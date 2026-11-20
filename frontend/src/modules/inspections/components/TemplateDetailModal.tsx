import React from 'react';
import { X, Layers, Cpu, Thermometer, Gauge, Activity, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { InspectionTemplate } from '../PreShiftInspectionPage';

interface TemplateDetailModalProps {
  template: InspectionTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TemplateDetailModal: React.FC<TemplateDetailModalProps> = ({
  template,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-white text-zinc-950 flex items-center justify-between border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">
                Checklist Rule Specification
              </h3>
              <p className="text-[11px] text-zinc-500 font-medium">Read-only template configuration and safety tolerances</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition"
            aria-label="Close specification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Metadata Grid */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-zinc-400 text-[10px] font-bold uppercase block">Title</span>
              <strong className="text-zinc-950 font-semibold">{template.title}</strong>
            </div>
            <div>
              <span className="text-zinc-400 text-[10px] font-bold uppercase block">Machine Category</span>
              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-mono font-bold text-[11px] mt-0.5">
                {template.machine_category}
              </span>
            </div>
            <div>
              <span className="text-zinc-400 text-[10px] font-bold uppercase block">Version</span>
              <span className="text-zinc-900 font-bold font-mono">v{template.version || 1}</span>
            </div>
            <div>
              <span className="text-zinc-400 text-[10px] font-bold uppercase block">Rule Status</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  template.is_active !== false
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                }`}
              >
                {template.is_active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Sensor Thresholds Specification */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-600" />
              <h4 className="text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                Telemetry & Sensor Tolerance Thresholds
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Pressure */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-zinc-700 font-bold">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-blue-600" />
                    Hydraulic Pressure
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {template.sensor_thresholds?.pressure?.unit || 'Bar'}
                  </span>
                </div>
                {template.sensor_thresholds?.pressure ? (
                  <div className="text-[11px] space-y-1 font-mono text-zinc-600">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nominal:</span>
                      <span>
                        {template.sensor_thresholds.pressure.min ?? '-'} to {template.sensor_thresholds.pressure.max ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-bold">
                      <span className="text-zinc-400">Critical Limits:</span>
                      <span>
                        &lt;{template.sensor_thresholds.pressure.critical_min ?? '-'} | &gt;{template.sensor_thresholds.pressure.critical_max ?? '-'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 pt-1">
                      {template.sensor_thresholds.pressure.required ? 'Mandatory telemetry' : 'Optional telemetry'}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 italic">No threshold rules configured</p>
                )}
              </div>

              {/* Temperature */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-zinc-700 font-bold">
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                    Coolant Temp
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {template.sensor_thresholds?.temperature?.unit || '°C'}
                  </span>
                </div>
                {template.sensor_thresholds?.temperature ? (
                  <div className="text-[11px] space-y-1 font-mono text-zinc-600">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nominal:</span>
                      <span>
                        {template.sensor_thresholds.temperature.min ?? '-'} to {template.sensor_thresholds.temperature.max ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-bold">
                      <span className="text-zinc-400">Critical Limits:</span>
                      <span>
                        &lt;{template.sensor_thresholds.temperature.critical_min ?? '-'} | &gt;{template.sensor_thresholds.temperature.critical_max ?? '-'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 pt-1">
                      {template.sensor_thresholds.temperature.required ? 'Mandatory telemetry' : 'Optional telemetry'}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 italic">No threshold rules configured</p>
                )}
              </div>

              {/* Vibration */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-zinc-700 font-bold">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    Spindle Vibration
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {template.sensor_thresholds?.vibration?.unit || 'mm/s'}
                  </span>
                </div>
                {template.sensor_thresholds?.vibration ? (
                  <div className="text-[11px] space-y-1 font-mono text-zinc-600">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Nominal:</span>
                      <span>
                        {template.sensor_thresholds.vibration.min ?? '0'} to {template.sensor_thresholds.vibration.max ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-red-600 font-bold">
                      <span className="text-zinc-400">Critical Limits:</span>
                      <span>
                        &gt;{template.sensor_thresholds.vibration.critical_max ?? '-'}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 pt-1">
                      {template.sensor_thresholds.vibration.required ? 'Mandatory telemetry' : 'Optional telemetry'}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 italic">No threshold rules configured</p>
                )}
              </div>
            </div>
          </div>

          {/* Checklist Questions Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                <h4 className="text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                  Checklist Inspection Items ({template.checklist?.length || 0})
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-zinc-500">Read-Only Safety Protocol</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-zinc-500">
                  <tr>
                    <th className="p-3 w-16">#</th>
                    <th className="p-3">Checklist Item & Question</th>
                    <th className="p-3 w-28">Type</th>
                    <th className="p-3 w-36">Thresholds / Range</th>
                    <th className="p-3 w-28 text-center">Required</th>
                    <th className="p-3 w-28 text-center">Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!template.checklist || template.checklist.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-zinc-400 italic">
                        No items configured in this checklist rule.
                      </td>
                    </tr>
                  ) : (
                    template.checklist.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono text-zinc-400 text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-zinc-900">{item.label}</div>
                          <div className="text-[10px] font-mono text-zinc-400">ID: {item.id}</div>
                          {item.options && item.options.length > 0 && (
                            <div className="text-[10px] text-zinc-500 mt-1">
                              Options: {item.options.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-block px-2 py-0.5 bg-slate-200 text-zinc-700 rounded text-[10px] font-mono uppercase font-bold">
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] font-mono text-zinc-600">
                          {item.type === 'number' ? (
                            <div>
                              <span>
                                {item.min !== undefined ? item.min : '-'} to {item.max !== undefined ? item.max : '-'} {item.unit || ''}
                              </span>
                              {(item.critical_min !== undefined || item.critical_max !== undefined) && (
                                <div className="text-[10px] text-red-600">
                                  Crit: &lt;{item.critical_min ?? '-'} | &gt;{item.critical_max ?? '-'}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">Binary / Pass-Fail</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.required ? (
                            <span className="px-2 py-0.5 bg-zinc-900 text-white rounded text-[9px] font-black uppercase">
                              Required
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[10px]">Optional</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.is_critical ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded text-[9px] font-black uppercase">
                              Critical
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[10px]">Standard</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-500 font-medium">
            Strictly read-only specification for Administrative Governance & Safety Auditing.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
