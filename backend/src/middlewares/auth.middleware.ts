import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { query as defaultQuery } from '../config/db';

export interface AuthenticatedUser {
  id: string;
  employee_code: string;
  email: string;
  role: string;
  plant_id?: string;
  shop_id?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

let activeAuthQuery: DbQueryFunction = defaultQuery;

export const setAuthMiddlewareDb = (customQuery?: DbQueryFunction): void => {
  activeAuthQuery = customQuery || defaultQuery;
};

export const resetAuthMiddlewareDb = (): void => {
  activeAuthQuery = defaultQuery;
};

function isValidAccessTokenPayload(
  payload: string | jwt.JwtPayload
): payload is jwt.JwtPayload & AuthenticatedUser {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  return (
    typeof payload.id === 'string' &&
    payload.id.trim().length > 0 &&
    typeof payload.employee_code === 'string' &&
    typeof payload.email === 'string' &&
    typeof payload.role === 'string' &&
    payload.role.trim().length > 0 &&
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    (payload.plant_id === undefined ||
      payload.plant_id === null ||
      typeof payload.plant_id === 'string') &&
    (payload.shop_id === undefined ||
      payload.shop_id === null ||
      typeof payload.shop_id === 'string')
  );
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
    return;
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!bearerMatch) {
    res.status(401).json({
      success: false,
      message: 'Invalid authorization format.',
    });
    return;
  }

  const token = bearerMatch[1].trim();

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session token.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
    });

    if (!isValidAccessTokenPayload(decoded)) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
      return;
    }

    // Verify current account status and current role from database
    // This strictly ensures that deactivated accounts and demoted roles
    // immediately invalidate access even with a valid, unexpired JWT.
    const userResult = await activeAuthQuery(
      `SELECT id, employee_code, email, role, plant_id, shop_id, is_active
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
      return;
    }

    const dbUser = userResult.rows[0];

    req.user = {
      id: dbUser.id,
      employee_code: dbUser.employee_code,
      email: dbUser.email,
      role: dbUser.role,
      ...(typeof dbUser.plant_id === 'string'
        ? { plant_id: dbUser.plant_id }
        : {}),
      ...(typeof dbUser.shop_id === 'string'
        ? { shop_id: dbUser.shop_id }
        : {}),
    };

    next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError ||
      err instanceof jwt.NotBeforeError
    ) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
      });
      return;
    }

    next(err);
  }
};
