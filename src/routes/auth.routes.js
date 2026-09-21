import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authRequired, authOptional } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';

const router = Router();

const registerSchema = {
  username: { required: true, type: 'string', minLength: 3, label: 'ชื่อผู้ใช้' },
  password: { required: true, type: 'string', minLength: 8, label: 'รหัสผ่าน' },
  role:     { enum: Object.values(ROLES), label: 'สิทธิ์การใช้งาน' },
};

const loginSchema = {
  username: { required: true, type: 'string', label: 'ชื่อผู้ใช้' },
  password: { required: true, type: 'string', label: 'รหัสผ่าน' },
};

// authOptional: ตอนยังไม่มีผู้ใช้ใครก็เรียกได้ (สร้าง admin คนแรก) หลังจากนั้น service จะบังคับว่าต้องเป็น admin
router.post('/register', authOptional, validate(registerSchema), controller.register);
router.post('/login',    validate(loginSchema),    controller.login);
router.get('/me',        authRequired,             controller.me);

export default router;
