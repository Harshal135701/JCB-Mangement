// Set safe mock test environment variables prior to module imports to prevent live database connections
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mock_cmms_test_user:mock_password@localhost:5432/mock_cmms_db';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'mock_test_jwt_secret_32_chars_long_key_strictly_for_unit_tests';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'mock_test_refresh_token_secret_32_chars_unit_test';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  login,
  refreshToken,
  getProfile,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  setAuthDb,
  resetAuthDb,
  signAccessToken,
  signRefreshToken,
  isUUID,
  VALID_ROLES,
  DbClientLike,
  DbPoolLike,
} from './auth.controller';
import {
  authenticateJWT,
  setAuthMiddlewareDb,
  resetAuthMiddlewareDb,
  AuthenticatedUser,
} from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { config } from '../../config/env';

/**
 * Mock Response Interface & Context Factory
 */
interface MockResponse {
  statusCode: number;
  responseData: any;
  headers: Record<string, any>;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: any): MockResponse;
  on(event: string, cb: () => void): void;
}

function createMockContext(
  body: any = {},
  params: any = {},
  query: any = {},
  headers: Record<string, string> = {},
  user?: AuthenticatedUser
): {
  req: Request;
  res: Response & MockResponse;
  next: NextFunction;
} {
  const req = {
    body,
    params,
    query,
    headers,
    user,
  } as unknown as Request;

  const mockRes: MockResponse = {
    statusCode: 200,
    responseData: null,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.responseData = data;
      return this;
    },
    setHeader(name: string, value: any) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    on(_event: string, _cb: () => void) {},
  };

  const res = mockRes as unknown as Response & MockResponse;

  const next = ((err?: any) => {
    if (err) {
      res.statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
      res.responseData = { success: false, message: err.message };
    }
  }) as NextFunction;

  return { req, res, next };
}

/**
 * In-memory Mock Database for Unit & Concurrency Testing
 */
interface MockUser {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  plant_id: string | null;
  shop_id: string | null;
  department: string | null;
  designation: string | null;
  shift: string | null;
  password_hash: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MockPlant {
  id: string;
  plant_code: string;
  plant_name: string;
}

interface MockShop {
  id: string;
  plant_id: string;
  shop_code: string;
  shop_name: string;
}

class MockAuthDatabase {
  public users: Map<string, MockUser> = new Map();
  public plants: Map<string, MockPlant> = new Map();
  public shops: Map<string, MockShop> = new Map();
  public queryLog: { text: string; params?: any[] }[] = [];

  constructor() {
    this.seed();
  }

  public seed(): void {
    this.users.clear();
    this.plants.clear();
    this.shops.clear();
    this.queryLog = [];

    // Plants
    const plant1: MockPlant = {
      id: 'b0000000-0000-0000-0000-000000000001',
      plant_code: 'PLANT-BALLABGARH',
      plant_name: 'Ballabgarh Central Works',
    };
    const plant2: MockPlant = {
      id: 'b0000000-0000-0000-0000-000000000002',
      plant_code: 'PLANT-PUNE',
      plant_name: 'Pune Heavy Machinery',
    };
    this.plants.set(plant1.id, plant1);
    this.plants.set(plant2.id, plant2);

    // Shops
    const shop1: MockShop = {
      id: 'c0000000-0000-0000-0000-000000000001',
      plant_id: plant1.id,
      shop_code: 'SHOP-FAB-01',
      shop_name: 'Fabrication Shop',
    };
    const shop2: MockShop = {
      id: 'c0000000-0000-0000-0000-000000000002',
      plant_id: plant2.id,
      shop_code: 'SHOP-ASSY-02',
      shop_name: 'Assembly Shop Pune',
    };
    this.shops.set(shop1.id, shop1);
    this.shops.set(shop2.id, shop2);

    // Known hashed password for testing: 'ValidPassword123!'
    // Pre-computed bcrypt hash of 'ValidPassword123!' with 10 rounds
    const knownHash = bcrypt.hashSync('ValidPassword123!', 10);

    const adminUser: MockUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      full_name: 'Administrator Chief',
      email: 'admin@jcb.com',
      phone: '+91 9876543210',
      role: 'admin',
      plant_id: plant1.id,
      shop_id: null,
      department: 'Corporate Maintenance',
      designation: 'General Maintenance Manager',
      shift: 'Shift A',
      password_hash: knownHash,
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    };

    const managerUser: MockUser = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      full_name: 'Suresh Plant Manager',
      email: 'manager@jcb.com',
      phone: '+91 9876543211',
      role: 'manager',
      plant_id: plant1.id,
      shop_id: shop1.id,
      department: 'Fabrication',
      designation: 'Shop Manager',
      shift: 'Shift A',
      password_hash: knownHash,
      is_active: true,
      created_at: new Date('2026-01-02T00:00:00Z'),
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };

    const technicianUser: MockUser = {
      id: 'f0000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-TCH-001',
      full_name: 'Anil Senior Technician',
      email: 'technician@jcb.com',
      phone: '+91 9876543212',
      role: 'technician',
      plant_id: plant1.id,
      shop_id: shop1.id,
      department: 'Fabrication',
      designation: 'Hydraulic Specialist',
      shift: 'Shift B',
      password_hash: knownHash,
      is_active: true,
      created_at: new Date('2026-01-03T00:00:00Z'),
      updated_at: new Date('2026-01-03T00:00:00Z'),
    };

    const inactiveUser: MockUser = {
      id: 'f0000000-0000-0000-0000-000000000099',
      employee_code: 'EMP-INA-099',
      full_name: 'Inactive Former Employee',
      email: 'inactive@jcb.com',
      phone: '+91 9876543299',
      role: 'operator',
      plant_id: plant1.id,
      shop_id: shop1.id,
      department: 'Fabrication',
      designation: 'Former Operator',
      shift: 'Shift A',
      password_hash: knownHash,
      is_active: false,
      created_at: new Date('2026-01-04T00:00:00Z'),
      updated_at: new Date('2026-01-04T00:00:00Z'),
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(managerUser.id, managerUser);
    this.users.set(technicianUser.id, technicianUser);
    this.users.set(inactiveUser.id, inactiveUser);
  }

  public async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.queryLog.push({ text: text.trim(), params });
    const trimmed = text.trim();

    // 1. Login query
    if (trimmed.includes('WHERE LOWER(email) = LOWER($1)')) {
      const identifier = String(params[0] || '').trim();
      const match = Array.from(this.users.values()).find(
        (u) =>
          u.email.toLowerCase() === identifier.toLowerCase() ||
          u.employee_code.toUpperCase() === identifier.toUpperCase()
      );
      return {
        rows: match ? [{ ...match }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    // 2. Fetch user by ID (for token verification, update lookup, delete lookup)
    if (trimmed.startsWith('SELECT') && trimmed.includes('FROM users') && trimmed.includes('WHERE id = $1')) {
      const userId = params[0];
      const match = this.users.get(userId);
      return {
        rows: match ? [{ ...match }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    // 3. User profile with JOIN plants and shops
    if (trimmed.includes('FROM users u') && trimmed.includes('LEFT JOIN plants p')) {
      const userId = params[0];
      const match = this.users.get(userId);
      if (!match || !match.is_active) {
        return { rows: [], rowCount: 0 };
      }
      const plant = match.plant_id ? this.plants.get(match.plant_id) : undefined;
      const shop = match.shop_id ? this.shops.get(match.shop_id) : undefined;
      return {
        rows: [
          {
            id: match.id,
            employee_code: match.employee_code,
            full_name: match.full_name,
            email: match.email,
            phone: match.phone,
            role: match.role,
            department: match.department,
            designation: match.designation,
            shift: match.shift,
            plant_id: match.plant_id,
            shop_id: match.shop_id,
            is_active: match.is_active,
            plant_name: plant?.plant_name ?? null,
            shop_name: shop?.shop_name ?? null,
          },
        ],
        rowCount: 1,
      };
    }

    // 4. Plant lookup
    if (trimmed.startsWith('SELECT id FROM plants WHERE id = $1')) {
      const plantId = params[0];
      const plant = this.plants.get(plantId);
      return {
        rows: plant ? [{ id: plant.id }] : [],
        rowCount: plant ? 1 : 0,
      };
    }

    // 5. Shop lookup
    if (trimmed.includes('FROM shops WHERE id = $1')) {
      const shopId = params[0];
      const shop = this.shops.get(shopId);
      return {
        rows: shop ? [{ id: shop.id, plant_id: shop.plant_id }] : [],
        rowCount: shop ? 1 : 0,
      };
    }

    // 6. Admin count / Lock query
    if (trimmed.includes("FROM users WHERE role = 'admin' AND is_active = TRUE")) {
      const activeAdmins = Array.from(this.users.values()).filter(
        (u) => u.role === 'admin' && u.is_active === true
      );
      if (trimmed.includes('COUNT(*)')) {
        return {
          rows: [{ count: activeAdmins.length, total: activeAdmins.length }],
          rowCount: 1,
        };
      }
      return {
        rows: activeAdmins.map((a) => ({ id: a.id })),
        rowCount: activeAdmins.length,
      };
    }

    // 7. Users count query with filters
    if (trimmed.startsWith('SELECT COUNT(*)::int AS total FROM users')) {
      let filtered = Array.from(this.users.values());

      let paramIdx = 0;
      if (trimmed.includes('ILIKE')) {
        const rawSearch = String(params[paramIdx++] || '')
          .replace(/%/g, '')
          .toLowerCase();
        filtered = filtered.filter(
          (u) =>
            u.full_name.toLowerCase().includes(rawSearch) ||
            u.employee_code.toLowerCase().includes(rawSearch) ||
            u.email.toLowerCase().includes(rawSearch)
        );
      }
      if (trimmed.includes('role = $')) {
        const roleVal = String(params[paramIdx++] || '').toLowerCase();
        filtered = filtered.filter((u) => u.role.toLowerCase() === roleVal);
      }
      if (trimmed.includes('is_active = $')) {
        const activeVal = Boolean(params[paramIdx++]);
        filtered = filtered.filter((u) => u.is_active === activeVal);
      }

      return {
        rows: [{ total: filtered.length }],
        rowCount: 1,
      };
    }

    // 8. Users list query with filters, ordering, pagination
    if (trimmed.startsWith('SELECT id, employee_code, full_name, email, phone, role') && trimmed.includes('FROM users')) {
      let filtered = Array.from(this.users.values()).sort(
        (a, b) => b.created_at.getTime() - a.created_at.getTime()
      );

      let paramIdx = 0;
      if (trimmed.includes('ILIKE')) {
        const rawSearch = String(params[paramIdx++] || '')
          .replace(/%/g, '')
          .toLowerCase();
        filtered = filtered.filter(
          (u) =>
            u.full_name.toLowerCase().includes(rawSearch) ||
            u.employee_code.toLowerCase().includes(rawSearch) ||
            u.email.toLowerCase().includes(rawSearch)
        );
      }
      if (trimmed.includes('role = $')) {
        const roleVal = String(params[paramIdx++] || '').toLowerCase();
        filtered = filtered.filter((u) => u.role.toLowerCase() === roleVal);
      }
      if (trimmed.includes('is_active = $')) {
        const activeVal = Boolean(params[paramIdx++]);
        filtered = filtered.filter((u) => u.is_active === activeVal);
      }

      const limit = params[params.length - 2] || 50;
      const offset = params[params.length - 1] || 0;
      const paginated = filtered.slice(offset, offset + limit);

      return {
        rows: paginated.map((u) => {
          const { password_hash, ...safeUser } = u;
          return safeUser;
        }),
        rowCount: paginated.length,
      };
    }

    // 9. INSERT INTO users
    if (trimmed.startsWith('INSERT INTO users')) {
      const [
        employee_code,
        full_name,
        email,
        phone,
        role,
        plant_id,
        shop_id,
        department,
        designation,
        shift,
        password_hash,
      ] = params;

      // Unique constraint check
      for (const u of this.users.values()) {
        if (
          u.employee_code.toUpperCase() === employee_code.toUpperCase() ||
          u.email.toLowerCase() === email.toLowerCase()
        ) {
          const err: any = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
      }

      const newId = `f0000000-0000-0000-0000-${String(this.users.size + 1).padStart(12, '0')}`;
      const newUser: MockUser = {
        id: newId,
        employee_code,
        full_name,
        email,
        phone,
        role,
        plant_id,
        shop_id,
        department,
        designation,
        shift,
        password_hash,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.users.set(newId, newUser);

      const { password_hash: _h, ...safeUser } = newUser;
      return {
        rows: [safeUser],
        rowCount: 1,
      };
    }

    // 10. UPDATE users (general update)
    if (trimmed.startsWith('UPDATE users') && trimmed.includes('SET full_name = CASE WHEN $1::boolean')) {
      const [
        nameProvided,
        nameVal,
        phoneProvided,
        phoneVal,
        roleProvided,
        roleVal,
        plantProvided,
        plantVal,
        shopProvided,
        shopVal,
        deptProvided,
        deptVal,
        desigProvided,
        desigVal,
        shiftProvided,
        shiftVal,
        activeProvided,
        activeVal,
        id,
      ] = params;

      const user = this.users.get(id);
      if (!user) {
        return { rows: [], rowCount: 0 };
      }

      if (nameProvided) user.full_name = nameVal;
      if (phoneProvided) user.phone = phoneVal;
      if (roleProvided) user.role = roleVal;
      if (plantProvided) user.plant_id = plantVal;
      if (shopProvided) user.shop_id = shopVal;
      if (deptProvided) user.department = deptVal;
      if (desigProvided) user.designation = desigVal;
      if (shiftProvided) user.shift = shiftVal;
      if (activeProvided) user.is_active = activeVal;
      user.updated_at = new Date();

      const { password_hash, ...safeUser } = user;
      return {
        rows: [safeUser],
        rowCount: 1,
      };
    }

    // 11. Soft delete update
    if (trimmed.startsWith('UPDATE users') && trimmed.includes('SET is_active = FALSE')) {
      const id = params[0];
      const user = this.users.get(id);
      if (!user) {
        return { rows: [], rowCount: 0 };
      }
      user.is_active = false;
      user.updated_at = new Date();

      return {
        rows: [
          {
            id: user.id,
            employee_code: user.employee_code,
            full_name: user.full_name,
            is_active: user.is_active,
          },
        ],
        rowCount: 1,
      };
    }

    // Fallback
    return { rows: [], rowCount: 0 };
  }

  public getPool(): DbPoolLike {
    const self = this;
    return {
      async connect(): Promise<DbClientLike> {
        return {
          async query(text: string, params: any[] = []) {
            if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
              return { rows: [], rowCount: 0 };
            }
            return self.query(text, params);
          },
          release() {},
        };
      },
    };
  }
}

describe('Authentication & User Governance Module (CMMS Module 0)', () => {
  let mockDb: MockAuthDatabase;

  beforeEach(() => {
    mockDb = new MockAuthDatabase();
    setAuthDb(mockDb.query.bind(mockDb), mockDb.getPool());
    setAuthMiddlewareDb(mockDb.query.bind(mockDb));
  });

  // ==========================================
  // SECTION A: LOGIN
  // ==========================================
  describe('A. Login Endpoint (POST /login)', () => {
    it('1. Successful login with employee ID returns valid JWTs and sanitized user details', async () => {
      const ctx = createMockContext({
        identifier: 'EMP-ADM-001',
        password: 'ValidPassword123!',
      });

      await login(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.message, 'Login successful.');
      assert.ok(typeof ctx.res.responseData.data.token === 'string');
      assert.ok(typeof ctx.res.responseData.data.refreshToken === 'string');

      const user = ctx.res.responseData.data.user;
      assert.equal(user.employeeCode, 'EMP-ADM-001');
      assert.equal(user.email, 'admin@jcb.com');
      assert.equal(user.role, 'admin');
      assert.equal(user.password_hash, undefined);
      assert.equal(user.password, undefined);

      // Verify access token claims
      const decoded: any = jwt.verify(
        ctx.res.responseData.data.token,
        config.jwtSecret
      );
      assert.equal(decoded.employee_code, 'EMP-ADM-001');
      assert.equal(decoded.role, 'admin');
    });

    it('2. Successful login with email address (case-insensitive) returns valid JWTs', async () => {
      const ctx = createMockContext({
        identifier: 'ADMIN@JCB.COM',
        password: 'ValidPassword123!',
      });

      await login(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.user.email, 'admin@jcb.com');
    });

    it('3. Incorrect password returns HTTP 401 Unauthorized without disclosing credentials', async () => {
      const ctx = createMockContext({
        identifier: 'EMP-ADM-001',
        password: 'WrongPassword999!',
      });

      await login(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 401);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(
        ctx.res.responseData.message,
        'Invalid credentials or inactive account.'
      );
    });

    it('4. Invalid employee ID / nonexistent email returns HTTP 401 Unauthorized', async () => {
      const ctx = createMockContext({
        identifier: 'NONEXISTENT-EMP-999',
        password: 'ValidPassword123!',
      });

      await login(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 401);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(
        ctx.res.responseData.message,
        'Invalid credentials or inactive account.'
      );
    });

    it('5. Inactive account login attempt returns HTTP 401 Unauthorized', async () => {
      const ctx = createMockContext({
        identifier: 'EMP-INA-099',
        password: 'ValidPassword123!',
      });

      await login(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 401);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(
        ctx.res.responseData.message,
        'Invalid credentials or inactive account.'
      );
    });

    it('6. Missing and malformed login fields return HTTP 400 Bad Request', async () => {
      // Empty identifier
      const ctx1 = createMockContext({ identifier: '   ', password: 'ValidPassword123!' });
      await login(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);

      // Missing password
      const ctx2 = createMockContext({ identifier: 'EMP-ADM-001' });
      await login(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);

      // Null body
      const ctx3 = createMockContext(null);
      await login(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 400);

      // Password exceeding 128 characters
      const ctx4 = createMockContext({
        identifier: 'EMP-ADM-001',
        password: 'a'.repeat(129),
      });
      await login(ctx4.req, ctx4.res, ctx4.next);
      assert.equal(ctx4.res.statusCode, 400);

      // Identifier exceeding 255 characters
      const ctx5 = createMockContext({
        identifier: 'a'.repeat(256),
        password: 'ValidPassword123!',
      });
      await login(ctx5.req, ctx5.res, ctx5.next);
      assert.equal(ctx5.res.statusCode, 400);
      assert.equal(ctx5.res.responseData.message, 'Invalid login identifier.');
    });
  });

  // ==========================================
  // SECTION B: REFRESH TOKEN
  // ==========================================
  describe('B. Refresh Token Endpoint (POST /refresh-token)', () => {
    it('7. Successful refresh issues new access token and rotated refresh token', async () => {
      const validRefreshToken = signRefreshToken('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({ refreshToken: validRefreshToken });
      await refreshToken(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(typeof ctx.res.responseData.data.token === 'string');
      assert.ok(typeof ctx.res.responseData.data.refreshToken === 'string');

      // Verify token type of rotated refresh token
      const decodedRefresh: any = jwt.verify(
        ctx.res.responseData.data.refreshToken,
        config.refreshTokenSecret
      );
      assert.equal(decodedRefresh.tokenType, 'refresh');
      assert.equal(decodedRefresh.id, 'f0000000-0000-0000-0000-000000000001');
    });

    it('8. Invalid, malformed and expired refresh tokens return HTTP 401 Unauthorized', async () => {
      // Empty token
      const ctx1 = createMockContext({ refreshToken: '' });
      await refreshToken(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);

      // Malformed token string
      const ctx2 = createMockContext({ refreshToken: 'malformed.garbage.token' });
      await refreshToken(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 401);

      // Token signed with wrong secret (e.g. jwtSecret instead of refreshTokenSecret)
      const wrongSecretToken = jwt.sign(
        { id: 'f0000000-0000-0000-0000-000000000001', tokenType: 'refresh' },
        config.jwtSecret
      );
      const ctx3 = createMockContext({ refreshToken: wrongSecretToken });
      await refreshToken(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 401);

      // Expired refresh token
      const expiredToken = jwt.sign(
        { id: 'f0000000-0000-0000-0000-000000000001', tokenType: 'refresh' },
        config.refreshTokenSecret,
        { expiresIn: '-1s' }
      );
      const ctx4 = createMockContext({ refreshToken: expiredToken });
      await refreshToken(ctx4.req, ctx4.res, ctx4.next);
      assert.equal(ctx4.res.statusCode, 401);

      // Wrong tokenType claim (access token used as refresh token)
      const accessTokenUsedAsRefresh = jwt.sign(
        { id: 'f0000000-0000-0000-0000-000000000001', role: 'admin' },
        config.refreshTokenSecret
      );
      const ctx5 = createMockContext({ refreshToken: accessTokenUsedAsRefresh });
      await refreshToken(ctx5.req, ctx5.res, ctx5.next);
      assert.equal(ctx5.res.statusCode, 401);
    });

    it('9. Refresh token belonging to inactive user returns HTTP 401 Unauthorized', async () => {
      // User 'f0000000-0000-0000-0000-000000000099' is seeded as is_active = false
      const inactiveUserRefreshToken = signRefreshToken(
        'f0000000-0000-0000-0000-000000000099'
      );

      const ctx = createMockContext({ refreshToken: inactiveUserRefreshToken });
      await refreshToken(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 401);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(
        ctx.res.responseData.message,
        'Invalid session or inactive account.'
      );
    });
  });

  // ==========================================
  // SECTION C: USER PROFILE
  // ==========================================
  describe('C. User Profile Endpoint (GET /profile)', () => {
    it('10. Successful profile retrieval returns employee details with plant and shop metadata', async () => {
      const userContext: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
      };

      const ctx = createMockContext({}, {}, {}, {}, userContext);
      await getProfile(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      const data = ctx.res.responseData.data;
      assert.equal(data.employee_code, 'EMP-MGR-001');
      assert.equal(data.full_name, 'Suresh Plant Manager');
      assert.equal(data.plant_name, 'Ballabgarh Central Works');
      assert.equal(data.shop_name, 'Fabrication Shop');
      assert.equal(data.password_hash, undefined);
    });

    it('11. Unauthenticated profile request without valid session returns HTTP 401', async () => {
      const ctx = createMockContext(); // req.user undefined
      await getProfile(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 401);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(ctx.res.responseData.message, 'Authentication required.');
    });
  });

  // ==========================================
  // SECTION D: LIST USERS & FILTERS
  // ==========================================
  describe('D. List Users (GET /users)', () => {
    it('12. Admin user listing retrieves paginated active and inactive users without password hashes', async () => {
      const adminContext: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-001',
        email: 'admin@jcb.com',
        role: 'admin',
      };

      const ctx = createMockContext({}, {}, { page: '1', limit: '10' }, {}, adminContext);
      await getUsers(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(Array.isArray(ctx.res.responseData.data), true);
      assert.equal(ctx.res.responseData.pagination.total, 4);
      assert.equal(ctx.res.responseData.pagination.page, 1);
      assert.equal(ctx.res.responseData.pagination.limit, 10);
      assert.equal(ctx.res.responseData.pagination.totalPages, 1);

      // Verify no password hashes are exposed
      for (const u of ctx.res.responseData.data) {
        assert.equal(u.password_hash, undefined);
      }
    });

    it('13. Pagination and search/filter parameters are strictly validated and applied', async () => {
      const adminContext: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-001',
        email: 'admin@jcb.com',
        role: 'admin',
      };

      // Invalid page: not a positive integer
      const ctxInvalidPage = createMockContext({}, {}, { page: '-1' }, {}, adminContext);
      await getUsers(ctxInvalidPage.req, ctxInvalidPage.res, ctxInvalidPage.next);
      assert.equal(ctxInvalidPage.res.statusCode, 400);

      // Invalid limit: exceeds 100
      const ctxInvalidLimit = createMockContext({}, {}, { limit: '150' }, {}, adminContext);
      await getUsers(ctxInvalidLimit.req, ctxInvalidLimit.res, ctxInvalidLimit.next);
      assert.equal(ctxInvalidLimit.res.statusCode, 400);

      // Invalid role filter
      const ctxInvalidRole = createMockContext({}, {}, { role: 'superadmin' }, {}, adminContext);
      await getUsers(ctxInvalidRole.req, ctxInvalidRole.res, ctxInvalidRole.next);
      assert.equal(ctxInvalidRole.res.statusCode, 400);

      // Invalid status filter
      const ctxInvalidStatus = createMockContext({}, {}, { status: 'suspended' }, {}, adminContext);
      await getUsers(ctxInvalidStatus.req, ctxInvalidStatus.res, ctxInvalidStatus.next);
      assert.equal(ctxInvalidStatus.res.statusCode, 400);

      // Search filter by technician name
      const ctxSearch = createMockContext({}, {}, { search: 'Anil' }, {}, adminContext);
      await getUsers(ctxSearch.req, ctxSearch.res, ctxSearch.next);
      assert.equal(ctxSearch.res.statusCode, 200);
      assert.equal(ctxSearch.res.responseData.data.length, 1);
      assert.equal(ctxSearch.res.responseData.data[0].employee_code, 'EMP-TCH-001');

      // Role filter for technician
      const ctxRole = createMockContext({}, {}, { role: 'technician' }, {}, adminContext);
      await getUsers(ctxRole.req, ctxRole.res, ctxRole.next);
      assert.equal(ctxRole.res.statusCode, 200);
      assert.equal(ctxRole.res.responseData.data.length, 1);
      assert.equal(ctxRole.res.responseData.data[0].role, 'technician');

      // Active status filter for inactive accounts
      const ctxInactive = createMockContext({}, {}, { status: 'inactive' }, {}, adminContext);
      await getUsers(ctxInactive.req, ctxInactive.res, ctxInactive.next);
      assert.equal(ctxInactive.res.statusCode, 200);
      assert.equal(ctxInactive.res.responseData.data.length, 1);
      assert.equal(ctxInactive.res.responseData.data[0].employee_code, 'EMP-INA-099');
    });

    it('14. Non-admin access rejection: requireRoles blocks technician and operator with HTTP 403', () => {
      const rbacAdminGuard = requireRoles('admin');

      // Operator request
      const ctxOp = createMockContext({}, {}, {}, {}, {
        id: 'f0000000-0000-0000-0000-000000000004',
        employee_code: 'EMP-OPR-001',
        email: 'operator@jcb.com',
        role: 'operator',
      });
      rbacAdminGuard(ctxOp.req, ctxOp.res, ctxOp.next);
      assert.equal(ctxOp.res.statusCode, 403);
      assert.equal(
        ctxOp.res.responseData.message,
        'You do not have permission to perform this action.'
      );

      // Technician request
      const ctxTech = createMockContext({}, {}, {}, {}, {
        id: 'f0000000-0000-0000-0000-000000000003',
        employee_code: 'EMP-TCH-001',
        email: 'technician@jcb.com',
        role: 'technician',
      });
      rbacAdminGuard(ctxTech.req, ctxTech.res, ctxTech.next);
      assert.equal(ctxTech.res.statusCode, 403);

      // Unauthenticated request
      const ctxUnauth = createMockContext();
      rbacAdminGuard(ctxUnauth.req, ctxUnauth.res, ctxUnauth.next);
      assert.equal(ctxUnauth.res.statusCode, 401);
    });
  });

  // ==========================================
  // SECTION E: CREATE USER
  // ==========================================
  describe('E. Create User (POST /users)', () => {
    it('15. Successful user creation hashes password with bcrypt and normalizes employee code', async () => {
      const payload = {
        employee_code: '  emp-tch-002  ',
        full_name: 'Rajesh Sharma',
        email: '  RAJESH.TECH@JCB.COM  ',
        phone: '+91 9988776655',
        role: 'technician',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        department: 'Assembly',
        designation: 'Senior Electrician',
        shift: 'Shift A',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      const created = ctx.res.responseData.data;
      assert.equal(created.employee_code, 'EMP-TCH-002'); // normalized upper-case
      assert.equal(created.email, 'rajesh.tech@jcb.com'); // normalized lower-case
      assert.equal(created.full_name, 'Rajesh Sharma');
      assert.equal(created.password_hash, undefined);

      // Verify stored record in database has a valid bcrypt hash
      const stored = mockDb.users.get(created.id);
      assert.ok(stored);
      assert.ok(stored.password_hash.startsWith('$2'));
      const matches = await bcrypt.compare('ValidPassword123!', stored.password_hash);
      assert.equal(matches, true);
    });

    it('16. Duplicate employee code or email returns HTTP 409 Conflict', async () => {
      // Existing employee code: EMP-ADM-001
      const payloadDupCode = {
        employee_code: 'EMP-ADM-001',
        full_name: 'Duplicate Admin',
        email: 'unique.email@jcb.com',
        password: 'ValidPassword123!',
      };
      const ctx1 = createMockContext(payloadDupCode);
      await createUser(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 409);
      assert.equal(
        ctx1.res.responseData.message,
        'Employee Code or Email already exists.'
      );

      // Existing email: admin@jcb.com
      const payloadDupEmail = {
        employee_code: 'EMP-NEW-999',
        full_name: 'Duplicate Email User',
        email: 'ADMIN@jcb.com',
        password: 'ValidPassword123!',
      };
      const ctx2 = createMockContext(payloadDupEmail);
      await createUser(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 409);
    });

    it('17. Invalid role and malformed UUIDs return HTTP 400 Bad Request', async () => {
      // Invalid role
      const ctxRole = createMockContext({
        employee_code: 'EMP-VAL-001',
        full_name: 'Role Test',
        email: 'role.test@jcb.com',
        role: 'superadmin',
        password: 'ValidPassword123!',
      });
      await createUser(ctxRole.req, ctxRole.res, ctxRole.next);
      assert.equal(ctxRole.res.statusCode, 400);
      assert.equal(ctxRole.res.responseData.message, 'Invalid user role.');

      // Malformed plant_id
      const ctxPlant = createMockContext({
        employee_code: 'EMP-VAL-002',
        full_name: 'Plant UUID Test',
        email: 'plant.test@jcb.com',
        plant_id: 'not-a-valid-uuid',
        password: 'ValidPassword123!',
      });
      await createUser(ctxPlant.req, ctxPlant.res, ctxPlant.next);
      assert.equal(ctxPlant.res.statusCode, 400);
      assert.equal(ctxPlant.res.responseData.message, 'Invalid plant ID.');

      // Password too short (< 12 chars)
      const ctxShortPass = createMockContext({
        employee_code: 'EMP-VAL-003',
        full_name: 'Pass Test',
        email: 'pass.test@jcb.com',
        password: 'short',
      });
      await createUser(ctxShortPass.req, ctxShortPass.res, ctxShortPass.next);
      assert.equal(ctxShortPass.res.statusCode, 400);
      assert.equal(
        ctxShortPass.res.responseData.message,
        'Password must contain between 12 and 128 characters.'
      );
    });

    it('18. Invalid plant/shop relationship: shop from different plant is rejected with HTTP 400', async () => {
      // shop2 belongs to plant2, but plant1 is selected
      const payload = {
        employee_code: 'EMP-MIS-001',
        full_name: 'Mismatch User',
        email: 'mismatch@jcb.com',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // plant1
        shop_id: 'c0000000-0000-0000-0000-000000000002', // shop2 (plant2)
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(
        ctx.res.responseData.message,
        'Selected shop does not belong to the selected plant.'
      );
    });

    it('19. Null shift handling during creation does not trigger shift.trim() TypeError', async () => {
      // shift is explicitly supplied as null
      const payload = {
        employee_code: 'EMP-NULL-001',
        full_name: 'Null Shift User',
        email: 'nullshift@jcb.com',
        shift: null,
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload);
      // Must not throw unhandled TypeError: Cannot read properties of null (reading 'trim')
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      const created = ctx.res.responseData.data;
      assert.equal(created.shift, null);
    });
  });

  // ==========================================
  // SECTION F: UPDATE USER
  // ==========================================
  describe('F. Update User (PUT /users/:id)', () => {
    const adminUserContext: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    it('20. Successful user update modifies allowed fields and returns updated user', async () => {
      const targetUserId = 'f0000000-0000-0000-0000-000000000003'; // technician
      const ctx = createMockContext(
        {
          full_name: 'Anil Senior Specialist Updated',
          phone: '+91 9900011122',
          shift: 'Shift C',
        },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );

      await updateUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.full_name, 'Anil Senior Specialist Updated');
      assert.equal(ctx.res.responseData.data.phone, '+91 9900011122');
      assert.equal(ctx.res.responseData.data.shift, 'Shift C');
      assert.equal(ctx.res.responseData.data.password_hash, undefined);
    });

    it('21. Null and omitted field handling correctly clears nullable fields while preserving omitted fields', async () => {
      const targetUserId = 'f0000000-0000-0000-0000-000000000003';

      // Explicitly send phone: null and shift: null, while omitting full_name and department
      const ctx = createMockContext(
        {
          phone: null,
          shift: null,
        },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );

      await updateUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      const updated = ctx.res.responseData.data;
      assert.equal(updated.phone, null); // Cleared to null
      assert.equal(updated.shift, null); // Cleared to null
      assert.ok(updated.full_name.length > 0); // Omitted field preserved!
    });

    it('22. Invalid update fields and prohibited body structures are rejected with HTTP 400', async () => {
      const targetUserId = 'f0000000-0000-0000-0000-000000000003';

      // Empty update body
      const ctxEmpty = createMockContext({}, { id: targetUserId }, {}, {}, adminUserContext);
      await updateUser(ctxEmpty.req, ctxEmpty.res, ctxEmpty.next);
      assert.equal(ctxEmpty.res.statusCode, 400);

      // Attempting to update immutable / unallowed fields like employee_code or email
      const ctxUnallowed = createMockContext(
        { employee_code: 'HACKED-CODE' },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );
      await updateUser(ctxUnallowed.req, ctxUnallowed.res, ctxUnallowed.next);
      assert.equal(ctxUnallowed.res.statusCode, 400);

      // Empty full_name
      const ctxEmptyName = createMockContext(
        { full_name: '   ' },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );
      await updateUser(ctxEmptyName.req, ctxEmptyName.res, ctxEmptyName.next);
      assert.equal(ctxEmptyName.res.statusCode, 400);
    });

    it('23. Plant/shop consistency after updates: changing plant alone leaves existing shop incompatible', async () => {
      // User 'f0000000-0000-0000-0000-000000000003' is assigned to plant1 and shop1
      const targetUserId = 'f0000000-0000-0000-0000-000000000003';

      // Admin updates plant_id to plant2 WITHOUT clearing or updating shop_id
      // Resulting combination: plant2 + existing shop1 (belonging to plant1) -> MUST FAIL
      const ctxIncompatible = createMockContext(
        {
          plant_id: 'b0000000-0000-0000-0000-000000000002', // plant2
        },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );

      await updateUser(ctxIncompatible.req, ctxIncompatible.res, ctxIncompatible.next);

      assert.equal(ctxIncompatible.res.statusCode, 400);
      assert.equal(
        ctxIncompatible.res.responseData.message,
        'Selected shop does not belong to the selected plant.'
      );

      // However, updating plant to plant2 while clearing shop_id succeeds
      const ctxCompatible = createMockContext(
        {
          plant_id: 'b0000000-0000-0000-0000-000000000002',
          shop_id: null,
        },
        { id: targetUserId },
        {},
        {},
        adminUserContext
      );
      await updateUser(ctxCompatible.req, ctxCompatible.res, ctxCompatible.next);
      assert.equal(ctxCompatible.res.statusCode, 200);
      assert.equal(ctxCompatible.res.responseData.data.plant_id, 'b0000000-0000-0000-0000-000000000002');
      assert.equal(ctxCompatible.res.responseData.data.shop_id, null);
    });

    it('24. Self-demotion and self-deactivation prevention: admin cannot remove own admin access', async () => {
      const adminId = 'f0000000-0000-0000-0000-000000000001';

      // Admin trying to self-deactivate
      const ctxDeactivate = createMockContext(
        { is_active: false },
        { id: adminId },
        {},
        {},
        adminUserContext
      );
      await updateUser(ctxDeactivate.req, ctxDeactivate.res, ctxDeactivate.next);
      assert.equal(ctxDeactivate.res.statusCode, 400);
      assert.equal(
        ctxDeactivate.res.responseData.message,
        'You cannot deactivate yourself or remove your own admin role.'
      );

      // Admin trying to self-demote to technician
      const ctxDemote = createMockContext(
        { role: 'technician' },
        { id: adminId },
        {},
        {},
        adminUserContext
      );
      await updateUser(ctxDemote.req, ctxDemote.res, ctxDemote.next);
      assert.equal(ctxDemote.res.statusCode, 400);
    });

    it('25. Last active administrator protection prevents demotion or deactivation of the last active admin', async () => {
      // In mockDb, there is only ONE active admin ('f0000000-0000-0000-0000-000000000001')
      // Create a second temporary admin caller to simulate an administrative action
      const secondAdminCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-999999999999',
        employee_code: 'EMP-CALLER',
        email: 'caller@jcb.com',
        role: 'admin',
      };

      const singleAdminTargetId = 'f0000000-0000-0000-0000-000000000001';

      // Attempt to demote the only active admin in the system
      const ctxDemote = createMockContext(
        { role: 'manager' },
        { id: singleAdminTargetId },
        {},
        {},
        secondAdminCaller
      );
      await updateUser(ctxDemote.req, ctxDemote.res, ctxDemote.next);

      assert.equal(ctxDemote.res.statusCode, 409);
      assert.equal(
        ctxDemote.res.responseData.message,
        'Cannot deactivate or demote the last active administrator.'
      );
    });
  });

  // ==========================================
  // SECTION G: DELETE USER (SOFT DEACTIVATION)
  // ==========================================
  describe('G. Delete User / Soft Deactivation (DELETE /users/:id)', () => {
    const adminUserContext: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    it('26. Successful soft deletion marks is_active = false without deleting record from DB', async () => {
      const targetUserId = 'f0000000-0000-0000-0000-000000000002'; // manager
      const ctx = createMockContext({}, { id: targetUserId }, {}, {}, adminUserContext);

      await deleteUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.is_active, false);

      // Verify row is still present in database but marked inactive
      const userInDb = mockDb.users.get(targetUserId);
      assert.ok(userInDb);
      assert.equal(userInDb.is_active, false);
    });

    it('27. Repeated deletion returns HTTP 409 Conflict', async () => {
      // User 99 is already inactive
      const inactiveUserId = 'f0000000-0000-0000-0000-000000000099';
      const ctx = createMockContext({}, { id: inactiveUserId }, {}, {}, adminUserContext);

      await deleteUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 409);
      assert.equal(ctx.res.responseData.message, 'User account is already inactive.');
    });

    it('28. Self-deactivation is strictly rejected with HTTP 400', async () => {
      const ctx = createMockContext(
        {},
        { id: adminUserContext.id },
        {},
        {},
        adminUserContext
      );

      await deleteUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(
        ctx.res.responseData.message,
        'You cannot deactivate your own account.'
      );
    });

    it('29. Deleting the last active administrator returns HTTP 409 Conflict', async () => {
      const externalCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-999999999999',
        employee_code: 'CALLER',
        email: 'caller@jcb.com',
        role: 'admin',
      };

      const singleAdminId = 'f0000000-0000-0000-0000-000000000001';
      const ctx = createMockContext({}, { id: singleAdminId }, {}, {}, externalCaller);

      await deleteUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 409);
      assert.equal(
        ctx.res.responseData.message,
        'Cannot deactivate the last active administrator.'
      );
    });
  });

  // ==========================================
  // SECTION H: SHARED MIDDLEWARE SECURITY
  // ==========================================
  describe('H. Shared Authentication Middleware & Session Invalidation', () => {
    it('30. Previously issued access token is strictly rejected after account deactivation', async () => {
      const targetUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003')!;
      assert.equal(targetUser.is_active, true);

      // Issue valid access token while user is active
      const token = signAccessToken(targetUser);

      // Deactivate the user in the database
      targetUser.is_active = false;

      // Request to protected API with the previously issued token
      const ctx = createMockContext({}, {}, {}, { authorization: `Bearer ${token}` });
      await authenticateJWT(ctx.req, ctx.res, ctx.next);

      // authenticateJWT verifies against database and rejects with 401
      assert.equal(ctx.res.statusCode, 401);
      assert.equal(
        ctx.res.responseData.message,
        'Invalid or expired session token.'
      );
      assert.equal(ctx.req.user, undefined);
    });

    it('31. Previously issued access token with admin claim is rejected by requireRoles after role demotion', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001')!;

      // Issue access token while user is admin
      const tokenWithAdminClaim = signAccessToken(adminUser);

      // User gets demoted to operator in the database
      adminUser.role = 'operator';

      // Step 1: Request passes through authenticateJWT
      const ctx = createMockContext({}, {}, {}, { authorization: `Bearer ${tokenWithAdminClaim}` });
      await authenticateJWT(ctx.req, ctx.res, ctx.next);

      // authenticateJWT refreshes user role from the database, setting req.user.role = 'operator'
      assert.ok(ctx.req.user);
      assert.equal(ctx.req.user.role, 'operator');

      // Step 2: Next middleware in the route chain is requireRoles('admin')
      const adminGuard = requireRoles('admin');
      adminGuard(ctx.req, ctx.res, ctx.next);

      // Access is blocked with HTTP 403 Forbidden!
      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'You do not have permission to perform this action.'
      );
    });
  });
});
