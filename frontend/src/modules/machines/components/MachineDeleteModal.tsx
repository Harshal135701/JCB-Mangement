import React, { useState } from 'react';
import apiClient from '../../../api/client';
import { Machine } from '../types';
import { AlertTriangle, Trash2, X, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

interface MachineDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machine: Machine | null;
}

export const MachineDeleteModal: React.FC<MachineDeleteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  machine,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<{
    text: string;
    decommissioned?: boolean;
    deleted?: boolean;
  } | null>(null);

  if (!isOpen || !machine) return null;

  const handleDelete = async () => {
    setErrorMsg(null);
    setResultMsg(null);
    setSubmitting(true);

    try {
      const res = await apiClient.delete(`/machines/${machine.id}`);
      if (res.data.success) {
        setResultMsg({
          text: res.data.message || `Machine ${machine.machine_code} processed.`,
          decommissioned: res.data.decommissioned,
          deleted: res.data.deleted,
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setErrorMsg(
          err.response?.data?.message ||
          'Operation blocked: Machine has active breakdowns or open work orders. Please resolve open maintenance tickets before decommissioning.'
        );
      } else {
        setErrorMsg(
          err.response?.data?.message ||
          'Failed to decommission/delete machine. Please verify user permissions.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-red-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-red-600 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-700 rounded-xl shadow-inner">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide">
                CONFIRM DECOMMISSION / DELETION
              </h3>
              <p className="text-[11px] text-red-100 font-medium">
                Admin Industrial Asset Governance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white p-1.5 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl text-xs flex items-start gap-2 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
              resultMsg.decommissioned 
                ? 'bg-amber-50 text-amber-900 border-amber-200' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {resultMsg.decommissioned ? 'Asset Safely Decommissioned' : 'Asset Hard Deleted'}
                </span>
                <span>{resultMsg.text}</span>
              </div>
            </div>
          )}

          {/* Machine Details Card */}
          <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-zinc-950">{machine.machine_code}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-200 text-zinc-800 rounded font-bold">
                {machine.qr_code_uid}
              </span>
            </div>
            <div className="text-xs text-zinc-700 font-bold">{machine.name}</div>
            <div className="text-[11px] text-zinc-500">
              <span>{machine.oem_manufacturer}</span> • <span>{machine.shop_name || 'Shop'}</span> • <span>{machine.bay_line_location || 'Bay 1'}</span>
            </div>
          </div>

          {/* Policy Explanation */}
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Automated Lifecycle Policy:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
              <li>
                <strong>Historical Maintenance Records:</strong> If work orders, breakdowns, or PM plans exist, the asset will be <em>decommissioned</em> (status set to decommissioned) to preserve compliance and audit trails.
              </li>
              <li>
                <strong>Zero History:</strong> If no maintenance records exist, the asset will be <em>hard deleted</em>.
              </li>
              <li>
                <strong>Active Workflows:</strong> Blocked if any open complaints or work orders are pending.
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || !!resultMsg}
              className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{submitting ? 'Processing...' : 'Proceed with Decommission / Deletion'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
