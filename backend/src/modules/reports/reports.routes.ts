import { Router } from 'express';
import { getDashboardStats, getMaintenanceTrend, getGovernanceTrend } from './reports.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard-kpis', getDashboardStats);
router.get('/maintenance-trend', getMaintenanceTrend);
router.get('/governance-trend', getGovernanceTrend);

export default router;
