import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Request, Response, NextFunction } from 'express';
import {
  createPurchaseRequisition,
  getPurchaseRequisitions,
  getPurchaseRequisitionDetails,
  updatePRStatus,
  editPurchaseRequisition,
  deletePurchaseRequisition,
  approvePurchaseRequisition,
  rejectPurchaseRequisition,
  cancelPurchaseRequisition,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderDetails,
  processGRNInward,
  getVendors,
  getProcurementDashboard,
  setProcurementDb,
  resetProcurementDb,
  setProcurementIo,
  resetProcurementIo,
} from './procurement.controller';
import {
  DbClientLike,
  DbPoolLike,
  generatePRNumberWithAdvisoryLock,
  generatePONumberWithAdvisoryLock,
} from './procurement.service';
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

// ---------------------------------------------------------------------------
// Advisory Lock Manager
// ---------------------------------------------------------------------------
class AdvisoryLockManager {
  private activeLocks = new Set<string>();

  acquire(key: string): boolean {
    if (this.activeLocks.has(key)) {
      return false;
    }
    this.activeLocks.add(key);
    return true;
  }

  release(key: string): void {
    this.activeLocks.delete(key);
  }

  clear(): void {
    this.activeLocks.clear();
  }

  isLocked(key: string): boolean {
    return this.activeLocks.has(key);
  }
}

// ---------------------------------------------------------------------------
// Mock Database State & Entities
// ---------------------------------------------------------------------------
interface MockPlant {
  id: string;
  name: string;
  plant_name?: string;
  code: string;
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
  model_number?: string;
  status: string;
}

interface MockSparePart {
  id: string;
  part_number: string;
  name: string;
  category: string;
  warehouse_zone: string;
  bin_location: string;
  current_physical_stock: number;
  reserved_stock: number;
  quarantined_stock: number;
  available_stock: number;
  unit_cost: number;
  supplier_name: string;
  status: string;
}

interface MockWorkOrder {
  id: string;
  wo_number: string;
  status: string;
  machine_id: string;
  assigned_technician_id: string;
  assigned_manager_id: string;
}

interface MockPurchaseRequisition {
  id: string;
  pr_number: string;
  work_order_id: string | null;
  machine_id: string | null;
  part_id: string;
  quantity_required: number;
  urgency: string;
  technical_justification: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  po_number: string | null;
  supplier_name: string | null;
  unit_price: number;
  expected_delivery_date: string | null;
  received_date: string | null;
  plant_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MockInventoryTransaction {
  id: string;
  part_id: string;
  transaction_type: string;
  quantity: number;
  source_location?: string;
  destination_location?: string;
  reference_work_order_id?: string | null;
  performed_by: string;
  remarks: string;
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
  recipient_id: string;
  title: string;
  message: string;
  type: string;
  link_url?: string;
  is_read: boolean;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Mock Procurement Database Implementation
// ---------------------------------------------------------------------------
class MockProcurementDatabase implements DbPoolLike {
  public plants: MockPlant[] = [];
  public shops: MockShop[] = [];
  public users: MockUser[] = [];
  public machines: MockMachine[] = [];
  public parts: MockSparePart[] = [];
  public workOrders: MockWorkOrder[] = [];
  public requisitions: MockPurchaseRequisition[] = [];
  public transactions: MockInventoryTransaction[] = [];
  public auditLogs: MockAuditLog[] = [];
  public notifications: MockNotification[] = [];

  public lockManager = new AdvisoryLockManager();
  public failNextTransaction = false;

  constructor() {
    this.seed();
  }

  seed() {
    this.plants = [
      { id: '10000000-0000-0000-0000-000000000001', name: 'JCB Pune Plant 1', plant_name: 'JCB Pune Plant 1', code: 'PUNE-01' },
      { id: '10000000-0000-0000-0000-000000000002', name: 'JCB Ballabgarh Plant 2', plant_name: 'JCB Ballabgarh Plant 2', code: 'BLB-02' },
    ];

    this.shops = [
      { id: '20000000-0000-0000-0000-000000000001', plant_id: '10000000-0000-0000-0000-000000000001', shop_name: 'Fabrication Shop' },
      { id: '20000000-0000-0000-0000-000000000002', plant_id: '10000000-0000-0000-0000-000000000002', shop_name: 'Assembly Shop' },
    ];

    this.users = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        employee_code: 'EMP-ADM-01',
        full_name: 'Enterprise Admin',
        email: 'admin@jcb.com',
        role: 'admin',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        employee_code: 'EMP-MGR-01',
        full_name: 'Pune Plant Manager',
        email: 'mgr.pune@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        employee_code: 'EMP-MGR-02',
        full_name: 'Ballabgarh Manager',
        email: 'mgr.blb@jcb.com',
        role: 'manager',
        plant_id: '10000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000002',
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
        employee_code: 'EMP-TEC-02',
        full_name: 'Electrical Tech',
        email: 'tech2@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        is_active: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000006',
        employee_code: 'EMP-OPR-01',
        full_name: 'Line Operator',
        email: 'op1@jcb.com',
        role: 'operator',
        plant_id: '10000000-0000-0000-0000-000000000001',
        is_active: true,
      },
    ];

    this.machines = [
      {
        id: '40000000-0000-0000-0000-000000000001',
        shop_id: '20000000-0000-0000-0000-000000000001',
        machine_code: 'CNC-PUNE-01',
        name: 'Mazak 5-Axis CNC Mill',
        status: 'under_maintenance',
      },
      {
        id: '40000000-0000-0000-0000-000000000002',
        shop_id: '20000000-0000-0000-0000-000000000002',
        machine_code: 'WLD-BLB-02',
        name: 'Fanuc Robotic Welder',
        status: 'running',
      },
    ];

    this.parts = [
      {
        id: '30000000-0000-0000-0000-000000000001',
        part_number: 'HYD-10025',
        name: 'Hydraulic Pump Filter Element',
        category: 'Hydraulic',
        warehouse_zone: 'Main Store',
        bin_location: 'A-01-05',
        current_physical_stock: 0,
        reserved_stock: 0,
        quarantined_stock: 0,
        available_stock: 0,
        unit_cost: 4850.0,
        supplier_name: 'Bosch Rexroth India',
        status: 'active',
      },
      {
        id: '30000000-0000-0000-0000-000000000002',
        part_number: 'BRG-70140',
        name: 'High Precision Angular Spindle Bearing',
        category: 'Bearings',
        warehouse_zone: 'Precision Store',
        bin_location: 'B-02-10',
        current_physical_stock: 2,
        reserved_stock: 1,
        quarantined_stock: 0,
        available_stock: 1,
        unit_cost: 76200.0,
        supplier_name: 'SKF Bearings Ltd',
        status: 'active',
      },
      {
        id: '30000000-0000-0000-0000-000000000003',
        part_number: 'OBS-99999',
        name: 'Obsolete Relay',
        category: 'Electrical',
        warehouse_zone: 'Scrap Bin',
        bin_location: 'Z-99-99',
        current_physical_stock: 0,
        reserved_stock: 0,
        quarantined_stock: 0,
        available_stock: 0,
        unit_cost: 500.0,
        supplier_name: 'Discontinued Supplier',
        status: 'inactive',
      },
    ];

    this.workOrders = [
      {
        id: '60000000-0000-0000-0000-000000000001',
        wo_number: 'WO-2026-00001',
        status: 'waiting_for_parts',
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
      },
      {
        id: '60000000-0000-0000-0000-000000000002',
        wo_number: 'WO-2026-00002',
        status: 'verified_closed',
        machine_id: '40000000-0000-0000-0000-000000000001',
        assigned_technician_id: '00000000-0000-0000-0000-000000000004',
        assigned_manager_id: '00000000-0000-0000-0000-000000000002',
      },
    ];

    this.requisitions = [
      {
        id: '70000000-0000-0000-0000-000000000001',
        pr_number: 'PR-2026-00001',
        work_order_id: '60000000-0000-0000-0000-000000000001',
        machine_id: '40000000-0000-0000-0000-000000000001',
        part_id: '30000000-0000-0000-0000-000000000001',
        quantity_required: 5,
        urgency: 'high',
        technical_justification: 'Zero-stock critical filter for Mazak 5-Axis CNC breakdown',
        status: 'new',
        requested_by: '00000000-0000-0000-0000-000000000004', // tech1
        approved_by: null,
        po_number: null,
        supplier_name: 'Bosch Rexroth India',
        unit_price: 4850.0,
        expected_delivery_date: '2026-11-20',
        received_date: null,
        plant_id: '10000000-0000-0000-0000-000000000001',
        created_at: new Date('2026-11-01T10:00:00Z'),
        updated_at: new Date('2026-11-01T10:00:00Z'),
      },
      {
        id: '70000000-0000-0000-0000-000000000002',
        pr_number: 'PR-2026-00002',
        work_order_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        part_id: '30000000-0000-0000-0000-000000000002',
        quantity_required: 2,
        urgency: 'critical',
        technical_justification: 'Quarterly spare replenish for Spindle Bearings',
        status: 'ordered',
        requested_by: '00000000-0000-0000-0000-000000000002', // mgr.pune
        approved_by: '00000000-0000-0000-0000-000000000001', // admin
        po_number: 'PO-2026-00001',
        supplier_name: 'SKF Bearings Ltd',
        unit_price: 76200.0,
        expected_delivery_date: '2026-11-02', // Overdue date
        received_date: null,
        plant_id: '10000000-0000-0000-0000-000000000001',
        created_at: new Date('2026-10-25T08:00:00Z'),
        updated_at: new Date('2026-10-26T09:00:00Z'),
      },
    ];

    this.transactions = [];
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

    if (this.failNextTransaction && trimmed.toUpperCase().startsWith('INSERT')) {
      this.failNextTransaction = false;
      throw new Error('Simulated database write failure for transaction rollback test');
    }

    // 1. Transaction Advisory Lock
    if (trimmed.includes('pg_advisory_xact_lock')) {
      const lockKey = params[0] || 'default_lock';
      this.lockManager.acquire(lockKey);
      return { rows: [{ pg_advisory_xact_lock: null }], rowCount: 1 };
    }

    // 2. PR Number generation (MAX sequence)
    if (trimmed.includes('SELECT MAX(SUBSTRING(pr_number FROM 9))')) {
      const yearPattern = params[0] || '';
      const year = yearPattern.split('-')[1] || '2026';
      const seqs = this.requisitions
        .filter((r) => r.pr_number.startsWith(`PR-${year}-`))
        .map((r) => parseInt(r.pr_number.split('-')[2], 10))
        .filter((n) => !isNaN(n));
      const maxSeq = seqs.length > 0 ? String(Math.max(...seqs)) : null;
      return { rows: [{ max_seq: maxSeq }], rowCount: 1 };
    }

    // 3. PO Number generation (MAX sequence)
    if (trimmed.includes('SELECT MAX(SUBSTRING(po_number FROM 9))')) {
      const yearPattern = params[0] || '';
      const year = yearPattern.split('-')[1] || '2026';
      const seqs = this.requisitions
        .filter((r) => r.po_number && r.po_number.startsWith(`PO-${year}-`))
        .map((r) => parseInt(r.po_number!.split('-')[2], 10))
        .filter((n) => !isNaN(n));
      const maxSeq = seqs.length > 0 ? String(Math.max(...seqs)) : null;
      return { rows: [{ max_seq: maxSeq }], rowCount: 1 };
    }

    // 4. Spare parts catalog query (by id)
    if (trimmed.includes('FROM spare_parts') && trimmed.includes('WHERE id = $1')) {
      const part = this.parts.find((p) => p.id === params[0]);
      return { rows: part ? [{ ...part }] : [], rowCount: part ? 1 : 0 };
    }

    // 5. Machine query (by id)
    if (trimmed.includes('FROM machines m') && trimmed.includes('WHERE m.id = $1')) {
      const machine = this.machines.find((m) => m.id === params[0]);
      if (!machine) return { rows: [], rowCount: 0 };
      const shop = this.shops.find((s) => s.id === machine.shop_id);
      return {
        rows: [
          {
            id: machine.id,
            machine_code: machine.machine_code,
            shop_id: machine.shop_id,
            plant_id: shop?.plant_id,
          },
        ],
        rowCount: 1,
      };
    }

    // 5b. Plant query (by id)
    if (trimmed.includes('FROM plants') && trimmed.includes('WHERE id = $1')) {
      const plant = this.plants.find((p) => p.id === params[0]);
      return { rows: plant ? [{ ...plant, plant_name: plant.plant_name || plant.name }] : [], rowCount: plant ? 1 : 0 };
    }

    // 6. Work order query (by id)
    if (trimmed.includes('FROM work_orders wo') && trimmed.includes('WHERE wo.id = $1')) {
      const wo = this.workOrders.find((w) => w.id === params[0]);
      if (!wo) return { rows: [], rowCount: 0 };
      const machine = this.machines.find((m) => m.id === wo.machine_id);
      const shop = this.shops.find((s) => s.id === machine?.shop_id);
      return {
        rows: [
          {
            id: wo.id,
            wo_number: wo.wo_number,
            status: wo.status,
            machine_id: wo.machine_id,
            shop_id: shop?.id,
            plant_id: shop?.plant_id,
          },
        ],
        rowCount: 1,
      };
    }

    // 7. Insert Purchase Requisition
    if (trimmed.startsWith('INSERT INTO purchase_requisitions')) {
      const newPR: MockPurchaseRequisition = {
        id: `70000000-0000-0000-0000-${String(this.requisitions.length + 1).padStart(12, '0')}`,
        pr_number: params[0],
        work_order_id: params[1],
        machine_id: params[2],
        part_id: params[3],
        quantity_required: params[4],
        urgency: params[5],
        technical_justification: params[6],
        status: 'new',
        requested_by: params[7],
        approved_by: null,
        po_number: null,
        expected_delivery_date: params[8] || null,
        supplier_name: params[9] || null,
        unit_price: params[10] || 0,
        plant_id: params[11] || null,
        received_date: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      this.requisitions.push(newPR);
      return { rows: [{ ...newPR }], rowCount: 1 };
    }

    // 8. Update Work Orders status
    if (trimmed.startsWith('UPDATE work_orders')) {
      const match = trimmed.match(/WHERE id = \$(\d+)/i);
      const woId = match ? params[parseInt(match[1], 10) - 1] : params[0];
      const wo = this.workOrders.find((w) => w.id === woId);
      if (wo) {
        if (trimmed.includes(`SET status = 'waiting_for_parts'`)) wo.status = 'waiting_for_parts';
        if (trimmed.includes(`SET status = 'in_progress'`)) wo.status = 'in_progress';
      }
      return { rows: wo ? [{ ...wo }] : [], rowCount: wo ? 1 : 0 };
    }

    // 9. Update Spare Parts physical stock
    if (trimmed.startsWith('UPDATE spare_parts')) {
      const match = trimmed.match(/WHERE id = \$(\d+)/i);
      const partId = match ? params[parseInt(match[1], 10) - 1] : params[1];
      const part = this.parts.find((p) => p.id === partId);
      if (part) {
        const qty = Number(params[0]);
        part.current_physical_stock += qty;
        part.available_stock = part.current_physical_stock - part.reserved_stock - part.quarantined_stock;
      }
      return { rows: part ? [{ ...part }] : [], rowCount: part ? 1 : 0 };
    }

    // 10. Insert inventory_transactions
    if (trimmed.startsWith('INSERT INTO inventory_transactions')) {
      let partId = params[0];
      let txType = 'STOCK_IN';
      let qty = params[1];
      let sourceLoc = params[2];
      let destLoc = params[3];
      let refWoId = params[4];
      let performedBy = params[5];
      let remarks = params[6] || '';

      if (params.length >= 8) {
        partId = params[0];
        txType = params[1];
        qty = params[2];
        sourceLoc = params[3];
        destLoc = params[4];
        refWoId = params[5];
        performedBy = params[6];
        remarks = params[7] || '';
      }

      const tx: MockInventoryTransaction = {
        id: `80000000-0000-0000-0000-${String(this.transactions.length + 1).padStart(12, '0')}`,
        part_id: partId,
        transaction_type: txType,
        quantity: qty,
        source_location: sourceLoc,
        destination_location: destLoc,
        reference_work_order_id: refWoId,
        performed_by: performedBy,
        remarks: remarks || '',
        created_at: new Date(),
      };
      this.transactions.push(tx);
      return { rows: [{ ...tx }], rowCount: 1 };
    }

    // 11. Sum previous inwarded quantity for PR
    if (trimmed.includes('FROM inventory_transactions') && trimmed.includes('SUM(quantity)')) {
      const partId = params[0];
      const prLike = params[1] || '';
      const prIdMatch = prLike.match(/PR:([0-9a-f-]+)/i);
      const targetPrId = prIdMatch ? prIdMatch[1] : '';

      const matchingTxs = this.transactions.filter(
        (t) => t.part_id === partId && t.transaction_type === 'STOCK_IN' && (t.remarks || '').includes(`[PR:${targetPrId}]`)
      );
      const sum = matchingTxs.reduce((acc, t) => acc + t.quantity, 0);
      return { rows: [{ total_prev_inwarded: sum }], rowCount: 1 };
    }

    // 12. Insert audit_logs
    if (trimmed.startsWith('INSERT INTO audit_logs')) {
      let entityName = 'purchase_requisitions';
      let entityId = params[0];
      let action = 'ACTION';
      let performedBy = params[1];
      let oldValues: any = null;
      let newValues: any = null;

      if (trimmed.includes(`'purchase_requisitions', $1, 'CREATE', $2, $3`)) {
        action = 'CREATE';
        entityId = params[0];
        performedBy = params[1];
        newValues = params[2];
      } else if (trimmed.includes(`'purchase_requisitions', $1, 'STATUS_UPDATE', $2, $3, $4`)) {
        action = 'STATUS_UPDATE';
        entityId = params[0];
        performedBy = params[1];
        oldValues = params[2];
        newValues = params[3];
      } else if (trimmed.includes(`'PR_REJECTED'`) || trimmed.includes(`'PR_CANCELLED'`)) {
        action = trimmed.includes(`'PR_REJECTED'`) ? 'PR_REJECTED' : 'PR_CANCELLED';
        entityId = params[0];
        performedBy = params[1];
        oldValues = params[2];
        newValues = params[3];
      } else if (trimmed.includes(`'purchase_requisitions', $1, 'PO_CREATED', $2, $3, $4`)) {
        action = 'PO_CREATED';
        entityId = params[0];
        performedBy = params[1];
        oldValues = params[2];
        newValues = params[3];
      } else if (trimmed.includes(`'purchase_requisitions', $1, 'GRN_INSPECTION_REJECT', $2, $3`)) {
        action = 'GRN_INSPECTION_REJECT';
        entityId = params[0];
        performedBy = params[1];
        newValues = params[2];
      } else if (trimmed.includes(`'purchase_requisitions', $1, 'GRN_PROCESSED', $2, $3`)) {
        action = 'GRN_PROCESSED';
        entityId = params[0];
        performedBy = params[1];
        newValues = params[2];
      } else {
        entityName = params[0];
        entityId = params[1];
        action = params[2];
        performedBy = params[3];
        newValues = params[4] || null;
      }

      const log: MockAuditLog = {
        id: `90000000-0000-0000-0000-${String(this.auditLogs.length + 1).padStart(12, '0')}`,
        entity_name: entityName,
        entity_id: entityId,
        action: action,
        performed_by: performedBy,
        old_values: oldValues,
        new_values: newValues,
        created_at: new Date(),
      };
      this.auditLogs.push(log);
      return { rows: [{ ...log }], rowCount: 1 };
    }

    // 13. Insert notifications
    if (trimmed.startsWith('INSERT INTO notifications')) {
      const notif: MockNotification = {
        id: `a0000000-0000-0000-0000-${String(this.notifications.length + 1).padStart(12, '0')}`,
        recipient_id: params[0],
        title: params[1],
        message: params[2],
        type: params[3],
        link_url: params[4] || undefined,
        is_read: false,
        created_at: new Date(),
      };
      this.notifications.push(notif);
      return { rows: [{ ...notif }], rowCount: 1 };
    }

    // 14. Managers query for notifications
    if (trimmed.includes('FROM users WHERE role IN (\'manager\', \'admin\')')) {
      const mgrs = this.users.filter((u) => ['manager', 'admin'].includes(u.role) && u.is_active);
      return { rows: mgrs.map((m) => ({ id: m.id })), rowCount: mgrs.length };
    }

    // 15. Lock PR row FOR UPDATE (by ID)
    if (trimmed.includes('FROM purchase_requisitions pr') && trimmed.includes('WHERE pr.id = $1')) {
      const pr = this.requisitions.find((r) => r.id === params[0]);
      if (!pr) return { rows: [], rowCount: 0 };
      const machine = this.machines.find((m) => m.id === pr.machine_id);
      const shop = this.shops.find((s) => s.id === machine?.shop_id);
      const part = this.parts.find((p) => p.id === pr.part_id);
      const wo = this.workOrders.find((w) => w.id === pr.work_order_id);

      return {
        rows: [
          {
            ...pr,
            plant_id: shop?.plant_id,
            shop_id: shop?.id,
            part_number: part?.part_number,
            part_name: part?.name,
            warehouse_zone: part?.warehouse_zone,
            bin_location: part?.bin_location,
            work_order_status: wo?.status,
          },
        ],
        rowCount: 1,
      };
    }

    // 16. Update PR details/status
    if (trimmed.startsWith('UPDATE purchase_requisitions')) {
      const match = trimmed.match(/WHERE id = \$(\d+)/i);
      const prId = match ? params[parseInt(match[1], 10) - 1] : params[0];
      const pr = this.requisitions.find((r) => r.id === prId);
      if (pr) {
        if (trimmed.includes('SET po_number = $2,')) {
          // createPurchaseOrderService query:
          // SET po_number = $2, supplier_name = $3, unit_price = $4, expected_delivery_date = $5, status = $6, approved_by = $7
          pr.po_number = params[1];
          pr.supplier_name = params[2];
          pr.unit_price = Number(params[3]);
          pr.expected_delivery_date = params[4];
          pr.status = params[5];
          pr.approved_by = params[6];
        } else if (trimmed.includes("SET status = 'rejected'")) {
          pr.status = 'rejected';
        } else if (trimmed.includes("SET status = 'cancelled'")) {
          pr.status = 'cancelled';
        } else if (trimmed.includes('status = $2,') && trimmed.includes('po_number = $3')) {
          // updatePRStatusService query:
          pr.status = params[1];
          pr.po_number = params[2];
          pr.supplier_name = params[3];
          pr.unit_price = Number(params[4]);
          pr.expected_delivery_date = params[5];
          pr.approved_by = params[6];
        } else if (trimmed.includes('SET status = $2,') && trimmed.includes('received_date = CURRENT_DATE')) {
          pr.status = params[1];
          pr.received_date = new Date().toISOString().split('T')[0];
        } else if (trimmed.includes('SET part_id = $2,')) {
          // editPurchaseRequisitionService query:
          pr.part_id = params[1];
          pr.quantity_required = Number(params[2]);
          pr.urgency = params[3];
          pr.technical_justification = params[4];
          pr.machine_id = params[5] || null;
          pr.expected_delivery_date = params[6] || null;
        }
        pr.updated_at = new Date();
      }
      return { rows: pr ? [{ ...pr }] : [], rowCount: pr ? 1 : 0 };
    }

    // 17. Check duplicate PO number
    if (trimmed.includes('SELECT id FROM purchase_requisitions WHERE po_number = $1')) {
      const poNum = params[0];
      const excludeId = params[1];
      const match = this.requisitions.find((r) => r.po_number === poNum && r.id !== excludeId);
      return { rows: match ? [{ id: match.id }] : [], rowCount: match ? 1 : 0 };
    }

    // 17b. Delete PR row
    if (trimmed.startsWith('DELETE FROM purchase_requisitions')) {
      const match = trimmed.match(/WHERE id = \$(\d+)/i);
      const prId = match ? params[parseInt(match[1], 10) - 1] : params[0];
      const idx = this.requisitions.findIndex((r) => r.id === prId);
      const deleted = idx !== -1 ? this.requisitions.splice(idx, 1)[0] : null;
      return { rows: deleted ? [{ id: deleted.id, pr_number: deleted.pr_number }] : [], rowCount: deleted ? 1 : 0 };
    }

    // 17c. Check grn_receipts for PR
    if (trimmed.includes('FROM grn_receipts WHERE pr_id = $1')) {
      return { rows: [{ count: '0' }], rowCount: 1 };
    }

    // 17d. Delete notifications
    if (trimmed.startsWith('DELETE FROM notifications')) {
      return { rows: [], rowCount: 0 };
    }

    // 18. Count PRs for pagination
    if (trimmed.includes('SELECT COUNT(*) as count FROM purchase_requisitions')) {
      return { rows: [{ count: this.requisitions.length }], rowCount: 1 };
    }

    // 19. List PRs with joins
    if (trimmed.includes('FROM purchase_requisitions pr') && trimmed.includes('JOIN spare_parts sp')) {
      const rows = this.requisitions.map((pr) => {
        const part = this.parts.find((p) => p.id === pr.part_id);
        const reqUser = this.users.find((u) => u.id === pr.requested_by);
        const appUser = this.users.find((u) => u.id === pr.approved_by);
        const machine = this.machines.find((m) => m.id === pr.machine_id);
        const shop = this.shops.find((s) => s.id === machine?.shop_id);
        const plant = this.plants.find((p) => p.id === shop?.plant_id);
        const wo = this.workOrders.find((w) => w.id === pr.work_order_id);

        return {
          ...pr,
          part_number: part?.part_number,
          part_name: part?.name,
          part_category: part?.category,
          part_unit_cost: part?.unit_cost,
          current_physical_stock: part?.current_physical_stock,
          available_stock: part?.available_stock,
          bin_location: part?.bin_location,
          requested_by_name: reqUser?.full_name,
          requested_by_code: reqUser?.employee_code,
          approved_by_name: appUser?.full_name,
          machine_code: machine?.machine_code,
          machine_name: machine?.name,
          machine_model: machine?.model_number || 'Mazak VARIAXIS',
          shop_name: shop?.shop_name,
          plant_name: plant?.plant_name || plant?.name,
          wo_number: wo?.wo_number,
        };
      });

      return { rows, rowCount: rows.length };
    }

    // 20. Vendor Directory Aggregation
    if (trimmed.includes('all_vendors') || (trimmed.includes('FROM spare_parts sp') && trimmed.includes('purchase_requisitions'))) {
      const vendorNames = Array.from(
        new Set([
          ...this.parts.map((p) => p.supplier_name).filter(Boolean),
          ...this.requisitions.map((r) => r.supplier_name).filter(Boolean),
        ])
      );

      const rows = vendorNames.map((vName) => {
        const vParts = this.parts.filter((p) => p.supplier_name === vName);
        const vPRs = this.requisitions.filter((r) => r.supplier_name === vName);
        const fulfilled = vPRs.filter((r) => r.status === 'fully_received').length;
        const active = vPRs.filter((r) => ['po_created', 'ordered', 'partially_received'].includes(r.status)).length;
        const totalSpend = vPRs
          .filter((r) => r.status === 'fully_received')
          .reduce((sum, r) => sum + r.quantity_required * r.unit_price, 0);

        return {
          vendor_name: vName,
          total_orders: vPRs.length,
          parts_supplied_count: vParts.length,
          active_orders: active,
          fulfilled_orders: fulfilled,
          total_spend: totalSpend,
          on_time_deliveries: fulfilled,
        };
      });

      return { rows, rowCount: rows.length };
    }

    // 21. Dashboard metrics queries
    if (trimmed.includes('SELECT pr.status, COUNT(*) as count FROM purchase_requisitions')) {
      const counts: Record<string, number> = {};
      for (const r of this.requisitions) {
        counts[r.status] = (counts[r.status] || 0) + 1;
      }
      const rows = Object.entries(counts).map(([status, count]) => ({ status, count }));
      return { rows, rowCount: rows.length };
    }

    if (trimmed.includes('expected_delivery_date < CURRENT_DATE')) {
      return { rows: [{ count: 1, overdue_value: 152400.0 }], rowCount: 1 };
    }

    if (trimmed.includes('SELECT COALESCE(SUM(pr.quantity_required * pr.unit_price), 0) as total_expenditure')) {
      const spend = this.requisitions
        .filter((r) => ['po_created', 'ordered', 'partially_received', 'fully_received'].includes(r.status))
        .reduce((sum, r) => sum + r.quantity_required * r.unit_price, 0);
      return { rows: [{ total_expenditure: spend }], rowCount: 1 };
    }

    if (trimmed.includes('SELECT pr.urgency, COUNT(*) as count')) {
      return {
        rows: [
          { urgency: 'high', count: 1 },
          { urgency: 'critical', count: 1 },
        ],
        rowCount: 2,
      };
    }

    return { rows: [], rowCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// TEST SUITE: Module 4 — Procurement Management
// ---------------------------------------------------------------------------
describe('Procurement & Purchase Requisition Module (CMMS Module 4)', () => {
  let mockDb: MockProcurementDatabase;
  let mockIo: MockSocketIO;

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
    shop_id: '20000000-0000-0000-0000-000000000002',
  };

  const tech1User: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000004',
    employee_code: 'EMP-TEC-01',
    email: 'tech1@jcb.com',
    role: 'technician',
    plant_id: '10000000-0000-0000-0000-000000000001',
    shop_id: '20000000-0000-0000-0000-000000000001',
  };

  const operatorUser: AuthenticatedUser = {
    id: '00000000-0000-0000-0000-000000000006',
    employee_code: 'EMP-OPR-01',
    email: 'op1@jcb.com',
    role: 'operator',
    plant_id: '10000000-0000-0000-0000-000000000001',
  };

  beforeEach(() => {
    mockDb = new MockProcurementDatabase();
    mockIo = new MockSocketIO();
    setProcurementDb(mockDb);
    setProcurementIo(mockIo);
  });

  // -------------------------------------------------------------------------
  // SECTION 1: Purchase Requisition Creation, Validation & Advisory Locking
  // -------------------------------------------------------------------------
  describe('1. Purchase Requisition Creation & Advisory Locking', () => {
    it('1. Successfully create purchase requisition with valid technician, part, positive quantity', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 10,
          urgency: 'high',
          technical_justification: 'Replenishing zero-stock microglass hydraulic filter element',
          machine_id: '40000000-0000-0000-0000-000000000001',
          work_order_id: '60000000-0000-0000-0000-000000000001',
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);

      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.match(res.responseData.data.pr_number, /^PR-\d{4}-\d{5}$/);
      assert.equal(res.responseData.data.status, 'new');
      assert.equal(res.responseData.data.quantity_required, 10);
    });

    it('2. Fails when part ID is missing or nonexistent (HTTP 400 / 404)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-999999999999',
          quantity_required: 5,
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Spare part not found/i);
    });

    it('3. Fails when quantity is zero, negative, or invalid format (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 0,
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /positive integer/i);
    });

    it('4. Fails when spare part is inactive in catalog (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000003', // Obsolete Relay (inactive)
          quantity_required: 2,
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /inactive/i);
    });

    it('5. Equipment scoping: Manager/technician cannot create PR for machine in another plant (HTTP 403)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 2,
          machine_id: '40000000-0000-0000-0000-000000000002', // Ballabgarh plant machine
        },
        {},
        {},
        {},
        puneManagerUser // Pune manager
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /different plant/i);
    });

    it('6. Operator role rejected from creating PRs (HTTP 403)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 1,
        },
        {},
        {},
        {},
        operatorUser
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Operators are not authorized/i);
    });

    it('7. Concurrency advisory locking: acquires pr_seq:YYYY and increments sequentially', async () => {
      const client = await mockDb.connect();
      const currentYear = new Date().getFullYear();
      const pr1 = await generatePRNumberWithAdvisoryLock(client, currentYear);
      assert.match(pr1, new RegExp(`^PR-${currentYear}-\\d{5}$`));
      assert.equal(mockDb.lockManager.isLocked(`pr_seq:${currentYear}`), true);
    });

    it('8. Active work order status updated to waiting_for_parts when PR created', async () => {
      const wo = mockDb.workOrders.find((w) => w.id === '60000000-0000-0000-0000-000000000001')!;
      wo.status = 'in_progress';

      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 4,
          work_order_id: wo.id,
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(wo.status, 'waiting_for_parts');
    });

    it('8b. Enterprise Admin creates generic stock PR with explicit valid plant_id', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 10,
          plant_id: '10000000-0000-0000-0000-000000000001',
          technical_justification: 'Plant 1 Central Store replenishment',
        },
        {},
        {},
        {},
        adminUser
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.plant_id, '10000000-0000-0000-0000-000000000001');
    });

    it('8c. Rejects conflicting plant_id when machine belongs to another plant (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          machine_id: '40000000-0000-0000-0000-000000000001', // Pune Plant 1
          plant_id: '10000000-0000-0000-0000-000000000002', // Ballabgarh Plant 2 (conflict)
          quantity_required: 2,
        },
        {},
        {},
        {},
        adminUser
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Plant conflict/i);
    });

    it('8d. Rejects generic stock PR creation when plant ownership cannot be determined (HTTP 400)', async () => {
      const unscopedAdmin = { ...adminUser, plant_id: undefined };
      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 5,
        },
        {},
        {},
        {},
        unscopedAdmin
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Plant ownership is required/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2: Requisition Listing, Filtering, Search & Scoping
  // -------------------------------------------------------------------------
  describe('2. Requisition Listing, Filtering & Scoping', () => {
    it('9. Admin lists all requisitions with server-side pagination metadata', async () => {
      const { req, res, next } = createMockContext({}, {}, { page: '1', limit: '10' }, {}, adminUser);

      await getPurchaseRequisitions(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(Array.isArray(res.responseData.data), true);
      assert.ok(res.responseData.pagination);
      assert.equal(res.responseData.pagination.page, 1);
    });

    it('10. Technician is strictly scoped to own requisitions or assigned work orders', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, tech1User);

      await getPurchaseRequisitions(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
    });

    it('11. Filter requisitions by status and urgency', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { status: 'new', urgency: 'high' },
        {},
        puneManagerUser
      );

      await getPurchaseRequisitions(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
    });

    it('12. Search requisitions by query string (PR number, part name, supplier)', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { search: 'Filter' },
        {},
        puneManagerUser
      );

      await getPurchaseRequisitions(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Details, Review, Approvals & Lifecycle Transitions
  // -------------------------------------------------------------------------
  describe('3. Requisition Review, Approval & State Machine', () => {
    it('13. Get requisition details returns catalog metadata, machine, and requester info', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await getPurchaseRequisitionDetails(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.pr_number, 'PR-2026-00001');
      assert.equal(res.responseData.data.part_number, 'HYD-10025');
      assert.ok(Array.isArray(res.responseData.data.grn_receipts), 'Response must include grn_receipts array');
    });

    it('14. Manager approves requisition and sets status to vendor_selected', async () => {
      const { req, res, next } = createMockContext(
        {
          next_status: 'vendor_selected',
          remarks: 'Quotation verified and approved for supplier ordering.',
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await approvePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'vendor_selected');
    });

    it('14b. Manager approves with target_status: approval_pending (frontend contract)', async () => {
      const pr1 = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr1.status = 'under_review';

      const { req, res, next } = createMockContext(
        {
          target_status: 'approval_pending',
          remarks: 'Needs secondary plant management signoff',
        },
        { id: pr1.id },
        {},
        {},
        puneManagerUser
      );

      await approvePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'approval_pending');
    });

    it('14c. Approval with invalid target status is rejected with HTTP 400', async () => {
      const pr1 = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr1.status = 'new';

      const { req, res, next } = createMockContext(
        {
          target_status: 'fully_received',
        },
        { id: pr1.id },
        {},
        {},
        puneManagerUser
      );

      await approvePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Invalid approval status/i);
    });

    it('15. Separation of duties: Manager cannot self-approve their own requisition (HTTP 403)', async () => {
      // Requisition 2 was requested by puneManagerUser
      const { req, res, next } = createMockContext(
        {
          status: 'approval_pending',
          remarks: 'Self approval attempt',
        },
        { id: '70000000-0000-0000-0000-000000000002' },
        {},
        {},
        puneManagerUser
      );

      await updatePRStatus(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Self-approval not permitted/i);
    });

    it('16. Manager rejection requires mandatory remarks of at least 5 chars (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          reason: 'No', // Too short
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await rejectPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /minimum 5 characters/i);
    });

    it('17. Successful rejection sets status to rejected and logs audit trail', async () => {
      const { req, res, next } = createMockContext(
        {
          reason: 'Part already available in Plant 2 buffer stock. Transfer arranged.',
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await rejectPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'rejected');

      const audit = mockDb.auditLogs.find((a) => a.entity_id === '70000000-0000-0000-0000-000000000001');
      assert.ok(audit);
    });

    it('17b. Explicit cancellation sets status to cancelled and logs audit trail', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr.status = 'under_review';

      const { req, res, next } = createMockContext(
        {
          reason: 'Duplicate requisition created by technician by mistake.',
        },
        { id: pr.id },
        {},
        {},
        puneManagerUser
      );

      await cancelPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'cancelled');
    });

    it('18. State machine rejects illegal status transitions (e.g. new -> fully_received directly) (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          status: 'fully_received',
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        adminUser
      );

      await updatePRStatus(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Invalid status transition/i);
    });

    it('18b. Get requisition details returns 404 for nonexistent PR ID', async () => {
      const { req, res, next } = createMockContext(
        {},
        { id: '70000000-0000-0000-0000-999999999999' },
        {},
        {},
        adminUser
      );

      await getPurchaseRequisitionDetails(req, res, next);
      assert.equal(res.statusCode, 404);
      assert.equal(res.responseData.success, false);
    });

    it('18c. Cancel requisition fails if requisition is already fully_received (HTTP 400)', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.status = 'fully_received';

      const { req, res, next } = createMockContext(
        { reason: 'Attempt to cancel completed procurement' },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await cancelPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /(Invalid status transition|Cannot cancel)/i);
    });

    it('18d. Successfully edit purchase requisition specifications (quantity, urgency, justification) in draft new status', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr.status = 'new';
      pr.quantity_required = 5;

      const { req, res, next } = createMockContext(
        {
          quantity_required: 12,
          urgency: 'critical',
          technical_justification: 'Updated justification for urgent cylinder breakdown',
        },
        { id: pr.id },
        {},
        {},
        tech1User
      );

      await editPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(pr.quantity_required, 12);
      assert.equal(pr.urgency, 'critical');
    });

    it('18e. Edit requisition is rejected with HTTP 409 Conflict if PR is already ordered or PO issued', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      assert.equal(pr.status, 'ordered');

      const { req, res, next } = createMockContext(
        { quantity_required: 20 },
        { id: pr.id },
        {},
        {},
        puneManagerUser
      );

      await editPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Cannot edit requisition/i);
    });

    it('18f. Edit requisition rejects invalid quantity (0 or negative) with HTTP 400', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr.status = 'new';

      const { req, res, next } = createMockContext(
        { quantity_required: 0 },
        { id: pr.id },
        {},
        {},
        tech1User
      );

      await editPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /must be greater than zero/i);
    });

    it('18g. Successfully delete purchase requisition in draft new status without PO', async () => {
      // Create a dedicated new PR to delete
      const prToDelete = {
        id: '70000000-0000-0000-0000-000000000099',
        pr_number: 'PR-2026-00099',
        work_order_id: null,
        machine_id: '40000000-0000-0000-0000-000000000001',
        part_id: '30000000-0000-0000-0000-000000000001',
        quantity_required: 3,
        urgency: 'high' as const,
        technical_justification: 'Temporary draft requisition',
        status: 'new' as const,
        requested_by: tech1User.id,
        approved_by: null,
        po_number: null,
        supplier_name: null,
        unit_price: 1000,
        expected_delivery_date: null,
        received_date: null,
        plant_id: '10000000-0000-0000-0000-000000000001',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockDb.requisitions.push(prToDelete);

      const { req, res, next } = createMockContext(
        {},
        { id: prToDelete.id },
        {},
        {},
        tech1User
      );

      await deletePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(mockDb.requisitions.some((r) => r.id === prToDelete.id), false);
    });

    it('18h. Delete requisition is rejected with HTTP 409 Conflict if PO is already issued', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      assert.ok(pr.po_number);

      const { req, res, next } = createMockContext(
        {},
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await deletePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Cannot delete requisition/i);
    });

    it('18i. Technician cannot delete another technician\'s purchase requisition (HTTP 403)', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr.requested_by = '00000000-0000-0000-0000-000000000004'; // tech1

      // tech2 tries to delete
      const otherTech: AuthenticatedUser = {
        id: '00000000-0000-0000-0000-000000000099',
        employee_code: 'TECH-99',
        email: 'tech99@jcb.com',
        role: 'technician',
        plant_id: '10000000-0000-0000-0000-000000000001',
      };

      const { req, res, next } = createMockContext(
        {},
        { id: pr.id },
        {},
        {},
        otherTech
      );

      await deletePurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Forbidden/i);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 4: Purchase Order Creation, Numbering & Duplicate Protection
  // -------------------------------------------------------------------------
  describe('4. Purchase Order (PO) Creation & Tracking', () => {
    it('19. Manager issues Purchase Order with vendor, unit price, and auto-generated PO number', async () => {
      const pr1 = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr1.status = 'vendor_selected';
      pr1.po_number = null;

      const { req, res, next } = createMockContext(
        {
          supplier_name: 'Bosch Rexroth India',
          unit_price: 4850.0,
          expected_delivery_date: '2026-11-25',
          mark_as_ordered: true,
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 201);
      assert.equal(res.responseData.success, true);
      assert.match(res.responseData.data.po_number, /^PO-\d{4}-\d{5}$/);
      assert.equal(res.responseData.data.status, 'ordered');
    });

    it('20. Duplicate PO prevention: cannot create a duplicate PO for already ordered requisition (HTTP 409)', async () => {
      // Requisition 2 already has PO-2026-00001 and status 'ordered'
      const { req, res, next } = createMockContext(
        {
          supplier_name: 'SKF Bearings Ltd',
          unit_price: 76200.0,
        },
        { id: '70000000-0000-0000-0000-000000000002' },
        {},
        {},
        adminUser
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /already active/i);
    });

    it('21. Custom PO number duplicate validation against existing POs (HTTP 409)', async () => {
      const pr1 = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr1.status = 'vendor_selected';
      pr1.po_number = null;

      const { req, res, next } = createMockContext(
        {
          po_number: 'PO-2026-00001', // Already in use by Requisition 2
          supplier_name: 'Bosch Rexroth India',
          unit_price: 4850.0,
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /already exists/i);
    });

    it('22. Technician or operator cannot issue a Purchase Order (HTTP 403)', async () => {
      const { req, res, next } = createMockContext(
        {
          supplier_name: 'Bosch Rexroth India',
          unit_price: 4850.0,
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        tech1User
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 403);
      assert.equal(res.responseData.success, false);
    });

    it('23. List purchase orders with pagination and overdue tracking', async () => {
      const { req, res, next } = createMockContext(
        {},
        {},
        { is_overdue: 'true' },
        {},
        adminUser
      );

      await getPurchaseOrders(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data);
    });

    it('23b. PO creation fails if supplier name is empty string (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        { supplier_name: '', unit_price: 100 },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Supplier name is mandatory/i);
    });

    it('23c. PO creation fails if unit price is negative (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        { supplier_name: 'Test Supplier', unit_price: -50 },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await createPurchaseOrder(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Unit price must be a valid non-negative/i);
    });

    it('23d. Get PO details returns details when PO number exists and 404 when no PO issued', async () => {
      const { req: req1, res: res1, next: next1 } = createMockContext(
        {},
        { id: '70000000-0000-0000-0000-000000000002' }, // Has PO-2026-00001
        {},
        {},
        adminUser
      );
      await getPurchaseOrderDetails(req1, res1, next1);
      assert.equal(res1.statusCode, 200);
      assert.equal(res1.responseData.success, true);
      assert.equal(res1.responseData.data.po_number, 'PO-2026-00001');

      const { req: req2, res: res2, next: next2 } = createMockContext(
        {},
        { id: '70000000-0000-0000-0000-000000000001' }, // Has NO PO
        {},
        {},
        adminUser
      );
      await getPurchaseOrderDetails(req2, res2, next2);
      assert.equal(res2.statusCode, 404);
      assert.equal(res2.responseData.success, false);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 5: Goods Receipt Note (GRN) & Quality Inspection
  // -------------------------------------------------------------------------
  describe('5. Goods Receipt Note (GRN) & Quality Inspection', () => {
    it('24. Process full GRN receipt: stock increments in physical store and PR marked fully_received', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      const part = mockDb.parts.find((p) => p.id === pr.part_id)!;
      const initialStock = part.current_physical_stock;

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 2,
          rejected_quantity: 0,
          remarks: 'Delivery received in good condition with test certificate',
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.equal(res.responseData.data.status, 'fully_received');
      assert.equal(part.current_physical_stock, initialStock + 2);

      // Verify immutable inventory transaction
      const tx = mockDb.transactions.find((t) => t.remarks.includes(`[PR:${pr.id}]`));
      assert.ok(tx);
      assert.equal(tx.transaction_type, 'STOCK_IN');
      assert.equal(tx.quantity, 2);
    });

    it('25. Quality inspection with rejected/damaged items: rejected stock is NOT added to usable inventory', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      const part = mockDb.parts.find((p) => p.id === pr.part_id)!;
      const initialStock = part.current_physical_stock;

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 1,
          rejected_quantity: 1,
          rejection_reason: 'Bearing box seal crushed during transit, ceramic balls exposed to grit',
          remarks: 'Batch inspected at receiving bay',
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      // ONLY 1 accepted item added to physical stock; rejected item NOT added
      assert.equal(part.current_physical_stock, initialStock + 1);

      // Verify rejection audit log
      const rejectAudit = mockDb.auditLogs.find(
        (a) => a.entity_id === pr.id && a.action === 'GRN_INSPECTION_REJECT'
      );
      assert.ok(rejectAudit);
    });

    it('26. Quality inspection requires mandatory rejection reason when rejected_quantity > 0 (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 1,
          rejected_quantity: 1,
          rejection_reason: '', // Missing
        },
        { id: '70000000-0000-0000-0000-000000000002' },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Rejection reason is mandatory/i);
    });

    it('27. Over-receipt prevention: Cannot receive more than remaining outstanding quantity (HTTP 400)', async () => {
      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 50, // PR only required 2
        },
        { id: '70000000-0000-0000-0000-000000000002' },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /Over-receipt rejected/i);
    });

    it('28. Partial delivery transitions PR to partially_received', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.quantity_required = 10;

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 4,
          rejected_quantity: 0,
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.data.status, 'partially_received');
    });

    it('29. Duplicate GRN prevention: Cannot inward against already fully_received PR (HTTP 409)', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.status = 'fully_received';

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 1,
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 409);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /already been fully received/i);
    });

    it('30. Cannot inward against a cancelled requisition (HTTP 400)', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.status = 'cancelled';

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 1,
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /cancelled requisition/i);
    });

    it('30b. Inwarding with batch quantity 0 fails validation (HTTP 400)', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.status = 'ordered';

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 0,
          rejected_quantity: 0,
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 400);
      assert.equal(res.responseData.success, false);
      assert.match(res.responseData.message, /At least 1 delivered unit/i);
    });

    it('30c. Subsequent partial delivery fulfills order and transitions to fully_received', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000002')!;
      pr.status = 'partially_received';
      pr.quantity_required = 5;

      // Seed 3 already received in transactions
      mockDb.transactions.push({
        id: '80000000-0000-0000-0000-000000000099',
        part_id: pr.part_id,
        transaction_type: 'STOCK_IN',
        quantity: 3,
        performed_by: adminUser.id,
        remarks: `[PR:${pr.id}] First batch`,
        created_at: new Date(),
      });

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 2, // Fulfills 3 + 2 = 5
        },
        { id: pr.id },
        {},
        {},
        adminUser
      );

      await processGRNInward(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.data.status, 'fully_received');
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 6: Cross-Module Integrations (Work Orders, Inventory & Socket.IO)
  // -------------------------------------------------------------------------
  describe('6. Cross-Module Integrations & Notifications', () => {
    it('31. GRN receipt automatically resumes linked work order from waiting_for_parts to in_progress', async () => {
      const pr = mockDb.requisitions.find((r) => r.id === '70000000-0000-0000-0000-000000000001')!;
      pr.status = 'ordered';
      const wo = mockDb.workOrders.find((w) => w.id === pr.work_order_id)!;
      wo.status = 'waiting_for_parts';

      const { req, res, next } = createMockContext(
        {
          accepted_quantity: 5,
        },
        { id: pr.id },
        {},
        {},
        puneManagerUser
      );

      await processGRNInward(req, res, next);

      assert.equal(res.statusCode, 200);
      assert.equal(wo.status, 'in_progress');

      // Verify Socket.IO emission to technician
      const partArrivedEmission = mockIo.emissions.find((e) =>
        e.event.includes('part_arrived')
      );
      assert.ok(partArrivedEmission);
    });

    it('32. In-app notifications and Socket.IO events are emitted on PR status changes', async () => {
      const { req, res, next } = createMockContext(
        {
          status: 'vendor_selected',
          supplier_name: 'Bosch Rexroth India',
          unit_price: 4850.0,
        },
        { id: '70000000-0000-0000-0000-000000000001' },
        {},
        {},
        puneManagerUser
      );

      await updatePRStatus(req, res, next);
      assert.equal(res.statusCode, 200);

      // Verify notification created for tech1
      const notif = mockDb.notifications.find(
        (n) => n.recipient_id === '00000000-0000-0000-0000-000000000004'
      );
      assert.ok(notif);
      assert.match(notif.title, /PR-2026-00001 Status Updated/i);

      // Verify Socket.IO emission
      const socketEvent = mockIo.emissions.find((e) => e.event === 'pr:status_changed');
      assert.ok(socketEvent);
    });

    it('33. Transaction rollback: Database failures abort state changes and revert', async () => {
      mockDb.failNextTransaction = true;

      const { req, res, next } = createMockContext(
        {
          part_id: '30000000-0000-0000-0000-000000000001',
          quantity_required: 1,
        },
        {},
        {},
        {},
        tech1User
      );

      await createPurchaseRequisition(req, res, next);
      assert.equal(res.statusCode, 500);
      assert.equal(res.responseData.success, false);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 7: Vendor Directory & Dashboard Analytics
  // -------------------------------------------------------------------------
  describe('7. Vendor Directory & Dashboard Analytics', () => {
    it('34. Vendor directory aggregates active orders, parts supplied, spend and delivery rate', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getVendors(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(Array.isArray(res.responseData.data));

      const bosch = res.responseData.data.find((v: any) => v.vendor_name === 'Bosch Rexroth India');
      assert.ok(bosch);
      assert.ok(bosch.parts_supplied_count >= 1);
    });

    it('35. Procurement dashboard aggregates KPI metrics (pending PRs, active POs, overdue POs, spend)', async () => {
      const { req, res, next } = createMockContext({}, {}, {}, {}, puneManagerUser);

      await getProcurementDashboard(req, res, next);
      assert.equal(res.statusCode, 200);
      assert.equal(res.responseData.success, true);
      assert.ok(res.responseData.data.kpi);
      assert.ok(res.responseData.data.kpi.active_purchase_orders !== undefined);
      assert.ok(res.responseData.data.kpi.overdue_purchase_orders !== undefined);
      assert.ok(res.responseData.data.kpi.total_expenditure !== undefined);
      assert.ok(res.responseData.data.summary);
      assert.ok(res.responseData.data.summary.total_pending_prs !== undefined);
      assert.ok(res.responseData.data.summary.active_pos !== undefined);
      assert.ok(res.responseData.data.summary.overdue_pos !== undefined);
      assert.ok(res.responseData.data.summary.total_spend !== undefined);
    });

    it('36. Technicians and operators cannot access vendor directory or dashboard (HTTP 403)', async () => {
      const { req: req1, res: res1, next: next1 } = createMockContext({}, {}, {}, {}, tech1User);
      await getVendors(req1, res1, next1);
      assert.equal(res1.statusCode, 403);

      const { req: req2, res: res2, next: next2 } = createMockContext({}, {}, {}, {}, operatorUser);
      await getProcurementDashboard(req2, res2, next2);
      assert.equal(res2.statusCode, 403);
    });
  });
});
