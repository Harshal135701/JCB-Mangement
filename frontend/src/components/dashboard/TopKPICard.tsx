import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TopKPICardProps {
  icon: LucideIcon | React.ElementType;
  iconBgColor?: string;
  iconColor?: string;
  label: string;
  value: string | number;
  trend?: string;
  isPositiveTrend?: boolean;
  trendColor?: string;
  accentColor?: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export const TopKPICard: React.FC<TopKPICardProps> = ({
  icon: Icon,
  iconBgColor = 'bg-amber-100/80',
  iconColor = 'text-amber-800',
  label,
  value,
  trend,
  trendColor,
  accentColor = 'border-l-4 border-l-jcb-yellow',
  subtitle,
  onClick,
  className = '',
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 ${accentColor} p-4 sm:p-5 shadow-xs transition-all duration-200 relative overflow-hidden flex flex-col justify-between h-full min-h-[115px] ${
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:border-amber-400 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-jcb-yellow'
          : 'hover:shadow-md'
      } ${className}`}
    >
      {/* Top Row: Circular Icon on Left & Trend Pill on Right */}
      <div className="flex items-center justify-between gap-2">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${iconBgColor} shadow-2xs`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        {trend && (
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 shadow-2xs ${
              trendColor
                ? trendColor
                : trend.includes('↓') || trend.includes('Critical') || trend.includes('Due')
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Metric Value & Label */}
      <div className="mt-3 sm:mt-4">
        <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
          {value}
        </div>
        <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mt-1.5 truncate">
          {label}
        </p>
        {subtitle && (
          <p className="text-[10px] text-zinc-400 font-medium truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
