-- Safe upgrade: members, offers, menu images, auth (do not drop existing data)

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

ALTER TABLE students ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS member_code TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'city_student';
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS barcode_value TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS qr_value TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE students ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE students ALTER COLUMN programme DROP NOT NULL;
ALTER TABLE students ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_member_code ON students(member_code) WHERE member_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_barcode ON students(barcode_value) WHERE barcode_value IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_phone ON students(phone) WHERE phone IS NOT NULL;

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_student_offer_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS offers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    TEXT NOT NULL UNIQUE,
  offer_name              TEXT NOT NULL,
  customer_type_eligibility TEXT NOT NULL DEFAULT 'city_student',
  discount_type           TEXT NOT NULL,
  discount_value          NUMERIC(10,2) NOT NULL DEFAULT 0,
  applies_to_category     TEXT,
  applies_to_product_ids  TEXT,
  start_date              DATE,
  end_date                DATE,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_used TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1;

-- Backfill city students
UPDATE students SET
  name = COALESCE(name, INITCAP(REPLACE(SPLIT_PART(email, '@', 1), '.', ' '))),
  member_code = COALESCE(member_code, 'CU-M-' || REPLACE(student_id, 'CU', '')),
  barcode_value = COALESCE(barcode_value, student_id),
  qr_value = COALESCE(qr_value, student_id),
  customer_type = COALESCE(customer_type, 'city_student')
WHERE student_id IS NOT NULL;

UPDATE menu_items SET is_student_offer_eligible = TRUE
WHERE category IN ('Coffee', 'Iced Drinks') AND slug IN ('latte', 'cappuccino', 'matcha', 'iced-latte');

INSERT INTO offers (slug, offer_name, customer_type_eligibility, discount_type, discount_value, applies_to_category, is_active)
SELECT v.slug, v.offer_name, v.eligibility, v.discount_type, v.discount_value, v.category, TRUE
FROM (VALUES
  ('student-drink-10', '10% Student Drink Discount', 'city_student', 'percentage', 10, 'Coffee'),
  ('student-combo', 'Student Combo: Coffee + Croissant RM 12', 'city_student', 'special_price', 12, 'Food'),
  ('double-points', 'Double Points Day (City Students)', 'city_student', 'double_points', 2, NULL),
  ('student-voucher-bonus', 'Student-Only Bonus Voucher Eligibility', 'city_student', 'fixed_amount', 5, NULL)
) AS v(slug, offer_name, eligibility, discount_type, discount_value, category)
WHERE NOT EXISTS (SELECT 1 FROM offers o WHERE o.slug = v.slug);

INSERT INTO students (student_id, name, programme, email, phone, member_code, barcode_value, qr_value, customer_type)
SELECT NULL, v.nm, NULL, v.em, v.ph, v.mc, v.bc, v.qr, 'general_customer'
FROM (VALUES
  ('Ali Rahman', 'ali.rahman@email.com', '60123456789', 'GC-M-001', 'GC001', 'GC001'),
  ('Mei Wong', 'mei.wong@email.com', '60198765432', 'GC-M-002', 'GC002', 'GC002'),
  ('Daniel Tan', NULL, '60112233445', 'GC-M-003', 'GC003', 'GC003'),
  ('Siti Aminah', 'siti.aminah@email.com', '60187654321', 'GC-M-004', 'GC004', 'GC004'),
  ('John Lee', 'john.lee@email.com', '60199887766', 'GC-M-005', 'GC005', 'GC005')
) AS v(nm, em, ph, mc, bc, qr)
WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.member_code = v.mc);

UPDATE users SET username = 'admin', password_hash = 'DEMO:admin123', role = 'admin', full_name = 'Café Admin', email = 'admin@citycafe.local'
WHERE email = 'admin@citycafe.edu.my' OR username = 'admin';

UPDATE users SET username = 'staff', password_hash = 'DEMO:staff123', role = 'staff', full_name = 'Counter Staff', email = 'staff@citycafe.local'
WHERE email = 'staff@citycafe.edu.my' OR username = 'staff';

INSERT INTO users (username, email, password_hash, role, full_name)
SELECT 'CU2024001', 'ahmad.faiz@student.city.edu.my', 'DEMO:demo123', 'customer', 'Ahmad Faiz'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'CU2024001');

INSERT INTO users (username, email, password_hash, role, full_name)
SELECT 'general001', 'ali.rahman@email.com', 'DEMO:demo123', 'customer', 'Ali Rahman'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'general001');
