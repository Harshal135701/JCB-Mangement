import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, 
  Search, 
  Filter, 
  Plus, 
  ArrowRight, 
  MoreHorizontal,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface WorkOrderRow {
  id: string;
  woNumber: string;
  type: 'Breakdown' | 'PM' | 'Inspection';
  machine: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  assignedTo: string;
  dueDate: string;
}

const mockWorkOrders: WorkOrderRow[] = [
  {
    id: 'wo-1',
    woNumber: 'WO-2026-1048',
    type: 'Breakdown',
    machine: 'JCB 3DX (CNC-001)',
    priority: 'High',
    status: 'Open',
    assignedTo: 'Ramesh Kumar',
    dueDate: 'Nov 07, 2026',
  },
  {
    id: 'wo-2',
    woNumber: 'WO-2026-1047',
    type: 'PM',
    machine: 'JCB 220X (Press Line A)',
    priority: 'Medium',
    status: 'In Progress',
    assignedTo: 'Suresh Patel',
    dueDate: 'Nov 08, 2026',
  },
  {
    id: 'wo-3',
    woNumber: 'WO-2026-1046',
    type: 'Breakdown',
    machine: 'JCB 140 (Robotic Cell)',
    priority: 'High',
    status: 'Open',
    assignedTo: 'Vikram Singh',
    dueDate: 'Nov 07, 2026',
  },
  {
    id: 'wo-4',
    woNumber: 'WO-2026-1045',
    type: 'PM',
    machine: 'JCB 3DX (Bay B-04)',
    priority: 'Low',
    status: 'Completed',
    assignedTo: 'Ajay Sharma',
    dueDate: 'Nov 06, 2026',
  },
  {
    id: 'wo-5',
    woNumber: 'WO-2026-1044',
    type: 'Inspection',
    machine: 'JCB 205 (Assembly 2)',
    priority: 'Medium',
    status: 'In Progress',
    assignedTo: 'Deepak Yadav',
    dueDate: 'Nov 06, 2026',
  },
  {
    id: 'wo-6',
    woNumber: 'WO-2026-1042',
    type: 'Breakdown',
    machine: 'JCB 455ZX (Loader Line)',
    priority: 'High',
    status: 'Overdue',
    assignedTo: 'Manoj Verma',
    dueDate: 'Nov 04, 2026',
  },
];

type FilterTab = 'ALL' | 'OPEN' | 'IN PROGRESS' | 'COMPLETED' | 'OVERDUE';

export const WorkOrdersQueueTable: React.FC<{ liveOrders?: any[] }> = ({ liveOrders }) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Priority Badge Color
  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'low':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Status Badge Color
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'in progress':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
      case 'verified_closed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-slate-100 text-zinc-700 border-slate-200';
    }
  };

  // Filtered rows
  const filteredOrders = mockWorkOrders.filter((wo) => {
    // Tab filter
    if (activeTab === 'OPEN' && wo.status !== 'Open') return false;
    if (activeTab === 'IN PROGRESS' && wo.status !== 'In Progress') return false;
    if (activeTab === 'COMPLETED' && wo.status !== 'Completed') return false;
    if (activeTab === 'OVERDUE' && wo.status !== 'Overdue') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        wo.woNumber.toLowerCase().includes(q) ||
        wo.machine.toLowerCase().includes(q) ||
        wo.assignedTo.toLowerCase().includes(q) ||
        wo.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-zinc-950" />
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
            Work Orders Queue
          </h3>
        </div>

        <Link
          to="/triage"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-black rounded-xl transition border border-amber-500 shadow-xs self-start sm:self-auto uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Work Order</span>
        </Link>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(
            [
              { key: 'ALL', label: 'All (68)' },
              { key: 'OPEN', label: 'Open (24)' },
              { key: 'IN PROGRESS', label: 'In Progress (20)' },
              { key: 'COMPLETED', label: 'Completed (18)' },
              { key: 'OVERDUE', label: 'Overdue (6)' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'bg-slate-100 text-zinc-600 hover:bg-slate-200 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search work orders..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-zinc-400 tracking-wider">
              <th className="pb-2.5 font-bold">WO #</th>
              <th className="pb-2.5 font-bold">Type</th>
              <th className="pb-2.5 font-bold">Machine</th>
              <th className="pb-2.5 font-bold">Priority</th>
              <th className="pb-2.5 font-bold">Status</th>
              <th className="pb-2.5 font-bold">Assigned To</th>
              <th className="pb-2.5 font-bold">Due Date</th>
              <th className="pb-2.5 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-xs text-zinc-400 font-medium">
                  No work orders found matching the filter criteria.
                </td>
              </tr>
            ) : (
              filteredOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-slate-50 transition group">
                  <td className="py-3 font-mono font-bold text-zinc-950">
                    <Link
                      to={`/work-orders/${wo.id}`}
                      className="hover:text-amber-800 transition flex items-center gap-1"
                    >
                      <span>{wo.woNumber}</span>
                    </Link>
                  </td>
                  <td className="py-3 text-zinc-600 font-medium">
                    {wo.type}
                  </td>
                  <td className="py-3 font-bold text-zinc-900">
                    {wo.machine}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadge(
                        wo.priority
                      )}`}
                    >
                      {wo.priority}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(
                        wo.status
                      )}`}
                    >
                      {wo.status}
                    </span>
                  </td>
                  <td className="py-3 text-zinc-700 font-medium">
                    {wo.assignedTo}
                  </td>
                  <td className="py-3 font-mono text-zinc-500 text-[11px]">
                    {wo.dueDate}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/work-orders`}
                      className="inline-flex items-center justify-center p-1.5 text-zinc-400 hover:text-black hover:bg-slate-100 rounded-lg transition"
                      title="View Details"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500 font-medium">
        <span>
          Showing <strong className="text-zinc-900">{filteredOrders.length}</strong> of 68 work orders
        </span>
        <Link
          to="/work-orders"
          className="font-bold text-amber-800 hover:text-black flex items-center gap-1"
        >
          <span>Complete Work Order Engine</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
