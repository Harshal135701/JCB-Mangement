import apiClient from '../../../api/client';

export function parseStartOfDay(dateStr?: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0).getTime();
  }
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function parseEndOfDay(dateStr?: string): number {
  if (!dateStr) return Infinity;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 23, 59, 59, 999).getTime();
  }
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function getItemTimestamp(item: any): number {
  if (!item) return 0;
  const ds = item.created_at || item.reported_at || item.breakdown_occurred_at || item.reported_time;
  if (!ds) return 0;
  const t = new Date(ds).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Validates and normalizes pagination parameters for API requests.
 * Ensures page is a positive integer >= 1 (defaults to 1).
 * Ensures limit is an integer between 1 and 100 (defaults to 100 or specified default, clamped to 1..100).
 */
export function normalizePaginationParams(
  params?: Record<string, any>,
  defaultLimit: number = 100
): Record<string, any> {
  const clean: Record<string, any> = { ...(params || {}) };

  // 1. Normalize page: must be a positive integer >= 1
  const rawPage = clean.page;
  const parsedPage = parseInt(String(rawPage ?? 1), 10);
  clean.page = !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  // 2. Normalize limit: must strictly be an integer between 1 and 100
  const rawLimit = clean.limit;
  const parsedLimit = parseInt(String(rawLimit ?? defaultLimit), 10);
  const clampedLimit = !isNaN(parsedLimit)
    ? Math.max(1, Math.min(100, parsedLimit))
    : Math.max(1, Math.min(100, defaultLimit));
  clean.limit = clampedLimit;

  return clean;
}

/**
 * Safely fetches paginated report items while strictly respecting the
 * backend contract of page >= 1 and 1 <= limit <= 100 per request.
 * Fetches up to maxPages (default: 5 pages = up to 500 records) to aggregate full reports.
 */
export async function fetchPaginatedReportItems<T = any>(
  url: string,
  params: Record<string, any> = {},
  maxPages: number = 5
): Promise<T[]> {
  try {
    const normalized = normalizePaginationParams(params, 100);
    const firstRes = await apiClient.get(url, { params: normalized });
    const firstPageItems: T[] = firstRes.data?.data || [];
    const totalPages = Number(firstRes.data?.pagination?.totalPages) || 1;

    if (totalPages <= 1 || maxPages <= 1) {
      return firstPageItems;
    }

    const pagesToFetch: number[] = [];
    const targetPages = Math.min(totalPages, maxPages);
    for (let p = 2; p <= targetPages; p++) {
      pagesToFetch.push(p);
    }

    const nextResponses = await Promise.all(
      pagesToFetch.map((p) =>
        apiClient
          .get(url, { params: { ...normalized, page: p } })
          .catch((err) => {
            console.warn(`[Reports] Failed to fetch page ${p} for ${url}:`, err);
            return { data: { data: [] } };
          })
      )
    );

    const aggregated = [...firstPageItems];
    for (const r of nextResponses) {
      const pageData: T[] = r.data?.data || [];
      aggregated.push(...pageData);
    }
    return aggregated;
  } catch (err: any) {
    console.error(`[Reports] Error fetching paginated data from ${url}:`, err);
    return [];
  }
}

export interface UserSummary {
  id: string;
  employee_code?: string;
  full_name: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  shift?: string;
  plant_id?: string;
  shop_id?: string;
  is_active: boolean;
}

export interface WorkOrderReportItem {
  id: string;
  wo_number: string;
  machine_code?: string;
  machine_name?: string;
  status: string;
  priority: string;
  problem_title?: string;
  diagnosis?: string;
  root_cause_analysis?: string;
  corrective_action?: string;
  actual_downtime_minutes?: number;
  created_at: string;
  completion_time?: string;
  is_rework?: boolean;
}

export interface InspectionReportItem {
  id: string;
  machine_code?: string;
  machine_name?: string;
  shop_name?: string;
  operator_id?: string;
  operator_name?: string;
  shift?: string;
  overall_status: string;
  created_at: string;
  responses_json?: any[];
  notes?: string;
}

export interface BreakdownReportItem {
  id: string;
  ticket_number?: string;
  machine_code?: string;
  machine_name?: string;
  problem_title?: string;
  issue_category?: string;
  priority: string;
  status: string;
  assignment_status?: string;
  created_at: string;
  reporter_id?: string;
  assigned_technician_id?: string;
}

export interface InventoryTransactionItem {
  id: string;
  transaction_type: string;
  part_name?: string;
  part_sku?: string;
  quantity: number;
  performed_by_name?: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface LowStockAlertItem {
  part_id: string;
  part_name: string;
  part_sku: string;
  current_quantity: number;
  min_quantity: number;
  location?: string;
}

export interface AuditReportItem {
  id: string;
  action: string;
  entity_name: string;
  entity_id?: string;
  performed_by?: string;
  created_at: string;
}

export interface MachineSummary {
  id: string;
  machine_code: string;
  name: string;
  category: string;
  oem_manufacturer: string;
  model_number?: string | null;
  serial_number?: string | null;
  bay_line_location?: string | null;
  criticality: string;
  status: string;
  operating_hours: number | string;
  maintenance_frequency_days?: number | string;
  qr_code_uid: string;
  created_at?: string;
  shop_name?: string | null;
  plant_name?: string | null;
  bay_name?: string | null;
  line_name?: string | null;
}

export interface MachineReportData {
  machine: any;
  operator: any;
  personnel: any;
  activeIssues: {
    breakdown?: any;
    workOrder?: any;
    hasActiveStoppage: boolean;
  };
  pmPlans: any[];
  workOrders: any[];
  breakdowns: any[];
  partsConsumed: any[];
  stats: {
    totalBreakdowns: number;
    totalWorkOrders: number;
    completedWorkOrders: number;
    activeWorkOrders: number;
    totalInspections: number;
    totalPmPlans: number;
    totalPartsConsumed: number;
    totalDowntimeMinutes: number;
    totalDowntimeHours: number;
    avgMTTRMinutes: number;
    operatingHours: number;
    availabilityPercent: number;
  };
}

/**
 * Fetch available machines list for report selection
 */
export async function fetchMachines(search?: string, plantId?: string): Promise<MachineSummary[]> {
  try {
    const params: Record<string, any> = normalizePaginationParams({ limit: 100, page: 1 });
    if (search && search.trim()) {
      params.search = search.trim();
    }
    if (plantId) {
      params.plant_id = plantId;
    }
    const res = await apiClient.get('/machines', { params });
    return res.data?.data || [];
  } catch (err) {
    console.error('Error fetching machines for report:', err);
    return [];
  }
}

/**
 * Fetch Machine Summary Report Data
 */
export async function fetchMachineReportData(
  machineId: string,
  startDate?: string,
  endDate?: string
): Promise<MachineReportData> {
  try {
    const params: Record<string, any> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const res = await apiClient.get(`/reports/machine-summary/${machineId}`, { params });
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Failed to fetch machine summary report data');
  } catch (err) {
    console.error('Error fetching machine report data:', err);
    throw err;
  }
}

/**
 * Fetch users by role (technician, operator, manager, store_manager)
 */
export async function fetchUsersByRole(role: string, search?: string, plantId?: string): Promise<UserSummary[]> {
  try {
    const params: Record<string, any> = normalizePaginationParams({ role, limit: 100, page: 1 });
    if (search && search.trim()) {
      params.search = search.trim();
    }
    if (plantId) {
      params.plant_id = plantId;
    }
    const res = await apiClient.get('/auth/users', { params });
    return res.data?.data || [];
  } catch (err) {
    console.error(`Error fetching users for role ${role}:`, err);
    return [];
  }
}

/**
 * Fetch Technician Report Data (Work Orders, Repair Metrics, Breakdowns)
 */
export async function fetchTechnicianReportData(
  technicianId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const bdParams: Record<string, any> = {
      assigned_technician_id: technicianId,
      limit: 100,
      page: 1,
    };
    if (startDate) bdParams.start_date = startDate;
    if (endDate) bdParams.end_date = endDate;

    const [workOrdersRaw, breakdownsRaw] = await Promise.all([
      fetchPaginatedReportItems<WorkOrderReportItem>('/work-orders', {
        technician_id: technicianId,
        limit: 100,
        page: 1,
      }),
      fetchPaginatedReportItems<BreakdownReportItem>('/breakdowns', bdParams),
    ]);

    let workOrders: WorkOrderReportItem[] = workOrdersRaw || [];
    let breakdowns: BreakdownReportItem[] = breakdownsRaw || [];

    // Apply robust date range filters if present
    if (startDate || endDate) {
      const startMs = parseStartOfDay(startDate);
      const endMs = parseEndOfDay(endDate);

      workOrders = workOrders.filter((w) => {
        const t = getItemTimestamp(w);
        return t >= startMs && t <= endMs;
      });
      breakdowns = breakdowns.filter((b) => {
        const t = getItemTimestamp(b);
        return t >= startMs && t <= endMs;
      });
    }

    // Compute KPI metrics
    const totalAssigned = workOrders.length;
    const acceptedOrInProgress = workOrders.filter((w) =>
      ['ACCEPTED', 'IN_PROGRESS', 'DIAGNOSED', 'PARTS_REQUESTED'].includes(
        w.status?.toUpperCase()
      )
    ).length;
    const waitingForParts = workOrders.filter(
      (w) => w.status?.toUpperCase() === 'PARTS_REQUESTED' || w.status?.toUpperCase() === 'WAITING_FOR_PARTS'
    ).length;
    const awaitingVerification = workOrders.filter(
      (w) => w.status?.toUpperCase() === 'PENDING_VERIFICATION'
    ).length;
    const verifiedAndClosed = workOrders.filter(
      (w) => ['VERIFIED', 'CLOSED', 'COMPLETED'].includes(w.status?.toUpperCase())
    ).length;
    const reworkCount = workOrders.filter(
      (w) => w.is_rework === true || w.status?.toUpperCase() === 'REWORK'
    ).length;
    const totalDowntime = workOrders.reduce(
      (acc, w) => acc + (Number(w.actual_downtime_minutes) || 0),
      0
    );

    return {
      workOrders,
      breakdowns,
      stats: {
        totalAssigned,
        acceptedOrInProgress,
        waitingForParts,
        awaitingVerification,
        verifiedAndClosed,
        reworkCount,
        totalDowntimeMinutes: totalDowntime,
        totalDowntimeHours: (totalDowntime / 60).toFixed(1),
        complaintsHandled: breakdowns.length,
      },
    };
  } catch (err) {
    console.error('Error fetching technician report data:', err);
    throw err;
  }
}

/**
 * Fetch Operator Report Data (Inspections, Sensor Readings, Reported Breakdowns)
 */
export async function fetchOperatorReportData(
  operatorId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const bdParams: Record<string, any> = { limit: 100, page: 1 };
    if (startDate) bdParams.start_date = startDate;
    if (endDate) bdParams.end_date = endDate;

    const [inspectionsRaw, breakdownsRaw] = await Promise.all([
      fetchPaginatedReportItems<InspectionReportItem>('/inspections/records', { limit: 100, page: 1 }),
      fetchPaginatedReportItems<BreakdownReportItem>('/breakdowns', bdParams),
    ]);

    let inspections: InspectionReportItem[] = inspectionsRaw || [];
    let breakdowns: BreakdownReportItem[] = breakdownsRaw || [];

    // Filter strictly to this operator's inspections
    if (operatorId) {
      inspections = inspections.filter(
        (i) => i.operator_id === operatorId || (!i.operator_id && inspections.length <= 1)
      );
      breakdowns = breakdowns.filter((b) => b.reporter_id === operatorId);
    }

    // Apply robust date range filters if present
    if (startDate || endDate) {
      const startMs = parseStartOfDay(startDate);
      const endMs = parseEndOfDay(endDate);

      inspections = inspections.filter((i) => {
        const t = getItemTimestamp(i);
        return t >= startMs && t <= endMs;
      });
      breakdowns = breakdowns.filter((b) => {
        const t = getItemTimestamp(b);
        return t >= startMs && t <= endMs;
      });
    }

    const totalInspections = inspections.length;
    const passed = inspections.filter((i) =>
      ['PASS', 'PASSED'].includes(i.overall_status?.toUpperCase())
    ).length;
    const failed = inspections.filter((i) =>
      ['FAIL', 'FAILED', 'REJECTED'].includes(i.overall_status?.toUpperCase())
    ).length;
    const requiringAttention = inspections.filter((i) =>
      ['WARNING', 'ATTENTION', 'FLAGGED'].includes(i.overall_status?.toUpperCase())
    ).length;

    // Track unique machines
    const machineSet = new Set<string>();
    inspections.forEach((i) => {
      if (i.machine_code) machineSet.add(i.machine_code);
    });

    return {
      inspections,
      breakdowns,
      stats: {
        totalInspections,
        passed,
        failed,
        requiringAttention,
        breakdownsReported: breakdowns.length,
        machinesOperatedCount: machineSet.size,
        machineList: Array.from(machineSet).join(', ') || 'N/A',
      },
    };
  } catch (err) {
    console.error('Error fetching operator report data:', err);
    throw err;
  }
}

/**
 * Fetch Manager Report Data (Triage Complaints, Work Orders Assigned & Verified)
 */
export async function fetchManagerReportData(
  managerId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const bdParams: Record<string, any> = { limit: 100, page: 1 };
    if (startDate) bdParams.start_date = startDate;
    if (endDate) bdParams.end_date = endDate;

    const [breakdownsRaw, workOrdersRaw] = await Promise.all([
      fetchPaginatedReportItems<BreakdownReportItem>('/breakdowns', bdParams),
      fetchPaginatedReportItems<WorkOrderReportItem>('/work-orders', { limit: 100, page: 1 }),
    ]);

    let breakdowns: BreakdownReportItem[] = breakdownsRaw || [];
    let workOrders: WorkOrderReportItem[] = workOrdersRaw || [];

    if (startDate || endDate) {
      const startMs = parseStartOfDay(startDate);
      const endMs = parseEndOfDay(endDate);

      breakdowns = breakdowns.filter((b) => {
        const t = getItemTimestamp(b);
        return t >= startMs && t <= endMs;
      });
      workOrders = workOrders.filter((w) => {
        const t = getItemTimestamp(w);
        return t >= startMs && t <= endMs;
      });
    }

    const totalComplaintsReceived = breakdowns.length;
    const complaintsAcknowledged = breakdowns.filter(
      (b) => b.status?.toUpperCase() === 'ACKNOWLEDGED'
    ).length;
    const complaintsRejected = breakdowns.filter(
      (b) => b.status?.toUpperCase() === 'REJECTED'
    ).length;
    const complaintsConverted = breakdowns.filter((b) =>
      ['CONVERTED', 'IN_PROGRESS', 'CLOSED', 'ASSIGNED'].includes(b.status?.toUpperCase())
    ).length;

    const workOrdersAssigned = workOrders.length;
    const workOrdersActive = workOrders.filter((w) =>
      ['ACCEPTED', 'IN_PROGRESS', 'DIAGNOSED', 'PARTS_REQUESTED'].includes(
        w.status?.toUpperCase()
      )
    ).length;
    const awaitingVerification = workOrders.filter(
      (w) => w.status?.toUpperCase() === 'PENDING_VERIFICATION'
    ).length;
    const verifiedAndClosed = workOrders.filter((w) =>
      ['VERIFIED', 'CLOSED', 'COMPLETED'].includes(w.status?.toUpperCase())
    ).length;
    const reworkCases = workOrders.filter(
      (w) => w.is_rework === true || w.status?.toUpperCase() === 'REWORK'
    ).length;

    return {
      breakdowns,
      workOrders,
      stats: {
        totalComplaintsReceived,
        complaintsAcknowledged,
        complaintsRejected,
        complaintsConverted,
        workOrdersAssigned,
        workOrdersActive,
        awaitingVerification,
        verifiedAndClosed,
        reworkCases,
      },
    };
  } catch (err) {
    console.error('Error fetching manager report data:', err);
    throw err;
  }
}

/**
 * Fetch Store Manager Report Data (Dashboard, Inventory Transactions, Low Stock Alerts, PRs)
 */
export async function fetchStoreManagerReportData(
  storeManagerId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const [dashRes, transactionsRaw, alertRes, purchaseRequestsRaw] = await Promise.all([
      apiClient.get('/inventory/dashboard').catch(() => ({ data: { data: {} } })),
      fetchPaginatedReportItems<InventoryTransactionItem>('/inventory/transactions', { limit: 100, page: 1 }),
      apiClient.get('/inventory/alerts/low-stock').catch(() => ({ data: { data: [] } })),
      fetchPaginatedReportItems('/procurement/pr', { limit: 100, page: 1 }),
    ]);

    const dashboard = dashRes.data?.data || {};
    let transactions: InventoryTransactionItem[] = transactionsRaw || [];
    let lowStockAlerts: LowStockAlertItem[] = alertRes.data?.data || [];
    let purchaseRequests: any[] = purchaseRequestsRaw || [];

    if (startDate || endDate) {
      const startMs = parseStartOfDay(startDate);
      const endMs = parseEndOfDay(endDate);

      transactions = transactions.filter((t) => {
        const time = getItemTimestamp(t);
        return time >= startMs && time <= endMs;
      });
      purchaseRequests = purchaseRequests.filter((p) => {
        const time = getItemTimestamp(p);
        return time >= startMs && time <= endMs;
      });
    }

    return {
      dashboard,
      transactions,
      lowStockAlerts,
      purchaseRequests,
      stats: {
        totalInventoryValuation:
          dashboard.total_valuation || dashboard.totalValuation || '₹ 0.00',
        totalItemsCount: dashboard.total_items || dashboard.totalItems || 0,
        lowStockCount: lowStockAlerts.length,
        transactionsCount: transactions.length,
        prsCount: purchaseRequests.length,
      },
    };
  } catch (err) {
    console.error('Error fetching store manager report data:', err);
    throw err;
  }
}

/**
 * Fetch Admin Report Data (KPIs, Audit Logs, Personnel Overview)
 */
export async function fetchAdminReportData(
  adminId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const kpiParams: Record<string, any> = {};
    if (startDate) kpiParams.start_date = startDate;
    if (endDate) kpiParams.end_date = endDate;

    const bdParams: Record<string, any> = { limit: 100, page: 1 };
    if (startDate) bdParams.start_date = startDate;
    if (endDate) bdParams.end_date = endDate;

    const [kpiRes, auditLogsRaw, usersRaw, workOrdersRaw, breakdownsRaw] = await Promise.all([
      apiClient.get('/reports/dashboard-kpis', { params: kpiParams }).catch(() => ({ data: { data: {} } })),
      fetchPaginatedReportItems<AuditReportItem>('/audit', { limit: 100, page: 1 }),
      fetchPaginatedReportItems<UserSummary>('/auth/users', { limit: 100, page: 1 }),
      fetchPaginatedReportItems('/work-orders', { limit: 100, page: 1 }),
      fetchPaginatedReportItems('/breakdowns', bdParams),
    ]);

    const kpis = kpiRes.data?.data || {};
    let auditLogs: AuditReportItem[] = auditLogsRaw || [];
    const users: UserSummary[] = usersRaw || [];
    let workOrders: any[] = workOrdersRaw || [];
    let breakdowns: any[] = breakdownsRaw || [];

    if (startDate || endDate) {
      const startMs = parseStartOfDay(startDate);
      const endMs = parseEndOfDay(endDate);

      auditLogs = auditLogs.filter((a) => {
        const time = getItemTimestamp(a);
        return time >= startMs && time <= endMs;
      });

      workOrders = workOrders.filter((w) => {
        const time = getItemTimestamp(w);
        return time >= startMs && time <= endMs;
      });

      breakdowns = breakdowns.filter((b) => {
        const time = getItemTimestamp(b);
        return time >= startMs && time <= endMs;
      });
    }

    // When date range is specified, compute counts directly from the date-filtered records
    const hasDateFilter = Boolean(startDate || endDate);
    const activeWorkOrders = hasDateFilter
      ? workOrders.filter((w) => ['ACCEPTED', 'IN_PROGRESS', 'DIAGNOSED', 'PARTS_REQUESTED'].includes(w.status?.toUpperCase())).length
      : (kpis.active_work_orders || kpis.activeWorkOrders || workOrders.filter((w) => ['ACCEPTED', 'IN_PROGRESS', 'DIAGNOSED', 'PARTS_REQUESTED'].includes(w.status?.toUpperCase())).length);

    const completedWorkOrders = hasDateFilter
      ? workOrders.filter((w) => ['VERIFIED', 'CLOSED', 'COMPLETED'].includes(w.status?.toUpperCase())).length
      : (kpis.completed_work_orders || kpis.completedWorkOrders || workOrders.filter((w) => ['VERIFIED', 'CLOSED', 'COMPLETED'].includes(w.status?.toUpperCase())).length);

    const pendingBreakdowns = hasDateFilter
      ? breakdowns.filter((b) => ['PENDING', 'NEW', 'REPORTED', 'OPEN', 'ACKNOWLEDGED'].includes(b.status?.toUpperCase())).length
      : (kpis.pending_breakdowns || kpis.pendingBreakdowns || breakdowns.filter((b) => ['PENDING', 'NEW', 'REPORTED', 'OPEN', 'ACKNOWLEDGED'].includes(b.status?.toUpperCase())).length);

    return {
      kpis,
      auditLogs,
      users,
      workOrders,
      breakdowns,
      stats: {
        totalUsers: users.length,
        totalAuditLogs: auditLogs.length,
        activeWorkOrders,
        pendingBreakdowns,
        completedWorkOrders,
        totalMachines: kpis.total_machines || kpis.totalMachines || 0,
      },
    };
  } catch (err) {
    console.error('Error fetching admin report data:', err);
    throw err;
  }
}
