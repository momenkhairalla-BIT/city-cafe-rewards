/**
 * Demonstration credentials for UI PREVIEW MODE only.
 * Never treat these as production authentication.
 */

export const PREVIEW_DEMO_NOTICE =
  'Demonstration credentials for UI preview only — not production authentication.';

export const PREVIEW_SAMPLE_ENROLMENT_CODE = 'AIDA-482731';
export const PREVIEW_EXPIRED_ENROLMENT_CODE = 'AIDA-EXPIRED';

export const PREVIEW_DEMO_ACCOUNTS = {
  staff: {
    username: 'preview.staff',
    password: 'preview123',
    label: 'Sample Staff (POS)',
  },
  admin: {
    username: 'preview.admin',
    password: 'preview123',
    label: 'Sample Admin (Office)',
  },
  dual: {
    username: 'preview.dual',
    password: 'preview123',
    label: 'Sample Dual-role',
  },
} as const;
