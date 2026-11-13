import { pool, query as defaultQuery } from '../../config/db';

export interface AuditFilterParams {
  entity_name?: string;
  action?: string;
  performed_by?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sort_order?: 'ASC' | 'DESC';
}

export interface AuditLogItem {
  id: string;
  entity_name: string;
  entity_id: string | null;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  performed_by_email: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  created_at: string;
}

export interface AuditStats {
  total_events: number;
  distinct_entities_count: number;
  distinct_actions_count: number;
  events_last_24h: number;
  entity_distribution: Array<{ entity_name: string; count: number }>;
  top_actions: Array<{ action: string; count: number }>;
}

export type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;

let activeQuery: QueryFn = defaultQuery as unknown as QueryFn;

export function setAuditServiceDb(customQuery: QueryFn): void {
  activeQuery = customQuery;
}

export function resetAuditServiceDb(): void {
  activeQuery = defaultQuery as unknown as QueryFn;
}

function buildAuditWhere(filters: AuditFilterParams): { whereSql: string; params: any[] } {
  const clauses: string[] = ['1=1'];
  const params: any[] = [];

  if (filters.entity_name && filters.entity_name !== 'ALL') {
    params.push(filters.entity_name.trim());
    clauses.push(`a.entity_name = $${params.length}`);
  }

  if (filters.action && filters.action !== 'ALL') {
    params.push(filters.action.trim());
    clauses.push(`a.action = $${params.length}`);
  }

  if (filters.performed_by) {
    params.push(filters.performed_by.trim());
    clauses.push(`(a.performed_by = $${params.length}::uuid OR u.employee_code ILIKE $${params.length})`);
  }

  if (filters.start_date) {
    params.push(filters.start_date.trim());
    clauses.push(`a.created_at >= $${params.length}::timestamptz`);
  }

  if (filters.end_date) {
    params.push(filters.end_date.trim() + ' 23:59:59.999Z');
    clauses.push(`a.created_at <= $${params.length}::timestamptz`);
  }

  if (filters.search) {
    params.push(`%${filters.search.trim()}%`);
    const pIdx = params.length;
    clauses.push(`(
      a.entity_name ILIKE $${pIdx} OR
      a.action ILIKE $${pIdx} OR
      u.full_name ILIKE $${pIdx} OR
      u.email ILIKE $${pIdx} OR
      a.ip_address ILIKE $${pIdx} OR
      CAST(a.entity_id AS TEXT) ILIKE $${pIdx}
    )`);
  }

  return { whereSql: clauses.join(' AND '), params };
}

export async function getAuditLogsService(filters: AuditFilterParams = {}): Promise<{
  logs: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 25));
  const offset = (page - 1) * limit;
  const sortOrder = filters.sort_order === 'ASC' ? 'ASC' : 'DESC';

  const { whereSql, params } = buildAuditWhere(filters);

  // 1. Get total count
  const countSql = `
    SELECT COUNT(*)::int as total
    FROM audit_logs a
    LEFT JOIN users u ON a.performed_by = u.id
    WHERE ${whereSql}
  `;
  const countRes = await activeQuery(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // 2. Query paginated records
  const queryParams = [...params, limit, offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const dataSql = `
    SELECT 
      a.id,
      a.entity_name,
      a.entity_id,
      a.action,
      a.performed_by,
      u.full_name as performed_by_name,
      u.role as performed_by_role,
      u.email as performed_by_email,
      a.old_values,
      a.new_values,
      a.ip_address,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.performed_by = u.id
    WHERE ${whereSql}
    ORDER BY a.created_at ${sortOrder}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await activeQuery(dataSql, queryParams);

  return {
    logs: dataRes.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getAuditStatsService(): Promise<AuditStats> {
  const statsRes = await activeQuery(`
    SELECT
      COUNT(*)::int as total_events,
      COUNT(DISTINCT a.entity_name)::int as distinct_entities_count,
      COUNT(DISTINCT a.action)::int as distinct_actions_count,
      COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END)::int as events_last_24h
    FROM audit_logs a
  `);

  const entityRes = await activeQuery(`
    SELECT entity_name, COUNT(*)::int as count
    FROM audit_logs
    GROUP BY entity_name
    ORDER BY count DESC
    LIMIT 10
  `);

  const actionRes = await activeQuery(`
    SELECT action, COUNT(*)::int as count
    FROM audit_logs
    GROUP BY action
    ORDER BY count DESC
    LIMIT 10
  `);

  const summary = statsRes.rows[0] || {};

  return {
    total_events: summary.total_events || 0,
    distinct_entities_count: summary.distinct_entities_count || 0,
    distinct_actions_count: summary.distinct_actions_count || 0,
    events_last_24h: summary.events_last_24h || 0,
    entity_distribution: entityRes.rows,
    top_actions: actionRes.rows,
  };
}

export async function getAuditEntitiesAndActionsService(): Promise<{
  entities: string[];
  actions: string[];
}> {
  const entitiesRes = await activeQuery(`
    SELECT DISTINCT entity_name 
    FROM audit_logs 
    WHERE entity_name IS NOT NULL 
    ORDER BY entity_name ASC
  `);

  const actionsRes = await activeQuery(`
    SELECT DISTINCT action 
    FROM audit_logs 
    WHERE action IS NOT NULL 
    ORDER BY action ASC
  `);

  return {
    entities: entitiesRes.rows.map(r => r.entity_name),
    actions: actionsRes.rows.map(r => r.action),
  };
}

export async function getAuditLogByIdService(id: string): Promise<AuditLogItem | null> {
  const sql = `
    SELECT 
      a.id,
      a.entity_name,
      a.entity_id,
      a.action,
      a.performed_by,
      u.full_name as performed_by_name,
      u.role as performed_by_role,
      u.email as performed_by_email,
      a.old_values,
      a.new_values,
      a.ip_address,
      a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON a.performed_by = u.id
    WHERE a.id = $1::uuid
  `;
  const res = await activeQuery(sql, [id]);
  return res.rows[0] || null;
}

export async function exportAuditLogsCsvService(filters: AuditFilterParams = {}): Promise<string> {
  // Query up to 2000 matching rows for export
  const exportFilters = { ...filters, page: 1, limit: 2000 };
  const { logs } = await getAuditLogsService(exportFilters);

  const header = ['"Event ID"','"Timestamp"','"Entity Domain"','"Entity Reference"','"Action Performed"','"User Name"','"Role"','"User Email"','"Client IP"','"Old Values"','"New Values"'].join(',');

  const rows = logs.map(l => {
    const oldStr = l.old_values ? JSON.stringify(l.old_values).replace(/"/g, '""') : '';
    const newStr = l.new_values ? JSON.stringify(l.new_values).replace(/"/g, '""') : '';
    return [
      `"${l.id}"`,
      `"${l.created_at}"`,
      `"${l.entity_name}"`,
      `"${l.entity_id || ''}"`,
      `"${l.action}"`,
      `"${(l.performed_by_name || 'System').replace(/"/g, '""')}"`,
      `"${l.performed_by_role || 'SYSTEM'}"`,
      `"${l.performed_by_email || ''}"`,
      `"${l.ip_address || ''}"`,
      `"${oldStr}"`,
      `"${newStr}"`
    ].join(',');
  });

  return [header, ...rows].join('\r\n');
}

