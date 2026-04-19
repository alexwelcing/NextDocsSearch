/** @type {import('next-sitemap').IConfig} */
function normalizeSiteUrl(rawUrl) {
  const defaultSiteUrl = 'https://alexwelcing.com'

  if (!rawUrl) {
    return defaultSiteUrl
  }

  try {
    const parsedUrl = new URL(rawUrl)

    if (parsedUrl.hostname === 'www.alexwelcing.com') {
      parsedUrl.hostname = 'alexwelcing.com'
    }

    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '')
    parsedUrl.search = ''
    parsedUrl.hash = ''

    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    return defaultSiteUrl
  }
}

const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com'
)

module.exports = {
  siteUrl,
  generateRobotsTxt: false, // We have a manual robots.txt in public/
  generateIndexSitemap: true,
  changefreq: 'daily',
  priority: 0.7,
  sitemapSize: 7000,
  exclude: [
    '/api/*',
    '/404',
    '/admin/*',
    '/chat',
    '/drafts/*',
    '/experiments/*',
    '/hire-me',
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
    // Current work page - professional focus
    else if (path === '/current-work') {
      priority = 0.9
      changefreq = 'weekly'
    }
    // Video pages
    else if (path.startsWith('/videos/')) {
      priority = 0.85
      changefreq = 'weekly'
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
    // Explore landing — primary entry to interactive layer
    else if (path === '/explore') {
      priority = 0.7
      changefreq = 'weekly'
    }
    // Explore sub-routes
    else if (path.startsWith('/explore/')) {
      priority = 0.7
      changefreq = 'monthly'
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    }
  },
  additionalPaths: async (config) => [
    await config.transform(config, '/explore'),
  ],
  additionalSitemaps: [
    `${siteUrl}/video-sitemap.xml`,
  ],
}
