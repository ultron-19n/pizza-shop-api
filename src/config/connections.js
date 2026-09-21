/**
 * =====================================================================
 * Connect DB — ตัวอย่างการเชื่อมต่อฐานข้อมูลทั้ง 4 แบบ
 * =====================================================================
 * เลือกใช้ตัวใดตัวหนึ่งผ่าน .env:  DB_DRIVER=postgres | sqlite | mysql | mongodb | supabase
 *
 * ติดตั้งไลบรารีตามที่จะใช้:
 *   npm install pg                       # PostgreSQL (ค่าเริ่มต้น)
 *   npm install better-sqlite3           # SQLite
 *   npm install mysql2                   # MySQL / MariaDB
 *   npm install mongoose                 # MongoDB
 *   npm install @supabase/supabase-js    # Supabase client
 */

import dotenv from 'dotenv';
dotenv.config();

/* ===================================================================
 * 1) SQLite — ไฟล์เดียวจบ เหมาะกับตอนพัฒนา/สอบ ไม่ต้องติดตั้ง server
 * =================================================================== */
export async function connectSQLite(file = process.env.SQLITE_FILE || './pizza_shop.db') {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL'); // อ่าน/เขียนพร้อมกันได้ดีขึ้น
  console.log('✅ SQLite connected:', file);
  return db;
}

// ตัวอย่างใช้งาน (better-sqlite3 ทำงานแบบ synchronous)
export function sqliteExample(db) {
  const menu = db.prepare('SELECT * FROM menu_items WHERE is_active = 1').all();

  const insert = db.prepare(
    'INSERT INTO orders (order_code, order_type, total_amount) VALUES (?, ?, ?)'
  );
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run(r.code, r.type, r.total);
  });

  return { menu, tx };
}

/* ===================================================================
 * 2) MySQL — ใช้ mysql2/promise + connection pool
 * =================================================================== */
export async function connectMySQL() {
  const mysql = await import('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'pizza_shop',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  await pool.query('SELECT 1');
  console.log('✅ MySQL connected');
  return pool;
}

export async function mysqlExample(pool) {
  // MySQL ใช้ ? แทน $1 และไม่มี RETURNING
  const [menu] = await pool.query('SELECT * FROM menu_items WHERE is_active = ?', [1]);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO orders (order_code, order_type, total_amount) VALUES (?, ?, ?)',
      ['PZ260908-1234', 'pickup', 299]
    );
    const orderId = result.insertId; // แทน RETURNING id
    await conn.commit();
    return { menu, orderId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/* ===================================================================
 * 3) MongoDB — mongoose
 * =================================================================== */
export async function connectMongo() {
  const mongoose = (await import('mongoose')).default;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pizza_shop';
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected:', mongoose.connection.name);
  return mongoose;
}

export async function mongoExample() {
  const { MenuItem, Order } = await import('../../db/mongodb/models.js');

  const menu = await MenuItem.find({ is_active: true }).populate('category_id');

  const order = await Order.create({
    order_code: 'PZ260908-1234',
    order_type: 'pickup',
    items: [
      { menu_name: 'Pepperoni', size: 'M', quantity: 1, unit_price: 289, total_price: 289 },
    ],
    subtotal: 289,
    total_amount: 289,
  });

  return { menu, order };
}

/* ===================================================================
 * 4) Supabase — client ของ Supabase (เหมาะกับยิงจากหน้าเว็บโดยตรง)
 *    - anon key   : ใช้บนเบราว์เซอร์ ผ่าน RLS
 *    - service key: ใช้บนเซิร์ฟเวอร์เท่านั้น ข้าม RLS ห้ามหลุดไป frontend
 * =================================================================== */
export async function connectSupabase({ admin = false } = {}) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    process.env.SUPABASE_URL,
    admin ? process.env.SUPABASE_SERVICE_KEY : process.env.SUPABASE_ANON_KEY
  );
  console.log('✅ Supabase client ready', admin ? '(service role)' : '(anon)');
  return client;
}

export async function supabaseExample(supabase) {
  // อ่านเมนูพร้อม variants แบบ nested — Supabase ทำ join ให้จาก foreign key
  const { data: menu, error } = await supabase
    .from('menu_items')
    .select('id, name, description, image_url, pizza_variants(id, size, crust, price)')
    .eq('is_active', true);
  if (error) throw error;

  // เรียก RPC ที่เขียนไว้ใน schema-supabase.sql
  const { data: orderId } = await supabase.rpc('create_order', {
    p_customer_id: 1,
    p_order_type: 'delivery',
    p_items: [{ variant_id: 6, quantity: 2 }],
  });

  // Realtime — ครัวเห็นออเดอร์ใหม่ทันที
  supabase
    .channel('kitchen')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      console.log('🔔 ออเดอร์ใหม่:', payload.new.order_code);
    })
    .subscribe();

  return { menu, orderId };
}

/* ===================================================================
 * ตัวเลือกกลาง — เรียกครั้งเดียวจาก server.js
 * =================================================================== */
export async function connectDatabase() {
  const driver = (process.env.DB_DRIVER || 'postgres').toLowerCase();
  switch (driver) {
    case 'sqlite':   return { driver, db: await connectSQLite() };
    case 'mysql':    return { driver, db: await connectMySQL() };
    case 'mongodb':  return { driver, db: await connectMongo() };
    case 'supabase': return { driver, db: await connectSupabase({ admin: true }) };
    default: {
      const { pool } = await import('./db.js');
      await pool.query('SELECT 1');
      console.log('✅ PostgreSQL connected');
      return { driver: 'postgres', db: pool };
    }
  }
}
