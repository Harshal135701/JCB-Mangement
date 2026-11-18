import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MachineSummary } from '../services/reportService';
import { Search, Cpu, ChevronDown, Check, X, Building2, Factory, Activity } from 'lucide-react';

interface ReportMachineSelectorProps {
  machines: MachineSummary[];
  selectedMachine: MachineSummary | null;
  onSelectMachine: (machine: MachineSummary | null) => void;
  isLoading?: boolean;
}

export const ReportMachineSelector: React.FC<ReportMachineSelectorProps> = ({
  machines,
  selectedMachine,
  onSelectMachine,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMachines = useMemo(() => {
    if (!searchTerm.trim()) return machines;
    const term = searchTerm.toLowerCase();
    return machines.filter(
      (m) =>
        m.name?.toLowerCase().includes(term) ||
        m.machine_code?.toLowerCase().includes(term) ||
        m.category?.toLowerCase().includes(term) ||
        m.oem_manufacturer?.toLowerCase().includes(term) ||
        m.shop_name?.toLowerCase().includes(term) ||
        m.plant_name?.toLowerCase().includes(term)
    );
  }, [machines, searchTerm]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'running') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (s === 'breakdown') {
      return 'bg-rose-100 text-rose-800 border-rose-300';
    }
    if (s === 'under_maintenance' || s === 'awaiting_parts') {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-zinc-100 text-zinc-700 border-zinc-300';
  };

  return (
    <div ref={containerRef} className="bg-white border-2 border-zinc-200 rounded-2xl p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-500" />
            Select Machine Asset
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
              {machines.length} Monitored
            </span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Search and select an active plant machinery asset to inspect its operational metrics, maintenance history, and generate an official summary report.
          </p>
        </div>

        {/* Selected Machine Pill Indicator */}
        {selectedMachine ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-amber-950 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>
              Selected: <strong className="font-black text-zinc-950">{selectedMachine.name}</strong>
            </span>
            <span className="text-amber-800 font-mono text-[11px] bg-amber-100/70 px-1.5 py-0.5 rounded">
              {selectedMachine.machine_code}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border capitalize ${getStatusBadge(
                selectedMachine.status
              )}`}
            >
              {selectedMachine.status?.replace(/_/g, ' ')}
            </span>
            <button
              type="button"
              onClick={() => onSelectMachine(null)}
              className="ml-1 p-0.5 text-zinc-400 hover:text-red-600 rounded transition cursor-pointer"
              title="Deselect machine"
              aria-label="Deselect machine"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-xl text-zinc-500 text-xs font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <span>No machine selected</span>
          </div>
        )}
      </div>

      {/* Search and Selection Box */}
      <div className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder={
              selectedMachine
                ? `Selected: ${selectedMachine.name} (${selectedMachine.machine_code}) - Click or search to change...`
                : 'Search and select a machine by name, asset code, category, or manufacturer...'
            }
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition cursor-pointer"
            aria-label="Toggle machine list"
          >
            <ChevronDown
              className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Dropdown Options List */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-72 overflow-y-auto bg-white border-2 border-zinc-200 rounded-2xl shadow-xl divide-y divide-zinc-100 animate-in fade-in zoom-in-95 duration-100">
            {isLoading ? (
              <div className="p-5 text-center text-xs text-zinc-500 font-medium">
                Loading machinery asset directory...
              </div>
            ) : filteredMachines.length === 0 ? (
              <div className="p-5 text-center text-xs text-zinc-500 font-medium">
                No machinery assets found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredMachines.map((m) => {
                const isSelected = selectedMachine?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSelectMachine(m);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-3.5 flex items-center justify-between transition hover:bg-zinc-50 cursor-pointer ${
                      isSelected ? 'bg-amber-50/70 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center shrink-0 font-bold border border-zinc-200">
                        <Cpu className="w-4 h-4 text-zinc-700" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-zinc-900 text-xs truncate">
                            {m.name}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                            {m.machine_code}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border capitalize ${getStatusBadge(
                              m.status
                            )}`}
                          >
                            {m.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
                          <span>{m.category}</span>
                          <span>•</span>
                          <span>{m.oem_manufacturer || 'OEM'}</span>
                          {m.shop_name && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Factory className="w-3 h-3 text-zinc-400" />
                                {m.shop_name}
                              </span>
                            </>
                          )}
                          {m.plant_name && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-zinc-400" />
                                {m.plant_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right hidden sm:block">
                        <span className="text-[11px] font-mono text-zinc-600 block">
                          {m.operating_hours ? `${m.operating_hours} hrs` : '0.0 hrs'}
                        </span>
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                          {m.criticality ? m.criticality.replace(/_/g, ' ') : 'Standard'}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
