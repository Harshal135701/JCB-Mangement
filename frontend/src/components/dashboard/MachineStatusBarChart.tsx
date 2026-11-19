import React, { useState } from 'react';

export interface MachineStatusBarItem {
  statusKey: string;
  label: string;
  count: number;
  color: string;
  description?: string;
}

interface MachineStatusBarChartProps {
  totalCount: number;
  items: MachineStatusBarItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export const MachineStatusBarChart: React.FC<MachineStatusBarChartProps> = ({
  totalCount = 0,
  items = [],
  loading = false,
  emptyMessage = 'No machine assets registered in the selected plant',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const hasData = totalCount > 0 && items.some((item) => item.count > 0);

  return (
    <div className="w-full">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-[13px] text-zinc-500 font-medium">Loading machine operating metrics...</span>
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
          <span className="text-[13px] text-zinc-500 font-normal">{emptyMessage}</span>
        </div>
      ) : (
        <div className="space-y-3.5 py-1">
          {items.map((item, idx) => {
            const pct = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
            const isZero = item.count === 0;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={item.statusKey || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'bg-slate-50 border border-slate-300/80 shadow-2xs'
                    : 'bg-transparent border border-transparent hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Left Column: Status Dot & Name */}
                  <div className="w-36 sm:w-44 shrink-0 flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 shadow-2xs transition-opacity duration-200 ${
                        isZero ? 'opacity-35' : 'opacity-100'
                      }`}
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={`text-[13px] sm:text-sm font-semibold truncate transition-colors duration-200 ${
                        isZero ? 'text-zinc-400 font-medium' : 'text-zinc-800'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {/* Center Column: Horizontal Bar Track */}
                  <div className="flex-1 h-5 sm:h-5.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                    {/* Subtle Reference Grid Markers (25%, 50%, 75%) */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-0.5">
                      <span className="w-px h-full bg-slate-200/60" style={{ marginLeft: '25%' }} />
                      <span className="w-px h-full bg-slate-200/60" style={{ marginLeft: '25%' }} />
                      <span className="w-px h-full bg-slate-200/60" style={{ marginLeft: '25%' }} />
                    </div>

                    {/* Animated Fill Bar */}
                    {!isZero && (
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out relative"
                        style={{
                          width: `${Math.max(pct, 2.5)}%`,
                          backgroundColor: item.color,
                          filter: isHovered ? 'brightness(1.08)' : 'none',
                        }}
                      />
                    )}
                  </div>

                  {/* Right Column: Machine Count & Percentage Badge */}
                  <div className="w-24 sm:w-28 shrink-0 flex items-center justify-end gap-2 text-right">
                    <span
                      className={`text-[13px] sm:text-sm font-bold font-mono transition-colors duration-200 ${
                        isZero ? 'text-zinc-400 font-medium' : 'text-zinc-950'
                      }`}
                    >
                      {item.count}
                    </span>
                    <span
                      className={`text-xs sm:text-[13px] font-semibold font-mono px-2 py-0.5 rounded-full border transition-all duration-200 ${
                        isZero
                          ? 'bg-slate-50 text-zinc-400 border-slate-200/60'
                          : isHovered
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-white text-zinc-600 border-slate-200'
                      }`}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Interactive Tooltip Card on Hover */}
                {isHovered && item.description && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs text-zinc-500">
                    <span className="italic">{item.description}</span>
                    <span className="font-mono font-semibold text-zinc-700">
                      {item.count} of {totalCount} machines ({pct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
