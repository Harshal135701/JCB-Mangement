import { Router } from 'express';
import { getMachines, getMachineByQR, getMachineById } from './machines.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getMachines);
router.get('/qr/:uid', getMachineByQR);
router.get('/:id', getMachineById);

export default router;
