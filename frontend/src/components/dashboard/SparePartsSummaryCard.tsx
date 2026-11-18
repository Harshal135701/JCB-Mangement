import React from 'react';
import { Package, Boxes, AlertTriangle, CircleOff, ArrowRight, ShieldCheck, ShoppingCart, CheckCircle2 } from 'lucide-react';
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
  const totalTracked = totalParts > 0 ? totalParts : availableStock + lowStock + outOfStock;
  const healthyParts = Math.max(0, totalTracked - lowStock - outOfStock);
  const healthPercent = totalTracked > 0 ? Math.round((healthyParts / totalTracked) * 100) : 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Spare Parts & Stock</span>
              </h3>
            </div>
          </div>

          <Link
            to="/inventory"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition shrink-0"
          >
            <span>Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 4 Compact Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 pt-1 border-t border-slate-100">
          {/* Card 1: SKUs */}
          <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">SKUs</span>
              <Boxes className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-base font-bold font-mono text-zinc-900 leading-tight">
              {loading ? '—' : formatNumber(totalParts)}
            </p>
            <span className="text-[10px] text-zinc-400">Catalogued</span>
          </div>

          {/* Card 2: Available Units */}
          <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Available</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-base font-bold font-mono text-emerald-700 leading-tight">
              {loading ? '—' : formatNumber(availableStock)}
            </p>
            <span className="text-[10px] text-zinc-400">In Store</span>
          </div>

          {/* Card 3: Low Stock */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              lowStock > 0 ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200/80 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Low Stock</span>
              <AlertTriangle
                className={`w-3.5 h-3.5 ${lowStock > 0 ? 'text-amber-600' : 'text-zinc-400'}`}
              />
            </div>
            <p
              className={`text-base font-bold font-mono leading-tight ${
                lowStock > 0 ? 'text-amber-900' : 'text-zinc-900'
              }`}
            >
              {loading ? '—' : formatNumber(lowStock)}
            </p>
            <span className="text-[10px] text-zinc-400">At Min Level</span>
          </div>

          {/* Card 4: Out of Stock */}
          <div
            className={`p-2.5 rounded-xl border flex flex-col justify-between ${
              outOfStock > 0 ? 'border-red-300 bg-red-50/70' : 'border-slate-200/80 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-500 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Out of Stock</span>
              <CircleOff
                className={`w-3.5 h-3.5 ${outOfStock > 0 ? 'text-red-600' : 'text-zinc-400'}`}
              />
            </div>
            <p
              className={`text-base font-bold font-mono leading-tight ${
                outOfStock > 0 ? 'text-red-700' : 'text-zinc-900'
              }`}
            >
              {loading ? '—' : formatNumber(outOfStock)}
            </p>
            <span className="text-[10px] text-zinc-400">Depleted</span>
          </div>
        </div>

        {/* Visual Stock Health Bar */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-zinc-700">Inventory Buffer Health</span>
            <span className="font-mono font-bold text-zinc-950">{healthPercent}% Safe</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${Math.max(5, healthPercent)}%` }}
              title="Healthy Stock"
            />
            {lowStock > 0 && (
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(50, Math.round((lowStock / (totalTracked || 1)) * 100))}%` }}
                title="Low Stock"
              />
            )}
            {outOfStock > 0 && (
              <div
                className="bg-red-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(50, Math.round((outOfStock / (totalTracked || 1)) * 100))}%` }}
                title="Out of Stock"
              />
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 mt-1.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Healthy</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Low ({lowStock})</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Out ({outOfStock})</span>
            </span>
          </div>
        </div>

        {/* Action Banner */}
        {hasAlerts ? (
          <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-xs truncate">
                <span className="font-bold text-amber-950">Replenishment Alert: </span>
                <span className="text-amber-800">
                  {outOfStock > 0 ? `${outOfStock} stock-outs` : ''}
                  {outOfStock > 0 && lowStock > 0 ? ' & ' : ''}
                  {lowStock > 0 ? `${lowStock} low items` : ''}.
                </span>
              </div>
            </div>
            <Link
              to="/procurement"
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition shrink-0 shadow-2xs flex items-center gap-1"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>Raise PR</span>
            </Link>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Optimal store buffer: All critical spare parts are above designated reorder thresholds.</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
        <span>Stock Valuation</span>
        <span className="font-semibold text-zinc-900 font-mono">
          {valuation > 0 ? `₹${formatNumber(valuation)}` : 'Audited Store'}
        </span>
      </div>
    </div>
  );
};
