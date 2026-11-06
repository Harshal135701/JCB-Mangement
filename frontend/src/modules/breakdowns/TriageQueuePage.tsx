import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BreakdownReportModal } from './components/BreakdownReportModal';
import { 
  AlertCircle, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X, 
  Wrench, 
  Play, 
  Search,
  Check,
  AlertTriangle,
  FileText,
  RefreshCw,
  Eye,
  ArrowRight,
  Filter,
  ExternalLink,
  ChevronRight,
  Thermometer,
  Gauge,
  Activity,
  History,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TriageQueuePage: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [detailComplaint, setDetailComplaint] = useState<any | null>(null);
  const [assignComplaint, setAssignComplaint] = useState<any | null>(null);
  const [priorityComplaint, setPriorityComplaint] = useState<any | null>(null);
  const [rejectComplaint, setRejectComplaint] = useState<any | null>(null);
  const [infoComplaint, setInfoComplaint] = useState<any | null>(null);

  // Form States
  const [assignForm, setAssignForm] = useState({
    technician_id: '',
    sla_hours: 2,
    work_instructions: 'Diagnose machine fault, isolate hydraulic pressure lines, verify LOTO safety interlocks, and restore machine cycle time tolerances.',
    is_major_breakdown: false,
  });

  const [newPriority, setNewPriority] = useState('critical');
  const [rejectReason, setRejectReason] = useState('');
  const [infoRemarks, setInfoRemarks] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [ticketsRes, machRes] = await Promise.all([
        apiClient.get('/breakdowns?limit=100'),
        apiClient.get('/machines?limit=100').catch(() => ({ data: { data: [] } })),
      ]);
      setBreakdowns(ticketsRes.data?.data || []);
      setMachines(machRes.data?.data || []);

      // Fetch technicians
      try {
        const usersRes = await apiClient.get('/auth/users?role=technician').catch(() => null);
        if (usersRes?.data?.success && Array.isArray(usersRes.data.data)) {
          const techs = usersRes.data.data.filter((u: any) => u.role === 'technician' && u.is_active !== false);
          setTechnicians(techs);
          if (techs.length > 0 && !assignForm.technician_id) {
            setAssignForm((prev) => ({ ...prev, technician_id: techs[0].id }));
          }
        } else {
          // Fallback verified seed technicians
          const fallback = [
            { id: 'f0000000-0000-0000-0000-000000000003', full_name: 'Sunil Yadav', employee_code: 'EMP-TCH-001', department: 'Mechanical Maintenance' },
            { id: 'f0000000-0000-0000-0000-000000000004', full_name: 'Anil Kumar', employee_code: 'EMP-TCH-002', department: 'Electrical & PLC Automation' },
            { id: 'f0000000-0000-0000-0000-000000000005', full_name: 'Suresh Patil', employee_code: 'EMP-TCH-003', department: 'Hydraulics & Tooling' },
            { id: 'f0000000-0000-0000-0000-000000000006', full_name: 'Vikram Singh', employee_code: 'EMP-TCH-004', department: 'Robotic Welding Maintenance' },
          ];
          setTechnicians(fallback);
          if (!assignForm.technician_id) {
            setAssignForm((prev) => ({ ...prev, technician_id: fallback[0].id }));
          }
        }
      } catch {
        // Ignored
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load triage queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter complaints
  const filteredBreakdowns = breakdowns.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (priorityFilter && b.priority !== priorityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = (b.complaint_number || '').toLowerCase().includes(q);
      const matchMachine = (b.machine_code || '').toLowerCase().includes(q) || (b.machine_name || '').toLowerCase().includes(q);
      const matchTitle = (b.problem_title || '').toLowerCase().includes(q);
      if (!matchNum && !matchMachine && !matchTitle) return false;
    }
    return true;
  });

  // Action 1: Acknowledge Complaint
  const handleAcknowledge = async (complaintId: string) => {
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${complaintId}/acknowledge`, {
        remarks: 'Acknowledged by maintenance triage supervisor. Dispatching field crew.',
      });
      if (res.data?.success) {
        setSuccessMsg(`Complaint ${res.data.data?.complaint_number || ''} acknowledged.`);
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to acknowledge breakdown.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 2: Update Priority
  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priorityComplaint) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${priorityComplaint.id}/priority`, {
        priority: newPriority,
      });
      if (res.data?.success) {
        setSuccessMsg(`Priority updated to ${newPriority.toUpperCase()} for ${priorityComplaint.complaint_number}.`);
        setPriorityComplaint(null);
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update priority.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 3: Convert Breakdown to Work Order / Dispatch Technician
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignComplaint || !assignForm.technician_id) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await apiClient.post(`/breakdowns/${assignComplaint.id}/convert-to-work-order`, {
        technician_id: assignForm.technician_id,
        sla_hours: Number(assignForm.sla_hours) || 2,
        work_instructions: assignForm.work_instructions,
        is_major_breakdown: Boolean(assignForm.is_major_breakdown),
      });

      if (res.data?.success) {
        const woNumber = res.data.data?.workOrder?.wo_number || 'WO-CREATED';
        setSuccessMsg(`Work Order ${woNumber} generated and dispatched! Technician notified.`);
        setAssignComplaint(null);
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert complaint to work order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 4: Reject Breakdown
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectComplaint || !rejectReason.trim()) {
      setError('Rejection reason is mandatory.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${rejectComplaint.id}/reject`, {
        rejection_reason: rejectReason.trim(),
      });
      if (res.data?.success) {
        setSuccessMsg(`Breakdown complaint ${rejectComplaint.complaint_number} rejected. Machine status verified.`);
        setRejectComplaint(null);
        setRejectReason('');
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject complaint.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 5: Request Additional Info
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!infoComplaint || !infoRemarks.trim()) {
      setError('Remarks are mandatory when requesting information.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.post(`/breakdowns/${infoComplaint.id}/request-information`, {
        remarks: infoRemarks.trim(),
      });
      if (res.data?.success) {
        setSuccessMsg(`Information requested for ${infoComplaint.complaint_number}. Operator notified.`);
        setInfoComplaint(null);
        setInfoRemarks('');
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request information.');
    } finally {
      setActionLoading(false);
    }
  };

  // KPI counters
  const newCount = breakdowns.filter((b) => b.status === 'new').length;
  const pendingCount = breakdowns.filter((b) => b.status === 'pending_review').length;
  const convertedCount = breakdowns.filter((b) => b.status === 'work_order_created').length;
  const criticalCount = breakdowns.filter((b) => b.priority === 'critical' && b.status !== 'closed' && b.status !== 'rejected').length;

  return (
    <div className="space-y-6 min-h-full">
      {/* Title & Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              Breakdown Triage & Dispatch Console
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Manager Command
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Review shop floor stoppage complaints, acknowledge alerts, update priority, and convert to allocated Work Orders.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Link
            to="/work-orders"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Work Orders Master</span>
          </Link>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Fault</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-800 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-black text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* New Complaints */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>New Unread</span>
            <AlertCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-blue-800">{newCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">tickets</span>
          </div>
          <div className="text-[10px] text-blue-700 font-bold mt-1">Requires Manager Ack</div>
        </div>

        {/* Pending Review / Acked */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>In Triage / Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">{pendingCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">tickets</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-1">Ready for Tech Dispatch</div>
        </div>

        {/* Converted to Work Orders */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Converted to WO</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-700">{convertedCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">orders</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">Active Maintenance WOs</div>
        </div>

        {/* Critical Line Stoppages */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Critical P0 Stoppages</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-red-700">{criticalCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">critical</span>
          </div>
          <div className="text-[10px] text-red-700 font-bold mt-1">Immediate SLA Clock Active</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by ticket #, machine code, or problem title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow transition"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="pending_review">Pending Review</option>
            <option value="work_order_created">Work Order Created</option>
            <option value="rejected">Rejected</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(search || statusFilter || priorityFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-zinc-700 text-xs font-bold rounded-xl transition"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400 font-bold uppercase tracking-wider space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-jcb-yellowDark mx-auto" />
            <p>Loading Breakdown Triage Complaints...</p>
          </div>
        ) : filteredBreakdowns.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-400 font-bold space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-zinc-600 font-black uppercase">No Complaints in Current Filter</p>
            <p className="text-zinc-400 font-medium">All shop floor equipment operating within acceptable parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="py-3.5 px-4">Ticket #</th>
                  <th className="py-3.5 px-4">Machine Asset</th>
                  <th className="py-3.5 px-4">Problem / Symptoms</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Reported By / Shift</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBreakdowns.map((t) => {
                  const isNew = t.status === 'new';
                  const isPending = t.status === 'pending_review';
                  const isConverted = t.status === 'work_order_created';
                  const isRejected = t.status === 'rejected';
                  const isClosed = t.status === 'closed';

                  return (
                    <tr key={t.id} className="hover:bg-amber-50/20 transition group">
                      {/* Ticket # */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setDetailComplaint(t)}
                          className="font-mono font-black text-zinc-950 hover:text-amber-800 transition text-left cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{t.complaint_number}</span>
                          <Eye className="w-3 h-3 text-zinc-400 group-hover:text-zinc-700" />
                        </button>
                        <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                          {new Date(t.reported_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Machine Asset */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{t.machine_code}</div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[150px]">{t.machine_name}</div>
                        <div className="text-[10px] text-zinc-400">{t.shop_name || 'Bay 1'}</div>
                      </td>

                      {/* Problem Title & Category */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-bold text-zinc-900 truncate" title={t.problem_title}>
                          {t.problem_title}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5" title={t.description}>
                          {t.description}
                        </div>
                        <span className="inline-block mt-1 text-[9px] uppercase font-bold text-zinc-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          {t.issue_category || 'Mechanical'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <StatusBadge status={t.priority} />
                          {isManagerOrAdmin && !isClosed && !isRejected && (
                            <button
                              onClick={() => {
                                setPriorityComplaint(t);
                                setNewPriority(t.priority);
                              }}
                              className="text-[10px] text-zinc-400 hover:text-black font-bold ml-1 cursor-pointer"
                              title="Edit Priority"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Reported By & Shift */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{t.reported_by_name || 'Operator'}</div>
                        <div className="text-[11px] text-zinc-500">{t.shift || 'Shift A'}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Triage Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. View Details */}
                          <button
                            onClick={() => setDetailComplaint(t)}
                            className="p-1.5 hover:bg-slate-100 text-zinc-600 rounded-lg transition"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* 2. Manager Actions */}
                          {isManagerOrAdmin && (
                            <>
                              {isNew && (
                                <button
                                  onClick={() => handleAcknowledge(t.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-lg border border-blue-200 transition cursor-pointer"
                                  title="Acknowledge Complaint"
                                >
                                  Ack
                                </button>
                              )}

                              {!isConverted && !isClosed && !isRejected && (
                                <>
                                  <button
                                    onClick={() => {
                                      setAssignComplaint(t);
                                      setAssignForm((prev) => ({
                                        ...prev,
                                        is_major_breakdown: t.priority === 'critical',
                                      }));
                                    }}
                                    className="px-3 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black uppercase rounded-lg border border-amber-500 shadow-xs transition cursor-pointer flex items-center gap-1"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>Dispatch Tech</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setInfoComplaint(t);
                                      setInfoRemarks('');
                                    }}
                                    className="p-1.5 hover:bg-slate-100 text-zinc-500 hover:text-black rounded-lg transition"
                                    title="Request Additional Information"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRejectComplaint(t);
                                      setRejectReason('');
                                    }}
                                    className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-700 rounded-lg transition"
                                    title="Reject Breakdown"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {isConverted && (
                                <Link
                                  to="/work-orders"
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg border border-emerald-300 transition flex items-center gap-1"
                                >
                                  <span>View WO</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </>
                          )}
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

      {/* MODAL 1: Detail Complaint Inspection */}
      {detailComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-jcb-yellow">
                  {detailComplaint.complaint_number}
                </span>
                <StatusBadge status={detailComplaint.status} />
                <StatusBadge status={detailComplaint.priority} />
              </div>
              <button onClick={() => setDetailComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Problem Title & Description */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Problem Summary:</span>
                <h4 className="font-bold text-zinc-950 text-sm">{detailComplaint.problem_title}</h4>
                <p className="text-zinc-700 font-medium mt-1">{detailComplaint.description}</p>
              </div>

              {/* Machine Details */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Target Machine</span>
                  <p className="font-bold text-zinc-900">{detailComplaint.machine_code} - {detailComplaint.machine_name}</p>
                  <p className="text-[11px] text-zinc-500">{detailComplaint.bay_line_location || 'Bay 1'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Plant / Facility</span>
                  <p className="font-bold text-zinc-900">{detailComplaint.plant_name || 'Ballabgarh Works'}</p>
                  <p className="text-[11px] text-zinc-500">{detailComplaint.shop_name}</p>
                </div>
              </div>

              {/* Telemetry Readings at breakdown */}
              {(detailComplaint.pressure || detailComplaint.temperature || detailComplaint.hour_meter_reading) && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold uppercase text-amber-900 block mb-2">
                    Reported Gauges & Telemetry
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {detailComplaint.pressure && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Gauge className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-zinc-900">{detailComplaint.pressure} Bar</span>
                      </div>
                    )}
                    {detailComplaint.temperature && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Thermometer className="w-4 h-4 text-amber-600" />
                        <span className="font-bold text-zinc-900">{detailComplaint.temperature} °C</span>
                      </div>
                    )}
                    {detailComplaint.hour_meter_reading && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Clock className="w-4 h-4 text-zinc-600" />
                        <span className="font-bold text-zinc-900">{detailComplaint.hour_meter_reading} hrs</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reported By Info */}
              <div className="grid grid-cols-2 gap-3 py-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Reported By</span>
                  <p className="font-bold text-zinc-900">{detailComplaint.reported_by_name || 'Operator'}</p>
                  <p className="text-[11px] text-zinc-500">{detailComplaint.reported_by_code}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400">Timestamp</span>
                  <p className="font-bold text-zinc-900">{new Date(detailComplaint.reported_at || detailComplaint.created_at).toLocaleString()}</p>
                  <p className="text-[11px] text-zinc-500">Shift: {detailComplaint.shift || 'Shift A'}</p>
                </div>
              </div>

              {/* Manager Remarks if present */}
              {detailComplaint.manager_remarks && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] font-bold uppercase text-blue-900 block mb-1">
                    Management Logged Remarks:
                  </span>
                  <p className="font-semibold text-blue-950">{detailComplaint.manager_remarks}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDetailComplaint(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-white"
              >
                Close
              </button>

              {isManagerOrAdmin && detailComplaint.status !== 'work_order_created' && detailComplaint.status !== 'closed' && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignComplaint(detailComplaint);
                    setDetailComplaint(null);
                  }}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Dispatch Technician
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Convert to Work Order & Assign Technician */}
      {assignComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Convert Complaint & Dispatch Work Order
                </h3>
              </div>
              <button onClick={() => setAssignComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="font-mono font-bold text-zinc-400 text-[10px]">CMP: {assignComplaint.complaint_number}</span>
                <p className="font-black text-zinc-900">{assignComplaint.problem_title}</p>
                <p className="text-zinc-500 font-medium">Machine: {assignComplaint.machine_code} ({assignComplaint.machine_name})</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Assign Maintenance Technician *
                </label>
                <select
                  required
                  value={assignForm.technician_id}
                  onChange={(e) => setAssignForm({ ...assignForm, technician_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.employee_code || 'TECH'}) - {t.department || 'Mechanical'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Target Resolution SLA Duration *
                </label>
                <select
                  value={assignForm.sla_hours}
                  onChange={(e) => setAssignForm({ ...assignForm, sla_hours: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value={1}>1 Hour (Critical Line Stop SLA)</option>
                  <option value={2}>2 Hours (Standard Breakdown SLA)</option>
                  <option value={4}>4 Hours (Complex Electrical / Hydraulic Repair)</option>
                  <option value={8}>8 Hours (Full Shift Diagnostic)</option>
                  <option value={24}>24 Hours (Major Overhaul)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Work Instructions & Safety SOP
                </label>
                <textarea
                  rows={2}
                  value={assignForm.work_instructions}
                  onChange={(e) => setAssignForm({ ...assignForm, work_instructions: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  id="majorBreakdown"
                  checked={assignForm.is_major_breakdown}
                  onChange={(e) => setAssignForm({ ...assignForm, is_major_breakdown: e.target.checked })}
                  className="w-4 h-4 text-jcb-yellow rounded border-slate-300 focus:ring-amber-400"
                />
                <label htmlFor="majorBreakdown" className="text-xs font-bold text-amber-950">
                  Tag as Major Breakdown (Line Stoppage / Bottleneck)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignComplaint(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Authorize & Dispatch WO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Priority */}
      {priorityComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Update Complaint Priority
              </h3>
              <button onClick={() => setPriorityComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePrioritySubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Adjust severity rating for ticket <strong className="text-zinc-900">{priorityComplaint.complaint_number}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  New Priority Rating
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="critical">Critical (Line Stoppage)</option>
                  <option value="high">High (Production Impaired)</option>
                  <option value="medium">Medium (Degraded Performance)</option>
                  <option value="low">Low (Minor Noise / Oil Seep)</option>
                </select>
              </div>

              {newPriority === 'critical' && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[11px] font-bold">
                  Escalating to CRITICAL immediately triggers real-time alerts to plant leadership.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPriorityComplaint(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Update Priority
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Reject Complaint */}
      {rejectComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                Reject Breakdown Complaint
              </h3>
              <button onClick={() => setRejectComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Rejecting ticket <strong className="text-zinc-900">{rejectComplaint.complaint_number}</strong> on machine <strong className="text-zinc-900">{rejectComplaint.machine_code}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Rejection Reason (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. False alarm; machine sensor was calibrated during changeover and is operating normally."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-zinc-500">
                If no other active complaints exist for this asset, machine status will be automatically restored to <strong>Running</strong>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectComplaint(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Request Additional Information */}
      {infoComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Request Additional Information
              </h3>
              <button onClick={() => setInfoComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInfoSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Prompt operator for more technical details on ticket <strong className="text-zinc-900">{infoComplaint.complaint_number}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Manager Information Request *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Please verify hydraulic gauge reading and specify which axis servo error code was displayed."
                  value={infoRemarks}
                  onChange={(e) => setInfoRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInfoComplaint(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Breakdown Modal */}
      <BreakdownReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={() => {
          setSuccessMsg('Breakdown complaint registered! Triage console updated.');
          fetchData();
        }}
      />
    </div>
  );
};
