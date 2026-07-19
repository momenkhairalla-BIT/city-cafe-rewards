import { describe, expect, it } from 'vitest';
import { isUiPreviewMode } from './uiPreviewMode';

describe('isUiPreviewMode', () => {
  it('returns true only when DEV and VITE_UI_PREVIEW_MODE=true', () => {
    expect(isUiPreviewMode({ DEV: true, VITE_UI_PREVIEW_MODE: 'true' })).toBe(true);
  });

  it('returns false in production even with flag', () => {
    expect(isUiPreviewMode({ PROD: true, DEV: false, VITE_UI_PREVIEW_MODE: 'true' })).toBe(false);
  });

  it('returns false in dev without flag', () => {
    expect(isUiPreviewMode({ DEV: true, VITE_UI_PREVIEW_MODE: undefined })).toBe(false);
    expect(isUiPreviewMode({ DEV: true, VITE_UI_PREVIEW_MODE: 'false' })).toBe(false);
  });
});
