import { ApiError } from '../utils/ApiError.js';

/**
 * ตัวจำกัดจำนวนคำขอแบบง่าย เก็บสถิติไว้ในหน่วยความจำของ process
 *
 * ใช้: router.post('/login', rateLimit({ max: 10, windowMs: 15*60*1000 }), controller.login)
 *
 * ข้อจำกัดที่ต้องรู้: นับแยกตาม process ถ้ารันหลาย instance (เช่น Vercel serverless)
 * แต่ละ instance จะนับของตัวเอง กันได้แค่การยิงรัวจากเครื่องเดียว ไม่ใช่การโจมตีแบบกระจาย
 * ถ้าต้องการของจริงจังให้ย้ายไปนับที่ Redis หรือใช้ rate limit ของ reverse proxy
 */
const buckets = new Map();

/** ล้างของเก่าทิ้งเป็นระยะ ไม่ให้ Map โตไม่รู้จบ */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const alive = hits.filter(t => t > now);
    if (alive.length) buckets.set(key, alive);
    else buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

/** ผู้ใช้ที่อยู่หลัง proxy จะเห็นเป็น IP เดียวกันหมด จึงเอา x-forwarded-for มาก่อนถ้ามี */
const clientKey = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
};

/**
 * onlyFailures = true: นับเฉพาะคำขอที่ตอบกลับเป็น error (4xx/5xx)
 * ใช้กับหน้าเข้าสู่ระบบ — พนักงานหลายคนที่ใช้เน็ตร้านเดียวกันจะไม่ติดล็อกจากการล็อกอินที่สำเร็จ
 * แต่คนที่เดารหัสผิดซ้ำ ๆ ยังโดนสกัดเหมือนเดิม
 */
export function rateLimit({ max, windowMs, name = 'default', message, onlyFailures = false }) {
  return (req, res, next) => {
    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();

    const hits = (buckets.get(key) || []).filter(expiry => expiry > now);
    if (hits.length >= max) {
      const waitSeconds = Math.ceil((Math.min(...hits) - now) / 1000);
      return next(new ApiError(429,
        message || `ส่งคำขอถี่เกินไป กรุณารออีก ${waitSeconds} วินาทีแล้วลองใหม่`));
    }

    const expiry = now + windowMs;
    hits.push(expiry);
    buckets.set(key, hits);

    // คืนโควตาให้เมื่อคำขอสำเร็จ
    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode >= 400) return;
        const remaining = (buckets.get(key) || []).filter(e => e > Date.now());
        const index = remaining.indexOf(expiry);
        if (index !== -1) remaining.splice(index, 1);
        remaining.length ? buckets.set(key, remaining) : buckets.delete(key);
      });
    }

    next();
  };
}
