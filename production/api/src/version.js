/** App version — included in /health and startup logs */
export const APP_VERSION = 'v1.5-demo-ready';

export function healthMeta() {
  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
  };
}
