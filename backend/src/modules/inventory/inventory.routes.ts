import { Router } from 'express';
import { 
  searchParts, 
  reservePartForWorkOrder,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  adjustStock
} from './inventory.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateJWT);

// Read & Search accessible across all roles
router.get('/search', searchParts);

// Reservation accessible by Technician, Manager, Admin
router.post('/reserve', requireRoles('admin', 'manager', 'technician'), reservePartForWorkOrder);

// Stock adjustment accessible by Manager, Admin
router.post('/adjust', requireRoles('admin', 'manager'), adjustStock);

// Admin-only master CRUD
router.post('/', requireRoles('admin'), createSparePart);
router.put('/:id', requireRoles('admin'), updateSparePart);
router.delete('/:id', requireRoles('admin'), deleteSparePart);

export default router;
