import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BreakdownReportModal } from '../breakdowns/components/BreakdownReportModal';
import { 
  HardHat, 
  AlertTriangle, 
  ClipboardCheck, 
  Cpu, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  RefreshCw,
  Plus,
  X,
  Gauge,
  Thermometer,
  Activity,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [machines, setMachines] = useState<any[]>([]);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch machines in plant/shop, breakdowns, and recent inspection audit records
      const [machRes, complaintsRes, inspectRes] = await Promise.all([
        apiClient.get('/machines?limit=12').catch(() => ({ data: { data: [] } })),
        apiClient.get('/breakdowns?limit=10').catch(() => ({ data: { data: [] } })),
        apiClient.get('/inspections/records?limit=5').catch(() => ({ data: { data: [] } })),
      ]);
      setMachines(machRes.data?.data || []);
      setMyComplaints(complaintsRes.data?.data || []);
      setRecentInspections(inspectRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load operator console:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openReportModal = (machineId?: string) => {
    setSelectedMachineId(machineId || '');
    setIsReportModalOpen(true);
  };

  const handleReportSuccess = (complaint: any) => {
    setReportSuccess(
      `Breakdown Ticket #${complaint?.complaint_number || 'CREATED'} dispatched successfully! Maintenance crew notified.`
    );
    fetchData();
  };

  return (
    <div className="space-y-6 min-h-full">
      {/* Title & Operator Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              Operator Shop Floor Console
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Line Operator
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Logged in as <strong className="text-zinc-900">{user?.fullName}</strong> ({user?.employeeCode || 'OP-01'}). Shift: <strong className="text-zinc-900">{user?.shift || 'Shift A'}</strong> • {user?.shopName || 'Main Production Bay'}.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {reportSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reportSuccess}</span>
          </div>
          <button onClick={() => setReportSuccess('')} className="text-emerald-800 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Two Big Shop-Floor Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Button 1: Report Breakdown (Emergency Red) */}
        <button
          type="button"
          onClick={() => openReportModal()}
          className="p-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-md transition-all text-left flex items-center justify-between group border-2 border-red-700 cursor-pointer"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-red-800/80 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Line Stoppage / Urgent Fault</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
              🚨 Report Breakdown (CMP)
            </h3>
            <p className="text-xs text-red-100 max-w-sm font-medium">
              Immediate ticket dispatch to maintenance supervisor and line technicians.
            </p>
          </div>
          <div className="w-12 h-12 bg-white text-red-600 rounded-2xl flex items-center justify-center shrink-0 shadow group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </button>

        {/* Button 2: Daily Pre-Shift Safety Audit (JCB Yellow) */}
        <Link
          to="/inspections/run"
          className="p-6 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-2xl shadow-md transition-all text-left flex items-center justify-between group border-2 border-amber-500 cursor-pointer"
        >
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 bg-amber-400/90 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-black">
              <span>Shift Safety Compliance</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
              📋 Pre-Shift Inspection
            </h3>
            <p className="text-xs text-zinc-900 max-w-sm font-medium">
              Inspect safety guards, record hydraulic oil pressure & temperatures, sign digitally before line startup.
            </p>
          </div>
          <div className="w-12 h-12 bg-black text-jcb-yellow rounded-2xl flex items-center justify-center shrink-0 shadow group-hover:scale-105 transition-transform">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </Link>
      </div>

      {/* Accessible Machines Grid */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              Accessible Machines ({machines.length})
            </h3>
            <p className="text-xs text-zinc-500 font-medium">Production assets in your shop bay</p>
          </div>
          <Link
            to="/machines"
            className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-1 uppercase tracking-wider"
          >
            <span>View All Machines</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {machines.map((m) => {
            const isDown = m.status === 'breakdown';
            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border-2 transition flex flex-col justify-between ${
                  isDown ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-black text-zinc-950">{m.machine_code}</span>
                      <h4 className="text-xs font-bold text-zinc-800 line-clamp-1 mt-0.5">{m.name}</h4>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isDown ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-zinc-500 font-medium truncate">
                    {m.bay_line_location || 'Bay 1'} • {m.category || 'CNC'} • {m.criticality || 'CLASS B'}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    to={`/inspections/run?machine_id=${m.id}`}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-800 hover:text-black bg-slate-100 hover:bg-jcb-yellow px-2 py-1 rounded transition"
                  >
                    <ClipboardCheck className="w-3 h-3 text-zinc-600" />
                    <span>Audit</span>
                  </Link>
                  <button
                    onClick={() => openReportModal(m.id)}
                    className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Report Fault</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Pre-Shift Inspection Audits */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-zinc-800" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                Recent Pre-Shift Inspection Audits ({recentInspections.length})
              </h3>
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Shift checklist history and safety verification records
            </p>
          </div>
          <Link
            to="/inspections/run"
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-zinc-900 bg-jcb-yellow hover:bg-jcb-yellowDark px-3 py-1.5 rounded-xl border border-amber-500 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Inspection</span>
          </Link>
        </div>

        {recentInspections.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-zinc-500">
            <ClipboardCheck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="font-bold">No inspection records logged yet today.</p>
            <p className="text-[11px] text-zinc-400 mt-1">Start your shift by conducting a pre-shift safety checklist.</p>
            <Link
              to="/inspections/run"
              className="inline-block mt-3 px-3.5 py-1.5 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black uppercase tracking-wider rounded-lg shadow-xs"
            >
              Run Pre-Shift Inspection
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="pb-2.5">Date & Time</th>
                  <th className="pb-2.5">Machine</th>
                  <th className="pb-2.5">Shift</th>
                  <th className="pb-2.5">Telemetry (P / T / Vib)</th>
                  <th className="pb-2.5">Inspector</th>
                  <th className="pb-2.5 text-right">Overall Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentInspections.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-mono text-zinc-600 text-[11px]">
                      {new Date(rec.inspected_at || rec.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5">
                      <span className="font-mono font-bold text-zinc-950">
                        {rec.machine_code || rec.machine?.machine_code || 'MC-00'}
                      </span>
                      <span className="block text-[11px] text-zinc-500 font-medium">
                        {rec.machine_name || rec.machine?.name}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-800 font-bold">
                      {rec.shift || 'Shift A'}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-zinc-600">
                      <div className="flex items-center gap-2">
                        {rec.pressure !== null && rec.pressure !== undefined && (
                          <span title="Pressure" className="inline-flex items-center gap-0.5">
                            <Gauge className="w-3 h-3 text-blue-600" />
                            {rec.pressure}b
                          </span>
                        )}
                        {rec.temperature !== null && rec.temperature !== undefined && (
                          <span title="Temperature" className="inline-flex items-center gap-0.5">
                            <Thermometer className="w-3 h-3 text-amber-600" />
                            {rec.temperature}°C
                          </span>
                        )}
                        {rec.vibration !== null && rec.vibration !== undefined && (
                          <span title="Vibration" className="inline-flex items-center gap-0.5">
                            <Activity className="w-3 h-3 text-purple-600" />
                            {rec.vibration}mm/s
                          </span>
                        )}
                        {!rec.pressure && !rec.temperature && !rec.vibration && (
                          <span className="text-zinc-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-zinc-700 font-medium text-[11px]">
                      {rec.inspector_name || rec.inspector?.full_name || user?.fullName}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={rec.overall_status || 'pass'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Submitted Complaints Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              My Submitted Complaints ({myComplaints.length})
            </h3>
            <p className="text-xs text-zinc-500 font-medium">
              Track resolution progress of tickets you have reported
            </p>
          </div>
        </div>

        {myComplaints.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 font-medium">
            You haven't reported any machine breakdowns yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="pb-2.5">Ticket #</th>
                  <th className="pb-2.5">Machine</th>
                  <th className="pb-2.5">Issue Description</th>
                  <th className="pb-2.5">Priority</th>
                  <th className="pb-2.5">Reported At</th>
                  <th className="pb-2.5 text-right">Ticket Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {myComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 font-mono font-bold text-zinc-950">
                      {c.complaint_number}
                    </td>
                    <td className="py-2.5 font-bold text-zinc-900">
                      {c.machine_code}
                    </td>
                    <td className="py-2.5 max-w-[200px] truncate text-zinc-600 font-medium">
                      {c.problem_title || c.description}
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={c.priority} />
                    </td>
                    <td className="py-2.5 text-zinc-500">
                      {new Date(c.reported_at || c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reusable Breakdown Reporting Modal */}
      <BreakdownReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={handleReportSuccess}
        preselectedMachineId={selectedMachineId}
      />
    </div>
  );
};

