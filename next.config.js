const fs = require('node:fs')
const path = require('node:path')

// Two targets build from the same commit. `pnpm build` is the Vercel server build. `pnpm build:cf`
// sets NEXT_OUTPUT=export: a static export into out/, served by the Cloudflare Worker's static
// assets (wrangler.jsonc), with redirects and headers moved to out/_redirects and out/_headers
// (scripts/cf-finalize.ts) and /api/* served by worker/index.ts.
const isExport = process.env.NEXT_OUTPUT === 'export'

// The export leaves out the Vercel-only server surface (pages/api/*.ts and middleware.ts) by page
// extension instead of moving files: every page is .tsx, and Next discovers pages and the
// middleware/proxy file through pageExtensions, so with ['tsx'] neither the API routes nor the
// middleware are compiled. Nothing in the checkout is moved, so a persistent workbench clone is
// never left dirty. The cost is a convention, enforced here: a non-.tsx file under pages/ outside
// pages/api would silently drop out of the export, so it fails the export build instead.
const EXPORT_PAGE_EXTENSIONS = ['tsx']
const PAGE_FILE = /\.(?:[cm]?[jt]sx?)$/

function assertExportablePages(dir = path.join(__dirname, 'pages'), rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.posix.join(rel, entry.name)
    if (entry.isDirectory()) {
      if (file !== 'api') assertExportablePages(path.join(dir, entry.name), file)
    } else if (PAGE_FILE.test(entry.name) && !entry.name.endsWith('.tsx')) {
      throw new Error(
        `next.config.js: pages/${file} is not .tsx, so the static export (pageExtensions ` +
          `${JSON.stringify(EXPORT_PAGE_EXTENSIONS)}) would drop it. Rename it to .tsx.`
      )
    }
  }
}
if (isExport) assertExportablePages()

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isExport
    ? {
        output: 'export',
        pageExtensions: EXPORT_PAGE_EXTENSIONS,
        // about.html, articles/<slug>.html: the assets binding's html_handling
        // 'auto-trailing-slash' serves them at /about and /articles/<slug> (no trailing slash,
        // as on Vercel) and 307s /about/ to /about.
        trailingSlash: false,
      }
    : {}),

  // StrictMode double-mounting destroys the first WebGPURenderer while its async init is still in
  // flight (device lost -> permanent black canvas), so it stays off for the immersive app.
  reactStrictMode: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Environment variables
  env: {
    GOOGLE_ANALYTICS_ID: 'GTM-W24L468',
    GTM_ID: 'GTM-W24L468',
  },

  // Performance optimizations
  compress: true, // Enable gzip compression

  // Nothing uses next/image, so the /_next/image optimizer is pure attack surface (the SVG and AVIF
  // RCE advisories GHSA-2464-fhr4-w9xw / GHSA-2xp9-vwfh-vxw4 live there). Keep it switched off.
  // This 404s the route under `next start` and keeps the images config out of Vercel's build output,
  // but Vercel still answers /_next/image with its platform-default optimizer (WebP only, SVG
  // refused, local sources only) whatever the loader; only leaving Vercel's Next runtime ends that.
  images: {
    unoptimized: true,
  },

  // Compiler optimizations
  compiler: {
    styledComponents: true,
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@react-three/fiber'],
  },

  // The Vercel server surface: function tracing, redirects and headers. A static export has no
  // server, so these move to out/_redirects and out/_headers (scripts/cf-finalize.ts) and are
  // left out of it (Next only warns about them there).
  ...(isExport ? {} : serverOnly()),
}

function serverOnly() {
  return {
    // Prevent Vercel from bundling public/ assets into serverless functions
    outputFileTracingExcludes: {
      '*': [
        'public/images/**',
        'public/background/**',
        'public/splats/**',
      ],
    },

    // The archive server source reads this generated file at runtime, and Ship reads the search
    // index from disk (lib/ship/node.ts) rather than self-fetching it.
    outputFileTracingIncludes: {
      '/api/arc/archive': ['./lib/generated/article-manifest.json'],
      '/api/vector-search': [
        './lib/generated/article-manifest.json',
        './lib/generated/search-manifest.json',
        './public/search/**',
      ],
    },

    // Redirects for SEO: fix broken /docs/articles/ URLs and normalize domain
    async redirects() {
      return [
        // /explore was retired: the 3D experience now starts directly from /
        {
          source: '/explore',
          destination: '/',
          permanent: true,
        },
        // Root Cause #3: Redirect old /docs/articles/ URLs to /articles/
        {
          source: '/docs/articles/:slug',
          destination: '/articles/:slug',
          permanent: true,
        },
        // Catch /docs/articles without a slug too
        {
          source: '/docs/articles',
          destination: '/articles',
          permanent: true,
        },
      ];
    },

    // Headers for caching and security
    async headers() {
      return [
        {
          source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
        {
          source: '/_next/static/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ];
    },
  }
}

module.exports = nextConfig
