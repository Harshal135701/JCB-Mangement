import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  Cpu, 
  Activity, 
  ArrowRight, 
  RefreshCw,
  Clock,
  KeyRound,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MaintenanceOverviewChart } from '../../components/dashboard/MaintenanceOverviewChart';
import { WorkOrderStatusDonut } from '../../components/dashboard/WorkOrderStatusDonut';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, orgRes, auditRes, kpiRes] = await Promise.all([
        apiClient.get('/auth/users'),
        apiClient.get('/org/hierarchy'),
        apiClient.get('/audit?limit=8'),
        apiClient.get('/reports/dashboard-kpis'),
      ]);

      setUsers(usersRes.data?.data || []);
      setHierarchy(orgRes.data?.data || null);
      setAuditLogs(auditRes.data?.data || []);
      setKpiStats(kpiRes.data?.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load system administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute User Counts by Role
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const managerCount = users.filter((u) => u.role === 'manager').length;
  const techCount = users.filter((u) => u.role === 'technician').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;

  return (
    <div className="space-y-6 min-h-full">
      {/* Title & System Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              System Administration & Governance
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              Root Authority
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Logged in as <strong className="text-zinc-900">{user?.fullName}</strong> ({user?.email}). Multi-plant enterprise CMMS infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Link
            to="/users"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Manage Personnel</span>
          </Link>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Metric Cards: Users, Plants, Machines, Security Logs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Enrolled Users</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-zinc-950">{users.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">accounts</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-bold mt-1">
            {adminCount} Admin • {managerCount} Mgr • {techCount} Tech • {operatorCount} Op
          </div>
        </div>

        {/* Manufacturing Sites */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Operating Plants</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-700">
              {hierarchy?.plants?.length ?? 3}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">facilities</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-bold mt-1">
            {hierarchy?.shops?.length ?? 8} Production Shops
          </div>
        </div>

        {/* Total Machines Master */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Machine Master</span>
            <Cpu className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">
              {kpiStats?.totalMachines ?? 0}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">assets</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-bold mt-1">
            {kpiStats?.operationalCount ?? 0} Operational
          </div>
        </div>

        {/* Security Audit Records */}
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Audit Trail</span>
            <ShieldCheck className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-zinc-900">{auditLogs.length}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">recent</span>
          </div>
          <div className="text-[10px] text-zinc-500 font-bold mt-1">ISO 9001 Immutable Log</div>
        </div>
      </div>

      {/* Two Column Layout: Left Plant Hierarchy | Right Recent Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plant Hierarchy Summary */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                  Industrial Facilities & Production Shops
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              {(!hierarchy?.plants || hierarchy.plants.length === 0) ? (
                <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                  Loading enterprise organization tree...
                </div>
              ) : (
                hierarchy.plants.map((p: any) => {
                  const plantShops = hierarchy.shops?.filter((s: any) => s.plant_id === p.id) || [];
                  return (
                    <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                            {p.plant_code}
                          </span>
                          <h4 className="text-xs font-black text-zinc-950 uppercase">{p.plant_name}</h4>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">● Active</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium">{p.location || 'India Manufacturing Base'}</p>
                      
                      <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                        {plantShops.map((s: any) => (
                          <span key={s.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-zinc-700">
                            {s.shop_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Production Lines: <strong className="text-zinc-900">{hierarchy?.lines?.length ?? 12}</strong></span>
            <span>Machining Bays: <strong className="text-zinc-900">{hierarchy?.bays?.length ?? 24}</strong></span>
          </div>
        </div>

        {/* Security Audit Activity Feed */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-900" />
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                  Recent Security & Audit Trail
                </h3>
              </div>
              <Link
                to="/audit"
                className="text-xs font-bold text-amber-800 hover:text-black flex items-center gap-1 uppercase tracking-wider"
              >
                <span>Full Audit Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 font-medium">
                  No recent audit events recorded.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                      <th className="pb-2.5">Action</th>
                      <th className="pb-2.5">Target Entity</th>
                      <th className="pb-2.5">User</th>
                      <th className="pb-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 font-bold text-zinc-950 truncate max-w-[120px]">
                          {log.action}
                        </td>
                        <td className="py-2.5 text-zinc-600 font-medium truncate max-w-[110px]">
                          {log.entity_name || 'System'}
                        </td>
                        <td className="py-2.5 text-zinc-900 font-bold truncate max-w-[100px]">
                          {log.user_name || 'System User'}
                        </td>
                        <td className="py-2.5 text-right text-zinc-500 text-[11px]">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Access Control Mode: <strong className="text-zinc-900">Role-Based (RBAC)</strong></span>
            <Link to="/users" className="text-xs font-bold text-zinc-800 hover:text-black">Manage User Roles →</Link>
          </div>
        </div>
      </div>

      {/* Fleet Maintenance & Work Order Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <MaintenanceOverviewChart />
        </div>
        <div className="lg:col-span-5">
          <WorkOrderStatusDonut />
        </div>
      </div>
    </div>
  );
};
