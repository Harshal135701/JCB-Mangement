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
  getBreakdownAssignment,
  getBreakdownAssignmentHistory,
  acceptBreakdownAssignment,
  rejectBreakdownAssignment,
  managerManualAssign,
  managerManualReassign,
  getEligibleTechnicians,
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

// Technician Assignment Lifecycle Endpoints
router.get('/:id/assignment', requireRoles('admin', 'manager', 'technician'), getBreakdownAssignment);
router.get('/:id/assignment/history', requireRoles('admin', 'manager', 'technician'), getBreakdownAssignmentHistory);
router.get('/:id/assignments', requireRoles('admin', 'manager', 'technician'), getBreakdownAssignmentHistory);
router.post('/:id/assignment/accept', requireRoles('admin', 'technician'), acceptBreakdownAssignment);
router.post('/:id/assignment/reject', requireRoles('admin', 'technician'), rejectBreakdownAssignment);
router.post('/:id/accept', requireRoles('admin', 'technician'), acceptBreakdownAssignment);
router.post('/:id/reject-assignment', requireRoles('admin', 'technician'), rejectBreakdownAssignment);

// Manager / Admin Assignment & Reassignment Governance
router.post('/:id/assignment/assign', requireRoles('admin', 'manager'), managerManualAssign);
router.post('/:id/assignment/manual-assign', requireRoles('admin', 'manager'), managerManualAssign);
router.post('/:id/assignment/reassign', requireRoles('admin', 'manager'), managerManualReassign);
router.post('/:id/assignment/manual-reassign', requireRoles('admin', 'manager'), managerManualReassign);
router.post('/:id/assign', requireRoles('admin', 'manager'), managerManualAssign);
router.post('/:id/reassign', requireRoles('admin', 'manager'), managerManualReassign);
router.get('/:id/eligible-technicians', requireRoles('admin', 'manager'), getEligibleTechnicians);
router.get('/:id/assignment/eligible-technicians', requireRoles('admin', 'manager'), getEligibleTechnicians);

// Manager / Admin Workflow Governance Actions
router.patch('/:id/acknowledge', requireRoles('admin', 'manager'), acknowledgeBreakdown);
router.patch('/:id/priority', requireRoles('admin', 'manager'), updateBreakdownPriority);
router.post('/:id/request-information', requireRoles('admin', 'manager'), requestAdditionalInfo);
router.patch('/:id/reject', requireRoles('admin', 'manager'), rejectBreakdown);
router.post('/:id/convert-to-work-order', requireRoles('admin', 'manager'), convertBreakdownToWorkOrder);

export default router;
