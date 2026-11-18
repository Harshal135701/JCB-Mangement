import React, { useState } from 'react';
import { PieChart } from 'lucide-react';

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
  totalLabel = 'Total Fleet',
  totalCount = 0,
  segments = [],
  emptyMessage = 'No machine assets recorded',
  loading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG donut math
  const size = 168;
  const baseStrokeWidth = 22;
  const radius = (size - baseStrokeWidth - 6) / 2;
  const circumference = 2 * Math.PI * radius;

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

  // Active highlighted segment
  const activeSegment = hoveredIndex !== null && computedSegments[hoveredIndex] ? computedSegments[hoveredIndex] : null;

  let accumulatedOffset = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
              {title}
            </h3>
            <p className="text-[11px] text-zinc-500 font-normal">
              Live operating state of plant machinery
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-semibold text-zinc-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {totalCount} Units
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-xs text-zinc-400 font-medium">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-2" />
          Loading status telemetry...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <div className="relative flex items-center justify-center mb-2">
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
                strokeWidth={baseStrokeWidth}
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 my-2">
          {/* SVG Donut with Hover Interactivity */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90 overflow-visible select-none"
            >
              {/* Background Ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#F1F5F9"
                strokeWidth={baseStrokeWidth}
              />

              {/* Segments */}
              {computedSegments.map((seg, i) => {
                const segLength = (seg.percentage / 100) * circumference;
                const offset = -accumulatedOffset;
                accumulatedOffset += segLength;

                const isHovered = hoveredIndex === i;
                const strokeWidth = isHovered ? baseStrokeWidth + 4 : baseStrokeWidth;

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
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      filter: isHovered ? 'drop-shadow(0px 0px 4px rgba(0,0,0,0.25))' : 'none',
                    }}
                  />
                );
              })}
            </svg>

            {/* Dynamic Interactive Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-all duration-200">
              {activeSegment ? (
                <>
                  <span
                    className="text-2xl font-black font-mono tracking-tight leading-none transition-all"
                    style={{ color: activeSegment.color }}
                  >
                    {activeSegment.count}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-700 truncate max-w-[110px] mt-1">
                    {activeSegment.label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                    {activeSegment.percentage.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                    {totalCount}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                    {totalLabel}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend */}
          <div className="w-full sm:w-auto space-y-2 text-xs flex-1">
            {computedSegments.map((seg, i) => {
              const isHovered = hoveredIndex === i;

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-200 ${
                    isHovered
                      ? 'bg-slate-100 shadow-2xs translate-x-1'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 transition-transform ${
                        isHovered ? 'scale-125' : ''
                      }`}
                      style={{ backgroundColor: seg.color }}
                    />
                    <span
                      className={`truncate text-xs ${
                        isHovered ? 'font-bold text-zinc-950' : 'font-medium text-zinc-700'
                      }`}
                    >
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-zinc-500 font-mono text-xs">
                      {seg.count}
                    </span>
                    <span
                      className={`font-mono text-xs px-1.5 py-0.2 rounded border ${
                        isHovered
                          ? 'bg-amber-100 text-amber-950 border-amber-300 font-bold'
                          : 'bg-slate-50 text-zinc-600 border-slate-200 font-semibold'
                      }`}
                    >
                      {seg.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Fleet Health Index</span>
        <span className="font-semibold text-emerald-700 font-mono">
          {totalCount > 0
            ? `${(((computedSegments.find((s) => s.label === 'Working')?.count || 0) / totalCount) * 100).toFixed(0)}% Working`
            : '0%'}
        </span>
      </div>
    </div>
  );
};
