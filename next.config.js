/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Environment variables
  env: {
    GOOGLE_ANALYTICS_ID: 'GTM-W24L468',
    GTM_ID: 'GTM-W24L468',
  },

  // Performance optimizations
  compress: true, // Enable gzip compression
  
  // Speed up static generation - don't wait for all pages
  staticPageGenerationTimeout: 60,

  // Image optimization - reduced sizes for faster builds
  images: {
    formats: ['image/webp'], // Remove avif - slower to generate
    deviceSizes: [640, 1080, 1920], // Reduced from 8 sizes to 3
    imageSizes: [64, 256, 384],
    minimumCacheTTL: 86400, // 24 hours
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compiler optimizations
  compiler: {
    styledComponents: {
      ssr: true,
      displayName: true,
      fileName: true,
    },
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', '@react-three/fiber', '@react-three/drei', 'three'],
    // Use webpack build worker for parallel processing
    webpackBuildWorker: true,
    // Parallelize server compilation
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
  },

  // Prevent Vercel from bundling public/ assets into serverless functions
  outputFileTracingExcludes: {
    '*': [
      'public/images/**',
      'public/background/**',
      'public/splats/**',
    ],
  },

  // Redirects for SEO: fix broken /docs/articles/ URLs and normalize domain
  async redirects() {
    return [
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
      // Fix for renamed article: ai-kill-switch → ai-kill-switch-postmortem
      {
        source: '/articles/ai-kill-switch',
        destination: '/articles/ai-kill-switch-postmortem',
        permanent: true,
      },
      // Redirect old hire-me page to current-work
      {
        source: '/hire-me',
        destination: '/current-work',
        permanent: true,
      },
    ];
  },

  // Headers for caching and security
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
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
