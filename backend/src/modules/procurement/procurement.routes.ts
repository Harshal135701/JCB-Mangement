import { Router } from 'express';
import {
  createPurchaseRequisition,
  getPurchaseRequisitions,
  getPurchaseRequisitionDetails,
  updatePRStatus,
  approvePurchaseRequisition,
  rejectPurchaseRequisition,
  cancelPurchaseRequisition,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderDetails,
  processGRNInward,
  getVendors,
  getProcurementDashboard,
} from './procurement.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All procurement endpoints require authentication
router.use(authenticateJWT);

// Operators are strictly blocked from all procurement actions
router.use(requireRoles('admin', 'manager', 'technician'));

// ---------------------------------------------------------------------------
// 1. Purchase Requisition Endpoints
// ---------------------------------------------------------------------------
// Technicians, Managers, and Admins can create and view PRs
router.post('/pr', createPurchaseRequisition);
router.get('/pr', getPurchaseRequisitions);
router.get('/pr/:id', getPurchaseRequisitionDetails);

// Manager & Admin only: Requisition status review, approvals, and cancellations
router.put('/pr/:id', requireRoles('admin', 'manager'), updatePRStatus);
router.post('/pr/:id/approve', requireRoles('admin', 'manager'), approvePurchaseRequisition);
router.post('/pr/:id/reject', requireRoles('admin', 'manager'), rejectPurchaseRequisition);
router.post('/pr/:id/cancel', requireRoles('admin', 'manager'), cancelPurchaseRequisition);

// ---------------------------------------------------------------------------
// 2. Purchase Order (PO) Lifecycle Endpoints
// ---------------------------------------------------------------------------
router.post('/pr/:id/po', requireRoles('admin', 'manager'), createPurchaseOrder);
router.get('/po', getPurchaseOrders);
router.get('/po/:id', getPurchaseOrderDetails);

// ---------------------------------------------------------------------------
// 3. Goods Receipt Note (GRN) Inwarding & Stock Increment
// ---------------------------------------------------------------------------
router.post('/pr/:id/grn', requireRoles('admin', 'manager'), processGRNInward);

// ---------------------------------------------------------------------------
// 4. Vendor Directory & Procurement Analytics Dashboard
// ---------------------------------------------------------------------------
router.get('/vendors', requireRoles('admin', 'manager'), getVendors);
router.get('/dashboard', requireRoles('admin', 'manager'), getProcurementDashboard);

export default router;
