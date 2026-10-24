/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // `unoptimized` makes `next start` 404 the route, but Vercel's builder still provisions its own
  // managed optimizer for any build whose loader is 'default'; loader 'custom' (with no loaderFile
  // to call, since nothing renders next/image) is what turns it off there.
  images: {
    unoptimized: true,
    loader: 'custom',
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

  // Prevent Vercel from bundling public/ assets into serverless functions
  outputFileTracingExcludes: {
    '*': [
      'public/images/**',
      'public/background/**',
      'public/splats/**',
    ],
  },

  // The archive server source reads this generated file at runtime.
  outputFileTracingIncludes: {
    '/api/arc/archive': ['./lib/generated/article-manifest.json'],
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

module.exports = nextConfig
