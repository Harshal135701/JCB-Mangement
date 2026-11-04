import { Router } from 'express';
import { getInspectionTemplate, submitInspection, getInspectionRecords } from './inspections.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/template', getInspectionTemplate);
router.post('/submit', submitInspection);
router.get('/records', getInspectionRecords);

export default router;
