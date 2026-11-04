import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { 
  Activity, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  PackageX, 
  ArrowUpRight, 
  RefreshCw,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Play
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
    <div className="space-y-6 bg-white min-h-full">
      {/* Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">LIVE SHOPFLOOR & ASSET TELEMETRY</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Operational Command
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Real-time machine health, breakdown status, maintenance response tracking, and line availability.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-zinc-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-zinc-50 transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Status</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Availability */}
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
            <span>Machine Availability</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-700">
              {stats?.machineAvailabilityPercent ?? '92.5'}%
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">OEE Target: 90.0%</div>
        </div>

        {/* Breakdown Count */}
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
            <span>Active Breakdowns</span>
            <AlertOctagon className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-red-700">
              {stats?.breakdownMachinesCount ?? 1}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-semibold">assets</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Immediate triage required</div>
        </div>

        {/* Open Work Orders */}
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
            <span>Open Work Orders</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-800">
              {stats?.openWorkOrdersCount ?? 2}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-semibold">jobs</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Assigned to technicians</div>
        </div>

        {/* Pending PM */}
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
            <span>PM Compliance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-zinc-950">
              {stats?.pmComplianceRate ?? '96.2'}%
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Monthly schedules completed</div>
        </div>

        {/* Low Stock Parts */}
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-600 text-xs font-black uppercase tracking-wider">
            <span>Zero / Low Stock</span>
            <PackageX className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-amber-700">
              {stats?.criticalLowStockCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-semibold">SKUs</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">PR auto-generation active</div>
        </div>
      </div>

      {/* Machine Status Grid */}
      <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              Plant Floor Assets Live Grid
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Real-time operational status across Ballabgarh machining bays</p>
          </div>
          <Link
            to="/machines"
            className="text-xs font-black text-amber-800 hover:text-black flex items-center gap-1 uppercase tracking-wider"
          >
            <span>View All 1,000+ Assets</span>
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {machines.map((m) => {
            const isDown = m.status === 'breakdown';
            const isMaint = m.status === 'under_maintenance';

            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border-2 transition relative ${
                  isDown
                    ? 'border-red-300 bg-red-50/20'
                    : isMaint
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-zinc-200 bg-white hover:border-zinc-400'
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

                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
                  <span>{m.bay_line_location || 'Bay 1'}</span>
                  <span className="font-black text-zinc-900 uppercase">{m.criticality?.replace('_', ' ') || 'CLASS B'}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className={isDown ? 'text-red-700' : isMaint ? 'text-amber-700' : 'text-emerald-700'}>
                    {m.status || 'running'}
                  </span>
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
