import React, { useState } from 'react';
import { 
  Cpu, 
  Clock, 
  Wrench, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const MachineAssetHealthWidget: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'specs' | 'docs'>('overview');

  // Gauge calculation for 92%
  const gaugeSize = 100;
  const strokeWidth = 10;
  const radius = (gaugeSize - strokeWidth) / 2; // 45
  const circumference = 2 * Math.PI * radius; // ≈ 282.74
  const healthPercent = 92;
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference;

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
          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200 shadow-2xs">
            Operational
          </span>
        </div>

        {/* Machine Identity (Clean typography, NO IMAGES) */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-jcb-yellow text-black text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  Class A
                </span>
                <h4 className="text-base font-extrabold text-zinc-950">
                  JCB 3DX Plus
                </h4>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                Serial No: <strong className="text-zinc-700">JCB3DX245678</strong> • Site: <strong className="text-zinc-700">Pune</strong>
              </p>
            </div>
            <Link
              to="/machines"
              className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-0.5"
            >
              <span>Fleet</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Health Gauge Strip */}
          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Health Status
              </span>
              <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">
                92% Healthy
              </div>
              <span className="text-[11px] text-zinc-500 font-medium">
                Bottleneck Asset • Zero Unplanned Halts
              </span>
            </div>

            {/* Circular Gauge Graphic */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg width={gaugeSize} height={gaugeSize} className="transform -rotate-90">
                <circle
                  cx={gaugeSize / 2}
                  cy={gaugeSize / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx={gaugeSize / 2}
                  cy={gaugeSize / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#10B981"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-base text-zinc-950">
                {healthPercent}%
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Strip (Run hours, Service count, Open WOs) */}
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <Clock className="w-3.5 h-3.5 text-zinc-400 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-zinc-950 font-mono">
              2,150 h
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Run Hours</div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <Wrench className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-zinc-950 font-mono">
              12 Done
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Services</div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <AlertCircle className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
            <div className="text-xs sm:text-sm font-black text-blue-700 font-mono">
              1 Active
            </div>
            <div className="text-[10px] text-zinc-400 font-medium mt-0.5">Open WO</div>
          </div>
        </div>

        {/* Tab links (Overview, History, Specs, Docs) */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-bold text-zinc-500">
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
            onClick={() => setActiveTab('history')}
            className={`pb-1 transition ${
              activeTab === 'history'
                ? 'text-zinc-950 border-b-2 border-jcb-yellow font-extrabold'
                : 'hover:text-zinc-800'
            }`}
          >
            Maintenance
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
            onClick={() => setActiveTab('docs')}
            className={`pb-1 transition ${
              activeTab === 'docs'
                ? 'text-zinc-950 border-b-2 border-jcb-yellow font-extrabold'
                : 'hover:text-zinc-800'
            }`}
          >
            Documents
          </button>
        </div>
      </div>

      {/* Tab Content Preview */}
      <div className="mt-3 pt-2 text-[11px] text-zinc-500 font-medium">
        {activeTab === 'overview' && (
          <div className="flex items-center justify-between">
            <span>Last Service: <strong className="text-zinc-700">25 Oct 2025</strong></span>
            <span>Next Service: <strong className="text-zinc-700">25 Nov 2025</strong></span>
          </div>
        )}
        {activeTab === 'history' && (
          <p className="text-zinc-600">3 preventive checks, 1 hydraulic seal replacement completed.</p>
        )}
        {activeTab === 'specs' && (
          <p className="text-zinc-600">76 HP Turbo Diesel • 0.3 m³ Shovel • 4WD Drive</p>
        )}
        {activeTab === 'docs' && (
          <p className="text-zinc-600">O&M Manual v4.2, Wiring Diagram 2025 attached.</p>
        )}
      </div>
    </div>
  );
};
