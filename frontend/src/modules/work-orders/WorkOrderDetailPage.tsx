import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Wrench, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Play, 
  Pause, 
  Check, 
  UserCheck, 
  RotateCcw, 
  Package, 
  History, 
  Calendar, 
  Cpu, 
  X, 
  Loader2,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Activity,
  Gauge,
  Thermometer,
  Zap,
  User,
  Info,
  RefreshCw
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';

export const WorkOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';
  const isTechnician = user?.role === 'technician';

  const [workOrder, setWorkOrder] = useState<any | null>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'parts' | 'timeline'>('overview');

  // Modals state
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

  // Form states
  const [completeForm, setCompleteForm] = useState({
    diagnosis: '',
    corrective_action: '',
    affected_component: '',
    fault_category: 'mechanical',
    root_cause_analysis: '',
    technician_remarks: '',
  });

  const [verifyForm, setVerifyForm] = useState({
    result: 'APPROVED' as 'APPROVED' | 'REJECTED',
    remarks: 'Quality test cycle verified. Machine restored to production tolerances.',
  });

  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '14:00',
    notes: 'Scheduled on-site maintenance inspection visit.',
  });

  const [progressForm, setProgressForm] = useState({
    diagnosis: '',
    affected_component: '',
    technician_remarks: '',
    notes: '',
  });

  const [reassignForm, setReassignForm] = useState({
    new_technician_id: '',
    notes: 'Reassigned for specialized mechanical / electrical expertise.',
    work_instructions: '',
  });

  const [techniciansList, setTechniciansList] = useState<any[]>([]);

  const fetchWorkOrderData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const [woRes, partsRes] = await Promise.all([
        apiClient.get(`/work-orders/${id}`),
        apiClient.get(`/work-orders/${id}/parts`).catch(() => ({ data: { data: [] } })),
      ]);

      if (woRes.data?.success) {
        setWorkOrder(woRes.data.data);
      }
      setParts(partsRes.data?.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load work order details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const usersRes = await apiClient.get('/auth/users?role=technician').catch(() => null);
      if (usersRes?.data?.success && Array.isArray(usersRes.data.data)) {
        setTechniciansList(usersRes.data.data);
        if (usersRes.data.data.length > 0 && !reassignForm.new_technician_id) {
          setReassignForm((prev) => ({ ...prev, new_technician_id: usersRes.data.data[0].id }));
        }
      } else {
        // Fallback seed technicians
        const fallback = [
          { id: 'f0000000-0000-0000-0000-000000000003', full_name: 'Sunil Yadav', employee_code: 'EMP-TCH-001', department: 'Mechanical Maintenance' },
          { id: 'f0000000-0000-0000-0000-000000000004', full_name: 'Anil Kumar', employee_code: 'EMP-TCH-002', department: 'Electrical & PLC Automation' },
          { id: 'f0000000-0000-0000-0000-000000000005', full_name: 'Suresh Patil', employee_code: 'EMP-TCH-003', department: 'Hydraulics & Tooling' },
          { id: 'f0000000-0000-0000-0000-000000000006', full_name: 'Vikram Singh', employee_code: 'EMP-TCH-004', department: 'Robotic Welding Maintenance' },
        ];
        setTechniciansList(fallback);
        if (!reassignForm.new_technician_id) {
          setReassignForm((prev) => ({ ...prev, new_technician_id: fallback[0].id }));
        }
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchWorkOrderData();
    if (isManagerOrAdmin) {
      fetchTechnicians();
    }
  }, [id]);

  // Execute Technician Milestone
  const handleMilestoneAction = async (action: string, payload: any = {}) => {
    if (!id) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await apiClient.post(`/work-orders/${id}/milestone`, {
        action,
        ...payload,
      });

      if (res.data?.success) {
        setSuccessMsg(`Milestone '${action}' recorded successfully!`);
        setIsCompleteModalOpen(false);
        setIsScheduleModalOpen(false);
        setIsProgressModalOpen(false);
        await fetchWorkOrderData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to record milestone ${action}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Manager Verification
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (verifyForm.result === 'REJECTED' && !verifyForm.remarks.trim()) {
      setError('Remarks are mandatory when rejecting a work order for rework.');
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await apiClient.post(`/work-orders/${id}/verify`, {
        result: verifyForm.result,
        remarks: verifyForm.remarks.trim(),
      });

      if (res.data?.success) {
        setSuccessMsg(
          verifyForm.result === 'APPROVED'
            ? 'Work order verified and approved. Machine status restored to Running!'
            : 'Work order rejected and returned to technician for rework.'
        );
        setIsVerifyModalOpen(false);
        await fetchWorkOrderData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification submission failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Reassignment
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !reassignForm.new_technician_id) return;

    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await apiClient.post(`/work-orders/${id}/reassign`, {
        new_technician_id: reassignForm.new_technician_id,
        notes: reassignForm.notes,
        work_instructions: reassignForm.work_instructions,
      });

      if (res.data?.success) {
        setSuccessMsg('Work order reassigned successfully to new technician.');
        setIsReassignModalOpen(false);
        await fetchWorkOrderData();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reassignment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !workOrder) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-jcb-yellowDark mx-auto" />
        <h3 className="text-sm font-black uppercase text-zinc-800 tracking-wider">
          Loading Work Order Workspace...
        </h3>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="p-8 bg-white rounded-2xl border-2 border-slate-200 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-600 mx-auto" />
        <h3 className="text-base font-black text-zinc-950 uppercase">Work Order Not Found</h3>
        <p className="text-xs text-zinc-500 max-w-md mx-auto">
          The requested work order could not be located or you lack permissions to view it.
        </p>
        <Link
          to="/work-orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-jcb-yellow text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Work Orders</span>
        </Link>
      </div>
    );
  }

  const isClosed = workOrder.status === 'verified_closed';
  const isSubmitted = workOrder.status === 'submitted_verification';
  const isRework = workOrder.status === 'rework_required';
  const isWaitingParts = workOrder.status === 'waiting_for_parts';
  const isInProgress = workOrder.status === 'in_progress';
  const isDiagnosis = workOrder.status === 'under_diagnosis';
  const isAccepted = workOrder.status === 'accepted';
  const isAssigned = workOrder.status === 'assigned';
  const isScheduled = workOrder.status === 'scheduled';

  // Primary Milestone Stages for Visual Stepper
  const milestoneSteps = [
    { key: 'assigned', label: 'Assigned', icon: UserCheck },
    { key: 'accepted', label: 'Accepted', icon: Check },
    { key: 'scheduled_or_diagnosis', label: 'Arrival / Diagnosis', icon: Activity },
    { key: 'in_progress', label: 'Repair In Progress', icon: Wrench },
    { key: 'submitted_verification', label: 'Verification Pending', icon: ShieldCheck },
    { key: 'verified_closed', label: 'Verified & Closed', icon: CheckCircle2 },
  ];

  const getStepStatus = (stepKey: string) => {
    const statusOrder: Record<string, number> = {
      assigned: 0,
      accepted: 1,
      scheduled: 1,
      under_diagnosis: 2,
      in_progress: 3,
      waiting_for_parts: 3,
      rework_required: 3,
      submitted_verification: 4,
      verified_closed: 5,
    };

    const currentIdx = statusOrder[workOrder.status] ?? 0;

    if (stepKey === 'assigned') return currentIdx >= 0 ? 'completed' : 'pending';
    if (stepKey === 'accepted') return currentIdx >= 1 ? 'completed' : 'pending';
    if (stepKey === 'scheduled_or_diagnosis') return currentIdx >= 2 ? 'completed' : 'pending';
    if (stepKey === 'in_progress') return currentIdx >= 3 ? 'completed' : 'pending';
    if (stepKey === 'submitted_verification') return currentIdx >= 4 ? 'completed' : 'pending';
    if (stepKey === 'verified_closed') return currentIdx >= 5 ? 'completed' : 'pending';

    return 'pending';
  };

  return (
    <div className="space-y-6 min-h-full">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 mb-1">
            <Link to="/work-orders" className="hover:text-black flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Work Orders Master</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-zinc-900">{workOrder.wo_number}</span>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-950 font-mono tracking-tight">
              {workOrder.wo_number}
            </h2>
            <StatusBadge status={workOrder.status} size="md" />
            <StatusBadge status={workOrder.priority} size="md" />
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Target Asset: <strong className="text-zinc-900">{workOrder.machine_code}</strong> ({workOrder.machine_name}) • {workOrder.bay_line_location || workOrder.shop_name}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isManagerOrAdmin && !isClosed && (
            <button
              onClick={() => setIsReassignModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-zinc-800 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Reassign Tech
            </button>
          )}

          <button
            onClick={fetchWorkOrderData}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
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

      {/* Rework Required Notice Banner */}
      {isRework && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 text-xs shadow-xs space-y-1">
          <div className="flex items-center gap-2 font-black uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Rework Requested by Quality Management</span>
          </div>
          <p className="font-medium text-amber-800">
            Manager Remarks: "{workOrder.manager_verification_remarks || 'Inspection failed. Please re-check tolerances and perform secondary test run.'}"
          </p>
        </div>
      )}

      {/* Waiting for Parts Notice Banner */}
      {isWaitingParts && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl text-red-900 text-xs shadow-xs space-y-1">
          <div className="flex items-center gap-2 font-black uppercase tracking-wider">
            <Package className="w-4 h-4 text-red-600" />
            <span>Work Paused: Waiting for Replacement Parts</span>
          </div>
          <p className="font-medium text-red-700">
            Work order execution is on hold pending spares issuance from the warehouse or Purchase Request fulfillment.
          </p>
        </div>
      )}

      {/* Visual Milestone Stepper */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900">
            Milestone Lifecycle Progression
          </h3>
          <span className="text-[11px] font-mono text-zinc-500 font-bold">
            Current: {workOrder.status?.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {milestoneSteps.map((step, idx) => {
            const Icon = step.icon;
            const status = getStepStatus(step.key);
            const isCompleted = status === 'completed';
            const isCurrent = 
              (step.key === 'assigned' && isAssigned) ||
              (step.key === 'accepted' && (isAccepted || isScheduled)) ||
              (step.key === 'scheduled_or_diagnosis' && isDiagnosis) ||
              (step.key === 'in_progress' && (isInProgress || isWaitingParts || isRework)) ||
              (step.key === 'submitted_verification' && isSubmitted) ||
              (step.key === 'verified_closed' && isClosed);

            return (
              <div
                key={step.key}
                className={`p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-jcb-yellowDark bg-amber-50/40 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black text-zinc-400">0{idx + 1}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-jcb-yellow animate-pulse border border-amber-600" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>

                <div className="mt-3">
                  <Icon
                    className={`w-4 h-4 mb-1 ${
                      isCurrent ? 'text-zinc-950' : isCompleted ? 'text-emerald-700' : 'text-zinc-400'
                    }`}
                  />
                  <h4 className="text-xs font-bold text-zinc-900 leading-tight">{step.label}</h4>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Actions Strip (Technician & Manager Workspaces) */}
      <div className="p-5 sm:p-6 bg-zinc-950 text-white rounded-2xl border-2 border-zinc-800 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-jcb-yellow block">
              Action Control Station
            </span>
            <h3 className="text-base font-black tracking-wide uppercase">
              {isClosed ? 'Work Order Verified & Completed' : 'Next Authorized Milestone Action'}
            </h3>
          </div>

          {/* Action Buttons dynamically rendered based on state */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* When Assigned: Technician Accepts or Schedules */}
            {isAssigned && (
              <>
                <button
                  type="button"
                  onClick={() => handleMilestoneAction('ACCEPT')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow border border-amber-500 cursor-pointer"
                >
                  Accept Job (Acknowledge)
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition border border-zinc-700 cursor-pointer"
                >
                  Schedule Visit
                </button>
              </>
            )}

            {/* When Accepted or Scheduled: Technician records site arrival or starts work */}
            {(isAccepted || isScheduled) && (
              <>
                <button
                  type="button"
                  onClick={() => handleMilestoneAction('ARRIVED')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer"
                >
                  Mark Arrived on Site
                </button>
                <button
                  type="button"
                  onClick={() => handleMilestoneAction('START_WORK')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow border border-amber-500 cursor-pointer"
                >
                  Start Work
                </button>
              </>
            )}

            {/* When Under Diagnosis: Start active repair or record progress */}
            {isDiagnosis && (
              <>
                <button
                  type="button"
                  onClick={() => handleMilestoneAction('START_WORK')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow border border-amber-500 cursor-pointer"
                >
                  Start Active Repair
                </button>
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase rounded-xl border border-zinc-700 cursor-pointer"
                >
                  Log Intermediate Findings
                </button>
              </>
            )}

            {/* When In Progress: Pause, Update Progress, Complete */}
            {isInProgress && (
              <>
                <button
                  type="button"
                  onClick={() => handleMilestoneAction('PAUSE', { notes: 'Awaiting spare parts issuance' })}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause (Waiting Spares)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase rounded-xl border border-zinc-700 cursor-pointer"
                >
                  Progress Notes
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(true)}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Repair & Submit</span>
                </button>
              </>
            )}

            {/* When Waiting for Parts: Resume */}
            {isWaitingParts && (
              <button
                type="button"
                onClick={() => handleMilestoneAction('RESUME')}
                disabled={actionLoading}
                className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow border border-amber-500 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-4 h-4" />
                <span>Resume Work</span>
              </button>
            )}

            {/* When Rework Required: Restart Work */}
            {isRework && (
              <button
                type="button"
                onClick={() => handleMilestoneAction('START_WORK')}
                disabled={actionLoading}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow border border-amber-600 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Rework Job</span>
              </button>
            )}

            {/* When Submitted for Verification: Manager Quality Sign-off */}
            {isSubmitted && isManagerOrAdmin && (
              <button
                type="button"
                onClick={() => setIsVerifyModalOpen(true)}
                disabled={actionLoading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Quality Verification & Sign-off</span>
              </button>
            )}

            {isSubmitted && !isManagerOrAdmin && (
              <span className="text-xs text-zinc-400 font-medium italic">
                Awaiting maintenance manager review and production sign-off.
              </span>
            )}

            {isClosed && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-black uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Order Closed • Machine Operational</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Tabs & Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Details / Spare Parts / Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 -mb-[2px] ${
                activeTab === 'overview'
                  ? 'border-jcb-yellow text-zinc-950 font-black'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Order Overview
            </button>
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 -mb-[2px] flex items-center gap-1.5 ${
                activeTab === 'parts'
                  ? 'border-jcb-yellow text-zinc-950 font-black'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>Parts Consumed</span>
              <span className="bg-slate-100 text-zinc-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {parts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition border-b-2 -mb-[2px] flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'border-jcb-yellow text-zinc-950 font-black'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <span>Audit Timeline</span>
              <span className="bg-slate-100 text-zinc-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {workOrder.events?.length || 0}
              </span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Complaint Origin Card */}
              {workOrder.complaint_number && (
                <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-red-100 text-red-800 font-mono text-[10px] font-black px-2 py-0.5 rounded uppercase">
                        CMP Reference
                      </span>
                      <h4 className="text-sm font-black text-zinc-950 font-mono">
                        {workOrder.complaint_number}
                      </h4>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      Reported: {new Date(workOrder.reported_time || workOrder.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                      {workOrder.problem_title}
                    </h5>
                    <p className="text-xs text-zinc-600 mt-1 font-medium bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {workOrder.complaint_description || 'No additional operator observation remarks.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Work Instructions Card */}
              <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs space-y-2">
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-600" />
                  <span>Work Instructions & Mandatory Safety SOP</span>
                </h4>
                <p className="text-xs text-zinc-700 font-medium bg-amber-50/50 p-3.5 rounded-xl border border-amber-200">
                  {workOrder.work_instructions || 'Diagnose machine fault, isolate hydraulic pressure lines, verify LOTO safety interlocks, and restore machine cycle time tolerances.'}
                </p>
              </div>

              {/* Technician Completion Report (if completed or closed) */}
              {(workOrder.diagnosis || workOrder.corrective_action) && (
                <div className="p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Technician Completion & RCA Report</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Technical Diagnosis
                      </span>
                      <p className="font-semibold text-zinc-900">{workOrder.diagnosis}</p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Corrective Action Taken
                      </span>
                      <p className="font-semibold text-zinc-900">{workOrder.corrective_action}</p>
                    </div>

                    {workOrder.affected_component && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          Affected Component
                        </span>
                        <p className="font-semibold text-zinc-900">{workOrder.affected_component}</p>
                      </div>
                    )}

                    {workOrder.fault_category && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                          Fault Classification
                        </span>
                        <p className="font-semibold text-zinc-900 uppercase">{workOrder.fault_category}</p>
                      </div>
                    )}
                  </div>

                  {workOrder.root_cause_analysis && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Root Cause Analysis (5-Why)
                      </span>
                      <p className="font-semibold text-zinc-900">{workOrder.root_cause_analysis}</p>
                    </div>
                  )}

                  {workOrder.technician_remarks && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Technician Closing Remarks
                      </span>
                      <p className="font-semibold text-zinc-900">{workOrder.technician_remarks}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SPARE PARTS */}
          {activeTab === 'parts' && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                    Spare Parts Reserved & Consumed ({parts.length})
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Materials deducted from plant warehouse for this maintenance order
                  </p>
                </div>
                <Link
                  to="/inventory"
                  className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-1 uppercase"
                >
                  <span>160k Catalog</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {parts.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400 font-bold space-y-1">
                  <Package className="w-8 h-8 text-zinc-300 mx-auto mb-1" />
                  <p>No spare parts billed to this work order yet.</p>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    Technicians can request parts from inventory in Phase 4.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                        <th className="pb-2.5">Part #</th>
                        <th className="pb-2.5">Part Name</th>
                        <th className="pb-2.5">Category</th>
                        <th className="pb-2.5">Quantity</th>
                        <th className="pb-2.5">Unit Cost</th>
                        <th className="pb-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 font-mono font-bold text-zinc-900">{p.part_number}</td>
                          <td className="py-2.5 font-bold text-zinc-800">{p.part_name}</td>
                          <td className="py-2.5 text-zinc-500 uppercase text-[11px]">{p.part_category || 'Hydraulics'}</td>
                          <td className="py-2.5 font-mono font-bold">
                            {p.quantity} {p.unit_of_measure || 'NOS'}
                          </td>
                          <td className="py-2.5 font-mono text-zinc-600">₹{p.unit_cost || 0}</td>
                          <td className="py-2.5 font-mono font-bold text-zinc-950 text-right">
                            ₹{(Number(p.quantity) * Number(p.unit_cost || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 space-y-4">
              <div>
                <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                  Audit Ledger & Execution History
                </h4>
                <p className="text-[11px] text-zinc-500 font-medium">
                  Immutable chronological milestones logged during ticket lifecycle
                </p>
              </div>

              {!workOrder.events || workOrder.events.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400 font-bold">
                  No milestone events recorded yet.
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                  {workOrder.events.map((evt: any, idx: number) => (
                    <div key={idx} className="relative flex items-start gap-4 pl-8">
                      <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-jcb-yellowDark" />
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex-1 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-zinc-950 text-[11px]">
                            {evt.event_type}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400 font-bold">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-zinc-600 font-medium">{evt.notes || 'Milestone updated.'}</p>
                        <div className="text-[10px] text-zinc-400 font-bold">
                          By: {evt.performed_by_name || 'System Operator'} ({evt.performed_by_role || 'Technician'})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (1 col): Machine Meta, Technician & Dual Downtime Clocks */}
        <div className="space-y-6">
          {/* Dual Downtime Clocks */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-600" />
              <span>Downtime & Repair Metrics</span>
            </h4>

            <div className="space-y-3">
              {/* Total Downtime */}
              <div className="p-3 bg-red-50/60 rounded-xl border border-red-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-red-800 tracking-wider block">
                    Total Machine Downtime
                  </span>
                  <span className="text-lg font-black text-red-950 font-mono">
                    {workOrder.total_downtime_minutes ? `${workOrder.total_downtime_minutes} mins` : 'Clock Running...'}
                  </span>
                </div>
                <Clock className="w-6 h-6 text-red-400" />
              </div>

              {/* Maintenance Response Time */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider block">
                    Response Arrival Time
                  </span>
                  <span className="text-lg font-black text-blue-950 font-mono">
                    {workOrder.maintenance_response_minutes ? `${workOrder.maintenance_response_minutes} mins` : 'Pending arrival'}
                  </span>
                </div>
                <Zap className="w-6 h-6 text-blue-400" />
              </div>

              {/* Active Repair Time */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">
                    Active Repair Labor
                  </span>
                  <span className="text-lg font-black text-amber-950 font-mono">
                    {workOrder.labour_hours ? `${workOrder.labour_hours} hrs` : `${workOrder.active_repair_minutes || 0} mins`}
                  </span>
                </div>
                <Wrench className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Machine Profile Card */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-zinc-600" />
                <span>Production Machine</span>
              </h4>
              <StatusBadge status={workOrder.machine_status || 'running'} />
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-zinc-500 font-medium">Machine Code</span>
                <span className="font-mono font-black text-zinc-950">{workOrder.machine_code}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-zinc-500 font-medium">Asset Name</span>
                <span className="font-bold text-zinc-900">{workOrder.machine_name}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-zinc-500 font-medium">Category</span>
                <span className="font-semibold text-zinc-800">{workOrder.machine_category || 'CNC Machining'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-zinc-500 font-medium">Criticality</span>
                <span className="font-black text-zinc-950 uppercase">{workOrder.criticality || 'CLASS B'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-zinc-500 font-medium">Shop / Bay</span>
                <span className="font-semibold text-zinc-800">{workOrder.bay_line_location || workOrder.shop_name}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-500 font-medium">Operating Hours</span>
                <span className="font-mono font-bold text-zinc-950">{workOrder.operating_hours || 0} hrs</span>
              </div>
            </div>
          </div>

          {/* Assigned Personnel Card */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-zinc-600" />
              <span>Assigned Personnel</span>
            </h4>

            <div className="space-y-3 text-xs">
              {/* Technician */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Lead Technician
                </span>
                <p className="font-black text-zinc-900 mt-0.5">
                  {workOrder.technician_name || 'Unassigned'}
                </p>
                <p className="text-[11px] font-mono text-zinc-500">
                  {workOrder.technician_code || 'EMP-TCH-001'} • {workOrder.technician_email || ''}
                </p>
              </div>

              {/* Manager */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Authorizing Supervisor
                </span>
                <p className="font-black text-zinc-900 mt-0.5">
                  {workOrder.manager_name || 'Vikas Verma'}
                </p>
                <p className="text-[11px] font-mono text-zinc-500">
                  {workOrder.manager_code || 'EMP-MGR-001'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Complete Repair & Submit for Quality Verification */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Complete Repair & Submit for Quality Verification
                </h3>
              </div>
              <button onClick={() => setIsCompleteModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMilestoneAction('COMPLETE', completeForm);
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Technical Diagnosis *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Blown hydraulic seal on spindle clamp cylinder causing pressure loss..."
                  value={completeForm.diagnosis}
                  onChange={(e) => setCompleteForm({ ...completeForm, diagnosis: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Corrective Action Taken *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Replaced nitrile O-ring seal, bled hydraulic circuit, retightened manifold bolts to 45 Nm..."
                  value={completeForm.corrective_action}
                  onChange={(e) => setCompleteForm({ ...completeForm, corrective_action: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Affected Component
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Spindle Clamp Valve"
                    value={completeForm.affected_component}
                    onChange={(e) => setCompleteForm({ ...completeForm, affected_component: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Fault Classification
                  </label>
                  <select
                    value={completeForm.fault_category}
                    onChange={(e) => setCompleteForm({ ...completeForm, fault_category: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900"
                  >
                    <option value="mechanical">Mechanical</option>
                    <option value="hydraulic">Hydraulic</option>
                    <option value="electrical">Electrical</option>
                    <option value="pneumatic">Pneumatic</option>
                    <option value="electronic">Electronic / Sensor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Root Cause Analysis (RCA)
                </label>
                <input
                  type="text"
                  placeholder="e.g. High ambient temperature caused accelerated thermal degradation of elastomer"
                  value={completeForm.root_cause_analysis}
                  onChange={(e) => setCompleteForm({ ...completeForm, root_cause_analysis: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Technician Closing Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Cycle time verified on dry run. Handover completed."
                  value={completeForm.technician_remarks}
                  onChange={(e) => setCompleteForm({ ...completeForm, technician_remarks: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Submit for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Manager Verification & Approval or Rework */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Manager Quality Verification & Sign-off
                </h3>
              </div>
              <button onClick={() => setIsVerifyModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleVerifySubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Submitted Diagnosis:</span>
                <p className="font-bold text-zinc-900">{workOrder.diagnosis}</p>
                <span className="text-[10px] uppercase font-bold text-zinc-500 mt-1 block">Corrective Action:</span>
                <p className="font-bold text-zinc-900">{workOrder.corrective_action}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2">
                  Verification Decision *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyForm({ ...verifyForm, result: 'APPROVED' })}
                    className={`p-3 rounded-xl border-2 text-xs font-black uppercase flex items-center justify-center gap-2 transition ${
                      verifyForm.result === 'APPROVED'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-200 text-zinc-600 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Approve & Close</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyForm({ ...verifyForm, result: 'REJECTED' })}
                    className={`p-3 rounded-xl border-2 text-xs font-black uppercase flex items-center justify-center gap-2 transition ${
                      verifyForm.result === 'REJECTED'
                        ? 'border-red-600 bg-red-50 text-red-900 shadow-xs'
                        : 'border-slate-200 text-zinc-600 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 text-red-600" />
                    <span>Request Rework</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Manager Verification Remarks {verifyForm.result === 'REJECTED' ? '*' : ''}
                </label>
                <textarea
                  required={verifyForm.result === 'REJECTED'}
                  rows={3}
                  value={verifyForm.remarks}
                  onChange={(e) => setVerifyForm({ ...verifyForm, remarks: e.target.value })}
                  placeholder={
                    verifyForm.result === 'APPROVED'
                      ? 'Confirm physical trial run, cycle time tolerances, and machine return to production.'
                      : 'Specify what failed or needs rework (e.g. pressure fluctuation persists, alignment out of tolerance).'
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`px-5 py-2 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50 ${
                    verifyForm.result === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionLoading ? 'Recording...' : verifyForm.result === 'APPROVED' ? 'Confirm Approval' : 'Send for Rework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reassign Work Order (Manager) */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Reassign Work Order to Technician
                </h3>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Select New Lead Technician *
                </label>
                <select
                  required
                  value={reassignForm.new_technician_id}
                  onChange={(e) => setReassignForm({ ...reassignForm, new_technician_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900"
                >
                  {techniciansList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.employee_code || 'TECH'}) - {t.department || 'Maintenance'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Reassignment Reason / Notes
                </label>
                <textarea
                  rows={2}
                  value={reassignForm.notes}
                  onChange={(e) => setReassignForm({ ...reassignForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Schedule Visit */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Schedule On-Site Maintenance Visit
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMilestoneAction('SCHEDULE', scheduleForm);
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleForm.scheduled_date}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_date: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.scheduled_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_time: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Scheduling Notes
                </label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Progress Update */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Log Intermediate Diagnosis & Progress
              </h3>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleMilestoneAction('PROGRESS', progressForm);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Current Observations / Findings
                </label>
                <textarea
                  rows={2}
                  placeholder="Disassembled pump manifold. Found metal debris in suction strainer."
                  value={progressForm.diagnosis}
                  onChange={(e) => setProgressForm({ ...progressForm, diagnosis: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Inspected Component
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suction Strainer & Check Valve"
                  value={progressForm.affected_component}
                  onChange={(e) => setProgressForm({ ...progressForm, affected_component: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Log Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
