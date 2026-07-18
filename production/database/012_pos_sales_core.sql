-- Phase 3A: POS server-authoritative sales foundation (additive)
-- Target: temporary Neon branch only — never production parent.
--
-- Rollback notes (manual, order matters):
--   1. DROP SEQUENCE IF EXISTS order_number_seq;
--   2. DROP INDEX IF EXISTS idx_voucher_redemptions_student_voucher_unique;
--   3. DROP TABLE IF EXISTS voucher_redemptions;
--   4. ALTER TABLE shifts DROP COLUMN IF EXISTS cash_sales_total;
--      ALTER TABLE shifts DROP COLUMN IF EXISTS non_cash_sales_total;
--      ALTER TABLE shifts DROP COLUMN IF EXISTS sale_count;
--   5. ALTER TABLE order_items DROP COLUMN IF EXISTS menu_item_id;
--   6. ALTER TABLE orders DROP COLUMN IF EXISTS is_guest;
--      ALTER TABLE orders DROP COLUMN IF EXISTS employee_session_id;
--      ALTER TABLE orders DROP COLUMN IF EXISTS external_payment_ref;
--      ALTER TABLE orders DROP COLUMN IF EXISTS auth_method;
--   7. Re-add NOT NULL on orders.student_id only after no guest rows remain:
--      DELETE FROM orders WHERE student_id IS NULL; -- only if discarding guests
--      ALTER TABLE orders ALTER COLUMN student_id SET NOT NULL;
--   8. Recreate loyalty_transactions view if replaced (see below).
-- Historical member orders are preserved. Guest nullability is additive.

-- ---------------------------------------------------------------------------
-- Guest sales: member FK nullable
-- ---------------------------------------------------------------------------
ALTER TABLE orders ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS employee_session_id UUID NULL
  REFERENCES employee_sessions(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_payment_ref TEXT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auth_method TEXT NULL;

COMMENT ON COLUMN orders.external_payment_ref IS
  'Optional non-sensitive soft-POS reference only. Never PAN/CVV/track data.';
COMMENT ON COLUMN orders.is_guest IS
  'True when sale has no member; student_id NULL; no loyalty mutation.';

-- ---------------------------------------------------------------------------
-- Order item menu linkage (unit_price remains the historical snapshot)
-- ---------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS menu_item_id UUID NULL
  REFERENCES menu_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- ---------------------------------------------------------------------------
-- Concurrency-safe order numbers
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- ---------------------------------------------------------------------------
-- Shift sale aggregates (expected closing cash = opening_float + cash_sales_total)
-- ---------------------------------------------------------------------------
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0
  CHECK (cash_sales_total >= 0);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS non_cash_sales_total NUMERIC(12,2) NOT NULL DEFAULT 0
  CHECK (non_cash_sales_total >= 0);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS sale_count INTEGER NOT NULL DEFAULT 0
  CHECK (sale_count >= 0);

-- ---------------------------------------------------------------------------
-- Voucher redemption ledger (prevents double-redeem of same voucher on a member
-- within a sale path; points catalog vouchers are once-per-order via UNIQUE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id  UUID NOT NULL REFERENCES vouchers(id),
  student_id  UUID NOT NULL REFERENCES students(id),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  points_used INTEGER NOT NULL CHECK (points_used > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_student ON voucher_redemptions(student_id);

-- Optional once-per-member voucher policy for catalog redemptions recorded here
CREATE UNIQUE INDEX IF NOT EXISTS idx_voucher_redemptions_student_voucher_unique
  ON voucher_redemptions (student_id, voucher_id);

-- ---------------------------------------------------------------------------
-- Reporting view: allow guest rows (LEFT JOIN)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW loyalty_transactions AS
SELECT
  o.id,
  o.order_number,
  o.transaction_type,
  o.created_at,
  s.student_id AS student_code,
  s.email AS student_email,
  COALESCE(s.name, u.full_name) AS student_name,
  s.programme,
  o.subtotal,
  o.discount,
  o.total,
  o.payment_method,
  o.points_earned,
  o.points_used,
  o.free_drink_unlocked,
  o.reward_name,
  o.cashier_name,
  o.is_guest,
  o.branch_id,
  o.sales_point_id,
  o.terminal_id,
  o.shift_id
FROM orders o
LEFT JOIN students s ON s.id = o.student_id
LEFT JOIN users u ON u.id = s.user_id;
