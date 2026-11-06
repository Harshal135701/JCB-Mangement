import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { 
  AlertTriangle, 
  X, 
  UploadCloud, 
  CheckCircle2, 
  Loader2,
  AlertCircle
} from 'lucide-react';

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
  const [machines, setMachines] = useState<any[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null);

  const [form, setForm] = useState({
    machine_id: preselectedMachineId || '',
    shift: user?.shift || 'Shift A',
    issue_category: 'hydraulic',
    priority: 'high',
    problem_title: '',
    description: '',
    hour_meter_reading: '',
    temperature: '',
    pressure: '',
    images_json: [] as string[],
  });

  // Fetch machines for selection dropdown
  useEffect(() => {
    if (isOpen) {
      const fetchMachines = async () => {
        try {
          setLoadingMachines(true);
          const res = await apiClient.get('/machines?limit=100');
          if (res.data?.success && Array.isArray(res.data.data)) {
            setMachines(res.data.data);
          }
        } catch {
          // machines fetch failed
        } finally {
          setLoadingMachines(false);
        }
      };
      fetchMachines();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedMachineId) {
      setForm((prev) => ({ ...prev, machine_id: preselectedMachineId }));
    }
  }, [preselectedMachineId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDuplicateWarning(null);

    if (!form.machine_id) {
      setError('Please select a machine.');
      return;
    }
    if (!form.problem_title.trim()) {
      setError('Please provide a symptom or problem title.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        machine_id: form.machine_id,
        shift: form.shift,
        issue_category: form.issue_category.toLowerCase(),
        priority: form.priority.toLowerCase(),
        problem_title: form.problem_title.trim(),
        description: form.description.trim() || form.problem_title.trim(),
        hour_meter_reading: form.hour_meter_reading ? Number(form.hour_meter_reading) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        pressure: form.pressure ? Number(form.pressure) : null,
        images_json: form.images_json.length > 0 ? form.images_json : null,
      };

      const res = await apiClient.post('/breakdowns', payload);
      if (res.data?.success) {
        if (onSuccess) {
          onSuccess(res.data.data);
        }
        onClose();
      }
    } catch (err: any) {
      if (err.response?.data?.isDuplicate) {
        setDuplicateWarning(err.response.data.existingComplaint || true);
        setError(err.response.data.message || 'An active breakdown ticket already exists for this machine.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to submit breakdown complaint.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
        {/* Header - Heavy Industrial Black with Red Alert Accent */}
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
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{error}</span>
                {duplicateWarning && (
                  <p className="mt-1 text-[11px] text-red-700">
                    Active ticket in progress. Supervisors are already notified.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Machine Selector */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Machine Asset *
            </label>
            <select
              required
              disabled={loadingMachines}
              value={form.machine_id}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">-- Select Affected Equipment --</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} - {m.name} ({m.bay_line_location || m.shop_name || 'Bay 1'}) [Status: {m.status}]
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
                value={form.issue_category}
                onChange={(e) => setForm({ ...form, issue_category: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
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
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
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
              placeholder="e.g. Spindle hydraulic pressure dropped to 20 bar with oil pool"
              value={form.problem_title}
              onChange={(e) => setForm({ ...form, problem_title: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Detailed Observation Remarks
            </label>
            <textarea
              rows={3}
              placeholder="Describe abnormal noises, smoke, visual warning indicators, error code on CNC screen..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            />
          </div>

          {/* Gauge Readings (Optional Hour Meter & Sensor) */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Hour Meter (hrs)
              </label>
              <input
                type="number"
                placeholder="4520"
                value={form.hour_meter_reading}
                onChange={(e) => setForm({ ...form, hour_meter_reading: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Pressure (Bar)
              </label>
              <input
                type="number"
                placeholder="210"
                value={form.pressure}
                onChange={(e) => setForm({ ...form, pressure: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                Temp (°C)
              </label>
              <input
                type="number"
                placeholder="42"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-zinc-900"
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
              disabled={submitting}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
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
