import { Router } from 'express';
import { reportBreakdown, getBreakdowns } from './breakdowns.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.post('/', reportBreakdown);
router.get('/', getBreakdowns);

export default router;
