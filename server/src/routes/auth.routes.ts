import { Router } from 'express';
import { login, me, logout, changePassword } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { requireCsrf } from '../middleware/security';
import { rateLimit } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { changePasswordSchema, loginSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/async-handler';

const router = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Too many sign-in attempts from this network. Try again in 15 minutes.' });
router.post('/login', loginLimit, validate(loginSchema), asyncHandler(login));
router.get('/me', asyncHandler(requireAuth), asyncHandler(me));
router.post('/logout', asyncHandler(requireAuth), requireCsrf, asyncHandler(logout));
router.post('/change-password', asyncHandler(requireAuth), requireCsrf, validate(changePasswordSchema), asyncHandler(changePassword));
export default router;
