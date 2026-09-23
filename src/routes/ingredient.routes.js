import { Router } from 'express';
import * as controller from '../controllers/ingredient.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { MANAGEMENT_ROLES, STAFF_ROLES } from '../config/constants.js';

const router = Router();

const ingredientSchema = {
  name: { required: true, type: 'string', label: 'ชื่อวัตถุดิบ' },
  unit: { required: true, type: 'string', label: 'หน่วยนับ' },
};

const restockSchema = {
  quantity: { required: true, type: 'number', min: 0.01, label: 'จำนวนที่รับเข้า' },
};

// สต๊อกเป็นเรื่องของหน้าร้านขึ้นไป ไรเดอร์ไม่ต้องเห็นและไม่ต้องแก้
router.use(authRequired, requireRole(...STAFF_ROLES));

router.get('/low-stock', controller.lowStock);
router.get('/',          controller.list);
router.get('/:id/logs',  controller.logs);

router.post('/', requireRole(...MANAGEMENT_ROLES), validate(ingredientSchema), controller.create);
router.post('/:id/restock', validate(restockSchema), controller.restock);

export default router;
