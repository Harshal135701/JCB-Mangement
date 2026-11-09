import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  HardHat, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Plus, 
  ArrowRight,
  ClipboardCheck,
  ShieldCheck,
  Gauge
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';
import { BreakdownReportModal } from '../breakdowns/components/BreakdownReportModal';

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [plant, setPlant] = useState('Pune Plant');
  const [shift, setShift] = useState('Shift A (06:00 - 14:00)');
  const [machines, setMachines] = useState<any[]>([]);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [machRes, complaintsRes, inspectRes] = await Promise.all([
        apiClient.get('/machines?limit=12').catch(() => ({ data: { data: [] } })),
        apiClient.get('/breakdowns?limit=5').catch(() => ({ data: { data: [] } })),
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
  }, [plant, shift]);

  // Real-time Socket.IO auto-refresh for operator repairs and breakdown updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchData();
    };
    socket.on('repair:verified', handleUpdate);
    socket.on('complaint:acknowledged', handleUpdate);
    socket.on('complaint:info_requested', handleUpdate);
    socket.on('complaint:rejected', handleUpdate);
    socket.on('notification:new', handleUpdate);

    return () => {
      socket.off('repair:verified', handleUpdate);
      socket.off('complaint:acknowledged', handleUpdate);
      socket.off('complaint:info_requested', handleUpdate);
      socket.off('complaint:rejected', handleUpdate);
      socket.off('notification:new', handleUpdate);
    };
  }, [socket]);

  const handleReportSuccess = (complaint: any) => {
    setReportSuccess(
      `Breakdown Ticket #${complaint?.complaint_number || 'CREATED'} dispatched successfully! Maintenance crew notified.`
    );
    fetchData();
  };

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Operator Shop Floor Console (Image 2 Style)
          ========================================================================= */}
      <DashboardHeader
        title="Operator Shop Floor Console"
        subtitle={`Shift telemetry, pre-shift safety verifications & instant stoppage dispatch • ${user?.fullName || 'Operator'}`}
        badge="LINE OPERATOR"
        plantOptions={['Pune Plant', 'Ballabgarh Works', 'Jaipur Plant']}
        selectedPlant={plant}
        onPlantChange={setPlant}
        timeframeOptions={['Shift A (06:00 - 14:00)', 'Shift B (14:00 - 22:00)', 'Shift C (22:00 - 06:00)']}
        selectedTimeframe={shift}
        onTimeframeChange={setShift}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedMachineId('');
                setIsReportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Report Breakdown</span>
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {reportSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reportSuccess}</span>
          </div>
          <button
            onClick={() => setReportSuccess('')}
            className="text-zinc-500 hover:text-black font-extrabold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Card 1: Assigned Machine */}
        <TopKPICard
          icon={HardHat}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Assigned Asset"
          value="JCB-205"
          trend="Operating Normal"
          trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
        />

        {/* Card 2: Pre-Shift Safety */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Pre-Shift Inspection"
          value="PASSED"
          trend="100% Verified"
          trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
        />

        {/* Card 3: Shift Run Hours */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Shift Run Hours"
          value="6.8 Hrs"
          trend="↑ 4%"
          trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
        />

        {/* Card 4: Open Stoppages */}
        <TopKPICard
          icon={AlertTriangle}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Open Stoppages"
          value="0"
          trend="Line Clear"
          trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
        />

        {/* Card 5: Asset Health Score */}
        <TopKPICard
          icon={Activity}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Asset Health Score"
          value="98.2%"
          trend="Optimal"
          trendColor="bg-emerald-50 text-emerald-700 border border-emerald-200"
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Inspection Compliance Donut */}
        <MachineStatusDonut
          title="Inspection Checklist Status"
          totalLabel="Items"
          totalCount={24}
          segments={[
            { label: 'Pass / Safe', count: 21, percentage: 87.5, color: '#10B981' },
            { label: 'Advisory Note', count: 2, percentage: 8.3, color: '#F59E0B' },
            { label: 'Action Needed', count: 1, percentage: 4.2, color: '#EF4444' },
          ]}
        />

        {/* Card 2: Run vs Stoppage Trend Spline */}
        <MaintenanceTrendChart
          title="Run vs Idle Hours Trend"
          series1Name="Run Hours"
          series2Name="Idle / Setup"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={[
            { label: 'Week 1', series1: 34, series2: 6 },
            { label: 'Week 2', series1: 38, series2: 4 },
            { label: 'Week 3', series1: 36, series2: 5 },
            { label: 'Week 4', series1: 39, series2: 3 },
          ]}
          maxY={40}
        />

        {/* Card 3: Machine Telemetry & OEE Gauge */}
        <DowntimeAnalysisCard
          title="Line OEE & Telemetry"
          rateValue="91.4%"
          rateLabel="Machine OEE"
          percentage={91}
          gaugeColor="#10B981"
          metrics={[
            {
              icon: Gauge,
              label: 'Engine Temp',
              value: '74 °C',
              change: 'Normal Range',
              isPositiveChange: true,
            },
            {
              icon: Activity,
              label: 'Hydraulic Pressure',
              value: '210 Bar',
              change: 'Optimal',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): My Breakdown Tickets & Stoppages */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Reported Stoppages & Tickets
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedMachineId('');
                setIsReportModalOpen(true);
              }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>+ New Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Ticket ID</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Symptom</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {(myComplaints.length > 0 ? myComplaints : [
                  { id: 'MR-10025', machine: 'JCB-205', issue: 'Hydraulic Cylinder Leak', priority: 'Critical', status: 'In Progress', date: 'Today, 10:20 AM' },
                  { id: 'MR-10018', machine: 'JCB-205', issue: 'Bucket Tooth Wear', priority: 'Low', status: 'Resolved', date: 'Yesterday' },
                  { id: 'MR-10011', machine: 'JCB-104', issue: 'Headlight Bulb Replacement', priority: 'Low', status: 'Closed', date: '3 Days Ago' },
                  { id: 'MR-10007', machine: 'JCB-205', issue: 'Filter Clogged Alarm', priority: 'Medium', status: 'Resolved', date: '1 Week Ago' },
                ]).map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                      {item.complaint_number || item.id || `MR-${10025 - idx}`}
                    </td>
                    <td className="py-3 px-3 font-semibold text-zinc-700">
                      {item.machine?.code || item.machine || 'JCB-205'}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium">
                      {item.description || item.issue || 'Hydraulic Cylinder Leak'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <span className={`w-2 h-2 rounded-full ${
                          (item.priority || '').toLowerCase() === 'critical' ? 'bg-red-500 animate-pulse' :
                          (item.priority || '').toLowerCase() === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span className="capitalize">{item.priority || 'Critical'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                        {item.status || 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                      {item.date || 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~40%): Recent Pre-Shift Inspection Records */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Pre-Shift Safety Sign-Offs
              </h3>
            </div>
            <Link
              to="/inspections/run"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>Start Inspection</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Checklist</th>
                  <th className="py-2.5 px-3">Shift</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {(recentInspections.length > 0 ? recentInspections : [
                  { machine: 'JCB-205', type: 'Pre-Shift Safety 24-Point', shift: 'Shift A', result: 'PASSED' },
                  { machine: 'JCB-205', type: 'Pre-Shift Safety 24-Point', shift: 'Shift B', result: 'PASSED' },
                  { machine: 'JCB-104', type: 'Pre-Shift Safety 24-Point', shift: 'Shift A', result: 'PASSED' },
                  { machine: 'JCB-178', type: 'Pre-Shift Safety 24-Point', shift: 'Shift C', result: 'PASSED' },
                  { machine: 'JCB-132', type: 'Engine & Oil Pre-Check', shift: 'Shift A', result: 'PASSED' },
                ]).map((rec: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                      {rec.machine?.code || rec.machine || 'JCB-205'}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium">
                      {rec.type || 'Pre-Shift Safety 24-Point'}
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                      {rec.shift || 'Shift A'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {rec.result || 'PASSED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Breakdown Report Modal */}
      {isReportModalOpen && (
        <BreakdownReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onSuccess={handleReportSuccess}
          preselectedMachineId={selectedMachineId}
        />
      )}
    </div>
  );
};
