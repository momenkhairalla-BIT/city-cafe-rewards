import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_EXPIRED_ENROLMENT_CODE,
  PREVIEW_SAMPLE_ENROLMENT_CODE,
} from '../demoAccounts';
import { PreviewTerminalRepository } from './previewTerminalRepository';

describe('PreviewTerminalRepository', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('enrols with sample code and binds Main Counter', async () => {
    const repo = new PreviewTerminalRepository();
    const result = await repo.enrol(PREVIEW_SAMPLE_ENROLMENT_CODE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.location.terminalCode).toBe('POS-MAIN-01');
      expect(result.location.branchName).toBe('Main Café');
      expect(result.location.salesPointName).toBe('Main Counter');
    }
    const status = await repo.getStatus();
    expect(status.enrolled).toBe(true);
  });

  it('rejects second use (single-use)', async () => {
    const repo = new PreviewTerminalRepository();
    await repo.enrol(PREVIEW_SAMPLE_ENROLMENT_CODE);
    repo.clearEnrolmentKeepConsumed();
    const second = await repo.enrol(PREVIEW_SAMPLE_ENROLMENT_CODE);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('ENROLMENT_CODE_CONSUMED');
  });

  it('rejects expired sample code', async () => {
    const repo = new PreviewTerminalRepository();
    const expired = await repo.enrol(PREVIEW_EXPIRED_ENROLMENT_CODE);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.code).toBe('ENROLMENT_CODE_EXPIRED');
  });

  it('rejects invalid code', async () => {
    const repo = new PreviewTerminalRepository();
    const invalid = await repo.enrol('admin123');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.code).toBe('INVALID_ENROLMENT_CODE');
  });

  it('simulates expiry of sample code', async () => {
    const repo = new PreviewTerminalRepository();
    repo.markSampleCodeExpired();
    const result = await repo.enrol(PREVIEW_SAMPLE_ENROLMENT_CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ENROLMENT_CODE_EXPIRED');
  });
});

describe('preview mode production gate', () => {
  it('documents fail-closed helper', async () => {
    vi.resetModules();
    const { isUiPreviewMode } = await import('../uiPreviewMode');
    expect(isUiPreviewMode({ DEV: false, VITE_UI_PREVIEW_MODE: 'true' })).toBe(false);
    expect(isUiPreviewMode({ DEV: true, VITE_UI_PREVIEW_MODE: 'true' })).toBe(true);
  });
});
