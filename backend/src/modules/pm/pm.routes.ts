import { Router } from 'express';
import {
  createPMPlan,
  getPMPlans,
  getPMPlanById,
  updatePMPlan,
  activatePMPlan,
  deactivatePMPlan,
  getPMPlanHistory,
  getPMPlanWorkOrders,
  getPMSchedule,
  getPMUpcoming,
  getPMDue,
  getPMOverdue,
  getPMCalendar,
  reschedulePM,
  deferPM,
  skipPM,
  generateDuePMWorkOrders,
  getPMExecutions,
  getPMExecutionDetails,
  getPMExecutionChecklist,
  submitPMExecutionChecklist,
  completePMExecution,
  verifyPMExecution,
  getMachinePMHistory,
  getPMDashboard,
  getPMCompliance,
  getPMTrends,
  getPMByMachine,
  getPMByPlant,
  getPMByShop,
} from './pm.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All PM endpoints require authentication
router.use(authenticateJWT);

// ---------------------------------------------------------------------------
// 1. PM Plan Management
// ---------------------------------------------------------------------------
router.post('/plans', requireRoles('admin', 'manager'), createPMPlan);
router.get('/plans', requireRoles('admin', 'manager', 'technician', 'operator'), getPMPlans);
router.get('/plans/:id', requireRoles('admin', 'manager', 'technician', 'operator'), getPMPlanById);
router.put('/plans/:id', requireRoles('admin', 'manager'), updatePMPlan);
router.patch('/plans/:id/activate', requireRoles('admin', 'manager'), activatePMPlan);
router.patch('/plans/:id/deactivate', requireRoles('admin', 'manager'), deactivatePMPlan);
router.get('/plans/:id/history', requireRoles('admin', 'manager', 'technician', 'operator'), getPMPlanHistory);
router.get('/plans/:id/work-orders', requireRoles('admin', 'manager', 'technician', 'operator'), getPMPlanWorkOrders);

// ---------------------------------------------------------------------------
// 2. PM Scheduling & Due Management
// ---------------------------------------------------------------------------
router.get('/schedule', requireRoles('admin', 'manager', 'technician', 'operator'), getPMSchedule);
router.get('/upcoming', requireRoles('admin', 'manager', 'technician', 'operator'), getPMUpcoming);
router.get('/due', requireRoles('admin', 'manager', 'technician', 'operator'), getPMDue);
router.get('/overdue', requireRoles('admin', 'manager', 'technician', 'operator'), getPMOverdue);
router.get('/calendar', requireRoles('admin', 'manager', 'technician', 'operator'), getPMCalendar);
router.patch('/plans/:id/reschedule', requireRoles('admin', 'manager'), reschedulePM);
router.post('/plans/:id/defer', requireRoles('admin', 'manager'), deferPM);
router.post('/plans/:id/skip', requireRoles('admin', 'manager'), skipPM);

// ---------------------------------------------------------------------------
// 3. Automatic Work Order Generation
// ---------------------------------------------------------------------------
router.post('/generate-due', requireRoles('admin', 'manager'), generateDuePMWorkOrders);

// ---------------------------------------------------------------------------
// 4. PM Execution & Verification Tracking
// ---------------------------------------------------------------------------
router.get('/executions', requireRoles('admin', 'manager', 'technician', 'operator'), getPMExecutions);
router.get('/executions/:id', requireRoles('admin', 'manager', 'technician', 'operator'), getPMExecutionDetails);
router.get('/executions/:id/checklist', requireRoles('admin', 'manager', 'technician', 'operator'), getPMExecutionChecklist);
router.post('/executions/:id/checklist', requireRoles('admin', 'manager', 'technician'), submitPMExecutionChecklist);
router.post('/executions/:id/complete', requireRoles('admin', 'manager', 'technician'), completePMExecution);
router.post('/executions/:id/verify', requireRoles('admin', 'manager'), verifyPMExecution);
router.get('/machines/:machineId/history', requireRoles('admin', 'manager', 'technician', 'operator'), getMachinePMHistory);

// ---------------------------------------------------------------------------
// 5. PM Dashboard & Compliance Analytics
// ---------------------------------------------------------------------------
router.get('/dashboard', requireRoles('admin', 'manager', 'technician', 'operator'), getPMDashboard);
router.get('/compliance', requireRoles('admin', 'manager', 'technician', 'operator'), getPMCompliance);
router.get('/trends', requireRoles('admin', 'manager', 'technician', 'operator'), getPMTrends);
router.get('/by-machine', requireRoles('admin', 'manager', 'technician', 'operator'), getPMByMachine);
router.get('/by-plant', requireRoles('admin', 'manager'), getPMByPlant);
router.get('/by-shop', requireRoles('admin', 'manager', 'technician'), getPMByShop);

export default router;
