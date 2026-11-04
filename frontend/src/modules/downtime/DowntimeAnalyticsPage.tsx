import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Clock, TrendingDown, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const DowntimeAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/downtime');
        if (res.data.success) {
          setAnalytics(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load downtime analytics:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">DOWNTIME, MTTR & PARETO ANALYTICS</h2>
        <p className="text-xs text-slate-500 mt-0.5">High-resolution breakdown analysis, mean repair durations, and bottleneck identification</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">Total Machine Downtime</div>
          <div className="text-3xl font-black text-red-600 mt-2">
            {analytics?.summary?.total_downtime_minutes || 0} <span className="text-xs text-slate-500 font-semibold">minutes</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Stoppage to restoration</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">MTTR (Active Wrench Time)</div>
          <div className="text-3xl font-black text-blue-600 mt-2">
            {Math.round(parseFloat(analytics?.summary?.mttr_active_wrench_minutes || 0))} <span className="text-xs text-slate-500 font-semibold">minutes</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Mean Time to Repair</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">Avg Maintenance Response Delay</div>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {Math.round(parseFloat(analytics?.summary?.avg_response_delay_minutes || 0))} <span className="text-xs text-slate-500 font-semibold">minutes</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Reported to tech arrival on-site</div>
        </div>
      </div>

      {/* Top 10 Pareto Machines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
            Pareto 80/20 Analysis – Top Downtime Contributors
          </h3>
          <p className="text-xs text-slate-500">Machines accounting for majority of manufacturing line stoppages</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Machine Asset</th>
                <th className="px-6 py-3.5">Production Shop</th>
                <th className="px-6 py-3.5">Criticality</th>
                <th className="px-6 py-3.5">Failure Count</th>
                <th className="px-6 py-3.5 text-right">Total Lost Production (Mins)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics?.paretoTopMachines?.map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-3.5">
                    <span className="font-extrabold text-slate-900">{m.machine_code}</span>
                    <span className="block text-[11px] text-slate-400">{m.name}</span>
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-700">{m.shop_name}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                      {m.criticality}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-bold text-slate-800">{m.failure_count}</td>
                  <td className="px-6 py-3.5 text-right font-black text-sm text-red-600">
                    {m.total_downtime_minutes} mins
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

