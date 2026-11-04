import { Router } from 'express';
import { 
  getMachines, 
  getMachineByQR, 
  getMachineById,
  createMachine,
  updateMachine,
  deleteMachine
} from './machines.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateJWT);

// Read endpoints accessible by all authenticated roles
router.get('/', getMachines);
router.get('/qr/:uid', getMachineByQR);
router.get('/:id', getMachineById);

// Admin-only CRUD operations
router.post('/', requireRoles('admin'), createMachine);
router.put('/:id', requireRoles('admin'), updateMachine);
router.delete('/:id', requireRoles('admin'), deleteMachine);

export default router;
