import { Router } from 'express';
import {
  getDowntimeAnalytics,
  getDowntimeRecords,
  getDowntimeRecordDetails,
  getMachineDowntimeSummary,
  getMachineDowntimeHistory,
  getMachineAvailability,
  getMTTRAnalytics,
  getMTBFAnalytics,
  getParetoMachines,
  getDowntimeByPlant,
  getDowntimeByShop,
  getDowntimeByCategory,
  getDowntimeByCause,
  getDowntimeTrends,
  getPlannedVsUnplanned,
  getSlaPerformance,
  getCurrentDowntime,
} from './downtime.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All downtime routes require authentication
router.use(authenticateJWT);

// Restrict to roles that have access to operational analytics
router.use(requireRoles('admin', 'manager', 'technician', 'operator'));

// ---------------------------------------------------------------------------
// 1. Overall Dashboard Summary (Compatibility with Frontend & Extended)
// ---------------------------------------------------------------------------
router.get('/', getDowntimeAnalytics);

// ---------------------------------------------------------------------------
// 2. Incident Records & Machine-Specific History
// ---------------------------------------------------------------------------
router.get('/records', getDowntimeRecords);
router.get('/records/:id', getDowntimeRecordDetails);
router.get('/machines/:machineId/history', getMachineDowntimeHistory);
router.get('/machines/:machineId', getMachineDowntimeSummary);

// ---------------------------------------------------------------------------
// 3. Availability, MTTR & MTBF Reliability Analytics
// ---------------------------------------------------------------------------
router.get('/availability', getMachineAvailability);
router.get('/mttr', getMTTRAnalytics);
router.get('/mtbf', getMTBFAnalytics);

// ---------------------------------------------------------------------------
// 4. Pareto & Dimensional Breakdowns
// ---------------------------------------------------------------------------
router.get('/by-machine', getParetoMachines);
router.get('/by-plant', getDowntimeByPlant);
router.get('/by-shop', getDowntimeByShop);
router.get('/by-category', getDowntimeByCategory);
router.get('/by-cause', getDowntimeByCause);
router.get('/trends', getDowntimeTrends);

// ---------------------------------------------------------------------------
// 5. Operational Insights & Exception Monitoring
// ---------------------------------------------------------------------------
router.get('/planned-vs-unplanned', getPlannedVsUnplanned);
router.get('/sla', getSlaPerformance);
router.get('/current', getCurrentDowntime);

export default router;
