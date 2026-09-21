import dotenv from 'dotenv';

/**
 * โหลด .env ให้เสร็จก่อนโมดูลอื่นอ่าน process.env
 *
 * ES module จะรัน import ทั้งหมดก่อนโค้ดบรรทัดแรกเสมอ
 * ถ้าเรียก dotenv.config() ในตัว server.js โมดูลที่ import ไว้ด้านบนจะโหลดไปก่อนแล้ว
 * และอ่านค่าไม่เจอ จึงต้องแยกมาเป็นไฟล์และ import ไฟล์นี้เป็นอันดับแรก
 */
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_URL: process.env.DATABASE_URL,
  PGSSL: process.env.PGSSL === 'true',
};

/** ตรวจค่าที่ขาดไม่ได้ตั้งแต่ตอนเปิดเครื่อง ดีกว่าไปพังตอนมีคนใช้งาน */
export function assertEnv() {
  const missing = ['JWT_SECRET', 'DATABASE_URL'].filter((k) => !process.env[k]);
  console.log('ALL ENV KEYS:', Object.keys(process.env));
  if (missing.length) {
    throw new Error(`ไม่ได้ตั้งค่าใน .env: ${missing.join(', ')}`);
  }
}
