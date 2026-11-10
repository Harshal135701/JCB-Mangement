import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
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
  ShieldCheck, 
  Cpu, 
  Thermometer, 
  Gauge, 
  Activity, 
  PenTool, 
  Loader2,
  AlertCircle,
  Eye,
  Filter,
  Calendar,
  Clock,
  User,
  RefreshCw,
  FileText,
  X
} from 'lucide-react';

export interface ChecklistItem {
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

export interface SensorThresholdItem {
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  unit?: string;
  required?: boolean;
}

export interface SensorThresholds {
  temperature?: SensorThresholdItem;
  pressure?: SensorThresholdItem;
  vibration?: SensorThresholdItem;
}

export interface InspectionTemplate {
  id: string;
  title: string;
  version?: number;
  machine_category: string;
  checklist: ChecklistItem[];
  sensor_thresholds?: SensorThresholds;
  is_active?: boolean;
}

export interface InspectionRecordSummary {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  operator_id: string;
  operator_name?: string;
  shift: string;
  overall_status: 'pass' | 'flagged' | 'fail';
  temperature?: number | null;
  pressure?: number | null;
  vibration?: number | null;
  responses_json?: any;
  operator_signature_url?: string;
  created_at: string;
}

export const PreShiftInspectionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeRecordId } = useParams<{ id?: string }>();

  // Main navigation tabs: 'audit' (Execution) | 'history' (Audit logs)
  const [activeTab, setActiveTab] = useState<'audit' | 'history'>('audit');

  // Machine state
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [loadingMachines, setLoadingMachines] = useState(true);

  // Template state
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');

  // Form states
  const [responses, setResponses] = useState<Record<string, { value: any; notes: string; status?: string }>>({});
  const [temperature, setTemperature] = useState('');
  const [pressure, setPressure] = useState('');
  const [vibration, setVibration] = useState('');
  const [escalateOnFail, setEscalateOnFail] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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

  // Inspection History State
  const [records, setRecords] = useState<InspectionRecordSummary[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');
  const [historyMachineFilter, setHistoryMachineFilter] = useState<string>('all');
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Single Record Detail Modal State
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<any | null>(null);
  const [loadingRecordDetail, setLoadingRecordDetail] = useState(false);
  const [recordDetailError, setRecordDetailError] = useState('');

  // 1. Fetch Accessible Machines
  useEffect(() => {
    let isMounted = true;
    const fetchMachines = async () => {
      try {
        setLoadingMachines(true);
        const res = await apiClient.get('/machines?limit=100');
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const list = res.data.data;
          setMachines(list);
          const paramMachineId = searchParams.get('machine_id');
          if (paramMachineId) {
            const found = list.find((m: any) => m.id === paramMachineId);
            if (found) setSelectedMachine(found);
          } else if (list.length > 0 && !selectedMachine) {
            setSelectedMachine(list[0]);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTemplateError('Failed to retrieve industrial machinery asset registry.');
        }
      } finally {
        if (isMounted) setLoadingMachines(false);
      }
    };
    fetchMachines();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // 2. Fetch Active Template for Selected Machine's Category
  useEffect(() => {
    if (!selectedMachine) return;
    let isMounted = true;

    const fetchTemplate = async () => {
      try {
        setLoadingTemplate(true);
        setTemplateError('');
        setResponses({});
        setSubmissionResult(null);
        setValidationErrors([]);
        clearSignature();

        const category = selectedMachine.category || 'HMC';
        const res = await apiClient.get(`/inspections/template?category=${encodeURIComponent(category)}`);

        if (isMounted && res.data?.success && res.data.data) {
          const t: InspectionTemplate = res.data.data;
          setTemplate(t);

          // Initialize default checklist answers
          const initialMap: Record<string, { value: any; notes: string; status?: string }> = {};
          (t.checklist || []).forEach((item: ChecklistItem) => {
            if (item.type === 'boolean') {
              initialMap[item.id] = { value: true, notes: '', status: 'pass' };
            } else if (item.type === 'number') {
              const defaultVal = item.min !== undefined && item.max !== undefined
                ? Math.round(((item.min + item.max) / 2) * 10) / 10
                : item.min !== undefined
                ? item.min
                : 0;
              initialMap[item.id] = { value: defaultVal, notes: '', status: 'pass' };
            } else if (item.type === 'select') {
              const firstOpt = item.options?.[0] || 'Normal / OK';
              initialMap[item.id] = { value: firstOpt, notes: '', status: 'pass' };
            }
          });
          setResponses(initialMap);

          // Initialize sensor defaults only if configured in template
          if (t.sensor_thresholds?.pressure) {
            const p = t.sensor_thresholds.pressure;
            const pVal = p.min !== undefined && p.max !== undefined
              ? (p.min + p.max) / 2
              : p.min ?? 50;
            setPressure(String(Math.round(pVal * 10) / 10));
          } else {
            setPressure('');
          }

          if (t.sensor_thresholds?.temperature) {
            const temp = t.sensor_thresholds.temperature;
            const tempVal = temp.min !== undefined && temp.max !== undefined
              ? (temp.min + temp.max) / 2
              : temp.min ?? 22;
            setTemperature(String(Math.round(tempVal * 10) / 10));
          } else {
            setTemperature('');
          }

          if (t.sensor_thresholds?.vibration) {
            const v = t.sensor_thresholds.vibration;
            const vVal = v.max !== undefined ? v.max * 0.6 : 1.2;
            setVibration(String(vVal.toFixed(1)));
          } else {
            setVibration('');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTemplate(null);
          setTemplateError(
            err.response?.data?.message ||
            `No active inspection template configured for machine category '${selectedMachine.category || 'Standard'}'.`
          );
        }
      } finally {
        if (isMounted) setLoadingTemplate(false);
      }
    };

    fetchTemplate();
    return () => {
      isMounted = false;
    };
  }, [selectedMachine]);

  // 3. Signature Canvas Handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#09090b';
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

  // 4. Checklist Item Evaluation
  const evaluateItemStatus = useCallback(
    (item: ChecklistItem): { status: 'pass' | 'flagged' | 'fail'; message: string } => {
      const resp = responses[item.id];
      if (!resp || resp.value === undefined || resp.value === null || resp.value === '') {
        return { status: item.required ? 'fail' : 'pass', message: item.required ? 'Required checkpoint missing' : '' };
      }

      if (item.type === 'number') {
        const val = Number(resp.value);
        if (isNaN(val)) {
          return { status: 'fail', message: 'Non-numeric reading provided' };
        }
        if (item.critical_min !== undefined && val < item.critical_min) {
          return { status: 'fail', message: `Critical low breach: ${val} < ${item.critical_min} ${item.unit || ''}` };
        }
        if (item.critical_max !== undefined && val > item.critical_max) {
          return { status: 'fail', message: `Critical high breach: ${val} > ${item.critical_max} ${item.unit || ''}` };
        }
        if (item.min !== undefined && val < item.min) {
          return {
            status: item.is_critical ? 'fail' : 'flagged',
            message: `Below operating spec: ${val} < ${item.min} ${item.unit || ''}`,
          };
        }
        if (item.max !== undefined && val > item.max) {
          return {
            status: item.is_critical ? 'fail' : 'flagged',
            message: `Above operating spec: ${val} > ${item.max} ${item.unit || ''}`,
          };
        }
        return { status: 'pass', message: 'Nominal within operating limits' };
      }

      if (item.type === 'boolean') {
        const isFailing = resp.value === false || resp.value === 'fail' || resp.value === 'false';
        if (isFailing) {
          return {
            status: item.is_critical ? 'fail' : 'flagged',
            message: item.is_critical ? 'Critical safety/operational check failed' : 'Non-critical check deviation noted',
          };
        }
        return { status: 'pass', message: 'Operational & nominal' };
      }

      if (item.type === 'select') {
        const valStr = String(resp.value).toLowerCase();
        const failKeywords = ['fail', 'leak', 'damage', 'abnormal', 'broken', 'critical', 'defective', 'not ok'];
        const flaggedKeywords = ['minor', 'warn', 'flag', 'wear', 'low', 'high'];

        if (failKeywords.some((kw) => valStr.includes(kw))) {
          return { status: item.is_critical ? 'fail' : 'flagged', message: `Condition '${resp.value}' recorded` };
        }
        if (flaggedKeywords.some((kw) => valStr.includes(kw))) {
          return { status: 'flagged', message: `Observation '${resp.value}' flagged` };
        }
        return { status: 'pass', message: 'Normal' };
      }

      return { status: 'pass', message: 'OK' };
    },
    [responses]
  );

  // 5. Sensor Evaluation Engine
  const evaluateSensor = useCallback(
    (key: 'pressure' | 'temperature' | 'vibration', rawVal: string): { status: 'pass' | 'flagged' | 'fail' | 'none'; notes: string } => {
      const threshold = template?.sensor_thresholds?.[key];
      if (!threshold) return { status: 'none', notes: 'Not configured' };

      const trimmed = (rawVal || '').trim();
      if (!trimmed) {
        if (threshold.required) {
          return { status: 'fail', notes: `Mandatory ${key} reading missing` };
        }
        return { status: 'none', notes: 'Optional sensor omitted' };
      }

      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        return { status: 'fail', notes: 'Invalid numeric sensor value' };
      }

      if (threshold.critical_min !== undefined && num < threshold.critical_min) {
        return {
          status: 'fail',
          notes: `Critical low breach: ${num} < ${threshold.critical_min} ${threshold.unit || ''}`,
        };
      }
      if (threshold.critical_max !== undefined && num > threshold.critical_max) {
        return {
          status: 'fail',
          notes: `Critical high breach: ${num} > ${threshold.critical_max} ${threshold.unit || ''}`,
        };
      }
      if (threshold.min !== undefined && num < threshold.min) {
        return {
          status: 'flagged',
          notes: `Operating low deviation: ${num} < ${threshold.min} ${threshold.unit || ''}`,
        };
      }
      if (threshold.max !== undefined && num > threshold.max) {
        return {
          status: 'flagged',
          notes: `Operating high deviation: ${num} > ${threshold.max} ${threshold.unit || ''}`,
        };
      }

      return { status: 'pass', notes: `Nominal within ${threshold.min ?? 0} - ${threshold.max ?? 0} ${threshold.unit || ''}` };
    },
    [template]
  );

  // 6. Comprehensive Review Summary (Items + Sensors)
  const summary = useMemo(() => {
    if (!template) return { total: 0, pass: 0, flagged: 0, fail: 0, criticalFailures: [] as string[], deviations: [] as string[] };

    let pass = 0;
    let flagged = 0;
    let fail = 0;
    const criticalFailures: string[] = [];
    const deviations: string[] = [];

    // Evaluate Checklist Items
    template.checklist.forEach((item) => {
      const res = evaluateItemStatus(item);
      if (res.status === 'fail') {
        fail++;
        criticalFailures.push(`${item.label} (${res.message})`);
      } else if (res.status === 'flagged') {
        flagged++;
        deviations.push(`${item.label} (${res.message})`);
      } else {
        pass++;
      }
    });

    // Evaluate Configured Sensors
    if (template.sensor_thresholds?.pressure) {
      const s = evaluateSensor('pressure', pressure);
      if (s.status === 'fail') {
        fail++;
        criticalFailures.push(`Hydraulic Pressure: ${s.notes}`);
      } else if (s.status === 'flagged') {
        flagged++;
        deviations.push(`Hydraulic Pressure: ${s.notes}`);
      } else if (s.status === 'pass') {
        pass++;
      }
    }

    if (template.sensor_thresholds?.temperature) {
      const s = evaluateSensor('temperature', temperature);
      if (s.status === 'fail') {
        fail++;
        criticalFailures.push(`Operating Temperature: ${s.notes}`);
      } else if (s.status === 'flagged') {
        flagged++;
        deviations.push(`Operating Temperature: ${s.notes}`);
      } else if (s.status === 'pass') {
        pass++;
      }
    }

    if (template.sensor_thresholds?.vibration) {
      const s = evaluateSensor('vibration', vibration);
      if (s.status === 'fail') {
        fail++;
        criticalFailures.push(`Spindle Vibration: ${s.notes}`);
      } else if (s.status === 'flagged') {
        flagged++;
        deviations.push(`Spindle Vibration: ${s.notes}`);
      } else if (s.status === 'pass') {
        pass++;
      }
    }

    return {
      total: pass + flagged + fail,
      pass,
      flagged,
      fail,
      criticalFailures,
      deviations,
    };
  }, [template, responses, pressure, temperature, vibration, evaluateItemStatus, evaluateSensor]);

  // Overall predicted status
  const predictedOverallStatus: 'pass' | 'flagged' | 'fail' = useMemo(() => {
    if (summary.fail > 0) return 'fail';
    if (summary.flagged > 0) return 'flagged';
    return 'pass';
  }, [summary]);

  // 7. Pre-Submission Form Validation
  const validateInspectionForm = (): boolean => {
    const errors: string[] = [];
    if (!selectedMachine) {
      errors.push('Machine asset must be selected.');
    }
    if (!template) {
      errors.push('Active checklist template is missing.');
    }

    // Required checkpoints check
    template?.checklist.forEach((item, idx) => {
      const r = responses[item.id];
      if (item.required !== false) {
        if (!r || r.value === undefined || r.value === null || r.value === '') {
          errors.push(`Checkpoint #${idx + 1} (${item.label}) is mandatory.`);
        }
      }
      const evalRes = evaluateItemStatus(item);
      if ((evalRes.status === 'fail' || evalRes.status === 'flagged') && (!r?.notes || !r.notes.trim())) {
        errors.push(`Checkpoint #${idx + 1} (${item.label}) is ${evalRes.status.toUpperCase()} and requires an Operator Remark.`);
      }
    });

    // Required sensor check
    if (template?.sensor_thresholds?.pressure?.required && !pressure.trim()) {
      errors.push('Hydraulic Pressure reading is marked mandatory for this machinery category.');
    }
    if (template?.sensor_thresholds?.temperature?.required && !temperature.trim()) {
      errors.push('Operating Temperature reading is marked mandatory for this machinery category.');
    }
    if (template?.sensor_thresholds?.vibration?.required && !vibration.trim()) {
      errors.push('Spindle Vibration reading is marked mandatory for this machinery category.');
    }

    // Digital signature validation
    if (!hasSignature) {
      errors.push('Digital signature is required to certify shift machine clearance.');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleOpenReview = () => {
    if (validateInspectionForm()) {
      setSubmitError('');
      setIsReviewOpen(true);
    }
  };

  // 8. Final Submit Handler
  const handleFinalSubmit = async () => {
    if (submitting || !selectedMachine || !template) return;

    try {
      setSubmitting(true);
      setSubmitError('');

      // Build authoritative payload
      const payloadResponses = template.checklist.map((item) => {
        const resp = responses[item.id] || { value: true, notes: '', status: 'pass' };
        const evaluated = evaluateItemStatus(item);
        return {
          id: item.id,
          value: item.type === 'number' ? Number(resp.value) : resp.value,
          status: evaluated.status,
          notes: resp.notes?.trim() || undefined,
        };
      });

      const payload = {
        machine_id: selectedMachine.id,
        template_id: template.id,
        shift: user?.shift || 'Shift A',
        temperature: template.sensor_thresholds?.temperature && temperature.trim() ? parseFloat(temperature) : null,
        pressure: template.sensor_thresholds?.pressure && pressure.trim() ? parseFloat(pressure) : null,
        vibration: template.sensor_thresholds?.vibration && vibration.trim() ? parseFloat(vibration) : null,
        responses: payloadResponses,
        operator_signature_url: getSignatureDataUrl() || 'SIGNATURE_CAPTURED_ON_CONSOLE',
        escalate_on_fail: escalateOnFail,
      };

      const res = await apiClient.post('/inspections/submit', payload);
      if (res.data?.success) {
        setSubmissionResult(res.data.data);
        setIsReviewOpen(false);
        // Refresh records in background if history was loaded
        fetchInspectionHistory();
      }
    } catch (err: any) {
      setSubmitError(err.response?.data?.message || 'Failed to submit pre-shift machine audit.');
    } finally {
      setSubmitting(false);
    }
  };

  // 9. Fetch Inspection Records (History Tab)
  const fetchInspectionHistory = useCallback(async () => {
    try {
      setLoadingRecords(true);
      const params = new URLSearchParams();
      params.append('page', String(historyPagination.page));
      params.append('limit', String(historyPagination.limit));

      if (historyStatusFilter !== 'all') {
        params.append('overall_status', historyStatusFilter);
      }
      if (historyMachineFilter !== 'all') {
        params.append('machine_id', historyMachineFilter);
      }

      const res = await apiClient.get(`/inspections/records?${params.toString()}`);
      if (res.data?.success) {
        setRecords(res.data.data || []);
        if (res.data.pagination) {
          setHistoryPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load inspection records:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, [historyPagination.page, historyPagination.limit, historyStatusFilter, historyMachineFilter]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchInspectionHistory();
    }
  }, [activeTab, fetchInspectionHistory]);

  // 10. Fetch Single Inspection Record Details Modal
  const openRecordDetail = async (recordId: string) => {
    try {
      setLoadingRecordDetail(true);
      setRecordDetailError('');
      setSelectedRecordDetail(null);
      const res = await apiClient.get(`/inspections/records/${recordId}`);
      if (res.data?.success) {
        setSelectedRecordDetail(res.data.data);
      }
    } catch (err: any) {
      setRecordDetailError(err.response?.data?.message || 'Failed to retrieve inspection record details.');
    } finally {
      setLoadingRecordDetail(false);
    }
  };

  // Direct route detection: /inspections/records/:id or ?record_id=...
  useEffect(() => {
    const targetRecordId = routeRecordId || searchParams.get('record_id');
    if (targetRecordId) {
      openRecordDetail(targetRecordId);
    }
  }, [routeRecordId, searchParams]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Link
              to="/operator/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-black transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Operator Console</span>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">
              Pre-Shift Machinery Safety Audit
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Daily Operator Clearance
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Operator: <strong className="text-zinc-900">{user?.fullName || 'Operator'}</strong> ({user?.employeeCode || 'OP-01'}) • Shift: <strong className="text-zinc-900">{user?.shift || 'Shift A'}</strong> • Verify safety interlocks, physical gauge levels & telemetry readings before powering on.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsBreakdownModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Emergency Breakdown</span>
          </button>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 border-b-2 border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'audit'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white text-zinc-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 text-jcb-yellow" />
          <span>Execute Pre-Shift Audit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'history'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white text-zinc-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-jcb-yellow" />
          <span>Audit Logs & History</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUDIT EXECUTION FORM                                               */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Submission Result Banner */}
          {submissionResult && (
            <div className={`p-6 rounded-2xl border-2 shadow-md space-y-4 ${
              submissionResult.overall_status === 'fail'
                ? 'bg-red-50/70 border-red-300 text-red-950'
                : submissionResult.overall_status === 'flagged'
                ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
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
                        ? 'Inspection Completed with Deviations Flagged'
                        : 'Inspection Cleared - Machine Ready for Shift Production'}
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
                    <span>Automated Breakdown Maintenance Ticket Generated</span>
                  </div>
                  <p className="text-xs text-zinc-700">
                    Ticket <strong className="font-mono text-black font-black">{submissionResult.breakdown_complaint.complaint_number}</strong> was automatically logged and dispatched to plant supervisors due to critical checkpoint/sensor threshold breach. Machine marked as <strong className="uppercase text-red-700">BREAKDOWN</strong>.
                  </p>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openRecordDetail(submissionResult.id)}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl uppercase tracking-wider transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-jcb-yellow" />
                  <span>View Full Record Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmissionResult(null);
                    setResponses({});
                    clearSignature();
                  }}
                  className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-zinc-50 transition"
                >
                  Perform Another Audit
                </button>
                <Link
                  to="/operator/dashboard"
                  className="px-4 py-2.5 bg-white border border-zinc-300 text-zinc-800 text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-zinc-50 transition"
                >
                  Return to Operator Console
                </Link>
              </div>
            </div>
          )}

          {/* Validation Alert Box */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-300 text-red-950 rounded-2xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-black uppercase text-red-800 tracking-wider">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Inspection Validation Incomplete</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-red-800 font-medium pl-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1: Equipment Selection */}
          <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-zinc-800" />
                <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                  1. Production Machine Asset Verification
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
                    if (found) {
                      setSearchParams({ machine_id: found.id });
                    }
                  }}
                  disabled={loadingMachines}
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - {m.name} ({m.bay_line_location || m.shop_name || 'Production Floor'}) [{m.category || 'HMC'}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-zinc-500 font-bold uppercase text-[10px]">Criticality:</span>
                <span className="font-black text-zinc-900 uppercase">
                  {selectedMachine?.criticality?.replace('_', ' ') || 'CLASS A'}
                </span>
              </div>
            </div>
          </div>

          {/* Template Loading & Error States */}
          {loadingTemplate && (
            <div className="p-8 bg-white rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
              <span className="text-xs font-bold">Retrieving machine-category checklist template...</span>
            </div>
          )}

          {templateError && !loadingTemplate && (
            <div className="p-5 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-black uppercase tracking-wider">Template Configuration Notice</h4>
                <p className="font-medium text-red-800">{templateError}</p>
                <p className="text-[11px] text-zinc-600">
                  Please ensure an active checklist template is registered for machine category <strong>{selectedMachine?.category || 'Standard'}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Section 2: Dynamic Checklist Form */}
          {template && !loadingTemplate && !submissionResult && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden space-y-0">
              {/* Checklist Header */}
              <div className="p-4 sm:p-5 bg-zinc-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800">
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
                  <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-md">
                    {summary.pass} Pass
                  </span>
                  {summary.flagged > 0 && (
                    <span className="px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800 rounded-md">
                      {summary.flagged} Flagged
                    </span>
                  )}
                  {summary.fail > 0 && (
                    <span className="px-2.5 py-1 bg-red-950 text-red-400 border border-red-800 rounded-md animate-pulse">
                      {summary.fail} Fail
                    </span>
                  )}
                </div>
              </div>

              {/* Checklist Items Table / List */}
              <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-4">
                {template.checklist.map((item, index) => {
                  const currentResp = responses[item.id] || { value: true, notes: '', status: 'pass' };
                  const itemEvaluation = evaluateItemStatus(item);
                  const isItemFailing = itemEvaluation.status === 'fail';
                  const isItemFlagged = itemEvaluation.status === 'flagged';

                  return (
                    <div
                      key={item.id}
                      className={`pt-4 first:pt-0 rounded-xl p-3.5 transition ${
                        isItemFailing
                          ? 'bg-red-50/50 border border-red-200'
                          : isItemFlagged
                          ? 'bg-amber-50/50 border border-amber-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        {/* Checkpoint Title & Limits */}
                        <div className="space-y-1 max-w-xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-zinc-400">
                              #{index + 1}
                            </span>
                            <h4 className="text-xs font-bold text-zinc-950 leading-snug">
                              {item.label}
                            </h4>
                            {item.is_critical && (
                              <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 border border-red-200">
                                Critical Interlock
                              </span>
                            )}
                            {item.required && (
                              <span className="text-red-500 font-bold text-xs" title="Mandatory checkpoint">*</span>
                            )}
                          </div>

                          {/* Numeric spec guidelines */}
                          {item.type === 'number' && (
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 font-mono">
                              <span>Spec: {item.min} - {item.max} {item.unit || ''}</span>
                              {(item.critical_min !== undefined || item.critical_max !== undefined) && (
                                <span className="text-red-600 font-bold">
                                  (Critical: {item.critical_min !== undefined ? `< ${item.critical_min}` : ''} {item.critical_max !== undefined ? `> ${item.critical_max}` : ''})
                                </span>
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
                                    [item.id]: { ...currentResp, value: true, status: 'pass' },
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
                                    [item.id]: {
                                      ...currentResp,
                                      value: false,
                                      status: item.is_critical ? 'fail' : 'flagged',
                                    },
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
                                  isItemFailing
                                    ? 'border-red-500 bg-red-50 text-red-900'
                                    : isItemFlagged
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
                              {(item.options || ['Normal / OK', 'Requires Attention', 'Defective']).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Operator Remark Input if flagged or failed */}
                      {(isItemFailing || isItemFlagged) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-[10px] font-black text-red-700 uppercase shrink-0">
                            Operator Remark <span className="text-red-500">*</span>:
                          </span>
                          <input
                            type="text"
                            placeholder="State observed physical condition, noise, leak, or justification..."
                            value={currentResp.notes}
                            onChange={(e) =>
                              setResponses({
                                ...responses,
                                [item.id]: { ...currentResp, notes: e.target.value },
                              })
                            }
                            className="w-full p-1.5 bg-white border border-red-300 rounded text-xs font-medium text-zinc-900 focus:outline-none focus:border-red-500"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Section 3: Physical Gauge & Sensor Telemetry Readings */}
              {template.sensor_thresholds && Object.keys(template.sensor_thresholds).length > 0 && (
                <div className="p-5 bg-slate-50 border-t-2 border-slate-200 space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-zinc-800" />
                    <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                      2. Physical Gauge & Sensor Telemetry Readings
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Hydraulic Pressure Card */}
                    {template.sensor_thresholds.pressure && (() => {
                      const pEval = evaluateSensor('pressure', pressure);
                      const pLimit = template.sensor_thresholds.pressure;
                      return (
                        <div className={`p-3.5 rounded-xl border space-y-2 transition ${
                          pEval.status === 'fail'
                            ? 'bg-red-50/70 border-red-300'
                            : pEval.status === 'flagged'
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-white border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                            <span className="flex items-center gap-1.5">
                              <Gauge className="w-3.5 h-3.5 text-blue-600" />
                              <span>Hydraulic Pressure</span>
                              {pLimit.required && <span className="text-red-500">*</span>}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">{pLimit.unit || 'Bar'}</span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 50"
                            value={pressure}
                            onChange={(e) => setPressure(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                          />
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-zinc-500 font-mono">
                              Nominal: {pLimit.min ?? 45} - {pLimit.max ?? 55} {pLimit.unit || 'Bar'}
                            </p>
                            {pEval.status !== 'none' && (
                              <p className={`text-[10px] font-bold ${
                                pEval.status === 'fail' ? 'text-red-700' : pEval.status === 'flagged' ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {pEval.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Operating Temperature Card */}
                    {template.sensor_thresholds.temperature && (() => {
                      const tEval = evaluateSensor('temperature', temperature);
                      const tLimit = template.sensor_thresholds.temperature;
                      return (
                        <div className={`p-3.5 rounded-xl border space-y-2 transition ${
                          tEval.status === 'fail'
                            ? 'bg-red-50/70 border-red-300'
                            : tEval.status === 'flagged'
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-white border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                            <span className="flex items-center gap-1.5">
                              <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                              <span>Operating Temp</span>
                              {tLimit.required && <span className="text-red-500">*</span>}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">{tLimit.unit || '°C'}</span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 22"
                            value={temperature}
                            onChange={(e) => setTemperature(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                          />
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-zinc-500 font-mono">
                              Nominal: {tLimit.min ?? 18} - {tLimit.max ?? 24} {tLimit.unit || '°C'}
                            </p>
                            {tEval.status !== 'none' && (
                              <p className={`text-[10px] font-bold ${
                                tEval.status === 'fail' ? 'text-red-700' : tEval.status === 'flagged' ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {tEval.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Spindle Vibration Card */}
                    {template.sensor_thresholds.vibration && (() => {
                      const vEval = evaluateSensor('vibration', vibration);
                      const vLimit = template.sensor_thresholds.vibration;
                      return (
                        <div className={`p-3.5 rounded-xl border space-y-2 transition ${
                          vEval.status === 'fail'
                            ? 'bg-red-50/70 border-red-300'
                            : vEval.status === 'flagged'
                            ? 'bg-amber-50/70 border-amber-300'
                            : 'bg-white border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                            <span className="flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Spindle Vibration</span>
                              {vLimit.required && <span className="text-red-500">*</span>}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">{vLimit.unit || 'mm/s'}</span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="e.g. 1.2"
                            value={vibration}
                            onChange={(e) => setVibration(e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                          />
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-zinc-500 font-mono">
                              Tolerance: Max {vLimit.max ?? 2.5} {vLimit.unit || 'mm/s'}
                            </p>
                            {vEval.status !== 'none' && (
                              <p className={`text-[10px] font-bold ${
                                vEval.status === 'fail' ? 'text-red-700' : vEval.status === 'flagged' ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {vEval.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Section 4: Touch Digital Signature & Escalation Option */}
              <div className="p-5 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-zinc-800" />
                    <h3 className="text-xs font-black text-zinc-950 uppercase tracking-wider">
                      3. Operator Touch Digital Signature <span className="text-red-500">*</span>
                    </h3>
                  </div>
                  {hasSignature ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Signature Captured</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-xs font-bold text-zinc-500 hover:text-black flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
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
                <div className="flex items-center justify-between max-w-md">
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Sign with touchscreen stylus or mouse to certify shift inspection accountability.
                  </p>
                  {hasSignature && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[11px] font-bold text-zinc-500 hover:text-red-600"
                    >
                      Reset Signature
                    </button>
                  )}
                </div>

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
                    Auto-generate emergency breakdown complaint (CMP) and flag machine stoppage if critical checkpoint or sensor threshold fails
                  </label>
                </div>
              </div>

              {/* Action Bar */}
              <div className="p-4 sm:p-5 bg-slate-100 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-600 font-medium">
                  Authoritative server-side evaluation guarantees industrial compliance and audit reproducibility.
                </div>

                <button
                  type="button"
                  onClick={handleOpenReview}
                  className="px-6 py-3 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black rounded-xl uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Review & Commit Audit</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUDIT LOGS & INSPECTION HISTORY                                    */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                Historical Pre-Shift Audit Ledger
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by Machine */}
              <select
                value={historyMachineFilter}
                onChange={(e) => setHistoryMachineFilter(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-800"
              >
                <option value="all">All Plant Machines</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machine_code} - {m.name}
                  </option>
                ))}
              </select>

              {/* Filter by Status */}
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-800"
              >
                <option value="all">All Statuses</option>
                <option value="pass">Pass Only</option>
                <option value="flagged">Flagged Only</option>
                <option value="fail">Fail Only</option>
              </select>

              <button
                type="button"
                onClick={fetchInspectionHistory}
                disabled={loadingRecords}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-zinc-800 rounded-lg text-xs font-bold transition"
                title="Refresh Records"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRecords ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Records Table */}
          {loadingRecords ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
              <span className="text-xs font-bold">Querying regulatory audit records...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ClipboardCheck className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs font-bold text-zinc-600">No inspection records match current filter criteria.</p>
              <button
                type="button"
                onClick={() => {
                  setHistoryMachineFilter('all');
                  setHistoryStatusFilter('all');
                }}
                className="text-xs font-bold text-amber-600 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black text-zinc-400 uppercase tracking-wider">
                    <th className="py-3 px-3">Equipment</th>
                    <th className="py-3 px-3">Audit Template</th>
                    <th className="py-3 px-3">Shift / Operator</th>
                    <th className="py-3 px-3">Telemetry Readings</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                        <div className="font-bold text-zinc-950">{rec.machine_code}</div>
                        <div className="text-[10px] text-zinc-500 truncate max-w-[150px]">{rec.machine_name}</div>
                      </td>
                      <td className="py-3 px-3 font-medium text-zinc-700">
                        {rec.responses_json?.template_title || 'Daily Pre-Shift Inspection'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-900">{rec.shift || 'Shift A'}</div>
                        <div className="text-[10px] text-zinc-500">{rec.operator_name || 'Operator'}</div>
                      </td>
                      <td className="py-3 px-3 text-[11px] font-mono text-zinc-600">
                        {rec.pressure !== null && rec.pressure !== undefined && (
                          <span className="mr-2">P: {rec.pressure} Bar</span>
                        )}
                        {rec.temperature !== null && rec.temperature !== undefined && (
                          <span className="mr-2">T: {rec.temperature}°C</span>
                        )}
                        {rec.vibration !== null && rec.vibration !== undefined && (
                          <span>V: {rec.vibration} mm/s</span>
                        )}
                        {rec.pressure === null && rec.temperature === null && rec.vibration === null && (
                          <span className="text-zinc-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={rec.overall_status} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openRecordDetail(rec.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-zinc-900 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5 text-jcb-yellow" />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination bar */}
              <div className="pt-4 flex items-center justify-between text-xs text-zinc-500 border-t border-slate-100">
                <span>
                  Showing {records.length} of {historyPagination.total} audit logs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={historyPagination.page <= 1}
                    onClick={() =>
                      setHistoryPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                    }
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono font-bold">
                    Page {historyPagination.page} / {historyPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={historyPagination.page >= historyPagination.totalPages}
                    onClick={() =>
                      setHistoryPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW & SUBMISSION MODAL                                                 */}
      {/* ========================================================================= */}
      {isReviewOpen && template && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">Confirm Pre-Shift Sign-Off</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg font-bold">
                  {submitError}
                </div>
              )}

              {/* Asset & Operator Strip */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Machine:</span>
                  <strong className="text-zinc-950 font-mono">
                    {selectedMachine?.machine_code} ({selectedMachine?.name})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Category & Location:</span>
                  <span className="text-zinc-800 font-medium">
                    {selectedMachine?.category} • {selectedMachine?.bay_line_location || 'Shop Floor'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold uppercase text-[10px]">Shift / Signatory:</span>
                  <span className="text-zinc-800 font-semibold">
                    {user?.shift || 'Shift A'} • {user?.fullName} ({user?.employeeCode || 'OP-01'})
                  </span>
                </div>
              </div>

              {/* Summary Counters */}
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

              {/* Status Alert Message */}
              {summary.fail > 0 ? (
                <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl space-y-2">
                  <div className="text-xs font-black text-red-800 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Critical Failures Detected</span>
                  </div>
                  <p className="text-[11px] text-red-700 font-medium leading-relaxed">
                    This audit will evaluate to <strong className="uppercase">FAIL</strong>.
                    {escalateOnFail && ' An emergency maintenance breakdown ticket (CMP) will be automatically dispatched to supervisors.'}
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-red-800 font-medium space-y-0.5">
                    {summary.criticalFailures.map((cf, idx) => (
                      <li key={idx}>{cf}</li>
                    ))}
                  </ul>
                </div>
              ) : summary.flagged > 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="text-xs font-black text-amber-800 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Operating Deviations Flagged</span>
                  </div>
                  <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                    Audit will evaluate to <strong className="uppercase">FLAGGED</strong>. Supervisor will be notified of deviations for monitoring.
                  </p>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 font-medium space-y-0.5">
                    {summary.deviations.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1">
                  <div className="text-xs font-black text-emerald-800 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>All Interlocks & Telemetry Nominal</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-medium leading-relaxed">
                    Audit evaluates to <strong className="uppercase">PASS</strong>. Equipment is cleared for immediate production shift operations.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
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
                    <span>Transmitting Audit...</span>
                  </>
                ) : (
                  <span>Commit Shift Audit</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE RECORD DETAIL MODAL                                                */}
      {/* ========================================================================= */}
      {(selectedRecordDetail || loadingRecordDetail || recordDetailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Pre-Shift Inspection Record Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecordDetail(null);
                  setRecordDetailError('');
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {loadingRecordDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
                  <span className="text-xs font-bold">Loading inspection envelope snapshot...</span>
                </div>
              ) : recordDetailError ? (
                <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold">
                  {recordDetailError}
                </div>
              ) : selectedRecordDetail && (
                <div className="space-y-4">
                  {/* Top Details Strip */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Machine</span>
                      <strong className="text-zinc-950 font-mono">
                        {selectedRecordDetail.machine_code} ({selectedRecordDetail.machine_name})
                      </strong>
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Location</span>
                      <span className="text-zinc-800 font-semibold">
                        {selectedRecordDetail.shop_name || 'Bay 1'}, {selectedRecordDetail.plant_name || 'Plant'}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Status</span>
                      <StatusBadge status={selectedRecordDetail.overall_status} size="sm" />
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Operator</span>
                      <span className="text-zinc-800 font-semibold">
                        {selectedRecordDetail.operator_name} ({selectedRecordDetail.operator_employee_code || 'OP'})
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Shift</span>
                      <span className="text-zinc-800 font-semibold">{selectedRecordDetail.shift || 'Shift A'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Date & Time</span>
                      <span className="text-zinc-600 font-mono text-[11px]">
                        {new Date(selectedRecordDetail.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Readings Summary */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-[11px] font-black uppercase text-zinc-600 tracking-wider mb-2">
                      Recorded Telemetry Readings
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase">Pressure</span>
                        <strong className="text-zinc-900">{selectedRecordDetail.pressure !== null ? `${selectedRecordDetail.pressure} Bar` : 'N/A'}</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase">Temperature</span>
                        <strong className="text-zinc-900">{selectedRecordDetail.temperature !== null ? `${selectedRecordDetail.temperature} °C` : 'N/A'}</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase">Vibration</span>
                        <strong className="text-zinc-900">{selectedRecordDetail.vibration !== null ? `${selectedRecordDetail.vibration} mm/s` : 'N/A'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Checkpoints Table */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black uppercase text-zinc-600 tracking-wider">
                      Itemized Checklist Responses
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-[10px] font-black uppercase text-zinc-500">
                          <tr>
                            <th className="p-2.5">Checkpoint</th>
                            <th className="p-2.5">Reading / Value</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedRecordDetail.responses_json?.items || []).map((ci: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-2.5 font-bold text-zinc-900">{ci.label || ci.id}</td>
                              <td className="p-2.5 font-mono text-zinc-700">
                                {typeof ci.value === 'boolean' ? (ci.value ? 'PASS' : 'FAIL') : String(ci.value ?? '')}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  ci.status === 'fail'
                                    ? 'bg-red-100 text-red-800'
                                    : ci.status === 'flagged'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {ci.status || 'PASS'}
                                </span>
                              </td>
                              <td className="p-2.5 text-zinc-600 text-[11px] italic">
                                {ci.notes || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Digital Signature Preview */}
                  {selectedRecordDetail.operator_signature_url && selectedRecordDetail.operator_signature_url.startsWith('data:image') && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black uppercase text-zinc-500 block">
                        Certified Operator Digital Signature
                      </span>
                      <img
                        src={selectedRecordDetail.operator_signature_url}
                        alt="Operator Signature"
                        className="h-16 border border-slate-300 rounded bg-white p-1"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedRecordDetail(null)}
                className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Emergency Breakdown Report Modal */}
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

export default PreShiftInspectionPage;
