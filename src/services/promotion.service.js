import * as promoRepo from '../repositories/promotion.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { DISCOUNT_TYPE } from '../config/constants.js';

/** รายการโค้ดที่ใช้ได้ — หน้าร้านเรียกได้โดยไม่ต้องล็อกอิน จึงส่งเฉพาะข้อมูลที่ลูกค้าต้องรู้ */
export const usable = () => promoRepo.findUsable();

export const list = () => promoRepo.findAll();

export async function create(input) {
  const code = normalizeCode(input.code);
  if (await promoRepo.findByCode(code)) throw ApiError.conflict('โค้ดนี้ถูกใช้แล้ว');

  return promoRepo.insert({ ...clean(input), code });
}

export async function update(id, patch) {
  const updated = await promoRepo.update(id, clean(patch));
  if (!updated) throw ApiError.notFound('ไม่พบโปรโมชั่นนี้');
  return updated;
}

const normalizeCode = (code) => String(code || '').trim().toUpperCase().slice(0, 50);

/** ส่วนลดแบบ percent เกิน 100 จะทำให้ยอดติดลบ กันไว้ตั้งแต่ตอนบันทึก */
function clean(input) {
  const out = { ...input };
  delete out.code;   // แก้โค้ดทีหลังไม่ได้ ออเดอร์เก่าอ้างถึงโค้ดเดิมอยู่

  if (out.discount_type !== undefined && !Object.values(DISCOUNT_TYPE).includes(out.discount_type)) {
    throw ApiError.badRequest('ประเภทส่วนลดต้องเป็น percent หรือ amount');
  }
  if (out.discount_value !== undefined) {
    const value = Number(out.discount_value);
    if (!(value > 0)) throw ApiError.badRequest('ส่วนลดต้องมากกว่า 0');
    if (out.discount_type === DISCOUNT_TYPE.PERCENT && value > 100) {
      throw ApiError.badRequest('ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100');
    }
  }
  for (const field of ['start_date', 'end_date']) {
    if (out[field] === '') out[field] = null;
  }
  if (out.start_date && out.end_date && out.start_date > out.end_date) {
    throw ApiError.badRequest('วันเริ่มต้องไม่หลังวันสิ้นสุด');
  }
  return out;
}
