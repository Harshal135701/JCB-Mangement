/**
 * JCB Smart Machine Maintenance Management System (CMMS)
 * Machines Module - Comprehensive Unit & Integration Test Suite
 * Fully implements all 20 enterprise CMMS testing requirements.
 */

// Set mock test environment variables before module imports
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
  getMachines,
  getMachineByQR,
  getMachineById,
  getMachineHistory,
  createMachine,
  updateMachine,
  deleteMachine,
  setMachinesDb,
  resetMachinesDb,
} from './machines.controller';
import { MachineRow } from './machines.repository';
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
 * Mock Database Implementation for Machines Module
 */
class MockMachinesDatabase {
  public plants: Map<string, any> = new Map();
  public shops: Map<string, any> = new Map();
  public bays: Map<string, any> = new Map();
  public production_lines: Map<string, any> = new Map();
  public machines: Map<string, MachineRow> = new Map();
  public maintenance_requests: any[] = [];
  public work_orders: any[] = [];
  public pm_plans: any[] = [];
  public inspection_records: any[] = [];
  public purchase_requisitions: any[] = [];
  public rdc_challans: any[] = [];
  public wo_parts_consumed: any[] = [];
  public spare_parts: any[] = [];
  public users: any[] = [];
  public audit_logs: any[] = [];
  public failQueryPattern: string | null = null;
  private snapshotMachines: Map<string, MachineRow> | null = null;
  private snapshotAuditLogs: any[] | null = null;

  constructor() {
    this.seed();
  }

  seed() {
    this.failQueryPattern = null;
    this.snapshotMachines = null;
    this.snapshotAuditLogs = null;
    this.plants.clear();
    this.shops.clear();
    this.bays.clear();
    this.production_lines.clear();
    this.machines.clear();
    this.maintenance_requests = [];
    this.work_orders = [];
    this.pm_plans = [];
    this.inspection_records = [];
    this.purchase_requisitions = [];
    this.rdc_challans = [];
    this.wo_parts_consumed = [];
    this.spare_parts = [];
    this.users = [];
    this.audit_logs = [];

    // Plants
    const p1 = {
      id: 'b0000000-0000-0000-0000-000000000001',
      plant_code: 'PLANT-BALLABGARH',
      plant_name: 'JCB Ballabgarh Works',
    };
    const p2 = {
      id: 'b0000000-0000-0000-0000-000000000002',
      plant_code: 'PLANT-PUNE',
      plant_name: 'JCB Pune Manufacturing Plant',
    };
    this.plants.set(p1.id, p1);
    this.plants.set(p2.id, p2);

    // Shops
    const s1 = {
      id: 'c0000000-0000-0000-0000-000000000001',
      plant_id: p1.id,
      shop_code: 'SHOP-CNC',
      shop_name: 'CNC Machining Shop',
    };
    const s2 = {
      id: 'c0000000-0000-0000-0000-000000000002',
      plant_id: p1.id,
      shop_code: 'SHOP-ROB',
      shop_name: 'Robotic Welding Shop',
    };
    const s3 = {
      id: 'c0000000-0000-0000-0000-000000000003',
      plant_id: p2.id,
      shop_code: 'SHOP-PUN-FAB',
      shop_name: 'Pune Fabrication Shop',
    };
    this.shops.set(s1.id, s1);
    this.shops.set(s2.id, s2);
    this.shops.set(s3.id, s3);

    // Bays & Lines
    const bay1 = { id: 'd0000000-0000-0000-0000-000000000001', shop_id: s1.id, bay_name: 'Machining Bay 1', bay_code: 'BAY-M1' };
    this.bays.set(bay1.id, bay1);

    const line1 = { id: 'e0000000-0000-0000-0000-000000000001', shop_id: s1.id, line_name: 'Line 4 Transmission', line_code: 'LINE-4' };
    this.production_lines.set(line1.id, line1);

    // Machines
    const m1: MachineRow = {
      id: '10000000-0000-0000-0000-000000000001',
      shop_id: s1.id,
      machine_code: 'CNC-001',
      name: 'Mazak Horizontal Machining Center 1',
      category: 'HMC',
      oem_manufacturer: 'Mazak',
      model_number: 'HCN-6800 NEO',
      serial_number: 'MZK-2023-8991',
      bay_line_location: 'Bay 1 / Line 4',
      bay_id: bay1.id,
      production_line_id: line1.id,
      criticality: 'class_a',
      status: 'under_maintenance',
      operating_hours: 4320.5,
      maintenance_frequency_days: 30,
      qr_code_uid: 'QR-JCB-CNC-001-UID',
      manual_url: 'https://docs.jcb.local/manuals/cnc-001.pdf',
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: 'Critical transmission milling center',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z'),
    };

    const m2: MachineRow = {
      id: '10000000-0000-0000-0000-000000000002',
      shop_id: s1.id,
      machine_code: 'ROB-012',
      name: 'Fanuc 6-Axis Robotic Welding Station',
      category: 'Robotic Welder',
      oem_manufacturer: 'Fanuc',
      model_number: 'ARC Mate 120iD',
      serial_number: 'FNC-9912-3341',
      bay_line_location: 'Bay 2 / Line ROB-1',
      bay_id: null,
      production_line_id: null,
      criticality: 'class_a',
      status: 'running',
      operating_hours: 6140.0,
      maintenance_frequency_days: 15,
      qr_code_uid: 'QR-JCB-ROB-012-UID',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: null,
      created_at: new Date('2026-01-02T00:00:00Z'),
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };

    const m3: MachineRow = {
      id: '10000000-0000-0000-0000-000000000003',
      shop_id: s3.id,
      machine_code: 'PUN-PRESS-01',
      name: 'Schuler 1000T Hydraulic Forming Press',
      category: 'Press',
      oem_manufacturer: 'Schuler',
      model_number: 'HP-1000-ECO',
      serial_number: 'SCH-1000-091',
      bay_line_location: 'Cutting Bay 3',
      bay_id: null,
      production_line_id: null,
      criticality: 'class_b',
      status: 'running',
      operating_hours: 11200.0,
      maintenance_frequency_days: 60,
      qr_code_uid: 'QR-JCB-CUT-001-UID',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: null,
      created_at: new Date('2026-01-03T00:00:00Z'),
      updated_at: new Date('2026-01-03T00:00:00Z'),
    };

    const mDecom: MachineRow = {
      id: '10000000-0000-0000-0000-000000000004',
      shop_id: s1.id,
      machine_code: 'OLD-LATHE-01',
      name: 'Legacy Manual Engine Lathe',
      category: 'Lathe',
      oem_manufacturer: 'HMT',
      model_number: 'LT-20',
      serial_number: 'HMT-1998-001',
      bay_line_location: 'Scrap Bay',
      bay_id: null,
      production_line_id: null,
      criticality: 'class_c',
      status: 'decommissioned',
      operating_hours: 32000.0,
      maintenance_frequency_days: 90,
      qr_code_uid: 'QR-JCB-OLD-LATHE-UID',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: 'Decommissioned lathe',
      created_at: new Date('2026-01-04T00:00:00Z'),
      updated_at: new Date('2026-01-04T00:00:00Z'),
    };

    this.machines.set(m1.id, m1);
    this.machines.set(m2.id, m2);
    this.machines.set(m3.id, m3);
    this.machines.set(mDecom.id, mDecom);

    // Users
    this.users.push(
      { id: 'u0000000-0000-0000-0000-000000000001', full_name: 'Rajesh Sharma', employee_code: 'EMP-ADM-001' },
      { id: 'u0000000-0000-0000-0000-000000000002', full_name: 'Vikas Verma', employee_code: 'EMP-MGR-001' },
      { id: 'u0000000-0000-0000-0000-000000000003', full_name: 'Sunil Yadav', employee_code: 'EMP-TCH-001' }
    );

    // Maintenance requests (Complaints) on m1
    this.maintenance_requests.push({
      id: 'mr000000-0000-0000-0000-000000000001',
      complaint_number: 'CMP-2026-00001',
      machine_id: m1.id,
      reported_by_id: 'u0000000-0000-0000-0000-000000000001',
      shift: 'Shift A',
      issue_category: 'hydraulic',
      priority: 'high',
      status: 'work_order_created',
      breakdown_occurred_at: new Date('2026-02-01T10:00:00Z'),
      reported_at: new Date('2026-02-01T10:15:00Z'),
      hour_meter_reading: 4320.5,
      problem_title: 'Spindle hydraulic pressure loss',
      description: 'Loss of clamping pressure during milling pass',
      created_at: new Date('2026-02-01T10:15:00Z'),
    });

    // Work Orders on m1
    this.work_orders.push({
      id: 'wo000000-0000-0000-0000-000000000001',
      wo_number: 'WO-2026-00001',
      complaint_id: 'mr000000-0000-0000-0000-000000000001',
      machine_id: m1.id,
      assigned_technician_id: 'u0000000-0000-0000-0000-000000000003',
      assigned_manager_id: 'u0000000-0000-0000-0000-000000000002',
      status: 'in_progress',
      priority: 'high',
      classification: 'minor_breakdown',
      is_major_breakdown: false,
      breakdown_time: new Date('2026-02-01T10:00:00Z'),
      reported_time: new Date('2026-02-01T10:15:00Z'),
      work_started_time: new Date('2026-02-01T11:00:00Z'),
      repair_completed_time: null,
      machine_restored_time: null,
      total_downtime_minutes: 0,
      active_repair_minutes: 0,
      maintenance_response_minutes: 45,
      labour_hours: 2.0,
      diagnosis: 'Hydraulic solenoid valve sticking',
      root_cause_analysis: 'Contaminated hydraulic oil',
      corrective_action: 'Replace solenoid and clean filter',
      created_at: new Date('2026-02-01T10:30:00Z'),
    });

    // Inspections on m1
    this.inspection_records.push({
      id: 'ir000000-0000-0000-0000-000000000001',
      machine_id: m1.id,
      operator_id: 'u0000000-0000-0000-0000-000000000001',
      shift: 'Shift A',
      overall_status: 'pass',
      temperature: 42.5,
      pressure: 6.2,
      vibration: 0.8,
      created_at: new Date('2026-02-01T08:00:00Z'),
    });

    // PM Plans on m1
    this.pm_plans.push({
      id: 'pm000000-0000-0000-0000-000000000001',
      plan_code: 'PM-CNC-M01',
      machine_id: m1.id,
      title: 'Monthly CNC Spindle & Hydraulic Service',
      frequency: 'monthly',
      interval_days: 30,
      operating_hour_threshold: 4500,
      last_pm_date: new Date('2026-01-05'),
      next_pm_date: new Date('2026-02-05'),
      grace_period_days: 3,
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });

    // Spare Parts
    this.spare_parts.push({
      id: 'sp000000-0000-0000-0000-000000000001',
      part_number: 'HYD-SOL-01',
      name: 'Rexroth Hydraulic Directional Valve',
    });

    // WO Parts Consumed on m1
    this.wo_parts_consumed.push({
      id: 'wpc00000-0000-0000-0000-000000000001',
      work_order_id: 'wo000000-0000-0000-0000-000000000001',
      part_id: 'sp000000-0000-0000-0000-000000000001',
      quantity_requested: 1,
      quantity_issued: 1,
      quantity_installed: 1,
      serial_number_installed: 'RX-99120',
      serial_number_removed: 'RX-88011',
      removed_part_disposition: 'quarantine',
      created_at: new Date('2026-02-01T12:00:00Z'),
    });

    // Purchase Requisitions on m1
    this.purchase_requisitions.push({
      id: 'pr000000-0000-0000-0000-000000000001',
      pr_number: 'PR-2026-00001',
      work_order_id: 'wo000000-0000-0000-0000-000000000001',
      machine_id: m1.id,
      part_id: 'sp000000-0000-0000-0000-000000000001',
      quantity_required: 2,
      urgency: 'high',
      technical_justification: 'Replacement hydraulic solenoid valve',
      status: 'approved',
      requested_by: 'u0000000-0000-0000-0000-000000000003',
      approved_by: 'u0000000-0000-0000-0000-000000000002',
      po_number: 'PO-2026-8812',
      supplier_name: 'Rexroth Bosch India',
      unit_price: 14500.0,
      expected_delivery_date: new Date('2026-02-15'),
      received_date: null,
      created_at: new Date('2026-02-02T10:00:00Z'),
      updated_at: new Date('2026-02-02T10:00:00Z'),
    });

    // RDC Challans on m1
    this.rdc_challans.push({
      id: 'rdc00000-0000-0000-0000-000000000001',
      challan_number: 'RDC-2026-00001',
      rdc_type: 'RDC',
      work_order_id: 'wo000000-0000-0000-0000-000000000001',
      machine_id: m1.id,
      vendor_party_name: 'Rexroth Service Center Faridabad',
      vendor_gstin: '06AAACR1234F1Z5',
      vendor_address: 'Plot 12, Industrial Area, Faridabad',
      contact_person: 'Anil Kumar',
      purpose: 'Hydraulic solenoid testing and bench calibration',
      dispatch_date: new Date('2026-02-03'),
      expected_return_date: new Date('2026-02-10'),
      actual_return_date: null,
      status: 'dispatched',
      gate_pass_number: 'GP-2026-0089',
      created_by: 'u0000000-0000-0000-0000-000000000003',
      approved_by: 'u0000000-0000-0000-0000-000000000002',
      created_at: new Date('2026-02-03T11:00:00Z'),
      updated_at: new Date('2026-02-03T11:00:00Z'),
    });

    // Initial audit log on m1
    this.audit_logs.push({
      id: 'aud-seed-001',
      entity_name: 'machines',
      entity_id: m1.id,
      action: 'MACHINE_CREATED',
      performed_by: 'u0000000-0000-0000-0000-000000000001',
      old_values: null,
      new_values: { machine_code: 'CNC-001', name: m1.name },
      ip_address: '127.0.0.1',
      created_at: new Date('2026-01-01T00:00:00Z'),
    });
  }

  enrichMachine(m: MachineRow) {
    const s = this.shops.get(m.shop_id);
    const p = s ? this.plants.get(s.plant_id) : undefined;
    const b = m.bay_id ? this.bays.get(m.bay_id) : undefined;
    const pl = m.production_line_id ? this.production_lines.get(m.production_line_id) : undefined;
    return {
      ...m,
      shop_name: s?.shop_name,
      shop_code: s?.shop_code,
      plant_id: s?.plant_id,
      plant_name: p?.plant_name,
      plant_code: p?.plant_code,
      bay_name: b?.bay_name || null,
      bay_code: b?.bay_code || null,
      line_name: pl?.line_name || null,
      line_code: pl?.line_code || null,
    };
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();
    const normalized = trimmed.replace(/\s+/g, ' ');

    if (this.failQueryPattern && text.includes(this.failQueryPattern)) {
      this.failQueryPattern = null;
      throw new Error(`Simulated database failure for query matching: ${text}`);
    }

    // 1. Transaction commands with rollback snapshot simulation
    if (trimmed === 'BEGIN') {
      this.snapshotMachines = new Map(
        Array.from(this.machines.entries()).map(([k, v]) => [k, { ...v }])
      );
      this.snapshotAuditLogs = [...this.audit_logs];
      return { rows: [], rowCount: 0 };
    }
    if (trimmed === 'ROLLBACK') {
      if (this.snapshotMachines) {
        this.machines = this.snapshotMachines;
        this.snapshotMachines = null;
      }
      if (this.snapshotAuditLogs) {
        this.audit_logs = this.snapshotAuditLogs;
        this.snapshotAuditLogs = null;
      }
      return { rows: [], rowCount: 0 };
    }
    if (trimmed === 'COMMIT') {
      this.snapshotMachines = null;
      this.snapshotAuditLogs = null;
      return { rows: [], rowCount: 0 };
    }

    // 2. Audit logs INSERT
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const log = {
        id: `aud-${this.audit_logs.length + 1}`,
        entity_name: params[0],
        entity_id: params[1],
        action: params[2],
        performed_by: params[3],
        old_values: params[4] ? JSON.parse(params[4]) : null,
        new_values: params[5] ? JSON.parse(params[5]) : null,
        ip_address: params[6],
        created_at: new Date(),
      };
      this.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // 3. Verify Shop
    if (trimmed.includes('FROM shops s') && trimmed.includes('JOIN plants p ON s.plant_id = p.id') && trimmed.includes('WHERE s.id = $1')) {
      const s = this.shops.get(params[0]);
      if (!s) return { rows: [], rowCount: 0 };
      const p = this.plants.get(s.plant_id);
      return {
        rows: [{ id: s.id, shop_name: s.shop_name, shop_code: s.shop_code, plant_id: s.plant_id, plant_name: p?.plant_name }],
        rowCount: 1,
      };
    }

    // 4. Verify Bay
    if (trimmed.startsWith('SELECT id, bay_name, shop_id FROM bays')) {
      const bay = this.bays.get(params[0]);
      if (bay && bay.shop_id === params[1]) {
        return { rows: [bay], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 5. Verify Production Line
    if (trimmed.startsWith('SELECT id, line_name, shop_id FROM production_lines')) {
      const line = this.production_lines.get(params[0]);
      if (line && line.shop_id === params[1]) {
        return { rows: [line], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 6. Check Active Workflows
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes("status NOT IN ('rejected', 'closed')")) {
      const activeCount = this.maintenance_requests.filter(
        (r) => r.machine_id === params[0] && r.status !== 'rejected' && r.status !== 'closed'
      ).length;
      return { rows: [{ count: String(activeCount) }], rowCount: 1 };
    }

    if (trimmed.includes('FROM work_orders') && trimmed.includes("status NOT IN ('completed', 'verified_closed')")) {
      const activeCount = this.work_orders.filter(
        (w) => w.machine_id === params[0] && w.status !== 'completed' && w.status !== 'verified_closed'
      ).length;
      return { rows: [{ count: String(activeCount) }], rowCount: 1 };
    }

    // 7. Check Historical References
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM work_orders WHERE machine_id = $1')) {
      const count = this.work_orders.filter((w) => w.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM maintenance_requests WHERE machine_id = $1')) {
      const count = this.maintenance_requests.filter((r) => r.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM pm_plans WHERE machine_id = $1')) {
      const count = this.pm_plans.filter((p) => p.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM inspection_records WHERE machine_id = $1')) {
      const count = this.inspection_records.filter((i) => i.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM purchase_requisitions WHERE machine_id = $1')) {
      const count = this.purchase_requisitions.filter((pr) => pr.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }
    if (trimmed.startsWith('SELECT COUNT(*) AS count FROM rdc_challans WHERE machine_id = $1')) {
      const count = this.rdc_challans.filter((r) => r.machine_id === params[0]).length;
      return { rows: [{ count: String(count) }], rowCount: 1 };
    }

    // 8. Find by ID
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE m.id = $1')) {
      const m = this.machines.get(params[0]);
      if (!m) return { rows: [], rowCount: 0 };
      return { rows: [this.enrichMachine(m)], rowCount: 1 };
    }

    // 9. Find by QR UID or Machine Code (Backward Compatibility)
    if (
      trimmed.includes('FROM machines m') &&
      trimmed.includes('WHERE m.qr_code_uid = $1 OR LOWER(m.machine_code) = LOWER($1)')
    ) {
      const searchVal = String(params[0] || '').toLowerCase();
      let m = Array.from(this.machines.values()).find((item) => item.qr_code_uid === params[0]);
      if (!m) {
        m = Array.from(this.machines.values()).find((item) => item.machine_code.toLowerCase() === searchVal);
      }
      if (!m) return { rows: [], rowCount: 0 };
      return { rows: [this.enrichMachine(m)], rowCount: 1 };
    }

    // 9B. Find by exact QR UID
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE m.qr_code_uid = $1')) {
      const m = Array.from(this.machines.values()).find((item) => item.qr_code_uid === params[0]);
      if (!m) return { rows: [], rowCount: 0 };
      return { rows: [this.enrichMachine(m)], rowCount: 1 };
    }

    // 10. Find by Code
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE LOWER(m.machine_code) = LOWER($1)')) {
      const m = Array.from(this.machines.values()).find(
        (item) => item.machine_code.toLowerCase() === params[0].toLowerCase()
      );
      if (!m) return { rows: [], rowCount: 0 };
      return { rows: [this.enrichMachine(m)], rowCount: 1 };
    }

    // 11. Find by Serial Number
    if (trimmed.includes('FROM machines') && trimmed.includes('LOWER(serial_number) = LOWER($1)')) {
      const m = Array.from(this.machines.values()).find(
        (item) => item.serial_number && item.serial_number.toLowerCase() === params[0].toLowerCase() && (params[1] ? item.id !== params[1] : true)
      );
      if (!m) return { rows: [], rowCount: 0 };
      return { rows: [m], rowCount: 1 };
    }

    // 12. List Machines & Count
    if (trimmed.includes('SELECT COUNT(*) AS total') && trimmed.includes('FROM machines m')) {
      let filtered = Array.from(this.machines.values()).map((m) => this.enrichMachine(m));

      let pIdx = 0;
      if (trimmed.includes('s.plant_id = $')) {
        const plantId = params[pIdx++];
        filtered = filtered.filter((m) => m.plant_id === plantId);
      }
      if (trimmed.includes('m.shop_id = $')) {
        const shopId = params[pIdx++];
        filtered = filtered.filter((m) => m.shop_id === shopId);
      }
      if (trimmed.includes('LOWER(m.category) = LOWER($')) {
        const cat = params[pIdx++];
        filtered = filtered.filter((m) => m.category.toLowerCase() === cat.toLowerCase());
      }
      if (trimmed.includes('m.criticality = $')) {
        const crit = params[pIdx++];
        filtered = filtered.filter((m) => m.criticality === crit);
      }
      if (trimmed.includes('m.status = $')) {
        const stat = params[pIdx++];
        filtered = filtered.filter((m) => m.status === stat);
      } else if (trimmed.includes("m.status != 'decommissioned'")) {
        filtered = filtered.filter((m) => m.status !== 'decommissioned');
      }
      if (trimmed.includes('ILIKE $')) {
        const search = params[pIdx++].replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.machine_code.toLowerCase().includes(search) ||
            m.name.toLowerCase().includes(search) ||
            (m.serial_number && m.serial_number.toLowerCase().includes(search)) ||
            (m.model_number && m.model_number.toLowerCase().includes(search))
        );
      }

      return { rows: [{ total: String(filtered.length) }], rowCount: 1 };
    }

    if (trimmed.includes('SELECT') && trimmed.includes('FROM machines m') && trimmed.includes('ORDER BY')) {
      let filtered = Array.from(this.machines.values()).map((m) => this.enrichMachine(m));

      let pIdx = 0;
      if (trimmed.includes('s.plant_id = $')) {
        const plantId = params[pIdx++];
        filtered = filtered.filter((m) => m.plant_id === plantId);
      }
      if (trimmed.includes('m.shop_id = $')) {
        const shopId = params[pIdx++];
        filtered = filtered.filter((m) => m.shop_id === shopId);
      }
      if (trimmed.includes('LOWER(m.category) = LOWER($')) {
        const cat = params[pIdx++];
        filtered = filtered.filter((m) => m.category.toLowerCase() === cat.toLowerCase());
      }
      if (trimmed.includes('m.criticality = $')) {
        const crit = params[pIdx++];
        filtered = filtered.filter((m) => m.criticality === crit);
      }
      if (trimmed.includes('m.status = $')) {
        const stat = params[pIdx++];
        filtered = filtered.filter((m) => m.status === stat);
      } else if (trimmed.includes("m.status != 'decommissioned'")) {
        filtered = filtered.filter((m) => m.status !== 'decommissioned');
      }
      if (trimmed.includes('ILIKE $')) {
        const search = params[pIdx++].replace(/%/g, '').toLowerCase();
        filtered = filtered.filter(
          (m) =>
            m.machine_code.toLowerCase().includes(search) ||
            m.name.toLowerCase().includes(search) ||
            (m.serial_number && m.serial_number.toLowerCase().includes(search)) ||
            (m.model_number && m.model_number.toLowerCase().includes(search))
        );
      }

      // Sorting
      if (trimmed.includes('m.created_at DESC')) {
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      } else {
        filtered.sort((a, b) => a.machine_code.localeCompare(b.machine_code));
      }

      const limit = params[params.length - 2];
      const offset = params[params.length - 1];

      const rows = filtered.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    // 13. Insert Machine
    if (trimmed.startsWith('INSERT INTO machines')) {
      const newMachine: MachineRow = {
        id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        shop_id: params[0],
        machine_code: params[1],
        name: params[2],
        category: params[3],
        oem_manufacturer: params[4],
        model_number: params[5],
        serial_number: params[6],
        bay_line_location: params[7],
        bay_id: params[8],
        production_line_id: params[9],
        criticality: params[10],
        status: params[11],
        operating_hours: params[12],
        maintenance_frequency_days: params[13],
        qr_code_uid: params[14],
        manual_url: params[15],
        electrical_diagram_url: params[16],
        hydraulic_schematic_url: params[17],
        sop_document_url: params[18],
        description: params[19],
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.machines.set(newMachine.id, newMachine);
      return { rows: [newMachine], rowCount: 1 };
    }

    // 14. Decommission Machine
    if (normalized.includes("UPDATE machines SET status = 'decommissioned'")) {
      const id = params[0];
      const m = this.machines.get(id);
      if (!m) return { rows: [], rowCount: 0 };
      m.status = 'decommissioned';
      m.updated_at = new Date();
      this.machines.set(id, m);
      return { rows: [m], rowCount: 1 };
    }

    // 15A. updateOperatingHours atomic query
    if (
      normalized.startsWith('UPDATE machines SET operating_hours = $1') &&
      normalized.includes('operating_hours <= $1')
    ) {
      const newHours = Number(params[0]);
      const id = params[1];
      const m = this.machines.get(id);
      if (!m) return { rows: [], rowCount: 0 };
      const cur = m.operating_hours !== null && m.operating_hours !== undefined ? Number(m.operating_hours) : 0;
      if (cur > newHours) {
        // Atomic monotonicity condition failed (concurrent higher reading stored)
        return { rows: [], rowCount: 0 };
      }
      m.operating_hours = newHours;
      m.updated_at = new Date();
      this.machines.set(id, m);
      return { rows: [m], rowCount: 1 };
    }

    // 15B. Generic Update Machine with atomic monotonic check
    if (trimmed.startsWith('UPDATE machines') && trimmed.includes('SET') && trimmed.includes('WHERE id = $')) {
      const id = params[params.length - 1];
      const m = this.machines.get(id);
      if (!m) return { rows: [], rowCount: 0 };

      // Check atomic monotonic operating hours constraint if present in WHERE clause
      if (normalized.includes('operating_hours <= $')) {
        const match = normalized.match(/operating_hours <= \$(\d+)/);
        if (match) {
          const pIdx = parseInt(match[1], 10) - 1;
          const attemptedHours = Number(params[pIdx]);
          const cur = m.operating_hours !== null && m.operating_hours !== undefined ? Number(m.operating_hours) : 0;
          if (cur > attemptedHours) {
            return { rows: [], rowCount: 0 };
          }
        }
      }

      // Parse fields from SQL
      // e.g. SET name = $1, operating_hours = $2, updated_at = NOW()
      const setPart = trimmed.substring(trimmed.indexOf('SET') + 3, trimmed.indexOf('WHERE')).trim();
      const assignments = setPart.split(',').map((s) => s.trim());

      assignments.forEach((assignment) => {
        if (assignment.startsWith('updated_at')) {
          m.updated_at = new Date();
          return;
        }
        const [field, paramRef] = assignment.split('=').map((s) => s.trim());
        const pIndex = parseInt(paramRef.replace('$', ''), 10) - 1;
        const val = params[pIndex];
        (m as any)[field] = val;
      });

      this.machines.set(id, m);
      return { rows: [m], rowCount: 1 };
    }

    // 16. Delete Machine
    if (trimmed.startsWith('DELETE FROM machines WHERE id = $1')) {
      const id = params[0];
      const m = this.machines.get(id);
      if (!m) return { rows: [], rowCount: 0 };
      this.machines.delete(id);
      return { rows: [{ id: m.id, machine_code: m.machine_code }], rowCount: 1 };
    }

    // 17. Metrics Query
    if (normalized.includes('total_breakdowns')) {
      const machineId = params[0];
      const mrCount = this.maintenance_requests.filter((r) => r.machine_id === machineId).length;
      const woCount = this.work_orders.filter((w) => w.machine_id === machineId).length;
      const irCount = this.inspection_records.filter((i) => i.machine_id === machineId).length;
      const pmCount = this.pm_plans.filter((p) => p.machine_id === machineId).length;
      const partsCount = this.wo_parts_consumed.filter((wpc) => {
        const wo = this.work_orders.find((w) => w.id === wpc.work_order_id && w.machine_id === machineId);
        return !!wo;
      }).length;
      const prCount = this.purchase_requisitions.filter((pr) => pr.machine_id === machineId).length;
      const rdcCount = this.rdc_challans.filter((r) => r.machine_id === machineId).length;
      const auditCount = this.audit_logs.filter((a) => a.entity_name === 'machines' && a.entity_id === machineId).length;

      return {
        rows: [
          {
            total_breakdowns: String(mrCount),
            total_work_orders: String(woCount),
            total_inspections: String(irCount),
            total_pm_plans: String(pmCount),
            total_downtime_minutes: '0',
            active_repair_minutes: '0',
            total_parts_consumed: String(partsCount),
            total_purchase_requisitions: String(prCount),
            total_rdc_challans: String(rdcCount),
            total_audit_logs: String(auditCount),
          },
        ],
        rowCount: 1,
      };
    }

    // 18. History Queries
    if (trimmed.includes('FROM maintenance_requests mr') && trimmed.includes('WHERE mr.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const filtered = this.maintenance_requests.filter((r) => r.machine_id === params[0]);
      const paged = filtered.slice(offset, offset + limit);
      const rows = paged.map((r) => {
        const u = this.users.find((user) => user.id === r.reported_by_id);
        return { ...r, reported_by_name: u?.full_name || null, reported_by_code: u?.employee_code || null };
      });
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const filtered = this.work_orders.filter((w) => w.machine_id === params[0]);
      const paged = filtered.slice(offset, offset + limit);
      const rows = paged.map((w) => {
        const tech = this.users.find((user) => user.id === w.assigned_technician_id);
        const mgr = this.users.find((user) => user.id === w.assigned_manager_id);
        return { ...w, assigned_technician_name: tech?.full_name || null, assigned_manager_name: mgr?.full_name || null };
      });
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM inspection_records ir') && trimmed.includes('WHERE ir.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const filtered = this.inspection_records.filter((i) => i.machine_id === params[0]);
      const paged = filtered.slice(offset, offset + limit);
      const rows = paged.map((i) => {
        const u = this.users.find((user) => user.id === i.operator_id);
        return { ...i, operator_name: u?.full_name || null, operator_code: u?.employee_code || null };
      });
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM pm_plans p') && trimmed.includes('WHERE p.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const filtered = this.pm_plans.filter((p) => p.machine_id === params[0]);
      const rows = filtered.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM wo_parts_consumed wpc') && trimmed.includes('WHERE wo.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const matched = this.wo_parts_consumed.map((wpc) => {
        const wo = this.work_orders.find((w) => w.id === wpc.work_order_id && w.machine_id === params[0]);
        if (!wo) return null;
        const sp = this.spare_parts.find((s) => s.id === wpc.part_id);
        return { ...wpc, wo_number: wo.wo_number, part_number: sp?.part_number, part_name: sp?.name };
      }).filter(Boolean);
      const rows = matched.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM purchase_requisitions pr') && trimmed.includes('WHERE pr.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const matched = this.purchase_requisitions
        .filter((pr) => pr.machine_id === params[0])
        .map((pr) => {
          const wo = this.work_orders.find((w) => w.id === pr.work_order_id);
          const sp = this.spare_parts.find((s) => s.id === pr.part_id);
          const u = this.users.find((user) => user.id === pr.requested_by);
          return {
            ...pr,
            wo_number: wo?.wo_number || null,
            part_number: sp?.part_number || null,
            part_name: sp?.name || null,
            requested_by_name: u?.full_name || null,
            requested_by_code: u?.employee_code || null,
          };
        });
      const rows = matched.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM rdc_challans rdc') && trimmed.includes('WHERE rdc.machine_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const matched = this.rdc_challans
        .filter((rdc) => rdc.machine_id === params[0])
        .map((rdc) => {
          const wo = this.work_orders.find((w) => w.id === rdc.work_order_id);
          const u = this.users.find((user) => user.id === rdc.created_by);
          return {
            ...rdc,
            wo_number: wo?.wo_number || null,
            created_by_name: u?.full_name || null,
            created_by_code: u?.employee_code || null,
          };
        });
      const rows = matched.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('FROM audit_logs al') && trimmed.includes("al.entity_name = 'machines'") && trimmed.includes('al.entity_id = $1')) {
      const limit = params[1] !== undefined ? params[1] : 20;
      const offset = params[2] !== undefined ? params[2] : 0;
      const matched = this.audit_logs
        .filter((a) => a.entity_name === 'machines' && a.entity_id === params[0])
        .map((a) => {
          const u = this.users.find((user) => user.id === a.performed_by);
          return {
            ...a,
            performed_by_name: u?.full_name || null,
            performed_by_code: u?.employee_code || null,
          };
        });
      const rows = matched.slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// Global test fixture
const mockDb = new MockMachinesDatabase();

const testPool = {
  connect: async () => ({
    query: mockDb.query.bind(mockDb),
    release: () => {},
  }),
  query: mockDb.query.bind(mockDb),
};

// Users for testing
const enterpriseAdmin: AuthenticatedUser = {
  id: 'u0000000-0000-0000-0000-000000000001',
  employee_code: 'EMP-ADM-001',
  email: 'admin@jcb.local',
  role: 'admin',
};

const plant1Manager: AuthenticatedUser = {
  id: 'u0000000-0000-0000-0000-000000000002',
  employee_code: 'EMP-MGR-001',
  email: 'manager.plant1@jcb.local',
  role: 'manager',
  plant_id: 'b0000000-0000-0000-0000-000000000001',
};

const plant1OperatorShop1: AuthenticatedUser = {
  id: 'u0000000-0000-0000-0000-000000000003',
  employee_code: 'EMP-OPR-001',
  email: 'operator.s1@jcb.local',
  role: 'operator',
  plant_id: 'b0000000-0000-0000-0000-000000000001',
  shop_id: 'c0000000-0000-0000-0000-000000000001',
};

const plant2Technician: AuthenticatedUser = {
  id: 'u0000000-0000-0000-0000-000000000004',
  employee_code: 'EMP-TCH-002',
  email: 'tech.plant2@jcb.local',
  role: 'technician',
  plant_id: 'b0000000-0000-0000-0000-000000000002',
};

describe('Machines Asset Management Module (CMMS Module 2)', () => {
  beforeEach(() => {
    mockDb.seed();
    setMachinesDb(mockDb.query.bind(mockDb), testPool as any);
  });

  // -------------------------------------------------------------------------
  // 1. Machine Creation with Valid Data
  // -------------------------------------------------------------------------
  it('1. Machine creation with valid data registers asset, auto-generates QR UID, and records audit', async () => {
    const ctx = createMockContext(
      {
        machine_code: 'NEW-CNC-99',
        name: 'Haas 5-Axis Machining Center',
        category: 'VMC',
        oem_manufacturer: 'Haas Automation',
        model_number: 'VF-4SS',
        serial_number: 'HAAS-2026-9901',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
        bay_line_location: 'Bay 1 / Cell 3',
        criticality: 'class_a',
        operating_hours: 15.5,
        maintenance_frequency_days: 45,
      },
      {},
      {},
      {},
      enterpriseAdmin
    );

    await createMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 201);
    assert.equal(ctx.res.responseData.success, true);
    assert.equal(ctx.res.responseData.data.machine_code, 'NEW-CNC-99');
    assert.equal(ctx.res.responseData.data.criticality, 'class_a');
    assert.ok(ctx.res.responseData.data.qr_code_uid.startsWith('QR-JCB-NEW-CNC-99-'));

    // Check Audit Log
    const audit = mockDb.audit_logs.find((a) => a.action === 'MACHINE_CREATED');
    assert.ok(audit, 'Audit log for MACHINE_CREATED must be recorded');
    assert.equal(audit.performed_by, enterpriseAdmin.id);
  });

  // -------------------------------------------------------------------------
  // 2. Missing Required Fields
  // -------------------------------------------------------------------------
  it('2. Missing required fields (machine_code, name, category, oem_manufacturer, shop_id) returns HTTP 400', async () => {
    // Missing machine_code
    let ctx = createMockContext({ name: 'Lathe', category: 'Lathe', oem_manufacturer: 'HMT', shop_id: 'c0000000-0000-0000-0000-000000000001' }, {}, {}, {}, enterpriseAdmin);
    await createMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('machine_code'));

    // Missing shop_id (never silently choose first shop)
    ctx = createMockContext({ machine_code: 'LAT-01', name: 'Lathe', category: 'Lathe', oem_manufacturer: 'HMT' }, {}, {}, {}, enterpriseAdmin);
    await createMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('shop_id'));

    // Missing oem_manufacturer
    ctx = createMockContext({ machine_code: 'LAT-01', name: 'Lathe', category: 'Lathe', shop_id: 'c0000000-0000-0000-0000-000000000001' }, {}, {}, {}, enterpriseAdmin);
    await createMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('oem_manufacturer'));
  });

  // -------------------------------------------------------------------------
  // 3. Duplicate Machine Code
  // -------------------------------------------------------------------------
  it('3. Duplicate machine code returns HTTP 409 Conflict', async () => {
    const ctx = createMockContext(
      {
        machine_code: 'CNC-001', // Already exists in mock seed
        name: 'Another CNC Machine',
        category: 'HMC',
        oem_manufacturer: 'Mazak',
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      },
      {},
      {},
      {},
      enterpriseAdmin
    );

    await createMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 409);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes('already exists'));
  });

  // -------------------------------------------------------------------------
  // 4. Duplicate Serial Number
  // -------------------------------------------------------------------------
  it('4. Duplicate serial number returns HTTP 409 Conflict', async () => {
    const ctx = createMockContext(
      {
        machine_code: 'CNC-999',
        name: 'New Mazak Clone',
        category: 'HMC',
        oem_manufacturer: 'Mazak',
        serial_number: 'MZK-2023-8991', // Serial number of CNC-001
        shop_id: 'c0000000-0000-0000-0000-000000000001',
      },
      {},
      {},
      {},
      enterpriseAdmin
    );

    await createMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 409);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes('Serial number'));
  });

  // -------------------------------------------------------------------------
  // 5. Invalid Shop/Plant Relationship
  // -------------------------------------------------------------------------
  it('5. Invalid shop/plant relationship: non-existent shop returns HTTP 404, cross-plant assignment returns HTTP 403', async () => {
    // Non-existent shop
    let ctx = createMockContext(
      {
        machine_code: 'PRESS-88',
        name: 'Press 88',
        category: 'Press',
        oem_manufacturer: 'Schuler',
        shop_id: 'c0000000-0000-0000-0000-999999999999',
      },
      {},
      {},
      {},
      enterpriseAdmin
    );
    await createMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 404);

    // Cross-plant assignment: Plant 1 Manager attempts to register machine into Plant 2 Shop
    ctx = createMockContext(
      {
        machine_code: 'PRESS-88',
        name: 'Press 88',
        category: 'Press',
        oem_manufacturer: 'Schuler',
        shop_id: 'c0000000-0000-0000-0000-000000000003', // Shop 3 is in Plant 2 (Pune)
      },
      {},
      {},
      {},
      plant1Manager
    );
    await createMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('Forbidden'));
  });

  // -------------------------------------------------------------------------
  // 6. Unauthorized Facility Access
  // -------------------------------------------------------------------------
  it('6. Unauthorized facility access prevents cross-plant and cross-shop data leakage (HTTP 403)', async () => {
    // Plant 2 Technician attempts to access Machine 1 located in Plant 1
    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      plant2Technician
    );

    await getMachineById(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 403);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes('Forbidden'));
  });

  // -------------------------------------------------------------------------
  // 7. Machine List Filters
  // -------------------------------------------------------------------------
  it('7. Machine list filters correctly by category, criticality, status, and search', async () => {
    // Filter by category HMC
    let ctx = createMockContext({}, {}, { category: 'HMC' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.ok(ctx.res.responseData.data.every((m: any) => m.category.toLowerCase() === 'hmc'));

    // Filter by criticality class_a
    ctx = createMockContext({}, {}, { criticality: 'class_a' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.ok(ctx.res.responseData.data.every((m: any) => m.criticality === 'class_a'));

    // Search by Fanuc
    ctx = createMockContext({}, {}, { search: 'Fanuc' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.length, 1);
    assert.equal(ctx.res.responseData.data[0].machine_code, 'ROB-012');
  });

  // -------------------------------------------------------------------------
  // 8. Accurate Filtered Pagination Count
  // -------------------------------------------------------------------------
  it('8. Accurate filtered pagination count reflects filtered subset, not total DB table size', async () => {
    // Filter by status = 'decommissioned' (only 1 machine in seed)
    const ctx = createMockContext({}, {}, { status: 'decommissioned' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.pagination.total, 1);
    assert.equal(ctx.res.responseData.pagination.totalPages, 1);
    assert.equal(ctx.res.responseData.data.length, 1);
  });

  // -------------------------------------------------------------------------
  // 9. Invalid Pagination and Sorting
  // -------------------------------------------------------------------------
  it('9. Invalid pagination and sorting parameters return HTTP 400 Bad Request', async () => {
    // Invalid page 0
    let ctx = createMockContext({}, {}, { page: '0' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);

    // Invalid limit 500
    ctx = createMockContext({}, {}, { limit: '500' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);

    // Non-whitelisted sort column
    ctx = createMockContext({}, {}, { sortBy: 'non_existent_column' }, {}, enterpriseAdmin);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
  });

  // -------------------------------------------------------------------------
  // 10. QR UID Lookup Success and Failure
  // -------------------------------------------------------------------------
  it('10. QR UID lookup resolves active machines and warns on decommissioned machines (404 on not found, 400 on malformed)', async () => {
    // Active QR lookup
    let ctx = createMockContext({}, { uid: 'QR-JCB-ROB-012-UID' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'ROB-012');
    assert.equal(ctx.res.responseData.warning, undefined);

    // Decommissioned machine QR lookup
    ctx = createMockContext({}, { uid: 'QR-JCB-OLD-LATHE-UID' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.ok(ctx.res.responseData.warning?.includes('decommissioned'));

    // Non-existent QR
    ctx = createMockContext({}, { uid: 'QR-NON-EXISTENT-UID' }, {}, {}, enterpriseAdmin);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 404);

    // Malformed empty QR
    ctx = createMockContext({}, { uid: '   ' }, {}, {}, enterpriseAdmin);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
  });

  // -------------------------------------------------------------------------
  // 11. Machine Detail Lookup
  // -------------------------------------------------------------------------
  it('11. Machine detail lookup by ID returns enriched data (HTTP 400 on invalid UUID, 404 on non-existent)', async () => {
    // Valid ID
    let ctx = createMockContext({}, { id: '10000000-0000-0000-0000-000000000001' }, {}, {}, plant1Manager);
    await getMachineById(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'CNC-001');
    assert.equal(ctx.res.responseData.data.shop_name, 'CNC Machining Shop');
    assert.equal(ctx.res.responseData.data.plant_name, 'JCB Ballabgarh Works');

    // Invalid UUID
    ctx = createMockContext({}, { id: 'invalid-uuid-string' }, {}, {}, plant1Manager);
    await getMachineById(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);

    // Non-existent UUID
    ctx = createMockContext({}, { id: '00000000-0000-0000-0000-000000000000' }, {}, {}, plant1Manager);
    await getMachineById(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 404);
  });

  // -------------------------------------------------------------------------
  // 12. Valid and Invalid Updates
  // -------------------------------------------------------------------------
  it('12. Valid updates modify allowed fields; immutable fields modification returns HTTP 400', async () => {
    // Valid update by Admin on asset master specifications
    let ctx = createMockContext(
      {
        name: 'Mazak HMC 1 (Upgraded Spindle)',
        model_number: 'HCN-6800 NEO Plus',
      },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.name, 'Mazak HMC 1 (Upgraded Spindle)');

    // Attempting to change immutable machine_code
    ctx = createMockContext(
      {
        machine_code: 'CNC-RENAMED-CODE',
      },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('immutable'));
  });

  // -------------------------------------------------------------------------
  // 13. Clearing Nullable Fields
  // -------------------------------------------------------------------------
  it('13. Clearing nullable fields explicitly sets them to null in database while preserving omitted fields', async () => {
    const ctx = createMockContext(
      {
        model_number: null,
        bay_line_location: null,
      },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );

    await updateMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.model_number, null);
    assert.equal(ctx.res.responseData.data.bay_line_location, null);
    // Preserved omitted fields
    assert.equal(ctx.res.responseData.data.serial_number, 'MZK-2023-8991');
  });

  // -------------------------------------------------------------------------
  // 14. Invalid Lifecycle Transitions
  // -------------------------------------------------------------------------
  it('14. Invalid lifecycle transitions: cannot set machine with open workflows to running or decommissioned (HTTP 409)', async () => {
    // Machine 1 currently has an open complaint CMP-2026-00001 and open WO-2026-00001
    // Attempting to manually force status = 'running'
    let ctx = createMockContext(
      { status: 'running' },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 409);
    assert.ok(ctx.res.responseData.message.includes('active maintenance workflows'));

    // Attempting to decommission machine with active workflows
    ctx = createMockContext(
      { status: 'decommissioned' },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 409);
    assert.ok(ctx.res.responseData.message.includes('active maintenance workflows'));
  });

  // -------------------------------------------------------------------------
  // 15. Operating-Hour Validation and Monotonic Increase
  // -------------------------------------------------------------------------
  it('15. Operating-hour validation: rejects negative hours and accidental reduction, permits monotonic increase', async () => {
    // Negative hours rejected
    let ctx = createMockContext(
      { operating_hours: -20 },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);

    // Current operating_hours for m2 is 6140.0. Attempting to reduce to 6000.0
    ctx = createMockContext(
      { operating_hours: 6000.0 },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('Cumulative operating hours cannot be reduced'));

    // Valid monotonic increase
    ctx = createMockContext(
      { operating_hours: 6200.5 },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(Number(ctx.res.responseData.data.operating_hours), 6200.5);

    // Verify Audit log recorded for MACHINE_HOURS_UPDATED
    const hoursAudit = mockDb.audit_logs.find((a) => a.action === 'MACHINE_HOURS_UPDATED');
    assert.ok(hoursAudit, 'MACHINE_HOURS_UPDATED audit must be recorded');
  });

  // -------------------------------------------------------------------------
  // 16. Machine Maintenance History
  // -------------------------------------------------------------------------
  it('16. Machine maintenance history endpoint consolidates breakdowns, work orders, inspections, PMs, and parts', async () => {
    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '1', limit: '10' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    const data = ctx.res.responseData.data;
    assert.equal(data.machine.machine_code, 'CNC-001');
    assert.equal(data.metrics.totalBreakdowns, 1);
    assert.equal(data.metrics.totalWorkOrders, 1);
    assert.equal(data.metrics.totalInspections, 1);
    assert.equal(data.metrics.totalPmPlans, 1);
    assert.equal(data.metrics.totalPartsConsumed, 1);
    assert.equal(data.history.breakdowns.length, 1);
    assert.equal(data.history.workOrders.length, 1);
    assert.equal(data.history.inspections.length, 1);
    assert.equal(data.history.partsConsumed.length, 1);
  });

  // -------------------------------------------------------------------------
  // 17. Safe Decommissioning with Historical References
  // -------------------------------------------------------------------------
  it('17. Safe decommissioning with historical references marks status = decommissioned instead of hard deleting', async () => {
    // Machine 2 has no active workflows, but let's give it a historical work order
    mockDb.work_orders.push({
      id: 'wo000000-0000-0000-0000-000000000002',
      wo_number: 'WO-2026-00002',
      machine_id: '10000000-0000-0000-0000-000000000002',
      status: 'verified_closed',
      created_at: new Date('2026-01-10'),
    });

    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      enterpriseAdmin
    );

    await deleteMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.decommissioned, true);
    assert.equal(ctx.res.responseData.deleted, false);
    assert.equal(ctx.res.responseData.data.status, 'decommissioned');

    // Repeated request is safe and idempotent
    const ctxRepeat = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      enterpriseAdmin
    );
    await deleteMachine(ctxRepeat.req, ctxRepeat.res, ctxRepeat.next);
    assert.equal(ctxRepeat.res.statusCode, 200);
    assert.ok(ctxRepeat.res.responseData.message.includes('already decommissioned'));
  });

  // -------------------------------------------------------------------------
  // 18. Hard-Delete Prevention & Pristine Asset Deletion
  // -------------------------------------------------------------------------
  it('18. Hard-delete prevention: machine with history is not deleted; pristine asset without history is hard deleted', async () => {
    // Create a new pristine machine with 0 history
    const pristineMachine: MachineRow = {
      id: '10000000-0000-0000-0000-000000000099',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      machine_code: 'TEST-NEW-01',
      name: 'Unused Test Bench',
      category: 'Bench',
      oem_manufacturer: 'JCB Lab',
      model_number: null,
      serial_number: 'TEST-SN-999',
      bay_line_location: null,
      bay_id: null,
      production_line_id: null,
      criticality: 'class_c',
      status: 'running',
      operating_hours: 0,
      maintenance_frequency_days: 30,
      qr_code_uid: 'QR-TEST-NEW-01',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.machines.set(pristineMachine.id, pristineMachine);

    // Delete pristine asset
    const ctx = createMockContext(
      {},
      { id: pristineMachine.id },
      {},
      {},
      enterpriseAdmin
    );

    await deleteMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.deleted, true);
    assert.equal(ctx.res.responseData.decommissioned, false);
    assert.equal(mockDb.machines.has(pristineMachine.id), false, 'Machine must be hard-deleted from DB');

    // Audit log recorded
    const delAudit = mockDb.audit_logs.find((a) => a.action === 'MACHINE_DELETED');
    assert.ok(delAudit, 'MACHINE_DELETED audit must be recorded');
  });

  // -------------------------------------------------------------------------
  // 19. Audit Behavior
  // -------------------------------------------------------------------------
  it('19. Audit logs capture entity mutations with before and after state', async () => {
    const initialLogCount = mockDb.audit_logs.length;

    // Perform an update that triggers MACHINE_UPDATED and MACHINE_STATUS_UPDATED
    const ctx = createMockContext(
      {
        status: 'idle',
      },
      { id: '10000000-0000-0000-0000-000000000002' }, // m2 has no active complaints
      {},
      {},
      enterpriseAdmin
    );

    await updateMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.ok(mockDb.audit_logs.length > initialLogCount);

    const statusLog = mockDb.audit_logs.find((a) => a.action === 'MACHINE_STATUS_UPDATED');
    assert.ok(statusLog);
    assert.equal(statusLog.old_values.status, 'running');
    assert.equal(statusLog.new_values.status, 'idle');
  });

  // -------------------------------------------------------------------------
  // 20. Regression Tests for Existing Endpoints
  // -------------------------------------------------------------------------
  it('20. Regression tests: All standard machine API contracts respond with consistent format', async () => {
    // GET /api/v1/machines
    let ctx = createMockContext({}, {}, {}, {}, plant1Manager);
    await getMachines(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    assert.ok(Array.isArray(ctx.res.responseData.data));
    assert.ok(ctx.res.responseData.pagination);

    // GET /api/v1/machines/:id
    ctx = createMockContext({}, { id: '10000000-0000-0000-0000-000000000001' }, {}, {}, plant1Manager);
    await getMachineById(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    assert.ok(ctx.res.responseData.data.machine_code);

    // GET /api/v1/machines/qr/:uid
    ctx = createMockContext({}, { uid: 'QR-JCB-CNC-001-UID' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    assert.equal(ctx.res.responseData.data.qr_code_uid, 'QR-JCB-CNC-001-UID');
  });

  // -------------------------------------------------------------------------
  // 21. Manager Field-Level Authorization (Governance Fields Blocked with 403)
  // -------------------------------------------------------------------------
  it('21. Manager attempting to change governance fields (criticality, category, shop_id, oem_manufacturer) returns HTTP 403', async () => {
    // Manager attempting to modify criticality
    let ctx = createMockContext(
      { criticality: 'class_a' },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('Managers are not authorized to modify master asset governance fields'));
    assert.ok(ctx.res.responseData.message.includes('criticality'));

    // Manager attempting to modify category
    ctx = createMockContext(
      { category: 'Welder' },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('category'));

    // Manager attempting to relocate shop_id
    ctx = createMockContext(
      { shop_id: 'c0000000-0000-0000-0000-000000000002' },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('shop_id'));

    // Manager attempting to modify oem_manufacturer
    ctx = createMockContext(
      { oem_manufacturer: 'Fanuc Robotics' },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('oem_manufacturer'));
  });

  // -------------------------------------------------------------------------
  // 22. Manager Updating Permitted Operational Fields
  // -------------------------------------------------------------------------
  it('22. Manager updating permitted operational fields (operating_hours, bay_line_location, description, URLs) succeeds with HTTP 200', async () => {
    const ctx = createMockContext(
      {
        operating_hours: 6185.0,
        bay_line_location: 'Bay 2 / Welding Cell Beta',
        description: 'Upgraded wire feeder installed',
        manual_url: 'https://docs.jcb.local/manuals/rob-012-rev2.pdf',
      },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );

    await updateMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    assert.equal(Number(ctx.res.responseData.data.operating_hours), 6185.0);
    assert.equal(ctx.res.responseData.data.bay_line_location, 'Bay 2 / Welding Cell Beta');
    assert.equal(ctx.res.responseData.data.description, 'Upgraded wire feeder installed');
    assert.equal(ctx.res.responseData.data.manual_url, 'https://docs.jcb.local/manuals/rob-012-rev2.pdf');
  });

  // -------------------------------------------------------------------------
  // 23. Manual Assignment of Maintenance Workflow Statuses
  // -------------------------------------------------------------------------
  it('23. Manual assignment of maintenance workflow statuses (breakdown, under_maintenance, awaiting_parts, awaiting_verification) returns HTTP 400', async () => {
    const maintenanceStatuses = ['breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification'];

    for (const st of maintenanceStatuses) {
      const ctx = createMockContext(
        { status: st },
        { id: '10000000-0000-0000-0000-000000000002' },
        {},
        {},
        enterpriseAdmin
      );
      await updateMachine(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400, `Expected 400 when setting status = ${st}`);
      assert.ok(ctx.res.responseData.message.includes('exclusively governed by Breakdown and Work Order workflows'));
    }
  });

  // -------------------------------------------------------------------------
  // 24. Setting Inactive with Active Maintenance Workflows
  // -------------------------------------------------------------------------
  it('24. Setting inactive when active maintenance workflows exist returns HTTP 409 Conflict', async () => {
    // Machine 1 has active breakdown complaint and active work order
    const ctx = createMockContext(
      { status: 'inactive' },
      { id: '10000000-0000-0000-0000-000000000001' },
      {},
      {},
      enterpriseAdmin
    );

    await updateMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 409);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes("Cannot transition machine status to 'inactive'"));
    assert.ok(ctx.res.responseData.message.includes('active maintenance workflows'));
  });

  // -------------------------------------------------------------------------
  // 25. Hard Deletion Prevention When Historical PM Plans Exist
  // -------------------------------------------------------------------------
  it('25. Hard deletion prevention: machine with historical PM plans is safely decommissioned instead of hard deleted', async () => {
    // Create an asset that has ONLY a PM plan (no breakdowns or work orders)
    const machineWithPm: MachineRow = {
      id: '10000000-0000-0000-0000-000000000077',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      machine_code: 'PM-ASSET-01',
      name: 'Air Compressor Unit',
      category: 'Compressor',
      oem_manufacturer: 'Atlas Copco',
      model_number: 'GA-75',
      serial_number: 'AC-2024-001',
      bay_line_location: 'Utility Room 1',
      bay_id: null,
      production_line_id: null,
      criticality: 'class_b',
      status: 'running',
      operating_hours: 1200,
      maintenance_frequency_days: 90,
      qr_code_uid: 'QR-PM-ASSET-01',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: null,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
    };
    mockDb.machines.set(machineWithPm.id, machineWithPm);

    mockDb.pm_plans.push({
      id: 'pm-plan-unique-077',
      plan_code: 'PM-COMP-Q01',
      machine_id: machineWithPm.id,
      title: 'Quarterly Air Filter & Oil PM',
      frequency: 'quarterly',
      interval_days: 90,
      is_active: true,
      created_at: new Date('2026-01-05'),
    });

    const ctx = createMockContext(
      {},
      { id: machineWithPm.id },
      {},
      {},
      enterpriseAdmin
    );

    await deleteMachine(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.decommissioned, true);
    assert.equal(ctx.res.responseData.deleted, false);
    assert.ok(mockDb.machines.has(machineWithPm.id), 'Machine row must be retained in DB as decommissioned');
    assert.equal(mockDb.machines.get(machineWithPm.id)?.status, 'decommissioned');
    assert.ok(
      mockDb.pm_plans.some((p) => p.machine_id === machineWithPm.id),
      'PM plan must NOT be cascade-deleted'
    );
  });

  // -------------------------------------------------------------------------
  // 26. Transaction Rollback When Deletion Query Fails
  // -------------------------------------------------------------------------
  it('26. Transaction rollback when machine deletion encounters a database failure: transaction rolls back cleanly', async () => {
    // Create a pristine machine
    const testRollbackMachine: MachineRow = {
      id: '10000000-0000-0000-0000-000000000088',
      shop_id: 'c0000000-0000-0000-0000-000000000001',
      machine_code: 'RB-TEST-01',
      name: 'Rollback Test Asset',
      category: 'Bench',
      oem_manufacturer: 'Test OEM',
      model_number: null,
      serial_number: null,
      bay_line_location: null,
      bay_id: null,
      production_line_id: null,
      criticality: 'class_c',
      status: 'idle',
      operating_hours: 0,
      maintenance_frequency_days: 30,
      qr_code_uid: 'QR-RB-TEST-01',
      manual_url: null,
      electrical_diagram_url: null,
      hydraulic_schematic_url: null,
      sop_document_url: null,
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockDb.machines.set(testRollbackMachine.id, testRollbackMachine);

    // Simulate database failure during DELETE query
    mockDb.failQueryPattern = 'DELETE FROM machines';

    const ctx = createMockContext(
      {},
      { id: testRollbackMachine.id },
      {},
      {},
      enterpriseAdmin
    );

    await deleteMachine(ctx.req, ctx.res, ctx.next);

    // Verify 500 status returned by error middleware
    assert.equal(ctx.res.statusCode, 500);

    // Verify database state was preserved via ROLLBACK: machine was NOT deleted
    assert.ok(mockDb.machines.has(testRollbackMachine.id), 'Machine must be preserved in DB after transaction rollback');
  });

  // -------------------------------------------------------------------------
  // 27. Operating-Hour Concurrency & Race Condition Simulation (Mock Simulation)
  // -------------------------------------------------------------------------
  it('27. Operating-hour concurrency: atomic conditional update rejects stale concurrent lower reading with HTTP 409 Conflict', async () => {
    // Current operating hours for m2 is 6140.0
    // Request A reads m2 at 6140.0 and prepares to update to 6300.0.
    // Concurrently, Request B completes and updates m2 operating hours to 6600.0.
    // When Request A executes: the atomic SQL update condition
    // WHERE id = $2 AND (operating_hours IS NULL OR operating_hours <= 6300)
    // matches 0 rows because 6600.0 > 6300.0.
    // The service detects 0 affected rows, inspects the current database record,
    // and returns HTTP 409 Conflict.

    // 1. First verify standard rejection when incoming reading is lower than current in-memory machine
    let ctx = createMockContext(
      { operating_hours: 6000.0 },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );
    await updateMachine(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 400);
    assert.ok(ctx.res.responseData.message.includes('Cumulative operating hours cannot be reduced'));

    // 2. Concurrency race simulation:
    // Intercept query: immediately after application check succeeds, another thread mutates m2 in DB to 6600.0
    const m2 = mockDb.machines.get('10000000-0000-0000-0000-000000000002')!;
    const originalQuery = mockDb.query.bind(mockDb);
    let raceInjected = false;
    mockDb.query = async (text: string, params: any[] = []) => {
      if (!raceInjected && text.includes('UPDATE machines') && text.includes('operating_hours')) {
        raceInjected = true;
        // Concurrent worker updates operating_hours to 6600.0
        m2.operating_hours = 6600.0;
      }
      return originalQuery(text, params);
    };

    // Request A submits 6300.0 (passes application check because 6300.0 > initial 6140.0)
    ctx = createMockContext(
      { operating_hours: 6300.0 },
      { id: '10000000-0000-0000-0000-000000000002' },
      {},
      {},
      plant1Manager
    );

    await updateMachine(ctx.req, ctx.res, ctx.next);

    // Restore original query function
    mockDb.query = originalQuery;

    // Must be rejected with HTTP 409 Conflict
    assert.equal(ctx.res.statusCode, 409);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes('Operating hour meter conflict'));
    assert.ok(ctx.res.responseData.message.includes('6600'));
  });

  // -------------------------------------------------------------------------
  // 28. Machine History — User Reference Integrity (LEFT JOIN)
  // -------------------------------------------------------------------------
  it('28. Machine history: user reference integrity uses LEFT JOIN so breakdown and inspection records with missing or deactivated users remain visible', async () => {
    // Add breakdown with missing user reference
    mockDb.maintenance_requests.push({
      id: 'mr000000-0000-0000-0000-000000000099',
      complaint_number: 'CMP-2026-00099',
      machine_id: '10000000-0000-0000-0000-000000000001',
      reported_by_id: 'u-deleted-or-nonexistent-user',
      shift: 'Shift B',
      issue_category: 'electrical',
      priority: 'medium',
      status: 'pending_assignment',
      breakdown_occurred_at: new Date('2026-02-04T12:00:00Z'),
      reported_at: new Date('2026-02-04T12:15:00Z'),
      hour_meter_reading: 4400.0,
      problem_title: 'Intermittent power trip on auxiliary control panel',
      description: 'Panel trips under heavy spindle acceleration',
      created_at: new Date('2026-02-04T12:15:00Z'),
    });

    // Add inspection with missing user reference
    mockDb.inspection_records.push({
      id: 'ir000000-0000-0000-0000-000000000099',
      machine_id: '10000000-0000-0000-0000-000000000001',
      operator_id: 'u-deleted-or-nonexistent-user',
      shift: 'Shift B',
      overall_status: 'flagged',
      temperature: 55.0,
      pressure: 5.8,
      vibration: 1.4,
      created_at: new Date('2026-02-04T08:00:00Z'),
    });

    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '1', limit: '20' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.success, true);
    const data = ctx.res.responseData.data;

    // Verify breakdown record is returned and user fields fall back gracefully to null
    const orphanedBreakdown = data.history.breakdowns.find(
      (b: any) => b.id === 'mr000000-0000-0000-0000-000000000099'
    );
    assert.ok(orphanedBreakdown, 'Breakdown with missing user must be preserved in history');
    assert.equal(orphanedBreakdown.reported_by_name, null);
    assert.equal(orphanedBreakdown.reported_by_code, null);

    // Verify inspection record is returned and user fields fall back gracefully to null
    const orphanedInspection = data.history.inspections.find(
      (i: any) => i.id === 'ir000000-0000-0000-0000-000000000099'
    );
    assert.ok(orphanedInspection, 'Inspection with missing user must be preserved in history');
    assert.equal(orphanedInspection.operator_name, null);
    assert.equal(orphanedInspection.operator_code, null);

    // Verify record with existing user still resolves proper names
    const regularBreakdown = data.history.breakdowns.find(
      (b: any) => b.id === 'mr000000-0000-0000-0000-000000000001'
    );
    assert.ok(regularBreakdown);
    assert.equal(regularBreakdown.reported_by_name, 'Rajesh Sharma');
    assert.equal(regularBreakdown.reported_by_code, 'EMP-ADM-001');
  });

  // -------------------------------------------------------------------------
  // 29. History Type Filtering
  // -------------------------------------------------------------------------
  it('29. History type filtering: selective category queries execute only the requested type and return empty arrays for other categories', async () => {
    // Query only work orders
    const ctxWo = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'work_orders' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctxWo.req, ctxWo.res, ctxWo.next);

    assert.equal(ctxWo.res.statusCode, 200);
    assert.equal(ctxWo.res.responseData.success, true);
    const dataWo = ctxWo.res.responseData.data;

    // Requested category is populated
    assert.ok(dataWo.history.workOrders.length >= 1);
    // Non-requested categories must remain empty arrays
    assert.equal(dataWo.history.breakdowns.length, 0);
    assert.equal(dataWo.history.inspections.length, 0);
    assert.equal(dataWo.history.pmPlans.length, 0);
    assert.equal(dataWo.history.partsConsumed.length, 0);
    assert.equal(dataWo.history.purchaseRequisitions.length, 0);
    assert.equal(dataWo.history.rdcChallans.length, 0);
    assert.equal(dataWo.history.auditLogs.length, 0);

    // Filter-specific pagination reflects work orders count
    assert.equal(dataWo.pagination.total, 1);
    assert.equal(dataWo.pagination.totalPages, 1);

    // Query only breakdowns
    const ctxBrk = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'breakdowns' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctxBrk.req, ctxBrk.res, ctxBrk.next);

    assert.equal(ctxBrk.res.statusCode, 200);
    const dataBrk = ctxBrk.res.responseData.data;
    assert.ok(dataBrk.history.breakdowns.length >= 1);
    assert.equal(dataBrk.history.workOrders.length, 0);
  });

  // -------------------------------------------------------------------------
  // 30. History Type Validation
  // -------------------------------------------------------------------------
  it('30. History type validation: invalid or unsupported type returns HTTP 400 Bad Request', async () => {
    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'telemetry_stream' }, // Unsupported type
      {},
      plant1Manager
    );

    await getMachineHistory(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 400);
    assert.equal(ctx.res.responseData.success, false);
    assert.ok(ctx.res.responseData.message.includes("Invalid history type 'telemetry_stream'"));
    assert.ok(ctx.res.responseData.message.includes('Allowed types: breakdowns, work_orders, inspections, pm_plans, parts_consumed, purchase_requisitions, rdc_challans, audit_logs'));
  });

  // -------------------------------------------------------------------------
  // 31. PM Plans Pagination
  // -------------------------------------------------------------------------
  it('31. PM plans pagination: limits and offsets work accurately with category pagination metadata', async () => {
    // Add a second PM plan for m1
    mockDb.pm_plans.push({
      id: 'pm000000-0000-0000-0000-000000000002',
      plan_code: 'PM-CNC-Q01',
      machine_id: '10000000-0000-0000-0000-000000000001',
      title: 'Quarterly Spindle Laser Alignment & Ballbar Test',
      frequency: 'quarterly',
      interval_days: 90,
      operating_hour_threshold: 6000,
      last_pm_date: new Date('2026-01-01'),
      next_pm_date: new Date('2026-04-01'),
      grace_period_days: 7,
      is_active: true,
      created_at: new Date('2026-01-02T00:00:00Z'),
    });

    // Page 1 with limit 1
    const ctxP1 = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'pm_plans', page: '1', limit: '1' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctxP1.req, ctxP1.res, ctxP1.next);

    assert.equal(ctxP1.res.statusCode, 200);
    const dataP1 = ctxP1.res.responseData.data;
    assert.equal(dataP1.history.pmPlans.length, 1);
    assert.equal(dataP1.pagination.page, 1);
    assert.equal(dataP1.pagination.limit, 1);
    assert.equal(dataP1.pagination.total, 2);
    assert.equal(dataP1.pagination.totalPages, 2);
    assert.equal(dataP1.pagination.categories.pm_plans.total, 2);
    assert.equal(dataP1.pagination.categories.pm_plans.totalPages, 2);
    const firstPlanId = dataP1.history.pmPlans[0].id;

    // Page 2 with limit 1
    const ctxP2 = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'pm_plans', page: '2', limit: '1' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctxP2.req, ctxP2.res, ctxP2.next);

    assert.equal(ctxP2.res.statusCode, 200);
    const dataP2 = ctxP2.res.responseData.data;
    assert.equal(dataP2.history.pmPlans.length, 1);
    assert.equal(dataP2.pagination.page, 2);
    assert.notEqual(dataP2.history.pmPlans[0].id, firstPlanId, 'Page 2 must return distinct PM plan from Page 1');
  });

  // -------------------------------------------------------------------------
  // 32. Category-Specific Pagination Metadata
  // -------------------------------------------------------------------------
  it('32. Category-specific pagination metadata: accurate per-category pagination metadata returned without breaking root contract', async () => {
    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '1', limit: '10' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    const pagination = ctx.res.responseData.data.pagination;

    // Backward-compatible root pagination
    assert.equal(pagination.page, 1);
    assert.equal(pagination.limit, 10);

    // Detailed per-category pagination
    assert.ok(pagination.categories, 'pagination.categories must be provided');
    const categories = [
      'breakdowns',
      'work_orders',
      'inspections',
      'pm_plans',
      'parts_consumed',
      'purchase_requisitions',
      'rdc_challans',
      'audit_logs',
    ];

    categories.forEach((cat) => {
      const meta = pagination.categories[cat];
      assert.ok(meta, `Category pagination for ${cat} must exist`);
      assert.equal(typeof meta.total, 'number');
      assert.equal(meta.page, 1);
      assert.equal(meta.limit, 10);
      assert.equal(typeof meta.totalPages, 'number');
      assert.ok(meta.totalPages >= 1);
    });

    // Pagination bounds validation: page 0 returns HTTP 400
    const ctxBadPage = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '0', limit: '10' },
      {},
      plant1Manager
    );
    await getMachineHistory(ctxBadPage.req, ctxBadPage.res, ctxBadPage.next);
    assert.equal(ctxBadPage.res.statusCode, 400);

    // Pagination bounds validation: limit 101 returns HTTP 400
    const ctxBadLimit = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '1', limit: '101' },
      {},
      plant1Manager
    );
    await getMachineHistory(ctxBadLimit.req, ctxBadLimit.res, ctxBadLimit.next);
    assert.equal(ctxBadLimit.res.statusCode, 400);
  });

  // -------------------------------------------------------------------------
  // 33. Machine-Linked History: PRs, RDC Challans, and Audit Logs
  // -------------------------------------------------------------------------
  it('33. Machine-linked history: purchase requisitions, RDC challans, and machine audit logs are populated with joined metadata', async () => {
    // 1. Fetch all history categories
    const ctx = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { page: '1', limit: '20' },
      {},
      plant1Manager
    );

    await getMachineHistory(ctx.req, ctx.res, ctx.next);

    assert.equal(ctx.res.statusCode, 200);
    const data = ctx.res.responseData.data;

    // Check Purchase Requisitions
    assert.ok(data.history.purchaseRequisitions.length >= 1);
    const pr = data.history.purchaseRequisitions[0];
    assert.equal(pr.pr_number, 'PR-2026-00001');
    assert.equal(pr.wo_number, 'WO-2026-00001');
    assert.equal(pr.part_number, 'HYD-SOL-01');
    assert.equal(pr.part_name, 'Rexroth Hydraulic Directional Valve');
    assert.equal(pr.requested_by_name, 'Sunil Yadav');

    // Check RDC Challans
    assert.ok(data.history.rdcChallans.length >= 1);
    const rdc = data.history.rdcChallans[0];
    assert.equal(rdc.challan_number, 'RDC-2026-00001');
    assert.equal(rdc.vendor_party_name, 'Rexroth Service Center Faridabad');
    assert.equal(rdc.wo_number, 'WO-2026-00001');
    assert.equal(rdc.created_by_name, 'Sunil Yadav');

    // Check Machine-Specific Audit Logs
    assert.ok(data.history.auditLogs.length >= 1);
    const al = data.history.auditLogs[0];
    assert.equal(al.entity_name, 'machines');
    assert.equal(al.action, 'MACHINE_CREATED');
    assert.equal(al.performed_by_name, 'Rajesh Sharma');

    // Metrics match category counts
    assert.equal(data.metrics.totalPurchaseRequisitions, 1);
    assert.equal(data.metrics.totalRdcChallans, 1);
    assert.ok(data.metrics.totalAuditLogs >= 1);

    // 2. Specific filter on ?type=purchase_requisitions
    const ctxPr = createMockContext(
      {},
      { id: '10000000-0000-0000-0000-000000000001' },
      { type: 'purchase_requisitions' },
      {},
      plant1Manager
    );
    await getMachineHistory(ctxPr.req, ctxPr.res, ctxPr.next);
    assert.equal(ctxPr.res.statusCode, 200);
    assert.equal(ctxPr.res.responseData.data.history.purchaseRequisitions.length, 1);
    assert.equal(ctxPr.res.responseData.data.history.rdcChallans.length, 0);
  });

  // -------------------------------------------------------------------------
  // 34. QR & Machine Code Lookup Backward Compatibility
  // -------------------------------------------------------------------------
  it('34. QR lookup backward compatibility: resolves by both qr_code_uid and machine_code, enforcing facility RBAC and decommissioned notices', async () => {
    // 1. Lookup by exact qr_code_uid
    let ctx = createMockContext({}, { uid: 'QR-JCB-CNC-001-UID' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'CNC-001');
    assert.equal(ctx.res.responseData.data.qr_code_uid, 'QR-JCB-CNC-001-UID');

    // 2. Lookup by machine_code (backward compatibility for mobile barcode scanners)
    ctx = createMockContext({}, { uid: 'CNC-001' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'CNC-001');
    assert.equal(ctx.res.responseData.data.id, '10000000-0000-0000-0000-000000000001');

    // 3. Case-insensitive lookup by machine_code
    ctx = createMockContext({}, { uid: 'cnc-001' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'CNC-001');

    // 4. Facility access enforcement: plant 2 technician cannot query plant 1 machine
    ctx = createMockContext({}, { uid: 'CNC-001' }, {}, {}, plant2Technician);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 403);
    assert.ok(ctx.res.responseData.message.includes('outside your authorized scope'));

    // 5. Decommissioned machine lookup by machine_code returns HTTP 200 with decommission notice warning
    ctx = createMockContext({}, { uid: 'OLD-LATHE-01' }, {}, {}, plant1Manager);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.responseData.data.machine_code, 'OLD-LATHE-01');
    assert.ok(ctx.res.responseData.warning.includes('permanently decommissioned'));

    // 6. Unknown QR code / machine code returns HTTP 404 Not Found
    ctx = createMockContext({}, { uid: 'NON-EXISTENT-CODE-999' }, {}, {}, enterpriseAdmin);
    await getMachineByQR(ctx.req, ctx.res, ctx.next);
    assert.equal(ctx.res.statusCode, 404);
    assert.ok(ctx.res.responseData.message.includes('No machine found matching QR identifier or machine code'));
  });
});
