import { Router } from 'express';
import { 
  login, 
  getProfile, 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} from './auth.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// Public
router.post('/login', login);

// Authenticated
router.get('/profile', authenticateJWT, getProfile);

// Admin-only User Governance CRUD
router.get('/users', authenticateJWT, requireRoles('admin'), getUsers);
router.post('/users', authenticateJWT, requireRoles('admin'), createUser);
router.put('/users/:id', authenticateJWT, requireRoles('admin'), updateUser);
router.delete('/users/:id', authenticateJWT, requireRoles('admin'), deleteUser);

export default router;
