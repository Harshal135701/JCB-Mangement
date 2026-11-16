import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Cpu,
  BarChart2,
  HelpCircle,
  Building,
} from 'lucide-react';
import { PMComplianceData, PMTrendItem } from '../types';

interface PMAnalyticsViewProps {
  complianceData: PMComplianceData | null;
  trends: PMTrendItem[];
  machineStats: any[];
  loading?: boolean;
}

export const PMAnalyticsView: React.FC<PMAnalyticsViewProps> = ({
  complianceData,
  trends,
  machineStats,
  loading = false,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Compliance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Compliance */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Overall PM Compliance
            </span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-zinc-900 tracking-tight">
            {complianceData?.overall_compliance_percentage ?? 100}%
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Calculated as: Completed PMs ÷ (Completed + Overdue) × 100
          </p>
          <div className="w-full bg-zinc-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${complianceData?.overall_compliance_percentage ?? 100}%` }}
            />
          </div>
        </div>

        {/* On-Time Completion */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              On-Time Completion Rate
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-black text-zinc-900 tracking-tight">
            {complianceData?.on_time_completion_percentage ?? 95}%
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Completed on or before scheduled date + grace buffer.
          </p>
          <div className="w-full bg-zinc-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${complianceData?.on_time_completion_percentage ?? 95}%` }}
            />
          </div>
        </div>

        {/* Overdue Stoppages Risk */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Overdue Risk Count
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-700 tracking-tight">
            {complianceData?.overdue_count ?? 0}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {complianceData?.due_count ?? 0} additional tasks due currently.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
              {complianceData?.completed_count ?? 0} Completed
            </span>
            <span className="px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-900">
              {complianceData?.due_count ?? 0} Due
            </span>
          </div>
        </div>
      </div>

      {/* 6-Month PM Compliance Trends */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-zinc-900">
              6-Month Preventive Maintenance Compliance Trend
            </h3>
          </div>
          <span className="text-xs text-zinc-400">Monthly Historic Execution Data</span>
        </div>

        {trends.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            No historical PM trend data recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {trends.map((t) => (
              <div
                key={t.month}
                className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center flex flex-col justify-between"
              >
                <span className="font-mono text-xs font-bold text-zinc-600">{t.month}</span>
                <div className="my-2">
                  <div className="text-xl font-black text-zinc-900">{t.compliance_rate}%</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {t.completed} of {t.scheduled_generated} tasks
                  </div>
                </div>
                <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${
                      t.compliance_rate >= 90 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, t.compliance_rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Machine Breakdown Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-zinc-900">
              Machine Asset PM Health & Compliance Register
            </h3>
          </div>
          <span className="text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full font-bold">
            {machineStats.length} Machines
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Machine Code</th>
                <th className="px-4 py-3">Machine Name</th>
                <th className="px-4 py-3">Shop / Location</th>
                <th className="px-4 py-3">Criticality</th>
                <th className="px-4 py-3">Active Plans</th>
                <th className="px-4 py-3">Overdue Count</th>
                <th className="px-4 py-3">Next Scheduled Date</th>
                <th className="px-4 py-3">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {machineStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs text-zinc-400">
                    No machine assets registered.
                  </td>
                </tr>
              ) : (
                machineStats.map((m) => (
                  <tr key={m.machine_id} className="hover:bg-zinc-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">
                      {m.machine_code}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900">{m.machine_name}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {m.shop_name} ({m.plant_name})
                    </td>
                    <td className="px-4 py-3 font-bold uppercase text-zinc-700">
                      {m.criticality}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900">
                      {m.active_plans_count}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-700">
                      {m.overdue_plans_count}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {m.next_scheduled_pm
                        ? new Date(m.next_scheduled_pm).toLocaleDateString()
                        : 'No active date'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          m.overdue_plans_count > 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {m.compliance_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
