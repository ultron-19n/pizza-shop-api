import dotenv from 'dotenv';
dotenv.config();

const isProduction = (process.env.NODE_ENV || 'development') === 'production';

/**
 * กุญแจสำรองนี้อยู่ในซอร์สโค้ด ใครอ่านโค้ดได้ก็ปลอม token เป็น admin ได้
 * จึงใช้ได้เฉพาะตอนพัฒนาในเครื่องเท่านั้น ส่วน production ถ้าไม่ตั้ง JWT_SECRET จะไม่ยอมสตาร์ต (ดู assertEnv)
 */
const DEV_ONLY_SECRET = 'dev-only-insecure-secret';

export const env = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || DEV_ONLY_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_URL: process.env.DATABASE_URL,
  PGSSL: process.env.PGSSL === 'true',
  /** โดเมนที่เรียก API ข้ามเว็บได้ คั่นด้วยจุลภาค — ว่างไว้ = อนุญาตทุกโดเมน (ใช้ได้เฉพาะตอนพัฒนา) */
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
};

/** ตรวจค่าที่จำเป็นตั้งแต่ตอนสตาร์ต — ผิดพลาดตอนนี้ดีกว่าไปพังตอนมีผู้ใช้จริง */
export function assertEnv() {
  if (!env.DATABASE_URL) {
    if (isProduction) throw new Error('ต้องตั้งค่า DATABASE_URL ก่อนรันบนเซิร์ฟเวอร์จริง');
    console.warn('⚠️ Warning: DATABASE_URL is not set');
  }

  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      throw new Error(
        'ต้องตั้งค่า JWT_SECRET ก่อนรันบนเซิร์ฟเวอร์จริง ' +
        '(สร้างคีย์สุ่มด้วย: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")'
      );
    }
    console.warn('⚠️ ยังไม่ได้ตั้ง JWT_SECRET — ใช้กุญแจสำหรับพัฒนาเท่านั้น ห้ามใช้ค่านี้บนเซิร์ฟเวอร์จริง');
  } else if (process.env.JWT_SECRET.length < 32 && isProduction) {
    throw new Error('JWT_SECRET สั้นเกินไป ควรยาวอย่างน้อย 32 ตัวอักษร');
  }

  if (isProduction && env.ALLOWED_ORIGINS.length === 0) {
    console.warn('⚠️ ยังไม่ได้ตั้ง ALLOWED_ORIGINS — API เปิดให้ทุกโดเมนเรียกได้');
  }
}