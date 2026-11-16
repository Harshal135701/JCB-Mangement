import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Package,
  Cpu,
  Layers,
  Send,
  Plus,
  Trash2,
  Check,
} from 'lucide-react';
import { PMExecutionDetail } from '../types';
import {
  fetchPMExecutionChecklist,
  submitPMExecutionChecklist,
  completePMExecution,
} from '../services/pmService';

interface PMExecutionModalProps {
  executionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isTechnician: boolean;
}

export const PMExecutionModal: React.FC<PMExecutionModalProps> = ({
  executionId,
  isOpen,
  onClose,
  onSuccess,
  isTechnician,
}) => {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [responses, setResponses] = useState<Array<{ step_index: number; task: string; status: 'pass' | 'fail'; notes?: string }>>([]);
  const [overallStatus, setOverallStatus] = useState<'pass' | 'fail'>('pass');
  const [checklistSubmitted, setChecklistSubmitted] = useState(false);

  // Completion fields
  const [workPerformed, setWorkPerformed] = useState('');
  const [technicianRemarks, setTechnicianRemarks] = useState('');
  const [partsUsed, setPartsUsed] = useState<Array<{ part_id: string; quantity: number }>>([]);
  const [submittingChecklist, setSubmittingChecklist] = useState(false);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!executionId || !isOpen) return;

    const loadChecklistData = async () => {
      try {
        setLoading(true);
        setFeedback(null);
        setChecklistSubmitted(false);

        const data = await fetchPMExecutionChecklist(executionId);
        let items: any[] = [];

        if (data.checklist) {
          if (Array.isArray(data.checklist)) {
            items = data.checklist;
          } else if (Array.isArray(data.checklist.responses)) {
            items = data.checklist.responses;
            setChecklistSubmitted(true);
          }
        }

        // If no checklist exists on execution, fallback to standard industrial verification steps
        if (items.length === 0) {
          items = [
            'Inspect hydraulic fluid level and contamination check',
            'Verify pressure relief valves and seal integrity',
            'Lubricate grease fittings and linear bearings',
            'Check electrical harness and terminal block tightness',
            'Perform functional dry run and verify no abnormal vibration',
          ];
        }

        setChecklist(items);
        setResponses(
          items.map((item, idx) => ({
            step_index: idx + 1,
            task: typeof item === 'string' ? item : item.task || `Step ${idx + 1}`,
            status: 'pass',
            notes: '',
          }))
        );
      } catch (err: any) {
        console.error('Failed to load PM execution checklist:', err);
        setFeedback({
          type: 'error',
          text: err?.response?.data?.message || 'Failed to load PM checklist.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadChecklistData();
  }, [executionId, isOpen]);

  if (!isOpen || !executionId) return null;

  const handleToggleItemStatus = (idx: number, status: 'pass' | 'fail') => {
    const next = [...responses];
    next[idx].status = status;
    setResponses(next);

    // If any item fails, mark overall status as fail
    if (next.some((r) => r.status === 'fail')) {
      setOverallStatus('fail');
    } else {
      setOverallStatus('pass');
    }
  };

  const handleItemNotesChange = (idx: number, notes: string) => {
    const next = [...responses];
    next[idx].notes = notes;
    setResponses(next);
  };

  const handleSubmitChecklist = async () => {
    try {
      setSubmittingChecklist(true);
      setFeedback(null);
      await submitPMExecutionChecklist(executionId, responses, overallStatus);
      setChecklistSubmitted(true);
      setFeedback({
        type: 'success',
        text: 'PM checklist steps recorded successfully! You may now submit final completion.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to record checklist responses.',
      });
    } finally {
      setSubmittingChecklist(false);
    }
  };

  const handleCompleteExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workPerformed.trim()) {
      setFeedback({ type: 'error', text: 'Details of work performed are required.' });
      return;
    }

    try {
      setSubmittingCompletion(true);
      setFeedback(null);

      // Auto-submit checklist if not already submitted
      if (!checklistSubmitted) {
        await submitPMExecutionChecklist(executionId, responses, overallStatus);
      }

      await completePMExecution(executionId, {
        work_performed: workPerformed.trim(),
        technician_remarks: technicianRemarks.trim(),
        parts_used: partsUsed,
      });

      alert('PM Maintenance completed and submitted for manager verification!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to complete PM execution.',
      });
    } finally {
      setSubmittingCompletion(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black font-black text-sm px-2.5 py-0.5 rounded shadow">
              PM EXECUTION
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">
                TECHNICIAN PREVENTIVE MAINTENANCE WORKBENCH
              </h3>
              <p className="text-[11px] text-zinc-400">
                Execute digital service checklist and submit completed maintenance.
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

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Section 1: Digital Checklist Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  Digital Checklist Verification ({responses.length} Items)
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Verify each factory maintenance step. Mark Pass or Fail and record observations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-500">Overall:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    overallStatus === 'pass'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {overallStatus.toUpperCase()}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 text-center text-xs text-zinc-400">Loading checklist steps...</div>
            ) : (
              <div className="space-y-2 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                {responses.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-zinc-200 rounded-lg space-y-2 hover:border-zinc-300 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-zinc-900">{item.task}</span>
                      </div>

                      {/* Status Toggle Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleItemStatus(idx, 'pass')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                            item.status === 'pass'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleItemStatus(idx, 'fail')}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                            item.status === 'fail'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          Fail
                        </button>
                      </div>
                    </div>

                    {/* Step Notes */}
                    <input
                      type="text"
                      placeholder="Add observation / sensor reading (optional)..."
                      value={item.notes || ''}
                      onChange={(e) => handleItemNotesChange(idx, e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSubmitChecklist}
                disabled={submittingChecklist}
                className="px-3.5 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-black transition disabled:opacity-50 cursor-pointer"
              >
                {submittingChecklist ? 'Saving...' : checklistSubmitted ? 'Checklist Recorded ✓' : 'Save Checklist Progress'}
              </button>
            </div>
          </div>

          {/* Section 2: Work Completion & Submission */}
          <form onSubmit={handleCompleteExecution} className="space-y-4 pt-4 border-t border-zinc-200">
            <div>
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                Maintenance Completion Summary
              </h4>

              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                Details of Work Performed *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Replaced hydraulic return line filter and fluid. Cleaned pressure relief valves. Verified system operates at 180 bar without leaks."
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                Technician Observations / Recommendations
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Recommended monitoring hydraulic pressure sensor on next shift."
                value={technicianRemarks}
                onChange={(e) => setTechnicianRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                Submitting will change status to <strong>Submitted Verification</strong> for manager sign-off.
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submittingCompletion}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {submittingCompletion ? 'Submitting...' : 'Complete & Submit for Verification'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
