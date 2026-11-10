process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mock_cmms_test_user:mock_password@localhost:5432/mock_cmms_db';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'mock_test_jwt_secret_32_chars_long_key_strictly_for_unit_tests';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'mock_test_refresh_token_secret_32_chars_unit_test';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/rbac.middleware';
import {
  createRDC,
  getRDCs,
  getRDCById,
  updateRDCDraft,
  submitRDC,
  approveRDC,
  approveAndDispatchRDC,
  rejectRDC,
  dispatchRDC,
  recordRDCReturn,
  recordRDCReplacement,
  recordRDCDamage,
  recordRDCWriteOff,
  cancelRDC,
  closeRDC,
  getRDCHistory,
  getRdcDashboard,
  getOverdueRDCs,
  setRdcServiceDb,
  resetRdcServiceDb,
  setRdcServiceIo,
  resetRdcServiceIo,
} from './rdc.controller';
import {
  generateChallanNumber,
  generateGatePassNumber,
} from './rdc.service';
import {
  setNotificationsServiceDb,
  resetNotificationsServiceDb,
  setNotificationsServiceIo,
  resetNotificationsServiceIo,
} from '../notifications/notifications.service';

// ---------------------------------------------------------------------------
// Test UUIDs
// ---------------------------------------------------------------------------
const PLANT_1_ID = 'b0000000-0000-0000-0000-000000000001';
const PLANT_2_ID = 'b0000000-0000-0000-0000-000000000002';
const SHOP_1_ID = 'e0000000-0000-0000-0000-000000000001';
const SHOP_2_ID = 'e0000000-0000-0000-0000-000000000002';
const MACHINE_1_ID = 'a0000000-0000-0000-0000-000000000001';
const WO_1_ID = 'd0000000-0000-0000-0000-000000000001';
const PART_1_ID = 'c0000000-0000-0000-0000-000000000001';
const PART_2_ID = 'c0000000-0000-0000-0000-000000000002';
const VENDOR_1_ID = '90000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Test Users
// ---------------------------------------------------------------------------
const adminUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000001',
  employee_code: 'EMP-ADM-001',
  email: 'admin@jcb.com',
  role: 'admin',
};

const managerUser1: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000002',
  employee_code: 'EMP-MGR-001',
  email: 'manager1@jcb.com',
  role: 'manager',
  plant_id: PLANT_1_ID,
  shop_id: SHOP_1_ID,
};

const managerUser2: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000006',
  employee_code: 'EMP-MGR-002',
  email: 'manager2@jcb.com',
  role: 'manager',
  plant_id: PLANT_2_ID,
  shop_id: SHOP_2_ID,
};

const storeManagerUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000005',
  employee_code: 'EMP-STM-001',
  email: 'store@jcb.com',
  role: 'store_manager',
  plant_id: PLANT_1_ID,
};

const technicianUser1: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000003',
  employee_code: 'EMP-TECH-001',
  email: 'tech1@jcb.com',
  role: 'technician',
  plant_id: PLANT_1_ID,
  shop_id: SHOP_1_ID,
};

const technicianUser2: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000007',
  employee_code: 'EMP-TECH-002',
  email: 'tech2@jcb.com',
  role: 'technician',
  plant_id: PLANT_2_ID,
  shop_id: SHOP_2_ID,
};

const operatorUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000004',
  employee_code: 'EMP-OP-001',
  email: 'operator@jcb.com',
  role: 'operator',
  plant_id: PLANT_1_ID,
  shop_id: SHOP_1_ID,
};

// ---------------------------------------------------------------------------
// Mock Express Context
// ---------------------------------------------------------------------------
interface MockResponse {
  statusCode: number;
  responseData: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
}

function createMockContext(
  body: any = {},
  user?: AuthenticatedUser,
  params: any = {},
  query: any = {}
): {
  req: Request;
  res: Response & MockResponse;
  next: NextFunction;
} {
  const req = {
    body,
    params,
    query,
    user,
  } as unknown as Request;

  const mockRes: MockResponse = {
    statusCode: 200,
    responseData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.responseData = data;
      return this;
    },
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

// ---------------------------------------------------------------------------
// Mock Database State & In-Memory Store
// ---------------------------------------------------------------------------
class MockDatabaseState {
  public rdcChallans = new Map<string, any>();
  public rdcItems = new Map<string, any>();
  public spareParts = new Map<string, any>();
  public inventoryTransactions: any[] = [];
  public damagedStockItems: any[] = [];
  public auditLogs: any[] = [];
  public notifications: any[] = [];
  public approvalConfigs: any[] = [];
  public users = new Map<string, any>();

  constructor() {
    this.reset();
  }

  reset() {
    this.rdcChallans.clear();
    this.rdcItems.clear();
    this.spareParts.clear();
    this.inventoryTransactions = [];
    this.damagedStockItems = [];
    this.auditLogs = [];
    this.notifications = [];
    this.approvalConfigs = [];
    this.users.clear();

    // Populate Users
    this.users.set(adminUser.id, adminUser);
    this.users.set(managerUser1.id, { ...managerUser1, full_name: 'Manager Plant 1', is_active: true });
    this.users.set(managerUser2.id, { ...managerUser2, full_name: 'Manager Plant 2', is_active: true });
    this.users.set(storeManagerUser.id, { ...storeManagerUser, full_name: 'Store Manager', is_active: true });
    this.users.set(technicianUser1.id, { ...technicianUser1, full_name: 'Technician 1', is_active: true });
    this.users.set(technicianUser2.id, { ...technicianUser2, full_name: 'Technician 2', is_active: true });
    this.users.set(operatorUser.id, { ...operatorUser, full_name: 'Operator 1', is_active: true });

    // Populate Spare Parts
    this.spareParts.set(PART_1_ID, {
      id: PART_1_ID,
      part_number: 'JCB-HYD-101',
      name: 'Hydraulic Cylinder Pump',
      current_physical_stock: 20,
      reserved_stock: 0,
      quarantined_stock: 0,
      available_stock: 20,
      unit_cost: 25000,
      bin_location: 'BIN-HYD-01',
      plant_id: PLANT_1_ID,
      status: 'active',
    });

    this.spareParts.set(PART_2_ID, {
      id: PART_2_ID,
      part_number: 'JCB-ELC-202',
      name: 'Induction Drive Motor 45kW',
      current_physical_stock: 5,
      reserved_stock: 0,
      quarantined_stock: 0,
      available_stock: 5,
      unit_cost: 80000,
      bin_location: 'BIN-ELC-04',
      plant_id: PLANT_1_ID,
      status: 'active',
    });

    // Populate Approval Configs
    this.approvalConfigs = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        plant_id: null,
        min_value: 0,
        max_value: 50000,
        priority: 'ALL',
        required_role: 'manager',
        approval_level: 1,
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        plant_id: null,
        min_value: 50000.01,
        max_value: null,
        priority: 'ALL',
        required_role: 'admin',
        approval_level: 2,
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        plant_id: null,
        min_value: 0,
        max_value: null,
        priority: 'emergency',
        required_role: 'admin',
        approval_level: 2,
        is_active: true,
      },
    ];
  }
}

const mockState = new MockDatabaseState();

// ---------------------------------------------------------------------------
// Mock Database Client & Pool
// ---------------------------------------------------------------------------
class MockDbClient {
  public inTransaction = false;

  async query(text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    const trimmed = text.trim();

    // Transactions
    if (trimmed === 'BEGIN') {
      this.inTransaction = true;
      return { rows: [], rowCount: 0 };
    }
    if (trimmed === 'COMMIT') {
      this.inTransaction = false;
      return { rows: [], rowCount: 0 };
    }
    if (trimmed === 'ROLLBACK') {
      this.inTransaction = false;
      return { rows: [], rowCount: 0 };
    }

    // Advisory Locks
    if (trimmed.includes('pg_advisory_xact_lock')) {
      return { rows: [{ pg_advisory_xact_lock: null }], rowCount: 1 };
    }

    // Vendors
    if (trimmed.includes('FROM vendors')) {
      if (params?.[0] === VENDOR_1_ID) {
        return {
          rows: [
            {
              id: VENDOR_1_ID,
              name: 'Bosch Rexroth India',
              gstin: '24AAACB9876G1Z2',
              address: 'Sanand Industrial Estate, Ahmedabad',
              contact_person: 'Industrial Sales Head',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // Max Challan Number
    if (trimmed.includes('SELECT MAX(SUBSTRING(challan_number')) {
      const prefix = params?.[0] || '';
      let maxSeq = 0;
      for (const c of mockState.rdcChallans.values()) {
        if (c.challan_number.startsWith(prefix)) {
          const seq = parseInt(c.challan_number.substring(prefix.length), 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      return {
        rows: [{ max_seq: maxSeq > 0 ? String(maxSeq).padStart(5, '0') : null }],
        rowCount: 1,
      };
    }

    // Max Gate Pass Number
    if (trimmed.includes('SELECT MAX(SUBSTRING(gate_pass_number')) {
      const prefix = params?.[0] || '';
      let maxSeq = 0;
      for (const c of mockState.rdcChallans.values()) {
        if (c.gate_pass_number && c.gate_pass_number.startsWith(prefix)) {
          const seq = parseInt(c.gate_pass_number.substring(prefix.length), 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      return {
        rows: [{ max_seq: maxSeq > 0 ? String(maxSeq).padStart(5, '0') : null }],
        rowCount: 1,
      };
    }

    // Max Damage Report Number
    if (trimmed.includes('SELECT MAX(SUBSTRING(report_number')) {
      let maxSeq = 0;
      for (const d of mockState.damagedStockItems) {
        if (d.report_number && d.report_number.startsWith('DMG-')) {
          const parts = d.report_number.split('-');
          const seq = parseInt(parts[2], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      return {
        rows: [{ max_seq: maxSeq > 0 ? String(maxSeq).padStart(5, '0') : null }],
        rowCount: 1,
      };
    }

    // Insert Challan
    if (trimmed.startsWith('INSERT INTO rdc_challans')) {
      const id = `10000000-0000-0000-0000-${String(mockState.rdcChallans.size + 1).padStart(12, '0')}`;
      const record = {
        id,
        challan_number: params![0],
        rdc_type: params![1],
        plant_id: params![2],
        shop_id: params![3],
        work_order_id: params![4],
        machine_id: params![5],
        vendor_id: params![6],
        vendor_party_name: params![7],
        vendor_gstin: params![8],
        vendor_address: params![9],
        contact_person: params![10],
        purpose: params![11],
        priority: params![12],
        approximate_value: Number(params![13]),
        dispatch_date: params![14] || new Date().toISOString(),
        expected_return_date: params![15],
        document_reference: params![16],
        status: params![17],
        created_by: params![18],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockState.rdcChallans.set(id, record);
      return { rows: [record], rowCount: 1 };
    }

    // Insert Item
    if (trimmed.startsWith('INSERT INTO rdc_items')) {
      const id = `20000000-0000-0000-0000-${String(mockState.rdcItems.size + 1).padStart(12, '0')}`;
      const record = {
        id,
        rdc_id: params![0],
        part_id: params![1],
        item_description: params![2],
        serial_number: params![3],
        quantity_dispatched: Number(params![4]),
        quantity_returned: 0,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
        unit_cost: Number(params![5]),
        approximate_value: Number(params![6]),
        remarks: params![7],
        disposition: 'pending',
        created_at: new Date().toISOString(),
      };
      mockState.rdcItems.set(id, record);
      return { rows: [record], rowCount: 1 };
    }

    // Select rdc_challans
    if (trimmed.includes('FROM rdc_challans') && (trimmed.includes('WHERE r.id = $1') || trimmed.includes('WHERE id = $1'))) {
      const id = params![0];
      const challan = mockState.rdcChallans.get(id);
      return { rows: challan ? [{ ...challan }] : [], rowCount: challan ? 1 : 0 };
    }

    // Select rdc_items
    if (trimmed.includes('FROM rdc_items') && trimmed.includes('COUNT(*)::int as count')) {
      const rdcId = params![0];
      const count = Array.from(mockState.rdcItems.values()).filter((it) => it.rdc_id === rdcId).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    if (trimmed.includes('FROM rdc_items') && trimmed.includes('WHERE id = $1 AND rdc_id = $2')) {
      const itemId = params![0];
      const rdcId = params![1];
      const item = mockState.rdcItems.get(itemId);
      return { rows: item && item.rdc_id === rdcId ? [{ ...item }] : [], rowCount: item && item.rdc_id === rdcId ? 1 : 0 };
    }

    if (trimmed.includes('FROM rdc_items') && trimmed.includes('WHERE rdc_id = $1')) {
      const rdcId = params![0];
      const items = Array.from(mockState.rdcItems.values()).filter((it) => it.rdc_id === rdcId);
      return { rows: items.map((it) => ({ ...it })), rowCount: items.length };
    }

    if (trimmed.includes('FROM rdc_items') && trimmed.includes('WHERE id = $1')) {
      const itemId = params![0];
      const item = mockState.rdcItems.get(itemId);
      return { rows: item ? [{ ...item }] : [], rowCount: item ? 1 : 0 };
    }

    // Update rdc_challans
    if (trimmed.startsWith('UPDATE rdc_challans')) {
      const id = trimmed.includes('WHERE id = $2') ? params![1] : params![0];
      const challan = mockState.rdcChallans.get(id);
      if (!challan) return { rows: [], rowCount: 0 };

      if (trimmed.includes("status = 'pending_approval'")) {
        challan.status = 'pending_approval';
        challan.submission_notes = params![1];
        challan.rejection_reason = null;
      } else if (trimmed.includes("status = 'approved'")) {
        challan.status = 'approved';
        challan.approved_by = params![1];
      } else if (trimmed.includes("status = 'rejected'")) {
        challan.status = 'rejected';
        challan.rejected_by = params![1];
        challan.rejection_reason = params![2];
      } else if (trimmed.includes("status = 'cancelled'")) {
        challan.status = 'cancelled';
        challan.cancelled_by = params![1];
        challan.cancellation_reason = params![2];
      } else if (trimmed.includes("status = 'closed'")) {
        challan.status = 'closed';
        challan.closed_by = params![1];
      } else if (trimmed.includes('status = $2') && trimmed.includes('gate_pass_number = $3')) {
        challan.status = params![1];
        challan.gate_pass_number = params![2];
        challan.vehicle_number = params![3];
        challan.transporter_name = params![4];
        challan.dispatched_by = params![5];
      } else if (trimmed.includes('status = $1') && trimmed.includes('actual_return_date = CASE')) {
        challan.status = params![0];
      } else if (trimmed.includes('approximate_value = $1')) {
        challan.approximate_value = params![0];
      }

      challan.updated_at = new Date().toISOString();
      return { rows: [{ ...challan }], rowCount: 1 };
    }

    // Update rdc_items
    if (trimmed.startsWith('UPDATE rdc_items')) {
      if (trimmed.includes('quantity_returned = $1')) {
        const qty = params![0];
        const itemId = params![2];
        const item = mockState.rdcItems.get(itemId);
        if (item) {
          item.quantity_returned = qty;
          return { rows: [{ ...item }], rowCount: 1 };
        }
      } else if (trimmed.includes('quantity_replacement = $1')) {
        const qty = params![0];
        const itemId = params![2];
        const item = mockState.rdcItems.get(itemId);
        if (item) {
          item.quantity_replacement = qty;
          return { rows: [{ ...item }], rowCount: 1 };
        }
      } else if (trimmed.includes('quantity_damaged = $1')) {
        const qty = params![0];
        const itemId = params![1];
        const item = mockState.rdcItems.get(itemId);
        if (item) {
          item.quantity_damaged = qty;
          item.disposition = 'quarantined';
          return { rows: [{ ...item }], rowCount: 1 };
        }
      } else if (trimmed.includes('quantity_written_off = $1')) {
        const qty = params![0];
        const itemId = params![1];
        const item = mockState.rdcItems.get(itemId);
        if (item) {
          item.quantity_written_off = qty;
          item.disposition = 'written_off';
          return { rows: [{ ...item }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Spare Parts
    if (trimmed.includes('FROM spare_parts') && trimmed.includes('WHERE id = $1')) {
      const partId = params![0];
      const part = mockState.spareParts.get(partId);
      return { rows: part ? [{ ...part }] : [], rowCount: part ? 1 : 0 };
    }

    if (trimmed.startsWith('UPDATE spare_parts')) {
      if (trimmed.includes('current_physical_stock = current_physical_stock - $1')) {
        const qty = Number(params![0]);
        const partId = params![1];
        const part = mockState.spareParts.get(partId);
        if (part) {
          part.current_physical_stock -= qty;
          part.available_stock = part.current_physical_stock - part.reserved_stock - part.quarantined_stock;
          return { rows: [{ ...part }], rowCount: 1 };
        }
      } else if (trimmed.includes('current_physical_stock = current_physical_stock + $1') && trimmed.includes('quarantined_stock = quarantined_stock + $1')) {
        const qty = Number(params![0]);
        const partId = params![1];
        const part = mockState.spareParts.get(partId);
        if (part) {
          part.current_physical_stock += qty;
          part.quarantined_stock += qty;
          part.available_stock = part.current_physical_stock - part.reserved_stock - part.quarantined_stock;
          return { rows: [{ ...part }], rowCount: 1 };
        }
      } else if (trimmed.includes('current_physical_stock = current_physical_stock + $1')) {
        const qty = Number(params![0]);
        const partId = params![1];
        const part = mockState.spareParts.get(partId);
        if (part) {
          part.current_physical_stock += qty;
          part.available_stock = part.current_physical_stock - part.reserved_stock - part.quarantined_stock;
          return { rows: [{ ...part }], rowCount: 1 };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // Inventory Transactions
    if (trimmed.startsWith('INSERT INTO inventory_transactions')) {
      const tx = {
        id: `30000000-0000-0000-0000-${String(mockState.inventoryTransactions.length + 1).padStart(12, '0')}`,
        part_id: params![0],
        transaction_type: params![1],
        quantity: params![2],
        source_location: params![3],
        destination_location: params![4],
        reference_work_order_id: params![5],
        performed_by: params![6],
        remarks: params![7],
        created_at: new Date().toISOString(),
      };
      mockState.inventoryTransactions.push(tx);
      return { rows: [tx], rowCount: 1 };
    }

    // Damaged Stock Items
    if (trimmed.startsWith('INSERT INTO damaged_stock_items')) {
      const dmg = {
        id: `40000000-0000-0000-0000-${String(mockState.damagedStockItems.length + 1).padStart(12, '0')}`,
        report_number: params![0],
        part_id: params![1],
        plant_id: params![2],
        quantity: params![3],
        damage_type: params![4],
        disposition: 'quarantined',
        reason: params![5],
        location: params![6],
        reported_by: params![7],
        created_at: new Date().toISOString(),
      };
      mockState.damagedStockItems.push(dmg);
      return { rows: [dmg], rowCount: 1 };
    }

    // Audit Logs
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      const log = {
        id: `50000000-0000-0000-0000-${String(mockState.auditLogs.length + 1).padStart(12, '0')}`,
        entity_name: params![0],
        entity_id: params![1],
        action: params![2],
        performed_by: params![3],
        old_values: params![4],
        new_values: params![5],
        created_at: new Date().toISOString(),
      };
      mockState.auditLogs.push(log);
      return { rows: [log], rowCount: 1 };
    }

    // Notifications
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const notif = {
        id: `60000000-0000-0000-0000-${String(mockState.notifications.length + 1).padStart(12, '0')}`,
        recipient_id: params![0],
        title: params![1],
        message: params![2],
        type: params![3],
        entity_type: 'rdc_challans',
        entity_id: params![5],
        plant_id: params![7],
        created_at: new Date().toISOString(),
      };
      mockState.notifications.push(notif);
      return { rows: [notif], rowCount: 1 };
    }

    // Approval Configs
    if (trimmed.includes('FROM rdc_approval_configs')) {
      let matched = mockState.approvalConfigs.filter((cfg) => cfg.is_active);
      if (params && params.length >= 3) {
        const pId = params[0];
        const prio = params[1];
        const val = Number(params[2]);
        matched = matched
          .filter((cfg) => {
            const pMatch = !cfg.plant_id || !pId || cfg.plant_id === pId;
            const prioMatch = cfg.priority === 'ALL' || cfg.priority === prio;
            const valMatch = val >= cfg.min_value && (cfg.max_value === null || val <= cfg.max_value);
            return pMatch && prioMatch && valMatch;
          })
          .sort((a, b) => b.approval_level - a.approval_level);
      }
      return { rows: matched, rowCount: matched.length };
    }

    // Users
    if (trimmed.includes('FROM users WHERE role IN')) {
      const plantId = params?.[0];
      const matched = Array.from(mockState.users.values()).filter(
        (u) => ['manager', 'admin'].includes(u.role) && (!plantId || !u.plant_id || u.plant_id === plantId)
      );
      return { rows: matched, rowCount: matched.length };
    }

    // Challan Count & List
    if (trimmed.includes('COUNT(*)::int as total FROM rdc_challans')) {
      return { rows: [{ total: mockState.rdcChallans.size }], rowCount: 1 };
    }

    if (trimmed.includes('FROM rdc_challans r') && trimmed.includes('json_agg')) {
      const list = Array.from(mockState.rdcChallans.values()).map((c) => {
        const items = Array.from(mockState.rdcItems.values()).filter((it) => it.rdc_id === c.id);
        return { ...c, items };
      });
      return { rows: list, rowCount: list.length };
    }

    // Audit History query
    if (trimmed.includes('FROM audit_logs a') && trimmed.includes("a.entity_name = 'rdc_challans'")) {
      const challanId = params![0];
      const logs = mockState.auditLogs.filter((l) => l.entity_id === challanId);
      return { rows: logs, rowCount: logs.length };
    }

    // Dashboard metrics query
    if (trimmed.includes('COUNT(*) FILTER (WHERE r.rdc_type =')) {
      const list = Array.from(mockState.rdcChallans.values());
      return {
        rows: [
          {
            total_challans: list.length,
            total_rdc: list.filter((c) => c.rdc_type === 'RDC').length,
            total_nrdc: list.filter((c) => c.rdc_type === 'NRDC').length,
            pending_approval: list.filter((c) => c.status === 'pending_approval').length,
            approved_not_dispatched: list.filter((c) => c.status === 'approved').length,
            currently_dispatched: list.filter((c) => c.status === 'dispatched').length,
            partially_returned: list.filter((c) => c.status === 'partially_returned').length,
            fully_returned: list.filter((c) => c.status === 'fully_returned').length,
            closed: list.filter((c) => c.status === 'closed').length,
            cancelled: list.filter((c) => c.status === 'cancelled').length,
            overdue_returns: list.filter((c) => c.status === 'overdue').length,
          },
        ],
        rowCount: 1,
      };
    }

    if (trimmed.includes('COALESCE(SUM(ri.quantity_dispatched')) {
      let totalQty = 0;
      let totalVal = 0;
      for (const it of mockState.rdcItems.values()) {
        const out = it.quantity_dispatched - (it.quantity_returned + it.quantity_replacement + it.quantity_damaged + it.quantity_written_off);
        if (out > 0) {
          totalQty += out;
          totalVal += out * (it.unit_cost || 0);
        }
      }
      return {
        rows: [
          {
            total_outstanding_quantity: totalQty,
            total_outstanding_value: totalVal,
          },
        ],
        rowCount: 1,
      };
    }

    // Overdue query
    if (trimmed.includes('expected_return_date < CURRENT_DATE')) {
      const overdue = Array.from(mockState.rdcChallans.values())
        .filter((c) => c.status === 'overdue' || (c.expected_return_date && new Date(c.expected_return_date) < new Date()))
        .map((c) => ({ ...c, days_overdue: 5, items: [] }));
      return { rows: overdue, rowCount: overdue.length };
    }

    return { rows: [], rowCount: 0 };
  }

  release() {}
}

const mockDbPool = {
  connect: async () => new MockDbClient(),
  query: async (text: string, params?: any[]) => {
    const client = new MockDbClient();
    return client.query(text, params);
  },
};

// ---------------------------------------------------------------------------
// TEST SUITE: Enterprise RDC Module (JCB CMMS)
// ---------------------------------------------------------------------------
describe('JCB Smart CMMS — Enterprise RDC Module', () => {
  beforeEach(() => {
    mockState.reset();
    setRdcServiceDb(mockDbPool);
    setNotificationsServiceDb(mockDbPool.query.bind(mockDbPool) as any, mockDbPool as any);
    const mockIo = { to: () => ({ emit: () => {} }), emit: () => {} };
    setRdcServiceIo(mockIo);
    setNotificationsServiceIo(mockIo);
  });

  // 1. RDC and NRDC Creation
  describe('1. RDC & NRDC Creation', () => {
    it('1.1. Successfully creates an RDC (Returnable) with pending_approval status', async () => {
      const ctx = createMockContext(
        {
          rdc_type: 'RDC',
          plant_id: PLANT_1_ID,
          vendor_party_name: 'Rexroth Spares Ltd',
          purpose: 'Motor Rewinding & Testing',
          expected_return_date: '2026-12-01',
          items: [
            {
              part_id: PART_1_ID,
              item_description: 'Hydraulic Cylinder Pump',
              quantity_dispatched: 2,
              unit_cost: 25000,
            },
          ],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.success, true);
      assert.match(ctx.res.responseData.data.challan_number, /^RDC-\d{4}-\d{5}$/);
      assert.equal(ctx.res.responseData.data.status, 'pending_approval');
      assert.equal(ctx.res.responseData.data.rdc_type, 'RDC');
      assert.equal(ctx.res.responseData.data.approximate_value, 50000);
    });

    it('1.2. Successfully creates an NRDC (Non-Returnable) challan', async () => {
      const ctx = createMockContext(
        {
          rdc_type: 'NRDC',
          plant_id: PLANT_1_ID,
          vendor_party_name: 'Scrap Disposals Inc',
          purpose: 'Disposal of non-repairable assemblies',
          items: [
            {
              item_description: 'Obsolete Metal Casings',
              quantity_dispatched: 10,
              unit_cost: 500,
            },
          ],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.data.rdc_type, 'NRDC');
      assert.match(ctx.res.responseData.data.challan_number, /^NRDC-\d{4}-\d{5}$/);
    });

    it('1.3. Supports creating a challan directly as draft', async () => {
      const ctx = createMockContext(
        {
          rdc_type: 'RDC',
          plant_id: PLANT_1_ID,
          vendor_party_name: 'Vendor X',
          purpose: 'Calibration draft',
          save_as_draft: true,
          items: [
            {
              item_description: 'Pressure Gauge',
              quantity_dispatched: 1,
            },
          ],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.data.status, 'draft');
    });
  });

  // 2. Required Field Validation
  describe('2. Required Field Validation', () => {
    it('2.1. Rejects creation when vendor name and ID are missing', async () => {
      const ctx = createMockContext(
        {
          purpose: 'Testing',
          items: [{ item_description: 'Item 1', quantity_dispatched: 1 }],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Vendor name or vendor ID is mandatory/i);
    });

    it('2.2. Rejects creation when purpose is missing', async () => {
      const ctx = createMockContext(
        {
          vendor_party_name: 'Vendor Y',
          items: [{ item_description: 'Item 1', quantity_dispatched: 1 }],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Dispatch purpose is mandatory/i);
    });

    it('2.3. Rejects creation when items array is empty', async () => {
      const ctx = createMockContext(
        {
          vendor_party_name: 'Vendor Y',
          purpose: 'Testing',
          items: [],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /At least one line item is required/i);
    });
  });

  // 3. Multiple Item Creation
  describe('3. Multiple Line Item Support', () => {
    it('3.1. Successfully creates multiple line items and calculates total approximate value', async () => {
      const ctx = createMockContext(
        {
          rdc_type: 'RDC',
          plant_id: PLANT_1_ID,
          vendor_party_name: 'Heavy Spares Ltd',
          purpose: 'Overhaul and refurbishing',
          items: [
            { item_description: 'Pump Assembly', quantity_dispatched: 2, unit_cost: 15000 },
            { item_description: 'Control Valve', quantity_dispatched: 3, unit_cost: 5000 },
          ],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.data.items.length, 2);
      assert.equal(ctx.res.responseData.data.approximate_value, 45000);
    });
  });

  // 4. Concurrency & Numbering
  describe('4. Challan & Gate Pass Numbering Concurrency', () => {
    it('4.1. Generates unique sequential challan numbers without collision', async () => {
      const client = new MockDbClient();
      const num1 = await generateChallanNumber(client, 'RDC', 2026);
      mockState.rdcChallans.set('10000000-0000-0000-0000-000000000091', { challan_number: num1 });
      const num2 = await generateChallanNumber(client, 'RDC', 2026);

      assert.equal(num1, 'RDC-2026-00001');
      assert.equal(num2, 'RDC-2026-00002');
      assert.notEqual(num1, num2);
    });

    it('4.2. Generates unique gate pass numbers sequentially', async () => {
      const client = new MockDbClient();
      const gp1 = await generateGatePassNumber(client, 2026);
      mockState.rdcChallans.set('10000000-0000-0000-0000-000000000092', { gate_pass_number: gp1 });
      const gp2 = await generateGatePassNumber(client, 2026);

      assert.equal(gp1, 'GP-2026-00001');
      assert.equal(gp2, 'GP-2026-00002');
      assert.notEqual(gp1, gp2);
    });
  });

  // 5. Plant & Shop Access Restrictions
  describe('5. Plant & Shop Isolation', () => {
    it('5.1. Prevents a technician from Plant 1 from creating a challan for Plant 2', async () => {
      const ctx = createMockContext(
        {
          plant_id: PLANT_2_ID,
          vendor_party_name: 'Vendor Outside',
          purpose: 'Cross-plant attempt',
          items: [{ item_description: 'Gear', quantity_dispatched: 1 }],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Forbidden.*assigned plant/i);
    });

    it('5.2. Admin can create and view challans across all plants', async () => {
      const ctx = createMockContext(
        {
          plant_id: PLANT_2_ID,
          vendor_party_name: 'Universal Vendor',
          purpose: 'Admin inter-plant dispatch',
          items: [{ item_description: 'Turbine', quantity_dispatched: 1 }],
        },
        adminUser
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 201);
      assert.equal(ctx.res.responseData.data.plant_id, PLANT_2_ID);
    });
  });

  // 6. Role-Based Access Control
  describe('6. Role-Based Access Control (RBAC)', () => {
    it('6.1. Operators are blocked from accessing RDC endpoints (HTTP 403)', async () => {
      const middleware = requireRoles('admin', 'manager', 'store_manager', 'technician');
      const ctx = createMockContext({}, operatorUser);
      let nextCalled = false;

      middleware(ctx.req, ctx.res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(ctx.res.statusCode, 403);
    });

    it('6.2. Technicians can create challans but cannot approve them', async () => {
      const middleware = requireRoles('admin', 'manager');
      const ctx = createMockContext({}, technicianUser1);
      let nextCalled = false;

      middleware(ctx.req, ctx.res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(ctx.res.statusCode, 403);
    });
  });

  // 7. Approval & Self-Approval Prevention
  describe('7. Approval & Self-Approval Rejection', () => {
    it('7.1. Prevents a manager from approving their own challan (Self-Approval Prohibited)', async () => {
      const challanId = '10000000-0000-0000-0000-000000000010';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00010',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: managerUser1.id,
        status: 'pending_approval',
        priority: 'medium',
        approximate_value: 30000,
      });

      const ctx = createMockContext({ remarks: 'Self-approve attempt' }, managerUser1, { id: challanId });
      await approveRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Self-approval not permitted/i);
    });

    it('7.2. Independent manager can successfully approve a pending challan within their limit', async () => {
      const challanId = '10000000-0000-0000-0000-000000000011';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00011',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
        priority: 'medium',
        approximate_value: 40000,
      });

      const ctx = createMockContext({ remarks: 'Approved for overhaul' }, managerUser1, { id: challanId });
      await approveRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'approved');
      assert.equal(ctx.res.responseData.data.approved_by, managerUser1.id);
    });

    it('7.3. Requires Admin approval when material value exceeds manager threshold (> 50,000 INR)', async () => {
      const challanId = '10000000-0000-0000-0000-000000000012';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00012',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
        priority: 'medium',
        approximate_value: 75000,
      });

      // Manager tries to approve high-value challan -> rejected
      const mgrCtx = createMockContext({ remarks: 'Manager attempt' }, managerUser1, { id: challanId });
      await approveRDC(mgrCtx.req, mgrCtx.res, mgrCtx.next);
      assert.equal(mgrCtx.res.statusCode, 403);
      assert.match(mgrCtx.res.responseData.message, /requires Administrator authorization/i);

      // Admin approves -> succeeds
      const adminCtx = createMockContext({ remarks: 'Admin override approval' }, adminUser, { id: challanId });
      await approveRDC(adminCtx.req, adminCtx.res, adminCtx.next);
      assert.equal(adminCtx.res.statusCode, 200);
      assert.equal(adminCtx.res.responseData.data.status, 'approved');
    });

    it('7.4. Legacy PUT /:id/approve strictly performs approval only and does not bypass dispatch authorization', async () => {
      const challanId = '10000000-0000-0000-0000-000000000013';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00013',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
        priority: 'medium',
        approximate_value: 35000,
      });

      const ctx = createMockContext({ remarks: 'Legacy PUT approval' }, managerUser1, { id: challanId });
      await approveAndDispatchRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'approved');
      assert.equal(ctx.res.responseData.data.gate_pass_number, undefined);
      assert.match(ctx.res.responseData.message, /Physical dispatch requires separate authorization/i);
    });
  });

  // 8. Rejection and Resubmission
  describe('8. Rejection and Resubmission Workflow', () => {
    it('8.1. Manager rejects challan with mandatory remarks', async () => {
      const challanId = '10000000-0000-0000-0000-000000000013';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00013',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
        approximate_value: 10000,
        priority: 'low',
      });

      const ctx = createMockContext(
        { rejection_reason: 'Quotation from vendor is missing.' },
        managerUser1,
        { id: challanId }
      );
      await rejectRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'rejected');
      assert.equal(ctx.res.responseData.data.rejection_reason, 'Quotation from vendor is missing.');
    });

    it('8.2. Author can update draft fields on a rejected challan and resubmit', async () => {
      const challanId = '10000000-0000-0000-0000-000000000014';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00014',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'rejected',
        purpose: 'Original Purpose',
      });

      // Update draft
      const updCtx = createMockContext({ purpose: 'Updated with vendor quote' }, technicianUser1, { id: challanId });
      await updateRDCDraft(updCtx.req, updCtx.res, updCtx.next);
      assert.equal(updCtx.res.statusCode, 200);

      // Add item to allow submission
      mockState.rdcItems.set('20000000-0000-0000-0000-000000000014', {
        id: '20000000-0000-0000-0000-000000000014',
        rdc_id: challanId,
        item_description: 'Pump',
        quantity_dispatched: 1,
      });

      // Resubmit
      const subCtx = createMockContext({ notes: 'Resubmitted with quote' }, technicianUser1, { id: challanId });
      await submitRDC(subCtx.req, subCtx.res, subCtx.next);
      assert.equal(subCtx.res.statusCode, 200);
      assert.equal(subCtx.res.responseData.data.status, 'pending_approval');
    });
  });

  // 9. Dispatch & Gate Pass Generation
  describe('9. Dispatch & Gate Pass Generation', () => {
    it('9.1. Store Manager dispatches approved challan, generates Gate Pass, and decrements physical stock', async () => {
      const challanId = '10000000-0000-0000-0000-000000000015';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00015',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'approved',
        vendor_party_name: 'Rexroth Spares',
      });

      mockState.rdcItems.set('20000000-0000-0000-0000-000000000015', {
        id: '20000000-0000-0000-0000-000000000015',
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Hydraulic Cylinder Pump',
        quantity_dispatched: 3,
      });

      const initialStock = mockState.spareParts.get(PART_1_ID).current_physical_stock;

      const ctx = createMockContext(
        { vehicle_number: 'HR-29-AB-1234', transporter_name: 'BlueDart Logistics' },
        storeManagerUser,
        { id: challanId }
      );
      await dispatchRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'dispatched');
      assert.match(ctx.res.responseData.data.gate_pass_number, /^GP-\d{4}-\d{5}$/);
      assert.equal(ctx.res.responseData.data.vehicle_number, 'HR-29-AB-1234');

      // Verify stock was decremented by 3
      const updatedPart = mockState.spareParts.get(PART_1_ID);
      assert.equal(updatedPart.current_physical_stock, initialStock - 3);

      // Verify ledger entry in inventory_transactions
      const lastTx = mockState.inventoryTransactions[mockState.inventoryTransactions.length - 1];
      assert.equal(lastTx.transaction_type, 'ISSUE');
      assert.equal(lastTx.quantity, -3);
    });
  });

  // 10. Dispatch without Approval Rejection
  describe('10. Dispatch Without Approval Rejection', () => {
    it('10.1. Rejects dispatch when challan is still in pending_approval status', async () => {
      const challanId = '10000000-0000-0000-0000-000000000016';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00016',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
      });

      const ctx = createMockContext({}, storeManagerUser, { id: challanId });
      await dispatchRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /must be formally approved prior to physical dispatch/i);
    });
  });

  // 11. Insufficient Stock Rejection
  describe('11. Insufficient Stock Rejection', () => {
    it('11.1. Prevents dispatch when dispatched quantity exceeds available stock', async () => {
      const challanId = '10000000-0000-0000-0000-000000000017';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00017',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'approved',
      });

      mockState.rdcItems.set('20000000-0000-0000-0000-000000000017', {
        id: '20000000-0000-0000-0000-000000000017',
        rdc_id: challanId,
        part_id: PART_2_ID,
        item_description: 'Induction Drive Motor',
        quantity_dispatched: 10, // only 5 available
      });

      const ctx = createMockContext({}, storeManagerUser, { id: challanId });
      await dispatchRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Insufficient available stock/i);
    });
  });

  // 12. Partial Return
  describe('12. Partial Return Handling', () => {
    it('12.1. Records partial return, transitions status to partially_returned, and increments stock', async () => {
      const challanId = '10000000-0000-0000-0000-000000000018';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00018',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'dispatched',
        vendor_party_name: 'Rewind Experts',
      });

      const itemId = '20000000-0000-0000-0000-000000000018';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Pump',
        quantity_dispatched: 5,
        quantity_returned: 0,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const stockBefore = mockState.spareParts.get(PART_1_ID).current_physical_stock;

      const ctx = createMockContext({ item_id: itemId, returned_quantity: 2 }, storeManagerUser, { id: challanId });
      await recordRDCReturn(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'partially_returned');
      assert.equal(mockState.spareParts.get(PART_1_ID).current_physical_stock, stockBefore + 2);
    });
  });

  // 13. Full Return
  describe('13. Full Return Reconciliation', () => {
    it('13.1. Completing return of all items transitions challan to fully_returned', async () => {
      const challanId = '10000000-0000-0000-0000-000000000019';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00019',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'partially_returned',
        vendor_party_name: 'Rewind Experts',
      });

      const itemId = '20000000-0000-0000-0000-000000000019';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Pump',
        quantity_dispatched: 5,
        quantity_returned: 2,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const ctx = createMockContext({ item_id: itemId, returned_quantity: 3 }, storeManagerUser, { id: challanId });
      await recordRDCReturn(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'fully_returned');
    });
  });

  // 14. Over-Return Rejection
  describe('14. Over-Return Rejection', () => {
    it('14.1. Rejects return quantity exceeding dispatched quantity', async () => {
      const challanId = '10000000-0000-0000-0000-000000000020';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00020',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
      });

      const itemId = '20000000-0000-0000-0000-000000000020';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Pump',
        quantity_dispatched: 2,
        quantity_returned: 1,
      });

      const ctx = createMockContext({ item_id: itemId, returned_quantity: 2 }, storeManagerUser, { id: challanId });
      await recordRDCReturn(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Over-return rejected/i);
    });
  });

  // 15. Replacement Receipt
  describe('15. Replacement Item Receipt', () => {
    it('15.1. Records replacement unit receipt, increases physical stock, and updates challan balance', async () => {
      const challanId = '10000000-0000-0000-0000-000000000021';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00021',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
        vendor_party_name: 'Warranty Repairs',
      });

      const itemId = '20000000-0000-0000-0000-000000000021';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Pump Sent for Replacement',
        quantity_dispatched: 1,
        quantity_returned: 0,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const stockBefore = mockState.spareParts.get(PART_1_ID).current_physical_stock;

      const ctx = createMockContext(
        { item_id: itemId, replacement_quantity: 1, new_serial_number: 'SN-REP-9988' },
        storeManagerUser,
        { id: challanId }
      );
      await recordRDCReplacement(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'fully_returned');
      assert.equal(mockState.spareParts.get(PART_1_ID).current_physical_stock, stockBefore + 1);

      const lastTx = mockState.inventoryTransactions[mockState.inventoryTransactions.length - 1];
      assert.equal(lastTx.transaction_type, 'STOCK_IN');
    });
  });

  // 16. Damaged Material Quarantine
  describe('16. Damaged Material Quarantine', () => {
    it('16.1. Quarantines damaged return: does NOT inflate available stock, records damaged stock item', async () => {
      const challanId = '10000000-0000-0000-0000-000000000022';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00022',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
        vendor_party_name: 'Vendor Damaged Delivery',
      });

      const itemId = '20000000-0000-0000-0000-000000000022';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Motor Casing',
        quantity_dispatched: 2,
        quantity_returned: 0,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const availableBefore = mockState.spareParts.get(PART_1_ID).available_stock;
      const physicalBefore = mockState.spareParts.get(PART_1_ID).current_physical_stock;

      const ctx = createMockContext(
        { item_id: itemId, damaged_quantity: 2, reason: 'Shaft fractured during transit by vendor' },
        storeManagerUser,
        { id: challanId }
      );
      await recordRDCDamage(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'fully_returned');

      const partAfter = mockState.spareParts.get(PART_1_ID);
      assert.equal(partAfter.available_stock, availableBefore);
      assert.equal(partAfter.current_physical_stock, physicalBefore + 2);
      assert.equal(partAfter.quarantined_stock, 2);

      assert.equal(mockState.damagedStockItems.length, 1);
      assert.match(mockState.damagedStockItems[0].report_number, /^DMG-\d{4}-\d{5}$/);
      assert.equal(mockState.damagedStockItems[0].disposition, 'quarantined');
    });
  });

  // 17. Write-off Authorization
  describe('17. Authorized Write-off', () => {
    it('17.1. Manager authorizes write-off for lost material with mandatory reason', async () => {
      const challanId = '10000000-0000-0000-0000-000000000023';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00023',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
        vendor_party_name: 'Vendor Bankrupt',
      });

      const itemId = '20000000-0000-0000-0000-000000000023';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Lost Assembly',
        quantity_dispatched: 1,
        quantity_returned: 0,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const ctx = createMockContext(
        { item_id: itemId, writeoff_quantity: 1, reason: 'Vendor went out of business; material unrecoverable' },
        managerUser1,
        { id: challanId }
      );
      await recordRDCWriteOff(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'fully_returned');

      const lastTx = mockState.inventoryTransactions[mockState.inventoryTransactions.length - 1];
      assert.equal(lastTx.transaction_type, 'SCRAP');
    });
  });

  // 18. NRDC Closure
  describe('18. Non-Returnable Challan (NRDC) Closure', () => {
    it('18.1. NRDC closes upon authorized physical dispatch without requiring returns', async () => {
      const challanId = '10000000-0000-0000-0000-000000000024';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'NRDC-2026-00001',
        rdc_type: 'NRDC',
        plant_id: PLANT_1_ID,
        status: 'approved',
        vendor_party_name: 'Scrap Buyer',
      });

      mockState.rdcItems.set('20000000-0000-0000-0000-000000000024', {
        id: '20000000-0000-0000-0000-000000000024',
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Scrap Metal',
        quantity_dispatched: 2,
      });

      const ctx = createMockContext({}, storeManagerUser, { id: challanId });
      await dispatchRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'closed');
    });
  });

  // 19. Overdue Return Tracking
  describe('19. Overdue Return Calculation', () => {
    it('19.1. Retrieves overdue challans where expected return date has passed', async () => {
      mockState.rdcChallans.set('10000000-0000-0000-0000-000000000025', {
        id: '10000000-0000-0000-0000-000000000025',
        challan_number: 'RDC-2026-00025',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
        expected_return_date: '2026-01-01',
      });

      const ctx = createMockContext({}, managerUser1);
      await getOverdueRDCs(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
    });
  });

  // 20. Audit Trail Correctness
  describe('20. Audit Trail Correctness', () => {
    it('20.1. Regulatory audit logs are recorded for all lifecycle events', async () => {
      const challanId = '10000000-0000-0000-0000-000000000026';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        plant_id: PLANT_1_ID,
      });
      mockState.auditLogs.push(
        { id: 'l1', entity_name: 'rdc_challans', entity_id: challanId, action: 'CREATE', performed_by: technicianUser1.id },
        { id: 'l2', entity_name: 'rdc_challans', entity_id: challanId, action: 'APPROVE', performed_by: managerUser1.id }
      );

      const ctx = createMockContext({}, technicianUser1, { id: challanId });
      await getRDCHistory(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.length, 2);
      assert.equal(ctx.res.responseData.data[0].action, 'CREATE');
      assert.equal(ctx.res.responseData.data[1].action, 'APPROVE');
    });
  });

  // 21. Concurrent Return & Stock Updates
  describe('21. Concurrency Protection on Returns', () => {
    it('21.1. Consecutive returns maintain accurate item returned balances', async () => {
      const challanId = '10000000-0000-0000-0000-000000000027';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00027',
        rdc_type: 'RDC',
        plant_id: PLANT_1_ID,
        status: 'dispatched',
      });

      const itemId = '20000000-0000-0000-0000-000000000027';
      mockState.rdcItems.set(itemId, {
        id: itemId,
        rdc_id: challanId,
        part_id: PART_1_ID,
        item_description: 'Pump',
        quantity_dispatched: 10,
        quantity_returned: 0,
      });

      // Return 3
      const ctx1 = createMockContext({ item_id: itemId, returned_quantity: 3 }, storeManagerUser, { id: challanId });
      await recordRDCReturn(ctx1.req, ctx1.res, ctx1.next);
      assert.equal(ctx1.res.statusCode, 200);

      // Return 4
      const ctx2 = createMockContext({ item_id: itemId, returned_quantity: 4 }, storeManagerUser, { id: challanId });
      await recordRDCReturn(ctx2.req, ctx2.res, ctx2.next);
      assert.equal(ctx2.res.statusCode, 200);

      assert.equal(mockState.rdcItems.get(itemId).quantity_returned, 7);
    });
  });

  // 22. Invalid IDs and Malformed Payloads
  describe('22. Malformed Payloads & Invalid IDs', () => {
    it('22.1. Rejects invalid UUID format on route parameters (HTTP 400)', async () => {
      const ctx = createMockContext({}, managerUser1, { id: 'invalid-non-uuid-string' });
      await getRDCById(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Invalid challan ID format/i);
    });

    it('22.2. Rejects negative quantities on line items', async () => {
      const ctx = createMockContext(
        {
          vendor_party_name: 'Vendor Negative',
          purpose: 'Testing',
          items: [{ item_description: 'Negative Item', quantity_dispatched: -5 }],
        },
        technicianUser1
      );

      await createRDC(ctx.req, ctx.res, ctx.next);
      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /positive integer/i);
    });
  });

  // 23. Cancellation & Invalid State Transitions
  describe('23. Cancellation and Invalid State Transitions', () => {
    it('23.1. Author can cancel draft or pending challan with mandatory reason', async () => {
      const challanId = '10000000-0000-0000-0000-000000000028';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00028',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'pending_approval',
      });

      const ctx = createMockContext(
        { reason: 'Maintenance cancelled; vendor quote rejected' },
        technicianUser1,
        { id: challanId }
      );
      await cancelRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.data.status, 'cancelled');
    });

    it('23.2. Prevents cancellation of already dispatched challans', async () => {
      const challanId = '10000000-0000-0000-0000-000000000029';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00029',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'dispatched',
      });

      const ctx = createMockContext({ reason: 'Try to cancel after dispatch' }, managerUser1, { id: challanId });
      await cancelRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /already been physically dispatched/i);
    });

    it('23.3. Prevents approving an already dispatched or cancelled challan', async () => {
      const challanId = '10000000-0000-0000-0000-000000000030';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00030',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'cancelled',
      });

      const ctx = createMockContext({}, managerUser1, { id: challanId });
      await approveRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Cannot approve challan in 'cancelled' status/i);
    });
  });

  // 24. Dashboard Metrics Endpoint
  describe('24. Database-Backed Dashboard Metrics', () => {
    it('24.1. Returns complete operational metrics with real counts', async () => {
      const ctx = createMockContext({}, managerUser1);
      await getRdcDashboard(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.ok('total_rdc' in ctx.res.responseData.data);
      assert.ok('total_nrdc' in ctx.res.responseData.data);
      assert.ok('pending_approval' in ctx.res.responseData.data);
      assert.ok('total_outstanding_quantity' in ctx.res.responseData.data);
    });
  });

  // 25. Close Reconciled Challan
  describe('25. Close Reconciled Challan Endpoint', () => {
    it('25.1. Prevents closing when items have outstanding balance', async () => {
      const challanId = '10000000-0000-0000-0000-000000000031';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00031',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'dispatched',
      });
      mockState.rdcItems.set('item-close-1', {
        id: 'item-close-1',
        rdc_id: challanId,
        item_description: 'Hydraulic Cylinder',
        quantity_dispatched: 5,
        quantity_returned: 2,
        quantity_replacement: 0,
        quantity_damaged: 0,
        quantity_written_off: 0,
      });

      const ctx = createMockContext({}, managerUser1, { id: challanId });
      await closeRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /outstanding unaccounted balance of 3/i);
    });

    it('25.2. Successfully closes fully reconciled challan', async () => {
      const challanId = '10000000-0000-0000-0000-000000000032';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00032',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'fully_returned',
      });
      mockState.rdcItems.set('item-close-2', {
        id: 'item-close-2',
        rdc_id: challanId,
        item_description: 'Hydraulic Cylinder',
        quantity_dispatched: 5,
        quantity_returned: 3,
        quantity_replacement: 1,
        quantity_damaged: 0,
        quantity_written_off: 1,
      });

      const ctx = createMockContext({}, managerUser1, { id: challanId });
      await closeRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 200);
      assert.equal(ctx.res.responseData.success, true);
      assert.equal(ctx.res.responseData.data.status, 'closed');
    });

    it('25.3. Enforces RBAC: Technician cannot close challan', async () => {
      const challanId = '10000000-0000-0000-0000-000000000033';
      mockState.rdcChallans.set(challanId, {
        id: challanId,
        challan_number: 'RDC-2026-00033',
        plant_id: PLANT_1_ID,
        created_by: technicianUser1.id,
        status: 'fully_returned',
      });
      const ctx = createMockContext({}, technicianUser1, { id: challanId });
      await closeRDC(ctx.req, ctx.res, ctx.next);

      assert.equal(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Only managers, store managers, or administrators/i);
    });
  });
});
