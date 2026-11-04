import { Router } from 'express';
import { getDowntimeAnalytics } from './downtime.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getDowntimeAnalytics);

export default router;

