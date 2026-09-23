import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * แยก app ออกจาก server เพื่อให้เทสสร้าง app ขึ้นมาทดสอบได้
 * โดยไม่ต้องเปิดพอร์ตจริง เช่น  request(createApp()).get('/api/menu')
 */
export function createApp() {
  const app = express();

  // ตั้ง ALLOWED_ORIGINS แล้วจะรับเฉพาะโดเมนที่ระบุ ไม่ตั้ง (ตอนพัฒนา) = รับทุกโดเมน
  app.use(cors(env.ALLOWED_ORIGINS.length
    ? { origin: env.ALLOWED_ORIGINS, credentials: true }
    : {}));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use(express.static(path.join(__dirname, '../public')));
  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
