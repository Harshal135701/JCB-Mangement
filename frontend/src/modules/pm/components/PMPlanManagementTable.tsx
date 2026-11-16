import React, { useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Power,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Filter,
  ListChecks,
} from 'lucide-react';
import { PMPlan } from '../types';

interface PMPlanManagementTableProps {
  plans: PMPlan[];
  onEditPlan: (plan: PMPlan) => void;
  onToggleStatus: (plan: PMPlan) => void;
  onViewPlanDetail: (plan: PMPlan) => void;
  onCreateNewPlan: () => void;
  canManage: boolean;
  loading?: boolean;
}

export const PMPlanManagementTable: React.FC<PMPlanManagementTableProps> = ({
  plans,
  onEditPlan,
  onToggleStatus,
  onViewPlanDetail,
  onCreateNewPlan,
  canManage,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');

  const filteredPlans = plans.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.plan_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.machine_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.machine_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchFreq =
      frequencyFilter === 'ALL' ||
      p.frequency?.toLowerCase() === frequencyFilter.toLowerCase();

    return matchSearch && matchFreq;
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Search & Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search PM plan by code, title, or machine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Frequencies</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semiannual">Semi-Annual</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={onCreateNewPlan}
            className="px-3.5 py-2 bg-amber-500 text-black rounded-lg text-xs font-bold hover:bg-amber-400 transition flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Configure New Plan</span>
          </button>
        )}
      </div>

      {/* Plans Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Plan Code</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Maintenance Title</th>
              <th className="px-4 py-3">Cadence & Cycle</th>
              <th className="px-4 py-3">Operating Hours</th>
              <th className="px-4 py-3">Checklist Steps</th>
              <th className="px-4 py-3">Next Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-xs text-zinc-400">
                  Loading service plans...
                </td>
              </tr>
            ) : filteredPlans.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-xs text-zinc-500">
                  No preventive maintenance plans found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredPlans.map((plan) => {
                const checklistCount = Array.isArray(plan.checklist_template)
                  ? plan.checklist_template.length
                  : 0;

                return (
                  <tr key={plan.id} className="hover:bg-zinc-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">
                      {plan.plan_code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-900">{plan.machine_code || 'N/A'}</div>
                      <div className="text-[11px] text-zinc-400">{plan.machine_name}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 max-w-xs truncate">
                      {plan.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-bold text-zinc-800">{plan.frequency}</span>
                      <span className="block text-[10px] text-zinc-400">
                        Interval: {plan.interval_days}d (Grace: {plan.grace_period_days}d)
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-700">
                      {plan.operating_hour_threshold
                        ? `${plan.operating_hour_threshold} hrs`
                        : 'Calendar Only'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-bold text-[11px]">
                        <ListChecks className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{checklistCount} steps</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 font-medium">
                      {plan.next_pm_date
                        ? new Date(plan.next_pm_date).toLocaleDateString()
                        : 'Pending Cycle'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          plan.is_active
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                        }`}
                      >
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewPlanDetail(plan)}
                          title="View Plan Details & Checklist"
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded transition cursor-pointer"
                        >
                          <ListChecks className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditPlan(plan)}
                              title="Edit Plan"
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleStatus(plan)}
                              title={plan.is_active ? 'Deactivate Plan' : 'Activate Plan'}
                              className={`p-1.5 rounded transition cursor-pointer ${
                                plan.is_active
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
