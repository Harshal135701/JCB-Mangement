import React, { useMemo } from 'react';
import { Layers, Building2 } from 'lucide-react';

interface MachineItem {
  id: string;
  name?: string;
  machine_code?: string;
  plant_id?: string;
  plant_name?: string;
  shop_id?: string;
  shop_name?: string;
  status?: string;
}

interface ManagerFleetDistributionChartProps {
  machines: MachineItem[];
  selectedPlant: string;
  hierarchy?: any;
  loading?: boolean;
}

interface GroupStat {
  id: string;
  name: string;
  total: number;
  operational: number;
  down: number;
  idle: number;
  pctOfTotal: number;
  uptimePct: number;
}

export const ManagerFleetDistributionChart: React.FC<ManagerFleetDistributionChartProps> = ({
  machines = [],
  selectedPlant,
  hierarchy,
  loading = false,
}) => {
  const isAllPlants = selectedPlant === 'All Plants';

  // Compute breakdown grouped by either Plant or Shop
  const groups: GroupStat[] = useMemo(() => {
    if (!machines || machines.length === 0) {
      // If machines array is empty but hierarchy has plants/shops, show 0-count baseline
      if (isAllPlants && hierarchy?.plants && Array.isArray(hierarchy.plants)) {
        return hierarchy.plants.map((p: any) => ({
          id: p.id || p.plant_name,
          name: p.plant_name || 'Plant Facility',
          total: 0,
          operational: 0,
          down: 0,
          idle: 0,
          pctOfTotal: 0,
          uptimePct: 100,
        }));
      }
      return [];
    }

    const totalFleet = machines.length;
    const map = new Map<string, { name: string; total: number; operational: number; down: number; idle: number }>();

    machines.forEach((m) => {
      let key = '';
      let groupName = '';

      if (isAllPlants) {
        key = m.plant_id || m.plant_name || 'Unassigned Plant';
        groupName = m.plant_name || 'Unassigned Plant';
      } else {
        key = m.shop_id || m.shop_name || 'General Operations';
        groupName = m.shop_name || 'General Operations';
      }

      if (!map.has(key)) {
        map.set(key, { name: groupName, total: 0, operational: 0, down: 0, idle: 0 });
      }

      const entry = map.get(key)!;
      entry.total += 1;

      const st = String(m.status || '').toLowerCase();
      if (st === 'running' || st === 'active' || st === 'operational') {
        entry.operational += 1;
      } else if (st === 'breakdown' || st === 'maintenance' || st === 'under_maintenance') {
        entry.down += 1;
      } else {
        entry.idle += 1;
      }
    });

    const result: GroupStat[] = [];
    map.forEach((val, id) => {
      const pctOfTotal = totalFleet > 0 ? (val.total / totalFleet) * 100 : 0;
      const uptimePct = val.total > 0 ? Math.round(((val.operational + val.idle) / val.total) * 100) : 100;
      result.push({
        id,
        name: val.name,
        total: val.total,
        operational: val.operational,
        down: val.down,
        idle: val.idle,
        pctOfTotal,
        uptimePct,
      });
    });

    // Sort descending by total machines
    return result.sort((a, b) => b.total - a.total);
  }, [machines, isAllPlants, hierarchy]);

  const maxCount = useMemo(() => {
    return groups.reduce((acc, g) => Math.max(acc, g.total), 1);
  }, [groups]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-black flex items-center justify-center shrink-0 font-black shadow-2xs">
            {isAllPlants ? <Building2 className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-950 tracking-tight">
              {isAllPlants ? 'Fleet Allocation by Plant Facility' : `Shop Floor Fleet Distribution (${selectedPlant})`}
            </h3>
            {isAllPlants && (
              <p className="text-2xs text-zinc-500 font-medium">
                Equipment distribution across authorized manufacturing sites
              </p>
            )}
          </div>
        </div>
        <span className="text-[11px] font-mono font-bold text-zinc-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
          {groups.length} {isAllPlants ? 'Plants' : 'Shops'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center my-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-400 font-medium">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading distribution analytics...
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
            <span className="text-xs text-zinc-400 font-medium">No machine distribution data available</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-around py-1 space-y-4 my-auto">
            {groups.map((group) => {
              const widthPct = Math.max(8, Math.round((group.total / maxCount) * 100));
              const operationalWidthPct =
                group.total > 0 ? Math.round((group.operational / group.total) * 100) : 0;

              return (
                <div key={group.id} className="group">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 truncate max-w-[190px] sm:max-w-[260px]">
                        {group.name}
                      </span>
                      {group.down > 0 && (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                          {group.down} down
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-2xs font-bold text-emerald-700">
                        {group.operational} active
                      </span>
                      <span className="text-xs font-mono font-black text-zinc-950">
                        {group.total} <span className="text-[10px] font-normal text-zinc-400">units</span>
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar Chart */}
                  <div className="w-full bg-slate-100 rounded-lg h-3 overflow-hidden flex border border-slate-200/60">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-lg transition-all duration-300 relative"
                      style={{ width: `${widthPct}%` }}
                    >
                      {/* Secondary split indicating operational vs down */}
                      {group.down > 0 && (
                        <div
                          className="absolute right-0 top-0 bottom-0 bg-rose-500/90"
                          style={{
                            width: `${Math.round((group.down / group.total) * 100)}%`,
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="shrink-0 pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-2xs text-zinc-500 font-medium">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>Operational Assets</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>Down / Repair</span>
          </div>
        </div>
        <span className="text-zinc-400 font-mono">Real-time DB</span>
      </div>
    </div>
  );
};
