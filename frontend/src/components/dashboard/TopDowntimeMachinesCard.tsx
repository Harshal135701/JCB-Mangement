import React from 'react';
import { AlertTriangle, Clock, ArrowRight, Cpu, Wrench } from 'lucide-react';
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
  emptyMessage = 'No machine downtime incidents recorded for this period',
}) => {
  const maxDowntime = Math.max(
    ...machines.map((m) => Number(m.downtime_minutes || 0)),
    1
  );

  const formatHours = (minutes: number) => {
    const mins = Number(minutes) || 0;
    if (mins >= 60) {
      const hrs = (mins / 60).toFixed(1);
      return `${hrs} hrs`;
    }
    return `${mins} mins`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                Critical Equipment Downtime Leaderboard
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                Highest production impact assets ranked by cumulative stoppage hours
              </p>
            </div>
          </div>

          <Link
            to="/machines"
            className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-semibold text-amber-600 hover:text-amber-700 transition shrink-0"
          >
            <span>View All Assets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[13px] text-zinc-500 font-medium">Loading downtime telemetry...</span>
          </div>
        ) : machines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <span className="text-[13px] text-zinc-500 font-normal">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {machines.map((item, idx) => {
              const mins = Number(item.downtime_minutes || 0);
              const barWidth = (mins / maxDowntime) * 100;

              return (
                <div
                  key={`${item.machine_code}-${idx}`}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    {/* Rank & Machine Info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-zinc-900 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] sm:text-sm font-bold font-mono text-zinc-950 truncate">
                            {item.machine_code}
                          </span>
                          <span className="text-xs text-zinc-500 font-normal truncate hidden sm:inline">
                            • {item.name}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 font-normal block truncate">
                          {item.shop_name}
                        </span>
                      </div>
                    </div>

                    {/* Stoppage Stats */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-amber-600" />
                        {item.failure_count} {item.failure_count === 1 ? 'incident' : 'incidents'}
                      </span>

                      <span className="text-[13px] sm:text-sm font-bold font-mono text-red-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-red-500" />
                        {formatHours(mins)}
                      </span>
                    </div>
                  </div>

                  {/* Downtime Severity Bar */}
                  <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-500"
                      style={{ width: `${Math.max(barWidth, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
        <span className="text-zinc-500 font-normal">
          Top 5 Impacted Units
        </span>
        <span className="text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-amber-600" />
          Prioritize Root-Cause Analysis
        </span>
      </div>
    </div>
  );
};
