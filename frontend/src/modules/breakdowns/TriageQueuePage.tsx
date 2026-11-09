import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BreakdownReportModal } from './components/BreakdownReportModal';
import { 
  AlertCircle, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X, 
  Wrench, 
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Thermometer,
  RotateCcw,
  MessageSquare,
  History,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  User,
  Phone,
  Mail,
  Shield,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface TechnicianUser {
  id: string;
  full_name: string;
  employee_code: string;
  department?: string | null;
  role: string;
  is_active?: boolean;
}

interface MachineOption {
  id: string;
  machine_code: string;
  name: string;
  shop_name?: string;
}

interface PlantOption {
  id: string;
  plant_name: string;
  plant_code: string;
}

interface ShopOption {
  id: string;
  plant_id: string;
  shop_name: string;
  shop_code: string;
}

export const TriageQueuePage: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'manager' || user?.role === 'admin';

  // Table Data & Pagination State
  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Dropdown Reference Data
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianUser[]>([]);
  const [technicianFetchError, setTechnicianFetchError] = useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');
  const [plantFilter, setPlantFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Modals State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailComplaint, setDetailComplaint] = useState<any | null>(null);

  const [assignComplaint, setAssignComplaint] = useState<any | null>(null);
  const [priorityComplaint, setPriorityComplaint] = useState<any | null>(null);
  const [rejectComplaint, setRejectComplaint] = useState<any | null>(null);
  const [infoComplaint, setInfoComplaint] = useState<any | null>(null);

  // Form States
  const [assignForm, setAssignForm] = useState({
    technician_id: '',
    sla_hours: 2,
    work_instructions: 'Diagnose machine fault, isolate hydraulic pressure lines, verify LOTO safety interlocks, and restore machine cycle time tolerances.',
    is_major_breakdown: false,
  });

  const [newPriority, setNewPriority] = useState('critical');
  const [rejectReason, setRejectReason] = useState('');
  const [infoRemarks, setInfoRemarks] = useState('');

  // 1. Fetch Technicians from /auth/users?role=technician
  const fetchTechnicians = useCallback(async () => {
    try {
      setTechnicianFetchError(null);
      const res = await apiClient.get('/auth/users?role=technician');
      if (res.data?.success && Array.isArray(res.data.data)) {
        // Filter strictly active technicians
        const activeTechs = res.data.data.filter(
          (u: any) => u.role === 'technician' && u.is_active !== false
        );
        setTechnicians(activeTechs);
        if (activeTechs.length > 0) {
          setAssignForm((prev) => ({
            ...prev,
            technician_id: prev.technician_id || activeTechs[0].id,
          }));
        } else {
          setTechnicianFetchError('No active technicians currently available in directory.');
        }
      } else {
        setTechnicianFetchError('Failed to load technician roster.');
      }
    } catch (err: any) {
      setTechnicians([]);
      setTechnicianFetchError(
        err.response?.data?.message || 'Failed to load technicians. Please check permissions.'
      );
    }
  }, []);

  // 2. Load Plants, Shops, and Machines for Filters
  useEffect(() => {
    const fetchOrgAndMachines = async () => {
      try {
        const [orgRes, machRes] = await Promise.all([
          apiClient.get('/org/hierarchy').catch(() => ({ data: { data: {} } })),
          apiClient.get('/machines?limit=100').catch(() => ({ data: { data: [] } })),
        ]);

        if (orgRes.data?.data) {
          if (Array.isArray(orgRes.data.data.plants)) setPlants(orgRes.data.data.plants);
          if (Array.isArray(orgRes.data.data.shops)) setShops(orgRes.data.data.shops);
        }

        if (Array.isArray(machRes.data?.data)) {
          setMachines(machRes.data.data);
        }
      } catch (e) {
        console.error('Failed to load filter options:', e);
      }
    };

    fetchOrgAndMachines();
    if (isManagerOrAdmin) {
      fetchTechnicians();
    }
  }, [fetchTechnicians, isManagerOrAdmin]);

  // 3. Fetch Breakdowns with Full Server-Side Filtering & Pagination
  const fetchBreakdowns = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('page', String(pagination.page));
      params.append('limit', String(pagination.limit));

      if (search.trim()) params.append('search', search.trim());
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (categoryFilter) params.append('issue_category', categoryFilter);
      if (machineFilter) params.append('machine_id', machineFilter);
      if (plantFilter) params.append('plant_id', plantFilter);
      if (shopFilter) params.append('shop_id', shopFilter);
      if (startDateFilter) params.append('start_date', startDateFilter);
      if (endDateFilter) params.append('end_date', endDateFilter);
      if (sortBy) params.append('sort_by', sortBy);
      if (sortOrder) params.append('sort_order', sortOrder);

      const res = await apiClient.get(`/breakdowns?${params.toString()}`);
      if (res.data?.success) {
        setBreakdowns(res.data.data || []);
        if (res.data.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total ?? 0,
            totalPages: res.data.pagination.totalPages ?? 1,
          }));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load breakdown triage queue.');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
    machineFilter,
    plantFilter,
    shopFilter,
    startDateFilter,
    endDateFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchBreakdowns();
  }, [fetchBreakdowns]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setMachineFilter('');
    setPlantFilter('');
    setShopFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // 4. Fetch Full Breakdown Details via GET /breakdowns/:id
  const openDetailModal = async (complaintId: string) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailComplaint(null);

    try {
      const res = await apiClient.get(`/breakdowns/${complaintId}`);
      if (res.data?.success && res.data.data) {
        setDetailComplaint(res.data.data);
      } else {
        setDetailError('Failed to load breakdown details.');
      }
    } catch (err: any) {
      setDetailError(err.response?.data?.message || 'Failed to retrieve breakdown details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Action 1: Acknowledge Complaint
  const handleAcknowledge = async (complaintId: string) => {
    if (actionLoading) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${complaintId}/acknowledge`, {
        remarks: 'Acknowledged by maintenance triage supervisor. Dispatching field crew.',
      });
      if (res.data?.success) {
        setSuccessMsg(`Complaint ${res.data.data?.complaint_number || ''} acknowledged.`);
        fetchBreakdowns();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to acknowledge breakdown.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 2: Update Priority
  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading || !priorityComplaint) return;
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${priorityComplaint.id}/priority`, {
        priority: newPriority,
      });
      if (res.data?.success) {
        setSuccessMsg(`Priority updated to ${newPriority.toUpperCase()} for ${priorityComplaint.complaint_number}.`);
        setPriorityComplaint(null);
        fetchBreakdowns();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update priority.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 3: Convert Breakdown to Work Order / Dispatch Technician
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading || !assignComplaint || !assignForm.technician_id) return;

    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');

      const res = await apiClient.post(`/breakdowns/${assignComplaint.id}/convert-to-work-order`, {
        technician_id: assignForm.technician_id,
        sla_hours: Number(assignForm.sla_hours) || 2,
        work_instructions: assignForm.work_instructions,
        is_major_breakdown: Boolean(assignForm.is_major_breakdown),
      });

      if (res.data?.success) {
        const woNumber = res.data.data?.workOrder?.wo_number || 'WO-CREATED';
        setSuccessMsg(`Work Order ${woNumber} generated and dispatched! Technician notified.`);
        setAssignComplaint(null);
        fetchBreakdowns();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to convert complaint to work order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 4: Reject Breakdown
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading || !rejectComplaint || !rejectReason.trim()) {
      setError('Rejection reason is mandatory.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.patch(`/breakdowns/${rejectComplaint.id}/reject`, {
        rejection_reason: rejectReason.trim(),
      });
      if (res.data?.success) {
        setSuccessMsg(`Breakdown complaint ${rejectComplaint.complaint_number} rejected. Machine status verified.`);
        setRejectComplaint(null);
        setRejectReason('');
        fetchBreakdowns();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject complaint.');
    } finally {
      setActionLoading(false);
    }
  };

  // Action 5: Request Additional Info
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading || !infoComplaint || !infoRemarks.trim()) {
      setError('Remarks are mandatory when requesting information.');
      return;
    }
    try {
      setActionLoading(true);
      setError('');
      setSuccessMsg('');
      const res = await apiClient.post(`/breakdowns/${infoComplaint.id}/request-information`, {
        remarks: infoRemarks.trim(),
      });
      if (res.data?.success) {
        setSuccessMsg(`Information requested for ${infoComplaint.complaint_number}. Operator notified.`);
        setInfoComplaint(null);
        setInfoRemarks('');
        fetchBreakdowns();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request information.');
    } finally {
      setActionLoading(false);
    }
  };

  // Current Loaded Page Counts (clearly labeled)
  const pageNewCount = breakdowns.filter((b) => b.status === 'new').length;
  const pagePendingCount = breakdowns.filter((b) => b.status === 'pending_review').length;
  const pageConvertedCount = breakdowns.filter((b) => b.status === 'work_order_created').length;
  const pageCriticalCount = breakdowns.filter(
    (b) => b.priority === 'critical' && b.status !== 'closed' && b.status !== 'rejected'
  ).length;

  return (
    <div className="space-y-6 min-h-full">
      {/* Title & Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Breakdown Triage & Dispatch Console</span>
            </h2>
            {isManagerOrAdmin ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
                Manager Command
              </span>
            ) : (
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                View Only ({user?.role?.toUpperCase()})
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Review shop floor stoppage complaints, acknowledge alerts, update priority, and convert to allocated Work Orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            to="/work-orders"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Work Orders Master</span>
          </Link>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Report Fault</span>
          </button>

          <button
            onClick={fetchBreakdowns}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-800 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-black text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Row (Clearly labeled as Current Page Summary) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>New Unread</span>
            <AlertCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-blue-800">{pageNewCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">tickets</span>
          </div>
          <div className="text-[10px] text-blue-700 font-bold mt-1">On Current Page ({pagination.total} total)</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>In Triage / Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">{pagePendingCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">tickets</span>
          </div>
          <div className="text-[10px] text-amber-700 font-bold mt-1">Ready for Tech Dispatch</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Converted to WO</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-700">{pageConvertedCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">orders</span>
          </div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1">Active Maintenance WOs</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 text-[11px] font-black uppercase tracking-wider">
            <span>Critical P0 Stoppages</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-red-700">{pageCriticalCount}</span>
            <span className="text-xs text-zinc-500 ml-1 font-bold">critical</span>
          </div>
          <div className="text-[10px] text-red-700 font-bold mt-1">Immediate SLA Clock Active</div>
        </div>
      </div>

      {/* Advanced Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by complaint #, machine code, problem title, or machine name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </form>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="pending_review">Pending Review</option>
              <option value="work_order_created">Work Order Created</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Issue Category */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Categories</option>
              <option value="hydraulic">Hydraulic</option>
              <option value="mechanical">Mechanical</option>
              <option value="electrical">Electrical</option>
              <option value="lubrication">Lubrication</option>
              <option value="safety">Safety</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Machine Filter */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Machine</label>
            <select
              value={machineFilter}
              onChange={(e) => {
                setMachineFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Machines</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.machine_code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Field */}
          <div>
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Sort Field</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="created_at">Date Reported</option>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="breakdown_occurred_at">Stoppage Time</option>
            </select>
          </div>

          {/* Sort Order Toggle */}
          <div className="flex flex-col">
            <label className="block text-[10px] font-black text-zinc-400 uppercase mb-1">Order</label>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-zinc-800 transition flex items-center justify-center gap-1"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOrder.toUpperCase()}</span>
            </button>
          </div>

          {/* Reset Action */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-zinc-600 transition"
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400 font-bold uppercase tracking-wider space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-jcb-yellowDark mx-auto" />
            <p>Loading Breakdown Triage Complaints...</p>
          </div>
        ) : breakdowns.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-400 font-bold space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-zinc-600 font-black uppercase">No Complaints in Current Filter</p>
            <p className="text-zinc-400 font-medium">All shop floor equipment operating within acceptable parameters.</p>
            <button
              onClick={resetFilters}
              className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-zinc-700 rounded-lg text-xs font-bold transition"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="py-3.5 px-4">Ticket #</th>
                  <th className="py-3.5 px-4">Machine Asset</th>
                  <th className="py-3.5 px-4">Problem / Symptoms</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Reported By / Shift</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {breakdowns.map((t) => {
                  const isNew = t.status === 'new';
                  const isConverted = t.status === 'work_order_created';
                  const isRejected = t.status === 'rejected';
                  const isClosed = t.status === 'closed';

                  return (
                    <tr key={t.id} className="hover:bg-amber-50/20 transition group">
                      {/* Ticket # */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openDetailModal(t.id)}
                          className="font-mono font-black text-zinc-950 hover:text-amber-800 transition text-left cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{t.complaint_number}</span>
                          <Eye className="w-3 h-3 text-zinc-400 group-hover:text-zinc-700" />
                        </button>
                        <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                          {new Date(t.reported_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Machine Asset */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{t.machine_code}</div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[150px]">{t.machine_name}</div>
                        <div className="text-[10px] text-zinc-400">{t.shop_name || 'Bay 1'}</div>
                      </td>

                      {/* Problem Title & Category */}
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="font-bold text-zinc-900 truncate" title={t.problem_title}>
                          {t.problem_title}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5" title={t.description}>
                          {t.description}
                        </div>
                        <span className="inline-block mt-1 text-[9px] uppercase font-bold text-zinc-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          {t.issue_category || 'Mechanical'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <StatusBadge status={t.priority} />
                          {isManagerOrAdmin && !isClosed && !isRejected && (
                            <button
                              onClick={() => {
                                setPriorityComplaint(t);
                                setNewPriority(t.priority);
                              }}
                              className="text-[10px] text-zinc-400 hover:text-black font-bold ml-1 cursor-pointer"
                              title="Edit Priority"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Reported By & Shift */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{t.reported_by_name || 'Operator'}</div>
                        <div className="text-[11px] text-zinc-500">{t.shift || 'Shift A'}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Triage Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. View Details (Always available) */}
                          <button
                            onClick={() => openDetailModal(t.id)}
                            className="p-1.5 hover:bg-slate-100 text-zinc-600 rounded-lg transition"
                            title="Inspect Details & Audit History"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* 2. Manager Actions (Strictly Manager & Admin only) */}
                          {isManagerOrAdmin && (
                            <>
                              {isNew && (
                                <button
                                  onClick={() => handleAcknowledge(t.id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-lg border border-blue-200 transition cursor-pointer disabled:opacity-50"
                                  title="Acknowledge Complaint"
                                >
                                  Ack
                                </button>
                              )}

                              {/* Dispatch Tech strictly hidden for rejected, closed, or converted complaints */}
                              {!isConverted && !isClosed && !isRejected && (
                                <>
                                  <button
                                    onClick={() => {
                                      setAssignComplaint(t);
                                      setAssignForm((prev) => ({
                                        ...prev,
                                        is_major_breakdown: t.priority === 'critical',
                                      }));
                                    }}
                                    disabled={actionLoading}
                                    className="px-3 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black uppercase rounded-lg border border-amber-500 shadow-xs transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>Dispatch Tech</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setInfoComplaint(t);
                                      setInfoRemarks('');
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 hover:bg-slate-100 text-zinc-500 hover:text-black rounded-lg transition disabled:opacity-50"
                                    title="Request Additional Information"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRejectComplaint(t);
                                      setRejectReason('');
                                    }}
                                    disabled={actionLoading}
                                    className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-700 rounded-lg transition disabled:opacity-50"
                                    title="Reject Breakdown"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}

                              {isConverted && (
                                <Link
                                  to="/work-orders"
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg border border-emerald-300 transition flex items-center gap-1"
                                >
                                  <span>View WO</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-zinc-500 font-medium">
            Showing{' '}
            <strong className="text-zinc-900">
              {breakdowns.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-zinc-900">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </strong>{' '}
            of <strong className="text-zinc-900">{pagination.total}</strong> complaints
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Rows:</span>
              <select
                value={pagination.limit}
                onChange={(e) => {
                  setPagination((prev) => ({
                    ...prev,
                    limit: Number(e.target.value),
                    page: 1,
                  }));
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev / Next Page Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 border border-slate-300 bg-white rounded-lg text-zinc-600 hover:bg-slate-100 disabled:opacity-40 transition"
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
                className="p-1.5 border border-slate-300 bg-white rounded-lg text-zinc-600 hover:bg-slate-100 disabled:opacity-40 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Detail Complaint Inspection with Real Audit History */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-jcb-yellow">
                  {detailComplaint ? detailComplaint.complaint_number : 'BREAKDOWN DETAILS'}
                </span>
                {detailComplaint && (
                  <>
                    <StatusBadge status={detailComplaint.status} />
                    <StatusBadge status={detailComplaint.priority} />
                  </>
                )}
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs flex-1">
              {detailLoading ? (
                <div className="py-16 text-center text-zinc-400 font-bold flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-jcb-yellowDark" />
                  <span>Loading breakdown details and audit history...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                  <span>{detailError}</span>
                </div>
              ) : detailComplaint ? (
                <>
                  {/* Problem Title & Description */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-black uppercase text-zinc-500">Problem Summary:</span>
                    <h4 className="font-bold text-zinc-950 text-sm">{detailComplaint.problem_title}</h4>
                    <p className="text-zinc-700 font-medium mt-1">{detailComplaint.description}</p>
                  </div>

                  {/* Machine Details */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Target Machine</span>
                      <p className="font-bold text-zinc-900">{detailComplaint.machine_code} - {detailComplaint.machine_name}</p>
                      <p className="text-[11px] text-zinc-500">{detailComplaint.bay_line_location || 'Bay 1'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Facility Location</span>
                      <p className="font-bold text-zinc-900">{detailComplaint.plant_name || 'Plant'}</p>
                      <p className="text-[11px] text-zinc-500">{detailComplaint.shop_name || 'Shop'}</p>
                    </div>
                  </div>

                  {/* Telemetry Readings */}
                  {(detailComplaint.pressure || detailComplaint.temperature || detailComplaint.hour_meter_reading) && (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                      <span className="text-[10px] font-bold uppercase text-amber-900 block mb-2">
                        Reported Gauges & Telemetry
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {detailComplaint.pressure && (
                          <div className="flex items-center gap-1.5 font-mono">
                            <Gauge className="w-4 h-4 text-blue-600" />
                            <span className="font-bold text-zinc-900">{detailComplaint.pressure} Bar</span>
                          </div>
                        )}
                        {detailComplaint.temperature && (
                          <div className="flex items-center gap-1.5 font-mono">
                            <Thermometer className="w-4 h-4 text-amber-600" />
                            <span className="font-bold text-zinc-900">{detailComplaint.temperature} °C</span>
                          </div>
                        )}
                        {detailComplaint.hour_meter_reading && (
                          <div className="flex items-center gap-1.5 font-mono">
                            <Clock className="w-4 h-4 text-zinc-600" />
                            <span className="font-bold text-zinc-900">{detailComplaint.hour_meter_reading} hrs</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reported By Info */}
                  <div className="grid grid-cols-2 gap-3 py-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Reported By</span>
                      <p className="font-bold text-zinc-900">{detailComplaint.reported_by_name || 'Operator'}</p>
                      <p className="text-[11px] text-zinc-500">{detailComplaint.reported_by_code}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">Timestamp</span>
                      <p className="font-bold text-zinc-900">{new Date(detailComplaint.reported_at || detailComplaint.created_at).toLocaleString()}</p>
                      <p className="text-[11px] text-zinc-500">Shift: {detailComplaint.shift || 'Shift A'}</p>
                    </div>
                  </div>

                  {/* Converted Work Order Information */}
                  {detailComplaint.wo_number && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                          Allocated Work Order:
                        </span>
                        <span className="font-mono font-black text-sm text-emerald-950">
                          {detailComplaint.wo_number}
                        </span>
                        <span className="text-[11px] text-emerald-700 block">
                          Technician: {detailComplaint.assigned_technician_name || 'Assigned'}
                        </span>
                      </div>
                      <Link
                        to={`/work-orders/${detailComplaint.work_order_id || ''}`}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <span>View Work Order</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}

                  {/* Audit History */}
                  <div>
                    <h5 className="font-black text-zinc-900 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-zinc-500" />
                      <span>Audit & Lifecycle History ({detailComplaint.history?.length || 0})</span>
                    </h5>
                    {(!detailComplaint.history || detailComplaint.history.length === 0) ? (
                      <p className="text-zinc-400 text-xs italic">No lifecycle events recorded.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        {detailComplaint.history.map((h: any, idx: number) => (
                          <div key={h.id || idx} className="p-3 hover:bg-white transition text-xs space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-900">{h.action}</span>
                              <span className="text-[10px] text-zinc-400">
                                {h.created_at ? new Date(h.created_at).toLocaleString() : ''}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-500">
                              By: <strong>{h.performed_by_name || 'System'}</strong> ({h.performed_by_role || 'Staff'})
                            </div>
                            {h.new_values && (
                              <div className="font-mono text-[10px] text-zinc-600 bg-white p-1.5 rounded border border-slate-200 overflow-x-auto mt-1">
                                {typeof h.new_values === 'object' ? JSON.stringify(h.new_values) : h.new_values}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-white transition"
              >
                Close
              </button>

              {isManagerOrAdmin && detailComplaint && detailComplaint.status !== 'work_order_created' && detailComplaint.status !== 'closed' && detailComplaint.status !== 'rejected' && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignComplaint(detailComplaint);
                    setDetailModalOpen(false);
                  }}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow"
                >
                  Dispatch Technician
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Convert to Work Order & Assign Technician */}
      {assignComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Convert Complaint & Dispatch Work Order
                </h3>
              </div>
              <button onClick={() => setAssignComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              {technicianFetchError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{technicianFetchError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-0.5">
                <span className="font-mono font-bold text-zinc-400 text-[10px]">CMP: {assignComplaint.complaint_number}</span>
                <p className="font-black text-zinc-900">{assignComplaint.problem_title}</p>
                <p className="text-zinc-500 font-medium">Machine: {assignComplaint.machine_code} ({assignComplaint.machine_name})</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Assign Maintenance Technician *
                </label>
                {technicians.length === 0 ? (
                  <div className="p-2.5 bg-red-50 text-red-800 rounded-lg text-xs font-bold border border-red-200">
                    No active technicians available. Work order allocation disabled.
                  </div>
                ) : (
                  <select
                    required
                    value={assignForm.technician_id}
                    onChange={(e) => setAssignForm({ ...assignForm, technician_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.employee_code}) {t.department ? `- ${t.department}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Target Resolution SLA Duration *
                </label>
                <select
                  value={assignForm.sla_hours}
                  onChange={(e) => setAssignForm({ ...assignForm, sla_hours: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value={1}>1 Hour (Critical Line Stop SLA)</option>
                  <option value={2}>2 Hours (Standard Breakdown SLA)</option>
                  <option value={4}>4 Hours (Complex Electrical / Hydraulic Repair)</option>
                  <option value={8}>8 Hours (Full Shift Diagnostic)</option>
                  <option value={24}>24 Hours (Major Overhaul)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Work Instructions & Safety SOP
                </label>
                <textarea
                  rows={2}
                  value={assignForm.work_instructions}
                  onChange={(e) => setAssignForm({ ...assignForm, work_instructions: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                <input
                  type="checkbox"
                  id="majorBreakdown"
                  checked={assignForm.is_major_breakdown}
                  onChange={(e) => setAssignForm({ ...assignForm, is_major_breakdown: e.target.checked })}
                  className="w-4 h-4 text-jcb-yellow rounded border-slate-300 focus:ring-amber-400"
                />
                <label htmlFor="majorBreakdown" className="text-xs font-bold text-amber-950">
                  Tag as Major Breakdown (Line Stoppage / Bottleneck)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignComplaint(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || technicians.length === 0 || !assignForm.technician_id}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Authorize & Dispatch WO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Priority */}
      {priorityComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Update Complaint Priority
              </h3>
              <button onClick={() => setPriorityComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePrioritySubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Adjust severity rating for ticket <strong className="text-zinc-900">{priorityComplaint.complaint_number}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  New Priority Rating
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="critical">Critical (Line Stoppage)</option>
                  <option value="high">High (Production Impaired)</option>
                  <option value="medium">Medium (Degraded Performance)</option>
                  <option value="low">Low (Minor Noise / Oil Seep)</option>
                </select>
              </div>

              {newPriority === 'critical' && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[11px] font-bold">
                  Escalating to CRITICAL immediately triggers real-time alerts to plant leadership.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPriorityComplaint(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : 'Update Priority'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Reject Complaint */}
      {rejectComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider text-red-400">
                Reject Breakdown Complaint
              </h3>
              <button onClick={() => setRejectComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Rejecting ticket <strong className="text-zinc-900">{rejectComplaint.complaint_number}</strong> on machine <strong className="text-zinc-900">{rejectComplaint.machine_code}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Rejection Reason (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. False alarm; machine sensor was calibrated during changeover and is operating normally."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-zinc-500">
                If no other active complaints exist for this asset, machine status will be automatically restored to <strong>Running</strong>.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectComplaint(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectReason.trim()}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Request Additional Information */}
      {infoComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black uppercase tracking-wider">
                Request Additional Information
              </h3>
              <button onClick={() => setInfoComplaint(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInfoSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-zinc-600 font-medium">
                Prompt operator for more technical details on ticket <strong className="text-zinc-900">{infoComplaint.complaint_number}</strong>.
              </p>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">
                  Manager Information Request *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Please verify hydraulic gauge reading and specify which axis servo error code was displayed."
                  value={infoRemarks}
                  onChange={(e) => setInfoRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInfoComplaint(null)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-zinc-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !infoRemarks.trim()}
                  className="px-5 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black rounded-xl text-xs font-black uppercase tracking-wider shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Breakdown Modal */}
      <BreakdownReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSuccess={(complaint) => {
          setSuccessMsg(`Breakdown complaint ${complaint?.complaint_number || ''} registered! Triage console updated.`);
          fetchBreakdowns();
        }}
      />
    </div>
  );
};
