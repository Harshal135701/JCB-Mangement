import React from 'react';
import { TrendingUp } from 'lucide-react';

export interface TrendDataPoint {
  label: string;
  series1: number;
  series2: number;
}

interface MaintenanceTrendChartProps {
  title?: string;
  series1Name?: string;
  series2Name?: string;
  series1Color?: string; // Corrective / Primary
  series2Color?: string; // Preventive / Secondary
  data?: TrendDataPoint[];
  maxY?: number;
}

const defaultData: TrendDataPoint[] = [
  { label: 'Week 1', series1: 20, series2: 13 },
  { label: 'Week 2', series1: 27, series2: 20 },
  { label: 'Week 3', series1: 25, series2: 18 },
  { label: 'Week 4', series1: 32, series2: 25 },
];

export const MaintenanceTrendChart: React.FC<MaintenanceTrendChartProps> = ({
  title = 'Maintenance Trend',
  series1Name = 'Corrective',
  series2Name = 'Preventive',
  series1Color = '#18181B', // Dark charcoal/navy
  series2Color = '#EAB308', // JCB Yellow/Amber
  data = defaultData,
  maxY = 40,
}) => {
  // SVG Canvas dimensions
  const width = 380;
  const height = 150;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 12;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Scale functions
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxY, val));
    return paddingTop + chartHeight - (clamped / maxY) * chartHeight;
  };

  // Helper to build smooth cubic bezier path
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

      // Catmull-Rom to Cubic Bezier conversion
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const pathSeries1 = buildSmoothPath(data.map((d) => d.series1));
  const pathSeries2 = buildSmoothPath(data.map((d) => d.series2));

  // Area path under series 2 (Preventive) with gradient fill
  const areaSeries2 =
    data.length > 0
      ? `${pathSeries2} L ${getX(data.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`
      : '';

  // Y-axis tick values: [0, 10, 20, 30, 40]
  const yTicks = [0, 10, 20, 30, 40].filter((v) => v <= maxY);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
            {title}
          </h3>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-600">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: series1Color }}
            />
            <span>{series1Name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rotate-45 inline-block"
              style={{ backgroundColor: series2Color }}
            />
            <span>{series2Name}</span>
          </div>
        </div>
      </div>

      {/* SVG Spline Chart */}
      <div className="w-full mt-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="preventiveAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={series2Color} stopOpacity="0.28" />
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
                  strokeDasharray={val === 0 ? undefined : '2 2'}
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 3.5}
                  textAnchor="end"
                  fill="#94A3B8"
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="600"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fill under Series 2 */}
          {areaSeries2 && (
            <path d={areaSeries2} fill="url(#preventiveAreaGradient)" />
          )}

          {/* Series 2 Line (Preventive - Yellow) */}
          <path
            d={pathSeries2}
            fill="none"
            stroke={series2Color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Series 1 Line (Corrective - Dark) */}
          <path
            d={pathSeries1}
            fill="none"
            stroke={series1Color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Series 2 Data Points (Diamonds / Circles) */}
          {data.map((d, i) => (
            <circle
              key={`s2-${i}`}
              cx={getX(i)}
              cy={getY(d.series2)}
              r="3.5"
              fill="#FFFFFF"
              stroke={series2Color}
              strokeWidth="2.5"
            />
          ))}

          {/* Series 1 Data Points */}
          {data.map((d, i) => (
            <circle
              key={`s1-${i}`}
              cx={getX(i)}
              cy={getY(d.series1)}
              r="3.5"
              fill={series1Color}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          ))}

          {/* X-axis Labels */}
          {data.map((d, i) => (
            <text
              key={`xlabel-${i}`}
              x={getX(i)}
              y={height - 6}
              textAnchor="middle"
              fill="#64748B"
              fontSize="9"
              fontFamily="sans-serif"
              fontWeight="600"
            >
              {d.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};
