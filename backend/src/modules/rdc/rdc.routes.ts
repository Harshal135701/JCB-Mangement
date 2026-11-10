import { Router } from 'express';
import {
  createRDC,
  getRDCs,
  getRDCById,
  updateRDCDraft,
  submitRDC,
  approveRDC,
  approveAndDispatchRDC,
  rejectRDC,
  dispatchRDC,
  recordRDCReturn,
  recordRDCReplacement,
  recordRDCDamage,
  recordRDCWriteOff,
  cancelRDC,
  closeRDC,
  getRDCHistory,
  getRdcDashboard,
  getOverdueRDCs,
} from './rdc.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All RDC routes require authentication
router.use(authenticateJWT);

// Specific path routes MUST be defined before parameterized /:id routes
router.get(
  '/dashboard',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  getRdcDashboard
);

router.get(
  '/overdue',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  getOverdueRDCs
);

router.post(
  '/',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  createRDC
);

router.get(
  '/',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  getRDCs
);

router.get(
  '/:id',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  getRDCById
);

router.patch(
  '/:id',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  updateRDCDraft
);

router.get(
  '/:id/history',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  getRDCHistory
);

router.post(
  '/:id/submit',
  requireRoles('admin', 'manager', 'store_manager', 'technician'),
  submitRDC
);

// Approval & Rejection (Managers & Admins only)
router.post(
  '/:id/approve',
  requireRoles('admin', 'manager'),
  approveRDC
);

// Legacy approval endpoint (strictly restricted to managers/admins, executing approval only)
router.put(
  '/:id/approve',
  requireRoles('admin', 'manager'),
  approveAndDispatchRDC
);

router.post(
  '/:id/reject',
  requireRoles('admin', 'manager'),
  rejectRDC
);

// Dispatch (Store Managers, Managers, Admins)
router.post(
  '/:id/dispatch',
  requireRoles('admin', 'manager', 'store_manager'),
  dispatchRDC
);

// Returns & Receipts (Store Managers, Managers, Admins)
router.post(
  '/:id/return',
  requireRoles('admin', 'manager', 'store_manager'),
  recordRDCReturn
);

router.post(
  '/:id/replacement',
  requireRoles('admin', 'manager', 'store_manager'),
  recordRDCReplacement
);

router.post(
  '/:id/damage',
  requireRoles('admin', 'manager', 'store_manager'),
  recordRDCDamage
);

// Authorized Write-off (Managers & Admins only)
router.post(
  '/:id/writeoff',
  requireRoles('admin', 'manager'),
  recordRDCWriteOff
);

// Cancellation (Creator technician or Manager/Admin)
router.post(
  '/:id/cancel',
  requireRoles('admin', 'manager', 'technician'),
  cancelRDC
);

// Close Reconciled Challan (Managers, Store Managers, Admins)
router.post(
  '/:id/close',
  requireRoles('admin', 'manager', 'store_manager'),
  closeRDC
);

export default router;
