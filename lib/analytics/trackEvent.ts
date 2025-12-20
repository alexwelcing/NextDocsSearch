export type AnalyticsEvent =
  | 'session_start'
  | 'chapter_unlock'
  | 'ai_chat'
  | 'game_play'
  | 'game_finish'
  | 'share'
  | 'ab_test_variant'
  | 'performance_metrics'
  | 'feedback_submit';

type AnalyticsPayload = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    posthog?: { capture: (event: string, properties?: AnalyticsPayload) => void };
  }
}

export const trackEvent = (event: AnalyticsEvent, params: AnalyticsPayload = {}) => {
  if (typeof window === 'undefined') return;

  if (window.posthog?.capture) {
    window.posthog.capture(event, params);
  }

  if (window.gtag) {
    window.gtag('event', event, params);
  }

  if (process.env.NODE_ENV === 'development') {
    console.info(`[analytics] ${event}`, params);
  }
};
