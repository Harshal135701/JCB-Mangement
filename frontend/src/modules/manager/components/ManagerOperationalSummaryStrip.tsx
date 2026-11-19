import React from 'react';
import { Activity, CheckCircle2, CalendarCheck, Clock } from 'lucide-react';

interface ManagerOperationalSummaryStripProps {
  machineAvailabilityPercent: number;
  woCompletionRate: number;
  pmComplianceRate: number;
  avgMTTRHours: number | string;
  loading?: boolean;
}

export const ManagerOperationalSummaryStrip: React.FC<ManagerOperationalSummaryStripProps> = ({
  machineAvailabilityPercent = 0,
  woCompletionRate = 0,
  pmComplianceRate = 0,
  avgMTTRHours = 0,
  loading = false,
}) => {
  const metrics = [
    {
      id: 'metric-availability',
      label: 'Fleet Availability',
      value: `${machineAvailabilityPercent}%`,
      percentage: Math.min(100, Math.max(0, machineAvailabilityPercent)),
      barColor: 'bg-emerald-500',
      badge: machineAvailabilityPercent >= 85 ? 'Optimal' : machineAvailabilityPercent >= 70 ? 'Acceptable' : 'Attention',
      badgeClass:
        machineAvailabilityPercent >= 85
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : machineAvailabilityPercent >= 70
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      icon: Activity,
      iconColor: 'text-emerald-700',
      iconBg: 'bg-emerald-50',
    },
    {
      id: 'metric-wo-completion',
      label: 'WO Completion Rate',
      value: `${woCompletionRate}%`,
      percentage: Math.min(100, Math.max(0, woCompletionRate)),
      barColor: 'bg-blue-500',
      badge: woCompletionRate >= 75 ? 'On Target' : 'In Progress',
      badgeClass:
        woCompletionRate >= 75
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-slate-100 text-zinc-600 border-slate-200',
      icon: CheckCircle2,
      iconColor: 'text-blue-700',
      iconBg: 'bg-blue-50',
    },
    {
      id: 'metric-pm-compliance',
      label: 'PM Compliance Rate',
      value: `${pmComplianceRate}%`,
      percentage: Math.min(100, Math.max(0, pmComplianceRate)),
      barColor: 'bg-amber-500',
      badge: pmComplianceRate >= 80 ? 'Compliant' : 'Due Work',
      badgeClass:
        pmComplianceRate >= 80
          ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
      icon: CalendarCheck,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-50',
    },
    {
      id: 'metric-mttr',
      label: 'Mean Time to Repair (MTTR)',
      value: `${avgMTTRHours}h`,
      percentage: Number(avgMTTRHours) > 0 ? Math.min(100, Math.max(10, 100 - Number(avgMTTRHours) * 10)) : 100,
      barColor: 'bg-purple-500',
      badge: Number(avgMTTRHours) <= 4 ? 'Fast Turnaround' : 'Standard',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: Clock,
      iconColor: 'text-purple-700',
      iconBg: 'bg-purple-50',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between ${
                idx > 0 ? 'sm:pl-4 pt-3 sm:pt-0' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.iconBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${m.iconColor}`} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 truncate">
                    {m.label}
                  </span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.badgeClass}`}>
                  {m.badge}
                </span>
              </div>

              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-zinc-950 tracking-tight">
                  {loading ? '—' : m.value}
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${m.barColor}`}
                  style={{ width: `${loading ? 0 : m.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
