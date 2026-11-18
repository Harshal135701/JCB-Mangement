import React from 'react';
import { Package, Boxes, AlertTriangle, CircleOff, ArrowRight, ShieldCheck, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface SparePartsSummaryData {
  total_parts: number;
  total_physical_stock?: number;
  total_available_stock: number;
  low_stock_items_count: number;
  out_of_stock_count: number;
  total_reserved_stock?: number;
  total_inventory_valuation?: number;
}

interface SparePartsSummaryCardProps {
  summary?: SparePartsSummaryData | null;
  loading?: boolean;
}

export const SparePartsSummaryCard: React.FC<SparePartsSummaryCardProps> = ({
  summary,
  loading = false,
}) => {
  const totalParts = summary?.total_parts ?? 0;
  const availableStock = summary?.total_available_stock ?? 0;
  const lowStock = summary?.low_stock_items_count ?? 0;
  const outOfStock = summary?.out_of_stock_count ?? 0;
  const valuation = summary?.total_inventory_valuation ?? 0;

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);

  const hasAlerts = lowStock > 0 || outOfStock > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Spare Parts & Stock</span>
                {hasAlerts ? (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Reorder Needed
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Healthy Stock
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-500 font-normal mt-0.5">
                Maintenance spares and consumable inventory levels
              </p>
            </div>
          </div>

          <Link
            to="/inventory"
            className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-semibold text-amber-600 hover:text-amber-700 transition shrink-0"
          >
            <span>Inventory Master</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Quick Stat Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-medium">Total SKUs</span>
              <Package className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold font-mono text-zinc-900 leading-tight">
              {loading ? '—' : formatNumber(totalParts)}
            </p>
            <span className="text-[10px] text-zinc-400">Registered</span>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-medium">Available Units</span>
              <Boxes className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-xl font-bold font-mono text-emerald-700 leading-tight">
              {loading ? '—' : formatNumber(availableStock)}
            </p>
            <span className="text-[10px] text-zinc-400">In stock</span>
          </div>

          <div className={`p-3 rounded-xl border ${lowStock > 0 ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-medium">Low Stock</span>
              <AlertTriangle className={`w-3.5 h-3.5 ${lowStock > 0 ? 'text-amber-600' : 'text-zinc-400'}`} />
            </div>
            <p className={`text-lg sm:text-xl font-bold font-mono leading-tight ${lowStock > 0 ? 'text-amber-800' : 'text-zinc-900'}`}>
              {loading ? '—' : formatNumber(lowStock)}
            </p>
            <span className="text-[10px] text-zinc-400">Below min reorder</span>
          </div>

          <div className={`p-3 rounded-xl border ${outOfStock > 0 ? 'border-red-300 bg-red-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-medium">Out of Stock</span>
              <CircleOff className={`w-3.5 h-3.5 ${outOfStock > 0 ? 'text-red-600' : 'text-zinc-400'}`} />
            </div>
            <p className={`text-lg sm:text-xl font-bold font-mono leading-tight ${outOfStock > 0 ? 'text-red-700' : 'text-zinc-900'}`}>
              {loading ? '—' : formatNumber(outOfStock)}
            </p>
            <span className="text-[10px] text-zinc-400">Zero physical units</span>
          </div>
        </div>

        {/* Warning or Health Status Card */}
        {hasAlerts ? (
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-950 block">Critical Inventory Replenishment Alert</span>
                <span className="text-amber-800">
                  {outOfStock > 0 ? `${outOfStock} items out of stock` : ''}
                  {outOfStock > 0 && lowStock > 0 ? ' and ' : ''}
                  {lowStock > 0 ? `${lowStock} items at or below reorder threshold` : ''}.
                  Generate PR to prevent repair stoppage.
                </span>
              </div>
            </div>
            <Link
              to="/procurement"
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition shrink-0 whitespace-nowrap shadow-2xs flex items-center gap-1"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>Raise PR</span>
            </Link>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Optimal store buffer: All critical spare parts are above designated reorder thresholds.</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Stock Valuation</span>
        <span className="font-semibold text-zinc-900 font-mono">
          {valuation > 0 ? `₹${formatNumber(valuation)}` : 'Audited Store'}
        </span>
      </div>
    </div>
  );
};
