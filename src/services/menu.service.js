import * as menuRepo from '../repositories/menu.repository.js';
import { ApiError } from '../utils/ApiError.js';

export const categories = () => menuRepo.findCategories();
export const toppings   = () => menuRepo.findAvailableToppings();

export const list = ({ category_id, search }) =>
  menuRepo.findMenu({ categoryId: category_id || null, search: search || null });

export async function getById(id) {
  const item = await menuRepo.findMenuItemById(id);
  if (!item) throw ApiError.notFound('ไม่พบเมนูนี้');
  return item;
}

export const create = (data) => menuRepo.insertMenuItem(data);

export async function update(id, patch) {
  const updated = await menuRepo.updateMenuItem(id, patch);
  if (!updated) throw ApiError.notFound('ไม่พบเมนูนี้');
  return updated;
}

/** ปิดการขาย ไม่ลบจริง เพื่อให้ใบเสร็จเก่ายังอ้างอิงเมนูได้ */
export async function deactivate(id) {
  const ok = await menuRepo.deactivateMenuItem(id);
  if (!ok) throw ApiError.notFound('ไม่พบเมนูนี้');
  return { message: 'ปิดการขายเมนูเรียบร้อย' };
}

export async function addVariant(menuItemId, data) {
  await getById(menuItemId);
  return menuRepo.insertVariant(menuItemId, data);
}

/** รายการเมนูสำหรับหลังร้าน — รวมเมนูที่ปิดขายอยู่ */
export const listForManage = () => menuRepo.findMenuForManage();

export async function updateVariant(id, patch) {
  if (patch.price !== undefined && !(Number(patch.price) >= 0)) {
    throw ApiError.badRequest('ราคาต้องเป็นตัวเลขไม่ติดลบ');
  }
  const updated = await menuRepo.updateVariant(id, patch);
  if (!updated) throw ApiError.notFound('ไม่พบขนาด/ตัวเลือกนี้');
  return updated;
}

export const allToppings = () => menuRepo.findAllToppings();

export const createTopping = (data) => menuRepo.insertTopping(data);

export async function updateTopping(id, patch) {
  const updated = await menuRepo.updateTopping(id, patch);
  if (!updated) throw ApiError.notFound('ไม่พบท็อปปิ้งนี้');
  return updated;
}
