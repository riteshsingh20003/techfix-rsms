import type { Request, Response } from 'express';
import { RepairModel } from '../models/repair.model';
import { ApiError } from '../utils/api-error';

const validStatuses = ['', 'pending', 'approved', 'in_progress', 'checking', 'done', 'cancelled'];
export async function listRepairs(req: Request, res: Response) {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').trim();
  if (!validStatuses.includes(status)) throw new ApiError(400, 'Invalid repair status filter.');
  const data = await RepairModel.list(search, status);
  res.json({ success: true, data });
}
export async function getRepair(req: Request, res: Response) {
  const data = await RepairModel.findById(Number(req.params.id));
  if (!data) throw new ApiError(404, 'Repair not found.');
  res.json({ success: true, data });
}
export async function trackRepair(req: Request, res: Response) {
  const code = String(req.params.code ?? '').trim().toUpperCase();
  const data = await RepairModel.findPublicStatus(code);
  if (!data) throw new ApiError(404, 'No repair record was found for that code. Check the code and try again.');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data });
}
export async function createRepair(req: Request, res: Response) {
  const data = await RepairModel.create(req.body, req.user!.id);
  res.status(201).json({ success: true, data, message: 'Repair job created.' });
}
export async function updateRepairStatus(req: Request, res: Response) {
  const data = await RepairModel.updateStatus(Number(req.params.id), req.body, req.user!.id);
  if (!data) throw new ApiError(404, 'Repair not found.');
  res.json({ success: true, data, message: 'Repair updated.' });
}
export async function createPayment(req: Request, res: Response) {
  const result = await RepairModel.createPayment(Number(req.params.id), req.body, req.user!.id);
  res.status(result.created ? 201 : 200).json({ success: true, data: result.repair, message: result.created ? 'Payment recorded.' : 'Payment was already recorded; no duplicate was created.' });
}
