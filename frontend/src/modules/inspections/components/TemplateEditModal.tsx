import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Plus,
  Trash2,
  Cpu,
  Gauge,
  Thermometer,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Save,
  Loader2,
  Info
} from 'lucide-react';
import apiClient from '../../../api/client';
import { ChecklistItem, SensorThresholds, InspectionTemplate } from '../PreShiftInspectionPage';

interface TemplateEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: InspectionTemplate | null; // null for Create mode, template object for Edit mode
  onSaveSuccess: () => void;
}

const COMMON_CATEGORIES = [
  'HMC',
  'VMC',
  'CNC Turning',
  'Welding Robot',
  'Press',
  'Laser',
  'Paint Booth',
  'Assembly Line',
  'Compressor',
  'Generator',
];

export const TemplateEditModal: React.FC<TemplateEditModalProps> = ({
  isOpen,
  onClose,
  template,
  onSaveSuccess,
}) => {
  const isEditMode = Boolean(template);

  // Form State
  const [machineCategory, setMachineCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [title, setTitle] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<ChecklistItem[]>([]);

  // Sensor Thresholds State
  const [showSensors, setShowSensors] = useState(false);
  const [pressureMin, setPressureMin] = useState<string>('');
  const [pressureMax, setPressureMax] = useState<string>('');
  const [pressureCritMin, setPressureCritMin] = useState<string>('');
  const [pressureCritMax, setPressureCritMax] = useState<string>('');
  const [pressureUnit, setPressureUnit] = useState<string>('Bar');
  const [pressureRequired, setPressureRequired] = useState<boolean>(false);

  const [tempMin, setTempMin] = useState<string>('');
  const [tempMax, setTempMax] = useState<string>('');
  const [tempCritMin, setTempCritMin] = useState<string>('');
  const [tempCritMax, setTempCritMax] = useState<string>('');
  const [tempUnit, setTempUnit] = useState<string>('°C');
  const [tempRequired, setTempRequired] = useState<boolean>(false);

  const [vibMin, setVibMin] = useState<string>('');
  const [vibMax, setVibMax] = useState<string>('');
  const [vibCritMin, setVibCritMin] = useState<string>('');
  const [vibCritMax, setVibCritMax] = useState<string>('');
  const [vibUnit, setVibUnit] = useState<string>('mm/s');
  const [vibRequired, setVibRequired] = useState<boolean>(false);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Populate form on open
  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (template) {
      // Edit Mode
      setMachineCategory(template.machine_category || '');
      setCustomCategory('');
      setTitle(template.title || '');
      setIsActive(template.is_active !== false);
      setItems(
        Array.isArray(template.checklist) && template.checklist.length > 0
          ? JSON.parse(JSON.stringify(template.checklist))
          : [
              {
                id: 'chk-1',
                label: '',
                type: 'boolean',
                required: true,
                is_critical: false,
              },
            ]
      );

      // Sensors
      const sensors = template.sensor_thresholds;
      if (sensors) {
        setShowSensors(true);
        if (sensors.pressure) {
          setPressureMin(sensors.pressure.min !== undefined ? String(sensors.pressure.min) : '');
          setPressureMax(sensors.pressure.max !== undefined ? String(sensors.pressure.max) : '');
          setPressureCritMin(sensors.pressure.critical_min !== undefined ? String(sensors.pressure.critical_min) : '');
          setPressureCritMax(sensors.pressure.critical_max !== undefined ? String(sensors.pressure.critical_max) : '');
          setPressureUnit(sensors.pressure.unit || 'Bar');
          setPressureRequired(Boolean(sensors.pressure.required));
        } else {
          setPressureMin('');
          setPressureMax('');
          setPressureCritMin('');
          setPressureCritMax('');
          setPressureUnit('Bar');
          setPressureRequired(false);
        }

        if (sensors.temperature) {
          setTempMin(sensors.temperature.min !== undefined ? String(sensors.temperature.min) : '');
          setTempMax(sensors.temperature.max !== undefined ? String(sensors.temperature.max) : '');
          setTempCritMin(sensors.temperature.critical_min !== undefined ? String(sensors.temperature.critical_min) : '');
          setTempCritMax(sensors.temperature.critical_max !== undefined ? String(sensors.temperature.critical_max) : '');
          setTempUnit(sensors.temperature.unit || '°C');
          setTempRequired(Boolean(sensors.temperature.required));
        } else {
          setTempMin('');
          setTempMax('');
          setTempCritMin('');
          setTempCritMax('');
          setTempUnit('°C');
          setTempRequired(false);
        }

        if (sensors.vibration) {
          setVibMin(sensors.vibration.min !== undefined ? String(sensors.vibration.min) : '');
          setVibMax(sensors.vibration.max !== undefined ? String(sensors.vibration.max) : '');
          setVibCritMin(sensors.vibration.critical_min !== undefined ? String(sensors.vibration.critical_min) : '');
          setVibCritMax(sensors.vibration.critical_max !== undefined ? String(sensors.vibration.critical_max) : '');
          setVibUnit(sensors.vibration.unit || 'mm/s');
          setVibRequired(Boolean(sensors.vibration.required));
        } else {
          setVibMin('');
          setVibMax('');
          setVibCritMin('');
          setVibCritMax('');
          setVibUnit('mm/s');
          setVibRequired(false);
        }
      } else {
        setShowSensors(false);
        resetSensors();
      }
    } else {
      // Create Mode default values
      setMachineCategory('HMC');
      setCustomCategory('');
      setTitle('');
      setIsActive(true);
      setItems([
        {
          id: 'chk-1',
          label: 'Hydraulic fluid level in reservoir is within nominal operational sight glass',
          type: 'boolean',
          required: true,
          is_critical: true,
        },
        {
          id: 'chk-2',
          label: 'Emergency stop push-buttons and safety interlock switches fully operational',
          type: 'boolean',
          required: true,
          is_critical: true,
        },
      ]);
      setShowSensors(false);
      resetSensors();
    }
  }, [isOpen, template]);

  const resetSensors = () => {
    setPressureMin('');
    setPressureMax('');
    setPressureCritMin('');
    setPressureCritMax('');
    setPressureUnit('Bar');
    setPressureRequired(false);

    setTempMin('');
    setTempMax('');
    setTempCritMin('');
    setTempCritMax('');
    setTempUnit('°C');
    setTempRequired(false);

    setVibMin('');
    setVibMax('');
    setVibCritMin('');
    setVibCritMax('');
    setVibUnit('mm/s');
    setVibRequired(false);
  };

  const handleAddItem = () => {
    const nextIndex = items.length + 1;
    setItems((prev) => [
      ...prev,
      {
        id: `chk-${nextIndex}`,
        label: '',
        type: 'boolean',
        required: true,
        is_critical: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ChecklistItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalCategory =
      machineCategory === 'custom' ? customCategory.trim() : machineCategory.trim();

    if (!isEditMode && !finalCategory) {
      setError('Please select or specify a valid Machine Category.');
      return;
    }

    if (!title.trim()) {
      setError('Checklist Title cannot be empty.');
      return;
    }

    if (items.length === 0) {
      setError('At least one checklist question is required.');
      return;
    }

    // Validate item uniqueness and non-empty labels
    const seenIds = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cleanId = (it.id || '').trim();
      const cleanLabel = (it.label || '').trim();

      if (!cleanId) {
        setError(`Question #${i + 1} requires a valid unique ID (e.g. chk-${i + 1}).`);
        return;
      }
      if (seenIds.has(cleanId.toLowerCase())) {
        setError(`Duplicate question ID '${cleanId}'. Each question must have a unique ID.`);
        return;
      }
      seenIds.add(cleanId.toLowerCase());

      if (!cleanLabel) {
        setError(`Question '${cleanId}' label cannot be empty.`);
        return;
      }

      if (it.type === 'select') {
        if (!it.options || (Array.isArray(it.options) && it.options.length === 0)) {
          setError(`Select question '${cleanId}' must specify at least one option.`);
          return;
        }
      }

      if (it.type === 'number') {
        if (it.min !== undefined && it.max !== undefined && Number(it.min) > Number(it.max)) {
          setError(`Question '${cleanId}' min value cannot be greater than max value.`);
          return;
        }
      }
    }

    // Build sensor thresholds payload
    const sensorPayload: SensorThresholds = {};
    if (showSensors) {
      const buildThreshold = (
        min: string,
        max: string,
        cMin: string,
        cMax: string,
        unit: string,
        req: boolean
      ) => {
        const obj: any = {};
        if (min !== '') obj.min = Number(min);
        if (max !== '') obj.max = Number(max);
        if (cMin !== '') obj.critical_min = Number(cMin);
        if (cMax !== '') obj.critical_max = Number(cMax);
        if (unit.trim()) obj.unit = unit.trim();
        if (req) obj.required = true;
        return Object.keys(obj).length > 0 ? obj : undefined;
      };

      const pObj = buildThreshold(pressureMin, pressureMax, pressureCritMin, pressureCritMax, pressureUnit, pressureRequired);
      const tObj = buildThreshold(tempMin, tempMax, tempCritMin, tempCritMax, tempUnit, tempRequired);
      const vObj = buildThreshold(vibMin, vibMax, vibCritMin, vibCritMax, vibUnit, vibRequired);

      if (pObj) sensorPayload.pressure = pObj;
      if (tObj) sensorPayload.temperature = tObj;
      if (vObj) sensorPayload.vibration = vObj;
    }

    try {
      setSaving(true);

      if (isEditMode && template) {
        // PUT /api/v1/inspections/templates/:id
        const updatePayload: any = {
          title: title.trim(),
          checklist: items,
          is_active: isActive,
          expected_version: template.version || 1,
        };
        if (Object.keys(sensorPayload).length > 0) {
          updatePayload.sensor_thresholds = sensorPayload;
        }

        const res = await apiClient.put(`/inspections/templates/${template.id}`, updatePayload);
        if (res.data?.success) {
          onSaveSuccess();
          onClose();
        } else {
          setError(res.data?.message || 'Failed to update inspection template.');
        }
      } else {
        // POST /api/v1/inspections/templates
        const createPayload: any = {
          machine_category: finalCategory,
          title: title.trim(),
          checklist: items,
          is_active: isActive,
        };
        if (Object.keys(sensorPayload).length > 0) {
          createPayload.sensor_thresholds = sensorPayload;
        }

        const res = await apiClient.post('/inspections/templates', createPayload);
        if (res.data?.success) {
          onSaveSuccess();
          onClose();
        } else {
          setError(res.data?.message || 'Failed to create inspection template.');
        }
      }
    } catch (err: any) {
      console.error('Template save error:', err);
      const msg = err.response?.data?.message || err.message || 'Error occurred while saving template.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-4xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 bg-white text-zinc-950 flex items-center justify-between border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
              <Layers className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">
                  {isEditMode ? 'Edit Checklist Rule' : 'Create New Checklist Rule'}
                </h3>
                {isEditMode && template && (
                  <span className="text-[10px] bg-zinc-900 text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full">
                    v{template.version || 1}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                {isEditMode
                  ? 'Update inspection checklist questions and safety limits. A new template version will be generated.'
                  : 'Define new pre-shift verification checkpoints and telemetry tolerances for equipment.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-6 overflow-y-auto flex-1">
            {/* Error Banner */}
            {error && (
              <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{error}</div>
              </div>
            )}

            {/* General Configuration Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <span>1. General Configuration</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Machine Category */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Machine Category *
                  </label>
                  {isEditMode ? (
                    <div className="p-2.5 bg-slate-200/70 border border-slate-300 rounded-lg text-xs font-mono font-bold text-zinc-800 flex items-center justify-between">
                      <span>{machineCategory}</span>
                      <span className="text-[10px] text-zinc-500 font-sans font-normal">(Category is fixed for existing rule)</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={COMMON_CATEGORIES.includes(machineCategory) ? machineCategory : 'custom'}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setMachineCategory('custom');
                          } else {
                            setMachineCategory(e.target.value);
                          }
                        }}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-500"
                      >
                        {COMMON_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="custom">+ Other / Custom Category...</option>
                      </select>

                      {machineCategory === 'custom' && (
                        <input
                          type="text"
                          required
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="e.g. Laser CNC, Robotic Arm, CMM..."
                          className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-500"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Checklist Title */}
                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
                    Checklist Rule Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. HMC Daily Pre-Shift Safety & Alignment Audit"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-500"
                  />
                </div>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                <div>
                  <span className="text-xs font-bold text-zinc-900 block">Rule Status</span>
                  <span className="text-[11px] text-zinc-500">
                    Active templates are immediately presented to machine operators during daily shift start.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-2.5 text-xs font-bold text-zinc-800">
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </div>

            {/* Checklist Questions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Checklist Checkpoints ({items.length})</span>
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Questions and inspection verifications executed by operators.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-black text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add Question</span>
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border transition space-y-3 ${
                      item.is_critical
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-zinc-700 font-mono font-bold text-xs flex items-center justify-center border border-slate-200">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">ID:</span>
                          <input
                            type="text"
                            value={item.id}
                            onChange={(e) => handleItemChange(idx, 'id', e.target.value)}
                            className="w-24 p-1 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono font-bold text-zinc-800"
                            placeholder="chk-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {/* Critical Toggle */}
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-800">
                          <input
                            type="checkbox"
                            checked={Boolean(item.is_critical)}
                            onChange={(e) => handleItemChange(idx, 'is_critical', e.target.checked)}
                            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <span>Critical Checkpoint</span>
                        </label>

                        {/* Required Toggle */}
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-zinc-700">
                          <input
                            type="checkbox"
                            checked={item.required !== false}
                            onChange={(e) => handleItemChange(idx, 'required', e.target.checked)}
                            className="rounded border-slate-300 text-zinc-900 focus:ring-zinc-500"
                          />
                          <span>Mandatory</span>
                        </label>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-zinc-400 hover:text-red-600 disabled:opacity-20 transition"
                          title="Remove Checkpoint"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Label */}
                    <div>
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleItemChange(idx, 'label', e.target.value)}
                        placeholder="e.g. Verify hydraulic pressure gauge is within 140 - 180 Bar and zero fluid leakage"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-400"
                      />
                    </div>

                    {/* Type & Thresholds Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-0.5">
                          Response Type
                        </label>
                        <select
                          value={item.type}
                          onChange={(e) => handleItemChange(idx, 'type', e.target.value as any)}
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-zinc-800"
                        >
                          <option value="boolean">Pass / Fail (Boolean)</option>
                          <option value="number">Numeric Measurement</option>
                          <option value="select">Dropdown Choice</option>
                        </select>
                      </div>

                      {/* Number-specific limits */}
                      {item.type === 'number' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-0.5">
                              Nominal Range (Min - Max)
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={item.min ?? ''}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'min',
                                    e.target.value === '' ? undefined : Number(e.target.value)
                                  )
                                }
                                placeholder="Min"
                                className="w-1/2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                              />
                              <span className="text-zinc-400">-</span>
                              <input
                                type="number"
                                step="any"
                                value={item.max ?? ''}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'max',
                                    e.target.value === '' ? undefined : Number(e.target.value)
                                  )
                                }
                                placeholder="Max"
                                className="w-1/2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-0.5">
                              Critical Limits
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={item.critical_min ?? ''}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'critical_min',
                                    e.target.value === '' ? undefined : Number(e.target.value)
                                  )
                                }
                                placeholder="Crit Min"
                                className="w-1/2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                              />
                              <span className="text-zinc-400">-</span>
                              <input
                                type="number"
                                step="any"
                                value={item.critical_max ?? ''}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'critical_max',
                                    e.target.value === '' ? undefined : Number(e.target.value)
                                  )
                                }
                                placeholder="Crit Max"
                                className="w-1/2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-0.5">
                              Unit of Measure
                            </label>
                            <input
                              type="text"
                              value={item.unit || ''}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              placeholder="e.g. Bar, °C, mm"
                              className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                            />
                          </div>
                        </>
                      )}

                      {/* Select-specific options */}
                      {item.type === 'select' && (
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-0.5">
                            Options (comma-separated list)
                          </label>
                          <input
                            type="text"
                            value={Array.isArray(item.options) ? item.options.join(', ') : ''}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                'options',
                                e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            placeholder="Normal, High, Low, Critical"
                            className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Telemetry Sensor Tolerances Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-zinc-700" />
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                      3. Machine Telemetry & IoT Sensor Limits (Optional)
                    </h4>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Configure safety envelopes for live gauge readings recorded during inspection.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSensors(!showSensors)}
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-bold text-zinc-800 transition"
                >
                  {showSensors ? 'Hide Sensors' : '+ Configure Sensors'}
                </button>
              </div>

              {showSensors && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 text-xs">
                  {/* Hydraulic Pressure */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-zinc-800 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-blue-600" />
                        Hydraulic Pressure
                      </span>
                      <label className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pressureRequired}
                          onChange={(e) => setPressureRequired(e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        <span>Req</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Min</span>
                        <input
                          type="number"
                          step="any"
                          value={pressureMin}
                          onChange={(e) => setPressureMin(e.target.value)}
                          placeholder="e.g. 150"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Max</span>
                        <input
                          type="number"
                          step="any"
                          value={pressureMax}
                          onChange={(e) => setPressureMax(e.target.value)}
                          placeholder="e.g. 220"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Min</span>
                        <input
                          type="number"
                          step="any"
                          value={pressureCritMin}
                          onChange={(e) => setPressureCritMin(e.target.value)}
                          placeholder="e.g. 120"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Max</span>
                        <input
                          type="number"
                          step="any"
                          value={pressureCritMax}
                          onChange={(e) => setPressureCritMax(e.target.value)}
                          placeholder="e.g. 260"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-zinc-800 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-amber-600" />
                        Temperature
                      </span>
                      <label className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempRequired}
                          onChange={(e) => setTempRequired(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span>Req</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Min</span>
                        <input
                          type="number"
                          step="any"
                          value={tempMin}
                          onChange={(e) => setTempMin(e.target.value)}
                          placeholder="e.g. 25"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Max</span>
                        <input
                          type="number"
                          step="any"
                          value={tempMax}
                          onChange={(e) => setTempMax(e.target.value)}
                          placeholder="e.g. 50"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Min</span>
                        <input
                          type="number"
                          step="any"
                          value={tempCritMin}
                          onChange={(e) => setTempCritMin(e.target.value)}
                          placeholder="e.g. 20"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Max</span>
                        <input
                          type="number"
                          step="any"
                          value={tempCritMax}
                          onChange={(e) => setTempCritMax(e.target.value)}
                          placeholder="e.g. 65"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Vibration */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-zinc-800 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Vibration Velocity
                      </span>
                      <label className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vibRequired}
                          onChange={(e) => setVibRequired(e.target.checked)}
                          className="rounded text-emerald-600"
                        />
                        <span>Req</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Min</span>
                        <input
                          type="number"
                          step="any"
                          value={vibMin}
                          onChange={(e) => setVibMin(e.target.value)}
                          placeholder="e.g. 0.5"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 font-mono block">Max</span>
                        <input
                          type="number"
                          step="any"
                          value={vibMax}
                          onChange={(e) => setVibMax(e.target.value)}
                          placeholder="e.g. 4.5"
                          className="w-full p-1 bg-slate-50 border border-slate-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Min</span>
                        <input
                          type="number"
                          step="any"
                          value={vibCritMin}
                          onChange={(e) => setVibCritMin(e.target.value)}
                          placeholder="e.g. 0.2"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-500 font-mono block">Crit Max</span>
                        <input
                          type="number"
                          step="any"
                          value={vibCritMax}
                          onChange={(e) => setVibCritMax(e.target.value)}
                          placeholder="e.g. 7.0"
                          className="w-full p-1 bg-slate-50 border border-red-200 rounded text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-zinc-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-jcb-yellow hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Saving Rule...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-zinc-950" />
                  <span>{isEditMode ? 'Update Rule Version' : 'Save & Publish Rule'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
