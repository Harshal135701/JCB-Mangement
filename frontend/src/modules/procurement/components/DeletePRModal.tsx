import React, { useState } from 'react';
import apiClient from '../../../api/client';
import { PurchaseRequisition } from '../ProcurementPage';
import {
  Trash2,
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Package,
  Cpu,
  Layers,
  Ban
} from 'lucide-react';

interface DeletePRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
  pr: PurchaseRequisition | null;
  userRole?: string;
  userId?: string;
}

export const DeletePRModal: React.FC<DeletePRModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  pr,
  userRole = 'manager',
  userId,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !pr) return null;

  // Business check: If PO is created or status is ordered/received, destructive deletion is prohibited
  const hasPO = Boolean(pr.po_number);
  const isPostOrdered = [
    'po_created',
    'ordered',
    'partially_received',
    'fully_received',
  ].includes(pr.status);
  const isRestricted = hasPO || isPostOrdered;

  const handleDelete = async () => {
    if (isRestricted) {
      setErrorMsg(
        `Cannot delete requisition: Purchase Order ${pr.po_number || 'in-flight'} has already been issued. Please cancel the requisition instead.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await apiClient.delete(`/procurement/pr/${pr.id}`);

      if (res.data?.success) {
        setSuccessMsg(
          res.data.message || `Purchase Requisition ${pr.pr_number} deleted successfully.`
        );
        setTimeout(() => {
          onSuccess(pr.id);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Failed to delete purchase requisition. Please verify user permissions and network connection.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-red-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-red-600 p-5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-700/60 rounded-xl">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide uppercase">
                Delete Purchase Requisition
              </h3>
              <p className="text-xs text-red-100">
                Action requires regulatory audit integrity verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-red-200 hover:text-white p-1 rounded-lg transition"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Requisition Overview Card */}
        <div className="p-6 space-y-4">
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-black text-sm text-zinc-900 bg-zinc-200 px-2 py-0.5 rounded">
                {pr.pr_number}
              </span>
              <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
                Status: {pr.status}
              </span>
            </div>

            <div className="text-xs text-zinc-800 font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>
                [{pr.part_number}] {pr.part_name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-600 font-medium pt-1 border-t border-zinc-200">
              <div>Quantity: <strong className="text-zinc-900">{pr.quantity_required} units</strong></div>
              <div>Priority: <strong className="text-zinc-900 uppercase">{pr.urgency}</strong></div>
              {pr.machine_code && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Machine: <strong>{pr.machine_code}</strong> ({pr.machine_name || 'Asset'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Deletion Restriction Banner */}
          {isRestricted ? (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <div className="font-bold">Permanent Deletion Restricted</div>
                <p className="leading-relaxed">
                  A Purchase Order (<strong className="font-mono">{pr.po_number || 'PO-Active'}</strong>) has already been created or stock received.
                  CMMS financial governance strictly prohibits destroying active procurement records to maintain audit trails.
                </p>
                <div className="pt-1 font-semibold text-amber-800">
                  Recommended action: Use <strong>Cancel Requisition</strong> if the procurement is discontinued.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900 leading-relaxed">
                <strong className="font-bold">Permanent Deletion Warning:</strong> Are you sure you want to delete this purchase requisition?
                This action will delete the database record from PostgreSQL and cannot be undone.
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-800 font-medium leading-relaxed">
                {errorMsg}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-xs text-emerald-800 font-bold">{successMsg}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-100 transition"
            >
              {isRestricted ? 'Close' : 'Cancel'}
            </button>
            {!isRestricted && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white font-black px-5 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{submitting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
