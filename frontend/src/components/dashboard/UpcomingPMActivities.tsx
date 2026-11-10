import React from 'react';
import { Calendar, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface PMActivityItem {
  id: string;
  month: string;
  day: string;
  title: string;
  machine: string;
  priority?: 'High' | 'Medium' | 'Low' | string;
}

interface UpcomingPMActivitiesProps {
  activities?: PMActivityItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export const UpcomingPMActivities: React.FC<UpcomingPMActivitiesProps> = ({
  activities = [],
  loading = false,
  emptyMessage = 'No upcoming PM activities scheduled',
}) => {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          <h3 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider">
            Upcoming PM Activities
          </h3>
        </div>
        <Link
          to="/work-orders"
          className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-1 transition"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-zinc-400 font-medium">
          Loading scheduled activities...
        </div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-400 font-medium">
          {emptyMessage}
        </div>
      ) : (
        /* List */
        <div className="space-y-2.5">
          {activities.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50/20 transition group"
            >
              {/* Bold Yellow Date Badge */}
              <div className="w-11 h-11 rounded-lg bg-jcb-yellow text-black flex flex-col items-center justify-center shrink-0 border border-amber-500 shadow-2xs font-mono leading-none">
                <span className="text-[9px] font-black uppercase tracking-wider text-zinc-800">
                  {item.month}
                </span>
                <span className="text-base font-black tracking-tight text-black mt-0.5">
                  {item.day}
                </span>
              </div>

              {/* Content Details */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-zinc-950 truncate group-hover:text-amber-950 transition">
                  {item.title}
                </h4>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-medium">
                  {item.machine}
                </p>
              </div>

              {/* Quick action arrow */}
              <div className="text-zinc-300 group-hover:text-amber-700 transition">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Hint */}
      {activities.length > 0 && (
        <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-zinc-500 font-medium">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-400" />
            <span>Next PM: {activities[0]?.title || 'Scheduled'}</span>
          </span>
          <span className="font-bold text-emerald-700">Scheduled</span>
        </div>
      )}
    </div>
  );
};
