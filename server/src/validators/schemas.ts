import { z } from 'zod';

const id = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const money = z.number().finite().min(0).max(1_000_000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Use no more than two decimal places.');
const positiveMoney = z.number().finite().gt(0).max(1_000_000).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7, 'Use no more than two decimal places.');

export const idParamSchema = z.object({ id }).strict();
export const trackParamSchema = z.object({ code: z.string().trim().regex(/^TF-\d{8}-[A-F0-9]{32}$/i, 'Invalid repair code.') }).strict();
const pageFields = {
  search: z.string().trim().max(100).optional().default(''),
  page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20)
};
export const listQuerySchema = z.object(pageFields).strict();
export const repairListQuerySchema = z.object({
  ...pageFields,
  status: z.enum(['', 'pending', 'approved', 'in_progress', 'checking', 'done', 'cancelled']).optional().default('')
}).strict();

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.')
}).strict();
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.'),
  newPassword: z.string().min(14).max(72)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.')
    .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value), 'Use uppercase, lowercase, a number and a symbol.')
    .refine((value) => !/(password|qwerty|123456|admin)/i.test(value), 'Choose a less predictable password.')
}).strict();

export const clientCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.union([z.string().trim().email().max(255), z.literal('')]).optional().transform((value) => value || null),
  phone: z.string().trim().min(5).max(40),
  address: z.string().trim().max(1000).default('')
}).strict();
export const clientUpdateSchema = clientCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const serviceCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).default(''),
  price: money
}).strict();
export const serviceUpdateSchema = serviceCreateSchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update.');

export const repairCreateSchema = z.object({
  clientId: id,
  remarks: z.string().trim().max(3000).default(''),
  serviceIds: z.array(id).min(1).max(30),
  materials: z.array(z.object({ name: z.string().trim().min(1).max(180), cost: money }).strict()).max(30).default([])
}).strict().superRefine((value, ctx) => {
  if (new Set(value.serviceIds).size !== value.serviceIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['serviceIds'], message: 'Choose each service only once.' });
  }
});
export const repairStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'in_progress', 'checking', 'done', 'cancelled']).optional(),
  remarks: z.string().trim().max(3000).optional()
}).strict().refine((value) => value.status !== undefined || value.remarks !== undefined, 'Provide a status or remarks update.');
export const paymentCreateSchema = z.object({
  idempotencyKey: z.string().uuid(),
  amount: positiveMoney,
  method: z.enum(['cash', 'card', 'upi', 'bank_transfer']),
  reference: z.string().trim().max(120).optional().default('')
}).strict();
