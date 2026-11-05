import { Router } from 'express';
import {
  getInspectionTemplate,
  getInspectionTemplatesList,
  getInspectionTemplateById,
  createInspectionTemplate,
  updateInspectionTemplate,
  toggleInspectionTemplateStatus,
  submitInspection,
  getInspectionRecords,
  getInspectionRecordById,
} from './inspections.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

const router = Router();

// Enforce JWT authentication on all inspection routes
router.use(authenticateJWT);

// Existing template retrieval (backward-compatible)
router.get(
  '/template',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  getInspectionTemplate
);

// Template Management routes (Phase 2)
router.get(
  '/templates',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  getInspectionTemplatesList
);

router.post(
  '/templates',
  requireRoles('admin', 'manager'),
  createInspectionTemplate
);

router.get(
  '/templates/:id',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  getInspectionTemplateById
);

router.put(
  '/templates/:id',
  requireRoles('admin', 'manager'),
  updateInspectionTemplate
);

router.patch(
  '/templates/:id/status',
  requireRoles('admin', 'manager'),
  toggleInspectionTemplateStatus
);

// Inspection Execution & Submission (server-side evaluation)
router.post(
  '/submit',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  submitInspection
);

// Inspection Records & Auditing
router.get(
  '/records',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  getInspectionRecords
);

router.get(
  '/records/:id',
  requireRoles('admin', 'manager', 'technician', 'operator'),
  getInspectionRecordById
);

export default router;
