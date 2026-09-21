import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userRepo from '../repositories/user.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { BUSINESS, ROLES } from '../config/constants.js';

/**
 * สร้างบัญชีพนักงาน
 * - ยังไม่มีผู้ใช้เลย: เปิดให้สมัครได้ และคนแรกเป็น admin เสมอ (ไว้ตั้งต้นระบบ)
 * - หลังจากนั้น: เฉพาะ admin ที่ล็อกอินอยู่เท่านั้นที่สร้างบัญชี/กำหนด role ได้
 */
export async function register({ username, password, first_name, last_name, phone_number, role }, actor = null) {
  const isFirstUser = (await userRepo.count()) === 0;
  if (!isFirstUser) {
    if (!actor) throw ApiError.unauthorized();
    if (actor.role !== ROLES.ADMIN) throw ApiError.forbidden('เฉพาะผู้ดูแลระบบที่สร้างบัญชีใหม่ได้');
  } else {
    role = ROLES.ADMIN;
  }

  const existing = await userRepo.findByUsername(username);
  if (existing) throw ApiError.conflict('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

  const password_hash = await bcrypt.hash(password, BUSINESS.BCRYPT_ROUNDS);
  return userRepo.insertUser({ username, password_hash, first_name, last_name, phone_number, role });
}

/**
 * hash ปลอมไว้เทียบตอนไม่มี username นั้นจริง
 * ถ้าข้าม bcrypt ไปเลย คำตอบจะเร็วกว่ากรณีรหัสผิดอย่างเห็นได้ชัด จนเดาได้ว่าชื่อไหนมีในระบบ
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

export async function login({ username, password }) {
  const user = await userRepo.findByUsername(username);

  // ข้อความเดียวกันทั้งกรณีไม่มี user และรหัสผิด เพื่อไม่ให้เดาได้ว่ามีชื่อนี้ในระบบ
  const invalid = ApiError.unauthorized('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  const matched = await bcrypt.compare(password || '', user?.password_hash || DUMMY_HASH);
  if (!user || !matched) throw invalid;
  if (user.status !== 'active') throw ApiError.forbidden('บัญชีนี้ถูกระงับการใช้งาน');

  return { token: signToken(user), user: toPublic(user) };
}

export async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw ApiError.notFound('ไม่พบผู้ใช้');
  return user;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const toPublic = (u) => ({
  id: u.id, username: u.username, first_name: u.first_name,
  last_name: u.last_name, role: u.role,
});
