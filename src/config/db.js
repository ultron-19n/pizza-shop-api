import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// คอลัมน์ DATE (oid 1082) ให้คืนเป็นสตริง 'YYYY-MM-DD' ตรงๆ
// ค่าเริ่มต้นของ pg แปลงเป็น Date เที่ยงคืนตามเวลาเครื่อง พอ JSON เป็น UTC วันที่ในไทย (UTC+7) จะเลื่อนถอยหลังไป 1 วัน
pg.types.setTypeParser(1082, (value) => value);

/**
 * จำนวนการเชื่อมต่อสูงสุดต่อ 1 process
 * - รันเป็นเซิร์ฟเวอร์ปกติ: 10 ช่อง ใช้ร่วมกันทั้งเครื่อง
 * - รันบน serverless (Vercel): แต่ละ instance เปิด pool ของตัวเอง ถ้าตั้ง 10 แล้วมี 20 instance
 *   จะกลายเป็น 200 การเชื่อมต่อวิ่งไปหาฐานข้อมูลพร้อมกันจนชนเพดาน จึงเหลือน้อย ๆ ต่อ instance
 */
const MAX_CLIENTS = process.env.VERCEL ? 2 : Number(process.env.PG_POOL_MAX || 20);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PGSSL ? { rejectUnauthorized: false } : false,
  max: MAX_CLIENTS,
  idleTimeoutMillis: 30_000,
  // ช่วงพีคที่คำขอเข้ามาพร้อมกันเป็นร้อย ให้รอคิวนานหน่อยดีกว่าตอบ error ทันที
  // (10 วินาทีสั้นพอที่ผู้ใช้จะยังไม่ปิดหน้าหนี แต่ยาวพอให้คลื่นคำขอระบายทัน)
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('❌ PG pool error:', err.message));

export const query = (text, params) => pool.query(text, params);

/**
 * รันหลายคำสั่งใน transaction เดียว — พลาดขั้นตอนไหน rollback ทั้งหมด
 * ใช้: await withTransaction(async (client) => { ... })
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
