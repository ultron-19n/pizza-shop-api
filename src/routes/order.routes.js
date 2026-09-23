import { Router } from 'express';
import * as controller from '../controllers/order.controller.js';
import { authRequired, authOptional, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ORDER_STATUS_LIST, ORDER_TYPE_LIST, PAYMENT_METHOD_LIST,
         STAFF_ROLES, MANAGEMENT_ROLES } from '../config/constants.js';

const router = Router();

const createSchema = {
  items: {
    required: true, type: 'array', notEmpty: true,
    emptyMessage: 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ', label: 'รายการสินค้า',
  },
  order_type: { enum: ORDER_TYPE_LIST, label: 'ประเภทการรับสินค้า' },
  payment_method: { enum: PAYMENT_METHOD_LIST, label: 'ช่องทางชำระเงิน' },
};

const statusSchema = {
  status: { required: true, enum: ORDER_STATUS_LIST, label: 'สถานะ' },
};

const paySchema = {
  method:          { enum: PAYMENT_METHOD_LIST, label: 'ช่องทางชำระเงิน' },
  received_amount: { type: 'number', min: 0, label: 'เงินที่รับมา' },
};

const staff   = [authRequired, requireRole(...STAFF_ROLES)];
const manager = [authRequired, requireRole(...MANAGEMENT_ROLES)];

// ยอดขายทั้งร้านเป็นข้อมูลของเจ้าของกิจการ ไม่ใช่ข้อมูลที่พนักงานหน้าร้านต้องใช้
// เส้นทางเฉพาะต้องมาก่อน '/:id'
router.get('/report/summary', ...manager, controller.summary);

// เปิดให้ลูกค้าตรวจโค้ดก่อนกดสั่ง จะได้เห็นยอดตรงกับที่เซิร์ฟเวอร์คิดจริง
router.get('/promotions/:code', controller.checkPromotion);

// ลูกค้าแจ้งว่าโอนแล้ว (ไม่ต้องล็อกอิน) — จำกัดจำนวนครั้งกันคนยิงรัวใส่รหัสบิลมั่ว ๆ
router.post('/code/:code/notify-transfer',
  rateLimit({ name: 'notify-transfer', max: 10, windowMs: 10 * 60 * 1000 }),
  controller.notifyTransfer);

// authOptional: ลูกค้าสั่งเองได้ แต่ถ้าพนักงานเป็นคนกด จะบันทึกว่าใครรับออเดอร์
// กันสคริปต์ยิงสั่งซื้อรัว ๆ จนสต๊อกหมดและคิวออเดอร์ท่วม
const orderLimit = rateLimit({ name: 'create-order', max: 12, windowMs: 10 * 60 * 1000,
  message: 'สั่งซื้อถี่เกินไป กรุณารอสักครู่ หากต้องการสั่งจำนวนมากโปรดโทรหาร้าน' });

router.post('/', orderLimit, authOptional, validate(createSchema), controller.create);
router.get('/',  ...staff, controller.list);
router.get('/:id', ...staff, controller.getDetail); // มีชื่อ/เบอร์ลูกค้า ห้ามเปิดสาธารณะ

router.patch('/:id/status', ...staff, validate(statusSchema), controller.changeStatus);
router.post('/:id/pay',     ...staff, validate(paySchema),    controller.pay);

export default router;
