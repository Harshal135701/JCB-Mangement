import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BreakdownReportModal } from '../breakdowns/components/BreakdownReportModal';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  ShieldAlert, 
  ShieldCheck, 
  Cpu, 
  Thermometer, 
  Gauge, 
  Activity, 
  PenTool, 
  Check, 
  Loader2,
  AlertCircle
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'select';
  unit?: string;
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  required?: boolean;
  is_critical?: boolean;
  options?: string[];
}

interface InspectionTemplate {
  id?: string;
  title: string;
  version?: number;
  machine_category: string;
  checklist: ChecklistItem[];
  sensor_thresholds?: {
    temperature?: { min?: number; max?: number; critical_min?: number; critical_max?: number; unit?: string };
    pressure?: { min?: number; max?: number; critical_min?: number; critical_max?: number; unit?: string };
    vibration?: { max?: number; critical_max?: number; unit?: string };
  };
}

export const PreShiftInspectionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Machine state
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [loadingMachines, setLoadingMachines] = useState(true);

  // Template state
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  // Form states
  const [responses, setResponses] = useState<Record<string, { value: any; notes: string }>>({});
  const [temperature, setTemperature] = useState('');
  const [pressure, setPressure] = useState('');
  const [vibration, setVibration] = useState('');
  const [escalateOnFail, setEscalateOnFail] = useState(true);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Review & Submission state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [submitError, setSubmitError] = useState('');

  // Load accessible machines
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoadingMachines(true);
        const res = await apiClient.get('/machines?limit=100');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setMachines(res.data.data);
          const paramId = searchParams.get('machine_id');
          if (paramId) {
            const found = res.data.data.find((m: any) => m.id === paramId);
            if (found) setSelectedMachine(found);
          } else if (res.data.data.length > 0) {
            setSelectedMachine(res.data.data[0]);
          }
        }
      } catch (err: any) {
        setTemplateError('Failed to retrieve machinery asset registry.');
      } finally {
        setLoadingMachines(false);
      }
    };
    fetchMachines();
  }, [searchParams]);

  // Load inspection template when machine is selected
  useEffect(() => {
    if (!selectedMachine) return;

    const fetchTemplate = async () => {
      try {
        setLoadingTemplate(true);
        setTemplateError('');
        setResponses({});
        setSubmissionResult(null);

        const category = selectedMachine.category || 'HMC';
        const res = await apiClient.get(`/inspections/template?category=${encodeURIComponent(category)}`);

        if (res.data?.success && res.data.data) {
          const t = res.data.data;
          setTemplate(t);

          // Initialize default answers
          const initialMap: Record<string, { value: any; notes: string }> = {};
          (t.checklist || []).forEach((item: ChecklistItem) => {
            if (item.type === 'boolean') {
              initialMap[item.id] = { value: true, notes: '' };
            } else if (item.type === 'number') {
              const defaultVal = item.min !== undefined && item.max !== undefined
                ? Math.round((item.min + item.max) / 2)
                : item.min || 0;
              initialMap[item.id] = { value: defaultVal, notes: '' };
            } else if (item.type === 'select') {
              initialMap[item.id] = { value: item.options?.[0] || '', notes: '' };
            }
          });
          setResponses(initialMap);

          // Seed default sensor values if thresholds configured
          if (t.sensor_thresholds?.temperature) {
            const tMin = t.sensor_thresholds.temperature.min || 20;
            const tMax = t.sensor_thresholds.temperature.max || 30;
            setTemperature(String(Math.round((tMin + tMax) / 2)));
          }
          if (t.sensor_thresholds?.pressure) {
            const pMin = t.sensor_thresholds.pressure.min || 45;
            const pMax = t.sensor_thresholds.pressure.max || 55;
            setPressure(String(Math.round((pMin + pMax) / 2)));
          }
          if (t.sensor_thresholds?.vibration) {
            const vMax = t.sensor_thresholds.vibration.max || 2.0;
            setVibration(String((vMax * 0.6).toFixed(1)));
          }
        }
      } catch (err: any) {
        setTemplate(null);
        setTemplateError(
          err.response?.data?.message ||
          `No active inspection template configured for machine category '${selectedMachine.category || 'Standard'}'.`
        );
      } finally {
        setLoadingTemplate(false);
      }
    };

    fetchTemplate();
  }, [selectedMachine]);

  // Signature canvas handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureDataUrl = (): string => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return '';
    return canvas.toDataURL('image/png');
  };

  // Evaluate single checklist item status
  const evaluateItemStatus = (item: ChecklistItem): 'pass' | 'flagged' | 'fail' => {
    const resp = responses[item.id];
    if (!resp || resp.value === undefined || resp.value === null) return 'pass';

    if (item.type === 'number') {
      const val = Number(resp.value);
      if (isNaN(val)) return 'fail';
      if (item.critical_min !== undefined && val < item.critical_min) return 'fail';
      if (item.critical_max !== undefined && val > item.critical_max) return 'fail';
      if (item.min !== undefined && val < item.min) return item.is_critical ? 'fail' : 'flagged';
      if (item.max !== undefined && val > item.max) return item.is_critical ? 'fail' : 'flagged';
      return 'pass';
    } else if (item.type === 'boolean') {
      const isFail = resp.value === false || resp.value === 'fail' || resp.value === 'false';
      if (isFail) return item.is_critical ? 'fail' : 'flagged';
      return 'pass';
    }
    return 'pass';
  };

  // Calculate review summary
  const summary = React.useMemo(() => {
    if (!template) return { total: 0, pass: 0, flagged: 0, fail: 0 };
    let pass = 0;
    let flagged = 0;
    let fail = 0;

    template.checklist.forEach((item) => {
      const s = evaluateItemStatus(item);
      if (s === 'fail') fail++;
      else if (s === 'flagged') flagged++;
      else pass++;
    });

    return { total: template.checklist.length, pass, flagged, fail };
  }, [template, responses]);

  // Final submit handler
  const handleFinalSubmit = async () => {
    if (!selectedMachine || !template) return;

    try {
      setSubmitting(true);
      setSubmitError('');

      // Build verified payload according to SubmitInspectionInput
      const payloadResponses = template.checklist.map((item) => {
        const resp = responses[item.id] || { value: true, notes: '' };
        return {
          id: item.id,
          value: resp.value,
          notes: resp.notes?.trim() || undefined,
        };
      });

      const payload = {
        machine_id: selectedMachine.id,
        template_id: template.id || undefined,
        shift: user?.shift || 'Shift A',
        temperature: temperature ? parseFloat(temperature) : null,
        pressure: pressure ? parseFloat(pressure) : null,
        vibration: vibration ? parseFloat(vibration) : null,
        responses: payloadResponses,
        operator_signature_url: getSignatureDataUrl() || 'SIGNATURE_CAPTURED_ON_CONSOLE',
        escalate_on_fail: escalateOnFail,
      };

      const res = await apiClient.post('/inspections/submit', payload);
      if (res.data?.success) {
        setSubmissionResult(res.data.data);
        setIsReviewOpen(false);
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to submit inspection audit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Page Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/operator/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-black transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Operator Console</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">
              Pre-Shift Machinery Safety Audit
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Daily Operator Sign-off
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Operator: <strong className="text-zinc-900">{user?.fullName}</strong> ({user?.employeeCode || 'OP-01'}) • Shift: <strong className="text-zinc-900">{user?.shift || 'Shift A'}</strong>. Verify interlocks, hydraulic lines, and fluid pressures.
          </p>
        </div>

        <button
          onClick={() => setIsBreakdownModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition self-start sm:self-auto"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Report Breakdown Directly</span>
        </button>
      </div>

      {/* Result Display Banner if already submitted */}
      {submissionResult && (
        <div className={`p-6 rounded-2xl border-2 shadow-md space-y-4 ${
          submissionResult.overall_status === 'fail'
            ? 'bg-red-50/50 border-red-300 text-red-950'
            : submissionResult.overall_status === 'flagged'
            ? 'bg-amber-50/50 border-amber-300 text-amber-950'
            : 'bg-emerald-50/50 border-emerald-300 text-emerald-950'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {submissionResult.overall_status === 'fail' ? (
                <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow">
                  <XCircle className="w-7 h-7" />
                </div>
              ) : submissionResult.overall_status === 'flagged' ? (
                <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow">
                  <AlertTriangle className="w-7 h-7" />
                </div>
              ) : (
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {submissionResult.overall_status === 'fail'
                    ? 'Inspection Critical Failure - Machine Stoppage Required'
                    : submissionResult.overall_status === 'flagged'
                    ? 'Inspection Flagged with Deviations'
                    : 'Inspection Passed - Cleared for Production'}
                </h3>
                <p className="text-xs font-medium text-zinc-600 mt-0.5">
                  Record ID: <code className="font-mono font-bold text-zinc-900">{submissionResult.id}</code> • Evaluated at {new Date(submissionResult.created_at || Date.now()).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <StatusBadge status={submissionResult.overall_status} size="md" />
          </div>

          {/* Cross-Module Auto Escalation Notice */}
          {submissionResult.breakdown_complaint && (
            <div className="p-4 bg-white/90 border-2 border-red-400 rounded-xl space-y-1">
              <div className="flex items-center gap-2 text-xs font-black text-red-700 uppercase">
                <AlertTriangle className="w-4 h-4" />
                <span>Automated Breakdown Ticket Generated</span>
              </div>
              <p className="text-xs text-zinc-700">
                Ticket <strong className="font-mono text-black">{submissionResult.breakdown_complaint.complaint_number}</strong> was automatically dispatched to maintenance supervisors due to critical safety/threshold breach.
              </p>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <Link
              to="/operator/dashboard"
              className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl uppercase tracking-wider transition"
            >
              Return to Operator Console
            </Link>
            <button
              onClick={() => {
                setSubmissionResult(null);
                setResponses({});
              }}
              className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-zinc-50 transition"
            >
              Perform Another Inspection
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Equipment Identifier */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-800" />
            <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
              1. Select Production Machine Asset
            </h3>
          </div>
          {selectedMachine && <StatusBadge status={selectedMachine.status || 'running'} />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <select
              value={selectedMachine?.id || ''}
              onChange={(e) => {
                const found = machines.find((m) => m.id === e.target.value);
                setSelectedMachine(found || null);
              }}
              disabled={loadingMachines}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} - {m.name} ({m.bay_line_location || m.shop_name || 'Bay 1'}) [{m.category || 'HMC'}]
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-zinc-500 font-bold uppercase text-[10px]">Criticality:</span>
            <span className="font-black text-zinc-900 uppercase">
              {selectedMachine?.criticality?.replace('_', ' ') || 'CLASS B'}
            </span>
          </div>
        </div>
      </div>

      {templateError && (
        <div className="p-5 bg-red-50 border border-red-300 text-red-800 rounded-2xl text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <h4 className="font-bold">Inspection Template Notice</h4>
            <p className="mt-0.5">{templateError}</p>
          </div>
        </div>
      )}

      {/* Step 2 & 3: Inspection Checklist Form */}
      {template && !submissionResult && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
          {/* Section Header */}
          <div className="p-4 sm:p-5 bg-zinc-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">{template.title}</h3>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                Category: <strong className="text-white">{template.machine_category}</strong> • Version {template.version || 1} • {template.checklist.length} Checkpoints
              </p>
            </div>

            {/* Live Counter Badges */}
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="px-2 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">
                {summary.pass} Pass
              </span>
              {summary.flagged > 0 && (
                <span className="px-2 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-md">
                  {summary.flagged} Flagged
                </span>
              )}
              {summary.fail > 0 && (
                <span className="px-2 py-1 bg-red-950 text-red-400 border border-red-800 rounded-md animate-pulse">
                  {summary.fail} Fail
                </span>
              )}
            </div>
          </div>

          {/* Checklist Items Table / List */}
          <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-4">
            {template.checklist.map((item, index) => {
              const currentResp = responses[item.id] || { value: true, notes: '' };
              const itemStatus = evaluateItemStatus(item);

              return (
                <div
                  key={item.id}
                  className={`pt-4 first:pt-0 rounded-xl p-3 transition ${
                    itemStatus === 'fail'
                      ? 'bg-red-50/40 border border-red-200'
                      : itemStatus === 'flagged'
                      ? 'bg-amber-50/40 border border-amber-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Item Label & Criticality */}
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-zinc-400">
                          #{index + 1}
                        </span>
                        <h4 className="text-xs font-bold text-zinc-950 leading-snug">
                          {item.label}
                        </h4>
                        {item.is_critical && (
                          <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Critical
                          </span>
                        )}
                        {item.required && (
                          <span className="text-red-500 font-bold text-xs" title="Mandatory checkpoint">*</span>
                        )}
                      </div>

                      {/* Threshold info if number */}
                      {item.type === 'number' && (
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                          <span>Operating Spec: {item.min} - {item.max} {item.unit}</span>
                          {item.critical_min !== undefined && (
                            <span className="text-red-600 font-bold">(Critical &lt; {item.critical_min})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Input Controls */}
                    <div className="shrink-0">
                      {item.type === 'boolean' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setResponses({
                                ...responses,
                                [item.id]: { ...currentResp, value: true },
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                              currentResp.value === true
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 text-zinc-600 hover:bg-slate-200'
                            }`}
                          >
                            Pass
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setResponses({
                                ...responses,
                                [item.id]: { ...currentResp, value: false },
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                              currentResp.value === false
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-slate-100 text-zinc-600 hover:bg-slate-200'
                            }`}
                          >
                            Fail
                          </button>
                        </div>
                      ) : item.type === 'number' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={currentResp.value ?? ''}
                            onChange={(e) =>
                              setResponses({
                                ...responses,
                                [item.id]: { ...currentResp, value: e.target.value },
                              })
                            }
                            className={`w-28 p-2 text-xs font-mono font-bold rounded-lg border text-right focus:outline-none ${
                              itemStatus === 'fail'
                                ? 'border-red-500 bg-red-50 text-red-900'
                                : itemStatus === 'flagged'
                                ? 'border-amber-500 bg-amber-50 text-amber-900'
                                : 'border-slate-300 bg-white text-zinc-900 focus:border-jcb-yellow'
                            }`}
                          />
                          <span className="text-xs font-mono text-zinc-500 font-semibold w-10">
                            {item.unit || ''}
                          </span>
                        </div>
                      ) : (
                        <select
                          value={currentResp.value}
                          onChange={(e) =>
                            setResponses({
                              ...responses,
                              [item.id]: { ...currentResp, value: e.target.value },
                            })
                          }
                          className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900"
                        >
                          {(item.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Remarks input if flagged or failed */}
                  {itemStatus !== 'pass' && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-red-700 uppercase shrink-0">Operator Remark:</span>
                      <input
                        type="text"
                        placeholder="State reason for failure or observed reading..."
                        value={currentResp.notes}
                        onChange={(e) =>
                          setResponses({
                            ...responses,
                            [item.id]: { ...currentResp, notes: e.target.value },
                          })
                        }
                        className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-zinc-900 focus:outline-none focus:border-red-400"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step 4: Machinery Telemetry Sensors */}
          <div className="p-5 bg-slate-50 border-t-2 border-slate-200 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-800" />
              <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                2. Physical Gauge Telemetry Readings
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Hydraulic Pressure */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hydraulic Pressure</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">Bar</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 50"
                  value={pressure}
                  onChange={(e) => setPressure(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <p className="text-[10px] text-zinc-500 font-mono">
                  Nominal: {template.sensor_thresholds?.pressure?.min ?? 45} - {template.sensor_thresholds?.pressure?.max ?? 55} Bar
                </p>
              </div>

              {/* Operating Temperature */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                    <span>Operating Temp</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">°C</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 22"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <p className="text-[10px] text-zinc-500 font-mono">
                  Nominal: {template.sensor_thresholds?.temperature?.min ?? 18} - {template.sensor_thresholds?.temperature?.max ?? 24} °C
                </p>
              </div>

              {/* Vibration Level */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Spindle Vibration</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">mm/s</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 1.2"
                  value={vibration}
                  onChange={(e) => setVibration(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <p className="text-[10px] text-zinc-500 font-mono">
                  Tolerance: Max {template.sensor_thresholds?.vibration?.max ?? 2.5} mm/s
                </p>
              </div>
            </div>
          </div>

          {/* Step 5: Touch Digital Signature & Escalation Checkbox */}
          <div className="p-5 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-zinc-800" />
                <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                  3. Operator Touch Digital Signature
                </h3>
              </div>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs font-bold text-zinc-500 hover:text-black flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-1 bg-white inline-block w-full max-w-md">
              <canvas
                ref={canvasRef}
                width={400}
                height={100}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full touch-none cursor-crosshair bg-slate-50/50 rounded-lg"
              />
            </div>
            <p className="text-[10px] text-zinc-400 font-medium">
              Sign above using your finger or touchscreen stylus to authenticate shift submission.
            </p>

            {/* Auto Escalation Checkbox */}
            <div className="pt-2 flex items-center gap-2.5">
              <input
                type="checkbox"
                id="escalateCheck"
                checked={escalateOnFail}
                onChange={(e) => setEscalateOnFail(e.target.checked)}
                className="w-4 h-4 text-jcb-yellow rounded border-slate-300 focus:ring-jcb-yellow"
              />
              <label htmlFor="escalateCheck" className="text-xs font-bold text-zinc-800 select-none cursor-pointer">
                Auto-generate emergency breakdown complaint (CMP) if critical checkpoint or sensor threshold fails
              </label>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 sm:p-5 bg-slate-100 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-zinc-600 font-medium">
              Review all checkpoints before submitting to supervisor audit trail.
            </div>

            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="px-6 py-3 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black rounded-xl uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2"
            >
              <span>Review & Commit Audit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewOpen && template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[85vh]">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">Confirm Inspection Submission</h3>
              </div>
              <button onClick={() => setIsReviewOpen(false)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                  {submitError}
                </div>
              )}

              {/* Machine Summary Strip */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Machine:</span>
                  <strong className="text-zinc-950 font-mono">{selectedMachine?.machine_code} ({selectedMachine?.name})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Shift / Operator:</span>
                  <span className="text-zinc-800 font-semibold">{user?.shift || 'Shift A'} • {user?.fullName}</span>
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-2xl font-black text-emerald-700">{summary.pass}</div>
                  <div className="text-[10px] font-bold uppercase text-emerald-800">Passed</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-2xl font-black text-amber-700">{summary.flagged}</div>
                  <div className="text-[10px] font-bold uppercase text-amber-800">Flagged</div>
                </div>
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <div className="text-2xl font-black text-red-700">{summary.fail}</div>
                  <div className="text-[10px] font-bold uppercase text-red-800">Failed</div>
                </div>
              </div>

              {summary.fail > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-red-800 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Critical Failures Detected</span>
                  </div>
                  <p className="text-[11px] text-red-700 font-medium leading-relaxed">
                    This inspection will evaluate to <strong className="uppercase">FAIL</strong>. If auto-escalation is enabled, an urgent breakdown ticket will be immediately issued.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-100"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Transmitting...</span>
                  </>
                ) : (
                  <span>Commit Final Audit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Breakdown Report Modal */}
      <BreakdownReportModal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        preselectedMachineId={selectedMachine?.id}
        onSuccess={() => {
          navigate('/operator/dashboard');
        }}
      />
    </div>
  );
};
