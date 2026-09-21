import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';

/** ตรวจ JWT จาก header: Authorization: Bearer <token> */
export function authRequired(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized('ไม่พบ token กรุณาเข้าสู่ระบบ'));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
      : 'token ไม่ถูกต้อง';
    next(ApiError.unauthorized(message));
  }
}

/** มี token ก็อ่าน ไม่มีก็ผ่าน — ใช้กับ endpoint ที่ลูกค้าทั่วไปเรียกได้
 *  แต่ถ้าพนักงานเป็นคนเรียก เราอยากบันทึกว่าใครรับออเดอร์ */
export function authOptional(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch { /* ไม่เป็นไร */ }
  }
  next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
