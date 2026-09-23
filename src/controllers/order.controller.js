import * as orderService from '../services/order.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder(req.body, req.user?.id ?? null);
  res.status(201).json(order);
});

export const list = asyncHandler(async (req, res) => {
  res.json(await orderService.list({
    status: req.query.status || null,
    date: req.query.date || null,
    customerId: req.query.customer_id || null,
    detail: req.query.detail === '1' || req.query.detail === 'true',
    limit: Math.min(Number(req.query.limit) || 30, 200),
  }));
});

export const getDetail = asyncHandler(async (req, res) => {
  res.json(await orderService.getDetail(req.params.id));
});

export const changeStatus = asyncHandler(async (req, res) => {
  res.json(await orderService.changeStatus(req.params.id, req.body.status, req.user?.id ?? null));
});

export const pay = asyncHandler(async (req, res) => {
  res.json(await orderService.pay(req.params.id, req.body));
});

export const notifyTransfer = asyncHandler(async (req, res) => {
  res.json(await orderService.notifyTransfer(req.params.code, req.body));
});

export const checkPromotion = asyncHandler(async (req, res) => {
  res.json(await orderService.checkPromotion(req.params.code));
});

export const summary = asyncHandler(async (req, res) => {
  res.json(await orderService.summary({ date: req.query.date || null }));
});

export const remove = asyncHandler(async (req, res) => res.json(await orderService.remove(req.params.id)));
