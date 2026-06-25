-- City Café Rewards — Production Schema (PostgreSQL)
-- Run via Docker Compose or any Postgres host (Neon, Railway, VPS).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('student', 'staff', 'admin');
CREATE TYPE payment_method AS ENUM ('Cash', 'Card', 'E-wallet', 'Student Wallet');
CREATE TYPE transaction_type AS ENUM ('Purchase', 'Reward', 'Free Drink', 'Free Drink Earned');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  full_name     TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  student_id            TEXT NOT NULL UNIQUE,
  programme             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  points                INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_purchases       INTEGER NOT NULL DEFAULT 0 CHECK (total_purchases >= 0),
  current_stamp_progress INTEGER NOT NULL DEFAULT 0 CHECK (current_stamp_progress >= 0 AND current_stamp_progress < 10),
  free_drinks_available INTEGER NOT NULL DEFAULT 0 CHECK (free_drinks_available >= 0),
  membership_status     TEXT NOT NULL DEFAULT 'Active Member',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_email ON students(email);

CREATE TABLE menu_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  price      NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category ON menu_items(category) WHERE is_active = TRUE;

CREATE TABLE vouchers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  points_required  INTEGER NOT NULL CHECK (points_required > 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT NOT NULL UNIQUE,
  student_id          UUID NOT NULL REFERENCES students(id),
  staff_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  transaction_type    transaction_type NOT NULL DEFAULT 'Purchase',
  subtotal            NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total               NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method      payment_method NOT NULL DEFAULT 'Cash',
  cash_received       NUMERIC(10,2),
  change_amount       NUMERIC(10,2),
  points_earned       INTEGER NOT NULL DEFAULT 0,
  points_used         INTEGER NOT NULL DEFAULT 0,
  stamp_before        INTEGER,
  stamp_after         INTEGER,
  free_drink_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  reward_name         TEXT,
  cashier_name        TEXT NOT NULL DEFAULT 'Counter Staff',
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_student_id ON orders(student_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  category    TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  line_total  NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Audit view: all loyalty-related events (matches prototype export needs)
CREATE VIEW loyalty_transactions AS
SELECT
  o.id,
  o.order_number,
  o.transaction_type,
  o.created_at,
  s.student_id AS student_code,
  s.email AS student_email,
  u.full_name AS student_name,
  s.programme,
  o.subtotal,
  o.discount,
  o.total,
  o.payment_method,
  o.points_earned,
  o.points_used,
  o.free_drink_unlocked,
  o.reward_name,
  o.cashier_name
FROM orders o
JOIN students s ON s.id = o.student_id
LEFT JOIN users u ON u.id = s.user_id;
