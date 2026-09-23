import * as menuService from '../services/menu.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const categories = asyncHandler(async (_req, res) => res.json(await menuService.categories()));
export const toppings   = asyncHandler(async (_req, res) => res.json(await menuService.toppings()));
export const list       = asyncHandler(async (req, res)  => res.json(await menuService.list(req.query)));
export const getById    = asyncHandler(async (req, res)  => res.json(await menuService.getById(req.params.id)));

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await menuService.create(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await menuService.update(req.params.id, req.body));
});

export const deactivate = asyncHandler(async (req, res) => {
  res.json(await menuService.deactivate(req.params.id));
});

export const addVariant = asyncHandler(async (req, res) => {
  res.status(201).json(await menuService.addVariant(req.params.id, req.body));
});

export const listForManage = asyncHandler(async (_req, res) => res.json(await menuService.listForManage()));
export const allToppings   = asyncHandler(async (_req, res) => res.json(await menuService.allToppings()));

export const updateVariant = asyncHandler(async (req, res) => {
  res.json(await menuService.updateVariant(req.params.id, req.body));
});

export const createTopping = asyncHandler(async (req, res) => {
  res.status(201).json(await menuService.createTopping(req.body));
});

export const updateTopping = asyncHandler(async (req, res) => {
  res.json(await menuService.updateTopping(req.params.id, req.body));
});

/* ---------- ลบถาวร ---------- */
export const remove = asyncHandler(async (req, res) => res.json(await menuService.remove(req.params.id)));
export const removeVariant = asyncHandler(async (req, res) => res.json(await menuService.removeVariant(req.params.id)));
export const removeTopping = asyncHandler(async (req, res) => res.json(await menuService.removeTopping(req.params.id)));
