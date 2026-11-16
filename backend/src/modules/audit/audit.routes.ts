import { Router } from 'express';
import {
  getAuditLogs,
  getAuditStats,
  getAuditFilters,
  getAuditLogById,
  exportAuditLogs,
} from './audit.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateJWT);
router.use(requireRoles('admin', 'manager', 'store_manager'));

// 1. Audit Stats & Metadata (before parameterized routes)
router.get('/stats', getAuditStats);
router.get('/filters', getAuditFilters);
router.get('/export', exportAuditLogs);

// 2. Paginated Query Ledger
router.get('/', getAuditLogs);

// 3. Single Audit Record Inspection
router.get('/:id', getAuditLogById);

export default router;
