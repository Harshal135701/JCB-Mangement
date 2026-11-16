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
  getBreakdownDetails,
  getBreakdownAssignment,
  getBreakdownAssignmentHistory,
  acceptBreakdownAssignment,
  rejectBreakdownAssignment,
  managerManualAssign,
  managerManualReassign,
  getEligibleTechnicians,
  setBreakdownsDb,
  resetBreakdownsDb,
  setBreakdownsIo,
  resetBreakdownsIo,
  DbClientLike,
  DbPoolLike,
} from './breakdowns.controller';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

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
 * In-memory Mock Database for Automatic Assignment Tests
 */
class MockAssignmentDatabase {
  public plants: Map<string, any> = new Map();
  public shops: Map<string, any> = new Map();
  public machines: Map<string, any> = new Map();
  public users: Map<string, any> = new Map();
  public maintenance_requests: Map<string, any> = new Map();
  public breakdown_assignments: Map<string, any> = new Map();
  public work_orders: Map<string, any> = new Map();
  public audit_logs: any[] = [];
  public notifications: any[] = [];
  public failNextTransaction: boolean = false;

  constructor() {
    this.reset();
  }

  reset() {
    this.plants.clear();
    this.shops.clear();
    this.machines.clear();
    this.users.clear();
    this.maintenance_requests.clear();
    this.breakdown_assignments.clear();
    this.work_orders.clear();
    this.audit_logs = [];
    this.notifications = [];
    this.failNextTransaction = false;

    // Seed Plant 1 & Plant 2
    const p1 = { id: 'b0000000-0000-0000-0000-000000000001', plant_name: 'Pune Plant 1', plant_code: 'PUN-01' };
    const p2 = { id: 'b0000000-0000-0000-0000-000000000002', plant_name: 'Ballabgarh Plant 2', plant_code: 'BLB-02' };
    this.plants.set(p1.id, p1);
    this.plants.set(p2.id, p2);

    // Seed Shops
    const s1 = { id: 'c0000000-0000-0000-0000-000000000001', plant_id: p1.id, shop_name: 'Machining Shop 1', shop_code: 'MCH-01' };
    const s2 = { id: 'c0000000-0000-0000-0000-000000000002', plant_id: p1.id, shop_name: 'Assembly Shop 2', shop_code: 'ASM-02' };
    const s3 = { id: 'c0000000-0000-0000-0000-000000000003', plant_id: p2.id, shop_name: 'Fabrication Shop 3', shop_code: 'FAB-03' };
    this.shops.set(s1.id, s1);
    this.shops.set(s2.id, s2);
    this.shops.set(s3.id, s3);

    // Seed Users
    // 1. Manager Pune
    const mgr1: any = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      full_name: 'Vikas Manager',
      email: 'manager@jcb.com',
      role: 'manager',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
    };
    // 2. Manager Ballabgarh (different plant)
    const mgr2: any = {
      id: 'f0000000-0000-0000-0000-000000000020',
      employee_code: 'EMP-MGR-002',
      full_name: 'Balraj Manager',
      email: 'mgr2@jcb.com',
      role: 'manager',
      plant_id: p2.id,
      shop_id: s3.id,
      is_active: true,
      is_available: true,
    };
    // 3. Operator
    const opr1: any = {
      id: 'f0000000-0000-0000-0000-000000000004',
      employee_code: 'EMP-OPR-001',
      full_name: 'Ramesh Operator',
      email: 'operator@jcb.com',
      role: 'operator',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
    };

    // Technicians in Plant 1, Shop 1
    // Tech 1: Designated Technician for Machine 1
    const techDes: any = {
      id: 'f0000000-0000-0000-0000-000000000010',
      employee_code: 'EMP-TCH-DES',
      full_name: 'Designated Technician Dev',
      email: 'dev.designated@jcb.com',
      phone: '+91-9800000010',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
      skills_json: ['electrical', 'plc', 'mechanical'],
      max_active_assignments: 5,
    };

    // Tech 2: Low Workload (workload = 0), matching mechanical skill
    const techLowWorkload: any = {
      id: 'f0000000-0000-0000-0000-000000000011',
      employee_code: 'EMP-TCH-002',
      full_name: 'Anil LowWorkload Tech',
      email: 'anil.tech@jcb.com',
      phone: '+91-9800000011',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
      skills_json: ['mechanical', 'hydraulic'],
      max_active_assignments: 5,
    };

    // Tech 3: Higher Workload (workload = 2), matching mechanical skill
    const techHighWorkload: any = {
      id: 'f0000000-0000-0000-0000-000000000012',
      employee_code: 'EMP-TCH-003',
      full_name: 'Bharat HighWorkload Tech',
      email: 'bharat.tech@jcb.com',
      phone: '+91-9800000012',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
      skills_json: ['mechanical', 'electrical'],
      max_active_assignments: 5,
    };

    // Tech 4: Inactive Technician
    const techInactive: any = {
      id: 'f0000000-0000-0000-0000-000000000013',
      employee_code: 'EMP-TCH-004',
      full_name: 'Chetan Inactive Tech',
      email: 'chetan.tech@jcb.com',
      phone: '+91-9800000013',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: false,
      is_available: true,
      skills_json: ['mechanical'],
      max_active_assignments: 5,
    };

    // Tech 5: Technician from Plant 2 (other plant)
    const techOtherPlant: any = {
      id: 'f0000000-0000-0000-0000-000000000014',
      employee_code: 'EMP-TCH-005',
      full_name: 'Deepak OtherPlant Tech',
      email: 'deepak.tech@jcb.com',
      phone: '+91-9800000014',
      role: 'technician',
      plant_id: p2.id,
      shop_id: s3.id,
      is_active: true,
      is_available: true,
      skills_json: ['mechanical', 'electrical'],
      max_active_assignments: 5,
    };

    // Tech 6: Technician in Plant 1 but different shop (Shop 2)
    const techOtherShop: any = {
      id: 'f0000000-0000-0000-0000-000000000015',
      employee_code: 'EMP-TCH-006',
      full_name: 'Eshwar OtherShop Tech',
      email: 'eshwar.tech@jcb.com',
      phone: '+91-9800000015',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s2.id,
      is_active: true,
      is_available: true,
      skills_json: ['mechanical'],
      max_active_assignments: 5,
    };

    // Tech 7: Full Capacity (workload = 5, max = 5)
    const techFullCapacity: any = {
      id: 'f0000000-0000-0000-0000-000000000016',
      employee_code: 'EMP-TCH-007',
      full_name: 'Farhan FullCapacity Tech',
      email: 'farhan.tech@jcb.com',
      phone: '+91-9800000016',
      role: 'technician',
      plant_id: p1.id,
      shop_id: s1.id,
      is_active: true,
      is_available: true,
      skills_json: ['mechanical'],
      max_active_assignments: 5,
    };

    this.users.set(mgr1.id, mgr1);
    this.users.set(mgr2.id, mgr2);
    this.users.set(opr1.id, opr1);
    this.users.set(techDes.id, techDes);
    this.users.set(techLowWorkload.id, techLowWorkload);
    this.users.set(techHighWorkload.id, techHighWorkload);
    this.users.set(techInactive.id, techInactive);
    this.users.set(techOtherPlant.id, techOtherPlant);
    this.users.set(techOtherShop.id, techOtherShop);
    this.users.set(techFullCapacity.id, techFullCapacity);

    // Seed Machines
    // Machine 1: Has designated technician techDes
    const m1 = {
      id: '10000000-0000-0000-0000-000000000001',
      shop_id: s1.id,
      machine_code: 'PUN-CNC-001',
      name: 'Pune CNC Lathe 1',
      category: 'CNC Lathe',
      criticality: 'class_a',
      status: 'running',
      designated_technician_id: techDes.id,
    };

    // Machine 2: No designated technician
    const m2 = {
      id: '10000000-0000-0000-0000-000000000002',
      shop_id: s1.id,
      machine_code: 'PUN-MILL-002',
      name: 'Pune Milling Center 2',
      category: 'Milling',
      criticality: 'class_b',
      status: 'running',
      designated_technician_id: null,
    };

    // Machine 3: In Shop 2
    const m3 = {
      id: '10000000-0000-0000-0000-000000000003',
      shop_id: s2.id,
      machine_code: 'PUN-ROB-003',
      name: 'Pune Welding Robot 3',
      category: 'Robotic Welding',
      criticality: 'class_a',
      status: 'running',
      designated_technician_id: null,
    };

    // Machine 4: In Plant 2
    const m4 = {
      id: '10000000-0000-0000-0000-000000000004',
      shop_id: s3.id,
      machine_code: 'BLB-PRESS-004',
      name: 'Ballabgarh Heavy Press 4',
      category: 'Hydraulic Press',
      criticality: 'class_a',
      status: 'running',
      designated_technician_id: null,
    };

    this.machines.set(m1.id, m1);
    this.machines.set(m2.id, m2);
    this.machines.set(m3.id, m3);
    this.machines.set(m4.id, m4);

    // Pre-populate some active work orders to create workload differences
    // Tech 3 has 2 active work orders
    this.work_orders.set('wo-1', {
      id: 'wo-1',
      assigned_technician_id: techHighWorkload.id,
      status: 'in_progress',
    });
    this.work_orders.set('wo-2', {
      id: 'wo-2',
      assigned_technician_id: techHighWorkload.id,
      status: 'under_diagnosis',
    });

    // Tech 7 (Full capacity) has 5 active work orders
    for (let i = 1; i <= 5; i++) {
      this.work_orders.set(`wo-full-${i}`, {
        id: `wo-full-${i}`,
        assigned_technician_id: techFullCapacity.id,
        status: 'in_progress',
      });
    }
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();

    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 1 };
    }

    // Machine lookup with join to shops and plants
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

    // Duplicate check on maintenance_requests
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('WHERE machine_id = $1') && trimmed.includes('LOWER(issue_category) = LOWER($2)')) {
      return { rows: [], rowCount: 0 };
    }

    // Sequence for complaint_number
    if (trimmed.includes('MAX(SUBSTRING(complaint_number FROM')) {
      const count = this.maintenance_requests.size + 1;
      return { rows: [{ next_seq: count }], rowCount: 1 };
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
      const complaint = {
        id: newId,
        complaint_number,
        machine_id,
        reported_by_id,
        shift,
        issue_category,
        priority,
        status: 'new',
        assignment_status: 'unassigned',
        assigned_technician_id: null,
        current_assignment_id: null,
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

    // Update machines status
    if (trimmed.startsWith('UPDATE machines SET status =')) {
      const machineId = params[params.length - 1];
      const m = this.machines.get(machineId);
      if (m) m.status = 'breakdown';
      return { rows: [], rowCount: 1 };
    }

    // Insert audit_logs
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values] = params;
      const log = {
        id: `aud-${this.audit_logs.length + 1}`,
        entity_name,
        entity_id,
        action,
        performed_by,
        old_values: old_values ? JSON.parse(old_values) : null,
        new_values: new_values ? JSON.parse(new_values) : null,
        created_at: new Date(),
      };
      this.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // Insert notifications
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

    // Select managers for notifications
    if (trimmed.includes('FROM users') && trimmed.includes("role IN ('admin', 'manager')")) {
      const plantId = params[0];
      const mgrs = Array.from(this.users.values()).filter(
        (u) => ['admin', 'manager'].includes(u.role) && (!u.plant_id || u.plant_id === plantId) && u.is_active
      );
      return { rows: mgrs, rowCount: mgrs.length };
    }

    // Look up designated technician: SELECT u.id ... FROM users u WHERE u.id = $1
    if (trimmed.includes('FROM users u') && trimmed.includes('WHERE u.id = $1')) {
      const u = this.users.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // Look up candidate technicians in plant
    if (trimmed.includes('FROM users u') && trimmed.includes("u.role = 'technician'") && trimmed.includes('u.is_active = TRUE')) {
      const plantId = params[0];
      const techs = Array.from(this.users.values()).filter(
        (u) => u.role === 'technician' && u.is_active && u.is_available !== false && (!u.plant_id || u.plant_id === plantId)
      );
      return { rows: techs, rowCount: techs.length };
    }

    // Workload: count active breakdown_assignments
    if (trimmed.includes('FROM breakdown_assignments') && trimmed.includes('WHERE technician_id = $1') && trimmed.includes("status IN ('PENDING', 'ACCEPTED')")) {
      const techId = params[0];
      const count = Array.from(this.breakdown_assignments.values()).filter(
        (ba) => ba.technician_id === techId && ['PENDING', 'ACCEPTED'].includes(ba.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Workload: count active work orders
    if (trimmed.includes('FROM work_orders') && trimmed.includes('WHERE assigned_technician_id = $1')) {
      const techId = params[0];
      const count = Array.from(this.work_orders.values()).filter(
        (wo) => wo.assigned_technician_id === techId && !['verified_closed', 'completed', 'rework_required'].includes(wo.status)
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Look up active assignment for breakdown: WHERE ba.breakdown_id = $1 AND ba.status IN ('PENDING', 'ACCEPTED')
    if (trimmed.includes('FROM breakdown_assignments ba') && trimmed.includes("status IN ('PENDING', 'ACCEPTED')")) {
      const bId = params[0];
      const active = Array.from(this.breakdown_assignments.values()).find(
        (ba) => ba.breakdown_id === bId && ['PENDING', 'ACCEPTED'].includes(ba.status)
      );
      if (active) {
        const u = this.users.get(active.technician_id);
        return {
          rows: [
            {
              ...active,
              technician_name: u?.full_name,
              technician_code: u?.employee_code,
              technician_email: u?.email,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Look up active PENDING assignment: WHERE breakdown_id = $1 AND status = 'PENDING'
    if (trimmed.includes('FROM breakdown_assignments') && trimmed.includes("status = 'PENDING'")) {
      const bId = params[0];
      const pending = Array.from(this.breakdown_assignments.values()).find(
        (ba) => ba.breakdown_id === bId && ba.status === 'PENDING'
      );
      return { rows: pending ? [pending] : [], rowCount: pending ? 1 : 0 };
    }

    // Look up active ACCEPTED assignment: WHERE breakdown_id = $1 AND status = 'ACCEPTED'
    if (trimmed.includes('FROM breakdown_assignments') && trimmed.includes("status = 'ACCEPTED'")) {
      const bId = params[0];
      const accepted = Array.from(this.breakdown_assignments.values()).find(
        (ba) => ba.breakdown_id === bId && ba.status === 'ACCEPTED'
      );
      return { rows: accepted ? [accepted] : [], rowCount: accepted ? 1 : 0 };
    }

    // Distinct rejected technician IDs
    if (trimmed.includes('FROM breakdown_assignments') && trimmed.includes("status = 'REJECTED'")) {
      const bId = params[0];
      const rejected = Array.from(this.breakdown_assignments.values())
        .filter((ba) => ba.breakdown_id === bId && ba.status === 'REJECTED')
        .map((ba) => ({ technician_id: ba.technician_id }));
      return { rows: rejected, rowCount: rejected.length };
    }

    // Next attempt number
    if (trimmed.includes('MAX(attempt_number)')) {
      const bId = params[0];
      const assignments = Array.from(this.breakdown_assignments.values()).filter((ba) => ba.breakdown_id === bId);
      const maxAttempt = assignments.reduce((max, a) => Math.max(max, a.attempt_number || 1), 0);
      return { rows: [{ next_attempt: maxAttempt + 1 }], rowCount: 1 };
    }

    // Insert breakdown_assignments
    if (trimmed.startsWith('INSERT INTO breakdown_assignments')) {
      const breakdown_id = params[0];
      const technician_id = params[1];
      let assigned_by: any = null;
      let assignment_method: 'AUTOMATIC' | 'MANUAL' = 'AUTOMATIC';
      const status = 'PENDING';
      let attempt_number = 1;
      let notes: any = null;
      let reassignment_reason: any = null;

      if (trimmed.includes("'MANUAL'")) {
        assignment_method = 'MANUAL';
        assigned_by = params[2];
        attempt_number = params[3] || 1;
        if (trimmed.includes('reassignment_reason')) {
          reassignment_reason = params[4];
        } else {
          notes = params[4];
        }
      } else {
        assignment_method = 'AUTOMATIC';
        attempt_number = params[2] || 1;
      }

      const newId = `a1110000-0000-0000-0000-${String(this.breakdown_assignments.size + 1).padStart(12, '0')}`;
      const record = {
        id: newId,
        breakdown_id,
        technician_id,
        assigned_by,
        assignment_method,
        status,
        attempt_number,
        notes,
        reassignment_reason,
        assigned_at: new Date(),
        responded_at: null,
        rejection_reason: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.breakdown_assignments.set(newId, record);
      return { rows: [record], rowCount: 1 };
    }

    // Update breakdown_assignments: ACCEPT or REJECT or REASSIGN
    if (trimmed.startsWith('UPDATE breakdown_assignments')) {
      if (trimmed.includes("status = 'ACCEPTED'")) {
        const id = params[0];
        const ba = this.breakdown_assignments.get(id);
        if (ba) {
          ba.status = 'ACCEPTED';
          ba.responded_at = new Date();
          ba.updated_at = new Date();
        }
        return { rows: ba ? [ba] : [], rowCount: ba ? 1 : 0 };
      }
      if (trimmed.includes("status = 'REJECTED'")) {
        const reason = params[0];
        const id = params[1];
        const ba = this.breakdown_assignments.get(id);
        if (ba) {
          ba.status = 'REJECTED';
          ba.rejection_reason = reason;
          ba.responded_at = new Date();
          ba.updated_at = new Date();
        }
        return { rows: ba ? [ba] : [], rowCount: ba ? 1 : 0 };
      }
      if (trimmed.includes("status = 'REASSIGNED'")) {
        const reason = params[0];
        const id = params[1];
        const ba = this.breakdown_assignments.get(id);
        if (ba) {
          ba.status = 'REASSIGNED';
          ba.reassignment_reason = reason;
          ba.responded_at = new Date();
          ba.updated_at = new Date();
        }
        return { rows: ba ? [ba] : [], rowCount: ba ? 1 : 0 };
      }
    }

    // Update maintenance_requests (assigned_technician_id, assignment_status, current_assignment_id)
    if (trimmed.startsWith('UPDATE maintenance_requests')) {
      const bId = params[params.length - 1];
      const r = this.maintenance_requests.get(bId);
      if (r) {
        if (trimmed.includes("assignment_status = 'accepted'")) {
          r.assignment_status = 'accepted';
          r.assigned_technician_id = params[0];
        } else if (trimmed.includes('assigned_technician_id = NULL')) {
          r.assigned_technician_id = null;
          r.assignment_status = 'unassigned';
          r.current_assignment_id = null;
        } else if (trimmed.includes('assigned_technician_id = $1')) {
          r.assigned_technician_id = params[0];
          r.assignment_status = 'pending';
          r.current_assignment_id = params[1];
        }
        r.updated_at = new Date();
      }
      return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
    }

    // Lookup breakdown with machine details
    if (trimmed.includes('FROM maintenance_requests r') && trimmed.includes('JOIN machines m ON r.machine_id = m.id')) {
      const bId = params[0];
      const r = this.maintenance_requests.get(bId);
      if (!r) return { rows: [], rowCount: 0 };
      const m = this.machines.get(r.machine_id);
      const s = m ? this.shops.get(m.shop_id) : undefined;
      const p = s ? this.plants.get(s.plant_id) : undefined;
      const u = this.users.get(r.reported_by_id);
      const baTech = r.assigned_technician_id ? this.users.get(r.assigned_technician_id) : null;
      return {
        rows: [
          {
            ...r,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            shop_id: m?.shop_id,
            shop_name: s?.shop_name,
            plant_id: s?.plant_id,
            plant_name: p?.plant_name,
            reported_by_name: u?.full_name,
            reported_by_code: u?.employee_code,
            assigned_technician_name: baTech?.full_name || null,
            assigned_technician_code: baTech?.employee_code || null,
            work_order_id: null,
            wo_number: null,
            work_order_status: null,
          },
        ],
        rowCount: 1,
      };
    }

    // Lookup maintenance_requests r by id alone
    if (trimmed.includes('FROM maintenance_requests r') && trimmed.includes('WHERE r.id = $1')) {
      const r = this.maintenance_requests.get(params[0]);
      if (!r) return { rows: [], rowCount: 0 };
      const m = this.machines.get(r.machine_id);
      const s = m ? this.shops.get(m.shop_id) : undefined;
      return {
        rows: [{ ...r, machine_code: m?.machine_code, machine_name: m?.name, shop_id: m?.shop_id, plant_id: s?.plant_id }],
        rowCount: 1,
      };
    }

    // Assignment history query: ORDER BY ba.attempt_number ASC
    if (trimmed.includes('FROM breakdown_assignments ba') && trimmed.includes('ORDER BY ba.attempt_number ASC')) {
      const bId = params[0];
      const history = Array.from(this.breakdown_assignments.values())
        .filter((ba) => ba.breakdown_id === bId)
        .map((ba) => {
          const u = this.users.get(ba.technician_id);
          const mgr = ba.assigned_by ? this.users.get(ba.assigned_by) : null;
          return {
            ...ba,
            technician_name: u?.full_name,
            technician_code: u?.employee_code,
            technician_email: u?.email,
            assigned_by_name: mgr?.full_name || null,
          };
        });
      return { rows: history, rowCount: history.length };
    }

    return { rows: [], rowCount: 0 };
  }

  getPool(): DbPoolLike {
    const self = this;
    return {
      async connect(): Promise<DbClientLike> {
        let snapshot: any = null;
        return {
          async query(text: string, params: any[] = []) {
            const trimmed = text.trim();
            if (trimmed === 'BEGIN') {
              if (self.failNextTransaction) {
                self.failNextTransaction = false;
                throw new Error('Simulated database transaction failure.');
              }
              snapshot = {
                requests: new Map(Array.from(self.maintenance_requests.entries()).map(([k, v]) => [k, { ...v }])),
                assignments: new Map(Array.from(self.breakdown_assignments.entries()).map(([k, v]) => [k, { ...v }])),
                audit: [...self.audit_logs],
                notifs: [...self.notifications],
              };
              return { rows: [], rowCount: 0 };
            }
            if (trimmed === 'COMMIT') {
              snapshot = null;
              return { rows: [], rowCount: 0 };
            }
            if (trimmed === 'ROLLBACK') {
              if (snapshot) {
                self.maintenance_requests = snapshot.requests;
                self.breakdown_assignments = snapshot.assignments;
                self.audit_logs = snapshot.audit;
                self.notifications = snapshot.notifs;
                snapshot = null;
              }
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

describe('Automatic Technician Assignment Module (CMMS Backend)', () => {
  let mockDb: MockAssignmentDatabase;
  let mockIo: MockSocketIO;

  beforeEach(() => {
    mockDb = new MockAssignmentDatabase();
    mockIo = new MockSocketIO();
    setBreakdownsDb(mockDb.query.bind(mockDb), mockDb.getPool());
    setBreakdownsIo(mockIo);
  });

  // ==========================================
  // SECTION 1: AUTOMATIC SELECTION LOGIC
  // ==========================================
  describe('1. Automatic Technician Selection Logic', () => {
    it('1. Breakdown creation automatically assigns the designated machine technician when eligible', async () => {
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001', // Machine with designated technician (techDes)
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Spindle motor vibration',
          description: 'Spindle is vibrating beyond threshold.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);

      // Verify assigned technician is the designated technician
      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      assert.equal(complaint.assigned_technician_id, 'f0000000-0000-0000-0000-000000000010');
      assert.equal(complaint.assignment_status, 'pending');

      // Verify assignment record was created
      const assignment = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === complaintId
      );
      assert.ok(assignment, 'Assignment record must exist');
      assert.equal(assignment.technician_id, 'f0000000-0000-0000-0000-000000000010');
      assert.equal(assignment.assignment_method, 'AUTOMATIC');
      assert.equal(assignment.status, 'PENDING');
      assert.equal(assignment.attempt_number, 1);

      // Verify notification sent to designated technician
      const techNotifs = mockDb.notifications.filter((n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000010');
      assert.ok(techNotifs.length >= 1);
      assert.equal(techNotifs[0].type, 'assignment');
    });

    it('2. If designated technician is unavailable or inactive, another eligible technician is selected', async () => {
      // Mark designated technician inactive
      const techDes = mockDb.users.get('f0000000-0000-0000-0000-000000000010');
      techDes.is_active = false;

      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'medium',
          problem_title: 'Coolant pump leakage',
          description: 'Coolant leaking from seal.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);

      // Designated tech was inactive, so system must fall back to lowest workload eligible tech (techLowWorkload)
      assert.notEqual(complaint.assigned_technician_id, techDes.id);
      assert.equal(complaint.assigned_technician_id, 'f0000000-0000-0000-0000-000000000011');
      assert.equal(complaint.assignment_status, 'pending');
    });

    it('3. Workload balancing selects technician with lowest active workload', async () => {
      // Machine 2 has no designated technician
      // Candidates in Shop 1:
      // techLowWorkload has active_workload = 0
      // techHighWorkload has active_workload = 2
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000002',
          issue_category: 'mechanical',
          priority: 'medium',
          problem_title: 'Conveyor belt slip',
          description: 'Belt is slipping under load.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);

      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      // Selected technician must be techLowWorkload (workload 0 vs workload 2)
      assert.equal(complaint.assigned_technician_id, 'f0000000-0000-0000-0000-000000000011');
    });

    it('4. Inactive technicians are strictly excluded from assignment', async () => {
      // Deactivate all technicians except techHighWorkload
      const techDes = mockDb.users.get('f0000000-0000-0000-0000-000000000010');
      const techLow = mockDb.users.get('f0000000-0000-0000-0000-000000000011');
      techDes.is_active = false;
      techLow.is_active = false;

      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Motor trip',
          description: 'Motor tripped.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);

      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      assert.equal(complaint.assigned_technician_id, 'f0000000-0000-0000-0000-000000000012');
    });

    it('5. Technicians from other plants are excluded from assignment', async () => {
      // Machine 1 is in Pune Plant 1. Verify techOtherPlant (Plant 2) is never assigned
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000002',
          issue_category: 'mechanical',
          priority: 'medium',
          problem_title: 'Gearbox noise',
          description: 'Noise from main drive.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      const assignedTech = mockDb.users.get(complaint.assigned_technician_id);
      assert.equal(assignedTech.plant_id, 'b0000000-0000-0000-0000-000000000001');
    });

    it('6. Shop restrictions are enforced where applicable', async () => {
      // Machine 1 is in Shop 1. techOtherShop is in Shop 2.
      // Deactivate all Shop 1 technicians so only techOtherShop remains in Plant 1.
      mockDb.users.get('f0000000-0000-0000-0000-000000000010').is_active = false;
      mockDb.users.get('f0000000-0000-0000-0000-000000000011').is_active = false;
      mockDb.users.get('f0000000-0000-0000-0000-000000000012').is_active = false;
      mockDb.users.get('f0000000-0000-0000-0000-000000000016').is_active = false; // full capacity tech

      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001', // Shop 1
          issue_category: 'mechanical',
          priority: 'medium',
          problem_title: 'Hydraulic leak',
          description: 'Leak in pipe.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);

      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      // Since all Shop 1 technicians are inactive and techOtherShop is strictly in Shop 2,
      // shop restriction prevents assigning techOtherShop. Breakdown remains unassigned!
      assert.equal(complaint.assigned_technician_id, null);
      assert.equal(complaint.assignment_status, 'unassigned');
    });

    it('7. No eligible technician results in an unassigned breakdown and manager notification', async () => {
      // Deactivate ALL technicians in Plant 1
      for (const u of mockDb.users.values()) {
        if (u.role === 'technician') u.is_active = false;
      }

      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Major breakdown',
          description: 'Total stoppage.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);

      const complaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(complaintId);
      assert.equal(complaint.assigned_technician_id, null);
      assert.equal(complaint.assignment_status, 'unassigned');

      // Verify manager was notified about failure
      const mgrNotif = mockDb.notifications.find(
        (n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000002' && n.title.includes('No Eligible Technician')
      );
      assert.ok(mgrNotif, 'Manager notification must be dispatched when assignment fails');
    });
  });

  // ==========================================
  // SECTION 2: ACCEPTANCE AND REJECTION WORKFLOW
  // ==========================================
  describe('2. Acceptance and Rejection Workflow', () => {
    let testComplaintId: string;
    let assignedTechId: string;

    beforeEach(async () => {
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Spindle motor issue',
          description: 'Motor vibration test.',
        },
        {},
        {},
        {},
        opr
      );
      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      testComplaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assignedTechId = complaint.assigned_technician_id;
    });

    it('8. Assigned technician can accept their pending assignment', async () => {
      const assignedTech = mockDb.users.get(assignedTechId);
      const ctx = createMockContext({}, { id: testComplaintId }, {}, {}, assignedTech);

      await acceptBreakdownAssignment(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);

      // Verify assignment transitioned to ACCEPTED
      const assignment = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId
      );
      assert.equal(assignment.status, 'ACCEPTED');
      assert.ok(assignment.responded_at, 'Responded at timestamp must be recorded');

      // Verify breakdown updated
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assert.equal(complaint.assignment_status, 'accepted');
      assert.equal(complaint.assigned_technician_id, assignedTechId);

      // Verify manager notification sent
      const mgrNotif = mockDb.notifications.find(
        (n) => n.recipient_id === 'f0000000-0000-0000-0000-000000000002' && n.title.includes('Accepted')
      );
      assert.ok(mgrNotif, 'Manager must be notified when technician accepts');

      // Verify audit trail logged
      const auditLog = mockDb.audit_logs.find((a) => a.action === 'ASSIGNMENT_ACCEPTED');
      assert.ok(auditLog, 'Audit log for assignment acceptance must exist');
      assert.equal(auditLog.performed_by, assignedTechId);
    });

    it('9. Assigned technician can reject with a mandatory reason', async () => {
      const assignedTech = mockDb.users.get(assignedTechId);
      const ctx = createMockContext(
        { reason: 'Occupied with another urgent breakdown in Cell 4' },
        { id: testComplaintId },
        {},
        {},
        assignedTech
      );

      await rejectBreakdownAssignment(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.rejected, true);

      // Verify original assignment marked REJECTED
      const originalAssignment = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 1
      );
      assert.equal(originalAssignment.status, 'REJECTED');
      assert.equal(originalAssignment.rejection_reason, 'Occupied with another urgent breakdown in Cell 4');
    });

    it('10. Rejection triggers automatic reassignment to another eligible technician', async () => {
      const assignedTech = mockDb.users.get(assignedTechId);
      const ctx = createMockContext(
        { reason: 'Unavailable due to training' },
        { id: testComplaintId },
        {},
        {},
        assignedTech
      );

      await rejectBreakdownAssignment(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.reassigned, true);

      // Verify new assignment record was created with attempt_number = 2
      const newAssignment = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 2
      );
      assert.ok(newAssignment, 'New assignment record must be created on reassignment');
      assert.notEqual(newAssignment.technician_id, assignedTechId);
      assert.equal(newAssignment.status, 'PENDING');
      assert.equal(newAssignment.assignment_method, 'AUTOMATIC');

      // Verify breakdown updated to new technician
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assert.equal(complaint.assigned_technician_id, newAssignment.technician_id);
      assert.equal(complaint.assignment_status, 'pending');

      // Verify newly assigned technician received notification
      const newTechNotif = mockDb.notifications.find(
        (n) => n.recipient_id === newAssignment.technician_id && n.title.includes('New Breakdown Assignment')
      );
      assert.ok(newTechNotif, 'New technician must receive assignment notification');
    });

    it('11. Previously rejected technicians are not immediately selected again', async () => {
      const firstTech = mockDb.users.get(assignedTechId);
      // First rejection
      const ctx1 = createMockContext({ reason: 'Busy 1' }, { id: testComplaintId }, {}, {}, firstTech);
      await rejectBreakdownAssignment(ctx1.req, ctx1.res, ctx1.next);

      const secondAssign = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 2
      );
      const secondTech = mockDb.users.get(secondAssign.technician_id);

      // Second rejection
      const ctx2 = createMockContext({ reason: 'Busy 2' }, { id: testComplaintId }, {}, {}, secondTech);
      await rejectBreakdownAssignment(ctx2.req, ctx2.res, ctx2.next);

      // Third assignment must NOT be either firstTech or secondTech
      const thirdAssign = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 3
      );
      if (thirdAssign) {
        assert.notEqual(thirdAssign.technician_id, firstTech.id);
        assert.notEqual(thirdAssign.technician_id, secondTech.id);
      }
    });

    it('12. No eligible technician after rejection returns the request to manager control', async () => {
      // Deactivate all technicians except the currently assigned one
      for (const u of mockDb.users.values()) {
        if (u.role === 'technician' && u.id !== assignedTechId) {
          u.is_active = false;
        }
      }

      const assignedTech = mockDb.users.get(assignedTechId);
      const ctx = createMockContext({ reason: 'Only technician busy' }, { id: testComplaintId }, {}, {}, assignedTech);
      await rejectBreakdownAssignment(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.reassigned, false);

      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      assert.equal(complaint.assigned_technician_id, null);
      assert.equal(complaint.assignment_status, 'unassigned');

      // Verify manager notification about exhausted queue
      const exhaustedNotif = mockDb.notifications.find(
        (n) => n.title.includes('Exhausted') || n.message.includes('All eligible technicians rejected')
      );
      assert.ok(exhaustedNotif, 'Manager must be notified when all technicians are exhausted');
    });

    it('13. Unauthorized technicians cannot accept or reject another technician assignment', async () => {
      const unauthorizedTech = mockDb.users.get('f0000000-0000-0000-0000-000000000014'); // Deepak (other tech)

      // Attempt accept
      const acceptCtx = createMockContext({}, { id: testComplaintId }, {}, {}, unauthorizedTech);
      await acceptBreakdownAssignment(acceptCtx.req, acceptCtx.res, acceptCtx.next);
      assert.equal(acceptCtx.res.statusCode, 403);

      // Attempt reject
      const rejectCtx = createMockContext({ reason: 'Wrong tech' }, { id: testComplaintId }, {}, {}, unauthorizedTech);
      await rejectBreakdownAssignment(rejectCtx.req, rejectCtx.res, rejectCtx.next);
      assert.equal(rejectCtx.res.statusCode, 403);
    });

    it('14. Operators cannot manually assign or reassign technicians (HTTP 403)', async () => {
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const techId = 'f0000000-0000-0000-0000-000000000011';

      // Operator manual assign attempt
      const ctx1 = createMockContext({ technician_id: techId }, { id: testComplaintId }, {}, {}, opr);
      await managerManualAssign(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 403);

      // Operator manual reassign attempt
      const ctx2 = createMockContext({ technician_id: techId, reason: 'Operator override' }, { id: testComplaintId }, {}, {}, opr);
      await managerManualReassign(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 403);
    });
  });

  // ==========================================
  // SECTION 3: MANAGER CONTROL & MANUAL OVERRIDE
  // ==========================================
  describe('3. Manager Control & Manual Reassignment', () => {
    let testComplaintId: string;
    let initialTechId: string;
    const mgr1 = {
      id: 'f0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-MGR-001',
      full_name: 'Vikas Manager',
      email: 'manager@jcb.com',
      role: 'manager',
      plant_id: 'b0000000-0000-0000-0000-000000000001',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
    };

    beforeEach(async () => {
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Manager test breakdown',
          description: 'Testing manager control.',
        },
        {},
        {},
        {},
        opr
      );
      await reportBreakdown(ctx.req, ctx.res, ctx.next);
      testComplaintId = ctx.res.responseData.data.id;
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      initialTechId = complaint.assigned_technician_id;
    });

    it('15. Manager can view current assignment details and complete history', async () => {
      // Get current assignment
      const ctx1 = createMockContext({}, { id: testComplaintId }, {}, {}, mgr1);
      await getBreakdownAssignment(ctx1.req, ctx1.res, ctx1.next);

      assert.equal(ctx1.res.statusCode, 200);
      assert.equal(ctx1.res.responseData.success, true);
      assert.equal(ctx1.res.responseData.data.assignment_status, 'pending');
      assert.equal(ctx1.res.responseData.data.assigned_technician_id, initialTechId);
      assert.ok(ctx1.res.responseData.data.current_assignment);

      // Get history
      const ctx2 = createMockContext({}, { id: testComplaintId }, {}, {}, mgr1);
      await getBreakdownAssignmentHistory(ctx2.req, ctx2.res, ctx2.next);

      assert.equal(ctx2.res.statusCode, 200);
      assert.equal(ctx2.res.responseData.success, true);
      assert.ok(Array.isArray(ctx2.res.responseData.data));
      assert.ok(ctx2.res.responseData.data.length >= 1);
    });

    it('16. Manager can manually reassign an assigned breakdown with a mandatory reason', async () => {
      const newTechId = 'f0000000-0000-0000-0000-000000000012'; // Bharat
      const ctx = createMockContext(
        {
          technician_id: newTechId,
          reason: 'Emergency VIP machine inspection requires specialized technician.',
        },
        { id: testComplaintId },
        {},
        {},
        mgr1
      );

      await managerManualReassign(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);

      // Verify previous assignment marked REASSIGNED
      const prevAssign = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 1
      );
      assert.equal(prevAssign.status, 'REASSIGNED');
      assert.equal(prevAssign.reassignment_reason, 'Emergency VIP machine inspection requires specialized technician.');

      // Verify new assignment marked MANUAL and PENDING
      const newAssign = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.attempt_number === 2
      );
      assert.ok(newAssign, 'New assignment attempt must be created');
      assert.equal(newAssign.technician_id, newTechId);
      assert.equal(newAssign.assignment_method, 'MANUAL');
      assert.equal(newAssign.status, 'PENDING');
      assert.equal(newAssign.assigned_by, mgr1.id);

      // Verify previous technician received withdrawal notification
      const prevNotif = mockDb.notifications.find(
        (n) => n.recipient_id === initialTechId && n.title.includes('Reassigned')
      );
      assert.ok(prevNotif, 'Previous technician must receive reassignment notification');

      // Verify new technician received assignment notification
      const newNotif = mockDb.notifications.find(
        (n) => n.recipient_id === newTechId && n.title.includes('New Breakdown Assignment')
      );
      assert.ok(newNotif, 'New technician must receive assignment notification');

      // Verify audit trail logged
      const auditLog = mockDb.audit_logs.find((a) => a.action === 'MANUAL_REASSIGNMENT_CREATED');
      assert.ok(auditLog, 'Audit log for manual reassignment must exist');
      assert.equal(auditLog.performed_by, mgr1.id);
    });

    it('17. Manager manual reassign requires mandatory reason (HTTP 400)', async () => {
      const newTechId = 'f0000000-0000-0000-0000-000000000012';
      // Missing reason
      const ctx = createMockContext({ technician_id: newTechId }, { id: testComplaintId }, {}, {}, mgr1);

      await managerManualReassign(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /reason/i);
    });

    it('18. Manager can manually assign an unassigned breakdown', async () => {
      // Set breakdown to unassigned first
      const complaint = mockDb.maintenance_requests.get(testComplaintId);
      complaint.assigned_technician_id = null;
      complaint.assignment_status = 'unassigned';
      // Clear active assignments
      for (const a of mockDb.breakdown_assignments.values()) {
        if (a.breakdown_id === testComplaintId) a.status = 'CANCELLED';
      }

      const targetTechId = 'f0000000-0000-0000-0000-000000000011';
      const ctx = createMockContext(
        { technician_id: targetTechId, notes: 'Direct assignment by manager' },
        { id: testComplaintId },
        {},
        {},
        mgr1
      );

      await managerManualAssign(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);

      assert.equal(complaint.assigned_technician_id, targetTechId);
      assert.equal(complaint.assignment_status, 'pending');

      const assignment = Array.from(mockDb.breakdown_assignments.values()).find(
        (a) => a.breakdown_id === testComplaintId && a.status === 'PENDING'
      );
      assert.ok(assignment);
      assert.equal(assignment.technician_id, targetTechId);
      assert.equal(assignment.assignment_method, 'MANUAL');
      assert.equal(assignment.assigned_by, mgr1.id);
    });

    it('19. Cross-plant manager cannot assign technician to machine outside their plant facility (HTTP 403)', async () => {
      const mgrBallabgarh = mockDb.users.get('f0000000-0000-0000-0000-000000000020'); // Plant 2
      const ctx = createMockContext(
        { technician_id: 'f0000000-0000-0000-0000-000000000011', reason: 'Cross-plant attempt' },
        { id: testComplaintId }, // Pune Plant 1 machine
        {},
        {},
        mgrBallabgarh
      );

      await managerManualReassign(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 403);
    });

    it('20. Eligible technicians list endpoint returns candidate list with recommendations and workload', async () => {
      const ctx = createMockContext({}, { id: testComplaintId }, {}, {}, mgr1);
      await getEligibleTechnicians(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok(Array.isArray(ctx.res.responseData.data.technicians));
      assert.ok(ctx.res.responseData.data.technicians.length > 0);
      assert.ok(ctx.res.responseData.data.strategy);
    });
  });

  // ==========================================
  // SECTION 4: TRANSACTIONS & ROLLBACK INTEGRITY
  // ==========================================
  describe('4. Concurrency & Transaction Safety', () => {
    it('21. Failed transaction rolls back safely without leaving partial assignment records', async () => {
      mockDb.failNextTransaction = true;

      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const ctx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Rollback test',
          description: 'Testing transaction rollback.',
        },
        {},
        {},
        {},
        opr
      );

      await reportBreakdown(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 500);
      // Ensure no dangling breakdown request was committed
      assert.equal(mockDb.maintenance_requests.size, 0);
      // Ensure no dangling breakdown assignment was committed
      assert.equal(mockDb.breakdown_assignments.size, 0);
    });

    it('22. getBreakdownDetails response includes assigned technician metadata and assignment status', async () => {
      const opr = mockDb.users.get('f0000000-0000-0000-0000-000000000004');
      const createCtx = createMockContext(
        {
          machine_id: '10000000-0000-0000-0000-000000000001',
          issue_category: 'mechanical',
          priority: 'high',
          problem_title: 'Details test',
          description: 'Testing breakdown details integration.',
        },
        {},
        {},
        {},
        opr
      );
      await reportBreakdown(createCtx.req, createCtx.res, createCtx.next);
      const complaintId = createCtx.res.responseData.data.id;

      const getCtx = createMockContext({}, { id: complaintId }, {}, {}, opr);
      await getBreakdownDetails(getCtx.req, getCtx.res, getCtx.next);

      assert.equal(getCtx.res.statusCode, 200);
      const data = getCtx.res.responseData.data;
      assert.equal(data.id, complaintId);
      assert.equal(data.assignment_status, 'pending');
      assert.equal(data.assigned_technician_id, 'f0000000-0000-0000-0000-000000000010');
      assert.equal(data.assigned_technician_name, 'Designated Technician Dev');
      assert.equal(data.assigned_technician_code, 'EMP-TCH-DES');
    });
  });
});
