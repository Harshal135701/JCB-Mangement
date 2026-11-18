import React, { useState } from 'react';
import { Building2, BarChart2, CheckCircle2 } from 'lucide-react';

export interface PlantNetworkItem {
  id: string;
  plant_code?: string;
  plant_name: string;
  city?: string;
  state?: string;
  plant_status?: string;
  shop_count: number;
  machine_count: number;
  active_machines: number;
}

interface PlantComparisonChartProps {
  plants: PlantNetworkItem[];
  selectedPlant?: string;
  onSelectPlant?: (plantName: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export const PlantComparisonChart: React.FC<PlantComparisonChartProps> = ({
  plants = [],
  selectedPlant = 'All Plants',
  onSelectPlant,
  loading = false,
  emptyMessage = 'No plant comparison data available',
}) => {
  const [hoveredPlantId, setHoveredPlantId] = useState<string | null>(null);

  const maxMachines = Math.max(
    ...plants.map((p) => p.machine_count || 0),
    1
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header & Legend */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <BarChart2 className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                Plant Fleet & Capacity Comparison
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                Comparative equipment fleet and active operational status across plants
              </p>
            </div>
          </div>

          {/* Series Legend */}
          <div className="flex items-center gap-4 text-xs sm:text-[13px] font-semibold text-zinc-600 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300 inline-block" />
              <span>Total Fleet</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-600 inline-block" />
              <span>Active Running</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[13px] text-zinc-500 font-medium">Loading plant comparative metrics...</span>
          </div>
        ) : plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <span className="text-[13px] text-zinc-500 font-normal">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-4">
            {plants.map((plant) => {
              const total = plant.machine_count || 0;
              const active = plant.active_machines || 0;
              const uptimePct = total > 0 ? (active / total) * 100 : 0;
              const totalBarWidth = (total / maxMachines) * 100;
              const activeBarWidth = total > 0 ? (active / total) * 100 : 0;
              const isSelected = selectedPlant === plant.plant_name;
              const isHovered = hoveredPlantId === plant.id;

              return (
                <div
                  key={plant.id}
                  onClick={() => onSelectPlant && onSelectPlant(plant.plant_name)}
                  onMouseEnter={() => setHoveredPlantId(plant.id)}
                  onMouseLeave={() => setHoveredPlantId(null)}
                  className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-50/70 border-amber-400 shadow-2xs'
                      : isHovered
                      ? 'bg-slate-50 border-slate-300 shadow-2xs translate-x-0.5'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50/70 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                    {/* Plant Label & Location */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-zinc-400'}`} />
                      <div className="min-w-0">
                        <span className="text-[13px] sm:text-sm font-semibold text-zinc-900 truncate block">
                          {plant.plant_name}
                        </span>
                        {(plant.city || plant.plant_code) && (
                          <span className="text-xs text-zinc-500 font-normal truncate block">
                            {plant.plant_code ? `${plant.plant_code} • ` : ''}
                            {plant.city || ''}
                            {plant.state ? `, ${plant.state}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Counts & Availability Pill */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <span className="text-[13px] sm:text-sm font-semibold text-zinc-700">
                        <strong className="text-zinc-950 font-mono font-bold">{active}</strong>
                        <span className="text-zinc-400 font-normal"> / {total} machines</span>
                      </span>

                      <span
                        className={`text-xs sm:text-[13px] font-semibold font-mono px-2.5 py-0.5 rounded-full border ${
                          uptimePct >= 80
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : uptimePct >= 50
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        {uptimePct.toFixed(0)}% Active
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar Track */}
                  <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    {/* Total capacity bar */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-slate-300/80 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(totalBarWidth, 2)}%` }}
                    >
                      {/* Active portion within total */}
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${activeBarWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Sub-metrics on Hover */}
                  {isHovered && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs text-zinc-500">
                      <span>Registered Shops: <strong className="text-zinc-800 font-semibold">{plant.shop_count}</strong></span>
                      <span>Operational Status: <strong className="text-emerald-700 font-semibold">{plant.plant_status || 'Active'}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
        <span className="text-zinc-500 font-normal">
          Facility Network: <strong className="text-zinc-900 font-mono font-semibold">{plants.length} Plants</strong>
        </span>
        <span className="text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-xs flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Cross-Plant Telemetry Live
        </span>
      </div>
    </div>
  );
};
