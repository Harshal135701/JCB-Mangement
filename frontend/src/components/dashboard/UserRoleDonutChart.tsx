import React, { useState } from 'react';

export interface UserRoleSegment {
  label: string;
  count: number;
  percentage?: number;
  color: string;
  description?: string;
}

interface UserRoleDonutChartProps {
  totalCount: number;
  segments: UserRoleSegment[];
  loading?: boolean;
  emptyMessage?: string;
}

export const UserRoleDonutChart: React.FC<UserRoleDonutChartProps> = ({
  totalCount = 0,
  segments = [],
  loading = false,
  emptyMessage = 'No personnel registered in system',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // SVG Donut geometry
  const size = 220;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2; // (220 - 28) / 2 = 96
  const circumference = 2 * Math.PI * radius; // ≈ 603.185

  // Calculate percentages dynamically
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

  let accumulatedOffset = 0;

  const activeSegment =
    hoveredIndex !== null && computedSegments[hoveredIndex]
      ? computedSegments[hoveredIndex]
      : null;

  return (
    <div className="w-full">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-[13px] text-zinc-500 font-medium">Loading workforce records...</span>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
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
                strokeDasharray="8 8"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-3xl font-bold text-zinc-400 font-mono">0</span>
              <span className="text-xs font-semibold text-zinc-400 mt-1">
                Users
              </span>
            </div>
          </div>
          <span className="text-[13px] text-zinc-500 font-normal">{emptyMessage}</span>
        </div>
      ) : (
        /* Balanced Two-Column Layout */
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 py-2">
          {/* LEFT: Large Donut Chart */}
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
                stroke="#F8FAFC"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {computedSegments.map((seg, i) => {
                const segLength = (seg.percentage / 100) * circumference;
                const offset = -accumulatedOffset;
                accumulatedOffset += segLength;

                const isHovered = hoveredIndex === i;
                const isDimmed = hoveredIndex !== null && !isHovered;

                return (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${Math.max(segLength - 1.5, 0)} ${circumference}`}
                    strokeDashoffset={offset}
                    opacity={isDimmed ? 0.35 : 1}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="transition-all duration-300 cursor-pointer"
                  />
                );
              })}
            </svg>

            {/* Centre Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              <span className="text-3xl sm:text-4xl font-bold text-zinc-950 font-mono tracking-tight leading-none transition-all duration-200">
                {activeSegment ? activeSegment.count : totalCount}
              </span>
              <span className="text-xs sm:text-[13px] font-semibold text-zinc-500 mt-1.5 transition-all duration-200">
                {activeSegment ? activeSegment.label : 'Total Users'}
              </span>
              {activeSegment && (
                <span className="text-xs font-semibold font-mono text-amber-600 mt-0.5">
                  {activeSegment.percentage.toFixed(1)}% of total
                </span>
              )}
            </div>
          </div>

          {/* RIGHT: Detailed, High-Legibility Legend */}
          <div className="flex-1 w-full space-y-2.5">
            {computedSegments.map((seg, i) => {
              const isHovered = hoveredIndex === i;
              const isDimmed = hoveredIndex !== null && !isHovered;

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isHovered
                      ? 'bg-slate-50 border-slate-300 shadow-sm translate-x-1'
                      : isDimmed
                      ? 'bg-transparent border-transparent opacity-50'
                      : 'bg-slate-50/60 border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {/* Left Column: Color Dot + Role Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[13px] sm:text-sm font-semibold text-zinc-800 truncate">
                      {seg.label}
                    </span>
                  </div>

                  {/* Right Column: User Count & Percentage Pill */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] sm:text-sm font-bold text-zinc-950 font-mono">
                      {seg.count}
                    </span>
                    <span
                      className={`text-xs sm:text-[13px] font-semibold font-mono px-2.5 py-0.5 rounded-full border ${
                        isHovered
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-white text-zinc-600 border-slate-200'
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
    </div>
  );
};
