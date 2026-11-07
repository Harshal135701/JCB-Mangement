import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';

export interface PMTableItem {
  machine: string;
  activity: string;
  dueDate: string;
  status: 'Due Soon' | 'Scheduled' | 'Upcoming' | string;
}

interface UpcomingPMTableProps {
  title?: string;
  viewCalendarLink?: string;
  activities?: PMTableItem[];
}

const defaultActivities: PMTableItem[] = [
  {
    machine: 'JCB-143',
    activity: 'Filter Replacement',
    dueDate: '01 May, 2025',
    status: 'Due Soon',
  },
  {
    machine: 'JCB-167',
    activity: 'Lubrication',
    dueDate: '03 May, 2025',
    status: 'Scheduled',
  },
  {
    machine: 'JCB-189',
    activity: 'General Inspection',
    dueDate: '05 May, 2025',
    status: 'Scheduled',
  },
  {
    machine: 'JCB-121',
    activity: 'Service (500 Hrs)',
    dueDate: '07 May, 2025',
    status: 'Upcoming',
  },
  {
    machine: 'JCB-176',
    activity: 'Safety Check',
    dueDate: '10 May, 2025',
    status: 'Upcoming',
  },
];

export const UpcomingPMTable: React.FC<UpcomingPMTableProps> = ({
  title = 'Upcoming Preventive Maintenance',
  viewCalendarLink = '/pm',
  activities = defaultActivities,
}) => {
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    let bg = 'bg-slate-100 text-slate-700 border-slate-200';

    if (s.includes('due') || s.includes('soon')) {
      bg = 'bg-amber-100 text-amber-800 border-amber-300';
    } else if (s.includes('scheduled')) {
      bg = 'bg-blue-50 text-blue-700 border-blue-200';
    } else if (s.includes('upcoming')) {
      bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
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
          <Calendar className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
            {title}
          </h3>
        </div>
        <Link
          to={viewCalendarLink}
          className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
        >
          <span>View Calendar</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">Machine</th>
              <th className="py-2.5 px-3">Activity</th>
              <th className="py-2.5 px-3">Due Date</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
            {activities.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70 transition">
                <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                  {row.machine}
                </td>
                <td className="py-3 px-3 text-zinc-800 font-medium">
                  {row.activity}
                </td>
                <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                  {row.dueDate}
                </td>
                <td className="py-3 px-3">
                  {getStatusBadge(row.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
