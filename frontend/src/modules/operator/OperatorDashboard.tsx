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
  AlertCircle,
  Repeat,
  Layers,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut, DonutSegment } from '../../components/dashboard/MachineStatusDonut';
import { MachineStatusBarChart, MachineStatusBarItem } from '../../components/dashboard/MachineStatusBarChart';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';
import { BreakdownReportModal } from '../breakdowns/components/BreakdownReportModal';
import { OperatorMachineSignInCard } from './components/OperatorMachineSignInCard';
import { RequestNewMachineModal } from './components/RequestNewMachineModal';
import { OperatorMachineAssignment, PermanentMachineInfo } from './types/operator-assignment.types';

export const OperatorDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [machines, setMachines] = useState<any[]>([]);
  const [myComplaints, setMyComplaints] = useState<any[]>([]);
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [currentAssignment, setCurrentAssignment] = useState<OperatorMachineAssignment | null>(null);
  const [recentRejected, setRecentRejected] = useState<OperatorMachineAssignment | null>(null);
  const [permanentMachine, setPermanentMachine] = useState<PermanentMachineInfo | null>(null);
  const [canRequestTemporary, setCanRequestTemporary] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
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
      const plantParam = user?.plantId || undefined;

      const [machRes, complaintsRes, inspectRes, orgRes, assignRes] = await Promise.all([
        apiClient.get('/machines', {
          params: { shop_id: shopParam, plant_id: plantParam, limit: 50 },
        }),
        apiClient.get('/breakdowns', {
          params: { shop_id: shopParam, limit: 10 },
        }),
        apiClient.get('/inspections/records', {
          params: { limit: 10 },
        }),
        apiClient.get('/org/hierarchy'),
        apiClient.get('/machines/operator/current-assignment').catch(() => ({ data: { data: {} } })),
      ]);

      setMachines(machRes.data?.data || []);
      setMyComplaints(complaintsRes.data?.data || []);
      setRecentInspections(inspectRes.data?.data || []);
      setHierarchy(orgRes.data?.data || null);

      const assignData = assignRes.data?.data || {};
      setCurrentAssignment(assignData.currentAssignment || null);
      setRecentRejected(assignData.recentRejected || null);
      setPermanentMachine(assignData.permanentMachine || null);
      setCanRequestTemporary(Boolean(assignData.canRequestTemporary));
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
  }, []);

  // Real-time Socket.IO auto-refresh for operator repairs, assignments, and breakdown updates
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
    socket.on('operator:machine_requested', handleUpdate);
    socket.on('operator:machine_approved', handleUpdate);
    socket.on('operator:machine_rejected', handleUpdate);
    socket.on('operator:machine_released', handleUpdate);

    return () => {
      socket.off('repair:verified', handleUpdate);
      socket.off('complaint:acknowledged', handleUpdate);
      socket.off('complaint:info_requested', handleUpdate);
      socket.off('complaint:rejected', handleUpdate);
      socket.off('notification:new', handleUpdate);
      socket.off('operator:machine_requested', handleUpdate);
      socket.off('operator:machine_approved', handleUpdate);
      socket.off('operator:machine_rejected', handleUpdate);
      socket.off('operator:machine_released', handleUpdate);
    };
  }, [socket]);

  const handleReportSuccess = (complaint: any) => {
    setReportSuccess(
      `Breakdown Ticket #${complaint?.complaint_number || 'CREATED'} dispatched successfully! Maintenance crew notified.`
    );
    fetchData();
  };

  const handleRequestSuccess = (message: string) => {
    setReportSuccess(message);
    fetchData();
  };

  // 1. Operator's Assigned Machine & Permanent Machine Context
  const isTemporaryActive =
    currentAssignment &&
    currentAssignment.status === 'approved' &&
    currentAssignment.assignment_type === 'temporary';

  const isTemporaryPending =
    currentAssignment &&
    currentAssignment.status === 'pending' &&
    currentAssignment.assignment_type === 'temporary';

  const assignedMachine =
    currentAssignment && currentAssignment.status === 'approved'
      ? {
          id: currentAssignment.machine_id,
          machine_code: currentAssignment.machine_code,
          name: currentAssignment.machine_name,
          status: currentAssignment.machine_status || 'running',
          operating_hours: currentAssignment.operating_hours,
        }
      : permanentMachine
      ? {
          id: permanentMachine.id,
          machine_code: permanentMachine.machine_code,
          name: permanentMachine.name,
          status: permanentMachine.status || 'running',
          operating_hours: permanentMachine.operating_hours,
        }
      : machines.length > 0
      ? machines[0]
      : null;

  const permStatus = (permanentMachine?.status || 'RUNNING').toUpperCase();

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

  // 4. Live Machine Status Counts for Real Visualizations
  const totalMachinesCount = machines.length;

  const availableMachinesCount = useMemo(() => {
    return machines.filter((m) => {
      const isFree =
        m.assignment_status === 'available' ||
        m.assignment_status === 'unassigned' ||
        (!m.current_operator_id && m.assignment_status !== 'occupied' && m.assignment_status !== 'pending_approval');
      const isHealthy = ['running', 'idle', 'active'].includes(String(m.status || '').toLowerCase());
      return isFree && isHealthy;
    }).length;
  }, [machines]);

  const occupiedMachinesCount = useMemo(() => {
    return machines.filter(
      (m) =>
        m.assignment_status === 'occupied' ||
        m.current_operator_id != null ||
        (currentAssignment && currentAssignment.status === 'approved' && currentAssignment.machine_id === m.id)
    ).length;
  }, [machines, currentAssignment]);

  const breakdownMachinesCount = useMemo(() => {
    return machines.filter((m) => String(m.status || '').toLowerCase() === 'breakdown').length;
  }, [machines]);

  const maintenanceMachinesCount = useMemo(() => {
    return machines.filter((m) =>
      ['under_maintenance', 'awaiting_parts', 'awaiting_verification'].includes(
        String(m.status || '').toLowerCase()
      )
    ).length;
  }, [machines]);

  // Bar Chart items for machine status distribution
  const statusBarItems: MachineStatusBarItem[] = useMemo(() => {
    return [
      {
        statusKey: 'available',
        label: 'Available / Ready',
        count: availableMachinesCount,
        color: '#10B981',
        description: 'Operational & unassigned on shop floor',
      },
      {
        statusKey: 'occupied',
        label: 'Occupied on Shift',
        count: occupiedMachinesCount,
        color: '#3B82F6',
        description: 'Currently operated by floor personnel',
      },
      {
        statusKey: 'breakdown',
        label: 'Breakdown / Stoppage',
        count: breakdownMachinesCount,
        color: '#EF4444',
        description: 'Out of service due to mechanical/electrical faults',
      },
      {
        statusKey: 'maintenance',
        label: 'Under Maintenance',
        count: maintenanceMachinesCount,
        color: '#F59E0B',
        description: 'Preventive or corrective service in progress',
      },
    ];
  }, [availableMachinesCount, occupiedMachinesCount, breakdownMachinesCount, maintenanceMachinesCount]);

  // Donut Chart segments for machine assignment distribution
  const assignmentSegments: DonutSegment[] = useMemo(() => {
    const myAssignedCount = (permanentMachine ? 1 : 0) + (isTemporaryActive ? 1 : 0);
    const othersOccupied = Math.max(
      0,
      occupiedMachinesCount - (currentAssignment?.status === 'approved' ? 1 : 0)
    );
    return [
      {
        label: 'Your Machine',
        count: myAssignedCount,
        color: '#F59E0B',
      },
      {
        label: 'Occupied by Others',
        count: othersOccupied,
        color: '#3B82F6',
      },
      {
        label: 'Available for Work',
        count: availableMachinesCount,
        color: '#10B981',
      },
      {
        label: 'Down / In Maintenance',
        count: breakdownMachinesCount + maintenanceMachinesCount,
        color: '#EF4444',
      },
    ].filter((s) => s.count > 0);
  }, [
    permanentMachine,
    isTemporaryActive,
    occupiedMachinesCount,
    currentAssignment,
    availableMachinesCount,
    breakdownMachinesCount,
    maintenanceMachinesCount,
  ]);

  // 5. Real Recorded Sensor Telemetry
  const recordedTemp = latestInspection?.temperature != null ? `${latestInspection.temperature} °C` : null;
  const recordedPressure = latestInspection?.pressure != null ? `${latestInspection.pressure} Bar` : null;
  const recordedVibration = latestInspection?.vibration != null ? `${latestInspection.vibration} mm/s` : null;
  const hasTelemetry = recordedTemp !== null || recordedPressure !== null;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Operator Dashboard
          ========================================================================= */}
      <DashboardHeader
        title="Operator Dashboard"
        subtitle=""
        badge="Operator"
        plantOptions={[]}
        timeframeOptions={[]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsRequestModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black shadow-2xs transition cursor-pointer border border-amber-600"
              title="Request an available temporary machine from your shop floor"
            >
              <Repeat className="w-3.5 h-3.5 text-black" />
              <span>Request New Machine</span>
            </button>
            <button
              onClick={() => {
                setSelectedMachineId(assignedMachine?.id || '');
                setIsReportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Report a Problem</span>
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

      {/* Safety Sign-Off Banner */}
      {latestInspection && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold shadow-xs ${
            inspectionStatus === 'FAIL'
              ? 'bg-red-50 border-red-300 text-red-900'
              : isInspectionPassed
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {inspectionStatus === 'FAIL' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            ) : isInspectionPassed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>
              {inspectionStatus === 'FAIL'
                ? 'Danger: Machine failed the safety check. Do not run.'
                : isInspectionPassed
                ? 'Machine passed the safety check. Ready to run.'
                : 'Notice: Daily safety check pending.'}
            </span>
          </div>
          <Link
            to="/inspections/run"
            className="text-xs underline font-extrabold hover:opacity-80"
          >
            {inspectionStatus === 'PENDING' ? 'Start Check' : 'View Check'}
          </Link>
        </div>
      )}

      {reportSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reportSuccess}</span>
          </div>
          <button
            onClick={() => setReportSuccess('')}
            className="text-zinc-500 hover:text-black font-extrabold text-xs cursor-pointer"
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
            className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg font-bold hover:bg-red-100 transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          ROW 1: 6 OPERATIONAL STATISTIC CARDS (Meeting Requirement 1)
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Permanent / Default Asset */}
        <TopKPICard
          icon={ShieldCheck}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-900"
          label="Permanent Asset"
          value={permanentMachine?.machine_code || 'None Assigned'}
          subtitle={permanentMachine?.name || 'Default Asset'}
          trend={permStatus}
          trendColor={
            permStatus === 'RUNNING' || permStatus === 'IDLE'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : permStatus === 'BREAKDOWN'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }
        />

        {/* Card 2: Current Working Asset */}
        <TopKPICard
          icon={Activity}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-900"
          label="Working Asset"
          value={
            currentAssignment && currentAssignment.status === 'approved'
              ? currentAssignment.machine_code
              : (permanentMachine?.machine_code || 'Standby')
          }
          subtitle={
            isTemporaryActive
              ? 'Temp Replacement'
              : (currentAssignment && currentAssignment.status === 'approved' ? 'Permanent Active' : 'No active session')
          }
          trend={isTemporaryActive ? 'TEMP ACTIVE' : (currentAssignment && currentAssignment.status === 'approved' ? 'ACTIVE' : 'STANDBY')}
          trendColor={
            isTemporaryActive
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
              : (currentAssignment && currentAssignment.status === 'approved'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-zinc-100 text-zinc-600')
          }
        />

        {/* Card 3: Temporary Replacement Asset */}
        <TopKPICard
          icon={Repeat}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-900"
          label="Temporary Asset"
          value={
            isTemporaryActive
              ? currentAssignment.machine_code
              : (isTemporaryPending
                ? currentAssignment.machine_code
                : 'None Active')
          }
          subtitle={
            isTemporaryActive
              ? `Replaces ${permanentMachine?.machine_code || 'Permanent'}`
              : (isTemporaryPending
                ? 'Pending Manager'
                : 'Standard Permanent')
          }
          trend={isTemporaryActive ? 'ASSIGNED' : (isTemporaryPending ? 'PENDING' : 'N/A')}
          trendColor={
            isTemporaryActive
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
              : (isTemporaryPending ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-zinc-50 text-zinc-500 border border-zinc-200')
          }
        />

        {/* Card 4: Machine Availability Status */}
        <TopKPICard
          icon={Layers}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-900"
          label="Fleet Availability"
          value={`${availableMachinesCount} Ready`}
          subtitle={`of ${totalMachinesCount} Assets in Shop`}
          trend={`${totalMachinesCount > 0 ? Math.round((availableMachinesCount / totalMachinesCount) * 100) : 0}% Avail`}
          isPositiveTrend={totalMachinesCount > 0 && (availableMachinesCount / totalMachinesCount) >= 0.5}
        />

        {/* Card 5: Active Breakdown Requests */}
        <TopKPICard
          icon={AlertTriangle}
          iconBgColor="bg-red-100"
          iconColor="text-red-800"
          label="Active Problems"
          value={openStoppagesCount}
          subtitle={openStoppagesCount === 0 ? 'All systems nominal' : `${openStoppagesCount} active ticket(s)`}
          trend={openStoppagesCount === 0 ? 'CLEAR' : 'ATTENTION'}
          trendColor={
            openStoppagesCount === 0
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }
        />

        {/* Card 6: Temporary Replacement Request Status */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-800"
          label="Temp Request State"
          value={
            isTemporaryPending
              ? 'Pending'
              : recentRejected
              ? 'Rejected'
              : isTemporaryActive
              ? 'Approved'
              : 'Standby'
          }
          subtitle={
            isTemporaryPending
              ? 'Awaiting Manager'
              : recentRejected
              ? (recentRejected.rejection_reason || 'Request not approved')
              : isTemporaryActive
              ? `Using ${currentAssignment.machine_code}`
              : 'Ready to Request'
          }
          trend={
            isTemporaryPending
              ? 'PENDING'
              : recentRejected
              ? 'REJECTED'
              : isTemporaryActive
              ? 'APPROVED'
              : 'STANDBY'
          }
          trendColor={
            isTemporaryPending
              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
              : recentRejected
              ? 'bg-red-50 text-red-700 border border-red-300'
              : isTemporaryActive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
          }
        />
      </div>

      {/* =========================================================================
          ROW 2: VISUALIZATIONS & FLEET ANALYTICS (Meeting Requirement 1 Charts)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Bar Chart: Machine Status Distribution (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Shop Machine Status Distribution
              </h3>
            </div>
            <span className="text-2xs font-extrabold uppercase bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
              {totalMachinesCount} Assets
            </span>
          </div>
          <div className="pt-2">
            <MachineStatusBarChart
              totalCount={totalMachinesCount}
              items={statusBarItems}
              loading={loading}
              emptyMessage="No machines registered in this shop"
            />
          </div>
        </div>

        {/* Donut Chart: Machine Assignment Distribution (4 cols) */}
        <div className="lg:col-span-4">
          <MachineStatusDonut
            title="Machine Assignment Distribution"
            totalLabel="Shop Machines"
            totalCount={totalMachinesCount}
            segments={assignmentSegments}
            loading={loading}
            emptyMessage="No machine assignments in this shop"
          />
        </div>

        {/* Telemetry / Downtime Widget (3 cols) */}
        <div className="lg:col-span-3">
          <DowntimeAnalysisCard
            title="Live Sensor Telemetry"
            rateValue={hasTelemetry ? 'ONLINE' : 'N/A'}
            rateLabel={hasTelemetry ? 'Live Sensors Monitored' : 'No Sensor Data'}
            percentage={hasTelemetry ? 100 : 0}
            gaugeColor="#10B981"
            loading={loading}
            emptyMessage="No sensor readings logged"
            metrics={
              hasTelemetry
                ? [
                    ...(recordedTemp
                      ? [
                          {
                            icon: Activity,
                            label: 'Temperature',
                            value: recordedTemp,
                            change: 'Normal',
                            isPositiveChange: true,
                          },
                        ]
                      : []),
                    ...(recordedPressure
                      ? [
                          {
                            icon: Activity,
                            label: 'Pressure',
                            value: recordedPressure,
                            change: 'Normal',
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
                            change: 'Normal',
                            isPositiveChange: true,
                          },
                        ]
                      : []),
                  ]
                : []
            }
          />
        </div>
      </div>

      {/* =========================================================================
          ROW 3: PERMANENT & TEMPORARY MACHINE DETAILS (Meeting Requirement 2)
          Clearly separated sections for Permanent Machine and Current Working Asset
          ========================================================================= */}
      <OperatorMachineSignInCard
        permanentMachine={permanentMachine}
        canRequestTemporary={canRequestTemporary}
        currentAssignment={currentAssignment}
        recentRejected={recentRejected}
        hierarchy={hierarchy}
        user={user}
        onAssignmentChange={fetchData}
        onRequestTemporaryClick={() => setIsRequestModalOpen(true)}
      />

      {/* =========================================================================
          ROW 4: BOTTOM ROW 2-COLUMN SPLIT (Problems You Reported + Recent Safety Checks)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): Problems You Reported */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Problems You Reported
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedMachineId(assignedMachine?.id || '');
                setIsReportModalOpen(true);
              }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition cursor-pointer"
            >
              <span>+ Report a Problem</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Report #</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Problem</th>
                  <th className="py-2.5 px-3">Urgency</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Report Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading problem reports...
                    </td>
                  </tr>
                ) : myComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No problems reported by you yet.
                    </td>
                  </tr>
                ) : (
                  myComplaints.map((item: any) => {
                    const ticketId = item.complaint_number || (typeof item.id === 'string' ? item.id.slice(0, 8) : `CMP-${item.id}`);
                    const machineCode = item.machine_code || item.machine?.code || item.machine?.name || 'Asset';
                    const titleStr = item.problem_title || item.description || 'Problem Alert';
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

        {/* Right Column (~40%): Recent Daily Safety Checks */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Recent Safety Checks
              </h3>
            </div>
            <Link
              to="/inspections/run"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>Start Daily Check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Checklist</th>
                  <th className="py-2.5 px-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading safety check records...
                    </td>
                  </tr>
                ) : recentInspections.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No safety checks recorded yet.
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

      {/* Request New Machine Modal */}
      <RequestNewMachineModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={handleRequestSuccess}
        user={user}
        permanentMachine={permanentMachine}
        currentAssignment={currentAssignment}
        hierarchy={hierarchy}
      />
    </div>
  );
};
