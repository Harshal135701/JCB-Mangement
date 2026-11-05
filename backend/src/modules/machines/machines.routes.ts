/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Routes Configuration
 */

import { Router } from 'express';
import {
  getMachines,
  getMachineByQR,
  getMachineById,
  getMachineHistory,
  createMachine,
  updateMachine,
  deleteMachine,
} from './machines.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// All machine endpoints require valid JWT authentication
router.use(authenticateJWT);

// Read endpoints accessible by all authenticated roles (subject to facility isolation)
router.get('/', getMachines);
router.get('/qr/:uid', getMachineByQR);
router.get('/:id/history', getMachineHistory);
router.get('/:id', getMachineById);

// Admin-only asset registration and decommissioning/deletion
router.post('/', requireRoles('admin'), createMachine);
router.delete('/:id', requireRoles('admin'), deleteMachine);

// Asset updates permitted for Admin and Manager roles within authorized facility scope
router.put('/:id', requireRoles('admin', 'manager'), updateMachine);

export default router;
