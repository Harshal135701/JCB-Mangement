import React from 'react';
import { AlertOctagon, AlertTriangle, Clock, ArrowRight, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CriticalAlertsBannerProps {
  breakdownCount?: number;
  pendingRequestsCount?: number;
  overdueWorkOrdersCount?: number;
  lowStockPartsCount?: number;
}

export const CriticalAlertsBanner: React.FC<CriticalAlertsBannerProps> = ({
  breakdownCount = 0,
  pendingRequestsCount = 0,
  overdueWorkOrdersCount = 0,
  lowStockPartsCount = 0,
}) => {
  const hasCritical = breakdownCount > 0 || overdueWorkOrdersCount > 0;
  const hasWarnings = pendingRequestsCount > 0 || lowStockPartsCount > 0;

  if (!hasCritical && !hasWarnings) {
    return (
      <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-50 via-emerald-50/70 to-teal-50 border border-emerald-200/90 shadow-2xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100/80 flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-800" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-[13px] font-bold text-emerald-950">
                All Plant Floor Telemetry Nominal
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-xs text-emerald-800 font-normal mt-0.5">
              Zero active machine stoppages • No overdue work orders • Safe stock buffers maintained
            </p>
          </div>
        </div>

        <Link
          to="/machines"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-xl hover:bg-emerald-100 transition shadow-2xs shrink-0"
        >
          <span>Fleet Health</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-2xs transition-all duration-300 ${
        hasCritical
          ? 'bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border-red-200'
          : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-amber-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Indicator & Message */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              hasCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {hasCritical ? (
              <AlertOctagon className="w-5 h-5 animate-bounce" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs sm:text-[13px] font-bold tracking-tight ${
                  hasCritical ? 'text-red-950' : 'text-amber-950'
                }`}
              >
                {hasCritical
                  ? 'Urgent Shop Floor Attention Required'
                  : 'Operational Action Items Pending'}
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  hasCritical
                    ? 'bg-red-200/80 text-red-900'
                    : 'bg-amber-200/80 text-amber-900'
                }`}
              >
                Priority Alert
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-zinc-700">
              {breakdownCount > 0 && (
                <span className="font-semibold text-red-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  <strong>{breakdownCount}</strong> machine stoppage{breakdownCount > 1 ? 's' : ''}
                </span>
              )}
              {overdueWorkOrdersCount > 0 && (
                <span className="font-semibold text-red-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-red-600" />
                  <strong>{overdueWorkOrdersCount}</strong> overdue repair{overdueWorkOrdersCount > 1 ? 's' : ''}
                </span>
              )}
              {pendingRequestsCount > 0 && (
                <span className="font-semibold text-amber-900 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-600" />
                  <strong>{pendingRequestsCount}</strong> new complaint{pendingRequestsCount > 1 ? 's' : ''} pending assignment
                </span>
              )}
              {lowStockPartsCount > 0 && (
                <span className="font-medium text-zinc-700">
                  • <strong>{lowStockPartsCount}</strong> spare part SKU{lowStockPartsCount > 1 ? 's' : ''} low
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
          {pendingRequestsCount > 0 && (
            <Link
              to="/triage"
              className="px-3 py-1.5 bg-jcb-yellow hover:bg-amber-400 text-black font-bold text-xs rounded-xl border border-amber-500 shadow-2xs transition flex items-center gap-1"
            >
              <span>Triage Queue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}

          {overdueWorkOrdersCount > 0 && (
            <Link
              to="/work-orders"
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1"
            >
              <span>Resolve Overdue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
