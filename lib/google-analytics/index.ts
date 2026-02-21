const GOOGLE_ANALYTICS_ID = process.env.GOOGLE_ANALYTICS_ID || ''

export const pageview = (url: string) => {
  if (!GOOGLE_ANALYTICS_ID || typeof window === 'undefined' || !window.gtag) return
  window.gtag('config', GOOGLE_ANALYTICS_ID, {
    page_path: url,
  })
}

export const trackEvent = (eventName: string, params: Record<string, string | number | boolean> = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
}
