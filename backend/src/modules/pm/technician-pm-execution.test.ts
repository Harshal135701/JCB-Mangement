import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import {
  getPMPlanEligibleMachines,
  startPMExecution,
  executePMPlan,
  getPMPlans,
  getPMExecutionChecklist,
  setPmDb,
  resetPmDb,
} from './pm.controller';
import { DbPoolLike } from './pm.service';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

// ---------------------------------------------------------------------------
// Mock Response Context Factory
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// In-Memory Test State
// ---------------------------------------------------------------------------
const PLANT_1_ID = '11111111-1111-1111-1111-111111111111';
const PLANT_2_ID = '22222222-2222-2222-2222-222222222222';
const SHOP_1_ID = '33333333-3333-3333-3333-333333333333';
const SHOP_2_ID = '44444444-4444-4444-4444-444444444444';

const MACHINE_1_ID = '55555555-5555-5555-5555-555555555551';
const MACHINE_2_ID = '55555555-5555-5555-5555-555555555552';
const MACHINE_OTHER_ID = '55555555-5555-5555-5555-555555555599'; // belongs to another plan

const PLAN_1_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PLAN_INACTIVE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const TECH_USER: AuthenticatedUser = {
  id: '99999999-9999-9999-9999-999999999991',
  employee_code: 'TECH-001',
  email: 'technician@jcb.com',
  role: 'technician',
  plant_id: PLANT_1_ID,
  shop_id: SHOP_1_ID,
};

const TECH_PLANT2_USER: AuthenticatedUser = {
  id: '99999999-9999-9999-9999-999999999992',
  employee_code: 'TECH-002',
  email: 'tech.p2@jcb.com',
  role: 'technician',
  plant_id: PLANT_2_ID,
  shop_id: SHOP_2_ID,
};

const OPERATOR_USER: AuthenticatedUser = {
  id: '99999999-9999-9999-9999-999999999993',
  employee_code: 'OP-001',
  email: 'operator@jcb.com',
  role: 'operator',
  plant_id: PLANT_1_ID,
  shop_id: SHOP_1_ID,
};

class MockDatabase {
  public plans: any[] = [];
  public planMachines: { plan_id: string; machine_id: string }[] = [];
  public machines: any[] = [];
  public shops: any[] = [];
  public plants: any[] = [];
  public workOrders: any[] = [];
  public events: any[] = [];
  public partsConsumed: any[] = [];
  public auditLogs: any[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.plants = [
      { id: PLANT_1_ID, plant_name: 'Pune Heavy Plant', plant_code: 'PUN-01' },
      { id: PLANT_2_ID, plant_name: 'Jaipur Plant', plant_code: 'JAI-01' },
    ];
    this.shops = [
      { id: SHOP_1_ID, plant_id: PLANT_1_ID, shop_name: 'Fabrication Shop' },
      { id: SHOP_2_ID, plant_id: PLANT_2_ID, shop_name: 'Assembly Shop' },
    ];
    this.machines = [
      {
        id: MACHINE_1_ID,
        machine_code: 'JCB-FAB-01',
        name: '3DX Backhoe Loader 1',
        category: 'Loader',
        status: 'operational',
        bay_line_location: 'Bay A-1',
        operating_hours: 260,
        criticality: 'class_a',
        shop_id: SHOP_1_ID,
      },
      {
        id: MACHINE_2_ID,
        machine_code: 'JCB-FAB-02',
        name: '3DX Backhoe Loader 2',
        category: 'Loader',
        status: 'operational',
        bay_line_location: 'Bay A-2',
        operating_hours: 245,
        criticality: 'class_b',
        shop_id: SHOP_1_ID,
      },
      {
        id: MACHINE_OTHER_ID,
        machine_code: 'JCB-ASM-99',
        name: 'Robotic Welder 99',
        category: 'Welder',
        status: 'operational',
        bay_line_location: 'Line B-3',
        operating_hours: 1500,
        criticality: 'class_a',
        shop_id: SHOP_1_ID,
      },
    ];

    this.plans = [
      {
        id: PLAN_1_ID,
        plan_code: 'PM-2026-0001',
        machine_id: MACHINE_1_ID,
        title: '3DX Periodic 250-Hour Powertrain & Hydraulic Service',
        frequency: 'monthly',
        interval_days: 30,
        grace_period_days: 3,
        operating_hour_threshold: 250,
        checklist_template: JSON.stringify([
          { id: 'chk_1', task: 'Inspect engine oil level and condition', type: 'boolean', required: true },
          { id: 'chk_2', task: 'Check hydraulic lines for leaks', type: 'boolean', required: true },
          { id: 'chk_3', task: 'Verify tyre pressure and rim torque', type: 'boolean', required: true },
        ]),
        is_active: true,
        next_pm_date: new Date(Date.now() - 86400000).toISOString(),
        last_pm_date: null,
      },
      {
        id: PLAN_INACTIVE_ID,
        plan_code: 'PM-2026-0099',
        machine_id: MACHINE_1_ID,
        title: 'Draft Inactive PM Plan',
        frequency: 'quarterly',
        interval_days: 90,
        grace_period_days: 5,
        operating_hour_threshold: 500,
        checklist_template: JSON.stringify([]),
        is_active: false,
        next_pm_date: new Date().toISOString(),
        last_pm_date: null,
      },
    ];

    // MACHINE_1 and MACHINE_2 are eligible for PLAN_1. MACHINE_OTHER is NOT.
    this.planMachines = [
      { plan_id: PLAN_1_ID, machine_id: MACHINE_1_ID },
      { plan_id: PLAN_1_ID, machine_id: MACHINE_2_ID },
    ];

    this.workOrders = [];
    this.events = [];
    this.partsConsumed = [];
    this.auditLogs = [];
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const norm = text.replace(/\s+/g, ' ').trim();

    // Lock simulation
    if (norm.includes('pg_advisory_xact_lock')) {
      return { rows: [{ locked: true }], rowCount: 1 };
    }

    // Sequence generator
    if (norm.includes('COALESCE(MAX(SUBSTRING(wo_number FROM')) {
      const nextNum = this.workOrders.length + 1;
      return { rows: [{ next_seq: nextNum }], rowCount: 1 };
    }

    // Plan lookup by ID
    if (norm.includes('FROM pm_plans p') && norm.includes('WHERE p.id = $1')) {
      const plan = this.plans.find((p) => p.id === params[0]);
      if (!plan) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === plan.machine_id) || this.machines[0];
      const s = this.shops.find((x) => x.id === m.shop_id) || this.shops[0];
      const pl = this.plants.find((x) => x.id === s.plant_id) || this.plants[0];
      return {
        rows: [
          {
            ...plan,
            machine_code: m.machine_code,
            machine_name: m.name,
            machine_status: m.status,
            current_machine_hours: m.operating_hours,
            criticality: m.criticality,
            shop_id: s.id,
            shop_name: s.shop_name,
            plant_id: pl.id,
            plant_name: pl.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // Strict eligibility query
    if (norm.includes('pm_plan_machines') && norm.includes('matched') && params[0] && params[1]) {
      const planId = params[0];
      const machineId = params[1];
      const isEligible =
        this.planMachines.some((pm) => pm.plan_id === planId && pm.machine_id === machineId) ||
        this.plans.some((p) => p.id === planId && p.machine_id === machineId);
      return { rows: isEligible ? [{ matched: 1 }] : [], rowCount: isEligible ? 1 : 0 };
    }

    // Eligible machines query for plan
    if (norm.includes('FROM machines m') && norm.includes('pm_plan_machines WHERE plan_id = $1')) {
      const planId = params[0];
      const plan = this.plans.find((p) => p.id === planId);
      const eligibleMachineIds = new Set(
        this.planMachines.filter((pm) => pm.plan_id === planId).map((pm) => pm.machine_id)
      );
      if (plan) eligibleMachineIds.add(plan.machine_id);

      let filtered = this.machines.filter((m) => eligibleMachineIds.has(m.id) && m.status !== 'decommissioned');

      // Plant scoping
      if (params.includes(PLANT_1_ID)) {
        filtered = filtered.filter((m) => {
          const s = this.shops.find((x) => x.id === m.shop_id);
          return s && s.plant_id === PLANT_1_ID;
        });
      } else if (params.includes(PLANT_2_ID)) {
        filtered = filtered.filter((m) => {
          const s = this.shops.find((x) => x.id === m.shop_id);
          return s && s.plant_id === PLANT_2_ID;
        });
      }

      const rows = filtered.map((m) => {
        const s = this.shops.find((x) => x.id === m.shop_id) || this.shops[0];
        const pl = this.plants.find((x) => x.id === s.plant_id) || this.plants[0];
        const openWo = this.workOrders.find(
          (wo) =>
            wo.machine_id === m.id &&
            (wo.pm_plan_id === planId || wo.work_instructions?.includes(plan?.plan_code || '')) &&
            !['verified_closed', 'completed'].includes(wo.status)
        );
        return {
          id: m.id,
          machine_code: m.machine_code,
          name: m.name,
          category: m.category,
          machine_status: m.status,
          bay_line_location: m.bay_line_location,
          operating_hours: m.operating_hours,
          criticality: m.criticality,
          shop_id: s.id,
          shop_name: s.shop_name,
          plant_id: pl.id,
          plant_name: pl.plant_name,
          active_execution_id: openWo?.id || null,
          active_execution_wo_number: openWo?.wo_number || null,
          active_execution_status: openWo?.status || null,
          active_assigned_technician_id: openWo?.assigned_technician_id || null,
        };
      });

      return { rows, rowCount: rows.length };
    }

    // Machine lookup
    if (norm.includes('FROM machines m') && norm.includes('WHERE m.id = $1')) {
      const m = this.machines.find((x) => x.id === params[0]);
      if (!m) return { rows: [], rowCount: 0 };
      const s = this.shops.find((x) => x.id === m.shop_id) || this.shops[0];
      const pl = this.plants.find((x) => x.id === s.plant_id) || this.plants[0];
      return {
        rows: [
          {
            ...m,
            plant_id: pl.id,
            shop_name: s.shop_name,
            plant_name: pl.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // Check open work order for machine
    if (norm.includes('FROM work_orders') && norm.includes('status NOT IN (\'verified_closed\', \'completed\')')) {
      const machineId = params[0];
      const planId = params[1];
      const planCode = params[2];
      const openWo = this.workOrders.find(
        (wo) =>
          wo.machine_id === machineId &&
          !['verified_closed', 'completed'].includes(wo.status) &&
          (wo.pm_plan_id === planId || (planCode && wo.work_instructions?.includes(planCode)))
      );
      return { rows: openWo ? [openWo] : [], rowCount: openWo ? 1 : 0 };
    }

    // Insert work order
    if (norm.includes('INSERT INTO work_orders')) {
      const wo = {
        id: `wo-${this.workOrders.length + 1}-${Date.now()}`,
        wo_number: params[0],
        machine_id: params[1],
        assigned_technician_id: params[2],
        assigned_manager_id: params[3],
        priority: params[4],
        status: norm.includes('in_progress') ? 'in_progress' : 'submitted_verification',
        classification: 'regular_maintenance',
        work_instructions: params[5],
        diagnosis: params[6],
        corrective_action: params[7],
        technician_remarks: params[8],
        pm_plan_id: params[9] || params[5],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.workOrders.push(wo);
      return { rows: [wo], rowCount: 1 };
    }

    // Update work order
    if (norm.includes('UPDATE work_orders')) {
      const woId = params[params.length - 1];
      const wo = this.workOrders.find((w) => w.id === woId);
      if (wo) {
        if (norm.includes('submitted_verification')) {
          wo.status = 'submitted_verification';
          wo.diagnosis = params[2];
          wo.corrective_action = params[3];
          wo.technician_remarks = params[4];
        } else if (norm.includes('in_progress')) {
          wo.status = 'in_progress';
          wo.assigned_technician_id = params[0];
        }
        wo.updated_at = new Date().toISOString();
        return { rows: [wo], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Advance PM plan schedule
    if (norm.includes('UPDATE pm_plans') && norm.includes('SET last_pm_date = CURRENT_DATE')) {
      const planId = params[1];
      const plan = this.plans.find((p) => p.id === planId);
      if (plan) {
        plan.last_pm_date = new Date().toISOString().split('T')[0];
        const next = new Date(Date.now() + (parseInt(params[0], 10) || 30) * 86400000);
        plan.next_pm_date = next.toISOString().split('T')[0];
        return { rows: [plan], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Events, audit logs, parts
    if (norm.includes('INSERT INTO work_order_events')) {
      this.events.push({ id: `evt-${Date.now()}`, params, text: norm });
      return { rows: [{ id: 'evt-1' }], rowCount: 1 };
    }
    if (norm.includes('INSERT INTO wo_parts_consumed')) {
      this.partsConsumed.push({ id: `part-${Date.now()}`, params });
      return { rows: [{ id: 'part-1' }], rowCount: 1 };
    }
    if (norm.includes('INSERT INTO audit_logs')) {
      this.auditLogs.push({ id: `audit-${Date.now()}`, params });
      return { rows: [{ id: 'audit-1' }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

describe('Technician Plan-Based PM Execution Backend Suite', () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    setPmDb(mockDb as unknown as DbPoolLike);
  });

  // -------------------------------------------------------------------------
  // 1. View Eligible Machines for Deployed PM Plan
  // -------------------------------------------------------------------------
  describe('1. GET /api/v1/pm/plans/:id/eligible-machines', () => {
    it('returns only machines explicitly associated with the deployed PM plan', async () => {
      const { req, res, next } = createMockContext({}, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await getPMPlanEligibleMachines(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      const data = res.responseData.data;
      assert.equal(data.plan.plan_code, 'PM-2026-0001');
      assert.equal(data.total_eligible, 2);

      const machineCodes = data.eligible_machines.map((m: any) => m.machine_code);
      assert.ok(machineCodes.includes('JCB-FAB-01'));
      assert.ok(machineCodes.includes('JCB-FAB-02'));
      // MACHINE_OTHER is NOT associated with PLAN_1
      assert.ok(!machineCodes.includes('JCB-ASM-99'));
    });

    it('rejects with HTTP 400 if plan is inactive / draft', async () => {
      const { req, res, next } = createMockContext({}, { id: PLAN_INACTIVE_ID }, {}, {}, TECH_USER);
      await getPMPlanEligibleMachines(req, res, next);

      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /inactive or draft/i);
    });

    it('filters out machines outside technician plant scope', async () => {
      const { req, res, next } = createMockContext({}, { id: PLAN_1_ID }, {}, {}, TECH_PLANT2_USER);
      await getPMPlanEligibleMachines(req, res, next);

      assert.equal(res.statusCode, 200);
      // Technician in Plant 2 has no machines in Plant 1
      assert.equal(res.responseData.data.total_eligible, 0);
    });

    it('rejects with HTTP 400 for malformed plan UUID', async () => {
      const { req, res, next } = createMockContext({}, { id: 'invalid-uuid' }, {}, {}, TECH_USER);
      await getPMPlanEligibleMachines(req, res, next);

      assert.equal(res.statusCode, 400);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Strict Machine Eligibility Enforcement during Execution
  // -------------------------------------------------------------------------
  describe('2. POST /api/v1/pm/plans/:id/execute — Machine Eligibility Enforcement', () => {
    it('CRITICAL: strictly rejects execution if machine is not associated with this PM plan (HTTP 403)', async () => {
      const payload = {
        machine_id: MACHINE_OTHER_ID, // belongs to another plan
        checklist_responses: [
          { item: 'Oil level', status: 'pass' },
        ],
        work_performed: 'Serviced oil filter and flushed lines.',
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.match(res.responseData.message, /not eligible for this PM plan/i);
      assert.match(res.responseData.message, /Only machines explicitly associated/i);
    });

    it('successfully executes PM plan when machine is explicitly associated with the plan', async () => {
      const payload = {
        machine_id: MACHINE_1_ID,
        checklist_responses: [
          { task: 'Inspect engine oil level and condition', status: 'pass', notes: 'Oil clean and topped up' },
          { task: 'Check hydraulic lines for leaks', status: 'pass', notes: 'No leaks observed' },
          { task: 'Verify tyre pressure and rim torque', status: 'pass', notes: 'Pressures adjusted to 35 PSI' },
        ],
        overall_status: 'pass',
        work_performed: 'Completed 250-hour powertrain lubrication and inspection.',
        technician_remarks: 'Machine in optimal operating state.',
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'submitted_verification');
      assert.equal(res.responseData.data.machine_code, 'JCB-FAB-01');
      assert.ok(res.responseData.data.wo_number.startsWith('WO-'));

      // Verify plan schedule was advanced
      const plan = mockDb.plans.find((p) => p.id === PLAN_1_ID);
      assert.ok(plan.last_pm_date);
      assert.ok(plan.next_pm_date);

      // Verify work order was recorded
      assert.equal(mockDb.workOrders.length, 1);
      const wo = mockDb.workOrders[0];
      assert.equal(wo.status, 'submitted_verification');
      assert.equal(wo.assigned_technician_id, TECH_USER.id);
      assert.equal(wo.corrective_action, payload.work_performed);

      // Verify diagnosis contains checklist data
      const diagnosis = JSON.parse(wo.diagnosis);
      assert.equal(diagnosis.overall_status, 'pass');
      assert.equal(diagnosis.responses.length, 3);
    });

    it('rejects execution when work_performed description is missing (HTTP 400)', async () => {
      const payload = {
        machine_id: MACHINE_1_ID,
        checklist_responses: [],
        work_performed: '   ', // empty
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /work performed/i);
    });

    it('rejects execution on inactive / draft plan (HTTP 400)', async () => {
      const payload = {
        machine_id: MACHINE_1_ID,
        checklist_responses: [],
        work_performed: 'Attempting execution on draft',
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_INACTIVE_ID }, {}, {}, TECH_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /inactive or draft/i);
    });

    it('rejects duplicate execution if one is already pending manager verification (HTTP 409)', async () => {
      // First execution
      mockDb.workOrders.push({
        id: 'wo-existing-1',
        wo_number: 'WO-2026-00001',
        machine_id: MACHINE_1_ID,
        pm_plan_id: PLAN_1_ID,
        assigned_technician_id: TECH_USER.id,
        status: 'submitted_verification',
        classification: 'regular_maintenance',
        work_instructions: '[PM Plan: PM-2026-0001]',
      });

      const payload = {
        machine_id: MACHINE_1_ID,
        checklist_responses: [],
        work_performed: 'Duplicate execution attempt',
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 409);
      assert.match(res.responseData.message, /already submitted/i);
    });

    it('prevents cross-plant technician from executing on machines in another plant (HTTP 403)', async () => {
      const payload = {
        machine_id: MACHINE_1_ID, // located in Plant 1
        checklist_responses: [],
        work_performed: 'Cross-plant attempt',
      };

      // Technician belongs to Plant 2
      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, TECH_PLANT2_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.match(res.responseData.message, /scope|plant/i);
    });

    it('operator cannot execute PM plans (HTTP 403 Forbidden)', async () => {
      const payload = {
        machine_id: MACHINE_1_ID,
        checklist_responses: [],
        work_performed: 'Operator execution attempt',
      };

      const { req, res, next } = createMockContext(payload, { id: PLAN_1_ID }, {}, {}, OPERATOR_USER);
      await executePMPlan(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.match(res.responseData.message, /Role 'operator' cannot execute/i);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Start On-Site PM Execution
  // -------------------------------------------------------------------------
  describe('3. POST /api/v1/pm/plans/:id/start — On-Site Commencement', () => {
    it('starts on-site PM execution, setting status to in_progress', async () => {
      const { req, res, next } = createMockContext({ machine_id: MACHINE_2_ID }, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await startPMExecution(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'in_progress');
      assert.equal(res.responseData.data.machine.machine_code, 'JCB-FAB-02');
      assert.ok(mockDb.events.some((e) => e.text?.includes('PM_EXECUTION_STARTED') || e.params?.includes('PM_EXECUTION_STARTED')));
    });

    it('rejects start execution for ineligible machine (HTTP 403)', async () => {
      const { req, res, next } = createMockContext({ machine_id: MACHINE_OTHER_ID }, { id: PLAN_1_ID }, {}, {}, TECH_USER);
      await startPMExecution(req, res, next);

      assert.equal(res.statusCode, 403);
      assert.match(res.responseData.message, /not eligible/i);
    });
  });
});
