import type { Request, Response } from 'express';
import { ClientModel } from '../models/client.model';
import { ApiError } from '../utils/api-error';

export async function listClients(req: Request, res: Response) {
  const query = res.locals.validatedQuery as { search: string; page: number; pageSize: number };
  const data = await ClientModel.list(query.search, query.page, query.pageSize);
  res.json({ success: true, data });
}
export async function getClient(req: Request, res: Response) {
  const data = await ClientModel.findById(Number(req.params.id));
  if (!data) throw new ApiError(404, 'Customer not found.');
  res.json({ success: true, data });
}
export async function createClient(req: Request, res: Response) {
  const data = await ClientModel.create(req.body);
  res.status(201).json({ success: true, data, message: 'Customer created.' });
}
export async function updateClient(req: Request, res: Response) {
  const data = await ClientModel.update(Number(req.params.id), req.body);
  if (!data) throw new ApiError(404, 'Customer not found.');
  res.json({ success: true, data, message: 'Customer updated.' });
}
export async function deleteClient(req: Request, res: Response) {
  try {
    const deleted = await ClientModel.delete(Number(req.params.id));
    if (!deleted) throw new ApiError(404, 'Customer not found.');
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
      throw new ApiError(409, 'This customer has repair records and cannot be deleted.');
    }
    throw error;
  }
}
