import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** controller ทำหน้าที่เดียว: แปลง HTTP <-> service ไม่มีตรรกะธุรกิจ */
export const register = asyncHandler(async (req, res) => {
  res.status(201).json(await authService.register(req.body, req.user));
});

export const login = asyncHandler(async (req, res) => {
  res.json(await authService.login(req.body));
});

export const me = asyncHandler(async (req, res) => {
  res.json(await authService.me(req.user.id));
});

export const setupStatus = asyncHandler(async (_req, res) => {
  res.json(await authService.needsSetup());
});

export const listUsers = asyncHandler(async (_req, res) => {
  res.json(await authService.listUsers());
});

export const updateUser = asyncHandler(async (req, res) => {
  res.json(await authService.updateUser(req.params.id, req.body, req.user));
});

export const resetPassword = asyncHandler(async (req, res) => {
  res.json(await authService.resetPassword(req.params.id, req.body.password));
});
