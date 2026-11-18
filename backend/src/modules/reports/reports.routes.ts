import { Router } from 'express';
import {
  getDashboardStats,
  getMaintenanceTrend,
  getGovernanceTrend,
  getMachineReportSummary,
} from './reports.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/dashboard-kpis', getDashboardStats);
router.get('/maintenance-trend', getMaintenanceTrend);
router.get('/governance-trend', getGovernanceTrend);
router.get('/machine-summary/:id', getMachineReportSummary);

export default router;
