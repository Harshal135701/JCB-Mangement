import { Router } from 'express';
import { getAuditLogs } from './audit.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

router.use(authenticateJWT);
router.use(requireRoles('admin', 'manager', 'store_manager'));

router.get('/', getAuditLogs);

export default router;

