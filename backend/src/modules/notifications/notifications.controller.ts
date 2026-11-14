import { Request, Response, NextFunction } from 'express';
import {
  getNotificationsService,
  getUnreadCountService,
  markAsReadService,
  markAllAsReadService,
  NotificationServiceError,
  setNotificationsServiceDb,
  resetNotificationsServiceDb,
  setNotificationsServiceIo,
  resetNotificationsServiceIo,
  DbQueryFunction,
  DbPoolLike,
} from './notifications.service';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const setNotificationsDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  setNotificationsServiceDb(customQuery, customPool);
};

export const resetNotificationsDb = (): void => {
  resetNotificationsServiceDb();
};

export const setNotificationsIo = (custom: any): void => {
  setNotificationsServiceIo(custom);
};

export const resetNotificationsIo = (): void => {
  resetNotificationsServiceIo();
};

/**
 * GET /api/v1/notifications
 * Retrieves the authenticated user's notifications with optional pagination and filters.
 */
export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { page, limit, is_read, type, entity_type } = req.query;

    const filters: { is_read?: boolean; type?: string; entity_type?: string } = {};
    if (is_read !== undefined) {
      filters.is_read = is_read === 'true' || is_read === '1';
    }
    if (typeof type === 'string' && type.trim()) {
      filters.type = type.trim();
    }
    if (typeof entity_type === 'string' && entity_type.trim()) {
      filters.entity_type = entity_type.trim();
    }

    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    };

    const result = await getNotificationsService(userId, filters, pagination);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      unread_count: result.unread_count,
    });
  } catch (err: any) {
    if (err instanceof NotificationServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * GET /api/v1/notifications/unread-count
 * Fast endpoint to query unread notifications count for badge display.
 */
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await getUnreadCountService(userId);
    res.json({
      success: true,
      data: result,
      count: result.unread_count,
      unread_count: result.unread_count,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/notifications/:id/read
 * Marks a specific notification as read, enforcing recipient ownership.
 */
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id.trim())) {
      res.status(400).json({ success: false, message: 'Invalid notification ID format. A valid UUID is required.' });
      return;
    }

    const updated = await markAsReadService(id.trim(), userId);

    res.json({
      success: true,
      message: 'Notification marked as read.',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof NotificationServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

/**
 * PUT /api/v1/notifications/mark-all-read
 * Marks all unread notifications as read for the authenticated user.
 */
export const markAllNotificationsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await markAllAsReadService(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read.',
      updated_count: result.updated_count,
    });
  } catch (err: any) {
    if (err instanceof NotificationServiceError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};
