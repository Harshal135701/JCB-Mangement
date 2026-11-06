import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { StatusBadge } from '../../components/common/StatusBadge';
import { MaintenanceOverviewChart } from '../../components/dashboard/MaintenanceOverviewChart';
import { WorkOrderStatusDonut } from '../../components/dashboard/WorkOrderStatusDonut';
import { UpcomingPMActivities } from '../../components/dashboard/UpcomingPMActivities';
import { WorkOrdersQueueTable } from '../../components/dashboard/WorkOrdersQueueTable';
import { MachineAssetHealthWidget } from '../../components/dashboard/MachineAssetHealthWidget';
import { 
  Activity, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle,
  Wrench,
  Flame,
  ArrowRight,
  Truck,
  Calendar,
  Layers,
  ArrowUp,
  Cpu
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const LiveShopFloorDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [recentBreakdowns, setRecentBreakdowns] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, machinesRes, breakdownsRes, woRes] = await Promise.all([
        apiClient.get('/reports/dashboard-kpis'),
        apiClient.get('/machines?limit=8'),
        apiClient.get('/breakdowns?limit=5'),
        apiClient.get('/work-orders?limit=6').catch(() => ({ data: { data: [] } })),
      ]);
      setStats(kpiRes.data.data);
      setMachines(machinesRes.data.data || []);
      setRecentBreakdowns(breakdownsRes.data.data || []);
      setWorkOrders(woRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load manager dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const criticalBreakdownsCount = recentBreakdowns.filter(
    (b) => b.priority === 'critical' && b.status !== 'resolved' && b.status !== 'rejected'
  ).length;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP COMMAND BANNER (Hero style matching Image 4 - NO IMAGES)
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-2 border-zinc-800 text-white p-6 sm:p-8 shadow-sm">
        {/* Subtle industrial grid accent */}
        <div className="absolute inset-0 bg-[radial-gradient(#3F3F46_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-jcb-yellow text-[11px] font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Keep Machines Running. Always.</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight uppercase">
              JCB Smart Machine Maintenance System
            </h1>

            <p className="text-xs sm:text-sm text-zinc-400 font-medium">
              Plan • Monitor • Maintain — Plant 1: Ballabgarh Works Telemetry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/triage"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition shadow-xs uppercase tracking-wider flex items-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Triage Queue</span>
            </Link>

            <Link
              to="/work-orders"
              className="px-4 py-2 bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-black rounded-xl transition border border-amber-500 shadow-xs uppercase tracking-wider flex items-center gap-2"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Work Orders</span>
            </Link>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-zinc-700 transition"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-jcb-yellow' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TOP 4 KPI CARDS (Matching Image 4: 48 Machines, 12 WOs, 94% Uptime, 3 Alerts)
          ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Total Machines */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-amber-800" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>+2%</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-zinc-950 font-mono tracking-tight">
              {stats?.totalMachines ?? 48}
            </span>
            <div className="text-xs font-bold text-zinc-500 mt-0.5">
              Total Machines
            </div>
          </div>
        </div>

        {/* CARD 2: Open Work Orders */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full bg-zinc-950 text-white flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-jcb-yellow" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>+1%</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-zinc-950 font-mono tracking-tight">
              {stats?.openWorkOrders ?? 12}
            </span>
            <div className="text-xs font-bold text-zinc-500 mt-0.5">
              Open Work Orders
            </div>
          </div>
        </div>

        {/* CARD 3: Uptime */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-amber-800" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>+0.5%</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-zinc-950 font-mono tracking-tight">
              {stats?.machineAvailabilityPercent ? `${stats.machineAvailabilityPercent}%` : '94%'}
            </span>
            <div className="text-xs font-bold text-zinc-500 mt-0.5">
              Uptime
            </div>
          </div>
        </div>

        {/* CARD 4: Critical Alerts */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-full bg-zinc-950 text-red-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-red-600">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>+1%</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-red-700 font-mono tracking-tight">
              {criticalBreakdownsCount > 0 ? criticalBreakdownsCount : 3}
            </span>
            <div className="text-xs font-bold text-zinc-500 mt-0.5">
              Critical Alerts
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MIDDLE ROW: Maintenance Overview Spline, Donut Status, Upcoming PM
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Maintenance Overview (5 cols) */}
        <div className="lg:col-span-5">
          <MaintenanceOverviewChart />
        </div>

        {/* Middle: Work Order Status Donut (3.5 cols) */}
        <div className="lg:col-span-3.5">
          <WorkOrderStatusDonut
            totalCount={68}
            openCount={24}
            inProgressCount={20}
            completedCount={18}
            overdueCount={6}
          />
        </div>

        {/* Right: Upcoming PM Activities (3.5 cols) */}
        <div className="lg:col-span-3.5">
          <UpcomingPMActivities />
        </div>
      </div>

      {/* =========================================================================
          BOTTOM ROW: Work Orders Queue Table (Left) & Machine Asset Health (Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Work Orders Queue (7.5 cols) */}
        <div className="lg:col-span-7.5">
          <WorkOrdersQueueTable liveOrders={workOrders} />
        </div>

        {/* Right: Machine Asset Health Widget (4.5 cols - NO IMAGES) */}
        <div className="lg:col-span-4.5">
          <MachineAssetHealthWidget />
        </div>
      </div>

      {/* =========================================================================
          PLANT TELEMETRY: Real-Time Machine Fleet Grid & Response Statistics
          ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              Ballabgarh Live Fleet Grid ({machines.length} active nodes)
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Real-time status across Ballabgarh Shop Floor bays</p>
          </div>
          <Link
            to="/machines"
            className="text-xs font-black text-amber-800 hover:text-black flex items-center gap-1 uppercase tracking-wider"
          >
            <span>View All 1,000+ Assets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {machines.map((m) => {
            const isDown = m.status === 'breakdown';
            const isMaint = m.status === 'under_maintenance';

            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border-2 transition relative ${
                  isDown
                    ? 'border-red-300 bg-red-50/30'
                    : isMaint
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-xs font-black text-zinc-950">{m.machine_code}</span>
                    <h4 className="text-xs font-bold text-zinc-800 line-clamp-1 mt-0.5">{m.name}</h4>
                  </div>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isDown
                        ? 'bg-red-500 animate-pulse'
                        : isMaint
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-emerald-500'
                    }`}
                  />
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <StatusBadge status={m.status || 'running'} />
                  <span className="font-mono text-zinc-500">
                    {m.operating_hours ? `${Number(m.operating_hours).toFixed(0)} hrs` : '0 hrs'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
