import { Router } from 'express';
import { getDashboardStats } from './reports.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard-kpis', getDashboardStats);

export default router;

