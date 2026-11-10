import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { 
  Truck, 
  CheckCircle2, 
  Wrench, 
  ClipboardList, 
  Clock, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';
import { RecentMaintenanceRequestsTable, MaintenanceRequestItem } from '../../components/dashboard/RecentMaintenanceRequestsTable';
import { UpcomingPMTable, PMTableItem } from '../../components/dashboard/UpcomingPMTable';

export const LiveShopFloorDashboard: React.FC = () => {
  const { socket } = useSocket();
  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [recentRequests, setRecentRequests] = useState<MaintenanceRequestItem[]>([]);
  const [upcomingPMs, setUpcomingPMs] = useState<PMTableItem[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const plantParam = plant !== 'All Plants' ? plant : undefined;

      const [kpiRes, breakdownsRes, pmRes, orgRes, trendRes] = await Promise.all([
        apiClient.get('/reports/dashboard-kpis', { params: { plant_id: plantParam, timeframe } }),
        apiClient.get('/breakdowns', { params: { plant_id: plantParam, limit: 5 } }),
        apiClient.get('/pm/upcoming', { params: { plant_id: plantParam, windowDays: 30 } }),
        apiClient.get('/org/hierarchy'),
        apiClient.get('/reports/maintenance-trend', { params: { plant_id: plantParam, timeframe } }),
      ]);

      if (kpiRes.data?.data) {
        setStats(kpiRes.data.data);
      }
      setHierarchy(orgRes.data?.data || null);
      setTrendData(trendRes.data?.data || []);

      // Real breakdown requests mapping
      if (breakdownsRes.data?.data && Array.isArray(breakdownsRes.data.data)) {
        const mapped = breakdownsRes.data.data.map((b: any) => ({
          id: b.complaint_number || (typeof b.id === 'string' ? b.id.slice(0, 8) : `CMP-${b.id}`),
          machine: b.machine_code || b.machine?.code || b.machine?.name || 'Machinery Asset',
          issue: b.problem_title || b.description || 'Stoppage Alert',
          priority: b.priority ? b.priority.charAt(0).toUpperCase() + b.priority.slice(1) : 'Medium',
          status:
            b.status === 'work_order_created'
              ? 'In Progress'
              : b.status === 'acknowledged'
              ? 'Approved'
              : b.status === 'new'
              ? 'Pending'
              : b.status === 'closed'
              ? 'Resolved'
              : b.status || 'Pending',
          date: b.created_at
            ? new Date(b.created_at).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'N/A',
        }));
        setRecentRequests(mapped);
      } else {
        setRecentRequests([]);
      }

      // Real PM records mapping
      if (pmRes.data?.data && Array.isArray(pmRes.data.data)) {
        const mappedPM = pmRes.data.data.map((p: any) => ({
          machine: p.machine_code || p.machine?.code || p.machine_name || 'Machinery Asset',
          activity: p.title || p.task_name || 'Preventive Maintenance',
          dueDate: p.next_pm_date
            ? new Date(p.next_pm_date).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Scheduled',
          status: p.status === 'overdue' ? 'Overdue' : 'Scheduled',
        }));
        setUpcomingPMs(mappedPM);
      } else {
        setUpcomingPMs([]);
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
  };

  useEffect(() => {
    fetchData();
  }, [plant, timeframe]);

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
  }, [socket, plant, timeframe]);

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

  // Real downtime metrics
  const downtimeRatePercent = stats?.downtime_rate_percent ?? 0;
  const totalDowntimeHours = stats?.total_downtime_hours ?? 0;
  const avgMTTRMinutes = stats?.avg_mttr_minutes ?? 0;

  // Machine status segments dynamically calculated
  const statusSegments = useMemo(() => {
    if (totalMachines === 0) return [];
    return [
      {
        label: 'Running',
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
        label: 'Breakdown',
        count: breakdownMachines,
        percentage: (breakdownMachines / totalMachines) * 100,
        color: '#EF4444',
      },
      {
        label: 'Under Maintenance',
        count: maintenanceMachines,
        percentage: (maintenanceMachines / totalMachines) * 100,
        color: '#1E293B',
      },
    ];
  }, [totalMachines, runningMachines, idleMachines, breakdownMachines, maintenanceMachines]);

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Manager Dashboard & Dropdowns
          ========================================================================= */}
      <DashboardHeader
        title="Manager Dashboard"
        subtitle="Overview of maintenance operations across your plant"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            title="Refresh shop floor telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      {/* Error Banner with Retry */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-100 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Real Database Values)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Card 1: Total Machines */}
        <TopKPICard
          icon={Truck}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Total Machines"
          value={totalMachines}
          subtitle={`${idleMachines} Idle`}
        />

        {/* Card 2: Running Machines */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Running Machines"
          value={runningMachines}
          subtitle={totalMachines > 0 ? `${((runningMachines / totalMachines) * 100).toFixed(0)}% Operating` : 'No Machines'}
        />

        {/* Card 3: Breakdown Machines */}
        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-red-100"
          iconColor="text-red-800"
          label="Breakdown Machines"
          value={breakdownMachines}
          subtitle={breakdownMachines > 0 ? 'Requires Action' : 'Zero Stoppages'}
        />

        {/* Card 4: Pending Requests */}
        <TopKPICard
          icon={ClipboardList}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Pending Requests"
          value={pendingRequests}
          subtitle="Triage Queue"
        />

        {/* Card 5: Active Work Orders */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Active Work Orders"
          value={activeWorkOrders}
          subtitle={`${stats?.overdue_work_orders ?? 0} Overdue`}
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Real Operational Metrics)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Machine Status Donut */}
        <MachineStatusDonut
          title="Machine Status Overview"
          totalLabel="Total"
          totalCount={totalMachines}
          segments={statusSegments}
          emptyMessage="No machine assets registered in scope"
          loading={loading}
        />

        {/* Card 2: Maintenance Trend Spline Chart */}
        <MaintenanceTrendChart
          title="Maintenance Trend"
          series1Name="Corrective"
          series2Name="Preventive"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={trendData}
          loading={loading}
          emptyMessage="No maintenance work orders recorded in period"
        />

        {/* Card 3: Downtime Analysis Gauge Card */}
        <DowntimeAnalysisCard
          title="Downtime Analysis"
          rateValue={`${downtimeRatePercent}%`}
          rateLabel="Downtime Rate"
          percentage={downtimeRatePercent}
          gaugeColor="#F59E0B"
          loading={loading}
          emptyMessage="Zero downtime recorded"
          metrics={[
            {
              icon: Clock,
              label: 'Total Downtime',
              value: `${totalDowntimeHours} Hrs`,
              change: totalDowntimeHours > 0 ? 'Recorded' : 'Zero Halts',
              isPositiveChange: totalDowntimeHours === 0,
            },
            {
              icon: Clock,
              label: 'Avg. Repair Time',
              value: `${avgMTTRMinutes} Mins`,
              change: avgMTTRMinutes > 0 ? 'Mean Wrench' : 'No Outages',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): Recent Maintenance Requests */}
        <div className="lg:col-span-7">
          <RecentMaintenanceRequestsTable
            title="Recent Maintenance Requests"
            viewAllLink="/triage"
            requests={recentRequests}
            loading={loading}
          />
        </div>

        {/* Right Column (~40%): Upcoming Preventive Maintenance */}
        <div className="lg:col-span-5">
          <UpcomingPMTable
            title="Upcoming Preventive Maintenance"
            viewCalendarLink="/pm"
            activities={upcomingPMs}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};
