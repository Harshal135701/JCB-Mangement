import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';
import { BreakdownReportModal } from '../breakdowns/components/BreakdownReportModal';

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [plant, setPlant] = useState('All Plants');
  const [shift, setShift] = useState('Shift A (06:00 - 14:00)');
  const [machines, setMachines] = useState<any[]>([]);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState('');

  // Read ticket/breakdown target from notification URL
  const [searchParams] = useSearchParams();
  const targetTicketId =
    searchParams.get('ticketId') ||
    searchParams.get('breakdownId') ||
    searchParams.get('id');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Scoped query: operators access machines within their shop / plant
      const shopParam = user?.shopId || undefined;
      const plantParam = plant !== 'All Plants' ? plant : user?.plantId || undefined;

      const [machRes, complaintsRes, inspectRes, orgRes] = await Promise.all([
        apiClient.get('/machines', {
          params: { shop_id: shopParam, plant_id: plantParam, limit: 20 },
        }),
        apiClient.get('/breakdowns', {
          params: { shop_id: shopParam, limit: 10 },
        }),
        apiClient.get('/inspections/records', {
          params: { limit: 10 },
        }),
        apiClient.get('/org/hierarchy'),
      ]);

      setMachines(machRes.data?.data || []);
      setMyComplaints(complaintsRes.data?.data || []);
      setRecentInspections(inspectRes.data?.data || []);
      setHierarchy(orgRes.data?.data || null);
    } catch (err: any) {
      console.error('Failed to load operator console:', err);
      setError(
        err.response?.data?.message ||
        'Unable to load live machine telemetry and inspection status from database.'
      );
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
  }, [socket, plant, shift]);

  const handleReportSuccess = (complaint: any) => {
    setReportSuccess(
      `Breakdown Ticket #${complaint?.complaint_number || 'CREATED'} dispatched successfully! Maintenance crew notified.`
    );
    fetchData();
  };

  // Dynamic Plant Options from hierarchy
  const plantOptions = useMemo(() => {
    const list = ['All Plants'];
    if (hierarchy?.plants && Array.isArray(hierarchy.plants)) {
      hierarchy.plants.forEach((p: any) => {
        if (p.plant_name && !list.includes(p.plant_name)) {
          list.push(p.plant_name);
        }
      });
    }
    return list;
  }, [hierarchy]);

  // 1. Operator's Assigned Machine
  const assignedMachine = machines.length > 0 ? machines[0] : null;
  const assignedAssetCode = assignedMachine?.machine_code || assignedMachine?.name || 'None Assigned';
  const assignedAssetStatus = (assignedMachine?.status || 'unknown').toUpperCase();
  const machineRunHours =
    assignedMachine?.operating_hours != null
      ? `${Number(assignedMachine.operating_hours).toLocaleString()} h`
      : 'N/A';

  // 2. Pre-Shift Inspection Status for today / current shift
  const latestInspection = recentInspections.length > 0 ? recentInspections[0] : null;
  const inspectionStatus = latestInspection
    ? (latestInspection.overall_status || 'PASS').toUpperCase()
    : 'PENDING';
  const isInspectionPassed = inspectionStatus === 'PASS';

  // 3. Open Stoppages / Complaints
  const openComplaints = myComplaints.filter(
    (c) => !['closed', 'resolved', 'rejected'].includes(String(c.status || '').toLowerCase())
  );
  const openStoppagesCount = openComplaints.length;

  // 4. Inspection Checklist Items breakdown from real responses_json
  const inspectionSummary = useMemo(() => {
    if (!latestInspection?.responses_json) {
      return { total: 0, passed: 0, flagged: 0, failed: 0 };
    }
    const evalSummary = latestInspection.responses_json.evaluation_summary;
    if (evalSummary) {
      return {
        total: evalSummary.total_items || 0,
        passed: evalSummary.passed || 0,
        flagged: evalSummary.flagged || 0,
        failed: evalSummary.failed || 0,
      };
    }
    const items = latestInspection.responses_json.items || [];
    return {
      total: items.length,
      passed: items.filter((i: any) => i.status === 'pass' || i.value === true).length,
      flagged: items.filter((i: any) => i.status === 'flagged').length,
      failed: items.filter((i: any) => i.status === 'fail' || i.value === false).length,
    };
  }, [latestInspection]);

  const inspectionSegments = useMemo(() => {
    if (inspectionSummary.total === 0) return [];
    return [
      {
        label: 'Pass / Safe',
        count: inspectionSummary.passed,
        percentage: (inspectionSummary.passed / inspectionSummary.total) * 100,
        color: '#10B981',
      },
      {
        label: 'Advisory Note',
        count: inspectionSummary.flagged,
        percentage: (inspectionSummary.flagged / inspectionSummary.total) * 100,
        color: '#F59E0B',
      },
      {
        label: 'Action Needed',
        count: inspectionSummary.failed,
        percentage: (inspectionSummary.failed / inspectionSummary.total) * 100,
        color: '#EF4444',
      },
    ].filter((s) => s.count > 0);
  }, [inspectionSummary]);

  // 5. Stoppage trend over time (real records)
  const stoppageTrend: TrendDataPoint[] = useMemo(() => {
    if (myComplaints.length === 0) return [];
    // Group reported complaints by shift or priority
    const criticalCount = myComplaints.filter((c) => (c.priority || '').toLowerCase() === 'critical').length;
    const nonCriticalCount = myComplaints.length - criticalCount;
    return [
      { label: 'Logged', series1: criticalCount, series2: nonCriticalCount },
      { label: 'Active', series1: openStoppagesCount, series2: Math.max(0, myComplaints.length - openStoppagesCount) },
    ];
  }, [myComplaints, openStoppagesCount]);

  // 6. Real Recorded Sensor Telemetry
  const recordedTemp = latestInspection?.temperature != null ? `${latestInspection.temperature} °C` : null;
  const recordedPressure = latestInspection?.pressure != null ? `${latestInspection.pressure} Bar` : null;
  const recordedVibration = latestInspection?.vibration != null ? `${latestInspection.vibration} mm/s` : null;
  const hasTelemetry = recordedTemp !== null || recordedPressure !== null;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Operator Shop Floor Console
          ========================================================================= */}
      <DashboardHeader
        title="Operator Shop Floor Console"
        subtitle={`Shift telemetry, pre-shift safety verifications & instant stoppage dispatch • ${user?.fullName || 'Operator'}`}
        badge="LINE OPERATOR"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        timeframeOptions={['Shift A (06:00 - 14:00)', 'Shift B (14:00 - 22:00)', 'Shift C (22:00 - 06:00)']}
        selectedTimeframe={shift}
        onTimeframeChange={setShift}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedMachineId(assignedMachine?.id || '');
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-100 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Real Database Values)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Card 1: Assigned Machine */}
        <TopKPICard
          icon={HardHat}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Assigned Asset"
          value={assignedAssetCode}
          subtitle={assignedMachine?.name || 'Assigned in Shop'}
          trend={assignedAssetStatus}
          trendColor={
            assignedAssetStatus === 'RUNNING'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : assignedAssetStatus === 'BREAKDOWN'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }
        />

        {/* Card 2: Pre-Shift Inspection Status */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Pre-Shift Inspection"
          value={inspectionStatus}
          subtitle={latestInspection ? `Recorded (${latestInspection.shift || 'Shift'})` : 'Awaiting Sign-Off'}
          trend={isInspectionPassed ? 'Verified' : inspectionStatus === 'PENDING' ? 'Action Due' : 'Issues Found'}
          trendColor={
            isInspectionPassed
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }
        />

        {/* Card 3: Machine Run Hours */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Meter Run Hours"
          value={machineRunHours}
          subtitle={assignedMachine ? 'Meter Reading' : 'No Asset Assigned'}
        />

        {/* Card 4: Open Stoppages */}
        <TopKPICard
          icon={AlertTriangle}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Open Stoppages"
          value={openStoppagesCount}
          subtitle={openStoppagesCount === 0 ? 'Line Clear' : `${openStoppagesCount} Active Incident(s)`}
          trend={openStoppagesCount === 0 ? 'Clear' : 'Active'}
          trendColor={
            openStoppagesCount === 0
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }
        />

        {/* Card 5: Operational Status */}
        <TopKPICard
          icon={Activity}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Asset State"
          value={assignedAssetStatus}
          subtitle={assignedMachine?.bay_line_location || 'Shop Floor'}
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Real Operational Data)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Inspection Compliance Donut */}
        <MachineStatusDonut
          title="Inspection Checklist Status"
          totalLabel="Checks"
          totalCount={inspectionSummary.total}
          segments={inspectionSegments}
          emptyMessage="No pre-shift inspection completed for this shift"
          loading={loading}
        />

        {/* Card 2: Reported Stoppage Velocity Spline */}
        <MaintenanceTrendChart
          title="Stoppage & Ticket Trend"
          series1Name="Critical"
          series2Name="Standard"
          series1Color="#EF4444"
          series2Color="#EAB308"
          data={stoppageTrend}
          loading={loading}
          emptyMessage="No stoppage events recorded for this operator shift"
        />

        {/* Card 3: Recorded Machine Telemetry (Real Sensor Readings) */}
        <DowntimeAnalysisCard
          title="Recorded Sensor Telemetry"
          rateValue={hasTelemetry ? 'ONLINE' : 'N/A'}
          rateLabel={hasTelemetry ? 'Sensors Monitored' : 'No Telemetry'}
          percentage={hasTelemetry ? 100 : 0}
          gaugeColor="#10B981"
          loading={loading}
          emptyMessage="No sensor readings logged for this shift"
          metrics={
            hasTelemetry
              ? [
                  ...(recordedTemp
                    ? [
                        {
                          icon: Activity,
                          label: 'Recorded Temperature',
                          value: recordedTemp,
                          change: 'Verified',
                          isPositiveChange: true,
                        },
                      ]
                    : []),
                  ...(recordedPressure
                    ? [
                        {
                          icon: Activity,
                          label: 'Recorded Pressure',
                          value: recordedPressure,
                          change: 'Verified',
                          isPositiveChange: true,
                        },
                      ]
                    : []),
                  ...(recordedVibration
                    ? [
                        {
                          icon: Activity,
                          label: 'Vibration Level',
                          value: recordedVibration,
                          change: 'Verified',
                          isPositiveChange: true,
                        },
                      ]
                    : []),
                ]
              : []
          }
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
                setSelectedMachineId(assignedMachine?.id || '');
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
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading stoppage tickets...
                    </td>
                  </tr>
                ) : myComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No breakdown stoppages reported by this operator or shop.
                    </td>
                  </tr>
                ) : (
                  myComplaints.map((item: any) => {
                    const ticketId = item.complaint_number || (typeof item.id === 'string' ? item.id.slice(0, 8) : `CMP-${item.id}`);
                    const machineCode = item.machine_code || item.machine?.code || item.machine?.name || 'Asset';
                    const titleStr = item.problem_title || item.description || 'Stoppage Alert';
                    const priority = item.priority || 'medium';
                    const statusStr = item.status || 'new';
                    const timeStr = item.created_at
                      ? new Date(item.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'N/A';

                    const isTargeted =
                      Boolean(targetTicketId) &&
                      (item.id === targetTicketId ||
                        item.complaint_number === targetTicketId ||
                        (typeof item.id === 'string' && item.id.startsWith(targetTicketId)));

                    return (
                      <tr
                        key={item.id}
                        id={`ticket-${item.id}`}
                        className={`transition ${
                          isTargeted
                            ? 'bg-amber-100/80 border-l-4 border-amber-500 shadow-sm'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                          {ticketId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-zinc-700">
                          {machineCode}
                        </td>
                        <td className="py-3 px-3 text-zinc-800 font-medium max-w-[150px] truncate" title={titleStr}>
                          {titleStr}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-semibold text-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                priority.toLowerCase() === 'critical'
                                  ? 'bg-red-500 animate-pulse'
                                  : priority.toLowerCase() === 'high'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span className="capitalize">{priority}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border capitalize ${
                              statusStr === 'closed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : statusStr === 'work_order_created'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {statusStr.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                          {timeStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~40%): Recent Pre-Shift Inspection Records from Database */}
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
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading inspection sign-offs...
                    </td>
                  </tr>
                ) : recentInspections.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No inspection logs found for this shop shift.
                    </td>
                  </tr>
                ) : (
                  recentInspections.map((rec: any) => {
                    const statusStr = (rec.overall_status || rec.result || 'pass').toLowerCase();
                    const machineName = rec.machine_code || rec.machine?.code || rec.machine?.name || 'Asset';
                    const title = rec.responses_json?.template_title || rec.type || 'Safety Checklist';

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                          <Link
                            to={`/inspections/run?record_id=${rec.id}`}
                            className="hover:underline hover:text-amber-600"
                          >
                            {machineName}
                          </Link>
                        </td>
                        <td
                          className="py-3 px-3 text-zinc-800 font-medium truncate max-w-[140px]"
                          title={title}
                        >
                          {title}
                        </td>
                        <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                          {rec.shift || 'Shift A'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                              statusStr === 'fail'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : statusStr === 'flagged'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {statusStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
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
