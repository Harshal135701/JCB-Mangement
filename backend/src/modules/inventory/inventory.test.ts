// Set safe mock test environment variables prior to module imports to prevent live database connections
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
import {
  reservePartForWorkOrderService,
  executeReservationTransaction,
  validateWorkOrderAuthorization,
  InventoryError,
  WorkOrderRecord,
  SparePartRecord,
  DatabaseQueryable,
  DatabasePoolLike,
} from './inventory.service';
import { reservePartForWorkOrder } from './inventory.controller';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

/**
 * Mock Request and Response generator for Express Controller testing
 */
interface MockResponse {
  statusCode: number;
  responseData: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
}

function createMockContext(
  body: any,
  user?: AuthenticatedUser
): {
  req: Request;
  res: Response & MockResponse;
  next: NextFunction;
} {
  const req = {
    body,
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
    if (err) throw err;
  }) as NextFunction;

  return { req, res, next };
}

/**
 * In-memory Mock Database Client for Unit & Concurrency Testing
 */
class MockDatabaseClient implements DatabaseQueryable {
  public queries: { text: string; values?: any[] }[] = [];
  public state: {
    workOrders: Map<string, WorkOrderRecord>;
    spareParts: Map<string, SparePartRecord>;
    consumed: Map<string, any>;
    transactions: any[];
  };
  public shouldFailOnQuery?: (text: string) => boolean;

  constructor(initialState?: {
    workOrders?: WorkOrderRecord[];
    spareParts?: SparePartRecord[];
    consumed?: any[];
  }) {
    this.state = {
      workOrders: new Map(
        (initialState?.workOrders || []).map((wo) => [wo.id, { ...wo }])
      ),
      spareParts: new Map(
        (initialState?.spareParts || []).map((p) => [p.id, { ...p }])
      ),
      consumed: new Map(
        (initialState?.consumed || []).map((c) => [
          `${c.work_order_id}_${c.part_id}`,
          { ...c },
        ])
      ),
      transactions: [],
    };
  }

  async query<R = any>(text: string, values?: any[]): Promise<{ rows: R[]; rowCount: number }> {
    this.queries.push({ text: text.trim(), values });

    if (this.shouldFailOnQuery && this.shouldFailOnQuery(text)) {
      throw new Error(`Database error simulated for query: ${text.slice(0, 30)}...`);
    }

    const trimmed = text.trim();

    // 1. Lock & fetch work order
    if (trimmed.includes('FROM work_orders wo')) {
      const woId = values?.[0];
      const wo = this.state.workOrders.get(woId);
      return {
        rows: wo ? ([wo] as unknown as R[]) : [],
        rowCount: wo ? 1 : 0,
      };
    }

    // 2. Lock & fetch spare part
    if (trimmed.includes('FROM spare_parts') && trimmed.includes('FOR UPDATE')) {
      const partId = values?.[0];
      const part = this.state.spareParts.get(partId);
      return {
        rows: part ? ([part] as unknown as R[]) : [],
        rowCount: part ? 1 : 0,
      };
    }

    // 3. Update spare_parts reserved stock
    if (trimmed.startsWith('UPDATE spare_parts')) {
      const qty = values?.[0];
      const partId = values?.[1];
      const part = this.state.spareParts.get(partId);
      if (!part) return { rows: [], rowCount: 0 };

      part.reserved_stock = Number(part.reserved_stock) + Number(qty);
      // PostgreSQL generated column emulation:
      part.available_stock =
        Number(part.current_physical_stock) -
        Number(part.reserved_stock) -
        Number(part.quarantined_stock);

      return {
        rows: [{ ...part }] as unknown as R[],
        rowCount: 1,
      };
    }

    // 4. Select wo_parts_consumed
    if (trimmed.includes('FROM wo_parts_consumed') && trimmed.includes('FOR UPDATE')) {
      const woId = values?.[0];
      const partId = values?.[1];
      const key = `${woId}_${partId}`;
      const record = this.state.consumed.get(key);
      return {
        rows: record ? ([record] as unknown as R[]) : [],
        rowCount: record ? 1 : 0,
      };
    }

    // 5. Update wo_parts_consumed
    if (trimmed.startsWith('UPDATE wo_parts_consumed')) {
      const qty = values?.[0];
      const id = values?.[1];
      for (const record of this.state.consumed.values()) {
        if (record.id === id) {
          record.quantity_requested = Number(record.quantity_requested) + Number(qty);
          return {
            rows: [{ ...record }] as unknown as R[],
            rowCount: 1,
          };
        }
      }
      return { rows: [], rowCount: 0 };
    }

    // 6. Insert wo_parts_consumed
    if (trimmed.startsWith('INSERT INTO wo_parts_consumed')) {
      const woId = values?.[0];
      const partId = values?.[1];
      const qty = values?.[2];
      const newRecord = {
        id: `consumed-${Date.now()}-${Math.random()}`,
        work_order_id: woId,
        part_id: partId,
        quantity_requested: qty,
        quantity_issued: 0,
        quantity_installed: 0,
        created_at: new Date().toISOString(),
      };
      this.state.consumed.set(`${woId}_${partId}`, newRecord);
      return {
        rows: [newRecord] as unknown as R[],
        rowCount: 1,
      };
    }

    // 7. Insert inventory_transactions
    if (trimmed.startsWith('INSERT INTO inventory_transactions')) {
      const newTx = {
        id: `tx-${Date.now()}-${Math.random()}`,
        part_id: values?.[0],
        transaction_type: 'RESERVATION',
        quantity: values?.[1],
        source_location: values?.[2],
        destination_location: values?.[3],
        reference_work_order_id: values?.[4],
        performed_by: values?.[5],
        remarks: values?.[6],
        created_at: new Date().toISOString(),
      };
      this.state.transactions.push(newTx);
      return {
        rows: [newTx] as unknown as R[],
        rowCount: 1,
      };
    }

    // Default empty
    return { rows: [], rowCount: 0 };
  }
}

/**
 * Mock Pool wrapping Mock Database Client for Service-level Testing
 */
class MockDatabasePool implements DatabasePoolLike {
  public client: MockDatabaseClient;
  public beginCount = 0;
  public commitCount = 0;
  public rollbackCount = 0;
  public released = false;

  constructor(client: MockDatabaseClient) {
    this.client = client;
  }

  async connect(): Promise<any> {
    this.released = false;
    const client = this.client;
    const pool = this;

    return {
      query: async (text: string, values?: any[]) => {
        const trimmed = text.trim();
        if (trimmed === 'BEGIN') {
          pool.beginCount++;
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'COMMIT') {
          pool.commitCount++;
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'ROLLBACK') {
          pool.rollbackCount++;
          return { rows: [], rowCount: 0 };
        }
        return client.query(text, values);
      },
      release: () => {
        pool.released = true;
      },
    };
  }
}

// Baseline Fixture IDs
const PLANT_BALLABGARH = '11111111-1111-1111-1111-111111111111';
const PLANT_PUNE = '22222222-2222-2222-2222-222222222222';
const SHOP_CNC = '33333333-3333-3333-3333-333333333333';
const SHOP_WELDING = '44444444-4444-4444-4444-444444444444';

const TECH_USER_ID = '90000000-0000-0000-0000-000000000001';
const OTHER_TECH_USER_ID = '90000000-0000-0000-0000-000000000002';
const MANAGER_USER_ID = '80000000-0000-0000-0000-000000000001';
const ADMIN_USER_ID = '70000000-0000-0000-0000-000000000001';

const VALID_WO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VALID_PART_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function createSampleWorkOrder(overrides?: Partial<WorkOrderRecord>): WorkOrderRecord {
  return {
    id: VALID_WO_ID,
    wo_number: 'WO-2026-00042',
    status: 'in_progress',
    machine_id: '55555555-5555-5555-5555-555555555555',
    assigned_technician_id: TECH_USER_ID,
    assigned_manager_id: MANAGER_USER_ID,
    shop_id: SHOP_CNC,
    plant_id: PLANT_BALLABGARH,
    shop_name: 'CNC Machining Shop',
    bay_line_location: 'Bay 1 / Line 4',
    ...overrides,
  };
}

function createSampleSparePart(overrides?: Partial<SparePartRecord>): SparePartRecord {
  return {
    id: VALID_PART_ID,
    part_number: 'HYD-10025',
    name: 'Hydraulic Pump Filter Element',
    warehouse_zone: 'Main Store',
    bin_location: 'A-01-05',
    current_physical_stock: 10,
    reserved_stock: 2,
    quarantined_stock: 0,
    available_stock: 8,
    status: 'active',
    ...overrides,
  };
}

describe('Inventory Reservation Workflow (CMMS Module 1)', () => {
  let mockClient: MockDatabaseClient;
  let mockPool: MockDatabasePool;

  beforeEach(() => {
    mockClient = new MockDatabaseClient({
      workOrders: [createSampleWorkOrder()],
      spareParts: [createSampleSparePart()],
    });
    mockPool = new MockDatabasePool(mockClient);
  });

  // -------------------------------------------------------------------------
  // 1. Successful Reservation
  // -------------------------------------------------------------------------
  it('1. Successful reservation updates reserved stock, creates consumption and records immutable transaction', async () => {
    const technicianUser: AuthenticatedUser = {
      id: TECH_USER_ID,
      employee_code: 'EMP-TCH-001',
      email: 'tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_CNC,
    };

    const result = await reservePartForWorkOrderService(
      {
        work_order_id: VALID_WO_ID,
        part_id: VALID_PART_ID,
        quantity: 3,
      },
      technicianUser,
      mockPool
    );

    // Verify stock math
    assert.strictEqual(result.spare_part.part_number, 'HYD-10025');
    assert.strictEqual(result.spare_part.reserved_stock, 5); // was 2, now 5
    assert.strictEqual(result.spare_part.available_stock, 5); // 10 - 5 = 5

    // Verify wo_parts_consumed persistence
    assert.strictEqual(result.consumption.work_order_id, VALID_WO_ID);
    assert.strictEqual(result.consumption.part_id, VALID_PART_ID);
    assert.strictEqual(result.consumption.quantity_requested, 3);
    assert.strictEqual(result.consumption.quantity_issued, 0);
    assert.strictEqual(result.consumption.quantity_installed, 0);

    // Verify transaction history record
    assert.strictEqual(result.transaction.transaction_type, 'RESERVATION');
    assert.strictEqual(result.transaction.quantity, 3);
    assert.strictEqual(result.transaction.reference_work_order_id, VALID_WO_ID);
    assert.strictEqual(result.transaction.performed_by, TECH_USER_ID);

    // Verify database transaction lifecycle
    assert.strictEqual(mockPool.beginCount, 1);
    assert.strictEqual(mockPool.commitCount, 1);
    assert.strictEqual(mockPool.rollbackCount, 0);
    assert.strictEqual(mockPool.released, true);
  });

  // -------------------------------------------------------------------------
  // 2. Invalid and Missing Input
  // -------------------------------------------------------------------------
  it('2. Invalid and missing input returns HTTP 400 Bad Request', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    // Missing work_order_id
    const ctx1 = createMockContext({ part_id: VALID_PART_ID, quantity: 2 }, adminUser);
    await reservePartForWorkOrder(ctx1.req, ctx1.res, ctx1.next);
    assert.strictEqual(ctx1.res.statusCode, 400);
    assert.strictEqual(ctx1.res.responseData.success, false);
    assert.match(ctx1.res.responseData.message, /work_order_id/i);

    // Malformed work_order_id (not a valid UUID)
    const ctx2 = createMockContext(
      { work_order_id: 'not-a-uuid', part_id: VALID_PART_ID, quantity: 2 },
      adminUser
    );
    await reservePartForWorkOrder(ctx2.req, ctx2.res, ctx2.next);
    assert.strictEqual(ctx2.res.statusCode, 400);
    assert.strictEqual(ctx2.res.responseData.success, false);
    assert.match(ctx2.res.responseData.message, /work_order_id/i);

    // Missing part_id
    const ctx3 = createMockContext({ work_order_id: VALID_WO_ID, quantity: 2 }, adminUser);
    await reservePartForWorkOrder(ctx3.req, ctx3.res, ctx3.next);
    assert.strictEqual(ctx3.res.statusCode, 400);
    assert.strictEqual(ctx3.res.responseData.success, false);
    assert.match(ctx3.res.responseData.message, /part_id/i);

    // Malformed part_id
    const ctx4 = createMockContext(
      { work_order_id: VALID_WO_ID, part_id: 'bad-uuid', quantity: 2 },
      adminUser
    );
    await reservePartForWorkOrder(ctx4.req, ctx4.res, ctx4.next);
    assert.strictEqual(ctx4.res.statusCode, 400);
    assert.strictEqual(ctx4.res.responseData.success, false);
    assert.match(ctx4.res.responseData.message, /part_id/i);
  });

  // -------------------------------------------------------------------------
  // 3. Non-Positive and Decimal Quantities
  // -------------------------------------------------------------------------
  it('3. Non-positive and decimal quantities are strictly rejected with HTTP 400', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    const invalidQuantities = [0, -1, -100, 1.5, 0.99, '1.5', '-5', '0', 'abc', null, undefined];

    for (const badQty of invalidQuantities) {
      const ctx = createMockContext(
        { work_order_id: VALID_WO_ID, part_id: VALID_PART_ID, quantity: badQty },
        adminUser
      );
      await reservePartForWorkOrder(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(
        ctx.res.statusCode,
        400,
        `Expected HTTP 400 for invalid quantity: ${badQty}`
      );
      assert.strictEqual(ctx.res.responseData.success, false);
      assert.match(ctx.res.responseData.message, /quantity/i);
    }
  });

  // -------------------------------------------------------------------------
  // 4. Nonexistent Work Order
  // -------------------------------------------------------------------------
  it('4. Nonexistent work order returns HTTP 404 Not Found', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    const nonexistentWoId = '99999999-9999-9999-9999-999999999999';

    await assert.rejects(
      async () => {
        await reservePartForWorkOrderService(
          {
            work_order_id: nonexistentWoId,
            part_id: VALID_PART_ID,
            quantity: 1,
          },
          adminUser,
          mockPool
        );
      },
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 404);
        assert.match(err.message, /Work order not found/i);
        return true;
      }
    );

    assert.strictEqual(mockPool.rollbackCount, 1);
    assert.strictEqual(mockPool.released, true);
  });

  // -------------------------------------------------------------------------
  // 5. Ineligible Work-Order Status
  // -------------------------------------------------------------------------
  it('5. Ineligible work-order statuses (completed, verified_closed, submitted_verification, on_hold) are rejected with HTTP 400', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    const ineligibleStatuses = [
      'verified_closed',
      'completed',
      'submitted_verification',
      'on_hold',
    ];

    for (const status of ineligibleStatuses) {
      mockClient.state.workOrders.set(
        VALID_WO_ID,
        createSampleWorkOrder({ status })
      );

      await assert.rejects(
        async () => {
          await reservePartForWorkOrderService(
            {
              work_order_id: VALID_WO_ID,
              part_id: VALID_PART_ID,
              quantity: 1,
            },
            adminUser,
            mockPool
          );
        },
        (err: any) => {
          assert(err instanceof InventoryError);
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /active work orders/i);
          return true;
        }
      );
    }
  });

  // -------------------------------------------------------------------------
  // 6. Nonexistent Spare Part
  // -------------------------------------------------------------------------
  it('6. Nonexistent spare part returns HTTP 404 Not Found', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    const missingPartId = '88888888-8888-8888-8888-888888888888';

    await assert.rejects(
      async () => {
        await reservePartForWorkOrderService(
          {
            work_order_id: VALID_WO_ID,
            part_id: missingPartId,
            quantity: 1,
          },
          adminUser,
          mockPool
        );
      },
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 404);
        assert.match(err.message, /Spare part not found/i);
        return true;
      }
    );

    assert.strictEqual(mockPool.rollbackCount, 1);
    assert.strictEqual(mockPool.released, true);
  });

  // -------------------------------------------------------------------------
  // 7. Insufficient Available Stock
  // -------------------------------------------------------------------------
  it('7. Insufficient available stock returns HTTP 400 with Stock Out details and does not alter stock', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    // Available stock is 8 (physical: 10, reserved: 2)
    await assert.rejects(
      async () => {
        await reservePartForWorkOrderService(
          {
            work_order_id: VALID_WO_ID,
            part_id: VALID_PART_ID,
            quantity: 9, // exceeds 8
          },
          adminUser,
          mockPool
        );
      },
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.availableStock, 8);
        assert.match(err.message, /Stock Out: Only 8 units available/i);
        return true;
      }
    );

    // Verify stock was not mutated
    const part = mockClient.state.spareParts.get(VALID_PART_ID);
    assert.strictEqual(part?.reserved_stock, 2);
    assert.strictEqual(part?.available_stock, 8);
    assert.strictEqual(mockPool.rollbackCount, 1);
  });

  // -------------------------------------------------------------------------
  // 8. Correct Stock Deduction and Reservation
  // -------------------------------------------------------------------------
  it('8. Correct stock reservation updates reserved_stock and respects generated available_stock', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    const result = await reservePartForWorkOrderService(
      {
        work_order_id: VALID_WO_ID,
        part_id: VALID_PART_ID,
        quantity: 4,
      },
      adminUser,
      mockPool
    );

    assert.strictEqual(result.spare_part.reserved_stock, 6);
    assert.strictEqual(result.spare_part.available_stock, 4);

    // Verify no query directly updated available_stock
    const hasDirectAvailableStockUpdate = mockClient.queries.some((q) =>
      q.text.toLowerCase().includes('set available_stock')
    );
    assert.strictEqual(
      hasDirectAvailableStockUpdate,
      false,
      'available_stock must NEVER be updated directly because it is a GENERATED ALWAYS STORED column'
    );
  });

  // -------------------------------------------------------------------------
  // 9. Correct wo_parts_consumed Persistence (Single Row Upsert / Accumulation)
  // -------------------------------------------------------------------------
  it('9. wo_parts_consumed accumulates quantities without duplicate rows for same work order and part', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    // First reservation: 2 units
    const res1 = await reservePartForWorkOrderService(
      {
        work_order_id: VALID_WO_ID,
        part_id: VALID_PART_ID,
        quantity: 2,
      },
      adminUser,
      mockPool
    );
    assert.strictEqual(res1.consumption.quantity_requested, 2);

    // Second reservation for same work order and part: 3 more units
    const res2 = await reservePartForWorkOrderService(
      {
        work_order_id: VALID_WO_ID,
        part_id: VALID_PART_ID,
        quantity: 3,
      },
      adminUser,
      mockPool
    );

    // Verify accumulation
    assert.strictEqual(res2.consumption.quantity_requested, 5);
    assert.strictEqual(res2.consumption.id, res1.consumption.id); // Same row updated!
    assert.strictEqual(mockClient.state.consumed.size, 1, 'No duplicate consumption rows allowed');

    // Verify no nonexistent is_installed column in SQL queries
    const hasIsInstalledRef = mockClient.queries.some((q) =>
      q.text.toLowerCase().includes('is_installed')
    );
    assert.strictEqual(
      hasIsInstalledRef,
      false,
      'wo_parts_consumed queries must not reference non-existent is_installed column'
    );
  });

  // -------------------------------------------------------------------------
  // 10. Correct Inventory Transaction History
  // -------------------------------------------------------------------------
  it('10. Correct inventory transaction history record is inserted with proper metadata', async () => {
    const technicianUser: AuthenticatedUser = {
      id: TECH_USER_ID,
      employee_code: 'EMP-TCH-001',
      email: 'tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_CNC,
    };

    const result = await reservePartForWorkOrderService(
      {
        work_order_id: VALID_WO_ID,
        part_id: VALID_PART_ID,
        quantity: 2,
      },
      technicianUser,
      mockPool
    );

    const tx = result.transaction;
    assert.strictEqual(tx.transaction_type, 'RESERVATION');
    assert.strictEqual(tx.part_id, VALID_PART_ID);
    assert.strictEqual(tx.quantity, 2);
    assert.strictEqual(tx.reference_work_order_id, VALID_WO_ID);
    assert.strictEqual(tx.performed_by, TECH_USER_ID);
    assert.match(tx.source_location || '', /Main Store/);
    assert.match(tx.destination_location || '', /WO-2026-00042/);
    assert.match(tx.remarks || '', /Reserved 2 unit\(s\)/);
  });

  // -------------------------------------------------------------------------
  // 11. Transaction Rollback on Database Failure
  // -------------------------------------------------------------------------
  it('11. Transaction rolls back cleanly and releases connection when a database write fails', async () => {
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    // Simulate failure during inventory_transactions insertion
    mockClient.shouldFailOnQuery = (queryText: string) => {
      return queryText.includes('INSERT INTO inventory_transactions');
    };

    await assert.rejects(
      async () => {
        await reservePartForWorkOrderService(
          {
            work_order_id: VALID_WO_ID,
            part_id: VALID_PART_ID,
            quantity: 2,
          },
          adminUser,
          mockPool
        );
      },
      (err: any) => {
        assert.match(err.message, /Database error simulated/i);
        return true;
      }
    );

    // Verify rollback was executed and client released
    assert.strictEqual(mockPool.beginCount, 1);
    assert.strictEqual(mockPool.commitCount, 0);
    assert.strictEqual(mockPool.rollbackCount, 1);
    assert.strictEqual(mockPool.released, true);

    // Verify no orphan transaction was persisted
    assert.strictEqual(mockClient.state.transactions.length, 0);
  });

  // -------------------------------------------------------------------------
  // 12. Concurrency Simulation Test (Row-level Lock Serialization)
  // -------------------------------------------------------------------------
  it('12. [Unit Concurrency Simulation] Concurrency serialization prevents overselling stock under race conditions', async () => {
    // Note: This unit test verifies the concurrency serialization algorithm
    // where SELECT ... FOR UPDATE serializes access to the spare_parts row.
    // Initial available stock: 3 units
    const sharedPart = createSampleSparePart({
      current_physical_stock: 5,
      reserved_stock: 2,
      available_stock: 3, // only 3 units available
    });

    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };

    mockClient.state.spareParts.set(VALID_PART_ID, sharedPart);

    // Request 1 asks for 2 units
    const firstCallPromise = executeReservationTransaction(
      mockClient,
      { work_order_id: VALID_WO_ID, part_id: VALID_PART_ID, quantity: 2 },
      adminUser
    );

    const firstResult = await firstCallPromise;
    assert.strictEqual(firstResult.spare_part.reserved_stock, 4);
    assert.strictEqual(firstResult.spare_part.available_stock, 1);

    // Request 2 also asks for 2 units (concurrent attempt after lock acquired)
    // Now only 1 unit is available, so Request 2 must fail with Stock Out
    await assert.rejects(
      async () => {
        await executeReservationTransaction(
          mockClient,
          { work_order_id: VALID_WO_ID, part_id: VALID_PART_ID, quantity: 2 },
          adminUser
        );
      },
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 400);
        assert.strictEqual(err.availableStock, 1);
        assert.match(err.message, /Stock Out: Only 1 units available/i);
        return true;
      }
    );

    // Verify that the row was locked with 'FOR UPDATE' in both queries
    const selectForUpdateQueries = mockClient.queries.filter(
      (q) => q.text.includes('FROM spare_parts') && q.text.includes('FOR UPDATE')
    );
    assert.strictEqual(selectForUpdateQueries.length, 2);
  });

  // -------------------------------------------------------------------------
  // 13. Unauthorized Cross-Plant/Shop Reservation
  // -------------------------------------------------------------------------
  it('13. Unauthorized cross-plant and cross-shop reservations are blocked with HTTP 403 Forbidden', () => {
    const baseWo = createSampleWorkOrder({
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_CNC,
      assigned_technician_id: TECH_USER_ID,
      assigned_manager_id: MANAGER_USER_ID,
    });

    // 13.1 Cross-plant Manager
    const crossPlantManager: AuthenticatedUser = {
      id: 'manager-pune',
      employee_code: 'EMP-MGR-002',
      email: 'pune.mgr@jcb.com',
      role: 'manager',
      plant_id: PLANT_PUNE, // different plant!
      shop_id: SHOP_CNC,
    };
    assert.throws(
      () => validateWorkOrderAuthorization(baseWo, crossPlantManager),
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /different plant/i);
        return true;
      }
    );

    // 13.2 Cross-shop Manager (not assigned to WO)
    const crossShopManager: AuthenticatedUser = {
      id: 'manager-welding',
      employee_code: 'EMP-MGR-003',
      email: 'welding.mgr@jcb.com',
      role: 'manager',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_WELDING, // different shop!
    };
    assert.throws(
      () => validateWorkOrderAuthorization(baseWo, crossShopManager),
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /different shop/i);
        return true;
      }
    );

    // 13.3 Technician assigned to a different plant
    const crossPlantTech: AuthenticatedUser = {
      id: TECH_USER_ID,
      employee_code: 'EMP-TCH-001',
      email: 'tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_PUNE, // different plant!
      shop_id: SHOP_CNC,
    };
    assert.throws(
      () => validateWorkOrderAuthorization(baseWo, crossPlantTech),
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /different plant/i);
        return true;
      }
    );

    // 13.4 Technician from different shop
    const crossShopTech: AuthenticatedUser = {
      id: TECH_USER_ID,
      employee_code: 'EMP-TCH-001',
      email: 'tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_WELDING, // different shop!
    };
    assert.throws(
      () => validateWorkOrderAuthorization(baseWo, crossShopTech),
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /different shop/i);
        return true;
      }
    );

    // 13.5 Technician who is NOT assigned to this work order
    const unassignedTech: AuthenticatedUser = {
      id: OTHER_TECH_USER_ID, // not assigned!
      employee_code: 'EMP-TCH-002',
      email: 'anil.tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_CNC,
    };
    assert.throws(
      () => validateWorkOrderAuthorization(baseWo, unassignedTech),
      (err: any) => {
        assert(err instanceof InventoryError);
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /Technician is not assigned to this work order/i);
        return true;
      }
    );

    // 13.6 Admin has global access across plants & shops
    const adminUser: AuthenticatedUser = {
      id: ADMIN_USER_ID,
      employee_code: 'EMP-ADM-001',
      email: 'admin@jcb.com',
      role: 'admin',
    };
    assert.doesNotThrow(() => validateWorkOrderAuthorization(baseWo, adminUser));
  });

  // -------------------------------------------------------------------------
  // 14. Database Errors Never Return Fake Success
  // -------------------------------------------------------------------------
  it('14. Database failures return HTTP 500 and NEVER return Demo Mode fake success', async () => {
    const technicianUser: AuthenticatedUser = {
      id: TECH_USER_ID,
      employee_code: 'EMP-TCH-001',
      email: 'tech@jcb.com',
      role: 'technician',
      plant_id: PLANT_BALLABGARH,
      shop_id: SHOP_CNC,
    };

    // Simulate unexpected database crash during query execution
    const mockDb = require('../../config/db');
    const originalConnect = mockDb.pool.connect;

    try {
      mockDb.pool.connect = async () => {
        throw new Error('Connection terminated unexpectedly: 08006');
      };

      const ctx = createMockContext(
        {
          work_order_id: VALID_WO_ID,
          part_id: VALID_PART_ID,
          quantity: 1,
        },
        technicianUser
      );

      await reservePartForWorkOrder(ctx.req, ctx.res, ctx.next);

      // Must be HTTP 500, never 200 Demo Mode!
      assert.strictEqual(ctx.res.statusCode, 500);
      assert.strictEqual(ctx.res.responseData.success, false);
      assert.strictEqual(ctx.res.responseData.message, 'Internal Enterprise Server Error');
      assert.doesNotMatch(
        JSON.stringify(ctx.res.responseData),
        /Demo Mode/i,
        'Demo Mode fake success responses must be completely eliminated'
      );
    } finally {
      mockDb.pool.connect = originalConnect;
    }
  });
});
