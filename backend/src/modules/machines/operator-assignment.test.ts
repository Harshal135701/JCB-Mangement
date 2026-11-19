/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Operator Machine Selection & Manager Approval Workflow Test Suite
 *
 * Comprehensive tests covering:
 * 1. Shop-scoped machine listing and dynamic filtering.
 * 2. Real-time availability calculation (available, occupied, pending, maintenance, breakdown).
 * 3. Operator sign-in reservation and concurrency control.
 * 4. Dual-reservation blocking (two operators cannot reserve the same machine).
 * 5. Single-active assignment restriction per operator.
 * 6. Facility & role isolation (cross-plant / cross-shop validation).
 * 7. Manager pending queue review, approval, and rejection flows.
 * 8. Real-time notifications and audit trail logging.
 * 9. Operator sign-out and reservation release.
 */

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
  getAvailableMachines,
  requestSignIn,
  getCurrentAssignment,
  cancelRequest,
  signOut,
  getPendingRequests,
  getActiveAssignments,
  approveRequest,
  rejectRequest,
  setOperatorAssignmentDb,
  resetOperatorAssignmentDb,
  setOperatorAssignmentIo,
  resetOperatorAssignmentIo,
} from './operator-assignment.controller';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

/**
 * Mock Response & Context Factory
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
    ip: '127.0.0.1',
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
      res.responseData = { success: false, message: err.message, details: err.details };
    }
  }) as NextFunction;

  return { req, res, next };
}

/**
 * Mock Socket.IO instance
 */
class MockSocketIo {
  public emittedEvents: { room?: string; event: string; payload: any }[] = [];

  to(room: string) {
    return {
      emit: (event: string, payload: any) => {
        this.emittedEvents.push({ room, event, payload });
      },
    };
  }

  emit(event: string, payload: any) {
    this.emittedEvents.push({ event, payload });
  }

  reset() {
    this.emittedEvents = [];
  }
}

/**
 * In-Memory Mock Database for Operator Assignment Workflow
 */
class MockAssignmentDatabase {
  public plants: Map<string, any> = new Map();
  public shops: Map<string, any> = new Map();
  public machines: Map<string, any> = new Map();
  public users: Map<string, any> = new Map();
  public assignments: Map<string, any> = new Map();
  public notifications: any[] = [];
  public audit_logs: any[] = [];

  private inTransaction: boolean = false;
  private transactionAssignments: Map<string, any> | null = null;
  private transactionMachines: Map<string, any> | null = null;

  constructor() {
    this.seed();
  }

  seed() {
    this.plants.clear();
    this.shops.clear();
    this.machines.clear();
    this.users.clear();
    this.assignments.clear();
    this.notifications = [];
    this.audit_logs = [];
    this.inTransaction = false;

    // Plants
    const plant1 = {
      id: 'a0000000-0000-0000-0000-000000000001',
      plant_code: 'PLANT-BALLABGARH',
      plant_name: 'JCB Ballabgarh Works',
    };
    const plant2 = {
      id: 'a0000000-0000-0000-0000-000000000002',
      plant_code: 'PLANT-PUNE',
      plant_name: 'JCB Pune Plant',
    };
    this.plants.set(plant1.id, plant1);
    this.plants.set(plant2.id, plant2);

    // Shops
    const shopCutting = {
      id: 'b0000000-0000-0000-0000-000000000001',
      plant_id: plant1.id,
      shop_code: 'SHOP-CUT',
      shop_name: 'Cutting Shop',
    };
    const shopWelding = {
      id: 'b0000000-0000-0000-0000-000000000002',
      plant_id: plant1.id,
      shop_code: 'SHOP-WELD',
      shop_name: 'Welding Shop',
    };
    const shopPune = {
      id: 'b0000000-0000-0000-0000-000000000003',
      plant_id: plant2.id,
      shop_code: 'SHOP-PUNE-ASM',
      shop_name: 'Pune Assembly',
    };
    this.shops.set(shopCutting.id, shopCutting);
    this.shops.set(shopWelding.id, shopWelding);
    this.shops.set(shopPune.id, shopPune);

    // Users
    const operator1 = {
      id: 'c0000000-0000-0000-0000-000000000001',
      employee_code: 'EMP-OP-001',
      full_name: 'Ramesh Sharma',
      email: 'ramesh.sharma@jcb-test.local',
      role: 'operator',
      plant_id: plant1.id,
      shop_id: shopCutting.id,
      shift: 'Shift A',
      is_active: true,
    };
    const operator2 = {
      id: 'c0000000-0000-0000-0000-000000000002',
      employee_code: 'EMP-OP-002',
      full_name: 'Suresh Verma',
      email: 'suresh.verma@jcb-test.local',
      role: 'operator',
      plant_id: plant1.id,
      shop_id: shopCutting.id,
      shift: 'Shift A',
      is_active: true,
    };
    const manager1 = {
      id: 'c0000000-0000-0000-0000-000000000003',
      employee_code: 'EMP-MGR-001',
      full_name: 'Vikram Singh',
      email: 'vikram.singh@jcb-test.local',
      role: 'manager',
      plant_id: plant1.id,
      shift: 'Shift A',
      is_active: true,
    };
    const adminUser = {
      id: 'c0000000-0000-0000-0000-000000000004',
      employee_code: 'EMP-ADM-001',
      full_name: 'Anil Kumar',
      email: 'anil.kumar@jcb-test.local',
      role: 'admin',
      is_active: true,
    };
    this.users.set(operator1.id, operator1);
    this.users.set(operator2.id, operator2);
    this.users.set(manager1.id, manager1);
    this.users.set(adminUser.id, adminUser);

    // Machines in Cutting Shop (Plant 1)
    const m1Available = {
      id: 'd0000000-0000-0000-0000-000000000001',
      shop_id: shopCutting.id,
      machine_code: 'JCB-CUT-001',
      name: 'CNC Plasma Cutter Alpha',
      category: 'CNC Plasma',
      status: 'idle',
      criticality: 'class_a',
      operating_hours: 1250,
      bay_line_location: 'Bay 1, Line A',
      assignment_status: 'unassigned',
      current_operator_id: null,
      current_assignment_id: null,
    };
    const m2Available = {
      id: 'd0000000-0000-0000-0000-000000000002',
      shop_id: shopCutting.id,
      machine_code: 'JCB-CUT-002',
      name: 'Laser Cutting System Beta',
      category: 'Laser Cutter',
      status: 'running',
      criticality: 'class_b',
      operating_hours: 3400,
      bay_line_location: 'Bay 1, Line B',
      assignment_status: 'unassigned',
      current_operator_id: null,
      current_assignment_id: null,
    };
    const m3Breakdown = {
      id: 'd0000000-0000-0000-0000-000000000003',
      shop_id: shopCutting.id,
      machine_code: 'JCB-CUT-003',
      name: 'Hydraulic Shear 500T',
      category: 'Shearing Machine',
      status: 'breakdown',
      criticality: 'class_a',
      operating_hours: 8900,
      bay_line_location: 'Bay 2, Line A',
      assignment_status: 'unassigned',
      current_operator_id: null,
      current_assignment_id: null,
    };
    const m4Maintenance = {
      id: 'd0000000-0000-0000-0000-000000000004',
      shop_id: shopCutting.id,
      machine_code: 'JCB-CUT-004',
      name: 'Bandsaw Heavy Duty',
      category: 'Sawing',
      status: 'under_maintenance',
      criticality: 'class_c',
      operating_hours: 450,
      bay_line_location: 'Bay 2, Line B',
      assignment_status: 'unassigned',
      current_operator_id: null,
      current_assignment_id: null,
    };

    this.machines.set(m1Available.id, m1Available);
    this.machines.set(m2Available.id, m2Available);
    this.machines.set(m3Breakdown.id, m3Breakdown);
    this.machines.set(m4Maintenance.id, m4Maintenance);
  }

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const s = sql.trim().toUpperCase();

    // 1. Transaction controls
    if (s === 'BEGIN') {
      this.inTransaction = true;
      this.transactionAssignments = new Map(this.assignments);
      this.transactionMachines = new Map(this.machines);
      return { rows: [], rowCount: 0 };
    }
    if (s === 'COMMIT') {
      this.inTransaction = false;
      this.transactionAssignments = null;
      this.transactionMachines = null;
      return { rows: [], rowCount: 0 };
    }
    if (s === 'ROLLBACK') {
      if (this.transactionAssignments) {
        this.assignments = this.transactionAssignments;
      }
      if (this.transactionMachines) {
        this.machines = this.transactionMachines;
      }
      this.inTransaction = false;
      this.transactionAssignments = null;
      this.transactionMachines = null;
      return { rows: [], rowCount: 0 };
    }

    // 2. Select Shop by ID
    if (s.includes('FROM SHOPS S') && s.includes('WHERE S.ID = $1')) {
      const shop = this.shops.get(params[0]);
      if (!shop) return { rows: [], rowCount: 0 };
      const plant = this.plants.get(shop.plant_id);
      return {
        rows: [
          {
            ...shop,
            plant_name: plant?.plant_name,
            plant_code: plant?.plant_code,
          },
        ],
        rowCount: 1,
      };
    }

    // 3. Select Machines in Shop
    if (s.includes('FROM MACHINES M') && s.includes('WHERE M.SHOP_ID = $1')) {
      const shopId = params[0];
      const result: any[] = [];
      for (const m of this.machines.values()) {
        if (m.shop_id === shopId && m.status !== 'decommissioned') {
          const shop = this.shops.get(m.shop_id);
          const plant = this.plants.get(shop?.plant_id);
          result.push({
            ...m,
            shop_name: shop?.shop_name,
            plant_id: shop?.plant_id,
            plant_name: plant?.plant_name,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 4. Select active or pending assignments for machines in shop
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes('OMA.SHOP_ID = $1') && s.includes("STATUS IN ('PENDING', 'APPROVED')")) {
      const shopId = params[0];
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.shop_id === shopId && ['pending', 'approved'].includes(a.status)) {
          const op = this.users.get(a.operator_id);
          result.push({
            assignment_id: a.id,
            machine_id: a.machine_id,
            operator_id: a.operator_id,
            assignment_status: a.status,
            shift: a.shift,
            created_at: a.created_at,
            operator_name: op?.full_name,
            operator_code: op?.employee_code,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 5. Select existing assignment for operator
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes('OMA.OPERATOR_ID = $1') && s.includes("STATUS IN ('PENDING', 'APPROVED')")) {
      const opId = params[0];
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.operator_id === opId && ['pending', 'approved'].includes(a.status)) {
          const m = this.machines.get(a.machine_id);
          const s = this.shops.get(a.shop_id);
          const p = this.plants.get(a.plant_id);
          const u = this.users.get(a.operator_id);
          const appr = a.approved_by ? this.users.get(a.approved_by) : null;
          result.push({
            ...a,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            machine_status: m?.status,
            operating_hours: m?.operating_hours,
            bay_line_location: m?.bay_line_location,
            shop_name: s?.shop_name,
            shop_code: s?.shop_code,
            plant_name: p?.plant_name,
            plant_code: p?.plant_code,
            operator_name: u?.full_name,
            operator_code: u?.employee_code,
            approver_name: appr?.full_name,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 6. Select recent rejected assignment for operator
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes("STATUS = 'REJECTED'")) {
      const opId = params[0];
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.operator_id === opId && a.status === 'rejected') {
          const m = this.machines.get(a.machine_id);
          const s = this.shops.get(a.shop_id);
          const p = this.plants.get(a.plant_id);
          const rej = a.rejected_by ? this.users.get(a.rejected_by) : null;
          result.push({
            ...a,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            shop_name: s?.shop_name,
            shop_code: s?.shop_code,
            plant_name: p?.plant_name,
            plant_code: p?.plant_code,
            approver_name: rej?.full_name,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 7. Lock Machine FOR UPDATE
    if (s.includes('FROM MACHINES M') && s.includes('WHERE M.ID = $1') && s.includes('FOR UPDATE')) {
      const m = this.machines.get(params[0]);
      if (!m) return { rows: [], rowCount: 0 };
      const shop = this.shops.get(m.shop_id);
      const plant = this.plants.get(shop?.plant_id);
      return {
        rows: [
          {
            ...m,
            shop_name: shop?.shop_name,
            plant_id: shop?.plant_id,
            plant_name: plant?.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 8. Lock active/pending assignments on machine FOR UPDATE
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS') && s.includes('MACHINE_ID = $1') && s.includes("STATUS IN ('PENDING', 'APPROVED')") && s.includes('FOR UPDATE')) {
      const machineId = params[0];
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.machine_id === machineId && ['pending', 'approved'].includes(a.status)) {
          result.push(a);
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 9. Lock active approved assignments on machine excluding current assignment
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS') && s.includes('MACHINE_ID = $1') && s.includes("STATUS = 'APPROVED'") && s.includes('ID !=')) {
      const machineId = params[0];
      const excludeId = params[1];
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.machine_id === machineId && a.status === 'approved' && a.id !== excludeId) {
          result.push(a);
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 10. Insert new assignment
    if (s.includes('INSERT INTO OPERATOR_MACHINE_ASSIGNMENTS')) {
      let operator_id: any;
      let machine_id: any;
      let shop_id: any;
      let plant_id: any;
      let shift: any;
      let assignment_type = 'temporary';
      let replacement_for_machine_id = null;
      let breakdown_id = null;
      let notes: any = null;

      if (params.length >= 7) {
        [operator_id, machine_id, shop_id, plant_id, shift, assignment_type, replacement_for_machine_id, breakdown_id, notes] = params;
      } else {
        [operator_id, machine_id, shop_id, plant_id, shift, notes] = params;
      }

      const id = 'e' + String(this.assignments.size + 1).padStart(7, '0') + '-0000-0000-0000-000000000001';
      const newAssignment = {
        id,
        operator_id,
        machine_id,
        shop_id,
        plant_id,
        shift: shift || 'Shift A',
        status: 'pending',
        assignment_type: assignment_type || 'temporary',
        replacement_for_machine_id: replacement_for_machine_id || null,
        breakdown_id: breakdown_id || null,
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.assignments.set(id, newAssignment);
      return { rows: [newAssignment], rowCount: 1 };
    }

    // 11. Update assignment (Approve, Reject, Cancel, Release)
    if (s.includes('UPDATE OPERATOR_MACHINE_ASSIGNMENTS')) {
      if (s.includes("SET STATUS = 'APPROVED'")) {
        const [approved_by, id] = params;
        const assign = this.assignments.get(id);
        if (assign) {
          assign.status = 'approved';
          assign.approved_by = approved_by;
          assign.approved_at = new Date().toISOString();
          assign.signed_in_at = new Date().toISOString();
          assign.updated_at = new Date().toISOString();
          return { rows: [assign], rowCount: 1 };
        }
      }
      if (s.includes("SET STATUS = 'REJECTED'")) {
        const [rejected_by, rejection_reason, id] = params;
        const assign = this.assignments.get(id);
        if (assign) {
          assign.status = 'rejected';
          assign.rejected_by = rejected_by;
          assign.rejection_reason = rejection_reason || null;
          assign.rejected_at = new Date().toISOString();
          assign.updated_at = new Date().toISOString();
          return { rows: [assign], rowCount: 1 };
        }
      }
      if (s.includes("SET STATUS = 'CANCELLED'")) {
        const [id] = params;
        const assign = this.assignments.get(id);
        if (assign) {
          assign.status = 'cancelled';
          assign.updated_at = new Date().toISOString();
          return { rows: [assign], rowCount: 1 };
        }
      }
      if (s.includes("SET STATUS = 'RELEASED'")) {
        const [id] = params;
        const assign = this.assignments.get(id);
        if (assign) {
          assign.status = 'released';
          assign.signed_out_at = new Date().toISOString();
          assign.updated_at = new Date().toISOString();
          return { rows: [assign], rowCount: 1 };
        }
      }
    }

    // 12. Update Machine assignment_status
    if (s.includes('UPDATE MACHINES')) {
      if (s.includes("ASSIGNMENT_STATUS = 'PENDING_APPROVAL'")) {
        const [assignment_id, machine_id] = params;
        const m = this.machines.get(machine_id);
        if (m) {
          m.assignment_status = 'pending_approval';
          m.current_assignment_id = assignment_id;
        }
        return { rows: [], rowCount: 1 };
      }
      if (s.includes("ASSIGNMENT_STATUS = 'OCCUPIED'")) {
        const [operator_id, assignment_id, machine_id] = params;
        const m = this.machines.get(machine_id);
        if (m) {
          m.assignment_status = 'occupied';
          m.current_operator_id = operator_id;
          m.current_assignment_id = assignment_id;
        }
        return { rows: [], rowCount: 1 };
      }
      if (s.includes("ASSIGNMENT_STATUS = 'UNASSIGNED'")) {
        const machine_id = params[0];
        const m = this.machines.get(machine_id);
        if (m) {
          m.assignment_status = 'unassigned';
          m.current_operator_id = null;
          m.current_assignment_id = null;
        }
        return { rows: [], rowCount: 1 };
      }
    }

    // 13. Select Assignment by ID (single lookup)
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes('WHERE OMA.ID = $1')) {
      const assign = this.assignments.get(params[0]);
      if (!assign) return { rows: [], rowCount: 0 };
      const m = this.machines.get(assign.machine_id);
      const s = this.shops.get(assign.shop_id);
      const p = this.plants.get(assign.plant_id);
      const u = this.users.get(assign.operator_id);
      const appr = assign.approved_by ? this.users.get(assign.approved_by) : null;
      return {
        rows: [
          {
            ...assign,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            machine_status: m?.status,
            operating_hours: m?.operating_hours,
            bay_line_location: m?.bay_line_location,
            shop_name: s?.shop_name,
            shop_code: s?.shop_code,
            plant_name: p?.plant_name,
            plant_code: p?.plant_code,
            operator_name: u?.full_name,
            operator_code: u?.employee_code,
            operator_email: u?.email,
            operator_shift: u?.shift,
            approver_name: appr?.full_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 14b. Lock Assignment for Operator Cancel
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS') && s.includes("STATUS = 'PENDING'") && s.includes('OPERATOR_ID = $1') && s.includes('FOR UPDATE')) {
      const opId = params[0];
      const assignId = params.length > 1 ? params[1] : null;
      for (const a of this.assignments.values()) {
        if (a.operator_id === opId && a.status === 'pending' && (!assignId || a.id === assignId)) {
          return { rows: [a], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // 14c. Lock Assignment for Sign-Out
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS') && s.includes("STATUS = 'APPROVED'") && s.includes('FOR UPDATE')) {
      for (const a of this.assignments.values()) {
        if (a.status === 'approved') {
          // If params has operatorId or assignmentId
          const matches = params.every((p) => a.operator_id === p || a.id === p);
          if (matches) {
            return { rows: [a], rowCount: 1 };
          }
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // 14. Lock Assignment by ID FOR UPDATE (Approval / Rejection)
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS') && s.includes('WHERE ID = $1') && s.includes('FOR UPDATE')) {
      const assign = this.assignments.get(params[0]);
      return { rows: assign ? [assign] : [], rowCount: assign ? 1 : 0 };
    }

    // 15. Lock Machine by ID FOR UPDATE (Simple lookup)
    if (s.includes('FROM MACHINES WHERE ID = $1 FOR UPDATE')) {
      const m = this.machines.get(params[0]);
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    // 16. Pending Requests Query (Manager View)
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes("OMA.STATUS = 'PENDING'")) {
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.status === 'pending') {
          // Check plant filter if provided in params
          if (params.length > 0 && params[0] && a.plant_id !== params[0]) {
            continue;
          }
          const m = this.machines.get(a.machine_id);
          const s = this.shops.get(a.shop_id);
          const p = this.plants.get(a.plant_id);
          const u = this.users.get(a.operator_id);
          result.push({
            ...a,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            machine_status: m?.status,
            operating_hours: m?.operating_hours,
            bay_line_location: m?.bay_line_location,
            shop_name: s?.shop_name,
            shop_code: s?.shop_code,
            plant_name: p?.plant_name,
            plant_code: p?.plant_code,
            operator_name: u?.full_name,
            operator_code: u?.employee_code,
            operator_email: u?.email,
            operator_shift: u?.shift,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 17. Active Assignments Query (Manager View)
    if (s.includes('FROM OPERATOR_MACHINE_ASSIGNMENTS OMA') && s.includes("OMA.STATUS = 'APPROVED'")) {
      const result: any[] = [];
      for (const a of this.assignments.values()) {
        if (a.status === 'approved') {
          if (params.length > 0 && params[0] && a.plant_id !== params[0]) {
            continue;
          }
          const m = this.machines.get(a.machine_id);
          const s = this.shops.get(a.shop_id);
          const p = this.plants.get(a.plant_id);
          const u = this.users.get(a.operator_id);
          const appr = a.approved_by ? this.users.get(a.approved_by) : null;
          result.push({
            ...a,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            machine_status: m?.status,
            operating_hours: m?.operating_hours,
            bay_line_location: m?.bay_line_location,
            shop_name: s?.shop_name,
            shop_code: s?.shop_code,
            plant_name: p?.plant_name,
            plant_code: p?.plant_code,
            operator_name: u?.full_name,
            operator_code: u?.employee_code,
            approver_name: appr?.full_name,
          });
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 17b. Query Operator permanent machine
    if (s.includes('FROM USERS U') && s.includes('WHERE U.ID = $1')) {
      const u = this.users.get(params[0]);
      if (!u) return { rows: [], rowCount: 0 };
      const m = u.permanent_machine_id ? this.machines.get(u.permanent_machine_id) : null;
      const s = m ? this.shops.get(m.shop_id) : null;
      const p = s ? this.plants.get(s.plant_id) : null;
      return {
        rows: [
          {
            permanent_machine_id: u.permanent_machine_id || null,
            shop_id: u.shop_id,
            plant_id: u.plant_id,
            machine_code: m?.machine_code || null,
            name: m?.name || null,
            category: m?.category || null,
            status: m?.status || null,
            bay_line_location: m?.bay_line_location || null,
            operating_hours: m?.operating_hours || null,
            shop_name: s?.shop_name || null,
            plant_name: p?.plant_name || null,
          },
        ],
        rowCount: 1,
      };
    }

    // 17c. Query active breakdown for machine
    if (s.includes('FROM MAINTENANCE_REQUESTS') && s.includes('WHERE MACHINE_ID = $1')) {
      return { rows: [], rowCount: 0 };
    }

    // 18. Find managers for notification
    if (s.includes('FROM USERS') && s.includes("ROLE IN ('MANAGER', 'ADMIN')")) {
      const plant_id = params[0];
      const result: any[] = [];
      for (const u of this.users.values()) {
        if (['manager', 'admin'].includes(u.role) && (!u.plant_id || u.plant_id === plant_id)) {
          result.push(u);
        }
      }
      return { rows: result, rowCount: result.length };
    }

    // 19. Insert Notification
    if (s.includes('INSERT INTO NOTIFICATIONS')) {
      const [recipient_id, title, message, type, link_url, entity_type, entity_id, plant_id, shop_id] = params;
      const notif = {
        id: 'f' + String(this.notifications.length + 1).padStart(7, '0') + '-0000-0000-0000-000000000001',
        recipient_id,
        title,
        message,
        type,
        link_url,
        entity_type,
        entity_id,
        plant_id,
        shop_id,
        created_at: new Date().toISOString(),
      };
      this.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // 19b. Notification unread count
    if (s.includes('FROM NOTIFICATIONS') && s.includes('UNREAD_COUNT')) {
      return { rows: [{ unread_count: 1 }], rowCount: 1 };
    }

    // 20. Insert Audit Log
    if (s.includes('INSERT INTO AUDIT_LOGS')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values, ip_address] = params;
      const log = {
        entity_name,
        entity_id,
        action,
        performed_by,
        old_values,
        new_values,
        ip_address,
        created_at: new Date().toISOString(),
      };
      this.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // 21. Update user shop_id
    if (s.includes('UPDATE USERS SET SHOP_ID')) {
      const [shop_id, user_id] = params;
      const u = this.users.get(user_id);
      if (u) u.shop_id = shop_id;
      return { rows: [], rowCount: 1 };
    }

    // Fallback
    return { rows: [], rowCount: 0 };
  }

  getPool() {
    return {
      query: this.query.bind(this),
      connect: async () => ({
        query: this.query.bind(this),
        release: () => {},
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE: Operator Machine Selection & Manager Approval Workflow
// ---------------------------------------------------------------------------
describe('Operator Machine Selection & Manager Approval Workflow', () => {
  let mockDb: MockAssignmentDatabase;
  let mockIo: MockSocketIo;

  // Test Entities
  const plant1Id = 'a0000000-0000-0000-0000-000000000001';
  const plant2Id = 'a0000000-0000-0000-0000-000000000002';
  const shopCutId = 'b0000000-0000-0000-0000-000000000001';
  const shopWeldId = 'b0000000-0000-0000-0000-000000000002';
  const shopPuneId = 'b0000000-0000-0000-0000-000000000003';

  const m1Cut001 = 'd0000000-0000-0000-0000-000000000001'; // idle -> available
  const m2Cut002 = 'd0000000-0000-0000-0000-000000000002'; // running -> available
  const m3Breakdown = 'd0000000-0000-0000-0000-000000000003'; // breakdown
  const m4Maintenance = 'd0000000-0000-0000-0000-000000000004'; // under_maintenance

  const operator1User: AuthenticatedUser = {
    id: 'c0000000-0000-0000-0000-000000000001',
    employee_code: 'EMP-OP-001',
    email: 'ramesh.sharma@jcb-test.local',
    role: 'operator',
    plant_id: plant1Id,
    shop_id: shopCutId,
  };

  const operator2User: AuthenticatedUser = {
    id: 'c0000000-0000-0000-0000-000000000002',
    employee_code: 'EMP-OP-002',
    email: 'suresh.verma@jcb-test.local',
    role: 'operator',
    plant_id: plant1Id,
    shop_id: shopCutId,
  };

  const manager1User: AuthenticatedUser = {
    id: 'c0000000-0000-0000-0000-000000000003',
    employee_code: 'EMP-MGR-001',
    email: 'vikram.singh@jcb-test.local',
    role: 'manager',
    plant_id: plant1Id,
  };

  const adminUser: AuthenticatedUser = {
    id: 'c0000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-ADM-001',
    email: 'anil.kumar@jcb-test.local',
    role: 'admin',
  };

  beforeEach(() => {
    mockDb = new MockAssignmentDatabase();
    mockIo = new MockSocketIo();
    setOperatorAssignmentDb(mockDb.query.bind(mockDb), mockDb.getPool());
    setOperatorAssignmentIo(mockIo);
  });

  // 1. Machine Availability & Shop Scoping
  it('1. Operator views machines belonging strictly to the selected shop with calculated availability', async () => {
    const { req, res, next } = createMockContext(
      {},
      {},
      { shop_id: shopCutId, plant_id: plant1Id },
      {},
      operator1User
    );

    await getAvailableMachines(req, res, next);

    assert.equal(res.statusCode, 200);
    assert.equal(res.responseData.success, true);
    assert.equal(res.responseData.count, 4);

    const machines = res.responseData.data;
    const m1 = machines.find((m: any) => m.id === m1Cut001);
    const m2 = machines.find((m: any) => m.id === m2Cut002);
    const m3 = machines.find((m: any) => m.id === m3Breakdown);
    const m4 = machines.find((m: any) => m.id === m4Maintenance);

    // M1 and M2 are operational and unassigned -> available
    assert.equal(m1.assignment_status, 'available');
    assert.equal(m1.is_selectable, true);

    assert.equal(m2.assignment_status, 'available');
    assert.equal(m2.is_selectable, true);

    // M3 is under breakdown -> breakdown, not selectable
    assert.equal(m3.assignment_status, 'breakdown');
    assert.equal(m3.is_selectable, false);
    assert.match(m3.unavailability_reason, /breakdown/i);

    // M4 is under maintenance -> maintenance, not selectable
    assert.equal(m4.assignment_status, 'maintenance');
    assert.equal(m4.is_selectable, false);
    assert.match(m4.unavailability_reason, /maintenance/i);
  });

  // 2. Cross-plant isolation
  it('2. Unauthorized cross-plant access is blocked (HTTP 403)', async () => {
    const { req, res, next } = createMockContext(
      {},
      {},
      { shop_id: shopPuneId, plant_id: plant2Id },
      {},
      operator1User // Scoped to Plant 1
    );

    await getAvailableMachines(req, res, next);

    assert.equal(res.statusCode, 403);
    assert.equal(res.responseData.success, false);
    assert.match(res.responseData.message, /Access denied/i);
  });

  // 3. Operator creates pending sign-in request
  it('3. Operator submits sign-in request: creates pending assignment, reserves machine, notifies managers', async () => {
    const { req, res, next } = createMockContext(
      {
        machine_id: m1Cut001,
        shop_id: shopCutId,
        plant_id: plant1Id,
        shift: 'Shift A',
        notes: 'Pre-shift check starting on Plasma Alpha',
      },
      {},
      {},
      {},
      operator1User
    );

    await requestSignIn(req, res, next);

    assert.equal(res.statusCode, 201);
    assert.equal(res.responseData.success, true);
    assert.equal(res.responseData.data.status, 'pending');
    assert.equal(res.responseData.data.machine_id, m1Cut001);
    assert.equal(res.responseData.data.operator_id, operator1User.id);

    // Verify machine in mock database is marked as pending_approval
    const machine = mockDb.machines.get(m1Cut001);
    assert.equal(machine.assignment_status, 'pending_approval');

    // Verify real-time notification was dispatched to plant managers
    assert.ok(mockDb.notifications.length >= 1);
    const notif = mockDb.notifications.find((n) => n.recipient_id === manager1User.id);
    assert.ok(notif, 'Manager received notification');
    assert.match(notif.title, /Machine Sign-In Request/i);

    // Verify Socket.IO event emitted
    const socketEvent = mockIo.emittedEvents.find((e) => e.event === 'operator:machine_requested');
    assert.ok(socketEvent, 'Socket.IO operator:machine_requested was emitted');

    // Verify audit log recorded
    const audit = mockDb.audit_logs.find((a) => a.action === 'OPERATOR_SIGNIN_REQUESTED');
    assert.ok(audit, 'Audit log recorded for sign-in request');
  });

  // 4. Pending request reserves machine: second operator cannot request same machine
  it('4. Concurrency Guard: Second operator cannot request machine with pending reservation (HTTP 409 Conflict)', async () => {
    // 1st operator requests machine 1
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    assert.equal(res1.statusCode, 201);

    // 2nd operator attempts to request machine 1
    const { req: req2, res: res2, next: next2 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator2User
    );
    await requestSignIn(req2, res2, next2);

    assert.equal(res2.statusCode, 409);
    assert.equal(res2.responseData.success, false);
    assert.match(res2.responseData.message, /already has a pending request/i);
  });

  // 5. Operator cannot create multiple pending or active requests
  it('5. Operator cannot request a second machine while having an active or pending request (HTTP 409)', async () => {
    // Operator requests Machine 1
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    assert.equal(res1.statusCode, 201);

    // Same operator attempts to request Machine 2
    const { req: req2, res: res2, next: next2 } = createMockContext(
      { machine_id: m2Cut002, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req2, res2, next2);

    assert.equal(res2.statusCode, 409);
    assert.equal(res2.responseData.success, false);
    assert.match(res2.responseData.message, /already have a pending approval assignment/i);
  });

  // 6. Cross-shop machine selection rejected
  it('6. Machine selection validation: machine not belonging to requested shop returns HTTP 400', async () => {
    const { req, res, next } = createMockContext(
      {
        machine_id: m1Cut001, // Belongs to shopCutId
        shop_id: shopWeldId,  // Mismatched shop
        plant_id: plant1Id,
      },
      {},
      {},
      {},
      operator1User
    );

    await requestSignIn(req, res, next);

    assert.equal(res.statusCode, 400);
    assert.equal(res.responseData.success, false);
    assert.match(res.responseData.message, /does not belong to the selected shop/i);
  });

  // 7. Breakdown / maintenance machine sign-in rejected
  it('7. Cannot sign in to a machine that is in breakdown or maintenance (HTTP 400)', async () => {
    const { req, res, next } = createMockContext(
      {
        machine_id: m3Breakdown,
        shop_id: shopCutId,
        plant_id: plant1Id,
      },
      {},
      {},
      {},
      operator1User
    );

    await requestSignIn(req, res, next);

    assert.equal(res.statusCode, 400);
    assert.equal(res.responseData.success, false);
    assert.match(res.responseData.message, /breakdown/i);
  });

  // 8. Operator cancels pending request
  it('8. Operator cancels pending request: releases reservation and returns machine to unassigned', async () => {
    // 1. Submit request
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    const assignmentId = res1.responseData.data.id;

    // 2. Cancel request
    const { req: req2, res: res2, next: next2 } = createMockContext(
      { assignment_id: assignmentId },
      {},
      {},
      {},
      operator1User
    );
    await cancelRequest(req2, res2, next2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.responseData.success, true);
    assert.equal(res2.responseData.data.status, 'cancelled');

    // Machine should now be unassigned
    const machine = mockDb.machines.get(m1Cut001);
    assert.equal(machine.assignment_status, 'unassigned');

    // Another operator should now be able to request it
    const { req: req3, res: res3, next: next3 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator2User
    );
    await requestSignIn(req3, res3, next3);
    assert.equal(res3.statusCode, 201);
  });

  // 9. Manager views pending requests queue
  it('9. Manager views pending sign-in requests queue scoped to their plant', async () => {
    // Create pending request
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);

    // Manager views queue
    const { req: req2, res: res2, next: next2 } = createMockContext(
      {},
      {},
      { plant_id: plant1Id },
      {},
      manager1User
    );
    await getPendingRequests(req2, res2, next2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.responseData.success, true);
    assert.equal(res2.responseData.count, 1);
    assert.equal(res2.responseData.data[0].operator_name, 'Ramesh Sharma');
    assert.equal(res2.responseData.data[0].machine_code, 'JCB-CUT-001');
  });

  // 10. Manager approves request: activates assignment, marks machine occupied, notifies operator
  it('10. Manager approves request: activates assignment, marks machine occupied, notifies operator', async () => {
    // 1. Submit request
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    const assignmentId = res1.responseData.data.id;

    // 2. Manager approves
    const { req: req2, res: res2, next: next2 } = createMockContext(
      {},
      { id: assignmentId },
      {},
      {},
      manager1User
    );
    await approveRequest(req2, res2, next2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.responseData.success, true);
    assert.equal(res2.responseData.data.status, 'approved');
    assert.equal(res2.responseData.data.approved_by, manager1User.id);
    assert.ok(res2.responseData.data.signed_in_at);

    // Machine state updated to occupied
    const machine = mockDb.machines.get(m1Cut001);
    assert.equal(machine.assignment_status, 'occupied');
    assert.equal(machine.current_operator_id, operator1User.id);

    // Notification sent to operator
    const notif = mockDb.notifications.find((n) => n.recipient_id === operator1User.id);
    assert.ok(notif, 'Operator received approval notification');
    assert.match(notif.title, /Approved/i);

    // Operator checking current assignment sees active machine
    const { req: req3, res: res3, next: next3 } = createMockContext(
      {},
      {},
      {},
      {},
      operator1User
    );
    await getCurrentAssignment(req3, res3, next3);

    assert.equal(res3.statusCode, 200);
    assert.equal(res3.responseData.data.currentAssignment.status, 'approved');
    assert.equal(res3.responseData.data.currentAssignment.machine_code, 'JCB-CUT-001');
  });

  // 11. Manager rejects request: releases reservation with reason, notifies operator
  it('11. Manager rejects request: releases reservation, sets status to rejected, notifies operator', async () => {
    // 1. Submit request
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    const assignmentId = res1.responseData.data.id;

    // 2. Manager rejects with reason
    const { req: req2, res: res2, next: next2 } = createMockContext(
      { rejection_reason: 'Assigned to different line for today shift.' },
      { id: assignmentId },
      {},
      {},
      manager1User
    );
    await rejectRequest(req2, res2, next2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.responseData.success, true);
    assert.equal(res2.responseData.data.status, 'rejected');
    assert.equal(res2.responseData.data.rejection_reason, 'Assigned to different line for today shift.');

    // Machine state returned to unassigned
    const machine = mockDb.machines.get(m1Cut001);
    assert.equal(machine.assignment_status, 'unassigned');

    // Notification sent to operator
    const notif = mockDb.notifications.find((n) => n.recipient_id === operator1User.id);
    assert.ok(notif, 'Operator received rejection notification');
    assert.match(notif.title, /Rejected/i);

    // Operator checking current assignment sees rejection feedback
    const { req: req3, res: res3, next: next3 } = createMockContext(
      {},
      {},
      {},
      {},
      operator1User
    );
    await getCurrentAssignment(req3, res3, next3);

    assert.equal(res3.statusCode, 200);
    assert.equal(res3.responseData.data.currentAssignment, null);
    assert.equal(res3.responseData.data.recentRejected.status, 'rejected');
  });

  // 12. Operator sign-out at shift end
  it('12. Operator signs out: marks session released, returns machine to unassigned status', async () => {
    // 1. Submit and Approve
    const { req: req1, res: res1, next: next1 } = createMockContext(
      { machine_id: m1Cut001, shop_id: shopCutId, plant_id: plant1Id },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(req1, res1, next1);
    const assignmentId = res1.responseData.data.id;

    const { req: req2, res: res2, next: next2 } = createMockContext(
      {},
      { id: assignmentId },
      {},
      {},
      manager1User
    );
    await approveRequest(req2, res2, next2);

    // 2. Sign out
    const { req: req3, res: res3, next: next3 } = createMockContext(
      { assignment_id: assignmentId },
      {},
      {},
      {},
      operator1User
    );
    await signOut(req3, res3, next3);

    assert.equal(res3.statusCode, 200);
    assert.equal(res3.responseData.success, true);
    assert.equal(res3.responseData.data.status, 'released');
    assert.ok(res3.responseData.data.signed_out_at);

    // Machine returned to unassigned
    const machine = mockDb.machines.get(m1Cut001);
    assert.equal(machine.assignment_status, 'unassigned');
    assert.equal(machine.current_operator_id, null);
  });

  // 13. Operator with permanent machine in breakdown requests temporary machine
  it('13. Operator with broken permanent machine requests temporary machine (assignment_type = temporary)', async () => {
    // Set operator's permanent machine to M3 (which is under breakdown)
    const op = mockDb.users.get(operator1User.id);
    op.permanent_machine_id = m3Breakdown;

    // Check operator current assignment state: permanentMachine returned and canRequestTemporary is true
    const { req: reqCur, res: resCur, next: nextCur } = createMockContext(
      {},
      {},
      {},
      {},
      operator1User
    );
    await getCurrentAssignment(reqCur, resCur, nextCur);
    assert.equal(resCur.statusCode, 200);
    assert.ok(resCur.responseData.data.permanentMachine);
    assert.equal(resCur.responseData.data.permanentMachine.id, m3Breakdown);
    assert.equal(resCur.responseData.data.canRequestTemporary, true);

    // Operator requests M1 as temporary replacement
    const { req: reqSign, res: resSign, next: nextSign } = createMockContext(
      {
        machine_id: m1Cut001,
        shop_id: shopCutId,
        plant_id: plant1Id,
        shift: 'Shift A',
        assignment_type: 'temporary',
        replacement_for_machine_id: m3Breakdown,
        notes: 'Replacing broken permanent machine Plasma Gamma',
      },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(reqSign, resSign, nextSign);

    assert.equal(resSign.statusCode, 201);
    assert.equal(resSign.responseData.success, true);
    assert.equal(resSign.responseData.data.status, 'pending');
    assert.equal(resSign.responseData.data.assignment_type, 'temporary');
    assert.equal(resSign.responseData.data.replacement_for_machine_id, m3Breakdown);

    // Temporary machine is reserved
    const tempMachine = mockDb.machines.get(m1Cut001);
    assert.equal(tempMachine.assignment_status, 'pending_approval');
  });

  // 14. Manager approves temporary machine request: temporary machine occupied, permanent machine unchanged
  it('14. Manager approves temporary machine request: marks temporary machine occupied and preserves permanent machine', async () => {
    const op = mockDb.users.get(operator1User.id);
    op.permanent_machine_id = m3Breakdown;

    // 1. Operator requests temporary machine
    const { req: reqReq, res: resReq, next: nextReq } = createMockContext(
      {
        machine_id: m2Cut002,
        shop_id: shopCutId,
        plant_id: plant1Id,
        shift: 'Shift A',
        assignment_type: 'temporary',
        replacement_for_machine_id: m3Breakdown,
        notes: 'Temporary machine request for shift',
      },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(reqReq, resReq, nextReq);
    const tempAssignId = resReq.responseData.data.id;

    // 2. Manager views pending requests
    const { req: reqList, res: resList, next: nextList } = createMockContext(
      {},
      {},
      {},
      {},
      manager1User
    );
    await getPendingRequests(reqList, resList, nextList);
    assert.equal(resList.statusCode, 200);
    const pendingItem = resList.responseData.data.find((a: any) => a.id === tempAssignId);
    assert.ok(pendingItem);
    assert.equal(pendingItem.assignment_type, 'temporary');

    // 3. Manager approves
    const { req: reqAppr, res: resAppr, next: nextAppr } = createMockContext(
      {},
      { id: tempAssignId },
      {},
      {},
      manager1User
    );
    await approveRequest(reqAppr, resAppr, nextAppr);
    assert.equal(resAppr.statusCode, 200);
    assert.equal(resAppr.responseData.data.status, 'approved');

    // 4. Temporary machine M2 is marked occupied
    const tempMachine = mockDb.machines.get(m2Cut002);
    assert.equal(tempMachine.assignment_status, 'occupied');
    assert.equal(tempMachine.current_operator_id, operator1User.id);

    // 5. Operator's permanent machine relationship is completely preserved
    const updatedOp = mockDb.users.get(operator1User.id);
    assert.equal(updatedOp.permanent_machine_id, m3Breakdown);
  });

  // 15. Release temporary machine assignment: returns temporary machine to available
  it('15. Releasing temporary assignment makes temporary machine available and operator returns to permanent machine', async () => {
    const op = mockDb.users.get(operator1User.id);
    op.permanent_machine_id = m3Breakdown;

    // 1. Submit and Approve
    const { req: reqReq, res: resReq, next: nextReq } = createMockContext(
      {
        machine_id: m1Cut001,
        shop_id: shopCutId,
        plant_id: plant1Id,
        shift: 'Shift A',
        assignment_type: 'temporary',
        replacement_for_machine_id: m3Breakdown,
      },
      {},
      {},
      {},
      operator1User
    );
    await requestSignIn(reqReq, resReq, nextReq);
    const tempAssignId = resReq.responseData.data.id;

    const { req: reqAppr, res: resAppr, next: nextAppr } = createMockContext(
      {},
      { id: tempAssignId },
      {},
      {},
      manager1User
    );
    await approveRequest(reqAppr, resAppr, nextAppr);

    // 2. Release temporary assignment
    const { req: reqRel, res: resRel, next: nextRel } = createMockContext(
      { assignment_id: tempAssignId },
      {},
      {},
      {},
      operator1User
    );
    await signOut(reqRel, resRel, nextRel);

    assert.equal(resRel.statusCode, 200);
    assert.equal(resRel.responseData.data.status, 'released');

    // Temporary machine M1 is unassigned and available
    const tempMachine = mockDb.machines.get(m1Cut001);
    assert.equal(tempMachine.assignment_status, 'unassigned');
    assert.equal(tempMachine.current_operator_id, null);

    // Operator permanent machine is unchanged
    assert.equal(op.permanent_machine_id, m3Breakdown);
  });
});
