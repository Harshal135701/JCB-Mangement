import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { InspectionRecordSummary } from '../PreShiftInspectionPage';
import {
  ClipboardCheck,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  User,
  Building,
  Layers,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

interface AdminSubmittedRecordsViewProps {
  initialRecordId?: string;
}

export const AdminSubmittedRecordsView: React.FC<AdminSubmittedRecordsViewProps> = ({
  initialRecordId,
}) => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [records, setRecords] = useState<InspectionRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dropdown options
  const [machines, setMachines] = useState<any[]>([]);
  const [plants, setPlants] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [machineFilter, setMachineFilter] = useState('all');
  const [plantFilter, setPlantFilter] = useState<string>(() => {
    return isManager && user?.plantId ? user.plantId : 'all';
  });
  const [shopFilter, setShopFilter] = useState('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [generalSearch, setGeneralSearch] = useState('');

  // Pagination
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Detail Modal State
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  // 1. Fetch Machines, Plants, and Operators for Filter Dropdowns
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [machinesRes, plantsRes, operatorsRes] = await Promise.all([
          apiClient.get('/machines?limit=100').catch(() => null),
          apiClient.get('/org/plants').catch(() => null),
          apiClient.get('/users?role=operator&limit=100').catch(() => null),
        ]);
        if (machinesRes?.data?.success && Array.isArray(machinesRes.data.data)) {
          setMachines(machinesRes.data.data);
        }
        if (plantsRes?.data?.success && Array.isArray(plantsRes.data.data)) {
          const loadedPlants = plantsRes.data.data;
          if (isManager && user?.plantId) {
            const userPlant = loadedPlants.filter((p: any) => p.id === user.plantId);
            setPlants(userPlant.length > 0 ? userPlant : loadedPlants);
            setPlantFilter(user.plantId);
          } else {
            setPlants(loadedPlants);
          }
        }
        if (operatorsRes?.data?.success && Array.isArray(operatorsRes.data.data)) {
          setOperators(operatorsRes.data.data);
        }
      } catch (err) {
        console.warn('Could not load filter metadata options:', err);
      }
    };
    fetchMetadata();
  }, [isManager, user?.plantId]);

  // 2. Fetch Shops when a plant is selected
  useEffect(() => {
    if (plantFilter === 'all' || !plantFilter) {
      setShops([]);
      setShopFilter('all');
      return;
    }
    const fetchShops = async () => {
      try {
        const res = await apiClient.get(`/org/plants/${plantFilter}/shops`);
        if (res.data?.success && Array.isArray(res.data.data)) {
          setShops(res.data.data);
        } else {
          setShops([]);
        }
      } catch (err) {
        setShops([]);
      }
    };
    fetchShops();
  }, [plantFilter]);

  // 3. Fetch Records from backend with full server-side query parameters
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('page', String(pagination.page));
      params.append('limit', String(pagination.limit));

      if (statusFilter !== 'all') {
        params.append('overall_status', statusFilter);
      }
      if (shiftFilter !== 'all') {
        params.append('shift', shiftFilter);
      }
      if (machineFilter !== 'all') {
        params.append('machine_id', machineFilter);
      }
      if (plantFilter !== 'all') {
        params.append('plant_id', plantFilter);
      }
      if (shopFilter !== 'all') {
        params.append('shop_id', shopFilter);
      }
      if (operatorFilter !== 'all') {
        params.append('operator_id', operatorFilter);
      }
      if (fromDate) {
        params.append('from_date', fromDate);
      }
      if (toDate) {
        params.append('to_date', toDate);
      }

      const res = await apiClient.get(`/inspections/records?${params.toString()}`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRecords(res.data.data);
        if (res.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
            totalPages: res.data.pagination.totalPages || 1,
          }));
        }
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      console.error('Failed to load inspection records:', err);
      setError(err.response?.data?.message || 'Failed to retrieve submitted inspection records.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    statusFilter,
    shiftFilter,
    machineFilter,
    plantFilter,
    shopFilter,
    operatorFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 4. Open Record Details Modal
  const openRecordDetail = async (recordId: string) => {
    try {
      setLoadingDetail(true);
      setDetailError('');
      setSelectedRecordDetail(null);
      const res = await apiClient.get(`/inspections/records/${recordId}`);
      if (res.data?.success) {
        setSelectedRecordDetail(res.data.data);
      } else {
        setDetailError('Unable to load inspection record details.');
      }
    } catch (err: any) {
      setDetailError(err.response?.data?.message || 'Failed to retrieve inspection record details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open initial record if passed in props
  useEffect(() => {
    if (initialRecordId) {
      openRecordDetail(initialRecordId);
    }
  }, [initialRecordId]);

  // Quick client-side search across currently loaded page rows for text convenience
  const filteredRecords = records.filter((rec: any) => {
    if (generalSearch.trim()) {
      const q = generalSearch.trim().toLowerCase();
      const code = (rec.machine_code || '').toLowerCase();
      const name = (rec.machine_name || '').toLowerCase();
      const tpl = (rec.responses_json?.template_title || '').toLowerCase();
      const shop = (rec.shop_name || '').toLowerCase();
      const op = (rec.operator_name || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q) && !tpl.includes(q) && !shop.includes(q) && !op.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const hasActiveFilters =
    statusFilter !== 'all' ||
    shiftFilter !== 'all' ||
    machineFilter !== 'all' ||
    plantFilter !== 'all' ||
    shopFilter !== 'all' ||
    operatorFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '' ||
    generalSearch !== '';

  const handleResetFilters = () => {
    setStatusFilter('all');
    setShiftFilter('all');
    setMachineFilter('all');
    setPlantFilter('all');
    setShopFilter('all');
    setOperatorFilter('all');
    setFromDate('');
    setToDate('');
    setGeneralSearch('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* Filter Card */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
              Submitted Daily AM Checklist Ledger
            </h3>
            <span className="text-[10px] bg-slate-100 text-zinc-600 px-2 py-0.5 rounded font-bold font-mono">
              {pagination.total} Total Submissions
            </span>
          </div>

          <button
            type="button"
            onClick={fetchRecords}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-zinc-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Backend Query Filters - Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Overall Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800"
            >
              <option value="all">All Statuses</option>
              <option value="pass">Pass Only</option>
              <option value="flagged">Flagged Only</option>
              <option value="fail">Fail Only</option>
            </select>
          </div>

          {/* Shift Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Work Shift
            </label>
            <select
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800"
            >
              <option value="all">All Shifts</option>
              <option value="Shift A">Shift A (Morning)</option>
              <option value="Shift B">Shift B (Evening)</option>
              <option value="Shift C">Shift C (Night)</option>
            </select>
          </div>

          {/* Machine Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Machine Asset
            </label>
            <select
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800 truncate"
            >
              <option value="all">All Machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Plant Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Plant Facility {isManager && user?.plantId ? '(Assigned)' : ''}
            </label>
            <select
              value={plantFilter}
              disabled={Boolean(isManager && user?.plantId)}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800 truncate disabled:opacity-80"
            >
              {!isManager && <option value="all">All Plants</option>}
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plant_name || p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shop Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Shop Floor
            </label>
            <select
              value={shopFilter}
              disabled={plantFilter === 'all' || shops.length === 0}
              onChange={(e) => {
                setShopFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800 truncate disabled:opacity-50"
            >
              <option value="all">All Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name || s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Filter */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Operator
            </label>
            <select
              value={operatorFilter}
              onChange={(e) => {
                setOperatorFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-zinc-800 truncate"
            >
              <option value="all">All Operators</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name} ({op.employee_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Range & Search Row - Row 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs items-end">
          {/* From Date */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              From Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              To Date
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Quick Search */}
          <div>
            <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
              Quick Filter Page
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={generalSearch}
                onChange={(e) => setGeneralSearch(e.target.value)}
                placeholder="Search machine, shop..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-800 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Reset Filters Action */}
          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-zinc-700 rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Submitted Records Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
            <span className="text-xs font-bold">Querying regulatory AM checklist ledger...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-xs font-bold text-red-700">{error}</p>
            <button
              type="button"
              onClick={fetchRecords}
              className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
            >
              Retry
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ClipboardCheck className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-xs font-bold text-zinc-600">No inspection records match current filter criteria.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black text-zinc-400 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Machine & Code</th>
                  <th className="py-3 px-4">Checklist Rule</th>
                  <th className="py-3 px-4">Plant & Shop</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">Submission Date & Time</th>
                  <th className="py-3 px-4">Overall Result</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-zinc-800">
                {filteredRecords.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-semibold text-zinc-900 whitespace-nowrap">
                      <div className="font-bold text-zinc-950 flex items-center gap-1.5">
                        <User className="w-3 h-3 text-zinc-400" />
                        <span>{rec.operator_name || 'Operator'}</span>
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {rec.operator_id ? `ID: ${rec.operator_id.substring(0, 8)}...` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold font-mono text-zinc-950">{rec.machine_code}</div>
                      <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">{rec.machine_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-zinc-800">
                        {rec.responses_json?.template_title || 'Daily AM Checklist'}
                      </div>
                      {rec.responses_json?.template_version && (
                        <div className="text-[10px] font-mono text-zinc-400">
                          v{rec.responses_json.template_version}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-zinc-900">{rec.shop_name || 'Shop Floor'}</div>
                      <div className="text-[10px] text-zinc-500">{rec.plant_name || 'Talegaon Plant'}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-zinc-900 px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                        {rec.shift || 'Shift A'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                      {new Date(rec.created_at).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={rec.overall_status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openRecordDetail(rec.id)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-zinc-950 hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-500" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="p-4 flex items-center justify-between text-xs text-zinc-500 border-t border-slate-100 bg-slate-50">
              <span>
                Showing {filteredRecords.length} of {pagination.total} audit records
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="font-mono font-bold text-zinc-700">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Read-Only Single Record Detail Modal */}
      {(selectedRecordDetail || loadingDetail || detailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-white text-zinc-950 flex items-center justify-between border-b border-zinc-200 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Submitted AM Checklist Audit Details
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Immutable regulatory audit record snapshot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecordDetail(null);
                  setDetailError('');
                }}
                className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition"
                aria-label="Close record detail"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {loadingDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-jcb-yellow" />
                  <span className="text-xs font-bold">Loading submitted inspection details...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold">
                  {detailError}
                </div>
              ) : selectedRecordDetail && (
                <div className="space-y-4">
                  {/* Top Details Strip */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Machine Asset</span>
                      <strong className="text-zinc-950 font-mono text-sm block">
                        {selectedRecordDetail.machine_code}
                      </strong>
                      <span className="text-[11px] text-zinc-600 truncate block">
                        {selectedRecordDetail.machine_name}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Location / Shop</span>
                      <span className="text-zinc-800 font-semibold block">
                        {selectedRecordDetail.shop_name || 'Shop Floor'}
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        {selectedRecordDetail.plant_name || 'Talegaon Dabhade'}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Operator / Submitter</span>
                      <span className="text-zinc-950 font-bold block">
                        {selectedRecordDetail.operator_name || 'Certified Operator'}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono block">
                        {selectedRecordDetail.operator_employee_code || 'OP'}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Overall Evaluation</span>
                      <div className="mt-1">
                        <StatusBadge status={selectedRecordDetail.overall_status} size="sm" />
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Checklist Rule</span>
                      <span className="text-zinc-800 font-medium block">
                        {selectedRecordDetail.responses_json?.template_title || 'Daily AM Checklist'}
                      </span>
                      {selectedRecordDetail.responses_json?.template_version && (
                        <span className="text-[10px] font-mono text-zinc-400">
                          v{selectedRecordDetail.responses_json.template_version}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Shift</span>
                      <span className="text-zinc-900 font-bold block">
                        {selectedRecordDetail.shift || 'Shift A'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-zinc-400 text-[10px] font-bold uppercase block">Submission Timestamp</span>
                      <span className="text-zinc-700 font-mono text-[11px] block">
                        {new Date(selectedRecordDetail.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Recorded Sensor Readings & Thresholds */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-[11px] font-black uppercase text-zinc-600 tracking-wider mb-2">
                      Sensor Readings & Evaluated Limits
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                      {/* Pressure */}
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase font-sans font-bold">
                          Hydraulic Pressure
                        </span>
                        <strong className="text-zinc-900 text-sm">
                          {selectedRecordDetail.pressure !== null && selectedRecordDetail.pressure !== undefined
                            ? `${selectedRecordDetail.pressure} Bar`
                            : 'N/A'}
                        </strong>
                        {selectedRecordDetail.responses_json?.evaluated_sensors?.pressure && (
                          <div className="text-[10px] text-zinc-500 pt-1 border-t border-slate-100 mt-1">
                            Status: <span className="font-bold uppercase">{selectedRecordDetail.responses_json.evaluated_sensors.pressure.status}</span>
                          </div>
                        )}
                      </div>

                      {/* Temperature */}
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase font-sans font-bold">
                          Coolant Temperature
                        </span>
                        <strong className="text-zinc-900 text-sm">
                          {selectedRecordDetail.temperature !== null && selectedRecordDetail.temperature !== undefined
                            ? `${selectedRecordDetail.temperature} °C`
                            : 'N/A'}
                        </strong>
                        {selectedRecordDetail.responses_json?.evaluated_sensors?.temperature && (
                          <div className="text-[10px] text-zinc-500 pt-1 border-t border-slate-100 mt-1">
                            Status: <span className="font-bold uppercase">{selectedRecordDetail.responses_json.evaluated_sensors.temperature.status}</span>
                          </div>
                        )}
                      </div>

                      {/* Vibration */}
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <span className="text-[10px] text-zinc-400 block uppercase font-sans font-bold">
                          Spindle Vibration
                        </span>
                        <strong className="text-zinc-900 text-sm">
                          {selectedRecordDetail.vibration !== null && selectedRecordDetail.vibration !== undefined
                            ? `${selectedRecordDetail.vibration} mm/s`
                            : 'N/A'}
                        </strong>
                        {selectedRecordDetail.responses_json?.evaluated_sensors?.vibration && (
                          <div className="text-[10px] text-zinc-500 pt-1 border-t border-slate-100 mt-1">
                            Status: <span className="font-bold uppercase">{selectedRecordDetail.responses_json.evaluated_sensors.vibration.status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Checklist Questions and Answers Table */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black uppercase text-zinc-600 tracking-wider">
                      Recorded Checklist Answers & Operator Remarks
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                      <table className="w-full min-w-[500px] text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-[10px] font-black uppercase text-zinc-500">
                          <tr>
                            <th className="p-2.5">Checklist Question</th>
                            <th className="p-2.5">Recorded Answer</th>
                            <th className="p-2.5">Evaluation</th>
                            <th className="p-2.5">Operator Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!selectedRecordDetail.responses_json?.items ||
                            selectedRecordDetail.responses_json.items.length === 0) ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-zinc-400 italic">
                                No question responses recorded for this audit entry.
                              </td>
                            </tr>
                          ) : (
                            selectedRecordDetail.responses_json.items.map((ci: any, i: number) => (
                              <tr key={ci.id || i} className="hover:bg-slate-50 transition">
                                <td className="p-2.5 font-bold text-zinc-900">
                                  {ci.label || ci.id}
                                  {ci.is_critical && (
                                    <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-black uppercase rounded">
                                      Critical
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 font-mono text-zinc-700 font-semibold">
                                  {typeof ci.value === 'boolean'
                                    ? ci.value
                                      ? 'PASS'
                                      : 'FAIL'
                                    : String(ci.value ?? '')}
                                </td>
                                <td className="p-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                      ci.status === 'fail'
                                        ? 'bg-red-100 text-red-800'
                                        : ci.status === 'flagged'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {ci.status || 'PASS'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-zinc-600 text-[11px] italic">
                                  {ci.notes || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Digital Signature Preview */}
                  {selectedRecordDetail.operator_signature_url && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-black uppercase text-zinc-500 block">
                        Certified Operator Digital Signature
                      </span>
                      {selectedRecordDetail.operator_signature_url.startsWith('data:image') ||
                      selectedRecordDetail.operator_signature_url.startsWith('http') ? (
                        <img
                          src={selectedRecordDetail.operator_signature_url}
                          alt="Operator Signature"
                          className="h-16 border border-slate-300 rounded bg-white p-1"
                        />
                      ) : (
                        <span className="text-zinc-600 font-mono text-xs">
                          {selectedRecordDetail.operator_signature_url}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer (Strictly Read-Only: No edit, delete, approve, reject) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-[11px] text-zinc-500 font-medium">
                Certified audit submission record • Strictly read-only for Administrator
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecordDetail(null);
                  setDetailError('');
                }}
                className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
