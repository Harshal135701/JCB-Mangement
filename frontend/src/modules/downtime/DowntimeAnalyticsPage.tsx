import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Clock, TrendingDown, AlertOctagon, CheckCircle2, TrendingUp, BarChart2 } from 'lucide-react';

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
    <div className="space-y-6 bg-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">DOWNTIME, MTTR & PARETO ANALYTICS</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Reliability Engineering
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Plant-wide machine stoppage analysis, Mean Time To Repair (MTTR), maintenance response delay, and 80/20 Pareto distribution.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-black uppercase text-zinc-500 tracking-wider">Total Machine Downtime</div>
          <div className="text-3xl font-black text-red-600 mt-2">
            {analytics?.summary?.total_downtime_minutes || 0} <span className="text-xs text-zinc-500 font-bold">Minutes</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Stoppage occurrence to full verification & restart</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-black uppercase text-zinc-500 tracking-wider">MTTR (Active Wrench Time)</div>
          <div className="text-3xl font-black text-blue-700 mt-2">
            {Math.round(parseFloat(analytics?.summary?.mttr_active_wrench_minutes || 0))} <span className="text-xs text-zinc-500 font-bold">Minutes</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Mean Time To Repair (Technician diagnosis to completion)</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-black uppercase text-zinc-500 tracking-wider">Avg Maintenance Response Delay</div>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {Math.round(parseFloat(analytics?.summary?.avg_response_delay_minutes || 0))} <span className="text-xs text-zinc-500 font-bold">Minutes</span>
          </div>
          <div className="text-[11px] text-zinc-500 font-medium mt-1">Operator complaint logged to technician arrival at machine</div>
        </div>
      </div>

      {/* Top 10 Pareto Machines Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              Pareto 80/20 Analysis – Top Bottleneck Machines
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Machines responsible for the majority of line stoppages and lost production hours</p>
          </div>
          <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-300">
            Criticality Priority
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Machine Asset</th>
                <th className="px-6 py-3.5">Production Shop</th>
                <th className="px-6 py-3.5">Criticality</th>
                <th className="px-6 py-3.5">Stoppage Count</th>
                <th className="px-6 py-3.5 text-right">Lost Production Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {analytics?.paretoTopMachines?.map((m: any) => (
                <tr key={m.id} className="hover:bg-zinc-50/70 transition">
                  <td className="px-6 py-3.5">
                    <span className="font-black text-sm text-zinc-950">{m.machine_code}</span>
                    <span className="block text-[11px] text-zinc-500 font-medium">{m.name}</span>
                  </td>
                  <td className="px-6 py-3.5 font-bold text-zinc-800">{m.shop_name}</td>
                  <td className="px-6 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                      {m.criticality}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">{m.failure_count} breakdowns</td>
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
