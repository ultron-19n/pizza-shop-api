import * as customerService from '../services/customer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const search  = asyncHandler(async (req, res) => res.json(await customerService.search(req.query)));
export const getById = asyncHandler(async (req, res) => res.json(await customerService.getById(req.params.id)));

export const upsert = asyncHandler(async (req, res) => {
  res.status(201).json(await customerService.upsert(req.body));
});

export const addAddress = asyncHandler(async (req, res) => {
  res.status(201).json(await customerService.addAddress(req.params.id, req.body));
});
