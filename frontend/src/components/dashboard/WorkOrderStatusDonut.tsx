import React from 'react';
import { PieChart } from 'lucide-react';

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
  // SVG donut math
  const size = 180;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius; // ≈ 490.09 for size 180, r=78

  const hasData = totalCount > 0;
  const total = hasData ? totalCount : 1;

  const openPct = Math.round((openCount / total) * 100);
  const inProgPct = Math.round((inProgressCount / total) * 100);
  const compPct = Math.round((completedCount / total) * 100);
  const overduePct = Math.max(0, 100 - openPct - inProgPct - compPct);

  // Segment stroke dash lengths
  const openLen = (openCount / total) * circumference;
  const inProgLen = (inProgressCount / total) * circumference;
  const compLen = (completedCount / total) * circumference;
  const overdueLen = (overdueCount / total) * circumference;

  const openOffset = 0;
  const inProgOffset = -openLen;
  const compOffset = -(openLen + inProgLen);
  const overdueOffset = -(openLen + inProgLen + compLen);

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-zinc-700" />
          <h3 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider">
            Work Order Status
          </h3>
        </div>
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Active Queue
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-400 font-medium">
          Loading work order status...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="relative flex items-center justify-center my-2">
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
                Total
              </span>
            </div>
          </div>
          <span className="text-xs text-zinc-400 font-medium">No active work orders recorded</span>
        </div>
      ) : (
        <>
          {/* SVG Donut */}
          <div className="relative flex items-center justify-center my-2">
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

              {/* Open Segment (Yellow/Amber) */}
              {openCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${openLen} ${circumference}`}
                  strokeDashoffset={openOffset}
                  className="transition-all duration-500"
                />
              )}

              {/* In Progress Segment (Blue) */}
              {inProgressCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${inProgLen} ${circumference}`}
                  strokeDashoffset={inProgOffset}
                  className="transition-all duration-500"
                />
              )}

              {/* Completed Segment (Green) */}
              {completedCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${compLen} ${circumference}`}
                  strokeDashoffset={compOffset}
                  className="transition-all duration-500"
                />
              )}

              {/* Overdue Segment (Red) */}
              {overdueCount > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#EF4444"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${overdueLen} ${circumference}`}
                  strokeDashoffset={overdueOffset}
                  className="transition-all duration-500"
                />
              )}
            </svg>

            {/* Center Total Count */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
                {totalCount}
              </span>
              <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mt-1">
                Total
              </span>
            </div>
          </div>

          {/* Status Legend Grid */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-3 border-t border-slate-100 text-[11px] font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-zinc-600 truncate">
                Open: <strong className="text-zinc-900">{openCount}</strong> ({openPct}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-zinc-600 truncate">
                Active: <strong className="text-zinc-900">{inProgressCount}</strong> ({inProgPct}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-zinc-600 truncate">
                Closed: <strong className="text-zinc-900">{completedCount}</strong> ({compPct}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-zinc-600 truncate">
                Overdue: <strong className="text-zinc-900">{overdueCount}</strong> ({overduePct}%)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
