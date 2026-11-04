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
import {
  reportBreakdown,
  getBreakdowns,
  getBreakdownDetails,
  getBreakdownHistory,
  acknowledgeBreakdown,
  updateBreakdownPriority,
  requestAdditionalInfo,
  rejectBreakdown,
  convertBreakdownToWorkOrder,
  setBreakdownsDb,
  resetBreakdownsDb,
  setBreakdownsIo,
  resetBreakdownsIo,
  DbClientLike,
  DbPoolLike,
} from './breakdowns.controller';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { createWorkOrderFromComplaint } from '../work-orders/work-orders.controller';

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
  params: Record<string, string> = {},
  query: Record<string, string> = {},
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
 * Mock Socket.IO Gateway for targeted room assertions
 */
class MockSocketIO {
  public emissions: { room?: string; event: string; data: any }[] = [];

  to(room: string) {
    const self = this;
    return {
      to(innerRoom: string) {
        return self.to(`${room},${innerRoom}`);
      },
      emit(event: string, data: any) {
        self.emissions.push({ room, event, data });
      },
    };
  }

  emit(event: string, data: any) {
    this.emissions.push({ event, data });
  }

  clear() {
    this.emissions = [];
  }
}

/**
 * In-memory Mock Database for CMMS Module 2 Testing
 */
interface MockMachine {
  id: string;
  shop_id: string;
  machine_code: string;
  name: string;
  category: string;
  criticality: string;
  status: string;
  bay_line_location: string;
  operating_hours: number;
}

interface MockComplaint {
  id: string;
  complaint_number: string;
  machine_id: string;
  reported_by_id: string;
  shift: string;
  issue_category: string;
  priority: string;
  status: string;
  breakdown_occurred_at: Date;
  reported_at: Date;
  hour_meter_reading: number | null;
  temperature: number | null;
  pressure: number | null;
  problem_title: string;
  description: string;
  images_json: any;
  manager_remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MockWorkOrder {
  id: string;
  wo_number: string;
  complaint_id: string;
  machine_id: string;
  assigned_technician_id: string;
  assigned_manager_id: string;
  priority: string;
  status: string;
  is_major_breakdown: boolean;
  sla_deadline: Date;
  work_instructions: string;
  breakdown_time: Date;
  reported_time: Date;
  manager_ack_time: Date;
  technician_assigned_time: Date;
  created_at: Date;
  updated_at: Date;
}

class AdvisoryLockManager {
  private locks = new Map<string, { queue: (() => void)[]; locked: boolean }>();

  async acquire(key: string): Promise<void> {
    let entry = this.locks.get(key);
    if (!entry) {
      entry = { queue: [], locked: false };
      this.locks.set(key, entry);
    }
    if (!entry.locked) {
      entry.locked = true;
      return;
    }
    await new Promise<void>((resolve) => entry!.queue.push(resolve));
    entry.locked = true;
  }

  release(key: string): void {
    const entry = this.locks.get(key);
    if (!entry) return;
    if (entry.queue.length > 0) {
      const next = entry.queue.shift()!;
      next();
    } else {
      entry.locked = false;
    }
  }
}

class TransactionLock {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.locked = true;
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

class MockBreakdownsDatabase {
  public users: Map<string, any> = new Map();
  public plants: Map<string, any> = new Map();
  public shops: Map<string, any> = new Map();
  public machines: Map<string, MockMachine> = new Map();
  public maintenance_requests: Map<string, MockComplaint> = new Map();
  public work_orders: Map<string, MockWorkOrder> = new Map();
  public work_order_events: any[] = [];
  public audit_logs: any[] = [];
  public notifications: any[] = [];
  public failMachineUpdate = false;
  public lock = new TransactionLock();
  public advisoryLockManager = new AdvisoryLockManager();
  public queryLog: { text: string; params: any[] }[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    this.users.clear();
    this.plants.clear();
    this.shops.clear();
    this.machines.clear();
    this.maintenance_requests.clear();
    this.work_orders.clear();
    this.work_order_events = [];
    this.audit_logs = [];
    this.notifications = [];
    this.failMachineUpdate = false;
    this.queryLog = [];

    // Plants
    const p1 = { id: 'b0000000-0000-0000-0000-000000000001', plant_name: 'Ballabgarh Central Works' };
    const p2 = { id: 'b0000000-0000-0000-0000-000000000002', plant_name: 'Pune Heavy Machinery' };
    this.plants.set(p1.id, p1);
    this.plants.set(p2.id, p2);

    // Shops
    const s1 = { id: 'c0000000-0000-0000-0000-000000000001', plant_id: p1.id, shop_name: 'Fabrication Shop' };
    const s2 = { id: 'c0000000-0000-0000-0000-000000000002', plant_id: p2.id, shop_name: 'Pune Assembly' };
    this.shops.set(s1.id, s1);
    this.shops.set(s2.id, s2);

    // Machines
    const m1: MockMachine = {
      id: '10000000-0000-0000-0000-000000000001',
      shop_id: s1.id,
      machine_code: 'CNC-001',
      name: 'Mazak HMC 1',
      category: 'HMC',
      criticality: 'class_a',
      status: 'running',
      bay_line_location: 'Bay 1 / Line 4',
      operating_hours: 4320.5,
    };
    const m2: MockMachine = {
      id: '10000000-0000-0000-0000-000000000002',
      shop_id: s1.id,
      machine_code: 'ROB-012',
      name: 'Fanuc Robotic Welder',
      category: 'Robotic Welder',
      criticality: 'class_a',
      status: 'running',
      bay_line_location: 'Bay 2',
      operating_hours: 6140.0,
    };
    const m3: MockMachine = {
      id: '10000000-0000-0000-0000-000000000003',
      shop_id: s2.id, // In Pune Shop
      machine_code: 'PUN-PRESS-01',
      name: 'Pune Forming Press',
      category: 'Press',
      criticality: 'class_b',
      status: 'running',
      bay_line_location: 'Pune Bay 3',
      operating_hours: 1200.0,
    };
    this.machines.set(m1.id, m1);
    this.machines.set(m2.id, m2);
    this.machines.set(m3.id, m3);

    // Users
    const adminUser = {
      id: 'f0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-ADM-001',
      full_name: 'Chief Admin',
      email: 'admin@jcb.com',
      role: 'admin',
      plant_id: null,
      shop_id: null,
      is_active: true,
    };
    const p1Manager = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      full_name: 'Suresh Plant Manager',
      email: 'manager@jcb.com',
      role: 'manager',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
    };
    const p1Technician = {
      id: 'f0000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-TCH-001',
      full_name: 'Anil Senior Technician',
      email: 'technician@jcb.com',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
    };
    const p1Operator = {
      id: 'f0000000-0000-0000-0000-000000000004',
      employee_code: 'EMP-OPR-001',
      full_name: 'Ravi Operator',
      email: 'operator@jcb.com',
      role: 'operator',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
    };
    const p2Operator = {
      id: 'f0000000-0000-0000-0000-000000000005',
      employee_code: 'EMP-OPR-002',
      full_name: 'Pune Operator',
      email: 'pune.operator@jcb.com',
      role: 'operator',
      plant_id: p2.id,
      shop_id: s2.id,
      is_active: true,
    };
    this.users.set(adminUser.id, adminUser);
    this.users.set(p1Manager.id, p1Manager);
    this.users.set(p1Technician.id, p1Technician);
    this.users.set(p1Operator.id, p1Operator);
    this.users.set(p2Operator.id, p2Operator);
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();
    this.queryLog.push({ text: trimmed, params });

    // Advisory lock simulation in standalone query
    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 1 };
    }

    // Machine lookup with join
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE m.id = $1')) {
      const machineId = params[0];
      const m = this.machines.get(machineId);
      if (!m) return { rows: [], rowCount: 0 };
      const s = this.shops.get(m.shop_id);
      const p = s ? this.plants.get(s.plant_id) : undefined;
      return {
        rows: [
          {
            ...m,
            plant_id: s?.plant_id,
            shop_name: s?.shop_name,
            plant_name: p?.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // Machine status update
    if (trimmed.startsWith('UPDATE machines SET status = $1') || trimmed.includes("SET status = 'breakdown'") || trimmed.includes("SET status = 'under_maintenance'") || trimmed.includes("SET status = 'running'")) {
      if (this.failMachineUpdate) {
        throw new Error('Simulated database write error on machines table');
      }
      let newStatus = 'running';
      let machineId = params[params.length - 1];
      if (trimmed.includes("'breakdown'")) newStatus = 'breakdown';
      else if (trimmed.includes("'under_maintenance'")) newStatus = 'under_maintenance';
      else if (trimmed.includes("'running'")) newStatus = 'running';
      else newStatus = params[0];

      const m = this.machines.get(machineId);
      if (m) {
        m.status = newStatus;
      }
      return { rows: [], rowCount: 1 };
    }

    // Duplicate complaint check
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('WHERE machine_id = $1') && trimmed.includes('LOWER(issue_category) = LOWER($2)')) {
      const [machineId, category] = params;
      const match = Array.from(this.maintenance_requests.values()).find(
        (c) =>
          c.machine_id === machineId &&
          c.issue_category.toLowerCase() === String(category).toLowerCase() &&
          !['closed', 'rejected'].includes(c.status)
      );
      return {
        rows: match ? [{ ...match }] : [],
        rowCount: match ? 1 : 0,
      };
    }

    // Sequence next_seq for complaint_number
    if (trimmed.includes('MAX(SUBSTRING(complaint_number FROM')) {
      const prefix = String(params[0] || '').replace(/%/g, '');
      const matching = Array.from(this.maintenance_requests.values()).filter((c) =>
        c.complaint_number.startsWith(prefix)
      );
      const maxSeq = matching.reduce((max, c) => {
        const parts = c.complaint_number.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }, 0);
      return {
        rows: [{ next_seq: maxSeq + 1 }],
        rowCount: 1,
      };
    }

    // Sequence next_seq for wo_number
    if (trimmed.includes('MAX(SUBSTRING(wo_number FROM')) {
      const prefix = String(params[0] || '').replace(/%/g, '');
      const matching = Array.from(this.work_orders.values()).filter((w) =>
        w.wo_number.startsWith(prefix)
      );
      const maxSeq = matching.reduce((max, w) => {
        const parts = w.wo_number.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }, 0);
      return {
        rows: [{ next_seq: maxSeq + 1 }],
        rowCount: 1,
      };
    }

    // Insert maintenance_requests
    if (trimmed.startsWith('INSERT INTO maintenance_requests')) {
      const [
        complaint_number,
        machine_id,
        reported_by_id,
        shift,
        issue_category,
        priority,
        breakdown_occurred_at,
        hour_meter_reading,
        temperature,
        pressure,
        problem_title,
        description,
        images_json,
      ] = params;

      const newId = `f1110000-0000-0000-0000-${String(this.maintenance_requests.size + 1).padStart(12, '0')}`;
      const complaint: MockComplaint = {
        id: newId,
        complaint_number,
        machine_id,
        reported_by_id,
        shift,
        issue_category,
        priority,
        status: 'new',
        breakdown_occurred_at,
        reported_at: new Date(),
        hour_meter_reading,
        temperature,
        pressure,
        problem_title,
        description,
        images_json,
        manager_remarks: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.maintenance_requests.set(newId, complaint);
      return { rows: [complaint], rowCount: 1 };
    }

    // Audit logs insert
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values] = params;
      const log = {
        id: `aud-${this.audit_logs.length + 1}`,
        entity_name,
        entity_id,
        action,
        performed_by,
        old_values,
        new_values,
        created_at: new Date(),
      };
      this.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // Notifications insert
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const [recipient_id, title, message, type, link_url] = params;
      const notif = {
        id: `notif-${this.notifications.length + 1}`,
        recipient_id,
        title,
        message,
        type,
        link_url,
        created_at: new Date(),
      };
      this.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // User lookup for managers/technicians
    if (trimmed.includes('FROM users') && (trimmed.includes("role IN ('admin', 'manager')") || trimmed.includes("role = 'admin'") || trimmed.includes('WHERE id = $1'))) {
      if (trimmed.includes('WHERE id = $1')) {
        const u = this.users.get(params[0]);
        return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
      }
      const plantId = params[0];
      const shopId = params[1];
      const mgrs = Array.from(this.users.values()).filter(
        (u) =>
          ['admin', 'manager'].includes(u.role) &&
          (plantId ? !u.plant_id || u.plant_id === plantId : true) &&
          (shopId ? !u.shop_id || u.shop_id === shopId : true)
      );
      return { rows: mgrs, rowCount: mgrs.length };
    }

    // Maintenance request single lookup
    if (trimmed.includes('FROM maintenance_requests r') && trimmed.includes('WHERE r.id = $1')) {
      const id = params[0];
      const r = this.maintenance_requests.get(id);
      if (!r) return { rows: [], rowCount: 0 };
      const m = this.machines.get(r.machine_id);
      const s = m ? this.shops.get(m.shop_id) : undefined;
      const p = s ? this.plants.get(s.plant_id) : undefined;
      const u = this.users.get(r.reported_by_id);
      const wo = Array.from(this.work_orders.values()).find((w) => w.complaint_id === r.id);
      const tech = wo ? this.users.get(wo.assigned_technician_id) : undefined;

      return {
        rows: [
          {
            ...r,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            machine_criticality: m?.criticality,
            machine_status: m?.status,
            bay_line_location: m?.bay_line_location,
            operating_hours: m?.operating_hours,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: s?.plant_id,
            plant_name: p?.plant_name,
            reported_by_name: u?.full_name,
            reported_by_code: u?.employee_code,
            reported_by_email: u?.email,
            reported_by_phone: '+91 9999999999',
            work_order_id: wo?.id || null,
            wo_number: wo?.wo_number || null,
            work_order_status: wo?.status || null,
            assigned_technician_id: wo?.assigned_technician_id || null,
            assigned_technician_name: tech?.full_name || null,
            assigned_technician_code: tech?.employee_code || null,
          },
        ],
        rowCount: 1,
      };
    }

    // Count query for getBreakdowns
    if (trimmed.includes('SELECT COUNT(r.id)::int AS total') && trimmed.includes('FROM maintenance_requests r')) {
      return {
        rows: [{ total: this.maintenance_requests.size }],
        rowCount: 1,
      };
    }

    // List query for getBreakdowns
    if (trimmed.startsWith('SELECT r.id, r.complaint_number, r.machine_id') && trimmed.includes('FROM maintenance_requests r')) {
      const rows = Array.from(this.maintenance_requests.values()).map((r) => {
        const m = this.machines.get(r.machine_id);
        const s = m ? this.shops.get(m.shop_id) : undefined;
        const p = s ? this.plants.get(s.plant_id) : undefined;
        const u = this.users.get(r.reported_by_id);
        return {
          ...r,
          machine_code: m?.machine_code,
          machine_name: m?.name,
          criticality: m?.criticality,
          machine_status: m?.status,
          shop_id: s?.id,
          shop_name: s?.shop_name,
          plant_id: s?.plant_id,
          plant_name: p?.plant_name,
          reported_by_name: u?.full_name,
          reported_by_code: u?.employee_code,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Audit logs history query
    if (trimmed.includes('FROM audit_logs a') && trimmed.includes("WHERE a.entity_name = 'maintenance_requests'")) {
      const complaintId = params[0];
      const logs = this.audit_logs.filter((a) => a.entity_id === complaintId);
      return {
        rows: logs.map((l) => ({
          ...l,
          performed_by_name: 'Chief Admin',
          performed_by_role: 'admin',
        })),
        rowCount: logs.length,
      };
    }

    // Update maintenance_requests (acknowledge, priority, reject, convert)
    if (trimmed.startsWith('UPDATE maintenance_requests')) {
      const id = params[params.length - 1];
      const r = this.maintenance_requests.get(id);
      if (!r) return { rows: [], rowCount: 0 };

      if (trimmed.includes("status = 'pending_review'")) {
        r.status = 'pending_review';
        if (params[0]) r.manager_remarks = params[0];
      } else if (trimmed.includes("priority = $1")) {
        r.priority = params[0];
      } else if (trimmed.includes("status = 'rejected'")) {
        r.status = 'rejected';
        r.manager_remarks = params[0];
      } else if (trimmed.includes("status = 'work_order_created'")) {
        r.status = 'work_order_created';
      }
      r.updated_at = new Date();
      return { rows: [r], rowCount: 1 };
    }

    // Check existing work_orders for complaint
    if (trimmed.includes('FROM work_orders WHERE complaint_id = $1')) {
      const cmpId = params[0];
      const existing = Array.from(this.work_orders.values()).filter((w) => w.complaint_id === cmpId);
      return { rows: existing, rowCount: existing.length };
    }

    // Count other active complaints for machine
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('machine_id = $1 AND id != $2')) {
      const [machineId, excludeId] = params;
      const count = Array.from(this.maintenance_requests.values()).filter(
        (c) => c.machine_id === machineId && c.id !== excludeId && !['closed', 'rejected'].includes(c.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Count active work orders for machine
    if (trimmed.includes('FROM work_orders') && trimmed.includes('WHERE machine_id = $1')) {
      const machineId = params[0];
      const count = Array.from(this.work_orders.values()).filter(
        (w) => w.machine_id === machineId && !['completed', 'verified_closed'].includes(w.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Insert work_orders
    if (trimmed.startsWith('INSERT INTO work_orders')) {
      const [
        wo_number,
        complaint_id,
        machine_id,
        assigned_technician_id,
        assigned_manager_id,
        priority,
        is_major_breakdown,
        sla_deadline,
        work_instructions,
        breakdown_time,
        reported_time,
      ] = params;

      const newId = `wo-${this.work_orders.size + 1}`;
      const wo: MockWorkOrder = {
        id: newId,
        wo_number,
        complaint_id,
        machine_id,
        assigned_technician_id,
        assigned_manager_id,
        priority,
        status: 'assigned',
        is_major_breakdown,
        sla_deadline,
        work_instructions,
        breakdown_time,
        reported_time,
        manager_ack_time: new Date(),
        technician_assigned_time: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.work_orders.set(newId, wo);
      return { rows: [wo], rowCount: 1 };
    }

    // Insert work_order_events
    if (trimmed.startsWith('INSERT INTO work_order_events')) {
      const [work_order_id, event_type, performed_by, notes] = params;
      const evt = { id: `evt-${this.work_order_events.length + 1}`, work_order_id, event_type, performed_by, notes };
      this.work_order_events.push(evt);
      return { rows: [evt], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  getPool(): DbPoolLike {
    const self = this;
    return {
      async connect(): Promise<DbClientLike> {
        let inTx = false;
        let holdingLock = false;
        const heldAdvisoryLocks = new Set<string>();
        let snapshot: {
          requests: Map<string, MockComplaint>;
          machines: Map<string, MockMachine>;
          work_orders: Map<string, MockWorkOrder>;
          audit_logs: any[];
          notifications: any[];
        } | null = null;

        return {
          async query(text: string, params: any[] = []) {
            const trimmed = text.trim();
            if (trimmed === 'BEGIN') {
              inTx = true;
              snapshot = {
                requests: new Map(Array.from(self.maintenance_requests.entries()).map(([k, v]) => [k, { ...v }])),
                machines: new Map(Array.from(self.machines.entries()).map(([k, v]) => [k, { ...v }])),
                work_orders: new Map(Array.from(self.work_orders.entries()).map(([k, v]) => [k, { ...v }])),
                audit_logs: [...self.audit_logs],
                notifications: [...self.notifications],
              };
              return { rows: [], rowCount: 0 };
            }

            if (trimmed === 'COMMIT') {
              inTx = false;
              snapshot = null;
              if (holdingLock) {
                holdingLock = false;
                self.lock.release();
              }
              for (const k of heldAdvisoryLocks) {
                self.advisoryLockManager.release(k);
              }
              heldAdvisoryLocks.clear();
              return { rows: [], rowCount: 0 };
            }

            if (trimmed === 'ROLLBACK') {
              inTx = false;
              if (snapshot) {
                self.maintenance_requests = snapshot.requests;
                self.machines = snapshot.machines;
                self.work_orders = snapshot.work_orders;
                self.audit_logs = snapshot.audit_logs;
                self.notifications = snapshot.notifications;
                snapshot = null;
              }
              if (holdingLock) {
                holdingLock = false;
                self.lock.release();
              }
              for (const k of heldAdvisoryLocks) {
                self.advisoryLockManager.release(k);
              }
              heldAdvisoryLocks.clear();
              return { rows: [], rowCount: 0 };
            }

            if (trimmed.includes('pg_advisory_xact_lock')) {
              const lockKey = String(params[0] || 'default');
              heldAdvisoryLocks.add(lockKey);
              await self.advisoryLockManager.acquire(lockKey);
              return self.query(text, params);
            }

            if (trimmed.includes('FOR UPDATE') && !holdingLock) {
              holdingLock = true;
              await self.lock.acquire();
            }

            return self.query(text, params);
          },
          release() {
            if (holdingLock) {
              holdingLock = false;
              self.lock.release();
            }
            for (const k of heldAdvisoryLocks) {
              self.advisoryLockManager.release(k);
            }
            heldAdvisoryLocks.clear();
          },
        };
      },
    };
  }
}

describe('Breakdown Management Module (CMMS Module 2)', () => {
  let mockDb: MockBreakdownsDatabase;
  let mockIo: MockSocketIO;

  beforeEach(() => {
    mockDb = new MockBreakdownsDatabase();
    mockIo = new MockSocketIO();
    setBreakdownsDb(mockDb.query.bind(mockDb), mockDb.getPool());
    setBreakdownsIo(mockIo);
  });

  // ==========================================
  // SECTION 1: REPORTING BREAKDOWNS (POST /)
  // ==========================================
  describe('1. Reporting Breakdowns (POST /)', () => {
    it('1. Valid operator breakdown report creates complaint and transitions machine to breakdown status', async () => {
      const operatorUser: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000004',
        employee_code: 'EMP-OPR-001',
        email: 'operator@jcb.com',
        role: 'operator',
        plant_id: 'b0000000-0000-0000-0000-000000000001',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      };

      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          priority: 'high',
          problem_title: 'Spindle Drive Inverter Overload Tripping',
          description: 'Spindle motor tripped out on fault code E-041 during high-torque milling operation.',
          hour_meter_reading: 4325.2,
          temperature: 78.5,
          pressure: 6.2,
          shift: 'Shift A',
          images_json: ['https://jcb-assets.local/spindle-overheat.jpg'],
        },
        {},
        {},
        {},
        operatorUser
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.message, 'Complaint submitted successfully. Manager notified.');

      const complaint = ctx.res.responseData.data;
      assert.ok(complaint.complaint_number.startsWith('CMP-'));
      assert.equal(complaint.status, 'new');
      assert.equal(complaint.issue_category, 'electrical');
      assert.equal(complaint.priority, 'high');
      assert.equal(complaint.reported_by_id, operatorUser.id);

      // Verify physical machine status updated atomically to 'breakdown'
      const machine = mockDb.machines.get('10000000-0000-0000-0000-000000000001');
      assert.equal(machine?.status, 'breakdown');

      // Verify audit trail record was inserted
      assert.equal(mockDb.audit_logs.length, 1);
      assert.equal(mockDb.audit_logs[0].action, 'BREAKDOWN_CREATED');

      // Verify targeted notifications sent to plant managers
      assert.ok(mockDb.notifications.length >= 1);
      assert.ok(mockDb.notifications.some((n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000002'));

      // Verify targeted socket emissions to plant and shop rooms (no global broadcast)
      assert.ok(mockIo.emissions.some((e) => e.room === 'plant:b0000000-0000-0000-0000-000000000001'));
      assert.ok(mockIo.emissions.some((e) => e.room === 'shop:c0000000-0000-0000-0000-000000000001'));
    });

    it('2. Missing required fields returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          // missing issue_category, problem_title, description
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Missing required complaint parameters'));
    });

    it('3. Invalid machine UUID returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext(
        {
          machine_id: 'invalid-non-uuid-1234',
          issue_category: 'mechanical',
          problem_title: 'Bearing vibration',
          description: 'High vibration on headstock',
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(ctx.res.responseData.message, 'Invalid machine ID.');
    });

    it('4. Nonexistent machine returns HTTP 404 Not Found', async () => {
      const ctx = createMockContext(
        {
          machine_id: '99999999-9999-9999-9999-999999999999',
          issue_category: 'hydraulic',
          problem_title: 'Hose rupture',
          description: 'Hydraulic leak detected',
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 404);
      assert.equal(ctx.res.responseData.message, 'Machine not found.');
    });

    it('5. Invalid priority returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          priority: 'urgent_super_high', // Invalid enum value
          problem_title: 'Fault code E-041',
          description: 'Tripped inverter',
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Invalid priority'));
    });

    it('6. Invalid issue category returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'software_bug', // Invalid category
          problem_title: 'Software crashed',
          description: 'HMI frozen',
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Invalid issue category'));
    });

    it('7. Invalid numeric readings (negative hour meter, invalid temperature) return HTTP 400', async () => {
      // Negative hour meter
      const ctx1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          problem_title: 'Vibration detected',
          description: 'Excessive spindle vibration',
          hour_meter_reading: -50.0,
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );
      await reportBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);

      // Non-numeric temperature string
      const ctx2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          problem_title: 'Overheating bearing',
          description: 'Bearing too hot',
          temperature: 'extremely_hot_not_a_number',
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );
      await reportBreakdown(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);
    });

    it('8. Invalid occurrence timestamp in the future returns HTTP 400 Bad Request', async () => {
      const futureDate = new Date(Date.now() + 24 * 3600 * 1000); // 1 day in future
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Future tripping',
          description: 'Spindle will trip tomorrow',
          breakdown_occurred_at: futureDate.toISOString(),
        },
        {},
        {},
        {},
        mockDb.users.get('f0000000-0000-0000-0000-000000000004')
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('cannot be in the future'));
    });

    it('9. Unauthorized cross-plant / cross-shop machine report is rejected with HTTP 403 Forbidden', async () => {
      // Operator from Pune (Plant 2, Shop 2) attempts to report a breakdown on Ballabgarh (Plant 1, Shop 1) machine
      const puneOperator = mockDb.users.get('f0000000-0000-0000-0000-000000000005');
      const ballabgarhMachineId = '10000000-0000-0000-0000-000000000001';

      const ctx = createMockContext(
        {
          machine_id: ballabgarhMachineId,
          issue_category: 'safety',
          problem_title: 'Emergency stop failure',
          description: 'E-stop button sticking',
        },
        {},
        {},
        {},
        puneOperator
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('not authorized'));
    });

    it('10. Duplicate open request for same machine and same issue category returns HTTP 409 Conflict', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      // First report: electrical breakdown on machine 1
      const ctx1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'First electrical trip',
          description: 'Spindle motor tripping',
        },
        {},
        {},
        {},
        operatorUser
      );
      await reportBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      // Second report: duplicate electrical breakdown on machine 1 while complaint is active
      const ctx2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Second electrical trip report',
          description: 'Same spindle motor tripping again',
        },
        {},
        {},
        {},
        operatorUser
      );
      await reportBreakdown(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 409);
      assert.equal(ctx2.res.responseData.isDuplicate, true);
      assert.ok(ctx2.res.responseData.message.includes('Duplicate Warning'));
    });

    it('11. Different issue category on same machine is NOT blocked as duplicate', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      // First report: electrical issue on machine 1
      const ctx1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Sensor communication fault',
          description: 'Profibus communication dropped',
        },
        {},
        {},
        {},
        operatorUser
      );
      await reportBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      // Second report: DIFFERENT issue category (hydraulic leak) on same machine
      const ctx2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'hydraulic',
          problem_title: 'Clamping pressure drop',
          description: 'Workpiece fixture hydraulic pressure low',
        },
        {},
        {},
        {},
        operatorUser
      );
      await reportBreakdown(ctx2.req, ctx2.res, ctx2.next);

      // Must succeed because issue categories are distinct!
      assert.equal(ctx2.res.statusCode, 201);
      assert.equal(ctx2.res.responseData.success, true);
      assert.equal(ctx2.res.responseData.data.issue_category, 'hydraulic');
    });

    it('12. Concurrent duplicate submissions are serialized safely without race conditions', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      const payload = {
        machine_id: '10000000-0000-0000-0000-000000000002',
        issue_category: 'mechanical',
        problem_title: 'Linear guideway seized',
        description: 'X-axis guideway stuck on limit switch',
      };

      const ctxA = createMockContext(payload, {}, {}, {}, operatorUser);
      const ctxB = createMockContext(payload, {}, {}, {}, operatorUser);

      // Execute concurrently
      await Promise.all([
        reportBreakdown(ctxA.req, ctxA.res, ctxA.next),
        reportBreakdown(ctxB.req, ctxB.res, ctxB.next),
      ]);

      const statusCodes = [ctxA.res.statusCode, ctxB.res.statusCode].sort();
      // Exactly one must succeed (201) and one must be caught by duplicate detection (409)
      assert.deepEqual(statusCodes, [201, 409]);
    });

    it('13. Unique complaint number sequence is maintained under concurrent submissions', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      // Submit reports for distinct categories on different machines
      const ctx1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Issue 1',
          description: 'Desc 1',
        },
        {},
        {},
        {},
        operatorUser
      );

      const ctx2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000002',
          issue_category: 'hydraulic',
          problem_title: 'Issue 2',
          description: 'Desc 2',
        },
        {},
        {},
        {},
        operatorUser
      );

      await Promise.all([
        reportBreakdown(ctx1.req, ctx1.res, ctx1.next),
        reportBreakdown(ctx2.req, ctx2.res, ctx2.next),
      ]);

      assert.equal(ctx1.res.statusCode, 201);
      assert.equal(ctx2.res.statusCode, 201);

      const num1 = ctx1.res.responseData.data.complaint_number;
      const num2 = ctx2.res.responseData.data.complaint_number;
      assert.notEqual(num1, num2);
    });

    it('14. Database rollback when machine status update fails: complaint is not committed', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      // Simulate database failure during machine status update step
      mockDb.failMachineUpdate = true;

      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'lubrication',
          problem_title: 'Lube oil level low',
          description: 'Central lubrication pressure switch fault',
        },
        {},
        {},
        {},
        operatorUser
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      // Caught by transaction error handler and passed to next(err) -> 500
      assert.equal(ctx.res.statusCode, 500);

      // Verify complaint was not committed to DB due to rollback
      const complaints = Array.from(mockDb.maintenance_requests.values());
      assert.equal(complaints.length, 0);
    });

    it('15. Critical breakdown notification triggers escalation to plant manager and senior team', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'safety',
          priority: 'critical',
          problem_title: 'Safety Interlock Curtain Bypassed',
          description: 'Optical safety light curtain failure while robot in cycle',
        },
        {},
        {},
        {},
        operatorUser
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);

      // Check critical notification in DB
      const criticalNotifs = mockDb.notifications.filter((n) => n.type === 'critical');
      assert.ok(criticalNotifs.length >= 1);
      assert.ok(criticalNotifs[0].title.includes('CRITICAL'));

      // Check critical socket room emission
      assert.ok(mockIo.emissions.some((e) => e.event === 'complaint:critical'));
    });
  });

  // ==========================================
  // SECTION 2: LISTING & DETAILS
  // ==========================================
  describe('2. Listing & Details', () => {
    beforeEach(async () => {
      // Seed a test complaint
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Ball screw backlash',
          description: 'Z-axis ball screw backlash exceeding tolerance',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctx.req, ctx.res, ctx.next);
    });

    it('16. List breakdowns retrieves complaints with pagination and machine details', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const ctx = createMockContext({}, {}, { page: '1', limit: '20' }, {}, managerUser);

      await getBreakdowns(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(Array.isArray(ctx.res.responseData.data), true);
      assert.equal(ctx.res.responseData.pagination.page, 1);
      assert.equal(ctx.res.responseData.pagination.limit, 20);
      assert.equal(ctx.res.responseData.pagination.total, 1);
    });

    it('17. Pagination parameter validation strictly rejects invalid values', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      // Negative page
      const ctx1 = createMockContext({}, {}, { page: '-2' }, {}, adminUser);
      await getBreakdowns(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);

      // Limit exceeding 100
      const ctx2 = createMockContext({}, {}, { limit: '500' }, {}, adminUser);
      await getBreakdowns(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);

      // Invalid sort column (SQL injection defense)
      const ctx3 = createMockContext({}, {}, { sort_by: 'malicious_column; DROP TABLE users;' }, {}, adminUser);
      await getBreakdowns(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 400);
      assert.ok(ctx3.res.responseData.message.includes('Invalid sort field'));
    });

    it('18. Search and filtering by status, priority, and machine ID', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      // Filter by status 'new'
      const ctx1 = createMockContext({}, {}, { status: 'new' }, {}, adminUser);
      await getBreakdowns(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 200);

      // Filter by priority 'high'
      const ctx2 = createMockContext({}, {}, { priority: 'high' }, {}, adminUser);
      await getBreakdowns(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 200);

      // Search query
      const ctx3 = createMockContext({}, {}, { search: 'backlash' }, {}, adminUser);
      await getBreakdowns(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 200);
    });

    it('19. Total count and totalPages calculated accurately in pagination metadata', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      const ctx = createMockContext({}, {}, { page: '1', limit: '10' }, {}, adminUser);

      await getBreakdowns(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(typeof ctx.res.responseData.pagination.total, 'number');
      assert.equal(typeof ctx.res.responseData.pagination.totalPages, 'number');
      assert.ok(ctx.res.responseData.pagination.totalPages >= 1);
    });

    it('20. Cross-plant access rejection on breakdown detail endpoint', async () => {
      const complaints = Array.from(mockDb.maintenance_requests.values());
      const ballabgarhComplaintId = complaints[0].id;

      // Pune Manager attempts to access Ballabgarh breakdown detail
      const puneManager: AuthenticatedUser = {
        id: 'f0000000-0000-0000-0000-000000000099',
        employee_code: 'PUN-MGR',
        email: 'pune.mgr@jcb.com',
        role: 'manager',
        plant_id: 'b0000000-0000-0000-0000-000000000002', // Pune Plant
        shop_id: 'c0000000-0000-0000-0000-000000000002',
      };

      const ctx = createMockContext({}, { id: ballabgarhComplaintId }, {}, {}, puneManager);
      await getBreakdownDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('restricted'));
    });

    it('21. Retrieve breakdown details includes machine, shop, plant, and reporter metadata', async () => {
      const complaints = Array.from(mockDb.maintenance_requests.values());
      const complaintId = complaints[0].id;
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, { id: complaintId }, {}, {}, adminUser);
      await getBreakdownDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      const data = ctx.res.responseData.data;
      assert.equal(data.id, complaintId);
      assert.equal(data.machine_code, 'CNC-001');
      assert.equal(data.shop_name, 'Fabrication Shop');
      assert.equal(data.plant_name, 'Ballabgarh Central Works');
      assert.equal(data.reported_by_name, 'Ravi Operator');
    });

    it('22. Retrieve breakdown history returns chronological lifecycle events', async () => {
      const complaints = Array.from(mockDb.maintenance_requests.values());
      const complaintId = complaints[0].id;
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, { id: complaintId }, {}, {}, adminUser);
      await getBreakdownHistory(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(Array.isArray(ctx.res.responseData.data), true);
      assert.ok(ctx.res.responseData.data.length >= 1);
      assert.equal(ctx.res.responseData.data[0].action, 'BREAKDOWN_CREATED');
    });

    it('23. Nonexistent breakdown returns HTTP 404 Not Found', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      const ctx = createMockContext(
        {},
        { id: '88888888-8888-8888-8888-888888888888' },
        {},
        {},
        adminUser
      );

      await getBreakdownDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 404);
      assert.equal(ctx.res.responseData.message, 'Breakdown request not found.');
    });
  });

  // ==========================================
  // SECTION 3: MANAGER WORKFLOW ACTIONS
  // ==========================================
  describe('3. Manager Workflow Governance', () => {
    let testComplaintId: string;

    beforeEach(async () => {
      // Create fresh breakdown for each manager test
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'hydraulic',
          priority: 'medium',
          problem_title: 'Hydraulic accumulator leak',
          description: 'Nitrogen gas pressure dropping in accumulator circuit',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      testComplaintId = ctx.res.responseData.data.id;
    });

    it('24. Successful acknowledgement updates status to pending_review and notifies operator', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const ctx = createMockContext(
        { remarks: 'Acknowledged. Maintenance team will inspect in 15 minutes.' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );

      await acknowledgeBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.status, 'pending_review');
      assert.equal(ctx.res.responseData.data.manager_remarks, 'Acknowledged. Maintenance team will inspect in 15 minutes.');

      // Check notification sent to operator
      const opNotifs = mockDb.notifications.filter(
        (n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000004'
      );
      assert.ok(opNotifs.length >= 1);
      assert.ok(opNotifs.some((n) => n.title.includes('Acknowledged')));
    });

    it('25. Invalid acknowledgement transition: repeated acknowledgement returns HTTP 400', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // First acknowledgement transitions to pending_review
      const ctx1 = createMockContext({}, { id: testComplaintId }, {}, {}, managerUser);
      await acknowledgeBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 200);

      // Second acknowledgement attempted on pending_review status
      const ctx2 = createMockContext({}, { id: testComplaintId }, {}, {}, managerUser);
      await acknowledgeBreakdown(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 400);
      assert.ok(ctx2.res.responseData.message.includes('cannot be acknowledged in current status'));
    });

    it('26. Priority update modifies priority and records audit log', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const ctx = createMockContext(
        { priority: 'critical' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );

      await updateBreakdownPriority(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.priority, 'critical');

      // Check audit log for priority update
      assert.ok(mockDb.audit_logs.some((a) => a.action === 'BREAKDOWN_PRIORITY_UPDATED'));
    });

    it('27. Invalid priority returns HTTP 400 Bad Request', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const ctx = createMockContext(
        { priority: 'invalid_priority_level' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );

      await updateBreakdownPriority(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Invalid priority'));
    });

    it('28. Request additional information requires mandatory remarks', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // Missing remarks
      const ctx1 = createMockContext({}, { id: testComplaintId }, {}, {}, managerUser);
      await requestAdditionalInfo(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.ok(ctx1.res.responseData.message.includes('mandatory'));

      // Valid remarks
      const ctx2 = createMockContext(
        { remarks: 'Please specify if pressure gauge is fluctuating or steady zero.' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );
      await requestAdditionalInfo(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 200);
      assert.equal(ctx2.res.responseData.success, true);
    });

    it('29. Reject breakdown requires mandatory reason and restores machine status when no other faults active', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // Missing rejection reason
      const ctx1 = createMockContext({}, { id: testComplaintId }, {}, {}, managerUser);
      await rejectBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.ok(ctx1.res.responseData.message.includes('mandatory'));

      // Machine was in 'breakdown'
      const mBefore = mockDb.machines.get('10000000-0000-0000-0000-000000000001');
      assert.equal(mBefore?.status, 'breakdown');

      // Valid rejection
      const ctx2 = createMockContext(
        { rejection_reason: 'False alarm. Operator resolved after bleeding air valve.' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );
      await rejectBreakdown(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 200);
      assert.equal(ctx2.res.responseData.data.status, 'rejected');

      // Machine status should be safely restored to 'running' because no other complaints are active
      const mAfter = mockDb.machines.get('10000000-0000-0000-0000-000000000001');
      assert.equal(mAfter?.status, 'running');
    });

    it('30. Invalid rejection transition: cannot reject already rejected or closed breakdown', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // First rejection
      const ctx1 = createMockContext(
        { rejection_reason: 'Resolved by operator' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );
      await rejectBreakdown(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 200);

      // Attempt second rejection on same breakdown
      const ctx2 = createMockContext(
        { rejection_reason: 'Repeat rejection attempt' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );
      await rejectBreakdown(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 400);
      assert.equal(ctx2.res.responseData.message, 'Breakdown is already rejected.');
    });

    it('31. Unauthorized operator/technician manager actions are blocked with HTTP 403 by RBAC', () => {
      const managerGuard = requireRoles('admin', 'manager');

      // Operator attempt
      const ctxOp = createMockContext({}, {}, {}, {}, mockDb.users.get('f0000000-0000-0000-0000-000000000004'));
      managerGuard(ctxOp.req, ctxOp.res, ctxOp.next);
      assert.equal(ctxOp.res.statusCode, 403);

      // Technician attempt
      const ctxTech = createMockContext({}, {}, {}, {}, mockDb.users.get('f0000000-0000-0000-0000-000000000003'));
      managerGuard(ctxTech.req, ctxTech.res, ctxTech.next);
      assert.equal(ctxTech.res.statusCode, 403);
    });

    it('32. Successful work-order conversion links breakdown and updates machine to under_maintenance', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const technicianId = 'f0000000-0000-0000-0000-000000000003';

      const ctx = createMockContext(
        {
          technician_id: technicianId,
          sla_hours: 6,
          work_instructions: 'Replace accumulator bladder and recharge nitrogen to 120 bar.',
          is_major_breakdown: false,
        },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );

      await convertBreakdownToWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);

      const workOrder = ctx.res.responseData.data.workOrder;
      assert.ok(workOrder.wo_number.startsWith('WO-'));
      assert.equal(workOrder.complaint_id, testComplaintId);
      assert.equal(workOrder.assigned_technician_id, technicianId);
      assert.equal(workOrder.status, 'assigned');

      // Verify complaint status transitioned to 'work_order_created'
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assert.equal(complaint?.status, 'work_order_created');

      // Verify machine status updated to 'under_maintenance'
      const machine = mockDb.machines.get('10000000-0000-0000-0000-000000000001');
      assert.equal(machine?.status, 'under_maintenance');

      // Verify notification sent to assigned technician
      const techNotifs = mockDb.notifications.filter((n) => n.recipient_id === technicianId);
      assert.ok(techNotifs.length >= 1);
      assert.equal(techNotifs[0].type, 'assignment');
    });

    it('33. Repeated conversion does not create duplicate work orders (HTTP 409 Conflict)', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const technicianId = 'f0000000-0000-0000-0000-000000000003';

      // First conversion
      const ctx1 = createMockContext({ technician_id: technicianId }, { id: testComplaintId }, {}, {}, managerUser);
      await convertBreakdownToWorkOrder(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 201);

      // Second conversion attempt on same complaint
      const ctx2 = createMockContext({ technician_id: technicianId }, { id: testComplaintId }, {}, {}, managerUser);
      await convertBreakdownToWorkOrder(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 409);
      assert.ok(ctx2.res.responseData.message.includes('already'));
    });

    it('34. Failed conversion rolls back safely without leaving orphan work orders', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // Non-existent technician ID
      const ctx = createMockContext(
        { technician_id: '88888888-8888-8888-8888-888888888888' },
        { id: testComplaintId },
        {},
        {},
        managerUser
      );

      await convertBreakdownToWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);

      // Verify no work orders were inserted
      assert.equal(mockDb.work_orders.size, 0);

      // Verify complaint status was not corrupted
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assert.equal(complaint?.status, 'new');
    });

    it('35. Machine status preservation: rejecting one breakdown leaves machine in breakdown if other complaints exist', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // Second complaint on SAME machine (different category: electrical)
      const ctxSecond = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Limit switch open circuit',
          description: 'Emergency stop circuit open',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxSecond.req, ctxSecond.res, ctxSecond.next);
      const secondComplaintId = ctxSecond.res.responseData.data.id;

      // Reject the first (hydraulic) complaint
      const ctxRejectFirst = createMockContext(
        { rejection_reason: 'Hydraulic accumulator was already charged' },
        { id: testComplaintId },
        {},
        {},
        mgr
      );
      await rejectBreakdown(ctxRejectFirst.req, ctxRejectFirst.res, ctxRejectFirst.next);

      assert.equal(ctxRejectFirst.res.statusCode, 200);

      // Machine status MUST NOT be set to 'running' because secondComplaintId is still active!
      const m = mockDb.machines.get('10000000-0000-0000-0000-000000000001');
      assert.equal(m?.status, 'breakdown');
    });
  });

  // ==========================================
  // SECTION 4: REGRESSION & CROSS-MODULE INTEGRATION
  // ==========================================
  describe('4. Regression & Cross-Module Integration', () => {
    it('36. Work Orders module integration: Work order references complaint_id and machine_id correctly', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';

      const ctxReport = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          problem_title: 'Coupling sheared',
          description: 'Motor to ball screw coupling sheared',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxReport.req, ctxReport.res, ctxReport.next);
      const cmpId = ctxReport.res.responseData.data.id;

      const ctxConvert = createMockContext(
        { technician_id: techId, sla_hours: 8 },
        { id: cmpId },
        {},
        {},
        mgr
      );
      await convertBreakdownToWorkOrder(ctxConvert.req, ctxConvert.res, ctxConvert.next);

      assert.equal(ctxConvert.res.statusCode, 201);
      const wo = ctxConvert.res.responseData.data.workOrder;
      assert.equal(wo.complaint_id, cmpId);
      assert.equal(wo.machine_id, '10000000-0000-0000-0000-000000000001');
      assert.equal(wo.status, 'assigned');
    });

    it('37. Notifications integration: Real-time and in-app notifications dispatched for all lifecycle stages', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      // 1. Report
      const ctxReport = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'safety',
          priority: 'high',
          problem_title: 'Safety Interlock',
          description: 'Gate lock open',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxReport.req, ctxReport.res, ctxReport.next);
      const cmpId = ctxReport.res.responseData.data.id;

      // 2. Request Info
      const ctxInfo = createMockContext({ remarks: 'Is it door 1 or door 2?' }, { id: cmpId }, {}, {}, mgr);
      await requestAdditionalInfo(ctxInfo.req, ctxInfo.res, ctxInfo.next);

      // Verify notification created for operator
      const opNotifs = mockDb.notifications.filter((n) => n.recipient_id === op.id);
      assert.ok(opNotifs.length >= 1);
    });

    it('38. Downtime and Reports timestamp integration: Breakdown timestamps preserved accurately', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const occurredAt = new Date('2026-05-10T14:30:00Z');

      const ctxReport = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Power spike trip',
          description: 'Spindle tripped at 14:30',
          breakdown_occurred_at: occurredAt.toISOString(),
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxReport.req, ctxReport.res, ctxReport.next);

      const complaint = ctxReport.res.responseData.data;
      assert.equal(new Date(complaint.breakdown_occurred_at).getTime(), occurredAt.getTime());
      assert.ok(complaint.reported_at);
    });

    it('39. API response compatibility: Standard success/data envelope preserved across all endpoints', async () => {
      const admin = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      const ctxList = createMockContext({}, {}, {}, {}, admin);
      await getBreakdowns(ctxList.req, ctxList.res, ctxList.next);

      assert.equal(ctxList.res.statusCode, 200);
      assert.equal(ctxList.res.responseData.success, true);
      assert.ok(Array.isArray(ctxList.res.responseData.data));
      assert.ok(ctxList.res.responseData.pagination);
    });
  });

  // ==========================================
  // SECTION 5: CONCURRENCY & REUSABLE WORK ORDER SERVICE VERIFICATION
  // ==========================================
  describe('5. Concurrency & Reusable Work Order Service Verification', () => {
    it('40. Multi-machine concurrent complaint numbering generates distinct, sequential complaint numbers without collision', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      // Two different machines, both reported concurrently
      const ctx1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'CNC Drive Fault',
          description: 'Spindle drive alarm',
        },
        {},
        {},
        {},
        op
      );

      const ctx2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000002',
          issue_category: 'hydraulic',
          problem_title: 'Welder clamp pressure drop',
          description: 'Hydraulic accumulator low',
        },
        {},
        {},
        {},
        op
      );

      await Promise.all([
        reportBreakdown(ctx1.req, ctx1.res, ctx1.next),
        reportBreakdown(ctx2.req, ctx2.res, ctx2.next),
      ]);

      assert.equal(ctx1.res.statusCode, 201);
      assert.equal(ctx2.res.statusCode, 201);

      const num1 = ctx1.res.responseData.data.complaint_number;
      const num2 = ctx2.res.responseData.data.complaint_number;

      // Extract sequence numbers
      const seq1 = parseInt(num1.split('-')[2], 10);
      const seq2 = parseInt(num2.split('-')[2], 10);

      assert.notEqual(num1, num2);
      const seqs = [seq1, seq2].sort((a, b) => a - b);
      assert.deepEqual(seqs, [1, 2]);
    });

    it('41. Advisory lock is acquired BEFORE MAX sequence query during breakdown reporting', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      mockDb.queryLog = [];

      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          problem_title: 'Bearing vibration',
          description: 'Vibration detected on axis Y',
        },
        {},
        {},
        {},
        op
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);

      const lockQueryIdx = mockDb.queryLog.findIndex((q) =>
        q.text.includes('pg_advisory_xact_lock') &&
        q.params?.some((p) => String(p).startsWith('complaint_seq:'))
      );
      const maxQueryIdx = mockDb.queryLog.findIndex((q) =>
        q.text.includes('MAX(SUBSTRING(complaint_number')
      );

      assert.ok(lockQueryIdx >= 0, 'pg_advisory_xact_lock must be invoked for complaint numbering');
      assert.ok(maxQueryIdx >= 0, 'MAX query must be executed');
      assert.ok(
        lockQueryIdx < maxQueryIdx,
        `Advisory lock (idx: ${lockQueryIdx}) must be acquired BEFORE the MAX sequence query (idx: ${maxQueryIdx})`
      );

      // Verify lock key format complaint_seq:YYYY
      const currentYear = new Date().getFullYear();
      assert.equal(mockDb.queryLog[lockQueryIdx].params[0], `complaint_seq:${currentYear}`);
    });

    it('42. Multi-complaint concurrent work order conversion generates distinct, sequential work order numbers without collision', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';

      // Create two complaints on two machines
      const ctxCmp1 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'electrical',
          problem_title: 'Breakdown 1',
          description: 'Fault 1',
        },
        {},
        {},
        {},
        op
      );
      const ctxCmp2 = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000002',
          issue_category: 'mechanical',
          problem_title: 'Breakdown 2',
          description: 'Fault 2',
        },
        {},
        {},
        {},
        op
      );

      await reportBreakdown(ctxCmp1.req, ctxCmp1.res, ctxCmp1.next);
      await reportBreakdown(ctxCmp2.req, ctxCmp2.res, ctxCmp2.next);

      const cmp1Id = ctxCmp1.res.responseData.data.id;
      const cmp2Id = ctxCmp2.res.responseData.data.id;

      // Concurrently convert both complaints to work orders
      const ctxWo1 = createMockContext(
        { technician_id: techId, sla_hours: 4, work_instructions: 'Fix 1' },
        { id: cmp1Id },
        {},
        {},
        mgr
      );
      const ctxWo2 = createMockContext(
        { technician_id: techId, sla_hours: 4, work_instructions: 'Fix 2' },
        { id: cmp2Id },
        {},
        {},
        mgr
      );

      await Promise.all([
        convertBreakdownToWorkOrder(ctxWo1.req, ctxWo1.res, ctxWo1.next),
        convertBreakdownToWorkOrder(ctxWo2.req, ctxWo2.res, ctxWo2.next),
      ]);

      assert.equal(ctxWo1.res.statusCode, 201);
      assert.equal(ctxWo2.res.statusCode, 201);

      const woNum1 = ctxWo1.res.responseData.data.workOrder.wo_number;
      const woNum2 = ctxWo2.res.responseData.data.workOrder.wo_number;

      assert.notEqual(woNum1, woNum2);
      const seq1 = parseInt(woNum1.split('-')[2], 10);
      const seq2 = parseInt(woNum2.split('-')[2], 10);
      const woSeqs = [seq1, seq2].sort((a, b) => a - b);
      assert.deepEqual(woSeqs, [1, 2]);
    });

    it('43. Advisory lock is acquired BEFORE MAX sequence query during work order conversion', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';

      const ctxCmp = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'hydraulic',
          problem_title: 'Hose rupture',
          description: 'Hose ruptured on cylinder B',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxCmp.req, ctxCmp.res, ctxCmp.next);
      const cmpId = ctxCmp.res.responseData.data.id;

      mockDb.queryLog = [];

      const ctxWo = createMockContext(
        { technician_id: techId, sla_hours: 6 },
        { id: cmpId },
        {},
        {},
        mgr
      );
      await convertBreakdownToWorkOrder(ctxWo.req, ctxWo.res, ctxWo.next);
      assert.equal(ctxWo.res.statusCode, 201);

      const woLockIdx = mockDb.queryLog.findIndex((q) =>
        q.text.includes('pg_advisory_xact_lock') &&
        q.params?.some((p) => String(p).startsWith('wo_seq:'))
      );
      const woMaxIdx = mockDb.queryLog.findIndex((q) =>
        q.text.includes('MAX(SUBSTRING(wo_number')
      );

      assert.ok(woLockIdx >= 0, 'pg_advisory_xact_lock must be invoked for work order numbering');
      assert.ok(woMaxIdx >= 0, 'MAX query must be executed');
      assert.ok(
        woLockIdx < woMaxIdx,
        `Advisory lock (idx: ${woLockIdx}) must be acquired BEFORE the MAX sequence query (idx: ${woMaxIdx})`
      );

      const currentYear = new Date().getFullYear();
      assert.equal(mockDb.queryLog[woLockIdx].params[0], `wo_seq:${currentYear}`);
    });

    it('44. Shared work order creation service verification: both endpoints share unified business logic and idempotency', async () => {
      const op = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const mgr = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techId = 'f0000000-0000-0000-0000-000000000003';

      // 1. Create a breakdown complaint
      const ctxCmp = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'lubrication',
          problem_title: 'Central grease pump dry run',
          description: 'No lube flow detected',
        },
        {},
        {},
        {},
        op
      );
      await reportBreakdown(ctxCmp.req, ctxCmp.res, ctxCmp.next);
      const cmpId = ctxCmp.res.responseData.data.id;

      // 2. Convert via Work Orders module endpoint (POST /api/v1/work-orders/assign)
      const ctxAssign = createMockContext(
        {
          complaint_id: cmpId,
          technician_id: techId,
          sla_hours: 4,
          work_instructions: 'Service grease reservoir and prime pumps.',
        },
        {},
        {},
        {},
        mgr
      );
      await createWorkOrderFromComplaint(ctxAssign.req, ctxAssign.res, ctxAssign.next);
      assert.equal(ctxAssign.res.statusCode, 201);
      assert.equal(ctxAssign.res.responseData.success, true);
      assert.ok(ctxAssign.res.responseData.data.wo_number);

      // 3. Attempt repeated conversion via Breakdown module endpoint (POST /api/v1/breakdowns/:id/convert-to-work-order)
      const ctxConvertDuplicate = createMockContext(
        { technician_id: techId },
        { id: cmpId },
        {},
        {},
        mgr
      );
      await convertBreakdownToWorkOrder(ctxConvertDuplicate.req, ctxConvertDuplicate.res, ctxConvertDuplicate.next);

      // Shared service idempotency check: must return HTTP 409 Conflict!
      assert.equal(ctxConvertDuplicate.res.statusCode, 409);
      assert.equal(ctxConvertDuplicate.res.responseData.success, false);
      assert.ok(
        ctxConvertDuplicate.res.responseData.message.includes('already exists') ||
        ctxConvertDuplicate.res.responseData.message.includes('already been created')
      );
    });
  });
});
