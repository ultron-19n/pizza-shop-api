import * as inventory from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list     = asyncHandler(async (_req, res) => res.json(await inventory.list()));
export const lowStock = asyncHandler(async (_req, res) => res.json(await inventory.listLowStock()));
export const logs     = asyncHandler(async (req, res)  => res.json(await inventory.logs(req.params.id)));

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await inventory.create(req.body));
});

export const restock = asyncHandler(async (req, res) => {
  const updated = await inventory.restock({
    ingredientId: req.params.id,
    quantity: req.body.quantity,
    userId: req.user.id,
    note: req.body.note,
  });
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => res.json(await inventory.remove(req.params.id)));
