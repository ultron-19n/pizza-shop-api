import { pool } from '../config/db.js';

export const findActivePromotionByCode = async (code, db = pool) => {
  const { rows } = await db.query(
    `SELECT * FROM promotions
     WHERE code = $1 AND is_active = TRUE
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date   IS NULL OR end_date   >= CURRENT_DATE)`,
    [code]
  );
  return rows[0] || null;
};

/**
 * บันทึกหัวออเดอร์ — รหัสชนกับของเดิมจะไม่ error แต่คืน undefined ให้ผู้เรียกสุ่มรหัสใหม่แล้วลองอีก
 * (ON CONFLICT ทำให้ไม่ต้องใช้ SAVEPOINT ประกบทุกครั้ง ประหยัดการคุยกับฐานข้อมูล 2 รอบต่อ 1 ออเดอร์)
 */
export const insertOrder = async (order, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO orders
      (order_code, customer_id, user_id, address_id, promotion_id, order_type,
       status, subtotal, discount, delivery_fee, total_amount, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (order_code) DO NOTHING
     RETURNING *`,
    [order.order_code, order.customer_id, order.user_id, order.address_id,
     order.promotion_id, order.order_type, order.status, order.subtotal,
     order.discount, order.delivery_fee, order.total_amount, order.note]
  );
  return rows[0];
};

export const insertOrderItem = async (orderId, item, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO order_items
      (order_id, menu_item_id, pizza_variant_id, quantity, unit_price, total_price, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [orderId, item.menu_item_id, item.pizza_variant_id, item.quantity,
     item.unit_price, item.total_price, item.note]
  );
  return rows[0].id;
};

/**
 * บันทึกรายการสินค้าทั้งออเดอร์ในคำสั่งเดียว แล้วคืน id ตามลำดับที่ส่งเข้ามา
 * เดิมวนบันทึกทีละบรรทัด ออเดอร์ 5 รายการ = 5 รอบไป-กลับฐานข้อมูล ตอนนี้เหลือรอบเดียว
 */
export const insertOrderItems = async (orderId, items, db = pool) => {
  const values = [orderId];
  // แถวแรกต้องระบุชนิดข้อมูลให้ PostgreSQL รู้ ไม่งั้นมันมองพารามิเตอร์เป็น text แล้วลงคอลัมน์ตัวเลขไม่ได้
  const casts = ['::int', '::int', '::int', '::numeric', '::numeric', '::text'];
  const rows = items.map((item, i) => {
    const b = values.length;
    values.push(item.menu_item_id, item.pizza_variant_id, item.quantity,
                item.unit_price, item.total_price, item.note);
    const cols = [1, 2, 3, 4, 5, 6].map((n, k) => `$${b + n}${i === 0 ? casts[k] : ''}`);
    return `(${cols.join(', ')}, ${i})`;
  });

  const { rows: inserted } = await db.query(
    `INSERT INTO order_items (order_id, menu_item_id, pizza_variant_id, quantity, unit_price, total_price, note)
     SELECT $1, v.menu_item_id, v.pizza_variant_id, v.quantity, v.unit_price, v.total_price, v.note
     FROM (VALUES ${rows.join(',')}) AS v(menu_item_id, pizza_variant_id, quantity, unit_price, total_price, note, seq)
     ORDER BY v.seq
     RETURNING id`,
    values
  );
  // ORDER BY บังคับให้แถวถูกเพิ่มตามลำดับที่ส่งมา และ id มาจาก sequence ที่เพิ่มขึ้นเสมอ
  // เรียง id จากน้อยไปมากจึงได้ลำดับเดียวกับ items เป๊ะ โดยไม่ต้องเชื่อลำดับของ RETURNING
  return inserted.map(r => r.id).sort((a, b) => a - b);
};

/** บันทึกท็อปปิ้งของทุกรายการในออเดอร์ในคำสั่งเดียว */
export const insertOrderItemToppings = async (toppings, db = pool) => {
  if (!toppings.length) return;

  const values = [];
  const rows = toppings.map((t, i) => {
    const b = i * 4;
    values.push(t.order_item_id, t.topping_id, t.quantity, t.price);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`;
  });

  await db.query(
    `INSERT INTO order_item_toppings (order_item_id, topping_id, quantity, price)
     VALUES ${rows.join(',')}`,
    values
  );
};

export const insertOrderItemTopping = async (orderItemId, topping, db = pool) => {
  await db.query(
    `INSERT INTO order_item_toppings (order_item_id, topping_id, quantity, price)
     VALUES ($1,$2,$3,$4)`,
    [orderItemId, topping.topping_id, topping.quantity, topping.price]
  );
};

export const insertPayment = async (orderId, { method, amount }, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO payments (order_id, method, amount, status)
     VALUES ($1, $2, $3, 'unpaid') RETURNING *`,
    [orderId, method, amount]
  );
  return rows[0];
};

export const findPayment = async (orderId, db = pool) => {
  const { rows } = await db.query('SELECT * FROM payments WHERE order_id = $1 FOR UPDATE', [orderId]);
  return rows[0] || null;
};

/** จ่ายได้เฉพาะรายการที่ยังไม่จ่าย — เงื่อนไขอยู่ใน UPDATE กดรับเงินซ้ำพร้อมกันจึงบันทึกได้ครั้งเดียว */
export const markPaid = async (orderId, { method, transaction_ref, received_amount, change_amount }, db = pool) => {
  const { rows } = await db.query(
    `UPDATE payments
     SET status = 'paid', method = $1, transaction_ref = $2,
         received_amount = $3, change_amount = $4, paid_at = CURRENT_TIMESTAMP
     WHERE order_id = $5 AND status <> 'paid' RETURNING *`,
    [method, transaction_ref, received_amount, change_amount, orderId]
  );
  return rows[0] || null;
};

/** คืนเงินได้เฉพาะรายการที่จ่ายแล้ว — เงื่อนไขอยู่ใน UPDATE กันคืนซ้ำสองครั้ง */
export const markRefunded = async (orderId, db = pool) => {
  const { rows } = await db.query(
    `UPDATE payments SET status = 'refunded'
     WHERE order_id = $1 AND status = 'paid' RETURNING *`,
    [orderId]
  );
  return rows[0] || null;
};

export const findOrders = async ({ status = null, date = null, customerId = null, limit = 200 }, db = pool) => {
  const { rows } = await db.query(
    `SELECT o.*, c.first_name, c.last_name, c.phone_number
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ($1::text IS NULL OR o.status = $1)
       AND ($2::date IS NULL OR DATE(o.created_at) = $2)
       AND ($3::int  IS NULL OR o.customer_id = $3)
     ORDER BY o.created_at DESC
     LIMIT $4`,
    [status, date, customerId, limit]
  );
  return rows;
};

/**
 * รายการออเดอร์พร้อมรายละเอียดครบในคิวรีเดียว — โครงสร้างเหมือน findOrderDetail ทุกประการ
 *
 * เดิมหน้าคิวหลังร้านต้องเรียก /orders 1 ครั้งแล้วตามด้วย /orders/:id อีกสูงสุด 30 ครั้ง
 * รวม 31 คำขอทุกครั้งที่รีเฟรช (ทุก 15 วินาที) ตอนนี้เหลือคำขอเดียว
 */
export const findOrdersWithDetail = async ({ status = null, date = null, customerId = null, limit = 30 }, db = pool) => {
  const { rows } = await db.query(
    `SELECT o.*,
            json_build_object(
              'id', c.id,
              'name', c.first_name || ' ' || COALESCE(c.last_name,''),
              'phone', c.phone_number
            ) AS customer,
            (
              SELECT COALESCE(json_agg(x ORDER BY x.id), '[]') FROM (
                SELECT oi.id, m.name AS menu_name, v.size, v.crust, v.sauce,
                       oi.quantity, oi.unit_price, oi.total_price, oi.note,
                       COALESCE((
                         SELECT json_agg(json_build_object(
                           'name', t.name, 'qty', oit.quantity, 'price', oit.price))
                         FROM order_item_toppings oit
                         JOIN toppings t ON t.id = oit.topping_id
                         WHERE oit.order_item_id = oi.id
                       ), '[]') AS toppings
                FROM order_items oi
                JOIN menu_items m ON m.id = oi.menu_item_id
                LEFT JOIN pizza_variants v ON v.id = oi.pizza_variant_id
                WHERE oi.order_id = o.id
              ) x
            ) AS items,
            (SELECT row_to_json(p) FROM payments p WHERE p.order_id = o.id LIMIT 1) AS payment
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ($1::text IS NULL OR o.status = $1)
       AND ($2::date IS NULL OR DATE(o.created_at) = $2)
       AND ($3::int  IS NULL OR o.customer_id = $3)
     ORDER BY o.created_at DESC
     LIMIT $4`,
    [status, date, customerId, limit]
  );
  return rows;
};

/** ใบเสร็จเต็ม: ออเดอร์ + รายการ + ท็อปปิ้ง + ลูกค้า + การชำระเงิน ในคิวรีเดียว */
export const findOrderDetail = async (id, db = pool) => {
  const { rows } = await db.query(
    `SELECT o.*,
            json_build_object(
              'id', c.id,
              'name', c.first_name || ' ' || COALESCE(c.last_name,''),
              'phone', c.phone_number
            ) AS customer,
            (
              SELECT COALESCE(json_agg(x), '[]') FROM (
                SELECT oi.id, m.name AS menu_name, v.size, v.crust, v.sauce,
                       oi.quantity, oi.unit_price, oi.total_price, oi.note,
                       COALESCE((
                         SELECT json_agg(json_build_object(
                           'name', t.name, 'qty', oit.quantity, 'price', oit.price))
                         FROM order_item_toppings oit
                         JOIN toppings t ON t.id = oit.topping_id
                         WHERE oit.order_item_id = oi.id
                       ), '[]') AS toppings
                FROM order_items oi
                JOIN menu_items m ON m.id = oi.menu_item_id
                LEFT JOIN pizza_variants v ON v.id = oi.pizza_variant_id
                WHERE oi.order_id = o.id
              ) x
            ) AS items,
            (SELECT row_to_json(p) FROM payments p WHERE p.order_id = o.id LIMIT 1) AS payment
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * FOR UPDATE ล็อกแถวไว้จนจบ transaction — กดยกเลิก/เปลี่ยนสถานะซ้ำพร้อมกันจะรอคิว
 * แล้วเห็นสถานะใหม่ ไม่ผ่านการตรวจด้วยสถานะเก่าจนคืนสต๊อกซ้ำ (เรียกภายใน transaction เท่านั้น)
 */
export const findOrderStatus = async (id, db = pool) => {
  const { rows } = await db.query(
    'SELECT id, status, customer_id, total_amount FROM orders WHERE id = $1 FOR UPDATE',
    [id]
  );
  return rows[0] || null;
};

export const updateStatus = async (id, status, db = pool) => {
  const { rows } = await db.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
};

/** รายการสินค้าในออเดอร์ — ใช้ตอนยกเลิกเพื่อคืนสต๊อก */
export const findItemsForRestock = async (orderId, db = pool) => {
  const { rows } = await db.query(
    'SELECT pizza_variant_id, quantity FROM order_items WHERE order_id = $1',
    [orderId]
  );
  return rows;
};

export const dailySales = async (limit = 30, db = pool) => {
  const { rows } = await db.query('SELECT * FROM v_daily_sales LIMIT $1', [limit]);
  return rows;
};

/**
 * ยอดรับเงินแยกตามช่องทาง ของวันที่ระบุ (ไม่ระบุ = วันนี้ตามเวลาไทย)
 * ใช้ตอนปิดร้าน: เทียบ "เงินสดที่ระบบบอก" กับ "เงินที่นับได้จริงในลิ้นชัก"
 */
export const paymentsByMethod = async (date = null, db = pool) => {
  const { rows } = await db.query(
    `SELECT p.method,
            COUNT(*)::int                       AS bills,
            SUM(p.amount)                       AS amount,
            SUM(COALESCE(p.received_amount, 0)) AS received,
            SUM(COALESCE(p.change_amount, 0))   AS change_given
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'paid'
       AND DATE(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')
           = COALESCE($1::date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok')::date)
     GROUP BY p.method
     ORDER BY amount DESC`,
    [date]
  );
  return rows;
};

export const bestSellers = async (limit = 10, db = pool) => {
  const { rows } = await db.query(
    `SELECT m.name, SUM(oi.quantity) AS sold, SUM(oi.total_price) AS revenue
     FROM order_items oi
     JOIN menu_items m ON m.id = oi.menu_item_id
     JOIN orders o ON o.id = oi.order_id AND o.status = 'completed'
     GROUP BY m.name ORDER BY sold DESC LIMIT $1`,
    [limit]
  );
  return rows;
};
