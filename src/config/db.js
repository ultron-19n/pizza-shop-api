import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// คอลัมน์ DATE (oid 1082) ให้คืนเป็นสตริง 'YYYY-MM-DD' ตรงๆ
// ค่าเริ่มต้นของ pg แปลงเป็น Date เที่ยงคืนตามเวลาเครื่อง พอ JSON เป็น UTC วันที่ในไทย (UTC+7) จะเลื่อนถอยหลังไป 1 วัน
pg.types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PGSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
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
