import React from 'react';
import { Clock, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';

export interface DowntimeMetricItem {
  icon?: React.ElementType;
  label: string;
  value: string;
  change?: string;
  isPositiveChange?: boolean; // For downtime/repair, a reduction is good (green)
}

interface DowntimeAnalysisCardProps {
  title?: string;
  rateValue?: string;
  rateLabel?: string;
  percentage?: number; // 0 to 100 for gauge arc
  gaugeColor?: string;
  metrics?: DowntimeMetricItem[];
}

const defaultMetrics: DowntimeMetricItem[] = [
  {
    icon: Clock,
    label: 'Total Downtime',
    value: '48 Hrs',
    change: '↓ 12%',
    isPositiveChange: true,
  },
  {
    icon: Clock,
    label: 'Avg. Repair Time',
    value: '2.1 Hrs',
    change: '↓ 8%',
    isPositiveChange: true,
  },
];

export const DowntimeAnalysisCard: React.FC<DowntimeAnalysisCardProps> = ({
  title = 'Downtime Analysis',
  rateValue = '2.8%',
  rateLabel = 'Downtime Rate',
  percentage = 28, // visual representation
  gaugeColor = '#F59E0B',
  metrics = defaultMetrics,
}) => {
  // Semi-circular or circular gauge math
  const size = 130;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressLength = (percentage / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
            {title}
          </h3>
        </div>
        <BarChart3 className="w-4 h-4 text-zinc-400" />
      </div>

      {/* Main Content: Gauge (Left) + Metric Cards (Right) */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center my-auto py-2">
        {/* Left: Circular Gauge Meter */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
            >
              {/* Background Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth={strokeWidth}
              />
              {/* Progress Arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={gaugeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={`${progressLength} ${circumference}`}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Gauge Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                {rateValue}
              </span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1 px-2">
                {rateLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Stacked Sub-Metrics */}
        <div className="sm:col-span-7 flex flex-col justify-center space-y-3 pl-0 sm:pl-2">
          {metrics.map((item, idx) => {
            const Icon = item.icon || Clock;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
              >
                <div className="p-2 rounded-lg bg-white border border-slate-200 text-zinc-600 shrink-0 shadow-2xs">
                  <Icon className="w-4 h-4 text-zinc-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block truncate">
                    {item.label}
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-base font-black text-zinc-950 font-mono tracking-tight">
                      {item.value}
                    </span>
                    {item.change && (
                      <span
                        className={`text-[10px] font-extrabold flex items-center ${
                          item.isPositiveChange ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {item.change}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
