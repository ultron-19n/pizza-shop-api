import { Router } from 'express';
import * as controller from '../controllers/promotion.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { MANAGEMENT_ROLES, DISCOUNT_TYPE } from '../config/constants.js';

const router = Router();
const manager = [authRequired, requireRole(...MANAGEMENT_ROLES)];

const createSchema = {
  code:           { required: true, type: 'string', minLength: 3, label: 'โค้ดส่วนลด' },
  name:           { required: true, type: 'string', label: 'ชื่อโปรโมชั่น' },
  discount_type:  { required: true, enum: Object.values(DISCOUNT_TYPE), label: 'ประเภทส่วนลด' },
  discount_value: { required: true, type: 'number', min: 0.01, label: 'มูลค่าส่วนลด' },
};

// โค้ดที่ใช้ได้เปิดสาธารณะ ลูกค้าจะได้เห็นว่ามีโปรอะไรบ้างโดยไม่ต้องล็อกอิน
router.get('/usable', controller.usable);

router.get('/',     ...manager, controller.list);
router.post('/',    ...manager, validate(createSchema), controller.create);
router.put('/:id',    ...manager, controller.update);
router.delete('/:id', ...manager, controller.remove);   // ลบได้เฉพาะโค้ดที่ยังไม่เคยถูกใช้

export default router;
