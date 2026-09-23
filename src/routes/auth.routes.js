import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authRequired, authOptional, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { ROLES } from '../config/constants.js';

const router = Router();

const registerSchema = {
  username: { required: true, type: 'string', minLength: 3, label: 'ชื่อผู้ใช้' },
  email:    { required: true, type: 'string', minLength: 5, label: 'อีเมล' },
  password: { required: true, type: 'string', minLength: 8, label: 'รหัสผ่าน' },
  role:     { enum: Object.values(ROLES), label: 'สิทธิ์การใช้งาน' },
};

// ช่องเดียวกรอกได้ทั้งชื่อผู้ใช้และอีเมล จึงไม่บังคับว่าต้องส่งฟิลด์ไหน — service เป็นคนตรวจ
const loginSchema = {
  password: { required: true, type: 'string', label: 'รหัสผ่าน' },
};

const updateUserSchema = {
  email:  { type: 'string', label: 'อีเมล' },
  role:   { enum: Object.values(ROLES), label: 'สิทธิ์การใช้งาน' },
  status: { enum: ['active', 'inactive'], label: 'สถานะ' },
};

const passwordSchema = {
  password: { required: true, type: 'string', minLength: 8, label: 'รหัสผ่านใหม่' },
};

// กันเดารหัสผ่าน: ยิงผิดรัว ๆ จาก IP เดียวจะโดนหยุดไว้ก่อน
const loginLimit = rateLimit({ name: 'login', max: 10, windowMs: 15 * 60 * 1000, onlyFailures: true,
  message: 'กรอกรหัสผ่านผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' });

router.get('/setup',     controller.setupStatus);   // บอกแค่ว่ามีบัญชีในระบบแล้วหรือยัง
// authOptional: ตอนยังไม่มีผู้ใช้ใครก็เรียกได้ (สร้าง admin คนแรก) หลังจากนั้น service จะบังคับว่าต้องเป็น admin
router.post('/register', loginLimit, authOptional, validate(registerSchema), controller.register);
router.post('/login',    loginLimit, validate(loginSchema),    controller.login);
router.get('/me',        authRequired,             controller.me);

// จัดการบัญชีพนักงาน — เฉพาะ admin เท่านั้น เพราะเปลี่ยนสิทธิ์คนอื่นได้
const admin = [authRequired, requireRole(ROLES.ADMIN)];
router.get('/users',                   ...admin, controller.listUsers);
router.patch('/users/:id',             ...admin, validate(updateUserSchema), controller.updateUser);
router.post('/users/:id/password',     ...admin, validate(passwordSchema),   controller.resetPassword);
router.delete('/users/:id',            ...admin, controller.removeUser);   // ลบได้เฉพาะบัญชีที่ยังไม่มีประวัติทำงาน

export default router;
