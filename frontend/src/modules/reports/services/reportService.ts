import apiClient from '../../../api/client';

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
    const params: Record<string, any> = { limit: 100 };
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
    const params: Record<string, any> = { role, limit: 100 };
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
    const [woRes, bdRes] = await Promise.all([
      apiClient.get('/work-orders', {
        params: {
          technician_id: technicianId,
          limit: 100,
        },
      }),
      apiClient.get('/breakdowns', {
        params: {
          assigned_technician_id: technicianId,
          limit: 100,
        },
      }),
    ]);

    let workOrders: WorkOrderReportItem[] = woRes.data?.data || [];
    let breakdowns: BreakdownReportItem[] = bdRes.data?.data || [];

    // Apply date range filters if present
    if (startDate) {
      const start = new Date(startDate).getTime();
      workOrders = workOrders.filter((w) => new Date(w.created_at).getTime() >= start);
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      workOrders = workOrders.filter((w) => new Date(w.created_at).getTime() <= end);
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() <= end);
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
    const [inspRes, bdRes] = await Promise.all([
      apiClient.get('/inspections/records', {
        params: { limit: 100 },
      }),
      apiClient.get('/breakdowns', {
        params: { limit: 100 },
      }),
    ]);

    let inspections: InspectionReportItem[] = inspRes.data?.data || [];
    let breakdowns: BreakdownReportItem[] = bdRes.data?.data || [];

    // Filter strictly to this operator's inspections
    if (operatorId) {
      inspections = inspections.filter(
        (i) => i.operator_id === operatorId || (!i.operator_id && inspections.length <= 1)
      );
      breakdowns = breakdowns.filter((b) => b.reporter_id === operatorId);
    }

    // Apply date range filters if present
    if (startDate) {
      const start = new Date(startDate).getTime();
      inspections = inspections.filter((i) => new Date(i.created_at).getTime() >= start);
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      inspections = inspections.filter((i) => new Date(i.created_at).getTime() <= end);
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() <= end);
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
    const [bdRes, woRes] = await Promise.all([
      apiClient.get('/breakdowns', { params: { limit: 100 } }),
      apiClient.get('/work-orders', { params: { limit: 100 } }),
    ]);

    let breakdowns: BreakdownReportItem[] = bdRes.data?.data || [];
    let workOrders: WorkOrderReportItem[] = woRes.data?.data || [];

    if (startDate) {
      const start = new Date(startDate).getTime();
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() >= start);
      workOrders = workOrders.filter((w) => new Date(w.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      breakdowns = breakdowns.filter((b) => new Date(b.created_at).getTime() <= end);
      workOrders = workOrders.filter((w) => new Date(w.created_at).getTime() <= end);
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
    const [dashRes, txRes, alertRes, prRes] = await Promise.all([
      apiClient.get('/inventory/dashboard').catch(() => ({ data: { data: {} } })),
      apiClient.get('/inventory/transactions', { params: { limit: 100 } }).catch(() => ({
        data: { data: [] },
      })),
      apiClient.get('/inventory/alerts/low-stock').catch(() => ({ data: { data: [] } })),
      apiClient.get('/procurement/pr', { params: { limit: 100 } }).catch(() => ({
        data: { data: [] },
      })),
    ]);

    const dashboard = dashRes.data?.data || {};
    let transactions: InventoryTransactionItem[] = txRes.data?.data || [];
    let lowStockAlerts: LowStockAlertItem[] = alertRes.data?.data || [];
    let purchaseRequests: any[] = prRes.data?.data || [];

    if (startDate) {
      const start = new Date(startDate).getTime();
      transactions = transactions.filter((t) => new Date(t.created_at).getTime() >= start);
      purchaseRequests = purchaseRequests.filter((p) => new Date(p.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      transactions = transactions.filter((t) => new Date(t.created_at).getTime() <= end);
      purchaseRequests = purchaseRequests.filter((p) => new Date(p.created_at).getTime() <= end);
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
    const [kpiRes, auditRes, usersRes] = await Promise.all([
      apiClient.get('/reports/dashboard-kpis').catch(() => ({ data: { data: {} } })),
      apiClient.get('/audit', { params: { limit: 100 } }).catch(() => ({
        data: { data: [] },
      })),
      apiClient.get('/auth/users', { params: { limit: 100 } }).catch(() => ({
        data: { data: [] },
      })),
    ]);

    const kpis = kpiRes.data?.data || {};
    let auditLogs: AuditReportItem[] = auditRes.data?.data || [];
    const users: UserSummary[] = usersRes.data?.data || [];

    if (startDate) {
      const start = new Date(startDate).getTime();
      auditLogs = auditLogs.filter((a) => new Date(a.created_at).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).setHours(23, 59, 59, 999);
      auditLogs = auditLogs.filter((a) => new Date(a.created_at).getTime() <= end);
    }

    return {
      kpis,
      auditLogs,
      users,
      stats: {
        totalUsers: users.length,
        totalAuditLogs: auditLogs.length,
        activeWorkOrders: kpis.active_work_orders || kpis.activeWorkOrders || 0,
        pendingBreakdowns: kpis.pending_breakdowns || kpis.pendingBreakdowns || 0,
        completedWorkOrders: kpis.completed_work_orders || kpis.completedWorkOrders || 0,
        totalMachines: kpis.total_machines || kpis.totalMachines || 0,
      },
    };
  } catch (err) {
    console.error('Error fetching admin report data:', err);
    throw err;
  }
}
