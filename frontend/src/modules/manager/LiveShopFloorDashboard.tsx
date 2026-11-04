import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { 
  Activity, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  PackageX, 
  ArrowUpRight, 
  RefreshCw 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const LiveShopFloorDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpiRes, machinesRes] = await Promise.all([
        apiClient.get('/reports/dashboard-kpis'),
        apiClient.get('/machines?limit=12'),
      ]);
      setStats(kpiRes.data.data);
      setMachines(machinesRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">LIVE SHOPFLOOR MONITOR</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time telemetry and machine availability state</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Live Status
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Availability */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Machine Availability</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-600">
              {stats?.machineAvailabilityPercent ?? '92.5'}%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">OEE Availability Target: 90%</div>
        </div>

        {/* Active Breakdowns */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Active Breakdowns</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-red-600">
              {stats?.breakdownCount ?? 1}
            </span>
            <span className="text-xs text-slate-500 ml-2">Stoppages</span>
          </div>
          <div className="text-[11px] text-red-500 mt-1 font-semibold">Immediate triage required</div>
        </div>

        {/* MTTR */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Avg MTTR (Wrench Time)</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-600">
              {stats?.avgMTTRMinutes ?? 45}
            </span>
            <span className="text-xs text-slate-500 ml-1">mins</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Mean Time to Repair</div>
        </div>

        {/* Operational Assets */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Operational Assets</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-800">
              {stats?.operationalCount ?? 4}/{stats?.totalMachines ?? 5}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Running in Shift A</div>
        </div>

        {/* Stock Shortages */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>160k Critical Stock Alert</span>
            <PackageX className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-amber-600">
              {stats?.lowStockItemsCount ?? 0}
            </span>
            <span className="text-xs text-slate-500 ml-1">SKUs low</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Below minimum threshold</div>
        </div>
      </div>

      {/* Bird's-Eye Live Machine Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Plant 1 Shopfloor Machine Grid</h3>
            <p className="text-xs text-slate-500">Color-coded status across CNC, Robotics & Press lines</p>
          </div>
          <Link
            to="/machines"
            className="text-xs font-bold text-jcb-charcoal hover:text-amber-600 flex items-center gap-1"
          >
            View All 1,000+ Assets <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {machines.map((m) => {
            const isDown = m.status === 'breakdown';
            const isMaint = m.status === 'under_maintenance';
            const isRunning = m.status === 'operational';

            return (
              <div
                key={m.id}
                className={`p-4 rounded-lg border-2 transition-all relative ${
                  isDown
                    ? 'border-red-500 bg-red-50/40 shadow-sm animate-pulse'
                    : isMaint
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-emerald-400 bg-emerald-50/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm text-slate-900 tracking-wide">{m.machine_code}</span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                      isDown
                        ? 'bg-red-600 text-white'
                        : isMaint
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {m.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs font-bold text-slate-700 truncate">{m.name}</p>
                <p className="text-[11px] text-slate-500 mt-1">{m.bay_line_location || 'Bay 1 / Line 4'}</p>
                
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Criticality:</span>
                  <span className="font-bold uppercase text-slate-800">{m.criticality}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

