import { Router } from 'express';
import {
  createRDC,
  getRDCs,
  approveAndDispatchRDC,
  recordRDCReturn,
} from './rdc.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.post('/', createRDC);
router.get('/', getRDCs);
router.put('/:id/approve', approveAndDispatchRDC);
router.post('/:id/return', recordRDCReturn);

export default router;

