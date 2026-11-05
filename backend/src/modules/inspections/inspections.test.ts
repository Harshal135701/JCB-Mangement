import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import {
  getInspectionTemplate,
  createInspectionTemplate,
  getInspectionTemplatesList,
  getInspectionTemplateById,
  updateInspectionTemplate,
  toggleInspectionTemplateStatus,
  submitInspection,
  getInspectionRecords,
  getInspectionRecordById,
  setInspectionsDb,
  resetInspectionsDb,
  setInspectionsIo,
  resetInspectionsIo,
} from './inspections.controller';
import {
  DbClientLike,
  DbPoolLike,
  DEFAULT_HMC_CHECKLIST,
  getInspectionsServiceDb,
} from './inspections.service';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';

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
// Mock Types & In-Memory Database Engine
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
}

interface MockTemplate {
  id: string;
  machine_category: string;
  title: string;
  checklist: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MockRecord {
  id: string;
  machine_id: string;
  operator_id: string;
  shift: string;
  overall_status: string;
  temperature: number | null;
  pressure: number | null;
  vibration: number | null;
  responses_json: any;
  operator_signature_url: string;
  created_at: Date;
}

interface MockAuditLog {
  id: string;
  entity_name: string;
  entity_id: string;
  action: string;
  performed_by: string;
  old_values: any;
  new_values: any;
  created_at: Date;
}

interface MockNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  read: boolean;
  created_at: Date;
}

interface MockMaintenanceRequest {
  id: string;
  complaint_number?: string;
  machine_id: string;
  reported_by_id: string;
  shift: string;
  issue_category: string;
  priority: string;
  problem_title: string;
  problem_description: string;
  status: string;
  created_at: Date;
}

class MockInspectionDatabase implements DbPoolLike {
  public plants: MockPlant[] = [];
  public shops: MockShop[] = [];
  public users: MockUser[] = [];
  public machines: MockMachine[] = [];
  public templates: MockTemplate[] = [];
  public records: MockRecord[] = [];
  public audit_logs: MockAuditLog[] = [];
  public notifications: MockNotification[] = [];
  public maintenance_requests: MockMaintenanceRequest[] = [];

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
        full_name: 'CNC Machine Operator Pune',
        email: 'operator1@jcb.com',
        role: 'operator',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        employee_code: 'EMP-OPR-02',
        full_name: 'Robot Operator BLB',
        email: 'operator2@jcb.com',
        role: 'operator',
        plant_id: '10000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000003',
        is_active: true,
      },
    ];

    this.machines = [
      {
        id: '40000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001', // Pune Shop 1
        machine_code: 'HMC-001',
        name: 'Makino 5-Axis HMC',
        category: 'HMC',
        criticality: 'class_a',
        status: 'running',
        operating_hours: 1540.0,
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000002', // Pune Shop 2
        machine_code: 'FAB-001',
        name: 'Trumpf Laser Cutting Cell',
        category: 'Laser',
        criticality: 'class_b',
        status: 'running',
        operating_hours: 2100.0,
      },
      {
        id: '40000000-0000-0000-0000-000000000003',
        shop_id: '20000000-0000-0000-0000-000000000003', // Ballabgarh Plant 2
        machine_code: 'ROB-001',
        name: 'Fanuc Arc Welding Cell',
        category: 'Robot',
        criticality: 'class_a',
        status: 'running',
        operating_hours: 890.0,
      },
      {
        id: '40000000-0000-0000-0000-000000000099',
        shop_id: '20000000-0000-0000-0000-000000000099', // Non-existent shop (unlinked/broken machine)
        machine_code: 'ORPHAN-001',
        name: 'Orphaned Machine Asset',
        category: 'HMC',
        criticality: 'class_c',
        status: 'running',
        operating_hours: 0,
      },
    ];

    this.templates = [
      {
        id: '50000000-0000-0000-0000-000000000001',
        machine_category: 'HMC',
        title: 'HMC Daily Pre-Shift Checklist',
        checklist: {
          version: 1,
          items: [
            { id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', type: 'number', unit: 'Bar', min: 45, max: 55, critical_min: 35, critical_max: 70, required: true, is_critical: true },
            { id: 'chk-2', label: 'Chiller Unit Operating Temperature (18C - 24C)', type: 'number', unit: 'C', min: 18, max: 24, critical_min: 15, critical_max: 35, required: true, is_critical: false },
            { id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', type: 'boolean', required: true, is_critical: false },
            { id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', type: 'boolean', required: true, is_critical: true },
            { id: 'chk-5', label: 'Way Lube Automatic Lubrication Reservoir Full', type: 'boolean', required: true, is_critical: false },
          ],
          sensor_thresholds: {
            pressure: { min: 45, max: 55, critical_min: 35, critical_max: 70, unit: 'Bar' },
            temperature: { min: 18, max: 24, critical_min: 15, critical_max: 35, unit: 'C' },
            vibration: { max: 2.5, critical_max: 4.5, unit: 'mm/s' },
          },
        },
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000),
        updated_at: new Date(Date.now() - 30 * 86400000),
      },
      {
        id: '50000000-0000-0000-0000-000000000002',
        machine_category: 'Laser',
        title: 'Laser Cutting Cell Pre-Shift Checklist',
        checklist: {
          version: 1,
          items: [
            { id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', type: 'number', unit: 'Bar', min: 45, max: 55, critical_min: 35, critical_max: 70, required: true, is_critical: true },
            { id: 'chk-2', label: 'Chiller Unit Operating Temperature (18C - 24C)', type: 'number', unit: 'C', min: 18, max: 24, critical_min: 15, critical_max: 35, required: true, is_critical: false },
            { id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', type: 'boolean', required: true, is_critical: false },
            { id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', type: 'boolean', required: true, is_critical: true },
            { id: 'chk-5', label: 'Way Lube Automatic Lubrication Reservoir Full', type: 'boolean', required: true, is_critical: false },
          ],
          sensor_thresholds: {
            pressure: { min: 45, max: 55, critical_min: 35, critical_max: 70, unit: 'Bar' },
            temperature: { min: 18, max: 24, critical_min: 15, critical_max: 35, unit: 'C' },
            vibration: { max: 2.5, critical_max: 4.5, unit: 'mm/s' },
          },
        },
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000),
        updated_at: new Date(Date.now() - 30 * 86400000),
      },
      {
        id: '50000000-0000-0000-0000-000000000003',
        machine_category: 'Robot',
        title: 'Robotic Welding Cell Pre-Shift Checklist',
        checklist: {
          version: 1,
          items: [
            { id: 'chk-1', label: 'Hydraulic System Pressure within 45 - 55 Bar', type: 'number', unit: 'Bar', min: 45, max: 55, critical_min: 35, critical_max: 70, required: true, is_critical: true },
            { id: 'chk-2', label: 'Chiller Unit Operating Temperature (18C - 24C)', type: 'number', unit: 'C', min: 18, max: 24, critical_min: 15, critical_max: 35, required: true, is_critical: false },
            { id: 'chk-3', label: 'Visual Check: No hydraulic fluid pooling or line leaks', type: 'boolean', required: true, is_critical: false },
            { id: 'chk-4', label: 'Emergency Stop & Safety Enclosure Interlock Operational', type: 'boolean', required: true, is_critical: true },
            { id: 'chk-5', label: 'Way Lube Automatic Lubrication Reservoir Full', type: 'boolean', required: true, is_critical: false },
          ],
          sensor_thresholds: {
            pressure: { min: 45, max: 55, critical_min: 35, critical_max: 70, unit: 'Bar' },
            temperature: { min: 18, max: 24, critical_min: 15, critical_max: 35, unit: 'C' },
            vibration: { max: 2.5, critical_max: 4.5, unit: 'mm/s' },
          },
        },
        is_active: true,
        created_at: new Date(Date.now() - 30 * 86400000),
        updated_at: new Date(Date.now() - 30 * 86400000),
      },
    ];

    this.records = [
      {
        id: '60000000-0000-0000-0000-000000000001',
        machine_id: '40000000-0000-0000-0000-000000000001', // Pune Machine 1 (Shop 1 - CNC)
        operator_id: '00000000-0000-0000-0000-000000000005', // Pune Operator
        shift: 'Shift A',
        overall_status: 'pass',
        temperature: 21.5,
        pressure: 49.0,
        vibration: 1.2,
        responses_json: {
          template_id: '50000000-0000-0000-0000-000000000001',
          template_version: 1,
          evaluation_summary: { overall_status: 'pass' },
          items: [{ id: 'chk-1', status: 'pass' }],
        },
        operator_signature_url: 'https://storage.jcb.com/signatures/emp-opr-01.png',
        created_at: new Date(Date.now() - 2 * 86400000),
      },
      {
        id: '60000000-0000-0000-0000-000000000002',
        machine_id: '40000000-0000-0000-0000-000000000003', // BLB Machine 3 (Shop 3 - Robotic Welding)
        operator_id: '00000000-0000-0000-0000-000000000006', // BLB Operator
        shift: 'Shift B',
        overall_status: 'flagged',
        temperature: 28.0,
        pressure: 42.0,
        vibration: 2.8,
        responses_json: {
          template_id: '50000000-0000-0000-0000-000000000001',
          template_version: 1,
          evaluation_summary: { overall_status: 'flagged' },
          items: [{ id: 'chk-1', status: 'flagged' }],
        },
        operator_signature_url: 'https://storage.jcb.com/signatures/emp-opr-02.png',
        created_at: new Date(Date.now() - 1 * 86400000),
      },
      {
        id: '60000000-0000-0000-0000-000000000003',
        machine_id: '40000000-0000-0000-0000-000000000002', // Pune Machine 2 (Shop 2 - Fabrication)
        operator_id: '00000000-0000-0000-0000-000000000005',
        shift: 'Shift A',
        overall_status: 'pass',
        temperature: 22.0,
        pressure: 50.0,
        vibration: 1.0,
        responses_json: {
          template_id: '50000000-0000-0000-0000-000000000001',
          template_version: 1,
          evaluation_summary: { overall_status: 'pass' },
          items: [{ id: 'chk-1', status: 'pass' }],
        },
        operator_signature_url: 'https://storage.jcb.com/signatures/emp-opr-01.png',
        created_at: new Date(Date.now() - 3 * 86400000),
      },
    ];

    this.audit_logs = [];
    this.notifications = [];
    this.maintenance_requests = [];
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

    // 1. Transaction controls
    if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }

    // 2. Fetch machine with shop & plant (supports JOIN and LEFT JOIN)
    if (trimmed.includes('FROM machines m') && trimmed.includes('shops s ON m.shop_id = s.id') && trimmed.includes('WHERE m.id = $1')) {
      const machineId = params[0];
      const m = this.machines.find((x) => x.id === machineId);
      if (!m) return { rows: [], rowCount: 0 };
      const shop = this.shops.find((s) => s.id === m.shop_id);
      const plant = shop ? this.plants.find((p) => p.id === shop.plant_id) : undefined;
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

    // 3. Fetch template by ID
    if (trimmed.includes('FROM inspection_templates') && trimmed.includes('WHERE id = $1')) {
      const templateId = params[0];
      const t = this.templates.find((x) => x.id === templateId);
      return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
    }

    // 4. Fetch inspection template by machine category (case-insensitive or active)
    if (
      trimmed.includes('FROM inspection_templates') &&
      (trimmed.includes('LOWER(machine_category) = LOWER($1)') || trimmed.includes('machine_category = $1'))
    ) {
      const category = params[0];
      const t = this.templates.find(
        (x) => x.machine_category.toLowerCase() === (category || '').toLowerCase() && x.is_active
      );
      return { rows: t ? [t] : [], rowCount: t ? 1 : 0 };
    }

    // 5. Count templates for listing
    if (trimmed.includes('SELECT COUNT(id) as total FROM inspection_templates')) {
      let filtered = [...this.templates];
      if (trimmed.includes('LOWER(machine_category) = LOWER($')) {
        const catIdx = trimmed.indexOf('LOWER(machine_category) = LOWER($');
        const paramNum = parseInt(trimmed.substring(catIdx + 33, catIdx + 35), 10);
        const cat = params[paramNum - 1];
        filtered = filtered.filter((t) => t.machine_category.toLowerCase() === cat.toLowerCase());
      }
      if (trimmed.includes('is_active = $')) {
        const actIdx = trimmed.indexOf('is_active = $');
        const paramNum = parseInt(trimmed.substring(actIdx + 13, actIdx + 15), 10);
        const act = params[paramNum - 1];
        filtered = filtered.filter((t) => t.is_active === act);
      }
      return { rows: [{ total: filtered.length }], rowCount: 1 };
    }

    // 6. List templates
    if (trimmed.includes('SELECT * FROM inspection_templates') && trimmed.includes('ORDER BY created_at DESC')) {
      let filtered = [...this.templates];
      if (trimmed.includes('LOWER(machine_category) = LOWER($')) {
        const catIdx = trimmed.indexOf('LOWER(machine_category) = LOWER($');
        const paramNum = parseInt(trimmed.substring(catIdx + 33, catIdx + 35), 10);
        const cat = params[paramNum - 1];
        filtered = filtered.filter((t) => t.machine_category.toLowerCase() === cat.toLowerCase());
      }
      if (trimmed.includes('is_active = $')) {
        const actIdx = trimmed.indexOf('is_active = $');
        const paramNum = parseInt(trimmed.substring(actIdx + 13, actIdx + 15), 10);
        const act = params[paramNum - 1];
        filtered = filtered.filter((t) => t.is_active === act);
      }
      return { rows: filtered, rowCount: filtered.length };
    }

    // 7. Insert inspection template
    if (trimmed.startsWith('INSERT INTO inspection_templates')) {
      const [machine_category, title, checklist, is_active] = params;
      const newT: MockTemplate = {
        id: `50000000-0000-0000-0000-${String(this.templates.length + 1).padStart(12, '0')}`,
        machine_category,
        title,
        checklist: typeof checklist === 'string' ? JSON.parse(checklist) : checklist,
        is_active: is_active !== false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.templates.push(newT);
      return { rows: [newT], rowCount: 1 };
    }

    // 8. Update inspection template (full or toggle)
    if (trimmed.startsWith('UPDATE inspection_templates')) {
      if (trimmed.includes('SET title = $1')) {
        const [title, checklist, is_active, templateId] = params;
        const idx = this.templates.findIndex((t) => t.id === templateId);
        if (idx >= 0) {
          this.templates[idx] = {
            ...this.templates[idx],
            title,
            checklist: typeof checklist === 'string' ? JSON.parse(checklist) : checklist,
            is_active,
            updated_at: new Date(),
          };
          return { rows: [this.templates[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (trimmed.includes('SET is_active = $1')) {
        const [is_active, templateId] = params;
        const idx = this.templates.findIndex((t) => t.id === templateId);
        if (idx >= 0) {
          this.templates[idx] = {
            ...this.templates[idx],
            is_active,
            updated_at: new Date(),
          };
          return { rows: [this.templates[idx]], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
    }

    // 9. Insert audit log
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const [entity_name, entity_id, action, performed_by, old_values, new_values] = params;
      const log: MockAuditLog = {
        id: `audit-${this.audit_logs.length + 1}`,
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

    // 10. Insert notification
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const [user_id, title, message, type, link] = params;
      const notif: MockNotification = {
        id: `notif-${this.notifications.length + 1}`,
        user_id,
        title,
        message,
        type,
        link,
        read: false,
        created_at: new Date(),
      };
      this.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // Advisory lock for complaint numbering concurrency
    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [], rowCount: 1 };
    }

    // Duplicate complaint check on maintenance_requests
    if (trimmed.includes('FROM maintenance_requests') && trimmed.includes('status NOT IN')) {
      const machineId = params[0];
      const cat = params[1];
      const match = this.maintenance_requests.find(
        (mr) => mr.machine_id === machineId && mr.issue_category?.toLowerCase() === (cat || '').toLowerCase() && !['closed', 'rejected'].includes(mr.status)
      );
      return { rows: match ? [match] : [], rowCount: match ? 1 : 0 };
    }

    // Max complaint number sequence query
    if (trimmed.includes('SELECT COALESCE(MAX') || trimmed.includes('next_seq')) {
      return { rows: [{ next_seq: this.maintenance_requests.length + 1 }], rowCount: 1 };
    }

    // 11. Select managers for notification
    if (
      trimmed.includes('FROM users') &&
      (trimmed.includes(`role = 'manager'`) || trimmed.includes(`role IN ('admin', 'manager')`))
    ) {
      const plantId = params[0];
      const mgrs = this.users.filter(
        (u) => (!plantId || u.plant_id === plantId || u.role === 'admin') && ['admin', 'manager'].includes(u.role) && u.is_active
      );
      return { rows: mgrs.map((m) => ({ id: m.id })), rowCount: mgrs.length };
    }

    // Machine status update to breakdown
    if (trimmed.startsWith('UPDATE machines SET status =') || trimmed.includes("status = 'breakdown'")) {
      const mId = params[params.length - 1];
      const m = this.machines.find((x) => x.id === mId);
      if (m) m.status = 'breakdown';
      return { rows: m ? [m] : [], rowCount: m ? 1 : 0 };
    }

    // 12. Insert maintenance request (breakdown escalation via Module 2 service)
    if (trimmed.startsWith('INSERT INTO maintenance_requests')) {
      let complaint_number = `CMP-2026-${String(this.maintenance_requests.length + 1).padStart(5, '0')}`;
      let machine_id: string;
      let reported_by_id: string;
      let shift: string;
      let issue_category: string;
      let priority = 'critical';
      let problem_title: string;
      let problem_description: string;

      if (trimmed.includes('complaint_number')) {
        complaint_number = params[0];
        machine_id = params[1];
        reported_by_id = params[2];
        shift = params[3];
        issue_category = params[4];
        priority = params[5];
        problem_title = params[10];
        problem_description = params[11];
      } else {
        machine_id = params[0];
        reported_by_id = params[1];
        shift = params[2];
        issue_category = params[3];
        problem_title = params[4];
        problem_description = params[5];
      }

      const mr: MockMaintenanceRequest = {
        id: `mr-${this.maintenance_requests.length + 1}`,
        complaint_number,
        machine_id,
        reported_by_id,
        shift,
        issue_category,
        priority,
        problem_title,
        problem_description,
        status: 'new',
        created_at: new Date(),
      };
      this.maintenance_requests.push(mr);
      return { rows: [mr], rowCount: 1 };
    }

    // 13. Single record detail query: SELECT ir.*, m.machine_code ... FROM inspection_records ir ... WHERE ir.id = $1
    if (trimmed.includes('FROM inspection_records ir') && trimmed.includes('WHERE ir.id = $1')) {
      const recordId = params[0];
      const r = this.records.find((x) => x.id === recordId);
      if (!r) return { rows: [], rowCount: 0 };
      const m = this.machines.find((x) => x.id === r.machine_id);
      const s = this.shops.find((sh) => sh.id === m?.shop_id);
      const p = s ? this.plants.find((pl) => pl.id === s.plant_id) : undefined;
      const u = this.users.find((usr) => usr.id === r.operator_id);
      return {
        rows: [
          {
            ...r,
            machine_code: m?.machine_code,
            machine_name: m?.name,
            machine_category: m?.category,
            shop_id: s?.id,
            plant_id: s?.plant_id,
            shop_name: s?.shop_name,
            plant_name: p?.plant_name,
            operator_name: u?.full_name,
            operator_employee_code: u?.employee_code,
          },
        ],
        rowCount: 1,
      };
    }

    // 14. Insert inspection record
    if (trimmed.startsWith('INSERT INTO inspection_records')) {
      const [
        machine_id,
        operator_id,
        shift,
        overall_status,
        temperature,
        pressure,
        vibration,
        responses_json,
        operator_signature_url,
      ] = params;

      const newRec: MockRecord = {
        id: `60000000-0000-0000-0000-${String(this.records.length + 1).padStart(12, '0')}`,
        machine_id,
        operator_id,
        shift,
        overall_status,
        temperature: temperature !== null ? Number(temperature) : null,
        pressure: pressure !== null ? Number(pressure) : null,
        vibration: vibration !== null ? Number(vibration) : null,
        responses_json: typeof responses_json === 'string' ? JSON.parse(responses_json) : responses_json,
        operator_signature_url: operator_signature_url || '',
        created_at: new Date(),
      };
      this.records.push(newRec);
      return { rows: [newRec], rowCount: 1 };
    }

    // 15. Count inspection records for listing
    if (trimmed.includes('SELECT COUNT(ir.id) as total') && trimmed.includes('FROM inspection_records ir')) {
      let filtered = [...this.records];
      if (trimmed.includes('s.plant_id = $')) {
        const plantParamIndex = trimmed.indexOf('s.plant_id = $');
        const paramNum = parseInt(trimmed.substring(plantParamIndex + 14, plantParamIndex + 16), 10);
        const plantId = params[paramNum - 1];
        filtered = filtered.filter((r) => {
          const m = this.machines.find((x) => x.id === r.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          return s?.plant_id === plantId;
        });
      }
      if (trimmed.includes('m.shop_id = $')) {
        const shopParamIndex = trimmed.indexOf('m.shop_id = $');
        const paramNum = parseInt(trimmed.substring(shopParamIndex + 13, shopParamIndex + 15), 10);
        const shopId = params[paramNum - 1];
        filtered = filtered.filter((r) => {
          const m = this.machines.find((x) => x.id === r.machine_id);
          return m?.shop_id === shopId;
        });
      }
      if (trimmed.includes('ir.machine_id = $')) {
        const mParamIndex = trimmed.indexOf('ir.machine_id = $');
        const paramNum = parseInt(trimmed.substring(mParamIndex + 16, mParamIndex + 18), 10);
        const machineId = params[paramNum - 1];
        filtered = filtered.filter((r) => r.machine_id === machineId);
      }
      if (trimmed.includes('ir.shift = $')) {
        const sParamIndex = trimmed.indexOf('ir.shift = $');
        const paramNum = parseInt(trimmed.substring(sParamIndex + 12, sParamIndex + 14), 10);
        const shiftVal = params[paramNum - 1];
        filtered = filtered.filter((r) => r.shift === shiftVal);
      }
      if (trimmed.includes('LOWER(ir.overall_status) = $')) {
        const stParamIndex = trimmed.indexOf('LOWER(ir.overall_status) = $');
        const paramNum = parseInt(trimmed.substring(stParamIndex + 28, stParamIndex + 30), 10);
        const statusVal = params[paramNum - 1];
        filtered = filtered.filter((r) => r.overall_status.toLowerCase() === statusVal.toLowerCase());
      }
      return { rows: [{ total: filtered.length }], rowCount: 1 };
    }

    // 16. Data query for inspection records listing
    if (trimmed.includes('SELECT') && trimmed.includes('FROM inspection_records ir')) {
      let filtered = [...this.records];
      if (trimmed.includes('s.plant_id = $')) {
        const plantParamIndex = trimmed.indexOf('s.plant_id = $');
        const paramNum = parseInt(trimmed.substring(plantParamIndex + 14, plantParamIndex + 16), 10);
        const plantId = params[paramNum - 1];
        filtered = filtered.filter((r) => {
          const m = this.machines.find((x) => x.id === r.machine_id);
          const s = this.shops.find((sh) => sh.id === m?.shop_id);
          return s?.plant_id === plantId;
        });
      }
      if (trimmed.includes('m.shop_id = $')) {
        const shopParamIndex = trimmed.indexOf('m.shop_id = $');
        const paramNum = parseInt(trimmed.substring(shopParamIndex + 13, shopParamIndex + 15), 10);
        const shopId = params[paramNum - 1];
        filtered = filtered.filter((r) => {
          const m = this.machines.find((x) => x.id === r.machine_id);
          return m?.shop_id === shopId;
        });
      }
      if (trimmed.includes('ir.machine_id = $')) {
        const mParamIndex = trimmed.indexOf('ir.machine_id = $');
        const paramNum = parseInt(trimmed.substring(mParamIndex + 16, mParamIndex + 18), 10);
        const machineId = params[paramNum - 1];
        filtered = filtered.filter((r) => r.machine_id === machineId);
      }
      if (trimmed.includes('ir.shift = $')) {
        const sParamIndex = trimmed.indexOf('ir.shift = $');
        const paramNum = parseInt(trimmed.substring(sParamIndex + 12, sParamIndex + 14), 10);
        const shiftVal = params[paramNum - 1];
        filtered = filtered.filter((r) => r.shift === shiftVal);
      }
      if (trimmed.includes('LOWER(ir.overall_status) = $')) {
        const stParamIndex = trimmed.indexOf('LOWER(ir.overall_status) = $');
        const paramNum = parseInt(trimmed.substring(stParamIndex + 28, stParamIndex + 30), 10);
        const statusVal = params[paramNum - 1];
        filtered = filtered.filter((r) => r.overall_status.toLowerCase() === statusVal.toLowerCase());
      }

      const rows = filtered.map((r) => {
        const m = this.machines.find((x) => x.id === r.machine_id);
        const s = this.shops.find((sh) => sh.id === m?.shop_id);
        const u = this.users.find((usr) => usr.id === r.operator_id);
        return {
          ...r,
          machine_code: m?.machine_code,
          machine_name: m?.name,
          shop_name: s?.shop_name,
          plant_id: s?.plant_id,
          operator_name: u?.full_name,
        };
      });

      return { rows, rowCount: rows.length };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Standard Valid Fixtures
// ---------------------------------------------------------------------------
const validHmcResponses = [
  { id: 'chk-1', value: 50 },
  { id: 'chk-2', value: 21 },
  { id: 'chk-3', value: true },
  { id: 'chk-4', value: true },
  { id: 'chk-5', value: true },
];

const standardValidSubmission = {
  shift: 'Shift A',
  temperature: 21.0,
  pressure: 50.0,
  vibration: 1.2,
  responses: validHmcResponses,
  operator_signature_url: 'https://storage.jcb.com/signatures/emp-opr-01.png',
};

// ---------------------------------------------------------------------------
// TEST SUITE: Module 7 — Inspection Management
// ---------------------------------------------------------------------------
describe('JCB CMMS Module 7 — Inspection Management (Phase 1 & Phase 2)', () => {
  let mockDb: MockInspectionDatabase;
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

  const managerBLB: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000003',
    employee_code: 'EMP-MGR-02',
    email: 'manager.blb@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000002',
    shop_id: '20000000-0000-0000-0000-000000000003',
  };

  const techPune: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-TEC-01',
    email: 'tech1@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const operatorPune: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000005',
    employee_code: 'EMP-OPR-01',
    email: 'operator1@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const operatorBLB: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000006',
    employee_code: 'EMP-OPR-02',
    email: 'operator2@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000002',
    shop_id: '20000000-0000-0000-0000-000000000003',
  };

  const managerPunePlantWide: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000010',
    employee_code: 'EMP-MGR-PW',
    email: 'manager.plantwide@jcb.com',
    role: 'manager',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: undefined, // Explicit null/undefined shop_id for Plant Manager policy
  };

  const techPunePlantWide: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000011',
    employee_code: 'EMP-TEC-PW',
    email: 'tech.plantwide@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: undefined, // Explicit null/undefined shop_id for Plant Maintenance Tech policy
  };

  const userWithoutPlant: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000097',
    employee_code: 'EMP-NOPLANT',
    email: 'noplant@jcb.com',
    role: 'manager',
    plant_id: undefined, // Missing plant_id
    shop_id: undefined,
  };

  const operatorWithoutShop: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000098',
    employee_code: 'EMP-NOSHOP',
    email: 'noshop@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: undefined, // Missing shop_id
  };

  beforeEach(() => {
    mockDb = new MockInspectionDatabase();
    mockIo = new MockSocketIO();
    setInspectionsDb(mockDb);
    setInspectionsIo(mockIo);
  });

  // -------------------------------------------------------------------------
  // 1. Authentication & Role-Based Access Control
  // -------------------------------------------------------------------------
  describe('1. Authentication & Role-Based Access Control (RBAC)', () => {
    it('1. Unauthenticated request without JWT returns HTTP 401 Unauthorized', async () => {
      const { req, res, next } = createMockContext();
      await getInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 401);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Authentication required/i);
    });

    it('2. requireRoles middleware rejects unauthorized role with HTTP 403 Forbidden', () => {
      const guard = requireRoles('admin', 'manager');
      const { req, res, next } = createMockContext({}, {}, {}, {}, {
        id: 'user-guest',
        employee_code: 'EMP-GST',
        email: 'guest@jcb.com',
        role: 'guest',
      });
      guard(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /do not have permission/i);
    });

    it('3. Admin user has universal access across all plants and operations', async () => {
      const { req, res, next } = createMockContext({}, {}, { category: 'HMC' }, {}, adminUser);
      await getInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Facility Tenancy & Scope Enforcement
  // -------------------------------------------------------------------------
  describe('2. Facility Tenancy & Scope Enforcement', () => {
    it('4. Pune Manager can view templates and records in Pune Plant 1', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, managerPune);
      await getInspectionRecords(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(res.responseData.data.every((r: any) => r.plant_id === managerPune.plant_id));
    });

    it('5. Pune Manager cannot submit inspection for machine in Ballabgarh Plant 2 (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000003', ...standardValidSubmission },
        {},
        {},
        {},
        managerPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Forbidden.*another plant/i);
    });

    it('6. Ballabgarh Manager cannot access records for machine in Pune Plant 1 (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { machine_id: '40000000-0000-0000-0000-000000000001' },
        {},
        managerBLB
      );
      await getInspectionRecords(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Forbidden.*another plant/i);
    });

    it('7. Pune Operator can submit inspection for machine in their assigned shop (HTTP 201 Created)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        operatorPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.operator_id, operatorPune.id);
      assert.equal(res.responseData.data.shift, 'Shift A');
    });

    it('8. Pune Operator cannot submit inspection for machine in another shop within same plant (HTTP 403 Forbidden)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000002', // Machine in Shop 2 (Fabrication)
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        operatorPune // Assigned to Shop 1 (CNC)
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /assigned shop|authorized scope/i);
    });

    it('9. Operator ID impersonation prevention: operator_id is strictly bound to authenticated user', async () => {
      const spoofedOperatorId = '00000000-0000-0000-0000-000000000099';
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          operator_id: spoofedOperatorId,
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        operatorPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.operator_id, operatorPune.id);
      assert.notEqual(res.responseData.data.operator_id, spoofedOperatorId);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Input Validation & Error Handling
  // -------------------------------------------------------------------------
  describe('3. Parameterized SQL, Input Validation & Clean Error Handling', () => {
    it('10. Missing machine_id in submitInspection returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Machine ID is mandatory/i);
    });

    it('11. Malformed machine_id (not a UUID) returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        { machine_id: 'invalid-not-a-uuid-123', ...standardValidSubmission },
        {},
        {},
        {},
        operatorPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Must be a valid UUID/i);
    });

    it('12. Nonexistent machine_id returns HTTP 404 Not Found without leaking internal SQL', async () => {
      const { req, res, next } = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000999', ...standardValidSubmission },
        {},
        {},
        {},
        operatorPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Machine asset not found/i);
    });

    it('13. Malformed machine_id in getInspectionRecords query returns HTTP 400 Bad Request', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { machine_id: 'bad-uuid-syntax' },
        {},
        managerPune
      );
      await getInspectionRecords(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Invalid machine ID format/i);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Backward Compatibility of Existing Contracts
  // -------------------------------------------------------------------------
  describe('4. Backward Compatibility of Existing Endpoints', () => {
    it('14. GET /template returns customized template from database when configured', async () => {
      const { req, res, next } = createMockContext({}, {}, { category: 'HMC' }, {}, operatorPune);
      await getInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.machine_category, 'HMC');
      assert.equal(res.responseData.data.title, 'HMC Daily Pre-Shift Checklist');
      assert.ok(Array.isArray(res.responseData.data.checklist));
    });

    it('15. GET /template returns HTTP 404 configuration error when machine category has no active template', async () => {
      const { req, res, next } = createMockContext({}, {}, { category: 'UNKNOWN_CAT' }, {}, operatorPune);
      await getInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /No active inspection template configured for machine category 'UNKNOWN_CAT'/i);
    });

    it('16. POST /submit returns HTTP 201 with standard response shape { success, message, data }', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        operatorPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.message, 'Inspection submitted successfully.');
      assert.ok(res.responseData.data.id);
    });

    it('17. GET /records returns HTTP 200 with data array and pagination metadata', async () => {
      const { req, res, next } = createMockContext({}, {}, { page: '1', limit: '10' }, {}, managerPune);
      await getInspectionRecords(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.ok(typeof res.responseData.pagination === 'object');
      assert.equal(res.responseData.pagination.page, 1);
      assert.equal(res.responseData.pagination.limit, 10);
    });

    it('18. GET /records filters by shift and overall_status correctly', async () => {
      const { req, res, next } = createMockContext({}, {}, { shift: 'Shift A', overall_status: 'pass' }, {}, managerPune);
      await getInspectionRecords(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.every((r: any) => r.shift === 'Shift A' && r.overall_status === 'pass'));
    });
  });

  // -------------------------------------------------------------------------
  // 5. Fail-Closed Scope, Role Policies & Scope Bypass Protections
  // -------------------------------------------------------------------------
  describe('5. Fail-Closed Scope, Role Policies & Scope Bypass Protections', () => {
    it('19. Missing user plant ID rejects non-admin request with HTTP 403 Forbidden (fail-closed)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        userWithoutPlant
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /plant context is required/i);
    });

    it('20. Missing operator shop ID rejects operator request with HTTP 403 Forbidden (fail-closed)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000001',
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        operatorWithoutShop
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Operator must be assigned to a valid shop/i);
    });

    it('21. Machine asset with missing plant/shop facility information rejects access with HTTP 403 Forbidden (fail-closed)', async () => {
      const { req, res, next } = createMockContext(
        {
          machine_id: '40000000-0000-0000-0000-000000000099',
          ...standardValidSubmission,
        },
        {},
        {},
        {},
        managerPune
      );
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /lacks valid plant or shop facility assignment/i);
    });

    it('22. Manager with null shop ID under Plant Manager policy: has plant-wide access across all shops within plant, rejected for other plants', async () => {
      const ctxM1 = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000001', ...standardValidSubmission },
        {},
        {},
        {},
        managerPunePlantWide
      );
      await submitInspection(ctxM1.req, ctxM1.res, ctxM1.next);
      assert.equal(ctxM1.res.statusCode, 201);

      const ctxM2 = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000002', ...standardValidSubmission },
        {},
        {},
        {},
        managerPunePlantWide
      );
      await submitInspection(ctxM2.req, ctxM2.res, ctxM2.next);
      assert.equal(ctxM2.res.statusCode, 201);

      const ctxBLB = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000003', ...standardValidSubmission },
        {},
        {},
        {},
        managerPunePlantWide
      );
      await submitInspection(ctxBLB.req, ctxBLB.res, ctxBLB.next);
      assert.equal(ctxBLB.res.statusCode, 403);
      assert.match(ctxBLB.res.responseData.message, /another plant outside your authorized scope/i);
    });

    it('23. Technician with null shop ID under Plant Maintenance Specialist policy: has plant-wide access across all shops within plant, rejected for other plants', async () => {
      const ctxT1 = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000001', ...standardValidSubmission },
        {},
        {},
        {},
        techPunePlantWide
      );
      await submitInspection(ctxT1.req, ctxT1.res, ctxT1.next);
      assert.equal(ctxT1.res.statusCode, 201);

      const ctxT2 = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000002', ...standardValidSubmission },
        {},
        {},
        {},
        techPunePlantWide
      );
      await submitInspection(ctxT2.req, ctxT2.res, ctxT2.next);
      assert.equal(ctxT2.res.statusCode, 201);

      const ctxBLB = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000003', ...standardValidSubmission },
        {},
        {},
        {},
        techPunePlantWide
      );
      await submitInspection(ctxBLB.req, ctxBLB.res, ctxBLB.next);
      assert.equal(ctxBLB.res.statusCode, 403);
      assert.match(ctxBLB.res.responseData.message, /another plant outside your authorized scope/i);
    });

    it('24. Technician with shop_id under Shop Technician policy: restricted strictly to assigned shop within plant', async () => {
      const ctxOK = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000001', ...standardValidSubmission },
        {},
        {},
        {},
        techPune
      );
      await submitInspection(ctxOK.req, ctxOK.res, ctxOK.next);
      assert.equal(ctxOK.res.statusCode, 201);

      const ctxBlocked = createMockContext(
        { machine_id: '40000000-0000-0000-0000-000000000002', ...standardValidSubmission },
        {},
        {},
        {},
        techPune
      );
      await submitInspection(ctxBlocked.req, ctxBlocked.res, ctxBlocked.next);
      assert.equal(ctxBlocked.res.statusCode, 403);
      assert.match(ctxBlocked.res.responseData.message, /another shop outside your authorized assigned shop/i);
    });

    it('25. Cross-plant and cross-shop record listing without machine filter: strictly isolates records according to facility scope', async () => {
      const ctxMgr = createMockContext({}, {}, {}, {}, managerPunePlantWide);
      await getInspectionRecords(ctxMgr.req, ctxMgr.res, ctxMgr.next);
      assert.equal(ctxMgr.res.statusCode, 200);
      assert.equal(ctxMgr.res.responseData.data.length, 2);
      assert.ok(ctxMgr.res.responseData.data.every((r: any) => r.plant_id === '10000000-0000-0000-0000-000000000001'));

      const ctxOp = createMockContext({}, {}, {}, {}, operatorPune);
      await getInspectionRecords(ctxOp.req, ctxOp.res, ctxOp.next);
      assert.equal(ctxOp.res.statusCode, 200);
      assert.equal(ctxOp.res.responseData.data.length, 1);
      assert.equal(ctxOp.res.responseData.data[0].machine_id, '40000000-0000-0000-0000-000000000001');

      const ctxBLB = createMockContext({}, {}, {}, {}, managerBLB);
      await getInspectionRecords(ctxBLB.req, ctxBLB.res, ctxBLB.next);
      assert.equal(ctxBLB.res.statusCode, 200);
      assert.equal(ctxBLB.res.responseData.data.length, 1);
      assert.equal(ctxBLB.res.responseData.data[0].machine_id, '40000000-0000-0000-0000-000000000003');
    });

    it('26. Query parameter scope bypass prevention: non-admin attempting to query another plant or shop via query parameters is rejected with HTTP 403 Forbidden', async () => {
      const ctxPlantBypass = createMockContext(
        {},
        {},
        { plant_id: '10000000-0000-0000-0000-000000000002' },
        {},
        managerPune
      );
      await getInspectionRecords(ctxPlantBypass.req, ctxPlantBypass.res, ctxPlantBypass.next);
      assert.equal(ctxPlantBypass.res.statusCode, 403);
      assert.match(ctxPlantBypass.res.responseData.message, /Cannot access records for another plant/i);

      const ctxShopBypass = createMockContext(
        {},
        {},
        { shop_id: '20000000-0000-0000-0000-000000000002' },
        {},
        operatorPune
      );
      await getInspectionRecords(ctxShopBypass.req, ctxShopBypass.res, ctxShopBypass.next);
      assert.equal(ctxShopBypass.res.statusCode, 403);
      assert.match(ctxShopBypass.res.responseData.message, /Cannot access records for another shop/i);
    });

    it('27. Test environment transparency: verifies test suite runs against MockInspectionDatabase adapter and reports active instance', () => {
      const activeDb = getInspectionsServiceDb();
      assert.ok(activeDb instanceof MockInspectionDatabase, 'Expected active DB to be an instance of MockInspectionDatabase');
      console.log(`[Inspection Test Info] Verified active injected database adapter: ${activeDb.constructor.name}`);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Inspection Template Management & Versioning (Phase 2)
  // -------------------------------------------------------------------------
  describe('6. Inspection Template Management & Versioning (Phase 2)', () => {
    it('28. Admin can create a new inspection template with version 1 (HTTP 201 Created)', async () => {
      const newTemplateBody = {
        machine_category: 'Press',
        title: 'Hydraulic Press Pre-Shift Checklist',
        checklist: [
          { id: 'prs-1', label: 'Main Ram Pressure (150 - 220 Bar)', type: 'number', unit: 'Bar', min: 150, max: 220, critical_min: 120, critical_max: 260, required: true, is_critical: true },
          { id: 'prs-2', label: 'Emergency Stop Buttons Fully Responsive', type: 'boolean', required: true, is_critical: true },
        ],
        sensor_thresholds: {
          pressure: { min: 150, max: 220, critical_min: 120, critical_max: 260, unit: 'Bar' },
          temperature: { min: 25, max: 45, critical_min: 20, critical_max: 60, unit: 'C' },
        },
      };

      const { req, res, next } = createMockContext(newTemplateBody, {}, {}, {}, adminUser);
      await createInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.title, 'Hydraulic Press Pre-Shift Checklist');
      assert.equal(res.responseData.data.machine_category, 'Press');
      assert.equal(res.responseData.data.version, 1);
      assert.equal(res.responseData.data.is_active, true);
      assert.ok(Array.isArray(res.responseData.data.checklist));
      assert.equal(res.responseData.data.checklist.length, 2);
    });

    it('29. Manager with plant context can create an inspection template', async () => {
      const newTemplateBody = {
        machine_category: 'Laser',
        title: 'Laser Cutting Cell Pre-Shift Checklist',
        checklist: [
          { id: 'lsr-1', label: 'Assist Gas Pressure (15 - 20 Bar)', type: 'number', min: 15, max: 20, required: true },
          { id: 'lsr-2', label: 'Nozzle Alignment & Centering Confirmed', type: 'boolean', required: true },
        ],
      };

      const { req, res, next } = createMockContext(newTemplateBody, {}, {}, {}, managerPune);
      await createInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.machine_category, 'Laser');
      assert.equal(res.responseData.data.version, 1);
    });

    it('30. Technician and Operator cannot create inspection templates (HTTP 403 Forbidden)', async () => {
      const newTemplateBody = {
        machine_category: 'Laser',
        title: 'Unauthorized Template',
        checklist: [{ id: 'chk-1', label: 'Check 1', type: 'boolean' }],
      };

      const ctxTech = createMockContext(newTemplateBody, {}, {}, {}, techPune);
      await createInspectionTemplate(ctxTech.req, ctxTech.res, ctxTech.next);
      assert.equal(ctxTech.res.statusCode, 403);
      assert.match(ctxTech.res.responseData.message, /Forbidden.*admins and managers/i);

      const ctxOp = createMockContext(newTemplateBody, {}, {}, {}, operatorPune);
      await createInspectionTemplate(ctxOp.req, ctxOp.res, ctxOp.next);
      assert.equal(ctxOp.res.statusCode, 403);
      assert.match(ctxOp.res.responseData.message, /Forbidden.*admins and managers/i);
    });

    it('31. Template creation validation: rejects empty title or category with HTTP 400 Bad Request', async () => {
      const invalidBody1 = {
        machine_category: '   ',
        title: 'Valid Title',
        checklist: [{ id: 'c1', label: 'Item 1', type: 'boolean' }],
      };
      const ctx1 = createMockContext(invalidBody1, {}, {}, {}, adminUser);
      await createInspectionTemplate(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.match(ctx1.res.responseData.message, /machine category is required/i);

      const invalidBody2 = {
        machine_category: 'HMC',
        title: '   ',
        checklist: [{ id: 'c1', label: 'Item 1', type: 'boolean' }],
      };
      const ctx2 = createMockContext(invalidBody2, {}, {}, {}, adminUser);
      await createInspectionTemplate(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);
      assert.match(ctx2.res.responseData.message, /title is required/i);
    });

    it('32. Template creation validation: rejects duplicate checklist item IDs (HTTP 400 Bad Request)', async () => {
      const duplicateBody = {
        machine_category: 'HMC',
        title: 'Duplicate Item IDs Test',
        checklist: [
          { id: 'dup-1', label: 'Item 1', type: 'boolean' },
          { id: 'dup-1', label: 'Item 2', type: 'boolean' },
        ],
      };
      const { req, res, next } = createMockContext(duplicateBody, {}, {}, {}, adminUser);
      await createInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /Duplicate checklist item ID/i);
    });

    it('33. Template creation validation: rejects unsupported item types and inverted numeric limits (HTTP 400)', async () => {
      const invalidType = {
        machine_category: 'HMC',
        title: 'Invalid Type Template',
        checklist: [{ id: 'c1', label: 'Item 1', type: 'datetime' as any }],
      };
      const ctx1 = createMockContext(invalidType, {}, {}, {}, adminUser);
      await createInspectionTemplate(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 400);
      assert.match(ctx1.res.responseData.message, /unsupported type/i);

      const invertedLimits = {
        machine_category: 'HMC',
        title: 'Inverted Limits Template',
        checklist: [{ id: 'c1', label: 'Pressure', type: 'number', min: 100, max: 50 }],
      };
      const ctx2 = createMockContext(invertedLimits, {}, {}, {}, adminUser);
      await createInspectionTemplate(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 400);
      assert.match(ctx2.res.responseData.message, /min.*cannot be greater than max/i);
    });

    it('34. Template creation validation: rejects inverted critical thresholds (critical_min > min, critical_max < max)', async () => {
      const invertedCritical = {
        machine_category: 'HMC',
        title: 'Inverted Critical Template',
        checklist: [
          { id: 'c1', label: 'Pressure', type: 'number', min: 40, max: 60, critical_min: 50 },
        ],
      };
      const { req, res, next } = createMockContext(invertedCritical, {}, {}, {}, adminUser);
      await createInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /critical_min.*cannot be greater than.*min/i);
    });

    it('35. GET /templates lists templates with pagination and category filtering', async () => {
      const { req, res, next } = createMockContext({}, {}, { machine_category: 'HMC', page: '1', limit: '10' }, {}, managerPune);
      await getInspectionTemplatesList(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));
      assert.equal(res.responseData.data[0].machine_category, 'HMC');
      assert.equal(res.responseData.pagination.page, 1);
    });

    it('36. GET /templates/:id retrieves template details by UUID', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        operatorPune
      );
      await getInspectionTemplateById(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.id, '50000000-0000-0000-0000-000000000001');
      assert.equal(res.responseData.data.machine_category, 'HMC');
      assert.equal(res.responseData.data.version, 1);
    });

    it('37. GET /templates/:id returns HTTP 404 for nonexistent template ID', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '50000000-0000-0000-0000-000000000999' },
        {},
        {},
        adminUser
      );
      await getInspectionTemplateById(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.match(res.responseData.message, /template not found/i);
    });

    it('38. PUT /templates/:id updates template safely with automatic version increment (v1 -> v2)', async () => {
      const updatedChecklist = [
        ...mockDb.templates[0].checklist.items,
        { id: 'chk-6', label: 'Spindle Taper Air Purge Pressure Verified', type: 'boolean', required: true, is_critical: false },
      ];

      const { req, res, next } = createMockContext(
        {
          title: 'HMC Daily Pre-Shift Checklist v2',
          checklist: updatedChecklist,
          expected_version: 1,
        },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        managerPune
      );
      await updateInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.title, 'HMC Daily Pre-Shift Checklist v2');
      assert.equal(res.responseData.data.version, 2);
      assert.equal(res.responseData.data.checklist.length, 6);

      const updateAudit = mockDb.audit_logs.find((a) => a.action === 'UPDATE_TEMPLATE');
      assert.ok(updateAudit);
      assert.equal(updateAudit.new_values.version, 2);
    });

    it('39. PATCH /templates/:id/status toggles template active state and records audit log', async () => {
      // Deactivate
      const ctxDeact = createMockContext(
        { is_active: false, expected_version: 1 },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await toggleInspectionTemplateStatus(ctxDeact.req, ctxDeact.res, ctxDeact.next);
      assert.equal(ctxDeact.res.statusCode, 200);
      assert.equal(ctxDeact.res.responseData.data.is_active, false);

      // Reactivate
      const ctxAct = createMockContext(
        { is_active: true, expected_version: 1 },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await toggleInspectionTemplateStatus(ctxAct.req, ctxAct.res, ctxAct.next);
      assert.equal(ctxAct.res.statusCode, 200);
      assert.equal(ctxAct.res.responseData.data.is_active, true);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Server-Side Inspection Evaluation Engine (Phase 2)
  // -------------------------------------------------------------------------
  describe('7. Server-Side Inspection Evaluation & Status Calculation (Phase 2)', () => {
    it('40. Nominal inspection with all items passing and nominal sensor readings evaluates to "pass"', async () => {
      const nominalBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.5,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          { id: 'chk-1', value: 50 },
          { id: 'chk-2', value: 21 },
          { id: 'chk-3', value: true },
          { id: 'chk-4', value: true },
          { id: 'chk-5', value: true },
        ],
      };

      const { req, res, next } = createMockContext(nominalBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'pass');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.overall_status, 'pass');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.failed_items, 0);
      assert.equal(res.responseData.data.responses_json.evaluation_summary.flagged_items, 0);
    });

    it('41. Client-supplied overall_status is strictly ignored: client claims "pass" but critical item fails -> evaluated as "fail"', async () => {
      const spoofedBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        overall_status: 'pass',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          { id: 'chk-1', value: 50 },
          { id: 'chk-2', value: 21 },
          { id: 'chk-3', value: true },
          { id: 'chk-4', value: false }, // Emergency stop failed (is_critical: true)
          { id: 'chk-5', value: true },
        ],
      };

      const { req, res, next } = createMockContext(spoofedBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.overall_status, 'fail');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.failed_items, 1);
    });

    it('42. Non-critical checklist failure evaluates to "flagged"', async () => {
      const flaggedBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift B',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          { id: 'chk-1', value: 50 },
          { id: 'chk-2', value: 21 },
          { id: 'chk-3', value: false }, // Visual check failed (is_critical: false)
          { id: 'chk-4', value: true },
          { id: 'chk-5', value: true },
        ],
      };

      const { req, res, next } = createMockContext(flaggedBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'flagged');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.overall_status, 'flagged');
      assert.equal(res.responseData.data.responses_json.evaluation_summary.flagged_items, 1);
      assert.equal(res.responseData.data.responses_json.evaluation_summary.failed_items, 0);
    });

    it('43. Sensor reading breaching normal operating limits evaluates to "flagged"', async () => {
      const sensorDeviationBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 26.0, // 26C > 24C normal max
        pressure: 50.0,
        vibration: 1.2,
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(sensorDeviationBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'flagged');
      assert.equal(res.responseData.data.responses_json.sensors.temperature.status, 'flagged');
    });

    it('44. Sensor reading breaching critical threshold evaluates to "fail"', async () => {
      const sensorCriticalBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 30.0, // 30 Bar < 35 Bar critical min
        vibration: 1.2,
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(sensorCriticalBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');
      assert.equal(res.responseData.data.responses_json.sensors.pressure.status, 'fail');
      assert.ok(res.responseData.data.responses_json.evaluation_summary.critical_failures.length > 0);
    });

    it('45. Vibration breaching critical maximum threshold (5.0 mm/s > 4.5 mm/s) evaluates to "fail"', async () => {
      const vibrationFailBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 5.0, // 5.0 > 4.5 critical max
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(vibrationFailBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');
      assert.equal(res.responseData.data.responses_json.sensors.vibration.status, 'fail');
    });

    it('46. Missing required checklist item rejects submission with HTTP 400 Bad Request', async () => {
      const missingItemBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          { id: 'chk-1', value: 50 },
          { id: 'chk-2', value: 21 },
        ],
      };

      const { req, res, next } = createMockContext(missingItemBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /Missing required checklist response/i);
    });

    it('47. Unknown checklist item ID rejects submission with HTTP 400 Bad Request', async () => {
      const unknownItemBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          ...validHmcResponses,
          { id: 'chk-unknown-999', value: true },
        ],
      };

      const { req, res, next } = createMockContext(unknownItemBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /unknown checklist item ID 'chk-unknown-999'/i);
    });

    it('48. Invalid response value data type rejects with HTTP 400 Bad Request', async () => {
      const invalidTypeBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 50.0,
        vibration: 1.2,
        responses: [
          { id: 'chk-1', value: 'not-a-number' },
          { id: 'chk-2', value: 21 },
          { id: 'chk-3', value: true },
          { id: 'chk-4', value: true },
          { id: 'chk-5', value: true },
        ],
      };

      const { req, res, next } = createMockContext(invalidTypeBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /Invalid numeric value/i);
    });

    it('49. Submitting inspection against an inactive template rejects with HTTP 400 Bad Request', async () => {
      const inactiveTemplate: MockTemplate = {
        id: '50000000-0000-0000-0000-000000000088',
        machine_category: 'HMC',
        title: 'Deprecated Template',
        checklist: { version: 1, items: validHmcResponses },
        is_active: false,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.templates.push(inactiveTemplate);

      const inactiveSubmitBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        template_id: inactiveTemplate.id,
        shift: 'Shift A',
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(inactiveSubmitBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /Cannot submit inspection against an inactive template/i);
    });

    it('50. Sensor reading provided when template lacks threshold configuration rejects with HTTP 400', async () => {
      const noThresholdsTemplate: MockTemplate = {
        id: '50000000-0000-0000-0000-000000000077',
        machine_category: 'HMC',
        title: 'No Thresholds Template',
        checklist: {
          version: 1,
          items: [
            { id: 'chk-1', label: 'Item 1', type: 'boolean', required: true },
          ],
          sensor_thresholds: {},
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.templates.push(noThresholdsTemplate);

      const submissionWithSensor = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        template_id: noThresholdsTemplate.id,
        shift: 'Shift A',
        temperature: 25.0,
        responses: [{ id: 'chk-1', value: true }],
      };

      const { req, res, next } = createMockContext(submissionWithSensor, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.match(res.responseData.message, /Missing or incomplete threshold configuration for sensor 'temperature'/i);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Historical Integrity, Single Detail & Cross-Module Integration (Phase 2)
  // -------------------------------------------------------------------------
  describe('8. Historical Integrity, Single Detail & Cross-Module Integration (Phase 2)', () => {
    it('51. Versioned metadata envelope snapshot in responses_json preserves historical integrity when template is updated', async () => {
      const submitBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        ...standardValidSubmission,
      };
      const ctxSub = createMockContext(submitBody, {}, {}, {}, operatorPune);
      await submitInspection(ctxSub.req, ctxSub.res, ctxSub.next);
      assert.equal(ctxSub.res.statusCode, 201);
      const recordId = ctxSub.res.responseData.data.id;
      const initialEnvelope = ctxSub.res.responseData.data.responses_json;

      assert.equal(initialEnvelope.template_version, 1);
      assert.equal(initialEnvelope.items.length, 5);

      const updateBody = {
        title: 'HMC Daily Pre-Shift Checklist v2 - Modified',
        expected_version: 1,
        checklist: [
          ...mockDb.templates[0].checklist.items,
          { id: 'chk-new-extra', label: 'Extra Check', type: 'boolean', required: true },
        ],
      };
      const ctxUpd = createMockContext(
        updateBody,
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await updateInspectionTemplate(ctxUpd.req, ctxUpd.res, ctxUpd.next);
      assert.equal(ctxUpd.res.statusCode, 200);
      assert.equal(ctxUpd.res.responseData.data.version, 2);

      const ctxGet = createMockContext({}, { id: recordId }, {}, {}, operatorPune);
      await getInspectionRecordById(ctxGet.req, ctxGet.res, ctxGet.next);
      assert.equal(ctxGet.res.statusCode, 200);
      const retrieved = ctxGet.res.responseData.data;

      assert.equal(retrieved.responses_json.template_version, 1);
      assert.equal(retrieved.responses_json.items.length, 5);
      assert.equal(retrieved.responses_json.template_title, 'HMC Daily Pre-Shift Checklist');
    });

    it('52. GET /records/:id retrieves record detail with populated facility context and parsed envelope', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000001' },
        {},
        {},
        operatorPune
      );
      await getInspectionRecordById(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.id, '60000000-0000-0000-0000-000000000001');
      assert.equal(res.responseData.data.machine_code, 'HMC-001');
      assert.equal(res.responseData.data.plant_name, 'JCB Pune Plant 1');
      assert.equal(res.responseData.data.shop_name, 'CNC Machining Shop');
      assert.ok(typeof res.responseData.data.responses_json === 'object');
    });

    it('53. GET /records/:id enforces facility scope: rejects operator attempting to view another shop record (HTTP 403)', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '60000000-0000-0000-0000-000000000002' },
        {},
        {},
        operatorPune
      );
      await getInspectionRecordById(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.match(res.responseData.message, /Forbidden.*another plant/i);
    });

    it('54. Audit logging: writes to audit_logs table on template creation, update, and inspection submission', async () => {
      const createBody = {
        machine_category: 'Press',
        title: 'Audit Test Press Checklist',
        checklist: [{ id: 'chk-1', label: 'Item 1', type: 'boolean' }],
      };
      const ctxC = createMockContext(createBody, {}, {}, {}, adminUser);
      await createInspectionTemplate(ctxC.req, ctxC.res, ctxC.next);
      assert.equal(ctxC.res.statusCode, 201);

      const templateLog = mockDb.audit_logs.find((l) => l.action === 'CREATE_TEMPLATE');
      assert.ok(templateLog, 'Expected audit log for CREATE_TEMPLATE');
      assert.equal(templateLog.entity_name, 'inspection_templates');
      assert.equal(templateLog.performed_by, adminUser.id);

      const submitBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        ...standardValidSubmission,
      };
      const ctxS = createMockContext(submitBody, {}, {}, {}, operatorPune);
      await submitInspection(ctxS.req, ctxS.res, ctxS.next);
      assert.equal(ctxS.res.statusCode, 201);

      const recordLog = mockDb.audit_logs.find((l) => l.action === 'INSPECTION_SUBMITTED');
      assert.ok(recordLog, 'Expected audit log for INSPECTION_SUBMITTED');
      assert.equal(recordLog.entity_name, 'inspection_records');
      assert.equal(recordLog.performed_by, operatorPune.id);
    });

    it('55. Critical inspection failure notifies plant managers and emits Socket.IO alert', async () => {
      const failBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 30.0, // Critical failure < 35 Bar
        vibration: 1.2,
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(failBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');

      const mgrNotif = mockDb.notifications.find(
        (n) => n.user_id === managerPune.id && n.title.includes('Critical Inspection Failure')
      );
      assert.ok(mgrNotif, 'Expected notification dispatched to Pune manager');
      assert.match(mgrNotif.message, /Pre-shift inspection failed for machine HMC-001/i);

      const socketAlert = mockIo.emissions.find((e) => e.event === 'inspection_alert');
      assert.ok(socketAlert, 'Expected Socket.IO inspection_alert event');
      assert.equal(socketAlert.data.overall_status, 'fail');
      assert.equal(socketAlert.data.machine_code, 'HMC-001');
    });

    it('56. Breakdown escalation: when escalate_on_fail is true and inspection critically fails, maintenance request is logged', async () => {
      const escalateBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        escalate_on_fail: true,
        temperature: 21.0,
        pressure: 25.0, // Critical failure < 35 Bar
        vibration: 1.2,
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(escalateBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');

      const mr = mockDb.maintenance_requests.find((r) => r.machine_id === '40000000-0000-0000-0000-000000000001');
      assert.ok(mr, 'Expected maintenance_requests record created for critical auto-escalation');
      assert.equal(mr.priority, 'critical');
      assert.match(mr.problem_title, /Auto-Escalation: Inspection Failure HMC-001/i);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Phase 2 Architecture & Security Verification: Concurrency, Limits & Safe Escalation
  // -------------------------------------------------------------------------
  describe('9. Phase 2 Architecture & Security Verification', () => {
    it('57. Concurrency: PUT /templates/:id rejects with HTTP 409 Conflict when expected_version is missing', async () => {
      const updateBody = {
        title: 'Missing Version Update Attempt',
        // expected_version missing
      };
      const { req, res, next } = createMockContext(
        updateBody,
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await updateInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /requires a valid expected_version/i);
    });

    it('58. Concurrency: PUT /templates/:id rejects with HTTP 409 Conflict when expected_version does not match current version', async () => {
      const updateBody = {
        title: 'Concurrent Edit Title Attempt',
        expected_version: 99, // Current version is 1
      };
      const { req, res, next } = createMockContext(
        updateBody,
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await updateInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Template version mismatch.*Expected version 99/i);
    });

    it('59. Concurrency: PUT /templates/:id succeeds when expected_version matches current version', async () => {
      const updateBody = {
        title: 'HMC Inspection Template v2',
        expected_version: 1,
      };
      const { req, res, next } = createMockContext(
        updateBody,
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await updateInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.version, 2);
      assert.equal(res.responseData.data.title, 'HMC Inspection Template v2');
    });

    it('60. Concurrency: PATCH /templates/:id/status rejects with HTTP 409 Conflict when expected_version is missing or stale', async () => {
      // 1. Missing expected_version
      const ctxMissing = createMockContext(
        { is_active: false },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await toggleInspectionTemplateStatus(ctxMissing.req, ctxMissing.res, ctxMissing.next);
      assert.equal(ctxMissing.res.statusCode, 409);
      assert.equal(ctxMissing.res.responseData.success, false);
      assert.match(ctxMissing.res.responseData.message, /requires a valid expected_version for template status changes/i);

      // 2. Stale expected_version
      const ctxStale = createMockContext(
        { is_active: false, expected_version: 99 },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await toggleInspectionTemplateStatus(ctxStale.req, ctxStale.res, ctxStale.next);
      assert.equal(ctxStale.res.statusCode, 409);
      assert.equal(ctxStale.res.responseData.success, false);
      assert.match(ctxStale.res.responseData.message, /Template version mismatch.*Expected version 99/i);

      // 3. Valid expected_version
      const ctxValid = createMockContext(
        { is_active: false, expected_version: 1 },
        { id: '50000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );
      await toggleInspectionTemplateStatus(ctxValid.req, ctxValid.res, ctxValid.next);
      assert.equal(ctxValid.res.statusCode, 200);
      assert.equal(ctxValid.res.responseData.success, true);
      assert.equal(ctxValid.res.responseData.data.is_active, false);
    });

    it('61. Sensor limits: One-sided limit template (vibration max only) validates without requiring min or critical_min', async () => {
      const oneSidedTemplate = {
        machine_category: 'Stamping',
        title: 'One-Sided Limit Template',
        checklist: [{ id: 'chk-1', label: 'Safety Guard Interlocked', type: 'boolean' }],
        sensor_thresholds: {
          vibration: { max: 2.0, critical_max: 4.0, unit: 'mm/s' }, // No min or critical_min
        },
      };
      const { req, res, next } = createMockContext(oneSidedTemplate, {}, {}, {}, adminUser);
      await createInspectionTemplate(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.machine_category, 'Stamping');
      assert.equal(res.responseData.data.sensor_thresholds.vibration.max, 2.0);
      assert.equal(res.responseData.data.sensor_thresholds.vibration.critical_max, 4.0);
    });

    it('62. Sensor evaluation: Missing required sensor reading rejects submission with HTTP 400 Bad Request', async () => {
      // Create a template with required: true on pressure
      const reqSensorTemplate: MockTemplate = {
        id: '50000000-0000-0000-0000-000000000078',
        machine_category: 'HMC',
        title: 'Template with Mandatory Sensor',
        checklist: {
          version: 1,
          items: [{ id: 'chk-1', label: 'Visual Check', type: 'boolean' }],
          sensor_thresholds: {
            pressure: { min: 45, max: 55, critical_min: 35, critical_max: 70, unit: 'Bar', required: true },
          },
        },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.templates.push(reqSensorTemplate);

      const submitWithoutSensor = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        template_id: reqSensorTemplate.id,
        shift: 'Shift A',
        responses: [{ id: 'chk-1', value: true }],
        // pressure omitted
      };
      const { req, res, next } = createMockContext(submitWithoutSensor, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Missing required sensor reading for 'System Pressure' \(pressure\)/i);
    });

    it('63. Sensor evaluation: Omitted optional sensor reading is omitted from evaluatedSensors and NOT counted as pass', async () => {
      const submitWithOptionalOmitted = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift A',
        temperature: 21.0,
        pressure: 50.0,
        // vibration omitted (optional)
        responses: validHmcResponses,
      };
      const { req, res, next } = createMockContext(submitWithOptionalOmitted, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'pass');

      const sensors = res.responseData.data.responses_json.sensors;
      assert.ok(sensors.temperature, 'Temperature must be evaluated');
      assert.ok(sensors.pressure, 'Pressure must be evaluated');
      assert.strictEqual(sensors.vibration, undefined, 'Omitted optional sensor must not be placed in evaluatedSensors');
      // Evaluation summary passed items must equal checklist items passed (not artificially inflated by absent sensors)
      assert.equal(res.responseData.data.responses_json.evaluation_summary.passed_items, 5);
    });

    it('64. Template validation: Submission for machine category without active template returns HTTP 400 configuration error', async () => {
      const unconfiguredMachine: MockMachine = {
        id: '40000000-0000-0000-0000-000000000088',
        shop_id: '20000000-0000-0000-0000-000000000001',
        machine_code: 'EXT-001',
        name: 'Extruder Cell Unconfigured',
        category: 'Extruder', // No active template exists for Extruder
        criticality: 'class_a',
        status: 'running',
        operating_hours: 100,
      };
      mockDb.machines.push(unconfiguredMachine);

      const submitBody = {
        machine_id: unconfiguredMachine.id,
        shift: 'Shift A',
        responses: validHmcResponses,
      };
      const { req, res, next } = createMockContext(submitBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /No active inspection template configured for machine category 'Extruder'/i);
    });

    it('65. Cross-module escalation: Critical inspection failure with escalate_on_fail delegates to Module 2 service, creating CMP-YYYY complaint and setting machine to breakdown', async () => {
      const escalateBody = {
        machine_id: '40000000-0000-0000-0000-000000000001',
        shift: 'Shift B',
        escalate_on_fail: true,
        temperature: 21.0,
        pressure: 20.0, // Critical low failure
        vibration: 1.2,
        responses: validHmcResponses,
      };

      const { req, res, next } = createMockContext(escalateBody, {}, {}, {}, operatorPune);
      await submitInspection(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.data.overall_status, 'fail');

      // Verify returned response contains Module 2 breakdown complaint
      const escalated = res.responseData.data.breakdown_complaint;
      assert.ok(escalated, 'Expected breakdown_complaint returned from Module 2 service');
      assert.match(escalated.complaint_number, /^CMP-\d{4}-\d{5}$/, 'Complaint number must follow CMP-YYYY-XXXXX format');
      assert.equal(escalated.status, 'new');
      assert.equal(escalated.priority, 'critical');
      assert.equal(escalated.issue_category, 'hydraulic'); // Inferred from hydraulic pressure critical failure

      // Verify machine status updated atomically to 'breakdown'
      const machine = mockDb.machines.find((m) => m.id === '40000000-0000-0000-0000-000000000001');
      assert.equal(machine?.status, 'breakdown');
    });
  });
});
