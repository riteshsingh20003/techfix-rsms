import { Router } from 'express';
import { getSummary } from '../controllers/dashboard.controller';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/async-handler';
const router = Router();
router.get('/summary', requireAuth, asyncHandler(getSummary));
export default router;
