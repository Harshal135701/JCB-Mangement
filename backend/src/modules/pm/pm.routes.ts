import { Router } from 'express';
import { createPMPlan, getPMPlans, generateDuePMWorkOrders } from './pm.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.post('/plans', createPMPlan);
router.get('/plans', getPMPlans);
router.post('/generate-due', generateDuePMWorkOrders);

export default router;
