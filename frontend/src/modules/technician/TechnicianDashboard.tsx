import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  acceptBreakdownAssignment, 
  rejectBreakdownAssignment 
} from '../../api/assignment';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Wrench, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  RefreshCw, 
  ArrowRight,
  AlertCircle,
  Inbox,
  UserCheck,
  X,
  RotateCcw
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

  // Technician Breakdown Assignments Inbox State
  const [assignedBreakdowns, setAssignedBreakdowns] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentTab, setAssignmentTab] = useState<'pending' | 'accepted'>('pending');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingBreakdown, setRejectingBreakdown] = useState<any | null>(null);
  const [technicianRejectReason, setTechnicianRejectReason] = useState('');
  const [technicianRejectReasonError, setTechnicianRejectReasonError] = useState('');
  const [assignmentNotice, setAssignmentNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);


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

  const fetchTechnicianAssignments = useCallback(async () => {
    try {
      setLoadingAssignments(true);
      const res = await apiClient.get('/breakdowns', {
        params: {
          limit: 50,
          assigned_technician_id: user?.id,
        },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setAssignedBreakdowns(res.data.data);
      } else {
        setAssignedBreakdowns([]);
      }
    } catch (err: any) {
      console.warn('Failed to load technician breakdown assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWorkOrders();
    fetchTechnicianAssignments();
  }, [plant, timeframe, fetchTechnicianAssignments]);

  // Real-time Socket.IO auto-refresh on new assignments and rework requests
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchWorkOrders();
      fetchTechnicianAssignments();
    };
    socket.on('technician:assigned', handleRefresh);
    socket.on('assignment:created', handleRefresh);
    socket.on('assignment:accepted', handleRefresh);
    socket.on('assignment:rejected', handleRefresh);
    socket.on('assignment:withdrawn', handleRefresh);
    socket.on('work_order:rework_required', handleRefresh);
    socket.on('work_order:reopened', handleRefresh);
    socket.on('work_order:closed', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('technician:assigned', handleRefresh);
      socket.off('assignment:created', handleRefresh);
      socket.off('assignment:accepted', handleRefresh);
      socket.off('assignment:rejected', handleRefresh);
      socket.off('assignment:withdrawn', handleRefresh);
      socket.off('work_order:rework_required', handleRefresh);
      socket.off('work_order:reopened', handleRefresh);
      socket.off('work_order:closed', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, plant, timeframe, fetchTechnicianAssignments]);

  const handleAcceptAssignment = async (breakdown: any) => {
    try {
      setActionLoading(true);
      setAssignmentNotice(null);
      const res = await acceptBreakdownAssignment(breakdown.id);
      if (res.success) {
        setAssignmentNotice({
          type: 'success',
          message: res.message || `Assignment for ${breakdown.complaint_number} accepted. You are now responsible for this breakdown.`,
        });
        await fetchTechnicianAssignments();
        setAssignmentTab('accepted');
      }
    } catch (err: any) {
      setAssignmentNotice({
        type: 'error',
        message: err.response?.data?.message || 'Failed to accept breakdown assignment.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (breakdown: any) => {
    setRejectingBreakdown(breakdown);
    setTechnicianRejectReason('');
    setTechnicianRejectReasonError('');
    setRejectModalOpen(true);
  };

  const handleRejectAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technicianRejectReason.trim()) {
      setTechnicianRejectReasonError('A reason explaining why you cannot accept the assignment is mandatory.');
      return;
    }
    if (actionLoading || !rejectingBreakdown) return;

    try {
      setActionLoading(true);
      setAssignmentNotice(null);
      const res = await rejectBreakdownAssignment(rejectingBreakdown.id, technicianRejectReason.trim());
      if (res.success) {
        setAssignmentNotice({
          type: 'info',
          message: res.message || 'Assignment rejected. System will automatically reassign to another eligible technician.',
        });
        setRejectModalOpen(false);
        setRejectingBreakdown(null);
        await fetchTechnicianAssignments();
      }
    } catch (err: any) {
      setTechnicianRejectReasonError(
        err.response?.data?.message || 'Failed to reject assignment.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const pendingAssignments = useMemo(
    () => assignedBreakdowns.filter((b) => (b.assignment_status || '').toLowerCase() === 'pending'),
    [assignedBreakdowns]
  );

  const acceptedAssignments = useMemo(
    () => assignedBreakdowns.filter((b) => (b.assignment_status || '').toLowerCase() === 'accepted'),
    [assignedBreakdowns]
  );


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

      {/* Prominent Pending Breakdown Assignment Alert Banner */}
      {pendingAssignments.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border-2 border-amber-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shrink-0 shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-black text-sm block uppercase tracking-wide text-zinc-950">
                {pendingAssignments.length} Breakdown Assignment(s) Awaiting Your Response
              </span>
              <span className="text-[11px] text-amber-900 font-medium">
                You have been selected by CMMS automatic technician assignment. Review machine breakdown symptoms and accept or decline.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAssignmentTab('pending');
              const el = document.getElementById('assignment-inbox-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 bg-zinc-950 hover:bg-black text-white font-bold rounded-xl text-xs transition shrink-0 cursor-pointer self-start sm:self-center"
          >
            Review Inbox
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
          BREAKDOWN ASSIGNMENT INBOX: Incoming Automatic Breakdown Assignments
          ========================================================================= */}
      <div id="assignment-inbox-section" className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm overflow-hidden">
        {/* Inbox Header */}
        <div className="p-4 sm:p-5 bg-zinc-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-jcb-yellow text-black flex items-center justify-center font-black shadow-xs">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  Breakdown Assignment Inbox
                </h3>
                {pendingAssignments.length > 0 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase rounded-full animate-pulse">
                    {pendingAssignments.length} Pending
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Incoming machine breakdowns allocated via CMMS automatic technician assignment
              </p>
            </div>
          </div>

          {/* Segmented Tabs: Pending vs Accepted */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setAssignmentTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                assignmentTab === 'pending'
                  ? 'bg-jcb-yellow text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending ({pendingAssignments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAssignmentTab('accepted')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                assignmentTab === 'accepted'
                  ? 'bg-jcb-yellow text-black shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accepted ({acceptedAssignments.length})</span>
            </button>
          </div>
        </div>

        {/* Action Notice Message if any */}
        {assignmentNotice && (
          <div
            className={`p-3.5 border-b text-xs font-bold flex items-center justify-between ${
              assignmentNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : assignmentNotice.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {assignmentNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : assignmentNotice.type === 'info' ? (
                <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{assignmentNotice.message}</span>
            </div>
            <button
              onClick={() => setAssignmentNotice(null)}
              className="text-zinc-500 hover:text-black font-bold text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5">
          {loadingAssignments ? (
            <div className="py-12 text-center text-xs text-zinc-400 font-bold flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
              <span>Loading breakdown assignments...</span>
            </div>
          ) : assignmentTab === 'pending' ? (
            pendingAssignments.length === 0 ? (
              <div className="py-10 text-center text-zinc-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="font-bold text-zinc-700 text-sm">No Pending Breakdown Assignments</p>
                <p className="text-xs text-zinc-400">All assigned equipment breakdown tickets have been processed.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {pendingAssignments.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/20 hover:bg-blue-50/40 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-zinc-950 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {b.complaint_number}
                        </span>
                        <StatusBadge status={b.priority} />
                        <span className="text-[10px] uppercase font-bold text-zinc-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {b.issue_category || 'Mechanical'}
                        </span>
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                          <span>Action Required: Accept or Reject</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-500 font-mono">
                        Reported: {new Date(b.reported_at || b.created_at).toLocaleString()} ({b.shift || 'Shift A'})
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Column 1: Machine & Facility */}
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Machine Equipment</span>
                        <p className="font-bold text-zinc-900 text-sm">{b.machine_code} - {b.machine_name}</p>
                        <p className="text-[11px] text-zinc-500">{b.shop_name || 'Shop'} • {b.plant_name || 'Plant'}</p>
                      </div>

                      {/* Column 2: Problem Description */}
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 md:col-span-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Problem Symptoms</span>
                        <p className="font-bold text-zinc-900">{b.problem_title}</p>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{b.description}</p>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-blue-100/60">
                      <div className="text-[11px] text-zinc-500">
                        Reported by: <strong>{b.reported_by_name || 'Operator'}</strong> ({b.reported_by_code})
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => openRejectModal(b)}
                          disabled={actionLoading}
                          className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-700 font-bold rounded-xl text-xs border border-red-200 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>Decline / Reject</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAcceptAssignment(b)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Accept Assignment</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            acceptedAssignments.length === 0 ? (
              <div className="py-10 text-center text-zinc-400 space-y-1">
                <UserCheck className="w-8 h-8 mx-auto text-zinc-300" />
                <p className="font-bold text-zinc-700 text-sm">No Accepted Breakdowns Pending Dispatch</p>
                <p className="text-xs text-zinc-400">Accepted breakdowns convert to work orders upon supervisor dispatch.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {acceptedAssignments.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-zinc-950 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {b.complaint_number}
                        </span>
                        <StatusBadge status={b.priority} />
                        <span className="text-[10px] uppercase font-bold text-zinc-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {b.issue_category || 'Mechanical'}
                        </span>
                        <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Accepted by You</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-500 font-mono">
                        Reported: {new Date(b.reported_at || b.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Machine Equipment</span>
                        <p className="font-bold text-zinc-900">{b.machine_code} - {b.machine_name}</p>
                        <p className="text-[11px] text-zinc-500">{b.shop_name || 'Shop'} • {b.plant_name || 'Plant'}</p>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 md:col-span-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Problem Symptoms</span>
                        <p className="font-bold text-zinc-900">{b.problem_title}</p>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{b.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100/60">
                      <span className="text-[11px] text-emerald-800 font-bold">
                        Responsibility active. Triage supervisor will dispatch work order for spare parts logging.
                      </span>

                      <Link
                        to="/work-orders"
                        className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>Check Work Orders</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
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

      {/* =========================================================================
          TECHNICIAN ASSIGNMENT REJECTION MODAL
          ========================================================================= */}
      {rejectModalOpen && rejectingBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20">
                  <RotateCcw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Decline Breakdown Assignment</h3>
                  <p className="text-xs text-rose-100">
                    Ticket #{rejectingBreakdown.complaint_number || rejectingBreakdown.id?.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectingBreakdown(null);
                  setTechnicianRejectReasonError('');
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRejectAssignmentSubmit} className="p-6 space-y-4">
              {/* Target Breakdown Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-zinc-900">
                    {rejectingBreakdown.machine_code || 'Machine'} — {rejectingBreakdown.machine_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {rejectingBreakdown.priority || 'MEDIUM'}
                  </span>
                </div>
                <p className="text-zinc-600 line-clamp-1">{rejectingBreakdown.problem_title}</p>
                <p className="text-[11px] text-zinc-400">
                  {rejectingBreakdown.shop_name || 'Shop'} • {rejectingBreakdown.plant_name || 'Plant'}
                </p>
              </div>

              {/* Informative notice about auto-reassignment */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Declining this assignment will automatically trigger the system to identify and assign the
                  <strong className="font-semibold text-amber-950"> next eligible technician</strong> in the shop/plant.
                  If no technician is available, it will return to the supervisor triage queue.
                </p>
              </div>

              {/* Error Banner */}
              {technicianRejectReasonError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{technicianRejectReasonError}</span>
                </div>
              )}

              {/* Rejection Reason Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Reason for Declining <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={technicianRejectReason}
                  onChange={(e) => {
                    setTechnicianRejectReason(e.target.value);
                    if (technicianRejectReasonError) setTechnicianRejectReasonError('');
                  }}
                  placeholder="Explain why you cannot take this breakdown (e.g., handling critical emergency on Line 2, missing tooling, shift changeover)..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none"
                  autoFocus
                />
              </div>

              {/* Quick reason templates */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Quick Select Reason
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Engaged in active high-priority emergency repair',
                    'Lacks required specialized tools / diagnostic equipment',
                    'Shift concluding shortly / handover scheduled',
                    'Off-duty / authorized break',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTechnicianRejectReason(preset);
                        if (technicianRejectReasonError) setTechnicianRejectReasonError('');
                      }}
                      className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-zinc-700 rounded-md border border-slate-200 transition text-left cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalOpen(false);
                    setRejectingBreakdown(null);
                    setTechnicianRejectReasonError('');
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !technicianRejectReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-red-500/20"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Reassigning...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm Decline & Reassign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
