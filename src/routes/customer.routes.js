import { Router } from 'express';
import * as controller from '../controllers/customer.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { STAFF_ROLES } from '../config/constants.js';

const router = Router();

const customerSchema = {
  phone_number: { required: true, type: 'string', minLength: 9, label: 'เบอร์โทร' },
};

const addressSchema = {
  address_line: { required: true, type: 'string', label: 'ที่อยู่' },
};

// ข้อมูลลูกค้า (ชื่อ เบอร์ ที่อยู่) เป็นข้อมูลส่วนบุคคล เปิดเฉพาะพนักงานหน้าร้านขึ้นไป
// ลูกค้าทั่วไปไม่ต้องเรียกที่นี่ — ส่ง customer/address มาพร้อม POST /orders แทน
router.use(authRequired, requireRole(...STAFF_ROLES));

router.get('/',    controller.search);
router.get('/:id', controller.getById);

router.post('/',              validate(customerSchema), controller.upsert);
router.post('/:id/addresses', validate(addressSchema),  controller.addAddress);

export default router;
