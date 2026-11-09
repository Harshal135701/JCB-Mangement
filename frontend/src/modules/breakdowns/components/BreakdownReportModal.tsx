import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { 
  AlertTriangle, 
  X, 
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Info
} from 'lucide-react';

interface MachineOption {
  id: string;
  machine_code: string;
  name: string;
  bay_line_location?: string;
  shop_name?: string;
  status?: string;
}

interface BreakdownReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (complaint: any) => void;
  preselectedMachineId?: string;
}

export const BreakdownReportModal: React.FC<BreakdownReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedMachineId,
}) => {
  const { user } = useAuth();
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [machineFetchError, setMachineFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);
  const [successComplaint, setSuccessComplaint] = useState<any | null>(null);

  const getInitialForm = useCallback(() => ({
    machine_id: preselectedMachineId || '',
    shift: user?.shift || 'Shift A',
    issue_category: 'hydraulic',
    priority: 'high',
    problem_title: '',
    description: '',
    hour_meter_reading: '',
    temperature: '',
    pressure: '',
  }), [preselectedMachineId, user?.shift]);

  const [form, setForm] = useState(getInitialForm);

  // Fetch machines for selection dropdown with retry capability
  const fetchMachines = useCallback(async () => {
    try {
      setLoadingMachines(true);
      setMachineFetchError(null);
      const res = await apiClient.get('/machines?limit=100');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMachines(res.data.data);
      } else {
        setMachineFetchError('Unexpected response format when loading machines.');
      }
    } catch (err: any) {
      setMachineFetchError(err.response?.data?.message || 'Failed to retrieve machine assets.');
    } finally {
      setLoadingMachines(false);
    }
  }, []);

  // Reset form and errors when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm());
      setError('');
      setDuplicateWarning(null);
      setSuccessComplaint(null);
      fetchMachines();
    } else {
      setError('');
      setDuplicateWarning(null);
      setSuccessComplaint(null);
    }
  }, [isOpen, getInitialForm, fetchMachines]);

  // Update machine_id when preselectedMachineId changes
  useEffect(() => {
    if (preselectedMachineId) {
      setForm((prev) => ({ ...prev, machine_id: preselectedMachineId }));
    }
  }, [preselectedMachineId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setDuplicateWarning(null);

    // 1. Mandatory Field Validation
    if (!form.machine_id) {
      setError('Please select an affected machine equipment.');
      return;
    }
    if (!form.problem_title.trim()) {
      setError('Problem / symptom title is required (max 255 characters).');
      return;
    }
    if (form.problem_title.trim().length > 255) {
      setError('Problem title cannot exceed 255 characters.');
      return;
    }
    if (!form.description.trim()) {
      setError('Detailed observation remarks are required.');
      return;
    }

    // 2. Numeric Readings Validation
    if (form.hour_meter_reading) {
      const hmr = Number(form.hour_meter_reading);
      if (isNaN(hmr) || hmr < 0 || hmr > 99999999.99) {
        setError('Operating hour meter reading must be a non-negative number.');
        return;
      }
    }

    if (form.temperature) {
      const temp = Number(form.temperature);
      if (isNaN(temp) || temp < -100 || temp > 2000) {
        setError('Temperature must be a valid numeric reading between -100°C and 2000°C.');
        return;
      }
    }

    if (form.pressure) {
      const press = Number(form.pressure);
      if (isNaN(press) || press < 0 || press > 10000) {
        setError('Pressure reading must be a valid non-negative number (0 - 10,000 Bar).');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        machine_id: form.machine_id,
        shift: form.shift.trim() || 'Shift A',
        issue_category: form.issue_category.toLowerCase(),
        priority: form.priority.toLowerCase(),
        problem_title: form.problem_title.trim(),
        description: form.description.trim(),
        hour_meter_reading: form.hour_meter_reading ? Number(form.hour_meter_reading) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        pressure: form.pressure ? Number(form.pressure) : null,
      };

      const res = await apiClient.post('/breakdowns', payload);
      if (res.data?.success) {
        const createdComplaint = res.data.data;
        setSuccessComplaint(createdComplaint);

        if (onSuccess) {
          onSuccess(createdComplaint);
        }

        // Close modal after brief success presentation
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      if (err.response?.data?.isDuplicate) {
        setDuplicateWarning(err.response.data.existingComplaint || true);
        setError(
          err.response.data.message ||
          'A breakdown ticket for this fault category is already active on this machine.'
        );
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to submit breakdown complaint.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header - Industrial Black with Red Alert Accent */}
        <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/30 text-red-500 border border-red-500/40 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide uppercase">Report Machine Breakdown</h3>
              <p className="text-[10px] text-zinc-400 font-semibold">Immediate line stoppage notification to maintenance crew</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Success Message Banner */}
          {successComplaint && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black text-sm block">
                  Complaint Registered: {successComplaint.complaint_number}
                </span>
                <span className="text-[11px] text-emerald-700">
                  Maintenance crew and plant supervisors notified. Ticket logged in triage queue.
                </span>
              </div>
            </div>
          )}

          {/* Machine Loading Error */}
          {machineFetchError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{machineFetchError}</span>
              </div>
              <button
                type="button"
                onClick={fetchMachines}
                disabled={loadingMachines}
                className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-[11px] flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3 h-3 ${loadingMachines ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* General / Duplicate Error Banner */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{error}</span>
                {duplicateWarning && typeof duplicateWarning === 'object' && duplicateWarning.complaint_number && (
                  <p className="mt-1 text-[11px] text-red-700">
                    Active Complaint: <strong>{duplicateWarning.complaint_number}</strong> ({duplicateWarning.priority?.toUpperCase()} priority) is currently pending review.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Machine Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Machine Asset *
              </label>
              {loadingMachines && (
                <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading assets...
                </span>
              )}
            </div>
            <select
              required
              disabled={loadingMachines || submitting || !!successComplaint}
              value={form.machine_id}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
            >
              <option value="">-- Select Affected Equipment --</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} - {m.name} ({m.bay_line_location || m.shop_name || 'Bay 1'}) [Status: {m.status || 'running'}]
                </option>
              ))}
            </select>
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Fault Category *
              </label>
              <select
                disabled={submitting || !!successComplaint}
                value={form.issue_category}
                onChange={(e) => setForm({ ...form, issue_category: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
              >
                <option value="hydraulic">Hydraulic System</option>
                <option value="mechanical">Mechanical / Spindle / Gears</option>
                <option value="electrical">Electrical / Motors / Wiring</option>
                <option value="lubrication">Lubrication / Coolant</option>
                <option value="safety">Safety Interlock / Light Curtain</option>
                <option value="other">Other Operational Fault</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                Priority Level *
              </label>
              <select
                disabled={submitting || !!successComplaint}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
              >
                <option value="critical">Critical (Line Stoppage - Immediate SLA)</option>
                <option value="high">High (Production Impaired)</option>
                <option value="medium">Medium (Degraded Performance)</option>
                <option value="low">Low (Minor Noise / Routine)</option>
              </select>
            </div>
          </div>

          {/* Problem Title */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Symptom / Problem Title *
            </label>
            <input
              type="text"
              required
              maxLength={255}
              disabled={submitting || !!successComplaint}
              placeholder="e.g. Spindle hydraulic pressure dropped to 20 bar with oil leakage"
              value={form.problem_title}
              onChange={(e) => setForm({ ...form, problem_title: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
            />
          </div>

          {/* Detailed Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Detailed Observation Remarks *
            </label>
            <textarea
              rows={3}
              required
              disabled={submitting || !!successComplaint}
              placeholder="Describe abnormal noises, smoke, visual warning indicators, error code on CNC screen..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
            />
          </div>

          {/* Gauge Readings (Optional Hour Meter & Sensors) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Hour Meter (hrs)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                disabled={submitting || !!successComplaint}
                placeholder="4520"
                value={form.hour_meter_reading}
                onChange={(e) => setForm({ ...form, hour_meter_reading: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Pressure (Bar)
              </label>
              <input
                type="number"
                min="0"
                max="10000"
                step="0.1"
                disabled={submitting || !!successComplaint}
                placeholder="210"
                value={form.pressure}
                onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Temp (°C)
              </label>
              <input
                type="number"
                min="-100"
                max="2000"
                step="0.1"
                disabled={submitting || !!successComplaint}
                placeholder="42"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !!successComplaint}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Ticket...</span>
                </>
              ) : successComplaint ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dispatched!</span>
                </>
              ) : (
                <span>Dispatch Ticket (CMP)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
