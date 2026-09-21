import { ApiError } from '../utils/ApiError.js';
import { toSatang, toBaht } from '../utils/money.js';
import { BUSINESS, DISCOUNT_TYPE, ORDER_TYPE } from '../config/constants.js';

/**
 * กฎการคิดเงินล้วน ๆ — ไม่แตะฐานข้อมูล ไม่แตะ req/res
 * ทำให้เขียนเทสได้ตรง ๆ โดยไม่ต้องต่อ PostgreSQL
 *
 * ทุกการคำนวณทำในหน่วย "สตางค์" (จำนวนเต็ม) เพราะ 0.1 + 0.2 ของ JavaScript
 * ได้ 0.30000000000000004 ถ้าปล่อยไว้ ยอดบิลจะเพี้ยนทีละสตางค์
 */

/** จำนวนต้องเป็นจำนวนเต็มบวก และไม่เกินเพดานต่อออเดอร์ */
export function normalizeQuantity(value) {
  const n = parseInt(value ?? 1, 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, BUSINESS.MAX_ITEMS_PER_ORDER);
}

/** คำนวณส่วนลดเป็นสตางค์ โยน error ถ้ายอดไม่ถึงขั้นต่ำ */
export function calcDiscount(subtotalSatang, promotion) {
  if (!promotion) return 0;

  const minSatang = toSatang(promotion.min_order_amount || 0);
  if (subtotalSatang < minSatang) {
    const short = toBaht(minSatang - subtotalSatang);
    throw ApiError.badRequest(
      `ยอดขั้นต่ำของโค้ดนี้คือ ${toBaht(minSatang)} บาท เพิ่มอีก ${short} บาท`
    );
  }

  const discount = promotion.discount_type === DISCOUNT_TYPE.PERCENT
    ? Math.round((subtotalSatang * Number(promotion.discount_value)) / 100)
    : toSatang(promotion.discount_value);

  return Math.min(discount, subtotalSatang); // ส่วนลดห้ามเกินยอดสินค้า
}

/** รวมยอดสุทธิทั้งบิล */
export function calcTotals({ items, promotion, orderType }) {
  const subtotal = items.reduce((sum, i) => sum + i.total_satang, 0);
  const discount = calcDiscount(subtotal, promotion);
  const deliveryFee = orderType === ORDER_TYPE.DELIVERY ? toSatang(BUSINESS.DELIVERY_FEE) : 0;

  return {
    subtotal_satang: subtotal,
    discount_satang: discount,
    delivery_fee_satang: deliveryFee,
    total_satang: subtotal - discount + deliveryFee,
  };
}

/** แต้มสะสม */
export const calcLoyaltyPoints = (totalSatang) =>
  Math.floor(toBaht(totalSatang) / BUSINESS.BAHT_PER_POINT);
