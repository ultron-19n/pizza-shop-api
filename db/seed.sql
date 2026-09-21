-- =====================================================================
-- Pizza Shop - Seed Data
-- รันหลังจาก schema.sql
-- =====================================================================

-- ---------- CATEGORIES ----------
INSERT INTO categories (name, description) VALUES
  ('พิซซ่า',      'พิซซ่าอบสดใหม่ทุกถาด'),
  ('ของทานเล่น',  'ไก่ทอด เฟรนช์ฟรายส์ ขนมปังกระเทียม'),
  ('เครื่องดื่ม',  'น้ำอัดลม น้ำผลไม้'),
  ('ของหวาน',     'ขนมหวานหลังมื้ออาหาร')
ON CONFLICT DO NOTHING;

-- ---------- MENU ITEMS ----------
INSERT INTO menu_items (category_id, name, description, image_url) VALUES
  (1, 'Margherita',      'ซอสมะเขือเทศ มอสซาเรลล่า โหระพา',            '/images/margherita.jpg'),
  (1, 'Pepperoni',       'เปปเปอโรนีเต็มหน้า ชีสยืด',                   '/images/pepperoni.jpg'),
  (1, 'Hawaiian',        'แฮม สับปะรด ชีสมอสซาเรลล่า',                  '/images/hawaiian.jpg'),
  (1, 'Seafood Deluxe',  'กุ้ง ปลาหมึก ปูอัด ซอสครีม',                  '/images/seafood.jpg'),
  (1, 'BBQ Chicken',     'ไก่ย่างซอสบาร์บีคิว หอมใหญ่',                 '/images/bbq-chicken.jpg'),
  (2, 'ไก่ทอด 5 ชิ้น',    'ไก่ทอดกรอบนอกนุ่มใน',                         '/images/fried-chicken.jpg'),
  (2, 'ขนมปังกระเทียม',  'อบเนยกระเทียมหอม',                            '/images/garlic-bread.jpg'),
  (3, 'โค้ก 1.25 ลิตร',  'เย็นเจี๊ยบ',                                  '/images/coke.jpg'),
  (4, 'ช็อกโกแลตลาวา',   'ช็อกโกแลตไหลเยิ้ม',                           '/images/lava.jpg')
ON CONFLICT DO NOTHING;

-- ---------- PIZZA VARIANTS ----------
-- Margherita
INSERT INTO pizza_variants (menu_item_id, size, crust, sauce, price) VALUES
  (1, 'S', 'classic', 'tomato', 159.00),
  (1, 'M', 'classic', 'tomato', 259.00),
  (1, 'L', 'classic', 'tomato', 359.00),
  (1, 'M', 'thin',    'tomato', 269.00),
-- Pepperoni
  (2, 'S', 'classic', 'tomato', 179.00),
  (2, 'M', 'classic', 'tomato', 289.00),
  (2, 'L', 'classic', 'tomato', 389.00),
  (2, 'L', 'cheese_burst', 'tomato', 439.00),
-- Hawaiian
  (3, 'S', 'classic', 'tomato', 169.00),
  (3, 'M', 'classic', 'tomato', 279.00),
  (3, 'L', 'pan',     'tomato', 379.00),
-- Seafood Deluxe
  (4, 'M', 'classic', 'creamy', 329.00),
  (4, 'L', 'classic', 'creamy', 429.00),
-- BBQ Chicken
  (5, 'M', 'pan',     'bbq',    299.00),
  (5, 'L', 'pan',     'bbq',    399.00),
-- Non-pizza (ใช้ variant เดียวเพื่อให้คิดราคาได้เหมือนกัน)
  (6, 'STD', '-', '-', 129.00),
  (7, 'STD', '-', '-',  69.00),
  (8, 'STD', '-', '-',  45.00),
  (9, 'STD', '-', '-',  59.00)
ON CONFLICT DO NOTHING;

-- ---------- TOPPINGS ----------
INSERT INTO toppings (name, price) VALUES
  ('ชีสเพิ่ม',      39.00),
  ('เปปเปอโรนี',    45.00),
  ('เห็ด',          29.00),
  ('หอมใหญ่',       19.00),
  ('พริกหยวก',      19.00),
  ('สับปะรด',       25.00),
  ('เบคอน',         49.00),
  ('กุ้ง',          59.00),
  ('มะกอกดำ',       29.00)
ON CONFLICT DO NOTHING;

-- ---------- INGREDIENTS ----------
INSERT INTO ingredients (name, stock_quantity, unit, min_required_quantity) VALUES
  ('แป้งพิซซ่า',        50.00, 'kg',   10.00),
  ('ซอสมะเขือเทศ',      30.00, 'kg',    5.00),
  ('ซอสบาร์บีคิว',      12.00, 'kg',    3.00),
  ('ซอสครีม',           10.00, 'kg',    3.00),
  ('ชีสมอสซาเรลล่า',    40.00, 'kg',   10.00),
  ('เปปเปอโรนี',        15.00, 'kg',    4.00),
  ('แฮม',               12.00, 'kg',    3.00),
  ('สับปะรด',           18.00, 'kg',    4.00),
  ('กุ้ง',               8.00, 'kg',    2.00),
  ('ปลาหมึก',            6.00, 'kg',    2.00),
  ('อกไก่',             20.00, 'kg',    5.00),
  ('หอมใหญ่',           14.00, 'kg',    3.00),
  ('โหระพา',             2.00, 'kg',    0.50),
  ('น้ำมันมะกอก',        9.00, 'l',     2.00)
ON CONFLICT DO NOTHING;

-- ---------- RECIPES (ตัวอย่างสูตร: ใช้ตัดสต๊อกอัตโนมัติเมื่อขาย) ----------
-- Margherita M (variant 2)
INSERT INTO pizza_recipes (pizza_variant_id, ingredient_id, quantity_used) VALUES
  (2, 1, 0.30), (2, 2, 0.12), (2, 5, 0.20), (2, 13, 0.01), (2, 14, 0.02),
-- Margherita L (variant 3)
  (3, 1, 0.45), (3, 2, 0.18), (3, 5, 0.30), (3, 13, 0.02), (3, 14, 0.03),
-- Pepperoni M (variant 6)
  (6, 1, 0.30), (6, 2, 0.12), (6, 5, 0.22), (6, 6, 0.15),
-- Pepperoni L (variant 7)
  (7, 1, 0.45), (7, 2, 0.18), (7, 5, 0.32), (7, 6, 0.22),
-- Hawaiian M (variant 10)
  (10, 1, 0.30), (10, 2, 0.12), (10, 5, 0.20), (10, 7, 0.12), (10, 8, 0.15),
-- Seafood M (variant 12)
  (12, 1, 0.30), (12, 4, 0.15), (12, 5, 0.20), (12, 9, 0.12), (12, 10, 0.10),
-- BBQ Chicken M (variant 14)
  (14, 1, 0.30), (14, 3, 0.14), (14, 5, 0.20), (14, 11, 0.18), (14, 12, 0.06)
ON CONFLICT DO NOTHING;

-- ---------- PROMOTIONS ----------
INSERT INTO promotions (code, name, discount_type, discount_value, min_order_amount, start_date, end_date) VALUES
  ('WELCOME10', 'ลูกค้าใหม่ลด 10%', 'percent', 10.00, 200.00, CURRENT_DATE, CURRENT_DATE + 90),
  ('SAVE50',    'ลด 50 บาท เมื่อครบ 500', 'amount', 50.00, 500.00, CURRENT_DATE, CURRENT_DATE + 30)
ON CONFLICT DO NOTHING;

-- ---------- CUSTOMERS ----------
INSERT INTO customers (first_name, last_name, phone_number, email, points) VALUES
  ('สมชาย', 'ใจดี',    '0812345678', 'somchai@example.com', 120),
  ('สมหญิง', 'รักพิซซ่า', '0898765432', 'somying@example.com', 40),
  ('ปิติ',  'มีสุข',    '0855551234', 'piti@example.com', 0)
ON CONFLICT DO NOTHING;

INSERT INTO addresses (customer_id, address_line, sub_district, district, province, postal_code, is_default) VALUES
  (1, '99/1 หมู่ 3 ซอยสุขสบาย', 'บางรัก',   'บางรัก',   'กรุงเทพมหานคร', '10500', TRUE),
  (2, '12 ถนนนิมมานเหมินท์',   'สุเทพ',     'เมือง',    'เชียงใหม่',     '50200', TRUE)
ON CONFLICT DO NOTHING;

-- หมายเหตุ: ผู้ใช้งาน (users) ให้สร้างผ่าน API POST /api/auth/register
-- เพื่อให้ password ถูกเข้ารหัสด้วย bcrypt อย่างถูกต้อง
