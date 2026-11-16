import React, { useState } from 'react';
import {
  Wrench,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Filter,
  Search,
} from 'lucide-react';
import { PMExecutionItem } from '../types';

interface PMExecutionQueueTableProps {
  executions: PMExecutionItem[];
  onOpenExecution: (execution: PMExecutionItem) => void;
  onOpenVerification?: (execution: PMExecutionItem) => void;
  userRole: string;
  loading?: boolean;
}

export const PMExecutionQueueTable: React.FC<PMExecutionQueueTableProps> = ({
  executions,
  onOpenExecution,
  onOpenVerification,
  userRole,
  loading = false,
}) => {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = executions.filter((item) => {
    const matchStatus =
      statusFilter === 'ALL' || item.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchSearch =
      !searchTerm ||
      item.wo_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.machine_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.assigned_technician_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'submitted_verification':
        return 'bg-purple-100 text-purple-900 border border-purple-300 font-bold';
      case 'verified_closed':
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
      case 'rework_required':
        return 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
      case 'in_progress':
        return 'bg-amber-100 text-amber-900 border border-amber-300 font-bold';
      default:
        return 'bg-blue-50 text-blue-800 border border-blue-200 font-bold';
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      {/* Filter Toolbar */}
      <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/70">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search execution by WO #, machine, or technician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted_verification">Submitted Verification</option>
            <option value="verified_closed">Verified & Closed</option>
            <option value="rework_required">Rework Required</option>
          </select>
        </div>

        <span className="text-xs text-zinc-500 font-medium">
          {filtered.length} Work Orders Dispatched from PM Plans
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">Work Order #</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Assigned Staff</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Repair Time</th>
              <th className="px-4 py-3">Created Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-zinc-400">
                  Loading PM execution work orders...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-zinc-500">
                  No PM execution work orders found matching your filter.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isReadyToVerify = item.status === 'submitted_verification';
                const isCanVerify =
                  (userRole === 'admin' || userRole === 'manager') && isReadyToVerify && onOpenVerification;

                return (
                  <tr key={item.execution_id} className="hover:bg-zinc-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-amber-700">
                      {item.wo_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-zinc-900">{item.machine_code}</div>
                      <div className="text-[11px] text-zinc-400">{item.machine_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-800">
                        {item.assigned_technician_name || 'Unassigned Tech'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Mgr: {item.assigned_manager_name || 'Plant Supervisor'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold uppercase text-zinc-700 text-[10px]">
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono">
                      {item.active_repair_minutes ? `${item.active_repair_minutes}m` : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCanVerify && (
                          <button
                            type="button"
                            onClick={() => onOpenVerification(item)}
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verify PM</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenExecution(item)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded text-[11px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>{item.status === 'verified_closed' ? 'View Details' : 'Execute PM'}</span>
                        </button>
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
