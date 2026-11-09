import { Router } from 'express';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAsRead,
  markAllNotificationsRead,
} from './notifications.controller';
import { authenticateJWT } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticateJWT);

// Specific action paths (must precede parameter route :id)
router.get('/unread-count', getUnreadNotificationCount);
router.put('/mark-all-read', markAllNotificationsRead);
router.post('/mark-all-read', markAllNotificationsRead);

// Collection and resource routes
router.get('/', getMyNotifications);
router.put('/:id/read', markAsRead);

export default router;
