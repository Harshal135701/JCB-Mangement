import React, { useState } from 'react';
import { TrendingUp, Calendar, ChevronDown } from 'lucide-react';

interface DataPoint {
  date: string;
  pm: number;
  breakdown: number;
}

const mock30DaysData: DataPoint[] = [
  { date: 'Oct 9', pm: 11, breakdown: 8 },
  { date: 'Oct 16', pm: 15, breakdown: 9 },
  { date: 'Oct 23', pm: 11, breakdown: 6 },
  { date: 'Oct 30', pm: 13, breakdown: 9 },
  { date: 'Nov 6', pm: 16, breakdown: 10 },
];

export const MaintenanceOverviewChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'30' | '14' | '7'>('30');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  // SVG dimensions
  const width = 520;
  const height = 210;
  const paddingX = 45;
  const paddingY = 30;
  const maxY = 20;

  // Coordinate mapper
  const getX = (index: number, total: number) => {
    return paddingX + (index / (total - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return height - paddingY - (val / maxY) * (height - paddingY * 2);
  };

  // Generate smooth cubic bezier SVG path
  const generateSplinePath = (data: DataPoint[], key: 'pm' | 'breakdown') => {
    if (data.length === 0) return '';
    const points = data.map((d, i) => ({ x: getX(i, data.length), y: getY(d[key]) }));
    
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

  const pmSpline = generateSplinePath(mock30DaysData, 'pm');
  const breakdownSpline = generateSplinePath(mock30DaysData, 'breakdown');

  // Closed area paths for gradient fills
  const firstX = getX(0, mock30DaysData.length);
  const lastX = getX(mock30DaysData.length - 1, mock30DaysData.length);
  const baselineY = height - paddingY;
  const pmArea = `${pmSpline} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
  const breakdownArea = `${breakdownSpline} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      {/* Header & Controls */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-jcb-yellow animate-pulse" />
          <h3 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider">
            Maintenance Overview
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
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
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

      {/* Mobile Legend if small */}
      <div className="flex sm:hidden items-center gap-3 text-[10px] font-bold mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-jcb-yellow border border-amber-500" />
          <span className="text-zinc-700">Scheduled PM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zinc-950" />
          <span className="text-zinc-700">Breakdowns</span>
        </div>
      </div>

      {/* SVG Chart Graphic */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 sm:h-52 overflow-visible">
          <defs>
            {/* PM Gradient */}
            <linearGradient id="pmAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFB800" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#FFB800" stopOpacity="0.0" />
            </linearGradient>
            {/* Breakdown Gradient */}
            <linearGradient id="breakdownAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18181B" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#18181B" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0, 5, 10, 15, 20].map((val) => {
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
          <path d={pmArea} fill="url(#pmAreaGrad)" />
          <path d={breakdownArea} fill="url(#breakdownAreaGrad)" />

          {/* Spline Lines */}
          <path
            d={pmSpline}
            fill="none"
            stroke="#FFB800"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={breakdownSpline}
            fill="none"
            stroke="#18181B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data Points */}
          {mock30DaysData.map((d, i) => {
            const px = getX(i, mock30DaysData.length);
            const pyPm = getY(d.pm);
            const pyBd = getY(d.breakdown);

            return (
              <g key={i}>
                {/* PM Point */}
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
                {/* Breakdown Point */}
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
                {/* X Axis Label */}
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
    </div>
  );
};
