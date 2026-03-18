const DEFAULT_SITE_URL = 'https://alexwelcing.com'

export function normalizeSiteUrl(rawUrl?: string | null): string {
  if (!rawUrl) {
    return DEFAULT_SITE_URL
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
    return DEFAULT_SITE_URL
  }
}

export const SITE_URL = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL
)