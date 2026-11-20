import React, { useState, useEffect } from 'react';
import {
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  Cpu,
  Send,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Search,
  ListChecks,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { PMPlan, PMExecutionItem } from '../types';
import {
  fetchPMPlanEligibleMachines,
  executePMPlanService,
  startPMExecutionService,
} from '../services/pmService';
import { useAuth } from '../../../context/AuthContext';

interface PMTechnicianExecutionViewProps {
  plans: PMPlan[];
  executions: PMExecutionItem[];
  selectedPlanIdFromProps?: string | null;
  onExecutionCompleted?: () => void;
  onViewExecutionDetail?: (executionId: string) => void;
}

export const PMTechnicianExecutionView: React.FC<PMTechnicianExecutionViewProps> = ({
  plans,
  executions,
  selectedPlanIdFromProps,
  onExecutionCompleted,
  onViewExecutionDetail,
}) => {
  const { user } = useAuth();

  // Active deployed plans only
  const activePlans = plans.filter((p) => p.is_active);

  // Selection states
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    selectedPlanIdFromProps || (activePlans.length > 0 ? activePlans[0].id : '')
  );
  const [selectedPlan, setSelectedPlan] = useState<PMPlan | null>(null);

  // Eligible machines states
  const [eligibleMachines, setEligibleMachines] = useState<any[]>([]);
  const [loadingEligibleMachines, setLoadingEligibleMachines] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');

  // Checklist execution form states
  const [checklistResponses, setChecklistResponses] = useState<
    Array<{ step: number; task: string; status: 'pass' | 'fail' | 'na'; notes: string }>
  >([]);
  const [overallStatus, setOverallStatus] = useState<'pass' | 'fail'>('pass');
  const [workPerformed, setWorkPerformed] = useState('');
  const [technicianRemarks, setTechnicianRemarks] = useState('');
  const [partsUsed, setPartsUsed] = useState<Array<{ part_id: string; quantity: number }>>([]);

  // Submitting & Feedback states
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active view tab: 'execute' | 'history'
  const [viewTab, setViewTab] = useState<'execute' | 'history'>('execute');

  // Handle prop change
  useEffect(() => {
    if (selectedPlanIdFromProps) {
      setSelectedPlanId(selectedPlanIdFromProps);
    }
  }, [selectedPlanIdFromProps]);

  // Load eligible machines when selected plan changes
  useEffect(() => {
    if (!selectedPlanId) {
      setSelectedPlan(null);
      setEligibleMachines([]);
      setSelectedMachineId('');
      setChecklistResponses([]);
      return;
    }

    const loadPlanAndMachines = async () => {
      try {
        setLoadingEligibleMachines(true);
        setFeedback(null);
        setSelectedMachineId('');

        const result = await fetchPMPlanEligibleMachines(selectedPlanId);
        if (result && result.plan) {
          setSelectedPlan(result.plan);
          setEligibleMachines(result.eligible_machines || []);

          // Auto-select first machine if available
          if (result.eligible_machines && result.eligible_machines.length > 0) {
            setSelectedMachineId(result.eligible_machines[0].id);
          }

          // Populate checklist responses from template
          const template = result.plan.checklist_template || [];
          if (Array.isArray(template) && template.length > 0) {
            setChecklistResponses(
              template.map((item: any, idx: number) => ({
                step: idx + 1,
                task: typeof item === 'string' ? item : item.task || `Step ${idx + 1}`,
                status: 'pass' as const,
                notes: '',
              }))
            );
          } else {
            // Default industrial verification steps
            setChecklistResponses([
              { step: 1, task: 'Inspect lubrication & fluid levels (engine/hydraulic/transmission)', status: 'pass', notes: '' },
              { step: 2, task: 'Inspect seal integrity, hoses, and check for leakage', status: 'pass', notes: '' },
              { step: 3, task: 'Verify pressure valves, gauges, and safety relief operation', status: 'pass', notes: '' },
              { step: 4, task: 'Check mechanical fasteners, pins, bushings, and joint tightness', status: 'pass', notes: '' },
              { step: 5, task: 'Execute functional dry-run and verify vibration and thermal limits', status: 'pass', notes: '' },
            ]);
          }
        }
      } catch (err: any) {
        console.error('Failed to load eligible machines for PM plan:', err);
        setFeedback({
          type: 'error',
          text: err?.response?.data?.message || 'Failed to load eligible machines for this plan.',
        });
      } finally {
        setLoadingEligibleMachines(false);
      }
    };

    loadPlanAndMachines();
  }, [selectedPlanId]);

  // Selected machine object
  const currentMachine = eligibleMachines.find((m) => m.id === selectedMachineId);

  // Toggle checklist step status
  const handleToggleStepStatus = (index: number, status: 'pass' | 'fail' | 'na') => {
    const next = [...checklistResponses];
    next[index].status = status;
    setChecklistResponses(next);

    if (next.some((item) => item.status === 'fail')) {
      setOverallStatus('fail');
    } else {
      setOverallStatus('pass');
    }
  };

  // Update checklist step notes
  const handleStepNotesChange = (index: number, notes: string) => {
    const next = [...checklistResponses];
    next[index].notes = notes;
    setChecklistResponses(next);
  };

  // Quick action: Pass all steps
  const handlePassAllSteps = () => {
    const next = checklistResponses.map((item) => ({ ...item, status: 'pass' as const }));
    setChecklistResponses(next);
    setOverallStatus('pass');
  };

  // Add spare part row
  const handleAddPart = () => {
    setPartsUsed((prev) => [...prev, { part_id: '', quantity: 1 }]);
  };

  const handleRemovePart = (index: number) => {
    setPartsUsed((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdatePart = (index: number, field: 'part_id' | 'quantity', val: any) => {
    const next = [...partsUsed];
    next[index] = { ...next[index], [field]: val };
    setPartsUsed(next);
  };

  // Start execution on site (set status to in_progress)
  const handleStartExecution = async () => {
    if (!selectedPlanId || !selectedMachineId) {
      setFeedback({ type: 'error', text: 'Please select a plan and an eligible machine.' });
      return;
    }

    try {
      setStarting(true);
      setFeedback(null);
      const res = await startPMExecutionService(selectedPlanId, selectedMachineId);
      setFeedback({
        type: 'success',
        text: `PM Execution commenced on site (${res.wo_number || 'in progress'}). Work order status updated to In-Progress.`,
      });
      if (onExecutionCompleted) onExecutionCompleted();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to start PM execution on site.',
      });
    } finally {
      setStarting(false);
    }
  };

  // Submit PM execution
  const handleSubmitExecution = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPlanId) {
      setFeedback({ type: 'error', text: 'Please select a deployed PM plan.' });
      return;
    }
    if (!selectedMachineId) {
      setFeedback({ type: 'error', text: 'Please select an eligible machine.' });
      return;
    }
    if (!workPerformed.trim()) {
      setFeedback({ type: 'error', text: 'Work performed details are required before submitting.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);

      const validParts = partsUsed.filter((p) => p.part_id && p.quantity > 0);

      const payload = {
        machine_id: selectedMachineId,
        checklist_responses: checklistResponses,
        overall_status: overallStatus,
        work_performed: workPerformed.trim(),
        technician_remarks: technicianRemarks.trim() || undefined,
        parts_used: validParts.length > 0 ? validParts : undefined,
      };

      const res = await executePMPlanService(selectedPlanId, payload);

      setFeedback({
        type: 'success',
        text: `PM Execution ${res.wo_number || ''} submitted successfully! Status moved to Submitted for Verification. Next maintenance cycle advanced.`,
      });

      // Clear execution form fields
      setWorkPerformed('');
      setTechnicianRemarks('');
      setPartsUsed([]);

      if (onExecutionCompleted) onExecutionCompleted();
    } catch (err: any) {
      console.error('Error submitting PM execution:', err);
      setFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to submit PM execution.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter executions for this technician
  const technicianExecutions = executions.filter(
    (ex) => !user?.id || ex.assigned_technician_name?.toLowerCase().includes((user as any)?.employeeCode?.toLowerCase() || (user as any)?.employee_code?.toLowerCase() || '') || true
  );

  return (
    <div className="space-y-6">
      {/* View Toggle Tabs */}
      <div className="flex items-center justify-between gap-4 bg-zinc-50 p-2 rounded-xl border border-zinc-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewTab('execute')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              viewTab === 'execute'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Execute PM Service</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              viewTab === 'history'
                ? 'bg-amber-500 text-black shadow-xs font-black'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Execution History ({executions.length})</span>
          </button>
        </div>

        <div className="text-right text-[11px] text-zinc-500 hidden sm:block">
          <span className="font-semibold text-zinc-700">{(user as any)?.fullName || (user as any)?.full_name || (user as any)?.employeeCode || 'Technician'}</span> | Plan-Based PM Workflow
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-zinc-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: EXECUTE PM SERVICE                                              */}
      {/* ========================================================================= */}
      {viewTab === 'execute' && (
        <div className="space-y-6">
          {/* Step 1 & 2 Card: Plan Selection & Eligible Machine Selection */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                  SELECT DEPLOYED PM PLAN & ELIGIBLE MACHINE
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-zinc-400">
                Machine eligibility strictly scoped to deployed plan
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deployed Plan Dropdown */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Deployed PM Plan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">-- Choose Deployed PM Plan --</option>
                  {activePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      [{plan.plan_code}] {plan.title} ({plan.frequency})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Only active deployed plans configured for your plant/shop are listed.
                </p>
              </div>

              {/* Eligible Machine Dropdown (CRITICAL REQUIREMENT) */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Eligible Machine Asset <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                  disabled={loadingEligibleMachines || eligibleMachines.length === 0}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  {loadingEligibleMachines ? (
                    <option value="">Loading eligible machines...</option>
                  ) : eligibleMachines.length === 0 ? (
                    <option value="">No eligible machines associated with this plan</option>
                  ) : (
                    eligibleMachines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.machine_name || m.name} ({m.bay_line_location || m.shop_name})
                        {m.active_execution_status ? ` [Execution: ${m.active_execution_status}]` : ''}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Dynamically loaded. Only machines explicitly associated with the selected plan are selectable.
                </p>
              </div>
            </div>

            {/* Plan & Machine Metadata Banner */}
            {selectedPlan && (
              <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Plan Code & Title</span>
                  <span className="font-bold text-zinc-900 block truncate">{selectedPlan.plan_code}</span>
                  <span className="text-zinc-600 block text-[11px] truncate">{selectedPlan.title}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Cadence & Schedule</span>
                  <span className="font-bold text-amber-700 capitalize block">{selectedPlan.frequency}</span>
                  <span className="text-zinc-600 block text-[11px]">
                    Interval: {selectedPlan.interval_days}d (Grace: {selectedPlan.grace_period_days}d)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Operating Threshold</span>
                  <span className="font-bold text-zinc-800 block">
                    {selectedPlan.operating_hour_threshold
                      ? `${selectedPlan.operating_hour_threshold} hrs`
                      : 'Calendar Trigger'}
                  </span>
                  <span className="text-zinc-500 block text-[11px]">
                    Eligible Assets: {eligibleMachines.length}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block">Next Due Date</span>
                  <span className="font-bold text-zinc-900 block">
                    {selectedPlan.next_pm_date
                      ? new Date(selectedPlan.next_pm_date).toLocaleDateString()
                      : 'Pending Cycle'}
                  </span>
                  <span className="text-emerald-700 font-bold block text-[11px]">Active Plan</span>
                </div>
              </div>
            )}

            {/* Selected Machine Details & Open Execution Notice */}
            {currentMachine && (
              <div className="p-3.5 rounded-lg bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-black font-black rounded-lg">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-zinc-950 flex items-center gap-2">
                      <span>{currentMachine.machine_code} — {currentMachine.machine_name || currentMachine.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase">
                        {currentMachine.category || 'Asset'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Location: {currentMachine.bay_line_location || 'Shop Floor'} | Hours: {currentMachine.operating_hours || 0} hrs | Criticality: {currentMachine.criticality || 'Normal'}
                    </div>
                  </div>
                </div>

                {currentMachine.active_execution_status ? (
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-purple-100 text-purple-900 font-mono text-xs font-bold border border-purple-200">
                      WO: {currentMachine.active_execution_wo_number} ({currentMachine.active_execution_status})
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartExecution}
                    disabled={starting}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{starting ? 'Starting...' : 'Start PM On-Site'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 3 Form: Service Checklist & Work Performed Form */}
          {selectedPlan && selectedMachineId && (
            <form onSubmit={handleSubmitExecution} className="space-y-6">
              {/* Checklist Section */}
              <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                      PREVENTIVE SERVICE CHECKLIST ({checklistResponses.length} STEPS)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePassAllSteps}
                      className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded-md transition flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Pass All Steps</span>
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        overallStatus === 'pass'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Overall: {overallStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {checklistResponses.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                        item.status === 'pass'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : item.status === 'fail'
                          ? 'bg-rose-50/40 border-rose-200'
                          : 'bg-zinc-50 border-zinc-200'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1">
                        <span className="font-mono font-bold text-zinc-500 mt-0.5">#{idx + 1}</span>
                        <div>
                          <p className="font-bold text-zinc-900 leading-snug">{item.task}</p>
                          <input
                            type="text"
                            placeholder="Observations, torque value, or readings..."
                            value={item.notes}
                            onChange={(e) => handleStepNotesChange(idx, e.target.value)}
                            className="mt-1.5 w-full max-w-md px-2.5 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStepStatus(idx, 'pass')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                            item.status === 'pass'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStepStatus(idx, 'fail')}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                            item.status === 'fail'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStepStatus(idx, 'na')}
                          className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                            item.status === 'na'
                              ? 'bg-zinc-700 text-white shadow-xs'
                              : 'bg-white text-zinc-500 border border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          <span>N/A</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Performed, Remarks & Consumed Parts Card */}
              <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                      WORK PERFORMED & SUBMISSION DETAILS
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Details of Work Performed <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Conducted 250-hr scheduled powertrain lubrication. Flushed hydraulic line, replaced oil filter, calibrated relief valve to 210 bar."
                      value={workPerformed}
                      onChange={(e) => setWorkPerformed(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Technician Observations & Remarks (Optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Slight wear on lower boom pin bushing. Recommend monitoring during next 500-hr service cycle."
                      value={technicianRemarks}
                      onChange={(e) => setTechnicianRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Spare Parts Consumed (Optional) */}
                <div className="pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                      Spare Parts Consumed (Optional)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPart}
                      className="text-amber-700 hover:text-amber-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Part</span>
                    </button>
                  </div>

                  {partsUsed.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic">No spare parts recorded for this PM service.</p>
                  ) : (
                    <div className="space-y-2">
                      {partsUsed.map((part, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Part ID or Part Number UUID"
                            value={part.part_id}
                            onChange={(e) => handleUpdatePart(idx, 'part_id', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono text-zinc-900"
                          />
                          <input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => handleUpdatePart(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="w-20 px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePart(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Execution Action Button */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                    <span>{submitting ? 'Submitting Execution...' : 'Submit PM Execution for Verification'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: TECHNICIAN EXECUTION HISTORY                                     */}
      {/* ========================================================================= */}
      {viewTab === 'history' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
            <div>
              <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                PREVENTIVE MAINTENANCE EXECUTION RECORDS
              </h3>
              <p className="text-[11px] text-zinc-500">
                Audit records of preventive maintenance executions and manager verification statuses.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Work Order #</th>
                  <th className="px-4 py-3">Machine</th>
                  <th className="px-4 py-3">Maintenance Plan / Instructions</th>
                  <th className="px-4 py-3">Assigned Tech</th>
                  <th className="px-4 py-3">Executed Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {technicianExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-zinc-500">
                      No PM execution records found. Select a plan above to perform an execution.
                    </td>
                  </tr>
                ) : (
                  technicianExecutions.map((item) => (
                    <tr key={item.execution_id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-amber-700">
                        {item.wo_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-zinc-900">{item.machine_code}</div>
                        <div className="text-[11px] text-zinc-400">{item.machine_name}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-800 max-w-xs truncate">
                        {item.work_instructions || 'PM Service Checklist'}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {item.assigned_technician_name || 'Assigned Tech'}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 font-mono text-[11px]">
                        {item.repair_completed_time
                          ? new Date(item.repair_completed_time).toLocaleString()
                          : new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'verified_closed'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : item.status === 'submitted_verification'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : item.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {onViewExecutionDetail && (
                          <button
                            type="button"
                            onClick={() => onViewExecutionDetail(item.execution_id)}
                            className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded transition cursor-pointer font-bold text-xs"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
