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
  registerOperator,
  registerTechnician,
  getRegistrationOptions,
  getRegistrationPlants,
  getRegistrationShops,
  getRegistrationMachines,
  getPendingOperators,
  approveOperator,
  rejectOperator,
  getPendingTechnicians,
  approveTechnician,
  rejectTechnician,
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
  approval_status?: string;
  approved_by?: string | null;
  approved_at?: Date | null;
  rejection_reason?: string | null;
  requested_machine_id?: string | null;
  permanent_machine_id?: string | null;
  skills_json?: any;
  is_available?: boolean;
  max_active_assignments?: number;
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

interface MockMachine {
  id: string;
  machine_code: string;
  name: string;
  shop_id: string;
  status: string;
  category: string;
  criticality: string;
  bay_line_location: string | null;
  operating_hours?: number;
}

class MockAuthDatabase {
  public users: Map<string, MockUser> = new Map();
  public plants: Map<string, MockPlant> = new Map();
  public shops: Map<string, MockShop> = new Map();
  public machines: Map<string, MockMachine> = new Map();
  public queryLog: { text: string; params?: any[] }[] = [];

  constructor() {
    this.seed();
  }

  public seed(): void {
    this.users.clear();
    this.plants.clear();
    this.shops.clear();
    this.machines.clear();
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

    // Machines
    const m1: MockMachine = {
      id: 'd0000000-0000-0000-0000-000000000001',
      machine_code: 'JCB-MCH-FAB-01',
      name: 'CNC Plasma Cutter Alpha',
      shop_id: shop1.id,
      status: 'active',
      category: 'Plasma Cutting',
      criticality: 'critical',
      bay_line_location: 'Bay 1',
      operating_hours: 1200,
    };
    const m2: MockMachine = {
      id: 'd0000000-0000-0000-0000-000000000002',
      machine_code: 'JCB-MCH-FAB-02',
      name: 'Hydraulic Press Brake Beta',
      shop_id: shop1.id,
      status: 'under_maintenance',
      category: 'Press Brake',
      criticality: 'medium',
      bay_line_location: 'Bay 2',
      operating_hours: 3200,
    };
    const m3: MockMachine = {
      id: 'd0000000-0000-0000-0000-000000000003',
      machine_code: 'JCB-MCH-FAB-03',
      name: 'Robotic Welder Gamma',
      shop_id: shop1.id,
      status: 'breakdown',
      category: 'Robotic Welding',
      criticality: 'high',
      bay_line_location: 'Bay 3',
      operating_hours: 4500,
    };
    const m4: MockMachine = {
      id: 'd0000000-0000-0000-0000-000000000004',
      machine_code: 'JCB-MCH-FAB-04',
      name: 'Secondary Plate Shear',
      shop_id: shop1.id,
      status: 'inactive',
      category: 'Shearing',
      criticality: 'low',
      bay_line_location: 'Bay 4',
      operating_hours: 500,
    };
    const mPune: MockMachine = {
      id: 'd0000000-0000-0000-0000-000000000005',
      machine_code: 'JCB-MCH-PUN-01',
      name: 'Chassis Alignment Rig',
      shop_id: shop2.id,
      status: 'active',
      category: 'Assembly',
      criticality: 'high',
      bay_line_location: 'Bay P1',
      operating_hours: 900,
    };
    this.machines.set(m1.id, m1);
    this.machines.set(m2.id, m2);
    this.machines.set(m3.id, m3);
    this.machines.set(m4.id, m4);
    this.machines.set(mPune.id, mPune);

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
      approval_status: 'approved',
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
      approval_status: 'approved',
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
      approval_status: 'approved',
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
      approval_status: 'approved',
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
    if (trimmed.includes('WHERE u.id = $1') && trimmed.includes('FROM users u') && trimmed.includes('LEFT JOIN plants p')) {
      const userId = params[0];
      const match = this.users.get(userId);
      if (!match || !match.is_active) {
        return { rows: [], rowCount: 0 };
      }
      const plant = match.plant_id ? this.plants.get(match.plant_id) : undefined;
      const shop = match.shop_id ? this.shops.get(match.shop_id) : undefined;
      const permMachine = match.permanent_machine_id ? this.machines.get(match.permanent_machine_id) : undefined;
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
            requested_machine_id: match.requested_machine_id ?? null,
            permanent_machine_id: match.permanent_machine_id ?? null,
            permanent_machine_code: permMachine?.machine_code ?? null,
            permanent_machine_name: permMachine?.name ?? null,
            permanent_machine_status: permMachine?.status ?? null,
            permanent_machine_location: permMachine?.bay_line_location ?? null,
          },
        ],
        rowCount: 1,
      };
    }

    // 4. Plant lookup
    if (trimmed.includes('FROM plants') && trimmed.includes('WHERE id = $1')) {
      const plantId = params[0];
      const plant = this.plants.get(plantId);
      return {
        rows: plant ? [{ id: plant.id, plant_name: plant.plant_name, plant_code: plant.plant_code }] : [],
        rowCount: plant ? 1 : 0,
      };
    }
    if (trimmed.includes('FROM plants')) {
      const allPlants = Array.from(this.plants.values()).map((p) => ({
        id: p.id,
        plant_code: p.plant_code,
        plant_name: p.plant_name,
        city: 'Ballabgarh',
        state: 'Haryana',
      }));
      return {
        rows: allPlants,
        rowCount: allPlants.length,
      };
    }

    // 5. Shop lookup
    if (trimmed.includes('FROM shops') && trimmed.includes('WHERE id = $1')) {
      const shopId = params[0];
      const shop = this.shops.get(shopId);
      return {
        rows: shop ? [{ id: shop.id, plant_id: shop.plant_id, shop_name: shop.shop_name, shop_code: shop.shop_code }] : [],
        rowCount: shop ? 1 : 0,
      };
    }
    if (trimmed.includes('FROM shops') && trimmed.includes('WHERE plant_id = $1')) {
      const plantId = params[0];
      const shops = Array.from(this.shops.values()).filter((s) => s.plant_id === plantId);
      return {
        rows: shops,
        rowCount: shops.length,
      };
    }
    if (trimmed.includes('FROM shops s') && trimmed.includes('JOIN plants p')) {
      return {
        rows: Array.from(this.shops.values()),
        rowCount: this.shops.size,
      };
    }

    // 5c. Machine queries
    if (trimmed.includes('FROM machines') && trimmed.includes('WHERE id = $1')) {
      const machineId = params[0];
      const m = this.machines.get(machineId);
      return {
        rows: m ? [{ ...m }] : [],
        rowCount: m ? 1 : 0,
      };
    }
    if (trimmed.includes('FROM machines') && (trimmed.includes('WHERE shop_id = $1') || trimmed.includes('WHERE m.shop_id = $1'))) {
      const shopId = params[0];
      const shopMachines = Array.from(this.machines.values())
        .filter((m) => m.shop_id === shopId)
        .sort((a, b) => a.machine_code.localeCompare(b.machine_code))
        .map((m) => {
          const assignedUser = Array.from(this.users.values()).find(
            (u) =>
              u.role === 'operator' &&
              u.approval_status !== 'rejected' &&
              (u.permanent_machine_id === m.id || (u.requested_machine_id === m.id && u.approval_status === 'pending'))
          );
          const isAssigned = !!assignedUser;
          return {
            ...m,
            is_assigned: isAssigned,
            is_available: !isAssigned,
            availability_status: isAssigned ? 'Assigned' : 'Available',
          };
        });
      return {
        rows: shopMachines,
        rowCount: shopMachines.length,
      };
    }

    if (
      trimmed.includes('FROM users') &&
      (trimmed.includes('permanent_machine_id = $1') || trimmed.includes('requested_machine_id = $1'))
    ) {
      const machineId = params[0];
      const match = Array.from(this.users.values()).find(
        (u) =>
          u.role === 'operator' &&
          u.approval_status !== 'rejected' &&
          (u.permanent_machine_id === machineId ||
            (u.requested_machine_id === machineId && u.approval_status === 'pending'))
      );
      return {
        rows: match ? [{ ...match }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    // 5b. Operator registration lookup queries
    if (trimmed.includes('FROM users WHERE UPPER(employee_code) = UPPER($1)')) {
      const code = String(params[0] || '').trim().toUpperCase();
      const match = Array.from(this.users.values()).find(
        (u) => u.employee_code.toUpperCase() === code
      );
      return {
        rows: match ? [{ id: match.id }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    if (trimmed.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0] || '').trim().toLowerCase();
      const match = Array.from(this.users.values()).find(
        (u) => u.email.toLowerCase() === email
      );
      return {
        rows: match ? [{ id: match.id }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    if (trimmed.includes("role = 'manager' AND plant_id = $1")) {
      const plantId = params[0];
      const mgrs = Array.from(this.users.values()).filter(
        (u) => u.role === 'manager' && u.plant_id === plantId && u.is_active
      );
      return {
        rows: mgrs.map((m) => ({ id: m.id, email: m.email, full_name: m.full_name })),
        rowCount: mgrs.length,
      };
    }

    if (trimmed.includes("u.role = 'operator'") && trimmed.includes("u.approval_status = 'pending'")) {
      let pending = Array.from(this.users.values()).filter(
        (u) => u.role === 'operator' && u.approval_status === 'pending'
      );
      if (trimmed.includes('u.plant_id = $')) {
        const plantId = params[0];
        pending = pending.filter((u) => u.plant_id === plantId);
      }
      return {
        rows: pending.map((u) => {
          const plant = u.plant_id ? this.plants.get(u.plant_id) : undefined;
          const shop = u.shop_id ? this.shops.get(u.shop_id) : undefined;
          const machine = u.requested_machine_id ? this.machines.get(u.requested_machine_id) : undefined;
          return {
            id: u.id,
            employee_code: u.employee_code,
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            plant_id: u.plant_id,
            shop_id: u.shop_id,
            department: u.department,
            designation: u.designation,
            shift: u.shift,
            approval_status: u.approval_status,
            is_active: u.is_active,
            created_at: u.created_at,
            requested_machine_id: u.requested_machine_id ?? null,
            requested_machine_code: machine?.machine_code ?? null,
            requested_machine_name: machine?.name ?? null,
            requested_machine_status: machine?.status ?? null,
            requested_machine_category: machine?.category ?? null,
            requested_machine_location: machine?.bay_line_location ?? null,
            plant_name: plant?.plant_name ?? 'Ballabgarh Plant',
            plant_code: plant?.plant_code ?? 'PLANT-BLB-01',
            shop_name: shop?.shop_name ?? 'Fabrication Shop',
            shop_code: shop?.shop_code ?? 'SHOP-FAB-01',
          };
        }),
        rowCount: pending.length,
      };
    }

    if (trimmed.includes("u.role = 'technician'") && trimmed.includes("u.approval_status = 'pending'")) {
      let pending = Array.from(this.users.values()).filter(
        (u) => u.role === 'technician' && u.approval_status === 'pending'
      );
      if (trimmed.includes('u.plant_id = $')) {
        const plantId = params[0];
        pending = pending.filter((u) => u.plant_id === plantId);
      }
      return {
        rows: pending.map((u) => {
          const plant = u.plant_id ? this.plants.get(u.plant_id) : undefined;
          const shop = u.shop_id ? this.shops.get(u.shop_id) : undefined;
          return {
            id: u.id,
            employee_code: u.employee_code,
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            plant_id: u.plant_id,
            shop_id: u.shop_id,
            department: u.department,
            designation: u.designation,
            shift: u.shift,
            skills_json: u.skills_json || [],
            approval_status: u.approval_status,
            is_active: u.is_active,
            is_available: u.is_available ?? true,
            max_active_assignments: u.max_active_assignments ?? 5,
            created_at: u.created_at,
            plant_name: plant?.plant_name ?? 'Ballabgarh Plant',
            plant_code: plant?.plant_code ?? 'PLANT-BLB-01',
            shop_name: shop?.shop_name ?? 'Fabrication Shop',
            shop_code: shop?.shop_code ?? 'SHOP-FAB-01',
          };
        }),
        rowCount: pending.length,
      };
    }

    if (trimmed.startsWith('UPDATE users') && trimmed.includes("SET approval_status = 'approved'")) {
      const approvedBy = params[0];
      const userId = params[1];
      const u = this.users.get(userId);
      if (u) {
        if (trimmed.includes("approval_status = 'pending'") && u.approval_status !== 'pending') {
          return { rows: [], rowCount: 0 };
        }
        u.approval_status = 'approved';
        u.is_active = true;
        u.approved_by = approvedBy;
        u.approved_at = new Date();
        u.permanent_machine_id = u.permanent_machine_id || u.requested_machine_id || null;
        u.rejection_reason = null;
      }
      return {
        rows: u ? [{ ...u }] : [],
        rowCount: u ? 1 : 0,
      };
    }

    if (trimmed.startsWith('UPDATE users') && trimmed.includes("SET approval_status = 'rejected'")) {
      const approvedBy = params[0];
      const reason = params[1];
      const userId = params[2];
      const u = this.users.get(userId);
      if (u) {
        if (trimmed.includes("approval_status = 'pending'") && u.approval_status !== 'pending') {
          return { rows: [], rowCount: 0 };
        }
        u.approval_status = 'rejected';
        u.is_active = false;
        u.approved_by = approvedBy;
        u.approved_at = new Date();
        u.rejection_reason = reason;
      }
      return {
        rows: u ? [{ ...u }] : [],
        rowCount: u ? 1 : 0,
      };
    }

    if (trimmed.startsWith('INSERT INTO notifications')) {
      return {
        rows: [{ id: 'notif-' + Math.random().toString(36).substring(2, 9) }],
        rowCount: 1,
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
      if (trimmed.includes("role IN ('technician', 'operator', 'store_manager')")) {
        filtered = filtered.filter((u) =>
          ['technician', 'operator', 'store_manager'].includes(u.role.toLowerCase())
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
      if (trimmed.includes('plant_id = $')) {
        const plantVal = String(params[paramIdx++] || '');
        filtered = filtered.filter((u) => u.plant_id === plantVal);
      }
      if (trimmed.includes('shop_id = $')) {
        const shopVal = String(params[paramIdx++] || '');
        filtered = filtered.filter((u) => u.shop_id === shopVal);
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
      if (trimmed.includes("role IN ('technician', 'operator', 'store_manager')")) {
        filtered = filtered.filter((u) =>
          ['technician', 'operator', 'store_manager'].includes(u.role.toLowerCase())
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
      if (trimmed.includes('plant_id = $')) {
        const plantVal = String(params[paramIdx++] || '');
        filtered = filtered.filter((u) => u.plant_id === plantVal);
      }
      if (trimmed.includes('shop_id = $')) {
        const shopVal = String(params[paramIdx++] || '');
        filtered = filtered.filter((u) => u.shop_id === shopVal);
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
      const isPendingOperator = trimmed.includes("'pending'") && !trimmed.includes("'technician'");
      let employee_code: string;
      let full_name: string;
      let email: string;
      let phone: string | null;
      let role = 'operator';
      let plant_id: string | null = null;
      let shop_id: string | null = null;
      let department: string | null = null;
      let designation: string | null = null;
      let shift: string | null = null;
      let password_hash: string;
      let requested_machine_id: string | null = null;
      let skills_json: any = [];
      let isPending = trimmed.includes("'pending'");

      if (trimmed.includes("'technician'")) {
        // params: [cleanEmployeeCode, cleanFullName, cleanEmail, cleanPhone, plant_id, shop_id, cleanDept, cleanDesig, cleanShift, skillsJsonString, passwordHash]
        employee_code = params[0];
        full_name = params[1];
        email = params[2];
        phone = params[3];
        plant_id = params[4];
        shop_id = params[5];
        department = params[6];
        designation = params[7];
        shift = params[8];
        const rawSkills = params[9];
        try { skills_json = JSON.parse(rawSkills); } catch { skills_json = rawSkills; }
        password_hash = params[10];
        role = 'technician';
        isPending = true;
      } else if (isPendingOperator) {
        if (trimmed.includes('requested_machine_id')) {
          // params: [employee_code, full_name, email, phone, plant_id, shop_id, department, designation, shift, targetMachineId, password_hash]
          employee_code = params[0];
          full_name = params[1];
          email = params[2];
          phone = params[3];
          plant_id = params[4];
          shop_id = params[5];
          department = params[6];
          designation = params[7];
          shift = params[8];
          requested_machine_id = params[9] || null;
          password_hash = params[10];
          role = 'operator';
        } else {
          // params: [employee_code, full_name, email, phone, plant_id, shop_id, department, designation, shift, password_hash]
          employee_code = params[0];
          full_name = params[1];
          email = params[2];
          phone = params[3];
          plant_id = params[4];
          shop_id = params[5];
          department = params[6];
          designation = params[7];
          shift = params[8];
          password_hash = params[9];
          role = 'operator';
        }
      } else {
        employee_code = params[0];
        full_name = params[1];
        email = params[2];
        phone = params[3];
        role = params[4];
        plant_id = params[5];
        shop_id = params[6];
        department = params[7];
        designation = params[8];
        shift = params[9];
        password_hash = params[10];
      }

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
        requested_machine_id,
        skills_json,
        is_available: true,
        max_active_assignments: 5,
        password_hash,
        is_active: !isPending,
        approval_status: isPending ? 'pending' : 'approved',
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

    it('19a. Admin can create all supported roles (technician, operator, manager, admin, store_manager)', async () => {
      const adminCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-001',
        email: 'admin@jcb.com',
        role: 'admin',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const rolesToTest = ['technician', 'operator', 'manager', 'admin', 'store_manager'];
      for (const targetRole of rolesToTest) {
        const payload = {
          employee_code: `EMP-CR-${targetRole.slice(0, 3).toUpperCase()}-99`,
          full_name: `Created ${targetRole}`,
          email: `created.${targetRole}@jcb.com`,
          role: targetRole,
          password: 'ValidPassword123!',
          plant_id: 'b0000000-0000-0000-0000-000000000001',
        };

        const ctx = createMockContext(payload, {}, {}, {}, adminCaller);
        await createUser(ctx.req, ctx.res, ctx.next);

        assert.equal(ctx.res.statusCode, 201, `Admin should be able to create ${targetRole}`);
        assert.equal(ctx.res.responseData.success, true);
        assert.equal(ctx.res.responseData.data.role, targetRole);
      }
    });

    it('19b. Manager can create Technician in own assigned plant', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };

      const payload = {
        employee_code: 'EMP-MGR-TECH-01',
        full_name: 'Manager Created Tech',
        email: 'mgr.tech@jcb.com',
        role: 'technician',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.role, 'technician');
      assert.equal(ctx.res.responseData.data.plant_id, managerCaller.plant_id);
    });

    it('19c. Manager can create Operator in own assigned plant', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const payload = {
        employee_code: 'EMP-MGR-OPR-01',
        full_name: 'Manager Created Operator',
        email: 'mgr.operator@jcb.com',
        role: 'operator',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.role, 'operator');
      assert.equal(ctx.res.responseData.data.plant_id, managerCaller.plant_id);
    });

    it('19d. Manager cannot create Admin (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const payload = {
        employee_code: 'EMP-ILLEGAL-ADM',
        full_name: 'Illegal Admin',
        email: 'illegal.admin@jcb.com',
        role: 'admin',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'Forbidden: Managers are only permitted to create technician, operator, and store_manager accounts.'
      );
    });

    it('19e. Manager cannot create Manager (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const payload = {
        employee_code: 'EMP-ILLEGAL-MGR',
        full_name: 'Illegal Manager',
        email: 'illegal.manager@jcb.com',
        role: 'manager',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'Forbidden: Managers are only permitted to create technician, operator, and store_manager accounts.'
      );
    });

    it('19f. Manager can create Store Manager in own assigned plant (HTTP 201 Created)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const payload = {
        employee_code: 'EMP-MGR-SM-01',
        full_name: 'Plant Store Manager',
        email: 'plant.sm@jcb.com',
        role: 'store_manager',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.role, 'store_manager');
      assert.equal(ctx.res.responseData.data.plant_id, managerCaller.plant_id);
      assert.equal(ctx.res.responseData.data.employee_code, 'EMP-MGR-SM-01');
    });

    it('19g. Manager cannot create users in another plant by manipulating plant_id (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // Plant 1
      };

      const payload = {
        employee_code: 'EMP-MGR-ROGUE-01',
        full_name: 'Rogue Plant Tech',
        email: 'rogue.tech@jcb.com',
        role: 'technician',
        plant_id: 'b0000000-0000-0000-0000-000000000002', // Plant 2 (different)
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'Forbidden: Managers cannot create users for another plant.'
      );
    });

    it('19h. Manager cannot create users if unassigned to a plant (HTTP 400 Bad Request)', async () => {
      const unassignedManager: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000098',
        employee_code: 'EMP-MGR-NOPLANT',
        email: 'noplant.mgr@jcb.com',
        role: 'manager',
      };

      const payload = {
        employee_code: 'EMP-MGR-TECH-NOPLANT',
        full_name: 'No Plant Tech',
        email: 'noplant.tech@jcb.com',
        role: 'technician',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, unassignedManager);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(
        ctx.res.responseData.message,
        'Manager account is not assigned to a plant. Cannot create users.'
      );
    });

    it('19i. Manager cannot assign a shop belonging to another plant (HTTP 400 Bad Request)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // Plant 1
      };

      const payload = {
        employee_code: 'EMP-MGR-WRONGSHOP',
        full_name: 'Wrong Shop Tech',
        email: 'wrongshop.tech@jcb.com',
        role: 'technician',
        shop_id: 'c0000000-0000-0000-0000-000000000002', // shop2 belongs to Plant 2
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(payload, {}, {}, {}, managerCaller);
      await createUser(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(
        ctx.res.responseData.message,
        "Selected shop does not belong to the manager's assigned plant."
      );
    });

    it('19j. Manager can view only permitted roles (technician, operator, store_manager) in own assigned plant (GET /auth/users)', async () => {
      // Add a user in plant 2
      const plant2User: MockUser = {
        id: 'f0000000-0000-0000-0000-000000000050',
        employee_code: 'EMP-PUNE-01',
        full_name: 'Pune Operator',
        email: 'pune.op@jcb.com',
        phone: null,
        role: 'operator',
        plant_id: 'b0000000-0000-0000-0000-000000000002', // Plant 2
        shop_id: 'c0000000-0000-0000-0000-000000000002',
        department: 'Assembly',
        designation: 'Operator',
        shift: 'Shift A',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.users.set(plant2User.id, plant2User);

      // Add a Store Manager in plant 1
      const plant1StoreMgr: MockUser = {
        id: 'f0000000-0000-0000-0000-000000000051',
        employee_code: 'EMP-SM-01',
        full_name: 'Plant 1 Store Mgr',
        email: 'sm1@jcb.com',
        phone: null,
        role: 'store_manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // Plant 1
        shop_id: null,
        department: 'Stores',
        designation: 'Store Manager',
        shift: 'Shift A',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.users.set(plant1StoreMgr.id, plant1StoreMgr);

      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // Plant 1
      };

      const ctx = createMockContext({}, {}, {}, {}, managerCaller);
      await getUsers(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      const users = ctx.res.responseData.data;
      assert.ok(users.length > 0);
      for (const u of users) {
        assert.equal(u.plant_id, 'b0000000-0000-0000-0000-000000000001');
        assert.ok(['technician', 'operator', 'store_manager'].includes(u.role));
      }
      // Manager must NOT see other managers or admins
      assert.equal(users.some((u: any) => u.role === 'manager'), false);
      assert.equal(users.some((u: any) => u.role === 'admin'), false);
      // Manager must NOT see users in other plants
      assert.equal(users.some((u: any) => u.employee_code === 'EMP-PUNE-01'), false);
    });

    it('19k. Admin can view users across all plants (GET /auth/users)', async () => {
      // Seed a user in plant 2
      const plant2User: MockUser = {
        id: 'f0000000-0000-0000-0000-000000000050',
        employee_code: 'EMP-PUNE-01',
        full_name: 'Pune Operator',
        email: 'pune.op@jcb.com',
        phone: null,
        role: 'operator',
        plant_id: 'b0000000-0000-0000-0000-000000000002', // Plant 2
        shop_id: 'c0000000-0000-0000-0000-000000000002',
        department: 'Assembly',
        designation: 'Operator',
        shift: 'Shift A',
        password_hash: 'hash',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.users.set(plant2User.id, plant2User);

      const adminCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-001',
        email: 'admin@jcb.com',
        role: 'admin',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const ctx = createMockContext({}, {}, {}, {}, adminCaller);
      await getUsers(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      const users = ctx.res.responseData.data;
      // Admin sees users across plants including the Pune user
      assert.ok(users.some((u: any) => u.plant_id === 'b0000000-0000-0000-0000-000000000001'));
      assert.ok(users.some((u: any) => u.plant_id === 'b0000000-0000-0000-0000-000000000002'));
    });

    it('19l. Manager cannot edit or deactivate users through direct API calls (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      const targetUserId = 'f0000000-0000-0000-0000-000000000003'; // existing technician

      // Direct edit attempt
      const editCtx = createMockContext({ full_name: 'Hacked Name' }, { id: targetUserId }, {}, {}, managerCaller);
      await updateUser(editCtx.req, editCtx.res, editCtx.next);

      assert.equal(editCtx.res.statusCode, 403);
      assert.equal(
        editCtx.res.responseData.message,
        'Forbidden: Only administrators are permitted to edit users.'
      );

      // Direct deactivation attempt
      const deleteCtx = createMockContext({}, { id: targetUserId }, {}, {}, managerCaller);
      await deleteUser(deleteCtx.req, deleteCtx.res, deleteCtx.next);

      assert.equal(deleteCtx.res.statusCode, 403);
      assert.equal(
        deleteCtx.res.responseData.message,
        'Forbidden: Only administrators are permitted to deactivate users.'
      );
    });

    it('19m. Manager cannot retrieve other Managers or Admins via role filter (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
      };

      // Querying role=manager
      const ctxMgr = createMockContext({}, {}, { role: 'manager' }, {}, managerCaller);
      await getUsers(ctxMgr.req, ctxMgr.res, ctxMgr.next);
      assert.equal(ctxMgr.res.statusCode, 403);
      assert.equal(
        ctxMgr.res.responseData.message,
        'Forbidden: Managers are not permitted to view manager or admin accounts.'
      );

      // Querying role=admin
      const ctxAdm = createMockContext({}, {}, { role: 'admin' }, {}, managerCaller);
      await getUsers(ctxAdm.req, ctxAdm.res, ctxAdm.next);
      assert.equal(ctxAdm.res.statusCode, 403);
      assert.equal(
        ctxAdm.res.responseData.message,
        'Forbidden: Managers are not permitted to view manager or admin accounts.'
      );
    });

    it('19n. Manager cannot access users in another plant by manipulating plant_id query param (HTTP 403 Forbidden)', async () => {
      const managerCaller: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-001',
        email: 'manager@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000001', // Plant 1
      };

      const ctx = createMockContext(
        {},
        {},
        { plant_id: 'b0000000-0000-0000-0000-000000000002' }, // Plant 2
        {},
        managerCaller
      );
      await getUsers(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'Forbidden: Managers cannot access users outside their assigned plant.'
      );
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

  // ==========================================
  // SECTION I: OPERATOR SIGN-UP & MANAGER APPROVAL WORKFLOW
  // ==========================================
  describe('I. Operator Sign-Up & Manager Approval Workflow', () => {
    const plant1Id = 'b0000000-0000-0000-0000-000000000001';
    const shop1Id = 'c0000000-0000-0000-0000-000000000001';
    const plant2Id = 'b0000000-0000-0000-0000-000000000002';
    const shop2Id = 'c0000000-0000-0000-0000-000000000002';

    const plant1Manager: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      email: 'manager@jcb.com',
      role: 'manager',
      plant_id: plant1Id,
      shop_id: shop1Id,
    };

    const plant2Manager: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000077',
      employee_code: 'EMP-MGR-002',
      email: 'manager.pune@jcb.com',
      role: 'manager',
      plant_id: plant2Id,
      shop_id: shop2Id,
    };

    const adminUserContext: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
      plant_id: plant1Id,
    };

    it('32. Operator self-registration with valid data creates pending, inactive account and returns HTTP 201', async () => {
      const regPayload = {
        employee_code: 'JCB-OPR-501',
        full_name: 'Ramesh Operator',
        email: 'ramesh.operator@jcb.com',
        phone: '+91 9123456789',
        plant_id: plant1Id,
        shop_id: shop1Id,
        department: 'Fabrication',
        designation: 'CNC Machine Operator',
        shift: 'Shift A',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(regPayload);
      await registerOperator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.role, 'operator');
      assert.equal(ctx.res.responseData.data.approval_status, 'pending');
      assert.equal(ctx.res.responseData.data.is_active, false);
      assert.ok(ctx.res.responseData.message.includes('pending manager approval'));
    });

    it('33. Operator registration with missing required fields returns HTTP 400 Bad Request', async () => {
      // Missing password
      let ctx = createMockContext({
        employee_code: 'JCB-OPR-502',
        full_name: 'Test Name',
        email: 'test@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
      });
      await registerOperator(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);

      // Missing plant_id
      ctx = createMockContext({
        employee_code: 'JCB-OPR-502',
        full_name: 'Test Name',
        email: 'test@jcb.com',
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);

      // Missing shop_id
      ctx = createMockContext({
        employee_code: 'JCB-OPR-502',
        full_name: 'Test Name',
        email: 'test@jcb.com',
        plant_id: plant1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
    });

    it('34. Operator registration with duplicate employee_code or email returns HTTP 409 Conflict', async () => {
      // First registration
      const ctx1 = createMockContext({
        employee_code: 'JCB-OPR-503',
        full_name: 'Unique User',
        email: 'unique.user@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      // Duplicate employee code attempt
      const ctx2 = createMockContext({
        employee_code: 'JCB-OPR-503',
        full_name: 'Duplicate Code User',
        email: 'diff.email@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 409);
      assert.ok(ctx2.res.responseData.message.includes('Employee ID already exists'));

      // Duplicate email attempt
      const ctx3 = createMockContext({
        employee_code: 'JCB-OPR-504',
        full_name: 'Duplicate Email User',
        email: 'unique.user@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 409);
      assert.ok(ctx3.res.responseData.message.includes('email address already exists'));
    });

    it('35. Operator registration with non-existent plant or mismatched shop returns HTTP 404 / 400', async () => {
      // Non-existent plant
      const nonExistentPlantId = 'b0000000-0000-0000-0000-999999999999';
      let ctx = createMockContext({
        employee_code: 'JCB-OPR-505',
        full_name: 'Mismatch User',
        email: 'mismatch1@jcb.com',
        plant_id: nonExistentPlantId,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 404);

      // Mismatched shop (shop2 belongs to plant2, but plant1 specified)
      ctx = createMockContext({
        employee_code: 'JCB-OPR-506',
        full_name: 'Mismatch User 2',
        email: 'mismatch2@jcb.com',
        plant_id: plant1Id,
        shop_id: shop2Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('does not belong'));
    });

    it('36. Registration options endpoint returns public active plants and shops', async () => {
      const ctx = createMockContext();
      await getRegistrationOptions(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data.plants));
      assert.ok(Array.isArray(ctx.res.responseData.data.shops));
      assert.ok(ctx.res.responseData.data.plants.length > 0);
      assert.ok(ctx.res.responseData.data.shops.length > 0);
    });

    it('37. Newly registered Operator in pending status cannot log in (HTTP 403 Forbidden with clear status message)', async () => {
      // Register pending operator
      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-701',
        full_name: 'Pending Operator',
        email: 'pending.opr@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      assert.equal(regCtx.res.statusCode, 201);

      // Attempt login with valid password
      const loginCtx = createMockContext({
        identifier: 'JCB-OPR-701',
        password: 'ValidPassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 403);
      assert.equal(loginCtx.res.responseData.success, false);
      assert.equal(loginCtx.res.responseData.approval_status, 'pending');
      assert.ok(loginCtx.res.responseData.message.includes('pending approval by your Plant Manager'));
    });

    it('38. Manager can retrieve list of pending operator registrations for their assigned plant facility', async () => {
      const ctx = createMockContext({}, {}, {}, {}, plant1Manager);
      await getPendingOperators(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      // All pending operators in the list must belong to plant1
      for (const op of ctx.res.responseData.data) {
        assert.equal(op.plant_id, plant1Id);
        assert.equal(op.approval_status, 'pending');
      }
    });

    it('39. Manager from Plant 2 cannot view or approve Operator registered for Plant 1 (HTTP 403 Forbidden)', async () => {
      // Create pending operator in Plant 1
      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-702',
        full_name: 'Plant 1 Pending Operator',
        email: 'p1.pending@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      const newOpId = regCtx.res.responseData.data.id;

      // Plant 2 Manager attempts to approve Plant 1 Operator
      const approveCtx = createMockContext({}, { id: newOpId }, {}, {}, plant2Manager);
      await approveOperator(approveCtx.req, approveCtx.res, approveCtx.next);

      assert.equal(approveCtx.res.statusCode, 403);
      assert.equal(approveCtx.res.responseData.success, false);
      assert.ok(approveCtx.res.responseData.message.includes('assigned to their own plant facility'));
    });

    it('40. Non-manager/non-admin role cannot approve or reject operators (requireRoles blocks with HTTP 403)', () => {
      const technicianUserContext: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000003',
        employee_code: 'EMP-TCH-001',
        email: 'technician@jcb.com',
        role: 'technician',
      };

      const ctx = createMockContext({}, { id: 'some-id' }, {}, {}, technicianUserContext);
      const guard = requireRoles('manager', 'admin');
      guard(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(
        ctx.res.responseData.message,
        'You do not have permission to perform this action.'
      );
    });

    it('41. Manager approves Operator: account activated, approval_status set to approved, and operator can now log in', async () => {
      // 1. Register operator
      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-703',
        full_name: 'Approve Me Operator',
        email: 'approve.me@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      const newOpId = regCtx.res.responseData.data.id;

      // 2. Plant 1 Manager approves
      const approveCtx = createMockContext({}, { id: newOpId }, {}, {}, plant1Manager);
      await approveOperator(approveCtx.req, approveCtx.res, approveCtx.next);

      assert.equal(approveCtx.res.statusCode, 200);
      assert.equal(approveCtx.res.responseData.success, true);
      assert.equal(approveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(approveCtx.res.responseData.data.is_active, true);

      // 3. Newly approved Operator logs in
      const loginCtx = createMockContext({
        identifier: 'JCB-OPR-703',
        password: 'ValidPassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 200);
      assert.equal(loginCtx.res.responseData.success, true);
      assert.ok(loginCtx.res.responseData.data.token);
      assert.equal(loginCtx.res.responseData.data.user.role, 'operator');
    });

    it('42. Manager rejects Operator: account marked rejected with reason, and rejected operator cannot log in (HTTP 403)', async () => {
      // 1. Register operator
      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-704',
        full_name: 'Reject Me Operator',
        email: 'reject.me@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      const newOpId = regCtx.res.responseData.data.id;

      // 2. Plant 1 Manager rejects with reason
      const rejectReason = 'Employee ID does not match factory HR badge register.';
      const rejectCtx = createMockContext({ rejection_reason: rejectReason }, { id: newOpId }, {}, {}, plant1Manager);
      await rejectOperator(rejectCtx.req, rejectCtx.res, rejectCtx.next);

      assert.equal(rejectCtx.res.statusCode, 200);
      assert.equal(rejectCtx.res.responseData.success, true);
      assert.equal(rejectCtx.res.responseData.data.approval_status, 'rejected');
      assert.equal(rejectCtx.res.responseData.data.is_active, false);

      // 3. Rejected Operator attempts login
      const loginCtx = createMockContext({
        identifier: 'JCB-OPR-704',
        password: 'ValidPassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 403);
      assert.equal(loginCtx.res.responseData.success, false);
      assert.equal(loginCtx.res.responseData.approval_status, 'rejected');
      assert.ok(loginCtx.res.responseData.message.includes(rejectReason));
    });

    it('43. Enterprise Admin can view pending operators across all plants and approve registrations', async () => {
      // 1. Register operator in plant 2
      mockDb.plants.set(plant2Id, { id: plant2Id, plant_code: 'PLANT-PUN-02', plant_name: 'Pune Plant' });
      mockDb.shops.set(shop2Id, { id: shop2Id, plant_id: plant2Id, shop_code: 'SHOP-ASSY-02', shop_name: 'Assembly Shop Pune' });

      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-705',
        full_name: 'Pune Operator',
        email: 'pune.opr@jcb.com',
        plant_id: plant2Id,
        shop_id: shop2Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      const opId = regCtx.res.responseData.data.id;

      // 2. Admin views pending
      const adminListCtx = createMockContext({}, {}, {}, {}, adminUserContext);
      await getPendingOperators(adminListCtx.req, adminListCtx.res, adminListCtx.next);
      assert.equal(adminListCtx.res.statusCode, 200);
      assert.ok(adminListCtx.res.responseData.data.some((u: any) => u.id === opId));

      // 3. Admin approves
      const adminApproveCtx = createMockContext({}, { id: opId }, {}, {}, adminUserContext);
      await approveOperator(adminApproveCtx.req, adminApproveCtx.res, adminApproveCtx.next);
      assert.equal(adminApproveCtx.res.statusCode, 200);
      assert.equal(adminApproveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(adminApproveCtx.res.responseData.data.is_active, true);
    });

    it('44. getRegistrationMachines returns all machines (active, inactive, maintenance, breakdown) for a valid shop', async () => {
      // Valid shop1 query
      const ctx = createMockContext({}, { shopId: shop1Id });
      await getRegistrationMachines(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      // Shop1 has 4 seeded machines: active, under_maintenance, breakdown, inactive
      assert.equal(ctx.res.responseData.data.length, 4);

      const statuses = ctx.res.responseData.data.map((m: any) => m.status);
      assert.ok(statuses.includes('active'));
      assert.ok(statuses.includes('under_maintenance'));
      assert.ok(statuses.includes('breakdown'));
      assert.ok(statuses.includes('inactive'));

      // Non-existent shop returns 404
      const invalidShopCtx = createMockContext({}, { shopId: 'c0000000-0000-0000-0000-999999999999' });
      await getRegistrationMachines(invalidShopCtx.req, invalidShopCtx.res, invalidShopCtx.next);
      assert.equal(invalidShopCtx.res.statusCode, 404);

      // Malformed shopId returns 400
      const malformedCtx = createMockContext({}, { shopId: 'not-a-uuid' });
      await getRegistrationMachines(malformedCtx.req, malformedCtx.res, malformedCtx.next);
      assert.equal(malformedCtx.res.statusCode, 400);
    });

    it('45. Operator self-registration with requested_machine_id persists machine preference without occupying machine', async () => {
      const targetMachineId = 'd0000000-0000-0000-0000-000000000001'; // JCB-MCH-FAB-01 in shop1
      const initialMachineStatus = mockDb.machines.get(targetMachineId)!.status;

      const regPayload = {
        employee_code: 'JCB-OPR-801',
        full_name: 'Machine Preferring Operator',
        email: 'mach.opr@jcb.com',
        phone: '+91 9888877777',
        plant_id: plant1Id,
        shop_id: shop1Id,
        requested_machine_id: targetMachineId,
        department: 'Fabrication',
        designation: 'CNC Operator',
        shift: 'Shift B',
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(regPayload);
      await registerOperator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.requested_machine_id, targetMachineId);
      assert.equal(ctx.res.responseData.data.approval_status, 'pending');

      // Crucial business rule: Machine status must NOT change on registration
      const currentMachineStatus = mockDb.machines.get(targetMachineId)!.status;
      assert.equal(currentMachineStatus, initialMachineStatus);
    });

    it('46. Operator self-registration with cross-shop requested_machine_id returns HTTP 400', async () => {
      // Machine 'd0000000-0000-0000-0000-000000000005' belongs to shop2 (Pune), but registration selects shop1 (Fabrication)
      const crossShopMachineId = 'd0000000-0000-0000-0000-000000000005';

      const regPayload = {
        employee_code: 'JCB-OPR-802',
        full_name: 'Cross Shop Operator',
        email: 'cross.opr@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        requested_machine_id: crossShopMachineId,
        password: 'ValidPassword123!',
      };

      const ctx = createMockContext(regPayload);
      await registerOperator(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('does not belong to the selected shop floor'));
    });

    it('47. Operator self-registration with non-existent machine ID returns HTTP 404 and malformed UUID returns HTTP 400', async () => {
      // Non-existent machine UUID
      const nonExistentMachineId = 'd0000000-0000-0000-0000-999999999999';
      const ctx404 = createMockContext({
        employee_code: 'JCB-OPR-803',
        full_name: 'Non Existent Machine Op',
        email: 'nonexist.mch@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        requested_machine_id: nonExistentMachineId,
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx404.req, ctx404.res, ctx404.next);
      assert.equal(ctx404.res.statusCode, 404);
      assert.ok(ctx404.res.responseData.message.includes('Requested machine does not exist'));

      // Malformed machine ID
      const ctx400 = createMockContext({
        employee_code: 'JCB-OPR-804',
        full_name: 'Malformed Machine Op',
        email: 'malformed.mch@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        requested_machine_id: 'invalid-not-a-uuid',
        password: 'ValidPassword123!',
      });
      await registerOperator(ctx400.req, ctx400.res, ctx400.next);
      assert.equal(ctx400.res.statusCode, 400);
      assert.ok(ctx400.res.responseData.message.includes('Invalid requested machine ID format'));
    });

    it('48. getPendingOperators returns joined machine metadata and manager approval does not occupy machine', async () => {
      const targetMachineId = 'd0000000-0000-0000-0000-000000000002'; // Under maintenance in shop1
      const initialMachineStatus = mockDb.machines.get(targetMachineId)!.status;

      // 1. Register with machine preference
      const regCtx = createMockContext({
        employee_code: 'JCB-OPR-805',
        full_name: 'Metadata Check Operator',
        email: 'meta.check@jcb.com',
        plant_id: plant1Id,
        shop_id: shop1Id,
        requested_machine_id: targetMachineId,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCtx.req, regCtx.res, regCtx.next);
      assert.equal(regCtx.res.statusCode, 201);
      const newOpId = regCtx.res.responseData.data.id;

      // 2. Manager views pending operators
      const listCtx = createMockContext({}, {}, {}, {}, plant1Manager);
      await getPendingOperators(listCtx.req, listCtx.res, listCtx.next);

      assert.equal(listCtx.res.statusCode, 200);
      const pendingRecord = listCtx.res.responseData.data.find((u: any) => u.id === newOpId);
      assert.ok(pendingRecord);
      assert.equal(pendingRecord.requested_machine_id, targetMachineId);
      assert.equal(pendingRecord.requested_machine_code, 'JCB-MCH-FAB-02');
      assert.equal(pendingRecord.requested_machine_name, 'Hydraulic Press Brake Beta');
      assert.equal(pendingRecord.requested_machine_status, 'under_maintenance');
      assert.equal(pendingRecord.requested_machine_category, 'Press Brake');

      // 3. Manager approves operator registration
      const approveCtx = createMockContext({}, { id: newOpId }, {}, {}, plant1Manager);
      await approveOperator(approveCtx.req, approveCtx.res, approveCtx.next);

      assert.equal(approveCtx.res.statusCode, 200);
      assert.equal(approveCtx.res.responseData.data.is_active, true);
      assert.equal(approveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(approveCtx.res.responseData.data.permanent_machine_id, targetMachineId);

      // 4. Verify machine status is STILL untouched (registration approval does not assign or occupy)
      const afterApprovalMachineStatus = mockDb.machines.get(targetMachineId)!.status;
      assert.equal(afterApprovalMachineStatus, initialMachineStatus);
    });

    it('49. Preferred Machine Request: Shop contains CNC 1, CNC 2, CNC 3; CNC 1 assigned to Operator A, CNC 3 assigned to Operator B; only CNC 2 is available and selectable', async () => {
      // 1. Setup shop and 3 machines: CNC 1, CNC 2, CNC 3
      const cncShopId = 'c0000000-0000-0000-0000-000000000099';
      mockDb.shops.set(cncShopId, {
        id: cncShopId,
        plant_id: plant1Id,
        shop_code: 'SHOP-CNC-99',
        shop_name: 'CNC Machining Bay',
      });

      const cnc1Id = 'd0000000-0000-0000-0000-000000000091';
      const cnc2Id = 'd0000000-0000-0000-0000-000000000092';
      const cnc3Id = 'd0000000-0000-0000-0000-000000000093';

      mockDb.machines.set(cnc1Id, {
        id: cnc1Id,
        machine_code: 'CNC-01',
        name: 'CNC 1',
        shop_id: cncShopId,
        status: 'active',
        category: 'CNC',
        criticality: 'high',
        bay_line_location: 'Bay 1',
        operating_hours: 500,
      });

      mockDb.machines.set(cnc2Id, {
        id: cnc2Id,
        machine_code: 'CNC-02',
        name: 'CNC 2',
        shop_id: cncShopId,
        status: 'active',
        category: 'CNC',
        criticality: 'medium',
        bay_line_location: 'Bay 2',
        operating_hours: 300,
      });

      mockDb.machines.set(cnc3Id, {
        id: cnc3Id,
        machine_code: 'CNC-03',
        name: 'CNC 3',
        shop_id: cncShopId,
        status: 'active',
        category: 'CNC',
        criticality: 'high',
        bay_line_location: 'Bay 3',
        operating_hours: 450,
      });

      // 2. CNC 1 is assigned to Operator A (approved operator with permanent_machine_id)
      const opAId = 'f0000000-0000-0000-0000-000000000081';
      mockDb.users.set(opAId, {
        id: opAId,
        employee_code: 'JCB-OPR-A',
        full_name: 'Operator A',
        email: 'operator.a@jcb.com',
        phone: '+91 9111111111',
        role: 'operator',
        plant_id: plant1Id,
        shop_id: cncShopId,
        department: 'Production',
        designation: 'CNC Operator',
        shift: 'Shift A',
        password_hash: 'hashed',
        is_active: true,
        approval_status: 'approved',
        permanent_machine_id: cnc1Id,
        requested_machine_id: cnc1Id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 3. CNC 3 is assigned to Operator B (operator with permanent_machine_id)
      const opBId = 'f0000000-0000-0000-0000-000000000082';
      mockDb.users.set(opBId, {
        id: opBId,
        employee_code: 'JCB-OPR-B',
        full_name: 'Operator B',
        email: 'operator.b@jcb.com',
        phone: '+91 9222222222',
        role: 'operator',
        plant_id: plant1Id,
        shop_id: cncShopId,
        department: 'Production',
        designation: 'CNC Operator',
        shift: 'Shift A',
        password_hash: 'hashed',
        is_active: true,
        approval_status: 'approved',
        permanent_machine_id: cnc3Id,
        requested_machine_id: cnc3Id,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 4. A new operator opens registration and fetches machines for the shop
      const fetchCtx = createMockContext({}, { shopId: cncShopId }, { plant_id: plant1Id });
      await getRegistrationMachines(fetchCtx.req, fetchCtx.res, fetchCtx.next);

      assert.equal(fetchCtx.res.statusCode, 200);
      assert.equal(fetchCtx.res.responseData.success, true);
      const machinesList = fetchCtx.res.responseData.data;
      assert.equal(machinesList.length, 3);

      const mCNC1 = machinesList.find((m: any) => m.id === cnc1Id);
      const mCNC2 = machinesList.find((m: any) => m.id === cnc2Id);
      const mCNC3 = machinesList.find((m: any) => m.id === cnc3Id);

      // 5. CNC 1 and CNC 3 appear disabled/assigned; CNC 2 is available
      assert.equal(mCNC1.is_assigned, true);
      assert.equal(mCNC1.is_available, false);
      assert.equal(mCNC1.availability_status, 'Assigned');

      assert.equal(mCNC3.is_assigned, true);
      assert.equal(mCNC3.is_available, false);
      assert.equal(mCNC3.availability_status, 'Assigned');

      assert.equal(mCNC2.is_assigned, false);
      assert.equal(mCNC2.is_available, true);
      assert.equal(mCNC2.availability_status, 'Available');

      // 7. Attempting to submit CNC 1 or CNC 3 manually via API must be rejected (HTTP 409)
      const tryCNC1Ctx = createMockContext({
        employee_code: 'JCB-OPR-C1',
        full_name: 'Operator Trying CNC1',
        email: 'try1@jcb.com',
        plant_id: plant1Id,
        shop_id: cncShopId,
        requested_machine_id: cnc1Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(tryCNC1Ctx.req, tryCNC1Ctx.res, tryCNC1Ctx.next);
      assert.equal(tryCNC1Ctx.res.statusCode, 409);
      assert.equal(tryCNC1Ctx.res.responseData.success, false);
      assert.ok(tryCNC1Ctx.res.responseData.message.includes('already assigned to another operator'));

      const tryCNC3Ctx = createMockContext({
        employee_code: 'JCB-OPR-C3',
        full_name: 'Operator Trying CNC3',
        email: 'try3@jcb.com',
        plant_id: plant1Id,
        shop_id: cncShopId,
        requested_machine_id: cnc3Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(tryCNC3Ctx.req, tryCNC3Ctx.res, tryCNC3Ctx.next);
      assert.equal(tryCNC3Ctx.res.statusCode, 409);
      assert.equal(tryCNC3Ctx.res.responseData.success, false);
      assert.ok(tryCNC3Ctx.res.responseData.message.includes('already assigned to another operator'));

      // 6 & 8. Only CNC 2 can be selected: Registration with CNC 2 succeeds
      const regCNC2Ctx = createMockContext({
        employee_code: 'JCB-OPR-C2',
        full_name: 'Operator C (CNC 2)',
        email: 'op.c2@jcb.com',
        plant_id: plant1Id,
        shop_id: cncShopId,
        requested_machine_id: cnc2Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(regCNC2Ctx.req, regCNC2Ctx.res, regCNC2Ctx.next);
      assert.equal(regCNC2Ctx.res.statusCode, 201);
      assert.equal(regCNC2Ctx.res.responseData.success, true);
      assert.equal(regCNC2Ctx.res.responseData.data.requested_machine_id, cnc2Id);
      const newOpId = regCNC2Ctx.res.responseData.data.id;

      // 8. Manager approval continues working correctly
      const approveCtx = createMockContext({}, { id: newOpId }, {}, {}, plant1Manager);
      await approveOperator(approveCtx.req, approveCtx.res, approveCtx.next);
      assert.equal(approveCtx.res.statusCode, 200);
      assert.equal(approveCtx.res.responseData.success, true);
      assert.equal(approveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(approveCtx.res.responseData.data.permanent_machine_id, cnc2Id);

      // Now CNC 2 is also assigned, so registering with CNC 2 again is rejected
      const tryCNC2AgainCtx = createMockContext({
        employee_code: 'JCB-OPR-C4',
        full_name: 'Another Operator Trying CNC2',
        email: 'try2again@jcb.com',
        plant_id: plant1Id,
        shop_id: cncShopId,
        requested_machine_id: cnc2Id,
        password: 'ValidPassword123!',
      });
      await registerOperator(tryCNC2AgainCtx.req, tryCNC2AgainCtx.res, tryCNC2AgainCtx.next);
      assert.equal(tryCNC2AgainCtx.res.statusCode, 409);
    });
  });

  describe('J. Technician Sign-Up & Manager Approval Workflow', () => {
    const plant1Id = 'b0000000-0000-0000-0000-000000000001';
    const shop1Id = 'c0000000-0000-0000-0000-000000000001';
    const plant2Id = 'b0000000-0000-0000-0000-000000000002';
    const shop2Id = 'c0000000-0000-0000-0000-000000000002';

    const plant1Manager: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      email: 'manager@jcb.com',
      role: 'manager',
      plant_id: plant1Id,
      shop_id: shop1Id,
    };

    const plant2Manager: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000077',
      employee_code: 'EMP-MGR-002',
      email: 'manager.pune@jcb.com',
      role: 'manager',
      plant_id: plant2Id,
      shop_id: shop2Id,
    };

    const adminUserContext: AuthenticatedUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
      plant_id: plant1Id,
    };

    const operatorUser: AuthenticatedUser = {
      id: 'u-opr-1',
      employee_code: 'EMP-OPR-999',
      email: 'operator.unauth@jcb.com',
      role: 'operator',
      plant_id: plant1Id,
    };

    const validTechPayload = {
      employee_code: 'JCB-TCH-501',
      full_name: 'Anand Technician',
      email: 'anand.tech@jcb.com',
      phone: '+91 98221 55667',
      plant_id: plant1Id,
      shop_id: shop1Id,
      department: 'Mechanical Maintenance',
      designation: 'Maintenance Specialist',
      shift: 'Shift A',
      skills: ['Mechanical', 'Hydraulic'],
      password: 'SecurePassword123!',
    };

    it('49. Successful technician registration creates account with pending status, is_active=false, and normalized skills', async () => {
      const ctx = createMockContext(validTechPayload);
      await registerTechnician(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.message, 'Technician registration submitted successfully. Your account is pending approval by your Plant Manager.');
      assert.equal(ctx.res.responseData.data.role, 'technician');
      assert.equal(ctx.res.responseData.data.approval_status, 'pending');
      assert.equal(ctx.res.responseData.data.is_active, false);
      assert.deepEqual(ctx.res.responseData.data.skills_json, ['Mechanical', 'Hydraulic']);
      assert.equal(ctx.res.responseData.data.password_hash, undefined);
    });

    it('50. Missing required fields return HTTP 400 Bad Request', async () => {
      const requiredKeys = ['employee_code', 'full_name', 'email', 'phone', 'plant_id', 'shop_id', 'department', 'designation', 'shift', 'password'];
      for (const key of requiredKeys) {
        const payload = { ...validTechPayload, employee_code: `JCB-TCH-REQ-${key}`, email: `req_${key}@jcb.com` };
        delete (payload as any)[key];
        const ctx = createMockContext(payload);
        await registerTechnician(ctx.req, ctx.res, ctx.next);
        assert.equal(ctx.res.statusCode, 400, `Expected 400 for missing ${key}`);
      }
    });

    it('51. Invalid email format returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-BADEMAIL', email: 'invalid-email-address' });
      await registerTechnician(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Invalid employee code, name, or email format'));
    });

    it('52. Invalid password length (< 8 chars) returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-SHORTPASS', email: 'shortpass@jcb.com', password: 'short' });
      await registerTechnician(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Password must be between 8 and 128 characters'));
    });

    it('53. Missing technical skills (empty array) returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-NOSKILLS', email: 'noskills@jcb.com', skills: [] });
      await registerTechnician(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('At least one technical skill must be selected'));
    });

    it('54. Invalid technical skill values return HTTP 400 Bad Request', async () => {
      const ctx = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-BADSKILL', email: 'badskill@jcb.com', skills: ['Mechanical', 'InvalidSkillNotAllowed'] });
      await registerTechnician(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Invalid skill'));
    });

    it('55. Duplicate employee ID returns HTTP 409 Conflict', async () => {
      const ctx1 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-DUP1', email: 'dup1@jcb.com' });
      await registerTechnician(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      const ctx2 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-dup1', email: 'dup1_other@jcb.com' });
      await registerTechnician(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 409);
      assert.ok(ctx2.res.responseData.message.includes('already exists'));
    });

    it('56. Duplicate email address (case-insensitive) returns HTTP 409 Conflict', async () => {
      const ctx1 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-DUP2A', email: 'dupemail@jcb.com' });
      await registerTechnician(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      const ctx2 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-DUP2B', email: 'DUPEMAIL@JCB.COM' });
      await registerTechnician(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 409);
      assert.ok(ctx2.res.responseData.message.includes('already exists'));
    });

    it('57. Invalid plant ID or non-existent plant returns HTTP 404 or 400', async () => {
      const ctx400 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-BADPLANT1', email: 'badplant1@jcb.com', plant_id: 'not-a-uuid' });
      await registerTechnician(ctx400.req, ctx400.res, ctx400.next);
      assert.equal(ctx400.res.statusCode, 400);

      const ctx404 = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-BADPLANT2', email: 'badplant2@jcb.com', plant_id: 'b9999999-9999-9999-9999-999999999999' });
      await registerTechnician(ctx404.req, ctx404.res, ctx404.next);
      assert.equal(ctx404.res.statusCode, 404);
    });

    it('58. Missing shop ID or shop belonging to another plant returns HTTP 400 Bad Request', async () => {
      const ctxMissing = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-NOSHOP', email: 'noshop@jcb.com', shop_id: '' });
      await registerTechnician(ctxMissing.req, ctxMissing.res, ctxMissing.next);
      assert.equal(ctxMissing.res.statusCode, 400);

      const ctxCross = createMockContext({ ...validTechPayload, employee_code: 'JCB-TCH-CROSS', email: 'cross@jcb.com', plant_id: plant1Id, shop_id: shop2Id });
      await registerTechnician(ctxCross.req, ctxCross.res, ctxCross.next);
      assert.equal(ctxCross.res.statusCode, 400);
      assert.ok(ctxCross.res.responseData.message.includes('does not belong'));
    });

    it('59. Request body attempt to tamper role, approval_status, or is_active is ignored and strictly enforced server-side', async () => {
      const maliciousPayload = {
        ...validTechPayload,
        employee_code: 'JCB-TCH-MALICIOUS',
        email: 'malicious.tech@jcb.com',
        role: 'admin',
        approval_status: 'approved',
        is_active: true,
      };
      const ctx = createMockContext(maliciousPayload);
      await registerTechnician(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.data.role, 'technician');
      assert.equal(ctx.res.responseData.data.approval_status, 'pending');
      assert.equal(ctx.res.responseData.data.is_active, false);
    });

    it('60. Newly registered Technician in pending status cannot log in (HTTP 403 Forbidden with clear status message)', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-PENDING-LOGIN',
        email: 'pending.tech@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      assert.equal(regCtx.res.statusCode, 201);

      const loginCtx = createMockContext({
        identifier: 'JCB-TCH-PENDING-LOGIN',
        password: 'SecurePassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 403);
      assert.equal(loginCtx.res.responseData.success, false);
      assert.equal(loginCtx.res.responseData.approval_status, 'pending');
      assert.ok(loginCtx.res.responseData.message.includes('pending approval by your Plant Manager'));
    });

    it('61. Manager can retrieve list of pending technician registrations for their assigned plant facility', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-PLANT1-MGR',
        email: 'p1.tech.mgr@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);

      const ctx = createMockContext({}, {}, {}, {}, plant1Manager);
      await getPendingTechnicians(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      for (const t of ctx.res.responseData.data) {
        assert.equal(t.plant_id, plant1Id);
        assert.equal(t.approval_status, 'pending');
      }
    });

    it('62. Manager from Plant 2 cannot view or approve Technician registered for Plant 1 (HTTP 403 Forbidden)', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-P1-ISOLATION',
        email: 'p1.isolation@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      const newTechId = regCtx.res.responseData.data.id;

      const approveCtx = createMockContext({}, { id: newTechId }, {}, {}, plant2Manager);
      await approveTechnician(approveCtx.req, approveCtx.res, approveCtx.next);

      assert.equal(approveCtx.res.statusCode, 403);
      assert.equal(approveCtx.res.responseData.success, false);
      assert.ok(approveCtx.res.responseData.message.includes('assigned to their own plant facility'));
    });

    it('63. Non-manager/non-admin role cannot approve or reject technicians (requireRoles blocks with HTTP 403)', () => {
      const middleware = requireRoles('manager', 'admin');
      const ctx = createMockContext({}, { id: 'tech-1' }, {}, {}, operatorUser);

      middleware(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.equal(
        ctx.res.responseData.message,
        'You do not have permission to perform this action.'
      );
    });

    it('64. Manager approves Technician: account activated, approval_status set to approved, and technician can now log in', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-APPROVE-FLOW',
        email: 'approve.flow@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      const techId = regCtx.res.responseData.data.id;

      const approveCtx = createMockContext({}, { id: techId }, {}, {}, plant1Manager);
      await approveTechnician(approveCtx.req, approveCtx.res, approveCtx.next);

      assert.equal(approveCtx.res.statusCode, 200);
      assert.equal(approveCtx.res.responseData.success, true);
      assert.equal(approveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(approveCtx.res.responseData.data.is_active, true);

      const loginCtx = createMockContext({
        identifier: 'JCB-TCH-APPROVE-FLOW',
        password: 'SecurePassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 200);
      assert.equal(loginCtx.res.responseData.success, true);
      assert.equal(loginCtx.res.responseData.data.user.role, 'technician');
      assert.ok(loginCtx.res.responseData.data.token);
    });

    it('65. Manager rejects Technician: account marked rejected with reason, and rejected technician cannot log in (HTTP 403)', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-REJECT-FLOW',
        email: 'reject.flow@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      const techId = regCtx.res.responseData.data.id;

      const rejectReason = 'Credentials do not match active plant technical maintenance roster.';
      const rejectCtx = createMockContext({ rejection_reason: rejectReason }, { id: techId }, {}, {}, plant1Manager);
      await rejectTechnician(rejectCtx.req, rejectCtx.res, rejectCtx.next);

      assert.equal(rejectCtx.res.statusCode, 200);
      assert.equal(rejectCtx.res.responseData.success, true);
      assert.equal(rejectCtx.res.responseData.data.approval_status, 'rejected');
      assert.equal(rejectCtx.res.responseData.data.is_active, false);

      const loginCtx = createMockContext({
        identifier: 'JCB-TCH-REJECT-FLOW',
        password: 'SecurePassword123!',
      });
      await login(loginCtx.req, loginCtx.res, loginCtx.next);

      assert.equal(loginCtx.res.statusCode, 403);
      assert.equal(loginCtx.res.responseData.approval_status, 'rejected');
      assert.ok(loginCtx.res.responseData.message.includes(rejectReason));
    });

    it('66. Already approved or non-pending technician cannot be approved or rejected again (HTTP 400 Bad Request)', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-ALREADY-APPROVED',
        email: 'already.approved@jcb.com',
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      const techId = regCtx.res.responseData.data.id;

      const approveCtx1 = createMockContext({}, { id: techId }, {}, {}, plant1Manager);
      await approveTechnician(approveCtx1.req, approveCtx1.res, approveCtx1.next);
      assert.equal(approveCtx1.res.statusCode, 200);

      const approveCtx2 = createMockContext({}, { id: techId }, {}, {}, plant1Manager);
      await approveTechnician(approveCtx2.req, approveCtx2.res, approveCtx2.next);
      assert.equal(approveCtx2.res.statusCode, 400);

      const rejectCtx = createMockContext({ rejection_reason: 'Testing' }, { id: techId }, {}, {}, plant1Manager);
      await rejectTechnician(rejectCtx.req, rejectCtx.res, rejectCtx.next);
      assert.equal(rejectCtx.res.statusCode, 400);
    });

    it('67. Enterprise Admin can view pending technicians across all plants and approve registrations', async () => {
      const regCtx = createMockContext({
        ...validTechPayload,
        employee_code: 'JCB-TCH-ADMIN-GLOBAL',
        email: 'admin.global@jcb.com',
        plant_id: plant2Id,
        shop_id: shop2Id,
      });
      await registerTechnician(regCtx.req, regCtx.res, regCtx.next);
      const newTechId = regCtx.res.responseData.data.id;

      const adminListCtx = createMockContext({}, {}, {}, {}, adminUserContext);
      await getPendingTechnicians(adminListCtx.req, adminListCtx.res, adminListCtx.next);
      assert.equal(adminListCtx.res.statusCode, 200);

      const adminApproveCtx = createMockContext({}, { id: newTechId }, {}, {}, adminUserContext);
      await approveTechnician(adminApproveCtx.req, adminApproveCtx.res, adminApproveCtx.next);
      assert.equal(adminApproveCtx.res.statusCode, 200);
      assert.equal(adminApproveCtx.res.responseData.data.approval_status, 'approved');
      assert.equal(adminApproveCtx.res.responseData.data.is_active, true);
    });
  });
});
