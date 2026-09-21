import { Router } from 'express';
import * as controller from '../controllers/ingredient.controller.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { MANAGEMENT_ROLES } from '../config/constants.js';

const router = Router();

const ingredientSchema = {
  name: { required: true, type: 'string', label: 'ชื่อวัตถุดิบ' },
  unit: { required: true, type: 'string', label: 'หน่วยนับ' },
};

const restockSchema = {
  quantity: { required: true, type: 'number', min: 0.01, label: 'จำนวนที่รับเข้า' },
};

router.use(authRequired); // ทุกเส้นทางในไฟล์นี้ต้องล็อกอิน

router.get('/low-stock', controller.lowStock);
router.get('/',          controller.list);
router.get('/:id/logs',  controller.logs);

router.post('/', requireRole(...MANAGEMENT_ROLES), validate(ingredientSchema), controller.create);
router.post('/:id/restock', validate(restockSchema), controller.restock);

export default router;
