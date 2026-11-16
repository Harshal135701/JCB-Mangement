import React from 'react';
import { BarChart3 } from 'lucide-react';

export interface DonutSegment {
  label: string;
  count: number;
  percentage?: number;
  color: string;
}

interface MachineStatusDonutProps {
  title?: string;
  totalLabel?: string;
  totalCount?: number;
  segments?: DonutSegment[];
  emptyMessage?: string;
  loading?: boolean;
}

export const MachineStatusDonut: React.FC<MachineStatusDonutProps> = ({
  title = 'Machine Status Overview',
  totalLabel = 'Total',
  totalCount = 0,
  segments = [],
  emptyMessage = 'No machine assets recorded',
  loading = false,
}) => {
  // SVG donut math
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius; // ≈ 433.54 for size 160, r=69

  let accumulatedOffset = 0;

  // Calculate percentages safely if totalCount > 0
  const computedSegments = segments.map((seg) => {
    const pct =
      typeof seg.percentage === 'number' && !isNaN(seg.percentage)
        ? seg.percentage
        : totalCount > 0
        ? (seg.count / totalCount) * 100
        : 0;
    return {
      ...seg,
      percentage: pct,
    };
  });

  const hasData = totalCount > 0 && computedSegments.some((s) => s.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <span>{title}</span>
        </h3>
        <BarChart3 className="w-4 h-4 text-amber-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-zinc-400 font-medium">
          Loading metrics...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="relative flex items-center justify-center mb-3">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth={strokeWidth}
                strokeDasharray="6 6"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-black text-zinc-400 font-mono tracking-tight leading-none">
                0
              </span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                {totalLabel}
              </span>
            </div>
          </div>
          <span className="text-xs text-zinc-400 font-medium">{emptyMessage}</span>
        </div>
      ) : (
        /* SVG Donut & Side Legend */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 my-2">
          {/* SVG Donut */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90 overflow-visible"
            >
              {/* Background Ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {computedSegments.map((seg, i) => {
                const segLength = (seg.percentage / 100) * circumference;
                const offset = -accumulatedOffset;
                accumulatedOffset += segLength;

                return (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segLength} ${circumference}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-500"
                  />
                );
              })}
            </svg>

            {/* Center Count */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                {totalCount}
              </span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                {totalLabel}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full sm:w-auto space-y-2 text-xs">
            {computedSegments.map((seg, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-zinc-600 font-medium truncate text-[11px] sm:text-xs">
                    {seg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-zinc-500 font-mono text-[11px]">
                    ({seg.count})
                  </span>
                  <span className="font-bold text-zinc-900 font-mono text-[11px] sm:text-xs">
                    {seg.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
