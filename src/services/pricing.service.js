import * as menuRepo from '../repositories/menu.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { toSatang } from '../utils/money.js';
import { normalizeQuantity } from './pricing.rules.js';

export { calcDiscount, calcTotals, calcLoyaltyPoints } from './pricing.rules.js';

/**
 * รหัสอ้างอิงต้องเป็นจำนวนเต็มบวกก่อนส่งเข้าคิวรี
 * ถ้าปล่อยค่าอย่าง "abc" ผ่านไป PostgreSQL จะโยน 22P02 แล้ว transaction ทั้งก้อนถูกยกเลิก
 * และผู้ใช้จะได้ข้อความกลางๆ แทนที่จะรู้ว่าฟิลด์ไหนผิด
 */
function toId(value, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw ApiError.badRequest(`${label}ไม่ถูกต้อง`);
  return n;
}

/**
 * ดึงราคาจริงจากฐานข้อมูลแล้วประกอบเป็นรายการพร้อมบันทึก
 * ไม่เคยอ่านราคาจากสิ่งที่ client ส่งมา — แก้ราคาผ่าน DevTools จึงไม่มีผล
 */
export async function priceItems(items, db) {
  const priced = [];

  for (const item of items) {
    // ข้อมูลมาจาก body ตรงๆ ต้องกันรูปแบบเพี้ยน (null, สตริง, ตัวเลขล้วน) ไม่งั้นกลายเป็น 500
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw ApiError.badRequest('รูปแบบรายการสินค้าไม่ถูกต้อง');
    }

    const variantId = toId(item.pizza_variant_id, 'รหัสสินค้า');
    const variant = await menuRepo.findVariantForPricing(variantId, db);
    if (!variant) throw ApiError.badRequest(`ไม่พบสินค้ารหัส ${variantId}`);
    // เมนูที่ปิดขาย (is_active = false) ต้องสั่งไม่ได้แม้รู้รหัส variant — หน้าเมนูแค่ซ่อน ไม่ได้กันที่ API
    if (!variant.is_available || !variant.is_active) throw ApiError.badRequest(`${variant.name} ไม่พร้อมขายในตอนนี้`);

    const quantity = normalizeQuantity(item.quantity);
    let unitSatang = toSatang(variant.price);
    const toppings = [];

    const requested = item.toppings ?? [];
    if (!Array.isArray(requested)) throw ApiError.badRequest('รูปแบบท็อปปิ้งไม่ถูกต้อง');

    for (const t of requested) {
      if (!t || typeof t !== 'object') throw ApiError.badRequest('รูปแบบท็อปปิ้งไม่ถูกต้อง');

      const toppingId = toId(t.topping_id, 'รหัสท็อปปิ้ง');
      const topping = await menuRepo.findToppingById(toppingId, db);
      if (!topping) throw ApiError.badRequest(`ไม่พบท็อปปิ้งรหัส ${toppingId}`);

      const tQty = normalizeQuantity(t.quantity);
      unitSatang += toSatang(topping.price) * tQty;
      toppings.push({ topping_id: topping.id, quantity: tQty, price: topping.price });
    }

    priced.push({
      menu_item_id: variant.menu_item_id,
      pizza_variant_id: variant.id,
      quantity,
      unit_satang: unitSatang,
      total_satang: unitSatang * quantity,
      note: item.note || null,
      toppings,
    });
  }

  return priced;
}
