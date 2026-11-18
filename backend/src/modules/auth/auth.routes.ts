import { Router } from 'express';
import { 
  login, 
  refreshToken,
  getProfile, 
  getUsers, 
  createUser, 
  updateUser, 
  deleteUser,
  registerOperator,
  getRegistrationOptions,
  getRegistrationPlants,
  getRegistrationShops,
  getPendingOperators,
  approveOperator,
  rejectOperator,
} from './auth.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { loginRateLimiter } from '../../middlewares/rateLimiter.middleware';

const router = Router();

// Public Authentication endpoints (protected by brute-force rate limiter)
router.post('/login', loginRateLimiter, login);
router.post('/refresh-token', refreshToken);

// Public Operator Self-Registration & Plant/Shop Hierarchy endpoints
router.post('/register-operator', loginRateLimiter, registerOperator);
router.get('/registration-options', getRegistrationOptions);
router.get('/plants', getRegistrationPlants);
router.get('/plants/:plantId/shops', getRegistrationShops);

// Authenticated Session Endpoints
router.get('/profile', authenticateJWT, getProfile);

// Manager & Admin Operator Approval Workflow
router.get('/pending-operators', authenticateJWT, requireRoles('manager', 'admin'), getPendingOperators);
router.post('/operators/:id/approve', authenticateJWT, requireRoles('manager', 'admin'), approveOperator);
router.post('/operators/:id/reject', authenticateJWT, requireRoles('manager', 'admin'), rejectOperator);

// Admin, Manager, and Store Manager can view users (e.g. managers dispatching technicians, stores verifying requestors)
router.get('/users', authenticateJWT, requireRoles('admin', 'manager', 'store_manager'), getUsers);
router.post('/users', authenticateJWT, requireRoles('admin', 'manager'), createUser);
router.put('/users/:id', authenticateJWT, requireRoles('admin'), updateUser);
router.delete('/users/:id', authenticateJWT, requireRoles('admin'), deleteUser);

export default router;
