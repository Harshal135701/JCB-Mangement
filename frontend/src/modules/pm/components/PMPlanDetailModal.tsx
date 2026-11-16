import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Clock,
  ListChecks,
  Cpu,
  History,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PMPlan } from '../types';
import { fetchPMPlanById, fetchMachinePMHistory } from '../services/pmService';

interface PMPlanDetailModalProps {
  planId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PMPlanDetailModal: React.FC<PMPlanDetailModalProps> = ({
  planId,
  isOpen,
  onClose,
}) => {
  const [plan, setPlan] = useState<PMPlan | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!planId || !isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchPMPlanById(planId);
        setPlan(data);
        if (data.machine_id) {
          const hist = await fetchMachinePMHistory(data.machine_id);
          setHistory(hist);
        }
      } catch (err) {
        console.error('Failed to load PM plan detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [planId, isOpen]);

  if (!isOpen || !planId) return null;

  const checklistItems = plan?.checklist_template || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black font-black text-sm px-2.5 py-0.5 rounded shadow">
              {plan?.plan_code || 'PM'}
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">
                PREVENTIVE MAINTENANCE PLAN SPECIFICATION
              </h3>
              <p className="text-[11px] text-zinc-400">
                Machine checklist guidelines, cadence parameters and work order history.
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {loading ? (
            <div className="p-8 text-center text-zinc-400">Loading plan specifications...</div>
          ) : plan ? (
            <>
              {/* Top Overview Card */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-zinc-900">{plan.title}</h4>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                      plan.is_active
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-zinc-600">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Target Machine
                    </span>
                    <span className="font-bold text-zinc-900">{plan.machine_code}</span>
                    <span className="block text-[10px] text-zinc-500">{plan.machine_name}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Cadence & Cycle
                    </span>
                    <span className="font-bold text-zinc-900 capitalize">{plan.frequency}</span>
                    <span className="block text-[10px] text-zinc-500">Every {plan.interval_days} Days</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Grace Buffer
                    </span>
                    <span className="font-bold text-zinc-900 font-mono">+{plan.grace_period_days} Days</span>
                    <span className="block text-[10px] text-zinc-500">Before Overdue</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Meter Trigger
                    </span>
                    <span className="font-bold text-zinc-900 font-mono">
                      {plan.operating_hour_threshold ? `${plan.operating_hour_threshold} hrs` : 'Calendar Only'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checklist Template */}
              <div>
                <h5 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-amber-500" />
                  Standard Maintenance Checklist ({checklistItems.length} Steps)
                </h5>

                <div className="space-y-1.5 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 max-h-48 overflow-y-auto">
                  {checklistItems.map((item: any, idx: number) => {
                    const taskText = typeof item === 'string' ? item : item.task || JSON.stringify(item);
                    return (
                      <div
                        key={idx}
                        className="p-2 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 flex items-center gap-2.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span>{taskText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Machine PM History */}
              <div>
                <h5 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-amber-500" />
                  Machine Historical Maintenance Executions ({history.length})
                </h5>

                <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">WO #</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Completion Date</th>
                        <th className="px-3 py-2">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {history.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-zinc-400">
                            No prior completed work orders recorded for this machine asset.
                          </td>
                        </tr>
                      ) : (
                        history.map((h) => (
                          <tr key={h.id} className="hover:bg-zinc-50">
                            <td className="px-3 py-2 font-mono font-bold text-amber-700">{h.wo_number}</td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 uppercase">
                                {h.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-600">
                              {h.repair_completed_time
                                ? new Date(h.repair_completed_time).toLocaleDateString()
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-zinc-600 max-w-xs truncate">
                              {h.technician_remarks || h.work_instructions || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 flex justify-end shrink-0 bg-zinc-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
