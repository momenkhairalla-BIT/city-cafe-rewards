-- Migration 008: staff_credentials + employee_sessions + dual-role flag
-- Phase 2A — additive. Never stores raw PINs/passwords/badge values.
-- Password hashes reuse bcrypt (same as users.password_hash). Badge/barcode
-- lookup uses keyed digest only; PIN verified via bcrypt secret_hash.
--
-- ROLLBACK NOTES (temp/disposable only — never production):
--   1. DROP TABLE IF EXISTS employee_sessions;
--   2. DROP TABLE IF EXISTS staff_credentials;
--   3. ALTER TABLE users DROP COLUMN IF EXISTS dual_role_pos_enabled;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dual_role_pos_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- staff_credentials
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_credentials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type    TEXT NOT NULL,
  lookup_digest      TEXT NULL,
  secret_hash        TEXT NOT NULL,
  credential_version INTEGER NOT NULL DEFAULT 1,
  is_enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at         TIMESTAMPTZ NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_credentials_type_check
    CHECK (credential_type IN ('password', 'badge_pin', 'barcode_pin')),
  CONSTRAINT staff_credentials_enabled_revoked_check
    CHECK (is_enabled = TRUE OR revoked_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_credentials_one_password
  ON staff_credentials (user_id)
  WHERE credential_type = 'password' AND is_enabled = TRUE AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_credentials_lookup_digest
  ON staff_credentials (lookup_digest)
  WHERE lookup_digest IS NOT NULL AND is_enabled = TRUE AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_credentials_user
  ON staff_credentials (user_id);

-- Compatibility: copy existing staff/admin password hashes into staff_credentials
-- without weakening them (same bcrypt / DEMO: values).
INSERT INTO staff_credentials (user_id, credential_type, secret_hash, credential_version, is_enabled)
SELECT u.id, 'password', u.password_hash, 1, TRUE
FROM users u
WHERE u.role IN ('staff', 'admin')
  AND u.password_hash IS NOT NULL
  AND u.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM staff_credentials sc
    WHERE sc.user_id = u.id
      AND sc.credential_type = 'password'
      AND sc.is_enabled = TRUE
      AND sc.revoked_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- employee_sessions (opaque token hash only — never store raw token)
-- Dynamic terminal/location/shift MUST NOT live here as authoritative claims.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL UNIQUE,
  auth_method         TEXT NOT NULL,
  selected_product    TEXT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idle_expires_at     TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ NULL,
  CONSTRAINT employee_sessions_auth_method_check
    CHECK (auth_method IN ('password', 'badge_pin', 'barcode_pin')),
  CONSTRAINT employee_sessions_product_check
    CHECK (selected_product IS NULL OR selected_product IN ('pos', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_user
  ON employee_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_active
  ON employee_sessions (token_hash)
  WHERE revoked_at IS NULL;
