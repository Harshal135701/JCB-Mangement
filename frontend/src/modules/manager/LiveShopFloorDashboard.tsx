import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import { 
  Truck, 
  CheckCircle2, 
  Wrench, 
  ClipboardList, 
  Clock, 
  RefreshCw 
} from 'lucide-react';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';
import { RecentMaintenanceRequestsTable, MaintenanceRequestItem } from '../../components/dashboard/RecentMaintenanceRequestsTable';
import { UpcomingPMTable, PMTableItem } from '../../components/dashboard/UpcomingPMTable';

export const LiveShopFloorDashboard: React.FC = () => {
  const { socket } = useSocket();
  const [plant, setPlant] = useState('Pune Plant');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [recentRequests, setRecentRequests] = useState<MaintenanceRequestItem[]>([]);
  const [upcomingPMs, setUpcomingPMs] = useState<PMTableItem[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, breakdownsRes, pmRes] = await Promise.all([
        apiClient.get('/reports/dashboard-kpis').catch(() => ({ data: { data: null } })),
        apiClient.get('/breakdowns?limit=5').catch(() => ({ data: { data: [] } })),
        apiClient.get('/pm?limit=5').catch(() => ({ data: { data: [] } })),
      ]);

      if (kpiRes.data?.data) {
        setStats(kpiRes.data.data);
      }

      // If backend returns real breakdowns, map them to table items
      if (breakdownsRes.data?.data && breakdownsRes.data.data.length > 0) {
        const mapped = breakdownsRes.data.data.map((b: any) => ({
          id: b.complaint_number || b.id?.slice(0, 8) || 'MR-10025',
          machine: b.machine?.code || b.machine_id || 'JCB-205',
          issue: b.description || b.reported_problem || 'Hydraulic Leak',
          priority: b.priority ? b.priority.charAt(0).toUpperCase() + b.priority.slice(1) : 'Critical',
          status: b.status === 'open' ? 'In Progress' : b.status === 'in_progress' ? 'In Progress' : 'Pending',
          date: b.created_at ? new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '30 Apr, 10:20 AM',
        }));
        setRecentRequests(mapped);
      }

      // If backend returns real PM records, map them
      if (pmRes.data?.data && pmRes.data.data.length > 0) {
        const mappedPM = pmRes.data.data.map((p: any) => ({
          machine: p.machine?.code || 'JCB-143',
          activity: p.title || p.task_name || 'Filter Replacement',
          dueDate: p.next_due_date ? new Date(p.next_due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '01 May, 2025',
          status: p.status === 'overdue' ? 'Due Soon' : 'Scheduled',
        }));
        setUpcomingPMs(mappedPM);
      }
    } catch (err) {
      console.error('Failed to load manager dashboard:', err);
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
  }, [socket]);

  // Derived or Image 2 baseline KPI metrics
  const totalMachines = stats?.total_machines ?? 120;
  const runningMachines = stats?.running_machines ?? 98;
  const breakdownMachines = stats?.breakdown_machines ?? 12;
  const pendingRequests = stats?.pending_requests ?? 18;
  const activeWorkOrders = stats?.active_work_orders ?? 22;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Manager Dashboard & Dropdowns (Image 2)
          ========================================================================= */}
      <DashboardHeader
        title="Manager Dashboard"
        subtitle="Overview of maintenance operations across your plant"
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

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Image 2)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Machines */}
        <TopKPICard
          icon={Truck}
          iconBgColor="bg-amber-100/70"
          iconColor="text-amber-700"
          label="Total Machines"
          value={totalMachines}
          trend="↑ 2%"
          trendColor="text-emerald-600"
        />

        {/* Card 2: Running Machines */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-zinc-900"
          iconColor="text-white"
          label="Running Machines"
          value={runningMachines}
          trend="↑ 1%"
          trendColor="text-emerald-600"
        />

        {/* Card 3: Breakdown Machines */}
        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Breakdown Machines"
          value={breakdownMachines}
          trend="↓ 1%"
          trendColor="text-red-500"
        />

        {/* Card 4: Pending Requests */}
        <TopKPICard
          icon={ClipboardList}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Pending Requests"
          value={pendingRequests}
          trend="↑ 3%"
          trendColor="text-emerald-600"
        />

        {/* Card 5: Active Work Orders */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Active Work Orders"
          value={activeWorkOrders}
          trend="↑ 5%"
          trendColor="text-emerald-600"
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Image 2)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Machine Status Donut */}
        <MachineStatusDonut
          title="Machine Status Overview"
          totalLabel="Total"
          totalCount={totalMachines}
          segments={[
            { label: 'Running', count: 98, percentage: 81.7, color: '#10B981' },
            { label: 'Idle', count: 8, percentage: 6.7, color: '#F59E0B' },
            { label: 'Breakdown', count: 12, percentage: 10.0, color: '#EF4444' },
            { label: 'Under Maintenance', count: 2, percentage: 1.6, color: '#1E293B' },
          ]}
        />

        {/* Card 2: Maintenance Trend Spline Chart */}
        <MaintenanceTrendChart
          title="Maintenance Trend"
          series1Name="Corrective"
          series2Name="Preventive"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={[
            { label: 'Week 1', series1: 20, series2: 13 },
            { label: 'Week 2', series1: 27, series2: 20 },
            { label: 'Week 3', series1: 25, series2: 18 },
            { label: 'Week 4', series1: 32, series2: 25 },
          ]}
          maxY={40}
        />

        {/* Card 3: Downtime Analysis Gauge Card */}
        <DowntimeAnalysisCard
          title="Downtime Analysis"
          rateValue="2.8%"
          rateLabel="Downtime Rate"
          percentage={28}
          gaugeColor="#F59E0B"
          metrics={[
            {
              icon: Clock,
              label: 'Total Downtime',
              value: '48 Hrs',
              change: '↓ 12%',
              isPositiveChange: true,
            },
            {
              icon: Clock,
              label: 'Avg. Repair Time',
              value: '2.1 Hrs',
              change: '↓ 8%',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (Image 2: ~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): Recent Maintenance Requests */}
        <div className="lg:col-span-7">
          <RecentMaintenanceRequestsTable
            title="Recent Maintenance Requests"
            viewAllLink="/triage"
            requests={recentRequests.length > 0 ? recentRequests : undefined}
          />
        </div>

        {/* Right Column (~40%): Upcoming Preventive Maintenance */}
        <div className="lg:col-span-5">
          <UpcomingPMTable
            title="Upcoming Preventive Maintenance"
            viewCalendarLink="/pm"
            activities={upcomingPMs.length > 0 ? upcomingPMs : undefined}
          />
        </div>
      </div>
    </div>
  );
};
