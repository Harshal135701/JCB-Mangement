import React from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  ShoppingBag,
  Truck,
  FileClock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface ManagerSpendingSummaryCardProps {
  totalSpend: number;
  activePOs: number;
  deliveredThisMonth: number;
  totalPendingPRs: number;
  overduePOs?: number;
  loading?: boolean;
}

export const ManagerSpendingSummaryCard: React.FC<ManagerSpendingSummaryCardProps> = ({
  totalSpend = 0,
  activePOs = 0,
  deliveredThisMonth = 0,
  totalPendingPRs = 0,
  overduePOs = 0,
  loading = false,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 text-amber-400 flex items-center justify-center font-black shadow-2xs shrink-0">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-950 tracking-tight">
                  Maintenance Spending &amp; Procurement
                </h3>
                <span className="px-2 py-0.5 rounded-full text-2xs font-black bg-amber-50 text-amber-900 border border-amber-200">
                  MRO Budget
                </span>
              </div>
              <p className="text-2xs text-zinc-500 font-medium">
                Real-time spares procurement, active purchase orders, and expenditure
              </p>
            </div>
          </div>

          <Link
            to="/procurement"
            className="text-xs font-bold text-amber-700 hover:text-black flex items-center gap-1 transition shrink-0"
          >
            <span>Procurement</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-xs text-zinc-400 font-medium">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading financial telemetry...
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Primary Expenditure Highlight */}
            <div className="p-4 bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl text-white shadow-xs relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-10">
                <IndianRupee className="w-20 h-20 text-white" />
              </div>
              <div className="text-2xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Total Maintenance Spend</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 text-white">
                ₹{Number(totalSpend || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-2">
                <span>Committed across approved POs &amp; GRNs</span>
              </div>
            </div>

            {/* 3 Secondary Metric Badges */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Active POs */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Active POs</span>
                  <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-lg font-black font-mono text-zinc-950">{activePOs}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
                  {overduePOs > 0 ? (
                    <span className="text-rose-600 font-bold">{overduePOs} overdue</span>
                  ) : (
                    'In fulfillment'
                  )}
                </div>
              </div>

              {/* Delivered This Month */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Fulfilled</span>
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-black font-mono text-zinc-950">{deliveredThisMonth}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 truncate">Delivered to stock</div>
              </div>

              {/* Pending PRs */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between text-zinc-500 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Pending PRs</span>
                  <FileClock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-black font-mono text-zinc-950">{totalPendingPRs}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 truncate">Awaiting review</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-2xs text-zinc-500 font-medium">
        <span>Sourced from Spares &amp; Procurement Master</span>
        <span className="font-mono text-zinc-400">Live Sync</span>
      </div>
    </div>
  );
};
