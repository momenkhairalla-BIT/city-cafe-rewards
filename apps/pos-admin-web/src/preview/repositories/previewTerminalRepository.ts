import {
  PREVIEW_EXPIRED_ENROLMENT_CODE,
  PREVIEW_SAMPLE_ENROLMENT_CODE,
} from '../demoAccounts';
import {
  PREVIEW_MAIN_COUNTER_LOCATION,
  type TerminalRepository,
  type TerminalStatusResult,
} from './terminalAdapter';

const STORAGE_KEY = 'aida_ui_preview_terminal_v1';

type PreviewTerminalState = {
  enrolled: boolean;
  sampleCodeConsumed: boolean;
  /** When true, the sample valid code behaves as expired before use. */
  forceSampleExpired: boolean;
  enrolledAt: string | null;
};

function readState(): PreviewTerminalState {
  if (typeof sessionStorage === 'undefined') {
    return {
      enrolled: false,
      sampleCodeConsumed: false,
      forceSampleExpired: false,
      enrolledAt: null,
    };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        enrolled: false,
        sampleCodeConsumed: false,
        forceSampleExpired: false,
        enrolledAt: null,
      };
    }
    return JSON.parse(raw) as PreviewTerminalState;
  } catch {
    return {
      enrolled: false,
      sampleCodeConsumed: false,
      forceSampleExpired: false,
      enrolledAt: null,
    };
  }
}

function writeState(state: PreviewTerminalState) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Development-only terminal enrolment simulator.
 * Uses sessionStorage so a reload keeps enrolment; never talks to Neon/API.
 */
export class PreviewTerminalRepository implements TerminalRepository {
  getStatus(): Promise<TerminalStatusResult> {
    const state = readState();
    if (state.enrolled) {
      return Promise.resolve({ enrolled: true, location: PREVIEW_MAIN_COUNTER_LOCATION });
    }
    return Promise.resolve({ enrolled: false, code: 'TERMINAL_UNENROLLED' });
  }

  enrol(enrolmentCode: string) {
    const code = enrolmentCode.trim().toUpperCase();
    const state = readState();

    if (code === PREVIEW_EXPIRED_ENROLMENT_CODE || (code === PREVIEW_SAMPLE_ENROLMENT_CODE && state.forceSampleExpired)) {
      return Promise.resolve({
        ok: false as const,
        code: 'ENROLMENT_CODE_EXPIRED' as const,
        message: 'This enrolment code has expired. Ask a manager to issue a new code.',
      });
    }

    if (code === PREVIEW_SAMPLE_ENROLMENT_CODE) {
      if (state.sampleCodeConsumed) {
        return Promise.resolve({
          ok: false as const,
          code: 'ENROLMENT_CODE_CONSUMED' as const,
          message: 'This enrolment code was already used. Ask a manager for a new one-time code.',
        });
      }
      const next: PreviewTerminalState = {
        enrolled: true,
        sampleCodeConsumed: true,
        forceSampleExpired: false,
        enrolledAt: new Date().toISOString(),
      };
      writeState(next);
      return Promise.resolve({
        ok: true as const,
        location: PREVIEW_MAIN_COUNTER_LOCATION,
      });
    }

    return Promise.resolve({
      ok: false as const,
      code: 'INVALID_ENROLMENT_CODE' as const,
      message: 'Invalid enrolment code. Use the sample manager-issued code shown above in preview mode.',
    });
  }

  /** Demo control: make the next attempt of AIDA-482731 report expired. */
  markSampleCodeExpired() {
    const state = readState();
    writeState({ ...state, forceSampleExpired: true, enrolled: false });
  }

  /** Demo control: clear enrolment but keep consumed flag (single-use demo). */
  clearEnrolmentKeepConsumed() {
    const state = readState();
    writeState({
      ...state,
      enrolled: false,
      enrolledAt: null,
      forceSampleExpired: false,
    });
  }

  /** Full preview reset for QA. */
  clearLocalPreview() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const previewTerminalRepository = new PreviewTerminalRepository();
