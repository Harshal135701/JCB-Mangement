import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  RotateCcw,
  FastForward,
  Play,
  Filter,
} from 'lucide-react';
import { PMPlan, PMScheduleStatus } from '../types';

interface PMScheduleQueueTableProps {
  upcomingItems: any[];
  dueItems: any[];
  overdueItems: any[];
  activeQueue: 'upcoming' | 'due' | 'overdue';
  onQueueChange: (queue: 'upcoming' | 'due' | 'overdue') => void;
  onReschedule: (item: any) => void;
  onDefer: (item: any) => void;
  onSkip: (item: any) => void;
  canManage: boolean;
  loading?: boolean;
}

export const PMScheduleQueueTable: React.FC<PMScheduleQueueTableProps> = ({
  upcomingItems,
  dueItems,
  overdueItems,
  activeQueue,
  onQueueChange,
  onReschedule,
  onDefer,
  onSkip,
  canManage,
  loading = false,
}) => {
  const currentList =
    activeQueue === 'upcoming'
      ? upcomingItems
      : activeQueue === 'due'
      ? dueItems
      : overdueItems;

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Sub-Queue Tabs Header */}
      <div className="px-5 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => onQueueChange('due')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeQueue === 'due'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Due PM</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
              {dueItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQueueChange('overdue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeQueue === 'overdue'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue PM</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20">
              {overdueItems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onQueueChange('upcoming')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeQueue === 'upcoming'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Upcoming (30 Days)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {upcomingItems.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-zinc-500 font-medium">
          Showing {currentList.length} items in active queue
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Plan Code</th>
              <th className="px-4 py-3">Machine Asset</th>
              <th className="px-4 py-3">Maintenance Task</th>
              <th className="px-4 py-3">Frequency</th>
              <th className="px-4 py-3">Scheduled Due Date</th>
              <th className="px-4 py-3">Grace Buffer</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="p-8 text-center text-xs text-zinc-400">
                  Loading schedule queue items...
                </td>
              </tr>
            ) : currentList.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="p-8 text-center text-xs text-zinc-500">
                  No maintenance items currently in the {activeQueue} queue.
                </td>
              </tr>
            ) : (
              currentList.map((item) => {
                const isOverdue =
                  activeQueue === 'overdue' ||
                  item.schedule_status === 'overdue' ||
                  (item.next_pm_date && new Date(item.next_pm_date) < new Date());

                return (
                  <tr key={item.id} className="hover:bg-zinc-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">
                      {item.plan_code || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-900">{item.machine_code || 'Machinery'}</div>
                      <div className="text-[11px] text-zinc-400">{item.machine_name}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-bold text-zinc-700">{item.frequency}</span>
                      <span className="block text-[10px] text-zinc-400">
                        {item.interval_days ? `Every ${item.interval_days}d` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span className={isOverdue ? 'text-rose-700 font-bold' : 'text-zinc-800'}>
                          {item.next_pm_date ? new Date(item.next_pm_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono">
                      +{item.grace_period_days || 3} days
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                          activeQueue === 'overdue'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : activeQueue === 'due'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {item.schedule_status || activeQueue}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onReschedule(item)}
                            title="Reschedule to specific date"
                            className="px-2 py-1 bg-white border border-zinc-200 text-zinc-700 hover:text-black hover:border-zinc-400 rounded text-[11px] font-bold transition cursor-pointer"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => onDefer(item)}
                            title="Defer by days"
                            className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 rounded text-[11px] font-bold transition cursor-pointer"
                          >
                            Defer
                          </button>
                          <button
                            type="button"
                            onClick={() => onSkip(item)}
                            title="Skip this cycle"
                            className="px-2 py-1 bg-zinc-100 text-zinc-600 hover:text-rose-700 hover:bg-rose-50 rounded text-[11px] font-bold transition cursor-pointer"
                          >
                            Skip
                          </button>
                        </div>
                      </td>
                    )}
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
