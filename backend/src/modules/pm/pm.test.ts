import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import {
  createPMPlan,
  getPMPlans,
  getPMPlanById,
  updatePMPlan,
  activatePMPlan,
  deactivatePMPlan,
  getPMPlanHistory,
  getPMPlanWorkOrders,
  getPMSchedule,
  getPMUpcoming,
  getPMDue,
  getPMOverdue,
  getPMCalendar,
  reschedulePM,
  deferPM,
  skipPM,
  generateDuePMWorkOrders,
  getPMExecutions,
  getPMExecutionDetails,
  getPMExecutionChecklist,
  submitPMExecutionChecklist,
  completePMExecution,
  verifyPMExecution,
  getMachinePMHistory,
  getPMDashboard,
  getPMCompliance,
  getPMTrends,
  getPMByMachine,
  getPMByPlant,
  getPMByShop,
  setPmDb,
  resetPmDb,
  setPmIo,
  resetPmIo,
} from './pm.controller';
import { DbClientLike, DbPoolLike } from './pm.service';
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
// Mock Socket.IO Gateway
// ---------------------------------------------------------------------------
class MockSocketIO {
  public emissions: { room?: string; event: string; data: any }[] = [];

  to(room: string) {
    const self = this;
    return {
      emit(event: string, data: any) {
        self.emissions.push({ room, event, data });
      },
    };
  }

  emit(event: string, data: any) {
    this.emissions.push({ event, data });
  }
}

// ---------------------------------------------------------------------------
// Mock Database State & Entities
// ---------------------------------------------------------------------------
interface MockPlant {
  id: string;
  plant_name: string;
  plant_code: string;
}

interface MockShop {
  id: string;
  plant_id: string;
  shop_name: string;
}

interface MockUser {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: string;
  plant_id?: string;
  shop_id?: string;
  is_active: boolean;
}

interface MockMachine {
  id: string;
  shop_id: string;
  machine_code: string;
  name: string;
  category: string;
  criticality: string;
  status: string;
  operating_hours: number;
  bay_line_location: string;
}

interface MockPMPlan {
  id: string;
  plan_code: string;
  machine_id: string;
  title: string;
  frequency: string;
  interval_days: number;
  operating_hour_threshold: number | null;
  checklist_template: any;
  last_pm_date: string | null;
  next_pm_date: string;
  grace_period_days: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MockWorkOrder {
  id: string;
  wo_number: string;
  complaint_id: string | null;
  machine_id: string;
  assigned_technician_id: string | null;
  assigned_manager_id: string | null;
  priority: string;
  status: string;
  classification: string;
  is_major_breakdown: boolean;
  sla_deadline: Date | null;
  work_instructions: string;
  diagnosis: any;
  corrective_action: string | null;
  root_cause_analysis: string | null;
  completed_at: Date | null;
  repair_completed_time: Date | null;
  manager_verified_time: Date | null;
  machine_restored_time: Date | null;
  total_downtime_minutes: number;
  active_repair_minutes: number;
  created_at: Date;
  updated_at: Date;
}

interface MockEvent {
  id: string;
  work_order_id: string;
  event_type: string;
  performed_by: string;
  notes: string;
  timestamp: Date;
}

interface MockAuditLog {
  id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  performed_by: string;
  old_values: any;
  new_values: any;
  timestamp: Date;
}

interface MockNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Mock PM Database Implementation
// ---------------------------------------------------------------------------
class MockPMDatabase implements DbPoolLike {
  public plants: MockPlant[] = [];
  public shops: MockShop[] = [];
  public users: MockUser[] = [];
  public machines: MockMachine[] = [];
  public plans: MockPMPlan[] = [];
  public workOrders: MockWorkOrder[] = [];
  public events: MockEvent[] = [];
  public auditLogs: MockAuditLog[] = [];
  public notifications: MockNotification[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    this.plants = [
      { id: '10000000-0000-0000-0000-000000000001', plant_name: 'JCB Pune Plant 1', plant_code: 'PUNE-01' },
      { id: '10000000-0000-0000-0000-000000000002', plant_name: 'JCB Ballabgarh Plant 2', plant_code: 'BLB-02' },
    ];

    this.shops = [
      { id: '20000000-0000-0000-0000-000000000001', plant_id: '10000000-0000-0000-0000-000000000001', shop_name: 'CNC Machining Shop' },
      { id: '20000000-0000-0000-0000-000000000002', plant_id: '10000000-0000-0000-0000-000000000001', shop_name: 'Fabrication Shop' },
      { id: '20000000-0000-0000-0000-000000000003', plant_id: '10000000-0000-0000-0000-000000000002', shop_name: 'Robotic Welding Shop' },
    ];

    this.users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-01',
        full_name: 'System Administrator',
        email: 'admin@jcb.com',
        role: 'admin',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-01',
        full_name: 'Pune Plant Manager',
        email: 'manager.pune@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        employee_code: 'EMP-MGR-02',
        full_name: 'Ballabgarh Plant Manager',
        email: 'manager.blb@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000003',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        employee_code: 'EMP-TEC-01',
        full_name: 'Senior Hydraulic Tech',
        email: 'tech1@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        employee_code: 'EMP-OPR-01',
        full_name: 'CNC Machine Operator',
        email: 'operator1@jcb.com',
        role: 'operator',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
    ];

    this.machines = [
      {
        id: '40000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        machine_code: 'CNC-001',
        name: 'Mazak 5-Axis HMC 1',
        category: 'CNC Machine',
        criticality: 'class_a',
        status: 'running',
        operating_hours: 1420.5,
        bay_line_location: 'Bay 1, Line A',
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000001',
        machine_code: 'CNC-002',
        name: 'Doosan Horizontal Lathe',
        category: 'CNC Machine',
        criticality: 'class_b',
        status: 'running',
        operating_hours: 2500.0,
        bay_line_location: 'Bay 1, Line B',
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        shop_id: '20000000-0000-0000-0000-000000000003', // Plant 2
        machine_code: 'ROB-001',
        name: 'Fanuc Arc Welding Cell',
        category: 'Robot',
        criticality: 'class_a',
        status: 'running',
        operating_hours: 800.0,
        bay_line_location: 'Bay 4, Line C',
      },
    ];

    const today = new Date().toISOString().split('T')[0];
    const upcomingDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const overdueDate = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0];

    this.plans = [
      {
        id: '30000000-0000-0000-0000-000000000001',
        plan_code: 'PM-2026-00001',
        machine_id: '40000000-0000-0000-0000-000000000001',
        title: 'Monthly Hydraulic & Spindle Inspection',
        frequency: 'monthly',
        interval_days: 30,
        operating_hour_threshold: null,
        checklist_template: [
          { item_id: 'chk-1', description: 'Check hydraulic oil pressure and filter condition', mandatory: true },
          { item_id: 'chk-2', description: 'Inspect spindle chiller temperature and flow rate', mandatory: true },
        ],
        last_pm_date: new Date(Date.now() - 27 * 86400000).toISOString().split('T')[0],
        next_pm_date: upcomingDate,
        grace_period_days: 3,
        is_active: true,
        created_at: new Date(Date.now() - 60 * 86400000),
        updated_at: new Date(Date.now() - 27 * 86400000),
      },
      {
        id: '30000000-0000-0000-0000-000000000002',
        plan_code: 'PM-2026-00002',
        machine_id: '40000000-0000-0000-0000-000000000001',
        title: 'Weekly Lubrication & Coolant Check',
        frequency: 'weekly',
        interval_days: 7,
        operating_hour_threshold: null,
        checklist_template: [
          { item_id: 'chk-10', description: 'Top up guideway lube reservoir', mandatory: true },
          { item_id: 'chk-11', description: 'Measure coolant concentration with refractometer', mandatory: true },
        ],
        last_pm_date: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        next_pm_date: today,
        grace_period_days: 1,
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000),
        updated_at: new Date(Date.now() - 7 * 86400000),
      },
      {
        id: '30000000-0000-0000-0000-000000000003',
        plan_code: 'PM-2026-00003',
        machine_id: '40000000-0000-0000-0000-000000000002',
        title: '500-Hour Hydraulic Servicing',
        frequency: 'monthly',
        interval_days: 30,
        operating_hour_threshold: 2000,
        checklist_template: [
          { item_id: 'chk-20', description: 'Replace hydraulic suction strainer', mandatory: true },
          { item_id: 'chk-21', description: 'Torque check chuck mounting bolts', mandatory: true },
        ],
        last_pm_date: new Date(Date.now() - 40 * 86400000).toISOString().split('T')[0],
        next_pm_date: overdueDate,
        grace_period_days: 2,
        is_active: true,
        created_at: new Date(Date.now() - 90 * 86400000),
        updated_at: new Date(Date.now() - 40 * 86400000),
      },
      {
        id: '30000000-0000-0000-0000-000000000004',
        plan_code: 'PM-2026-00004',
        machine_id: '40000000-0000-0000-0000-000000000002',
        title: 'Quarterly Electrical Cabinet Audit',
        frequency: 'quarterly',
        interval_days: 90,
        operating_hour_threshold: null,
        checklist_template: [],
        last_pm_date: null,
        next_pm_date: upcomingDate,
        grace_period_days: 7,
        is_active: false,
        created_at: new Date(Date.now() - 100 * 86400000),
        updated_at: new Date(Date.now() - 100 * 86400000),
      },
    ];

    this.workOrders = [
      {
        id: '60000000-0000-0000-0000-000000000001',
        wo_number: 'WO-2026-00101',
        complaint_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'medium',
        status: 'in_progress',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 48 * 3600000),
        work_instructions: '[PM Plan: PM-2026-00002 | Plan ID: 30000000-0000-0000-0000-000000000002] Weekly Lubrication & Coolant Check. Execute mandatory maintenance checklist.',
        diagnosis: null,
        corrective_action: null,
        root_cause_analysis: null,
        completed_at: null,
        repair_completed_time: null,
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 0,
        created_at: new Date(Date.now() - 2 * 3600000),
        updated_at: new Date(Date.now() - 2 * 3600000),
      },
      {
        id: '60000000-0000-0000-0000-000000000002',
        wo_number: 'WO-2026-00102',
        complaint_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'medium',
        status: 'submitted_verification',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: '[PM Plan: PM-2026-00001 | Plan ID: 30000000-0000-0000-0000-000000000001] Monthly Hydraulic & Spindle Inspection.',
        diagnosis: [
          { item_id: 'chk-1', description: 'Oil pressure check', status: 'pass' },
          { item_id: 'chk-2', description: 'Chiller temp check', status: 'pass' },
        ],
        corrective_action: 'Completed monthly inspection, cleaned intake filters, topped up 5L hydraulic oil.',
        root_cause_analysis: null,
        completed_at: new Date(Date.now() - 1 * 3600000),
        repair_completed_time: new Date(Date.now() - 1 * 3600000),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 60,
        active_repair_minutes: 45,
        created_at: new Date(Date.now() - 8 * 3600000),
        updated_at: new Date(Date.now() - 1 * 3600000),
      },
      {
        id: '60000000-0000-0000-0000-000000000003',
        wo_number: 'WO-2026-00050',
        complaint_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'medium',
        status: 'verified_closed',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() - 25 * 86400000),
        work_instructions: '[PM Plan: PM-2026-00001 | Plan ID: 30000000-0000-0000-0000-000000000001] Previous monthly service',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'Routine service successfully closed.',
        root_cause_analysis: null,
        completed_at: new Date(Date.now() - 27 * 86400000),
        repair_completed_time: new Date(Date.now() - 27 * 86400000),
        manager_verified_time: new Date(Date.now() - 27 * 86400000),
        machine_restored_time: new Date(Date.now() - 27 * 86400000),
        total_downtime_minutes: 90,
        active_repair_minutes: 75,
        created_at: new Date(Date.now() - 28 * 86400000),
        updated_at: new Date(Date.now() - 27 * 86400000),
      },
    ];

    this.events = [];
    this.auditLogs = [];
    this.notifications = [];
  }

  async connect(): Promise<DbClientLike> {
    const self = this;
    const client: DbClientLike = {
      async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
        return self.query(text, params);
      },
      release() {},
    };
    return client;
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();

    // 1. Transaction controls & Advisory Locks
    if (
      trimmed === 'BEGIN' ||
      trimmed === 'COMMIT' ||
      trimmed === 'ROLLBACK' ||
      trimmed.includes('pg_advisory_xact_lock')
    ) {
      return { rows: [], rowCount: 0 };
    }

    // 2. Dashboard KPIs Plan query (matches near top)
    if (trimmed.includes('total_active_plans') && trimmed.includes('FROM pm_plans p')) {
      const active = this.plans.filter((p) => p.is_active).length;
      return {
        rows: [
          {
            total_active_plans: active,
            upcoming_count: 1,
            due_count: 2,
            overdue_count: 1,
          },
        ],
        rowCount: 1,
      };
    }

    // 3. Dashboard KPIs WO query
    if (trimmed.includes('total_generated_wos') && trimmed.includes('FROM work_orders wo')) {
      const closed = this.workOrders.filter((w) => w.status === 'verified_closed').length;
      const awaiting = this.workOrders.filter((w) => ['completed', 'submitted_verification'].includes(w.status)).length;
      const inProg = this.workOrders.filter((w) => !['completed', 'verified_closed', 'cancelled'].includes(w.status)).length;
      return {
        rows: [
          {
            total_generated_wos: this.workOrders.length,
            active_open_wos: inProg,
            pending_verification_count: awaiting,
            completed_count: closed,
          },
        ],
        rowCount: 1,
      };
    }

    // 4. Monthly trends query
    if (trimmed.includes("DATE_TRUNC('month', wo.created_at)")) {
      return {
        rows: [
          { month: '2026-06', scheduled_generated: 5, completed: 5, compliance_rate: 100 },
          { month: '2026-07', scheduled_generated: 6, completed: 6, compliance_rate: 100 },
          { month: '2026-08', scheduled_generated: 7, completed: 6, compliance_rate: 85.7 },
          { month: '2026-09', scheduled_generated: 8, completed: 8, compliance_rate: 100 },
          { month: '2026-10', scheduled_generated: 7, completed: 7, compliance_rate: 100 },
          { month: '2026-11', scheduled_generated: 4, completed: 4, compliance_rate: 100 },
        ],
        rowCount: 6,
      };
    }

    // 5. Plan sequence number: MAX SUBSTRING plan_code
    if (trimmed.includes('MAX(SUBSTRING(plan_code FROM') && trimmed.includes('FROM pm_plans')) {
      const nextSeq = this.plans.length + 1;
      return { rows: [{ next_seq: nextSeq }], rowCount: 1 };
    }

    // 6. Work Order sequence number: MAX SUBSTRING wo_number
    if (trimmed.includes('MAX(SUBSTRING(wo_number FROM') && trimmed.includes('FROM work_orders')) {
      const nextSeq = this.workOrders.length + 1;
      return { rows: [{ next_seq: nextSeq }], rowCount: 1 };
    }

    // 7. Fetch machine with shop & plant
    if (trimmed.includes('FROM machines m') && trimmed.includes('JOIN shops s ON m.shop_id = s.id') && trimmed.includes('WHERE m.id = $1')) {
      const machineId = params[0];
      const m = this.machines.find((x) => x.id === machineId);
      if (!m) return { rows: [], rowCount: 0 };
      const shop = this.shops.find((s) => s.id === m.shop_id);
      const plant = this.plants.find((p) => p.id === shop?.plant_id);
      return {
        rows: [
          {
            ...m,
            shop_id: shop?.id,
            shop_name: shop?.shop_name,
            plant_id: plant?.id,
            plant_name: plant?.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 8. Fetch user by ID
    if (trimmed.includes('FROM users') && trimmed.includes('WHERE id = $1')) {
      const u = this.users.find((x) => x.id === params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }

    // 9. Duplicate plan check: machine_id, is_active = true, lower(title)
    if (trimmed.includes('FROM pm_plans') && trimmed.toLowerCase().includes('title') && trimmed.toLowerCase().includes('is_active = true')) {
      const [machineId, title] = params;
      const cleanTitle = (title || '').trim().toLowerCase();
      const dup = this.plans.find(
        (p) => p.machine_id === machineId && p.is_active && p.title.toLowerCase().trim() === cleanTitle
      );
      return { rows: dup ? [dup] : [], rowCount: dup ? 1 : 0 };
    }

    // 10. Insert new PM Plan
    if (trimmed.startsWith('INSERT INTO pm_plans')) {
      const [
        plan_code,
        machine_id,
        title,
        frequency,
        interval_days,
        operating_hour_threshold,
        checklist_template,
        last_pm_date,
        next_pm_date,
        grace_period_days,
        is_active,
      ] = params;

      const newPlan: MockPMPlan = {
        id: `30000000-0000-0000-0000-${String(this.plans.length + 1).padStart(12, '0')}`,
        plan_code,
        machine_id,
        title,
        frequency,
        interval_days,
        operating_hour_threshold,
        checklist_template: typeof checklist_template === 'string' ? JSON.parse(checklist_template) : checklist_template,
        last_pm_date,
        next_pm_date,
        grace_period_days,
        is_active,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.plans.push(newPlan);
      return { rows: [newPlan], rowCount: 1 };
    }

    // 11. Count PM plans for listing
    if (trimmed.includes('SELECT COUNT(DISTINCT p.id) as total') && trimmed.includes('FROM pm_plans p')) {
      let filtered = [...this.plans];
      return { rows: [{ total: filtered.length }], rowCount: 1 };
    }

    // 12. Fetch PM plans listing with joins
    if (trimmed.includes('SELECT p.*, m.machine_code') && trimmed.includes('FROM pm_plans p') && !trimmed.includes('WHERE p.id = $1')) {
      const rows = this.plans.map((p) => {
        const m = this.machines.find((x) => x.id === p.machine_id);
        const s = this.shops.find((sh) => sh.id === m?.shop_id);
        const pl = this.plants.find((pla) => pla.id === s?.plant_id);
        return {
          ...p,
          machine_code: m?.machine_code,
          machine_name: m?.name,
          machine_operating_hours: m?.operating_hours,
          shop_id: s?.id,
          shop_name: s?.shop_name,
          plant_id: pl?.id,
          plant_name: pl?.plant_name,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 13. Fetch single PM plan by ID with joins
    if (trimmed.includes('FROM pm_plans') && (trimmed.includes('WHERE p.id = $1') || trimmed.includes('WHERE id = $1'))) {
      const p = this.plans.find((x) => x.id === params[0]);
      if (!p) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === p.machine_id);
      const s = this.shops.find((sh) => sh.id === m?.shop_id);
      const pl = this.plants.find((pla) => pla.id === s?.plant_id);
      return {
        rows: [
          {
            ...p,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_operating_hours: m?.operating_hours,
            machine_status: m?.status,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: pl?.id,
            plant_name: pl?.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 13b. Fetch single PM plan by plan_code with joins
    if (trimmed.includes('FROM pm_plans') && trimmed.includes('WHERE plan_code = $1')) {
      const p = this.plans.find((x) => x.plan_code === params[0]);
      if (!p) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === p.machine_id);
      const s = this.shops.find((sh) => sh.id === m?.shop_id);
      const pl = this.plants.find((pla) => pla.id === s?.plant_id);
      return {
        rows: [
          {
            ...p,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_operating_hours: m?.operating_hours,
            machine_status: m?.status,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: pl?.id,
            plant_name: pl?.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 14. Fetch work order stats for a PM plan
    if (trimmed.includes('COUNT(id) as total_work_orders') && trimmed.includes('FROM work_orders')) {
      const matchedWos = this.workOrders.filter((w) => w.classification === 'regular_maintenance');
      const completedWos = matchedWos.filter((w) => w.status === 'verified_closed');
      return {
        rows: [
          {
            total_work_orders: matchedWos.length,
            completed_work_orders: completedWos.length,
            open_work_orders: matchedWos.length - completedWos.length,
            last_completed_at: completedWos.length > 0 ? completedWos[0].completed_at : null,
          },
        ],
        rowCount: 1,
      };
    }

    // 15. Update PM plan
    if (trimmed.startsWith('UPDATE pm_plans')) {
      const planId = params[params.length - 1];
      const pIndex = this.plans.findIndex((x) => x.id === planId);
      if (pIndex === -1) return { rows: [], rowCount: 0 };
      const p = this.plans[pIndex];

      if (trimmed.includes('last_pm_date = CURRENT_DATE')) {
        p.last_pm_date = new Date().toISOString().split('T')[0];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (p.interval_days || 30));
        p.next_pm_date = nextDate.toISOString().split('T')[0];
        if (trimmed.includes('operating_hour_threshold = COALESCE($1')) {
          if (params[0] !== null && params[0] !== undefined) {
            p.operating_hour_threshold = Number(params[0]);
          }
        }
      } else if (trimmed.includes('is_active = $1')) {
        p.is_active = params[0];
      } else if (trimmed.includes('next_pm_date = $1')) {
        p.next_pm_date = params[0];
      } else if (trimmed.includes('next_pm_date = next_pm_date +')) {
        const days = Number(params[0]) || 0;
        const cur = new Date(p.next_pm_date);
        cur.setDate(cur.getDate() + days);
        p.next_pm_date = cur.toISOString().split('T')[0];
      }
      p.updated_at = new Date();
      return { rows: [p], rowCount: 1 };
    }

    // 16. Upcoming query
    if (trimmed.includes('p.next_pm_date >= CURRENT_DATE') && trimmed.includes('p.next_pm_date <= CURRENT_DATE +')) {
      const rows = this.plans
        .filter((p) => p.is_active && p.next_pm_date >= new Date().toISOString().split('T')[0])
        .map((p) => {
          const m = this.machines.find((x) => x.id === p.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          const pl = this.plants.find((pla) => pla.id === s?.plant_id);
          return {
            ...p,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_operating_hours: m?.operating_hours,
            shop_name: s?.shop_name,
            plant_name: pl?.plant_name,
            plant_code: pl?.plant_code,
            days_until_due: 3,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // 17. Due query (date due or hours exceeded)
    if (trimmed.includes('p.next_pm_date <= CURRENT_DATE') || (trimmed.includes('p.operating_hour_threshold IS NOT NULL') && trimmed.includes('total_due'))) {
      const today = new Date().toISOString().split('T')[0];
      const rows = this.plans
        .filter((p) => {
          if (!p.is_active) return false;
          if (params.some((param) => typeof param === 'string' && param === p.id)) {
            // explicit match
          } else if (params.some((param) => typeof param === 'string' && param.startsWith('30000000-'))) {
            return false;
          }
          if (params.some((param) => typeof param === 'string' && param === p.machine_id)) {
            // explicit match
          } else if (params.some((param) => typeof param === 'string' && param.startsWith('40000000-'))) {
            return false;
          }
          const dateDue = p.next_pm_date <= today;
          const m = this.machines.find((x) => x.id === p.machine_id);
          const hoursDue = p.operating_hour_threshold !== null && (m?.operating_hours || 0) >= p.operating_hour_threshold;
          return dateDue || hoursDue;
        })
        .map((p) => {
          const m = this.machines.find((x) => x.id === p.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          const pl = this.plants.find((pla) => pla.id === s?.plant_id);
          return {
            ...p,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_operating_hours: m?.operating_hours,
            shop_name: s?.shop_name,
            plant_name: pl?.plant_name,
            plant_code: pl?.plant_code,
            due_reason: 'date_due',
            days_overdue: 0,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // 18. Overdue query (past grace period)
    if (trimmed.includes('CURRENT_DATE > (p.next_pm_date + (p.grace_period_days')) {
      const today = new Date().toISOString().split('T')[0];
      const rows = this.plans
        .filter((p) => p.is_active && p.next_pm_date < today)
        .map((p) => {
          const m = this.machines.find((x) => x.id === p.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          const pl = this.plants.find((pla) => pla.id === s?.plant_id);
          return {
            ...p,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_operating_hours: m?.operating_hours,
            shop_name: s?.shop_name,
            plant_name: pl?.plant_name,
            plant_code: pl?.plant_code,
            overdue_days: 10,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // 19. Existing active WO check for PM generation (status NOT IN ('verified_closed', 'completed'))
    if (trimmed.includes('FROM work_orders') && trimmed.includes("classification = 'regular_maintenance'") && trimmed.includes('status NOT IN')) {
      const machineId = params[0];
      const match = this.workOrders.find(
        (w) =>
          w.machine_id === machineId &&
          w.classification === 'regular_maintenance' &&
          !['verified_closed', 'completed'].includes(w.status)
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // 20. Insert new Work Order
    if (trimmed.startsWith('INSERT INTO work_orders')) {
      const [
        wo_number,
        machine_id,
        assigned_technician_id,
        assigned_manager_id,
        priority,
        status,
        classification,
        is_major_breakdown,
        sla_deadline,
        work_instructions,
      ] = params;

      const newWo: MockWorkOrder = {
        id: `60000000-0000-0000-0000-${String(this.workOrders.length + 1).padStart(12, '0')}`,
        wo_number,
        complaint_id: null,
        machine_id,
        assigned_technician_id,
        assigned_manager_id,
        priority,
        status,
        classification,
        is_major_breakdown,
        sla_deadline,
        work_instructions,
        diagnosis: null,
        corrective_action: null,
        root_cause_analysis: null,
        completed_at: null,
        repair_completed_time: null,
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.workOrders.push(newWo);
      return { rows: [newWo], rowCount: 1 };
    }

    // 21. Update machine status
    if (trimmed.startsWith('UPDATE machines')) {
      const mId = params[params.length - 1];
      const m = this.machines.find((x) => x.id === mId);
      if (m && trimmed.includes('status = \'under_maintenance\'')) {
        m.status = 'under_maintenance';
      } else if (m && trimmed.includes('status = \'running\'')) {
        m.status = 'running';
      }
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    // 22. Count Executions
    if (trimmed.includes('SELECT COUNT(DISTINCT wo.id) as total') && trimmed.includes('wo.classification = \'regular_maintenance\'')) {
      const count = this.workOrders.filter((w) => w.classification === 'regular_maintenance').length;
      return { rows: [{ total: count }], rowCount: 1 };
    }

    // 23. Machine PM History
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.machine_id = $1') && trimmed.includes('wo.classification = \'regular_maintenance\'')) {
      const machineId = params[0];
      const rows = this.workOrders
        .filter((w) => w.machine_id === machineId && w.classification === 'regular_maintenance')
        .map((wo) => {
          const tech = this.users.find((u) => u.id === wo.assigned_technician_id);
          const mgr = this.users.find((u) => u.id === wo.assigned_manager_id);
          return {
            ...wo,
            technician_name: tech?.full_name,
            manager_name: mgr?.full_name,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // 24. Executions listing
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('wo.classification = \'regular_maintenance\'') && !trimmed.includes('WHERE wo.id = $1') && !trimmed.includes('wo.machine_id = $1')) {
      const rows = this.workOrders
        .filter((w) => w.classification === 'regular_maintenance')
        .map((wo) => {
          const m = this.machines.find((x) => x.id === wo.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          const pl = this.plants.find((pla) => pla.id === s?.plant_id);
          const tech = this.users.find((u) => u.id === wo.assigned_technician_id);
          const mgr = this.users.find((u) => u.id === wo.assigned_manager_id);
          return {
            ...wo,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            bay_line_location: m?.bay_line_location,
            operating_hours: m?.operating_hours,
            machine_status: m?.status,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: pl?.id,
            plant_name: pl?.plant_name,
            technician_name: tech?.full_name,
            technician_code: tech?.employee_code,
            manager_name: mgr?.full_name,
          };
        });
      return { rows, rowCount: rows.length };
    }

    // 25. Execution details by ID
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.id = $1 AND wo.classification = \'regular_maintenance\'')) {
      const wo = this.workOrders.find((w) => w.id === params[0] && w.classification === 'regular_maintenance');
      if (!wo) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === wo.machine_id);
      const s = this.shops.find((sh) => sh.id === m?.shop_id);
      const pl = this.plants.find((pla) => pla.id === s?.plant_id);
      const tech = this.users.find((u) => u.id === wo.assigned_technician_id);
      const mgr = this.users.find((u) => u.id === wo.assigned_manager_id);
      return {
        rows: [
          {
            ...wo,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            bay_line_location: m?.bay_line_location,
            operating_hours: m?.operating_hours,
            machine_status: m?.status,
            shop_id: s?.id,
            shop_name: s?.shop_name,
            plant_id: pl?.id,
            plant_name: pl?.plant_name,
            technician_name: tech?.full_name,
            technician_code: tech?.employee_code,
            manager_name: mgr?.full_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 26. Events and parts queries for execution
    if (trimmed.includes('FROM work_order_events') && trimmed.includes('WHERE work_order_id = $1')) {
      const evs = this.events.filter((e) => e.work_order_id === params[0]);
      return { rows: evs, rowCount: evs.length };
    }
    if (trimmed.includes('FROM wo_parts_consumed')) {
      return { rows: [], rowCount: 0 };
    }

    // 27. Update execution work order (checklist, completion, verification)
    if (trimmed.startsWith('UPDATE work_orders')) {
      const woId = params[params.length - 1];
      const woIndex = this.workOrders.findIndex((w) => w.id === woId);
      if (woIndex === -1) return { rows: [], rowCount: 0 };
      const wo = this.workOrders[woIndex];

      if (trimmed.includes('diagnosis = $1')) {
        wo.diagnosis = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
      } else if (trimmed.includes('status = \'submitted_verification\'')) {
        wo.status = 'submitted_verification';
        wo.corrective_action = params[0];
        wo.repair_completed_time = new Date();
        wo.completed_at = new Date();
        wo.total_downtime_minutes = 45;
        wo.active_repair_minutes = 40;
      } else if (trimmed.includes('status = \'rework_required\'')) {
        wo.status = 'rework_required';
        wo.root_cause_analysis = params[0];
      } else if (trimmed.includes('status = \'verified_closed\'')) {
        wo.status = 'verified_closed';
        wo.manager_verified_time = new Date();
        wo.machine_restored_time = new Date();
      }
      wo.updated_at = new Date();
      return { rows: [wo], rowCount: 1 };
    }

    // 28. Insert event, audit, notification
    if (trimmed.startsWith('INSERT INTO work_order_events')) {
      const match = trimmed.match(/'(PM_[A-Z_]+)'/);
      let work_order_id = params[0];
      let event_type = '';
      let performed_by = '';
      let notes = '';
      if (match) {
        event_type = match[1];
        performed_by = params[1];
        notes = params[2];
      } else {
        event_type = params[1];
        performed_by = params[2];
        notes = params[3];
      }
      const ev: MockEvent = {
        id: `70000000-0000-0000-0000-${String(this.events.length + 1).padStart(12, '0')}`,
        work_order_id,
        event_type,
        performed_by,
        notes,
        timestamp: new Date(),
      };
      this.events.push(ev);
      return { rows: [ev], rowCount: 1 };
    }

    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values] = params;
      const log: MockAuditLog = {
        id: `80000000-0000-0000-0000-${String(this.auditLogs.length + 1).padStart(12, '0')}`,
        entity_name,
        entity_id,
        action,
        performed_by,
        old_values,
        new_values,
        timestamp: new Date(),
      };
      this.auditLogs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    if (trimmed.startsWith('INSERT INTO notifications')) {
      const [user_id, title, message, type, link] = params;
      const notif: MockNotification = {
        id: `90000000-0000-0000-0000-${String(this.notifications.length + 1).padStart(12, '0')}`,
        user_id,
        title,
        message,
        type,
        link,
        created_at: new Date(),
      };
      this.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // 29. By Machine summary query
    if (trimmed.includes('FROM machines m') && trimmed.includes('LEFT JOIN pm_plans pl ON m.id = pl.machine_id')) {
      const rows = this.machines.map((m) => {
        const s = this.shops.find((sh) => sh.id === m.shop_id);
        const pl = this.plants.find((pla) => pla.id === s?.plant_id);
        const mPlans = this.plans.filter((p) => p.machine_id === m.id);
        const activeCount = mPlans.filter((p) => p.is_active).length;
        const dueCount = mPlans.filter((p) => p.is_active && p.next_pm_date <= new Date().toISOString().split('T')[0]).length;
        return {
          id: m.id,
          machine_code: m.machine_code,
          name: m.name,
          category: m.category,
          criticality: m.criticality,
          operating_hours: m.operating_hours,
          shop_id: s?.id,
          shop_name: s?.shop_name,
          plant_id: pl?.id,
          plant_name: pl?.plant_name,
          active_plans: activeCount,
          due_plans: dueCount,
          last_pm_date: mPlans[0]?.last_pm_date || null,
          next_pm_date: mPlans[0]?.next_pm_date || null,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 30. By Plant summary query
    if (trimmed.includes('FROM plants p') && trimmed.includes('LEFT JOIN pm_plans pl')) {
      const rows = this.plants.map((pl) => {
        return {
          plant_id: pl.id,
          plant_name: pl.plant_name,
          plant_code: pl.plant_code,
          total_plans: 2,
          active_plans: 2,
          due_plans: 1,
          overdue_plans: 1,
          total_completed_wos: 1,
          on_time_completed_wos: 1,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 31. By Shop summary query
    if (trimmed.includes('FROM shops s') && trimmed.includes('LEFT JOIN pm_plans pl')) {
      const rows = this.shops.map((sh) => {
        const pl = this.plants.find((p) => p.id === sh.plant_id);
        return {
          shop_id: sh.id,
          shop_name: sh.shop_name,
          plant_id: pl?.id,
          plant_name: pl?.plant_name,
          total_plans: 2,
          active_plans: 2,
          due_plans: 1,
          overdue_plans: 1,
          total_completed_wos: 1,
          on_time_completed_wos: 1,
        };
      });
      return { rows, rowCount: rows.length };
    }

    // Default fallback: return empty
    return { rows: [], rowCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE: JCB CMMS MODULE 6 — PREVENTIVE MAINTENANCE (PM) MANAGEMENT
// ---------------------------------------------------------------------------
describe('JCB CMMS Module 6 — Preventive Maintenance (PM) Management Backend', () => {
  let mockDb: MockPMDatabase;
  let mockIo: MockSocketIO;

  const adminUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000001',
    employee_code: 'EMP-ADM-01',
    email: 'admin@jcb.com',
    role: 'admin',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const managerPune: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000002',
    employee_code: 'EMP-MGR-01',
    email: 'manager.pune@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const technicianUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-TEC-01',
    email: 'tech1@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const operatorUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000005',
    employee_code: 'EMP-OPR-01',
    email: 'operator1@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const managerBLB: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000003',
    employee_code: 'EMP-MGR-02',
    email: 'manager.blb@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000002',
    shop_id: '20000000-0000-0000-0000-000000000003',
  };

  beforeEach(() => {
    mockDb = new MockPMDatabase();
    mockIo = new MockSocketIO();
    setPmDb(mockDb);
    setPmIo(mockIo);
  });

  // -------------------------------------------------------------------------
  // SECTION 1: PM Plan Management (CRUD, Activation & Isolation)
  // -------------------------------------------------------------------------
  describe('1. PM Plan Management', () => {
    it('1. Create PM plan with valid fields returns HTTP 201 Created and sequential plan code', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          title: 'Quarterly Spindle Bearing Lubrication',
          frequency: 'quarterly',
          interval_days: 90,
          checklist_template: [
            { item_id: 'c-1', description: 'Inspect front bearing grease', mandatory: true },
          ],
          grace_period_days: 5,
        },
        {},
        {},
        {},
        managerPune
      );

      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.plan_code.startsWith('PM-'));
      assert.equal(res.responseData.data.title, 'Quarterly Spindle Bearing Lubrication');
      assert.equal(res.responseData.data.frequency, 'quarterly');
    });

    it('2. Create PM plan validation failure (missing title/machine_id) returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        {
          frequency: 'monthly',
        },
        {},
        {},
        {},
        managerPune
      );

      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /machine.*required/i);
    });

    it('3. Duplicate active PM plan on same machine rejects with HTTP 409 Conflict', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          title: 'Monthly Hydraulic & Spindle Inspection', // Same title as existing active plan
          frequency: 'monthly',
        },
        {},
        {},
        {},
        managerPune
      );

      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Active PM plan with title.*already exists/i);
    });

    it('4. List PM plans returns HTTP 200 with pagination metadata', async () => {
      const { req, res, next } = createMockContext({}, {}, { page: '1', limit: '10' }, {}, managerPune);
      await getPMPlans(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.pagination);
      assert.equal(res.responseData.pagination.page, 1);
    });

    it('5. Retrieve PM plan details by ID returns HTTP 200 with associated stats', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await getPMPlanById(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.id, '30000000-0000-0000-0000-000000000001');
      assert.equal(res.responseData.data.plan_code, 'PM-2026-00001');
      assert.ok(res.responseData.data.statistics);
    });

    it('6. Retrieve non-existent PM plan returns HTTP 404 Not Found', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '30000000-0000-0000-0000-999999999999' },
        {},
        {},
        managerPune
      );
      await getPMPlanById(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /PM plan not found/i);
    });

    it('7. Update PM plan fields updates successfully with HTTP 200 and audit log', async () => {
      const { req, res, next } = createMockContext(
        { title: 'Updated Monthly Inspection Protocol', grace_period_days: 4 },
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await updatePMPlan(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'UPDATE_PM_PLAN'));
    });

    it('8. Deactivate PM plan changes status to inactive and logs audit record', async () => {
      const { req, res, next } = createMockContext(
        { reason: 'Machine decommissioned for overhaul' },
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await deactivatePMPlan(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.is_active, false);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'DEACTIVATE_PM_PLAN'));
    });

    it('9. Activate PM plan reactivates plan with HTTP 200', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '30000000-0000-0000-0000-000000000004' },
        {},
        {},
        managerPune
      );
      await activatePMPlan(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.is_active, true);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'ACTIVATE_PM_PLAN'));
    });

    it('10. Manager cross-plant isolation: cannot create plan for another plant (HTTP 403 Forbidden)', async () => {
      // Machine 3 is in Ballabgarh (Plant 2); managerPune is assigned to Plant 1
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000003',
          title: 'Robot Arm Calibration',
          frequency: 'monthly',
        },
        {},
        {},
        {},
        managerPune
      );
      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /authorized scope/i);
    });

    it('11. Technician cannot create or update PM plans (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          title: 'Tech Plan',
          frequency: 'weekly',
        },
        {},
        {},
        {},
        technicianUser
      );
      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /not authorized to create PM plans/i);
    });

    it('12. Operator cannot create or update PM plans (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          title: 'Operator Plan',
          frequency: 'weekly',
        },
        {},
        {},
        {},
        operatorUser
      );
      await createPMPlan(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /not authorized to create PM plans/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Scheduling, Due Management, Reschedule, Defer & Skip
  // -------------------------------------------------------------------------
  describe('2. PM Scheduling & Due Management', () => {
    it('13. Upcoming PM query returns plans within 7 days window (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, { days: '7' }, {}, managerPune);
      await getPMUpcoming(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
    });

    it('14. Due PM query returns plans due today or operating hours threshold exceeded (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMDue(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.some((p: any) => p.plan_code === 'PM-2026-00002'));
    });

    it('15. Overdue PM query returns plans past due date plus grace period (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMOverdue(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
    });

    it('16. PM calendar endpoint returns grouped schedules by date (HTTP 200)', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { start_date: '2026-11-01', end_date: '2026-11-30' },
        {},
        managerPune
      );
      await getPMCalendar(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(typeof res.responseData.data === 'object');
    });

    it('17. Reschedule PM plan updates next_pm_date and logs audit (HTTP 200)', async () => {
      const targetDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const { req, res, next } = createMockContext(
        { new_date: targetDate, reason: 'Production shift schedule change' },
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await reschedulePM(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      const returnedDate = new Date(res.responseData.data.next_pm_date).toISOString().split('T')[0];
      assert.equal(returnedDate, targetDate);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'RESCHEDULE_PM'));
      assert.ok(mockIo.emissions.some((e) => e.event === 'notification'));
    });

    it('18. Reschedule PM plan rejects missing reason with HTTP 400 Bad Request', async () => {
      const targetDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const { req, res, next } = createMockContext(
        { new_date: targetDate }, // Missing reason
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await reschedulePM(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Reschedule reason is mandatory/i);
    });

    it('19. Defer PM plan extends next_pm_date by N days and logs audit (HTTP 200)', async () => {
      const { req, res, next } = createMockContext(
        { days: 7, reason: 'Spare seals waiting for shipment' },
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await deferPM(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'DEFER_PM'));
      assert.ok(mockIo.emissions.some((e) => e.event === 'notification'));
    });

    it('20. Skip PM plan advances next_pm_date by 1 cycle, logs audit and alert (HTTP 200)', async () => {
      const { req, res, next } = createMockContext(
        { reason: 'Major plant maintenance planned next week' },
        { id: '30000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await skipPM(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'SKIP_PM'));
      assert.ok(mockDb.notifications.some((n) => n.title.includes('Skipped')));
      assert.ok(mockIo.emissions.some((e) => e.event === 'notification'));
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Automatic PM Work Order Engine & Idempotency
  // -------------------------------------------------------------------------
  describe('3. Automatic Work Order Generation & Concurrency', () => {
    it('21. Automatic PM work order generation creates work order via shared service (HTTP 200)', async () => {
      // Remove any active open WO for Plan 3 so generation succeeds
      mockDb.workOrders = mockDb.workOrders.filter((w) => w.machine_id !== '40000000-0000-0000-0000-000000000002');

      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);
      await generateDuePMWorkOrders(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.generated_count >= 1);
      assert.ok(mockDb.workOrders.some((w) => w.classification === 'regular_maintenance'));
    });

    it('22. Automatic generation does NOT advance next_pm_date immediately (Invariance Check)', async () => {
      // Record next_pm_date of plan before generation
      const plan3Before = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000003');
      const expectedDueDate = plan3Before?.next_pm_date;

      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);
      await generateDuePMWorkOrders(req, res, next);

      const plan3After = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000003');
      assert.equal(plan3After?.next_pm_date, expectedDueDate, 'next_pm_date must NOT advance upon work order creation');
    });

    it('23. Idempotent generation: does not create duplicate work orders if open WO exists', async () => {
      // There is already an open WO (WO-2026-00101) for Plan 2 / Machine 1
      const initialCount = mockDb.workOrders.length;
      const { req, res, next } = createMockContext(
        { plan_id: '30000000-0000-0000-0000-000000000002' },
        {},
        {},
        {},
        managerPune
      );
      await generateDuePMWorkOrders(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.data.already_existing_count, 1);
      assert.equal(res.responseData.data.generated_count, 0);
      assert.equal(mockDb.workOrders.length, initialCount, 'No duplicate work order should be created');
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 4: PM Execution, Checklist & Lifecycle Tracking
  // -------------------------------------------------------------------------
  describe('4. PM Execution & Lifecycle Tracking', () => {
    it('24. Execution listing returns regular_maintenance work orders with HTTP 200', async () => {
      const { req, res, next } = createMockContext({}, {}, { page: '1', limit: '10' }, {}, managerPune);
      await getPMExecutions(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.every((w: any) => w.classification === 'regular_maintenance'));
    });

    it('25. Submit checklist results records checklist in execution (HTTP 200)', async () => {
      const checklistData = [
        { item_id: 'chk-10', description: 'Guideway lube', status: 'pass' },
        { item_id: 'chk-11', description: 'Coolant brix 8.5%', status: 'pass', value: '8.5%' },
      ];
      const { req, res, next } = createMockContext(
        { checklist: checklistData },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        technicianUser
      );
      await submitPMExecutionChecklist(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(mockDb.events.some((e) => e.event_type === 'PM_CHECKLIST_SUBMITTED'));
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'SUBMIT_PM_CHECKLIST'));
    });

    it('26. Technician completes PM execution moving status to submitted_verification (HTTP 200)', async () => {
      const { req, res, next } = createMockContext(
        {
          work_performed: 'Greased all linear axes, flushed coolant tank, verified sensor readings.',
          downtime_minutes: 45,
          active_repair_minutes: 40,
        },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        technicianUser
      );
      await completePMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'submitted_verification');
      assert.ok(mockDb.events.some((e) => e.event_type === 'PM_WORK_COMPLETED'));
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'COMPLETE_PM'));
    });

    it('27. Complete PM execution rejects missing work_performed with HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        { downtime_minutes: 30 },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        technicianUser
      );
      await completePMExecution(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /work performed are required/i);
    });

    it('28. Manager approves verification: closes WO and advances next_pm_date on PM plan (HTTP 200)', async () => {
      // WO 2 is in 'submitted_verification' status linked to Plan 1
      const plan1Before = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001');
      const oldDueDate = plan1Before?.next_pm_date;

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Service verified against OEM specs. All checks passed.' },
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'verified_closed');

      // Next due date MUST advance strictly upon manager approval
      const plan1After = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001');
      assert.notEqual(plan1After?.next_pm_date, oldDueDate, 'next_pm_date MUST advance after manager approval');
      assert.equal(plan1After?.last_pm_date, new Date().toISOString().split('T')[0]);
      assert.ok(mockDb.events.some((e) => e.event_type === 'PM_VERIFIED_CLOSED'));
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'VERIFY_PM'));
    });

    it('29. Manager rejects verification: sets status to rework_required with mandatory remarks (HTTP 200)', async () => {
      // Revert WO 2 to submitted_verification
      const wo2 = mockDb.workOrders.find((w) => w.id === '60000000-0000-0000-0000-000000000002')!;
      wo2.status = 'submitted_verification';

      const { req, res, next } = createMockContext(
        { action: 'REJECTED', verification_remarks: 'Spindle chiller temperature sensor still out of calibration.' },
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'rework_required');
      assert.ok(mockDb.events.some((e) => e.event_type === 'PM_VERIFICATION_REJECTED'));
      assert.ok(mockDb.auditLogs.some((l) => l.action === 'REJECT_PM'));
    });

    it('30. Technician cannot verify PM completion (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Self approval' },
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        technicianUser
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /only managers and admins can verify/i);
    });

    it('31. Machine PM history returns historical completed work orders (HTTP 200)', async () => {
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await getMachinePMHistory(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Dashboard & Compliance Analytics
  // -------------------------------------------------------------------------
  describe('5. PM Dashboard & Compliance Analytics', () => {
    it('32. Dashboard KPIs calculate active plans, due, overdue, and compliance % (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMDashboard(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(typeof res.responseData.data.kpis === 'object');
      assert.ok(typeof res.responseData.data.kpis.pm_compliance_percentage === 'number');
      assert.ok(res.responseData.data.kpis.total_active_plans >= 1);
    });

    it('33. Compliance endpoint returns overall compliance, plant, and shop breakdown (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMCompliance(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(typeof res.responseData.data.overall_compliance_percentage === 'number');
      assert.ok(Array.isArray(res.responseData.data.by_plant));
      assert.ok(Array.isArray(res.responseData.data.by_shop));
    });

    it('34. Trends endpoint returns 6-month historical compliance trend (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, { months: '6' }, {}, managerPune);
      await getPMTrends(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.equal(res.responseData.data.length, 6);
    });

    it('35. Machine-wise PM summary returns machine compliance status (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMByMachine(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
      assert.ok(res.responseData.data[0].machine_code);
    });

    it('36. Plant-wise PM summary returns plant compliance status (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);
      await getPMByPlant(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
      assert.ok(res.responseData.data[0].plant_name);
    });

    it('37. Shop-wise PM summary returns shop compliance status (HTTP 200)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getPMByShop(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 1);
      assert.ok(res.responseData.data[0].shop_name);
    });

    it('38. Database mode transparency: reports mock vs real PostgreSQL database configuration', () => {
      const hasRealDb = Boolean(process.env.DATABASE_URL);
      if (hasRealDb) {
        console.log('[PM Test Info] Real PostgreSQL DATABASE_URL detected.');
      } else {
        console.log('[PM Test Info] Running against high-fidelity in-memory MockPMDatabase with full transactional contract.');
      }
      assert.ok(true);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Focused Final Verification Suite
  // -------------------------------------------------------------------------
  describe('6. Focused Final Verification Suite', () => {
    it('39. Operating-hour PM limitation: does not infer recurring interval from threshold without explicit interval, preserves calendar next_pm_date', async () => {
      // Setup a plan with operating_hour_threshold: 500 on Machine 1, but NO explicit interval in checklist_template
      const opPlanId = '30000000-0000-0000-0000-000000000099';
      mockDb.plans.push({
        id: opPlanId,
        plan_code: 'PM-2026-00099',
        machine_id: '40000000-0000-0000-0000-000000000001',
        title: '500-Hour Hydraulic Service',
        frequency: 'monthly',
        interval_days: 30,
        operating_hour_threshold: 500,
        checklist_template: [{ item_id: 'h-1', description: 'Hydraulic filter replacement' }],
        last_pm_date: null,
        next_pm_date: new Date().toISOString().split('T')[0],
        grace_period_days: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const opWoId = '60000000-0000-0000-0000-000000000099';
      mockDb.workOrders.push({
        id: opWoId,
        wo_number: 'WO-2026-0099',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'high',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: `[PM Plan: PM-2026-00099 | Plan ID: ${opPlanId}] 500-Hour Hydraulic Service. Completed at 520 operating hours.`,
        diagnosis: [{ item_id: 'h-1', status: 'pass' }],
        corrective_action: 'Hydraulic filter replaced and flushed.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 45,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Manager verifies and approves completion
      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: '500-hour service completed at 520h. Approved.' },
        { id: opWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'verified_closed');

      // Verify that operating_hour_threshold was NOT assumed or guessed without explicit interval
      const updatedPlan = mockDb.plans.find((p) => p.id === opPlanId)!;
      assert.equal(updatedPlan.operating_hour_threshold, 500, 'Threshold must remain 500 without explicit interval');
      assert.equal(updatedPlan.last_pm_date, new Date().toISOString().split('T')[0]);
      assert.notEqual(updatedPlan.next_pm_date, new Date().toISOString().split('T')[0], 'Calendar next_pm_date must advance');

      // Verify explicit unsupported_configuration data_quality metadata
      assert.equal(res.responseData.data.data_quality.operating_hour_status, 'unsupported_configuration');
      assert.ok(res.responseData.data.data_quality.proposed_schema_fields.includes('operating_hour_interval'));
      assert.ok(res.responseData.data.data_quality.proposed_schema_fields.includes('last_pm_operating_hours'));
    });

    it('40. Explicit operating-hour interval: advances threshold when recurring interval is explicitly persisted in metadata', async () => {
      // Setup a plan with operating_hour_threshold: 500 and explicit operating_hour_interval: 500 in metadata
      const explicitPlanId = '30000000-0000-0000-0000-000000000098';
      mockDb.plans.push({
        id: explicitPlanId,
        plan_code: 'PM-2026-00098',
        machine_id: '40000000-0000-0000-0000-000000000001',
        title: '500-Hour Hydraulic Service (Explicit Interval)',
        frequency: 'monthly',
        interval_days: 30,
        operating_hour_threshold: 500,
        checklist_template: { items: [{ item_id: 'h-1' }], operating_hour_interval: 500 },
        last_pm_date: null,
        next_pm_date: new Date().toISOString().split('T')[0],
        grace_period_days: 3,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const explicitWoId = '60000000-0000-0000-0000-000000000098';
      mockDb.workOrders.push({
        id: explicitWoId,
        wo_number: 'WO-2026-0098',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'high',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: `[PM Plan: PM-2026-00098 | Plan ID: ${explicitPlanId}] Service with explicit interval metadata.`,
        diagnosis: [{ item_id: 'h-1', status: 'pass' }],
        corrective_action: 'Service completed.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 45,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Approved explicit interval PM' },
        { id: explicitWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);

      // Verify that operating_hour_threshold correctly advanced to 1000
      const updatedPlan = mockDb.plans.find((p) => p.id === explicitPlanId)!;
      assert.equal(updatedPlan.operating_hour_threshold, 1000, 'Operating hour threshold must advance to 1000');
      assert.equal(res.responseData.data.data_quality.operating_hour_status, 'advanced');
    });

    it('41. Technician cannot access PM execution assigned to another technician (HTTP 403 Forbidden)', async () => {
      const otherTechnician: AuthenticatedUser = {
        id: '00000000-0000-0000-0000-000000000099',
        employee_code: 'EMP-TEC-99',
        email: 'othertech@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      };

      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        otherTechnician
      );
      await getPMExecutionDetails(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /authorized to access PM executions assigned to you/i);
    });

    it('42. Technician cannot submit checklist for PM execution assigned to another technician (HTTP 403 Forbidden)', async () => {
      const otherTechnician: AuthenticatedUser = {
        id: '00000000-0000-0000-0000-000000000099',
        employee_code: 'EMP-TEC-99',
        email: 'othertech@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      };

      const { req, res, next } = createMockContext(
        { responses: [{ item_id: 'chk-1', status: 'pass' }], overall_status: 'pass' },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        otherTechnician
      );
      await submitPMExecutionChecklist(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /authorized to access PM executions assigned to you/i);
    });

    it('43. Technician cannot complete PM execution assigned to another technician (HTTP 403 Forbidden)', async () => {
      const otherTechnician: AuthenticatedUser = {
        id: '00000000-0000-0000-0000-000000000099',
        employee_code: 'EMP-TEC-99',
        email: 'othertech@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      };

      const { req, res, next } = createMockContext(
        { work_performed: 'Unauthorized attempt to complete other tech work order' },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        otherTechnician
      );
      await completePMExecution(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /authorized to access PM executions assigned to you/i);
    });

    it('44. Operator cannot submit checklist, complete, or verify PM executions (HTTP 403 Forbidden)', async () => {
      // 1. Checklist submission attempt by operator
      const ctx1 = createMockContext(
        { responses: [{ item_id: 'chk-1', status: 'pass' }] },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        operatorUser
      );
      await submitPMExecutionChecklist(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 403);
      assert.match(ctx1.res.responseData.message, /Forbidden.*role/i);

      // 2. Execution completion attempt by operator
      const ctx2 = createMockContext(
        { work_performed: 'Operator trying to complete maintenance' },
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        operatorUser
      );
      await completePMExecution(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 403);
      assert.match(ctx2.res.responseData.message, /Forbidden.*role/i);

      // 3. Verification attempt by operator
      const ctx3 = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Operator approval' },
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        operatorUser
      );
      await verifyPMExecution(ctx3.req, ctx3.res, ctx3.next);
      assert.equal(ctx3.res.statusCode, 403);
      assert.match(ctx3.res.responseData.message, /only managers and admins can verify/i);
    });

    it('45. Plant/Shop Isolation: Manager from Plant 2 cannot access or verify PM executions in Plant 1 (HTTP 403 Forbidden)', async () => {
      // Manager from Ballabgarh Plant 2 accessing Pune Plant 1 execution
      const ctx1 = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerBLB
      );
      await getPMExecutionDetails(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 403);
      assert.match(ctx1.res.responseData.message, /Forbidden.*another plant/i);

      // Manager from Ballabgarh Plant 2 verifying Pune Plant 1 execution
      const ctx2 = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Cross-plant attempt' },
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        managerBLB
      );
      await verifyPMExecution(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 403);
      assert.match(ctx2.res.responseData.message, /Forbidden.*another plant/i);
    });

    it('46. Missing PM plan metadata in work instructions rejects verification with HTTP 400 and advances no plan', async () => {
      const noMetaWoId = '60000000-0000-0000-0000-000000000050';
      mockDb.workOrders.push({
        id: noMetaWoId,
        wo_number: 'WO-2026-0050',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'medium',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: 'Routine filter replacement. No metadata headers present.',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'Completed filter replacement.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Approved' },
        { id: noMetaWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /could not be unambiguously resolved/i);

      // Verify work order was NOT verified_closed
      const wo = mockDb.workOrders.find((w) => w.id === noMetaWoId)!;
      assert.equal(wo.status, 'submitted_verification', 'Work order status must remain submitted_verification');
    });

    it('47. Malformed PM plan UUID in work instructions rejects verification with HTTP 400 and advances no plan', async () => {
      const malformedWoId = '60000000-0000-0000-0000-000000000051';
      mockDb.workOrders.push({
        id: malformedWoId,
        wo_number: 'WO-2026-0051',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'medium',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: '[PM Plan: NONEXISTENT_CODE | Plan ID: malformed-uuid-12345] Malformed ID.',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'Done.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Approved' },
        { id: malformedWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /could not be unambiguously resolved/i);
    });

    it('48. Nonexistent PM plan ID in work instructions rejects verification with HTTP 400 and advances no plan', async () => {
      const nonExistentWoId = '60000000-0000-0000-0000-000000000052';
      mockDb.workOrders.push({
        id: nonExistentWoId,
        wo_number: 'WO-2026-0052',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'medium',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: '[Plan ID: 99999999-9999-9999-9999-999999999999] Valid UUID format but nonexistent plan.',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'Done.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Approved' },
        { id: nonExistentWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /could not be unambiguously resolved/i);
    });

    it('49. Multiple active PM plans on same machine: ambiguous verification rejects with HTTP 400 and advances neither plan', async () => {
      // Machine 1 has Plan 1 (Monthly) already seeded in mockDb.
      // Add a second active plan on Machine 1: Plan B (Quarterly)
      const planBId = '30000000-0000-0000-0000-000000000088';
      mockDb.plans.push({
        id: planBId,
        plan_code: 'PM-2026-00088',
        machine_id: '40000000-0000-0000-0000-000000000001',
        title: 'Quarterly Spindle Maintenance',
        frequency: 'quarterly',
        interval_days: 90,
        operating_hour_threshold: 1000,
        checklist_template: [],
        last_pm_date: null,
        next_pm_date: '2026-11-20',
        grace_period_days: 5,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const plan1Before = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001')!;
      const plan1NextDateBefore = plan1Before.next_pm_date;
      const plan1ThresholdBefore = plan1Before.operating_hour_threshold;

      const planBBefore = mockDb.plans.find((p) => p.id === planBId)!;
      const planBNextDateBefore = planBBefore.next_pm_date;
      const planBThresholdBefore = planBBefore.operating_hour_threshold;

      // Work order with ambiguous instructions (no Plan ID or valid code)
      const ambiguousWoId = '60000000-0000-0000-0000-000000000053';
      mockDb.workOrders.push({
        id: ambiguousWoId,
        wo_number: 'WO-2026-0053',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'medium',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: 'Ambiguous maintenance on Machine 1 without plan metadata.',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'General maintenance performed.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Approved' },
        { id: ambiguousWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /could not be unambiguously resolved/i);

      // Verify that NEITHER Plan 1 nor Plan B was advanced
      const plan1After = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001')!;
      assert.equal(plan1After.next_pm_date, plan1NextDateBefore, 'Plan 1 next_pm_date must remain unchanged');
      assert.equal(plan1After.operating_hour_threshold, plan1ThresholdBefore, 'Plan 1 threshold must remain unchanged');

      const planBAfter = mockDb.plans.find((p) => p.id === planBId)!;
      assert.equal(planBAfter.next_pm_date, planBNextDateBefore, 'Plan B next_pm_date must remain unchanged');
      assert.equal(planBAfter.operating_hour_threshold, planBThresholdBefore, 'Plan B threshold must remain unchanged');
    });

    it('50. PM plan resolution succeeds via unique plan_code when plan UUID is omitted', async () => {
      const plan1Before = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001')!;
      const oldDueDate = plan1Before.next_pm_date;

      const codeOnlyWoId = '60000000-0000-0000-0000-000000000054';
      mockDb.workOrders.push({
        id: codeOnlyWoId,
        wo_number: 'WO-2026-0054',
        machine_id: '40000000-0000-0000-0000-000000000001',
        complaint_id: null,
        assigned_technician_id: technicianUser.id,
        assigned_manager_id: managerPune.id,
        status: 'submitted_verification',
        priority: 'medium',
        classification: 'regular_maintenance',
        is_major_breakdown: false,
        sla_deadline: new Date(Date.now() + 24 * 3600000),
        work_instructions: '[PM Plan: PM-2026-00001] Monthly inspection without Plan ID UUID. Execute checklist.',
        diagnosis: [{ item_id: 'chk-1', status: 'pass' }],
        corrective_action: 'Completed monthly PM.',
        root_cause_analysis: null,
        completed_at: new Date(),
        repair_completed_time: new Date(),
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 30,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        { action: 'APPROVED', verification_remarks: 'Verified via plan_code' },
        { id: codeOnlyWoId },
        {},
        {},
        managerPune
      );
      await verifyPMExecution(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'verified_closed');

      const plan1After = mockDb.plans.find((p) => p.id === '30000000-0000-0000-0000-000000000001')!;
      assert.notEqual(plan1After.next_pm_date, oldDueDate, 'Plan 1 next_pm_date must advance');
    });
  });
});
