-- Migration 009: terminal credential versioning + enrolment revocation
-- Phase 2A — additive on tables from 006.
-- device_fingerprint remains optional telemetry only (never auth).
--
-- ROLLBACK NOTES (temp/disposable only — never production):
--   1. ALTER TABLE terminal_enrolment_codes DROP COLUMN IF EXISTS revoked_at;
--   2. ALTER TABLE terminals DROP COLUMN IF EXISTS registered_by_user_id;
--   3. ALTER TABLE terminals DROP COLUMN IF EXISTS registered_at;
--   4. ALTER TABLE terminals DROP COLUMN IF EXISTS credential_version;

ALTER TABLE terminals
  ADD COLUMN IF NOT EXISTS credential_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE terminals
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NULL;

ALTER TABLE terminals
  ADD COLUMN IF NOT EXISTS registered_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE terminal_enrolment_codes
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_terminal_enrolment_codes_unconsumed
  ON terminal_enrolment_codes (terminal_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
