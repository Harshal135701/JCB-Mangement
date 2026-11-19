import React from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  ChevronDown,
  Layers,
  Radio,
  RefreshCw,
  Bell,
} from 'lucide-react';

interface ManagerDashboardHeaderProps {
  user: any;
  plantOptions: string[];
  selectedPlant: string;
  onPlantChange: (plant: string) => void;
  shopOptions: { id: string; name: string }[];
  selectedShopId: string;
  onShopChange: (shopId: string) => void;
  timeframeOptions: string[];
  selectedTimeframe: string;
  onTimeframeChange: (tf: string) => void;
  isConnected: boolean;
  loading: boolean;
  pendingApprovalsCount: number;
  onRefresh: () => void;
}

export const ManagerDashboardHeader: React.FC<ManagerDashboardHeaderProps> = ({
  user,
  plantOptions,
  selectedPlant,
  onPlantChange,
  shopOptions,
  selectedShopId,
  onShopChange,
  timeframeOptions,
  selectedTimeframe,
  onTimeframeChange,
  isConnected,
  loading,
  pendingApprovalsCount,
  onRefresh,
}) => {
  // Greeting based on current time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Row: Welcome Info, Live Status, Notification Bell & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Title & Manager Greeting */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              {greeting}, {user?.fullName || 'Plant Manager'}
            </h1>
            
            
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            JCB Smart CMMS • Facility operations &amp; equipment analytics • {todayStr}
          </p>
        </div>

        {/* Right: Notifications Bell Icon & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Notification Bell linking to Staff Management -> Pending Approvals */}
          <Link
            to="/users?tab=pending"
            className="relative p-2.5 bg-slate-50 hover:bg-slate-100 text-zinc-700 rounded-xl border border-slate-200 transition shadow-2xs group flex items-center justify-center cursor-pointer"
            title={`${pendingApprovalsCount} pending approvals in Staff Management`}
          >
            <Bell className="w-4.5 h-4.5 text-zinc-600 group-hover:text-black transition" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center shadow-xs animate-pulse border-2 border-white">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            title="Refresh live telemetry data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Bottom Filter Controls Bar */}
      <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 text-xs">
        <span className="text-zinc-400 font-bold uppercase tracking-wider text-2xs mr-1">
          Operational Scope:
        </span>

        {/* Plant Selector */}
        {plantOptions.length > 0 && (
          <div className="relative inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs hover:border-slate-300 transition">
            <Building2 className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0" />
            <select
              value={selectedPlant}
              onChange={(e) => onPlantChange(e.target.value)}
              className="bg-transparent appearance-none pr-5 focus:outline-hidden cursor-pointer font-bold text-zinc-900 text-xs"
            >
              {plantOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 pointer-events-none" />
          </div>
        )}

        {/* Shop Floor Selector */}
        <div className="relative inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs hover:border-slate-300 transition">
          <Layers className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0" />
          <select
            value={selectedShopId}
            onChange={(e) => onShopChange(e.target.value)}
            className="bg-transparent appearance-none pr-5 focus:outline-hidden cursor-pointer font-bold text-zinc-900 text-xs"
          >
            <option value="">All Shop Floors</option>
            {shopOptions.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 pointer-events-none" />
        </div>

        {/* Timeframe Selector */}
        <div className="relative inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-2xs hover:border-slate-300 transition ml-auto">
          <Calendar className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0" />
          <select
            value={selectedTimeframe}
            onChange={(e) => onTimeframeChange(e.target.value)}
            className="bg-transparent appearance-none pr-5 focus:outline-hidden cursor-pointer font-bold text-zinc-900 text-xs"
          >
            {timeframeOptions.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
