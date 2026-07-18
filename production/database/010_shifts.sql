-- Migration 010: shifts domain (Phase 0 amended concurrency model)
-- Phase 2A — additive. Adds FK from orders.shift_id → shifts.
-- Default handover: close current shift, then open a new one (no simultaneous active).
--
-- ROLLBACK NOTES (temp/disposable only — never production):
--   1. ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shift_id_fkey;
--   2. DROP INDEX IF EXISTS idx_shifts_one_active_employee;
--   3. DROP INDEX IF EXISTS idx_shifts_one_active_terminal;
--   4. DROP TABLE IF EXISTS shifts;

CREATE TABLE IF NOT EXISTS shifts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terminal_id            UUID NOT NULL REFERENCES terminals(id) ON DELETE RESTRICT,
  sales_point_id         UUID NOT NULL REFERENCES sales_points(id) ON DELETE RESTRICT,
  branch_id              UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  staff_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status                 TEXT NOT NULL DEFAULT 'open',
  opening_float          NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_expected_cash  NUMERIC(12,2) NULL,
  closing_actual_cash    NUMERIC(12,2) NULL,
  cash_variance          NUMERIC(12,2) NULL,
  notes                  TEXT NULL,
  handover_notes         TEXT NULL,
  handover_to_user_id    UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  handover_at            TIMESTAMPTZ NULL,
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at              TIMESTAMPTZ NULL,
  closed_at              TIMESTAMPTZ NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shifts_status_check
    CHECK (status IN ('open', 'locked', 'closed')),
  CONSTRAINT shifts_closed_fields_check
    CHECK (
      (status = 'closed' AND closed_at IS NOT NULL)
      OR (status <> 'closed')
    ),
  CONSTRAINT shifts_locked_fields_check
    CHECK (
      (status = 'locked' AND locked_at IS NOT NULL)
      OR (status <> 'locked')
    )
);

-- At most one active (open|locked) shift per terminal
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_one_active_terminal
  ON shifts (terminal_id)
  WHERE status IN ('open', 'locked');

-- At most one active (open|locked) shift per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_one_active_employee
  ON shifts (staff_user_id)
  WHERE status IN ('open', 'locked');

CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts (branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_terminal ON shifts (terminal_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shifts (staff_user_id);

-- Wire historical nullable orders.shift_id to shifts (still nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shift_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_shift_id_fkey
      FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
  END IF;
END $$;
