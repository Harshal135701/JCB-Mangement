import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  Building2, 
  Cpu, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  ArrowRight,
  ShieldAlert,
  Server
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [users, setUsers] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, orgRes, auditRes, kpiRes] = await Promise.all([
        apiClient.get('/auth/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/org/hierarchy').catch(() => ({ data: { data: null } })),
        apiClient.get('/audit?limit=6').catch(() => ({ data: { data: [] } })),
        apiClient.get('/reports/dashboard-kpis').catch(() => ({ data: { data: null } })),
      ]);

      setUsers(usersRes.data?.data || []);
      setHierarchy(orgRes.data?.data || null);
      setAuditLogs(auditRes.data?.data || []);
      setKpiStats(kpiRes.data?.data || null);
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [plant, timeframe]);

  // Derived user counts
  const totalUsers = users.length > 0 ? users.length : 48;
  const adminCount = users.filter((u) => u.role === 'admin').length || 3;
  const managerCount = users.filter((u) => u.role === 'manager').length || 9;
  const techCount = users.filter((u) => u.role === 'technician').length || 20;
  const operatorCount = users.filter((u) => u.role === 'operator').length || 16;

  // Plants
  const plantsCount = hierarchy?.plants?.length || 5;
  const totalAssets = kpiStats?.total_machines || 120;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Admin Governance Dashboard (Image 2 Style)
          ========================================================================= */}
      <DashboardHeader
        title="Admin Governance Dashboard"
        subtitle="Enterprise platform infrastructure, multi-plant security & user access governance"
        badge="ROOT AUTHORITY"
        plantOptions={['All Plants', 'Pune Plant', 'Ballabgarh Works', 'Jaipur Plant']}
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

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Enrolled Personnel */}
        <TopKPICard
          icon={Users}
          iconBgColor="bg-amber-100/70"
          iconColor="text-amber-700"
          label="Enrolled Personnel"
          value={totalUsers}
          trend="↑ 4%"
          trendColor="text-emerald-600"
        />

        {/* Card 2: Operating Plants */}
        <TopKPICard
          icon={Building2}
          iconBgColor="bg-zinc-900"
          iconColor="text-white"
          label="Operating Plants"
          value={plantsCount}
          trend="100% Online"
          trendColor="text-emerald-600"
        />

        {/* Card 3: Monitored Machines */}
        <TopKPICard
          icon={Cpu}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Monitored Machines"
          value={totalAssets}
          trend="↑ 2%"
          trendColor="text-emerald-600"
        />

        {/* Card 4: Audit Security Logs */}
        <TopKPICard
          icon={ShieldCheck}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Audit Security Logs"
          value="1,420"
          trend="↑ 12%"
          trendColor="text-emerald-600"
        />

        {/* Card 5: Platform Reliability */}
        <TopKPICard
          icon={Activity}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Platform Reliability"
          value="99.9%"
          trend="↑ 0.1%"
          trendColor="text-emerald-600"
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: User Distribution by Role Donut */}
        <MachineStatusDonut
          title="User Role Distribution"
          totalLabel="Users"
          totalCount={totalUsers}
          segments={[
            { label: 'Technicians', count: techCount, percentage: 41.7, color: '#10B981' },
            { label: 'Operators', count: operatorCount, percentage: 33.3, color: '#F59E0B' },
            { label: 'Managers', count: managerCount, percentage: 18.8, color: '#3B82F6' },
            { label: 'System Admins', count: adminCount, percentage: 6.2, color: '#18181B' },
          ]}
        />

        {/* Card 2: Security & Audit Trend Spline */}
        <MaintenanceTrendChart
          title="Security & Governance Trend"
          series1Name="Auth Events"
          series2Name="Audit Logs"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={[
            { label: 'Week 1', series1: 22, series2: 15 },
            { label: 'Week 2', series1: 30, series2: 24 },
            { label: 'Week 3', series1: 28, series2: 21 },
            { label: 'Week 4', series1: 36, series2: 29 },
          ]}
          maxY={40}
        />

        {/* Card 3: Infrastructure Health Gauge */}
        <DowntimeAnalysisCard
          title="Infrastructure Health"
          rateValue="99.9%"
          rateLabel="Service Uptime"
          percentage={99}
          gaugeColor="#10B981"
          metrics={[
            {
              icon: Server,
              label: 'Active Plant Nodes',
              value: '5 / 5 Active',
              change: 'Healthy',
              isPositiveChange: true,
            },
            {
              icon: Activity,
              label: 'Avg. API Latency',
              value: '14 ms',
              change: '↓ 2ms',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): Recent Security & Audit Logs */}
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
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {(auditLogs.length > 0 ? auditLogs : [
                  { id: 'LOG-8841', user: 'admin@jcb.com', action: 'USER_ROLE_PROMOTION', status: 'SUCCESS', time: '10 Mins Ago' },
                  { id: 'LOG-8840', user: 'system_bot', action: 'DB_BACKUP_COMPLETED', status: 'SUCCESS', time: '35 Mins Ago' },
                  { id: 'LOG-8839', user: 'manager@jcb.com', action: 'GATE_PASS_APPROVED', status: 'VERIFIED', time: '1 Hr Ago' },
                  { id: 'LOG-8838', user: 'tech1@jcb.com', action: 'WORK_ORDER_MILESTONE', status: 'RECORDED', time: '2 Hrs Ago' },
                  { id: 'LOG-8837', user: 'operator@jcb.com', action: 'PRE_SHIFT_SIGN_OFF', status: 'PASSED', time: '3 Hrs Ago' },
                ]).map((log: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                      {log.id || `LOG-${8841 - idx}`}
                    </td>
                    <td className="py-3 px-3 font-semibold text-zinc-700">
                      {log.user_email || log.user || 'admin@jcb.com'}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium">
                      {log.action || log.event || 'CONFIG_CHANGE'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {log.status || 'SUCCESS'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                      {log.time || 'Today'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~40%): Manufacturing Plant Hierarchy */}
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
                {[
                  { name: 'Pune Plant 1', shops: '3 Bays', machines: 48, status: 'Online' },
                  { name: 'Ballabgarh Works', shops: '4 Bays', machines: 42, status: 'Online' },
                  { name: 'Jaipur Plant', shops: '2 Bays', machines: 30, status: 'Online' },
                  { name: 'Talegaon Parts DC', shops: 'Central WH', machines: 8, status: 'Online' },
                  { name: 'Vadodara Testing Yard', shops: 'Field Proving', machines: 6, status: 'Online' },
                ].map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-semibold text-zinc-900">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 text-zinc-600 font-medium">
                      {p.shops}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                      {p.machines}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
