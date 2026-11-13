import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { PurchaseRequisition, PRUrgency } from '../ProcurementPage';
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  Cpu,
  Calendar,
  FileText,
  Save,
  ShieldAlert,
  Eye,
  Lock,
} from 'lucide-react';

export interface SparePartOption {
  id: string;
  part_number: string;
  name: string;
  category?: string;
  available_stock: number;
  unit_cost?: number;
}

export interface MachineOption {
  id: string;
  machine_code: string;
  name: string;
  plant_name?: string;
}

interface EditPRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPR: PurchaseRequisition) => void;
  pr: PurchaseRequisition | null;
  parts: SparePartOption[];
  machines: MachineOption[];
  userRole?: string;
  userId?: string;
}

export const EditPRModal: React.FC<EditPRModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  pr,
  parts,
  machines,
  userRole = 'manager',
  userId,
}) => {
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [urgency, setUrgency] = useState<PRUrgency>('high');
  const [machineId, setMachineId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [justification, setJustification] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Status check: only 'new' or 'under_review' can be modified
  const isEditable = pr ? ['new', 'under_review'].includes(pr.status) : false;

  useEffect(() => {
    if (!isOpen || !pr) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(false);

    setPartId(pr.part_id || '');
    setQuantity(pr.quantity_required ? Number(pr.quantity_required) : 1);
    setUrgency(pr.urgency || 'high');
    setMachineId(pr.machine_id || '');
    setDeliveryDate(
      pr.expected_delivery_date ? pr.expected_delivery_date.split('T')[0] : ''
    );
    setJustification(pr.technical_justification || '');
  }, [isOpen, pr]);

  if (!isOpen || !pr) return null;

  const selectedPart = parts.find((p) => p.id === partId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return; // Silently block — button is hidden anyway

    if (!partId) {
      setErrorMsg('Please select a valid spare part from the master catalog.');
      return;
    }

    if (!quantity || quantity < 1) {
      setErrorMsg('Quantity required must be a positive integer greater than zero.');
      return;
    }

    if (!justification.trim() || justification.trim().length < 5) {
      setErrorMsg('Technical justification is mandatory and must be at least 5 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        part_id: partId,
        quantity_required: Number(quantity),
        urgency,
        technical_justification: justification.trim(),
        machine_id: machineId ? machineId : null,
        expected_delivery_date: deliveryDate ? deliveryDate : null,
      };

      const res = await apiClient.put(`/procurement/pr/${pr.id}/edit`, payload);

      if (res.data?.success) {
        setSuccessMsg(
          res.data.message || `Purchase Requisition ${pr.pr_number} updated successfully!`
        );
        setTimeout(() => {
          onSuccess(res.data.data);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Failed to save requisition changes. Please verify database connectivity.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className={`${isEditable ? 'bg-zinc-950' : 'bg-zinc-700'} p-5 flex items-center justify-between border-b border-zinc-800 shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="bg-jcb-yellow text-black font-black text-sm px-2.5 py-1 rounded shadow uppercase tracking-wide">
              {pr.pr_number}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
                {isEditable ? (
                  'Edit Purchase Requisition'
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-zinc-300" />
                    View Requisition (Read-Only)
                  </>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                Created: {new Date(pr.created_at).toLocaleDateString()} | Requester:{' '}
                {pr.requester_name || pr.requested_by_name || 'Technician'}
                {!isEditable && (
                  <span className="ml-2 bg-zinc-600 text-zinc-200 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                    {pr.status.replace(/_/g, ' ')}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Warning if not editable */}
        {!isEditable && (
          <div className="bg-amber-50 border-b border-amber-300 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold">Editing Restricted:</strong> This requisition is currently in{' '}
              <span className="font-mono font-bold uppercase underline">{pr.status.replace(/_/g, '_')}</span> status.
              Specifications cannot be modified once a vendor has been selected, approval granted, or a Purchase Order issued.
              To discontinue, please use <strong>Cancel Requisition</strong>.
            </div>
          </div>
        )}

        {/* Notification Feedback */}
        {errorMsg && (
          <div className="bg-red-50 border-b border-red-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed font-medium">
              {errorMsg}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-800 font-bold">{successMsg}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Spare Part Selector */}
          <div>
            <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-zinc-500" />
              <span>Spare Part / SKU (Master Catalog) *</span>
            </label>
            <select
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              disabled={!isEditable || submitting}
              required
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              <option value="">-- Select Spare Part SKU --</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.part_number}] {p.name} (Stock: {p.available_stock})
                </option>
              ))}
            </select>
            {selectedPart && (
              <div className="mt-1.5 text-[11px] text-zinc-500 flex items-center gap-3 font-medium">
                <span>Category: {selectedPart.category || 'General'}</span>
                <span>Physical Stock: {selectedPart.available_stock}</span>
                {selectedPart.unit_cost && (
                  <span>Unit Cost: ₹{Number(selectedPart.unit_cost).toLocaleString()}</span>
                )}
              </div>
            )}
          </div>

          {/* Quantity & Urgency Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1">
                Quantity Required *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                disabled={!isEditable || submitting}
                required
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1">
                Priority / Urgency *
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as PRUrgency)}
                disabled={!isEditable || submitting}
                required
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical (Line Stoppage)</option>
              </select>
            </div>
          </div>

          {/* Machine Asset & Expected Delivery Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <span>Machine / Equipment Asset</span>
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                disabled={!isEditable || submitting}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
              >
                <option value="">-- No Specific Machine (General Stock) --</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.machine_code}] {m.name} {m.plant_name ? `(${m.plant_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Target Required Date</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                disabled={!isEditable || submitting}
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
              />
            </div>
          </div>

          {/* Technical Justification */}
          <div>
            <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <span>Technical Remarks / Justification * (min 5 chars)</span>
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              disabled={!isEditable || submitting}
              required
              minLength={5}
              placeholder="State the technical reasons for modifying this purchase requisition..."
              className="w-full bg-zinc-50 border border-zinc-300 rounded-xl p-3 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500 resize-none"
            />
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-100 transition"
            >
              {isEditable ? 'Cancel' : 'Close'}
            </button>
            {isEditable && (
              <button
                type="submit"
                disabled={submitting}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{submitting ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
