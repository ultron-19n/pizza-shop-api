import { pool } from '../config/db.js';

export const findAll = async (db = pool) => {
  const { rows } = await db.query(
    `SELECT *, (stock_quantity <= min_required_quantity) AS is_low
     FROM ingredients ORDER BY id`
  );
  return rows;
};

export const findLowStock = async (db = pool) => {
  const { rows } = await db.query('SELECT * FROM v_low_stock');
  return rows;
};

export const insertIngredient = async (data, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO ingredients (name, stock_quantity, unit, min_required_quantity)
     VALUES ($1, COALESCE($2,0), $3, COALESCE($4,0)) RETURNING *`,
    [data.name, data.stock_quantity, data.unit, data.min_required_quantity]
  );
  return rows[0];
};

/** เปลี่ยนแปลงสต๊อก — ค่าบวกคือรับเข้า ค่าลบคือตัดออก */
export const adjustStock = async (ingredientId, delta, db = pool) => {
  const { rows } = await db.query(
    'UPDATE ingredients SET stock_quantity = stock_quantity + $1 WHERE id = $2 RETURNING *',
    [delta, ingredientId]
  );
  return rows[0] || null;
};

/**
 * ตัดสต๊อกแบบไม่ยอมให้ติดลบ — เงื่อนไขอยู่ใน UPDATE เดียว (atomic) สองออเดอร์ตัดพร้อมกันจึงไม่เกินของที่มี
 * คืน null ถ้าของไม่พอหรือไม่มีวัตถุดิบนั้น (ให้ผู้เรียกแยกกรณีด้วย findById)
 */
export const deductStock = async (ingredientId, quantity, db = pool) => {
  const { rows } = await db.query(
    `UPDATE ingredients SET stock_quantity = stock_quantity - $1
     WHERE id = $2 AND stock_quantity >= $1 RETURNING *`,
    [quantity, ingredientId]
  );
  return rows[0] || null;
};

export const findById = async (id, db = pool) => {
  const { rows } = await db.query('SELECT * FROM ingredients WHERE id = $1', [id]);
  return rows[0] || null;
};

export const insertLog = async (log, db = pool) => {
  await db.query(
    `INSERT INTO inventory_logs (ingredient_id, change_quantity, type, reference_order_id, user_id, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [log.ingredient_id, log.change_quantity, log.type, log.reference_order_id, log.user_id, log.note]
  );
};

export const findLogs = async (ingredientId, limit = 100, db = pool) => {
  const { rows } = await db.query(
    `SELECT l.*, u.username
     FROM inventory_logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.ingredient_id = $1
     ORDER BY l.created_at DESC LIMIT $2`,
    [ingredientId, limit]
  );
  return rows;
};
