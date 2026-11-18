import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Activity, AlertTriangle, ChevronDown, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';

export interface MachineStatusDataPoint {
  point_date: string;
  date_label: string;
  operational: number;
  under_maintenance: number;
  breakdown: number;
  idle: number;
  total_fleet: number;
}

export interface MachineStatusSummary {
  current_operational: number;
  current_under_maintenance: number;
  current_breakdown: number;
  current_idle: number;
  total_machines: number;
}

interface MachineStatusMultiLineChartProps {
  plantId?: string;
  plantName?: string;
  dashboardTimeframe?: string;
  showAddMachine?: boolean;
}

interface SeriesConfig {
  key: 'operational' | 'under_maintenance' | 'breakdown' | 'idle';
  label: string;
  color: string;
  gradientId: string;
  description: string;
}

const SERIES_CONFIG: SeriesConfig[] = [
  {
    key: 'operational',
    label: 'Operational',
    color: '#16A34A', // Emerald green
    gradientId: 'grad-operational',
    description: 'Active & running on production floor',
  },
  {
    key: 'under_maintenance',
    label: 'Under Maintenance',
    color: '#F59E0B', // Amber / JCB yellow-orange
    gradientId: 'grad-maintenance',
    description: 'Active repair or parts replacement',
  },
  {
    key: 'breakdown',
    label: 'Breakdown',
    color: '#DC2626', // Crimson red
    gradientId: 'grad-breakdown',
    description: 'Critical stoppage requiring immediate action',
  },
  {
    key: 'idle',
    label: 'Idle',
    color: '#64748B', // Slate gray
    gradientId: 'grad-idle',
    description: 'Standby mode with no active job',
  },
];

export const MachineStatusMultiLineChart: React.FC<MachineStatusMultiLineChartProps> = ({
  plantId,
  plantName = 'All Plants',
  dashboardTimeframe,
  showAddMachine = false,
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(
    dashboardTimeframe && ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'].includes(dashboardTimeframe)
      ? dashboardTimeframe
      : 'Last 30 Days'
  );

  const [data, setData] = useState<MachineStatusDataPoint[]>([]);
  const [summary, setSummary] = useState<MachineStatusSummary>({
    current_operational: 0,
    current_under_maintenance: 0,
    current_breakdown: 0,
    current_idle: 0,
    total_machines: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    operational: true,
    under_maintenance: true,
    breakdown: true,
    idle: true,
  });

  // Sync if dashboard timeframe changes externally
  useEffect(() => {
    if (dashboardTimeframe && ['Last 7 Days', 'Last 30 Days', 'Last 90 Days'].includes(dashboardTimeframe)) {
      setSelectedTimeframe(dashboardTimeframe);
    }
  }, [dashboardTimeframe]);

  // Fetch machine status trend data from backend
  useEffect(() => {
    let isMounted = true;
    const fetchTrend = async () => {
      try {
        setLoading(true);
        const params: Record<string, string> = {
          timeframe: selectedTimeframe,
        };
        if (plantId) {
          params.plant_id = plantId;
        }

        const res = await apiClient.get('/reports/machine-status-trend', { params });
        if (isMounted && res.data?.success) {
          setData(res.data.data || []);
          if (res.data.summary) {
            setSummary(res.data.summary);
          }
        }
      } catch (err) {
        console.error('Failed to fetch machine status trend:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTrend();
    return () => {
      isMounted = false;
    };
  }, [plantId, selectedTimeframe]);

  // SVG dimensions
  const svgWidth = 560;
  const svgHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 36;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Maximum value for Y scale
  const maxVal = useMemo(() => {
    if (data.length === 0) return 4;
    let highest = 0;
    for (const d of data) {
      highest = Math.max(highest, d.operational, d.under_maintenance, d.breakdown, d.idle, d.total_fleet);
    }
    return Math.max(3, Math.ceil(highest * 1.25));
  }, [data]);

  // Scale functions
  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(maxVal, val));
    return paddingTop + chartHeight - (clamped / maxVal) * chartHeight;
  };

  // Build smooth cubic Bézier spline path
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

  // Build shaded area path under spline
  const buildAreaPath = (values: number[]) => {
    if (values.length === 0) return '';
    const linePath = buildSmoothPath(values);
    if (!linePath) return '';
    const lastX = getX(values.length - 1);
    const firstX = getX(0);
    const bottomY = paddingTop + chartHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Generate 4-step Y-axis tick values
  const yTicks = useMemo(() => {
    const step = Math.max(1, Math.ceil(maxVal / 4));
    const ticks = [0];
    for (let i = 1; i <= 4; i++) {
      ticks.push(step * i);
    }
    return ticks;
  }, [maxVal]);

  // Series paths
  const seriesPaths = useMemo(() => {
    const res: Record<string, { line: string; area: string }> = {};
    for (const s of SERIES_CONFIG) {
      const vals = data.map((d) => d[s.key] || 0);
      res[s.key] = {
        line: buildSmoothPath(vals),
        area: buildAreaPath(vals),
      };
    }
    return res;
  }, [data, maxVal]);

  // Toggle series visibility
  const toggleSeries = (key: string) => {
    setActiveSeries((prev) => {
      // Don't allow turning off all series
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (activeCount === 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const hasData = data.length > 0;
  const currentTotal = summary.total_machines;
  const operationalPct = currentTotal > 0 ? Math.round((summary.current_operational / currentTotal) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      {/* Header with Title and Date-Range Dropdown */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Machine Status Overview</span>
              {plantName && plantName !== 'All Plants' && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                  {plantName}
                </span>
              )}
            </h3>
          </div>

          {/* Top-Right: Date-Range Dropdown Filter */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
            <div className="relative inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:border-slate-300 transition">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 mr-1.5 shrink-0" />
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="bg-transparent appearance-none pr-5 focus:outline-none cursor-pointer font-semibold text-zinc-800 text-xs"
                aria-label="Select Date Range"
              >
                <option value="Last 7 Days">Last 7 Days</option>
                <option value="Last 30 Days">Last 30 Days</option>
                <option value="Last 90 Days">Last 90 Days</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2 pointer-events-none" />
            </div>

            {showAddMachine && (
              <Link
                to="/machines"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-xs font-semibold border border-amber-500 shadow-2xs transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Machine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Compact Legend with Clickable Toggles & Live Counts */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-zinc-600 mb-3 border-b border-slate-100 pb-3">
          {SERIES_CONFIG.map((s) => {
            const isVisible = activeSeries[s.key];
            const currentCount =
              s.key === 'operational'
                ? summary.current_operational
                : s.key === 'under_maintenance'
                ? summary.current_under_maintenance
                : s.key === 'breakdown'
                ? summary.current_breakdown
                : summary.current_idle;

            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isVisible
                    ? 'bg-slate-50 text-zinc-900 border border-slate-200 shadow-2xs'
                    : 'bg-transparent text-zinc-400 border border-transparent opacity-50 hover:opacity-80'
                }`}
                title={`Click to ${isVisible ? 'hide' : 'show'} ${s.label}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: isVisible ? s.color : '#CBD5E1' }}
                />
                <span>{s.label}</span>
                <span className="font-mono text-[11px] text-zinc-500 font-bold ml-0.5">
                  ({currentCount})
                </span>
              </button>
            );
          })}
        </div>

        {/* Chart Canvas Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[13px] text-zinc-500 font-medium">Aggregating machine status records...</span>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-center">
            <span className="text-[13px] text-zinc-500 font-normal">
              No machine assets recorded for the selected plant
            </span>
          </div>
        ) : (
          <div className="w-full relative select-none">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible"
            >
              <defs>
                {SERIES_CONFIG.map((s) => (
                  <linearGradient key={s.gradientId} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
                  </linearGradient>
                ))}
              </defs>

              {/* Horizontal Gridlines & Y-axis Labels */}
              {yTicks.map((val) => {
                const yPos = getY(val);
                return (
                  <g key={`ytick-${val}`}>
                    <line
                      x1={paddingLeft}
                      y1={yPos}
                      x2={svgWidth - paddingRight}
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

              {/* Shaded Area Fills under Visible Splines */}
              {SERIES_CONFIG.map((s) => {
                if (!activeSeries[s.key] || !seriesPaths[s.key]?.area) return null;
                return (
                  <path
                    key={`area-${s.key}`}
                    d={seriesPaths[s.key].area}
                    fill={`url(#${s.gradientId})`}
                    className="transition-opacity duration-300 pointer-events-none"
                  />
                );
              })}

              {/* Smooth Spline Lines */}
              {SERIES_CONFIG.map((s) => {
                if (!activeSeries[s.key] || !seriesPaths[s.key]?.line) return null;
                return (
                  <path
                    key={`line-${s.key}`}
                    d={seriesPaths[s.key].line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-opacity duration-300 pointer-events-none"
                  />
                );
              })}

              {/* Interactive Column Hover Bands, Points & Guidelines */}
              {data.map((item, idx) => {
                const xPos = getX(idx);
                const isHovered = hoveredIdx === idx;
                const columnBandWidth = chartWidth / Math.max(1, data.length);

                return (
                  <g key={`col-${idx}`}>
                    {/* Transparent touch/hover hit zone */}
                    <rect
                      x={xPos - columnBandWidth / 2}
                      y={paddingTop}
                      width={columnBandWidth}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    />

                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={xPos}
                        y1={paddingTop}
                        x2={xPos}
                        y2={paddingTop + chartHeight}
                        stroke="#94A3B8"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        pointerEvents="none"
                      />
                    )}

                    {/* Circular markers at each status point */}
                    {SERIES_CONFIG.map((s) => {
                      if (!activeSeries[s.key]) return null;
                      const val = item[s.key] || 0;
                      const yPos = getY(val);

                      return (
                        <circle
                          key={`pt-${s.key}-${idx}`}
                          cx={xPos}
                          cy={yPos}
                          r={isHovered ? 5.5 : 3.5}
                          fill={s.color}
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          className="transition-all duration-150 pointer-events-none"
                          style={{
                            filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                          }}
                        />
                      );
                    })}

                    {/* X-Axis Date Label */}
                    <text
                      x={xPos}
                      y={svgHeight - 12}
                      textAnchor="middle"
                      className={`text-[11px] font-medium transition-colors pointer-events-none ${
                        isHovered ? 'fill-zinc-950 font-bold' : 'fill-zinc-500'
                      }`}
                    >
                      {item.date_label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card */}
            {hoveredIdx !== null && data[hoveredIdx] && (
              <div
                className="absolute top-2 bg-zinc-950/95 text-white rounded-xl px-3.5 py-2.5 text-xs shadow-xl pointer-events-none border border-zinc-800 backdrop-blur z-20 transition-all duration-150"
                style={{
                  left: `${Math.min(84, Math.max(16, (getX(hoveredIdx) / svgWidth) * 100))}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-1.5 mb-2">
                  <span className="font-bold text-zinc-100">{data[hoveredIdx].date_label}</span>
                  <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                    Total: {data[hoveredIdx].total_fleet}
                  </span>
                </div>

                <div className="space-y-1.5 min-w-[150px]">
                  {SERIES_CONFIG.map((s) => {
                    const count = data[hoveredIdx][s.key] || 0;
                    return (
                      <div key={s.key} className="flex items-center justify-between gap-3 text-zinc-200">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span>{s.label}:</span>
                        </span>
                        <span className="font-mono font-bold text-[12px]">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Metrics */}
      <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 font-normal">
            Total Factory Fleet:{' '}
            <strong className="text-zinc-900 font-mono font-semibold">
              {currentTotal} Machines
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {summary.current_breakdown > 0 && (
            <span className="text-rose-700 font-semibold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {summary.current_breakdown} Breakdown
            </span>
          )}
          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            {operationalPct}% Operational
          </span>
        </div>
      </div>
    </div>
  );
};
