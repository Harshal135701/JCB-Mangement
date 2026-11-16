import React, { useState } from 'react';
import { 
  Cpu, 
  Clock, 
  Wrench, 
  AlertCircle, 
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface MachineAssetHealthWidgetProps {
  machine?: {
    id?: string;
    machine_code?: string;
    name?: string;
    category?: string;
    serial_number?: string;
    bay_line_location?: string;
    shop_name?: string;
    plant_name?: string;
    criticality?: string;
    status?: string;
    operating_hours?: number | string;
    healthScore?: number;
    servicesDone?: number;
    openWorkOrders?: number;
    description?: string;
  } | null;
  loading?: boolean;
}

export const MachineAssetHealthWidget: React.FC<MachineAssetHealthWidgetProps> = ({
  machine,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'desc'>('overview');

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-xs flex items-center justify-center min-h-[300px]">
        <span className="text-xs text-zinc-400 font-medium">Loading asset telemetry...</span>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-xs flex flex-col items-center justify-center min-h-[300px] text-center">
        <Cpu className="w-8 h-8 text-zinc-300 mb-2" />
        <h4 className="text-sm font-bold text-zinc-700">No Asset Assigned</h4>
        <p className="text-xs text-zinc-400 mt-1">
          Select or assign an active production machine to view asset telemetry.
        </p>
        <Link
          to="/machines"
          className="mt-4 px-3 py-1.5 bg-jcb-yellow text-black text-xs font-bold rounded-lg border border-amber-500 hover:bg-amber-400 transition"
        >
          View Fleet Registry
        </Link>
      </div>
    );
  }

  const status = (machine.status || 'running').toLowerCase();
  const isRunning = status === 'running' || status === 'operational';
  const isBreakdown = status === 'breakdown';

  // Real status display
  const statusBadge = isBreakdown ? (
    <span className="bg-red-50 text-red-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-red-200">
      Breakdown
    </span>
  ) : isRunning ? (
    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
      Operational
    </span>
  ) : (
    <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 capitalize">
      {status.replace('_', ' ')}
    </span>
  );

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-zinc-950" />
            <h3 className="text-xs sm:text-sm font-black text-zinc-950 uppercase tracking-wider">
              Machine Asset Health
            </h3>
          </div>
          {statusBadge}
        </div>

        {/* Machine Identity */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-jcb-yellow text-black text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  {machine.criticality ? machine.criticality.replace('_', ' ') : 'Asset'}
                </span>
                <h4 className="text-base font-extrabold text-zinc-950">
                  {machine.name || machine.machine_code}
                </h4>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Code: <strong className="text-zinc-700">{machine.machine_code}</strong>
                {machine.serial_number && (
                  <> • S/N: <strong className="text-zinc-700">{machine.serial_number}</strong></>
                )}
                {machine.shop_name && (
                  <> • Shop: <strong className="text-zinc-700">{machine.shop_name}</strong></>
                )}
              </p>
            </div>
            <Link
              to={machine.id ? `/machines/${machine.id}` : '/machines'}
              className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-0.5"
            >
              <span>Fleet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Machine Location & Category strip */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-zinc-600">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Operating Status
              </span>
              <span className="font-extrabold text-zinc-900 capitalize">
                {machine.status ? machine.status.replace('_', ' ') : 'Unknown'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Location
              </span>
              <span className="font-medium text-zinc-700">
                {machine.bay_line_location || machine.shop_name || 'Production Floor'}
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics Strip (Run hours, Service count, Open WOs) */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <Clock className="w-3.5 h-3.5 text-zinc-400 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-zinc-950 font-mono">
              {machine.operating_hours != null
                ? `${Number(machine.operating_hours).toLocaleString()} h`
                : 'N/A'}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Run Hours</div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <Wrench className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-zinc-950 font-mono">
              {machine.servicesDone != null ? machine.servicesDone : 0} Done
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">PM Services</div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <AlertCircle className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-blue-700 font-mono">
              {machine.openWorkOrders != null ? machine.openWorkOrders : 0} Active
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Open WO</div>
          </div>
        </div>

        {/* Tab links (Overview, Specs, Description) */}
        <div className="flex items-center gap-4 border-t border-slate-100 pt-3 text-[11px] font-bold text-zinc-500">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-1 transition ${
              activeTab === 'overview'
                ? 'text-zinc-950 border-b-2 border-jcb-yellow font-extrabold'
                : 'hover:text-zinc-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`pb-1 transition ${
              activeTab === 'specs'
                ? 'text-zinc-950 border-b-2 border-jcb-yellow font-extrabold'
                : 'hover:text-zinc-800'
            }`}
          >
            Specs
          </button>
          <button
            onClick={() => setActiveTab('desc')}
            className={`pb-1 transition ${
              activeTab === 'desc'
                ? 'text-zinc-950 border-b-2 border-jcb-yellow font-extrabold'
                : 'hover:text-zinc-800'
            }`}
          >
            Description
          </button>
        </div>

        <div className="pt-2 text-xs text-zinc-600">
          {activeTab === 'overview' && (
            <p className="line-clamp-2 text-zinc-500">
              {machine.description || `Industrial ${machine.category || 'production'} equipment monitored live.`}
            </p>
          )}
          {activeTab === 'specs' && (
            <p className="text-zinc-500">
              Category: <strong>{machine.category || 'N/A'}</strong> • Criticality: <strong>{machine.criticality || 'Standard'}</strong>
            </p>
          )}
          {activeTab === 'desc' && (
            <p className="text-zinc-500">
              {machine.description || 'No equipment documentation recorded in registry.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
