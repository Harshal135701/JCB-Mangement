import React from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { PMDashboardData } from '../types';

interface PMKPISummaryProps {
  data: PMDashboardData | null;
  loading?: boolean;
}

export const PMKPISummary: React.FC<PMKPISummaryProps> = ({ data, loading }) => {
  const kpis = data?.kpis;

  const cards = [
    {
      label: 'Active PM Plans',
      value: kpis?.total_active_plans ?? (loading ? '...' : 0),
      subtext: 'Configured machine schedules',
      icon: Layers,
      color: 'text-zinc-900',
      badgeBg: 'bg-zinc-100 text-zinc-700',
    },
    {
      label: 'Upcoming Service',
      value: kpis?.upcoming_count ?? (loading ? '...' : 0),
      subtext: 'Next 7-30 days window',
      icon: Calendar,
      color: 'text-blue-700',
      badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    {
      label: 'Due Maintenance',
      value: kpis?.due_count ?? (loading ? '...' : 0),
      subtext: 'Service due now',
      icon: Clock,
      color: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-300 font-black',
    },
    {
      label: 'Overdue Stoppages',
      value: kpis?.overdue_count ?? (loading ? '...' : 0),
      subtext: 'Past grace period',
      icon: AlertTriangle,
      color: 'text-rose-700',
      badgeBg: 'bg-rose-50 text-rose-800 border border-rose-300 font-black',
    },
    {
      label: 'Pending Verification',
      value: kpis?.pending_verification_count ?? (loading ? '...' : 0),
      subtext: 'Awaiting manager sign-off',
      icon: ShieldCheck,
      color: 'text-purple-700',
      badgeBg: 'bg-purple-50 text-purple-800 border border-purple-200',
    },
    {
      label: 'Completed Cycles',
      value: kpis?.completed_pm_activities ?? (loading ? '...' : 0),
      subtext: 'Verified & closed',
      icon: CheckCircle2,
      color: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    },
    {
      label: 'PM Compliance',
      value: `${kpis?.pm_compliance_percentage ?? 100}%`,
      subtext: 'Standard KPI: ≥90%',
      icon: Activity,
      color: (kpis?.pm_compliance_percentage ?? 100) >= 90 ? 'text-emerald-700' : 'text-amber-700',
      badgeBg: 'bg-zinc-50 border border-zinc-200',
      tooltip: data?.definitions?.compliance_formula,
    },
    {
      label: 'On-Time Completion',
      value: `${kpis?.on_time_completion_percentage ?? 100}%`,
      subtext: 'Within scheduled grace',
      icon: Clock,
      color: 'text-zinc-800',
      badgeBg: 'bg-zinc-50 border border-zinc-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((c, idx) => {
        const Icon = c.icon;
        return (
          <div
            key={idx}
            className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider truncate">
                  {c.label}
                </span>
                {Icon && <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
              </div>
              <div className={`text-xl font-black tracking-tight ${c.color}`}>
                {c.value}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between pt-1 border-t border-zinc-100">
              <span className="text-[10px] text-zinc-400 font-medium truncate">
                {c.subtext}
              </span>
              {c.tooltip && (
                <span title={c.tooltip} className="cursor-help text-zinc-400 hover:text-zinc-600">
                  <HelpCircle className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
