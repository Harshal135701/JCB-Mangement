
import { Request, Response, NextFunction } from 'express';

export const requireRoles = (...allowedRoles: string[]) => {
  const roles = allowedRoles
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  if (roles.length === 0) {
    throw new Error('RBAC configuration error: At least one role is required.');
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const userRole = req.user.role?.trim().toLowerCase();

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
};
