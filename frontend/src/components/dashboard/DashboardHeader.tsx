import React from 'react';
import { Building2, Calendar, ChevronDown } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  plantOptions?: string[];
  selectedPlant?: string;
  onPlantChange?: (plant: string) => void;
  timeframeOptions?: string[];
  selectedTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
  actions?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  badge,
  plantOptions = ['All Plants'],
  selectedPlant = 'All Plants',
  onPlantChange,
  timeframeOptions = ['Last 30 Days', 'Last 7 Days', 'This Month', 'Today'],
  selectedTimeframe = 'Last 30 Days',
  onTimeframeChange,
  actions,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
      {/* Title & Subtitle */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-jcb-yellow text-black border border-amber-400">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-1 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Dropdown Filters & Actions */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {/* Plant Selector Pill */}
        {plantOptions.length > 0 && (
          <div className="relative inline-flex items-center bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-[13px] sm:text-sm font-semibold text-zinc-800 shadow-2xs hover:border-slate-300 transition">
            <Building2 className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <select
              value={selectedPlant}
              onChange={(e) => onPlantChange && onPlantChange(e.target.value)}
              className="bg-transparent appearance-none pr-5 focus:outline-none cursor-pointer font-semibold text-zinc-900 text-[13px] sm:text-sm"
            >
              {plantOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-3" />
          </div>
        )}

        {/* Timeframe Selector Pill */}
        {timeframeOptions.length > 0 && (
          <div className="relative inline-flex items-center bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-[13px] sm:text-sm font-semibold text-zinc-800 shadow-2xs hover:border-slate-300 transition">
            <Calendar className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            <select
              value={selectedTimeframe}
              onChange={(e) => onTimeframeChange && onTimeframeChange(e.target.value)}
              className="bg-transparent appearance-none pr-5 focus:outline-none cursor-pointer font-semibold text-zinc-900 text-[13px] sm:text-sm"
            >
              {timeframeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-3" />
          </div>
        )}

        {/* Custom Actions (e.g. Refresh or Quick Action Button) */}
        {actions}
      </div>
    </div>
  );
};
