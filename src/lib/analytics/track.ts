export const GA_MEASUREMENT_ID = "G-W2PJW4MVEX";

type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: GtagParams) => void;
  }
}

export function trackEvent(name: string, params?: GtagParams) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}
