import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import {
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  CheckCircle2,
  BarChart2,
  Activity,
  Wrench,
  ShieldAlert,
  Layers,
  Cpu,
  Building2,
  Filter,
  Search,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sliders,
  HelpCircle,
  Info,
  FileText,
  Zap,
} from 'lucide-react';

interface DowntimeSummary {
  total_downtime_minutes: number;
  total_breakdown_incidents: number;
  mttr_active_wrench_minutes: number;
  avg_response_delay_minutes: number;
  longest_stoppage_minutes: number;
  active_stoppages_count: number;
}

interface ParetoMachine {
  id: string;
  machine_code: string;
  name: string;
  shop_name: string;
  plant_name?: string;
  criticality: string;
  failure_count: number;
  total_downtime_minutes: number;
}

interface CategoryDist {
  category: string;
  count: number;
  total_downtime_minutes: number;
  percentage?: number;
}

interface ActiveStoppage {
  machine_id: string;
  machine_code: string;
  machine_name: string;
  machine_status: string;
  criticality: string;
  location?: string;
  shop: { id: string; name: string };
  plant: { id: string; name: string };
  active_work_order?: {
    id: string;
    wo_number: string;
    status: string;
    priority: string;
    sla_deadline?: string;
    assigned_technician?: string;
  };
  incident: {
    complaint_number: string;
    category: string;
    title: string;
  };
  breakdown_start_time: string;
  elapsed_downtime_minutes: number;
  last_update?: string;
}

interface StoppageRecord {
  work_order_id: string;
  wo_number: string;
  work_order_status: string;
  priority: string;
  classification: string;
  is_major_breakdown: boolean;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  machine_criticality: string;
  shop_name: string;
  plant_name: string;
  complaint_id?: string;
  complaint_number?: string;
  issue_category: string;
  problem_title: string;
  breakdown_time: string;
  reported_time?: string;
  manager_ack_time?: string;
  technician_ack_time?: string;
  repair_start_time?: string;
  repair_end_time?: string;
  production_restart_time?: string;
  total_stoppage_duration_minutes: number;
  active_wrench_duration_minutes?: number;
  response_delay_minutes?: number;
  assigned_technician_name?: string;
  resolution_notes?: string;
}

interface AvailabilityRecord {
  machine_id: string;
  machine_code: string;
  machine_name: string;
  plant_name: string;
  shop_name: string;
  criticality: string;
  failure_count: number;
  total_downtime_minutes: number;
  meter_operating_hours: number;
  calculated_availability_percent: number | null;
  notes?: string;
}

interface MtbfRecord {
  id: string;
  machine_code: string;
  name: string;
  failure_count: number;
  operating_hours: number;
  mtbf_operating_hours: number | null;
  data_quality_note?: string;
}

type ActiveTab = 'overview' | 'incidents' | 'assets';

export const DowntimeAnalyticsPage: React.FC = () => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [timeframe, setTimeframe] = useState<string>('30d');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [summary, setSummary] = useState<DowntimeSummary | null>(null);
  const [paretoMachines, setParetoMachines] = useState<ParetoMachine[]>([]);
  const [categories, setCategories] = useState<CategoryDist[]>([]);
  const [activeStoppages, setActiveStoppages] = useState<ActiveStoppage[]>([]);
  const [plannedVsUnplanned, setPlannedVsUnplanned] = useState<any>(null);

  // Incidents Log Tab States
  const [records, setRecords] = useState<StoppageRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState<number>(0);
  const [recordsPage, setRecordsPage] = useState<number>(1);
  const [recordsLimit] = useState<number>(10);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Asset Availability & MTBF Tab States
  const [availabilityList, setAvailabilityList] = useState<AvailabilityRecord[]>([]);
  const [mtbfList, setMtbfList] = useState<MtbfRecord[]>([]);
  const [assetsLoading, setAssetsLoading] = useState<boolean>(false);

  // Detail Modal State
  const [selectedIncident, setSelectedIncident] = useState<StoppageRecord | null>(null);

  // Primary Fetch: Overview & Active Stoppages
  const fetchOverviewData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [mainRes, currentRes, catRes, pvuRes] = await Promise.all([
        apiClient.get('/downtime', { params: { timeframe } }),
        apiClient.get('/downtime/current'),
        apiClient.get('/downtime/by-category'),
        apiClient.get('/downtime/planned-vs-unplanned'),
      ]);

      if (mainRes.data?.success) {
        setSummary(mainRes.data.data.summary);
        setParetoMachines(mainRes.data.data.paretoTopMachines || []);
      }

      if (currentRes.data?.success) {
        setActiveStoppages(currentRes.data.data || []);
      }

      if (catRes.data?.success) {
        setCategories(catRes.data.data || []);
      }

      if (pvuRes.data?.success) {
        setPlannedVsUnplanned(pvuRes.data.data || null);
      }
    } catch (err: any) {
      console.error('Failed to load downtime analytics overview:', err);
      setError(
        err.response?.data?.message ||
          'Failed to retrieve telemetry and reliability metrics from the server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe]);

  // Fetch Incident Records
  const fetchIncidentRecords = useCallback(async () => {
    try {
      setRecordsLoading(true);
      const params: any = {
        page: recordsPage,
        limit: recordsLimit,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filterCategory !== 'ALL') params.category = filterCategory.toLowerCase();
      if (filterPriority !== 'ALL') params.priority = filterPriority.toLowerCase();

      const res = await apiClient.get('/downtime/records', { params });
      if (res.data?.success) {
        const d = res.data.data;
        if (Array.isArray(d)) {
          setRecords(d);
          setRecordsTotal(d.length);
        } else if (d?.records) {
          setRecords(d.records);
          setRecordsTotal(d.total || d.pagination?.total || d.records.length);
        }
      }
    } catch (err: any) {
      console.error('Failed to load downtime stoppage records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [recordsPage, recordsLimit, searchQuery, filterCategory, filterPriority]);

  // Fetch Asset Availability & MTBF
  const fetchAssetReliability = useCallback(async () => {
    try {
      setAssetsLoading(true);
      const [availRes, mtbfRes] = await Promise.all([
        apiClient.get('/downtime/availability'),
        apiClient.get('/downtime/mtbf'),
      ]);

      if (availRes.data?.success) {
        const records = availRes.data.data?.records || availRes.data.data || [];
        setAvailabilityList(Array.isArray(records) ? records : []);
      }

      if (mtbfRes.data?.success) {
        const records = mtbfRes.data.data?.records || mtbfRes.data.data || [];
        setMtbfList(Array.isArray(records) ? records : []);
      }
    } catch (err: any) {
      console.error('Failed to load machine reliability metrics:', err);
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  // Initial Load & Timeframe Change
  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  // Tab change trigger
  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidentRecords();
    } else if (activeTab === 'assets') {
      fetchAssetReliability();
    }
  }, [activeTab, fetchIncidentRecords, fetchAssetReliability]);

  // Total downtime formatted
  const formatMinutes = (minutes: number | null | undefined): string => {
    if (!minutes || isNaN(Number(minutes))) return '0m';
    const m = Math.round(Number(minutes));
    if (m < 60) return `${m}m`;
    const hrs = Math.floor(m / 60);
    const remM = m % 60;
    return `${hrs}h ${remM}m`;
  };

  // Max Pareto downtime for visual bars
  const maxParetoDowntime = useMemo(() => {
    if (!paretoMachines.length) return 1;
    return Math.max(...paretoMachines.map((m) => Number(m.total_downtime_minutes) || 1));
  }, [paretoMachines]);

  // Max category downtime for bars
  const totalCatMinutes = useMemo(() => {
    if (!categories.length) return 1;
    return categories.reduce((acc, c) => acc + (Number(c.total_downtime_minutes) || 0), 0) || 1;
  }, [categories]);

  return (
    <div className="space-y-6 bg-slate-50 min-h-full pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              Downtime, MTTR & Pareto Analytics
            </h1>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Reliability Engineering
            </span>
            {activeStoppages.length > 0 ? (
              <span className="flex items-center gap-1.5 bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-red-300 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                {activeStoppages.length} Active Breakdown{activeStoppages.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                All Lines Nominal
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Plant-wide machine stoppage analysis, Mean Time To Repair (MTTR), maintenance response delay, and 80/20 Pareto distribution.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold">
            {(['7d', '30d', '90d', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg transition uppercase text-[11px] ${
                  timeframe === t
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {t === 'all' ? 'All History' : `Last ${t}`}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchOverviewData(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Refresh Real-Time Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <span className="font-bold">Telemetry Connection Error:</span> {error}
          </div>
        </div>
      )}

      {/* Active Stoppages Live Alert Banner */}
      {activeStoppages.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl shadow-lg p-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <AlertOctagon className="w-6 h-6 text-white animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-wide uppercase">
                  Active Machine Stoppage Alert ({activeStoppages.length} Ongoing Line Breakdown{activeStoppages.length > 1 ? 's' : ''})
                </h3>
                <p className="text-xs text-red-100 font-medium">
                  Immediate engineering attention required. Production is currently halted on the following assets.
                </p>
              </div>
            </div>
            <div className="text-xs font-bold bg-white text-red-700 px-3 py-1.5 rounded-xl uppercase tracking-wider self-start sm:self-auto shadow">
              Live Priority Queue
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeStoppages.map((stoppage) => (
              <div
                key={stoppage.machine_id}
                className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-black text-sm text-yellow-300 font-mono">
                      {stoppage.machine_code}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-red-900/80 text-white uppercase border border-red-400">
                      {stoppage.criticality?.replace(/_/g, ' ') || 'Class A'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white line-clamp-1">{stoppage.machine_name}</div>
                  <div className="text-[11px] text-red-200 mt-0.5 flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span>{stoppage.shop?.name || 'Shop Floor'}</span>
                  </div>
                  <div className="text-[11px] text-white/90 font-medium mt-2 bg-black/20 p-2 rounded-lg">
                    <span className="font-bold text-yellow-200 uppercase text-[10px] block">
                      Incident: {stoppage.incident?.complaint_number || 'CMP'}
                    </span>
                    <span className="line-clamp-2">{stoppage.incident?.title || 'Unspecified stoppage'}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-red-200 block">Elapsed Downtime:</span>
                    <span className="font-mono font-black text-white text-sm">
                      {formatMinutes(stoppage.elapsed_downtime_minutes)}
                    </span>
                  </div>
                  {stoppage.active_work_order?.assigned_technician && (
                    <div className="text-right">
                      <span className="text-[10px] text-red-200 block">Assigned Tech:</span>
                      <span className="font-bold text-white text-[11px]">
                        {stoppage.active_work_order.assigned_technician}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6 Core Reliability KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Total Downtime */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Total Downtime
              </span>
              <Clock className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-black text-red-600 mt-2">
              {formatMinutes(summary?.total_downtime_minutes)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            {summary?.total_downtime_minutes || 0} minutes across all lines
          </div>
        </div>

        {/* Breakdown Incidents */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Stoppage Events
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-zinc-950 mt-2">
              {summary?.total_breakdown_incidents ?? 0}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            Verified line stoppage orders
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                MTTR (Active Wrench)
              </span>
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-700 mt-2">
              {formatMinutes(summary?.mttr_active_wrench_minutes)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            Mean repair execution duration
          </div>
        </div>

        {/* Avg Response Delay */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Response Delay
              </span>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2">
              {formatMinutes(summary?.avg_response_delay_minutes)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            Complaint to technician arrival
          </div>
        </div>

        {/* Longest Stoppage */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Longest Stoppage
              </span>
              <TrendingDown className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-700 mt-2">
              {formatMinutes(summary?.longest_stoppage_minutes)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            Worst single line interruption
          </div>
        </div>

        {/* Active Outages */}
        <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Active Outages
              </span>
              <Zap className="w-4 h-4 text-red-500" />
            </div>
            <div className={`text-2xl font-black mt-2 ${activeStoppages.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {activeStoppages.length}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-2 pt-2 border-t border-zinc-100">
            Currently halted machinery
          </div>
        </div>
      </div>

      {/* Tab Navigation Navigation Controls */}
      <div className="flex items-center gap-2 border-b-2 border-zinc-200 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'overview'
              ? 'bg-zinc-950 text-white shadow'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-jcb-yellow" />
          <span>Pareto & Root Cause Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('incidents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'incidents'
              ? 'bg-zinc-950 text-white shadow'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          <FileText className="w-4 h-4 text-jcb-yellow" />
          <span>Stoppage Incidents Log ({recordsTotal || summary?.total_breakdown_incidents || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'assets'
              ? 'bg-zinc-950 text-white shadow'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          <Cpu className="w-4 h-4 text-jcb-yellow" />
          <span>Asset Availability & MTBF Matrix</span>
        </button>
      </div>

      {/* TAB 1: PARETO & ROOT CAUSE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pareto 80/20 Top Bottleneck Machines (2 Columns) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      Pareto 80/20 Analysis – Top Bottleneck Machines
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      Machines responsible for the highest proportion of cumulative lost production hours
                    </p>
                  </div>
                  <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-300">
                    High Impact Assets
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Machine Asset</th>
                        <th className="px-6 py-3.5">Production Shop</th>
                        <th className="px-6 py-3.5">Criticality</th>
                        <th className="px-6 py-3.5">Failures</th>
                        <th className="px-6 py-3.5">Lost Production Time</th>
                        <th className="px-6 py-3.5 w-32">Impact Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paretoMachines.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-zinc-500 font-medium">
                            No machine stoppages recorded for the selected timeframe.
                          </td>
                        </tr>
                      ) : (
                        paretoMachines.map((m, idx) => {
                          const pct = Math.min(
                            100,
                            Math.round((Number(m.total_downtime_minutes) / maxParetoDowntime) * 100)
                          );
                          return (
                            <tr key={m.id || idx} className="hover:bg-zinc-50/80 transition">
                              <td className="px-6 py-3.5">
                                <span className="font-black text-sm text-zinc-950 font-mono">
                                  {m.machine_code}
                                </span>
                                <span className="block text-[11px] text-zinc-500 font-medium line-clamp-1">
                                  {m.name}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 font-bold text-zinc-800">{m.shop_name}</td>
                              <td className="px-6 py-3.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                                  {m.criticality?.replace(/_/g, ' ') || 'Class A'}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                                {m.failure_count} {m.failure_count === 1 ? 'breakdown' : 'breakdowns'}
                              </td>
                              <td className="px-6 py-3.5 font-black text-sm text-red-600">
                                {formatMinutes(m.total_downtime_minutes)}
                              </td>
                              <td className="px-6 py-3.5">
                                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-red-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-400 font-mono block text-right mt-0.5">
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 border-t border-zinc-200 text-xs text-zinc-500 font-medium flex items-center justify-between">
                <span>Total Bottlenecks Tracked: {paretoMachines.length}</span>
                <span className="text-zinc-400 text-[11px]">Formula: Top 10 Descending Downtime Minutes</span>
              </div>
            </div>

            {/* Failure Category Distribution (1 Column) */}
            <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-600" />
                      Failure Category Distribution
                    </h3>
                    <p className="text-xs text-zinc-500 font-medium">Breakdown reasons by engineering domain</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {categories.length === 0 ? (
                    <div className="text-center py-8 text-zinc-400 text-xs font-medium">
                      No categorization records available
                    </div>
                  ) : (
                    categories.map((c, idx) => {
                      const sharePct = Math.min(
                        100,
                        Math.round((Number(c.total_downtime_minutes) / totalCatMinutes) * 100)
                      );
                      const catName = (c.category || 'Unspecified').toUpperCase();
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-zinc-800 flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                              {catName}
                            </span>
                            <div className="text-right">
                              <span className="text-zinc-950 font-black">{formatMinutes(c.total_downtime_minutes)}</span>
                              <span className="text-zinc-400 text-[11px] ml-1.5 font-normal">
                                ({c.count} {c.count === 1 ? 'incident' : 'incidents'})
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-jcb-yellow h-full rounded-full transition-all duration-500"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                            <span>Contribution: {sharePct}% of total downtime</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Planned vs Unplanned Ratio Footer */}
              {plannedVsUnplanned && (
                <div className="p-4 bg-zinc-50 border-t border-zinc-200">
                  <div className="text-[11px] font-black uppercase text-zinc-600 tracking-wider mb-2 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                    Planned PM vs Unplanned Breakdown Ratio
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black text-emerald-800 uppercase block">Planned Maintenance</span>
                      <span className="text-base font-black text-emerald-700">
                        {plannedVsUnplanned.planned?.count ?? plannedVsUnplanned.planned_count ?? 0} Orders
                      </span>
                    </div>
                    <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl">
                      <span className="text-[10px] font-black text-red-800 uppercase block">Emergency Outages</span>
                      <span className="text-base font-black text-red-700">
                        {plannedVsUnplanned.unplanned?.count ?? plannedVsUnplanned.unplanned_count ?? summary?.total_breakdown_incidents ?? 0} Orders
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOPPAGE INCIDENTS LOG */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden space-y-4">
          {/* Filter Bar */}
          <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by WO#, Complaint#, Machine, Problem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchIncidentRecords()}
                  className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-jcb-yellow"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-jcb-yellow"
              >
                <option value="ALL">All Categories</option>
                <option value="HYDRAULIC">Hydraulic</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="MECHANICAL">Mechanical</option>
                <option value="PNEUMATIC">Pneumatic</option>
                <option value="ELECTRONIC">Electronic</option>
              </select>

              {/* Priority Filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-jcb-yellow"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <button
              onClick={() => fetchIncidentRecords()}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition shadow"
            >
              Apply Filter
            </button>
          </div>

          {/* Incidents Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Work Order / Complaint</th>
                  <th className="px-6 py-3.5">Machine Asset</th>
                  <th className="px-6 py-3.5">Category & Issue</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Stoppage Duration</th>
                  <th className="px-6 py-3.5">Wrench Time</th>
                  <th className="px-6 py-3.5">Technician</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recordsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-bold">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                      Loading stoppage incidents from database...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-medium">
                      No stoppage incident records found matching query.
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.work_order_id} className="hover:bg-zinc-50 transition">
                      <td className="px-6 py-3.5">
                        <span className="font-mono font-black text-sm text-zinc-950 block">
                          {rec.wo_number}
                        </span>
                        {rec.complaint_number && (
                          <span className="text-[11px] text-zinc-500 font-mono">
                            Ref: {rec.complaint_number}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-black text-xs text-zinc-900 font-mono block">
                          {rec.machine_code}
                        </span>
                        <span className="text-[11px] text-zinc-500 line-clamp-1">{rec.machine_name}</span>
                        <span className="text-[10px] text-zinc-400 block">{rec.shop_name}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-amber-200">
                          {rec.issue_category || 'Mechanical'}
                        </span>
                        <span className="block text-xs font-bold text-zinc-800 mt-1 line-clamp-1">
                          {rec.problem_title}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                            rec.priority === 'critical'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : rec.priority === 'high'
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-zinc-100 text-zinc-800 border-zinc-200'
                          }`}
                        >
                          {rec.priority}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-black text-sm text-red-600">
                        {formatMinutes(rec.total_stoppage_duration_minutes)}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-xs text-blue-700">
                        {formatMinutes(rec.active_wrench_duration_minutes)}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-zinc-700">
                        {rec.assigned_technician_name || 'Unassigned'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedIncident(rec)}
                          className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-xs font-bold transition"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium">
              Showing page {recordsPage} (Total {recordsTotal} stoppage records)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                disabled={recordsPage <= 1 || recordsLoading}
                className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setRecordsPage((p) => p + 1)}
                disabled={records.length < recordsLimit || recordsLoading}
                className="px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ASSET AVAILABILITY & MTBF MATRIX */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  Asset Operating Hours, Stoppages & Lifetime MTBF
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Reliability matrix mapping machine run meters, cumulative failures, and Mean Time Between Failures
                </p>
              </div>
              <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-blue-300">
                Asset Telemetry
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Machine Asset</th>
                    <th className="px-6 py-3.5">Plant & Shop</th>
                    <th className="px-6 py-3.5">Criticality</th>
                    <th className="px-6 py-3.5">Cumulative Failures</th>
                    <th className="px-6 py-3.5">Operating Meter</th>
                    <th className="px-6 py-3.5">Cumulative Downtime</th>
                    <th className="px-6 py-3.5">Lifetime MTBF</th>
                    <th className="px-6 py-3.5">Reliability Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {assetsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 font-bold">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                        Calculating machine availability and MTBF matrix...
                      </td>
                    </tr>
                  ) : availabilityList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-zinc-500 font-medium">
                        No machine asset records available.
                      </td>
                    </tr>
                  ) : (
                    availabilityList.map((m) => {
                      const matchedMtbf = mtbfList.find((x) => x.id === m.machine_id);
                      const mtbfValue = matchedMtbf?.mtbf_operating_hours;
                      return (
                        <tr key={m.machine_id} className="hover:bg-zinc-50 transition">
                          <td className="px-6 py-3.5">
                            <span className="font-mono font-black text-sm text-zinc-950 block">
                              {m.machine_code}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-medium line-clamp-1">
                              {m.machine_name}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="font-bold text-zinc-800 block">{m.shop_name}</span>
                            <span className="text-[10px] text-zinc-400">{m.plant_name}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                              {m.criticality?.replace(/_/g, ' ') || 'Class B'}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                            {m.failure_count} {m.failure_count === 1 ? 'failure' : 'failures'}
                          </td>
                          <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                            {m.meter_operating_hours} hrs
                          </td>
                          <td className="px-6 py-3.5 font-mono font-black text-red-600">
                            {formatMinutes(m.total_downtime_minutes)}
                          </td>
                          <td className="px-6 py-3.5 font-mono font-black text-blue-700">
                            {mtbfValue ? `${mtbfValue} hrs` : 'N/A (0 failures)'}
                          </td>
                          <td className="px-6 py-3.5">
                            {m.failure_count > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                Active Service
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Zero Breakdown
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500 font-medium">
              <span>Total Plant Assets Tracked: {availabilityList.length}</span>
              <span className="text-zinc-400 text-[11px]">MTBF Formula: Lifetime Operating Hours ÷ Failures</span>
            </div>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-zinc-950 p-5 flex items-center justify-between text-white border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="bg-jcb-yellow text-black font-black text-sm px-2.5 py-1 rounded uppercase tracking-wide">
                  {selectedIncident.wo_number}
                </span>
                <div>
                  <h3 className="text-base font-black tracking-wide uppercase">
                    Stoppage Incident Breakdown Details
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Asset: {selectedIncident.machine_code} ({selectedIncident.machine_name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Problem Title & Category */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Reported Problem
                  </span>
                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-amber-300">
                    {selectedIncident.issue_category}
                  </span>
                </div>
                <div className="text-sm font-black text-zinc-950">{selectedIncident.problem_title}</div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-red-800 uppercase block">Total Stoppage</span>
                  <span className="text-lg font-black text-red-700">
                    {formatMinutes(selectedIncident.total_stoppage_duration_minutes)}
                  </span>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-blue-800 uppercase block">Active Wrench Time</span>
                  <span className="text-lg font-black text-blue-700">
                    {formatMinutes(selectedIncident.active_wrench_duration_minutes)}
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                  <span className="text-[10px] font-black text-amber-800 uppercase block">Response Delay</span>
                  <span className="text-lg font-black text-amber-700">
                    {formatMinutes(selectedIncident.response_delay_minutes)}
                  </span>
                </div>
              </div>

              {/* Incident Timeline */}
              <div className="space-y-3">
                <div className="text-xs font-black uppercase text-zinc-800 tracking-wider">
                  Chronological Incident Telemetry Timeline
                </div>
                <div className="space-y-2 border-l-2 border-zinc-200 pl-4 ml-2">
                  <div className="relative">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 absolute -left-[21px] top-1" />
                    <span className="text-[11px] font-black text-zinc-900 block">Line Stoppage Triggered</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {selectedIncident.breakdown_time ? new Date(selectedIncident.breakdown_time).toLocaleString() : 'N/A'}
                    </span>
                  </div>

                  {selectedIncident.reported_time && (
                    <div className="relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 absolute -left-[21px] top-1" />
                      <span className="text-[11px] font-black text-zinc-900 block">Operator Complaint Logged</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(selectedIncident.reported_time).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {selectedIncident.manager_ack_time && (
                    <div className="relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[21px] top-1" />
                      <span className="text-[11px] font-black text-zinc-900 block">Manager Triage & Assignment</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(selectedIncident.manager_ack_time).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {selectedIncident.repair_start_time && (
                    <div className="relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 absolute -left-[21px] top-1" />
                      <span className="text-[11px] font-black text-zinc-900 block">Technician Wrench Work Commenced</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(selectedIncident.repair_start_time).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {selectedIncident.repair_end_time && (
                    <div className="relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-[21px] top-1" />
                      <span className="text-[11px] font-black text-zinc-900 block">Repair Completed & Ready for Trial</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(selectedIncident.repair_end_time).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {selectedIncident.production_restart_time && (
                    <div className="relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-700 absolute -left-[21px] top-1" />
                      <span className="text-[11px] font-black text-zinc-900 block">Production Line Restart Confirmed</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(selectedIncident.production_restart_time).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Technician Remarks */}
              {selectedIncident.resolution_notes && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block mb-1">
                    Technician Resolution Notes
                  </span>
                  <p className="text-zinc-800 font-medium whitespace-pre-wrap">
                    {selectedIncident.resolution_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
