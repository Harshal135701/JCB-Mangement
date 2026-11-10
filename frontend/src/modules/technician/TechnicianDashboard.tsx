import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Wrench, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  RefreshCw, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [upcomingPMs, setUpcomingPMs] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const [woRes, pmRes, orgRes] = await Promise.all([
        apiClient.get('/work-orders', { params: { limit: 50 } }),
        apiClient.get('/pm/upcoming', { params: { windowDays: 30, limit: 10 } }),
        apiClient.get('/org/hierarchy'),
      ]);

      if (woRes.data?.success && Array.isArray(woRes.data.data)) {
        setWorkOrders(woRes.data.data);
      } else {
        setWorkOrders([]);
      }

      if (pmRes.data?.data && Array.isArray(pmRes.data.data)) {
        setUpcomingPMs(pmRes.data.data);
      } else {
        setUpcomingPMs([]);
      }

      setHierarchy(orgRes.data?.data || null);
    } catch (err: any) {
      console.error('Failed to load technician orders:', err);
      setError(
        err.response?.data?.message ||
        'Failed to connect to technician dispatch queue and database.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [plant, timeframe]);

  // Real-time Socket.IO auto-refresh on new assignments and rework requests
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchWorkOrders();
    };
    socket.on('technician:assigned', handleRefresh);
    socket.on('work_order:rework_required', handleRefresh);
    socket.on('work_order:reopened', handleRefresh);
    socket.on('work_order:closed', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('technician:assigned', handleRefresh);
      socket.off('work_order:rework_required', handleRefresh);
      socket.off('work_order:reopened', handleRefresh);
      socket.off('work_order:closed', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, plant, timeframe]);

  const handleQuickMilestone = async (woId: string, action: string) => {
    try {
      setActionLoading(true);
      setActionSuccess('');

      let payload: any = { action };
      if (['DECLINE', 'REJECT'].includes(action.toUpperCase())) {
        const reason = window.prompt('Please provide a reason for declining this assignment:');
        if (!reason || !reason.trim()) {
          setActionLoading(false);
          return;
        }
        payload.notes = reason.trim();
        payload.technician_remarks = reason.trim();
      }

      const res = await apiClient.post(`/work-orders/${woId}/milestone`, payload);
      if (res.data?.success) {
        setActionSuccess(`Milestone '${action}' recorded successfully!`);
        fetchWorkOrders();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to record milestone ${action}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Dynamic Plant Options from hierarchy
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

  // Real Status segmentation
  const pendingAcceptance = workOrders.filter((wo) => wo.status === 'assigned');
  const activeRepairs = workOrders.filter((wo) =>
    ['in_progress', 'under_diagnosis', 'accepted', 'scheduled'].includes(wo.status)
  );
  const completedRepairs = workOrders.filter((wo) =>
    ['verified_closed', 'completed', 'submitted_verification'].includes(wo.status)
  );
  const overdueRepairs = workOrders.filter(
    (wo) =>
      wo.sla_deadline &&
      new Date(wo.sla_deadline) < new Date() &&
      !['verified_closed', 'completed'].includes(wo.status)
  );

  const totalAssignedCount = workOrders.length;
  const activeCount = activeRepairs.length;
  const pendingCount = pendingAcceptance.length;
  const completedCount = completedRepairs.length;

  // Real parts count consumed/reserved for this technician's orders
  const partsConsumedCount = useMemo(() => {
    return workOrders.reduce((sum, wo) => {
      const parts = wo.parts_consumed || wo.parts || [];
      return sum + (Array.isArray(parts) ? parts.length : 0);
    }, 0);
  }, [workOrders]);

  // Real SLA Calculation from completed orders
  const onTimeCompleted = useMemo(() => {
    return completedRepairs.filter((wo) => {
      if (!wo.sla_deadline) return true;
      if (!wo.repair_completed_time) return false;
      return new Date(wo.repair_completed_time) <= new Date(wo.sla_deadline);
    }).length;
  }, [completedRepairs]);

  const onTimeSlaRate =
    completedCount > 0 ? Math.round((onTimeCompleted / completedCount) * 100) : 0;

  // Real average active repair MTTR
  const avgMTTRMinutes = useMemo(() => {
    const times = completedRepairs
      .map((wo) => Number(wo.active_repair_minutes || 0))
      .filter((m) => m > 0);
    if (times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }, [completedRepairs]);

  // Work Order Category Donut segments
  const categorySegments = useMemo(() => {
    if (totalAssignedCount === 0) return [];

    const criticalCount = workOrders.filter((w) => w.is_major_breakdown || w.priority === 'critical').length;
    const correctiveCount = workOrders.filter(
      (w) => w.classification === 'minor_breakdown' || (!w.is_major_breakdown && w.priority !== 'critical' && w.classification !== 'regular_maintenance')
    ).length;
    const pmCount = workOrders.filter((w) => w.classification === 'regular_maintenance').length;
    const otherCount = Math.max(0, totalAssignedCount - criticalCount - correctiveCount - pmCount);

    return [
      {
        label: 'Emergency Breakdown',
        count: criticalCount,
        percentage: (criticalCount / totalAssignedCount) * 100,
        color: '#EF4444',
      },
      {
        label: 'Corrective Repair',
        count: correctiveCount,
        percentage: (correctiveCount / totalAssignedCount) * 100,
        color: '#10B981',
      },
      {
        label: 'Preventive Service',
        count: pmCount,
        percentage: (pmCount / totalAssignedCount) * 100,
        color: '#F59E0B',
      },
      {
        label: 'Standard WO',
        count: otherCount,
        percentage: (otherCount / totalAssignedCount) * 100,
        color: '#18181B',
      },
    ].filter((s) => s.count > 0);
  }, [workOrders, totalAssignedCount]);

  // Real repair resolution trend from work orders
  const velocityTrend: TrendDataPoint[] = useMemo(() => {
    if (workOrders.length === 0) return [];
    return [
      { label: 'Assigned', series1: totalAssignedCount, series2: activeCount },
      { label: 'Completed', series1: completedCount, series2: overdueRepairs.length },
    ];
  }, [workOrders, totalAssignedCount, activeCount, completedCount, overdueRepairs.length]);

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Technician Field Workbench
          ========================================================================= */}
      <DashboardHeader
        title="Technician Field Workbench"
        subtitle={`Dispatched maintenance work orders, SLA timers & parts reservation tracking • ${user?.fullName || 'Technician'}`}
        badge="EXECUTION QUEUE"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/work-orders"
              className="flex items-center gap-1.5 px-3 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-xs font-bold border border-amber-500 shadow-2xs transition"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>All Work Orders</span>
            </Link>
            <button
              onClick={fetchWorkOrders}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchWorkOrders}
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
        {/* Card 1: Assigned Work Orders */}
        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Assigned Work Orders"
          value={totalAssignedCount}
          subtitle={`${completedCount} Completed`}
        />

        {/* Card 2: Active In-Progress Repairs */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Active In-Progress"
          value={activeCount}
          subtitle={activeCount > 0 ? 'Under Repair' : 'Queue Clear'}
          trend={activeCount > 0 ? 'In Progress' : 'Optimal'}
          trendColor="bg-blue-50 text-blue-700 border border-blue-200"
        />

        {/* Card 3: Pending Acceptance */}
        <TopKPICard
          icon={AlertTriangle}
          iconBgColor="bg-red-100"
          iconColor="text-red-800"
          label="Pending Acceptance"
          value={pendingCount}
          subtitle={pendingCount > 0 ? 'Immediate Action' : 'All Accepted'}
          trend={pendingCount > 0 ? 'Action Needed' : 'Clear'}
          trendColor={
            pendingCount > 0
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }
        />

        {/* Card 4: Spare Parts Consumed */}
        <TopKPICard
          icon={Package}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-800"
          label="Parts Consumed"
          value={partsConsumedCount}
          subtitle="Linked to Orders"
        />

        {/* Card 5: On-Time SLA Rate */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="SLA Compliance"
          value={completedCount > 0 ? `${onTimeSlaRate}%` : 'N/A'}
          subtitle={completedCount > 0 ? `${onTimeCompleted} of ${completedCount} On-Time` : 'No Completed Orders'}
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Real Database Records)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Work Order Type Donut */}
        <MachineStatusDonut
          title="Work Order Categories"
          totalLabel="Orders"
          totalCount={totalAssignedCount}
          segments={categorySegments}
          emptyMessage="No work orders dispatched to technician"
          loading={loading}
        />

        {/* Card 2: Repair Resolution Velocity Spline */}
        <MaintenanceTrendChart
          title="Repair Execution Velocity"
          series1Name="Total Volume"
          series2Name="Active Repairs"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={velocityTrend}
          loading={loading}
          emptyMessage="No repair velocity records available"
        />

        {/* Card 3: SLA Performance & MTTR Gauge */}
        <DowntimeAnalysisCard
          title="SLA Compliance & MTTR"
          rateValue={completedCount > 0 ? `${onTimeSlaRate}%` : '0%'}
          rateLabel="On-Time SLA"
          percentage={onTimeSlaRate}
          gaugeColor="#10B981"
          loading={loading}
          emptyMessage="No completed repair records"
          metrics={[
            {
              icon: Clock,
              label: 'Average MTTR',
              value: avgMTTRMinutes > 0 ? `${avgMTTRMinutes} Mins` : 'N/A',
              change: avgMTTRMinutes > 0 ? 'Active Wrench' : 'No Data',
              isPositiveChange: true,
            },
            {
              icon: CheckCircle2,
              label: 'Overdue Work Orders',
              value: `${overdueRepairs.length} Tasks`,
              change: overdueRepairs.length === 0 ? 'On Schedule' : 'Overdue',
              isPositiveChange: overdueRepairs.length === 0,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): My Dispatched Work Orders from Database */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                My Dispatched Work Orders
              </h3>
            </div>
            <Link
              to="/work-orders"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">WO Code</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Fault / Task</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading dispatched work orders...
                    </td>
                  </tr>
                ) : workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No maintenance work orders assigned to you.
                    </td>
                  </tr>
                ) : (
                  workOrders.slice(0, 6).map((wo: any) => {
                    const woCode = wo.wo_number || (typeof wo.id === 'string' ? wo.id.slice(0, 8) : `WO-${wo.id}`);
                    const machineCode = wo.machine?.code || wo.machine_code || 'Asset';
                    const titleStr = wo.work_instructions || wo.title || wo.diagnosis || 'Mechanical Service';
                    const priority = (wo.priority || 'medium').toLowerCase();
                    const statusStr = (wo.status || 'assigned').toLowerCase();

                    return (
                      <tr key={wo.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                          <Link to={`/work-orders/${wo.id}`} className="hover:text-amber-600 transition">
                            {woCode}
                          </Link>
                        </td>
                        <td className="py-3 px-3 font-semibold text-zinc-700">
                          {machineCode}
                        </td>
                        <td className="py-3 px-3 text-zinc-800 font-medium max-w-[140px] truncate" title={titleStr}>
                          {titleStr}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-semibold text-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                priority === 'critical'
                                  ? 'bg-red-500 animate-pulse'
                                  : priority === 'high'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span className="capitalize">{priority}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border capitalize ${
                              statusStr === 'in_progress'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : statusStr === 'assigned'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : statusStr === 'verified_closed' || statusStr === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}
                          >
                            {statusStr.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {statusStr === 'assigned' ? (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'accept')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                            >
                              Accept
                            </button>
                          ) : statusStr === 'accepted' ? (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'start_repair')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                            >
                              Start
                            </button>
                          ) : (
                            <Link
                              to={`/work-orders/${wo.id}`}
                              className="text-[11px] font-bold text-zinc-500 hover:text-black transition"
                            >
                              Details →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~40%): Assigned Preventive Maintenance Schedule from Database */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Scheduled Maintenance Due
              </h3>
            </div>
            <Link
              to="/pm"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">PM Task</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading maintenance schedules...
                    </td>
                  </tr>
                ) : upcomingPMs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No upcoming preventive maintenance tasks due.
                    </td>
                  </tr>
                ) : (
                  upcomingPMs.slice(0, 5).map((item: any, idx: number) => {
                    const machineName = item.machine_code || item.machine?.code || item.machine_name || 'Asset';
                    const taskName = item.title || item.task_name || 'PM Service';
                    const dueDateStr = item.next_pm_date
                      ? new Date(item.next_pm_date).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Scheduled';
                    const statusStr = item.status === 'overdue' ? 'Overdue' : 'Scheduled';

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                          {machineName}
                        </td>
                        <td className="py-3 px-3 text-zinc-800 font-medium truncate max-w-[140px]" title={taskName}>
                          {taskName}
                        </td>
                        <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                          {dueDateStr}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                              statusStr === 'Overdue'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {statusStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
