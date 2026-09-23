/**
 * จุดเข้าใช้งานสำหรับ Vercel (serverless)
 *
 * ต่างจาก src/server.js ตรงที่ "ไม่เรียก listen" เพราะบน Vercel ไม่มีพอร์ตให้เปิดค้างไว้
 * แต่ละคำขอจะถูกส่งเข้ามาที่ handler ที่ export ออกไปนี้ แล้ว Vercel จัดการที่เหลือเอง
 *
 * รันในเครื่องยังใช้ `npm run dev` (src/server.js) เหมือนเดิม
 */
import { createApp } from '../src/app.js';
import { assertEnv } from '../src/config/env.js';

// ค่าที่จำเป็นต้องตั้งใน Vercel: DATABASE_URL, JWT_SECRET, NODE_ENV=production
// ถ้าขาด จะล้มตั้งแต่ตอนนี้พร้อมข้อความบอกสาเหตุใน log ดีกว่าไปพังตอนมีคนใช้งาน
assertEnv();

export default createApp();
