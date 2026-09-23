import { pool } from '../config/db.js';

/** โค้ดที่ลูกค้าใช้ได้ตอนนี้ — เปิดอยู่และอยู่ในช่วงวันที่ */
export const findUsable = async (db = pool) => {
  const { rows } = await db.query(
    `SELECT id, code, name, discount_type, discount_value, min_order_amount, end_date
     FROM promotions
     WHERE is_active = TRUE
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)
     ORDER BY min_order_amount, id`
  );
  return rows;
};

/** ทุกโค้ดรวมที่ปิดหรือหมดอายุแล้ว พร้อมจำนวนครั้งที่ถูกใช้ — สำหรับหลังร้าน */
export const findAll = async (db = pool) => {
  const { rows } = await db.query(
    `SELECT p.*, COUNT(o.id)::int AS used_count
     FROM promotions p
     LEFT JOIN orders o ON o.promotion_id = p.id AND o.status <> 'cancelled'
     GROUP BY p.id
     ORDER BY p.is_active DESC, p.id DESC`
  );
  return rows;
};

export const findByCode = async (code, db = pool) => {
  const { rows } = await db.query('SELECT * FROM promotions WHERE code = $1', [code]);
  return rows[0] || null;
};

export const insert = async (p, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO promotions
      (code, name, discount_type, discount_value, min_order_amount, start_date, end_date, is_active)
     VALUES ($1,$2,$3,$4,COALESCE($5,0),$6,$7,COALESCE($8,TRUE)) RETURNING *`,
    [p.code, p.name, p.discount_type, p.discount_value,
     p.min_order_amount, p.start_date, p.end_date, p.is_active]
  );
  return rows[0];
};

export const update = async (id, patch, db = pool) => {
  const { rows } = await db.query(
    `UPDATE promotions SET
       name             = COALESCE($1, name),
       discount_type    = COALESCE($2, discount_type),
       discount_value   = COALESCE($3, discount_value),
       min_order_amount = COALESCE($4, min_order_amount),
       start_date       = COALESCE($5, start_date),
       end_date         = COALESCE($6, end_date),
       is_active        = COALESCE($7, is_active)
     WHERE id = $8 RETURNING *`,
    [patch.name, patch.discount_type, patch.discount_value, patch.min_order_amount,
     patch.start_date, patch.end_date, patch.is_active, id]
  );
  return rows[0] || null;
};
