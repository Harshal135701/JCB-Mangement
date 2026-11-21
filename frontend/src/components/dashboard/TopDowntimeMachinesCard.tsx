import React from 'react';
import { AlertTriangle, Clock, ArrowRight, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface DowntimeMachineItem {
  machine_code: string;
  name: string;
  shop_name: string;
  downtime_minutes: number;
  failure_count: number;
}

interface TopDowntimeMachinesCardProps {
  machines: DowntimeMachineItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export const TopDowntimeMachinesCard: React.FC<TopDowntimeMachinesCardProps> = ({
  machines = [],
  loading = false,
  emptyMessage = 'Zero equipment stoppage incidents recorded',
}) => {
  const maxDowntime = Math.max(
    ...machines.map((m) => Number(m.downtime_minutes || 0)),
    1
  );

  const formatHours = (minutes: number) => {
    const mins = Number(minutes) || 0;
    if (mins >= 60) {
      const hrs = (mins / 60).toFixed(1);
      return `${hrs}h`;
    }
    return `${mins}m`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col h-[460px] overflow-hidden">
      {/* Header - Fixed & Pinned */}
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight truncate">
              Equipment Downtime
            </h3>
            <p className="text-[11px] text-zinc-500 font-normal truncate">
              Top impacted assets by stoppage time
            </p>
          </div>
        </div>

        <Link
          to="/machines"
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition shrink-0"
        >
          <span>Assets</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content - Scrollable area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-xs text-zinc-400 font-medium">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
            Loading downtime records...
          </div>
        ) : machines.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-1">
            <span className="text-xs text-zinc-500 font-normal">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {machines.map((item, idx) => {
              const mins = Number(item.downtime_minutes || 0);
              const barWidth = (mins / maxDowntime) * 100;

              return (
                <div
                  key={`${item.machine_code}-${idx}`}
                  className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    {/* Rank & Machine Info */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-zinc-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold font-mono text-zinc-950 truncate block">
                          {item.machine_code}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-normal truncate block">
                          {item.shop_name}
                        </span>
                      </div>
                    </div>

                    {/* Stoppage Stats */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Wrench className="w-2.5 h-2.5 text-amber-600" />
                        {item.failure_count} {item.failure_count === 1 ? 'halt' : 'halts'}
                      </span>

                      <span className="text-xs font-bold font-mono text-red-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-500" />
                        {formatHours(mins)}
                      </span>
                    </div>
                  </div>

                  {/* Downtime Severity Bar */}
                  <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-300"
                      style={{ width: `${Math.max(barWidth, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - Fixed & Pinned */}
      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span>Impact Ranking</span>
        <span className="text-zinc-700 font-semibold text-[11px]">
          {machines.length} Units Tracked
        </span>
      </div>
    </div>
  );
};
