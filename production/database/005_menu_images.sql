-- Phase 4: Menu image management (additive, safe to re-run)

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_alt TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_student_offer_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Ensure student-offer flags remain set for demo coffee items
UPDATE menu_items SET is_student_offer_eligible = TRUE
WHERE category IN ('Coffee', 'Iced Drinks') AND slug IN ('latte', 'cappuccino', 'matcha', 'iced-latte')
  AND is_student_offer_eligible = FALSE;

-- Demo best sellers (only if not already marked)
UPDATE menu_items SET is_best_seller = TRUE
WHERE slug IN ('latte', 'croissant', 'iced-latte') AND is_best_seller = FALSE;

-- Default image alt text from product name where missing
UPDATE menu_items SET image_alt = name
WHERE (image_alt IS NULL OR image_alt = '') AND name IS NOT NULL;
