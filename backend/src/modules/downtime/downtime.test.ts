import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import {
  getDowntimeAnalytics,
  getDowntimeRecords,
  getDowntimeRecordDetails,
  getMachineDowntimeSummary,
  getMachineDowntimeHistory,
  getMachineAvailability,
  getMTTRAnalytics,
  getMTBFAnalytics,
  getParetoMachines,
  getDowntimeByPlant,
  getDowntimeByShop,
  getDowntimeByCategory,
  getDowntimeByCause,
  getDowntimeTrends,
  getPlannedVsUnplanned,
  getSlaPerformance,
  getCurrentDowntime,
  setDowntimeDb,
  resetDowntimeDb,
} from './downtime.controller';
import { DbClientLike, DbPoolLike } from './downtime.service';
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
  breakdown_time: Date | null;
  reported_time: Date | null;
  manager_ack_time?: Date | null;
  technician_assigned_time?: Date | null;
  arrival_time?: Date | null;
  work_started_time?: Date | null;
  repair_completed_time?: Date | null;
  manager_verified_time?: Date | null;
  machine_restored_time?: Date | null;
  total_downtime_minutes: number;
  active_repair_minutes: number;
  maintenance_response_minutes: number;
  affected_component?: string | null;
  fault_category?: string | null;
  root_cause_analysis?: string | null;
  corrective_action?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MockMaintenanceRequest {
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
}

interface MockWorkOrderEvent {
  id: string;
  work_order_id: string;
  event_type: string;
  performed_by: string;
  notes: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Mock Downtime Database Implementation
// ---------------------------------------------------------------------------
class MockDowntimeDatabase implements DbPoolLike {
  public plants: MockPlant[] = [];
  public shops: MockShop[] = [];
  public users: MockUser[] = [];
  public machines: MockMachine[] = [];
  public workOrders: MockWorkOrder[] = [];
  public complaints: MockMaintenanceRequest[] = [];
  public events: MockWorkOrderEvent[] = [];

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
        status: 'breakdown',
        operating_hours: 890.0,
        bay_line_location: 'Bay 1, Line B',
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        shop_id: '20000000-0000-0000-0000-000000000002',
        machine_code: 'PRS-1000',
        name: 'Schuler 1000T Hydraulic Press',
        category: 'Press',
        criticality: 'class_a',
        status: 'under_maintenance',
        operating_hours: 3200.0,
        bay_line_location: 'Bay 3, Line 1',
      },
      {
        id: '40000000-0000-0000-0000-000000000004',
        shop_id: '20000000-0000-0000-0000-000000000003', // Plant 2
        machine_code: 'ROB-001',
        name: 'Fanuc Arc Welding Cell',
        category: 'Robot',
        criticality: 'class_b',
        status: 'running',
        operating_hours: 500.0,
        bay_line_location: 'Plant 2, Cell 4',
      },
    ];

    this.users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-01',
        full_name: 'System Admin',
        email: 'admin@jcb.com',
        role: 'admin',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-01',
        full_name: 'Pune Plant Manager',
        email: 'mgr.pune@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        employee_code: 'EMP-MGR-02',
        full_name: 'Ballabgarh Manager',
        email: 'mgr.blb@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000002',
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        employee_code: 'EMP-TEC-01',
        full_name: 'Senior Hydraulic Tech',
        email: 'tech1@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        employee_code: 'EMP-TEC-02',
        full_name: 'Electrical Technician',
        email: 'tech2@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000002',
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        employee_code: 'EMP-OPR-01',
        full_name: 'CNC Operator',
        email: 'operator1@jcb.com',
        role: 'operator',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
      },
    ];

    this.complaints = [
      {
        id: '50000000-0000-0000-0000-000000000001',
        complaint_number: 'CMP-2026-00001',
        machine_id: '40000000-0000-0000-0000-000000000001',
        reported_by_id: '00000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'Hydraulic',
        priority: 'high',
        status: 'closed',
        breakdown_occurred_at: new Date('2026-11-01T08:00:00Z'),
        reported_at: new Date('2026-11-01T08:15:00Z'),
        problem_title: 'Hydraulic pump pressure drop below 150 bar',
        description: 'Microglass filter element choked during heavy milling cut',
      },
      {
        id: '50000000-0000-0000-0000-000000000002',
        complaint_number: 'CMP-2026-00002',
        machine_id: '40000000-0000-0000-0000-000000000003',
        reported_by_id: '00000000-0000-0000-0000-000000000004',
        shift: 'Shift B',
        issue_category: 'Mechanical',
        priority: 'critical',
        status: 'closed',
        breakdown_occurred_at: new Date('2026-11-02T10:00:00Z'),
        reported_at: new Date('2026-11-02T10:10:00Z'),
        problem_title: 'Main ram seal ruptured on 1000T press',
        description: 'Severe oil leakage around cylinder packings',
      },
      {
        id: '50000000-0000-0000-0000-000000000003',
        complaint_number: 'CMP-2026-00003',
        machine_id: '40000000-0000-0000-0000-000000000002',
        reported_by_id: '00000000-0000-0000-0000-000000000004',
        shift: 'Shift A',
        issue_category: 'Electrical',
        priority: 'high',
        status: 'in_progress',
        breakdown_occurred_at: new Date('2026-11-05T06:00:00Z'),
        reported_at: new Date('2026-11-05T06:20:00Z'),
        problem_title: 'Spindle drive overload trip error code ALM-401',
        description: 'CNC lathe trips immediately upon engaging M03',
      },
    ];

    this.workOrders = [
      {
        id: '60000000-0000-0000-0000-000000000001',
        wo_number: 'WO-2026-00001',
        complaint_id: '50000000-0000-0000-0000-000000000001',
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'high',
        status: 'verified_closed',
        classification: 'minor_breakdown',
        is_major_breakdown: false,
        sla_deadline: new Date('2026-11-01T12:00:00Z'),
        breakdown_time: new Date('2026-11-01T08:00:00Z'),
        reported_time: new Date('2026-11-01T08:15:00Z'),
        manager_ack_time: new Date('2026-11-01T08:20:00Z'),
        technician_assigned_time: new Date('2026-11-01T08:25:00Z'),
        arrival_time: new Date('2026-11-01T08:35:00Z'),
        work_started_time: new Date('2026-11-01T08:45:00Z'),
        repair_completed_time: new Date('2026-11-01T10:15:00Z'),
        manager_verified_time: new Date('2026-11-01T10:30:00Z'),
        machine_restored_time: new Date('2026-11-01T10:30:00Z'),
        total_downtime_minutes: 150, // 8:00 to 10:30 = 150 mins
        active_repair_minutes: 90,   // 8:45 to 10:15 = 90 mins
        maintenance_response_minutes: 20, // 8:15 to 8:35 = 20 mins
        affected_component: 'Hydraulic Pump Filter',
        fault_category: 'Hydraulic',
        root_cause_analysis: 'Filter element clogged due to particulate contamination in oil reservoir',
        corrective_action: 'Flushed reservoir and installed new microglass filter HYD-10025',
        created_at: new Date('2026-11-01T08:25:00Z'),
        updated_at: new Date('2026-11-01T10:30:00Z'),
      },
      {
        id: '60000000-0000-0000-0000-000000000002',
        wo_number: 'WO-2026-00002',
        complaint_id: '50000000-0000-0000-0000-000000000002',
        machine_id: '40000000-0000-0000-0000-000000000003',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'critical',
        status: 'verified_closed',
        classification: 'major_breakdown',
        is_major_breakdown: true,
        sla_deadline: new Date('2026-11-02T13:00:00Z'),
        breakdown_time: new Date('2026-11-02T10:00:00Z'),
        reported_time: new Date('2026-11-02T10:10:00Z'),
        manager_ack_time: new Date('2026-11-02T10:15:00Z'),
        technician_assigned_time: new Date('2026-11-02T10:20:00Z'),
        arrival_time: new Date('2026-11-02T10:30:00Z'),
        work_started_time: new Date('2026-11-02T10:45:00Z'),
        repair_completed_time: new Date('2026-11-02T13:45:00Z'), // Breached SLA by 45 mins
        manager_verified_time: new Date('2026-11-02T14:00:00Z'),
        machine_restored_time: new Date('2026-11-02T14:00:00Z'),
        total_downtime_minutes: 240, // 10:00 to 14:00 = 240 mins
        active_repair_minutes: 180,  // 10:45 to 13:45 = 180 mins
        maintenance_response_minutes: 20, // 10:10 to 10:30 = 20 mins
        affected_component: 'Ram Seal Assembly',
        fault_category: 'Mechanical',
        root_cause_analysis: 'High cyclic pressure fatigue caused polyurethane extrusion',
        corrective_action: 'Replaced main piston packing with reinforced seal kit',
        created_at: new Date('2026-11-02T10:20:00Z'),
        updated_at: new Date('2026-11-02T14:00:00Z'),
      },
      {
        id: '60000000-0000-0000-0000-000000000003',
        wo_number: 'WO-2026-00003',
        complaint_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'medium',
        status: 'verified_closed',
        classification: 'regular_maintenance', // Planned downtime
        is_major_breakdown: false,
        sla_deadline: new Date('2026-11-03T12:00:00Z'),
        breakdown_time: new Date('2026-11-03T07:00:00Z'),
        reported_time: new Date('2026-11-03T07:00:00Z'),
        manager_ack_time: new Date('2026-11-03T07:05:00Z'),
        technician_assigned_time: new Date('2026-11-03T07:10:00Z'),
        arrival_time: new Date('2026-11-03T07:15:00Z'),
        work_started_time: new Date('2026-11-03T07:30:00Z'),
        repair_completed_time: new Date('2026-11-03T08:30:00Z'),
        manager_verified_time: new Date('2026-11-03T08:40:00Z'),
        machine_restored_time: new Date('2026-11-03T08:40:00Z'),
        total_downtime_minutes: 100, // 7:00 to 8:40 = 100 mins
        active_repair_minutes: 60,   // 7:30 to 8:30 = 60 mins
        maintenance_response_minutes: 15, // 7:00 to 7:15 = 15 mins
        affected_component: 'Lubrication System',
        fault_category: 'Lubrication',
        root_cause_analysis: 'Monthly scheduled preventive oil change and greasing',
        corrective_action: 'Replaced ISO VG 68 slideway oil and greased ball screws',
        created_at: new Date('2026-11-03T07:00:00Z'),
        updated_at: new Date('2026-11-03T08:40:00Z'),
      },
      {
        id: '60000000-0000-0000-0000-000000000004',
        wo_number: 'WO-2026-00004',
        complaint_id: '50000000-0000-0000-0000-000000000003',
        machine_id: '40000000-0000-0000-0000-000000000002',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'high',
        status: 'under_diagnosis', // ONGOING incident
        classification: 'minor_breakdown',
        is_major_breakdown: false,
        sla_deadline: new Date('2026-11-05T12:00:00Z'),
        breakdown_time: new Date('2026-11-05T06:00:00Z'),
        reported_time: new Date('2026-11-05T06:20:00Z'),
        manager_ack_time: new Date('2026-11-05T06:25:00Z'),
        technician_assigned_time: new Date('2026-11-05T06:30:00Z'),
        arrival_time: new Date('2026-11-05T06:45:00Z'),
        work_started_time: new Date('2026-11-05T07:00:00Z'),
        repair_completed_time: null,
        manager_verified_time: null,
        machine_restored_time: null,
        total_downtime_minutes: 0,
        active_repair_minutes: 0,
        maintenance_response_minutes: 25,
        affected_component: 'Spindle Servo Amplifier',
        fault_category: 'Electrical',
        root_cause_analysis: null,
        corrective_action: null,
        created_at: new Date('2026-11-05T06:30:00Z'),
        updated_at: new Date('2026-11-05T07:00:00Z'),
      },
      {
        id: '60000000-0000-0000-0000-000000000005',
        wo_number: 'WO-2026-00005',
        complaint_id: null,
        machine_id: '40000000-0000-0000-0000-000000000002',
        assigned_technician_id: '00000000-0000-0000-0000-000000000005', // Assigned to tech2 (same CNC shop as tech1)
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
        priority: 'high',
        status: 'under_diagnosis',
        classification: 'minor_breakdown',
        is_major_breakdown: false,
        sla_deadline: new Date('2026-11-05T18:00:00Z'),
        breakdown_time: new Date('2026-11-05T08:00:00Z'),
        reported_time: new Date('2026-11-05T08:15:00Z'),
        total_downtime_minutes: 0,
        active_repair_minutes: 0,
        maintenance_response_minutes: 15,
        created_at: new Date('2026-11-05T08:15:00Z'),
        updated_at: new Date('2026-11-05T08:15:00Z'),
      },
    ];

    this.events = [
      {
        id: '70000000-0000-0000-0000-000000000001',
        work_order_id: '60000000-0000-0000-0000-000000000001',
        event_type: 'ASSIGNED',
        performed_by: '00000000-0000-0000-0000-000000000002',
        notes: 'Allocated to tech1',
        timestamp: new Date('2026-11-01T08:25:00Z'),
      },
      {
        id: '70000000-0000-0000-0000-000000000002',
        work_order_id: '60000000-0000-0000-0000-000000000001',
        event_type: 'WORK_STARTED',
        performed_by: '00000000-0000-0000-0000-000000000004',
        notes: 'Commenced filter housing disassembly',
        timestamp: new Date('2026-11-01T08:45:00Z'),
      },
      {
        id: '70000000-0000-0000-0000-000000000003',
        work_order_id: '60000000-0000-0000-0000-000000000001',
        event_type: 'COMPLETED',
        performed_by: '00000000-0000-0000-0000-000000000004',
        notes: 'Repair complete, pressure stable at 210 bar',
        timestamp: new Date('2026-11-01T10:15:00Z'),
      },
    ];
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

    // 1. Overall Summary query
    if (trimmed.includes('COUNT(DISTINCT wo.id) as total_breakdown_events') && trimmed.includes('status = \'verified_closed\'')) {
      const closed = this.workOrders.filter((w) => w.status === 'verified_closed');
      const totalDowntime = closed.reduce((acc, w) => acc + w.total_downtime_minutes, 0);
      const totalRepair = closed.reduce((acc, w) => acc + w.active_repair_minutes, 0);
      const totalResponse = closed.reduce((acc, w) => acc + w.maintenance_response_minutes, 0);

      const plannedMins = closed.filter((w) => w.classification === 'regular_maintenance').reduce((a, b) => a + b.total_downtime_minutes, 0);
      const unplannedMins = closed.filter((w) => w.classification !== 'regular_maintenance').reduce((a, b) => a + b.total_downtime_minutes, 0);

      return {
        rows: [
          {
            total_breakdown_events: closed.length,
            total_downtime_minutes: totalDowntime,
            total_downtime_hours: Math.round((totalDowntime / 60) * 100) / 100,
            avg_downtime_per_incident: closed.length > 0 ? Math.round((totalDowntime / closed.length) * 100) / 100 : 0,
            mttr_active_wrench_minutes: closed.length > 0 ? Math.round((totalRepair / closed.length) * 100) / 100 : 0,
            avg_response_delay_minutes: closed.length > 0 ? Math.round((totalResponse / closed.length) * 100) / 100 : 0,
            planned_downtime_minutes: plannedMins,
            unplanned_downtime_minutes: unplannedMins,
            restored_machines_period: closed.length,
            sla_met_count: 2,
            sla_breached_count: 1,
          },
        ],
        rowCount: 1,
      };
    }

    // 2. Currently down machines count
    if (trimmed.includes('COUNT(DISTINCT m.id) as currently_down_count')) {
      const down = this.machines.filter((m) => ['breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification'].includes(m.status));
      return { rows: [{ currently_down_count: down.length }], rowCount: 1 };
    }

    // 3. Top 10 Pareto Machines
    if (trimmed.includes('FROM machines m') && trimmed.includes('ORDER BY total_downtime_minutes DESC')) {
      const rows = this.machines.map((m) => {
        const wos = this.workOrders.filter((w) => w.machine_id === m.id && w.status === 'verified_closed');
        const shop = this.shops.find((s) => s.id === m.shop_id);
        const plant = this.plants.find((p) => p.id === shop?.plant_id);
        const totalDt = wos.reduce((a, b) => a + b.total_downtime_minutes, 0);
        const avgRep = wos.length > 0 ? Math.round(wos.reduce((a, b) => a + b.active_repair_minutes, 0) / wos.length) : 0;
        return {
          id: m.id,
          machine_code: m.machine_code,
          name: m.name,
          shop_name: shop?.shop_name,
          plant_name: plant?.plant_name || 'JCB Pune Plant 1',
          criticality: m.criticality,
          failure_count: wos.length,
          total_downtime_minutes: totalDt,
          avg_repair_minutes: avgRep,
        };
      }).sort((a, b) => b.total_downtime_minutes - a.total_downtime_minutes).slice(0, 10);

      return { rows, rowCount: rows.length };
    }

    // 4. Category-wise Breakdown Distribution
    if (trimmed.includes('SELECT COALESCE(mr.issue_category, wo.fault_category, \'Unspecified\') as issue_category')) {
      return {
        rows: [
          { issue_category: 'Mechanical', count: 1, total_downtime_minutes: 240 },
          { issue_category: 'Hydraulic', count: 1, total_downtime_minutes: 150 },
          { issue_category: 'Lubrication', count: 1, total_downtime_minutes: 100 },
        ],
        rowCount: 3,
      };
    }

    // 5. Grand total downtime for Pareto contribution
    if (trimmed.includes('SELECT COALESCE(SUM(wo.total_downtime_minutes), 0) as grand_total_downtime')) {
      const closed = this.workOrders.filter((w) => w.status === 'verified_closed');
      const sum = closed.reduce((a, b) => a + b.total_downtime_minutes, 0);
      return { rows: [{ grand_total_downtime: sum }], rowCount: 1 };
    }

    // 6. Count distinct wo.id for records pagination
    if (trimmed.includes('SELECT COUNT(DISTINCT wo.id) as count FROM work_orders wo')) {
      let filtered = this.workOrders;
      if (params.includes('00000000-0000-0000-0000-000000000004')) {
        filtered = filtered.filter((w) => w.assigned_technician_id === '00000000-0000-0000-0000-000000000004');
      }
      return { rows: [{ count: filtered.length }], rowCount: 1 };
    }

    // 7. Records listing
    if (trimmed.includes('SELECT') && trimmed.includes('wo.id as work_order_id') && trimmed.includes('FROM work_orders wo')) {
      let filteredWos = this.workOrders;
      if (params.includes('00000000-0000-0000-0000-000000000004')) {
        filteredWos = filteredWos.filter((w) => w.assigned_technician_id === '00000000-0000-0000-0000-000000000004');
      }
      const rows = filteredWos.map((wo) => {
        const m = this.machines.find((x) => x.id === wo.machine_id)!;
        const s = this.shops.find((x) => x.id === m.shop_id)!;
        const p = this.plants.find((x) => x.id === s.plant_id)!;
        const mr = this.complaints.find((x) => x.id === wo.complaint_id);
        const tech = this.users.find((x) => x.id === wo.assigned_technician_id);
        const mgr = this.users.find((x) => x.id === wo.assigned_manager_id);

        return {
          work_order_id: wo.id,
          wo_number: wo.wo_number,
          work_order_status: wo.status,
          priority: wo.priority,
          classification: wo.classification,
          is_major_breakdown: wo.is_major_breakdown,
          machine_id: m.id,
          machine_code: m.machine_code,
          machine_name: m.name,
          machine_criticality: m.criticality,
          machine_current_status: m.status,
          shop_id: s.id,
          shop_name: s.shop_name,
          plant_id: p.id,
          plant_name: p.plant_name,
          complaint_id: mr?.id || null,
          complaint_number: mr?.complaint_number || null,
          issue_category: mr?.issue_category || wo.fault_category || 'General',
          problem_title: mr?.problem_title || wo.classification,
          breakdown_time: wo.breakdown_time || mr?.breakdown_occurred_at,
          reported_time: wo.reported_time || mr?.reported_at,
          manager_ack_time: wo.manager_ack_time,
          technician_assigned_time: wo.technician_assigned_time,
          arrival_time: wo.arrival_time,
          work_started_time: wo.work_started_time,
          repair_completed_time: wo.repair_completed_time,
          manager_verified_time: wo.manager_verified_time,
          machine_restored_time: wo.machine_restored_time,
          sla_deadline: wo.sla_deadline,
          downtime_duration_minutes: wo.status === 'verified_closed' ? wo.total_downtime_minutes : 240,
          active_repair_minutes: wo.active_repair_minutes,
          maintenance_response_minutes: wo.maintenance_response_minutes,
          incident_state: wo.status === 'verified_closed' ? 'completed' : 'ongoing',
          affected_component: wo.affected_component,
          root_cause_analysis: wo.root_cause_analysis,
          corrective_action: wo.corrective_action,
          assigned_technician_name: tech?.full_name,
          assigned_manager_name: mgr?.full_name,
        };
      });

      return { rows, rowCount: rows.length };
    }

    // 8. Single record details (by ID)
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.id = $1')) {
      const wo = this.workOrders.find((w) => w.id === params[0]);
      if (!wo) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === wo.machine_id)!;
      const s = this.shops.find((x) => x.id === m.shop_id)!;
      const p = this.plants.find((x) => x.id === s.plant_id)!;
      const mr = this.complaints.find((x) => x.id === wo.complaint_id);
      const tech = this.users.find((x) => x.id === wo.assigned_technician_id);
      const mgr = this.users.find((x) => x.id === wo.assigned_manager_id);

      return {
        rows: [
          {
            ...wo,
            machine_code: m.machine_code,
            machine_name: m.name,
            machine_category: m.category,
            machine_criticality: m.criticality,
            machine_current_status: m.status,
            bay_line_location: m.bay_line_location,
            shop_id: s.id,
            shop_name: s.shop_name,
            plant_id: p.id,
            plant_name: p.plant_name,
            complaint_number: mr?.complaint_number,
            problem_title: mr?.problem_title,
            complaint_description: mr?.description,
            issue_category: mr?.issue_category || wo.fault_category,
            breakdown_occurred_at: mr?.breakdown_occurred_at,
            shift: mr?.shift || 'Shift A',
            technician_name: tech?.full_name,
            technician_email: tech?.email,
            manager_name: mgr?.full_name,
          },
        ],
        rowCount: 1,
      };
    }

    // 9. Milestone events for single record
    if (trimmed.includes('FROM work_order_events we') && trimmed.includes('WHERE we.work_order_id = $1')) {
      const evs = this.events.filter((e) => e.work_order_id === params[0]);
      return { rows: evs, rowCount: evs.length };
    }

    // 10. Machine summary query (by machine ID)
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE m.id = $1')) {
      const m = this.machines.find((x) => x.id === params[0]);
      if (!m) return { rows: [], rowCount: 0 };
      const s = this.shops.find((x) => x.id === m.shop_id)!;
      const p = this.plants.find((x) => x.id === s.plant_id)!;

      return {
        rows: [
          {
            ...m,
            shop_id: s.id,
            shop_name: s.shop_name,
            plant_id: p.id,
            plant_name: p.plant_name,
          },
        ],
        rowCount: 1,
      };
    }

    // Technician assigned machine check
    if (trimmed.includes('FROM work_orders') && trimmed.includes('WHERE machine_id = $1 AND assigned_technician_id = $2')) {
      const match = this.workOrders.some((w) => w.machine_id === params[0] && w.assigned_technician_id === params[1]);
      return match ? { rows: [{ 1: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    // 11. Machine-specific downtime stats
    if (trimmed.includes('COUNT(DISTINCT wo.id) as total_incidents') && trimmed.includes('WHERE') && trimmed.includes('status = \'verified_closed\'')) {
      return {
        rows: [
          {
            total_incidents: 2,
            total_downtime_minutes: 250,
            avg_downtime_minutes: 125.0,
            mttr_active_repair_minutes: 75.0,
            avg_response_delay_minutes: 17.5,
          },
        ],
        rowCount: 1,
      };
    }

    // 12. Plant-level downtime aggregation
    if (trimmed.includes('SELECT') && trimmed.includes('p.id as plant_id') && trimmed.includes('FROM plants p')) {
      return {
        rows: [
          {
            plant_id: '10000000-0000-0000-0000-000000000001',
            plant_name: 'JCB Pune Plant 1',
            plant_code: 'PUNE-01',
            total_machines: 3,
            currently_down_machines: 2,
            total_breakdowns: 3,
            total_downtime_minutes: 490,
            avg_repair_minutes: 110.0,
          },
          {
            plant_id: '10000000-0000-0000-0000-000000000002',
            plant_name: 'JCB Ballabgarh Plant 2',
            plant_code: 'BLB-02',
            total_machines: 1,
            currently_down_machines: 0,
            total_breakdowns: 0,
            total_downtime_minutes: 0,
            avg_repair_minutes: 0,
          },
        ],
        rowCount: 2,
      };
    }

    // 13. Shop-level downtime aggregation
    if (trimmed.includes('SELECT') && trimmed.includes('s.id as shop_id') && trimmed.includes('FROM shops s')) {
      return {
        rows: [
          {
            shop_id: '20000000-0000-0000-0000-000000000001',
            shop_name: 'CNC Machining Shop',
            plant_name: 'JCB Pune Plant 1',
            total_machines: 2,
            currently_down_machines: 1,
            total_breakdowns: 2,
            total_downtime_minutes: 250,
            avg_repair_minutes: 75.0,
          },
          {
            shop_id: '20000000-0000-0000-0000-000000000002',
            shop_name: 'Fabrication Shop',
            plant_name: 'JCB Pune Plant 1',
            total_machines: 1,
            currently_down_machines: 1,
            total_breakdowns: 1,
            total_downtime_minutes: 240,
            avg_repair_minutes: 180.0,
          },
        ],
        rowCount: 2,
      };
    }

    // 14. Root Cause breakdown
    if (trimmed.includes('SELECT') && trimmed.includes('COALESCE(wo.affected_component, \'Unspecified Component\') as affected_component')) {
      return {
        rows: [
          {
            affected_component: 'Ram Seal Assembly',
            fault_category: 'Mechanical',
            occurrence_count: 1,
            total_downtime_minutes: 240,
            avg_repair_minutes: 180.0,
          },
          {
            affected_component: 'Hydraulic Pump Filter',
            fault_category: 'Hydraulic',
            occurrence_count: 1,
            total_downtime_minutes: 150,
            avg_repair_minutes: 90.0,
          },
        ],
        rowCount: 2,
      };
    }

    // 15. Planned vs Unplanned downtime breakdown
    if (trimmed.includes('CASE') && trimmed.includes('WHEN wo.classification = \'regular_maintenance\' THEN \'planned\'')) {
      return {
        rows: [
          {
            downtime_type: 'planned',
            event_count: 1,
            total_minutes: 100,
            avg_repair_minutes: 60.0,
          },
          {
            downtime_type: 'unplanned',
            event_count: 2,
            total_minutes: 390,
            avg_repair_minutes: 135.0,
          },
        ],
        rowCount: 2,
      };
    }

    // 16. SLA Performance calculation
    if (trimmed.includes('SELECT') && trimmed.includes('COUNT(wo.id) as total_work_orders_tracked') && trimmed.includes('on_time_resolutions')) {
      return {
        rows: [
          {
            total_work_orders_tracked: 3,
            avg_response_minutes: 18.33,
            avg_repair_minutes: 110.0,
            on_time_resolutions: 2,
            breached_resolutions: 1,
          },
        ],
        rowCount: 1,
      };
    }

    // 17. Current ongoing downtime list
    if (trimmed.includes('SELECT') && trimmed.includes('m.id as machine_id') && trimmed.includes('elapsed_downtime_minutes')) {
      return {
        rows: [
          {
            machine_id: '40000000-0000-0000-0000-000000000002',
            machine_code: 'CNC-002',
            name: 'Doosan Horizontal Lathe',
            machine_status: 'breakdown',
            criticality: 'class_b',
            bay_line_location: 'Bay 1, Line B',
            shop_id: '20000000-0000-0000-0000-000000000001',
            shop_name: 'CNC Machining Shop',
            plant_id: '10000000-0000-0000-0000-000000000001',
            plant_name: 'JCB Pune Plant 1',
            active_work_order_id: '60000000-0000-0000-0000-000000000004',
            wo_number: 'WO-2026-00004',
            work_order_status: 'under_diagnosis',
            priority: 'high',
            classification: 'minor_breakdown',
            sla_deadline: new Date('2026-11-05T12:00:00Z'),
            complaint_id: '50000000-0000-0000-0000-000000000003',
            complaint_number: 'CMP-2026-00003',
            issue_category: 'Electrical',
            problem_title: 'Spindle drive overload trip error code ALM-401',
            breakdown_start_time: new Date('2026-11-05T06:00:00Z'),
            elapsed_downtime_minutes: 240,
            assigned_technician_name: 'Senior Hydraulic Tech',
            last_lifecycle_update: new Date('2026-11-05T07:00:00Z'),
          },
        ],
        rowCount: 1,
      };
    }

    // 18. Trends query
    if (trimmed.includes('DATE_TRUNC(') && trimmed.includes('as period_date')) {
      return {
        rows: [
          {
            period_date: '2026-11-01T00:00:00.000Z',
            incident_count: 1,
            total_downtime_minutes: 150,
            avg_repair_minutes: 90.0,
            avg_response_minutes: 20.0,
          },
          {
            period_date: '2026-11-02T00:00:00.000Z',
            incident_count: 1,
            total_downtime_minutes: 240,
            avg_repair_minutes: 180.0,
            avg_response_minutes: 20.0,
          },
        ],
        rowCount: 2,
      };
    }

    // 19. MTTR overall query
    if (trimmed.includes('completed_repair_count') && trimmed.includes('active_wrench_mttr_minutes')) {
      return {
        rows: [
          {
            completed_repair_count: 3,
            active_wrench_mttr_minutes: 110.0,
            overall_stoppage_mttr_minutes: 163.33,
            avg_response_delay_minutes: 18.33,
          },
        ],
        rowCount: 1,
      };
    }

    // 20. MTBF query
    if (trimmed.includes('SELECT') && trimmed.includes('mtbf_operating_hours')) {
      const isPeriod = trimmed.includes('WHEN FALSE AND');
      return {
        rows: [
          {
            id: '40000000-0000-0000-0000-000000000001',
            machine_code: 'CNC-001',
            name: 'Mazak 5-Axis HMC 1',
            operating_hours: 1420.5,
            failure_count: 2,
            mtbf_operating_hours: isPeriod ? null : 710.25,
          },
          {
            id: '40000000-0000-0000-0000-000000000003',
            machine_code: 'PRS-1000',
            name: 'Schuler 1000T Hydraulic Press',
            operating_hours: 3200.0,
            failure_count: 1,
            mtbf_operating_hours: isPeriod ? null : 3200.0,
          },
        ],
        rowCount: 2,
      };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE: Module 5 — Downtime Analytics & Machine Availability
// ---------------------------------------------------------------------------
describe('Downtime Analytics & Machine Availability Module (CMMS Module 5)', () => {
  let mockDb: MockDowntimeDatabase;

  const adminUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000001',
    employee_code: 'EMP-ADM-01',
    email: 'admin@jcb.com',
    role: 'admin',
  };

  const puneManagerUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000002',
    employee_code: 'EMP-MGR-01',
    email: 'mgr.pune@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const blbManagerUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000003',
    employee_code: 'EMP-MGR-02',
    email: 'mgr.blb@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000002',
  };

  const tech1User: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-TEC-01',
    email: 'tech1@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const tech2User: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000005',
    employee_code: 'EMP-TEC-02',
    email: 'tech2@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000002',
  };

  const puneOperatorUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000006',
    employee_code: 'EMP-OPR-01',
    email: 'operator1@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001', // CNC Shop
  };

  beforeEach(() => {
    mockDb = new MockDowntimeDatabase();
    setDowntimeDb(mockDb);
  });

  // -------------------------------------------------------------------------
  // SECTION 1: Overall Summary Dashboard & Backward Compatibility
  // -------------------------------------------------------------------------
  describe('1. Overall Summary Dashboard & Backward Compatibility', () => {
    it('1. Root endpoint GET / returns summary metrics, Pareto machines, and category distribution', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.summary);
      assert.ok(res.responseData.data.paretoTopMachines);
      assert.ok(res.responseData.data.categoryDistribution);
    });

    it('2. Frontend contract compatibility: summary contains total_downtime_minutes, mttr_active_wrench_minutes, and avg_response_delay_minutes', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getDowntimeAnalytics(req, res, next);
      const summary = res.responseData.data.summary;
      assert.equal(typeof summary.total_downtime_minutes, 'number');
      assert.equal(typeof summary.mttr_active_wrench_minutes, 'number');
      assert.equal(typeof summary.avg_response_delay_minutes, 'number');
      assert.ok(summary.total_downtime_minutes >= 0);
    });

    it('3. Date range and dimensional filters are accepted on GET /', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        {
          start_date: '2026-11-01',
          end_date: '2026-11-05',
          priority: 'critical',
          issue_category: 'Mechanical',
        },
        {},
        puneManagerUser
      );

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
    });

    it('4. Data quality metadata indicates missing shift_schedules table for availability', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.responseData.data.kpis.availability_percentage, null);
      assert.equal(res.responseData.data.data_quality.availability_status, 'unavailable');
      assert.match(res.responseData.data.data_quality.availability_reason, /shift_schedules/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Machine Downtime Incident Records
  // -------------------------------------------------------------------------
  describe('2. Machine Downtime Records & Inspection', () => {
    it('5. GET /records returns paginated list of downtime incidents with timestamps and durations', async () => {
      const { req, res, next } = createMockContext({}, {}, { page: '1', limit: '10' }, {}, puneManagerUser);

      await getDowntimeRecords(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.pagination);
      assert.equal(res.responseData.pagination.page, 1);
    });

    it('6. GET /records/:id returns single incident details with milestone timeline and root cause', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.wo_number, 'WO-2026-00001');
      assert.equal(res.responseData.data.machine_code, 'CNC-001');
      assert.ok(Array.isArray(res.responseData.data.timeline_events));
    });

    it('7. GET /records/:id returns 404 for nonexistent incident ID', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-999999999999' },
        {},
        {},
        adminUser
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
    });

    it('8. Cross-plant access restriction: Manager cannot view records belonging to another plant (HTTP 403)', async () => {
      // Record 1 belongs to Pune plant; blbManagerUser is from Ballabgarh plant
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        blbManagerUser
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /another plant/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Machine-Specific Downtime & History
  // -------------------------------------------------------------------------
  describe('3. Machine-Specific Downtime & History', () => {
    it('9. GET /machines/:machineId returns machine metadata, cumulative downtime, and status', async () => {
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.machine.machine_code, 'CNC-001');
      assert.ok(res.responseData.data.metrics);
      assert.ok(res.responseData.data.metrics.total_downtime_minutes >= 0);
    });

    it('10. GET /machines/:machineId/history returns paginated historical incident timeline for machine', async () => {
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        { page: '1', limit: '5' },
        {},
        puneManagerUser
      );

      await getMachineDowntimeHistory(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });

    it('11. GET /machines/:machineId returns 404 for nonexistent machine', async () => {
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-999999999999' },
        {},
        {},
        adminUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 4: Availability, MTTR & MTBF Reliability Analytics
  // -------------------------------------------------------------------------
  describe('4. Availability, MTTR & MTBF Analytics', () => {
    it('12. GET /availability returns data-quality status explaining missing scheduled operating time denominator', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);

      await getMachineAvailability(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'unavailable');
      assert.match(res.responseData.data.reason, /shift_schedules/i);
      assert.ok(Array.isArray(res.responseData.data.records));
    });

    it('13. GET /mttr distinguishes active wrench repair time from overall stoppage duration', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getMTTRAnalytics(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.definitions.active_wrench_mttr);
      assert.ok(res.responseData.data.definitions.total_stoppage_mttr);
      assert.ok(res.responseData.data.overall);
      assert.ok(Array.isArray(res.responseData.data.by_machine));
    });

    it('14. GET /mtbf calculates MTBF using machines.operating_hours meter divided by failures', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);

      await getMTBFAnalytics(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data.records));

      const cnc1 = res.responseData.data.records.find((r: any) => r.machine_code === 'CNC-001');
      assert.ok(cnc1);
      assert.equal(cnc1.mtbf_operating_hours, 710.25); // 1420.5 hours / 2 failures
      assert.equal(res.responseData.data.data_quality.reliability, 'conditional');
      assert.match(res.responseData.data.data_quality.limitation, /Shared measurement baseline/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Pareto & Dimensional Breakdowns
  // -------------------------------------------------------------------------
  describe('5. Pareto 80/20 & Dimensional Breakdowns', () => {
    it('15. GET /by-machine returns Pareto 80/20 sorted by total downtime with contribution percentage', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getParetoMachines(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data[0].downtime_contribution_percent !== undefined);
    });

    it('16. GET /by-plant aggregates total downtime, failure count, and currently down machines by plant', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, adminUser);

      await getDowntimeByPlant(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.length >= 2);
    });

    it('17. GET /by-shop aggregates downtime metrics across production shops', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getDowntimeByShop(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });

    it('18. GET /by-category groups downtime and breakdown frequency by issue category', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getDowntimeByCategory(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });

    it('19. GET /by-cause aggregates root causes and affected components', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getDowntimeByCause(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });

    it('20. GET /trends returns time-series trends grouped by daily/weekly/monthly periods', async () => {
      const { req, res, next } = createMockContext({}, {}, { period: 'daily' }, {}, puneManagerUser);

      await getDowntimeTrends(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Planned vs Unplanned, SLA Performance & Current Incidents
  // -------------------------------------------------------------------------
  describe('6. Planned vs Unplanned, SLA & Current Monitoring', () => {
    it('21. GET /planned-vs-unplanned distinguishes preventive maintenance from unexpected breakdowns', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getPlannedVsUnplanned(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.planned);
      assert.ok(res.responseData.data.unplanned);
      assert.equal(res.responseData.data.planned.total_minutes, 100);
      assert.equal(res.responseData.data.unplanned.total_minutes, 390);
    });

    it('22. GET /sla calculates response delay, resolution SLA compliance, and breach counts', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getSlaPerformance(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.summary);
      assert.equal(res.responseData.data.summary.on_time_resolutions, 2);
      assert.equal(res.responseData.data.summary.breached_resolutions, 1);
      assert.equal(res.responseData.data.summary.sla_compliance_rate_percent, 66.7);
    });

    it('23. GET /current monitors currently ongoing machine stoppages with elapsed downtime calculation', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getCurrentDowntime(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));

      const ongoing = res.responseData.data[0];
      assert.ok(ongoing);
      assert.equal(ongoing.machine_code, 'CNC-002');
      assert.equal(ongoing.machine_status, 'breakdown');
      assert.ok(ongoing.elapsed_downtime_minutes > 0);
      assert.ok(ongoing.data_quality_flags.has_active_work_order);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 7: Security, Input Validation & Defensive Handling
  // -------------------------------------------------------------------------
  describe('7. Security, Validation & Defensive Query Rules', () => {
    it('24. Invalid date range (start_date > end_date) returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { start_date: '2026-11-10', end_date: '2026-11-01' },
        {},
        puneManagerUser
      );

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /start_date cannot be later than end_date/i);
    });

    it('25. Malformed date string returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { start_date: 'invalid-date-string' },
        {},
        puneManagerUser
      );

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Invalid start_date format/i);
    });

    it('26. Malformed machine UUID returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        {},
        { machineId: 'not-a-valid-uuid' },
        {},
        {},
        puneManagerUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Invalid machine ID format/i);
    });

    it('27. Cross-plant access attempt via query param plant_id is rejected with HTTP 403 Forbidden', async () => {
      // puneManagerUser attempting to query Ballabgarh plant_id
      const { req, res, next } = createMockContext(
        {},
        {},
        { plant_id: '10000000-0000-0000-0000-000000000002' },
        {},
        puneManagerUser
      );

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Cannot view downtime data for another plant/i);
    });

    it('28. Unauthenticated requests without req.user return HTTP 401 Unauthorized', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, undefined);

      await getDowntimeAnalytics(req, res, next);
      assert.equal(res.statusCode, 401);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Authentication required/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 8: Strict Role-Based Scoping & MTBF Observation Period Verification
  // -------------------------------------------------------------------------
  describe('8. Role-Based Scoping, Cross-Entity Isolation & MTBF Observation Period', () => {
    it('29. MTBF date range filter: sets mtbf_operating_hours to null with unavailable status (no lifetime hours division)', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { start_date: '2026-11-01', end_date: '2026-11-05' },
        {},
        adminUser
      );

      await getMTBFAnalytics(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'unavailable');
      assert.match(res.responseData.data.calculation_basis, /Period-specific MTBF is unavailable/i);
      assert.equal(res.responseData.data.data_quality.reliability, 'unavailable');
      assert.match(res.responseData.data.data_quality.limitation, /Period-specific MTBF cannot be computed/i);

      for (const rec of res.responseData.data.records) {
        assert.equal(rec.mtbf_operating_hours, null);
        assert.match(rec.data_quality_note, /Period-specific MTBF unavailable/i);
      }
    });

    it('30. Operator access: Operator can access machine summary in their assigned shop (HTTP 200)', async () => {
      // Machine 1 is in Pune CNC shop, matching puneOperatorUser
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneOperatorUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.machine.machine_code, 'CNC-001');
    });

    it('31. Operator access restriction: Operator cannot view machine summary for another shop (HTTP 403)', async () => {
      // Machine 3 is in Fabrication shop; puneOperatorUser is in CNC shop
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000003' },
        {},
        {},
        puneOperatorUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /another shop outside your assigned scope/i);
    });

    it('32. Operator access restriction: Operator cannot view machine history for another shop (HTTP 403)', async () => {
      // Machine 3 is in Fabrication shop; puneOperatorUser is in CNC shop
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000003' },
        {},
        {},
        puneOperatorUser
      );

      await getMachineDowntimeHistory(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /another shop outside your assigned scope/i);
    });

    it('33. Operator access restriction: Operator cannot view incident details for machine in another shop (HTTP 403)', async () => {
      // Record 2 (WO-2026-00002) is on Machine 3 in Fabrication shop
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        puneOperatorUser
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /another shop outside your authorized scope/i);
    });

    it('34. Operator access restriction: Operator cannot filter incident records by machine in another shop (HTTP 403)', async () => {
      // puneOperatorUser attempting to filter by Machine 3 (Fabrication shop)
      const { req, res, next } = createMockContext(
        {},
        {},
        { machine_id: '40000000-0000-0000-0000-000000000003' },
        {},
        puneOperatorUser
      );

      await getDowntimeRecords(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /another shop outside your assigned scope/i);
    });

    it('35. Technician access: Technician can view details of work order assigned to them (HTTP 200)', async () => {
      // Record 1 (WO-2026-00001) is assigned to tech1User
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1User
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.wo_number, 'WO-2026-00001');
    });

    it('36. Technician access restriction: Technician cannot view details of work order assigned to another technician (HTTP 403)', async () => {
      // Record 5 (WO-2026-00005) is assigned to tech2User
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000005' },
        {},
        {},
        tech1User
      );

      await getDowntimeRecordDetails(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /assigned to another technician/i);
    });

    it('37. Technician access restriction: GET /records only returns work orders assigned to the requesting technician', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, tech1User);

      await getDowntimeRecords(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      for (const row of res.responseData.data) {
        assert.equal(row.assigned_technician_name, 'Senior Hydraulic Tech');
      }
    });

    it('38. Manager cross-plant isolation: Manager cannot view machine summary of another plant (HTTP 403)', async () => {
      // Machine 4 is in Ballabgarh plant; puneManagerUser belongs to Pune plant
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000004' },
        {},
        {},
        puneManagerUser
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /belongs to another plant/i);
    });

    it('39. Manager cross-plant isolation: Manager cannot view machine history of another plant (HTTP 403)', async () => {
      // Machine 4 is in Ballabgarh plant; puneManagerUser belongs to Pune plant
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000004' },
        {},
        {},
        puneManagerUser
      );

      await getMachineDowntimeHistory(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /belongs to another plant/i);
    });

    it('40. Technician access: Technician can view machine summary for an assigned machine (HTTP 200)', async () => {
      // Machine 1 has work orders WO-2026-00001 and WO-2026-00003 assigned to tech1User
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1User
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.machine.machine_code, 'CNC-001');
    });

    it('41. Technician access: Technician can view machine history for an assigned machine (HTTP 200)', async () => {
      // Machine 1 has work orders assigned to tech1User
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1User
      );

      await getMachineDowntimeHistory(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
    });

    it('42. Technician access restriction: Technician cannot view machine summary for an unassigned machine via URL tampering (HTTP 403)', async () => {
      // Machine 3 is in Fabrication shop (matching tech2User's shop), but has NO work orders assigned to tech2User
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000003' },
        {},
        {},
        tech2User
      );

      await getMachineDowntimeSummary(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /not assigned to maintenance tasks on this machine/i);
    });

    it('43. Technician access restriction: Technician cannot view machine history for an unassigned machine via URL tampering (HTTP 403)', async () => {
      // Machine 3 is in Fabrication shop (matching tech2User's shop), but has NO work orders assigned to tech2User
      const { req, res, next } = createMockContext(
        {},
        { machineId: '40000000-0000-0000-0000-000000000003' },
        {},
        {},
        tech2User
      );

      await getMachineDowntimeHistory(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /not assigned to maintenance tasks on this machine/i);
    });

    it('44. Technician access restriction: Technician cannot filter incident records by an unassigned machine (HTTP 403)', async () => {
      // tech2User attempting to filter incident records by Machine 3 (which they are not assigned to)
      const { req, res, next } = createMockContext(
        {},
        {},
        { machine_id: '40000000-0000-0000-0000-000000000003' },
        {},
        tech2User
      );

      await getDowntimeRecords(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /not assigned to maintenance tasks on this machine/i);
    });
  });
});
