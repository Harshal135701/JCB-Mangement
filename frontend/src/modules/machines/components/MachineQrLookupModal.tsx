import React, { useState } from 'react';
import apiClient from '../../../api/client';
import { Machine } from '../types';
import { StatusBadge } from '../../../components/common/StatusBadge';
import {
  X,
  QrCode,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  Building,
  RotateCw,
  ExternalLink,
} from 'lucide-react';

interface MachineQrLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewHistory: (machineId: string) => void;
}

export const MachineQrLookupModal: React.FC<MachineQrLookupModalProps> = ({
  isOpen,
  onClose,
  onViewHistory,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [foundMachine, setFoundMachine] = useState<Machine | null>(null);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setWarningMsg(null);
    setFoundMachine(null);

    try {
      const res = await apiClient.get(`/machines/qr/${encodeURIComponent(identifier.trim())}`);
      if (res.data.success && res.data.data) {
        setFoundMachine(res.data.data);
        if (res.data.warning) {
          setWarningMsg(res.data.warning);
        }
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setErrorMsg(`No machine found matching QR identifier or code: "${identifier.trim()}".`);
      } else if (err.response?.status === 403) {
        setErrorMsg('Access Restricted: Machine belongs to a facility outside your authorized scope.');
      } else {
        setErrorMsg(err.response?.data?.message || 'Failed to resolve QR code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIdentifier('');
    setFoundMachine(null);
    setErrorMsg(null);
    setWarningMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-jcb-yellow text-black rounded-xl shadow">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                QR CODE & ASSET IDENTIFIER LOOKUP
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">
                Instant Shop Floor Asset Resolution & Service Card
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Lookup Input Form */}
          <form onSubmit={handleLookup} className="space-y-3">
            <label className="block text-[11px] font-black text-zinc-700 uppercase">
              Scan Barcode / Enter QR UID or Machine Code
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. QR-JCB-CNC-001-UID or CNC-001"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Lookup</span>
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 font-medium">
              Accepts system QR UIDs (e.g. <span className="font-mono text-zinc-700">QR-JCB-CNC-001-UID</span>) or legacy machine tags (<span className="font-mono text-zinc-700">CNC-001</span>).
            </p>
          </form>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl text-xs flex items-center gap-2 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Warning Message (e.g. Decommissioned / Inactive) */}
          {warningMsg && (
            <div className="p-3 rounded-xl text-xs flex items-start gap-2 bg-amber-50 text-amber-900 border border-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span className="font-bold">{warningMsg}</span>
            </div>
          )}

          {/* Found Machine Card */}
          {foundMachine && (
            <div className="p-5 bg-zinc-50 rounded-2xl border-2 border-zinc-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div>
                  <span className="font-mono font-black text-base text-zinc-950 block">
                    {foundMachine.machine_code}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500 font-semibold">
                    UID: {foundMachine.qr_code_uid}
                  </span>
                </div>
                <StatusBadge status={foundMachine.status} />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-black text-zinc-900">{foundMachine.name}</span>
                <div className="text-[11px] text-zinc-600 font-medium flex flex-wrap items-center gap-2">
                  <span>{foundMachine.oem_manufacturer}</span>
                  {foundMachine.model_number && <span>&bull; {foundMachine.model_number}</span>}
                  {foundMachine.category && <span>&bull; {foundMachine.category}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-zinc-200 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Facility Shop</span>
                  <span className="font-bold text-zinc-800">{foundMachine.shop_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Bay / Line</span>
                  <span className="font-bold text-zinc-800">{foundMachine.bay_line_location || 'Bay 1'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Operating Meter</span>
                  <span className="font-mono font-black text-zinc-900">
                    {foundMachine.operating_hours ? `${Number(foundMachine.operating_hours).toFixed(1)} hrs` : '0.0 hrs'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Criticality</span>
                  <span className="font-bold uppercase text-zinc-800">
                    {foundMachine.criticality?.replace('_', ' ') || 'Class B'}
                  </span>
                </div>
              </div>

              {foundMachine.description && (
                <p className="text-[11px] text-zinc-600 italic bg-white p-2.5 rounded-lg border border-zinc-200">
                  "{foundMachine.description}"
                </p>
              )}

              {/* Action: Open History */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-zinc-500 hover:text-zinc-800 font-medium underline"
                >
                  Scan Another Asset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onViewHistory(foundMachine.id);
                    onClose();
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition shadow"
                >
                  <span>View Maintenance History</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
