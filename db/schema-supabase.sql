-- =====================================================================
-- Pizza Shop - Supabase เพิ่มเติม
-- รันหลัง schema.sql (โครงสร้างตารางเป็น PostgreSQL ปกติ ใช้ไฟล์เดิมได้เลย)
-- วางใน Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) เปิด Row Level Security ทุกตาราง
--    Supabase เปิด API ให้ตารางอัตโนมัติ ถ้าไม่เปิด RLS = ใครก็อ่านได้
-- ---------------------------------------------------------------------
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE toppings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pizza_recipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_toppings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews             ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2) เมนู/ท็อปปิ้ง/โปรโมชั่น: ใครก็อ่านได้ (หน้าเว็บลูกค้าต้องใช้)
-- ---------------------------------------------------------------------
CREATE POLICY "menu readable by everyone" ON menu_items
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "variants readable by everyone" ON pizza_variants
  FOR SELECT USING (TRUE);

CREATE POLICY "categories readable by everyone" ON categories
  FOR SELECT USING (TRUE);

CREATE POLICY "toppings readable by everyone" ON toppings
  FOR SELECT USING (is_available = TRUE);

CREATE POLICY "active promotions readable" ON promotions
  FOR SELECT USING (is_active = TRUE AND end_date >= CURRENT_DATE);

-- ---------------------------------------------------------------------
-- 3) helper: เช็คว่าเป็นพนักงานไหม
--    (สมมติ map auth.users -> users ด้วยคอลัมน์ auth_uid ที่เพิ่มด้านล่าง)
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_uid = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_uid = auth.uid() AND role IN ('admin','manager') AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---------------------------------------------------------------------
-- 4) พนักงานจัดการเมนู / สต๊อก / ออเดอร์ได้
-- ---------------------------------------------------------------------
CREATE POLICY "staff manage menu"        ON menu_items      FOR ALL USING (is_admin());
CREATE POLICY "staff manage variants"    ON pizza_variants  FOR ALL USING (is_admin());
CREATE POLICY "staff manage ingredients" ON ingredients     FOR ALL USING (is_staff());
CREATE POLICY "staff read orders"        ON orders          FOR SELECT USING (is_staff());
CREATE POLICY "staff update orders"      ON orders          FOR UPDATE USING (is_staff());
CREATE POLICY "staff read order items"   ON order_items     FOR SELECT USING (is_staff());
CREATE POLICY "staff read customers"     ON customers       FOR SELECT USING (is_staff());

-- ---------------------------------------------------------------------
-- 5) ลูกค้าสร้างออเดอร์ของตัวเองได้ (กรณีให้เว็บยิงตรงเข้า Supabase)
--    หมายเหตุ: โปรเจกต์นี้สั่งซื้อผ่าน Express API เป็นหลัก
--    ซึ่งใช้ service_role key ที่ข้าม RLS อยู่แล้ว
-- ---------------------------------------------------------------------
CREATE POLICY "anyone can create order" ON orders
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "anyone can add order items" ON order_items
  FOR INSERT WITH CHECK (TRUE);

-- ---------------------------------------------------------------------
-- 6) Realtime: ให้ครัวเห็นออเดอร์ใหม่ทันทีโดยไม่ต้องกด refresh
-- ---------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ---------------------------------------------------------------------
-- 7) Storage: บัคเก็ตเก็บรูปเมนู (สร้างผ่าน Dashboard > Storage ก็ได้)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "menu images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'menu-images');

CREATE POLICY "staff upload menu images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'menu-images' AND is_admin());

-- ---------------------------------------------------------------------
-- 8) RPC: สร้างออเดอร์ในคำสั่งเดียว เรียกจากฝั่งเว็บได้
--    supabase.rpc('create_order', { p_customer_id: 1, p_items: [...] })
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_order(
  p_customer_id INT,
  p_order_type  TEXT,
  p_items       JSONB      -- [{"variant_id":6,"quantity":2}]
) RETURNS INT AS $$
DECLARE
  v_order_id  INT;
  v_subtotal  NUMERIC(10,2) := 0;
  v_item      JSONB;
  v_price     NUMERIC(10,2);
  v_menu_id   INT;
  v_fee       NUMERIC(10,2) := 0;
BEGIN
  IF p_order_type = 'delivery' THEN v_fee := 39; END IF;

  INSERT INTO orders (order_code, customer_id, order_type, status, delivery_fee)
  VALUES ('PZ' || to_char(now(), 'YYMMDD') || '-' || floor(random()*9000+1000),
          p_customer_id, p_order_type, 'pending', v_fee)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price, menu_item_id INTO v_price, v_menu_id
    FROM pizza_variants WHERE id = (v_item->>'variant_id')::INT;

    INSERT INTO order_items (order_id, menu_item_id, pizza_variant_id, quantity, unit_price, total_price)
    VALUES (v_order_id, v_menu_id, (v_item->>'variant_id')::INT,
            (v_item->>'quantity')::INT, v_price,
            v_price * (v_item->>'quantity')::INT);

    v_subtotal := v_subtotal + v_price * (v_item->>'quantity')::INT;
  END LOOP;

  UPDATE orders
  SET subtotal = v_subtotal, total_amount = v_subtotal + v_fee
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
