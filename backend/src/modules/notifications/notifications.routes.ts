import { Router } from 'express';
import { getMyNotifications, markAsRead } from './notifications.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getMyNotifications);
router.put('/:id/read', markAsRead);

export default router;

