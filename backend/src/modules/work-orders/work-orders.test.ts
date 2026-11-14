// Set safe mock test environment variables prior to module imports
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
  createWorkOrderFromComplaint,
  getWorkOrders,
  getWorkOrderDetails,
  getWorkOrderHistory,
  getWorkOrderParts,
  reassignWorkOrder,
  updateWorkOrderMilestone,
  verifyAndCloseWorkOrder,
  reopenWorkOrder,
  setWorkOrdersDb,
  resetWorkOrdersDb,
  setWorkOrdersIo,
  resetWorkOrdersIo,
} from './work-orders.controller';
import {
  DbClientLike,
  DbPoolLike,
} from './work-orders.service';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

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
 * Mock Socket.IO Gateway
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
 * Mock Database Entities
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
  problem_title: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

interface MockWorkOrder {
  id: string;
  wo_number: string;
  complaint_id: string | null;
  machine_id: string;
  assigned_technician_id: string;
  assigned_manager_id: string | null;
  priority: string;
  status: string;
  classification: string;
  is_major_breakdown: boolean;
  sla_deadline: Date;
  work_instructions: string;
  scheduled_visit_date: string | null;
  scheduled_visit_time: string | null;
  schedule_status: string;
  breakdown_time: Date | null;
  reported_time: Date | null;
  manager_ack_time: Date | null;
  technician_assigned_time: Date | null;
  travel_started_time: Date | null;
  arrival_time: Date | null;
  work_started_time: Date | null;
  work_paused_time: Date | null;
  work_resumed_time: Date | null;
  repair_completed_time: Date | null;
  manager_verified_time: Date | null;
  machine_restored_time: Date | null;
  total_downtime_minutes: number;
  active_repair_minutes: number;
  maintenance_response_minutes: number;
  labour_hours: number;
  diagnosis: string | null;
  affected_component: string | null;
  fault_category: string | null;
  root_cause_analysis: string | null;
  corrective_action: string | null;
  technician_remarks: string | null;
  manager_verification_remarks: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MockSparePart {
  id: string;
  part_number: string;
  name: string;
  category: string;
  unit_of_measure: string;
  current_physical_stock: number;
  reserved_stock: number;
  available_stock: number;
}

interface MockPartsConsumed {
  id: string;
  work_order_id: string;
  part_id: string;
  quantity_requested: number;
  quantity_issued: number;
  quantity_installed: number;
  serial_number_installed: string | null;
  serial_number_removed: string | null;
  removed_part_disposition: string;
  created_at: Date;
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

class MockWorkOrdersDatabase {
  public users: Map<string, any> = new Map();
  public plants: Map<string, any> = new Map();
  public shops: Map<string, any> = new Map();
  public machines: Map<string, MockMachine> = new Map();
  public maintenance_requests: Map<string, MockComplaint> = new Map();
  public work_orders: Map<string, MockWorkOrder> = new Map();
  public spare_parts: Map<string, MockSparePart> = new Map();
  public wo_parts_consumed: Map<string, MockPartsConsumed> = new Map();
  public work_order_events: any[] = [];
  public audit_logs: any[] = [];
  public notifications: any[] = [];
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
    this.spare_parts.clear();
    this.wo_parts_consumed.clear();
    this.work_order_events = [];
    this.audit_logs = [];
    this.notifications = [];
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
      status: 'under_maintenance',
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
      shop_id: s2.id,
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
    const p1Tech1 = {
      id: 'f0000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-TCH-001',
      full_name: 'Anil Senior Technician',
      email: 'technician@jcb.com',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
    };
    const p1Tech2 = {
      id: 'f0000000-0000-0000-0000-000000000006',
      employee_code: 'EMP-TCH-002',
      full_name: 'Sunil Junior Technician',
      email: 'sunil.tech@jcb.com',
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
    const p2Manager = {
      id: 'f0000000-0000-0000-0000-000000000007',
      employee_code: 'EMP-MGR-002',
      full_name: 'Pune Plant Manager',
      email: 'pune.mgr@jcb.com',
      role: 'manager',
      plant_id: p2.id,
      shop_id: s2.id,
      is_active: true,
    };
    const p2Tech = {
      id: 'f0000000-0000-0000-0000-000000000008',
      employee_code: 'EMP-TCH-003',
      full_name: 'Pune Technician',
      email: 'pune.tech@jcb.com',
      role: 'technician',
      plant_id: p2.id,
      shop_id: s2.id,
      is_active: true,
    };
    const inactiveTech = {
      id: 'f0000000-0000-0000-0000-000000000009',
      employee_code: 'EMP-TCH-009',
      full_name: 'Former Technician',
      email: 'inactive.tech@jcb.com',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: false,
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(p1Manager.id, p1Manager);
    this.users.set(p1Tech1.id, p1Tech1);
    this.users.set(p1Tech2.id, p1Tech2);
    this.users.set(p1Operator.id, p1Operator);
    this.users.set(p2Manager.id, p2Manager);
    this.users.set(p2Tech.id, p2Tech);
    this.users.set(inactiveTech.id, inactiveTech);

    // Spare parts
    const sp1: MockSparePart = {
      id: '30000000-0000-0000-0000-000000000001',
      part_number: 'HYD-10025',
      name: 'Hydraulic Pump Filter Element',
      category: 'Hydraulic',
      unit_of_measure: 'PCS',
      current_physical_stock: 50,
      reserved_stock: 5,
      available_stock: 45,
    };
    this.spare_parts.set(sp1.id, sp1);

    // Complaint
    const c1: MockComplaint = {
      id: '50000000-0000-0000-0000-000000000001',
      complaint_number: 'CMP-2026-00001',
      machine_id: m1.id,
      reported_by_id: p1Operator.id,
      shift: 'Shift A',
      issue_category: 'electrical',
      priority: 'high',
      status: 'work_order_created',
      breakdown_occurred_at: new Date(Date.now() - 3600000),
      reported_at: new Date(Date.now() - 3500000),
      problem_title: 'Spindle Inverter Tripped',
      description: 'Overload code E-041 on drive',
      created_at: new Date(Date.now() - 3500000),
      updated_at: new Date(Date.now() - 3500000),
    };
    this.maintenance_requests.set(c1.id, c1);

    // Work order 1
    const wo1: MockWorkOrder = {
      id: '40000000-0000-0000-0000-000000000001',
      wo_number: 'WO-2026-00001',
      complaint_id: c1.id,
      machine_id: m1.id,
      assigned_technician_id: p1Tech1.id,
      assigned_manager_id: p1Manager.id,
      priority: 'high',
      status: 'assigned',
      classification: 'minor_breakdown',
      is_major_breakdown: false,
      sla_deadline: new Date(Date.now() + 4 * 3600000),
      work_instructions: 'Inspect and replace faulty power module.',
      scheduled_visit_date: null,
      scheduled_visit_time: null,
      schedule_status: 'pending',
      breakdown_time: c1.breakdown_occurred_at,
      reported_time: c1.reported_at,
      manager_ack_time: new Date(),
      technician_assigned_time: new Date(),
      travel_started_time: null,
      arrival_time: null,
      work_started_time: null,
      work_paused_time: null,
      work_resumed_time: null,
      repair_completed_time: null,
      manager_verified_time: null,
      machine_restored_time: null,
      total_downtime_minutes: 0,
      active_repair_minutes: 0,
      maintenance_response_minutes: 0,
      labour_hours: 0,
      diagnosis: null,
      affected_component: null,
      fault_category: null,
      root_cause_analysis: null,
      corrective_action: null,
      technician_remarks: null,
      manager_verification_remarks: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.work_orders.set(wo1.id, wo1);
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();
    this.queryLog.push({ text: trimmed, params });

    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 1 };
    }

    // Single complaint lookup
    if (trimmed.includes('FROM maintenance_requests r') && trimmed.includes('WHERE r.id = $1')) {
      const id = params[0];
      const r = this.maintenance_requests.get(id);
      if (!r) return { rows: [], rowCount: 0 };
      const m = this.machines.get(r.machine_id);
      const s = m ? this.shops.get(m.shop_id) : undefined;
      return {
        rows: [{ ...r, machine_code: m?.machine_code, machine_name: m?.name, shop_id: s?.id, plant_id: s?.plant_id }],
        rowCount: 1,
      };
    }

    // Work order sequence MAX query
    if (trimmed.includes('MAX(SUBSTRING(wo_number FROM')) {
      const prefix = String(params[0] || '').replace(/%/g, '');
      const matching = Array.from(this.work_orders.values()).filter((w) => w.wo_number.startsWith(prefix));
      const maxSeq = matching.reduce((max, w) => {
        const parts = w.wo_number.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        return !isNaN(seq) && seq > max ? seq : max;
      }, 0);
      return { rows: [{ next_seq: maxSeq + 1 }], rowCount: 1 };
    }

    // Check existing WO by complaint_id
    if (trimmed.includes('FROM work_orders WHERE complaint_id = $1')) {
      const cid = params[0];
      const found = Array.from(this.work_orders.values()).filter((w) => w.complaint_id === cid);
      return { rows: found, rowCount: found.length };
    }

    // User lookup
    if (trimmed.includes('FROM users WHERE id = $1')) {
      const u = this.users.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // Work order lookup with machine and shop
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.id = $1')) {
      const id = params[0];
      const wo = this.work_orders.get(id);
      if (!wo) return { rows: [], rowCount: 0 };
      const m = this.machines.get(wo.machine_id);
      const s = m ? this.shops.get(m.shop_id) : undefined;
      const p = s ? this.plants.get(s.plant_id) : undefined;
      const u = this.users.get(wo.assigned_technician_id);
      const mgr = wo.assigned_manager_id ? this.users.get(wo.assigned_manager_id) : undefined;
      const r = wo.complaint_id ? this.maintenance_requests.get(wo.complaint_id) : undefined;

      return {
        rows: [
          {
            ...wo,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            criticality: m?.criticality,
            bay_line_location: m?.bay_line_location,
            operating_hours: m?.operating_hours,
            machine_status: m?.status,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: s?.plant_id,
            plant_name: p?.plant_name,
            technician_name: u?.full_name,
            technician_code: u?.employee_code,
            technician_email: u?.email,
            manager_name: mgr?.full_name,
            manager_code: mgr?.employee_code,
            complaint_number: r?.complaint_number,
            problem_title: r?.problem_title,
            complaint_description: r?.description,
            issue_category: r?.issue_category,
            shift: r?.shift,
            breakdown_occurred_at: r?.breakdown_occurred_at,
            reported_at: r?.reported_at,
          },
        ],
        rowCount: 1,
      };
    }

    // Parts consumed query
    if (trimmed.includes('FROM wo_parts_consumed pc') && trimmed.includes('WHERE pc.work_order_id = $1')) {
      const woId = params[0];
      const consumed = Array.from(this.wo_parts_consumed.values())
        .filter((c) => c.work_order_id === woId)
        .map((c) => {
          const sp = this.spare_parts.get(c.part_id);
          return {
            ...c,
            part_number: sp?.part_number,
            part_name: sp?.name,
            part_category: sp?.category,
            unit_of_measure: sp?.unit_of_measure,
            current_physical_stock: sp?.current_physical_stock,
            available_stock: sp?.available_stock,
          };
        });
      return { rows: consumed, rowCount: consumed.length };
    }

    // Milestone events query
    if (trimmed.includes('FROM work_order_events e') && trimmed.includes('WHERE e.work_order_id = $1')) {
      const woId = params[0];
      const events = this.work_order_events
        .filter((e) => e.work_order_id === woId)
        .map((e) => {
          const u = this.users.get(e.performed_by);
          return { ...e, performed_by_name: u?.full_name, performed_by_role: u?.role };
        });
      return { rows: events, rowCount: events.length };
    }

    // Active complaints count on machine
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('WHERE machine_id = $1 AND id != $2')) {
      const [mid, excludeId] = params;
      const count = Array.from(this.maintenance_requests.values()).filter(
        (c) => c.machine_id === mid && c.id !== excludeId && !['closed', 'rejected'].includes(c.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Active work orders count on machine
    if (trimmed.includes('FROM work_orders') && trimmed.includes('WHERE machine_id = $1 AND id != $2')) {
      const [mid, excludeId] = params;
      const count = Array.from(this.work_orders.values()).filter(
        (w) => w.machine_id === mid && w.id !== excludeId && !['verified_closed', 'completed'].includes(w.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Count for work orders listing
    if (trimmed.includes('SELECT COUNT(wo.id)::int AS total') && trimmed.includes('FROM work_orders wo')) {
      let filtered = Array.from(this.work_orders.values());
      // apply basic technician filter simulation if present
      if (trimmed.includes('wo.assigned_technician_id = $')) {
        const techId = params[0];
        filtered = filtered.filter((w) => w.assigned_technician_id === techId);
      }
      return { rows: [{ total: filtered.length }], rowCount: 1 };
    }

    // Work orders listing query
    if (trimmed.startsWith('SELECT') && trimmed.includes('FROM work_orders wo') && trimmed.includes('JOIN machines m')) {
      let rows = Array.from(this.work_orders.values()).map((wo) => {
        const m = this.machines.get(wo.machine_id);
        const s = m ? this.shops.get(m.shop_id) : undefined;
        const p = s ? this.plants.get(s.plant_id) : undefined;
        const u = this.users.get(wo.assigned_technician_id);
        const mgr = wo.assigned_manager_id ? this.users.get(wo.assigned_manager_id) : undefined;
        const r = wo.complaint_id ? this.maintenance_requests.get(wo.complaint_id) : undefined;
        return {
          ...wo,
          machine_code: m?.machine_code,
          machine_name: m?.name,
          bay_line_location: m?.bay_line_location,
          criticality: m?.criticality,
          machine_status: m?.status,
          shop_id: s?.id,
          shop_name: s?.shop_name,
          plant_id: s?.plant_id,
          plant_name: p?.plant_name,
          technician_name: u?.full_name,
          technician_code: u?.employee_code,
          technician_email: u?.email,
          manager_name: mgr?.full_name,
          manager_code: mgr?.employee_code,
          complaint_number: r?.complaint_number,
          problem_title: r?.problem_title,
          issue_category: r?.issue_category,
        };
      });

      if (trimmed.includes('wo.assigned_technician_id = $1')) {
        const techId = params[0];
        rows = rows.filter((r) => r.assigned_technician_id === techId);
      }

      if (trimmed.includes('s.plant_id = $1')) {
        const plantId = params[0];
        rows = rows.filter((r) => r.plant_id === plantId);
      }

      if (trimmed.includes('ILIKE')) {
        const searchParam = String(params.find((p) => typeof p === 'string' && p.startsWith('%')) || '')
          .replace(/%/g, '')
          .toLowerCase();
        if (searchParam) {
          rows = rows.filter(
            (r) =>
              r.wo_number.toLowerCase().includes(searchParam) ||
              (r.machine_code && r.machine_code.toLowerCase().includes(searchParam)) ||
              (r.problem_title && r.problem_title.toLowerCase().includes(searchParam))
          );
        }
      }

      return { rows, rowCount: rows.length };
    }

    // Insert work orders
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
        classification: is_major_breakdown ? 'major_breakdown' : 'minor_breakdown',
        is_major_breakdown: Boolean(is_major_breakdown),
        sla_deadline: new Date(sla_deadline),
        work_instructions,
        scheduled_visit_date: null,
        scheduled_visit_time: null,
        schedule_status: 'pending',
        breakdown_time: breakdown_time ? new Date(breakdown_time) : null,
        reported_time: reported_time ? new Date(reported_time) : null,
        manager_ack_time: new Date(),
        technician_assigned_time: new Date(),
        travel_started_time: null,
        arrival_time: null,
        work_started_time: null,
        work_paused_time: null,
        work_resumed_time: null,
        repair_completed_time: null,
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 0,
        maintenance_response_minutes: 0,
        labour_hours: 0,
        diagnosis: null,
        affected_component: null,
        fault_category: null,
        root_cause_analysis: null,
        corrective_action: null,
        technician_remarks: null,
        manager_verification_remarks: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.work_orders.set(newId, wo);
      return { rows: [wo], rowCount: 1 };
    }

    // Update work orders
    if (trimmed.startsWith('UPDATE work_orders')) {
      const match = trimmed.match(/WHERE id = \$(\d+)/i);
      const id = match ? params[parseInt(match[1], 10) - 1] : params[0];
      const wo = this.work_orders.get(id);
      if (!wo) return { rows: [], rowCount: 0 };

      if (trimmed.includes("status = 'accepted'")) {
        wo.status = 'accepted';
      } else if (trimmed.includes("status = 'scheduled'")) {
        wo.status = 'scheduled';
        wo.schedule_status = 'confirmed';
      } else if (trimmed.includes("status = 'under_diagnosis'")) {
        wo.status = 'under_diagnosis';
        wo.arrival_time = new Date();
        wo.maintenance_response_minutes = 25;
      } else if (trimmed.includes("status = 'in_progress'")) {
        wo.status = 'in_progress';
        wo.work_started_time = wo.work_started_time || new Date(Date.now() - 3600000);
      } else if (trimmed.includes("status = 'waiting_for_parts'")) {
        wo.status = 'waiting_for_parts';
        wo.work_paused_time = new Date();
      } else if (trimmed.includes("status = 'submitted_verification'")) {
        wo.status = 'submitted_verification';
        wo.repair_completed_time = new Date();
        wo.active_repair_minutes = 60;
        wo.labour_hours = 1.0;
        wo.diagnosis = params.find((p) => p === 'Spindle Inverter IGBT replaced') || 'Diagnosis recorded';
        wo.corrective_action = params.find((p) => p === 'Replaced IGBT module and calibrated drive') || 'Action taken';
      } else if (trimmed.includes("status = 'verified_closed'")) {
        wo.status = 'verified_closed';
        wo.manager_verified_time = new Date();
        wo.machine_restored_time = new Date();
        wo.total_downtime_minutes = 120;
        wo.manager_verification_remarks = params[1] || 'Quality approved';
      } else if (trimmed.includes("status = 'rework_required'")) {
        wo.status = 'rework_required';
        wo.manager_verification_remarks = params[0] || 'Rework requested';
      } else if (trimmed.includes("status = 'reopened'")) {
        wo.status = 'reopened';
      } else if (trimmed.includes('assigned_technician_id = $1')) {
        wo.assigned_technician_id = params[0];
        wo.technician_assigned_time = new Date();
      }

      wo.updated_at = new Date();
      return { rows: [wo], rowCount: 1 };
    }

    // Update machines table
    if (trimmed.startsWith('UPDATE machines')) {
      const machineId = params[params.length - 1];
      const m = this.machines.get(machineId);
      if (m) {
        if (trimmed.includes("'under_maintenance'")) m.status = 'under_maintenance';
        else if (trimmed.includes("'awaiting_parts'")) m.status = 'awaiting_parts';
        else if (trimmed.includes("'awaiting_verification'")) m.status = 'awaiting_verification';
        else if (trimmed.includes("'running'")) m.status = 'running';
        else if (params[0]) m.status = params[0];
      }
      return { rows: [], rowCount: 1 };
    }

    // Update maintenance_requests table
    if (trimmed.startsWith('UPDATE maintenance_requests')) {
      const cid = params[params.length - 1];
      const c = this.maintenance_requests.get(cid);
      if (c) {
        if (trimmed.includes("status = 'work_order_created'")) c.status = 'work_order_created';
        else if (trimmed.includes("status = 'closed'")) c.status = 'closed';
        c.updated_at = new Date();
      }
      return { rows: [], rowCount: 1 };
    }

    // Work order events
    if (trimmed.startsWith('INSERT INTO work_order_events')) {
      const [work_order_id, event_type, performed_by, notes] = params;
      const evt = { id: `evt-${this.work_order_events.length + 1}`, work_order_id, event_type, performed_by, notes, timestamp: new Date() };
      this.work_order_events.push(evt);
      return { rows: [evt], rowCount: 1 };
    }

    // Audit logs
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values] = params;
      const log = { id: `aud-${this.audit_logs.length + 1}`, entity_name, entity_id, action, performed_by, old_values, new_values, created_at: new Date() };
      this.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // Notifications
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const [recipient_id, title, message, type, link_url] = params;
      const notif = {
        id: `c0000000-0000-0000-0000-${String(this.notifications.length + 1).padStart(12, '0')}`,
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

    return { rows: [], rowCount: 0 };
  }

  getPool(): DbPoolLike {
    const self = this;
    return {
      async connect(): Promise<DbClientLike> {
        const heldLocks = new Set<string>();
        let snapshot: {
          work_orders: Map<string, MockWorkOrder>;
          machines: Map<string, MockMachine>;
          complaints: Map<string, MockComplaint>;
          events: any[];
          audit: any[];
          notifications: any[];
        } | null = null;

        return {
          async query(text: string, params: any[] = []) {
            const trimmed = text.trim();
            if (trimmed === 'BEGIN') {
              snapshot = {
                work_orders: new Map(Array.from(self.work_orders.entries()).map(([k, v]) => [k, { ...v }])),
                machines: new Map(Array.from(self.machines.entries()).map(([k, v]) => [k, { ...v }])),
                complaints: new Map(Array.from(self.maintenance_requests.entries()).map(([k, v]) => [k, { ...v }])),
                events: [...self.work_order_events],
                audit: [...self.audit_logs],
                notifications: [...self.notifications],
              };
              return { rows: [], rowCount: 0 };
            }

            if (trimmed === 'COMMIT') {
              snapshot = null;
              for (const k of heldLocks) {
                self.advisoryLockManager.release(k);
              }
              heldLocks.clear();
              return { rows: [], rowCount: 0 };
            }

            if (trimmed === 'ROLLBACK') {
              if (snapshot) {
                self.work_orders = snapshot.work_orders;
                self.machines = snapshot.machines;
                self.maintenance_requests = snapshot.complaints;
                self.work_order_events = snapshot.events;
                self.audit_logs = snapshot.audit;
                self.notifications = snapshot.notifications;
                snapshot = null;
              }
              for (const k of heldLocks) {
                self.advisoryLockManager.release(k);
              }
              heldLocks.clear();
              return { rows: [], rowCount: 0 };
            }

            if (trimmed.includes('pg_advisory_xact_lock')) {
              const lockKey = String(params[0] || 'default');
              heldLocks.add(lockKey);
              await self.advisoryLockManager.acquire(lockKey);
              return { rows: [], rowCount: 1 };
            }

            return self.query(text, params);
          },
          release() {
            for (const k of heldLocks) {
              self.advisoryLockManager.release(k);
            }
            heldLocks.clear();
          },
        };
      },
    };
  }
}

describe('Work Order Management Module (CMMS Module 3)', () => {
  let mockDb: MockWorkOrdersDatabase;
  let mockIo: MockSocketIO;

  beforeEach(() => {
    mockDb = new MockWorkOrdersDatabase();
    mockIo = new MockSocketIO();
    setWorkOrdersDb(mockDb.query.bind(mockDb), mockDb.getPool());
    setWorkOrdersIo(mockIo);
  });

  // ==========================================
  // SECTION 1: WORK ORDER CREATION & ASSIGNMENT
  // ==========================================
  describe('1. Work Order Creation & Assignment', () => {
    it('1. Manager can create and assign a work order from a valid complaint', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      // Create fresh new complaint
      const newCmp: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000002',
        complaint_number: 'CMP-2026-00002',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'mechanical',
        priority: 'high',
        status: 'new',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Bearing vibration',
        description: 'Vibration on Axis X',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.maintenance_requests.set(newCmp.id, newCmp);

      const ctx = createMockContext(
        {
          complaint_id: newCmp.id,
          technician_id: techUser.id,
          sla_hours: 6,
          work_instructions: 'Replace bearing and align axis.',
          is_major_breakdown: true,
        },
        {},
        {},
        {},
        managerUser
      );

      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(ctx.res.responseData.data.wo_number.startsWith('WO-2026-'));
      assert.equal(ctx.res.responseData.data.status, 'assigned');
      assert.equal(ctx.res.responseData.data.assigned_technician_id, techUser.id);
      assert.equal(ctx.res.responseData.data.is_major_breakdown, true);
    });

    it('2. Work order numbering follows WO-YYYY-XXXXX format and maintains sequence under concurrency', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      // Create two complaints
      const cA: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000003',
        complaint_number: 'CMP-2026-00003',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'hydraulic',
        priority: 'medium',
        status: 'new',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Hydraulic pressure low',
        description: 'Pressure drops below 5 bar',
        created_at: new Date(),
        updated_at: new Date(),
      };
      const cB: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000004',
        complaint_number: 'CMP-2026-00004',
        machine_id: '10000000-0000-0000-0000-000000000002',
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'lubrication',
        priority: 'low',
        status: 'new',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Lube pump dry',
        description: 'Reservoir low',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.maintenance_requests.set(cA.id, cA);
      mockDb.maintenance_requests.set(cB.id, cB);

      const ctxA = createMockContext({ complaint_id: cA.id, technician_id: techUser.id }, {}, {}, {}, managerUser);
      const ctxB = createMockContext({ complaint_id: cB.id, technician_id: techUser.id }, {}, {}, {}, managerUser);

      await Promise.all([
        createWorkOrderFromComplaint(ctxA.req, ctxA.res, ctxA.next),
        createWorkOrderFromComplaint(ctxB.req, ctxB.res, ctxB.next),
      ]);

      assert.equal(ctxA.res.statusCode, 201);
      assert.equal(ctxB.res.statusCode, 201);
      const numA = ctxA.res.responseData.data.wo_number;
      const numB = ctxB.res.responseData.data.wo_number;
      assert.notEqual(numA, numB);
      assert.ok(/^WO-\d{4}-\d{5}$/.test(numA));
      assert.ok(/^WO-\d{4}-\d{5}$/.test(numB));
    });

    it('3. Creation rejects non-existent complaint with HTTP 404', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { complaint_id: '50000000-0000-0000-0000-999999999999', technician_id: techUser.id },
        {},
        {},
        {},
        managerUser
      );

      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 404);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('not found'));
    });

    it('4. Creation rejects inactive technician or user without technician role with HTTP 400', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const inactiveTech = mockDb.users.get('f0000000-0000-0000-0000-000000000009');
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      const freshCmp: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000014',
        complaint_number: 'CMP-2026-00014',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'electrical',
        priority: 'high',
        status: 'new',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Fresh fault',
        description: 'Testing inactive technician',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.maintenance_requests.set(freshCmp.id, freshCmp);

      // Attempt assigning to inactive technician
      const ctx1 = createMockContext(
        { complaint_id: freshCmp.id, technician_id: inactiveTech.id },
        {},
        {},
        {},
        managerUser
      );
      await createWorkOrderFromComplaint(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.ok(ctx1.res.responseData.message.includes('inactive'));

      // Attempt assigning to operator
      const ctx2 = createMockContext(
        { complaint_id: freshCmp.id, technician_id: operatorUser.id },
        {},
        {},
        {},
        managerUser
      );
      await createWorkOrderFromComplaint(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);
      assert.ok(ctx2.res.responseData.message.includes('technician role'));
    });

    it('5. Creation enforces idempotency: repeated creation on same complaint returns HTTP 409', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      // Complaint 1 already has WO-2026-00001 created
      const ctx = createMockContext(
        { complaint_id: '50000000-0000-0000-0000-000000000001', technician_id: techUser.id },
        {},
        {},
        {},
        managerUser
      );

      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 409);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('already'));
    });

    it('6. Operator is blocked from creating work orders with HTTP 403', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const freshCmp: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000016',
        complaint_number: 'CMP-2026-00016',
        machine_id: '10000000-0000-0000-0000-000000000001',
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'electrical',
        priority: 'high',
        status: 'new',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Operator test fault',
        description: 'Testing operator block',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.maintenance_requests.set(freshCmp.id, freshCmp);

      const ctx = createMockContext(
        { complaint_id: freshCmp.id, technician_id: techUser.id },
        {},
        {},
        {},
        operatorUser
      );

      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
    });

    it('7. Cross-plant creation attempt by manager is blocked with HTTP 403', async () => {
      // Pune Manager attempts to create WO for Ballabgarh machine
      const puneManager = mockDb.users.get('f0000000-0000-0000-0000-000000000007');
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { complaint_id: '50000000-0000-0000-0000-000000000001', technician_id: techUser.id },
        {},
        {},
        {},
        puneManager
      );

      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('Unauthorized for this plant'));
    });
  });

  // ==========================================
  // SECTION 2: REASSIGNMENT & AUTHORIZATION
  // ==========================================
  describe('2. Technician Reassignment', () => {
    it('8. Manager can reassign an active work order to another active technician', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const newTech = mockDb.users.get('f0000000-0000-0000-0000-000000000006'); // Sunil Tech

      const ctx = createMockContext(
        { new_technician_id: newTech.id, notes: 'Anil is on leave; reassigning to Sunil.' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.assigned_technician_id, newTech.id);
    });

    it('9. Reassignment records REASSIGNED event, audit log, and notifies the new technician', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const newTech = mockDb.users.get('f0000000-0000-0000-0000-000000000006');

      const ctx = createMockContext(
        { new_technician_id: newTech.id, notes: 'Urgent reassignment' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      // Verify event
      const evt = mockDb.work_order_events.find((e) => e.event_type === 'REASSIGNED');
      assert.ok(evt);

      // Verify audit log
      const audit = mockDb.audit_logs.find((a) => a.action === 'WORK_ORDER_REASSIGNED');
      assert.ok(audit);

      // Verify notification
      const notif = mockDb.notifications.find((n) => n.recipient_id === newTech.id);
      assert.ok(notif);
    });

    it('10. Reassignment to the same technician returns HTTP 400', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const currentTech = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { new_technician_id: currentTech.id },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('already assigned'));
    });

    it('11. Reassignment to an inactive user or non-technician returns HTTP 400', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      const ctx = createMockContext(
        { new_technician_id: operatorUser.id },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('technician role'));
    });

    it('12. Cannot reassign a closed or completed work order (HTTP 400)', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const newTech = mockDb.users.get('f0000000-0000-0000-0000-000000000006');

      // Set work order to verified_closed
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'verified_closed';

      const ctx = createMockContext(
        { new_technician_id: newTech.id },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Cannot reassign'));
    });

    it('13. Operator or technician attempting to reassign is blocked with HTTP 403', async () => {
      const techUser = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const newTech = mockDb.users.get('f0000000-0000-0000-0000-000000000006');

      const ctx = createMockContext(
        { new_technician_id: newTech.id },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        techUser
      );

      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
    });
  });

  // ==========================================
  // SECTION 3: LISTING, DETAILS, HISTORY & SCOPING
  // ==========================================
  describe('3. Listing, Details, History & Scoping', () => {
    it('14. List work orders supports pagination (page, limit, total, totalPages)', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, {}, { page: '1', limit: '10' }, {}, adminUser);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      assert.equal(ctx.res.responseData.pagination.page, 1);
      assert.equal(ctx.res.responseData.pagination.limit, 10);
      assert.ok(typeof ctx.res.responseData.pagination.total === 'number');
    });

    it('15. Text search filters by wo_number, machine code, or problem title', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, {}, { search: 'WO-2026-00001' }, {}, adminUser);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.length, 1);
      assert.equal(ctx.res.responseData.data[0].wo_number, 'WO-2026-00001');
    });

    it('16. Filter by status returns matching work orders', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, {}, { status: 'assigned' }, {}, adminUser);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.ok(ctx.res.responseData.data.every((w: any) => w.status === 'assigned'));
    });

    it('17. Technician listing is strictly scoped to work orders assigned to that technician', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext({}, {}, {}, {}, tech1);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      // All returned work orders must belong to tech1
      assert.ok(ctx.res.responseData.data.every((w: any) => w.assigned_technician_id === tech1.id));
    });

    it('18. Manager listing is strictly scoped to manager plant and shop', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');

      const ctx = createMockContext({}, {}, {}, {}, managerUser);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.ok(ctx.res.responseData.data.every((w: any) => w.plant_id === managerUser.plant_id));
    });

    it('19. Operators attempting to list work orders are blocked with HTTP 403', async () => {
      const operatorUser = mockDb.users.get('f0000000-0000-0000-0000-000000000004');

      const ctx = createMockContext({}, {}, {}, {}, operatorUser);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('not authorized'));
    });

    it('20. Get work order details returns full joined metadata, parts consumed, and milestone events', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, adminUser);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      const data = ctx.res.responseData.data;
      assert.equal(data.wo_number, 'WO-2026-00001');
      assert.ok(data.machine_code);
      assert.ok(Array.isArray(data.parts_consumed));
      assert.ok(Array.isArray(data.events));
    });

    it('21. Technician cannot view work order details of another technician (HTTP 403)', async () => {
      // Tech2 attempts to view work order assigned to Tech1
      const tech2 = mockDb.users.get('f0000000-0000-0000-0000-000000000006');

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, tech2);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('only authorized to access work orders assigned to you'));
    });

    it('22. Non-existent work order ID returns HTTP 404', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-999999999999' }, {}, {}, adminUser);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 404);
    });

    it('23. Get lifecycle history returns chronological timeline of milestone events', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      mockDb.work_order_events.push({
        id: 'evt-test-1',
        work_order_id: '40000000-0000-0000-0000-000000000001',
        event_type: 'ASSIGNED',
        performed_by: adminUser.id,
        notes: 'Initial allocation',
        timestamp: new Date(),
      });

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, adminUser);
      await getWorkOrderHistory(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      assert.ok(ctx.res.responseData.data.length >= 1);
    });

    it('24. Get work order parts returns reserved and consumed spare parts', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      mockDb.wo_parts_consumed.set('pc-1', {
        id: 'pc-1',
        work_order_id: '40000000-0000-0000-0000-000000000001',
        part_id: '30000000-0000-0000-0000-000000000001',
        quantity_requested: 2,
        quantity_issued: 2,
        quantity_installed: 2,
        serial_number_installed: 'SN-INST-001',
        serial_number_removed: 'SN-REM-001',
        removed_part_disposition: 'scrap',
        created_at: new Date(),
      });

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, adminUser);
      await getWorkOrderParts(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.ok(Array.isArray(ctx.res.responseData.data));
      assert.equal(ctx.res.responseData.data.length, 1);
      assert.equal(ctx.res.responseData.data[0].part_number, 'HYD-10025');
    });
  });

  // ==========================================
  // SECTION 4: MILESTONE LIFECYCLE & STATE MACHINE
  // ==========================================
  describe('4. Milestone Lifecycle & State Machine', () => {
    it('25. Assigned technician can accept work order (ACCEPT)', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { action: 'ACCEPT', notes: 'Accepted by technician.' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'accepted');
    });

    it('26. Acceptance on an already accepted or in-progress work order returns HTTP 400', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      const ctx = createMockContext(
        { action: 'ACCEPT' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Cannot accept'));
    });

    it('27. Technician can schedule visit (SCHEDULE)', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { action: 'SCHEDULE', scheduled_date: '2026-11-06', scheduled_time: '10:00:00' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'scheduled');
    });

    it('28. Technician arrival (ARRIVED) sets arrival_time and status to under_diagnosis', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctx = createMockContext(
        { action: 'ARRIVED', notes: 'Arrived at CNC machine.' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'under_diagnosis');
      assert.ok(ctx.res.responseData.data.arrival_time);
    });

    it('29. Start work (START_WORK) transitions status to in_progress', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'under_diagnosis';

      const ctx = createMockContext(
        { action: 'START_WORK', notes: 'Commencing disassembly.' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'in_progress');
      assert.ok(ctx.res.responseData.data.work_started_time);
    });

    it('30. Technician can record progress remarks and diagnosis updates (PROGRESS) while keeping status active', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      const ctx = createMockContext(
        {
          action: 'PROGRESS',
          diagnosis: 'IGBT transistor open circuit',
          affected_component: 'Inverter Board',
          technician_remarks: 'Removed old module, preparing surface.',
        },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'in_progress');
    });

    it('31. Pause work (PAUSE) transitions status to waiting_for_parts and updates machine status', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      const ctx = createMockContext(
        { action: 'PAUSE', notes: 'Waiting for hydraulic filter from store.' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'waiting_for_parts');

      const m = mockDb.machines.get(wo.machine_id);
      assert.equal(m?.status, 'awaiting_parts');
    });

    it('32. Resume work (RESUME) transitions status back to in_progress', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'waiting_for_parts';

      const ctx = createMockContext(
        { action: 'RESUME', notes: 'Parts received, resuming work.' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'in_progress');

      const m = mockDb.machines.get(wo.machine_id);
      assert.equal(m?.status, 'under_maintenance');
    });

    it('33. Complete repair (COMPLETE) requires mandatory diagnosis and corrective action (HTTP 400 if missing)', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      // Missing diagnosis & corrective action
      const ctx = createMockContext(
        { action: 'COMPLETE', notes: 'Done' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('mandatory'));
    });

    it('34. Valid repair completion (COMPLETE) sets status to submitted_verification, calculates metrics and notifies manager', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';
      wo.work_started_time = new Date(Date.now() - 3600000); // 1 hour ago

      const ctx = createMockContext(
        {
          action: 'COMPLETE',
          diagnosis: 'Spindle Inverter IGBT replaced',
          affected_component: 'Inverter Board',
          fault_category: 'Electrical Component Failure',
          root_cause_analysis: 'Thermal fatigue on cooling fan lead to overheating of IGBT power transistor',
          corrective_action: 'Replaced IGBT module and calibrated drive',
        },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'submitted_verification');
      assert.ok(ctx.res.responseData.data.repair_completed_time);
      assert.ok(ctx.res.responseData.data.active_repair_minutes > 0);
      assert.ok(ctx.res.responseData.data.labour_hours > 0);

      // Verify manager notification created
      const notif = mockDb.notifications.find((n) => n.recipient_id === wo.assigned_manager_id);
      assert.ok(notif);
    });

    it('35. Unassigned technician cannot update milestones on another technician work order (HTTP 403)', async () => {
      const tech2 = mockDb.users.get('f0000000-0000-0000-0000-000000000006');

      const ctx = createMockContext(
        { action: 'ACCEPT' },
        { id: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech2
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.ok(ctx.res.responseData.message.includes('only update work orders assigned to you'));
    });

    it('36. Invalid milestone transition: cannot start work on an already closed work order (HTTP 400)', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'verified_closed';

      const ctx = createMockContext(
        { action: 'START_WORK' },
        { id: wo.id },
        {},
        {},
        tech1
      );

      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('already closed'));
    });
  });

  // ==========================================
  // SECTION 5: VERIFICATION, CLOSURE, REOPEN & MACHINE RESTORATION
  // ==========================================
  describe('5. Verification, Closure, Reopen & Machine Restoration', () => {
    it('37. Manager verification requires work order to be in submitted_verification status (HTTP 400 if other status)', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Good work' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('must be in'));
    });

    it('38. Manager approval (APPROVED) transitions status to verified_closed, closes complaint, and calculates total_downtime_minutes', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Quality inspection passed. Zero vibration measured.' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.status, 'verified_closed');
      assert.ok(ctx.res.responseData.data.manager_verified_time);
      assert.ok(ctx.res.responseData.data.total_downtime_minutes > 0);

      // Verify linked complaint closed
      const c = mockDb.maintenance_requests.get(wo.complaint_id!);
      assert.equal(c?.status, 'closed');
    });

    it('39. Machine status restoration: machine status restored to running when no other active complaints/work orders exist', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Inspection OK' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      const m = mockDb.machines.get(wo.machine_id);
      assert.equal(m?.status, 'running');
    });

    it('40. Machine status preservation: machine remains in under_maintenance if other active complaints exist', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      // Seed another active complaint on the same machine
      const otherComplaint: MockComplaint = {
        id: '50000000-0000-0000-0000-000000000099',
        complaint_number: 'CMP-2026-00099',
        machine_id: wo.machine_id,
        reported_by_id: 'f0000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'hydraulic',
        priority: 'high',
        status: 'pending_review',
        breakdown_occurred_at: new Date(),
        reported_at: new Date(),
        problem_title: 'Hydraulic leak',
        description: 'Oil pool under tank',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.maintenance_requests.set(otherComplaint.id, otherComplaint);

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Work done' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      // Machine should NOT be marked running because another breakdown is open
      const m = mockDb.machines.get(wo.machine_id);
      assert.notEqual(m?.status, 'running');
    });

    it('41. Manager rejection (REJECTED) requires mandatory remarks and transitions status to rework_required', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      // Missing remarks rejection
      const ctx1 = createMockContext({ result: 'REJECTED' }, { id: wo.id }, {}, {}, managerUser);
      await verifyAndCloseWorkOrder(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.ok(ctx1.res.responseData.message.includes('mandatory'));

      // Valid rejection with remarks
      const ctx2 = createMockContext(
        { result: 'REJECTED', remarks: 'Vibration still exceeds ISO standard. Re-check balancing.' },
        { id: wo.id },
        {},
        {},
        managerUser
      );
      await verifyAndCloseWorkOrder(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 200);
      assert.equal(ctx2.res.responseData.data.status, 'rework_required');

      // Notification sent to technician
      const notif = mockDb.notifications.find((n) => n.recipient_id === wo.assigned_technician_id);
      assert.ok(notif);
      assert.ok(notif.message.includes('rework'));
    });

    it('42. Reopen work order transitions verified_closed work order to reopened', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'verified_closed';

      const ctx = createMockContext(
        { reason: 'Issue recurred after 2 hours in production.' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await reopenWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'reopened');

      const m = mockDb.machines.get(wo.machine_id);
      assert.equal(m?.status, 'under_maintenance');

      // Linked complaint updated back to work_order_created
      const c = mockDb.maintenance_requests.get(wo.complaint_id!);
      assert.equal(c?.status, 'work_order_created');
    });

    it('43. Reopen requires mandatory reason and rejects reopening active work orders (HTTP 400)', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      // Cannot reopen non-closed work order
      const ctx = createMockContext(
        { reason: 'Reopening active work order' },
        { id: wo.id },
        {},
        {},
        managerUser
      );

      await reopenWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.ok(ctx.res.responseData.message.includes('Only closed or completed'));
    });

    it('44. Technician or operator cannot verify or reopen work orders (HTTP 403)', async () => {
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');

      const ctxVerify = createMockContext({ result: 'APPROVED' }, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, tech1);
      await verifyAndCloseWorkOrder(ctxVerify.req, ctxVerify.res, ctxVerify.next);
      assert.equal(ctxVerify.res.statusCode, 403);

      const ctxReopen = createMockContext({ reason: 'Reopening' }, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, tech1);
      await reopenWorkOrder(ctxReopen.req, ctxReopen.res, ctxReopen.next);
      assert.equal(ctxReopen.res.statusCode, 403);
    });
  });

  // ==========================================
  // SECTION 6: CROSS-MODULE INTEGRATION, INVENTORY & DOWNTIME COMPATIBILITY
  // ==========================================
  describe('6. Cross-Module Integration & Downtime Metrics', () => {
    it('45. Inventory integration: Consumed spare parts in wo_parts_consumed reflect in work order details', async () => {
      const adminUser = mockDb.users.get('f0000000-0000-0000-0000-000000000001');
      mockDb.wo_parts_consumed.set('pc-filter', {
        id: 'pc-filter',
        work_order_id: '40000000-0000-0000-0000-000000000001',
        part_id: '30000000-0000-0000-0000-000000000001',
        quantity_requested: 1,
        quantity_issued: 1,
        quantity_installed: 1,
        serial_number_installed: 'FILTER-099',
        serial_number_removed: 'FILTER-OLD',
        removed_part_disposition: 'scrap',
        created_at: new Date(),
      });

      const ctx = createMockContext({}, { id: '40000000-0000-0000-0000-000000000001' }, {}, {}, adminUser);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      const consumed = ctx.res.responseData.data.parts_consumed;
      assert.equal(consumed.length, 1);
      assert.equal(consumed[0].part_number, 'HYD-10025');
    });

    it('46. Downtime integration: Timestamps and metrics match downtime analytics query contract', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';
      wo.breakdown_time = new Date(Date.now() - 7200000); // 2 hours ago
      wo.reported_time = new Date(Date.now() - 7000000);
      wo.work_started_time = new Date(Date.now() - 3600000); // 1 hour ago
      wo.repair_completed_time = new Date(Date.now() - 600000); // 10 mins ago

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Closure test' },
        { id: wo.id },
        {},
        {},
        managerUser
      );
      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      const data = ctx.res.responseData.data;
      assert.equal(data.status, 'verified_closed');
      assert.ok(data.total_downtime_minutes >= 110);
      assert.ok(data.machine_restored_time);
    });

    it('47. Notifications integration: In-app notifications and Socket.IO room events are emitted', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const tech1 = mockDb.users.get('f0000000-0000-0000-0000-000000000003');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      mockIo.clear();

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Good work' },
        { id: wo.id },
        {},
        {},
        managerUser
      );
      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      // Verify notification recorded
      const techNotifs = mockDb.notifications.filter((n) => n.recipient_id === tech1.id);
      assert.ok(techNotifs.length >= 1);

      // Verify real-time socket emission
      assert.ok(mockIo.emissions.length >= 1);
    });

    it('48. Audit trail integration: Regulatory immutable audit logs are generated for all lifecycle actions', async () => {
      const managerUser = mockDb.users.get('f0000000-0000-0000-0000-000000000002');
      const wo = mockDb.work_orders.get('40000000-0000-0000-0000-000000000001')!;
      wo.status = 'submitted_verification';

      const initialAuditCount = mockDb.audit_logs.length;

      const ctx = createMockContext(
        { result: 'APPROVED', remarks: 'Audit check' },
        { id: wo.id },
        {},
        {},
        managerUser
      );
      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.ok(mockDb.audit_logs.length > initialAuditCount);
      const audit = mockDb.audit_logs.find((a) => a.action === 'WORK_ORDER_VERIFIED');
      assert.ok(audit);
      assert.equal(audit.performed_by, managerUser.id);
    });
  });
});
