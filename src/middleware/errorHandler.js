import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`ไม่พบเส้นทาง ${req.method} ${req.originalUrl}`));
}

/** แปลงรหัส error ของ PostgreSQL เป็นข้อความที่ผู้ใช้เข้าใจ */
function translatePgError(err) {
  switch (err.code) {
    case '23505': return ApiError.conflict('ข้อมูลนี้มีอยู่แล้วในระบบ');
    case '23503': return ApiError.badRequest('อ้างอิงข้อมูลที่ไม่มีอยู่จริง');
    case '23514': return ApiError.badRequest('ข้อมูลไม่ผ่านเงื่อนไขของฐานข้อมูล');
    case '22P02': return ApiError.badRequest('รูปแบบข้อมูลไม่ถูกต้อง');
    case '22001': return ApiError.badRequest('ข้อมูลยาวเกินกว่าที่ระบบรับได้');
    case '22003': return ApiError.badRequest('ตัวเลขเกินช่วงที่ระบบรับได้');
    case 'ECONNREFUSED': return ApiError.internal('เชื่อมต่อฐานข้อมูลไม่ได้');
    default: return null;
  }
}

export function errorHandler(err, _req, res, _next) {
  const apiError = err instanceof ApiError ? err : (translatePgError(err) || null);
  const status = apiError?.status || err.status || 500;

  // log เฉพาะข้อผิดพลาดของระบบ ไม่ต้องรกด้วย error ที่ผู้ใช้กรอกผิด
  if (status >= 500) console.error('🔥', err);

  // ข้อความของ error ระดับระบบมักมีรายละเอียดภายใน (ชื่อตาราง คอลัมน์ ที่อยู่เซิร์ฟเวอร์)
  // ตอนรันจริงจึงส่งข้อความกลางแทน ส่วนตอนพัฒนายังเห็นของจริงเพื่อไล่ปัญหาได้
  const isServerError = status >= 500;
  const hideDetails = isServerError && process.env.NODE_ENV === 'production';

  res.status(status).json({
    message: hideDetails
      ? 'เกิดข้อผิดพลาดภายในระบบ'
      : apiError?.message || err.message || 'เกิดข้อผิดพลาดภายในระบบ',
    ...(apiError?.details ? { errors: apiError.details } : {}),
    ...(isServerError && !hideDetails ? { stack: err.stack } : {}),
  });
}
