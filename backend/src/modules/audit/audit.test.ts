import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuditLogsService,
  getAuditStatsService,
  getAuditEntitiesAndActionsService,
  getAuditLogByIdService,
  exportAuditLogsCsvService,
  setAuditServiceDb,
  resetAuditServiceDb,
  QueryFn,
} from './audit.service';

describe('Audit Trail Module Tests', () => {
  const mockRows = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      entity_name: 'work_orders',
      entity_id: 'wo-001',
      action: 'WORK_ORDER_COMPLETE',
      performed_by: 'u-001',
      performed_by_name: 'Rajesh Admin',
      performed_by_role: 'admin',
      performed_by_email: 'admin@jcb.com',
      old_values: { status: 'in_progress' },
      new_values: { status: 'completed' },
      ip_address: '192.168.1.100',
      created_at: '2026-11-12T10:00:00.000Z',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      entity_name: 'purchase_requisitions',
      entity_id: 'pr-001',
      action: 'PR_CREATED',
      performed_by: 'u-002',
      performed_by_name: 'Sunil Yadav',
      performed_by_role: 'technician',
      performed_by_email: 'technician@jcb.com',
      old_values: null,
      new_values: { part_id: 'part-1', quantity: 5 },
      ip_address: '192.168.1.105',
      created_at: '2026-11-12T11:00:00.000Z',
    },
  ];

  beforeEach(() => {
    resetAuditServiceDb();
  });

  it('1. Retrieves paginated audit logs with metadata', async () => {
    const mockQuery: QueryFn = async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ total: 2 }] };
      }
      return { rows: mockRows };
    };

    setAuditServiceDb(mockQuery);
    const result = await getAuditLogsService({ page: 1, limit: 10 });

    assert.equal(result.logs.length, 2);
    assert.equal(result.pagination.total, 2);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.totalPages, 1);
    assert.equal(result.logs[0].entity_name, 'work_orders');
  });

  it('2. Filters audit logs by entity domain', async () => {
    let executedSql = '';
    let executedParams: any[] = [];

    const mockQuery: QueryFn = async (sql: string, params?: any[]) => {
      executedSql = sql;
      executedParams = params || [];
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ total: 1 }] };
      }
      return { rows: [mockRows[0]] };
    };

    setAuditServiceDb(mockQuery);
    const result = await getAuditLogsService({ entity_name: 'work_orders' });

    assert.ok(executedSql.includes('a.entity_name = $1'));
    assert.equal(executedParams[0], 'work_orders');
    assert.equal(result.logs.length, 1);
  });

  it('3. Generates audit aggregate statistics', async () => {
    const mockQuery: QueryFn = async (sql: string) => {
      if (sql.includes('total_events')) {
        return {
          rows: [{
            total_events: 100,
            distinct_entities_count: 5,
            distinct_actions_count: 12,
            events_last_24h: 15,
          }],
        };
      }
      if (sql.includes('GROUP BY entity_name')) {
        return { rows: [{ entity_name: 'work_orders', count: 60 }] };
      }
      if (sql.includes('GROUP BY action')) {
        return { rows: [{ action: 'WORK_ORDER_COMPLETE', count: 40 }] };
      }
      return { rows: [] };
    };

    setAuditServiceDb(mockQuery);
    const stats = await getAuditStatsService();

    assert.equal(stats.total_events, 100);
    assert.equal(stats.distinct_entities_count, 5);
    assert.equal(stats.events_last_24h, 15);
    assert.equal(stats.entity_distribution[0].entity_name, 'work_orders');
  });

  it('4. Retrieves distinct entities and actions list', async () => {
    const mockQuery: QueryFn = async (sql: string) => {
      if (sql.includes('DISTINCT entity_name')) {
        return { rows: [{ entity_name: 'machines' }, { entity_name: 'work_orders' }] };
      }
      if (sql.includes('DISTINCT action')) {
        return { rows: [{ action: 'CREATE' }, { action: 'UPDATE' }] };
      }
      return { rows: [] };
    };

    setAuditServiceDb(mockQuery);
    const filters = await getAuditEntitiesAndActionsService();

    assert.deepEqual(filters.entities, ['machines', 'work_orders']);
    assert.deepEqual(filters.actions, ['CREATE', 'UPDATE']);
  });

  it('5. Exports audit records as RFC-compliant CSV', async () => {
    const mockQuery: QueryFn = async (sql: string) => {
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ total: 2 }] };
      }
      return { rows: mockRows };
    };

    setAuditServiceDb(mockQuery);
    const csv = await exportAuditLogsCsvService({});

    assert.ok(csv.includes('"Event ID","Timestamp","Entity Domain"'));
    assert.ok(csv.includes('"work_orders"'));
    assert.ok(csv.includes('"Rajesh Admin"'));
    assert.ok(csv.includes('"PR_CREATED"'));
  });
});
