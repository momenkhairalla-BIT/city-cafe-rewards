export type PreviewEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_UI_PREVIEW_MODE?: string;
};

/**
 * Development-only fixture mode.
 * Production builds must fail closed if VITE_UI_PREVIEW_MODE=true (vite.config.ts).
 */
export function isUiPreviewMode(env: PreviewEnv = import.meta.env as PreviewEnv): boolean {
  return env.DEV === true && env.VITE_UI_PREVIEW_MODE === 'true';
}

export const UI_PREVIEW_LABEL = 'UI PREVIEW — SAMPLE DATA';
