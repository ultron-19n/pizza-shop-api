import * as promoService from '../services/promotion.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const usable = asyncHandler(async (_req, res) => res.json(await promoService.usable()));
export const list   = asyncHandler(async (_req, res) => res.json(await promoService.list()));

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await promoService.create(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await promoService.update(req.params.id, req.body));
});
