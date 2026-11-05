import { pool, query as defaultQuery } from '../../config/db';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------
export class DowntimeServiceError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'DowntimeServiceError';
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, DowntimeServiceError.prototype);
  }
}

// ---------------------------------------------------------------------------
// Database Interface & Test Dependency Injection
// ---------------------------------------------------------------------------
export type QueryFn = (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;

export interface DbClientLike {
  query: QueryFn;
  release: () => void;
}

export interface DbPoolLike {
  connect: () => Promise<DbClientLike>;
  query?: QueryFn;
}

let activePool: DbPoolLike = pool as unknown as DbPoolLike;
let activeQuery: QueryFn = defaultQuery as unknown as QueryFn;

export function setDowntimeServiceDb(customPool: DbPoolLike, customQuery?: QueryFn): void {
  activePool = customPool;
  activeQuery = customQuery || (customPool.query ? customPool.query.bind(customPool) : async (text, params) => {
    const client = await customPool.connect();
    try {
      return await client.query(text, params);
    } finally {
      client.release();
    }
  });
}

export function resetDowntimeServiceDb(): void {
  activePool = pool as unknown as DbPoolLike;
  activeQuery = defaultQuery as unknown as QueryFn;
}

export function getDowntimeServiceDb(): { pool: DbPoolLike; query: QueryFn } {
  return { pool: activePool, query: activeQuery };
}

// ---------------------------------------------------------------------------
// Constants & UUID Validation
// ---------------------------------------------------------------------------
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DowntimeFilterParams {
  start_date?: string;
  end_date?: string;
  plant_id?: string;
  shop_id?: string;
  machine_id?: string;
  technician_id?: string;
  priority?: string;
  issue_category?: string;
  downtime_type?: 'planned' | 'unplanned' | 'all';
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// ---------------------------------------------------------------------------
// Date Validation & Scoping Query Builder Helpers
// ---------------------------------------------------------------------------
export function validateDateRange(startDate?: string, endDate?: string): { parsedStart?: Date; parsedEnd?: Date } {
  let parsedStart: Date | undefined;
  let parsedEnd: Date | undefined;

  if (startDate) {
    parsedStart = new Date(startDate);
    if (isNaN(parsedStart.getTime())) {
      throw new DowntimeServiceError(`Invalid start_date format '${startDate}'. Expected ISO date format (YYYY-MM-DD).`, 400);
    }
  }

  if (endDate) {
    parsedEnd = new Date(endDate);
    if (isNaN(parsedEnd.getTime())) {
      throw new DowntimeServiceError(`Invalid end_date format '${endDate}'. Expected ISO date format (YYYY-MM-DD).`, 400);
    }
  }

  if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
    throw new DowntimeServiceError('Invalid date range: start_date cannot be later than end_date.', 400);
  }

  return { parsedStart, parsedEnd };
}

export function buildScopeAndFilters(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser,
  tableAliases: { wo?: string; m?: string; s?: string; mr?: string } = { wo: 'wo', m: 'm', s: 's', mr: 'mr' }
): { whereClause: string; params: any[] } {
  const params: any[] = [];
  const conditions: string[] = ['1=1'];

  const wo = tableAliases.wo || 'wo';
  const m = tableAliases.m || 'm';
  const s = tableAliases.s || 's';
  const mr = tableAliases.mr || 'mr';

  // 1. RBAC & Multi-tenant plant/shop scope enforcement
  if (user.role === 'admin') {
    // Admin has global visibility across all plants
  } else if (user.role === 'manager') {
    if (user.plant_id) {
      params.push(user.plant_id);
      conditions.push(`${s}.plant_id = $${params.length}`);
    }
    if (user.shop_id) {
      params.push(user.shop_id);
      conditions.push(`${m}.shop_id = $${params.length}`);
    }
  } else if (user.role === 'technician') {
    if (user.plant_id) {
      params.push(user.plant_id);
      conditions.push(`${s}.plant_id = $${params.length}`);
    }
    if (user.shop_id) {
      params.push(user.shop_id);
      conditions.push(`${m}.shop_id = $${params.length}`);
    }
  } else if (user.role === 'operator') {
    if (user.plant_id) {
      params.push(user.plant_id);
      conditions.push(`${s}.plant_id = $${params.length}`);
    }
    if (user.shop_id) {
      params.push(user.shop_id);
      conditions.push(`${m}.shop_id = $${params.length}`);
    }
  } else {
    throw new DowntimeServiceError(`Forbidden: Role '${user.role}' is not authorized to access downtime analytics.`, 403);
  }

  // 2. Organization Filters (must be within user's allowed scope)
  if (filters.plant_id) {
    if (!UUID_REGEX.test(filters.plant_id.trim())) {
      throw new DowntimeServiceError('Invalid plant_id format.', 400);
    }
    if (user.role !== 'admin' && user.plant_id && user.plant_id !== filters.plant_id) {
      throw new DowntimeServiceError('Forbidden: Cannot view downtime data for another plant.', 403);
    }
    params.push(filters.plant_id);
    conditions.push(`${s}.plant_id = $${params.length}`);
  }

  if (filters.shop_id) {
    if (!UUID_REGEX.test(filters.shop_id.trim())) {
      throw new DowntimeServiceError('Invalid shop_id format.', 400);
    }
    if (user.role !== 'admin' && user.shop_id && user.shop_id !== filters.shop_id) {
      throw new DowntimeServiceError('Forbidden: Cannot view downtime data for another shop.', 403);
    }
    params.push(filters.shop_id);
    conditions.push(`${m}.shop_id = $${params.length}`);
  }

  if (filters.machine_id) {
    if (!UUID_REGEX.test(filters.machine_id.trim())) {
      throw new DowntimeServiceError('Invalid machine_id format.', 400);
    }
    params.push(filters.machine_id);
    conditions.push(`${m}.id = $${params.length}`);
  }

  if (filters.technician_id) {
    if (!UUID_REGEX.test(filters.technician_id.trim())) {
      throw new DowntimeServiceError('Invalid technician_id format.', 400);
    }
    if (user.role === 'technician' && user.id && user.id !== filters.technician_id) {
      throw new DowntimeServiceError('Forbidden: Technicians can only view their own assigned work order incidents.', 403);
    }
    params.push(filters.technician_id);
    conditions.push(`${wo}.assigned_technician_id = $${params.length}`);
  }

  // 3. Date Range Filter (inclusive end date)
  const { parsedStart, parsedEnd } = validateDateRange(filters.start_date, filters.end_date);
  if (parsedStart) {
    params.push(parsedStart.toISOString());
    conditions.push(`COALESCE(${wo}.breakdown_time, ${mr}.breakdown_occurred_at, ${wo}.created_at) >= $${params.length}`);
  }
  if (parsedEnd) {
    // Set end of day for inclusive date range (23:59:59.999Z)
    const endOfDay = new Date(parsedEnd);
    endOfDay.setUTCHours(23, 59, 59, 999);
    params.push(endOfDay.toISOString());
    conditions.push(`COALESCE(${wo}.breakdown_time, ${mr}.breakdown_occurred_at, ${wo}.created_at) <= $${params.length}`);
  }

  // 4. Priority Filter
  if (filters.priority) {
    params.push(filters.priority.toLowerCase());
    conditions.push(`LOWER(COALESCE(${wo}.priority, ${mr}.priority)) = $${params.length}`);
  }

  // 5. Category Filter
  if (filters.issue_category) {
    params.push(`%${filters.issue_category.trim()}%`);
    conditions.push(`(${mr}.issue_category ILIKE $${params.length} OR ${wo}.fault_category ILIKE $${params.length})`);
  }

  // 6. Planned vs Unplanned Filter
  if (filters.downtime_type === 'planned') {
    conditions.push(`(${wo}.classification = 'regular_maintenance' OR ${wo}.classification = 'preventive_maintenance')`);
  } else if (filters.downtime_type === 'unplanned') {
    conditions.push(`(${wo}.classification IN ('minor_breakdown', 'major_breakdown', 'external_service_required') OR ${wo}.complaint_id IS NOT NULL)`);
  }

  return {
    whereClause: conditions.join(' AND '),
    params,
  };
}

// ---------------------------------------------------------------------------
// 1. Overall Downtime Summary & KPI Dashboard (GET /api/v1/downtime)
// ---------------------------------------------------------------------------
export async function getDowntimeSummaryService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  // 1. Summary Metrics from Verified Closed Work Orders
  const summarySql = `
    SELECT 
      COUNT(DISTINCT wo.id) as total_breakdown_events,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(SUM(wo.total_downtime_minutes), 0) / 60.0, 2) as total_downtime_hours,
      ROUND(COALESCE(AVG(wo.total_downtime_minutes), 0), 2) as avg_downtime_per_incident,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as mttr_active_wrench_minutes,
      ROUND(COALESCE(AVG(wo.maintenance_response_minutes), 0), 2) as avg_response_delay_minutes,
      COALESCE(SUM(CASE WHEN wo.classification = 'regular_maintenance' THEN wo.total_downtime_minutes ELSE 0 END), 0) as planned_downtime_minutes,
      COALESCE(SUM(CASE WHEN wo.classification != 'regular_maintenance' THEN wo.total_downtime_minutes ELSE 0 END), 0) as unplanned_downtime_minutes,
      COUNT(CASE WHEN wo.status = 'verified_closed' AND wo.machine_restored_time IS NOT NULL THEN 1 END) as restored_machines_period,
      COUNT(CASE WHEN wo.sla_deadline IS NOT NULL AND wo.repair_completed_time IS NOT NULL AND wo.repair_completed_time <= wo.sla_deadline THEN 1 END) as sla_met_count,
      COUNT(CASE WHEN wo.sla_deadline IS NOT NULL AND wo.repair_completed_time IS NOT NULL AND wo.repair_completed_time > wo.sla_deadline THEN 1 END) as sla_breached_count
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
  `;

  const summaryRes = await query(summarySql, params);
  const summaryRow = summaryRes.rows[0] || {};

  // 2. Currently Down Machines Count (within scope, parameterized)
  const downConditions: string[] = ["m.status IN ('breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification')"];
  const downParams: any[] = [];
  if (user.role !== 'admin' && user.plant_id) {
    downParams.push(user.plant_id);
    downConditions.push(`s.plant_id = $${downParams.length}`);
  }
  if (user.role !== 'admin' && user.shop_id) {
    downParams.push(user.shop_id);
    downConditions.push(`m.shop_id = $${downParams.length}`);
  }
  if (filters.shop_id) {
    downParams.push(filters.shop_id);
    downConditions.push(`m.shop_id = $${downParams.length}`);
  }
  if (filters.machine_id) {
    downParams.push(filters.machine_id);
    downConditions.push(`m.id = $${downParams.length}`);
  }
  const downMachinesSql = `
    SELECT COUNT(DISTINCT m.id) as currently_down_count
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    WHERE ${downConditions.join(' AND ')}
  `;
  const downRes = await query(downMachinesSql, downParams);
  const currentlyDown = parseInt(downRes.rows[0]?.currently_down_count || '0', 10);

  // 3. Top 10 Pareto Machines (preserved for frontend compatibility)
  const paretoSql = `
    SELECT m.id, m.machine_code, m.name, s.shop_name, m.criticality,
           COUNT(wo.id) as failure_count,
           COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
           ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY m.id, m.machine_code, m.name, s.shop_name, m.criticality
    ORDER BY total_downtime_minutes DESC
    LIMIT 10
  `;
  const paretoRes = await query(paretoSql, params);

  // 4. Category-wise Breakdown Distribution (preserved for frontend compatibility)
  const categorySql = `
    SELECT COALESCE(mr.issue_category, wo.fault_category, 'Unspecified') as issue_category,
           COUNT(*) as count,
           COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY issue_category
    ORDER BY count DESC
  `;
  const categoryRes = await query(categorySql, params);

  // 5. Calculate SLA Compliance %
  const totalSLATracked = parseInt(summaryRow.sla_met_count || '0', 10) + parseInt(summaryRow.sla_breached_count || '0', 10);
  const slaCompliance = totalSLATracked > 0
    ? Math.round((parseInt(summaryRow.sla_met_count, 10) / totalSLATracked) * 1000) / 10
    : 100.0;

  return {
    summary: {
      total_breakdown_events: parseInt(summaryRow.total_breakdown_events || '0', 10),
      total_downtime_minutes: parseInt(summaryRow.total_downtime_minutes || '0', 10),
      total_downtime_hours: parseFloat(summaryRow.total_downtime_hours || '0'),
      avg_downtime_per_incident: parseFloat(summaryRow.avg_downtime_per_incident || '0'),
      mttr_active_wrench_minutes: parseFloat(summaryRow.mttr_active_wrench_minutes || '0'),
      avg_response_delay_minutes: parseFloat(summaryRow.avg_response_delay_minutes || '0'),
      currently_down_machines: currentlyDown,
      restored_machines_period: parseInt(summaryRow.restored_machines_period || '0', 10),
      planned_downtime_minutes: parseInt(summaryRow.planned_downtime_minutes || '0', 10),
      unplanned_downtime_minutes: parseInt(summaryRow.unplanned_downtime_minutes || '0', 10),
    },
    paretoTopMachines: paretoRes.rows.map((r: any) => ({
      ...r,
      failure_count: parseInt(r.failure_count || '0', 10),
      total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
      avg_repair_minutes: parseFloat(r.avg_repair_minutes || '0'),
    })),
    categoryDistribution: categoryRes.rows.map((r: any) => ({
      issue_category: r.issue_category,
      count: parseInt(r.count || '0', 10),
      total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    })),
    kpis: {
      availability_percentage: null, // Explained under data_quality
      mttr_minutes: parseFloat(summaryRow.mttr_active_wrench_minutes || '0'),
      mtbf_hours: null, // Explained under data_quality
      sla_compliance_percentage: slaCompliance,
      sla_breaches_count: parseInt(summaryRow.sla_breached_count || '0', 10),
    },
    data_quality: {
      availability_status: 'unavailable',
      availability_reason: 'Missing shift_schedules table defining scheduled production operating hours denominator. Calendar hours are not used as operating hours.',
      mtbf_status: 'unavailable',
      mtbf_reason: 'Continuous operating time logs absent. Machine operating hours meter requires interval tracking table.',
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Machine Downtime Records (GET /api/v1/downtime/records)
// ---------------------------------------------------------------------------
export async function getDowntimeRecordsService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  const { query } = getDowntimeServiceDb();

  // 1. If machine_id filter is specified, pre-validate existence and user scope
  if (filters.machine_id) {
    if (!UUID_REGEX.test(filters.machine_id.trim())) {
      throw new DowntimeServiceError('Invalid machine ID format.', 400);
    }
    const mCheck = await query(
      `SELECT m.id, m.shop_id, s.plant_id 
       FROM machines m 
       JOIN shops s ON m.shop_id = s.id 
       WHERE m.id = $1`,
      [filters.machine_id]
    );
    if (mCheck.rows.length === 0) {
      throw new DowntimeServiceError('Machine asset not found.', 404);
    }
    const mach = mCheck.rows[0];
    if (user.role !== 'admin') {
      if (user.plant_id && mach.plant_id && user.plant_id !== mach.plant_id) {
        throw new DowntimeServiceError('Forbidden: Machine belongs to another plant.', 403);
      }
      if (user.shop_id && mach.shop_id && user.shop_id !== mach.shop_id) {
        throw new DowntimeServiceError('Forbidden: Machine belongs to another shop outside your assigned scope.', 403);
      }
    }
    if (user.role === 'technician') {
      const assignedCheck = await query(
        `SELECT 1 FROM work_orders WHERE machine_id = $1 AND assigned_technician_id = $2 LIMIT 1`,
        [filters.machine_id, user.id]
      );
      if (assignedCheck.rows.length === 0) {
        throw new DowntimeServiceError('Forbidden: You are not assigned to maintenance tasks on this machine.', 403);
      }
    }
  }

  // 2. Technicians are restricted to their assigned work order records
  const effectiveFilters: DowntimeFilterParams = user.role === 'technician'
    ? { ...filters, technician_id: user.id }
    : filters;

  const { whereClause, params } = buildScopeAndFilters(effectiveFilters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  // Sorting columns
  const allowedSortCols: Record<string, string> = {
    breakdown_time: 'COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.created_at)',
    total_downtime_minutes: 'wo.total_downtime_minutes',
    active_repair_minutes: 'wo.active_repair_minutes',
    machine_code: 'm.machine_code',
    status: 'wo.status',
    priority: 'wo.priority',
  };
  const sortCol = allowedSortCols[filters.sortBy || 'breakdown_time'] || 'COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.created_at)';
  const sortDir = filters.sortOrder === 'ASC' ? 'ASC' : 'DESC';

  const countSql = `
    SELECT COUNT(DISTINCT wo.id) as count
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.count || '0', 10);

  const dataSql = `
    SELECT 
      wo.id as work_order_id,
      wo.wo_number,
      wo.status as work_order_status,
      wo.priority,
      wo.classification,
      wo.is_major_breakdown,
      m.id as machine_id,
      m.machine_code,
      m.name as machine_name,
      m.criticality as machine_criticality,
      m.status as machine_current_status,
      s.id as shop_id,
      s.shop_name,
      p.id as plant_id,
      p.plant_name as plant_name,
      mr.id as complaint_id,
      mr.complaint_number,
      COALESCE(mr.issue_category, wo.fault_category, 'General') as issue_category,
      mr.problem_title,
      COALESCE(wo.breakdown_time, mr.breakdown_occurred_at) as breakdown_time,
      COALESCE(wo.reported_time, mr.reported_at) as reported_time,
      wo.manager_ack_time,
      wo.technician_assigned_time,
      wo.arrival_time,
      wo.work_started_time,
      wo.repair_completed_time,
      wo.manager_verified_time,
      wo.machine_restored_time,
      wo.sla_deadline,
      CASE 
        WHEN wo.status = 'verified_closed' THEN wo.total_downtime_minutes
        ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.reported_time, wo.created_at))) / 60)
      END as downtime_duration_minutes,
      wo.active_repair_minutes,
      wo.maintenance_response_minutes,
      CASE 
        WHEN wo.status = 'verified_closed' THEN 'completed'
        ELSE 'ongoing'
      END as incident_state,
      wo.affected_component,
      wo.root_cause_analysis,
      wo.corrective_action,
      u_tech.full_name as assigned_technician_name,
      u_mgr.full_name as assigned_manager_name
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    LEFT JOIN users u_tech ON wo.assigned_technician_id = u_tech.id
    LEFT JOIN users u_mgr ON wo.assigned_manager_id = u_mgr.id
    WHERE ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const dataRes = await query(dataSql, [...params, limit, offset]);

  return {
    data: dataRes.rows.map((row: any) => ({
      ...row,
      downtime_duration_minutes: Math.max(0, parseInt(row.downtime_duration_minutes || '0', 10)),
      active_repair_minutes: Math.max(0, parseInt(row.active_repair_minutes || '0', 10)),
      maintenance_response_minutes: Math.max(0, parseInt(row.maintenance_response_minutes || '0', 10)),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Single Downtime Record Inspection (GET /api/v1/downtime/records/:id)
// ---------------------------------------------------------------------------
export async function getDowntimeRecordDetailsService(id: string, user: AuthenticatedUser): Promise<any> {
  if (!UUID_REGEX.test(id.trim())) {
    throw new DowntimeServiceError('Invalid work order / incident ID format.', 400);
  }

  const { query } = getDowntimeServiceDb();

  const detailSql = `
    SELECT 
      wo.*,
      m.machine_code,
      m.name as machine_name,
      m.category as machine_category,
      m.criticality as machine_criticality,
      m.status as machine_current_status,
      m.bay_line_location,
      s.id as shop_id,
      s.shop_name,
      p.id as plant_id,
      p.plant_name as plant_name,
      mr.complaint_number,
      mr.problem_title,
      mr.description as complaint_description,
      mr.issue_category,
      mr.breakdown_occurred_at,
      mr.shift,
      u_tech.full_name as technician_name,
      u_tech.email as technician_email,
      u_mgr.full_name as manager_name
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    LEFT JOIN users u_tech ON wo.assigned_technician_id = u_tech.id
    LEFT JOIN users u_mgr ON wo.assigned_manager_id = u_mgr.id
    WHERE wo.id = $1
  `;

  const detailRes = await query(detailSql, [id]);
  if (detailRes.rows.length === 0) {
    throw new DowntimeServiceError('Downtime incident record not found.', 404);
  }

  const record = detailRes.rows[0];

  // Plant, shop & technician RBAC verification
  if (user.role !== 'admin') {
    if (user.plant_id && record.plant_id && user.plant_id !== record.plant_id) {
      throw new DowntimeServiceError('Forbidden: Incident record belongs to another plant outside your authorized scope.', 403);
    }
    if (user.shop_id && record.shop_id && user.shop_id !== record.shop_id) {
      throw new DowntimeServiceError('Forbidden: Incident record belongs to another shop outside your authorized scope.', 403);
    }
    if (user.role === 'technician' && record.assigned_technician_id && record.assigned_technician_id !== user.id) {
      throw new DowntimeServiceError('Forbidden: Incident record is assigned to another technician.', 403);
    }
  }

  // Fetch chronological milestone events
  const eventsRes = await query(
    `SELECT we.*, u.full_name as performed_by_name, u.role as performed_by_role
     FROM work_order_events we
     LEFT JOIN users u ON we.performed_by = u.id
     WHERE we.work_order_id = $1
     ORDER BY we.timestamp ASC`,
    [id]
  );

  return {
    ...record,
    total_downtime_minutes: Math.max(0, parseInt(record.total_downtime_minutes || '0', 10)),
    active_repair_minutes: Math.max(0, parseInt(record.active_repair_minutes || '0', 10)),
    maintenance_response_minutes: Math.max(0, parseInt(record.maintenance_response_minutes || '0', 10)),
    timeline_events: eventsRes.rows,
  };
}

// ---------------------------------------------------------------------------
// 4. Machine-specific Downtime & Availability (GET /api/v1/downtime/machines/:machineId)
// ---------------------------------------------------------------------------
export async function getMachineDowntimeSummaryService(
  machineId: string,
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  if (!UUID_REGEX.test(machineId.trim())) {
    throw new DowntimeServiceError('Invalid machine ID format.', 400);
  }

  const { query } = getDowntimeServiceDb();

  // Verify machine exists and obtain plant/shop
  const mRes = await query(
    `SELECT m.*, s.id as shop_id, s.shop_name, s.plant_id, p.plant_name as plant_name
     FROM machines m
     JOIN shops s ON m.shop_id = s.id
     JOIN plants p ON s.plant_id = p.id
     WHERE m.id = $1`,
    [machineId]
  );
  if (mRes.rows.length === 0) {
    throw new DowntimeServiceError('Machine asset not found.', 404);
  }
  const machine = mRes.rows[0];

  // Authorization check (cross-plant and cross-shop)
  if (user.role !== 'admin') {
    if (user.plant_id && machine.plant_id && user.plant_id !== machine.plant_id) {
      throw new DowntimeServiceError('Forbidden: Machine belongs to another plant.', 403);
    }
    if (user.shop_id && machine.shop_id && user.shop_id !== machine.shop_id) {
      throw new DowntimeServiceError('Forbidden: Machine belongs to another shop outside your assigned scope.', 403);
    }
  }

  // Technician assignment check: Technicians are restricted to machines with work orders assigned to them
  if (user.role === 'technician') {
    const assignedCheck = await query(
      `SELECT 1 FROM work_orders WHERE machine_id = $1 AND assigned_technician_id = $2 LIMIT 1`,
      [machineId, user.id]
    );
    if (assignedCheck.rows.length === 0) {
      throw new DowntimeServiceError('Forbidden: You are not assigned to maintenance tasks on this machine.', 403);
    }
  }

  const { whereClause, params } = buildScopeAndFilters({ ...filters, machine_id: machineId }, user, {
    wo: 'wo',
    m: 'm',
    s: 's',
    mr: 'mr',
  });

  const statsRes = await query(
    `SELECT 
       COUNT(DISTINCT wo.id) as total_incidents,
       COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
       ROUND(COALESCE(AVG(wo.total_downtime_minutes), 0), 2) as avg_downtime_minutes,
       ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as mttr_active_repair_minutes,
       ROUND(COALESCE(AVG(wo.maintenance_response_minutes), 0), 2) as avg_response_delay_minutes
     FROM work_orders wo
     JOIN machines m ON wo.machine_id = m.id
     JOIN shops s ON m.shop_id = s.id
     LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
     WHERE ${whereClause} AND wo.status = 'verified_closed'`,
    params
  );

  const stats = statsRes.rows[0];

  return {
    machine: {
      id: machine.id,
      machine_code: machine.machine_code,
      name: machine.name,
      criticality: machine.criticality,
      status: machine.status,
      operating_hours: parseFloat(machine.operating_hours || '0'),
      plant_name: machine.plant_name,
      shop_name: machine.shop_name,
    },
    metrics: {
      total_incidents: parseInt(stats.total_incidents || '0', 10),
      total_downtime_minutes: parseInt(stats.total_downtime_minutes || '0', 10),
      avg_downtime_minutes: parseFloat(stats.avg_downtime_minutes || '0'),
      mttr_active_repair_minutes: parseFloat(stats.mttr_active_repair_minutes || '0'),
      avg_response_delay_minutes: parseFloat(stats.avg_response_delay_minutes || '0'),
    },
    data_quality: {
      availability_percentage: null,
      reason: 'Scheduled operating shift denominator not configured in schema.',
      mtbf_baseline_limitation: 'Shared measurement baseline cannot be established between machines.operating_hours (cumulative meter reading which may include pre-CMMS operating history) and CMMS failure count (which only records failures logged in this CMMS since go-live).',
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Machine Historical Incidents Timeline (GET /api/v1/downtime/machines/:machineId/history)
// ---------------------------------------------------------------------------
export async function getMachineDowntimeHistoryService(
  machineId: string,
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
  if (!UUID_REGEX.test(machineId.trim())) {
    throw new DowntimeServiceError('Invalid machine ID format.', 400);
  }

  const { query } = getDowntimeServiceDb();

  // Verify machine exists and check authorization scope
  const mRes = await query(
    `SELECT m.*, s.id as shop_id, s.shop_name, s.plant_id, p.plant_name as plant_name
     FROM machines m
     JOIN shops s ON m.shop_id = s.id
     JOIN plants p ON s.plant_id = p.id
     WHERE m.id = $1`,
    [machineId]
  );
  if (mRes.rows.length === 0) {
    throw new DowntimeServiceError('Machine asset not found.', 404);
  }
  const machine = mRes.rows[0];

  if (user.role !== 'admin') {
    if (user.plant_id && machine.plant_id && user.plant_id !== machine.plant_id) {
      throw new DowntimeServiceError('Forbidden: Machine belongs to another plant.', 403);
    }
    if (user.shop_id && machine.shop_id && user.shop_id !== machine.shop_id) {
      throw new DowntimeServiceError('Forbidden: Machine belongs to another shop outside your assigned scope.', 403);
    }
  }

  // Technician assignment check: Technicians are restricted to machines with work orders assigned to them
  if (user.role === 'technician') {
    const assignedCheck = await query(
      `SELECT 1 FROM work_orders WHERE machine_id = $1 AND assigned_technician_id = $2 LIMIT 1`,
      [machineId, user.id]
    );
    if (assignedCheck.rows.length === 0) {
      throw new DowntimeServiceError('Forbidden: You are not assigned to maintenance tasks on this machine.', 403);
    }
  }

  return getDowntimeRecordsService({ ...filters, machine_id: machineId }, user);
}

// ---------------------------------------------------------------------------
// 6. Machine Availability Analytics (GET /api/v1/downtime/availability)
// ---------------------------------------------------------------------------
export async function getMachineAvailabilityService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  // Grouped by machine
  const availabilitySql = `
    SELECT 
      m.id as machine_id,
      m.machine_code,
      m.name as machine_name,
      m.criticality,
      s.shop_name,
      p.plant_name as plant_name,
      COUNT(DISTINCT wo.id) as failure_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      m.operating_hours
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY m.id, m.machine_code, m.name, m.criticality, s.shop_name, p.plant_name, m.operating_hours
    ORDER BY total_downtime_minutes DESC
  `;

  const res = await query(availabilitySql, params);

  return {
    formula: 'Availability (%) = ((Scheduled Operating Time - Downtime) / Scheduled Operating Time) * 100',
    status: 'unavailable',
    reason: 'Database schema does not define scheduled shift operating hours (e.g. shift_schedules table). Calendar time is strictly not substituted for production operating hours.',
    records: res.rows.map((row: any) => ({
      machine_id: row.machine_id,
      machine_code: row.machine_code,
      machine_name: row.machine_name,
      plant_name: row.plant_name,
      shop_name: row.shop_name,
      criticality: row.criticality,
      failure_count: parseInt(row.failure_count || '0', 10),
      total_downtime_minutes: parseInt(row.total_downtime_minutes || '0', 10),
      meter_operating_hours: parseFloat(row.operating_hours || '0'),
      calculated_availability_percent: null,
      notes: 'Requires shift_schedules migration to provide scheduled operating time denominator.',
    })),
  };
}

// ---------------------------------------------------------------------------
// 7. MTTR Analytics (GET /api/v1/downtime/mttr)
// ---------------------------------------------------------------------------
export async function getMTTRAnalyticsService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  // 1. Overall MTTR Breakdown
  const overallSql = `
    SELECT 
      COUNT(wo.id) as completed_repair_count,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as active_wrench_mttr_minutes,
      ROUND(COALESCE(AVG(wo.total_downtime_minutes), 0), 2) as overall_stoppage_mttr_minutes,
      ROUND(COALESCE(AVG(wo.maintenance_response_minutes), 0), 2) as avg_response_delay_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
  `;
  const overallRes = await query(overallSql, params);

  // 2. MTTR by Machine
  const byMachineSql = `
    SELECT m.id, m.machine_code, m.name, s.shop_name,
           COUNT(wo.id) as incident_count,
           ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as mttr_active_repair_minutes,
           ROUND(COALESCE(AVG(wo.total_downtime_minutes), 0), 2) as mttr_total_downtime_minutes
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY m.id, m.machine_code, m.name, s.shop_name
    ORDER BY mttr_active_repair_minutes DESC
    LIMIT 10
  `;
  const byMachineRes = await query(byMachineSql, params);

  // 3. MTTR by Shop
  const byShopSql = `
    SELECT s.id, s.shop_name,
           COUNT(wo.id) as incident_count,
           ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as mttr_active_repair_minutes,
           ROUND(COALESCE(AVG(wo.total_downtime_minutes), 0), 2) as mttr_total_downtime_minutes
    FROM shops s
    JOIN machines m ON s.id = m.shop_id
    JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY s.id, s.shop_name
    ORDER BY mttr_active_repair_minutes DESC
  `;
  const byShopRes = await query(byShopSql, params);

  return {
    definitions: {
      active_wrench_mttr: 'Average duration in minutes from work_started_time to repair_completed_time.',
      total_stoppage_mttr: 'Average duration in minutes from breakdown occurrence to verified restoration.',
    },
    overall: overallRes.rows[0],
    by_machine: byMachineRes.rows,
    by_shop: byShopRes.rows,
  };
}

// ---------------------------------------------------------------------------
// 8. MTBF Analytics (GET /api/v1/downtime/mtbf)
// ---------------------------------------------------------------------------
export async function getMTBFAnalyticsService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const isPeriodFiltered = Boolean(filters.start_date || filters.end_date);

  const mtbfSql = `
    SELECT 
      m.id, m.machine_code, m.name, m.operating_hours,
      COUNT(wo.id) as failure_count,
      CASE 
        WHEN ${isPeriodFiltered ? 'FALSE' : 'TRUE'} AND COUNT(wo.id) > 0 AND m.operating_hours > 0 THEN ROUND(m.operating_hours / COUNT(wo.id), 2)
        ELSE NULL
      END as mtbf_operating_hours
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY m.id, m.machine_code, m.name, m.operating_hours
    ORDER BY failure_count DESC
  `;

  const res = await query(mtbfSql, params);

  if (isPeriodFiltered) {
    return {
      status: 'unavailable',
      calculation_basis: 'Period-specific MTBF is unavailable: machines.operating_hours represents cumulative lifetime operating meter.',
      reason: 'Period-specific MTBF cannot be computed because historical interval meter readings or shift schedules are not tracked in the schema. Lifetime cumulative operating hours cannot be divided by period-specific failures.',
      data_quality: {
        reliability: 'unavailable',
        limitation: 'Period-specific MTBF cannot be computed because historical interval meter readings or shift schedules are not tracked in the schema. Lifetime cumulative operating hours cannot be divided by period-specific failures.',
        recommendation: 'Requires meter reading snapshots per observation period or shift schedule integration.',
      },
      records: res.rows.map((r: any) => ({
        id: r.id,
        machine_code: r.machine_code,
        name: r.name,
        failure_count: parseInt(r.failure_count || '0', 10),
        operating_hours: parseFloat(r.operating_hours || '0'),
        mtbf_operating_hours: null,
        data_quality_note: 'Period-specific MTBF unavailable: lifetime cumulative operating hours cannot be divided by period-specific failures without period meter readings.',
      })),
    };
  }

  return {
    status: 'lifetime_only',
    calculation_basis: 'Lifetime MTBF = Total Lifetime Operating Hours / Total Lifetime Verified Failures (using machines.operating_hours meter)',
    reason: 'Calculated as cumulative lifetime MTBF across all recorded history. Period-specific MTBF requires historical meter logging.',
    data_quality: {
      reliability: 'conditional',
      limitation: 'Shared measurement baseline cannot be established between machines.operating_hours (cumulative meter reading which may include pre-CMMS operating history) and work_orders failure count (which only records failures logged in this CMMS since go-live).',
      recommendation: 'Baseline calibration requires recording meter reading at CMMS commissioning or tracking periodic meter snapshots.',
    },
    records: res.rows.map((r: any) => {
      const failureCount = parseInt(r.failure_count || '0', 10);
      const operatingHours = parseFloat(r.operating_hours || '0');
      const mtbf = failureCount > 0 && operatingHours > 0 ? Math.round((operatingHours / failureCount) * 100) / 100 : null;

      return {
        id: r.id,
        machine_code: r.machine_code,
        name: r.name,
        failure_count: failureCount,
        operating_hours: operatingHours,
        mtbf_operating_hours: mtbf,
        data_quality_note: mtbf !== null
          ? 'Conditional: Calculated from cumulative machine hour meter divided by total recorded failures. Shared measurement baseline not calibrated.'
          : 'Hour meter is zero or no failures recorded in CMMS',
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// 9. Machine Pareto 80/20 Breakdown (GET /api/v1/downtime/by-machine)
// ---------------------------------------------------------------------------
export async function getParetoMachinesService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  // 1. Total plant downtime to compute contribution percentage
  const totalSql = `
    SELECT COALESCE(SUM(wo.total_downtime_minutes), 0) as grand_total_downtime
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
  `;
  const totalRes = await query(totalSql, params);
  const grandTotal = parseInt(totalRes.rows[0]?.grand_total_downtime || '0', 10);

  // 2. Machine Pareto Breakdown
  const paretoSql = `
    SELECT 
      m.id, m.machine_code, m.name, m.criticality, s.shop_name, p.plant_name as plant_name,
      COUNT(wo.id) as failure_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY m.id, m.machine_code, m.name, m.criticality, s.shop_name, p.plant_name
    ORDER BY total_downtime_minutes DESC
    LIMIT 20
  `;
  const res = await query(paretoSql, params);

  return res.rows.map((row: any) => {
    const downtime = parseInt(row.total_downtime_minutes || '0', 10);
    const contributionPercent = grandTotal > 0 ? Math.round((downtime / grandTotal) * 1000) / 10 : 0;
    return {
      ...row,
      failure_count: parseInt(row.failure_count || '0', 10),
      total_downtime_minutes: downtime,
      avg_repair_minutes: parseFloat(row.avg_repair_minutes || '0'),
      downtime_contribution_percent: contributionPercent,
    };
  });
}

// ---------------------------------------------------------------------------
// 10. Plant-level Downtime Aggregation (GET /api/v1/downtime/by-plant)
// ---------------------------------------------------------------------------
export async function getDowntimeByPlantService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const plantSql = `
    SELECT 
      p.id as plant_id,
      p.plant_name as plant_name,
      p.plant_code as plant_code,
      COUNT(DISTINCT m.id) as total_machines,
      COUNT(DISTINCT CASE WHEN m.status IN ('breakdown', 'under_maintenance', 'awaiting_parts') THEN m.id END) as currently_down_machines,
      COUNT(DISTINCT wo.id) as total_breakdowns,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM plants p
    JOIN shops s ON p.id = s.plant_id
    JOIN machines m ON s.id = m.shop_id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY p.id, p.plant_name, p.plant_code
    ORDER BY total_downtime_minutes DESC
  `;

  const res = await query(plantSql, params);
  return res.rows.map((r: any) => ({
    ...r,
    total_machines: parseInt(r.total_machines || '0', 10),
    currently_down_machines: parseInt(r.currently_down_machines || '0', 10),
    total_breakdowns: parseInt(r.total_breakdowns || '0', 10),
    total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    avg_repair_minutes: parseFloat(r.avg_repair_minutes || '0'),
  }));
}

// ---------------------------------------------------------------------------
// 11. Shop-level Downtime Aggregation (GET /api/v1/downtime/by-shop)
// ---------------------------------------------------------------------------
export async function getDowntimeByShopService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const shopSql = `
    SELECT 
      s.id as shop_id,
      s.shop_name,
      p.plant_name as plant_name,
      COUNT(DISTINCT m.id) as total_machines,
      COUNT(DISTINCT CASE WHEN m.status IN ('breakdown', 'under_maintenance', 'awaiting_parts') THEN m.id END) as currently_down_machines,
      COUNT(DISTINCT wo.id) as total_breakdowns,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM shops s
    JOIN plants p ON s.plant_id = p.id
    JOIN machines m ON s.id = m.shop_id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status = 'verified_closed'
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause}
    GROUP BY s.id, s.shop_name, p.plant_name
    ORDER BY total_downtime_minutes DESC
  `;

  const res = await query(shopSql, params);
  return res.rows.map((r: any) => ({
    ...r,
    total_machines: parseInt(r.total_machines || '0', 10),
    currently_down_machines: parseInt(r.currently_down_machines || '0', 10),
    total_breakdowns: parseInt(r.total_breakdowns || '0', 10),
    total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    avg_repair_minutes: parseFloat(r.avg_repair_minutes || '0'),
  }));
}

// ---------------------------------------------------------------------------
// 12. Category-wise Distribution (GET /api/v1/downtime/by-category)
// ---------------------------------------------------------------------------
export async function getDowntimeByCategoryService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const catSql = `
    SELECT 
      COALESCE(mr.issue_category, wo.fault_category, 'Unspecified') as issue_category,
      COUNT(DISTINCT wo.id) as incident_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_active_repair_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
    GROUP BY issue_category
    ORDER BY incident_count DESC
  `;

  const res = await query(catSql, params);
  return res.rows.map((r: any) => ({
    issue_category: r.issue_category,
    incident_count: parseInt(r.incident_count || '0', 10),
    total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    avg_active_repair_minutes: parseFloat(r.avg_active_repair_minutes || '0'),
  }));
}

// ---------------------------------------------------------------------------
// 13. Root Cause & Fault Analysis (GET /api/v1/downtime/by-cause)
// ---------------------------------------------------------------------------
export async function getDowntimeByCauseService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const causeSql = `
    SELECT 
      COALESCE(wo.affected_component, 'Unspecified Component') as affected_component,
      COALESCE(wo.fault_category, mr.issue_category, 'General') as fault_category,
      COUNT(wo.id) as occurrence_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
    GROUP BY affected_component, fault_category
    ORDER BY occurrence_count DESC
    LIMIT 25
  `;

  const res = await query(causeSql, params);
  return res.rows.map((r: any) => ({
    affected_component: r.affected_component,
    fault_category: r.fault_category,
    occurrence_count: parseInt(r.occurrence_count || '0', 10),
    total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    avg_repair_minutes: parseFloat(r.avg_repair_minutes || '0'),
  }));
}

// ---------------------------------------------------------------------------
// 14. Trend Analytics (GET /api/v1/downtime/trends)
// ---------------------------------------------------------------------------
export async function getDowntimeTrendsService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const period = filters.period || 'daily';
  let dateTrunc = 'day';
  if (period === 'weekly') dateTrunc = 'week';
  if (period === 'monthly') dateTrunc = 'month';
  if (period === 'yearly') dateTrunc = 'year';

  const trendSql = `
    SELECT 
      DATE_TRUNC('${dateTrunc}', COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.created_at)) as period_date,
      COUNT(DISTINCT wo.id) as incident_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_downtime_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes,
      ROUND(COALESCE(AVG(wo.maintenance_response_minutes), 0), 2) as avg_response_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
    GROUP BY period_date
    ORDER BY period_date ASC
  `;

  const res = await query(trendSql, params);
  return res.rows.map((r: any) => ({
    period_date: r.period_date,
    incident_count: parseInt(r.incident_count || '0', 10),
    total_downtime_minutes: parseInt(r.total_downtime_minutes || '0', 10),
    avg_repair_minutes: parseFloat(r.avg_repair_minutes || '0'),
    avg_response_minutes: parseFloat(r.avg_response_minutes || '0'),
  }));
}

// ---------------------------------------------------------------------------
// 15. Planned vs Unplanned Downtime (GET /api/v1/downtime/planned-vs-unplanned)
// ---------------------------------------------------------------------------
export async function getPlannedVsUnplannedService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const sql = `
    SELECT 
      CASE 
        WHEN wo.classification = 'regular_maintenance' THEN 'planned'
        ELSE 'unplanned'
      END as downtime_type,
      COUNT(DISTINCT wo.id) as event_count,
      COALESCE(SUM(wo.total_downtime_minutes), 0) as total_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
    GROUP BY downtime_type
  `;

  const res = await query(sql, params);
  const rows = res.rows;

  const planned = rows.find((r: any) => r.downtime_type === 'planned') || { event_count: 0, total_minutes: 0, avg_repair_minutes: 0 };
  const unplanned = rows.find((r: any) => r.downtime_type === 'unplanned') || { event_count: 0, total_minutes: 0, avg_repair_minutes: 0 };

  const plannedMins = parseInt(planned.total_minutes || '0', 10);
  const unplannedMins = parseInt(unplanned.total_minutes || '0', 10);
  const totalMins = plannedMins + unplannedMins;

  return {
    planned: {
      event_count: parseInt(planned.event_count || '0', 10),
      total_minutes: plannedMins,
      avg_repair_minutes: parseFloat(planned.avg_repair_minutes || '0'),
      percentage_of_downtime: totalMins > 0 ? Math.round((plannedMins / totalMins) * 1000) / 10 : 0,
    },
    unplanned: {
      event_count: parseInt(unplanned.event_count || '0', 10),
      total_minutes: unplannedMins,
      avg_repair_minutes: parseFloat(unplanned.avg_repair_minutes || '0'),
      percentage_of_downtime: totalMins > 0 ? Math.round((unplannedMins / totalMins) * 1000) / 10 : 0,
    },
    total_downtime_minutes: totalMins,
  };
}

// ---------------------------------------------------------------------------
// 16. SLA & Response Performance (GET /api/v1/downtime/sla)
// ---------------------------------------------------------------------------
export async function getSlaPerformanceService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any> {
  const { query } = getDowntimeServiceDb();
  const { whereClause, params } = buildScopeAndFilters(filters, user, { wo: 'wo', m: 'm', s: 's', mr: 'mr' });

  const slaSql = `
    SELECT 
      COUNT(wo.id) as total_work_orders_tracked,
      ROUND(COALESCE(AVG(wo.maintenance_response_minutes), 0), 2) as avg_response_minutes,
      ROUND(COALESCE(AVG(wo.active_repair_minutes), 0), 2) as avg_repair_minutes,
      COUNT(CASE WHEN wo.sla_deadline IS NOT NULL AND wo.repair_completed_time IS NOT NULL AND wo.repair_completed_time <= wo.sla_deadline THEN 1 END) as on_time_resolutions,
      COUNT(CASE WHEN wo.sla_deadline IS NOT NULL AND wo.repair_completed_time IS NOT NULL AND wo.repair_completed_time > wo.sla_deadline THEN 1 END) as breached_resolutions
    FROM work_orders wo
    JOIN machines m ON wo.machine_id = m.id
    JOIN shops s ON m.shop_id = s.id
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    WHERE ${whereClause} AND wo.status = 'verified_closed'
  `;

  const res = await query(slaSql, params);
  const row = res.rows[0] || {};

  const onTime = parseInt(row.on_time_resolutions || '0', 10);
  const breached = parseInt(row.breached_resolutions || '0', 10);
  const totalTracked = onTime + breached;
  const complianceRate = totalTracked > 0 ? Math.round((onTime / totalTracked) * 1000) / 10 : 100.0;

  return {
    summary: {
      total_work_orders_tracked: parseInt(row.total_work_orders_tracked || '0', 10),
      avg_response_minutes: parseFloat(row.avg_response_minutes || '0'),
      avg_repair_minutes: parseFloat(row.avg_repair_minutes || '0'),
      on_time_resolutions: onTime,
      breached_resolutions: breached,
      sla_compliance_rate_percent: complianceRate,
      breach_rate_percent: totalTracked > 0 ? Math.round((breached / totalTracked) * 1000) / 10 : 0.0,
    },
  };
}

// ---------------------------------------------------------------------------
// 17. Current Downtime & Ongoing Incident Monitoring (GET /api/v1/downtime/current)
// ---------------------------------------------------------------------------
export async function getCurrentDowntimeService(
  filters: DowntimeFilterParams,
  user: AuthenticatedUser
): Promise<any[]> {
  const { query } = getDowntimeServiceDb();

  // Active machines condition
  let scopeCondition = '1=1';
  const params: any[] = [];

  if (user.role !== 'admin' && user.plant_id) {
    params.push(user.plant_id);
    scopeCondition += ` AND s.plant_id = $${params.length}`;
  }
  if (user.role !== 'admin' && user.shop_id) {
    params.push(user.shop_id);
    scopeCondition += ` AND m.shop_id = $${params.length}`;
  }

  if (filters.shop_id) {
    params.push(filters.shop_id);
    scopeCondition += ` AND m.shop_id = $${params.length}`;
  }
  if (filters.machine_id) {
    params.push(filters.machine_id);
    scopeCondition += ` AND m.id = $${params.length}`;
  }

  const currentSql = `
    SELECT 
      m.id as machine_id,
      m.machine_code,
      m.name as machine_name,
      m.status as machine_status,
      m.criticality,
      m.bay_line_location,
      s.id as shop_id,
      s.shop_name,
      p.id as plant_id,
      p.plant_name as plant_name,
      wo.id as active_work_order_id,
      wo.wo_number,
      wo.status as work_order_status,
      wo.priority,
      wo.classification,
      wo.sla_deadline,
      mr.id as complaint_id,
      mr.complaint_number,
      mr.issue_category,
      mr.problem_title,
      COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.reported_time, wo.created_at) as breakdown_start_time,
      ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(wo.breakdown_time, mr.breakdown_occurred_at, wo.reported_time, wo.created_at))) / 60) as elapsed_downtime_minutes,
      u.full_name as assigned_technician_name,
      wo.updated_at as last_lifecycle_update
    FROM machines m
    JOIN shops s ON m.shop_id = s.id
    JOIN plants p ON s.plant_id = p.id
    LEFT JOIN work_orders wo ON m.id = wo.machine_id AND wo.status NOT IN ('verified_closed', 'completed')
    LEFT JOIN maintenance_requests mr ON wo.complaint_id = mr.id
    LEFT JOIN users u ON wo.assigned_technician_id = u.id
    WHERE m.status IN ('breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification')
      AND ${scopeCondition}
    ORDER BY elapsed_downtime_minutes DESC
  `;

  const res = await query(currentSql, params);

  return res.rows.map((row: any) => ({
    machine_id: row.machine_id,
    machine_code: row.machine_code,
    machine_name: row.machine_name,
    machine_status: row.machine_status,
    criticality: row.criticality,
    location: row.bay_line_location,
    shop: { id: row.shop_id, name: row.shop_name },
    plant: { id: row.plant_id, name: row.plant_name },
    active_work_order: row.wo_number ? {
      id: row.active_work_order_id,
      wo_number: row.wo_number,
      status: row.work_order_status,
      priority: row.priority,
      sla_deadline: row.sla_deadline,
      assigned_technician: row.assigned_technician_name,
    } : null,
    incident: row.complaint_number ? {
      complaint_number: row.complaint_number,
      category: row.issue_category,
      title: row.problem_title,
    } : null,
    breakdown_start_time: row.breakdown_start_time,
    elapsed_downtime_minutes: Math.max(0, parseInt(row.elapsed_downtime_minutes || '0', 10)),
    last_update: row.last_lifecycle_update,
    data_quality_flags: {
      has_active_work_order: Boolean(row.wo_number),
      has_linked_complaint: Boolean(row.complaint_number),
      has_assigned_technician: Boolean(row.assigned_technician_name),
    },
  }));
}
