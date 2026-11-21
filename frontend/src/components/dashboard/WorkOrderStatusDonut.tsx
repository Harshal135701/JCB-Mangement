import React, { useState } from 'react';
import { PieChart, Clock, CheckCircle2, Wrench, AlertTriangle } from 'lucide-react';

interface WorkOrderStatusDonutProps {
  totalCount?: number;
  openCount?: number;
  inProgressCount?: number;
  completedCount?: number;
  overdueCount?: number;
  loading?: boolean;
  layout?: 'stacked' | 'horizontal';
}

export const WorkOrderStatusDonut: React.FC<WorkOrderStatusDonutProps> = ({
  totalCount = 0,
  openCount = 0,
  inProgressCount = 0,
  completedCount = 0,
  overdueCount = 0,
  loading = false,
  layout = 'horizontal',
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const isHorizontal = layout === 'horizontal';

  // SVG donut math: Well-proportioned size (200px) and bolder stroke (24px) on desktop for horizontal layout; compact (144px/18px) for stacked
  const size = isHorizontal ? 200 : 144;
  const baseStrokeWidth = isHorizontal ? 24 : 18;
  const radius = (size - baseStrokeWidth - 6) / 2;
  const circumference = 2 * Math.PI * radius;

  const hasData = totalCount > 0;
  const total = hasData ? totalCount : 1;

  const segments = [
    {
      key: 'open',
      label: 'Open',
      count: openCount,
      percentage: Math.round((openCount / total) * 100),
      color: '#F59E0B',
      icon: Clock,
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      count: inProgressCount,
      percentage: Math.round((inProgressCount / total) * 100),
      color: '#3B82F6',
      icon: Wrench,
    },
    {
      key: 'completed',
      label: 'Completed',
      count: completedCount,
      percentage: Math.round((completedCount / total) * 100),
      color: '#10B981',
      icon: CheckCircle2,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      count: overdueCount,
      percentage: Math.round((overdueCount / total) * 100),
      color: '#EF4444',
      icon: AlertTriangle,
    },
  ];

  let accumulatedOffset = 0;
  const activeSeg = segments.find((s) => s.key === hoveredKey);

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/90 ${
        isHorizontal ? 'px-5 py-6 sm:px-6 sm:py-7' : 'p-5 justify-between h-full'
      } shadow-xs flex flex-col`}
    >
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <PieChart className="w-4 h-4 text-purple-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                Work Order Status
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold text-zinc-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
            {totalCount} Total
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-400 font-medium">
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2" />
          Loading work orders telemetry...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <span className="text-xs text-zinc-400 font-medium">No active work orders recorded</span>
        </div>
      ) : isHorizontal ? (
        /* Enhanced Horizontal Layout for Manager Dashboard (~35-45px increased vertical breathing room) */
        <div className="my-4 sm:my-5 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between xl:justify-center gap-4 sm:gap-6 xl:gap-8 w-full">
            {/* Well-proportioned Donut (200px desktop, responsive 170-185px tablet/mobile) */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="w-[170px] h-[170px] sm:w-[185px] sm:h-[185px] xl:w-[200px] xl:h-[200px] transform -rotate-90 overflow-visible select-none shrink-0"
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
                {segments.map((seg) => {
                  const segLength = (seg.count / total) * circumference;
                  const offset = -accumulatedOffset;
                  accumulatedOffset += segLength;

                  if (seg.count <= 0) return null;

                  const isHovered = hoveredKey === seg.key;
                  const strokeWidth = isHovered ? baseStrokeWidth + 4 : baseStrokeWidth;

                  return (
                    <circle
                      key={seg.key}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${segLength} ${circumference}`}
                      strokeDashoffset={offset}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredKey(seg.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{
                        filter: isHovered ? 'drop-shadow(0px 0px 4px rgba(0,0,0,0.25))' : 'none',
                      }}
                    />
                  );
                })}
              </svg>

              {/* Dynamic Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-all duration-200 px-2">
                {activeSeg ? (
                  <>
                    <span
                      className="text-2xl xl:text-3xl font-black font-mono tracking-tight leading-none"
                      style={{ color: activeSeg.color }}
                    >
                      {activeSeg.count}
                    </span>
                    <span className="text-2xs xl:text-xs font-bold text-zinc-700 truncate max-w-[105px] mt-1">
                      {activeSeg.label}
                    </span>
                    <span className="text-[10px] xl:text-[11px] font-mono text-zinc-500 font-semibold">
                      {activeSeg.percentage}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl xl:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                      {totalCount}
                    </span>
                    <span className="text-[9px] xl:text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                      Total Orders
                    </span>
                    <span className="text-[9px] xl:text-[10px] font-mono text-zinc-400 font-medium">
                      Maintenance
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Vertical Legend beside Donut */}
            <div className="flex flex-col gap-2.5 w-full sm:w-auto sm:min-w-[190px] sm:max-w-[245px] flex-1">
              {segments.map((seg) => {
                const isHovered = hoveredKey === seg.key;
                const IconComponent = seg.icon;

                return (
                  <div
                    key={seg.key}
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                      isHovered
                        ? 'bg-slate-100 border-slate-300 shadow-2xs scale-[1.01]'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                        style={{ backgroundColor: `${seg.color}15`, color: seg.color }}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-xs font-semibold text-zinc-800 truncate">
                        {seg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                      <span className="font-bold text-zinc-950">{seg.count}</span>
                      <span className="text-[10px] text-zinc-500 bg-slate-200/70 px-1.5 py-0.5 rounded font-medium">
                        {seg.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Legacy Stacked Layout */
        <div className="flex flex-col items-center">
          {/* SVG Donut */}
          <div className="relative flex items-center justify-center my-2 shrink-0">
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
              {segments.map((seg) => {
                const segLength = (seg.count / total) * circumference;
                const offset = -accumulatedOffset;
                accumulatedOffset += segLength;

                if (seg.count <= 0) return null;

                const isHovered = hoveredKey === seg.key;
                const strokeWidth = isHovered ? baseStrokeWidth + 4 : baseStrokeWidth;

                return (
                  <circle
                    key={seg.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segLength} ${circumference}`}
                    strokeDashoffset={offset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={{
                      filter: isHovered ? 'drop-shadow(0px 0px 4px rgba(0,0,0,0.25))' : 'none',
                    }}
                  />
                );
              })}
            </svg>

            {/* Dynamic Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-all duration-200">
              {activeSeg ? (
                <>
                  <span
                    className="text-2xl font-black font-mono tracking-tight leading-none"
                    style={{ color: activeSeg.color }}
                  >
                    {activeSeg.count}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-700 truncate max-w-[95px] mt-0.5">
                    {activeSeg.label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                    {activeSeg.percentage}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                    {totalCount}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
                    Orders
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 2-Column Compact Grid Legend */}
          <div className="grid grid-cols-2 gap-2 w-full mt-2">
            {segments.map((seg) => {
              const isHovered = hoveredKey === seg.key;

              return (
                <div
                  key={seg.key}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    isHovered
                      ? 'bg-slate-100 border-slate-300 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-xs font-semibold text-zinc-800 truncate">
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-mono text-xs">
                    <span className="font-bold text-zinc-950">{seg.count}</span>
                    <span className="text-[10px] text-zinc-400">
                      {seg.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Directly Below Content */}
      <div className="pt-4 mt-3 sm:pt-4.5 sm:mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span>Resolution Velocity</span>
        <span className="font-semibold text-emerald-700 font-mono">
          {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% Resolved` : '0%'}
        </span>
      </div>
    </div>
  );
};
