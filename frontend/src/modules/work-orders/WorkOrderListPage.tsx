import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { 
  Wrench, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  ChevronLeft,
  ChevronRight,
  User,
  ArrowUpDown
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export const WorkOrderListPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active query parameters derived from URL searchParams
  const page = useMemo(() => {
    const p = parseInt(searchParams.get('page') || '1', 10);
    return isNaN(p) || p < 1 ? 1 : p;
  }, [searchParams]);

  const limit = useMemo(() => {
    const l = parseInt(searchParams.get('limit') || '15', 10);
    return isNaN(l) || l < 1 ? 15 : l;
  }, [searchParams]);

  const searchParam = useMemo(() => searchParams.get('search') || '', [searchParams]);
  const statusFilter = useMemo(() => searchParams.get('status') || '', [searchParams]);
  const priorityFilter = useMemo(() => searchParams.get('priority') || '', [searchParams]);
  const sortBy = useMemo(() => searchParams.get('sortBy') || searchParams.get('sort_by') || 'created_at', [searchParams]);
  const sortOrder = useMemo<'ASC' | 'DESC'>(() => {
    const so = (searchParams.get('sortOrder') || searchParams.get('sort_order') || 'DESC').toUpperCase();
    return so === 'ASC' ? 'ASC' : 'DESC';
  }, [searchParams]);

  // Controlled search input field
  const [searchInput, setSearchInput] = useState(searchParam);

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Update URL helper that preserves other params and handles page resets
  const updateParams = useCallback((newParams: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      Object.entries(newParams).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '') {
          updated.delete(key);
        } else {
          updated.set(key, val);
        }
      });
      return updated;
    });
  }, [setSearchParams]);

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params: Record<string, any> = {
        page,
        limit,
        sortBy,
        sortOrder,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (searchParam.trim()) params.search = searchParam.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await apiClient.get('/work-orders', { params });
      if (res.data?.success) {
        setWorkOrders(res.data.data || []);
        if (res.data.pagination) {
          setTotalCount(res.data.pagination.total ?? 0);
          setTotalPages(Math.max(1, res.data.pagination.totalPages ?? 1));
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load work orders catalog.');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchParam, statusFilter, priorityFilter, sortBy, sortOrder]);

  // Single effect triggers API call whenever URL params change
  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({
      search: searchInput.trim() || null,
      page: '1',
    });
  };

  const handleStatusChange = (newStatus: string) => {
    updateParams({
      status: newStatus || null,
      page: '1',
    });
  };

  const handlePriorityChange = (newPriority: string) => {
    updateParams({
      priority: newPriority || null,
      page: '1',
    });
  };

  const handleSortChange = (newSortBy: string) => {
    updateParams({
      sortBy: newSortBy,
      page: '1',
    });
  };

  const handleSortOrderToggle = () => {
    const nextOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
    updateParams({
      sortOrder: nextOrder,
      page: '1',
    });
  };

  const handlePageChange = (newPage: number) => {
    updateParams({
      page: String(newPage),
    });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(searchParam || statusFilter || priorityFilter || sortBy !== 'created_at' || sortOrder !== 'DESC');

  return (
    <div className="space-y-6 min-h-full">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
              Maintenance Work Orders Master
            </h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
              {user?.role === 'technician' ? 'Technician Queue' : 'Plant Operations'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Track end-to-end execution of corrective breakdown jobs and scheduled maintenance orders across shop bays.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <Link
              to="/triage"
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition shadow-xs uppercase tracking-wider"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Breakdown Triage</span>
            </Link>
          )}

          <button
            onClick={fetchWorkOrders}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Reload current page and filters"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-700 hover:text-black text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by WO#, Machine code, asset name, or problem title..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow transition"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            {/* Status Filter: includes all backend supported statuses */}
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="accepted">Accepted</option>
              <option value="scheduled">Scheduled</option>
              <option value="under_diagnosis">Under Diagnosis</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_for_parts">Waiting for Parts</option>
              <option value="waiting_for_approval">Waiting for Approval</option>
              <option value="on_hold">On Hold</option>
              <option value="submitted_verification">Submitted for Verification</option>
              <option value="rework_required">Rework Required</option>
              <option value="completed">Completed</option>
              <option value="verified_closed">Verified & Closed</option>
              <option value="reopened">Reopened</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical (Line Stop)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Sort Field */}
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow"
            >
              <option value="created_at">Sort: Created Date</option>
              <option value="wo_number">Sort: WO Number</option>
              <option value="priority">Sort: Priority</option>
              <option value="status">Sort: Status</option>
              <option value="sla_deadline">Sort: SLA Deadline</option>
            </select>

            {/* Sort Order Toggle */}
            <button
              type="button"
              onClick={handleSortOrderToggle}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 hover:bg-slate-100 flex items-center gap-1 transition"
              title={`Currently sorted ${sortOrder}. Click to toggle.`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
              <span>{sortOrder}</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black uppercase tracking-wider rounded-xl transition shadow-xs"
            >
              Filter
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-zinc-700 text-xs font-bold rounded-xl transition"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium pt-1">
          <span>Showing <strong>{workOrders.length}</strong> of <strong>{totalCount}</strong> work orders</span>
          <span>Page {page} of {totalPages}</span>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-zinc-400 font-bold uppercase tracking-wider space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-jcb-yellowDark mx-auto" />
            <p>Loading Work Orders Catalog...</p>
          </div>
        ) : workOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-400 font-bold space-y-2">
            <Wrench className="w-8 h-8 text-zinc-300 mx-auto" />
            <p className="text-zinc-600 font-black uppercase">No Work Orders Matching Current Filters</p>
            <p className="text-zinc-400 font-medium">Try resetting search keywords or status filters.</p>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="mt-2 px-3 py-1.5 bg-slate-100 text-zinc-800 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-black text-zinc-500 tracking-wider">
                  <th className="py-3.5 px-4">WO Number</th>
                  <th className="py-3.5 px-4">Machine Asset</th>
                  <th className="py-3.5 px-4">Problem / Instructions</th>
                  <th className="py-3.5 px-4">Technician</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">SLA Deadline</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {workOrders.map((wo) => {
                  const isTerminal = ['verified_closed', 'completed'].includes(wo.status);
                  const deadlineDate = wo.sla_deadline ? new Date(wo.sla_deadline) : null;
                  const isValidDeadline = deadlineDate && !isNaN(deadlineDate.getTime());
                  const isSlaOverdue = isValidDeadline && deadlineDate < new Date() && !isTerminal;
                  const isMajor = Boolean(wo.is_major_breakdown);

                  return (
                    <tr key={wo.id} className="hover:bg-amber-50/20 transition group">
                      {/* WO Number */}
                      <td className="py-3 px-4">
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="font-mono font-black text-zinc-950 group-hover:text-amber-800 transition flex items-center gap-1.5"
                        >
                          <span>{wo.wo_number}</span>
                          {isMajor && (
                            <span className="bg-red-600 text-white text-[9px] px-1 py-0.2 rounded font-black uppercase tracking-wider">
                              Major
                            </span>
                          )}
                        </Link>
                        {wo.complaint_number && (
                          <span className="block text-[10px] font-mono text-zinc-400 mt-0.5">
                            Ref: {wo.complaint_number}
                          </span>
                        )}
                      </td>

                      {/* Machine Asset */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-zinc-900">{wo.machine_code || 'Not specified'}</div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[150px]">{wo.machine_name || 'Machine'}</div>
                        <div className="text-[10px] text-zinc-400">{wo.bay_line_location || wo.shop_name || 'Location unavailable'}</div>
                      </td>

                      {/* Problem Title & Instructions */}
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-bold text-zinc-900 truncate" title={wo.problem_title || wo.work_instructions || 'No details provided'}>
                          {wo.problem_title || (wo.work_instructions ? 'Maintenance Task' : 'No title specified')}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {wo.work_instructions || 'No additional work instructions provided.'}
                        </div>
                      </td>

                      {/* Assigned Technician */}
                      <td className="py-3 px-4">
                        {wo.technician_name ? (
                          <div>
                            <div className="font-bold text-zinc-900 flex items-center gap-1">
                              <User className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[130px]">{wo.technician_name}</span>
                            </div>
                            {wo.technician_code && (
                              <span className="text-[10px] font-mono text-zinc-400 block pl-4">
                                {wo.technician_code}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-black uppercase border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <StatusBadge status={wo.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={wo.status} />
                      </td>

                      {/* SLA Deadline */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {isValidDeadline ? (
                          <div className={isSlaOverdue ? 'text-red-700 font-bold' : 'text-zinc-600'}>
                            <span>
                              {deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="block text-[10px] text-zinc-400">
                              {deadlineDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                            {isSlaOverdue && (
                              <span className="text-[9px] bg-red-100 text-red-800 px-1 py-0.2 rounded font-black uppercase tracking-wider block mt-0.5">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/work-orders/${wo.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg transition shadow-xs"
                        >
                          <span>{user?.role === 'technician' ? 'Execute' : 'Inspect'}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-white disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-bold text-zinc-700">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-white disabled:opacity-40 transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
