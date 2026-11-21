import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';

export interface TrendDataPoint {
  label: string;
  dateLabel?: string;
  series1: number;
  series2: number;
}

interface MaintenanceTrendChartProps {
  title?: string;
  subtitle?: string;
  series1Name?: string;
  series2Name?: string;
  series1Color?: string; // Corrective / Primary
  series2Color?: string; // Preventive / Secondary
  data?: TrendDataPoint[];
  maxY?: number;
  loading?: boolean;
  emptyMessage?: string;
  height?: number;
}

export const MaintenanceTrendChart: React.FC<MaintenanceTrendChartProps> = ({
  title = 'Maintenance Velocity',
  subtitle,
  series1Name = 'Corrective',
  series2Name = 'Preventive',
  series1Color = '#18181B', // Dark charcoal
  series2Color = '#F59E0B', // JCB Yellow/Amber
  data = [],
  maxY,
  loading = false,
  emptyMessage = 'No maintenance trend recorded',
  height: customHeight,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG Canvas dimensions (clean wide ratio, customizable for dashboard alignment)
  const width = 460;
  const height = customHeight || 180;
  const paddingLeft = 28;
  const paddingRight = 14;
  const paddingTop = 12;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Dynamically calculate effective maxY
  const maxDataVal = data.reduce(
    (acc, curr) => Math.max(acc, curr.series1 || 0, curr.series2 || 0),
    0
  );
  const effectiveMaxY = maxY || Math.max(4, Math.ceil(maxDataVal * 1.25) || 4);

  // Scale functions
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(effectiveMaxY, val));
    return paddingTop + chartHeight - (clamped / effectiveMaxY) * chartHeight;
  };

  // Helper to build smooth path
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const pathSeries1 = buildSmoothPath(data.map((d) => d.series1 || 0));
  const pathSeries2 = buildSmoothPath(data.map((d) => d.series2 || 0));

  const areaSeries2 =
    data.length > 0
      ? `${pathSeries2} L ${getX(data.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`
      : '';

  // 3-step tick markers (deduplicated to prevent duplicate key warning)
  const tickStep = Math.max(1, Math.ceil(effectiveMaxY / 3));
  const yTicks = Array.from(new Set([0, tickStep, tickStep * 2, effectiveMaxY]));

  const hasData = data.length > 0;
  const totalCorrective = data.reduce((acc, curr) => acc + (curr.series1 || 0), 0);
  const totalPreventive = data.reduce((acc, curr) => acc + (curr.series2 || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between h-full overflow-hidden">
      {/* Header & Legend */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 tracking-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-zinc-500 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <span className="text-[10px] font-bold text-zinc-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
            4-Wk
          </span>
        </div>

        {/* Legend Pills Bar - structured and wrap-safe */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 pb-1.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-[11px] font-medium text-zinc-700">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: series1Color }} />
              <span>{series1Name}</span>
              <strong className="text-zinc-950 font-mono">({totalCorrective})</strong>
            </span>
            <span className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px] font-medium text-amber-900">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: series2Color }} />
              <span>{series2Name}</span>
              <strong className="text-amber-950 font-mono">({totalPreventive})</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Chart Visualization Area */}
      <div className="flex-1 flex flex-col justify-center my-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-400 font-medium">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading trend...
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
            <span className="text-xs text-zinc-400 font-medium">{emptyMessage}</span>
          </div>
        ) : (
          <div className="w-full relative select-none flex-1 flex items-center justify-center min-h-0 py-1">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none max-h-[285px]"
            >
              <defs>
                <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series2Color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={series2Color} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Gridlines & Y-axis numbers */}
              {yTicks.map((val, idx) => {
                const yPos = getY(val);
                return (
                  <g key={`ytick-${idx}-${val}`}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={width - paddingRight}
                      y2={yPos}
                      stroke="#F1F5F9"
                      strokeWidth="1"
                      strokeDasharray={val === 0 ? undefined : '2 2'}
                    />
                    <text
                      x={paddingLeft - 7}
                      y={yPos + 3.5}
                      textAnchor="end"
                      className="text-[10px] fill-zinc-500 font-mono font-semibold"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Preventive Area Fill */}
              {areaSeries2 && <path d={areaSeries2} fill="url(#trendAreaGrad)" />}

              {/* Corrective Spline (Dark Charcoal) */}
              {pathSeries1 && (
                <path
                  d={pathSeries1}
                  fill="none"
                  stroke={series1Color}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Preventive Spline (JCB Amber) */}
              {pathSeries2 && (
                <path
                  d={pathSeries2}
                  fill="none"
                  stroke={series2Color}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Points */}
              {data.map((item, idx) => {
                const xPos = getX(idx);
                const yPos1 = getY(item.series1 || 0);
                const yPos2 = getY(item.series2 || 0);
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {isHovered && (
                      <line
                        x1={xPos}
                        y1={paddingTop}
                        x2={xPos}
                        y2={paddingTop + chartHeight}
                        stroke="#CBD5E1"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Point 1 */}
                    <circle
                      cx={xPos}
                      cy={yPos1}
                      r={isHovered ? 5.5 : 4.5}
                      fill={series1Color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />

                    {/* Point 2 */}
                    <circle
                      cx={xPos}
                      cy={yPos2}
                      r={isHovered ? 5.5 : 4.5}
                      fill={series2Color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />

                    {/* X-Axis Label */}
                    <text
                      x={xPos}
                      y={height - 5}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold transition-colors ${
                        isHovered ? 'fill-zinc-950 font-bold' : 'fill-zinc-600'
                      }`}
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Popup - safely clamped */}
            {hoveredIdx !== null && data[hoveredIdx] && (
              <div
                className="absolute top-0 bg-zinc-900/95 text-white rounded-lg px-2.5 py-1 text-[11px] shadow-md pointer-events-none transform -translate-x-1/2 z-10"
                style={{
                  left: `${Math.max(20, Math.min(80, (getX(hoveredIdx) / width) * 100))}%`,
                }}
              >
                <div className="font-semibold text-zinc-300 border-b border-zinc-700/80 pb-0.5 mb-0.5 text-[10px]">
                  {data[hoveredIdx].label} {data[hoveredIdx].dateLabel ? `(${data[hoveredIdx].dateLabel})` : ''}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300">Corr: <strong className="text-white">{data[hoveredIdx].series1}</strong></span>
                  <span className="text-zinc-300">• Prev: <strong className="text-amber-400">{data[hoveredIdx].series2}</strong></span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 pt-3 mt-auto border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Velocity Ratio</span>
        <span className="font-semibold text-zinc-800 font-mono">
          {totalCorrective + totalPreventive > 0
            ? `${Math.round((totalPreventive / (totalCorrective + totalPreventive)) * 100)}% PM Share`
            : 'Nominal'}
        </span>
      </div>
    </div>
  );
};
