import { pool } from '../config/db.js';

/**
 * ชั้น repository = ที่เดียวที่มี SQL
 * ทุกฟังก์ชันรับ `db` เป็นพารามิเตอร์แรก จะส่ง pool (ปกติ) หรือ client (ใน transaction) ก็ได้
 * เวลาย้ายไป MySQL/MongoDB แก้แค่ไฟล์ชั้นนี้ service ไม่ต้องแตะ
 */

export const findCategories = async (db = pool) => {
  const { rows } = await db.query('SELECT * FROM categories ORDER BY id');
  return rows;
};

export const findMenu = async ({ categoryId = null, search = null } = {}, db = pool) => {
  const { rows } = await db.query(
    `SELECT m.id, m.name, m.description, m.image_url, m.is_active,
            c.id AS category_id, c.name AS category_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id, 'size', v.size, 'crust', v.crust,
                  'sauce', v.sauce, 'price', v.price, 'is_available', v.is_available
                ) ORDER BY v.price
              ) FILTER (WHERE v.id IS NOT NULL), '[]'
            ) AS variants
     FROM menu_items m
     JOIN categories c ON c.id = m.category_id
     LEFT JOIN pizza_variants v ON v.menu_item_id = m.id
     WHERE m.is_active = TRUE
       AND ($1::int IS NULL OR m.category_id = $1)
       AND ($2::text IS NULL OR m.name ILIKE '%' || $2 || '%')
     GROUP BY m.id, c.id
     ORDER BY c.id, m.id`,
    [categoryId, search]
  );
  return rows;
};

export const findMenuItemById = async (id, db = pool) => {
  const { rows } = await db.query(
    `SELECT m.*, COALESCE(json_agg(v.* ORDER BY v.price)
            FILTER (WHERE v.id IS NOT NULL), '[]') AS variants
     FROM menu_items m
     LEFT JOIN pizza_variants v ON v.menu_item_id = m.id
     WHERE m.id = $1
     GROUP BY m.id`,
    [id]
  );
  return rows[0] || null;
};

export const insertMenuItem = async ({ category_id, name, description, image_url }, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO menu_items (category_id, name, description, image_url)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [category_id, name, description, image_url]
  );
  return rows[0];
};

export const updateMenuItem = async (id, patch, db = pool) => {
  const { rows } = await db.query(
    `UPDATE menu_items SET
       category_id = COALESCE($1, category_id),
       name        = COALESCE($2, name),
       description = COALESCE($3, description),
       image_url   = COALESCE($4, image_url),
       is_active   = COALESCE($5, is_active)
     WHERE id = $6 RETURNING *`,
    [patch.category_id, patch.name, patch.description, patch.image_url, patch.is_active, id]
  );
  return rows[0] || null;
};

export const deactivateMenuItem = async (id, db = pool) => {
  const { rowCount } = await db.query(
    'UPDATE menu_items SET is_active = FALSE WHERE id = $1',
    [id]
  );
  return rowCount > 0;
};

export const insertVariant = async (menuItemId, { size, crust, sauce, price }, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO pizza_variants (menu_item_id, size, crust, sauce, price)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [menuItemId, size, crust, sauce, price]
  );
  return rows[0];
};

/** ดึง variant พร้อมชื่อเมนู — ใช้ตอนคิดราคาออเดอร์ */
export const findVariantForPricing = async (variantId, db = pool) => {
  const { rows } = await db.query(
    `SELECT v.id, v.price, v.menu_item_id, v.is_available, m.name, m.is_active
     FROM pizza_variants v
     JOIN menu_items m ON m.id = v.menu_item_id
     WHERE v.id = $1`,
    [variantId]
  );
  return rows[0] || null;
};

export const findAvailableToppings = async (db = pool) => {
  const { rows } = await db.query(
    'SELECT * FROM toppings WHERE is_available = TRUE ORDER BY id'
  );
  return rows;
};

export const findToppingById = async (id, db = pool) => {
  const { rows } = await db.query(
    'SELECT * FROM toppings WHERE id = $1 AND is_available = TRUE',
    [id]
  );
  return rows[0] || null;
};

export const findRecipeByVariant = async (variantId, db = pool) => {
  const { rows } = await db.query(
    'SELECT ingredient_id, quantity_used FROM pizza_recipes WHERE pizza_variant_id = $1',
    [variantId]
  );
  return rows;
};
