import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Wrench, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  RefreshCw, 
  ArrowRight,
  Play,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { MachineStatusDonut } from '../../components/dashboard/MachineStatusDonut';
import { MaintenanceTrendChart } from '../../components/dashboard/MaintenanceTrendChart';
import { DowntimeAnalysisCard } from '../../components/dashboard/DowntimeAnalysisCard';

export const TechnicianDashboard: React.FC = () => {
  const { user } = useAuth();
  const [plant, setPlant] = useState('Pune Plant');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/work-orders?limit=50').catch(() => ({ data: { data: [] } }));
      if (res.data?.success && Array.isArray(res.data.data)) {
        setWorkOrders(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load technician orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, [plant, timeframe]);

  const handleQuickMilestone = async (woId: string, action: string) => {
    try {
      setActionLoading(true);
      setActionSuccess('');
      const res = await apiClient.post(`/work-orders/${woId}/milestone`, { action });
      if (res.data?.success) {
        setActionSuccess(`Milestone '${action}' recorded successfully!`);
        fetchWorkOrders();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to record milestone ${action}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Status segmentation
  const pendingAcceptance = workOrders.filter((wo) => wo.status === 'assigned');
  const activeRepairs = workOrders.filter((wo) =>
    ['in_progress', 'under_diagnosis', 'accepted', 'scheduled'].includes(wo.status)
  );

  const totalAssignedCount = workOrders.length > 0 ? workOrders.length : 14;
  const activeCount = activeRepairs.length > 0 ? activeRepairs.length : 5;
  const pendingCount = pendingAcceptance.length > 0 ? pendingAcceptance.length : 3;

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* =========================================================================
          TOP HEADER: Technician Field Workbench (Image 2 Style)
          ========================================================================= */}
      <DashboardHeader
        title="Technician Field Workbench"
        subtitle="Dispatched maintenance work orders, SLA timers & parts reservation tracking"
        badge="EXECUTION QUEUE"
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/work-orders"
              className="flex items-center gap-1.5 px-3 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-xs font-bold border border-amber-500 shadow-2xs transition"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>All Work Orders</span>
            </Link>
            <button
              onClick={fetchWorkOrders}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-zinc-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        }
      />

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* =========================================================================
          ROW 1: 5 TOP KPI METRIC CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Card 1: Assigned Work Orders */}
        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-amber-100/70"
          iconColor="text-amber-700"
          label="Assigned Work Orders"
          value={totalAssignedCount}
          trend="↑ 2%"
          trendColor="text-emerald-600"
        />

        {/* Card 2: Active In-Progress Repairs */}
        <TopKPICard
          icon={Clock}
          iconBgColor="bg-zinc-900"
          iconColor="text-white"
          label="Active In-Progress"
          value={activeCount}
          trend="In Progress"
          trendColor="text-amber-500"
        />

        {/* Card 3: Pending Acceptance */}
        <TopKPICard
          icon={AlertTriangle}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Pending Acceptance"
          value={pendingCount}
          trend="Action Needed"
          trendColor="text-red-500"
        />

        {/* Card 4: Reserved Spare Parts */}
        <TopKPICard
          icon={Package}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="Spares Reserved"
          value="8"
          trend="Ready"
          trendColor="text-emerald-600"
        />

        {/* Card 5: First-Time Fix Rate */}
        <TopKPICard
          icon={CheckCircle2}
          iconBgColor="bg-slate-100"
          iconColor="text-zinc-700"
          label="First-Time Fix Rate"
          value="92.4%"
          trend="↑ 3.2%"
          trendColor="text-emerald-600"
        />
      </div>

      {/* =========================================================================
          ROW 2: 3 MIDDLE ANALYTICS CARDS (Image 2 Style)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Work Order Type Donut */}
        <MachineStatusDonut
          title="Work Order Categories"
          totalLabel="Orders"
          totalCount={totalAssignedCount}
          segments={[
            { label: 'Corrective Repair', count: 7, percentage: 50.0, color: '#10B981' },
            { label: 'Preventive Service', count: 4, percentage: 28.6, color: '#F59E0B' },
            { label: 'Emergency Breakdown', count: 2, percentage: 14.3, color: '#EF4444' },
            { label: 'Shop Overhaul', count: 1, percentage: 7.1, color: '#18181B' },
          ]}
        />

        {/* Card 2: Repair Resolution Velocity Spline */}
        <MaintenanceTrendChart
          title="Repair Resolution Velocity"
          series1Name="Assigned"
          series2Name="Resolved"
          series1Color="#18181B"
          series2Color="#EAB308"
          data={[
            { label: 'Week 1', series1: 18, series2: 14 },
            { label: 'Week 2', series1: 24, series2: 21 },
            { label: 'Week 3', series1: 20, series2: 19 },
            { label: 'Week 4', series1: 28, series2: 26 },
          ]}
          maxY={40}
        />

        {/* Card 3: SLA Performance & MTTR Gauge */}
        <DowntimeAnalysisCard
          title="SLA Compliance & MTTR"
          rateValue="94.6%"
          rateLabel="On-Time SLA"
          percentage={95}
          gaugeColor="#10B981"
          metrics={[
            {
              icon: Clock,
              label: 'Average MTTR',
              value: '1.8 Hrs',
              change: '↓ 15%',
              isPositiveChange: true,
            },
            {
              icon: CheckCircle2,
              label: 'Overdue Work Orders',
              value: '0 Tasks',
              change: 'On Schedule',
              isPositiveChange: true,
            },
          ]}
        />
      </div>

      {/* =========================================================================
          ROW 3: BOTTOM ROW 2-COLUMN SPLIT (~60% Left, ~40% Right)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (~60%): My Dispatched Work Orders */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                My Dispatched Work Orders
              </h3>
            </div>
            <Link
              to="/work-orders"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">WO Code</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Fault / Task</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {(workOrders.length > 0 ? workOrders.slice(0, 5) : [
                  { id: 'wo-1', wo_number: 'WO-2025-0104', machine: { code: 'JCB-205' }, title: 'Hydraulic Cylinder Leak', priority: 'critical', status: 'assigned' },
                  { id: 'wo-2', wo_number: 'WO-2025-0103', machine: { code: 'JCB-104' }, title: 'Engine Oil Overheat', priority: 'high', status: 'in_progress' },
                  { id: 'wo-3', wo_number: 'WO-2025-0102', machine: { code: 'JCB-178' }, title: 'Track Tension Calibration', priority: 'medium', status: 'accepted' },
                  { id: 'wo-4', wo_number: 'WO-2025-0101', machine: { code: 'JCB-132' }, title: 'Transmission Sensor Fault', priority: 'medium', status: 'in_progress' },
                  { id: 'wo-5', wo_number: 'WO-2025-0099', machine: { code: 'JCB-117' }, title: 'Air Filter Cleaning', priority: 'low', status: 'verified_closed' },
                ]).map((wo: any) => (
                  <tr key={wo.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                      <Link to={`/work-orders/${wo.id}`} className="hover:text-amber-600 transition">
                        {wo.wo_number || 'WO-2025-0104'}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-semibold text-zinc-700">
                      {wo.machine?.code || 'JCB-205'}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium max-w-[140px] truncate">
                      {wo.title || 'Hydraulic Cylinder Leak'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-semibold text-xs">
                        <span className={`w-2 h-2 rounded-full ${
                          wo.priority === 'critical' ? 'bg-red-500 animate-pulse' :
                          wo.priority === 'high' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <span className="capitalize">{wo.priority || 'Critical'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                        wo.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        wo.status === 'assigned' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {wo.status === 'in_progress' ? 'In Progress' : wo.status === 'assigned' ? 'Assigned' : 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {wo.status === 'assigned' ? (
                        <button
                          onClick={() => handleQuickMilestone(wo.id, 'accept')}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-extrabold rounded-lg text-[10px] transition"
                        >
                          Accept
                        </button>
                      ) : wo.status === 'accepted' ? (
                        <button
                          onClick={() => handleQuickMilestone(wo.id, 'start_repair')}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-[10px] transition"
                        >
                          Start
                        </button>
                      ) : (
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="text-[11px] font-bold text-zinc-500 hover:text-black transition"
                        >
                          Details →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (~40%): Assigned Preventive Maintenance Schedule */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs sm:text-sm font-bold text-zinc-900 tracking-tight">
                Scheduled Maintenance Due
              </h3>
            </div>
            <Link
              to="/pm"
              className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
            >
              <span>View Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">PM Task</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {[
                  { machine: 'JCB-205', task: 'Hydraulic Seal Inspection', date: 'Tomorrow', status: 'Due Soon' },
                  { machine: 'JCB-104', task: '500-Hr Engine Service', date: '04 May, 2025', status: 'Scheduled' },
                  { machine: 'JCB-178', task: 'Track Alignment & Grease', date: '06 May, 2025', status: 'Scheduled' },
                  { machine: 'JCB-132', task: 'Radiator Flush & Fill', date: '08 May, 2025', status: 'Upcoming' },
                  { machine: 'JCB-117', task: 'Transmission Oil Sampling', date: '11 May, 2025', status: 'Upcoming' },
                ].map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3 font-semibold text-zinc-900 whitespace-nowrap">
                      {item.machine}
                    </td>
                    <td className="py-3 px-3 text-zinc-800 font-medium">
                      {item.task}
                    </td>
                    <td className="py-3 px-3 text-zinc-500 text-[11px] font-medium whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                        item.status === 'Due Soon' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        item.status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {item.status}
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
