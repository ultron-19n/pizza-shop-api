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

export const insertOrder = async (order, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO orders
      (order_code, customer_id, user_id, address_id, promotion_id, order_type,
       status, subtotal, discount, delivery_fee, total_amount, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
export const markPaid = async (orderId, { method, transaction_ref }, db = pool) => {
  const { rows } = await db.query(
    `UPDATE payments
     SET status = 'paid', method = $1, transaction_ref = $2, paid_at = CURRENT_TIMESTAMP
     WHERE order_id = $3 AND status <> 'paid' RETURNING *`,
    [method, transaction_ref, orderId]
  );
  return rows[0] || null;
};

export const findOrders = async ({ status = null, date = null, customerId = null }, db = pool) => {
  const { rows } = await db.query(
    `SELECT o.*, c.first_name, c.last_name, c.phone_number
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ($1::text IS NULL OR o.status = $1)
       AND ($2::date IS NULL OR DATE(o.created_at) = $2)
       AND ($3::int  IS NULL OR o.customer_id = $3)
     ORDER BY o.created_at DESC
     LIMIT 200`,
    [status, date, customerId]
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
