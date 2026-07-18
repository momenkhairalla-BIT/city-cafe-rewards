-- Migration 006: Branch / sales point / terminal foundation + order attribution columns
-- Phase 1A — additive only. Does NOT rename or drop students.
-- Does NOT create shifts table (Phase 2). orders.shift_id is UUID NULL without FK until then.
-- Timestamps: TIMESTAMPTZ stored in UTC.
--
-- ROLLBACK NOTES:
--   1. DROP INDEX IF EXISTS idx_orders_idempotency_scope;
--   2. ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_payload_hash;
--   3. ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;
--   4. ALTER TABLE orders DROP COLUMN IF EXISTS shift_id;
--   5. ALTER TABLE orders DROP COLUMN IF EXISTS terminal_id;
--   6. ALTER TABLE orders DROP COLUMN IF EXISTS sales_point_id;
--   7. ALTER TABLE orders DROP COLUMN IF EXISTS branch_id;
--   8. DROP TABLE IF EXISTS terminal_enrolment_codes;
--   9. DROP TABLE IF EXISTS terminals;
--  10. DROP TABLE IF EXISTS user_branch_access;
--  11. DROP TABLE IF EXISTS sales_points;
--  12. DROP TABLE IF EXISTS inventory_locations;
--  13. ALTER TABLE users DROP COLUMN IF EXISTS is_global_manager;
--  14. DROP TABLE IF EXISTS branches;
-- Safe only if no production dependence on these objects.

-- ---------------------------------------------------------------------------
-- branches (created before inventory_locations.branch_id FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- inventory_locations (optional branch_id; never infer access from emptiness)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  branch_id   UUID NULL REFERENCES branches(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_branch
  ON inventory_locations(branch_id);

-- ---------------------------------------------------------------------------
-- sales_points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_points (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                  UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code                       TEXT NOT NULL,
  name                       TEXT NOT NULL,
  inventory_location_id      UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  consolidates_to_branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  is_active                  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order                 INTEGER NOT NULL DEFAULT 0,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sales_points_branch ON sales_points(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_points_inventory ON sales_points(inventory_location_id);

-- ---------------------------------------------------------------------------
-- terminals (credential hash only; device_fingerprint is NOT authentication)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terminals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_point_id           UUID NOT NULL REFERENCES sales_points(id) ON DELETE RESTRICT,
  code                     TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'pending_enrolment',
  credential_hash          TEXT NULL,
  credential_issued_at     TIMESTAMPTZ NULL,
  credential_revoked_at    TIMESTAMPTZ NULL,
  replaced_by_terminal_id  UUID NULL REFERENCES terminals(id) ON DELETE SET NULL,
  device_fingerprint       TEXT NULL,
  last_heartbeat_at        TIMESTAMPTZ NULL,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT terminals_status_check
    CHECK (status IN ('pending_enrolment', 'active', 'revoked', 'replaced'))
);

CREATE INDEX IF NOT EXISTS idx_terminals_sales_point ON terminals(sales_point_id);
CREATE INDEX IF NOT EXISTS idx_terminals_status ON terminals(status);

CREATE TABLE IF NOT EXISTS terminal_enrolment_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id        UUID NOT NULL REFERENCES terminals(id) ON DELETE CASCADE,
  code_hash          TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  consumed_at        TIMESTAMPTZ NULL,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminal_enrolment_codes_terminal
  ON terminal_enrolment_codes(terminal_id);

-- ---------------------------------------------------------------------------
-- Explicit global manager flag — empty user_branch_access NEVER means global
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_global_manager BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- user_branch_access (explicit assignments only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_branch_access (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id        UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  can_operate_pos  BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage       BOOLEAN NOT NULL DEFAULT FALSE,
  is_default       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branch_access_user ON user_branch_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch ON user_branch_access(branch_id);

-- ---------------------------------------------------------------------------
-- orders: nullable attribution + idempotency (historical rows remain valid)
-- shift_id has no FK until shifts table exists (Phase 2)
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID NULL REFERENCES branches(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_point_id UUID NULL REFERENCES sales_points(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terminal_id UUID NULL REFERENCES terminals(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_id UUID NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_payload_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_sales_point_id ON orders(sales_point_id);
CREATE INDEX IF NOT EXISTS idx_orders_terminal_id ON orders(terminal_id);
CREATE INDEX IF NOT EXISTS idx_orders_shift_id ON orders(shift_id);

-- Scoped idempotency uniqueness (NULL keys excluded — historical / non-idempotent rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_scope
  ON orders (staff_user_id, terminal_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND terminal_id IS NOT NULL AND staff_user_id IS NOT NULL;
