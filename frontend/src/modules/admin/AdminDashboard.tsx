
import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import { useSocket } from '../../context/SocketContext';
import {
  Users,
  Building2,
  Cpu,
  Wrench,
  RefreshCw,
  AlertCircle,
  Package,
  Boxes,
  AlertTriangle,
  CircleOff,
  ArrowRight,
  Plus,
  Activity,
  AlertOctagon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardHeader } from '../../components/dashboard/DashboardHeader';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import { UserRoleDonutChart, UserRoleSegment } from '../../components/dashboard/UserRoleDonutChart';
import { MachineStatusBarChart, MachineStatusBarItem } from '../../components/dashboard/MachineStatusBarChart';
import { MaintenanceTrendChart, TrendDataPoint } from '../../components/dashboard/MaintenanceTrendChart';
import { PlantComparisonChart, PlantNetworkItem } from '../../components/dashboard/PlantComparisonChart';
import { TopDowntimeMachinesCard, DowntimeMachineItem } from '../../components/dashboard/TopDowntimeMachinesCard';
import { WorkOrdersQueueTable } from '../../components/dashboard/WorkOrdersQueueTable';

export const AdminDashboard: React.FC = () => {
  const { socket } = useSocket();

  const [plant, setPlant] = useState('All Plants');
  const [timeframe, setTimeframe] = useState('Last 30 Days');
  const [users, setUsers] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [inventoryStats, setInventoryStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [liveWorkOrders, setLiveWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlantId = useMemo(() => {
    if (plant === 'All Plants') return undefined;

    const selected = hierarchy?.plants?.find(
      (p: any) => p.plant_name === plant
    );

    return selected?.id;
  }, [plant, hierarchy]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const plantParams = selectedPlantId
        ? { plant_id: selectedPlantId }
        : {};

      const [usersRes, orgRes, kpiRes, inventoryRes, trendRes, workOrdersRes] = await Promise.all([
        apiClient.get('/auth/users', {
          params: { limit: 100, ...plantParams },
        }).catch(() => ({ data: { data: [] } })),

        apiClient.get('/org/hierarchy', {
          params: plantParams,
        }).catch(() => ({ data: { data: null } })),

        apiClient.get('/reports/dashboard-kpis', {
          params: {
            ...plantParams,
            timeframe,
          },
        }),

        apiClient.get('/inventory/dashboard', {
          params: plantParams,
        }).catch(() => ({ data: { data: null } })),

        apiClient.get('/reports/maintenance-trend', {
          params: plantParams,
        }).catch(() => ({ data: { data: [] } })),

        apiClient.get('/work-orders', {
          params: { limit: 10, ...plantParams },
        }).catch(() => ({ data: { data: [] } })),
      ]);

      let fetchedUsers = usersRes.data?.data || [];

      if (selectedPlantId) {
        fetchedUsers = fetchedUsers.filter(
          (u: any) => u.plant_id === selectedPlantId
        );
      }

      setUsers(fetchedUsers);
      setHierarchy(orgRes.data?.data || null);
      setKpiStats(kpiRes.data?.data || null);
      setInventoryStats(inventoryRes.data?.data || null);
      setTrendData(trendRes.data?.data || []);
      setLiveWorkOrders(workOrdersRes.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);

      setError(
        err.response?.data?.message ||
        'Unable to retrieve dashboard data from the backend.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [plant, timeframe, selectedPlantId]);

  // Real-time Socket.IO auto-refresh
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
  }, [socket, plant, timeframe, selectedPlantId]);

  // Dynamic plant options
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

  // User and machine KPIs
  const totalUsers = selectedPlantId
    ? users.length
    : (kpiStats?.total_users ?? users.length);
  const adminCount = selectedPlantId
    ? users.filter((u) => u.role === 'admin').length
    : (kpiStats?.admin_count ?? users.filter((u) => u.role === 'admin').length);
  const managerCount = selectedPlantId
    ? users.filter((u) => u.role === 'manager').length
    : (kpiStats?.manager_count ?? users.filter((u) => u.role === 'manager').length);
  const techCount = selectedPlantId
    ? users.filter((u) => u.role === 'technician').length
    : (kpiStats?.technician_count ?? users.filter((u) => u.role === 'technician').length);
  const operatorCount = selectedPlantId
    ? users.filter((u) => u.role === 'operator').length
    : (kpiStats?.operator_count ?? users.filter((u) => u.role === 'operator').length);

  const plantsCount = selectedPlantId
    ? 1
    : hierarchy?.plants?.length ?? kpiStats?.total_plants ?? 0;

  const totalAssets = kpiStats?.total_machines ?? 0;

  // User role distribution
  const userSegments: UserRoleSegment[] = useMemo(() => {
    if (totalUsers === 0) return [];

    return [
      {
        label: 'Technicians',
        count: techCount,
        percentage: (techCount / totalUsers) * 100,
        color: '#10B981',
      },
      {
        label: 'Operators',
        count: operatorCount,
        percentage: (operatorCount / totalUsers) * 100,
        color: '#F59E0B',
      },
      {
        label: 'Managers',
        count: managerCount,
        percentage: (managerCount / totalUsers) * 100,
        color: '#3B82F6',
      },
      {
        label: 'System Admins',
        count: adminCount,
        percentage: (adminCount / totalUsers) * 100,
        color: '#18181B',
      },
    ];
  }, [totalUsers, techCount, operatorCount, managerCount, adminCount]);

  // Machine status breakdown for horizontal bar chart
  const machineStatusItems: MachineStatusBarItem[] = useMemo(() => [
    {
      statusKey: 'running',
      label: 'Running',
      count: Number(kpiStats?.running_machines ?? 0),
      color: '#16A34A',
      description: 'Active & operating on the production line',
    },
    {
      statusKey: 'idle',
      label: 'Idle / Not Working',
      count: Number(kpiStats?.idle_machines ?? 0),
      color: '#64748B',
      description: 'Standby mode with no active production task',
    },
    {
      statusKey: 'breakdown',
      label: 'Breakdown',
      count: Number(kpiStats?.breakdown_machines ?? 0),
      color: '#DC2626',
      description: 'Critical stoppage requiring immediate technician action',
    },
    {
      statusKey: 'maintenance',
      label: 'Under Maintenance',
      count: Number(kpiStats?.maintenance_machines ?? 0),
      color: '#F59E0B',
      description: 'Scheduled preventive or corrective maintenance underway',
    },
    {
      statusKey: 'awaiting_parts',
      label: 'Awaiting Parts',
      count: Number(kpiStats?.awaiting_parts_machines ?? 0),
      color: '#2563EB',
      description: 'Repairs on hold pending spare parts fulfillment',
    },
  ], [kpiStats]);

  // Plant network
  const plantNetwork = useMemo(() => {
    const network = Array.isArray(kpiStats?.plant_network)
      ? kpiStats.plant_network
      : [];

    return selectedPlantId
      ? network.filter((p: any) => p.id === selectedPlantId)
      : network;
  }, [kpiStats, selectedPlantId]);

  // Multi-plant comparison data
  const comparisonPlants: PlantNetworkItem[] = useMemo(() => {
    const network = Array.isArray(kpiStats?.plant_network)
      ? kpiStats.plant_network
      : [];

    return network.map((p: any) => ({
      id: p.id,
      plant_code: p.plant_code,
      plant_name: p.plant_name,
      city: p.city,
      state: p.state,
      plant_status: p.plant_status,
      shop_count: Number(p.shop_count || 0),
      machine_count: Number(p.machine_count || 0),
      active_machines: Number(p.active_machines || 0),
    }));
  }, [kpiStats]);

  // Top downtime machines for leaderboard
  const topDowntimeMachines: DowntimeMachineItem[] = useMemo(() => {
    const list = Array.isArray(kpiStats?.top_downtime_machines)
      ? kpiStats.top_downtime_machines
      : [];

    return list.map((m: any) => ({
      machine_code: m.machine_code || '—',
      name: m.name || 'Equipment Unit',
      shop_name: m.shop_name || 'Production Line',
      downtime_minutes: Number(m.downtime_minutes || 0),
      failure_count: Number(m.failure_count || 0),
    }));
  }, [kpiStats]);

  const totalShops = useMemo(() => {
    const shops = Array.isArray(hierarchy?.shops)
      ? hierarchy.shops
      : [];

    if (selectedPlantId) {
      return shops.filter(
        (shop: any) => shop.plant_id === selectedPlantId
      ).length;
    }

    return shops.length || Number(kpiStats?.total_shops ?? 0);
  }, [hierarchy, selectedPlantId, kpiStats]);

  // Inventory summary
  const inventorySummary = inventoryStats?.summary || {};

  const inventoryCategories = Array.isArray(
    inventoryStats?.category_breakdown
  )
    ? inventoryStats.category_breakdown
    : [];

  const totalSKUs = Number(inventorySummary.total_parts ?? 0);

  const availableStock = Number(
    inventorySummary.total_available_stock ?? 0
  );

  const lowStockCount = Number(
    inventorySummary.low_stock_items_count ?? 0
  );

  const outOfStockCount = Number(
    inventorySummary.out_of_stock_count ?? 0
  );

  const physicalStock = Number(
    inventorySummary.total_physical_stock ?? 0
  );

  const categoryColors = [
    '#2563EB',
    '#16A34A',
    '#D97706',
    '#9333EA',
    '#0891B2',
    '#DC2626',
    '#64748B',
    '#DB2777',
  ];

  const maxCategoryStock = Math.max(
    ...inventoryCategories.map((category: any) =>
      Number(category.available_stock ?? 0)
    ),
    0
  );

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('en-IN').format(value);

  return (
    <div className="space-y-6 min-h-full pb-8">
      {/* TOP HEADER */}
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Manage users, plants, machines, and activity across JCB plants"
        badge="Admin"
        plantOptions={plantOptions}
        selectedPlant={plant}
        onPlantChange={setPlant}
        selectedTimeframe={timeframe}
        onTimeframeChange={setTimeframe}
        actions={
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-[13px] sm:text-sm font-semibold text-zinc-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading
                  ? 'animate-spin text-amber-600'
                  : 'text-zinc-500'
                }`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      {/* COMPACT PLANT FILTER */}
      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
        <button
          key="all-plants"
          onClick={() => setPlant('All Plants')}
          className={`px-4.5 py-1.5 sm:px-5 sm:py-2 rounded-full text-[13px] sm:text-sm font-semibold border transition-all duration-200 ${plant === 'All Plants'
              ? 'bg-amber-400 border-amber-500 text-black shadow-sm'
              : 'bg-white border-slate-200 text-zinc-600 hover:border-amber-400 hover:bg-amber-50'
            }`}
        >
          All Plants
        </button>
        {hierarchy?.plants?.map((p: any) => {
          const isSelected = plant === p.plant_name;

          return (
            <button
              key={p.id}
              onClick={() => setPlant(p.plant_name)}
              className={`px-4.5 py-1.5 sm:px-5 sm:py-2 rounded-full text-[13px] sm:text-sm font-semibold border transition-all duration-200 ${isSelected
                  ? 'bg-amber-400 border-amber-500 text-black shadow-sm'
                  : 'bg-white border-slate-200 text-zinc-600 hover:border-amber-400 hover:bg-amber-50'
                }`}
            >
              {p.plant_name}
            </button>
          );
        })}
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs sm:text-[13px] text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ROW 1: EXECUTIVE KPI STRIP (7 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        <TopKPICard
          icon={Building2}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-800"
          label="Active Plants"
          value={plantsCount}
          subtitle={`${totalShops} Active Shops`}
        />

        <TopKPICard
          icon={Building2}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Total Shops"
          value={totalShops}
          subtitle="Registered Facilities"
        />

        <TopKPICard
          icon={Cpu}
          iconBgColor="bg-zinc-100"
          iconColor="text-zinc-800"
          label="Total Machines"
          value={totalAssets}
          subtitle={`${kpiStats?.running_machines ?? 0} Running • ${kpiStats?.breakdown_machines ?? 0
            } Down`}
        />

        <TopKPICard
          icon={Activity}
          iconBgColor="bg-emerald-100"
          iconColor="text-emerald-800"
          label="Fleet Availability"
          value={`${kpiStats?.machine_availability_percent ?? 0}%`}
          subtitle={`${kpiStats?.running_machines ?? 0} Active Running`}
          trend={Number(kpiStats?.machine_availability_percent ?? 0) >= 85 ? 'Optimal' : 'Caution'}
        />

        <TopKPICard
          icon={AlertOctagon}
          iconBgColor="bg-red-100"
          iconColor="text-red-700"
          label="Critical Breakdowns"
          value={kpiStats?.breakdown_machines ?? 0}
          subtitle={`${kpiStats?.downtime_rate_percent ?? 0}% Stoppage Rate`}
          trend={Number(kpiStats?.breakdown_machines ?? 0) > 0 ? 'Action Req.' : 'Nominal'}
          trendColor={
            Number(kpiStats?.breakdown_machines ?? 0) > 0
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }
        />

        <TopKPICard
          icon={Wrench}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-800"
          label="Total Work Orders"
          value={kpiStats?.total_work_orders ?? 0}
          subtitle={`${kpiStats?.active_work_orders ?? 0} Active • ${kpiStats?.completed_work_orders ?? 0
            } Done`}
        />

        <TopKPICard
          icon={Users}
          iconBgColor="bg-amber-100"
          iconColor="text-amber-800"
          label="Total Users"
          value={totalUsers}
          subtitle={`${techCount} Techs • ${operatorCount} Ops`}
        />
        
      </div>

      {/* ROW 2: USER AND MACHINE ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* MACHINE STATUS OVERVIEW */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                  Machine Status Overview
                </h3>
                <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                  Live operating condition of all factory assets
                </p>
              </div>

              <Link
                to="/machines"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-[13px] sm:text-sm font-semibold border border-amber-500 shadow-2xs transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Machine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <MachineStatusBarChart
              totalCount={totalAssets}
              items={machineStatusItems}
              loading={loading}
              emptyMessage="No machines registered in the selected plant"
            />
          </div>

          <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
            <span className="text-zinc-500 font-normal">
              Total Factory Fleet:{' '}
              <strong className="text-zinc-900 font-mono font-semibold">
                {totalAssets} Machines
              </strong>
            </span>
            <span className="text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-xs">
              {totalAssets > 0
                ? ((Number(kpiStats?.running_machines ?? 0) / totalAssets) * 100).toFixed(0)
                : 0}
              % Operational
            </span>
          </div>
        </div>

        {/* USER ROLE DISTRIBUTION */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                  User Role Distribution
                </h3>
                <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                  Allocated personnel across active operations
                </p>
              </div>

              <Link
                to="/users"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-[13px] sm:text-sm font-semibold border border-amber-500 shadow-2xs transition shrink-0"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff Personnel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <UserRoleDonutChart
              totalCount={totalUsers}
              segments={userSegments}
              emptyMessage="No personnel registered in system"
              loading={loading}
            />
          </div>

          <div className="flex items-center justify-between pt-4 mt-5 border-t border-slate-100 text-[13px]">
            <span className="text-zinc-500 font-normal">
              Registered Workforce:{' '}
              <strong className="text-zinc-900 font-mono font-semibold">
                {totalUsers} Personnel
              </strong>
            </span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-xs">
              Active Roster
            </span>
          </div>
        </div>
      </div>

      {/* ROW 3: OPERATIONAL TRENDS & MULTI-PLANT COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <MaintenanceTrendChart
          title="Operational Maintenance Trends"
          subtitle="4-week velocity of Corrective vs. Preventive maintenance work orders"
          data={trendData}
          loading={loading}
        />

        <PlantComparisonChart
          plants={comparisonPlants}
          selectedPlant={plant}
          onSelectPlant={setPlant}
          loading={loading}
        />
      </div>

      {/* ROW 4: EQUIPMENT RISK & WORK ORDER EXECUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5">
          <TopDowntimeMachinesCard
            machines={topDowntimeMachines}
            loading={loading}
          />
        </div>

        <div className="lg:col-span-7">
          <WorkOrdersQueueTable
            workOrders={liveWorkOrders}
            loading={loading}
          />
        </div>
      </div>

      {/* ROW 5: SPARE PARTS INVENTORY */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                Spare Parts Inventory
              </h3>
              <p className="text-xs sm:text-[13px] text-zinc-500 font-normal mt-0.5">
                Live inventory summary from the database
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              {plant === 'All Plants'
                ? 'All Plants Inventory'
                : `${plant} Inventory`}
            </span>

            <Link
              to="/inventory"
              className="inline-flex items-center gap-2 px-4 py-2 bg-jcb-yellow hover:bg-amber-400 text-black rounded-xl text-[13px] sm:text-sm font-semibold border border-amber-500 shadow-2xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Spare Part</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* INVENTORY KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <span className="text-[13px] sm:text-sm font-semibold text-zinc-600 truncate">
                Total Spare Part SKUs
              </span>
              <Package className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            <p className="text-[28px] sm:text-3xl font-bold font-mono text-zinc-900 mt-3 leading-tight">
              {loading ? '—' : formatNumber(totalSKUs)}
            </p>
            <p className="text-xs text-zinc-500 font-normal mt-1 truncate">
              Active registered parts
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70">
            <div className="flex items-center justify-between">
              <span className="text-[13px] sm:text-sm font-semibold text-zinc-600 truncate">
                Available Stock
              </span>
              <Boxes className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <p className="text-[28px] sm:text-3xl font-bold font-mono text-emerald-700 mt-3 leading-tight">
              {loading ? '—' : formatNumber(availableStock)}
            </p>
            <p className="text-xs text-zinc-500 font-normal mt-1 truncate">
              Units available for use
            </p>
          </div>

          <div className="rounded-xl border border-amber-200 p-4 bg-amber-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[13px] sm:text-sm font-semibold text-zinc-600 truncate">
                Low Stock Items
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <p className="text-[28px] sm:text-3xl font-bold font-mono text-amber-700 mt-3 leading-tight">
              {loading ? '—' : formatNumber(lowStockCount)}
            </p>
            <p className="text-xs text-zinc-500 font-normal mt-1 truncate">
              At or below reorder level
            </p>
          </div>

          <div className="rounded-xl border border-red-200 p-4 bg-red-50/50">
            <div className="flex items-center justify-between">
              <span className="text-[13px] sm:text-sm font-semibold text-zinc-600 truncate">
                Out of Stock
              </span>
              <CircleOff className="w-4 h-4 text-red-600 shrink-0" />
            </div>
            <p className="text-[28px] sm:text-3xl font-bold font-mono text-red-700 mt-3 leading-tight">
              {loading ? '—' : formatNumber(outOfStockCount)}
            </p>
            <p className="text-xs text-zinc-500 font-normal mt-1 truncate">
              Items with zero physical stock
            </p>
          </div>
        </div>

        {/* INVENTORY ANALYTICS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
          {/* CATEGORY DISTRIBUTION */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[15px] sm:text-base font-semibold text-zinc-800">
                Spare Parts Categories
              </h4>
              <span className="text-xs text-zinc-500 font-normal">
                SKU distribution
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[13px] text-zinc-400 font-normal">
                Loading categories...
              </div>
            ) : inventoryCategories.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-zinc-400 font-normal">
                No spare part categories found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {inventoryCategories.map((category: any, index: number) => {
                  const colors = [
                    'bg-blue-50 border-blue-200 text-blue-700',
                    'bg-emerald-50 border-emerald-200 text-emerald-700',
                    'bg-amber-50 border-amber-200 text-amber-700',
                    'bg-purple-50 border-purple-200 text-purple-700',
                    'bg-cyan-50 border-cyan-200 text-cyan-700',
                    'bg-rose-50 border-rose-200 text-rose-700',
                  ];

                  return (
                    <div
                      key={`${category.category}-${index}`}
                      className={`rounded-xl border p-4 ${colors[index % colors.length]
                        }`}
                    >
                      <p className="text-[13px] sm:text-sm font-semibold truncate">
                        {category.category || 'Uncategorized'}
                      </p>
                      <p className="text-2xl font-bold font-mono mt-2 leading-none">
                        {formatNumber(Number(category.part_count ?? 0))}
                      </p>
                      <p className="text-xs font-normal opacity-85 mt-1">
                        Spare Part SKUs
                      </p>
                      <div className="mt-3 pt-2 border-t border-current/10">
                        <p className="text-xs font-semibold">
                          {formatNumber(Number(category.available_stock ?? 0))} units available
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AVAILABLE STOCK BY CATEGORY */}
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[15px] sm:text-base font-semibold text-zinc-800">
                Available Stock by Category
              </h4>
              <span className="text-xs text-zinc-500 font-normal">
                Units
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[13px] text-zinc-400 font-normal">
                Loading category stock...
              </div>
            ) : inventoryCategories.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-zinc-400 font-normal">
                No category inventory data available
              </div>
            ) : (
              <div className="space-y-5">
                {inventoryCategories.map((category: any, index: number) => {
                  const stock = Number(category.available_stock ?? 0);
                  const percentage =
                    maxCategoryStock > 0
                      ? (stock / maxCategoryStock) * 100
                      : 0;

                  return (
                    <div key={`${category.category}-${index}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[13px] sm:text-sm font-semibold text-zinc-700 truncate">
                          {category.category || 'Uncategorized'}
                        </span>
                        <span className="text-[13px] sm:text-sm font-bold font-mono text-zinc-900 whitespace-nowrap">
                          {formatNumber(stock)}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor:
                              categoryColors[index % categoryColors.length],
                          }}
                        />
                      </div>

                      <div className="flex justify-between mt-1.5">
                        <span className="text-xs text-zinc-500">
                          {formatNumber(Number(category.part_count ?? 0))} SKUs
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatNumber(Number(category.physical_stock ?? 0))} physical units
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* INVENTORY FOOTER */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-[13px] font-normal text-zinc-500">
              Total Physical Stock
            </span>
            <span className="text-sm font-bold font-mono text-zinc-900">
              {loading ? '—' : formatNumber(physicalStock)}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-[13px] font-normal text-zinc-500">
              Categories Registered
            </span>
            <span className="text-sm font-bold font-mono text-zinc-900">
              {loading ? '—' : formatNumber(inventoryCategories.length)}
            </span>
          </div>
        </div>
      </div>

      {/* ROW 6: ACTIVE PLANTS & SHOPS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
              Active Plants & Shops
            </h3>
          </div>

          <Link
            to="/machines"
            className="text-[13px] sm:text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
          >
            <span>View Machines</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 text-[13px] font-semibold text-zinc-600">
                <th className="py-3 px-3.5">Plant Location</th>
                <th className="py-3 px-3.5">Shops</th>
                <th className="py-3 px-3.5">Machines</th>
                <th className="py-3 px-3.5">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm text-zinc-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-[13px] text-zinc-400 font-normal"
                  >
                    Loading facility network...
                  </td>
                </tr>
              ) : plantNetwork.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-[13px] text-zinc-400 font-normal"
                  >
                    No plant facilities registered in database.
                  </td>
                </tr>
              ) : (
                plantNetwork.map((p: any) => (
                  <tr
                    key={p.id}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3 px-3.5 font-semibold text-zinc-900">
                      {p.plant_name}
                    </td>

                    <td className="py-3 px-3.5 text-zinc-600 font-normal">
                      {p.shop_count} Shops
                    </td>

                    <td className="py-3 px-3.5 font-mono font-semibold text-zinc-950">
                      {p.machine_count}
                    </td>

                    <td className="py-3 px-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border capitalize ${p.plant_status === 'active'
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
  );
};
