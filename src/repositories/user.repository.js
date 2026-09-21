import { pool } from '../config/db.js';

const PUBLIC_FIELDS = 'id, username, first_name, last_name, phone_number, role, status, created_at';

export const findByUsername = async (username, db = pool) => {
  const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] || null;
};

export const findById = async (id, db = pool) => {
  const { rows } = await db.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
};

export const count = async (db = pool) => {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
};

export const insertUser =async (user, db = pool) => {
  const { rows } = await db.query(
    `INSERT INTO users (username, password_hash, first_name, last_name, phone_number, role, status)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'staff'), 'active')
     RETURNING ${PUBLIC_FIELDS}`,
    [user.username, user.password_hash, user.first_name, user.last_name, user.phone_number, user.role]
  );
  return rows[0];
};
