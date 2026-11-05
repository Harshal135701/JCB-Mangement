import { Router } from 'express';
import {
  createWorkOrderFromComplaint,
  reassignWorkOrder,
  updateWorkOrderMilestone,
  verifyAndCloseWorkOrder,
  reopenWorkOrder,
  getWorkOrders,
  getWorkOrderDetails,
  getWorkOrderHistory,
  getWorkOrderParts,
} from './work-orders.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// Authentication required on all routes
router.use(authenticateJWT);

// Work order listing & search (Technicians, Managers, Admins)
router.get('/', requireRoles('admin', 'manager', 'technician'), getWorkOrders);

// Creation from complaint (Admin & Manager)
router.post('/assign', requireRoles('admin', 'manager'), createWorkOrderFromComplaint);

// Work order inspection endpoints
router.get('/:id', requireRoles('admin', 'manager', 'technician'), getWorkOrderDetails);
router.get('/:id/history', requireRoles('admin', 'manager', 'technician'), getWorkOrderHistory);
router.get('/:id/parts', requireRoles('admin', 'manager', 'technician'), getWorkOrderParts);

// Reassignment (Admin & Manager)
router.post('/:id/reassign', requireRoles('admin', 'manager'), reassignWorkOrder);

// Milestone lifecycle updates (Technicians, Managers, Admins)
router.post('/:id/milestone', requireRoles('admin', 'manager', 'technician'), updateWorkOrderMilestone);

// Verification and closure (Admin & Manager)
router.post('/:id/verify', requireRoles('admin', 'manager'), verifyAndCloseWorkOrder);

// Reopen work order (Admin & Manager)
router.post('/:id/reopen', requireRoles('admin', 'manager'), reopenWorkOrder);

export default router;
