import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface OverviewDataPoint {
  date: string;
  pm: number;
  breakdown: number;
}

interface MaintenanceOverviewChartProps {
  title?: string;
  data?: OverviewDataPoint[];
  timeframe?: '30' | '14' | '7';
  onTimeframeChange?: (tf: '30' | '14' | '7') => void;
  loading?: boolean;
  emptyMessage?: string;
}

export const MaintenanceOverviewChart: React.FC<MaintenanceOverviewChartProps> = ({
  title = 'Maintenance Overview',
  data = [],
  timeframe = '30',
  onTimeframeChange,
  loading = false,
  emptyMessage = 'No maintenance activity recorded for this period',
}) => {
  const [internalTimeframe, setInternalTimeframe] = useState<'30' | '14' | '7'>(timeframe);
  const [hoveredPoint, setHoveredPoint] = useState<OverviewDataPoint | null>(null);

  const activeTimeframe = onTimeframeChange ? timeframe : internalTimeframe;
  const handleTimeframeChange = (val: '30' | '14' | '7') => {
    if (onTimeframeChange) {
      onTimeframeChange(val);
    } else {
      setInternalTimeframe(val);
    }
  };

  // SVG dimensions
  const width = 520;
  const height = 210;
  const paddingX = 45;
  const paddingY = 30;

  // Dynamically compute maxY
  const maxVal = data.reduce((acc, d) => Math.max(acc, d.pm || 0, d.breakdown || 0), 0);
  const maxY = Math.max(5, Math.ceil(maxVal * 1.25) || 5);

  // Coordinate mapper
  const getX = (index: number, total: number) => {
    if (total <= 1) return width / 2;
    return paddingX + (index / (total - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return height - paddingY - (val / maxY) * (height - paddingY * 2);
  };

  // Generate smooth cubic bezier SVG path
  const generateSplinePath = (items: OverviewDataPoint[], key: 'pm' | 'breakdown') => {
    if (items.length === 0) return '';
    const points = items.map((d, i) => ({ x: getX(i, items.length), y: getY(d[key] || 0) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
    return path;
  };

  const pmSpline = generateSplinePath(data, 'pm');
  const breakdownSpline = generateSplinePath(data, 'breakdown');

  // Closed area paths for gradient fills
  const firstX = getX(0, data.length);
  const lastX = getX(Math.max(0, data.length - 1), data.length);
  const baselineY = height - paddingY;
  const pmArea = data.length > 0 ? `${pmSpline} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z` : '';
  const breakdownArea = data.length > 0 ? `${breakdownSpline} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z` : '';

  const step = Math.max(1, Math.ceil(maxY / 4));
  const yTicks = [0, step, step * 2, step * 3, maxY];

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-jcb-yellow animate-pulse" />
          <h3 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-jcb-yellow border border-amber-500" />
              <span className="text-zinc-700">Scheduled PM</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-950" />
              <span className="text-zinc-700">Breakdowns</span>
            </div>
          </div>

          {/* Timeframe Dropdown */}
          <div className="relative">
            <select
              value={activeTimeframe}
              onChange={(e) => handleTimeframeChange(e.target.value as any)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-zinc-800 text-xs font-bold py-1.5 pl-3 pr-7 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="30">Last 30 Days</option>
              <option value="14">Last 14 Days</option>
              <option value="7">Last 7 Days</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-zinc-400 font-medium">
          Loading maintenance overview...
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-xs text-zinc-400 font-medium">{emptyMessage}</span>
        </div>
      ) : (
        /* SVG Chart Graphic */
        <div className="relative w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 sm:h-52 overflow-visible">
            <defs>
              <linearGradient id="pmAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFB800" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#FFB800" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="breakdownAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181B" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#18181B" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {yTicks.map((val) => {
              const y = getY(val);
              return (
                <g key={val}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                    strokeDasharray={val === 0 ? 'none' : '3,3'}
                  />
                  <text
                    x={paddingX - 10}
                    y={y + 3.5}
                    textAnchor="end"
                    className="text-[10px] fill-zinc-400 font-mono font-medium"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fills */}
            {pmArea && <path d={pmArea} fill="url(#pmAreaGrad)" />}
            {breakdownArea && <path d={breakdownArea} fill="url(#breakdownAreaGrad)" />}

            {/* Spline Lines */}
            {pmSpline && (
              <path
                d={pmSpline}
                fill="none"
                stroke="#FFB800"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            {breakdownSpline && (
              <path
                d={breakdownSpline}
                fill="none"
                stroke="#18181B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Data Points */}
            {data.map((d, i) => {
              const px = getX(i, data.length);
              const pyPm = getY(d.pm || 0);
              const pyBd = getY(d.breakdown || 0);

              return (
                <g key={i}>
                  <circle
                    cx={px}
                    cy={pyPm}
                    r="4.5"
                    fill="#FFB800"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="cursor-pointer transition-transform hover:scale-125"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  <circle
                    cx={px}
                    cy={pyBd}
                    r="4"
                    fill="#18181B"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    className="cursor-pointer transition-transform hover:scale-125"
                    onMouseEnter={() => setHoveredPoint(d)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  <text
                    x={px}
                    y={height - 8}
                    textAnchor="middle"
                    className="text-[10px] fill-zinc-400 font-medium"
                  >
                    {d.date}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Hover Tooltip Overlay */}
          {hoveredPoint && (
            <div className="absolute top-2 right-2 bg-zinc-950 text-white text-[10px] p-2 rounded-lg shadow-lg border border-zinc-700 pointer-events-none">
              <div className="font-bold text-jcb-yellow mb-1">{hoveredPoint.date}</div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-jcb-yellow" />
                <span>Scheduled PM: {hoveredPoint.pm}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>Breakdowns: {hoveredPoint.breakdown}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
