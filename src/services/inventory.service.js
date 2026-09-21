import * as ingredientRepo from '../repositories/ingredient.repository.js';
import * as menuRepo from '../repositories/menu.repository.js';
import { withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { INVENTORY_LOG_TYPE } from '../config/constants.js';

const round2 = (n) => Math.round(n * 100) / 100; // คอลัมน์สต๊อกเป็น NUMERIC(10,2)

/**
 * การเปลี่ยนสต๊อกทุกครั้งต้องมี log คู่กันเสมอ — ผู้เรียกต้องส่ง db (client ใน transaction) มาเอง
 * เพื่อให้การปรับสต๊อกกับการเขียน log สำเร็จหรือล้มเหลวพร้อมกัน
 *
 * allowNegative = false: ตัดออกได้ไม่เกินที่มี (ใช้ตอนขาย) ถ้าไม่พอโยน 409 บอกว่าวัตถุดิบตัวไหนขาด
 */
async function changeStock({ ingredientId, delta, type, orderId = null, userId = null, note = null, allowNegative = true }, db) {
  const guarded = !allowNegative && delta < 0;
  const updated = guarded
    ? await ingredientRepo.deductStock(ingredientId, -delta, db)
    : await ingredientRepo.adjustStock(ingredientId, delta, db);

  if (!updated) {
    const current = guarded ? await ingredientRepo.findById(ingredientId, db) : null;
    if (current) {
      const unit = current.unit ? ` ${current.unit}` : '';
      throw ApiError.conflict(
        `วัตถุดิบไม่พอ: ${current.name} คงเหลือ ${Number(current.stock_quantity)}${unit}, ต้องใช้ ${-delta}${unit}`
      );
    }
    throw ApiError.notFound(`ไม่พบวัตถุดิบรหัส ${ingredientId}`);
  }

  await ingredientRepo.insertLog({
    ingredient_id: ingredientId,
    change_quantity: delta,
    type,
    reference_order_id: orderId,
    user_id: userId,
    note,
  }, db);

  return updated;
}

/**
 * รวมวัตถุดิบที่ใช้ทั้งออเดอร์ แยกตามวัตถุดิบ เรียงตาม id จากน้อยไปมาก
 * เรียงเสมอเหมือนกันทุกออเดอร์ เพื่อให้ล็อกแถวในลำดับเดียวกัน ไม่เกิด deadlock เมื่อสองออเดอร์ใช้วัตถุดิบชุดเดียวกันพร้อมกัน
 * รวมก่อนตัดด้วย จึงแจ้งยอดที่ขาดของทั้งออเดอร์ได้ถูกต้อง
 */
async function collectUsage(items, db) {
  const usage = new Map();
  for (const item of items) {
    const recipe = await menuRepo.findRecipeByVariant(item.pizza_variant_id, db);
    for (const line of recipe) {
      const used = Number(line.quantity_used) * item.quantity;
      usage.set(line.ingredient_id, (usage.get(line.ingredient_id) || 0) + used);
    }
  }
  return [...usage]
    .map(([ingredientId, qty]) => [ingredientId, round2(qty)])
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => a[0] - b[0]);
}

/** ตัดวัตถุดิบตามสูตรของทุกรายการในออเดอร์ — ของไม่พอ = โยน error แล้ว transaction ของออเดอร์ rollback ทั้งหมด */
export async function deductForOrder({ items, orderId, userId }, db) {
  for (const [ingredientId, qty] of await collectUsage(items, db)) {
    await changeStock({
      ingredientId,
      delta: -qty,
      type: INVENTORY_LOG_TYPE.SALE,
      orderId,
      userId,
      note: 'ตัดสต๊อกจากการขาย',
      allowNegative: false,
    }, db);
  }
}

/** คืนวัตถุดิบเมื่อออเดอร์ถูกยกเลิก */
export async function returnForOrder({ items, orderId, userId }, db) {
  for (const [ingredientId, qty] of await collectUsage(items, db)) {
    await changeStock({
      ingredientId,
      delta: qty,
      type: INVENTORY_LOG_TYPE.ADJUST,
      orderId,
      userId,
      note: 'คืนสต๊อกจากการยกเลิกออเดอร์',
    }, db);
  }
}

export const list = (db) => ingredientRepo.findAll(db);
export const listLowStock = (db) => ingredientRepo.findLowStock(db);
export const create = (data, db) => ingredientRepo.insertIngredient(data, db);
export const logs = (ingredientId, db) => ingredientRepo.findLogs(ingredientId, 100, db);

/** รับของเข้าคลัง — ปรับสต๊อกกับเขียน log อยู่ใน transaction เดียว (ถ้าไม่ได้ส่ง db มา จะเปิดให้เอง) */
export async function restock({ ingredientId, quantity, userId, note }, db) {
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw ApiError.badRequest('จำนวนที่รับเข้าต้องมากกว่า 0');

  const run = (tx) => changeStock({
    ingredientId,
    delta: qty,
    type: INVENTORY_LOG_TYPE.RESTOCK,
    userId,
    note,
  }, tx);

  return db ? run(db) : withTransaction(run);
}
