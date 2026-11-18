import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import {
  CheckCircle2,
  Wrench,
  ClipboardList,
  Clock,
  RefreshCw,
  AlertCircle,
  AlertOctagon,
  Package,
  Radio,
} from 'lucide-react';

// Dashboard Components
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { CriticalAlertsBanner } from '../../components/dashboard/CriticalAlertsBanner';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { WorkOrderStatusDonut } from '../../components/dashboard/WorkOrderStatusDonut';
import { StaffAvailabilityCard, StaffMember } from '../../components/dashboard/StaffAvailabilityCard';
import { SparePartsSummaryCard, SparePartsSummaryData } from '../../components/dashboard/SparePartsSummaryCard';
import { WorkOrdersQueueTable } from '../../components/dashboard/WorkOrdersQueueTable';

export const LiveShopFloorDashboard: React.FC = () => {
  const { socket, isConnected } = useSocket();

  // Filters
  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Telemetry Data
  const [stats, setStats] = useState<any>(null);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffMember[]>([]);
  const [inventorySummary, setInventorySummary] = useState<SparePartsSummaryData | null>(null);

  // Selected plant ID lookup
  const selectedPlantId = useMemo(() => {
    if (plant === 'All Plants') return undefined;
    const selected = hierarchy?.plants?.find((p: any) => p.plant_name === plant);
    return selected?.id || plant;
  }, [plant, hierarchy]);

  // Fetch telemetry from real backend APIs
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const plantParam = selectedPlantId;

      const [
        kpiRes,
        orgRes,
        trendRes,
        workOrdersRes,
        usersRes,
        inventoryRes,
      ] = await Promise.all([
        apiClient.get('/reports/dashboard-kpis', { params: { plant_id: plantParam, timeframe } }),
        apiClient.get('/org/hierarchy'),
        apiClient.get('/reports/maintenance-trend', { params: { plant_id: plantParam, timeframe } }),
        apiClient.get('/work-orders', { params: { plant_id: plantParam, limit: 10 } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/auth/users', { params: { plant_id: plantParam, limit: 50 } }).catch(() => ({ data: { data: [] } })),
        apiClient.get('/inventory/dashboard', { params: plantParam ? { plant_id: plantParam } : {} }).catch(() => ({ data: { data: null } })),
      ]);

      if (kpiRes.data?.data) {
        setStats(kpiRes.data.data);
      }
      setHierarchy(orgRes.data?.data || null);
      setTrendData(trendRes.data?.data || []);
      setWorkOrders(workOrdersRes.data?.data || []);

      // Staff users mapping
      if (usersRes.data?.data && Array.isArray(usersRes.data.data)) {
        const mappedStaff: StaffMember[] = usersRes.data.data.map((u: any) => ({
          id: u.id,
          fullName: u.full_name || u.fullName || 'Staff Member',
          employeeCode: u.employee_code || u.employeeCode || '—',
          email: u.email || '',
          role: u.role || 'technician',
          isActive: u.is_active ?? true,
          department: u.department,
          designation: u.designation,
          shift: u.shift,
          plantName: u.plant_name || u.plantName,
          shopName: u.shop_name || u.shopName,
        }));
        setStaffUsers(mappedStaff);
      } else {
        setStaffUsers([]);
      }

      // Spare parts inventory mapping
      if (inventoryRes.data?.data?.summary) {
        setInventorySummary(inventoryRes.data.data.summary);
      } else if (kpiRes.data?.data) {
        setInventorySummary({
          total_parts: kpiRes.data.data.total_parts ?? 0,
          total_available_stock: kpiRes.data.data.total_available_stock ?? 0,
          low_stock_items_count: kpiRes.data.data.low_stock_items_count ?? 0,
          out_of_stock_count: kpiRes.data.data.out_of_stock_count ?? 0,
          total_reserved_stock: kpiRes.data.data.total_reserved_parts ?? 0,
        });
      }
    } catch (err: any) {
      console.error('Failed to load manager dashboard:', err);
      setError(
        err.response?.data?.message ||
        'Failed to connect to shop floor telemetry and database.'
      );
    } finally {
      setLoading(false);
    }
  }, [plant, timeframe, selectedPlantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Socket.IO auto-refresh for live shop floor operations
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchData();
    };

    socket.on('complaint:created', handleRefresh);
    socket.on('complaint:critical', handleRefresh);
    socket.on('work_order:accepted', handleRefresh);
    socket.on('work_order:declined', handleRefresh);
    socket.on('work_order:submitted_verification', handleRefresh);
    socket.on('work_order:closed', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('complaint:created', handleRefresh);
      socket.off('complaint:critical', handleRefresh);
      socket.off('work_order:accepted', handleRefresh);
      socket.off('work_order:declined', handleRefresh);
      socket.off('work_order:submitted_verification', handleRefresh);
      socket.off('work_order:closed', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, fetchData]);

  // Dynamic Plant Options from real database hierarchy
  const plantOptions = useMemo(() => {
    const list = ['All Plants'];
    if (hierarchy?.plants && Array.isArray(hierarchy.plants)) {
      hierarchy.plants.forEach((p: any) => {
        if (p.plant_name && !list.includes(p.plant_name)) {
          list.push(p.plant_name);
        }
      });
    }
    return list;
  }, [hierarchy]);

  // Real KPIs directly from PostgreSQL
  const totalMachines = stats?.total_machines ?? 0;
  const runningMachines = stats?.running_machines ?? 0;
  const idleMachines = stats?.idle_machines ?? 0;
  const breakdownMachines = stats?.breakdown_machines ?? 0;
  const maintenanceMachines = stats?.maintenance_machines ?? 0;
  const pendingRequests = stats?.pending_requests ?? 0;
  const activeWorkOrders = stats?.active_work_orders ?? 0;
  const overdueWorkOrders = stats?.overdue_work_orders ?? 0;
  const completedWorkOrders = stats?.completed_work_orders ?? 0;
  const openWorkOrders = stats?.open_work_orders ?? 0;

  // Real downtime metrics
  const machineAvailabilityPercent = stats?.machine_availability_percent ?? (totalMachines > 0 ? parseFloat((((runningMachines + idleMachines) / totalMachines) * 100).toFixed(1)) : 0);
  const avgMTTRMinutes = stats?.avg_mttr_minutes ?? 0;

  // Machine status segments dynamically calculated
  const statusSegments = useMemo(() => {
    if (totalMachines === 0) return [];
    return [
      {
        label: 'Working',
        count: runningMachines,
        percentage: (runningMachines / totalMachines) * 100,
        color: '#10B981',
      },
      {
        label: 'Idle',
        count: idleMachines,
        percentage: (idleMachines / totalMachines) * 100,
        color: '#F59E0B',
      },
      {
        label: 'Machine Stopped',
        count: breakdownMachines,
        percentage: (breakdownMachines / totalMachines) * 100,
        color: '#EF4444',
      },
      {
        label: 'Under Repair',
        count: maintenanceMachines,
        percentage: (maintenanceMachines / totalMachines) * 100,
        color: '#1E293B',
      },
    ];
  }, [totalMachines, runningMachines, idleMachines, breakdownMachines, maintenanceMachines]);

  const lowStockCount =
    inventorySummary?.low_stock_items_count ?? stats?.low_stock_items_count ?? 0;

  return (
    <div className="space-y-4 sm:space-y-5 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Clean, Compact Manager Header & Controls
          ========================================================================= */}
      <DashboardHeader
        title="Manager Dashboard"
        subtitle="Shop floor operations & equipment telemetry"
        badge="Plant Operations"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <div className="flex items-center gap-2">
            {/* Live Socket Status Pill */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                isConnected !== false
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Radio
                className={`w-3 h-3 ${
                  isConnected !== false ? 'text-emerald-600 animate-pulse' : 'text-amber-600'
                }`}
              />
              <span>{isConnected !== false ? 'Live Telemetry' : 'Synced'}</span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-2.5 py-0.5 bg-white border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-100 transition cursor-pointer text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Critical Alerts Banner (Compact single-line notice) */}
      <CriticalAlertsBanner
        breakdownCount={breakdownMachines}
        pendingRequestsCount={pendingRequests}
        overdueWorkOrdersCount={overdueWorkOrders}
        lowStockPartsCount={lowStockCount}
      />

      {/* =========================================================================
          ROW 1: COMPACT KPI STRIP (6 Metrics in a single balanced row)
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Machines Operating */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Fleet Running"
          value={runningMachines}
          subtitle={`of ${totalMachines} Machines`}
          trend={`${machineAvailabilityPercent}%`}
          isPositiveTrend={machineAvailabilityPercent >= 75}
        />

        {/* Card 2: Breakdown Machines */}
        <TopKPICard
          icon={AlertOctagon}
          iconBgColor="bg-red-100"
          iconColor="text-red-800"
          label="Breakdowns"
          value={breakdownMachines}
          subtitle={breakdownMachines > 0 ? 'Urgent Action' : 'Zero Halts'}
          trend={breakdownMachines > 0 ? `${breakdownMachines} Down` : 'Nominal'}
          trendColor={
            breakdownMachines > 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }
        />

        {/* Card 3: Pending Problem Reports */}
        <TopKPICard
          icon={ClipboardList}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Pending Triage"
          value={pendingRequests}
          subtitle="Needs Technician"
          trend={pendingRequests > 0 ? 'Action' : 'Clear'}
          trendColor="bg-amber-50 text-amber-800 border-amber-200"
        />

        {/* Card 4: Active Repair Jobs */}
        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Active Repairs"
          value={activeWorkOrders}
          subtitle={`${overdueWorkOrders} Overdue`}
          trend={overdueWorkOrders > 0 ? 'SLA Alert' : 'On Track'}
          trendColor={
            overdueWorkOrders > 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }
        />

        {/* Card 5: Mean Time to Repair (MTTR) */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-800"
          label="Avg MTTR"
          value={`${avgMTTRMinutes}m`}
          subtitle="Fix Velocity"
          trend="Telemetry"
          trendColor="bg-purple-50 text-purple-700 border-purple-200"
        />

        {/* Card 6: Spare Parts Alert */}
        <TopKPICard
          icon={Package}
          iconBgColor={lowStockCount > 0 ? 'bg-amber-100' : 'bg-slate-100'}
          iconColor={lowStockCount > 0 ? 'text-amber-800' : 'text-zinc-800'}
          label="Low Spares"
          value={lowStockCount}
          subtitle="At Reorder Point"
          trend={lowStockCount > 0 ? 'Restock' : 'Buffer OK'}
          trendColor={
            lowStockCount > 0
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }
        />
      </div>

      {/* =========================================================================
          ROW 2: CORE TELEMETRY CHARTS (Balanced 3-Column Grid)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Chart 1: Interactive Machine Status Donut */}
        <div className="h-full">
          <MachineStatusDonut
            title="Machine Status"
            totalLabel="Total Fleet"
            totalCount={totalMachines}
            segments={statusSegments}
            emptyMessage="No machine assets registered"
            loading={loading}
          />
        </div>

        {/* Chart 2: Fixed Maintenance Velocity Trend Spline Chart */}
        <div className="h-full">
          <MaintenanceTrendChart
            title="Maintenance Velocity"
            series1Name="Corrective"
            series2Name="Preventive"
            series1Color="#18181B"
            series2Color="#EAB308"
            data={trendData}
            loading={loading}
            emptyMessage="No maintenance trend recorded"
          />
        </div>

        {/* Chart 3: Work Order Lifecycle Donut */}
        <div className="h-full">
          <WorkOrderStatusDonut
            totalCount={activeWorkOrders + completedWorkOrders}
            openCount={openWorkOrders}
            inProgressCount={activeWorkOrders - openWorkOrders > 0 ? activeWorkOrders - openWorkOrders : activeWorkOrders}
            completedCount={completedWorkOrders}
            overdueCount={overdueWorkOrders}
            loading={loading}
          />
        </div>
      </div>

      {/* =========================================================================
          ROW 3: OPERATIONAL READINESS & RESOURCE HEALTH (Balanced 2-Column Grid)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Column 1: Staff on Shift & Availability */}
        <div className="h-full">
          <StaffAvailabilityCard
            users={staffUsers}
            loading={loading}
            emptyMessage="No personnel registered for this facility scope"
          />
        </div>

        {/* Column 2: Spare Parts & Inventory Health */}
        <div className="h-full">
          <SparePartsSummaryCard
            summary={inventorySummary}
            loading={loading}
          />
        </div>
      </div>

      {/* =========================================================================
          ROW 4: LIVE WORK ORDERS & REPAIR QUEUE TABLE (Full Width)
          ========================================================================= */}
      <div className="w-full">
        <WorkOrdersQueueTable
          workOrders={workOrders}
          loading={loading}
        />
      </div>
    </div>
  );
};
