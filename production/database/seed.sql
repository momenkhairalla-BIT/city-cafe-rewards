-- Demo seed data (same students & menu as prototype)

INSERT INTO menu_items (slug, name, price, category, sort_order) VALUES
  ('latte', 'Latte', 8.00, 'Coffee', 1),
  ('americano', 'Americano', 6.00, 'Coffee', 2),
  ('cappuccino', 'Cappuccino', 9.00, 'Coffee', 3),
  ('mocha', 'Mocha', 10.00, 'Coffee', 4),
  ('iced-coffee', 'Iced Coffee', 7.00, 'Iced Drinks', 5),
  ('iced-latte', 'Iced Latte', 9.00, 'Iced Drinks', 6),
  ('matcha', 'Matcha Latte', 10.00, 'Iced Drinks', 7),
  ('chocolate-ice', 'Chocolate Ice', 8.00, 'Iced Drinks', 8),
  ('sandwich', 'Sandwich', 12.00, 'Food', 9),
  ('croissant', 'Croissant', 6.00, 'Food', 10),
  ('muffin', 'Muffin', 5.00, 'Food', 11),
  ('chicken-wrap', 'Chicken Wrap', 14.00, 'Food', 12),
  ('extra-shot', 'Extra Shot', 2.00, 'Add-ons', 13),
  ('oat-milk', 'Oat Milk', 3.00, 'Add-ons', 14),
  ('whipped-cream', 'Whipped Cream', 2.00, 'Add-ons', 15);

INSERT INTO vouchers (slug, name, points_required) VALUES
  ('v5', 'RM 5 Voucher', 100),
  ('v10', 'RM 10 Voucher', 180),
  ('pastry', 'Free Pastry', 150);

-- Placeholder password hashes — change before production (Staff@2024!, Admin@2024!)
INSERT INTO users (email, password_hash, role, full_name) VALUES
  ('staff@citycafe.edu.my', '$2b$10$placeholder_staff_hash_change_me', 'staff', 'Counter Staff'),
  ('admin@citycafe.edu.my', '$2b$10$placeholder_admin_hash_change_me', 'admin', 'Café Admin');

INSERT INTO students (student_id, programme, email) VALUES
  ('CU2024001', 'Bachelor of IT', 'ahmad.faiz@student.city.edu.my'),
  ('CU2024002', 'Diploma in Business', 'sarah.lim@student.city.edu.my'),
  ('CU2024003', 'Bachelor of Computer Science', 'kumar.raj@student.city.edu.my'),
  ('CU2024004', 'Diploma in IT', 'nur.aina@student.city.edu.my'),
  ('CU2024005', 'Master of IT', 'moimen.ali@student.city.edu.my');
