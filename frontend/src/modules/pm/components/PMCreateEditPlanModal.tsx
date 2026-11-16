import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { PMPlan, PMFrequency } from '../types';

interface PMCreateEditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  editingPlan?: PMPlan | null;
  machines: any[];
}

const FREQUENCY_DAYS: Record<PMFrequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
};

export const PMCreateEditPlanModal: React.FC<PMCreateEditPlanModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingPlan,
  machines,
}) => {
  const [machineId, setMachineId] = useState('');
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<PMFrequency>('monthly');
  const [intervalDays, setIntervalDays] = useState(30);
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [operatingHourThreshold, setOperatingHourThreshold] = useState<string>('');
  const [checklistItems, setChecklistItems] = useState<string[]>([
    'Inspect hydraulic fluid level and contamination check',
    'Verify pressure relief valves and seal integrity',
    'Lubricate grease fittings and linear bearings',
    'Check electrical harness and terminal block tightness',
  ]);
  const [newChecklistStep, setNewChecklistStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingPlan) {
      setMachineId(editingPlan.machine_id);
      setTitle(editingPlan.title);
      setFrequency(editingPlan.frequency);
      setIntervalDays(editingPlan.interval_days || 30);
      setGracePeriodDays(editingPlan.grace_period_days || 3);
      setOperatingHourThreshold(
        editingPlan.operating_hour_threshold ? String(editingPlan.operating_hour_threshold) : ''
      );
      if (Array.isArray(editingPlan.checklist_template)) {
        setChecklistItems(
          editingPlan.checklist_template.map((item: any) =>
            typeof item === 'string' ? item : item.task || JSON.stringify(item)
          )
        );
      }
    } else {
      setMachineId(machines[0]?.id || '');
      setTitle('');
      setFrequency('monthly');
      setIntervalDays(30);
      setGracePeriodDays(3);
      setOperatingHourThreshold('');
      setChecklistItems([
        'Inspect hydraulic fluid level and contamination check',
        'Verify pressure relief valves and seal integrity',
        'Lubricate grease fittings and linear bearings',
        'Check electrical harness and terminal block tightness',
      ]);
    }
    setErrorMsg(null);
  }, [editingPlan, machines, isOpen]);

  const handleFrequencyChange = (newFreq: PMFrequency) => {
    setFrequency(newFreq);
    setIntervalDays(FREQUENCY_DAYS[newFreq] || 30);
  };

  const handleAddStep = () => {
    if (!newChecklistStep.trim()) return;
    setChecklistItems([...checklistItems, newChecklistStep.trim()]);
    setNewChecklistStep('');
  };

  const handleRemoveStep = (idx: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan && !machineId) {
      setErrorMsg('Please select a target machine asset.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Plan title is mandatory.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const payload: any = {
        title: title.trim(),
        frequency,
        interval_days: Number(intervalDays) || 30,
        grace_period_days: Number(gracePeriodDays) || 3,
        operating_hour_threshold: operatingHourThreshold ? parseFloat(operatingHourThreshold) : null,
        checklist_template: checklistItems,
      };

      if (!editingPlan) {
        payload.machine_id = machineId;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save PM plan.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black font-black text-sm px-2.5 py-0.5 rounded shadow">
              JCB PM
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">
                {editingPlan ? 'UPDATE PREVENTIVE MAINTENANCE PLAN' : 'CONFIGURE PREVENTIVE MAINTENANCE SCHEDULE'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {editingPlan ? `Editing ${editingPlan.plan_code}` : 'Define routine service intervals and maintenance checklists.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Machine Selection */}
          {!editingPlan && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                Target Machine Asset *
              </label>
              <select
                required
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Choose machine from plant registry --</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machine_code} - {m.name} ({m.shop_name || 'Plant Shop'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Plan Title */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
              Maintenance Plan Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 500-Hour Hydraulic Seal, Oil & Filter Overhaul"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Cadence Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">
                Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => handleFrequencyChange(e.target.value as PMFrequency)}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semiannual">Semi-Annual</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">
                Interval (Days)
              </label>
              <input
                type="number"
                min="1"
                value={intervalDays}
                onChange={(e) => setIntervalDays(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">
                Grace Buffer (Days)
              </label>
              <input
                type="number"
                min="0"
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 uppercase mb-1">
                Meter Trigger (Hrs)
              </label>
              <input
                type="number"
                min="0"
                placeholder="Optional"
                value={operatingHourThreshold}
                onChange={(e) => setOperatingHourThreshold(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Checklist Template Builder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-zinc-700 uppercase">
                Service Checklist Steps ({checklistItems.length})
              </label>
              <span className="text-[10px] text-zinc-400">
                Technicians will verify these items during PM execution
              </span>
            </div>

            {/* Checklist Items List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-zinc-200 rounded-lg p-2 bg-zinc-50/50">
              {checklistItems.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2 bg-white border border-zinc-200 rounded-md text-xs font-medium text-zinc-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="truncate">{step}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="text-zinc-400 hover:text-rose-600 p-1 rounded transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Step Input */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                placeholder="Add checklist inspection step..."
                value={newChecklistStep}
                onChange={(e) => setNewChecklistStep(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="px-3 py-1.5 bg-zinc-800 text-white rounded-lg text-xs font-bold hover:bg-black transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Deploying...' : editingPlan ? 'Update Plan' : 'Deploy PM Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
