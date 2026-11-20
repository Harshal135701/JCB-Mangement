import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  RefreshCw,
  Calendar,
  ExternalLink,
  Activity,
  Layers,
  ArrowRight,
  User,
  AlertCircle,
  FileText,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface MaintenanceProgress {
  status: string;
  stage: string;
  progress_percentage: number;
}

export interface WorkOrderSummary {
  id: string;
  wo_number: string;
  title: string;
  classification: string;
  status: string;
  priority: string;
  technician_name: string | null;
  created_at: string;
  scheduled_sla_target: string | null;
  progress_stage?: string;
  progress_percentage?: number;
  is_major_breakdown?: boolean;
}

export interface UpcomingPMSchedule {
  plan_id: string;
  plan_code: string;
  title: string;
  frequency: string;
  interval_days?: number;
  scheduled_maintenance_date: string | null;
  pm_status: 'Scheduled' | 'Due' | 'Overdue' | 'In Progress' | 'Completed';
  checklist_summary?: any[];
}

export interface MachineMaintenanceOverview {
  machine_id: string;
  machine_code: string;
  name: string;
  category?: string;
  status: string;
  maintenance_condition: 'running' | 'under_maintenance' | 'under_breakdown' | 'awaiting_maintenance';
  bay_line_location?: string;
  operating_hours?: number;
  shop_id?: string;
  shop_name?: string;
  plant_id?: string;
  plant_name?: string;
  active_breakdown: {
    id: string;
    complaint_number: string;
    problem_title: string;
    description: string;
    status: string;
    priority: string;
    reported_at: string;
    assigned_technician_name: string | null;
  } | null;
  active_work_order: WorkOrderSummary | null;
  current_maintenance_progress: MaintenanceProgress | null;
  last_maintenance_date: string | null;
  next_scheduled_maintenance_date: string | null;
  upcoming_pm_schedules: UpcomingPMSchedule[];
}

export interface OperatorConsolidatedMaintenanceStatus {
  operator: {
    id: string;
    employee_code: string;
    role: string;
  };
  permanent_machine: MachineMaintenanceOverview | null;
  temporary_machine: MachineMaintenanceOverview | null;
  has_active_temporary_assignment: boolean;
  summary: {
    assigned_machine_count: number;
    any_in_breakdown: boolean;
    any_under_maintenance: boolean;
  };
}

export const OperatorMaintenanceStatusView: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusData, setStatusData] = useState<OperatorConsolidatedMaintenanceStatus | null>(null);
  const [selectedTab, setSelectedTab] = useState<'permanent' | 'temporary'>('permanent');

  // Secondary data for selected machine
  const [recentWorkOrders, setRecentWorkOrders] = useState<any[]>([]);
  const [recentWOLoading, setRecentWOLoading] = useState(false);

  // Fetch Consolidated Maintenance Status for Operator
  const fetchMaintenanceStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const res = await apiClient.get('/machines/operator/maintenance-status');
      if (res.data?.success && res.data.data) {
        setStatusData(res.data.data);
      } else {
        setError(res.data?.message || 'Failed to load maintenance status.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load operator maintenance status.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMaintenanceStatus();
  }, [fetchMaintenanceStatus]);

  // Determine active machine asset based on selected tab
  const activeMachine: MachineMaintenanceOverview | null = useMemo(() => {
    if (!statusData) return null;
    if (selectedTab === 'temporary') {
      return statusData.temporary_machine || statusData.permanent_machine;
    }
    return statusData.permanent_machine || statusData.temporary_machine;
  }, [statusData, selectedTab]);

  // Auto-select available tab if chosen tab does not have a machine
  useEffect(() => {
    if (statusData) {
      if (selectedTab === 'temporary' && !statusData.temporary_machine && statusData.permanent_machine) {
        setSelectedTab('permanent');
      } else if (selectedTab === 'permanent' && !statusData.permanent_machine && statusData.temporary_machine) {
        setSelectedTab('temporary');
      }
    }
  }, [statusData, selectedTab]);

  // Fetch recent work orders for the currently selected machine
  const fetchRecentWorkOrders = useCallback(async (machineId: string) => {
    if (!machineId) {
      setRecentWorkOrders([]);
      return;
    }
    try {
      setRecentWOLoading(true);
      const res = await apiClient.get('/work-orders', {
        params: {
          machine_id: machineId,
          limit: 6,
          sortBy: 'created_at',
          sortOrder: 'DESC',
        },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRecentWorkOrders(res.data.data);
      } else {
        setRecentWorkOrders([]);
      }
    } catch {
      // Operator work-order retrieval scoped to assigned machine
      setRecentWorkOrders([]);
    } finally {
      setRecentWOLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeMachine?.machine_id) {
      fetchRecentWorkOrders(activeMachine.machine_id);
    } else {
      setRecentWorkOrders([]);
    }
  }, [activeMachine?.machine_id, fetchRecentWorkOrders]);

  // Real-time Socket.IO auto-refresh
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      fetchMaintenanceStatus();
      if (activeMachine?.machine_id) {
        fetchRecentWorkOrders(activeMachine.machine_id);
      }
    };

    socket.on('machine:status_changed', handleRealtimeUpdate);
    socket.on('work_order:status_updated', handleRealtimeUpdate);
    socket.on('work_order:milestone_updated', handleRealtimeUpdate);
    socket.on('work_order:closed', handleRealtimeUpdate);
    socket.on('work_order:reopened', handleRealtimeUpdate);
    socket.on('complaint:created', handleRealtimeUpdate);
    socket.on('complaint:status_updated', handleRealtimeUpdate);
    socket.on('operator:machine_approved', handleRealtimeUpdate);
    socket.on('operator:machine_released', handleRealtimeUpdate);
    socket.on('notification:new', handleRealtimeUpdate);

    return () => {
      socket.off('machine:status_changed', handleRealtimeUpdate);
      socket.off('work_order:status_updated', handleRealtimeUpdate);
      socket.off('work_order:milestone_updated', handleRealtimeUpdate);
      socket.off('work_order:closed', handleRealtimeUpdate);
      socket.off('work_order:reopened', handleRealtimeUpdate);
      socket.off('complaint:created', handleRealtimeUpdate);
      socket.off('complaint:status_updated', handleRealtimeUpdate);
      socket.off('operator:machine_approved', handleRealtimeUpdate);
      socket.off('operator:machine_released', handleRealtimeUpdate);
      socket.off('notification:new', handleRealtimeUpdate);
    };
  }, [socket, fetchMaintenanceStatus, fetchRecentWorkOrders, activeMachine?.machine_id]);

  // Helper date formatter
  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return 'Not Scheduled';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const hasBothMachines = Boolean(statusData?.permanent_machine && statusData?.temporary_machine);

  return (
    <div className="space-y-6 min-h-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 uppercase tracking-tight">
              Maintenance Status & Asset Health
            </h2>
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Operator Read-Only Access</span>
            </span>
          </div>
          <p className="text-xs text-zinc-600 font-medium mt-1">
            Live maintenance condition, active repair milestones, and preventive schedules for your assigned JCB assets.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Socket real-time indicator */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-[11px] font-bold text-zinc-700"
            title={isConnected ? 'Connected to Socket.IO real-time updates' : 'Connecting to real-time gateway...'}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{isConnected ? 'Live Sync' : 'Reconnecting'}</span>
          </div>

          <button
            onClick={() => {
              fetchMaintenanceStatus();
              if (activeMachine?.machine_id) fetchRecentWorkOrders(activeMachine.machine_id);
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Reload maintenance status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-700 hover:text-black text-xs font-bold px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Dual Machine Switcher (When both permanent and approved temporary machines exist) */}
      {hasBothMachines && (
        <div className="bg-slate-50 p-2 rounded-2xl border-2 border-slate-200 flex flex-col sm:flex-row gap-2">
          {/* Permanent Machine Tab */}
          <button
            type="button"
            onClick={() => setSelectedTab('permanent')}
            className={`flex-1 p-3.5 rounded-xl border-2 transition text-left cursor-pointer flex items-center justify-between gap-3 ${
              selectedTab === 'permanent'
                ? 'bg-white border-jcb-yellow shadow-sm ring-2 ring-amber-400/20'
                : 'bg-transparent border-transparent hover:bg-white/60 text-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${
                  selectedTab === 'permanent'
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : 'bg-slate-200 text-zinc-700 border-slate-300'
                }`}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-zinc-950 uppercase">
                    {statusData?.permanent_machine?.machine_code}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-zinc-700 uppercase tracking-wider">
                    Permanent Asset
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 truncate max-w-xs font-medium">
                  {statusData?.permanent_machine?.name}
                </p>
              </div>
            </div>
            <StatusBadge status={statusData?.permanent_machine?.status || 'running'} size="sm" />
          </button>

          {/* Temporary Replacement Machine Tab */}
          <button
            type="button"
            onClick={() => setSelectedTab('temporary')}
            className={`flex-1 p-3.5 rounded-xl border-2 transition text-left cursor-pointer flex items-center justify-between gap-3 ${
              selectedTab === 'temporary'
                ? 'bg-white border-jcb-yellow shadow-sm ring-2 ring-amber-400/20'
                : 'bg-transparent border-transparent hover:bg-white/60 text-zinc-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs border ${
                  selectedTab === 'temporary'
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                    : 'bg-slate-200 text-zinc-700 border-slate-300'
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-zinc-950 uppercase">
                    {statusData?.temporary_machine?.machine_code}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-300">
                    Active Replacement
                  </span>
                </div>
                <p className="text-[11px] text-zinc-600 truncate max-w-xs font-medium">
                  {statusData?.temporary_machine?.name}
                </p>
              </div>
            </div>
            <StatusBadge status={statusData?.temporary_machine?.status || 'running'} size="sm" />
          </button>
        </div>
      )}

      {/* 3. Empty State: No Machine Assigned */}
      {!loading && !activeMachine && (
        <div className="p-10 bg-white rounded-2xl border-2 border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 text-zinc-500 rounded-2xl flex items-center justify-center mx-auto border-2 border-slate-200">
            <Cpu className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
            No Machine Assigned
          </h3>
          <p className="text-xs text-zinc-600 max-w-md mx-auto leading-relaxed">
            You do not currently have a permanent machine or active temporary replacement assigned to your operator account.
            Please contact your shop floor supervisor or plant manager to assign a default machine.
          </p>
          <div className="pt-2">
            <Link
              to="/operator/dashboard"
              className="inline-flex items-center gap-2 bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-black px-4 py-2.5 rounded-xl uppercase tracking-wider transition shadow-xs border border-amber-500"
            >
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. Active Machine Maintenance View */}
      {activeMachine && (
        <div className="space-y-6">
          {/* A. Machine Asset Summary Card */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-700 shrink-0 shadow-xs">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-base font-black text-zinc-950 uppercase">
                      {activeMachine.machine_code}
                    </span>
                    <StatusBadge status={activeMachine.status} size="md" />
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                        selectedTab === 'temporary'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-zinc-700 border-slate-300'
                      }`}
                    >
                      {selectedTab === 'temporary' ? 'Temporary Replacement Asset' : 'Permanent / Default Asset'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 mt-0.5">{activeMachine.name}</h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    {activeMachine.plant_name || 'Plant'} • {activeMachine.shop_name || 'Shop'} •{' '}
                    <span className="font-mono text-zinc-700 font-bold">
                      {activeMachine.bay_line_location || 'Bay / Line Location Unavailable'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Maintenance Condition Indicator */}
              <div className="self-start sm:self-center">
                {activeMachine.maintenance_condition === 'under_breakdown' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs font-black uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse shrink-0" />
                    <span>Breakdown Reported</span>
                  </div>
                )}
                {activeMachine.maintenance_condition === 'under_maintenance' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 text-amber-900 rounded-xl border border-amber-300 text-xs font-black uppercase tracking-wider">
                    <Wrench className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                    <span>Under Active Repair</span>
                  </div>
                )}
                {activeMachine.maintenance_condition === 'awaiting_maintenance' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-900 rounded-xl border border-blue-200 text-xs font-black uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Awaiting Maintenance</span>
                  </div>
                )}
                {activeMachine.maintenance_condition === 'running' && (
                  <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200 text-xs font-black uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Healthy & In Production</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Operating Hours
                </span>
                <span className="text-base font-black text-zinc-950 font-mono mt-0.5 block">
                  {typeof activeMachine.operating_hours === 'number'
                    ? `${activeMachine.operating_hours.toLocaleString()} hrs`
                    : '—'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Machine Category
                </span>
                <span className="text-sm font-black text-zinc-950 truncate mt-0.5 block">
                  {activeMachine.category || 'General Equipment'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Last Maintenance
                </span>
                <span className="text-xs font-black text-zinc-950 font-mono mt-1 block">
                  {formatDate(activeMachine.last_maintenance_date)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Next Scheduled PM
                </span>
                <span className="text-xs font-black text-zinc-950 font-mono mt-1 block">
                  {formatDate(activeMachine.next_scheduled_maintenance_date)}
                </span>
              </div>
            </div>
          </div>

          {/* B. Active Breakdown & Work Order Execution Progress */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">
                  Real-time Operational Status
                </span>
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Active Breakdown & Work Order Execution
                </h3>
              </div>

              {activeMachine.active_work_order && (
                <Link
                  to={`/work-orders/${activeMachine.active_work_order.id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-zinc-900 hover:text-amber-600 uppercase tracking-wider transition"
                >
                  <span>Inspect Timeline</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {/* Sub-Card 1: Active Breakdown Reported */}
            {activeMachine.active_breakdown ? (
              <div className="p-4 bg-red-50/60 rounded-xl border-2 border-red-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                      Problem Report
                    </span>
                    <span className="font-mono text-xs font-black text-zinc-950">
                      {activeMachine.active_breakdown.complaint_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeMachine.active_breakdown.status} size="sm" />
                    <StatusBadge status={activeMachine.active_breakdown.priority} size="sm" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black text-zinc-950">
                    {activeMachine.active_breakdown.problem_title}
                  </h4>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    {activeMachine.active_breakdown.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-red-200/60 text-[11px] text-zinc-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Reported: {formatDateTime(activeMachine.active_breakdown.reported_at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      Technician:{' '}
                      <strong className="text-zinc-900">
                        {activeMachine.active_breakdown.assigned_technician_name || 'Unassigned'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-emerald-950 font-medium">
                  <strong className="font-bold">No Active Breakdown:</strong> Machine is operating normally without
                  unresolved breakdown tickets.
                </div>
              </div>
            )}

            {/* Sub-Card 2: Active Work Order & Progress Percentage */}
            {activeMachine.active_work_order ? (
              <div className="p-5 bg-slate-50 rounded-xl border-2 border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span className="font-mono text-xs font-black text-zinc-950">
                      {activeMachine.active_work_order.wo_number}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-zinc-800">
                      {activeMachine.active_work_order.classification === 'preventive'
                        ? 'Preventive Service'
                        : 'Corrective Repair'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeMachine.active_work_order.status} size="sm" />
                    <StatusBadge status={activeMachine.active_work_order.priority} size="sm" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-black text-zinc-950">{activeMachine.active_work_order.title}</h4>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-700 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
                      <span>{activeMachine.current_maintenance_progress?.stage || 'Maintenance in Progress'}</span>
                    </span>
                    <span className="font-mono font-black text-zinc-950">
                      {activeMachine.current_maintenance_progress?.progress_percentage ?? 25}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-jcb-yellow h-2.5 rounded-full transition-all duration-500 ease-out border-r border-amber-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, activeMachine.current_maintenance_progress?.progress_percentage ?? 25)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-zinc-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      Assigned Specialist:{' '}
                      <strong className="text-zinc-900 font-bold">
                        {activeMachine.active_work_order.technician_name || 'Dispatched Technician'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>
                      SLA Target Deadline:{' '}
                      <strong className="text-zinc-900 font-mono font-bold">
                        {formatDateTime(activeMachine.active_work_order.scheduled_sla_target)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <Info className="w-5 h-5 text-zinc-400 shrink-0" />
                <div className="text-xs text-zinc-600">
                  No active maintenance work orders in progress on this asset.
                </div>
              </div>
            )}
          </div>

          {/* C. Scheduled Preventive Maintenance (PM) Section */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">
                  Planned Reliability Schedule
                </span>
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Preventive Maintenance (PM) Status
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-600">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Next Scheduled: {formatDate(activeMachine.next_scheduled_maintenance_date)}</span>
              </div>
            </div>

            {activeMachine.upcoming_pm_schedules && activeMachine.upcoming_pm_schedules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMachine.upcoming_pm_schedules.map((pm) => (
                  <div
                    key={pm.plan_id || pm.plan_code}
                    className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 space-y-2.5 hover:border-amber-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black text-zinc-950">{pm.plan_code}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                          pm.pm_status === 'Overdue'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : pm.pm_status === 'Due'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {pm.pm_status}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-zinc-900">{pm.title}</h4>

                    <div className="flex items-center justify-between text-[11px] text-zinc-600 pt-2 border-t border-slate-200">
                      <span>Frequency: {pm.frequency}</span>
                      <span>Target: {formatDate(pm.scheduled_maintenance_date)}</span>
                    </div>

                    {pm.checklist_summary && pm.checklist_summary.length > 0 && (
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>{pm.checklist_summary.length} Standard Safety & Inspection Checks</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-zinc-500">
                No upcoming preventive maintenance plans scheduled for this asset.
              </div>
            )}
          </div>

          {/* D. Recent Work Orders & Maintenance History */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">
                  Asset Service History
                </span>
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Recent Work Orders & Maintenance Log
                </h3>
              </div>
            </div>

            {recentWOLoading ? (
              <div className="p-8 text-center text-xs font-bold text-zinc-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
                <span>Loading maintenance records...</span>
              </div>
            ) : recentWorkOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                      <th className="py-2.5 px-3">WO Number</th>
                      <th className="py-2.5 px-3">Problem / Task</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-3">Assigned Tech</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Created Date</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentWorkOrders.map((wo) => (
                      <tr key={wo.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-zinc-950">{wo.wo_number}</td>
                        <td className="py-2.5 px-3 font-medium text-zinc-800 max-w-xs truncate">{wo.title}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-zinc-600">
                          {wo.classification === 'preventive' ? 'PM' : 'Corrective'}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700">{wo.technician_name || '—'}</td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={wo.status} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">
                          {formatDate(wo.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/work-orders/${wo.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-zinc-900 hover:text-amber-600 uppercase tracking-wider"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-zinc-500">
                No prior maintenance work orders recorded for this asset.
              </div>
            )}
          </div>

          {/* E. Security Notice / Read-Only Policy */}
          <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-950 leading-relaxed">
              <strong className="font-bold uppercase tracking-wider block mb-0.5">
                JCB CMMS Security Enforcement
              </strong>
              Operators possess view-only permissions for assigned machinery. Mutation actions (work order dispatch, milestone progression, quality verification, and ticket closure) are strictly restricted to certified maintenance supervisors and technicians.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
