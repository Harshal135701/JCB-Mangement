import { Router } from 'express';
import {
  reportBreakdown,
  getBreakdowns,
  getBreakdownDetails,
  getBreakdownHistory,
  acknowledgeBreakdown,
  updateBreakdownPriority,
  requestAdditionalInfo,
  rejectBreakdown,
  convertBreakdownToWorkOrder,
} from './breakdowns.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All breakdown routes require authentication
router.use(authenticateJWT);

// Operator / Scoped Reporting & Inspection Endpoints
router.post('/', reportBreakdown);
router.get('/', getBreakdowns);
router.get('/:id', getBreakdownDetails);
router.get('/:id/history', getBreakdownHistory);

// Manager / Admin Workflow Governance Actions
router.patch('/:id/acknowledge', requireRoles('admin', 'manager'), acknowledgeBreakdown);
router.patch('/:id/priority', requireRoles('admin', 'manager'), updateBreakdownPriority);
router.post('/:id/request-information', requireRoles('admin', 'manager'), requestAdditionalInfo);
router.patch('/:id/reject', requireRoles('admin', 'manager'), rejectBreakdown);
router.post('/:id/convert-to-work-order', requireRoles('admin', 'manager'), convertBreakdownToWorkOrder);

export default router;
