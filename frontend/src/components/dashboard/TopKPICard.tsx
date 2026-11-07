import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TopKPICardProps {
  icon: LucideIcon | React.ElementType;
  iconBgColor?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  trend?: string;
  isPositiveTrend?: boolean; // For breakdowns, down is green or red depending on perspective
  trendColor?: string;
  accentColor?: string; // Yellow accent bar
}

export const TopKPICard: React.FC<TopKPICardProps> = ({
  icon: Icon,
  iconBgColor = 'bg-amber-50',
  iconColor = 'text-amber-600',
  label,
  value,
  trend,
  trendColor,
  accentColor = 'border-t-2 border-jcb-yellow',
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-200 ${accentColor}`}
    >
      {/* Top row: Icon and Trend */}
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBgColor}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {trend && (
          <span className={`text-[11px] font-extrabold flex items-center gap-0.5 ${trendColor || 'text-emerald-600'}`}>
            {trend}
          </span>
        )}
      </div>

      {/* Middle & Bottom: Value and Label */}
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-tight">
          {value}
        </div>
        <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 mt-1 truncate">
          {label}
        </p>
      </div>
    </div>
  );
};
