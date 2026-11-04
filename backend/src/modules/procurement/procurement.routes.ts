import { Router } from 'express';
import {
  createPurchaseRequisition,
  getPurchaseRequisitions,
  updatePRStatus,
  processGRNInward,
} from './procurement.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.post('/pr', createPurchaseRequisition);
router.get('/pr', getPurchaseRequisitions);
router.put('/pr/:id', updatePRStatus);
router.post('/pr/:id/grn', processGRNInward);

export default router;

