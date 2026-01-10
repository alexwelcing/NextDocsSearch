/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://alexwelcing.com',
  generateRobotsTxt: false, // We have a manual robots.txt in public/
  generateIndexSitemap: true,
  changefreq: 'daily',
  priority: 0.7,
  sitemapSize: 7000,
  exclude: [
    '/api/*',
    '/404',
    '/character-studio',
    '/story-studio',
    '/chat',
  ],
  transform: async (config, path) => {
    // Custom priority for important pages based on SEO strategy
    let priority = 0.7
    let changefreq = 'daily'

    // Core pages - highest priority
    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    }
    // Hub pages - high priority (PageRank concentrators)
    else if (
      path === '/speculative-ai' ||
      path === '/agent-futures' ||
      path === '/emergent-intelligence'
    ) {
      priority = 0.95
      changefreq = 'weekly'
    }
    // About page
    else if (path === '/about') {
      priority = 0.9
      changefreq = 'monthly'
    }
    // Articles index
    else if (path === '/articles') {
      priority = 0.85
      changefreq = 'daily'
    }
    // Individual articles
    else if (path.startsWith('/articles/')) {
      priority = 0.8
      changefreq = 'weekly'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }
  },
  additionalSitemaps: [
    // Generate separate sitemaps for better crawl understanding
    // These will be referenced in robots.txt
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/drafts/', '/experiments/', '/_next/', '/character-studio', '/story-studio'],
      },
    ],
    additionalSitemaps: [
      'https://alexwelcing.com/sitemap-core.xml',
      'https://alexwelcing.com/sitemap-articles.xml',
    ],
  },
}
