// Safe test mock configuration
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
import { VALID_ROLES } from '../auth/auth.controller';
import { requireRoles } from '../../middlewares/rbac.middleware';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import {
  searchParts,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  adjustStock,
  getStoreDashboard,
  createStockTransfer,
  reportDamagedStock,
  updateDamagedStockDisposition,
  getInventoryValuationReport,
} from './inventory.controller';
import {
  setInventoryServiceDb,
  resetInventoryServiceDb,
  executeStockAdjustmentTransaction,
} from './inventory.service';
import {
  approvePurchaseRequisition,
  processGRNInward,
  setProcurementDb,
  resetProcurementDb,
  setProcurementIo,
  resetProcurementIo,
} from '../procurement/procurement.controller';
import { setCustomIo } from '../../config/socket';

const mockDb = require('../../config/db');

// Test UUIDs
const PLANT_1_ID = 'b0000000-0000-0000-0000-000000000001';
const PLANT_2_ID = 'b0000000-0000-0000-0000-000000000002';
const STORE_MGR_ID = 'f0000000-0000-0000-0000-000000000005';
const PART_1_ID = 'c0000000-0000-0000-0000-000000000001';
const PART_2_ID = 'c0000000-0000-0000-0000-000000000002';
const PR_1_ID = 'd0000000-0000-0000-0000-000000000001';
const DMG_1_ID = 'a0000000-0000-0000-0000-000000000001';

// Test Users
const adminUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000001',
  employee_code: 'EMP-ADM-001',
  email: 'admin@jcb.com',
  role: 'admin',
};

const storeManagerUser: AuthenticatedUser = {
  id: STORE_MGR_ID,
  employee_code: 'EMP-STM-001',
  email: 'store@jcb.com',
  role: 'store_manager',
  plant_id: PLANT_1_ID,
};

const technicianUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000003',
  employee_code: 'EMP-TECH-001',
  email: 'tech@jcb.com',
  role: 'technician',
  plant_id: PLANT_1_ID,
};

const operatorUser: AuthenticatedUser = {
  id: 'f0000000-0000-0000-0000-000000000004',
  employee_code: 'EMP-OP-001',
  email: 'operator@jcb.com',
  role: 'operator',
  plant_id: PLANT_1_ID,
};

// Mock Response Factory
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

describe('Store Manager Role & Advanced Inventory Governance (JCB CMMS)', () => {
  beforeEach(() => {
    resetInventoryServiceDb();
    resetProcurementDb();
    resetProcurementIo();
    const mockIo = {
      to: () => ({ emit: () => {} }),
      emit: () => {},
    };
    setCustomIo(mockIo);
    setProcurementIo(mockIo);
  });

  // ---------------------------------------------------------------------------
  // 1. Role & RBAC Governance
  // ---------------------------------------------------------------------------
  describe('1. Role & RBAC Governance', () => {
    it('1.1. store_manager is a recognized system role in VALID_ROLES', () => {
      assert.ok(VALID_ROLES.includes('store_manager'), 'VALID_ROLES must include store_manager');
    });

    it('1.2. requireRoles allows store_manager when permitted', () => {
      const middleware = requireRoles('admin', 'manager', 'store_manager');
      let called = false;
      const ctx = createMockContext({}, storeManagerUser);
      middleware(ctx.req, ctx.res, () => {
        called = true;
      });
      assert.strictEqual(called, true, 'Middleware must call next() for store_manager');
      assert.strictEqual(ctx.res.statusCode, 200);
    });

    it('1.3. requireRoles blocks technician and operator when store_manager is required', () => {
      const middleware = requireRoles('store_manager');
      let called = false;
      const ctx = createMockContext({}, technicianUser);
      middleware(ctx.req, ctx.res, () => {
        called = true;
      });
      assert.strictEqual(called, false);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /permission/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Spare Parts Catalog CRUD & Scoping
  // ---------------------------------------------------------------------------
  describe('2. Spare Parts Catalog CRUD & Plant Scoping', () => {
    it('2.1. Store Manager can create a spare part with plant linkage', async () => {
      let insertExecuted = false;
      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('INSERT INTO spare_parts')) {
          insertExecuted = true;
          assert.strictEqual(params![0], 'JCB-HYD-5001');
          assert.strictEqual(params![2], 'Main Hydraulic Pump');
          assert.strictEqual(params![14], PLANT_1_ID); // assignedPlantId
          return {
            rows: [
              {
                id: PART_1_ID,
                part_number: 'JCB-HYD-5001',
                name: 'Main Hydraulic Pump',
                current_physical_stock: 10,
                available_stock: 10,
                plant_id: PLANT_1_ID,
              },
            ],
            rowCount: 1,
          };
        }
        if (text.includes('INSERT INTO inventory_transactions')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext(
        {
          part_number: 'JCB-HYD-5001',
          name: 'Main Hydraulic Pump',
          bin_location: 'BIN-HYD-01',
          current_physical_stock: 10,
          min_reorder_level: 2,
          unit_cost: 45000,
        },
        storeManagerUser
      );

      await createSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 201);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(insertExecuted, true);
    });

    it('2.2. Technician or Operator cannot create spare parts (HTTP 403)', async () => {
      const ctx = createMockContext(
        {
          part_number: 'JCB-HYD-5001',
          name: 'Main Hydraulic Pump',
          bin_location: 'BIN-HYD-01',
        },
        technicianUser
      );

      await createSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Forbidden.*technician/i);
    });

    it('2.3. Store Manager cannot update spare part belonging to another plant (HTTP 403)', async () => {
      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('SELECT id, plant_id FROM spare_parts')) {
          return {
            rows: [{ id: PART_2_ID, plant_id: PLANT_2_ID }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext(
        { name: 'Updated Part Name' },
        storeManagerUser,
        { id: PART_2_ID }
      );

      await updateSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Cannot update spare parts assigned to another plant/i);
    });

    it('2.4. Store Manager can update spare part in their own plant (HTTP 200)', async () => {
      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('SELECT id, plant_id FROM spare_parts')) {
          return {
            rows: [{ id: PART_1_ID, plant_id: PLANT_1_ID }],
            rowCount: 1,
          };
        }
        if (text.includes('UPDATE spare_parts')) {
          return {
            rows: [{ id: PART_1_ID, name: 'Updated Pump', plant_id: PLANT_1_ID }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext(
        { name: 'Updated Pump', min_reorder_level: 5 },
        storeManagerUser,
        { id: PART_1_ID }
      );

      await updateSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
    });

    it('2.5. Store Manager cannot delete spare part from another plant (HTTP 403)', async () => {
      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('SELECT id, part_number, plant_id')) {
          return {
            rows: [{ id: PART_2_ID, part_number: 'P-002', plant_id: PLANT_2_ID, current_physical_stock: 0, reserved_stock: 0, quarantined_stock: 0 }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext({}, storeManagerUser, { id: PART_2_ID });
      await deleteSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /another plant/i);
    });

    it('2.6. Store Manager searchParts enforces plant isolation', async () => {
      let querySql = '';
      let queryParams: any[] = [];
      let countSql = '';
      let countParams: any[] = [];

      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('FROM spare_parts') && text.includes('SELECT id, part_number')) {
          querySql = text;
          queryParams = params || [];
          return {
            rows: [
              {
                id: PART_1_ID,
                part_number: 'JCB-HYD-5001',
                name: 'Main Hydraulic Pump',
                plant_id: PLANT_1_ID,
                status: 'active',
              },
            ],
            rowCount: 1,
          };
        }
        if (text.includes('SELECT COUNT(*) FROM spare_parts')) {
          countSql = text;
          countParams = params || [];
          return {
            rows: [{ count: '1' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext({}, storeManagerUser, {}, { page: '1', limit: '10' });
      await searchParts(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.length, 1);
      assert.ok(querySql.includes('plant_id = $') && querySql.includes('OR plant_id IS NULL'), 'Query must enforce plant isolation');
      assert.ok(countSql.includes('plant_id = $') && countSql.includes('OR plant_id IS NULL'), 'Count query must synchronize plant isolation');
      assert.strictEqual(queryParams[0], PLANT_1_ID);
      assert.strictEqual(countParams[0], PLANT_1_ID);
    });

    it('2.7. Admin searchParts can retrieve catalog across all plants without automatic plant filter', async () => {
      let querySql = '';
      mockDb.query = async (text: string, params?: any[]) => {
        if (text.includes('SELECT id, part_number')) {
          querySql = text;
          return { rows: [{ id: PART_1_ID }, { id: PART_2_ID }], rowCount: 2 };
        }
        if (text.includes('SELECT COUNT(*) FROM spare_parts')) {
          return { rows: [{ count: '2' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      };

      const ctx = createMockContext({}, adminUser, {}, {});
      await searchParts(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.length, 2);
      assert.ok(!querySql.includes('plant_id = $'), 'Admin query without plant_id filter must not be scoped');
    });

    it('2.8. Store Manager cannot create spare parts for another plant (HTTP 403 Forbidden)', async () => {
      const ctx = createMockContext(
        {
          part_number: 'JCB-ROGUE-001',
          name: 'Unauthorized Part',
          bin_location: 'BIN-01',
          plant_id: PLANT_2_ID,
        },
        storeManagerUser
      );

      await createSparePart(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.strictEqual(ctx.res.responseData.success, false);
      assert.match(ctx.res.responseData.message, /Cannot create spare parts for another plant/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Stock Adjustments & Integrity Rules
  // ---------------------------------------------------------------------------
  describe('3. Stock Adjustments & Integrity Rules', () => {
    it('3.1. Store Manager can adjust stock with mandatory reason', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  current_physical_stock: 20,
                  reserved_stock: 2,
                  quarantined_stock: 1,
                  available_stock: 17,
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE spare_parts')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  current_physical_stock: 25,
                  reserved_stock: 2,
                  quarantined_stock: 1,
                  available_stock: 22,
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('INSERT INTO inventory_transactions')) {
            return {
              rows: [
                {
                  id: 'tx-001',
                  part_id: PART_1_ID,
                  transaction_type: 'ADJUSTMENT',
                  quantity: 5,
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      mockDb.pool.connect = async () => mockClient;

      const ctx = createMockContext(
        {
          part_id: PART_1_ID,
          adjustment_quantity: 5,
          reason: 'Annual inventory audit surplus count',
        },
        storeManagerUser
      );

      await adjustStock(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.current_physical_stock, 25);
    });

    it('3.2. Stock adjustment prevents negative physical stock', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  current_physical_stock: 5,
                  reserved_stock: 1,
                  quarantined_stock: 0,
                  available_stock: 4,
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      await assert.rejects(
        async () => {
          await executeStockAdjustmentTransaction(
            mockClient as any,
            {
              part_id: PART_1_ID,
              adjustment_quantity: -10,
              reason: 'Damaged write-off',
            },
            storeManagerUser
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /cannot be negative/i);
          return true;
        }
      );
    });

    it('3.3. Stock adjustment prevents physical stock dropping below reserved + quarantined', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  current_physical_stock: 10,
                  reserved_stock: 8,
                  quarantined_stock: 0,
                  available_stock: 2,
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      await assert.rejects(
        async () => {
          await executeStockAdjustmentTransaction(
            mockClient as any,
            {
              part_id: PART_1_ID,
              adjustment_quantity: -5,
              reason: 'Audit reduction',
            },
            storeManagerUser
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /allocated stock/i);
          return true;
        }
      );
    });

    it('3.4. Operator or Technician cannot adjust stock (HTTP 403)', async () => {
      const ctx = createMockContext(
        {
          part_id: PART_1_ID,
          adjustment_quantity: 5,
          reason: 'Unauthorized adjustment attempt',
        },
        operatorUser
      );

      await adjustStock(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Forbidden.*operator/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Stock Transfers
  // ---------------------------------------------------------------------------
  describe('4. Stock Transfers (Intra-bin & Inter-plant)', () => {
    it('4.1. Store Manager can execute intra-bin stock transfer', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  available_stock: 15,
                  current_physical_stock: 20,
                  bin_location: 'BIN-OLD-01',
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('SELECT COUNT(*)::int')) {
            return { rows: [{ count: 1 }], rowCount: 1 };
          }
          if (text.includes('INSERT INTO stock_transfers')) {
            return {
              rows: [
                {
                  id: 'trf-001',
                  transfer_number: 'TRF-2026-00002',
                  part_id: PART_1_ID,
                  source_location: 'BIN-OLD-01',
                  destination_location: 'BIN-NEW-02',
                  quantity: 5,
                  status: 'completed',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('INSERT INTO inventory_transactions')) {
            return { rows: [{ id: 'tx-002' }], rowCount: 1 };
          }
          if (text.includes('UPDATE spare_parts SET bin_location')) {
            return { rows: [], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setInventoryServiceDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        {
          part_id: PART_1_ID,
          source_location: 'BIN-OLD-01',
          destination_location: 'BIN-NEW-02',
          quantity: 5,
        },
        storeManagerUser
      );

      await createStockTransfer(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 201);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.status, 'completed');
    });

    it('4.2. Stock transfer rejects quantity exceeding available stock', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  available_stock: 3,
                  current_physical_stock: 10,
                  bin_location: 'BIN-01',
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setInventoryServiceDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        {
          part_id: PART_1_ID,
          source_location: 'BIN-01',
          destination_location: 'BIN-02',
          quantity: 10,
        },
        storeManagerUser
      );

      await createStockTransfer(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 400);
      assert.match(ctx.res.responseData.message, /Insufficient available stock/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Damaged Stock Management & Quarantine Disposition
  // ---------------------------------------------------------------------------
  describe('5. Damaged Stock & Quarantine Disposition', () => {
    it('5.1. Store Manager can report damaged stock and isolate it in quarantine', async () => {
      let quarantinedUpdated = false;
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  current_physical_stock: 20,
                  reserved_stock: 2,
                  quarantined_stock: 0,
                  available_stock: 18,
                  plant_id: PLANT_1_ID,
                  status: 'active',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('SELECT COUNT(*)::int')) {
            return { rows: [{ count: 0 }], rowCount: 1 };
          }
          if (text.includes('INSERT INTO damaged_stock_items')) {
            return {
              rows: [
                {
                  id: DMG_1_ID,
                  report_number: 'DMG-2026-00001',
                  part_id: PART_1_ID,
                  quantity: 4,
                  disposition: 'quarantined',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE spare_parts') && text.includes('quarantined_stock = quarantined_stock + $1')) {
            quarantinedUpdated = true;
            assert.strictEqual(params![0], 4);
            return { rows: [], rowCount: 1 };
          }
          if (text.includes('INSERT INTO inventory_transactions')) {
            return { rows: [{ id: 'tx-003' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setInventoryServiceDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        {
          part_id: PART_1_ID,
          quantity: 4,
          damage_type: 'damaged',
          reason: 'Box damaged during forklift handling',
        },
        storeManagerUser
      );

      await reportDamagedStock(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 201);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(quarantinedUpdated, true);
    });

    it('5.2. Store Manager can update disposition to scrapped', async () => {
      let scrapExecuted = false;
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FROM damaged_stock_items')) {
            return {
              rows: [
                {
                  id: DMG_1_ID,
                  report_number: 'DMG-2026-00001',
                  part_id: PART_1_ID,
                  quantity: 4,
                  disposition: 'quarantined',
                  plant_id: PLANT_1_ID,
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('spare_parts') && text.includes('FOR UPDATE')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  current_physical_stock: 20,
                  quarantined_stock: 4,
                  plant_id: PLANT_1_ID,
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE spare_parts') && text.includes('current_physical_stock')) {
            scrapExecuted = true;
            assert.strictEqual(params![0], 4);
            return { rows: [], rowCount: 1 };
          }
          if (text.includes('UPDATE damaged_stock_items') && text.includes('disposition')) {
            return {
              rows: [
                {
                  id: DMG_1_ID,
                  report_number: 'DMG-2026-00001',
                  disposition: 'scrapped',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('INSERT INTO inventory_transactions')) {
            return { rows: [{ id: 'tx-004' }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setInventoryServiceDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        { disposition: 'scrapped', remarks: 'Approved scrap write-off' },
        storeManagerUser,
        { id: DMG_1_ID }
      );

      await updateDamagedStockDisposition(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.disposition, 'scrapped');
      assert.strictEqual(scrapExecuted, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Procurement & Goods Receipt Note (GRN) Inwarding
  // ---------------------------------------------------------------------------
  describe('6. Procurement & GRN Material Inwarding', () => {
    it('6.1. Store Manager can approve Purchase Requisition for their plant', async () => {
      let prApproved = false;
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FROM purchase_requisitions pr')) {
            return {
              rows: [
                {
                  id: PR_1_ID,
                  pr_number: 'PR-2026-00001',
                  status: 'new',
                  plant_id: PLANT_1_ID,
                  requested_by: 'f0000000-0000-0000-0000-000000000003',
                  total_estimated_cost: 15000,
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE purchase_requisitions')) {
            prApproved = true;
            return {
              rows: [
                {
                  id: PR_1_ID,
                  pr_number: 'PR-2026-00001',
                  status: 'vendor_selected',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setProcurementDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        { next_status: 'vendor_selected', remarks: 'Requisition approved by store management.' },
        storeManagerUser,
        { id: PR_1_ID }
      );

      await approvePurchaseRequisition(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(prApproved, true);
    });

    it('6.2. Store Manager cannot approve PR from another plant (HTTP 403)', async () => {
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FROM purchase_requisitions pr')) {
            return {
              rows: [
                {
                  id: PR_1_ID,
                  pr_number: 'PR-2026-00001',
                  status: 'new',
                  plant_id: PLANT_2_ID,
                  requested_by: 'f0000000-0000-0000-0000-000000000003',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setProcurementDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        { next_status: 'vendor_selected', remarks: 'Approved' },
        storeManagerUser,
        { id: PR_1_ID }
      );

      await approvePurchaseRequisition(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Forbidden.*another plant/i);
    });

    it('6.3. Store Manager can process GRN inwarding and increase physical stock', async () => {
      let stockIncremented = false;
      const mockClient = {
        query: async (text: string, params?: any[]) => {
          if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [], rowCount: 0 };
          if (text.includes('FROM purchase_requisitions pr') && text.includes('JOIN spare_parts sp')) {
            return {
              rows: [
                {
                  id: PR_1_ID,
                  pr_number: 'PR-2026-00001',
                  status: 'ordered',
                  plant_id: PLANT_1_ID,
                  part_id: PART_1_ID,
                  part_number: 'JCB-HYD-5001',
                  part_name: 'Main Hydraulic Pump',
                  quantity_required: 10,
                  warehouse_zone: 'Main Store',
                  bin_location: 'BIN-HYD-01',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('SELECT COALESCE(SUM(quantity), 0) as total_prev_inwarded')) {
            return { rows: [{ total_prev_inwarded: 0 }], rowCount: 1 };
          }
          if (text.includes('SELECT id, current_physical_stock, available_stock')) {
            return {
              rows: [
                {
                  id: PART_1_ID,
                  current_physical_stock: 5,
                  available_stock: 5,
                  warehouse_zone: 'Main Store',
                  bin_location: 'BIN-HYD-01',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE spare_parts') && text.includes('current_physical_stock = current_physical_stock + $1')) {
            stockIncremented = true;
            assert.strictEqual(params![0], 10);
            assert.strictEqual(params![1], PART_1_ID);
            return { rows: [], rowCount: 1 };
          }
          if (text.includes('INSERT INTO inventory_transactions')) {
            return { rows: [{ id: 'tx-005' }], rowCount: 1 };
          }
          if (text.includes('INSERT INTO goods_receipt_notes') || text.includes('INSERT INTO grn_receipts')) {
            return {
              rows: [
                {
                  id: 'grn-001',
                  grn_number: 'GRN-2026-00001',
                  purchase_requisition_id: PR_1_ID,
                  received_by: STORE_MGR_ID,
                  accepted_quantity: 10,
                  rejected_quantity: 0,
                  status: 'verified',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('UPDATE purchase_requisitions')) {
            return {
              rows: [
                {
                  id: PR_1_ID,
                  pr_number: 'PR-2026-00001',
                  status: 'fully_received',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('SELECT pg_advisory_xact_lock')) {
            return { rows: [], rowCount: 0 };
          }
          if (text.includes('SELECT MAX(SPLIT_PART(grn_number')) {
            return { rows: [{ max_seq: 0 }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => {},
      };

      setProcurementDb({ connect: async () => mockClient });

      const ctx = createMockContext(
        {
          accepted_quantity: 10,
          rejected_quantity: 0,
          delivery_note_number: 'DN-9988',
          remarks: 'Received in full without damage',
        },
        storeManagerUser,
        { id: PR_1_ID }
      );

      await processGRNInward(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(stockIncremented, true);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Store Dashboard & Valuation Reports
  // ---------------------------------------------------------------------------
  describe('7. Store Dashboard & Inventory Reports', () => {
    it('7.1. Store Manager can access store dashboard KPIs', async () => {
      const mockDbInstance = {
        query: async (text: string, params?: any[]) => {
          if (text.includes('COUNT(*)::int AS total_parts')) {
            return {
              rows: [
                {
                  total_parts: 150,
                  total_physical_stock: 2500,
                  total_reserved_stock: 45,
                  total_quarantined_stock: 12,
                  total_available_stock: 2443,
                  low_stock_items_count: 8,
                  out_of_stock_count: 2,
                  total_inventory_valuation: '4500000.00',
                },
              ],
              rowCount: 1,
            };
          }
          if (text.includes('FROM spare_parts sp') && text.includes('GROUP BY sp.category')) {
            return {
              rows: [{ category: 'Mechanical', part_count: 80, valuation: '2500000.00' }],
              rowCount: 1,
            };
          }
          if (text.includes('FROM stock_transfers')) {
            return { rows: [{ pending_transfers: 3 }], rowCount: 1 };
          }
          if (text.includes('FROM damaged_stock_items')) {
            return { rows: [{ quarantined_damaged_count: 5 }], rowCount: 1 };
          }
          if (text.includes('FROM purchase_requisitions')) {
            return { rows: [{ pending_prs: 4 }], rowCount: 1 };
          }
          if (text.includes('FROM goods_receipt_notes')) {
            return { rows: [{ recent_grns_30d: 14 }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      setInventoryServiceDb(mockDbInstance);

      const ctx = createMockContext({}, storeManagerUser);
      await getStoreDashboard(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.summary.total_parts, 150);
      assert.strictEqual(ctx.res.responseData.data.summary.total_available_stock, 2443);
      assert.strictEqual(ctx.res.responseData.data.summary.low_stock_items_count, 8);
    });

    it('7.2. Operator cannot access store dashboard (HTTP 403)', async () => {
      const ctx = createMockContext({}, operatorUser);
      await getStoreDashboard(ctx.req, ctx.res, ctx.next);
      assert.strictEqual(ctx.res.statusCode, 403);
      assert.match(ctx.res.responseData.message, /Forbidden.*operator/i);
    });

    it('7.3. Store Manager can access inventory valuation report', async () => {
      const mockDbInstance = {
        query: async (text: string, params?: any[]) => {
          if (text.includes('GROUP BY sp.category')) {
            return {
              rows: [{ category: 'Hydraulic', sku_count: 80, category_valuation: '2000000.00' }],
              rowCount: 1,
            };
          }
          if (text.includes('GROUP BY sp.warehouse_zone')) {
            return {
              rows: [{ warehouse_zone: 'Main Store', sku_count: 150, zone_valuation: '4500000.00' }],
              rowCount: 1,
            };
          }
          if (text.includes('COUNT(*)::int AS total_skus')) {
            return {
              rows: [
                {
                  total_skus: 150,
                  total_physical_stock: 2500,
                  total_valuation: '4500000.00',
                },
              ],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      setInventoryServiceDb(mockDbInstance);

      const ctx = createMockContext({}, storeManagerUser);
      await getInventoryValuationReport(ctx.req, ctx.res, ctx.next);

      assert.strictEqual(ctx.res.statusCode, 200);
      assert.strictEqual(ctx.res.responseData.success, true);
      assert.strictEqual(ctx.res.responseData.data.total.total_skus, 150);
      assert.strictEqual(ctx.res.responseData.data.total.total_valuation, '4500000.00');
    });
  });
});
