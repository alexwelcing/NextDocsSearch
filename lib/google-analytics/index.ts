// Ensure the env variable is always a string (or throw an error if not defined)
if (!process.env.GOOGLE_ANALYTICS_ID) {
    throw new Error("The GOOGLE_ANALYTICS_ID env variable is not set.");
}

const GOOGLE_ANALYTICS_ID = process.env.GOOGLE_ANALYTICS_ID as string;

export const pageview = (url: string) => {
    window.gtag('config', GOOGLE_ANALYTICS_ID, {
        page_path: url,
    });
}

// New function to handle custom events
export const trackEvent = (eventName: string, params: object = {}) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, params);
    }
}
