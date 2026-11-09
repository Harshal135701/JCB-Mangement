import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Machine, Plant, Shop } from './types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { MachineCreateModal } from './components/MachineCreateModal';
import { MachineEditModal } from './components/MachineEditModal';
import { MachineDeleteModal } from './components/MachineDeleteModal';
import { MachineHistoryModal } from './components/MachineHistoryModal';
import { MachineQrLookupModal } from './components/MachineQrLookupModal';
import {
  Cpu,
  QrCode,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  History,
  Building,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  Layers,
  ArrowUpDown,
} from 'lucide-react';

export const MachineMasterPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canEdit = isAdmin || isManager;

  // Data & Pagination State
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [selectedShopId, setSelectedShopId] = useState('');
  const [excludeDecommissioned, setExcludeDecommissioned] = useState(false);
  const [sortBy, setSortBy] = useState('machine_code');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Org options for filtering
  const [plants, setPlants] = useState<Plant[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQrLookupOpen, setIsQrLookupOpen] = useState(false);

  const [activeMachine, setActiveMachine] = useState<Machine | null>(null);
  const [historyMachineId, setHistoryMachineId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Load plants and shops for filter dropdowns
  useEffect(() => {
    const fetchOrgFilters = async () => {
      try {
        const res = await apiClient.get('/org/hierarchy');
        if (res.data.success && res.data.data) {
          if (Array.isArray(res.data.data.plants)) {
            setPlants(res.data.data.plants);
          }
          if (Array.isArray(res.data.data.shops)) {
            setShops(res.data.data.shops);
          }
        }
      } catch (e) {
        console.error('Failed to load org hierarchy for filters:', e);
      }
    };

    fetchOrgFilters();
  }, []);

  // Main Machine Fetching
  const fetchMachines = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const params = new URLSearchParams();
      params.append('page', String(pagination.page));
      params.append('limit', String(pagination.limit));

      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (criticalityFilter) params.append('criticality', criticalityFilter);
      if (categoryFilter.trim()) params.append('category', categoryFilter.trim());
      if (selectedPlantId) params.append('plant_id', selectedPlantId);
      if (selectedShopId) params.append('shop_id', selectedShopId);
      if (excludeDecommissioned) params.append('exclude_decommissioned', 'true');
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const res = await apiClient.get(`/machines?${params.toString()}`);
      if (res.data.success) {
        setMachines(res.data.data || []);
        if (res.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages,
          }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load machines:', err);
      setErrorMessage(
        err.response?.data?.message ||
        'Failed to load machine directory. Please check network or authentication.'
      );
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    search,
    statusFilter,
    criticalityFilter,
    categoryFilter,
    selectedPlantId,
    selectedShopId,
    excludeDecommissioned,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setCriticalityFilter('');
    setCategoryFilter('');
    setSelectedPlantId('');
    setSelectedShopId('');
    setExcludeDecommissioned(false);
    setSortBy('machine_code');
    setSortOrder('ASC');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleCopyUid = (uid: string) => {
    navigator.clipboard?.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const openEdit = (m: Machine) => {
    setActiveMachine(m);
    setIsEditOpen(true);
  };

  const openDelete = (m: Machine) => {
    setActiveMachine(m);
    setIsDeleteOpen(true);
  };

  const openHistory = (mId: string) => {
    setHistoryMachineId(mId);
    setIsHistoryOpen(true);
  };

  // Filter shops by selected plant if plant is selected
  const availableShops = selectedPlantId
    ? shops.filter((s) => s.plant_id === selectedPlantId)
    : shops;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-amber-500" />
              <span>INDUSTRIAL MACHINE ASSET DIRECTORY</span>
            </h2>
            {isAdmin ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
                Admin Full Access (CRUD)
              </span>
            ) : isManager ? (
              <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-blue-200">
                Manager Operational Access (Edit Specs)
              </span>
            ) : (
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                View Only ({user?.role?.toUpperCase()})
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            {user?.plantName || user?.shopName ? (
              <span>
                Scoped Facility Context:{' '}
                <strong className="text-zinc-800">
                  {user.plantName || 'Assigned Plant'}{user.shopName ? ` • ${user.shopName}` : ''}
                </strong>
              </span>
            ) : (
              'Enterprise Multi-Shop Plant Asset Governance, QR UIDs, and Lifecycle Maintenance History'
            )}
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsQrLookupOpen(true)}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-zinc-800"
            title="Scan or Lookup QR Code"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span>QR Asset Lookup</span>
          </button>

          <button
            onClick={() => fetchMachines()}
            disabled={loading}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-3 py-2.5 rounded-xl border border-zinc-200 transition flex items-center gap-1.5"
            title="Refresh Table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
            >
              <Plus className="w-4 h-4" />
              <span>REGISTER MACHINE</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, asset name, OEM, model, serial no, or bay..."
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-inner"
            />
          </div>
          <button
            type="submit"
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </form>

        {/* Advanced Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-zinc-100 text-xs">
          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Statuses</option>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
              <option value="breakdown">Breakdown</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="awaiting_parts">Awaiting Parts</option>
              <option value="inactive">Inactive</option>
              <option value="decommissioned">Decommissioned</option>
            </select>
          </div>

          {/* Criticality Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Criticality</label>
            <select
              value={criticalityFilter}
              onChange={(e) => {
                setCriticalityFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Criticalities</option>
              <option value="class_a">Class A (Bottleneck)</option>
              <option value="class_b">Class B (Medium)</option>
              <option value="class_c">Class C (Standby)</option>
            </select>
          </div>

          {/* Plant Filter (Admin only or disabled if restricted) */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Plant</label>
            <select
              value={selectedPlantId}
              onChange={(e) => {
                setSelectedPlantId(e.target.value);
                setSelectedShopId('');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              disabled={!isAdmin && !!user?.plantId}
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-jcb-yellow disabled:opacity-60"
            >
              <option value="">All Plants</option>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plant_name}
                </option>
              ))}
            </select>
          </div>

          {/* Shop Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Shop Floor</label>
            <select
              value={selectedShopId}
              onChange={(e) => {
                setSelectedShopId(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              disabled={user?.role === 'operator' && !!user?.shopId}
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-jcb-yellow disabled:opacity-60"
            >
              <option value="">All Shops</option>
              {availableShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Column */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Sort Field</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="machine_code">Machine Code</option>
              <option value="name">Asset Name</option>
              <option value="operating_hours">Run Hours</option>
              <option value="status">Status</option>
              <option value="criticality">Criticality</option>
              <option value="created_at">Date Added</option>
            </select>
          </div>

          {/* Reset Filters / Order */}
          <div className="flex items-end gap-1.5">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
              className="flex-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-800 transition flex items-center justify-center gap-1"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOrder}</span>
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-600 transition"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-4 rounded-xl text-xs flex items-center justify-between gap-2 bg-red-50 text-red-800 border border-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchMachines()}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded font-bold text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Machine Data Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Machine Code & QR UID</th>
                <th className="px-5 py-3.5">Asset Technical Name</th>
                <th className="px-5 py-3.5">OEM & Model</th>
                <th className="px-5 py-3.5">Plant & Shop Location</th>
                <th className="px-5 py-3.5">Criticality</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Run Hours</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-400 font-bold">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span>Loading industrial assets directory...</span>
                    </div>
                  </td>
                </tr>
              ) : machines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-zinc-400 font-medium">
                    <div className="flex flex-col items-center gap-1.5">
                      <AlertCircle className="w-6 h-6 text-zinc-300" />
                      <span className="font-bold text-zinc-600">No matching machines found.</span>
                      <span className="text-[11px] text-zinc-400">
                        Try adjusting search queries or resetting active filters.
                      </span>
                      <button
                        onClick={resetFilters}
                        className="mt-2 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-bold transition"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                machines.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/70 transition">
                    {/* Machine Code & UID */}
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-black text-sm text-zinc-950 flex items-center gap-1.5">
                        <span>{m.machine_code}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-zinc-400 font-mono tracking-tight truncate max-w-[150px]">
                          {m.qr_code_uid}
                        </span>
                        <button
                          onClick={() => handleCopyUid(m.qr_code_uid)}
                          className="text-zinc-400 hover:text-zinc-700 p-0.5"
                          title="Copy QR UID"
                        >
                          {copiedUid === m.qr_code_uid ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      {m.serial_number && (
                        <div className="text-[10px] text-zinc-500 font-mono">SN: {m.serial_number}</div>
                      )}
                    </td>

                    {/* Asset Technical Name */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-zinc-900">{m.name}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[10px] font-bold">
                        {m.category || 'Machinery'}
                      </span>
                    </td>

                    {/* OEM & Model */}
                    <td className="px-5 py-3.5 text-zinc-700">
                      <span className="font-bold text-zinc-900">{m.oem_manufacturer}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {m.model_number || 'Standard Model'}
                      </span>
                    </td>

                    {/* Plant & Shop */}
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-zinc-900 block">{m.shop_name || 'Assigned Shop'}</span>
                      <span className="text-[11px] text-zinc-500 block">
                        {m.bay_line_location || 'Bay 1'} &bull; {m.plant_name || 'Plant'}
                      </span>
                    </td>

                    {/* Criticality */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider inline-block ${
                          m.criticality === 'class_a'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : m.criticality === 'class_b'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                        }`}
                      >
                        {m.criticality?.replace('_', ' ') || 'CLASS B'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <StatusBadge status={m.status} />
                    </td>

                    {/* Run Hours */}
                    <td className="px-5 py-3.5 font-mono text-zinc-800 font-bold">
                      {m.operating_hours ? `${Number(m.operating_hours).toFixed(1)} hrs` : '0.0 hrs'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Maintenance History Button (Available to ALL roles) */}
                        <button
                          onClick={() => openHistory(m.id)}
                          className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition"
                          title="View Maintenance Lifecycle History"
                        >
                          <History className="w-4 h-4 text-blue-600" />
                        </button>

                        {/* Edit Button (Admin & Manager) */}
                        {canEdit && (
                          <button
                            onClick={() => openEdit(m)}
                            className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition"
                            title={isAdmin ? 'Edit Master Machine' : 'Edit Operational Metrics (Manager)'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button (Admin Only) */}
                        {isAdmin && (
                          <button
                            onClick={() => openDelete(m)}
                            className="p-1.5 text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                            title="Decommission or Delete Machine (Admin Only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        <div className="bg-zinc-50 px-6 py-3.5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-zinc-500 font-medium">
            Showing{' '}
            <strong className="text-zinc-900">
              {machines.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-zinc-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{' '}
            of <strong className="text-zinc-900">{pagination.total}</strong> machine records
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Rows per page:</span>
              <select
                value={pagination.limit}
                onChange={(e) => {
                  setPagination((prev) => ({
                    ...prev,
                    limit: Number(e.target.value),
                    page: 1,
                  }));
                }}
                className="bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 border border-zinc-300 bg-white rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-bold text-zinc-800">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>

              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-1.5 border border-zinc-300 bg-white rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isCreateOpen && (
        <MachineCreateModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={fetchMachines}
        />
      )}

      {isEditOpen && (
        <MachineEditModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setActiveMachine(null);
          }}
          onSuccess={fetchMachines}
          machine={activeMachine}
          userRole={user?.role}
        />
      )}

      {isDeleteOpen && (
        <MachineDeleteModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setActiveMachine(null);
          }}
          onSuccess={fetchMachines}
          machine={activeMachine}
        />
      )}

      {isHistoryOpen && (
        <MachineHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryMachineId(null);
          }}
          machineId={historyMachineId}
        />
      )}

      {isQrLookupOpen && (
        <MachineQrLookupModal
          isOpen={isQrLookupOpen}
          onClose={() => setIsQrLookupOpen(false)}
          onViewHistory={(mId) => {
            setHistoryMachineId(mId);
            setIsHistoryOpen(true);
          }}
        />
      )}
    </div>
  );
};
