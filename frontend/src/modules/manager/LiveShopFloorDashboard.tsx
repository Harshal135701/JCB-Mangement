import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Cpu,
  Activity,
  AlertOctagon,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Reusable Dashboard Components (Matching Admin Dashboard)
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut, DonutSegment } from '../../components/dashboard/MachineStatusDonut';
import { WorkOrderStatusDonut } from '../../components/dashboard/WorkOrderStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';

// Expanded Manager Operational Analytics Components
import { ManagerOperationalSummaryStrip } from './components/ManagerOperationalSummaryStrip';
import { ManagerFleetDistributionChart } from './components/ManagerFleetDistributionChart';
import { ManagerPMPerformanceCard } from './components/ManagerPMPerformanceCard';
import { ManagerTechnicianPerformanceCard, TechnicianWorkloadItem } from './components/ManagerTechnicianPerformanceCard';

export const LiveShopFloorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Live Data States
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [pmData, setPmData] = useState<any>(null);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scoped internally to the logged-in manager's authorized plant facility
  const managerPlantId = useMemo(() => {
    return user?.plantId || (user as any)?.plant_id || undefined;
  }, [user]);

  // Fetch all operational data in parallel using real backend APIs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = managerPlantId ? { plant_id: managerPlantId } : {};

      const [
        kpiRes,
        trendRes,
        machinesRes,
        workOrdersRes,
        breakdownsRes,
        usersRes,
        pmRes,
        orgRes,
      ] = await Promise.all([
        // 1. Core KPIs and telemetry (scoped to manager's plant internally)
        apiClient.get('/reports/dashboard-kpis', {
          params: { ...params, timeframe: 'Last 30 Days' },
        }),
        // 2. Maintenance trend history (breakdowns vs preventive maintenance over time)
        apiClient
          .get('/reports/maintenance-trend', { params })
          .catch(() => ({ data: { data: [] } })),
        // 3. Machines roster for plant status and shop distribution
        apiClient
          .get('/machines', { params: { limit: 100, ...params } })
          .catch(() => ({ data: { data: [] } })),
        // 4. Work orders for active, overdue and technician workload tracking
        apiClient
          .get('/work-orders', { params: { limit: 100, ...params } })
          .catch(() => ({ data: { data: [] } })),
        // 5. Breakdown complaints for incident tracking
        apiClient
          .get('/breakdowns', { params: { limit: 100, ...params } })
          .catch(() => ({ data: { data: [] } })),
        // 6. Personnel directory for technician roster
        apiClient
          .get('/auth/users', { params: { limit: 100, ...params } })
          .catch(() => ({ data: { data: [] } })),
        // 7. PM Dashboard for preventive maintenance compliance
        apiClient
          .get('/pm/dashboard', { params })
          .catch(() => ({ data: { data: null } })),
        // 8. Hierarchy for shop structure
        apiClient.get('/org/hierarchy').catch(() => ({ data: { data: null } })),
      ]);

      if (kpiRes.data?.data) setKpiStats(kpiRes.data.data);
      if (trendRes.data?.data) setTrendData(trendRes.data.data);
      if (machinesRes.data?.data) setMachines(machinesRes.data.data);
      if (workOrdersRes.data?.data) setWorkOrders(workOrdersRes.data.data);
      if (breakdownsRes.data?.data) setBreakdowns(breakdownsRes.data.data);
      if (usersRes.data?.data) setStaffUsers(usersRes.data.data);
      if (pmRes.data?.data) setPmData(pmRes.data.data);
      if (orgRes.data?.data) setHierarchy(orgRes.data.data);
    } catch (err: any) {
      console.error('Failed to load manager dashboard telemetry:', err);
      setError(
        err.response?.data?.message ||
          'Unable to retrieve operational metrics from the database.'
      );
    } finally {
      setLoading(false);
    }
  }, [managerPlantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Socket.IO auto-refresh for live shop floor operations
  useEffect(() => {
    if (!socket) return;

    const handleRefresh = () => {
      fetchData();
    };

    socket.on('complaint:critical', handleRefresh);
    socket.on('complaint:created', handleRefresh);
    socket.on('work_order:accepted', handleRefresh);
    socket.on('work_order:closed', handleRefresh);
    socket.on('pm:updated', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('complaint:critical', handleRefresh);
      socket.off('complaint:created', handleRefresh);
      socket.off('work_order:accepted', handleRefresh);
      socket.off('work_order:closed', handleRefresh);
      socket.off('pm:updated', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, fetchData]);

  // 1. Machine Performance Metrics
  const totalMachines = kpiStats?.total_machines ?? machines.length ?? 0;
  const runningMachines = kpiStats?.running_machines ?? 0;
  const idleMachines = kpiStats?.idle_machines ?? 0;
  const breakdownMachines = kpiStats?.breakdown_machines ?? 0;
  const maintenanceMachines = kpiStats?.maintenance_machines ?? 0;
  const machinesDown = breakdownMachines + maintenanceMachines;

  const machineAvailabilityPercent =
    kpiStats?.machine_availability_percent ??
    (totalMachines > 0
      ? parseFloat((((runningMachines + idleMachines) / totalMachines) * 100).toFixed(1))
      : 0);

  // Machine status segments for Donut chart
  const machineStatusSegments: DonutSegment[] = useMemo(() => {
    if (totalMachines === 0) return [];
    return [
      {
        label: 'Running',
        count: runningMachines,
        percentage: (runningMachines / totalMachines) * 100,
        color: '#10B981', // Emerald
      },
      {
        label: 'Available / Idle',
        count: idleMachines,
        percentage: (idleMachines / totalMachines) * 100,
        color: '#64748B', // Slate
      },
      {
        label: 'In Breakdown',
        count: breakdownMachines,
        percentage: (breakdownMachines / totalMachines) * 100,
        color: '#EF4444', // Red
      },
      {
        label: 'Under Maintenance',
        count: maintenanceMachines,
        percentage: (maintenanceMachines / totalMachines) * 100,
        color: '#F59E0B', // Amber
      },
    ];
  }, [totalMachines, runningMachines, idleMachines, breakdownMachines, maintenanceMachines]);

  // 2. Maintenance Performance Metrics
  const totalWorkOrders =
    kpiStats?.total_work_orders ?? workOrders.length ?? 0;
  const activeWorkOrders = kpiStats?.active_work_orders ?? 0;
  const openWorkOrders = kpiStats?.open_work_orders ?? 0;
  const inProgressWorkOrders = kpiStats?.in_progress_work_orders ?? 0;
  const completedWorkOrders = kpiStats?.completed_work_orders ?? 0;
  const overdueWorkOrders = kpiStats?.overdue_work_orders ?? 0;

  const woCompletionRate =
    totalWorkOrders > 0
      ? Math.round((completedWorkOrders / totalWorkOrders) * 100)
      : 0;

  // 3. Breakdown Performance Metrics
  const avgMTTRHours =
    kpiStats?.avg_mttr_hours ??
    (kpiStats?.avg_mttr_minutes
      ? (kpiStats.avg_mttr_minutes / 60).toFixed(1)
      : 0);

  // 4. Preventive Maintenance Metrics
  const pmKpis = pmData?.kpis;
  const totalPmPlans = pmKpis?.total_active_plans ?? 0;
  const pmUpcomingCount = pmKpis?.upcoming_count ?? pmKpis?.due_count ?? 0;
  const pmCompletedCount = pmKpis?.completed_pm_activities ?? 0;
  const pmOverdueCount = pmKpis?.overdue_count ?? 0;
  const pmComplianceRate = pmKpis?.pm_compliance_percentage ?? 100;
  const pmOnTimeRate = pmKpis?.on_time_completion_percentage ?? 100;

  // 5. Workforce / Technician Performance Metrics
  const techniciansList = useMemo(() => {
    return staffUsers.filter(
      (u: any) => String(u.role || '').toLowerCase() === 'technician'
    );
  }, [staffUsers]);

  const totalTechnicians = techniciansList.length;

  const technicianWorkloadItems: TechnicianWorkloadItem[] = useMemo(() => {
    return techniciansList.map((tech) => {
      const activeCount = workOrders.filter(
        (w: any) =>
          w.assigned_technician_id === tech.id &&
          !['completed', 'verified_closed', 'cancelled'].includes(
            String(w.status || '').toLowerCase()
          )
      ).length;

      const completedCount = workOrders.filter(
        (w: any) =>
          w.assigned_technician_id === tech.id &&
          ['completed', 'verified_closed'].includes(
            String(w.status || '').toLowerCase()
          )
      ).length;

      return {
        id: tech.id,
        name: tech.full_name || 'Technician',
        employee_code: tech.employee_code,
        activeCount,
        completedCount,
      };
    }).sort((a, b) => b.activeCount - a.activeCount);
  }, [techniciansList, workOrders]);

  const activeTechniciansCount = useMemo(() => {
    return technicianWorkloadItems.filter((t) => t.activeCount > 0).length;
  }, [technicianWorkloadItems]);

  const unassignedWOCount = useMemo(() => {
    return workOrders.filter(
      (w: any) =>
        !w.assigned_technician_id &&
        !['completed', 'verified_closed', 'cancelled'].includes(
          String(w.status || '').toLowerCase()
        )
    ).length;
  }, [workOrders]);

  const avgWOPerTech =
    totalTechnicians > 0 ? (activeWorkOrders / totalTechnicians).toFixed(1) : 0;

  return (
    <div className="space-y-6 min-h-full pb-10">
      {/* =========================================================================
          HEADER: COMPACT WELCOME HEADER (MATCHING ADMIN DASHBOARD)
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            Welcome, {user?.fullName || 'Plant Manager'}
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-jcb-yellow text-black border border-amber-400">
            Manager
          </span>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs sm:text-[13px] text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: OPERATIONAL OVERVIEW (6 PRIMARY KPIS + SUMMARY STRIP)
          ========================================================================= */}
      <section aria-label="Operational Key Performance Indicators" className="space-y-4">
        {/* 6 Primary Executive KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {/* 1. Total Machines */}
          <TopKPICard
            icon={Cpu}
            iconBgColor="bg-zinc-100"
            iconColor="text-zinc-800"
            accentColor="border-l-4 border-l-zinc-800"
            label="Total Machines"
            value={loading ? '—' : totalMachines}
          />

          {/* 2. Running Machines */}
          <TopKPICard
            icon={Activity}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-800"
            accentColor="border-l-4 border-l-emerald-500"
            label="Running Machines"
            value={loading ? '—' : runningMachines}
            trend={totalMachines > 0 ? `${machineAvailabilityPercent}%` : undefined}
            trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
          />

          {/* 3. Machines Under Breakdown / Maintenance */}
          <TopKPICard
            icon={AlertOctagon}
            iconBgColor="bg-red-100"
            iconColor="text-red-700"
            accentColor="border-l-4 border-l-red-500"
            label="Breakdown / Maint."
            value={loading ? '—' : machinesDown}
            trend={
              machinesDown > 0
                ? `${breakdownMachines} BD • ${maintenanceMachines} Maint`
                : 'Nominal'
            }
            trendColor={
              machinesDown > 0
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }
          />

          {/* 4. Active Work Orders */}
          <TopKPICard
            icon={Wrench}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-800"
            accentColor="border-l-4 border-l-blue-500"
            label="Active Work Orders"
            value={loading ? '—' : activeWorkOrders}
          />

          {/* 5. Overdue Work Orders */}
          <TopKPICard
            icon={AlertTriangle}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-800"
            accentColor="border-l-4 border-l-amber-500"
            label="Overdue Work Orders"
            value={loading ? '—' : overdueWorkOrders}
            trend={overdueWorkOrders > 0 ? 'Action Req.' : 'On Schedule'}
            trendColor={
              overdueWorkOrders > 0
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-slate-100 text-zinc-600 border border-slate-200'
            }
          />

          {/* 6. Resolved Work Orders */}
          <TopKPICard
            icon={CheckCircle2}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-800"
            accentColor="border-l-4 border-l-purple-500"
            label="Resolved Work Orders"
            value={loading ? '—' : completedWorkOrders}
          />
        </div>

        {/* Compact Operational Health Strip */}
        <ManagerOperationalSummaryStrip
          machineAvailabilityPercent={machineAvailabilityPercent}
          woCompletionRate={woCompletionRate}
          pmComplianceRate={pmComplianceRate}
          avgMTTRHours={avgMTTRHours}
          loading={loading}
        />
      </section>

      {/* =========================================================================
          SECTION 2: MACHINE FLEET PERFORMANCE (DONUT + SHOP DISTRIBUTION)
          ========================================================================= */}
      <section aria-label="Machine Fleet Performance">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Machine Status Donut Chart (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <MachineStatusDonut
              title="Machine Status Distribution"
              totalLabel="Total Fleet"
              totalCount={totalMachines}
              segments={machineStatusSegments}
              loading={loading}
              emptyMessage="No machine assets registered in plant scope"
            />
          </div>

          {/* Machine Fleet Distribution by Shop Floor (7 cols) */}
          <div className="lg:col-span-7 h-full">
            <ManagerFleetDistributionChart
              machines={machines}
              selectedPlant="Plant Operations"
              hierarchy={hierarchy}
              loading={loading}
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: MAINTENANCE OPERATIONS (WORK ORDERS + VELOCITY TREND)
          ========================================================================= */}
      <section aria-label="Maintenance Operations">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Work-Order Status Analytics (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <WorkOrderStatusDonut
              totalCount={totalWorkOrders}
              openCount={openWorkOrders}
              inProgressCount={inProgressWorkOrders}
              completedCount={completedWorkOrders}
              overdueCount={overdueWorkOrders}
              loading={loading}
            />
          </div>

          {/* Maintenance Velocity & Trend Chart (7 cols) */}
          <div className="lg:col-span-7 h-full">
            <MaintenanceTrendChart
              title="Operational Maintenance Trends"
              subtitle=""
              series1Name="Breakdowns"
              series2Name="Preventive (PM)"
              data={trendData}
              loading={loading}
              emptyMessage="No maintenance trend recorded"
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: PREVENTIVE MAINTENANCE PERFORMANCE
          ========================================================================= */}
      <section aria-label="Preventive Maintenance Performance">
        <ManagerPMPerformanceCard
          totalPlans={totalPmPlans}
          upcomingCount={pmUpcomingCount}
          completedCount={pmCompletedCount}
          overdueCount={pmOverdueCount}
          complianceRate={pmComplianceRate}
          onTimeRate={pmOnTimeRate}
          loading={loading}
        />
      </section>

      {/* =========================================================================
          SECTION 5: WORKFORCE & TECHNICIAN PERFORMANCE
          ========================================================================= */}
      <section aria-label="Workforce and Technician Performance">
        <ManagerTechnicianPerformanceCard
          technicians={technicianWorkloadItems}
          totalTechnicians={totalTechnicians}
          activeTechniciansCount={activeTechniciansCount}
          unassignedWOCount={unassignedWOCount}
          avgWOPerTech={avgWOPerTech}
          loading={loading}
        />
      </section>
    </div>
  );
};
