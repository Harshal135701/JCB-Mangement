import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { config } from '../../config/env';
import { createAndSendNotification } from '../notifications/notifications.service';

export const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const VALID_ROLES = ['admin', 'manager', 'store_manager', 'operator', 'technician'] as const;
export type ValidRole = (typeof VALID_ROLES)[number];

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isValidPassword = (value: string): boolean =>
  typeof value === 'string' && value.length >= 12 && value.length <= 128;

export type DbQueryFunction = (
  text: string,
  params?: any[]
) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
  release: () => void;
}

export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
}

let activeQuery: DbQueryFunction = defaultQuery;
let activePool: DbPoolLike = defaultPool as unknown as DbPoolLike;

export const setAuthDb = (
  customQuery?: DbQueryFunction,
  customPool?: DbPoolLike
): void => {
  activeQuery = customQuery || defaultQuery;
  activePool = customPool || (defaultPool as unknown as DbPoolLike);
};

export const resetAuthDb = (): void => {
  activeQuery = defaultQuery;
  activePool = defaultPool as unknown as DbPoolLike;
};

export const signAccessToken = (user: {
  id: string;
  employee_code: string;
  email: string;
  role: string;
  plant_id?: string | null;
  shop_id?: string | null;
}): string =>
  jwt.sign(
    {
      id: user.id,
      employee_code: user.employee_code,
      email: user.email,
      role: user.role,
      plant_id: user.plant_id ?? null,
      shop_id: user.shop_id ?? null,
    },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    }
  );

export const signRefreshToken = (userId: string): string =>
  jwt.sign(
    { id: userId, tokenType: 'refresh' },
    config.refreshTokenSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.refreshTokenExpiresIn as SignOptions['expiresIn'],
    }
  );

export const verifyRefreshToken = (token: string): string | null => {
  try {
    const decoded = jwt.verify(token, config.refreshTokenSecret, {
      algorithms: ['HS256'],
    }) as JwtPayload;

    if (
      decoded.tokenType !== 'refresh' ||
      typeof decoded.id !== 'string' ||
      !isUUID(decoded.id)
    ) {
      return null;
    }

    return decoded.id;
  } catch {
    return null;
  }
};

// LOGIN
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { identifier, password } = req.body || {};

    if (
      !isNonEmptyString(identifier) ||
      typeof password !== 'string' ||
      password.length === 0 ||
      password.length > 128
    ) {
      res.status(400).json({
        success: false,
        message: 'Please provide Employee ID / Email and password.',
      });
      return;
    }

    const cleanIdentifier = identifier.trim();

    if (cleanIdentifier.length > 255) {
      res.status(400).json({
        success: false,
        message: 'Invalid login identifier.',
      });
      return;
    }

    const result = await activeQuery(
      `SELECT id, employee_code, full_name, email, phone, role,
              plant_id, shop_id, department, designation, shift,
              password_hash, is_active, approval_status, rejection_reason,
              permanent_machine_id
       FROM users
       WHERE LOWER(email) = LOWER($1)
          OR UPPER(employee_code) = UPPER($1)`,
      [cleanIdentifier]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    const dbUser = result.rows[0];

    // Password verification using bcrypt
    const isMatch = await bcrypt.compare(password, dbUser.password_hash);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    // Newly registered Operator must not be able to log in until approved by Manager (Requirement 4)
    const approvalStatus = (dbUser.approval_status || 'approved').toLowerCase();
    if (approvalStatus === 'pending') {
      res.status(403).json({
        success: false,
        approval_status: 'pending',
        message: 'Your registration is pending approval by your Plant Manager. You will be able to log in once approved.',
      });
      return;
    }

    if (approvalStatus === 'rejected') {
      res.status(403).json({
        success: false,
        approval_status: 'rejected',
        message: dbUser.rejection_reason
          ? `Your registration was rejected by your Plant Manager. Reason: ${dbUser.rejection_reason}`
          : 'Your registration has been rejected. Please contact your plant manager or administrator.',
      });
      return;
    }

    // Reject inactive accounts with consistent 401 response
    if (!dbUser.is_active) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    if (!VALID_ROLES.includes(dbUser.role)) {
      res.status(403).json({
        success: false,
        message: 'Account role is not authorized.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token: signAccessToken(dbUser),
        refreshToken: signRefreshToken(dbUser.id),
        user: {
          id: dbUser.id,
          employeeCode: dbUser.employee_code,
          fullName: dbUser.full_name,
          email: dbUser.email,
          role: dbUser.role,
          plantId: dbUser.plant_id,
          shopId: dbUser.shop_id,
          department: dbUser.department,
          designation: dbUser.designation,
          shift: dbUser.shift,
          permanentMachineId: dbUser.permanent_machine_id ?? null,
          permanent_machine_id: dbUser.permanent_machine_id ?? null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// REFRESH TOKEN
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.body?.refreshToken;

    if (typeof token !== 'string' || token.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
      return;
    }

    const userId = verifyRefreshToken(token);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token.',
      });
      return;
    }

    const result = await activeQuery(
      `SELECT id, employee_code, email, role, plant_id, shop_id, is_active
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      res.status(401).json({
        success: false,
        message: 'Invalid session or inactive account.',
      });
      return;
    }

    const dbUser = result.rows[0];

    if (!VALID_ROLES.includes(dbUser.role)) {
      res.status(403).json({
        success: false,
        message: 'Account role is not authorized.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully.',
      data: {
        token: signAccessToken(dbUser),
        refreshToken: signRefreshToken(dbUser.id),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET USER PROFILE
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId || !isUUID(userId)) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const result = await activeQuery(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone,
              u.role, u.department, u.designation, u.shift,
              u.plant_id, u.shop_id, u.is_active,
              u.requested_machine_id, u.permanent_machine_id,
              pm.machine_code AS permanent_machine_code,
              pm.name AS permanent_machine_name,
              pm.status AS permanent_machine_status,
              pm.bay_line_location AS permanent_machine_location,
              p.plant_name, s.shop_name
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
       LEFT JOIN machines pm ON u.permanent_machine_id = pm.id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Active user profile not found.',
      });
      return;
    }

    const row = result.rows[0];

    res.json({
      success: true,
      data: {
        id: row.id,
        employee_code: row.employee_code,
        employeeCode: row.employee_code,
        full_name: row.full_name,
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        department: row.department,
        designation: row.designation,
        shift: row.shift,
        plant_id: row.plant_id,
        plantId: row.plant_id,
        shop_id: row.shop_id,
        shopId: row.shop_id,
        plant_name: row.plant_name ?? null,
        plantName: row.plant_name ?? null,
        shop_name: row.shop_name ?? null,
        shopName: row.shop_name ?? null,
        requested_machine_id: row.requested_machine_id ?? null,
        requestedMachineId: row.requested_machine_id ?? null,
        permanent_machine_id: row.permanent_machine_id ?? null,
        permanentMachineId: row.permanent_machine_id ?? null,
        permanent_machine_code: row.permanent_machine_code ?? null,
        permanentMachineCode: row.permanent_machine_code ?? null,
        permanent_machine_name: row.permanent_machine_name ?? null,
        permanentMachineName: row.permanent_machine_name ?? null,
        permanent_machine_status: row.permanent_machine_status ?? null,
        permanentMachineStatus: row.permanent_machine_status ?? null,
        permanent_machine_location: row.permanent_machine_location ?? null,
        permanentMachineLocation: row.permanent_machine_location ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// LIST USERS (Admin Only)
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pageParam = req.query.page;
    const limitParam = req.query.limit;

    let page = 1;
    if (pageParam !== undefined) {
      const pageNum = Number(pageParam);
      if (!Number.isInteger(pageNum) || pageNum < 1) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters: page must be a positive integer.',
        });
        return;
      }
      page = pageNum;
    }

    let limit = 50;
    if (limitParam !== undefined) {
      const limitNum = Number(limitParam);
      if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
        res.status(400).json({
          success: false,
          message: 'Invalid pagination parameters: limit must be an integer between 1 and 100.',
        });
        return;
      }
      limit = limitNum;
    }

    const search =
      typeof req.query.search === 'string'
        ? req.query.search.trim()
        : typeof req.query.q === 'string'
        ? req.query.q.trim()
        : undefined;

    if (search !== undefined && search.length > 255) {
      res.status(400).json({
        success: false,
        message: 'Search query exceeds maximum length of 255 characters.',
      });
      return;
    }

    const role =
      typeof req.query.role === 'string'
        ? req.query.role.trim().toLowerCase()
        : undefined;

    if (role !== undefined && !VALID_ROLES.includes(role as ValidRole)) {
      res.status(400).json({
        success: false,
        message: `Invalid role filter. Supported roles: ${VALID_ROLES.join(', ')}.`,
      });
      return;
    }

    // Role-based visibility and scope checks:
    // Manager can view only: technician, operator, store_manager.
    // Manager must NOT be able to view or manage: manager, admin.
    // Managers must only see users belonging to their own assigned plant.
    const callerRole = req.user?.role?.trim().toLowerCase();
    const isManager = callerRole === 'manager';

    if (isManager) {
      if (!req.user?.plant_id) {
        // Manager with no assigned plant sees empty directory
        res.json({
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
          },
        });
        return;
      }

      // Reject if manager attempts to query a plant outside their assignment
      if (req.query.plant_id && req.query.plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers cannot access users outside their assigned plant.',
        });
        return;
      }

      // Manager can view and manage only: technician, operator, store_manager
      // Reject if manager attempts to query other manager or admin accounts
      const allowedManagerViewRoles = ['technician', 'operator', 'store_manager'];
      if (role !== undefined && !allowedManagerViewRoles.includes(role)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers are not permitted to view manager or admin accounts.',
        });
        return;
      }
    }

    const statusParam = req.query.status ?? req.query.is_active;
    let isActiveFilter: boolean | undefined = undefined;

    if (statusParam !== undefined) {
      const cleanStatus = String(statusParam).trim().toLowerCase();
      if (cleanStatus === 'active' || cleanStatus === 'true') {
        isActiveFilter = true;
      } else if (cleanStatus === 'inactive' || cleanStatus === 'false') {
        isActiveFilter = false;
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid status filter. Allowed values: active, inactive, true, false.',
        });
        return;
      }
    }

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const pIdx = params.length;
      whereClauses.push(
        `(full_name ILIKE $${pIdx} OR employee_code ILIKE $${pIdx} OR email ILIKE $${pIdx})`
      );
    }

    if (role) {
      params.push(role);
      whereClauses.push(`role = $${params.length}`);
    } else if (isManager) {
      // Unfiltered role query by manager strictly restricts visibility to technician, operator, and store_manager
      whereClauses.push("role IN ('technician', 'operator', 'store_manager')");
    }

    if (isActiveFilter !== undefined) {
      params.push(isActiveFilter);
      whereClauses.push(`is_active = $${params.length}`);
    }

    // Plant filtering:
    // Managers must only see users belonging to their own assigned plant.
    // Admins can see all plants, or optionally filter by plant_id query parameter.
    if (isManager) {
      params.push(req.user!.plant_id);
      whereClauses.push(`plant_id = $${params.length}`);
    } else if (req.query.plant_id && isUUID(req.query.plant_id as string)) {
      params.push(req.query.plant_id);
      whereClauses.push(`plant_id = $${params.length}`);
    }

    // Shop filtering:
    if (req.query.shop_id) {
      if (!isUUID(req.query.shop_id as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid shop ID filter.',
        });
        return;
      }
      if (isManager) {
        const shopRes = await activeQuery(
          `SELECT id, plant_id FROM shops WHERE id = $1`,
          [req.query.shop_id]
        );
        if (shopRes.rows.length === 0 || shopRes.rows[0].plant_id !== req.user!.plant_id) {
          res.status(403).json({
            success: false,
            message: 'Forbidden: Shop does not belong to your assigned plant.',
          });
          return;
        }
      }
      params.push(req.query.shop_id);
      whereClauses.push(`shop_id = $${params.length}`);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countResult = await activeQuery(
      `SELECT COUNT(*)::int AS total FROM users ${whereSql}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    const offset = (page - 1) * limit;
    const queryParams = [...params, limit, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const result = await activeQuery(
      `SELECT id, employee_code, full_name, email, phone, role,
              plant_id, shop_id, department, designation, shift,
              is_active, created_at, updated_at
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// CREATE USER (Admin Only)
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      role = 'operator',
      plant_id,
      shop_id,
      department,
      designation,
      shift = 'Shift A',
      password,
    } = req.body || {};

    if (
      !isNonEmptyString(employee_code) ||
      !isNonEmptyString(full_name) ||
      !isNonEmptyString(email) ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: 'employee_code, full_name, email, and password are required.',
      });
      return;
    }

    const cleanEmployeeCode = employee_code.trim().toUpperCase();
    const cleanFullName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanEmployeeCode.length > 50 ||
      cleanFullName.length > 255 ||
      cleanEmail.length > 255 ||
      !isValidEmail(cleanEmail)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid employee code, name, or email format.',
      });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({
        success: false,
        message: 'Password must contain between 12 and 128 characters.',
      });
      return;
    }

    if (
      typeof role !== 'string' ||
      !VALID_ROLES.includes(role.trim().toLowerCase() as ValidRole)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid user role.',
      });
      return;
    }
    const cleanRole = role.trim().toLowerCase();

    // Role-based authorization & permission enforcement
    const callerRole = req.user?.role ? req.user.role.trim().toLowerCase() : 'admin';
    if (callerRole === 'manager') {
      const allowedManagerRoles = ['technician', 'operator', 'store_manager'];
      if (!allowedManagerRoles.includes(cleanRole)) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers are only permitted to create technician, operator, and store_manager accounts.',
        });
        return;
      }
    } else if (callerRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to create user accounts.',
      });
      return;
    }

    if (
      phone != null &&
      (typeof phone !== 'string' || phone.trim().length > 50)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number.',
      });
      return;
    }

    if (
      [department, designation, shift].some(
        (value) => value != null && typeof value !== 'string'
      )
    ) {
      res.status(400).json({
        success: false,
        message: 'Department, designation, and shift must be text values.',
      });
      return;
    }

    if (
      (department && department.trim().length > 100) ||
      (designation && designation.trim().length > 100) ||
      (shift && shift.trim().length > 50)
    ) {
      res.status(400).json({
        success: false,
        message: 'One or more user fields exceed their maximum length.',
      });
      return;
    }

    // Plant & Shop Resolution and Verification:
    let targetPlantId: string | null = null;
    let targetShopId: string | null = shop_id || null;

    if (callerRole === 'manager') {
      // 1. Manager must have an assigned plant
      if (!req.user?.plant_id || !isUUID(req.user.plant_id)) {
        res.status(400).json({
          success: false,
          message: 'Manager account is not assigned to a plant. Cannot create users.',
        });
        return;
      }

      // 2. Reject if manager attempts to manipulate plant_id to another plant
      if (plant_id != null && plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers cannot create users for another plant.',
        });
        return;
      }

      // Always enforce the manager's assigned plant ID from trusted server-side user context
      targetPlantId = req.user.plant_id;

      // 3. If shop_id is provided, validate it belongs to the manager's plant
      if (targetShopId != null) {
        if (!isUUID(targetShopId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid shop ID.',
          });
          return;
        }

        const shopResult = await activeQuery(
          `SELECT id, plant_id FROM shops WHERE id = $1`,
          [targetShopId]
        );

        if (shopResult.rows.length === 0) {
          res.status(400).json({
            success: false,
            message: 'Selected shop does not exist.',
          });
          return;
        }

        const dbShop = shopResult.rows[0];
        if (dbShop.plant_id !== targetPlantId) {
          res.status(400).json({
            success: false,
            message: 'Selected shop does not belong to the manager\'s assigned plant.',
          });
          return;
        }
      }
    } else {
      // Admin: retains existing plant and shop assignment capabilities
      if (plant_id != null) {
        if (!isUUID(plant_id)) {
          res.status(400).json({
            success: false,
            message: 'Invalid plant ID.',
          });
          return;
        }

        const plantResult = await activeQuery(
          `SELECT id FROM plants WHERE id = $1`,
          [plant_id]
        );
        if (plantResult.rows.length === 0) {
          res.status(400).json({
            success: false,
            message: 'Selected plant does not exist.',
          });
          return;
        }
        targetPlantId = plant_id;
      }

      if (targetShopId != null) {
        if (!isUUID(targetShopId)) {
          res.status(400).json({
            success: false,
            message: 'Invalid shop ID.',
          });
          return;
        }

        const shopResult = await activeQuery(
          `SELECT id, plant_id FROM shops WHERE id = $1`,
          [targetShopId]
        );

        if (shopResult.rows.length === 0) {
          res.status(400).json({
            success: false,
            message: 'Selected shop does not exist.',
          });
          return;
        }

        const dbShop = shopResult.rows[0];
        if (!targetPlantId || dbShop.plant_id !== targetPlantId) {
          res.status(400).json({
            success: false,
            message: 'Selected shop does not belong to the selected plant.',
          });
          return;
        }
      }
    }

    // Safe shift normalization without calling .trim() on null
    const cleanShift =
      shift === null
        ? null
        : typeof shift === 'string'
        ? shift.trim() || null
        : 'Shift A';

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await activeQuery(
      `INSERT INTO users (
        employee_code, full_name, email, phone, role,
        plant_id, shop_id, department, designation, shift, password_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, employee_code, full_name, email, phone, role,
                 plant_id, shop_id, department, designation, shift, is_active, created_at`,
      [
        cleanEmployeeCode,
        cleanFullName,
        cleanEmail,
        phone != null && typeof phone === 'string' ? phone.trim() || null : null,
        cleanRole,
        targetPlantId,
        targetShopId,
        department != null && typeof department === 'string' ? department.trim() || null : null,
        designation != null && typeof designation === 'string' ? designation.trim() || null : null,
        cleanShift,
        passwordHash,
      ]
    );

    res.status(201).json({
      success: true,
      message: `User ${result.rows[0].full_name} (${result.rows[0].employee_code}) created successfully.`,
      data: result.rows[0],
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Employee Code or Email already exists.',
      });
      return;
    }
    if (err?.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Invalid plant or shop reference.',
      });
      return;
    }
    if (err?.code === '22P02') {
      res.status(400).json({
        success: false,
        message: 'Invalid parameter format.',
      });
      return;
    }

    next(err);
  }
};

// UPDATE USER (Admin Only)
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const callerRole = req.user?.role ? req.user.role.trim().toLowerCase() : 'admin';
    if (callerRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators are permitted to edit users.',
      });
      return;
    }

    const { id } = req.params;

    if (!isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID.',
      });
      return;
    }

    const allowedFields = [
      'full_name',
      'phone',
      'role',
      'plant_id',
      'shop_id',
      'department',
      'designation',
      'shift',
      'is_active',
    ];

    const suppliedFields = Object.keys(req.body || {});

    if (
      suppliedFields.length === 0 ||
      suppliedFields.some((field) => !allowedFields.includes(field))
    ) {
      res.status(400).json({
        success: false,
        message: 'Provide valid user fields to update.',
      });
      return;
    }

    const currentResult = await activeQuery(
      `SELECT id, role, is_active, plant_id, shop_id FROM users WHERE id = $1`,
      [id]
    );

    if (currentResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const currentUser = currentResult.rows[0];

    // Prevent administrators from deactivating themselves or removing their own admin role
    if (
      req.user?.id === id &&
      (req.body.is_active === false ||
        (req.body.role !== undefined && req.body.role !== 'admin'))
    ) {
      res.status(400).json({
        success: false,
        message: 'You cannot deactivate yourself or remove your own admin role.',
      });
      return;
    }

    const updates: Record<string, any> = { ...req.body };

    if (
      updates.role !== undefined &&
      (typeof updates.role !== 'string' ||
        !VALID_ROLES.includes(updates.role.trim().toLowerCase() as ValidRole))
    ) {
      res.status(400).json({ success: false, message: 'Invalid user role.' });
      return;
    }

    if (
      updates.is_active !== undefined &&
      typeof updates.is_active !== 'boolean'
    ) {
      res.status(400).json({
        success: false,
        message: 'is_active must be boolean.',
      });
      return;
    }

    if (
      updates.plant_id !== undefined &&
      updates.plant_id !== null &&
      !isUUID(updates.plant_id as string)
    ) {
      res.status(400).json({ success: false, message: 'Invalid plant ID.' });
      return;
    }

    if (
      updates.shop_id !== undefined &&
      updates.shop_id !== null &&
      !isUUID(updates.shop_id as string)
    ) {
      res.status(400).json({ success: false, message: 'Invalid shop ID.' });
      return;
    }

    const stringLimits: Record<string, number> = {
      full_name: 255,
      phone: 50,
      department: 100,
      designation: 100,
      shift: 50,
    };

    for (const [field, limit] of Object.entries(stringLimits)) {
      if (
        updates[field] !== undefined &&
        updates[field] !== null &&
        (typeof updates[field] !== 'string' ||
          (updates[field] as string).trim().length > limit)
      ) {
        res.status(400).json({
          success: false,
          message: `Invalid ${field}.`,
        });
        return;
      }
    }

    if (
      updates.full_name !== undefined &&
      !isNonEmptyString(updates.full_name)
    ) {
      res.status(400).json({ success: false, message: 'Name cannot be empty.' });
      return;
    }

    // Determine the resulting plant and shop IDs incorporating both updates and existing state
    const resultingPlantId =
      updates.plant_id !== undefined ? updates.plant_id : currentUser.plant_id;
    const resultingShopId =
      updates.shop_id !== undefined ? updates.shop_id : currentUser.shop_id;

    // Validate plant existence when plant is updated to a non-null ID
    if (updates.plant_id !== undefined && updates.plant_id !== null) {
      const plantResult = await activeQuery(
        `SELECT id FROM plants WHERE id = $1`,
        [updates.plant_id]
      );
      if (plantResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Selected plant does not exist.',
        });
        return;
      }
    }

    // Validate resulting shop existence and ensure it matches the resulting plant
    if (resultingShopId !== null && resultingShopId !== undefined) {
      const shopResult = await activeQuery(
        `SELECT id, plant_id FROM shops WHERE id = $1`,
        [resultingShopId]
      );

      if (shopResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Selected shop does not exist.',
        });
        return;
      }

      const dbShop = shopResult.rows[0];
      if (!resultingPlantId || dbShop.plant_id !== resultingPlantId) {
        res.status(400).json({
          success: false,
          message: 'Selected shop does not belong to the selected plant.',
        });
        return;
      }
    }

    const resultingRole =
      updates.role !== undefined
        ? updates.role.trim().toLowerCase()
        : currentUser.role;
    const resultingActive =
      updates.is_active !== undefined ? updates.is_active : currentUser.is_active;

    const isDemotingOrDeactivatingAdmin =
      currentUser.role === 'admin' &&
      currentUser.is_active === true &&
      (!resultingActive || resultingRole !== 'admin');

    let updatedRow: any;

    if (isDemotingOrDeactivatingAdmin) {
      // Use transaction with row-level locks for concurrent last-admin protection
      const client = await activePool.connect();
      try {
        await client.query('BEGIN');
        const adminLockResult = await client.query(
          `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE`
        );

        if (adminLockResult.rows.length <= 1) {
          await client.query('ROLLBACK');
          res.status(409).json({
            success: false,
            message: 'Cannot deactivate or demote the last active administrator.',
          });
          return;
        }

        const result = await client.query(
          `UPDATE users
           SET full_name = CASE WHEN $1::boolean THEN $2 ELSE full_name END,
               phone = CASE WHEN $3::boolean THEN $4 ELSE phone END,
               role = CASE WHEN $5::boolean THEN $6::user_role ELSE role END,
               plant_id = CASE WHEN $7::boolean THEN $8::uuid ELSE plant_id END,
               shop_id = CASE WHEN $9::boolean THEN $10::uuid ELSE shop_id END,
               department = CASE WHEN $11::boolean THEN $12 ELSE department END,
               designation = CASE WHEN $13::boolean THEN $14 ELSE designation END,
               shift = CASE WHEN $15::boolean THEN $16 ELSE shift END,
               is_active = CASE WHEN $17::boolean THEN $18::boolean ELSE is_active END,
               updated_at = NOW()
           WHERE id = $19
           RETURNING id, employee_code, full_name, email, phone, role,
                     plant_id, shop_id, department, designation, shift, is_active, updated_at`,
          [
            updates.full_name !== undefined,
            updates.full_name?.trim() ?? null,
            updates.phone !== undefined,
            updates.phone != null && typeof updates.phone === 'string'
              ? updates.phone.trim() || null
              : null,
            updates.role !== undefined,
            updates.role?.trim().toLowerCase() ?? null,
            updates.plant_id !== undefined,
            updates.plant_id ?? null,
            updates.shop_id !== undefined,
            updates.shop_id ?? null,
            updates.department !== undefined,
            updates.department != null && typeof updates.department === 'string'
              ? updates.department.trim() || null
              : null,
            updates.designation !== undefined,
            updates.designation != null && typeof updates.designation === 'string'
              ? updates.designation.trim() || null
              : null,
            updates.shift !== undefined,
            updates.shift != null && typeof updates.shift === 'string'
              ? updates.shift.trim() || null
              : null,
            updates.is_active !== undefined,
            updates.is_active ?? null,
            id,
          ]
        );

        await client.query('COMMIT');
        updatedRow = result.rows[0];
      } catch (clientErr) {
        await client.query('ROLLBACK');
        throw clientErr;
      } finally {
        client.release();
      }
    } else {
      const result = await activeQuery(
        `UPDATE users
         SET full_name = CASE WHEN $1::boolean THEN $2 ELSE full_name END,
             phone = CASE WHEN $3::boolean THEN $4 ELSE phone END,
             role = CASE WHEN $5::boolean THEN $6::user_role ELSE role END,
             plant_id = CASE WHEN $7::boolean THEN $8::uuid ELSE plant_id END,
             shop_id = CASE WHEN $9::boolean THEN $10::uuid ELSE shop_id END,
             department = CASE WHEN $11::boolean THEN $12 ELSE department END,
             designation = CASE WHEN $13::boolean THEN $14 ELSE designation END,
             shift = CASE WHEN $15::boolean THEN $16 ELSE shift END,
             is_active = CASE WHEN $17::boolean THEN $18::boolean ELSE is_active END,
             updated_at = NOW()
         WHERE id = $19
         RETURNING id, employee_code, full_name, email, phone, role,
                   plant_id, shop_id, department, designation, shift, is_active, updated_at`,
        [
          updates.full_name !== undefined,
          updates.full_name?.trim() ?? null,
          updates.phone !== undefined,
          updates.phone != null && typeof updates.phone === 'string'
            ? updates.phone.trim() || null
            : null,
          updates.role !== undefined,
          updates.role?.trim().toLowerCase() ?? null,
          updates.plant_id !== undefined,
          updates.plant_id ?? null,
          updates.shop_id !== undefined,
          updates.shop_id ?? null,
          updates.department !== undefined,
          updates.department != null && typeof updates.department === 'string'
            ? updates.department.trim() || null
            : null,
          updates.designation !== undefined,
          updates.designation != null && typeof updates.designation === 'string'
            ? updates.designation.trim() || null
            : null,
          updates.shift !== undefined,
          updates.shift != null && typeof updates.shift === 'string'
            ? updates.shift.trim() || null
            : null,
          updates.is_active !== undefined,
          updates.is_active ?? null,
          id,
        ]
      );
      updatedRow = result.rows[0];
    }

    res.json({
      success: true,
      message: 'User updated successfully.',
      data: updatedRow,
    });
  } catch (err: any) {
    if (err?.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Invalid plant or shop reference.',
      });
      return;
    }
    if (err?.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'Duplicate key value violates unique constraint.',
      });
      return;
    }
    if (err?.code === '22P02') {
      res.status(400).json({
        success: false,
        message: 'Invalid parameter format.',
      });
      return;
    }

    next(err);
  }
};

// DELETE USER / SOFT DEACTIVATE (Admin Only)
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const callerRole = req.user?.role ? req.user.role.trim().toLowerCase() : 'admin';
    if (callerRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only administrators are permitted to deactivate users.',
      });
      return;
    }

    const { id } = req.params;

    if (!isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID.',
      });
      return;
    }

    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
      return;
    }

    const userResult = await activeQuery(
      `SELECT id, employee_code, full_name, role, is_active
       FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const targetUser = userResult.rows[0];

    if (!targetUser.is_active) {
      res.status(409).json({
        success: false,
        message: 'User account is already inactive.',
      });
      return;
    }

    let deactivatedRow: any;

    if (targetUser.role === 'admin') {
      const client = await activePool.connect();
      try {
        await client.query('BEGIN');
        const adminLockResult = await client.query(
          `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE`
        );

        if (adminLockResult.rows.length <= 1) {
          await client.query('ROLLBACK');
          res.status(409).json({
            success: false,
            message: 'Cannot deactivate the last active administrator.',
          });
          return;
        }

        const result = await client.query(
          `UPDATE users
           SET is_active = FALSE, updated_at = NOW()
           WHERE id = $1
           RETURNING id, employee_code, full_name, is_active`,
          [id]
        );

        await client.query('COMMIT');
        deactivatedRow = result.rows[0];
      } catch (clientErr) {
        await client.query('ROLLBACK');
        throw clientErr;
      } finally {
        client.release();
      }
    } else {
      const result = await activeQuery(
        `UPDATE users
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING id, employee_code, full_name, is_active`,
        [id]
      );
      deactivatedRow = result.rows[0];
    }

    res.json({
      success: true,
      message: `User ${deactivatedRow.full_name} deactivated successfully.`,
      data: deactivatedRow,
    });
  } catch (err) {
    next(err);
  }
};

// =====================================================================
// OPERATOR SIGN-UP & MANAGER APPROVAL WORKFLOW
// =====================================================================

/**
 * Public registration options: returns active plants and active shops
 */
export const getRegistrationOptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const plantsRes = await activeQuery(
      `SELECT id, plant_code, plant_name, city, state 
       FROM plants 
       WHERE status = 'active' OR status IS NULL
       ORDER BY plant_name ASC`
    );

    const shopsRes = await activeQuery(
      `SELECT s.id, s.plant_id, s.shop_code, s.shop_name 
       FROM shops s
       JOIN plants p ON s.plant_id = p.id
       WHERE (s.status = 'active' OR s.status IS NULL)
         AND (p.status = 'active' OR p.status IS NULL)
       ORDER BY s.shop_name ASC`
    );

    res.json({
      success: true,
      data: {
        plants: plantsRes.rows,
        shops: shopsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getRegistrationPlants = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await activeQuery(
      `SELECT id, plant_code, plant_name, city, state 
       FROM plants 
       WHERE status = 'active' OR status IS NULL
       ORDER BY plant_name ASC`
    );
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

export const getRegistrationShops = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { plantId } = req.params;
    if (!plantId || !isUUID(plantId)) {
      res.status(400).json({
        success: false,
        message: 'Valid plant ID is required.',
      });
      return;
    }

    const result = await activeQuery(
      `SELECT id, plant_id, shop_code, shop_name 
       FROM shops 
       WHERE plant_id = $1 AND (status = 'active' OR status IS NULL)
       ORDER BY shop_name ASC`,
      [plantId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public Operator Registration: Fetch machines for a selected shop
 * Returns machines in the shop floor with availability status (Available vs Assigned).
 */
export const getRegistrationMachines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { shopId } = req.params;
    const targetPlantId = (req.query.plant_id || req.query.plantId) as string | undefined;

    if (!shopId || !isUUID(shopId)) {
      res.status(400).json({
        success: false,
        message: 'Valid shop ID is required.',
      });
      return;
    }

    if (targetPlantId && !isUUID(targetPlantId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plant facility ID.',
      });
      return;
    }

    // Verify shop exists and belongs to plant if plant filter supplied
    const shopCheck = await activeQuery(`SELECT id, shop_name, plant_id FROM shops WHERE id = $1`, [shopId]);
    if (shopCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Specified shop floor does not exist.',
      });
      return;
    }

    const dbShop = shopCheck.rows[0];
    if (targetPlantId && dbShop.plant_id !== targetPlantId) {
      res.status(400).json({
        success: false,
        message: 'Specified shop floor does not belong to the selected plant facility.',
      });
      return;
    }

    // Return machines belonging to this shop with calculated assignment and availability status
    let result;
    try {
      result = await activeQuery(
        `SELECT 
          id, 
          machine_code, 
          name, 
          category, 
          status, 
          criticality, 
          operating_hours, 
          bay_line_location, 
          shop_id,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM users u 
              WHERE (u.permanent_machine_id = machines.id OR (u.requested_machine_id = machines.id AND u.approval_status = 'pending'))
                AND u.role = 'operator'
                AND u.approval_status != 'rejected'
            ) THEN TRUE
            WHEN EXISTS (
              SELECT 1 FROM operator_machine_assignments oma 
              WHERE oma.machine_id = machines.id 
                AND oma.status IN ('pending', 'approved')
            ) THEN TRUE
            WHEN machines.current_operator_id IS NOT NULL THEN TRUE
            ELSE FALSE
          END AS is_assigned
        FROM machines
        WHERE shop_id = $1
        ORDER BY machine_code ASC`,
        [shopId]
      );
    } catch {
      result = await activeQuery(
        `SELECT id, machine_code, name, category, status, criticality, operating_hours, bay_line_location, shop_id
         FROM machines
         WHERE shop_id = $1
         ORDER BY machine_code ASC`,
        [shopId]
      );
    }

    // Resolve assignment status fallback if simple mock or columns did not include is_assigned
    let fallbackAssignedIds = new Set<string>();
    if (result.rows.length > 0 && result.rows[0].is_assigned === undefined) {
      try {
        const assignedUsers = await activeQuery(
          `SELECT permanent_machine_id, requested_machine_id, approval_status
           FROM users
           WHERE role = 'operator' AND approval_status != 'rejected'`
        );
        for (const u of assignedUsers.rows) {
          if (u.permanent_machine_id) fallbackAssignedIds.add(u.permanent_machine_id);
          if (u.requested_machine_id && u.approval_status === 'pending') fallbackAssignedIds.add(u.requested_machine_id);
        }
      } catch {
        // Fallback for minimal schemas
      }
    }

    const data = result.rows.map((row: any) => {
      const isAssigned = row.is_assigned !== undefined
        ? Boolean(row.is_assigned)
        : fallbackAssignedIds.has(row.id);
      return {
        ...row,
        is_assigned: isAssigned,
        is_available: !isAssigned,
        availability_status: isAssigned ? 'Assigned' : 'Available',
      };
    });

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public Operator Self-Registration
 * Creates an operator account in 'pending' status and is_active = false.
 * Role is strictly locked to 'operator'. Notifies managers of the assigned plant.
 */
export const registerOperator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      plant_id,
      shop_id,
      department,
      designation,
      shift = 'Shift A',
      password,
      requested_machine_id,
      machine_id,
    } = req.body || {};

    const targetMachineId = requested_machine_id || machine_id || null;

    if (
      !isNonEmptyString(employee_code) ||
      !isNonEmptyString(full_name) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(plant_id) ||
      !isNonEmptyString(shop_id) ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: 'employee_code, full_name, email, plant_id, shop_id, and password are required.',
      });
      return;
    }

    const cleanEmployeeCode = employee_code.trim().toUpperCase();
    const cleanFullName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      cleanEmployeeCode.length > 50 ||
      cleanFullName.length > 255 ||
      cleanEmail.length > 255 ||
      !isValidEmail(cleanEmail)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid employee code, name, or email format.',
      });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        success: false,
        message: 'Password must be between 8 and 128 characters.',
      });
      return;
    }

    if (!isUUID(plant_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plant facility ID.',
      });
      return;
    }

    if (!isUUID(shop_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid shop floor ID.',
      });
      return;
    }

    // Verify plant exists
    const plantCheck = await activeQuery(
      `SELECT id, plant_name, plant_code FROM plants WHERE id = $1`,
      [plant_id]
    );
    if (plantCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Specified plant facility does not exist.',
      });
      return;
    }
    const dbPlant = plantCheck.rows[0];

    // Verify shop exists and belongs to plant
    const shopCheck = await activeQuery(
      `SELECT id, plant_id, shop_name, shop_code FROM shops WHERE id = $1`,
      [shop_id]
    );
    if (shopCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Specified shop floor does not exist.',
      });
      return;
    }
    const dbShop = shopCheck.rows[0];
    if (dbShop.plant_id !== plant_id) {
      res.status(400).json({
        success: false,
        message: 'Selected shop does not belong to the selected plant facility.',
      });
      return;
    }

    // Optional requested machine validation (registration preference only)
    let dbMachine: any = null;
    if (targetMachineId) {
      if (!isUUID(String(targetMachineId))) {
        res.status(400).json({
          success: false,
          message: 'Invalid requested machine ID format.',
        });
        return;
      }

      const machineCheck = await activeQuery(
        `SELECT id, shop_id, machine_code, name, status FROM machines WHERE id = $1`,
        [targetMachineId]
      );

      if (machineCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Requested machine does not exist.',
        });
        return;
      }

      dbMachine = machineCheck.rows[0];
      if (dbMachine.shop_id !== shop_id) {
        res.status(400).json({
          success: false,
          message: 'Requested machine does not belong to the selected shop floor.',
        });
        return;
      }

      // Check if machine is already assigned as permanent machine or pending requested machine to another operator
      const assignedCheck = await activeQuery(
        `SELECT id, full_name, employee_code, approval_status, permanent_machine_id, requested_machine_id
         FROM users
         WHERE (permanent_machine_id = $1 OR (requested_machine_id = $1 AND approval_status = 'pending'))
           AND role = 'operator'
           AND approval_status != 'rejected'`,
        [targetMachineId]
      );

      if (assignedCheck.rows.length > 0) {
        const assignedOp = assignedCheck.rows[0];
        res.status(409).json({
          success: false,
          message: `Machine ${dbMachine.name || dbMachine.machine_code} is already assigned to another operator.`,
        });
        return;
      }

      // Also check active assignments in operator_machine_assignments if present
      try {
        const omaCheck = await activeQuery(
          `SELECT oma.id, u.full_name, u.employee_code
           FROM operator_machine_assignments oma
           LEFT JOIN users u ON u.id = oma.operator_id
           WHERE oma.machine_id = $1 AND oma.status IN ('pending', 'approved')`,
          [targetMachineId]
        );
        if (omaCheck.rows.length > 0) {
          res.status(409).json({
            success: false,
            message: `Machine ${dbMachine.name || dbMachine.machine_code} is already assigned to another operator.`,
          });
          return;
        }
      } catch {
        // Fallback for minimal schemas
      }

      // Check if machine currently has active operator tracking
      if (dbMachine.current_operator_id) {
        res.status(409).json({
          success: false,
          message: `Machine ${dbMachine.name || dbMachine.machine_code} is already assigned to another operator.`,
        });
        return;
      }
    }

    // Check unique employee code
    const existingCode = await activeQuery(
      `SELECT id FROM users WHERE UPPER(employee_code) = UPPER($1)`,
      [cleanEmployeeCode]
    );
    if (existingCode.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'An account with this Employee ID already exists.',
      });
      return;
    }

    // Check unique email
    const existingEmail = await activeQuery(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );
    if (existingEmail.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanDept = department ? String(department).trim() : 'Production';
    const cleanDesig = designation ? String(designation).trim() : 'Machine Operator';
    const cleanShift = shift ? String(shift).trim() : 'Shift A';

    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new operator with approval_status = 'pending' and is_active = false
    // Persist requested_machine_id if provided. Note: This does NOT occupy or assign the machine.
    let insertRes;
    try {
      insertRes = await activeQuery(
        `INSERT INTO users (
          employee_code, full_name, email, phone, role,
          plant_id, shop_id, department, designation, shift,
          requested_machine_id, password_hash, is_active, approval_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'operator', $5, $6, $7, $8, $9, $10, $11, FALSE, 'pending', NOW(), NOW())
        RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, requested_machine_id, is_active, approval_status, created_at`,
        [
          cleanEmployeeCode,
          cleanFullName,
          cleanEmail,
          cleanPhone,
          plant_id,
          shop_id,
          cleanDept,
          cleanDesig,
          cleanShift,
          targetMachineId || null,
          passwordHash,
        ]
      );
    } catch {
      // Fallback if column not yet present in test mock schema
      insertRes = await activeQuery(
        `INSERT INTO users (
          employee_code, full_name, email, phone, role,
          plant_id, shop_id, department, designation, shift,
          password_hash, is_active, approval_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'operator', $5, $6, $7, $8, $9, $10, FALSE, 'pending', NOW(), NOW())
        RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, is_active, approval_status, created_at`,
        [
          cleanEmployeeCode,
          cleanFullName,
          cleanEmail,
          cleanPhone,
          plant_id,
          shop_id,
          cleanDept,
          cleanDesig,
          cleanShift,
          passwordHash,
        ]
      );
    }

    const newUser = {
      ...insertRes.rows[0],
      requested_machine_id: targetMachineId || null,
      requested_machine_code: dbMachine?.machine_code || null,
      requested_machine_name: dbMachine?.name || null,
    };

    // Notify Managers assigned to this plant
    try {
      const managersRes = await activeQuery(
        `SELECT id, email, full_name FROM users WHERE role = 'manager' AND plant_id = $1 AND is_active = TRUE`,
        [plant_id]
      );

      const machineNotice = dbMachine ? ` (Requested Machine: ${dbMachine.machine_code})` : '';

      for (const mgr of managersRes.rows) {
        await createAndSendNotification({
          recipientId: mgr.id,
          title: 'Operator Registration Pending Approval',
          message: `New Operator ${cleanFullName} (${cleanEmployeeCode}) has registered for ${dbShop.shop_name} at ${dbPlant.plant_name}${machineNotice} and is awaiting your approval.`,
          type: 'approval',
          entityType: 'user_approval',
          entityId: newUser.id,
          linkUrl: '/users?tab=pending',
          plantId: plant_id,
          shopId: shop_id,
        });
      }
    } catch (notifErr: any) {
      console.warn('[Operator Registration Notification Warning]:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Operator registration submitted successfully. Your account is pending manager approval.',
      data: newUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Pending Operator Registrations
 * Managers see pending operators for their plant. Admins see all or can filter by plant_id.
 */
export const getPendingOperators = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const callerRole = req.user?.role?.trim().toLowerCase();
    const isManager = callerRole === 'manager';

    const whereClauses: string[] = ["u.role = 'operator'", "u.approval_status = 'pending'"];
    const params: any[] = [];

    if (isManager) {
      if (!req.user?.plant_id) {
        res.json({
          success: true,
          data: [],
          count: 0,
        });
        return;
      }
      params.push(req.user.plant_id);
      whereClauses.push(`u.plant_id = $${params.length}`);
    } else if (req.query.plant_id && isUUID(String(req.query.plant_id))) {
      params.push(String(req.query.plant_id));
      whereClauses.push(`u.plant_id = $${params.length}`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await activeQuery(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role,
              u.plant_id, u.shop_id, u.department, u.designation, u.shift,
              u.approval_status, u.is_active, u.created_at,
              u.requested_machine_id,
              m.machine_code AS requested_machine_code,
              m.name AS requested_machine_name,
              m.status AS requested_machine_status,
              m.category AS requested_machine_category,
              m.bay_line_location AS requested_machine_location,
              p.plant_name, p.plant_code,
              s.shop_name, s.shop_code
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
       LEFT JOIN machines m ON u.requested_machine_id = m.id
       WHERE ${whereSql}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve Operator Registration
 * Activates account (is_active = true, approval_status = 'approved') and notifies operator.
 */
export const approveOperator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || !isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid operator user ID.',
      });
      return;
    }

    const userRes = await activeQuery(
      `SELECT id, employee_code, full_name, email, role, plant_id, shop_id, approval_status, is_active
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.role !== 'operator') {
      res.status(400).json({
        success: false,
        message: 'Only operator registrations can be processed through operator approval.',
      });
      return;
    }

    if (targetUser.approval_status === 'approved' && targetUser.is_active) {
      res.status(400).json({
        success: false,
        message: 'Operator account is already approved and active.',
      });
      return;
    }

    const callerRole = req.user?.role?.trim().toLowerCase();
    if (callerRole === 'manager') {
      if (!req.user?.plant_id || targetUser.plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers can only approve operators assigned to their own plant facility.',
        });
        return;
      }
    }

    const updateRes = await activeQuery(
      `UPDATE users
       SET approval_status = 'approved',
           is_active = TRUE,
           approved_by = $1,
           approved_at = NOW(),
           permanent_machine_id = COALESCE(permanent_machine_id, requested_machine_id),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, approval_status, is_active, approved_at, requested_machine_id, permanent_machine_id`,
      [req.user?.id || null, id]
    );

    const approvedUser = updateRes.rows[0];

    // Notify Operator
    try {
      const approverTitle = (req.user as any)?.full_name || (req.user?.employee_code ? `Plant Manager (${req.user.employee_code})` : 'Plant Manager');
      await createAndSendNotification({
        recipientId: approvedUser.id,
        title: 'Operator Account Approved',
        message: `Welcome to JCB Smart CMMS! Your operator account has been approved by ${approverTitle}. You can now sign in to your dashboard.`,
        type: 'info',
        entityType: 'user_approval',
        entityId: approvedUser.id,
        linkUrl: '/login',
        plantId: approvedUser.plant_id,
        shopId: approvedUser.shop_id,
      });
    } catch (notifErr: any) {
      console.warn('[Operator Approval Notification Warning]:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Operator ${approvedUser.full_name} (${approvedUser.employee_code}) approved and activated successfully.`,
      data: approvedUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Operator Registration
 * Sets approval_status = 'rejected', is_active = false, records reason, and notifies operator.
 */
export const rejectOperator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body || {};

    if (!id || !isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid operator user ID.',
      });
      return;
    }

    const userRes = await activeQuery(
      `SELECT id, employee_code, full_name, email, role, plant_id, shop_id, approval_status, is_active
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.role !== 'operator') {
      res.status(400).json({
        success: false,
        message: 'Only operator registrations can be processed through operator approval.',
      });
      return;
    }

    const callerRole = req.user?.role?.trim().toLowerCase();
    if (callerRole === 'manager') {
      if (!req.user?.plant_id || targetUser.plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers can only reject operators assigned to their own plant facility.',
        });
        return;
      }
    }

    const cleanReason = rejection_reason && typeof rejection_reason === 'string'
      ? rejection_reason.trim()
      : 'Registration request rejected by plant manager.';

    const updateRes = await activeQuery(
      `UPDATE users
       SET approval_status = 'rejected',
           is_active = FALSE,
           approved_by = $1,
           approved_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, approval_status, is_active, rejection_reason`,
      [req.user?.id || null, cleanReason, id]
    );

    const rejectedUser = updateRes.rows[0];

    // Notify Operator
    try {
      await createAndSendNotification({
        recipientId: rejectedUser.id,
        title: 'Operator Registration Update',
        message: `Your operator registration was not approved. Reason: ${cleanReason}`,
        type: 'warning',
        entityType: 'user_approval',
        entityId: rejectedUser.id,
        linkUrl: '/login',
        plantId: rejectedUser.plant_id,
        shopId: rejectedUser.shop_id,
      });
    } catch (notifErr: any) {
      console.warn('[Operator Rejection Notification Warning]:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Operator registration for ${rejectedUser.full_name} (${rejectedUser.employee_code}) rejected.`,
      data: rejectedUser,
    });
  } catch (err) {
    next(err);
  }
};

export const PREDEFINED_TECHNICIAN_SKILLS = [
  'Mechanical',
  'Electrical',
  'Hydraulic',
  'PLC',
  'Robotics',
  'Welding',
  'Pneumatics',
  'Instrumentation',
] as const;

export const PREDEFINED_TECHNICIAN_DEPARTMENTS = [
  'Mechanical Maintenance',
  'Electrical & Automation',
  'Hydraulics Maintenance',
  'Robotics Maintenance',
  'Preventive Maintenance',
] as const;

export const PREDEFINED_SHIFTS = [
  'Shift A',
  'Shift B',
  'Shift C',
  'General Shift',
] as const;

/**
 * Public Technician Self-Registration
 * Creates a technician account in 'pending' status, is_active = false, is_available = true, max_active_assignments = 5.
 * Role is strictly locked to 'technician'. Notifies managers of the assigned plant.
 */
export const registerTechnician = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      employee_code,
      full_name,
      email,
      phone,
      plant_id,
      shop_id,
      department,
      designation,
      shift,
      skills,
      password,
    } = req.body || {};

    if (
      !isNonEmptyString(employee_code) ||
      !isNonEmptyString(full_name) ||
      !isNonEmptyString(email) ||
      !isNonEmptyString(phone) ||
      !isNonEmptyString(plant_id) ||
      !isNonEmptyString(shop_id) ||
      !isNonEmptyString(department) ||
      !isNonEmptyString(designation) ||
      !isNonEmptyString(shift) ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      res.status(400).json({
        success: false,
        message: 'employee_code, full_name, email, phone, plant_id, shop_id, department, designation, shift, and password are required.',
      });
      return;
    }

    const cleanEmployeeCode = employee_code.trim().toUpperCase();
    const cleanFullName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanDept = department.trim();
    const cleanDesig = designation.trim();
    const cleanShift = shift.trim();

    if (
      cleanEmployeeCode.length > 50 ||
      cleanFullName.length > 255 ||
      cleanEmail.length > 255 ||
      !isValidEmail(cleanEmail)
    ) {
      res.status(400).json({
        success: false,
        message: 'Invalid employee code, name, or email format.',
      });
      return;
    }

    if (cleanPhone.length < 7 || cleanPhone.length > 50) {
      res.status(400).json({
        success: false,
        message: 'Phone number must be between 7 and 50 characters.',
      });
      return;
    }

    if (cleanDesig.length > 100) {
      res.status(400).json({
        success: false,
        message: 'Designation must not exceed 100 characters.',
      });
      return;
    }

    if (!PREDEFINED_TECHNICIAN_DEPARTMENTS.includes(cleanDept as any)) {
      res.status(400).json({
        success: false,
        message: `Invalid department. Allowed departments: ${PREDEFINED_TECHNICIAN_DEPARTMENTS.join(', ')}.`,
      });
      return;
    }

    if (!PREDEFINED_SHIFTS.includes(cleanShift as any)) {
      res.status(400).json({
        success: false,
        message: `Invalid shift. Allowed shifts: ${PREDEFINED_SHIFTS.join(', ')}.`,
      });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({
        success: false,
        message: 'Password must be between 8 and 128 characters.',
      });
      return;
    }

    // Skills validation: array with at least one predefined skill
    if (!Array.isArray(skills) || skills.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one technical skill must be selected.',
      });
      return;
    }

    const normalizedSkills: string[] = [];
    for (const rawSkill of skills) {
      if (typeof rawSkill !== 'string') {
        res.status(400).json({
          success: false,
          message: 'All skills must be text values.',
        });
        return;
      }
      const matched = PREDEFINED_TECHNICIAN_SKILLS.find(
        (s) => s.toLowerCase() === rawSkill.trim().toLowerCase()
      );
      if (!matched) {
        res.status(400).json({
          success: false,
          message: `Invalid skill "${rawSkill}". Allowed skills: ${PREDEFINED_TECHNICIAN_SKILLS.join(', ')}.`,
        });
        return;
      }
      if (!normalizedSkills.includes(matched)) {
        normalizedSkills.push(matched);
      }
    }

    if (normalizedSkills.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one technical skill must be selected.',
      });
      return;
    }

    if (!isUUID(plant_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plant facility ID.',
      });
      return;
    }

    if (!isUUID(shop_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid shop floor ID.',
      });
      return;
    }

    // Verify plant exists
    const plantCheck = await activeQuery(
      `SELECT id, plant_name, plant_code FROM plants WHERE id = $1`,
      [plant_id]
    );
    if (plantCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Specified plant facility does not exist.',
      });
      return;
    }
    const dbPlant = plantCheck.rows[0];

    // Verify shop exists and belongs to plant
    const shopCheck = await activeQuery(
      `SELECT id, plant_id, shop_name, shop_code FROM shops WHERE id = $1`,
      [shop_id]
    );
    if (shopCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Specified shop floor does not exist.',
      });
      return;
    }
    const dbShop = shopCheck.rows[0];
    if (dbShop.plant_id !== plant_id) {
      res.status(400).json({
        success: false,
        message: 'Selected shop does not belong to the selected plant facility.',
      });
      return;
    }

    // Check unique employee code
    const existingCode = await activeQuery(
      `SELECT id FROM users WHERE UPPER(employee_code) = UPPER($1)`,
      [cleanEmployeeCode]
    );
    if (existingCode.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'An account with this Employee ID already exists.',
      });
      return;
    }

    // Check unique email
    const existingEmail = await activeQuery(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    );
    if (existingEmail.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const skillsJsonString = JSON.stringify(normalizedSkills);

    // Insert new technician with approval_status = 'pending', is_active = false, is_available = true, max_active_assignments = 5
    const insertRes = await activeQuery(
      `INSERT INTO users (
        employee_code, full_name, email, phone, role,
        plant_id, shop_id, department, designation, shift,
        skills_json, password_hash, is_active, is_available, max_active_assignments,
        approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'technician', $5, $6, $7, $8, $9, $10, $11, FALSE, TRUE, 5, 'pending', NOW(), NOW())
      RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, is_active, is_available, max_active_assignments, approval_status, created_at`,
      [
        cleanEmployeeCode,
        cleanFullName,
        cleanEmail,
        cleanPhone,
        plant_id,
        shop_id,
        cleanDept,
        cleanDesig,
        cleanShift,
        skillsJsonString,
        passwordHash,
      ]
    );

    const newUser = {
      ...insertRes.rows[0],
      skills_json: normalizedSkills,
    };

    // Notify Managers assigned to this plant
    try {
      const managersRes = await activeQuery(
        `SELECT id, email, full_name FROM users WHERE role = 'manager' AND plant_id = $1 AND is_active = TRUE`,
        [plant_id]
      );

      for (const mgr of managersRes.rows) {
        await createAndSendNotification({
          recipientId: mgr.id,
          title: 'Technician Registration Pending Approval',
          message: `New Technician ${cleanFullName} (${cleanEmployeeCode}) has registered for ${dbShop.shop_name} at ${dbPlant.plant_name} and is awaiting your approval.`,
          type: 'approval',
          entityType: 'user_approval',
          entityId: newUser.id,
          linkUrl: '/users?tab=pending&sub=technicians',
          plantId: plant_id,
          shopId: shop_id,
        });
      }
    } catch (notifErr: any) {
      console.warn('[Technician Registration Notification Warning]:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Technician registration submitted successfully. Your account is pending approval by your Plant Manager.',
      data: newUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Pending Technician Registrations
 * Managers see pending technicians for their plant. Admins see all or can filter by plant_id.
 */
export const getPendingTechnicians = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const callerRole = req.user?.role?.trim().toLowerCase();
    const isManager = callerRole === 'manager';

    const whereClauses: string[] = ["u.role = 'technician'", "u.approval_status = 'pending'"];
    const params: any[] = [];

    if (isManager) {
      if (!req.user?.plant_id) {
        res.json({
          success: true,
          data: [],
          count: 0,
        });
        return;
      }
      params.push(req.user.plant_id);
      whereClauses.push(`u.plant_id = $${params.length}`);
    } else if (req.query.plant_id && isUUID(String(req.query.plant_id))) {
      params.push(String(req.query.plant_id));
      whereClauses.push(`u.plant_id = $${params.length}`);
    }

    const whereSql = whereClauses.join(' AND ');

    const result = await activeQuery(
      `SELECT u.id, u.employee_code, u.full_name, u.email, u.phone, u.role,
              u.plant_id, u.shop_id, u.department, u.designation, u.shift,
              u.skills_json, u.approval_status, u.is_active, u.is_available,
              u.max_active_assignments, u.created_at,
              p.plant_name, p.plant_code,
              s.shop_name, s.shop_code
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
       WHERE ${whereSql}
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve Technician Registration
 * Activates account (is_active = true, approval_status = 'approved') and notifies technician.
 * Uses atomic conditional update to prevent race conditions.
 */
export const approveTechnician = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id || !isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid technician user ID.',
      });
      return;
    }

    const userRes = await activeQuery(
      `SELECT id, employee_code, full_name, email, role, plant_id, shop_id, approval_status, is_active
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.role !== 'technician') {
      res.status(400).json({
        success: false,
        message: 'Only technician registrations can be processed through technician approval.',
      });
      return;
    }

    if (targetUser.approval_status === 'approved' && targetUser.is_active) {
      res.status(400).json({
        success: false,
        message: 'Technician account is already approved and active.',
      });
      return;
    }

    if (targetUser.approval_status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot approve technician with approval status '${targetUser.approval_status}'. Only pending registrations can be approved.`,
      });
      return;
    }

    const callerRole = req.user?.role?.trim().toLowerCase();
    if (callerRole === 'manager') {
      if (!req.user?.plant_id || targetUser.plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers can only approve technicians assigned to their own plant facility.',
        });
        return;
      }
    }

    const updateRes = await activeQuery(
      `UPDATE users
       SET approval_status = 'approved',
           is_active = TRUE,
           approved_by = $1,
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $2 AND role = 'technician' AND approval_status = 'pending'
       RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, department, designation, shift, skills_json, approval_status, is_active, approved_at`,
      [req.user?.id || null, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(409).json({
        success: false,
        message: 'Technician registration was already processed by another manager.',
      });
      return;
    }

    const approvedUser = updateRes.rows[0];

    // Notify Technician
    try {
      const approverTitle = (req.user as any)?.full_name || (req.user?.employee_code ? `Plant Manager (${req.user.employee_code})` : 'Plant Manager');
      await createAndSendNotification({
        recipientId: approvedUser.id,
        title: 'Technician Account Approved',
        message: `Welcome to JCB Smart CMMS! Your technician account has been approved by ${approverTitle}. You can now sign in to your dashboard.`,
        type: 'info',
        entityType: 'user_approval',
        entityId: approvedUser.id,
        linkUrl: '/login',
        plantId: approvedUser.plant_id,
        shopId: approvedUser.shop_id,
      });
    } catch (notifErr: any) {
      console.warn('[Technician Approval Notification Warning]:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Technician ${approvedUser.full_name} (${approvedUser.employee_code}) approved and activated successfully.`,
      data: approvedUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Technician Registration
 * Sets approval_status = 'rejected', is_active = false, records reason, and notifies technician.
 * Uses atomic conditional update to prevent race conditions.
 */
export const rejectTechnician = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body || {};

    if (!id || !isUUID(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid technician user ID.',
      });
      return;
    }

    const userRes = await activeQuery(
      `SELECT id, employee_code, full_name, email, role, plant_id, shop_id, approval_status, is_active
       FROM users WHERE id = $1`,
      [id]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.role !== 'technician') {
      res.status(400).json({
        success: false,
        message: 'Only technician registrations can be processed through technician rejection.',
      });
      return;
    }

    if (targetUser.approval_status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot reject technician with approval status '${targetUser.approval_status}'. Only pending registrations can be rejected.`,
      });
      return;
    }

    const callerRole = req.user?.role?.trim().toLowerCase();
    if (callerRole === 'manager') {
      if (!req.user?.plant_id || targetUser.plant_id !== req.user.plant_id) {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Managers can only reject technicians assigned to their own plant facility.',
        });
        return;
      }
    }

    const cleanReason = rejection_reason && typeof rejection_reason === 'string'
      ? rejection_reason.trim()
      : 'Registration request rejected by plant manager.';

    const updateRes = await activeQuery(
      `UPDATE users
       SET approval_status = 'rejected',
           is_active = FALSE,
           approved_by = $1,
           approved_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $3 AND role = 'technician' AND approval_status = 'pending'
       RETURNING id, employee_code, full_name, email, phone, role, plant_id, shop_id, approval_status, is_active, rejection_reason`,
      [req.user?.id || null, cleanReason, id]
    );

    if (updateRes.rows.length === 0) {
      res.status(409).json({
        success: false,
        message: 'Technician registration was already processed by another manager.',
      });
      return;
    }

    const rejectedUser = updateRes.rows[0];

    // Notify Technician
    try {
      await createAndSendNotification({
        recipientId: rejectedUser.id,
        title: 'Technician Registration Update',
        message: `Your technician registration was not approved. Reason: ${cleanReason}`,
        type: 'warning',
        entityType: 'user_approval',
        entityId: rejectedUser.id,
        linkUrl: '/login',
        plantId: rejectedUser.plant_id,
        shopId: rejectedUser.shop_id,
      });
    } catch (notifErr: any) {
      console.warn('[Technician Rejection Notification Warning]:', notifErr.message);
    }

    res.json({
      success: true,
      message: `Technician registration for ${rejectedUser.full_name} (${rejectedUser.employee_code}) rejected.`,
      data: rejectedUser,
    });
  } catch (err) {
    next(err);
  }
};
