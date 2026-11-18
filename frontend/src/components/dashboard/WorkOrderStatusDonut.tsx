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

  // SVG donut math
  const size = 168;
  const baseStrokeWidth = 22;
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
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
            <PieChart className="w-4 h-4 text-purple-700" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
              Work Order Lifecycle
            </h3>
            <p className="text-[11px] text-zinc-500 font-normal">
              Status distribution across repair orders
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono font-semibold text-zinc-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {totalCount} Total
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-400 font-medium">
          Loading work order metrics...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <span className="text-xs text-zinc-400 font-medium">No active work orders recorded</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 my-2">
          {/* SVG Donut */}
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

            {/* Dynamic Interactive Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none transition-all duration-200">
              {activeSeg ? (
                <>
                  <span
                    className="text-2xl font-black font-mono tracking-tight leading-none"
                    style={{ color: activeSeg.color }}
                  >
                    {activeSeg.count}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-700 truncate max-w-[110px] mt-1">
                    {activeSeg.label}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                    {activeSeg.percentage}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                    {totalCount}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                    Orders
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend Grid */}
          <div className="w-full sm:w-auto space-y-2 text-xs flex-1">
            {segments.map((seg) => {
              const isHovered = hoveredKey === seg.key;

              return (
                <div
                  key={seg.key}
                  onMouseEnter={() => setHoveredKey(seg.key)}
                  onMouseLeave={() => setHoveredKey(null)}
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
                      {seg.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Completion Velocity</span>
        <span className="font-semibold text-emerald-700 font-mono">
          {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}% Resolved` : '0%'}
        </span>
      </div>
    </div>
  );
};
