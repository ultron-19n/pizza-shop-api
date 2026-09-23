import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userRepo from '../repositories/user.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { BUSINESS, ROLES } from '../config/constants.js';
import { env } from '../config/env.js';

/** อีเมลเก็บเป็นตัวพิมพ์เล็กเสมอ เทียบตอนล็อกอินจะได้ไม่พลาดเพราะพิมพ์ใหญ่ */
const normalizeEmail = (email) => {
  const value = String(email ?? '').trim().toLowerCase();
  if (!value) return null;
  // ตรวจแค่รูปแบบพื้นฐาน: มี @ มีจุดหลัง @ และไม่มีช่องว่าง
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw ApiError.badRequest('รูปแบบอีเมลไม่ถูกต้อง');
  if (value.length > 150) throw ApiError.badRequest('อีเมลยาวเกินไป');
  return value;
};

/**
 * สร้างบัญชีพนักงาน
 * - ยังไม่มีผู้ใช้เลย: เปิดให้สมัครได้ และคนแรกเป็น admin เสมอ (ไว้ตั้งต้นระบบ)
 * - หลังจากนั้น: เฉพาะ admin ที่ล็อกอินอยู่เท่านั้นที่สร้างบัญชี/กำหนด role ได้
 */
export async function register({ username, email, password, first_name, last_name, phone_number, role }, actor = null) {
  const isFirstUser = (await userRepo.count()) === 0;
  if (!isFirstUser) {
    if (!actor) throw ApiError.unauthorized();
    if (actor.role !== ROLES.ADMIN) throw ApiError.forbidden('เฉพาะผู้ดูแลระบบที่สร้างบัญชีใหม่ได้');
  } else {
    role = ROLES.ADMIN;
  }

  const existing = await userRepo.findByUsername(username);
  if (existing) throw ApiError.conflict('ชื่อผู้ใช้นี้ถูกใช้แล้ว');

  const mail = normalizeEmail(email);
  if (mail && await userRepo.findByEmail(mail)) throw ApiError.conflict('อีเมลนี้ถูกใช้แล้ว');

  const password_hash = await bcrypt.hash(password, BUSINESS.BCRYPT_ROUNDS);
  return userRepo.insertUser({ username, email: mail, password_hash, first_name, last_name, phone_number, role });
}

/**
 * hash ปลอมไว้เทียบตอนไม่มี username นั้นจริง
 * ถ้าข้าม bcrypt ไปเลย คำตอบจะเร็วกว่ากรณีรหัสผิดอย่างเห็นได้ชัด จนเดาได้ว่าชื่อไหนมีในระบบ
 */
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/** กรอกได้ทั้งชื่อผู้ใช้และอีเมลในช่องเดียว */
export async function login({ username, email, password }) {
  const identifier = String(username || email || '').trim();
  const user = await userRepo.findByLogin(identifier);

  // ข้อความเดียวกันทั้งกรณีไม่มี user และรหัสผิด เพื่อไม่ให้เดาได้ว่ามีชื่อนี้ในระบบ
  const invalid = ApiError.unauthorized('ชื่อผู้ใช้ อีเมล หรือรหัสผ่านไม่ถูกต้อง');
  const matched = await bcrypt.compare(password || '', user?.password_hash || DUMMY_HASH);
  if (!user || !matched) throw invalid;
  if (user.status !== 'active') throw ApiError.forbidden('บัญชีนี้ถูกระงับการใช้งาน');

  return { token: signToken(user), user: toPublic(user) };
}

/** ยังไม่มีบัญชีไหนเลย = ระบบเพิ่งติดตั้ง หน้าเข้าสู่ระบบจะได้เสนอให้สร้าง admin คนแรก */
export const needsSetup = async () => ({ needs_setup: (await userRepo.count()) === 0 });

export const listUsers = () => userRepo.findAll();

/**
 * แก้บัญชีพนักงาน (เฉพาะ admin)
 * กันสองกรณีที่ทำให้ระบบล็อกตัวเอง: ปลด admin คนสุดท้าย และ admin ระงับบัญชีตัวเอง
 */
export async function updateUser(id, patch, actor) {
  const target = await userRepo.findById(id);
  if (!target) throw ApiError.notFound('ไม่พบบัญชีนี้');

  if (patch.email !== undefined) {
    patch.email = normalizeEmail(patch.email);
    const owner = patch.email ? await userRepo.findByEmail(patch.email) : null;
    if (owner && String(owner.id) !== String(target.id)) throw ApiError.conflict('อีเมลนี้ถูกใช้แล้ว');
  }

  const losesAdmin = (patch.role && patch.role !== ROLES.ADMIN) || patch.status === 'inactive';
  if (target.role === ROLES.ADMIN && target.status === 'active' && losesAdmin) {
    if (String(actor.id) === String(target.id)) {
      throw ApiError.badRequest('เปลี่ยนสิทธิ์หรือระงับบัญชีตัวเองไม่ได้');
    }
    if ((await userRepo.countActiveAdmins()) <= 1) {
      throw ApiError.badRequest('ต้องเหลือผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 บัญชี');
    }
  }

  return userRepo.updateUser(id, patch);
}

/** ตั้งรหัสผ่านใหม่ให้พนักงาน — ใช้ตอนลืมรหัส */
export async function resetPassword(id, password) {
  const target = await userRepo.findById(id);
  if (!target) throw ApiError.notFound('ไม่พบบัญชีนี้');

  const hash = await bcrypt.hash(password, BUSINESS.BCRYPT_ROUNDS);
  await userRepo.updatePassword(id, hash);
  return { message: 'ตั้งรหัสผ่านใหม่เรียบร้อย' };
}

export async function me(userId) {
  const user = await userRepo.findById(userId);
  if (!user) throw ApiError.notFound('ไม่พบผู้ใช้');
  return user;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    env.JWT_SECRET,           // อ่านผ่าน env กลาง จะได้ใช้ค่าเดียวกับตอนตรวจ token เสมอ
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

const toPublic = (u) => ({
  id: u.id, username: u.username, email: u.email, first_name: u.first_name,
  last_name: u.last_name, role: u.role,
});
