/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Routes Configuration
 */

import { Router } from 'express';
import {
  getMachines,
  getMachineByQR,
  getMachineById,
  getMachineHistory,
  createMachine,
  updateMachine,
  deleteMachine,
} from './machines.controller';
import {
  getAvailableMachines,
  requestSignIn,
  getCurrentAssignment,
  cancelRequest,
  signOut,
  getPendingRequests,
  getActiveAssignments,
  approveRequest,
  rejectRequest,
} from './operator-assignment.controller';
import {
  getOperatorMaintenanceStatus,
  getMachineMaintenanceStatus,
} from './operator-maintenance-access.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All machine endpoints require valid JWT authentication
router.use(authenticateJWT);

// Operator Machine Selection & Manager Approval Workflow endpoints
// Must be registered before /:id parameterized routes
router.get('/operator/available-machines', getAvailableMachines);
router.post('/operator/sign-in', requireRoles('operator', 'admin'), requestSignIn);
router.post('/operator/request-temporary', requireRoles('operator', 'admin'), requestSignIn);
router.get('/operator/current-assignment', getCurrentAssignment);
router.get('/operator/maintenance-status', requireRoles('operator', 'admin'), getOperatorMaintenanceStatus);
router.post('/operator/cancel-request', requireRoles('operator', 'admin'), cancelRequest);
router.post('/operator/sign-out', signOut);
router.post('/operator/release-temporary', signOut);

// Manager Approval & Floor Supervision endpoints
router.get('/operator/requests/pending', requireRoles('manager', 'admin'), getPendingRequests);
router.get('/operator/assignments/active', requireRoles('manager', 'admin'), getActiveAssignments);
router.post('/operator/requests/:id/approve', requireRoles('manager', 'admin'), approveRequest);
router.post('/operator/requests/:id/reject', requireRoles('manager', 'admin'), rejectRequest);

// Read endpoints accessible by all authenticated roles (subject to facility isolation)
router.get('/', getMachines);
router.get('/qr/:uid', getMachineByQR);
router.get('/:id/maintenance-status', getMachineMaintenanceStatus);
router.get('/:id/history', getMachineHistory);
router.get('/:id', getMachineById);

// Manager-only asset registration; Admin-only decommissioning/deletion
router.post('/', requireRoles('manager'), createMachine);
router.delete('/:id', requireRoles('admin'), deleteMachine);

// Asset updates permitted for Admin and Manager roles within authorized facility scope
router.put('/:id', requireRoles('admin', 'manager'), updateMachine);

export default router;
