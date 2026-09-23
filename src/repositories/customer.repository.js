import { pool } from '../config/db.js';

export const search = async ({ phone = null, name = null }, db = pool) => {
  const { rows } = await db.query(
    `SELECT * FROM customers
     WHERE ($1::text IS NULL OR phone_number = $1)
       AND ($2::text IS NULL OR (first_name || ' ' || COALESCE(last_name,'')) ILIKE '%' || $2 || '%')
     ORDER BY id DESC LIMIT 100`,
    [phone, name]
  );
  return rows;
};

export const findByIdWithAddresses = async (id, db = pool) => {
  const { rows } = await db.query(
    `SELECT c.*, COALESCE(json_agg(a.*) FILTER (WHERE a.id IS NOT NULL), '[]') AS addresses
     FROM customers c
     LEFT JOIN addresses a ON a.customer_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  return rows[0] || null;
};

/** สร้างใหม่ ถ้าเบอร์ซ้ำให้อัปเดตชื่อแทน */
export const upsertByPhone = async ({ first_name, last_name, phone_number, email }, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO customers (first_name, last_name, phone_number, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone_number) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name  = EXCLUDED.last_name,
           email      = COALESCE(EXCLUDED.email, customers.email)
     RETURNING *`,
    [first_name, last_name, phone_number, email]
  );
  return rows[0];
};

/**
 * หาลูกค้าจากเบอร์ ไม่มีก็สร้างใหม่ — ใช้กับออเดอร์ที่ลูกค้าสั่งเองโดยไม่ล็อกอิน
 * ถ้าเบอร์ซ้ำจะ "ไม่แก้ชื่อ/อีเมลเดิม" (ต่างจาก upsertByPhone ที่ทับข้อมูล) เพื่อกันคนอื่นแก้ข้อมูลลูกค้าด้วยเบอร์
 * DO UPDATE แบบไม่เปลี่ยนค่า ทำเพื่อให้ RETURNING คืนแถวเดิมกลับมา
 */
export const findOrCreateByPhone = async ({ first_name, last_name, phone_number, email }, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO customers (first_name, last_name, phone_number, email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone_number) DO UPDATE
       SET email = COALESCE(customers.email, EXCLUDED.email)   -- เติมอีเมลให้ลูกค้าเดิมที่ยังไม่เคยให้ไว้ แต่ไม่ทับของเดิม
     RETURNING id`,
    [first_name, last_name, phone_number, email]
  );
  return rows[0];
};

export const findAddressById = async (id, db = pool) => {
  const { rows } = await db.query('SELECT id, customer_id FROM addresses WHERE id = $1', [id]);
  return rows[0] || null;
};

export const clearDefaultAddress = async (customerId, db = pool) => {
  await db.query('UPDATE addresses SET is_default = FALSE WHERE customer_id = $1', [customerId]);
};

export const insertAddress = async (customerId, addr, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO addresses (customer_id, address_line, sub_district, district, province, postal_code, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, FALSE)) RETURNING *`,
    [customerId, addr.address_line, addr.sub_district, addr.district,
     addr.province, addr.postal_code, addr.is_default]
  );
  return rows[0];
};

export const addPoints = async (customerId, points, db = pool) => {
  if (!customerId || points <= 0) return;
  await db.query('UPDATE customers SET points = points + $1 WHERE id = $2', [points, customerId]);
};

/** ดึงแต้มคืนตอนยกเลิกออเดอร์ — GREATEST กันแต้มติดลบ ถ้าลูกค้าใช้แต้มไปแล้วบางส่วน */
export const removePoints = async (customerId, points, db = pool) => {
  if (!customerId || points <= 0) return;
  await db.query(
    'UPDATE customers SET points = GREATEST(points - $1, 0) WHERE id = $2',
    [points, customerId]
  );
};
