import { Router } from 'express';
import { 
  login, 
  refreshToken,
  getProfile, 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} from './auth.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { loginRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

// Public Authentication endpoints (protected by brute-force rate limiter)
router.post('/login', loginRateLimiter, login);
router.post('/refresh-token', refreshToken);

// Authenticated Session Endpoints
router.get('/profile', authenticateJWT, getProfile);

// Admin, Manager, and Store Manager can view users (e.g. managers dispatching technicians, stores verifying requestors)
router.get('/users', authenticateJWT, requireRoles('admin', 'manager', 'store_manager'), getUsers);
router.post('/users', authenticateJWT, requireRoles('admin'), createUser);
router.put('/users/:id', authenticateJWT, requireRoles('admin'), updateUser);
router.delete('/users/:id', authenticateJWT, requireRoles('admin'), deleteUser);

export default router;
