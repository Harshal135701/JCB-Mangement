import React from 'react';
import { Users, Wrench, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

export interface TechnicianWorkloadItem {
  id: string;
  name: string;
  employee_code?: string;
  activeCount: number;
  completedCount: number;
}

interface ManagerTechnicianPerformanceCardProps {
  technicians: TechnicianWorkloadItem[];
  totalTechnicians: number;
  activeTechniciansCount: number;
  unassignedWOCount: number;
  avgWOPerTech: number | string;
  loading?: boolean;
}

export const ManagerTechnicianPerformanceCard: React.FC<ManagerTechnicianPerformanceCardProps> = ({
  technicians = [],
  totalTechnicians = 0,
  activeTechniciansCount = 0,
  unassignedWOCount = 0,
  avgWOPerTech = 0,
  loading = false,
}) => {
  const maxActive = Math.max(1, ...technicians.map((t) => t.activeCount));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                Workforce &amp; Technician Performance
              </h3>
            </div>
          </div>
          <span className="text-xs font-semibold text-zinc-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
            {totalTechnicians} Technicians
          </span>
        </div>

        {/* Content: 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: Summary Metrics (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
              <span className="text-xs font-semibold text-zinc-500 block">Active Workforce Load</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold font-mono text-zinc-950">
                  {loading ? '—' : `${activeTechniciansCount} / ${totalTechnicians}`}
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  {totalTechnicians > 0 ? Math.round((activeTechniciansCount / totalTechnicians) * 100) : 0}% active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                <span className="text-[11px] font-semibold text-zinc-500 block truncate">Unassigned WOs</span>
                <span className={`text-xl font-bold font-mono mt-0.5 block ${unassignedWOCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
                  {loading ? '—' : unassignedWOCount}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                <span className="text-[11px] font-semibold text-zinc-500 block truncate">Avg Load / Tech</span>
                <span className="text-xl font-bold font-mono text-zinc-900 mt-0.5 block">
                  {loading ? '—' : avgWOPerTech}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Technician Workload Bars (8 cols) */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                Loading technician roster...
              </div>
            ) : technicians.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                No technicians registered in plant facility
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {technicians.slice(0, 5).map((tech) => {
                  const widthPct = Math.max(8, Math.round((tech.activeCount / maxActive) * 100));

                  return (
                    <div key={tech.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <span className="font-semibold text-zinc-800 truncate">{tech.name}</span>
                          {tech.employee_code && (
                            <span className="text-[10px] font-mono text-zinc-400">({tech.employee_code})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <span className="text-blue-700 font-semibold font-mono">
                            {tech.activeCount} active
                          </span>
                          <span className="text-zinc-400 font-mono text-[11px]">
                            • {tech.completedCount} done
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Assignment Dispatch Balance</span>
        <span className="font-semibold text-zinc-700 font-mono">
          {unassignedWOCount > 0 ? `${unassignedWOCount} Unassigned Jobs` : 'All Work Orders Assigned'}
        </span>
      </div>
    </div>
  );
};
