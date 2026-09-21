import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✅ สร้างตารางเรียบร้อย (schema.sql)');
  await pool.end();
};

run().catch((err) => {
  console.error('❌ migrate ล้มเหลว:', err.message);
  process.exit(1);
});
