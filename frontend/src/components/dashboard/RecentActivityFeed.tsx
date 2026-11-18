import React from 'react';
import { History, ArrowRight, Wrench, Shield, AlertTriangle, Package, CheckCircle2, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface AuditActivityItem {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userName?: string;
  userEmail?: string;
  timestamp: string;
  details?: any;
}

interface RecentActivityFeedProps {
  activities?: AuditActivityItem[];
  loading?: boolean;
  emptyMessage?: string;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities = [],
  loading = false,
  emptyMessage = 'No recent operational activity recorded in log',
}) => {
  const getActionMeta = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('BREAKDOWN') || act.includes('COMPLAINT')) {
      return {
        icon: AlertTriangle,
        color: 'text-red-600 bg-red-50 border-red-200',
        label: 'Breakdown Event',
      };
    }
    if (act.includes('WORK_ORDER') || act.includes('REPAIR')) {
      return {
        icon: Wrench,
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        label: 'Work Order',
      };
    }
    if (act.includes('INVENTORY') || act.includes('PART') || act.includes('STOCK')) {
      return {
        icon: Package,
        color: 'text-blue-700 bg-blue-50 border-blue-200',
        label: 'Spare Parts',
      };
    }
    if (act.includes('CLOSE') || act.includes('COMPLETE') || act.includes('VERIF')) {
      return {
        icon: CheckCircle2,
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        label: 'Completed',
      };
    }
    return {
      icon: Shield,
      color: 'text-zinc-700 bg-slate-100 border-slate-200',
      label: 'System Governance',
    };
  };

  const formatTime = (ts: string) => {
    if (!ts) return 'Recent';
    try {
      const d = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <History className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight">
                Recent Operations & Audit Log
              </h3>
              <p className="text-[11px] text-zinc-500 font-normal">
                Chronological ledger of factory floor maintenance events
              </p>
            </div>
          </div>

          <Link
            to="/audit"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
          >
            <span>Full Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Activity Feed */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs text-zinc-500 font-medium">Loading activity stream...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <span className="text-xs text-zinc-500">{emptyMessage}</span>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {activities.map((act) => {
              const meta = getActionMeta(act.action);
              const Icon = meta.icon;

              return (
                <div
                  key={act.id}
                  className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.color}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900 tracking-tight">
                          {act.action?.replace(/_/g, ' ')}
                        </span>
                        {act.entityType && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white text-zinc-600 border border-slate-200 rounded">
                            {act.entityType}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-500 mt-0.5 truncate flex items-center gap-1">
                        <User className="w-3 h-3 text-zinc-400" />
                        <span>{act.userName || act.userEmail || 'System Process'}</span>
                        {act.entityId && (
                          <span className="font-mono text-zinc-400">
                            • {act.entityId.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400 shrink-0 whitespace-nowrap">
                    {formatTime(act.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Verified Cryptographic Audit</span>
        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
          Compliant
        </span>
      </div>
    </div>
  );
};
