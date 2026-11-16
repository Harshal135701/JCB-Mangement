import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Wrench,
  User,
  ListChecks,
} from 'lucide-react';
import { PMExecutionItem } from '../types';
import { verifyPMExecution } from '../services/pmService';

interface PMVerificationModalProps {
  execution: PMExecutionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PMVerificationModal: React.FC<PMVerificationModalProps> = ({
  execution,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [remarks, setRemarks] = useState(
    'PM service verified against machine operating checklist. Service rolled over to next maintenance cycle.'
  );
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !execution) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === 'REJECTED' && !remarks.trim()) {
      setErrorMsg('Verification remarks are mandatory when rejecting maintenance completion.');
      return;
    }

    try {
      setVerifying(true);
      setErrorMsg(null);
      await verifyPMExecution(execution.execution_id, {
        status: decision,
        verification_remarks: remarks.trim(),
      });
      alert(
        decision === 'APPROVED'
          ? 'PM execution approved and verified closed! Schedule rolled over.'
          : 'PM execution rejected. Work order marked for technician rework.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-white text-zinc-950 flex items-center justify-between border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 text-black font-black text-sm px-2.5 py-0.5 rounded shadow">
              PM SIGN-OFF
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">
                MANAGER PREVENTIVE MAINTENANCE VERIFICATION
              </h3>
              <p className="text-[11px] text-zinc-500">
                Audit technician maintenance work, review checklist compliance, and authorize closure.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition cursor-pointer"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Metadata Card */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-amber-700 text-sm">
                {execution.wo_number}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 uppercase">
                {execution.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-zinc-600">
              <div>
                <span className="font-semibold text-zinc-400 block text-[10px] uppercase">
                  Machine Asset
                </span>
                <span className="font-bold text-zinc-900">{execution.machine_code} - {execution.machine_name}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block text-[10px] uppercase">
                  Assigned Technician
                </span>
                <span className="font-bold text-zinc-900">{execution.assigned_technician_name || 'Assigned Staff'}</span>
              </div>
            </div>

            {execution.technician_remarks && (
              <div className="pt-2 border-t border-zinc-200">
                <span className="font-semibold text-zinc-400 block text-[10px] uppercase">
                  Technician Remarks
                </span>
                <p className="text-zinc-800 italic mt-0.5">{execution.technician_remarks}</p>
              </div>
            )}
          </div>

          {/* Decision Selector */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-2">
              Manager Audit Decision *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDecision('APPROVED');
                  setRemarks('PM service verified against machine operating checklist. Service rolled over to next maintenance cycle.');
                }}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  decision === 'APPROVED'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500'
                    : 'bg-white border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${decision === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 text-xs">Approve & Sign-Off</div>
                  <div className="text-[10px] text-zinc-500">Close WO & rollover PM plan to next date</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDecision('REJECTED');
                  setRemarks('');
                }}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  decision === 'REJECTED'
                    ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500'
                    : 'bg-white border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <div className={`p-2 rounded-lg ${decision === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-zinc-900 text-xs">Reject / Require Rework</div>
                  <div className="text-[10px] text-zinc-500">Return to technician for re-inspection</div>
                </div>
              </button>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
              Verification Remarks {decision === 'REJECTED' && '* (Mandatory for rejection)'}
            </label>
            <textarea
              required={decision === 'REJECTED'}
              rows={3}
              placeholder={decision === 'REJECTED' ? 'Specify reasons for rejecting PM completion and required rework steps...' : 'Add verification observations...'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-xs text-white cursor-pointer ${
                decision === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              } disabled:opacity-50`}
            >
              {verifying ? 'Submitting...' : decision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
