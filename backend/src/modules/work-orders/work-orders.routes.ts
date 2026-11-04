import { Router } from 'express';
import {
  createWorkOrderFromComplaint,
  updateWorkOrderMilestone,
  verifyAndCloseWorkOrder,
  getWorkOrders,
} from './work-orders.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getWorkOrders);
router.post('/assign', createWorkOrderFromComplaint);
router.post('/:id/milestone', updateWorkOrderMilestone);
router.post('/:id/verify', verifyAndCloseWorkOrder);

export default router;
