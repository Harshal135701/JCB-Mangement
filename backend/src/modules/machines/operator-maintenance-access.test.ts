/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Operator Read-Only Maintenance Status & Scoping - Security Test Suite
 *
 * Verifies that:
 * 1. Operators can view read-only maintenance status of their permanent machine.
 * 2. Operators can view read-only maintenance status of their approved temporary machine.
 * 3. Operators CANNOT view maintenance information for other operators' machines (HTTP 403).
 * 4. Operators CANNOT access machines from unauthorized plants or shops (HTTP 403).
 * 5. Operators CANNOT create work orders (HTTP 403).
 * 6. Operators CANNOT update maintenance status or milestones (HTTP 403).
 * 7. Operators CANNOT assign or reassign technicians (HTTP 403).
 * 8. Operators CANNOT approve, verify, or reject maintenance requests (HTTP 403).
 * 9. Operators CANNOT modify PM plans or reschedule PMs (HTTP 403).
 * 10. URL parameter tampering cannot bypass authorization.
 * 11. Manager, technician, and admin permissions continue working as before.
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
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import {
  getOperatorMaintenanceStatus,
  getMachineMaintenanceStatus,
  setOperatorMaintenanceAccessDb,
  resetOperatorMaintenanceAccessDb,
} from './operator-maintenance-access.controller';
import {
  getWorkOrders,
  getWorkOrderDetails,
  getWorkOrderParts,
  createWorkOrderFromComplaint,
  reassignWorkOrder,
  updateWorkOrderMilestone,
  verifyAndCloseWorkOrder,
  reopenWorkOrder,
  setWorkOrdersDb,
  resetWorkOrdersDb,
} from '../work-orders/work-orders.controller';
import {
  getPMUpcoming,
  getPMPlanById,
  updatePMPlan,
  reschedulePM,
  getMachinePMHistory,
  getPMDashboard,
  setPmDb,
} from '../pm/pm.controller';

/**
 * Mock Request & Response Helper
 */
interface MockResponse {
  statusCode: number;
  responseData: any;
  headers: Record<string, any>;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: any): MockResponse;
}

function createMockContext(
  body: any = {},
  params: any = {},
  query: any = {},
  user?: AuthenticatedUser
): { req: Request; res: Response & MockResponse; next: NextFunction } {
  const resObj: MockResponse = {
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
      this.headers[name] = value;
      return this;
    },
  };

  const reqObj: Partial<Request> = {
    body,
    params,
    query,
    headers: {},
    ip: '127.0.0.1',
    user,
  };

  const nextFn: NextFunction = (err?: any) => {
    if (err) {
      const code = err.statusCode || err.status || 500;
      resObj.status(code).json({
        success: false,
        message: err.message || 'Internal Server Error',
      });
    }
  };

  return {
    req: reqObj as Request,
    res: resObj as unknown as Response & MockResponse,
    next: nextFn,
  };
}

describe('Operator Read-Only Maintenance Status & Scoping Security Suite', () => {
  // Test UUIDs
  const plant1Id = '11111111-1111-1111-1111-111111111111';
  const shop1Id = '22222222-2222-2222-2222-222222222222';
  const plant2Id = '33333333-3333-3333-3333-333333333333';
  const shop2Id = '44444444-4444-4444-4444-444444444444';

  const machine1Id = 'aaaaaaaa-1111-1111-1111-111111111111'; // Operator 1 Permanent Machine
  const machine2Id = 'bbbbbbbb-2222-2222-2222-222222222222'; // Operator 2 Permanent Machine
  const machine3Id = 'cccccccc-3333-3333-3333-333333333333'; // Operator 1 Approved Temporary Machine
  const machine4Id = 'dddddddd-4444-4444-4444-444444444444'; // Plant 2 Machine

  const wo1Id = 'e0000000-0000-0000-0000-000000000001'; // Work order on machine 1
  const wo2Id = 'e0000000-0000-0000-0000-000000000002'; // Work order on machine 2

  const plan1Id = 'f0000000-0000-0000-0000-000000000001'; // PM plan on machine 1
  const plan2Id = 'f0000000-0000-0000-0000-000000000002'; // PM plan on machine 2

  const operator1: AuthenticatedUser = {
    id: '10000000-0000-0000-0000-000000000001',
    employee_code: 'EMP-OPR-01',
    email: 'operator1@jcb.local',
    role: 'operator',
    plant_id: plant1Id,
    shop_id: shop1Id,
  };

  const operator2: AuthenticatedUser = {
    id: '10000000-0000-0000-0000-000000000002',
    employee_code: 'EMP-OPR-02',
    email: 'operator2@jcb.local',
    role: 'operator',
    plant_id: plant1Id,
    shop_id: shop1Id,
  };

  const manager1: AuthenticatedUser = {
    id: '10000000-0000-0000-0000-000000000003',
    employee_code: 'EMP-MGR-01',
    email: 'manager1@jcb.local',
    role: 'manager',
    plant_id: plant1Id,
    shop_id: shop1Id,
  };

  const technician1: AuthenticatedUser = {
    id: '10000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-TCH-01',
    email: 'tech1@jcb.local',
    role: 'technician',
    plant_id: plant1Id,
    shop_id: shop1Id,
  };

  const admin1: AuthenticatedUser = {
    id: '10000000-0000-0000-0000-000000000005',
    employee_code: 'EMP-ADM-01',
    email: 'admin1@jcb.local',
    role: 'admin',
  };

  // Mock In-Memory Database Engine
  const mockDb = {
    users: new Map<string, any>([
      [
        operator1.id,
        {
          id: operator1.id,
          employee_code: operator1.employee_code,
          role: 'operator',
          plant_id: plant1Id,
          shop_id: shop1Id,
          permanent_machine_id: machine1Id,
        },
      ],
      [
        operator2.id,
        {
          id: operator2.id,
          employee_code: operator2.employee_code,
          role: 'operator',
          plant_id: plant1Id,
          shop_id: shop1Id,
          permanent_machine_id: machine2Id,
        },
      ],
      [
        manager1.id,
        {
          id: manager1.id,
          employee_code: manager1.employee_code,
          role: 'manager',
          plant_id: plant1Id,
          shop_id: shop1Id,
        },
      ],
      [
        technician1.id,
        {
          id: technician1.id,
          employee_code: technician1.employee_code,
          role: 'technician',
          plant_id: plant1Id,
          shop_id: shop1Id,
        },
      ],
      [
        admin1.id,
        {
          id: admin1.id,
          employee_code: admin1.employee_code,
          role: 'admin',
        },
      ],
    ]),
    assignments: [
      {
        id: 'assign-001',
        operator_id: operator1.id,
        machine_id: machine3Id,
        assignment_type: 'temporary',
        status: 'approved',
        created_at: new Date('2026-11-19T10:00:00Z'),
      },
    ],
    machines: new Map<string, any>([
      [
        machine1Id,
        {
          id: machine1Id,
          machine_code: 'MC-001-PERM',
          name: 'CNC Milling Center 1',
          category: 'Machining',
          status: 'under_maintenance',
          bay_line_location: 'Bay 1',
          operating_hours: 1200,
          shop_id: shop1Id,
          shop_name: 'CNC Shop 1',
          plant_id: plant1Id,
          plant_name: 'Pune Plant',
        },
      ],
      [
        machine2Id,
        {
          id: machine2Id,
          machine_code: 'MC-002-PERM',
          name: 'CNC Milling Center 2',
          category: 'Machining',
          status: 'running',
          bay_line_location: 'Bay 2',
          operating_hours: 1400,
          shop_id: shop1Id,
          shop_name: 'CNC Shop 1',
          plant_id: plant1Id,
          plant_name: 'Pune Plant',
        },
      ],
      [
        machine3Id,
        {
          id: machine3Id,
          machine_code: 'MC-003-TEMP',
          name: 'Temporary Buffer Machine 3',
          category: 'Machining',
          status: 'running',
          bay_line_location: 'Bay 3',
          operating_hours: 800,
          shop_id: shop1Id,
          shop_name: 'CNC Shop 1',
          plant_id: plant1Id,
          plant_name: 'Pune Plant',
        },
      ],
      [
        machine4Id,
        {
          id: machine4Id,
          machine_code: 'MC-004-PLANT2',
          name: 'Ballabgarh Machine 4',
          category: 'Fabrication',
          status: 'running',
          bay_line_location: 'Bay 4',
          operating_hours: 2000,
          shop_id: shop2Id,
          shop_name: 'Fabrication Shop',
          plant_id: plant2Id,
          plant_name: 'Ballabgarh Plant',
        },
      ],
    ]),
    workOrders: new Map<string, any>([
      [
        wo1Id,
        {
          id: wo1Id,
          wo_number: 'WO-2026-00001',
          machine_id: machine1Id,
          machine_code: 'MC-001-PERM',
          machine_name: 'CNC Milling Center 1',
          status: 'under_repair',
          classification: 'breakdown_repair',
          priority: 'high',
          assigned_technician_id: technician1.id,
          technician_name: 'Rajesh Technician',
          work_instructions: 'Replace faulty hydraulic pressure seal and calibrate axis.',
          sla_deadline: new Date('2026-11-20T12:00:00Z'),
          created_at: new Date('2026-11-19T08:00:00Z'),
          plant_id: plant1Id,
          shop_id: shop1Id,
        },
      ],
      [
        wo2Id,
        {
          id: wo2Id,
          wo_number: 'WO-2026-00002',
          machine_id: machine2Id,
          machine_code: 'MC-002-PERM',
          machine_name: 'CNC Milling Center 2',
          status: 'in_progress',
          classification: 'regular_maintenance',
          priority: 'medium',
          assigned_technician_id: technician1.id,
          technician_name: 'Rajesh Technician',
          work_instructions: 'Monthly 500-hour spindle lubrication and alignment.',
          sla_deadline: new Date('2026-11-21T12:00:00Z'),
          created_at: new Date('2026-11-19T09:00:00Z'),
          plant_id: plant1Id,
          shop_id: shop1Id,
        },
      ],
    ]),
    pmPlans: new Map<string, any>([
      [
        plan1Id,
        {
          id: plan1Id,
          plan_code: 'PM-2026-0001',
          machine_id: machine1Id,
          machine_code: 'MC-001-PERM',
          title: 'Quarterly Spindle Overhaul',
          frequency: 'quarterly',
          interval_days: 90,
          next_pm_date: new Date('2026-11-25'),
          grace_period_days: 3,
          is_active: true,
          plant_id: plant1Id,
          shop_id: shop1Id,
          checklist_template: JSON.stringify([{ task: 'Inspect bearing play', mandatory: true }]),
        },
      ],
      [
        plan2Id,
        {
          id: plan2Id,
          plan_code: 'PM-2026-0002',
          machine_id: machine2Id,
          machine_code: 'MC-002-PERM',
          title: 'Monthly Filter Cleaning',
          frequency: 'monthly',
          interval_days: 30,
          next_pm_date: new Date('2026-11-22'),
          grace_period_days: 2,
          is_active: true,
          plant_id: plant1Id,
          shop_id: shop1Id,
          checklist_template: JSON.stringify([{ task: 'Clean intake mesh', mandatory: true }]),
        },
      ],
    ]),
  };

  // Mock Database Query Handler
  const mockQuery = async (text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> => {
    const q = text.trim();

    // Query permanent_machine_id from users
    if (q.includes('SELECT permanent_machine_id FROM users WHERE id = $1')) {
      const u = mockDb.users.get(params[0]);
      return { rows: u ? [{ permanent_machine_id: u.permanent_machine_id }] : [], rowCount: u ? 1 : 0 };
    }

    // Query operator_machine_assignments
    if (q.includes('FROM operator_machine_assignments') && q.includes('WHERE operator_id = $1')) {
      const rows = mockDb.assignments.filter((a) => a.operator_id === params[0] && a.status === 'approved');
      return { rows, rowCount: rows.length };
    }

    // Query machine by ID
    if (q.includes('FROM machines m') && q.includes('WHERE m.id = $1')) {
      const m = mockDb.machines.get(params[0]);
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    // Query active breakdown for machine
    if (q.includes('FROM maintenance_requests r') && q.includes('WHERE r.machine_id = $1')) {
      if (params[0] === machine1Id) {
        return {
          rows: [
            {
              id: 'bd-001',
              complaint_number: 'CMP-2026-0001',
              problem_title: 'Hydraulic Pressure Failure',
              description: 'Pressure dropped below threshold during shift operation.',
              status: 'under_repair',
              priority: 'high',
              reported_at: new Date('2026-11-19T07:30:00Z'),
              assigned_technician_name: 'Rajesh Technician',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Query work_orders by machine
    if (q.includes('FROM work_orders wo') && q.includes('WHERE wo.machine_id = $1')) {
      const match = Array.from(mockDb.workOrders.values()).find((w) => w.machine_id === params[0]);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Query work order by ID
    if (q.includes('FROM work_orders wo') && q.includes('WHERE wo.id = $1')) {
      const wo = mockDb.workOrders.get(params[0]);
      return { rows: wo ? [wo] : [], rowCount: wo ? 1 : 0 };
    }

    // Query pm_plans by machine
    if (q.includes('FROM pm_plans p') && q.includes('WHERE p.machine_id = $1')) {
      const match = Array.from(mockDb.pmPlans.values()).find((p) => p.machine_id === params[0]);
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Query pm_plan by ID
    if (q.includes('FROM pm_plans p') && q.includes('WHERE p.id = $1')) {
      const p = mockDb.pmPlans.get(params[0]);
      return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
    }

    // General work orders list count
    if (q.includes('SELECT COUNT(wo.id)::int AS total FROM work_orders wo')) {
      let count = 0;
      if (params.includes(machine1Id)) count = 1;
      else if (params.includes(machine2Id)) count = 1;
      else count = mockDb.workOrders.size;
      return { rows: [{ total: count }], rowCount: 1 };
    }

    // General work orders select list
    if (q.includes('FROM work_orders wo') && !q.includes('WHERE wo.id = $1')) {
      if (params.includes(machine1Id)) {
        return { rows: [mockDb.workOrders.get(wo1Id)!], rowCount: 1 };
      }
      if (params.includes(machine2Id)) {
        return { rows: [mockDb.workOrders.get(wo2Id)!], rowCount: 1 };
      }
      return { rows: Array.from(mockDb.workOrders.values()), rowCount: mockDb.workOrders.size };
    }

    // Default empty rows
    return { rows: [], rowCount: 0 };
  };

  beforeEach(() => {
    setOperatorMaintenanceAccessDb(mockQuery);
    setWorkOrdersDb(mockQuery, {
      connect: async () => ({
        query: mockQuery,
        release: () => {},
      }),
    });
    setPmDb({
      query: mockQuery,
      connect: async () => ({
        query: mockQuery,
        release: () => {},
      }),
    });
  });

  // ===========================================================================
  // SECTION 1: OPERATOR CONSOLIDATED & MACHINE-LEVEL MAINTENANCE STATUS
  // ===========================================================================
  describe('1. Operator Maintenance Visibility for Assigned Machines', () => {
    it('1. Operator views consolidated maintenance status for both permanent and temporary machines', async () => {
      const ctx = createMockContext({}, {}, {}, operator1);
      await getOperatorMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);

      const data = ctx.res.responseData.data;
      assert.ok(data);

      // Permanent machine verification (machine 1)
      assert.equal(data.permanent_machine?.machine_id, machine1Id);
      assert.equal(data.permanent_machine?.machine_code, 'MC-001-PERM');
      assert.equal(data.permanent_machine?.maintenance_condition, 'under_breakdown');
      assert.ok(data.permanent_machine?.active_breakdown);
      assert.equal(data.permanent_machine?.active_breakdown.complaint_number, 'CMP-2026-0001');
      assert.equal(data.permanent_machine?.active_work_order?.id, wo1Id);
      assert.equal(data.permanent_machine?.active_work_order?.maintenance_type, 'Corrective');
      assert.equal(data.permanent_machine?.active_work_order?.technician_name, 'Rajesh Technician');
      assert.equal(data.permanent_machine?.active_work_order?.work_progress?.stage, 'Under Repair');
      assert.equal(data.permanent_machine?.active_work_order?.work_progress?.progress_percentage, 60);

      // Temporary replacement machine verification (machine 3)
      assert.equal(data.has_active_temporary_assignment, true);
      assert.equal(data.temporary_machine?.machine_id, machine3Id);
      assert.equal(data.temporary_machine?.machine_code, 'MC-003-TEMP');
      assert.equal(data.temporary_machine?.maintenance_condition, 'running');
    });

    it('2. Operator views detailed maintenance status of permanent machine via :id', async () => {
      const ctx = createMockContext({}, { id: machine1Id }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.machine_id, machine1Id);
      assert.equal(ctx.res.responseData.data.maintenance_condition, 'under_breakdown');
      assert.equal(ctx.res.responseData.data.active_work_order?.wo_number, 'WO-2026-00001');
    });

    it('3. Operator views detailed maintenance status of approved temporary machine via :id', async () => {
      const ctx = createMockContext({}, { id: machine3Id }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.machine_id, machine3Id);
      assert.equal(ctx.res.responseData.data.machine_code, 'MC-003-TEMP');
      assert.equal(ctx.res.responseData.data.maintenance_condition, 'running');
    });
  });

  // ===========================================================================
  // SECTION 2: URL PARAMETER TAMPERING & MACHINE-LEVEL OWNERSHIP ENFORCEMENT
  // ===========================================================================
  describe('2. Machine-Level Access Control & URL Tampering Prevention', () => {
    it('4. Operator CANNOT view maintenance status of another operator machine (HTTP 403 Forbidden)', async () => {
      // Operator 1 tries to access Operator 2's permanent machine (machine2Id)
      const ctx = createMockContext({}, { id: machine2Id }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
      assert.ok(ctx.res.responseData.message.includes('assigned machine'));
    });

    it('5. Operator CANNOT view maintenance status of a machine in another plant (HTTP 403 Forbidden)', async () => {
      // Operator 1 tries to access Plant 2 machine (machine4Id)
      const ctx = createMockContext({}, { id: machine4Id }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
    });

    it('6. URL tampering with arbitrary UUID is strictly rejected with HTTP 403 Forbidden', async () => {
      const arbitraryId = '99999999-9999-9999-9999-999999999999';
      const ctx = createMockContext({}, { id: arbitraryId }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('7. Malformed machine ID returns HTTP 400 Bad Request', async () => {
      const ctx = createMockContext({}, { id: 'invalid-non-uuid' }, {}, operator1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('valid UUID'));
    });
  });

  // ===========================================================================
  // SECTION 3: WORK-ORDER READ-ONLY VISIBILITY & SECURITY SCOPING
  // ===========================================================================
  describe('3. Work Order Visibility Scoped to Assigned Machines', () => {
    it('8. Operator can view work orders filtered by their assigned machine ID', async () => {
      const ctx = createMockContext({}, {}, { machine_id: machine1Id }, operator1);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data[0].id, wo1Id);
    });

    it('9. Operator CANNOT query work orders for another operator machine ID (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext({}, {}, { machine_id: machine2Id }, operator1);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
    });

    it('10. Operator attempting general work order listing without machine_id is blocked with HTTP 403', async () => {
      const ctx = createMockContext({}, {}, {}, operator1);
      await getWorkOrders(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('not authorized'));
    });

    it('11. Operator can view work order details for their assigned machine', async () => {
      const ctx = createMockContext({}, { id: wo1Id }, {}, operator1);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.id, wo1Id);
      assert.equal(ctx.res.responseData.data.technician_name, 'Rajesh Technician');
    });

    it('12. Operator CANNOT view work order details for another operator machine (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext({}, { id: wo2Id }, {}, operator1);
      await getWorkOrderDetails(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
    });

    it('13. Operator CANNOT access spare parts costs and inventory details (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext({}, { id: wo1Id }, {}, operator1);
      await getWorkOrderParts(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
    });
  });

  // ===========================================================================
  // SECTION 4: STRICT PROHIBITION OF OPERATOR MAINTENANCE MUTATIONS
  // ===========================================================================
  describe('4. Strict Prohibition of Maintenance Mutations for Operators', () => {
    it('14. Operator CANNOT create maintenance work orders (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        {
          complaint_id: '50000000-0000-0000-0000-000000000001',
          technician_id: technician1.id,
        },
        {},
        {},
        operator1
      );
      await createWorkOrderFromComplaint(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('15. Operator CANNOT reassign technicians (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { new_technician_id: '10000000-0000-0000-0000-000000000009', notes: 'Reassign' },
        { id: wo1Id },
        {},
        operator1
      );
      await reassignWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('16. Operator CANNOT update maintenance milestones or status (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { action: 'COMPLETE_REPAIR' },
        { id: wo1Id },
        {},
        operator1
      );
      await updateWorkOrderMilestone(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('17. Operator CANNOT verify or close maintenance work orders (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { status: 'APPROVED', remarks: 'Verification' },
        { id: wo1Id },
        {},
        operator1
      );
      await verifyAndCloseWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('18. Operator CANNOT reopen completed maintenance work orders (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { reason: 'Reopen requested' },
        { id: wo1Id },
        {},
        operator1
      );
      await reopenWorkOrder(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('19. Operator CANNOT update PM plan configuration (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { title: 'Modified Plan Title' },
        { id: plan1Id },
        {},
        operator1
      );
      await updatePMPlan(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });

    it('20. Operator CANNOT reschedule PM maintenance dates (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        { next_pm_date: '2026-12-01', reason: 'Operator reschedule attempt' },
        { id: plan1Id },
        {},
        operator1
      );
      await reschedulePM(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });
  });

  // ===========================================================================
  // SECTION 5: PREVENTIVE MAINTENANCE READ VISIBILITY & SECURITY
  // ===========================================================================
  describe('5. Preventive Maintenance Visibility & Role Restrictions', () => {
    it('21. Operator can view PM plan details for their assigned machine', async () => {
      const ctx = createMockContext({}, { id: plan1Id }, {}, operator1);
      await getPMPlanById(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.id, plan1Id);
      assert.equal(ctx.res.responseData.data.title, 'Quarterly Spindle Overhaul');
    });

    it('22. Operator CANNOT view PM plan details for another operator machine (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext({}, { id: plan2Id }, {}, operator1);
      await getPMPlanById(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
      assert.ok(ctx.res.responseData.message.includes('Forbidden'));
    });

    it('23. Operator CANNOT access plant-level PM dashboard analytics (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext({}, {}, {}, operator1);
      await getPMDashboard(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.equal(ctx.res.responseData.success, false);
    });
  });

  // ===========================================================================
  // SECTION 6: PRESERVATION OF MANAGER & ADMIN PERMISSIONS
  // ===========================================================================
  describe('6. Manager, Technician & Admin Permissions Unbroken', () => {
    it('24. Manager can view maintenance status of machines in their plant', async () => {
      const ctx = createMockContext({}, { id: machine1Id }, {}, manager1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.machine_id, machine1Id);
    });

    it('25. Technician can view maintenance status of machines in their shop', async () => {
      const ctx = createMockContext({}, { id: machine2Id }, {}, technician1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.machine_id, machine2Id);
    });

    it('26. Enterprise Admin can view maintenance status globally across all plants', async () => {
      const ctx = createMockContext({}, { id: machine4Id }, {}, admin1);
      await getMachineMaintenanceStatus(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.machine_id, machine4Id);
    });
  });
});
