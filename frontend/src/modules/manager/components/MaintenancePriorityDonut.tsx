import React, { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MaintenancePriorityDonutProps {
  breakdowns?: any[];
  workOrders?: any[];
  loading?: boolean;
}

export const MaintenancePriorityDonut: React.FC<MaintenancePriorityDonutProps> = ({
  breakdowns = [],
  workOrders = [],
  loading = false,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  // Extract requests: Use breakdowns (maintenance requests logged by operators), fallback to workOrders if breakdowns is empty
  const items = useMemo(() => {
    if (breakdowns && breakdowns.length > 0) return breakdowns;
    if (workOrders && workOrders.length > 0) return workOrders;
    return [];
  }, [breakdowns, workOrders]);

  // Priority categorization
  const { highCount, mediumCount, lowCount, totalCount } = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;

    items.forEach((item) => {
      const raw = (item.priority || '').toString().trim().toLowerCase();
      if (raw === 'critical' || raw === 'high' || raw === 'emergency' || raw === 'urgent') {
        high++;
      } else if (raw === 'low' || raw === 'minor') {
        low++;
      } else {
        // default to medium if 'medium', 'normal', or unspecified
        medium++;
      }
    });

    return {
      highCount: high,
      mediumCount: medium,
      lowCount: low,
      totalCount: items.length,
    };
  }, [items]);

  const total = totalCount > 0 ? totalCount : 1;

  const segments = useMemo(
    () => [
      {
        key: 'high',
        label: 'High Priority',
        shortLabel: 'High',
        count: highCount,
        percentage: totalCount > 0 ? Math.round((highCount / total) * 100) : 0,
        color: '#EF4444', // Red / Rose
        icon: ShieldAlert,
      },
      {
        key: 'medium',
        label: 'Medium Priority',
        shortLabel: 'Medium',
        count: mediumCount,
        percentage: totalCount > 0 ? Math.round((mediumCount / total) * 100) : 0,
        color: '#F59E0B', // Amber
        icon: AlertTriangle,
      },
      {
        key: 'low',
        label: 'Low Priority',
        shortLabel: 'Low',
        count: lowCount,
        percentage: totalCount > 0 ? Math.round((lowCount / total) * 100) : 0,
        color: '#3B82F6', // Blue
        icon: CheckCircle2,
      },
    ],
    [highCount, mediumCount, lowCount, total, totalCount]
  );

  // Donut geometry: size = 160, baseStrokeWidth = 20, radius = 67, circumference = 2 * PI * 67
  const size = 160;
  const baseStrokeWidth = 20;
  const radius = (size - baseStrokeWidth - 6) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;
  const activeSeg = segments.find((s) => s.key === hoveredKey);

  const hasData = totalCount > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col">
      {/* Header */}
      <div className="shrink-0 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                Maintenance Priority Distribution
              </h3>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold text-zinc-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
            {totalCount} Total
          </span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 text-xs text-zinc-400 font-medium">
          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
          Loading priority telemetry...
        </div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <span className="text-xs text-zinc-400 font-medium">No maintenance requests recorded</span>
        </div>
      ) : (
        <div className="my-3 w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between xl:justify-center gap-4 sm:gap-6 xl:gap-8 w-full">
            {/* Donut Chart */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="w-[145px] h-[145px] sm:w-[155px] sm:h-[155px] xl:w-[160px] xl:h-[160px] transform -rotate-90 overflow-visible select-none shrink-0"
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
                    <span className="text-2xs xl:text-xs font-bold text-zinc-700 truncate max-w-[95px] mt-0.5">
                      {activeSeg.shortLabel}
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
                    <span className="text-[9px] xl:text-[10px] font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
                      Requests
                    </span>
                    <span className="text-[9px] xl:text-[10px] font-mono text-zinc-400 font-medium">
                      Total
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Vertical Legend beside Donut */}
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[190px] sm:max-w-[245px] flex-1">
              {segments.map((seg) => {
                const isHovered = hoveredKey === seg.key;
                const IconComponent = seg.icon;

                return (
                  <div
                    key={seg.key}
                    onMouseEnter={() => setHoveredKey(seg.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
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
      )}

      {/* Footer */}
      <div className="pt-3.5 mt-2 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span>Total Maintenance Requests</span>
        <span className="font-semibold text-zinc-900 font-mono">
          {totalCount} {totalCount === 1 ? 'Request' : 'Requests'}
        </span>
      </div>
    </div>
  );
};
