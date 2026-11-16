import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { getIo, emitToUser } from '../../config/socket';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: DbQueryFunction;
}

export interface DbPoolLike {
  query: DbQueryFunction;
  connect: () => Promise<DbClientLike>;
}

let activeQuery: DbQueryFunction = defaultQuery;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;
let customIo: any = undefined;

export const setNotificationsServiceDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
};

export const resetNotificationsServiceDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
};

export const setNotificationsServiceIo = (custom: any): void => {
  customIo = custom;
};

export const resetNotificationsServiceIo = (): void => {
  customIo = undefined;
};

const getActiveIo = (override?: any): any => {
  if (override !== undefined) return override;
  if (customIo !== undefined) return customIo;
  return getIo();
};

export class NotificationServiceError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'NotificationServiceError';
    this.statusCode = statusCode;
  }
}

export interface NotificationRecord {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  plant_id?: string | null;
  shop_id?: string | null;
  created_at: Date | string;
  read_at?: Date | string | null;
}

export interface CreateNotificationInput {
  recipientId: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'critical' | 'assignment' | 'approval' | 'system' | 'alert';
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  plantId?: string;
  shopId?: string;
  socketEvent?: string;
  socketPayload?: any;
}

export interface GetNotificationsFilters {
  is_read?: boolean;
  type?: string;
  entity_type?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Creates and persists a notification in the database, then dispatches real-time Socket.IO events.
 */
export async function createAndSendNotification(
  input: CreateNotificationInput,
  dbClient?: DbClientLike | DbPoolLike,
  ioInstance?: any
): Promise<NotificationRecord> {
  const queryFn = dbClient ? dbClient.query.bind(dbClient) : activeQuery;
  const {
    recipientId,
    title,
    message,
    type = 'info',
    linkUrl = null,
    entityType = null,
    entityId = null,
    plantId = null,
    shopId = null,
    socketEvent,
    socketPayload,
  } = input;

  if (!recipientId || !title || !message) {
    throw new NotificationServiceError('Recipient, title, and message are mandatory.', 400);
  }

  // 1. Persist notification to DB
  let insertRes;
  try {
    insertRes = await queryFn(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, entity_type, entity_id, plant_id, shop_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [recipientId, title, message, type, linkUrl, entityType, entityId, plantId, shopId]
    );
  } catch (err: any) {
    // If table does not yet have entity_type/entity_id columns in mock DB or legacy schema, fall back safely
    insertRes = await queryFn(
      `INSERT INTO notifications (recipient_id, title, message, type, link_url, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [recipientId, title, message, type, linkUrl]
    );
  }

  const notif = insertRes?.rows?.[0];
  if (!notif || !notif.id) {
    throw new NotificationServiceError('Failed to persist notification record to database.', 500);
  }

  // 2. Real-time Socket.IO dispatch
  const activeIo = getActiveIo(ioInstance);
  if (activeIo) {
    const payload = {
      ...notif,
      link_url: notif.link_url || linkUrl,
      action_url: notif.link_url || linkUrl, // Frontend alias
    };

    // Primary real-time notification events
    emitToUser(recipientId, 'notification:new', payload, activeIo);
    emitToUser(recipientId, 'notification', payload, activeIo); // Backward compatibility

    // Optional specific domain event (e.g. 'technician:assigned', 'complaint:created')
    if (socketEvent && socketPayload) {
      emitToUser(recipientId, socketEvent, socketPayload, activeIo);
    }

    // Refresh recipient's live unread count
    try {
      const countRes = await queryFn(
        `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [recipientId]
      );
      const unreadCount = countRes.rows[0]?.unread_count || 1;
      emitToUser(recipientId, 'notification:unread-count', { unread_count: unreadCount }, activeIo);
    } catch {
      // Non-blocking
    }
  }

  return notif;
}

/**
 * Retrieves paginated notifications with filters, pagination metadata, and total unread count.
 */
export async function getNotificationsService(
  userId: string,
  filters: GetNotificationsFilters = {},
  pagination: PaginationOptions = {},
  dbClient?: DbClientLike | DbPoolLike
): Promise<{
  data: NotificationRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  unread_count: number;
}> {
  const queryFn = dbClient ? dbClient.query.bind(dbClient) : activeQuery;

  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(pagination.limit) || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = ['recipient_id = $1'];
  const params: any[] = [userId];

  if (filters.is_read !== undefined) {
    params.push(Boolean(filters.is_read));
    whereClauses.push(`is_read = $${params.length}`);
  }

  if (filters.type && filters.type.trim()) {
    params.push(filters.type.trim().toLowerCase());
    whereClauses.push(`LOWER(type) = $${params.length}`);
  }

  if (filters.entity_type && filters.entity_type.trim()) {
    params.push(filters.entity_type.trim());
    whereClauses.push(`entity_type = $${params.length}`);
  }

  const whereSql = whereClauses.join(' AND ');

  // Fetch paginated rows, total matching count, and unread count in parallel
  const [rowsRes, countRes, unreadRes] = await Promise.all([
    queryFn(
      `SELECT * FROM notifications 
       WHERE ${whereSql} 
       ORDER BY created_at DESC 
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    queryFn(`SELECT COUNT(*)::int as total FROM notifications WHERE ${whereSql}`, params),
    queryFn(
      `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    ),
  ]);

  const total = Number(countRes.rows[0]?.total || 0);
  const unreadCount = Number(unreadRes.rows[0]?.unread_count || 0);
  const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

  return {
    data: rowsRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    unread_count: unreadCount,
  };
}

/**
 * Retrieves unread notification count for an authenticated user.
 */
export async function getUnreadCountService(
  userId: string,
  dbClient?: DbClientLike | DbPoolLike
): Promise<{ unread_count: number }> {
  const queryFn = dbClient ? dbClient.query.bind(dbClient) : activeQuery;
  const res = await queryFn(
    `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
    [userId]
  );
  return { unread_count: Number(res.rows[0]?.unread_count || 0) };
}

/**
 * Marks a specific notification as read, enforcing recipient ownership (prevents IDOR).
 */
export async function markAsReadService(
  notificationId: string,
  userId: string,
  dbClient?: DbClientLike | DbPoolLike,
  ioInstance?: any
): Promise<NotificationRecord> {
  const queryFn = dbClient ? dbClient.query.bind(dbClient) : activeQuery;

  if (!notificationId || !UUID_REGEX.test(notificationId.trim())) {
    throw new NotificationServiceError('Invalid notification ID format. A valid UUID is required.', 400);
  }

  // Attempt update with recipient ownership check
  const updateRes = await queryFn(
    `UPDATE notifications 
     SET is_read = true, read_at = NOW() 
     WHERE id = $1 AND recipient_id = $2 
     RETURNING *`,
    [notificationId, userId]
  );

  if (updateRes.rows.length === 0) {
    // Check if notification exists for another user (IDOR prevention)
    const checkRes = await queryFn(`SELECT id, recipient_id FROM notifications WHERE id = $1`, [
      notificationId,
    ]);
    if (checkRes.rows.length > 0) {
      throw new NotificationServiceError(
        'Access denied: You cannot modify notifications belonging to another user.',
        403
      );
    }
    throw new NotificationServiceError('Notification not found.', 404);
  }

  const updated = updateRes.rows[0];

  // Dispatch real-time updates
  const activeIo = getActiveIo(ioInstance);
  if (activeIo) {
    emitToUser(userId, 'notification:read', { id: notificationId, is_read: true }, activeIo);
    const countRes = await queryFn(
      `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    );
    const unreadCount = Number(countRes.rows[0]?.unread_count || 0);
    emitToUser(userId, 'notification:unread-count', { unread_count: unreadCount }, activeIo);
  }

  return updated;
}

/**
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllAsReadService(
  userId: string,
  dbClient?: DbClientLike | DbPoolLike,
  ioInstance?: any
): Promise<{ updated_count: number }> {
  const queryFn = dbClient ? dbClient.query.bind(dbClient) : activeQuery;

  const updateRes = await queryFn(
    `UPDATE notifications 
     SET is_read = true, read_at = NOW() 
     WHERE recipient_id = $1 AND is_read = false 
     RETURNING id`,
    [userId]
  );

  const updatedCount = updateRes.rows.length;

  const activeIo = getActiveIo(ioInstance);
  if (activeIo) {
    emitToUser(userId, 'notification:all-read', { updated_count: updatedCount }, activeIo);
    emitToUser(userId, 'notification:unread-count', { unread_count: 0 }, activeIo);
  }

  return { updated_count: updatedCount };
}
