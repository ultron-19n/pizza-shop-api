import { Router } from 'express';
import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import authRoutes from './auth.routes.js';
import menuRoutes from './menu.routes.js';
import customerRoutes from './customer.routes.js';
import orderRoutes from './order.routes.js';
import ingredientRoutes from './ingredient.routes.js';

const router = Router();

router.get('/health', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT NOW() AS now');
  res.json({ status: 'ok', db_time: rows[0].now });
}));

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/customers', customerRoutes);
router.use('/orders', orderRoutes);
router.use('/ingredients', ingredientRoutes);

export default router;
