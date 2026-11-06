import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  PackageX, 
  RefreshCw, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Check,
  Play,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      setError('');
      // Backend automatically scopes to assigned_technician_id = req.user.id
      const res = await apiClient.get('/work-orders?limit=50');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWorkOrders(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load technician work orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleQuickMilestone = async (woId: string, action: string) => {
    try {
      setActionLoading(true);
      setActionSuccess('');
      setError('');
      const res = await apiClient.post(`/work-orders/${woId}/milestone`, { action });
      if (res.data?.success) {
        setActionSuccess(`Milestone '${action}' recorded successfully!`);
        fetchWorkOrders();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to record milestone ${action}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Group work orders by status
  const pendingAcceptance = workOrders.filter((wo) => wo.status === 'assigned');
  const activeRepairs = workOrders.filter((wo) => ['in_progress', 'under_diagnosis', 'accepted', 'scheduled'].includes(wo.status));
  const waitingPartsTasks = workOrders.filter((wo) => wo.status === 'waiting_for_parts');
  const submittedVerification = workOrders.filter((wo) => wo.status === 'submitted_verification');
  const closedTasks = workOrders.filter((wo) => ['verified_closed', 'completed'].includes(wo.status));

  return (
    <div className="space-y-6 min-h-full">
      {/* Title & Status Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              Technician Field Workbench
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Execution Queue
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Logged in as <strong className="text-zinc-900">{user?.fullName}</strong> ({user?.employeeCode || 'TECH-01'}). Dispatched maintenance orders and active SLA timers.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Link
            to="/work-orders"
            className="flex items-center gap-2 px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>All Work Orders</span>
          </Link>

          <button
            onClick={fetchWorkOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span>Refresh Tasks</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-800 hover:text-black">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-black text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Pending Acceptance */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Pending Acceptance</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-blue-800">{pendingAcceptance.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">tasks</span>
          </div>
          <div className="text-[10px] text-blue-700 font-bold mt-1">Requires Initial Ack</div>
        </div>

        {/* Active Repairs */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Active Repairs</span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">{activeRepairs.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">active</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-1">Diagnosing / Working</div>
        </div>

        {/* Waiting For Parts */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Waiting for Parts</span>
            <PackageX className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-red-700">{waitingPartsTasks.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">paused</span>
          </div>
          <div className="text-[10px] text-red-700 font-bold mt-1">Spares on Hold</div>
        </div>

        {/* Submitted for Verification */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Awaiting Verification</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-700">{submittedVerification.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">in review</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">Manager Sign-off Pending</div>
        </div>
      </div>

      {/* Assigned Tasks Data Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              My Dispatched Work Orders Queue ({workOrders.length})
            </h3>
            <p className="text-xs text-zinc-500 font-medium">
              Orders automatically filtered to your authenticated technician ID
            </p>
          </div>
          <Link
            to="/work-orders"
            className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-1 uppercase tracking-wider"
          >
            <span>Open Work Order Master</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-400 font-bold uppercase tracking-wider">
            Loading technician assignments...
          </div>
        ) : workOrders.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">No Pending Work Orders</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
              You have no active maintenance tickets assigned at this moment. New breakdown dispatches will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="pb-3">WO Number</th>
                  <th className="pb-3">Machine</th>
                  <th className="pb-3">Problem / Instructions</th>
                  <th className="pb-3">Priority</th>
                  <th className="pb-3">Milestone Status</th>
                  <th className="pb-3">SLA Deadline</th>
                  <th className="pb-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {workOrders.map((wo) => {
                  const isSlaOverdue = wo.sla_deadline && new Date(wo.sla_deadline) < new Date() && wo.status !== 'verified_closed';
                  const isAssigned = wo.status === 'assigned';
                  const isAccepted = wo.status === 'accepted';
                  const isDiagnosis = wo.status === 'under_diagnosis';
                  const isInProgress = wo.status === 'in_progress';
                  const isWaitingParts = wo.status === 'waiting_for_parts';
                  const isRework = wo.status === 'rework_required';

                  return (
                    <tr key={wo.id} className="hover:bg-slate-50 transition">
                      {/* WO Number */}
                      <td className="py-3 font-mono font-bold text-zinc-950">
                        <Link to={`/work-orders/${wo.id}`} className="hover:text-amber-800">
                          {wo.wo_number}
                        </Link>
                        {wo.complaint_number && (
                          <span className="block text-[10px] font-mono text-zinc-400">
                            CMP: {wo.complaint_number}
                          </span>
                        )}
                      </td>

                      {/* Machine */}
                      <td className="py-3">
                        <div className="font-bold text-zinc-900">{wo.machine_code}</div>
                        <div className="text-[10px] text-zinc-400 truncate max-w-[130px]">{wo.machine_name}</div>
                      </td>

                      {/* Problem Title */}
                      <td className="py-3 max-w-[200px] truncate text-zinc-700 font-medium" title={wo.problem_title || wo.work_instructions}>
                        {wo.problem_title || wo.work_instructions || 'Mechanical / Electrical Maintenance'}
                      </td>

                      {/* Priority */}
                      <td className="py-3">
                        <StatusBadge status={wo.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3">
                        <StatusBadge status={wo.status} />
                      </td>

                      {/* SLA Deadline */}
                      <td className="py-3">
                        {wo.sla_deadline ? (
                          <div className={`font-mono text-xs ${isSlaOverdue ? 'text-red-700 font-bold' : 'text-zinc-600'}`}>
                            {new Date(wo.sla_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isSlaOverdue && <span className="text-[9px] uppercase ml-1 px-1 py-0.2 bg-red-100 rounded">Overdue</span>}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs">4.0 hrs SLA</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAssigned && (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'ACCEPT')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black uppercase rounded shadow-xs"
                            >
                              Accept
                            </button>
                          )}

                          {isAccepted && (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'ARRIVED')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase rounded shadow-xs"
                            >
                              Arrived
                            </button>
                          )}

                          {isDiagnosis && (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'START_WORK')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black uppercase rounded shadow-xs"
                            >
                              Start
                            </button>
                          )}

                          {isWaitingParts && (
                            <button
                              onClick={() => handleQuickMilestone(wo.id, 'RESUME')}
                              disabled={actionLoading}
                              className="px-2.5 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black uppercase rounded shadow-xs"
                            >
                              Resume
                            </button>
                          )}

                          <Link
                            to={`/work-orders/${wo.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition"
                          >
                            <span>Workspace</span>
                            <ChevronRight className="w-3 h-3 text-zinc-400" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Spares Inventory Search Banner */}
      <div className="p-5 bg-amber-50/50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
            Need Spare Parts for Breakdown Repair?
          </h4>
          <p className="text-xs text-amber-800 font-medium mt-0.5">
            Search 160,000+ catalog SKUs, check warehouse zone and bin locations, or reserve stock.
          </p>
        </div>
        <Link
          to="/inventory"
          className="self-start sm:self-auto px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black rounded-xl uppercase tracking-wider transition shadow-xs flex items-center gap-2"
        >
          <span>Search 160k Spares</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
