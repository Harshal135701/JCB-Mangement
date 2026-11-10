import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { query as defaultQuery, pool as defaultPool } from '../../config/db';
import { config } from '../../config/env';

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
              password_hash, is_active
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

    // Reject inactive accounts with consistent 401 response
    if (!dbUser.is_active) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials or inactive account.',
      });
      return;
    }

    // Password verification using bcrypt
    const isMatch = await bcrypt.compare(password, dbUser.password_hash);

    if (!isMatch) {
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
              p.plant_name, s.shop_name
       FROM users u
       LEFT JOIN plants p ON u.plant_id = p.id
       LEFT JOIN shops s ON u.shop_id = s.id
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
    }

    if (isActiveFilter !== undefined) {
      params.push(isActiveFilter);
      whereClauses.push(`is_active = $${params.length}`);
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

    if (plant_id != null && !isUUID(plant_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plant ID.',
      });
      return;
    }

    if (shop_id != null && !isUUID(shop_id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid shop ID.',
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

    // Verify plant exists if plant_id is provided
    if (plant_id != null) {
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
    }

    // Verify shop exists and belongs to the selected plant
    if (shop_id != null) {
      const shopResult = await activeQuery(
        `SELECT id, plant_id FROM shops WHERE id = $1`,
        [shop_id]
      );

      if (shopResult.rows.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Selected shop does not exist.',
        });
        return;
      }

      const dbShop = shopResult.rows[0];
      if (!plant_id || dbShop.plant_id !== plant_id) {
        res.status(400).json({
          success: false,
          message: 'Selected shop does not belong to the selected plant.',
        });
        return;
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
        plant_id || null,
        shop_id || null,
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
