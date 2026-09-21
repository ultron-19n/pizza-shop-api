import { env, assertEnv } from './config/env.js';   // ต้องเป็น import แรกเสมอ
import { createApp } from './app.js';
import { pool } from './config/db.js';

try {
  assertEnv();
} catch (err) {
  console.error('❌', err.message);
  process.exit(1);
}

const server = createApp().listen(env.PORT, () => {
  console.log(`🍕 หน้าสั่งซื้อ   http://localhost:${env.PORT}/`);
  console.log(`👔 หน้าพนักงาน  http://localhost:${env.PORT}/admin.html`);
  console.log(`🔌 API           http://localhost:${env.PORT}/api`);
});

/** ปิดการเชื่อมต่อให้เรียบร้อยเมื่อถูกสั่งหยุด (Ctrl+C หรือ container หยุด) */
const shutdown = (signal) => {
  console.log(`\n${signal} — กำลังปิดเซิร์ฟเวอร์…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
