import React, { useState } from 'react';
import { X, Calendar, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface PMActionModalProps {
  type: 'reschedule' | 'defer' | 'skip';
  plan: any;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const PMActionModal: React.FC<PMActionModalProps> = ({
  type,
  plan,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [newDate, setNewDate] = useState<string>(
    new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
  );
  const [deferDays, setDeferDays] = useState<number>(7);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !plan) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg('Operational justification reason is mandatory.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      if (type === 'reschedule') {
        await onSubmit({ new_date: newDate, reason: reason.trim() });
      } else if (type === 'defer') {
        await onSubmit({ days: Number(deferDays) || 7, reason: reason.trim() });
      } else if (type === 'skip') {
        await onSubmit({ reason: reason.trim() });
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    reschedule: 'RESCHEDULE PREVENTIVE MAINTENANCE',
    defer: 'DEFER PREVENTIVE MAINTENANCE SCHEDULE',
    skip: 'SKIP PREVENTIVE MAINTENANCE CYCLE',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-white text-zinc-950 flex items-center justify-between border-b border-zinc-200">
          <div>
            <h3 className="text-xs font-black tracking-wider uppercase">{titles[type]}</h3>
            <p className="text-[11px] text-zinc-500">
              {plan.plan_code} • {plan.machine_code || 'Machinery Asset'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-5 mt-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {type === 'reschedule' && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                New Target Maintenance Date *
              </label>
              <input
                type="date"
                required
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {type === 'defer' && (
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                Defer By (Days) *
              </label>
              <input
                type="number"
                min="1"
                max="90"
                required
                value={deferDays}
                onChange={(e) => setDeferDays(parseInt(e.target.value, 10) || 7)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}

          {type === 'skip' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
              <span className="font-bold">Warning:</span> Skipping this PM cycle will automatically advance the schedule to the next planned recurrence without generating a work order for this window.
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
              Operational Justification / Reason *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Critical production run ongoing in main assembly line; approved by plant manager."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-xs cursor-pointer ${
                type === 'skip'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              } disabled:opacity-50`}
            >
              {loading ? 'Processing...' : type === 'skip' ? 'Confirm Skip' : 'Confirm Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
