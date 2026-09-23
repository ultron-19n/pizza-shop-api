import { pool } from '../config/db.js';

const PUBLIC_FIELDS = 'id, username, email, first_name, last_name, phone_number, role, status, created_at';

export const findByUsername = async (username, db = pool) => {
  const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
};

export const findByEmail = async (email, db = pool) => {
  const { rows } = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  return rows[0] || null;
};

/** ผู้ใช้กรอกอะไรมาก็ได้ในช่องเดียว — เทียบทั้งชื่อผู้ใช้และอีเมล (อีเมลไม่สนตัวพิมพ์เล็กใหญ่) */
export const findByLogin = async (identifier, db = pool) => {
  const { rows } = await db.query(
    'SELECT * FROM users WHERE username = $1 OR LOWER(email) = LOWER($1) LIMIT 1',
    [identifier]
  );
  return rows[0] || null;
};

export const findById = async (id, db = pool) => {
  const { rows } = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
};

export const findAll = async (db = pool) => {
  const { rows } = await db.query(
    `SELECT ${PUBLIC_FIELDS} FROM users ORDER BY status, role, id`
  );
  return rows;
};

/** แก้ได้เฉพาะ role/status/ข้อมูลติดต่อ — รหัสผ่านมีเส้นทางของตัวเอง */
export const updateUser = async (id, patch, db = pool) => {
  const { rows } = await db.query(
    `UPDATE users SET
       first_name   = COALESCE($1, first_name),
       last_name    = COALESCE($2, last_name),
       phone_number = COALESCE($3, phone_number),
       email        = COALESCE($4, email),
       role         = COALESCE($5, role),
       status       = COALESCE($6, status)
     WHERE id = $7 RETURNING ${PUBLIC_FIELDS}`,
    [patch.first_name, patch.last_name, patch.phone_number, patch.email,
     patch.role, patch.status, id]
  );
  return rows[0] || null;
};

export const updatePassword = async (id, password_hash, db = pool) => {
  const { rowCount } = await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]
  );
  return rowCount > 0;
};

export const countActiveAdmins = async (db = pool) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND status = 'active'`
  );
  return rows[0].n;
};

export const count = async (db = pool) => {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
};

export const insertUser = async (user, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, role, status)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'staff'), 'active')
     RETURNING ${PUBLIC_FIELDS}`,
    [user.username, user.email, user.password_hash, user.first_name,
     user.last_name, user.phone_number, user.role]
  );
  return rows[0];
};
