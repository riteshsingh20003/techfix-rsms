import type { Request, Response } from 'express';
import { ServiceModel } from '../models/service.model';
import { ApiError } from '../utils/api-error';

export async function listServices(req: Request, res: Response) {
  const query = res.locals.validatedQuery as { search: string; page: number; pageSize: number };
  const data = await ServiceModel.list(query.search, query.page, query.pageSize);
  res.json({ success: true, data });
}
export async function getService(req: Request, res: Response) {
  const data = await ServiceModel.findById(Number(req.params.id));
  if (!data) throw new ApiError(404, 'Service not found.');
  res.json({ success: true, data });
}
export async function createService(req: Request, res: Response) {
  const data = await ServiceModel.create(req.body);
  res.status(201).json({ success: true, data, message: 'Service created.' });
}
export async function updateService(req: Request, res: Response) {
  const data = await ServiceModel.update(Number(req.params.id), req.body);
  if (!data) throw new ApiError(404, 'Service not found.');
  res.json({ success: true, data, message: 'Service updated.' });
}
export async function deleteService(req: Request, res: Response) {
  const archived = await ServiceModel.archive(Number(req.params.id));
  if (!archived) throw new ApiError(404, 'Service not found.');
  res.json({ success: true, message: 'Service archived.' });
}
