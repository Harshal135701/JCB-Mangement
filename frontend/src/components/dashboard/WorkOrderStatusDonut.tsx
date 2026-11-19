import React, { useState } from 'react';
import { PieChart, Clock, CheckCircle2, Wrench, AlertTriangle } from 'lucide-react';

interface WorkOrderStatusDonutProps {
  totalCount?: number;
  openCount?: number;
  inProgressCount?: number;
  completedCount?: number;
  overdueCount?: number;
  loading?: boolean;
}

export const WorkOrderStatusDonut: React.FC<WorkOrderStatusDonutProps> = ({
  totalCount = 0,
  openCount = 0,
  inProgressCount = 0,
  completedCount = 0,
  overdueCount = 0,
  loading = false,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // SVG donut math (compact, perfectly proportioned)
  const size = 144;
  const baseStrokeWidth = 18;
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
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-400 font-medium">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading work orders telemetry...
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
            <span className="text-xs text-zinc-400 font-medium">No active work orders recorded</span>
          </div>
        ) : (
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
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Resolution Velocity</span>
        <span className="font-semibold text-emerald-700 font-mono">
          {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% Resolved` : '0%'}
        </span>
      </div>
    </div>
  );
};
