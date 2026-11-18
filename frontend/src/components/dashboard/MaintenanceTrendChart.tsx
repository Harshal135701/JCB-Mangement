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
}

export const MaintenanceTrendChart: React.FC<MaintenanceTrendChartProps> = ({
  title = 'Operational Maintenance Trends',
  subtitle = '4-week velocity of Corrective vs. Preventive maintenance work orders',
  series1Name = 'Corrective Work Orders',
  series2Name = 'Preventive Work Orders',
  series1Color = '#18181B', // Dark charcoal
  series2Color = '#F59E0B', // JCB Yellow/Amber
  data = [],
  maxY,
  loading = false,
  emptyMessage = 'No maintenance trend data recorded for this period',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG Canvas dimensions
  const width = 480;
  const height = 180;
  const paddingLeft = 36;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Dynamically calculate effective maxY
  const maxDataVal = data.reduce(
    (acc, curr) => Math.max(acc, curr.series1 || 0, curr.series2 || 0),
    0
  );
  const effectiveMaxY = maxY || Math.max(5, Math.ceil(maxDataVal * 1.3) || 5);

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

  // Generate 4-step tick markers
  const tickStep = Math.max(1, Math.ceil(effectiveMaxY / 4));
  const yTicks = [0, tickStep, tickStep * 2, tickStep * 3, effectiveMaxY];

  const hasData = data.length > 0;

  const totalCorrective = data.reduce((acc, curr) => acc + (curr.series1 || 0), 0);
  const totalPreventive = data.reduce((acc, curr) => acc + (curr.series2 || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header & Legend */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                {title}
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs sm:text-[13px] font-semibold text-zinc-600 shrink-0">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block shrink-0"
                style={{ backgroundColor: series1Color }}
              />
              <span>{series1Name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block shrink-0"
                style={{ backgroundColor: series2Color }}
              />
              <span>{series2Name}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[13px] text-zinc-500 font-medium">Loading trend records...</span>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-14 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <span className="text-[13px] text-zinc-500 font-normal">{emptyMessage}</span>
          </div>
        ) : (
          /* SVG Spline Chart */
          <div className="w-full mt-2 relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={series2Color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={series2Color} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-axis labels */}
              {yTicks.map((val) => {
                const yPos = getY(val);
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={width - paddingRight}
                      y2={yPos}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray={val === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      className="text-[11px] fill-zinc-400 font-mono font-medium"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill for Series 2 (Preventive) */}
              {areaSeries2 && <path d={areaSeries2} fill="url(#trendAreaGradient)" />}

              {/* Smooth Spline for Series 1 (Charcoal Corrective) */}
              {pathSeries1 && (
                <path
                  d={pathSeries1}
                  fill="none"
                  stroke={series1Color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Smooth Spline for Series 2 (JCB Yellow Preventive) */}
              {pathSeries2 && (
                <path
                  d={pathSeries2}
                  fill="none"
                  stroke={series2Color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Interactive Column Guidelines & Markers */}
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
                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={xPos}
                        y1={paddingTop}
                        x2={xPos}
                        y2={paddingTop + chartHeight}
                        stroke="#94A3B8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Point Series 1 */}
                    <circle
                      cx={xPos}
                      cy={yPos1}
                      r={isHovered ? 5.5 : 4}
                      fill={series1Color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all duration-200"
                    />

                    {/* Point Series 2 */}
                    <circle
                      cx={xPos}
                      cy={yPos2}
                      r={isHovered ? 5.5 : 4}
                      fill={series2Color}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      className="transition-all duration-200"
                    />

                    {/* X-Axis Label */}
                    <text
                      x={xPos}
                      y={height - 8}
                      textAnchor="middle"
                      className={`text-[11px] font-medium transition-colors ${
                        isHovered ? 'fill-zinc-950 font-bold' : 'fill-zinc-500'
                      }`}
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Popup */}
            {hoveredIdx !== null && data[hoveredIdx] && (
              <div
                className="absolute top-2 bg-zinc-900 text-white rounded-xl px-3 py-2 text-xs shadow-lg pointer-events-none transform -translate-x-1/2 z-10"
                style={{
                  left: `${(getX(hoveredIdx) / width) * 100}%`,
                }}
              >
                <div className="font-semibold text-zinc-300 border-b border-zinc-700 pb-1 mb-1">
                  {data[hoveredIdx].label} {data[hoveredIdx].dateLabel ? `(${data[hoveredIdx].dateLabel})` : ''}
                </div>
                <div className="flex items-center justify-between gap-3 text-zinc-100">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: series1Color }} />
                    Corrective:
                  </span>
                  <span className="font-mono font-bold">{data[hoveredIdx].series1}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-zinc-100">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: series2Color }} />
                    Preventive:
                  </span>
                  <span className="font-mono font-bold">{data[hoveredIdx].series2}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
        <div className="flex items-center gap-4 text-zinc-500 font-normal">
          <span>Corrective Total: <strong className="text-zinc-900 font-mono font-semibold">{totalCorrective}</strong></span>
          <span>Preventive Total: <strong className="text-zinc-900 font-mono font-semibold">{totalPreventive}</strong></span>
        </div>
      </div>
    </div>
  );
};

