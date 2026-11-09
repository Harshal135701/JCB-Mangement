import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { Machine, Shop } from '../types';
import { X, AlertCircle, CheckCircle2, ShieldAlert, Clock, FileText, Info } from 'lucide-react';

interface MachineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machine: Machine | null;
  userRole?: string;
}

export const MachineEditModal: React.FC<MachineEditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  machine,
  userRole = 'manager',
}) => {
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  // State for all potential fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [oemManufacturer, setOemManufacturer] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [bayLineLocation, setBayLineLocation] = useState('');
  const [criticality, setCriticality] = useState('class_b');
  const [status, setStatus] = useState('running');
  const [operatingHours, setOperatingHours] = useState<number>(0);
  const [maintenanceFreq, setMaintenanceFreq] = useState<number>(30);
  const [description, setDescription] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [electricalDiagramUrl, setElectricalDiagramUrl] = useState('');
  const [sopDocumentUrl, setSopDocumentUrl] = useState('');

  const [initialHours, setInitialHours] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !machine) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(false);

    const hours = machine.operating_hours ? Number(machine.operating_hours) : 0;
    setInitialHours(hours);

    setName(machine.name || '');
    setCategory(machine.category || '');
    setOemManufacturer(machine.oem_manufacturer || '');
    setModelNumber(machine.model_number || '');
    setSerialNumber(machine.serial_number || '');
    setBayLineLocation(machine.bay_line_location || '');
    setCriticality(machine.criticality || 'class_b');
    setStatus(machine.status || 'running');
    setOperatingHours(hours);
    setMaintenanceFreq(machine.maintenance_frequency_days ? Number(machine.maintenance_frequency_days) : 30);
    setDescription(machine.description || '');
    setManualUrl(machine.manual_url || '');
    setElectricalDiagramUrl(machine.electrical_diagram_url || '');
    setSopDocumentUrl(machine.sop_document_url || '');
  }, [isOpen, machine]);

  if (!isOpen || !machine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Monotonic operating hours check
    if (operatingHours < initialHours) {
      setErrorMsg(
        `Cumulative operating hours cannot be reduced. Current meter reading is ${initialHours.toFixed(1)} hrs, attempted: ${operatingHours.toFixed(1)} hrs.`
      );
      return;
    }

    setSubmitting(true);

    try {
      let payload: Record<string, any> = {};

      if (isManager && !isAdmin) {
        // MANAGER: Strictly permitted operational fields ONLY
        // Permitted: operating_hours, bay_line_location, description, manual_url, electrical_diagram_url, sop_document_url
        payload = {
          operating_hours: Number(operatingHours),
          bay_line_location: bayLineLocation.trim() || null,
          description: description.trim() || null,
          manual_url: manualUrl.trim() || null,
          electrical_diagram_url: electricalDiagramUrl.trim() || null,
          sop_document_url: sopDocumentUrl.trim() || null,
        };
      } else {
        // ADMIN: Can edit all mutable fields (NEVER send id, machine_code, qr_code_uid, created_at)
        if (!name.trim()) {
          setErrorMsg('Machine name is required.');
          setSubmitting(false);
          return;
        }
        if (!category.trim()) {
          setErrorMsg('Category is required.');
          setSubmitting(false);
          return;
        }
        if (!oemManufacturer.trim()) {
          setErrorMsg('OEM Manufacturer is required.');
          setSubmitting(false);
          return;
        }

        payload = {
          name: name.trim(),
          category: category.trim(),
          oem_manufacturer: oemManufacturer.trim(),
          model_number: modelNumber.trim() || null,
          serial_number: serialNumber.trim() || null,
          bay_line_location: bayLineLocation.trim() || null,
          criticality: criticality,
          operating_hours: Number(operatingHours),
          maintenance_frequency_days: Number(maintenanceFreq) || 30,
          description: description.trim() || null,
          manual_url: manualUrl.trim() || null,
          electrical_diagram_url: electricalDiagramUrl.trim() || null,
          sop_document_url: sopDocumentUrl.trim() || null,
        };

        // Only include status if it is an allowed manual update status
        // and doesn't conflict with maintenance workflow statuses
        if (status !== machine.status) {
          const disallowedWorkflowStatuses = ['breakdown', 'under_maintenance', 'awaiting_parts', 'awaiting_verification'];
          if (disallowedWorkflowStatuses.includes(status)) {
            setErrorMsg(`Maintenance workflow status '${status}' cannot be manually assigned; it is governed by Work Order & Breakdown lifecycles.`);
            setSubmitting(false);
            return;
          }
          payload.status = status;
        }
      }

      const res = await apiClient.put(`/machines/${machine.id}`, payload);
      if (res.data.success) {
        setSuccessMsg(res.data.message || `Machine ${machine.machine_code} updated successfully.`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.details ||
        'Failed to update machine. Please check field permissions and constraints.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-jcb-yellow text-black font-black text-lg px-2.5 py-0.5 rounded shadow">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  EDIT ASSET: {machine.machine_code}
                </h3>
                {isAdmin ? (
                  <span className="bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Admin Full Edit
                  </span>
                ) : (
                  <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">
                    Manager Operational Edit
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                UID: {machine.qr_code_uid} | Facility: {machine.shop_name || 'Assigned Shop'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Immutable Header Bar for All Roles */}
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-black text-zinc-400 uppercase block">Machine Code (Immutable)</span>
              <span className="font-mono font-black text-zinc-950 text-sm">{machine.machine_code}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-zinc-400 uppercase block">QR Asset UID (Immutable)</span>
              <span className="font-mono text-zinc-700 font-bold text-[11px]">{machine.qr_code_uid}</span>
            </div>
            <div>
              <span className="text-[10px] font-black text-zinc-400 uppercase block">Shop & Plant</span>
              <span className="font-semibold text-zinc-800">{machine.shop_name || 'N/A'}</span>
            </div>
          </div>

          {/* Manager Role Notice */}
          {isManager && !isAdmin && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold">Manager Operational Scope:</span> You have permission to update run meter hours, bay location, operational notes, and maintenance documentation URLs. Governance fields (criticality, category, OEM, status) are read-only.
              </div>
            </div>
          )}

          {/* ADMIN ONLY: Governance & Asset Specs */}
          {isAdmin ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    OEM Manufacturer *
                  </label>
                  <input
                    type="text"
                    required
                    value={oemManufacturer}
                    onChange={(e) => setOemManufacturer(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={modelNumber}
                    onChange={(e) => setModelNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Criticality Class
                  </label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="class_a">Class A (Bottleneck)</option>
                    <option value="class_b">Class B (Medium)</option>
                    <option value="class_c">Class C (Standby)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="running">Running</option>
                    <option value="idle">Idle</option>
                    <option value="inactive">Inactive</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    PM Frequency (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={maintenanceFreq}
                    onChange={(e) => setMaintenanceFreq(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>
            </>
          ) : (
            /* MANAGER: Governance Fields displayed as read-only summary */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Asset Name</span>
                <span className="font-bold text-zinc-900">{machine.name}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">OEM / Model</span>
                <span className="font-semibold text-zinc-800">{machine.oem_manufacturer} {machine.model_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Criticality</span>
                <span className="font-bold uppercase text-zinc-900">{machine.criticality?.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Current Status</span>
                <span className="font-bold uppercase text-emerald-700">{machine.status}</span>
              </div>
            </div>
          )}

          {/* OPERATIONAL FIELDS: Editable by BOTH Admin and Manager */}
          <div className="p-4 bg-zinc-50/80 rounded-xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2 text-xs font-black text-zinc-900 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Operational Maintenance Metrics & Location</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Operating Hours Meter Reading *
                  <span className="text-zinc-400 font-normal ml-1">
                    (Current: {initialHours.toFixed(1)} hrs - Monotonic)
                  </span>
                </label>
                <input
                  type="number"
                  min={initialHours}
                  step="0.1"
                  required
                  value={operatingHours}
                  onChange={(e) => setOperatingHours(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Meter reading can only increase to protect cumulative runtime integrity.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Bay / Line Location
                </label>
                <input
                  type="text"
                  value={bayLineLocation}
                  onChange={(e) => setBayLineLocation(e.target.value)}
                  placeholder="Bay 1 / Line 4"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Operational Notes / Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Operational notes, critical process dependencies, or special maintenance instructions..."
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            {/* Technical Documentation URLs */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider block">
                Technical Documentation Links (Cloud / Intranet)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">Manual Document URL</label>
                  <input
                    type="text"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://intranet.jcb.com/manuals/..."
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-[11px] text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">Electrical Diagram URL</label>
                  <input
                    type="text"
                    value={electricalDiagramUrl}
                    onChange={(e) => setElectricalDiagramUrl(e.target.value)}
                    placeholder="https://intranet.jcb.com/schematics/..."
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-[11px] text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">SOP Document URL</label>
                  <input
                    type="text"
                    value={sopDocumentUrl}
                    onChange={(e) => setSopDocumentUrl(e.target.value)}
                    placeholder="https://intranet.jcb.com/sop/..."
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-[11px] text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
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
              type="submit"
              disabled={submitting}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Updating Asset...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
