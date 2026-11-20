import React, { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  PlantHierarchyNode,
  ShopHierarchyNode,
  BayHierarchyNode,
  LineHierarchyNode,
  OrgMachineInfo,
} from './types';
import {
  Building2,
  Layers,
  Cpu,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  User,
  Shield,
  AlertCircle,
  CheckCircle2,
  Network,
  ChevronsUpDown,
  Filter,
  ExternalLink,
  Info,
  Maximize2,
  Minimize2,
  Workflow,
  Factory,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const OrganizationalHierarchyPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';

  // Authorization check
  const isAuthorized = isAdmin || isManager;

  // Data states
  const [plants, setPlants] = useState<PlantHierarchyNode[]>([]);
  const [shops, setShops] = useState<ShopHierarchyNode[]>([]);
  const [bays, setBays] = useState<BayHierarchyNode[]>([]);
  const [lines, setLines] = useState<LineHierarchyNode[]>([]);
  const [machines, setMachines] = useState<OrgMachineInfo[]>([]);

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [expandedPlants, setExpandedPlants] = useState<Record<string, boolean>>({});
  const [expandedShops, setExpandedShops] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree');

  // Fetch complete organizational hierarchy from backend
  const fetchHierarchyData = useCallback(async () => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch hierarchy from GET /api/v1/org/hierarchy
      const hierarchyRes = await apiClient.get('/org/hierarchy');

      let plantsData: PlantHierarchyNode[] = [];
      let shopsData: ShopHierarchyNode[] = [];
      let baysData: BayHierarchyNode[] = [];
      let linesData: LineHierarchyNode[] = [];

      if (hierarchyRes.data?.success && hierarchyRes.data?.data) {
        plantsData = hierarchyRes.data.data.plants || [];
        shopsData = hierarchyRes.data.data.shops || [];
        baysData = hierarchyRes.data.data.bays || [];
        linesData = hierarchyRes.data.data.lines || [];
      } else if (hierarchyRes.data && Array.isArray(hierarchyRes.data.plants)) {
        plantsData = hierarchyRes.data.plants;
        shopsData = hierarchyRes.data.shops || [];
        baysData = hierarchyRes.data.bays || [];
        linesData = hierarchyRes.data.lines || [];
      }

      // If manager has a designated plant, scope to that plant
      const managerPlantId = user?.plantId || (user as any)?.plant_id;
      if (isManager && managerPlantId) {
        plantsData = plantsData.filter((p) => p.id === managerPlantId);
        shopsData = shopsData.filter((s) => s.plant_id === managerPlantId);
      }

      setPlants(plantsData);
      setShops(shopsData);
      setBays(baysData);
      setLines(linesData);

      // Initialize all plants expanded by default for quick overview
      const initialExpanded: Record<string, boolean> = {};
      plantsData.forEach((p) => {
        initialExpanded[p.id] = true;
      });
      setExpandedPlants(initialExpanded);

      if (plantsData.length > 0 && !selectedPlantId) {
        setSelectedPlantId(plantsData[0].id);
      }

      // 2. Fetch machine assets to accurately derive real shop and plant machine counts
      try {
        const machinesRes = await apiClient.get('/machines?limit=200');
        if (machinesRes.data?.success && Array.isArray(machinesRes.data?.data)) {
          setMachines(machinesRes.data.data);
        } else if (Array.isArray(machinesRes.data)) {
          setMachines(machinesRes.data);
        }
      } catch (mErr) {
        // Machine counts are supplementary; hierarchy remains fully operational if this fails
        console.warn('Machine inventory metrics unavailable:', mErr);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setErrorMsg('Access Restricted: You do not have permissions to view factory structure.');
      } else {
        setErrorMsg(
          err.response?.data?.message ||
            'Failed to load organizational structure from server. Please verify network connectivity.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, isManager, user?.plantId, selectedPlantId]);

  useEffect(() => {
    fetchHierarchyData();
  }, [fetchHierarchyData]);

  // Map machines to shops and plants
  const machinesByShop = useMemo(() => {
    const map: Record<string, OrgMachineInfo[]> = {};
    machines.forEach((m) => {
      if (m.shop_id) {
        if (!map[m.shop_id]) map[m.shop_id] = [];
        map[m.shop_id].push(m);
      }
    });
    return map;
  }, [machines]);

  const machinesByPlant = useMemo(() => {
    const map: Record<string, OrgMachineInfo[]> = {};
    machines.forEach((m) => {
      if (m.plant_id) {
        if (!map[m.plant_id]) map[m.plant_id] = [];
        map[m.plant_id].push(m);
      }
    });
    return map;
  }, [machines]);

  // Filtered plants and shops based on search query
  const filteredHierarchy = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return { plants, shops };

    const matchingShops = shops.filter(
      (s) =>
        s.shop_name.toLowerCase().includes(query) ||
        s.shop_code.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query))
    );

    const matchingPlantIdsFromShops = new Set(matchingShops.map((s) => s.plant_id));

    const matchingPlants = plants.filter(
      (p) =>
        p.plant_name.toLowerCase().includes(query) ||
        p.plant_code.toLowerCase().includes(query) ||
        (p.city && p.city.toLowerCase().includes(query)) ||
        (p.state && p.state.toLowerCase().includes(query)) ||
        (p.plant_manager && p.plant_manager.toLowerCase().includes(query)) ||
        matchingPlantIdsFromShops.has(p.id)
    );

    return { plants: matchingPlants, shops };
  }, [plants, shops, searchQuery]);

  // Toggle plant expand
  const togglePlantExpand = (plantId: string) => {
    setExpandedPlants((prev) => ({
      ...prev,
      [plantId]: !prev[plantId],
    }));
  };

  // Toggle shop expand
  const toggleShopExpand = (shopId: string) => {
    setExpandedShops((prev) => ({
      ...prev,
      [shopId]: !prev[shopId],
    }));
  };

  // Expand / Collapse All
  const handleExpandAll = () => {
    const allPlants: Record<string, boolean> = {};
    const allShops: Record<string, boolean> = {};
    plants.forEach((p) => (allPlants[p.id] = true));
    shops.forEach((s) => (allShops[s.id] = true));
    setExpandedPlants(allPlants);
    setExpandedShops(allShops);
  };

  const handleCollapseAll = () => {
    setExpandedPlants({});
    setExpandedShops({});
  };

  // Selected Plant details
  const activePlant = useMemo(() => {
    return plants.find((p) => p.id === selectedPlantId) || plants[0] || null;
  }, [plants, selectedPlantId]);

  const activePlantShops = useMemo(() => {
    if (!activePlant) return [];
    return shops.filter((s) => s.plant_id === activePlant.id);
  }, [shops, activePlant]);

  // Overall Statistics
  const totalStats = useMemo(() => {
    return {
      plantsCount: plants.length,
      shopsCount: shops.length,
      machinesCount: machines.length,
      linesCount: lines.length,
      baysCount: bays.length,
    };
  }, [plants, shops, machines, lines, bays]);

  // Unauthorized view
  if (!isAuthorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl border-2 border-zinc-200 shadow-md text-center space-y-4">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl mx-auto flex items-center justify-center">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-zinc-950 uppercase tracking-tight">
            Organizational Structure Access Restricted
          </h2>
          <p className="text-xs text-zinc-600 leading-relaxed">
            The Organizational Hierarchy Explorer is restricted to authorized Plant Managers and System
            Administrators. Please contact your site administrator if you require access.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-jcb-yellow text-zinc-950 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-2xs">
                  JCB STRUCTURE
                </span>
                <span className="text-xs font-mono font-bold text-zinc-500">
                  {isAdmin ? 'ENTERPRISE SCOPE' : `SCOPED: ${user?.plantName || 'ASSIGNED PLANT'}`}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight uppercase mt-0.5">
                Organizational Hierarchy Explorer
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Interactive topology of manufacturing plants, production shops, and commissioned equipment
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                Plants
              </span>
              <span className="text-lg font-black text-zinc-950">{totalStats.plantsCount}</span>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                Shops
              </span>
              <span className="text-lg font-black text-zinc-950">{totalStats.shopsCount}</span>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                Machines
              </span>
              <span className="text-lg font-black text-amber-600">{totalStats.machinesCount}</span>
            </div>
          </div>
        </div>

        {/* Action Controls & Filters Bar */}
        <div className="mt-5 pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plants, facilities, shops or codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white text-zinc-900 transition placeholder:text-zinc-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="bg-zinc-100 p-1 rounded-xl flex items-center border border-zinc-200">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'tree'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>Tree Topology</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Card Grid</span>
              </button>
            </div>

            {/* Expand / Collapse Controls */}
            {viewMode === 'tree' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Expand All Nodes"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  title="Collapse All Nodes"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={fetchHierarchyData}
              disabled={loading}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 p-4 rounded-2xl flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-black uppercase tracking-wide">Error Loading Hierarchy: </span>
              <span>{errorMsg}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchHierarchyData}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-12 text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <h3 className="text-sm font-black text-zinc-800 uppercase tracking-wider">
            Querying Enterprise Hierarchy...
          </h3>
          <p className="text-xs text-zinc-500">
            Resolving manufacturing plants, operational shops, and machine mappings
          </p>
        </div>
      ) : filteredHierarchy.plants.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-2xl mx-auto flex items-center justify-center">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">
            No Organizational Nodes Found
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            {searchQuery
              ? `No plants or shops match "${searchQuery}". Please check your search terms.`
              : 'No active manufacturing plants are currently assigned to this account scope.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-3.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      ) : viewMode === 'tree' ? (
        /* TREE TOPOLOGY VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Visual Hierarchy Tree (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Manufacturing Plants ({filteredHierarchy.plants.length})
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">Click to inspect plant & shops</span>
            </div>

            {filteredHierarchy.plants.map((plant) => {
              const plantShops = shops.filter((s) => s.plant_id === plant.id);
              const plantMachines = machinesByPlant[plant.id] || [];
              const isExpanded = !!expandedPlants[plant.id];
              const isSelected = selectedPlantId === plant.id;

              return (
                <div
                  key={plant.id}
                  className={`bg-white rounded-2xl border-2 transition-all shadow-xs overflow-hidden ${
                    isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-zinc-200'
                  }`}
                >
                  {/* Plant Header Card */}
                  <div
                    onClick={() => {
                      setSelectedPlantId(plant.id);
                      togglePlantExpand(plant.id);
                    }}
                    className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-zinc-50/70 transition"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlantExpand(plant.id);
                        }}
                        className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-500 transition mt-0.5 sm:mt-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-800" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>

                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded border border-zinc-200">
                            {plant.plant_code}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {plant.status}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-black text-zinc-950 uppercase tracking-tight mt-1">
                          {plant.plant_name}
                        </h3>
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span>
                            {plant.city || 'Facility'}, {plant.state || 'India'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Shops</span>
                        <span className="text-xs font-black text-zinc-900">{plantShops.length}</span>
                      </div>
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">Machines</span>
                        <span className="text-xs font-black text-amber-600">{plantMachines.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nested Shops (Tree Branch) */}
                  {isExpanded && (
                    <div className="bg-zinc-50/50 border-t border-zinc-200 p-3 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400 px-2">
                        <span>Production Shops ({plantShops.length})</span>
                        <span>Equipments</span>
                      </div>

                      {plantShops.length === 0 ? (
                        <div className="bg-white p-4 rounded-xl border border-zinc-200 text-center text-xs text-zinc-500">
                          No production shops currently registered under this plant.
                        </div>
                      ) : (
                        plantShops.map((shop) => {
                          const shopMachines = machinesByShop[shop.id] || [];
                          const isShopExpanded = !!expandedShops[shop.id];
                          const isShopSelected = selectedShopId === shop.id;

                          return (
                            <div
                              key={shop.id}
                              className={`bg-white rounded-xl border transition-all ${
                                isShopSelected
                                  ? 'border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                                  : 'border-zinc-200 hover:border-zinc-300'
                              }`}
                            >
                              <div
                                onClick={() => {
                                  setSelectedShopId(shop.id);
                                  toggleShopExpand(shop.id);
                                }}
                                className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleShopExpand(shop.id);
                                    }}
                                    className="p-1 rounded hover:bg-zinc-100 text-zinc-400"
                                  >
                                    {isShopExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-zinc-700" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                                    )}
                                  </button>

                                  <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                                    <Factory className="w-4 h-4" />
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] font-black bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-zinc-200">
                                        {shop.shop_code}
                                      </span>
                                      <span className="text-xs font-black text-zinc-950 uppercase tracking-tight">
                                        {shop.shop_name}
                                      </span>
                                    </div>
                                    {shop.description && (
                                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                                        {shop.description}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    {shopMachines.length} Machines
                                  </span>
                                </div>
                              </div>

                              {/* Nested Shop Detail & Machine Level */}
                              {isShopExpanded && (
                                <div className="p-3 border-t border-zinc-100 bg-zinc-50/70 rounded-b-xl space-y-3 text-xs">
                                  {/* Assembly Line & Bays Status Section */}
                                  <div className="bg-white p-2.5 rounded-lg border border-zinc-200">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-400 mb-1">
                                      <span className="flex items-center gap-1">
                                        <Layers className="w-3 h-3 text-zinc-500" />
                                        Assembly Lines & Bay Partitions
                                      </span>
                                      <span>Database Status</span>
                                    </div>
                                    <p className="text-[11px] text-zinc-600">
                                      {lines.filter((l) => l.shop_id === shop.id).length > 0 ? (
                                        <span>
                                          Configured Lines:{' '}
                                          {lines
                                            .filter((l) => l.shop_id === shop.id)
                                            .map((l) => l.line_name)
                                            .join(', ')}
                                        </span>
                                      ) : (
                                        <span className="text-zinc-500 italic">
                                          No dedicated assembly line partitions configured for this shop. All
                                          machinery operates on the primary shop floor.
                                        </span>
                                      )}
                                    </p>
                                  </div>

                                  {/* Machinery Assets in Shop */}
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-zinc-400 mb-1.5 px-1">
                                      <span>Commissioned Assets ({shopMachines.length})</span>
                                      <Link
                                        to="/machines"
                                        className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-0.5"
                                      >
                                        <span>View in Asset Master</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                      </Link>
                                    </div>

                                    {shopMachines.length === 0 ? (
                                      <div className="p-2.5 text-center text-zinc-400 text-[11px] bg-white rounded-lg border border-zinc-200">
                                        No active machines mapped to this shop ID.
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {shopMachines.map((m) => (
                                          <div
                                            key={m.id}
                                            className="bg-white p-2 rounded-lg border border-zinc-200 flex items-center justify-between gap-2"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <Cpu className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                              <div className="truncate">
                                                <span className="font-mono font-black text-xs text-zinc-900 block truncate">
                                                  {m.machine_code}
                                                </span>
                                                <span className="text-[10px] text-zinc-500 truncate block">
                                                  {m.name}
                                                </span>
                                              </div>
                                            </div>
                                            <span
                                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                m.status === 'operational'
                                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                  : m.status === 'breakdown'
                                                  ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse'
                                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                                              }`}
                                            >
                                              {m.status || 'Active'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Node Inspector (5 cols) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="px-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                Facility & Operational Overview
              </span>
            </div>

            {activePlant ? (
              <div className="bg-white rounded-2xl border-2 border-zinc-200 p-5 shadow-xs space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-4">
                  <div>
                    <span className="bg-jcb-yellow text-zinc-950 font-mono text-xs font-black px-2 py-0.5 rounded shadow-2xs">
                      {activePlant.plant_code}
                    </span>
                    <h2 className="text-lg font-black text-zinc-950 uppercase tracking-tight mt-1.5">
                      {activePlant.plant_name}
                    </h2>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      <span>
                        {activePlant.address || 'Industrial Area'}, {activePlant.city}, {activePlant.state} -{' '}
                        {activePlant.pin_code || '100001'}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Operational
                  </span>
                </div>

                {/* Key Facility Personnel & Contacts */}
                <div className="space-y-2.5">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    Facility Administration
                  </h4>
                  <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        Plant Manager
                      </span>
                      <span className="font-black text-zinc-900">
                        {activePlant.plant_manager || 'Site Director'}
                      </span>
                    </div>
                    {activePlant.contact_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-zinc-400" />
                          Direct Phone
                        </span>
                        <a
                          href={`tel:${activePlant.contact_number}`}
                          className="font-mono font-bold text-amber-600 hover:underline"
                        >
                          {activePlant.contact_number}
                        </a>
                      </div>
                    )}
                    {activePlant.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-zinc-400" />
                          Corporate Email
                        </span>
                        <a
                          href={`mailto:${activePlant.email}`}
                          className="font-mono font-bold text-amber-600 hover:underline"
                        >
                          {activePlant.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plant Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                      Production Shops
                    </span>
                    <span className="text-xl font-black text-zinc-900">{activePlantShops.length}</span>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">
                      Assigned Machinery
                    </span>
                    <span className="text-xl font-black text-amber-600">
                      {(machinesByPlant[activePlant.id] || []).length}
                    </span>
                  </div>
                </div>

                {/* Shop Directory in this Plant */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    Shops in {activePlant.plant_name}
                  </h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {activePlantShops.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedShopId(s.id)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                          selectedShopId === s.id
                            ? 'bg-amber-50/50 border-amber-400 font-bold'
                            : 'bg-white border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-black bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
                            {s.shop_code}
                          </span>
                          <span className="text-zinc-900 font-bold">{s.shop_name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {(machinesByShop[s.id] || []).length} mach.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit & Compliance Disclaimer */}
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-[11px] text-zinc-500 flex items-start gap-2">
                  <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <span>
                    Plant structural data is managed via JCB Enterprise Core Master Services. Changes require
                    corporate administrator authorization.
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-zinc-200 p-8 text-center text-zinc-400 text-xs">
                Select a plant node from the tree to inspect details.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredHierarchy.plants.map((plant) => {
              const plantShops = shops.filter((s) => s.plant_id === plant.id);
              const plantMachines = machinesByPlant[plant.id] || [];

              return (
                <div
                  key={plant.id}
                  className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs hover:border-zinc-300 transition overflow-hidden flex flex-col"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-zinc-100 bg-zinc-50/40">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="bg-jcb-yellow text-zinc-950 font-mono text-xs font-black px-2 py-0.5 rounded shadow-2xs">
                        {plant.plant_code}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {plant.status}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                      {plant.plant_name}
                    </h3>
                    <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>
                        {plant.city || 'Facility'}, {plant.state || 'India'}
                      </span>
                    </p>
                  </div>

                  {/* Card Body: Summary Stats & Leadership */}
                  <div className="p-5 space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">
                          Shops
                        </span>
                        <span className="text-lg font-black text-zinc-900">{plantShops.length}</span>
                      </div>
                      <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                        <span className="text-[10px] font-black uppercase text-zinc-400 block">
                          Machines
                        </span>
                        <span className="text-lg font-black text-amber-600">{plantMachines.length}</span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 font-medium">Head of Plant:</span>
                        <span className="font-bold text-zinc-900">
                          {plant.plant_manager || 'Plant Director'}
                        </span>
                      </div>
                      {plant.contact_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 font-medium">Contact:</span>
                          <span className="font-mono font-bold text-zinc-700">
                            {plant.contact_number}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Associated Shops Tag List */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                        Operational Shops ({plantShops.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {plantShops.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 text-zinc-800 text-[11px] font-bold border border-zinc-200"
                          >
                            <Factory className="w-3 h-3 text-zinc-500" />
                            <span>{s.shop_name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3 bg-zinc-50 border-t border-zinc-200 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlantId(plant.id);
                        setViewMode('tree');
                      }}
                      className="text-xs font-black text-zinc-800 hover:text-black uppercase tracking-wider transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore Plant Topology</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
