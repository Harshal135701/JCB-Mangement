import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Users, 
  Building2, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [users, setUsers] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [govTrend, setGovTrend] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const plantParam = plant !== 'All Plants' ? plant : undefined;

      const [usersRes, orgRes, auditRes, kpiRes, trendRes] = await Promise.all([
        apiClient.get('/auth/users', { params: { limit: 100 } }),
        apiClient.get('/org/hierarchy'),
        apiClient.get('/audit', { params: { limit: 6 } }),
        apiClient.get('/reports/dashboard-kpis', { params: { plant_id: plantParam, timeframe } }),
        apiClient.get('/reports/governance-trend', { params: { plant_id: plantParam, timeframe } }),
      ]);

      setUsers(usersRes.data?.data || []);
      setHierarchy(orgRes.data?.data || null);
      setAuditLogs(auditRes.data?.data || []);
      setKpiStats(kpiRes.data?.data || null);
      setGovTrend(trendRes.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      setError(
        err.response?.data?.message ||
        'Unable to retrieve real governance and telemetry data from the backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [plant, timeframe]);

  // Real-time Socket.IO auto-refresh for critical events and system alerts
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      fetchData();
    };
    socket.on('complaint:critical', handleRefresh);
    socket.on('complaint:created', handleRefresh);
    socket.on('notification:new', handleRefresh);

    return () => {
      socket.off('complaint:critical', handleRefresh);
      socket.off('complaint:created', handleRefresh);
      socket.off('notification:new', handleRefresh);
    };
  }, [socket, plant, timeframe]);

  // Dynamic Plant Options from real database hierarchy
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

  // Real Counts from DB
  const totalUsers = kpiStats?.total_users ?? users.length;
  const adminCount = kpiStats?.admin_count ?? users.filter((u) => u.role === 'admin').length;
  const managerCount = kpiStats?.manager_count ?? users.filter((u) => u.role === 'manager').length;
  const techCount = kpiStats?.technician_count ?? users.filter((u) => u.role === 'technician').length;
  const operatorCount = kpiStats?.operator_count ?? users.filter((u) => u.role === 'operator').length;

  const plantsCount = hierarchy?.plants?.length ?? kpiStats?.total_plants ?? 0;
  const totalAssets = kpiStats?.total_machines ?? 0;
  const totalAuditCount = kpiStats?.total_audit_logs ?? auditLogs.length;

  // Real availability calculation from actual database records
  const availabilityPercent = kpiStats?.machine_availability_percent ?? 0;
  const downtimeRatePercent = kpiStats?.downtime_rate_percent ?? 0;
  const totalDowntimeHours = kpiStats?.total_downtime_hours ?? 0;
  const avgMTTRMinutes = kpiStats?.avg_mttr_minutes ?? 0;

  // User distribution segments dynamically computed from actual database records
  const userSegments = useMemo(() => {
    if (totalUsers === 0) return [];
    return [
      {
        label: 'Technicians',
        count: techCount,
        percentage: totalUsers > 0 ? (techCount / totalUsers) * 100 : 0,
        color: '#10B981',
      },
      {
        label: 'Operators',
        count: operatorCount,
        percentage: totalUsers > 0 ? (operatorCount / totalUsers) * 100 : 0,
        color: '#F59E0B',
      },
      {
        label: 'Managers',
        count: managerCount,
        percentage: totalUsers > 0 ? (managerCount / totalUsers) * 100 : 0,
        color: '#3B82F6',
      },
      {
        label: 'System Admins',
        count: adminCount,
        percentage: totalUsers > 0 ? (adminCount / totalUsers) * 100 : 0,
        color: '#18181B',
      },
    ];
  }, [totalUsers, techCount, operatorCount, managerCount, adminCount]);

  // Plant network data from real database
  const plantNetwork = kpiStats?.plant_network || [];

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Admin Governance Dashboard
          ========================================================================= */}
      <DashboardHeader
        title="Admin Governance Dashboard"
        subtitle="Enterprise platform infrastructure, multi-plant security & user access governance"
        badge="ROOT AUTHORITY"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/users"
              className="flex items-center gap-1.5 px-3 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-xs font-bold border border-amber-500 shadow-2xs transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Manage Users</span>
            </Link>
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

      {/* Error Banner with Retry */}
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
          ROW 1: 5 TOP KPI METRIC CARDS (Real DB Values)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Card 1: Enrolled Personnel */}
        <TopKPICard
          icon={Users}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Enrolled Personnel"
          value={totalUsers}
          subtitle={`${techCount} Techs • ${operatorCount} Operators`}
        />

        {/* Card 2: Operating Plants */}
        <TopKPICard
          icon={Building2}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Operating Plants"
          value={plantsCount}
          subtitle={`${kpiStats?.total_shops ?? hierarchy?.shops?.length ?? 0} Active Shops`}
        />

        {/* Card 3: Monitored Machines */}
        <TopKPICard
          icon={Cpu}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-800"
          label="Monitored Machines"
          value={totalAssets}
          subtitle={`${kpiStats?.running_machines ?? 0} Running • ${kpiStats?.breakdown_machines ?? 0} Breakdown`}
        />

        {/* Card 4: Audit Security Logs */}
        <TopKPICard
          icon={ShieldCheck}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Audit Security Logs"
          value={totalAuditCount}
          subtitle="Regulatory Ledger"
        />

        {/* Card 5: Fleet Availability */}
        <TopKPICard
          icon={Activity}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Fleet Availability"
          value={totalAssets > 0 ? `${availabilityPercent}%` : 'N/A'}
          subtitle={totalAssets > 0 ? 'Operational Ratio' : 'No Assets Monitored'}
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Real Backend Metrics)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: User Distribution by Role Donut */}
        <MachineStatusDonut
          title="User Role Distribution"
          totalLabel="Users"
          totalCount={totalUsers}
          segments={userSegments}
          emptyMessage="No enrolled personnel registered in system"
          loading={loading}
        />

        {/* Card 2: Security & Audit Trend Spline */}
        <MaintenanceTrendChart
          title="Security & Governance Trend"
          series1Name="Auth Events"
          series2Name="Audit Logs"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={govTrend}
          loading={loading}
          emptyMessage="No audit log events recorded for this period"
        />

        {/* Card 3: Real Operational Downtime & MTTR Gauge */}
        <DowntimeAnalysisCard
          title="Downtime & Repair Reliability"
          rateValue={`${downtimeRatePercent}%`}
          rateLabel="Breakdown Rate"
          percentage={downtimeRatePercent}
          gaugeColor="#F59E0B"
          loading={loading}
          emptyMessage="Zero downtime recorded"
          metrics={[
            {
              icon: Activity,
              label: 'Total Downtime',
              value: `${totalDowntimeHours} Hrs`,
              change: totalDowntimeHours > 0 ? 'Logged' : 'Zero Halts',
              isPositiveChange: totalDowntimeHours === 0,
            },
            {
              icon: Activity,
              label: 'Avg. MTTR',
              value: `${avgMTTRMinutes} Mins`,
              change: avgMTTRMinutes > 0 ? 'Mean Repair' : 'No Outages',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): Recent Security & Audit Logs from Database */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Recent Security & Governance Audit Logs
              </h3>
            </div>
            <Link
              to="/audit"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View Audit Trail</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Log ID</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Entity</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No audit security logs recorded in database.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log: any) => {
                    const shortId = typeof log.id === 'string' ? log.id.slice(0, 8) : `LOG-${log.id}`;
                    const actor = log.performed_by_name || log.performed_by_email || 'System';
                    const timeStr = log.created_at
                      ? new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recent';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                          {shortId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-zinc-700">
                          {actor}
                        </td>
                        <td className="py-3 px-3 text-zinc-800 font-medium">
                          {log.action}
                        </td>
                        <td className="py-3 px-3 text-zinc-600 font-mono text-[11px]">
                          {log.entity_name || 'System'}
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

        {/* Right Column (~40%): Manufacturing Plant Hierarchy from Database */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Manufacturing Plant Network
              </h3>
            </div>
            <Link
              to="/machines"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View Assets</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Plant Facility</th>
                  <th className="py-2.5 px-3">Shops</th>
                  <th className="py-2.5 px-3">Machines</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      Loading facility network...
                    </td>
                  </tr>
                ) : plantNetwork.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-zinc-400 font-medium">
                      No plant facilities registered in database.
                    </td>
                  </tr>
                ) : (
                  plantNetwork.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3 font-semibold text-zinc-900">
                        {p.plant_name}
                      </td>
                      <td className="py-3 px-3 text-zinc-600 font-medium">
                        {p.shop_count} Shops
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                        {p.machine_count}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border capitalize ${
                            p.plant_status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          {p.plant_status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
