-- Migration 007: Idempotent seed — Main Cafe branch, shared inventory, Main Counter + Snack Station
-- Snack Station is a sales point under Main Cafe (NOT a separate branch).
-- Terminals seeded as pending_enrolment (enrolment workflow is Phase 2 — not activated here).
-- Does NOT grant global access via empty user_branch_access.
-- Explicitly sets is_global_manager=TRUE only for username 'admin' when that user exists.
--
-- ROLLBACK NOTES:
--   DELETE FROM terminal_enrolment_codes WHERE terminal_id IN (
--     SELECT id FROM terminals WHERE code IN ('POS-MAIN-01', 'POS-SNACK-01'));
--   DELETE FROM terminals WHERE code IN ('POS-MAIN-01', 'POS-SNACK-01');
--   DELETE FROM sales_points WHERE code IN ('SP-MAIN', 'SP-SNACK');
--   DELETE FROM inventory_locations WHERE code = 'INV-MAIN';
--   DELETE FROM user_branch_access WHERE branch_id = (SELECT id FROM branches WHERE code = 'BR-MAIN');
--   UPDATE users SET is_global_manager = FALSE WHERE username = 'admin';
--   DELETE FROM branches WHERE code = 'BR-MAIN';
-- Only run rollback if these seed rows are unused by live orders.

-- Branch
INSERT INTO branches (code, name, timezone, is_active)
SELECT 'BR-MAIN', 'Aida Cafe Main', 'Asia/Kuala_Lumpur', TRUE
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'BR-MAIN');

-- Shared inventory location (linked to main branch)
INSERT INTO inventory_locations (code, name, branch_id, is_active)
SELECT 'INV-MAIN', 'Main Cafe Store', b.id, TRUE
FROM branches b
WHERE b.code = 'BR-MAIN'
  AND NOT EXISTS (SELECT 1 FROM inventory_locations WHERE code = 'INV-MAIN');

-- Ensure inventory points at main branch if row already existed without FK
UPDATE inventory_locations il
SET branch_id = b.id,
    updated_at = NOW()
FROM branches b
WHERE il.code = 'INV-MAIN'
  AND b.code = 'BR-MAIN'
  AND (il.branch_id IS DISTINCT FROM b.id);

-- Main Counter sales point
INSERT INTO sales_points (
  branch_id, code, name, inventory_location_id, consolidates_to_branch_id, is_active, sort_order
)
SELECT b.id, 'SP-MAIN', 'Main Counter', inv.id, b.id, TRUE, 1
FROM branches b
CROSS JOIN inventory_locations inv
WHERE b.code = 'BR-MAIN'
  AND inv.code = 'INV-MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM sales_points sp WHERE sp.branch_id = b.id AND sp.code = 'SP-MAIN'
  );

-- Second Floor Snack Station — sales point under Main Cafe (same branch + shared inventory)
INSERT INTO sales_points (
  branch_id, code, name, inventory_location_id, consolidates_to_branch_id, is_active, sort_order
)
SELECT b.id, 'SP-SNACK', 'Snack Station (Level 2)', inv.id, b.id, TRUE, 2
FROM branches b
CROSS JOIN inventory_locations inv
WHERE b.code = 'BR-MAIN'
  AND inv.code = 'INV-MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM sales_points sp WHERE sp.branch_id = b.id AND sp.code = 'SP-SNACK'
  );

-- Terminal placeholders (pending enrolment — Phase 2 activates auth workflow)
INSERT INTO terminals (sales_point_id, code, name, status, is_active)
SELECT sp.id, 'POS-MAIN-01', 'Main Counter Terminal 1', 'pending_enrolment', TRUE
FROM sales_points sp
JOIN branches b ON b.id = sp.branch_id
WHERE b.code = 'BR-MAIN' AND sp.code = 'SP-MAIN'
  AND NOT EXISTS (SELECT 1 FROM terminals WHERE code = 'POS-MAIN-01');

INSERT INTO terminals (sales_point_id, code, name, status, is_active)
SELECT sp.id, 'POS-SNACK-01', 'Snack Station Terminal 1', 'pending_enrolment', TRUE
FROM sales_points sp
JOIN branches b ON b.id = sp.branch_id
WHERE b.code = 'BR-MAIN' AND sp.code = 'SP-SNACK'
  AND NOT EXISTS (SELECT 1 FROM terminals WHERE code = 'POS-SNACK-01');

-- Explicit global manager flag for demo admin account (NOT inferred from empty access)
UPDATE users
SET is_global_manager = TRUE,
    updated_at = NOW()
WHERE username = 'admin'
  AND is_global_manager IS DISTINCT FROM TRUE;

-- Explicit staff branch assignment when staff user exists
INSERT INTO user_branch_access (user_id, branch_id, can_operate_pos, can_manage, is_default)
SELECT u.id, b.id, TRUE, FALSE, TRUE
FROM users u
CROSS JOIN branches b
WHERE u.username = 'staff'
  AND b.code = 'BR-MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_branch_access uba
    WHERE uba.user_id = u.id AND uba.branch_id = b.id
  );

-- Explicit admin branch assignment (in addition to is_global_manager — still not via emptiness)
INSERT INTO user_branch_access (user_id, branch_id, can_operate_pos, can_manage, is_default)
SELECT u.id, b.id, TRUE, TRUE, TRUE
FROM users u
CROSS JOIN branches b
WHERE u.username = 'admin'
  AND b.code = 'BR-MAIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_branch_access uba
    WHERE uba.user_id = u.id AND uba.branch_id = b.id
  );
