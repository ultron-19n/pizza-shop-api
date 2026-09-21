import { randomInt } from 'node:crypto';

/**
 * เงินกับเลขทศนิยมของ JavaScript
 * 0.1 + 0.2 ได้ 0.30000000000000004 ถ้าปล่อยไว้ ยอดบิลจะเพี้ยนทีละสตางค์
 * แก้ด้วยการคิดเป็น "สตางค์" (จำนวนเต็ม) แล้วค่อยแปลงกลับตอนบันทึก
 */

/** บาท -> สตางค์ (จำนวนเต็ม) */
export const toSatang = (baht) => Math.round(Number(baht) * 100);

/** สตางค์ -> บาท */
export const toBaht = (satang) => satang / 100;

/** ปัดเป็นทศนิยม 2 ตำแหน่งแบบสตริง พร้อมบันทึกลง NUMERIC(10,2) */
export const toDecimal = (baht) => (Math.round(Number(baht) * 100) / 100).toFixed(2);

/** รวมรายการเป็นสตางค์ */
export const sumSatang = (items, pick) =>
  items.reduce((sum, item) => sum + pick(item), 0);

const THAI_UTC_OFFSET_MS = 7 * 60 * 60 * 1000; // ไทยไม่มี DST ใช้ offset คงที่ได้

/**
 * สร้างรหัสออเดอร์ เช่น PZ260911-4821
 * วันที่เป็นเวลาไทย (ไม่ใช่ UTC ไม่งั้นออเดอร์ตี 0–7 โมงจะได้รหัสของเมื่อวาน)
 * เลข 4 หลักไม่ได้รับประกันว่าไม่ซ้ำ — ตอนบันทึกจึงมี retry เมื่อชน (ดู insertOrderWithUniqueCode)
 */
export const generateOrderCode = (date = new Date()) => {
  const ymd = new Date(date.getTime() + THAI_UTC_OFFSET_MS).toISOString().slice(2, 10).replace(/-/g, '');
  const rand = randomInt(1000, 10000);
  return `PZ${ymd}-${rand}`;
};
