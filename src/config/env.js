import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'pizza_shop_jwt_secret_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  DATABASE_URL: process.env.DATABASE_URL,
  PGSSL: process.env.PGSSL === 'true',
};

export function assertEnv() {
  if (!env.DATABASE_URL) {
    console.warn('⚠️ Warning: DATABASE_URL is not set');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ Warning: JWT_SECRET is using fallback key');
  }
}