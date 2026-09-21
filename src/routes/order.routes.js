import { Router } from 'express';
import * as controller from '../controllers/order.controller.js';
import { authRequired, authOptional } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ORDER_STATUS_LIST, ORDER_TYPE_LIST, PAYMENT_METHOD_LIST } from '../config/constants.js';

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
  method: { enum: PAYMENT_METHOD_LIST, label: 'ช่องทางชำระเงิน' },
};

// เส้นทางเฉพาะต้องมาก่อน '/:id'
router.get('/report/summary', authRequired, controller.summary);

// เปิดให้ลูกค้าตรวจโค้ดก่อนกดสั่ง จะได้เห็นยอดตรงกับที่เซิร์ฟเวอร์คิดจริง
router.get('/promotions/:code', controller.checkPromotion);

// authOptional: ลูกค้าสั่งเองได้ แต่ถ้าพนักงานเป็นคนกด จะบันทึกว่าใครรับออเดอร์
router.post('/', authOptional, validate(createSchema), controller.create);
router.get('/',  authRequired, controller.list);
router.get('/:id', authRequired, controller.getDetail); // มีชื่อ/เบอร์ลูกค้า ห้ามเปิดสาธารณะ

router.patch('/:id/status', authRequired, validate(statusSchema), controller.changeStatus);
router.post('/:id/pay',     authRequired, validate(paySchema),    controller.pay);

export default router;
