import { Router } from 'express';
import * as controller from '../controllers/menu.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { MANAGEMENT_ROLES } from '../config/constants.js';

const router = Router();
const manager = [authRequired, requireRole(...MANAGEMENT_ROLES)];

const menuSchema = {
  name:        { required: true, type: 'string', label: 'ชื่อเมนู' },
  category_id: { required: true, type: 'number', label: 'หมวดหมู่' },
};

const variantSchema = {
  price: { required: true, type: 'number', min: 0, label: 'ราคา' },
  size:  { required: true, type: 'string', label: 'ขนาด' },
};

// เส้นทางเฉพาะต้องมาก่อน '/:id' ไม่งั้น 'toppings' จะถูกอ่านเป็น id
const toppingSchema = {
  name:  { required: true, type: 'string', label: 'ชื่อท็อปปิ้ง' },
  price: { required: true, type: 'number', min: 0, label: 'ราคา' },
};

/**
 * เมนูเปลี่ยนวันละไม่กี่ครั้ง แต่ถูกเรียกทุกครั้งที่มีคนเปิดหน้าร้าน
 * ให้ CDN เก็บคำตอบไว้ 60 วินาที และระหว่างที่ไปดึงของใหม่ก็ยังส่งของเดิมให้ก่อน (ลูกค้าไม่ต้องรอ)
 * ผลคือช่วงพีคที่มีคนเปิดเว็บพร้อมกันเป็นร้อย ฐานข้อมูลถูกถามแค่ครั้งเดียวต่อนาที
 */
const publicCache = (_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  next();
};

router.get('/categories',   publicCache, controller.categories);
router.get('/toppings/all', publicCache, controller.toppings);
router.get('/manage/all',   ...manager, controller.listForManage);   // รวมเมนูที่ปิดขาย
router.get('/manage/toppings', ...manager, controller.allToppings);
router.get('/',             publicCache, controller.list);
router.get('/:id',          publicCache, controller.getById);

router.post('/',             ...manager, validate(menuSchema),    controller.create);
router.put('/:id',           ...manager,                          controller.update);
router.delete('/:id',        ...manager,                          controller.deactivate);   // ปิดการขาย ไม่ได้ลบจริง

// ลบถาวร — ทำได้เฉพาะของที่ยังไม่เคยถูกสั่ง (service เป็นคนตรวจและอธิบายเหตุผลถ้าลบไม่ได้)
router.delete('/items/:id/permanent', ...manager, controller.remove);
router.delete('/variants/:id',        ...manager, controller.removeVariant);
router.delete('/toppings/:id',        ...manager, controller.removeTopping);
router.post('/:id/variants', ...manager, validate(variantSchema), controller.addVariant);
router.patch('/variants/:id', ...manager, controller.updateVariant);

router.post('/toppings',       ...manager, validate(toppingSchema), controller.createTopping);
router.patch('/toppings/:id',  ...manager, controller.updateTopping);

export default router;
