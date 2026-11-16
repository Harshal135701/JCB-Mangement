import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './env';
import { query as defaultQuery } from './db';
import { AuthenticatedUser } from '../middlewares/auth.middleware';

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

let activeSocketQuery: DbQueryFunction = defaultQuery;
let activeIoInstance: SocketIOServer | any = null;

export const setSocketDb = (customQuery?: DbQueryFunction): void => {
  activeSocketQuery = customQuery || defaultQuery;
};

export const resetSocketDb = (): void => {
  activeSocketQuery = defaultQuery;
};

export const setCustomIo = (customIo: any): void => {
  activeIoInstance = customIo;
};

export const resetCustomIo = (): void => {
  activeIoInstance = null;
};

export const getIo = (): SocketIOServer | any => {
  if (activeIoInstance) {
    return activeIoInstance;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serverModule = require('../server');
    return serverModule ? serverModule.io : null;
  } catch {
    return null;
  }
};

/**
 * Validates access token and extracts user payload from Socket.IO handshake
 */
export async function authenticateSocketToken(
  token: string
): Promise<AuthenticatedUser> {
  if (!token || typeof token !== 'string') {
    throw new Error('Authentication required: Token missing.');
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  if (!cleanToken) {
    throw new Error('Authentication required: Token malformed.');
  }

  const decoded = jwt.verify(cleanToken, config.jwtSecret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload & { id?: string; email?: string; role?: string };

  if (!decoded || !decoded.id) {
    throw new Error('Invalid token payload.');
  }

  // Verify user is active in database
  const userResult = await activeSocketQuery(
    `SELECT id, employee_code, email, role, plant_id, shop_id, is_active
     FROM users
     WHERE id = $1`,
    [decoded.id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    throw new Error('User account not found or inactive.');
  }

  const dbUser = userResult.rows[0];
  return {
    id: dbUser.id,
    employee_code: dbUser.employee_code,
    email: dbUser.email,
    role: dbUser.role,
    ...(dbUser.plant_id ? { plant_id: dbUser.plant_id } : {}),
    ...(dbUser.shop_id ? { shop_id: dbUser.shop_id } : {}),
  };
}

/**
 * Initializes authentication middleware and secure room routing on the Socket.IO server
 */
export function initSocketServer(io: SocketIOServer): void {
  activeIoInstance = io;

  // 1. Connection Authentication Middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!authHeader) {
        return next(new Error('Authentication required: Missing session token.'));
      }

      const user = await authenticateSocketToken(authHeader as string);
      socket.data.user = user;
      next();
    } catch (err: any) {
      next(new Error(err.message || 'Authentication error.'));
    }
  });

  // 2. Connection Lifecycle & Room Routing
  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as AuthenticatedUser;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Automatically join authenticated user rooms
    // A. Private user inbox room
    socket.join(`user:${user.id}`);
    socket.join(`user_${user.id}`); // backward compatibility for existing modules

    // B. Role-based broadcast room
    socket.join(`role:${user.role}`);

    // C. Plant-scoped room
    if (user.plant_id) {
      socket.join(`plant:${user.plant_id}`);
      if (user.role === 'manager' || user.role === 'admin') {
        socket.join(`managers:${user.plant_id}`);
      }
    }

    // D. Shop-scoped room
    if (user.shop_id) {
      socket.join(`shop:${user.shop_id}`);
    }

    if (config.nodeEnv === 'development') {
      console.log(
        `[Socket.io] Authenticated client connected: ${socket.id} (User: ${user.email}, Role: ${user.role})`
      );
    }

    // Push initial unread notification count on connect
    try {
      const countRes = await activeSocketQuery(
        `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [user.id]
      );
      const unreadCount = countRes.rows[0]?.unread_count || 0;
      socket.emit('notification:unread-count', { unread_count: unreadCount });
    } catch {
      // Non-blocking initial count fetch
    }

    // Secure room subscription event handler: prevents IDOR and cross-user snooping
    socket.on('notification:subscribe', (room: string) => {
      if (!room || typeof room !== 'string') return;

      const trimmed = room.trim();
      const isAllowed =
        trimmed === `user:${user.id}` ||
        trimmed === `user_${user.id}` ||
        trimmed === `role:${user.role}` ||
        (user.plant_id && trimmed === `plant:${user.plant_id}`) ||
        (user.shop_id && trimmed === `shop:${user.shop_id}`) ||
        (user.plant_id && (user.role === 'manager' || user.role === 'admin') && trimmed === `managers:${user.plant_id}`);

      if (isAllowed) {
        socket.join(trimmed);
      } else {
        socket.emit('notification:error', {
          message: 'Access denied: You cannot subscribe to unauthorized notification rooms.',
        });
      }
    });

    // Client requests fresh unread count
    socket.on('notification:get-unread-count', async () => {
      try {
        const countRes = await activeSocketQuery(
          `SELECT COUNT(*)::int as unread_count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
          [user.id]
        );
        const unreadCount = countRes.rows[0]?.unread_count || 0;
        socket.emit('notification:unread-count', { unread_count: unreadCount });
      } catch (err: any) {
        socket.emit('notification:error', { message: 'Failed to retrieve unread count.' });
      }
    });

    socket.on('disconnect', () => {
      if (config.nodeEnv === 'development') {
        console.log(`[Socket.io] Client disconnected: ${socket.id}`);
      }
    });
  });
}

/**
 * Targeted real-time notification dispatch helpers
 */
export function emitToUser(userId: string, event: string, payload: any, ioInstance?: any): void {
  const io = ioInstance || getIo();
  if (io && typeof io.to === 'function') {
    io.to(`user:${userId}`).emit(event, payload);
    io.to(`user_${userId}`).emit(event, payload);
  }
}

export function emitToPlant(plantId: string, event: string, payload: any, ioInstance?: any): void {
  const io = ioInstance || getIo();
  if (io && typeof io.to === 'function') {
    io.to(`plant:${plantId}`).emit(event, payload);
  }
}

export function emitToShop(shopId: string, event: string, payload: any, ioInstance?: any): void {
  const io = ioInstance || getIo();
  if (io && typeof io.to === 'function') {
    io.to(`shop:${shopId}`).emit(event, payload);
  }
}

export function emitToRole(role: string, event: string, payload: any, ioInstance?: any): void {
  const io = ioInstance || getIo();
  if (io && typeof io.to === 'function') {
    io.to(`role:${role}`).emit(event, payload);
  }
}
