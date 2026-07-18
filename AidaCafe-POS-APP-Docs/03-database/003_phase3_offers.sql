-- Phase 3: offer metadata on orders (additive only)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type TEXT;

-- Ensure default student drink offer note reflects Coffee + Iced Drinks (no data loss)
UPDATE offers SET offer_name = '10% Student Drink Discount'
WHERE slug = 'student-drink-10'
  AND offer_name IS DISTINCT FROM '10% Student Drink Discount';
