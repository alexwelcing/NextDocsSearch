/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://alexwelcing.com',
  generateRobotsTxt: false, // We have a manual robots.txt in public/
  generateIndexSitemap: true,
  changefreq: 'daily',
  priority: 0.7,
  sitemapSize: 7000,
  exclude: [
    '/api/*', // Exclude API routes
    '/404', // Exclude 404 page
  ],
  transform: async (config, path) => {
    // Custom priority for important pages
    let priority = 0.7
    let changefreq = 'daily'

    if (path === '/') {
      priority = 1.0
      changefreq = 'daily'
    } else if (path.startsWith('/articles/')) {
      priority = 0.8
      changefreq = 'weekly'
    } else if (path === '/about' || path === '/chat') {
      priority = 0.9
      changefreq = 'weekly'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }
  },
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
}
