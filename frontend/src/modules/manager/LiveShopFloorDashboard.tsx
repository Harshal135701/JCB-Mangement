import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

// Minimal, Professional Manager Analytics Dashboard Components
import { ManagerDashboardHeader } from './components/ManagerDashboardHeader';
import { ManagerPrimaryKPIs } from './components/ManagerPrimaryKPIs';
import { MachineStatusDonut, DonutSegment } from '../../components/dashboard/MachineStatusDonut';
import { ManagerFleetDistributionChart } from './components/ManagerFleetDistributionChart';
import { MaintenanceTrendChart } from '../../components/dashboard/MaintenanceTrendChart';
import { ManagerSpendingSummaryCard } from './components/ManagerSpendingSummaryCard';

export const LiveShopFloorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  // Filter Scope States
  const [plant, setPlant] = useState('All Plants');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [timeframe, setTimeframe] = useState('Last 30 Days');

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Data States
  const [stats, setStats] = useState<any>(null);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [pendingOperators, setPendingOperators] = useState<any[]>([]);
  const [pendingTempRequests, setPendingTempRequests] = useState<any[]>([]);
  const [procurementData, setProcurementData] = useState<any>(null);

  // Selected Plant ID lookup from hierarchy
  const selectedPlantId = useMemo(() => {
    if (plant === 'All Plants') return undefined;
    const selected = hierarchy?.plants?.find(
      (p: any) => p.plant_name === plant || p.plant_code === plant || p.id === plant
    );
    return selected?.id || plant;
  }, [plant, hierarchy]);

  // Dynamic Plant Options
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

  // Dynamic Shop Options based on selected plant
  const shopOptions = useMemo(() => {
    if (!hierarchy?.plants || !Array.isArray(hierarchy.plants)) return [];

    let shopsList: any[] = [];
    if (selectedPlantId) {
      const pl = hierarchy.plants.find((p: any) => p.id === selectedPlantId);
      if (pl && Array.isArray(pl.shops)) {
        shopsList = pl.shops;
      }
    } else {
      // Aggregate across all plants
      hierarchy.plants.forEach((p: any) => {
        if (Array.isArray(p.shops)) {
          shopsList.push(...p.shops);
        }
      });
    }

    return shopsList.map((s: any) => ({
      id: s.id,
      name: s.shop_name,
    }));
  }, [hierarchy, selectedPlantId]);

  // Fetch telemetry from real backend APIs in parallel
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const plantParam = selectedPlantId;
      const shopParam = selectedShopId || undefined;

      const [
        kpiRes,
        orgRes,
        trendRes,
        workOrdersRes,
        machinesRes,
        pendingOpsRes,
        pendingTempRes,
        procurementRes,
      ] = await Promise.all([
        // 1. Dashboard KPIs (Machine telemetry, work order rollups)
        apiClient.get('/reports/dashboard-kpis', {
          params: { plant_id: plantParam, shop_id: shopParam, timeframe },
        }),
        // 2. Organization Hierarchy (Plants & Shops structure)
        apiClient.get('/org/hierarchy'),
        // 3. Maintenance Trend (Historical velocity)
        apiClient.get('/reports/maintenance-trend', {
          params: { plant_id: plantParam, shop_id: shopParam, timeframe },
        }),
        // 4. Work Orders
        apiClient
          .get('/work-orders', {
            params: { plant_id: plantParam, shop_id: shopParam, limit: 100 },
          })
          .catch(() => ({ data: { data: [] } })),
        // 5. Machines Roster
        apiClient
          .get('/machines', {
            params: { plant_id: plantParam, shop_id: shopParam, limit: 100 },
          })
          .catch(() => ({ data: { data: [] } })),
        // 6. Pending Operators (Count for header notification bell)
        apiClient.get('/auth/pending-operators').catch(() => ({ data: { data: [] } })),
        // 7. Pending Temporary Machine Requests (Count for header notification bell)
        apiClient
          .get('/machines/operator/requests/pending', {
            params: plantParam ? { plant_id: plantParam } : {},
          })
          .catch(() => ({ data: { data: [] } })),
        // 8. Procurement & Spending Analytics
        apiClient.get('/procurement/dashboard').catch(() => ({ data: { data: null } })),
      ]);

      if (kpiRes.data?.data) setStats(kpiRes.data.data);
      if (orgRes.data?.data) setHierarchy(orgRes.data.data);
      if (trendRes.data?.data) setTrendData(trendRes.data.data);
      if (workOrdersRes.data?.data) setWorkOrders(workOrdersRes.data.data);
      if (machinesRes.data?.data) setMachines(machinesRes.data.data);
      if (pendingOpsRes.data?.data) setPendingOperators(pendingOpsRes.data.data);
      if (pendingTempRes.data?.data) setPendingTempRequests(pendingTempRes.data.data);
      if (procurementRes.data?.data) setProcurementData(procurementRes.data.data);
    } catch (err: any) {
      console.error('Failed to load manager dashboard telemetry:', err);
      setError(
        err.response?.data?.message ||
          'Failed to connect to shop floor telemetry and database.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedPlantId, selectedShopId, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Socket.IO Listeners for live operations
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchData();
    };

    socket.on('complaint:created', handleRefresh);
    socket.on('complaint:critical', handleRefresh);
    socket.on('complaint:acknowledged', handleRefresh);
    socket.on('complaint:rejected', handleRefresh);
    socket.on('work_order:accepted', handleRefresh);
    socket.on('work_order:declined', handleRefresh);
    socket.on('work_order:submitted_verification', handleRefresh);
    socket.on('work_order:closed', handleRefresh);
    socket.on('operator:machine_requested', handleRefresh);
    socket.on('operator:machine_approved', handleRefresh);
    socket.on('operator:machine_rejected', handleRefresh);
    socket.on('operator:machine_released', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('complaint:created', handleRefresh);
      socket.off('complaint:critical', handleRefresh);
      socket.off('complaint:acknowledged', handleRefresh);
      socket.off('complaint:rejected', handleRefresh);
      socket.off('work_order:accepted', handleRefresh);
      socket.off('work_order:declined', handleRefresh);
      socket.off('work_order:submitted_verification', handleRefresh);
      socket.off('work_order:closed', handleRefresh);
      socket.off('operator:machine_requested', handleRefresh);
      socket.off('operator:machine_approved', handleRefresh);
      socket.off('operator:machine_rejected', handleRefresh);
      socket.off('operator:machine_released', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, fetchData]);

  // Derived KPI metrics from real backend database
  const totalMachines = stats?.total_machines ?? machines.length ?? 0;
  const runningMachines = stats?.running_machines ?? 0;
  const idleMachines = stats?.idle_machines ?? 0;
  const breakdownMachines = stats?.breakdown_machines ?? 0;
  const maintenanceMachines = stats?.maintenance_machines ?? 0;
  const activeWorkOrders = stats?.active_work_orders ?? 0;
  const openWorkOrders = stats?.open_work_orders ?? 0;
  const inProgressWorkOrders = stats?.in_progress_work_orders ?? 0;
  const completedWorkOrders = stats?.completed_work_orders ?? 0;
  const overdueWorkOrders = stats?.overdue_work_orders ?? 0;

  const machineAvailabilityPercent =
    stats?.machine_availability_percent ??
    (totalMachines > 0
      ? parseFloat((((runningMachines + idleMachines) / totalMachines) * 100).toFixed(1))
      : 0);

  // Machine status segments for Donut chart
  const statusSegments: DonutSegment[] = useMemo(() => {
    if (totalMachines === 0) return [];
    return [
      {
        label: 'Operational',
        count: runningMachines,
        percentage: (runningMachines / totalMachines) * 100,
        color: '#10B981',
      },
      {
        label: 'Idle / Standby',
        count: idleMachines,
        percentage: (idleMachines / totalMachines) * 100,
        color: '#F59E0B',
      },
      {
        label: 'In Breakdown',
        count: breakdownMachines,
        percentage: (breakdownMachines / totalMachines) * 100,
        color: '#EF4444',
      },
      {
        label: 'Under Repair',
        count: maintenanceMachines,
        percentage: (maintenanceMachines / totalMachines) * 100,
        color: '#18181B',
      },
    ];
  }, [totalMachines, runningMachines, idleMachines, breakdownMachines, maintenanceMachines]);

  // Spending metrics from real procurement API
  const totalSpend =
    procurementData?.summary?.total_spend ??
    procurementData?.kpi?.total_expenditure ??
    0;
  const activePOs =
    procurementData?.summary?.active_pos ??
    procurementData?.kpi?.active_purchase_orders ??
    0;
  const deliveredThisMonth =
    procurementData?.summary?.delivered_this_month ??
    procurementData?.kpi?.fulfilled_orders ??
    0;
  const totalPendingPRs =
    procurementData?.summary?.total_pending_prs ??
    procurementData?.kpi?.pending_requisitions ??
    0;
  const overduePOs =
    procurementData?.summary?.overdue_pos ??
    procurementData?.kpi?.overdue_purchase_orders ??
    0;

  // Total pending approvals count for the single notification bell
  const pendingApprovalsCount =
    (pendingOperators?.length || 0) + (pendingTempRequests?.length || 0);

  return (
    <div className="space-y-6 min-h-full pb-10">
      {/* =========================================================================
          HEADER: Welcome message, Context selectors, Date, Notification Bell
          ========================================================================= */}
      <ManagerDashboardHeader
        user={user}
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        shopOptions={shopOptions}
        selectedShopId={selectedShopId}
        onShopChange={setSelectedShopId}
        timeframeOptions={['Today', 'Last 7 Days', 'Last 30 Days', 'This Month']}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        isConnected={Boolean(isConnected)}
        loading={loading}
        pendingApprovalsCount={pendingApprovalsCount}
        onRefresh={fetchData}
      />

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="px-2.5 py-1 bg-white border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-100 transition text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: EXACTLY 6 PRIMARY OPERATIONAL KPI CARDS
          ========================================================================= */}
      <section aria-label="Operational Key Performance Indicators">
        <ManagerPrimaryKPIs
          totalMachines={totalMachines}
          runningMachines={runningMachines}
          idleMachines={idleMachines}
          breakdownMachines={breakdownMachines}
          maintenanceMachines={maintenanceMachines}
          activeWorkOrders={activeWorkOrders}
          openWorkOrders={openWorkOrders}
          inProgressWorkOrders={inProgressWorkOrders}
          overdueWorkOrders={overdueWorkOrders}
          completedWorkOrders={completedWorkOrders}
          machineAvailabilityPercent={machineAvailabilityPercent}
        />
      </section>

      {/* =========================================================================
          SECTION 2: MACHINE FLEET ANALYTICS (DONUT + DISTRIBUTION BAR CHART)
          ========================================================================= */}
      <section aria-label="Machine Fleet Analytics">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Donut Chart: Machine Status Distribution (5 cols) */}
          <div className="lg:col-span-5 h-full">
            <MachineStatusDonut
              title="Machine Fleet Status Distribution"
              totalLabel="Total Fleet Assets"
              totalCount={totalMachines}
              segments={statusSegments}
              loading={loading}
              emptyMessage="No equipment assets found in this facility scope"
            />
          </div>

          {/* Bar Chart: Machine Distribution by Plant or Shop (7 cols) */}
          <div className="lg:col-span-7 h-full">
            <ManagerFleetDistributionChart
              machines={machines}
              selectedPlant={plant}
              hierarchy={hierarchy}
              loading={loading}
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: MAINTENANCE PERFORMANCE & SPENDING ANALYTICS
          ========================================================================= */}
      <section aria-label="Maintenance Performance and Spending">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Work-Order Performance / Maintenance Velocity Trend (6 cols) */}
          <div className="lg:col-span-6 h-full">
            <MaintenanceTrendChart
              title="Maintenance Velocity Trend"
              subtitle="Breakdown faults vs scheduled preventive maintenance compliance"
              series1Name="Corrective / Faults"
              series2Name="Preventive (PM)"
              series1Color="#18181B"
              series2Color="#EAB308"
              data={trendData}
              loading={loading}
              emptyMessage="No maintenance activity records logged for this period"
            />
          </div>

          {/* Procurement & Spending Financial Summary (6 cols) */}
          <div className="lg:col-span-6 h-full">
            <ManagerSpendingSummaryCard
              totalSpend={totalSpend}
              activePOs={activePOs}
              deliveredThisMonth={deliveredThisMonth}
              totalPendingPRs={totalPendingPRs}
              overduePOs={overduePOs}
              loading={loading}
            />
          </div>
        </div>
      </section>
    </div>
  );
};
