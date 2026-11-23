import { Router } from 'express';
import * as controller from '../controllers/repair.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { requireCsrf } from '../middleware/security';
import { rateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { idParamSchema, paymentCreateSchema, repairCreateSchema, repairListQuerySchema, repairStatusSchema, trackParamSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/async-handler';
const router = Router();
const trackingLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many tracking lookups. Try again later.' });
// Public tracking is rate-limited and returns only safe, non-identifying status data.
router.get('/track/:code', trackingLimit, validate(trackParamSchema, 'params'), asyncHandler(controller.trackRepair));
router.use(asyncHandler(requireAuth));
router.get('/', validate(repairListQuerySchema, 'query'), asyncHandler(controller.listRepairs));
router.post('/', requireCsrf, validate(repairCreateSchema), asyncHandler(controller.createRepair));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.getRepair));
router.patch('/:id/status', requireCsrf, validate(idParamSchema, 'params'), validate(repairStatusSchema), asyncHandler(controller.updateRepairStatus));
router.post('/:id/payments', requireRole('admin'), requireCsrf, validate(idParamSchema, 'params'), validate(paymentCreateSchema), asyncHandler(controller.createPayment));
// Repair records are retained for auditability. Cancel a job through its status workflow instead of deleting it.
export default router;
