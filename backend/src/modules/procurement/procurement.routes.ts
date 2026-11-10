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
  createVendor,
  updateVendor,
  getVendorById,
  getProcurementDashboard,
} from './procurement.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All procurement endpoints require authentication
router.use(authenticateJWT);

// Operators are strictly blocked from all procurement actions
router.use(requireRoles('admin', 'manager', 'technician', 'store_manager'));

// ---------------------------------------------------------------------------
// 1. Purchase Requisition Endpoints
// ---------------------------------------------------------------------------
// Technicians, Managers, Store Managers, and Admins can create and view PRs
router.post('/pr', createPurchaseRequisition);
router.get('/pr', getPurchaseRequisitions);
router.get('/pr/:id', getPurchaseRequisitionDetails);

// Manager, Store Manager & Admin: Requisition status review, approvals, and cancellations
router.put('/pr/:id', requireRoles('admin', 'manager', 'store_manager'), updatePRStatus);
router.post('/pr/:id/approve', requireRoles('admin', 'manager', 'store_manager'), approvePurchaseRequisition);
router.post('/pr/:id/reject', requireRoles('admin', 'manager', 'store_manager'), rejectPurchaseRequisition);
router.post('/pr/:id/cancel', requireRoles('admin', 'manager', 'store_manager'), cancelPurchaseRequisition);

// ---------------------------------------------------------------------------
// 2. Purchase Order (PO) Lifecycle Endpoints
// ---------------------------------------------------------------------------
router.post('/pr/:id/po', requireRoles('admin', 'manager', 'store_manager'), createPurchaseOrder);
router.get('/po', getPurchaseOrders);
router.get('/po/:id', getPurchaseOrderDetails);

// ---------------------------------------------------------------------------
// 3. Goods Receipt Note (GRN) Inwarding & Stock Increment
// ---------------------------------------------------------------------------
router.post('/pr/:id/grn', requireRoles('admin', 'manager', 'store_manager'), processGRNInward);

// ---------------------------------------------------------------------------
// 4. Vendor Directory & Procurement Analytics Dashboard
// ---------------------------------------------------------------------------
router.get('/vendors', requireRoles('admin', 'manager', 'store_manager'), getVendors);
router.post('/vendors', requireRoles('admin', 'manager', 'store_manager'), createVendor);
router.get('/vendors/:id', requireRoles('admin', 'manager', 'store_manager'), getVendorById);
router.put('/vendors/:id', requireRoles('admin', 'manager', 'store_manager'), updateVendor);
router.get('/dashboard', requireRoles('admin', 'manager', 'store_manager'), getProcurementDashboard);

export default router;
