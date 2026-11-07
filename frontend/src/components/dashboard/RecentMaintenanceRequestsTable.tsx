import React from 'react';
import { Link } from 'react-router-dom';
import { ListFilter, ArrowRight } from 'lucide-react';

export interface MaintenanceRequestItem {
  id: string;
  machine: string;
  issue: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  status: 'In Progress' | 'Approved' | 'Pending' | 'Resolved' | 'Closed' | string;
  date: string;
}

interface RecentMaintenanceRequestsTableProps {
  title?: string;
  viewAllLink?: string;
  requests?: MaintenanceRequestItem[];
}

const defaultRequests: MaintenanceRequestItem[] = [
  {
    id: 'MR-10025',
    machine: 'JCB-205',
    issue: 'Hydraulic Leak',
    priority: 'Critical',
    status: 'In Progress',
    date: '30 Apr, 10:20 AM',
  },
  {
    id: 'MR-10024',
    machine: 'JCB-104',
    issue: 'Engine Noise',
    priority: 'High',
    status: 'Approved',
    date: '30 Apr, 09:15 AM',
  },
  {
    id: 'MR-10023',
    machine: 'JCB-178',
    issue: 'Overheating',
    priority: 'Medium',
    status: 'Pending',
    date: '30 Apr, 08:50 AM',
  },
  {
    id: 'MR-10022',
    machine: 'JCB-132',
    issue: 'Oil Leakage',
    priority: 'Medium',
    status: 'Resolved',
    date: '29 Apr, 06:30 PM',
  },
  {
    id: 'MR-10021',
    machine: 'JCB-117',
    issue: 'Vibration',
    priority: 'Low',
    status: 'Closed',
    date: '29 Apr, 05:10 PM',
  },
];

export const RecentMaintenanceRequestsTable: React.FC<RecentMaintenanceRequestsTableProps> = ({
  title = 'Recent Maintenance Requests',
  viewAllLink = '/triage',
  requests = defaultRequests,
}) => {
  const getPriorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    let dotColor = 'bg-slate-400';
    let textColor = 'text-zinc-700';

    if (p.includes('critical')) {
      dotColor = 'bg-red-500 animate-pulse';
      textColor = 'text-red-700';
    } else if (p.includes('high')) {
      dotColor = 'bg-amber-500';
      textColor = 'text-amber-800';
    } else if (p.includes('medium')) {
      dotColor = 'bg-amber-400';
      textColor = 'text-amber-700';
    } else if (p.includes('low')) {
      dotColor = 'bg-emerald-500';
      textColor = 'text-emerald-700';
    }

    return (
      <div className="flex items-center gap-1.5 font-semibold text-xs">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className={textColor}>{priority}</span>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';

    if (s.includes('progress')) {
      bg = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (s.includes('approved')) {
      bg = 'bg-cyan-50 text-cyan-800 border-cyan-200';
    } else if (s.includes('pending')) {
      bg = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (s.includes('resolved')) {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (s.includes('closed')) {
      bg = 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${bg}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
      {/* Table Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
            {title}
          </h3>
        </div>
        <Link
          to={viewAllLink}
          className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Request ID</th>
              <th className="py-2.5 px-3">Machine</th>
              <th className="py-2.5 px-3">Issue</th>
              <th className="py-2.5 px-3">Priority</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
            {requests.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                  {row.id}
                </td>
                <td className="py-3 px-3 font-semibold text-zinc-700">
                  {row.machine}
                </td>
                <td className="py-3 px-3 text-zinc-800 font-medium">
                  {row.issue}
                </td>
                <td className="py-3 px-3">
                  {getPriorityBadge(row.priority)}
                </td>
                <td className="py-3 px-3">
                  {getStatusBadge(row.status)}
                </td>
                <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
