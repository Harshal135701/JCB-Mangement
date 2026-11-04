import { Router } from 'express';
import { searchParts, reservePartForWorkOrder } from './inventory.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/search', searchParts);
router.post('/reserve', reservePartForWorkOrder);

export default router;
