import React from 'react';
import { CalendarCheck, AlertCircle, CheckCircle2, Clock, Calendar } from 'lucide-react';

interface ManagerPMPerformanceCardProps {
  totalPlans: number;
  upcomingCount: number;
  completedCount: number;
  overdueCount: number;
  complianceRate: number;
  onTimeRate?: number;
  loading?: boolean;
}

export const ManagerPMPerformanceCard: React.FC<ManagerPMPerformanceCardProps> = ({
  totalPlans = 0,
  upcomingCount = 0,
  completedCount = 0,
  overdueCount = 0,
  complianceRate = 100,
  onTimeRate = 100,
  loading = false,
}) => {
  const totalTasks = upcomingCount + completedCount + overdueCount;
  const maxBarValue = Math.max(1, upcomingCount, completedCount, overdueCount);

  const taskBars = [
    {
      label: 'Scheduled / Due PMs',
      count: upcomingCount,
      percentage: totalTasks > 0 ? (upcomingCount / totalTasks) * 100 : 0,
      widthPercent: Math.max(6, (upcomingCount / maxBarValue) * 100),
      color: 'bg-amber-500',
      textColor: 'text-amber-800',
      badgeBg: 'bg-amber-50 border-amber-200',
      icon: Clock,
    },
    {
      label: 'Completed Activities',
      count: completedCount,
      percentage: totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0,
      widthPercent: Math.max(6, (completedCount / maxBarValue) * 100),
      color: 'bg-emerald-500',
      textColor: 'text-emerald-800',
      badgeBg: 'bg-emerald-50 border-emerald-200',
      icon: CheckCircle2,
    },
    {
      label: 'Overdue PM Tasks',
      count: overdueCount,
      percentage: totalTasks > 0 ? (overdueCount / totalTasks) * 100 : 0,
      widthPercent: Math.max(6, (overdueCount / maxBarValue) * 100),
      color: 'bg-rose-500',
      textColor: 'text-rose-800',
      badgeBg: 'bg-rose-50 border-rose-200',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                Preventive Maintenance Performance
              </h3>
            </div>
          </div>
          <span className="text-xs font-semibold text-zinc-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
            {totalPlans} Active Plans
          </span>
        </div>

        {/* Content: 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: Statistics Overview (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl">
              <span className="text-xs font-semibold text-zinc-500 block">Overall Compliance</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold font-mono text-zinc-950">
                  {loading ? '—' : `${complianceRate}%`}
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  {onTimeRate}% on-time
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                <span className="text-[11px] font-semibold text-zinc-500 block truncate">Total Plans</span>
                <span className="text-xl font-bold font-mono text-zinc-900 mt-0.5 block">
                  {loading ? '—' : totalPlans}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200/90 rounded-xl">
                <span className="text-[11px] font-semibold text-zinc-500 block truncate">Overdue</span>
                <span className={`text-xl font-bold font-mono mt-0.5 block ${overdueCount > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                  {loading ? '—' : overdueCount}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Compact PM Task Comparison Bars (8 cols) */}
          <div className="lg:col-span-8 space-y-3.5">
            {taskBars.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="font-semibold text-zinc-700">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-zinc-950 text-xs">
                        {loading ? '—' : item.count}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        ({Math.round(item.percentage)}%)
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${loading ? 0 : item.widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Routine Servicing Health</span>
        <span className={`font-semibold font-mono ${complianceRate >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
          {complianceRate >= 80 ? 'Standard PM Compliance' : 'Overdue Tasks Require Action'}
        </span>
      </div>
    </div>
  );
};
