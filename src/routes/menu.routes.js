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
router.get('/categories',   controller.categories);
router.get('/toppings/all', controller.toppings);
router.get('/',             controller.list);
router.get('/:id',          controller.getById);

router.post('/',             ...manager, validate(menuSchema),    controller.create);
router.put('/:id',           ...manager,                          controller.update);
router.delete('/:id',        ...manager,                          controller.deactivate);
router.post('/:id/variants', ...manager, validate(variantSchema), controller.addVariant);

export default router;
