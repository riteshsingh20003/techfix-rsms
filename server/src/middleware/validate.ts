import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../utils/api-error';

type Target = 'body' | 'params' | 'query';
export const validate = (schema: ZodType, target: Target = 'body') => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) return next(new ApiError(400, 'Please check the submitted fields.', result.error.flatten().fieldErrors));
  if (target === 'body') req.body = result.data;
  else if (target === 'query' || target === 'params') res.locals[`validated${target[0].toUpperCase()}${target.slice(1)}`] = result.data;
  next();
};
