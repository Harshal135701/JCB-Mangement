import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { Plant, Shop } from '../types';
import { X, AlertCircle, CheckCircle2, Building, Wrench, Shield, Layers } from 'lucide-react';

interface MachineCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MachineCreateModal: React.FC<MachineCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');

  const [formData, setFormData] = useState({
    shop_id: '',
    machine_code: '',
    name: '',
    category: 'HMC',
    oem_manufacturer: 'Mazak',
    model_number: '',
    serial_number: '',
    bay_line_location: '',
    criticality: 'class_b',
    status: 'running',
    operating_hours: 0,
    maintenance_frequency_days: 30,
    description: '',
    manual_url: '',
    electrical_diagram_url: '',
    sop_document_url: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch plants when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(false);

    const fetchPlants = async () => {
      try {
        setLoadingOrg(true);
        const res = await apiClient.get('/org/plants');
        if (res.data.success && Array.isArray(res.data.data)) {
          setPlants(res.data.data);
          if (res.data.data.length > 0) {
            const firstPlant = res.data.data[0];
            setSelectedPlantId(firstPlant.id);
            fetchShops(firstPlant.id);
          }
        }
      } catch (err: any) {
        console.error('Failed to load plants:', err);
        setErrorMsg('Failed to load plants from organization hierarchy.');
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchPlants();
  }, [isOpen]);

  const fetchShops = async (plantId: string) => {
    if (!plantId) return;
    try {
      setLoadingOrg(true);
      const res = await apiClient.get(`/org/plants/${plantId}/shops`);
      if (res.data.success && Array.isArray(res.data.data)) {
        setShops(res.data.data);
        if (res.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, shop_id: res.data.data[0].id }));
        } else {
          setFormData((prev) => ({ ...prev, shop_id: '' }));
        }
      }
    } catch (err) {
      console.error('Failed to load shops for plant:', err);
    } finally {
      setLoadingOrg(false);
    }
  };

  const handlePlantChange = (plantId: string) => {
    setSelectedPlantId(plantId);
    fetchShops(plantId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formData.shop_id) {
      setErrorMsg('Please select a valid Shop facility.');
      return;
    }

    if (!formData.machine_code.trim()) {
      setErrorMsg('Machine code is required.');
      return;
    }

    if (!formData.name.trim()) {
      setErrorMsg('Machine name is required.');
      return;
    }

    if (!formData.category.trim()) {
      setErrorMsg('Machine category is required.');
      return;
    }

    if (!formData.oem_manufacturer.trim()) {
      setErrorMsg('OEM manufacturer is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        shop_id: formData.shop_id,
        machine_code: formData.machine_code.trim().toUpperCase(),
        name: formData.name.trim(),
        category: formData.category.trim(),
        oem_manufacturer: formData.oem_manufacturer.trim(),
        criticality: formData.criticality,
        status: formData.status,
        operating_hours: Number(formData.operating_hours) || 0,
        maintenance_frequency_days: Number(formData.maintenance_frequency_days) || 30,
      };

      if (formData.model_number.trim()) payload.model_number = formData.model_number.trim();
      if (formData.serial_number.trim()) payload.serial_number = formData.serial_number.trim();
      if (formData.bay_line_location.trim()) payload.bay_line_location = formData.bay_line_location.trim();
      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.manual_url.trim()) payload.manual_url = formData.manual_url.trim();
      if (formData.electrical_diagram_url.trim()) payload.electrical_diagram_url = formData.electrical_diagram_url.trim();
      if (formData.sop_document_url.trim()) payload.sop_document_url = formData.sop_document_url.trim();

      const res = await apiClient.post('/machines', payload);
      if (res.data.success) {
        setSuccessMsg(res.data.message || 'Machine registered successfully.');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.details ||
        'Failed to register machine asset. Please verify input data.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
              <h3 className="text-base font-black text-white tracking-wide">
                REGISTER NEW INDUSTRIAL MACHINE ASSET
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                Admin Asset Commissioning & QR UID Generator
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

        {/* Content Form */}
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

          {/* Plant & Shop Selection */}
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-amber-900 uppercase tracking-wider">
              <Building className="w-4 h-4" />
              <span>Facility Allocation (Required)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Plant Facility *
                </label>
                <select
                  value={selectedPlantId}
                  onChange={(e) => handlePlantChange(e.target.value)}
                  disabled={loadingOrg || submitting}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {plants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plant_name} ({p.plant_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Shop Floor *
                </label>
                <select
                  required
                  value={formData.shop_id}
                  onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                  disabled={loadingOrg || submitting || shops.length === 0}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {shops.length === 0 ? (
                    <option value="">No shops found for plant</option>
                  ) : (
                    shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shop_name} ({s.shop_code})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Machine Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Machine Code * <span className="text-zinc-400 font-normal">(e.g. CNC-104)</span>
              </label>
              <input
                type="text"
                required
                value={formData.machine_code}
                onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                placeholder="e.g. CNC-104"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold uppercase text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Asset Name * <span className="text-zinc-400 font-normal">(Full technical designation)</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Mazak 5-Axis Horizontal Machining Center"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>
          </div>

          {/* OEM & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Category *
              </label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="HMC, VMC, Robotic Welder, Press..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                OEM Manufacturer *
              </label>
              <input
                type="text"
                required
                value={formData.oem_manufacturer}
                onChange={(e) => setFormData({ ...formData, oem_manufacturer: e.target.value })}
                placeholder="Mazak, Fanuc, Schuler, ABB, Doosan..."
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>
          </div>

          {/* Model & Serial Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Model Number
              </label>
              <input
                type="text"
                value={formData.model_number}
                onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                placeholder="e.g. HCN-6800 NEO"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="e.g. MZK-2024-9182"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>
          </div>

          {/* Bay Location, Criticality, Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Bay / Line Location
              </label>
              <input
                type="text"
                value={formData.bay_line_location}
                onChange={(e) => setFormData({ ...formData, bay_line_location: e.target.value })}
                placeholder="Bay 2 / Line 1"
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Criticality Class *
              </label>
              <select
                value={formData.criticality}
                onChange={(e) => setFormData({ ...formData, criticality: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              >
                <option value="class_a">Class A (Bottleneck / Highest Impact)</option>
                <option value="class_b">Class B (Medium / Standard)</option>
                <option value="class_c">Class C (Low / Standby)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Initial Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              >
                <option value="running">Running (Active Production)</option>
                <option value="idle">Idle (Ready / Standby)</option>
                <option value="inactive">Inactive (De-energized)</option>
              </select>
            </div>
          </div>

          {/* Operating Hours & PM Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                Initial Operating Hours (Run Hours)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.operating_hours}
                onChange={(e) => setFormData({ ...formData, operating_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                PM Frequency (Days)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.maintenance_frequency_days}
                onChange={(e) => setFormData({ ...formData, maintenance_frequency_days: parseInt(e.target.value, 10) || 30 })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
              Asset Description / Operational Role
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. Critical transmission casing machining unit for heavy backhoe loader assemblies."
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
            />
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
              disabled={submitting || loadingOrg}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Registering Asset...' : 'Register Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
