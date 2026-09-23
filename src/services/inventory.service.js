import * as ingredientRepo from '../repositories/ingredient.repository.js';
import * as menuRepo from '../repositories/menu.repository.js';
import { withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { INVENTORY_LOG_TYPE } from '../config/constants.js';

const round2 = (n) => Math.round(n * 100) / 100; // คอลัมน์สต๊อกเป็น NUMERIC(10,2)

/**
 * เปลี่ยนสต๊อกทีละตัวพร้อมเขียน log คู่กันเสมอ — ใช้กับงานที่ทำทีละรายการ เช่น รับของเข้าคลัง
 * (ออเดอร์ใช้ applyUsage ด้านล่างที่รวมทั้งชุดเป็นคำสั่งเดียว)
 * ผู้เรียกต้องส่ง db (client ใน transaction) มาเอง เพื่อให้สต๊อกกับ log สำเร็จหรือล้มเหลวพร้อมกัน
 */
async function changeStock({ ingredientId, delta, type, orderId = null, userId = null, note = null }, db) {
  const updated = await ingredientRepo.adjustStock(ingredientId, delta, db);
  if (!updated) throw ApiError.notFound(`ไม่พบวัตถุดิบรหัส ${ingredientId}`);

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
  // ดึงสูตรของทุก variant ในคิวรีเดียว ไม่ใช่ทีละรายการ
  const recipes = await menuRepo.findRecipesByVariants(
    [...new Set(items.map(i => Number(i.pizza_variant_id)))], db
  );

  const usage = new Map();
  for (const item of items) {
    for (const line of recipes.get(Number(item.pizza_variant_id)) ?? []) {
      const used = Number(line.quantity_used) * item.quantity;
      usage.set(line.ingredient_id, (usage.get(line.ingredient_id) || 0) + used);
    }
  }
  return [...usage]
    .map(([ingredientId, qty]) => [ingredientId, round2(qty)])
    .filter(([, qty]) => qty > 0)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * ตัดวัตถุดิบตามสูตรของทุกรายการในออเดอร์ — ของไม่พอ = โยน error แล้ว transaction ของออเดอร์ rollback ทั้งหมด
 *
 * การปรับสต๊อกยังทำทีละวัตถุดิบเรียงตาม id เหมือนเดิม (กัน deadlock และกันสต๊อกติดลบ)
 * แต่ log ทั้งชุดถูกเขียนรวดเดียวตอนท้าย จึงลดจำนวนรอบไป-กลับฐานข้อมูลลงครึ่งหนึ่ง
 */
export async function deductForOrder({ items, orderId, userId }, db) {
  await applyUsage(await collectUsage(items, db), {
    sign: -1, type: INVENTORY_LOG_TYPE.SALE, orderId, userId,
    note: 'ตัดสต๊อกจากการขาย', allowNegative: false,
  }, db);
}

/** คืนวัตถุดิบเมื่อออเดอร์ถูกยกเลิก */
export async function returnForOrder({ items, orderId, userId }, db) {
  await applyUsage(await collectUsage(items, db), {
    sign: 1, type: INVENTORY_LOG_TYPE.ADJUST, orderId, userId,
    note: 'คืนสต๊อกจากการยกเลิกออเดอร์',
  }, db);
}

/**
 * ปรับสต๊อกทั้งชุดในคำสั่งเดียว แล้วเขียน log ทั้งชุดในอีกคำสั่งเดียว
 * ออเดอร์ที่ใช้วัตถุดิบ 5 อย่าง เดิมยิง 10 คำสั่ง (ตัด+log อย่างละตัว) ตอนนี้เหลือ 2
 */
async function applyUsage(usage, { sign, type, orderId, userId, note, allowNegative = true }, db) {
  if (!usage.length) return;

  const changes = usage.map(([ingredientId, qty]) => ({ ingredientId, delta: sign * qty }));
  const updated = await ingredientRepo.applyStockBatch(changes, { guard: !allowNegative }, db);

  // ครบทุกตัว = สำเร็จ ถ้าขาดแปลว่ามีวัตถุดิบที่ของไม่พอ (หรือไม่มีวัตถุดิบนั้นจริง)
  if (updated.length !== changes.length) {
    const done = new Set(updated.map(r => Number(r.id)));
    const missed = changes.find(c => !done.has(Number(c.ingredientId)));
    const current = await ingredientRepo.findById(missed.ingredientId, db);

    if (!current) throw ApiError.notFound(`ไม่พบวัตถุดิบรหัส ${missed.ingredientId}`);
    const unit = current.unit ? ` ${current.unit}` : '';
    throw ApiError.conflict(
      `วัตถุดิบไม่พอ: ${current.name} คงเหลือ ${Number(current.stock_quantity)}${unit}, ต้องใช้ ${-missed.delta}${unit}`
    );
  }

  await ingredientRepo.insertLogs(changes.map(c => ({
    ingredient_id: c.ingredientId, change_quantity: c.delta,
    type, reference_order_id: orderId, user_id: userId, note,
  })), db);
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
