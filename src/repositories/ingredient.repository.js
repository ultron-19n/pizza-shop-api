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

/**
 * ปรับสต๊อกหลายวัตถุดิบในคำสั่งเดียว
 *
 * CTE ตัวแรกล็อกแถวโดยเรียงตาม id ก่อนเสมอ ทำให้ทุกออเดอร์ล็อกในลำดับเดียวกัน จึงไม่เกิด deadlock
 * (เหมือนกับตอนที่วนตัดทีละตัวเรียงตาม id แต่ยิงคำสั่งเดียวแทน n คำสั่ง)
 *
 * guard = true (ตอนขาย): ตัดเฉพาะแถวที่ของพอ แถวไหนไม่พอจะไม่ถูกแตะและไม่ถูกคืนกลับมาใน RETURNING
 * ผู้เรียกจึงรู้ได้จากจำนวนแถวที่คืนมาว่ามีตัวไหนของไม่พอ
 */
export const applyStockBatch = async (changes, { guard = false } = {}, db = pool) => {
  if (!changes.length) return [];

  const ids = changes.map(c => c.ingredientId);
  const values = [];
  const rows = changes.map(({ ingredientId, delta }, i) => {
    const b = i * 2;
    values.push(ingredientId, delta);
    return i === 0 ? `($${b + 1}::int, $${b + 2}::numeric)` : `($${b + 1}, $${b + 2})`;
  });
  values.push(ids);

  const { rows: updated } = await db.query(
    `WITH locked AS (
       SELECT id FROM ingredients WHERE id = ANY($${values.length}::int[]) ORDER BY id FOR UPDATE
     )
     UPDATE ingredients i
        SET stock_quantity = i.stock_quantity + v.delta
       FROM (VALUES ${rows.join(',')}) AS v(id, delta)
      WHERE i.id = v.id
        AND i.id IN (SELECT id FROM locked)
        ${guard ? 'AND i.stock_quantity + v.delta >= 0' : ''}
      RETURNING i.id, i.name, i.stock_quantity`,
    values
  );
  return updated;
};

/** เขียน log หลายรายการในคำสั่งเดียว — ใช้ตอนตัด/คืนสต๊อกทั้งออเดอร์ */
export const insertLogs = async (logs, db = pool) => {
  if (!logs.length) return;

  const values = [];
  const rows = logs.map((log, i) => {
    const b = i * 6;
    values.push(log.ingredient_id, log.change_quantity, log.type,
                log.reference_order_id, log.user_id, log.note);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
  });

  await db.query(
    `INSERT INTO inventory_logs (ingredient_id, change_quantity, type, reference_order_id, user_id, note)
     VALUES ${rows.join(',')}`,
    values
  );
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

/** วัตถุดิบถูกอ้างอิงที่ไหนบ้าง — สูตรอาหารและประวัติการเข้า-ออก */
export const countUsage = async (id, db = pool) => {
  const { rows } = await db.query(
    `SELECT (SELECT COUNT(*)::int FROM pizza_recipes  WHERE ingredient_id = $1) AS recipes,
            (SELECT COUNT(*)::int FROM inventory_logs WHERE ingredient_id = $1) AS logs`,
    [id]
  );
  return rows[0];
};

export const remove = async (id, db = pool) => {
  const { rows } = await db.query('DELETE FROM ingredients WHERE id = $1 RETURNING id, name', [id]);
  return rows[0] || null;
};
