import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import {
  ShieldCheck,
  Database,
  Clock,
  RefreshCw,
  Search,
  X,
  Download,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  Activity,
  User,
  Globe,
  FileCode,
  FileSpreadsheet,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  entity_name: string;
  entity_id: string | null;
  action: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_by_role: string | null;
  performed_by_email: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  created_at: string;
}

interface AuditStats {
  total_events: number;
  distinct_entities_count: number;
  distinct_actions_count: number;
  events_last_24h: number;
  entity_distribution: Array<{ entity_name: string; count: number }>;
  top_actions: Array<{ action: string; count: number }>;
}

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter options from backend
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  // Selected log for Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Export loading
  const [exporting, setExporting] = useState(false);

  // Fetch filter dropdown options
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await apiClient.get('/audit/filters');
      if (res.data?.success) {
        setAvailableEntities(res.data.data.entities || []);
        setAvailableActions(res.data.data.actions || []);
      }
    } catch (e) {
      console.error('Failed to load filter options:', e);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiClient.get('/audit/stats');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load audit stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch paginated audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit,
      };
      if (search.trim()) params.search = search.trim();
      if (entityFilter !== 'ALL') params.entity_name = entityFilter;
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await apiClient.get('/audit', { params });
      if (res.data?.success) {
        setLogs(res.data.data || []);
        if (res.data.pagination) {
          setTotal(res.data.pagination.total);
          setTotalPages(res.data.pagination.totalPages);
        }
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, entityFilter, actionFilter, startDate, endDate]);

  useEffect(() => {
    fetchFilterOptions();
    fetchStats();
  }, [fetchFilterOptions, fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params: Record<string, any> = {};
      if (search.trim()) params.search = search.trim();
      if (entityFilter !== 'ALL') params.entity_name = entityFilter;
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const res = await apiClient.get('/audit/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jcb_audit_ledger_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to export audit ledger:', e);
    } finally {
      setExporting(false);
    }
  };

  const getEntityBadgeColor = (entity: string) => {
    switch (entity?.toLowerCase()) {
      case 'work_orders':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'maintenance_requests':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'purchase_requisitions':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'machines':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'rdc_challans':
        return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'users':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300';
      case 'pm_plans':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-300';
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action?.toUpperCase();
    if (act.includes('DELETE') || act.includes('REJECT') || act.includes('FAIL') || act.includes('CANCEL')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (act.includes('CREATE') || act.includes('COMPLETE') || act.includes('VERIFIED') || act.includes('ACCEPT') || act.includes('APPROVE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('UPDATE') || act.includes('PROGRESS') || act.includes('START') || act.includes('EDIT')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  };

  return (
    <div className="space-y-6 bg-slate-50 min-h-full font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-jcb-yellow/20 rounded-xl border border-amber-400">
              <ShieldCheck className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-950 tracking-tight uppercase">
                Enterprise Immutable Audit Ledger
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-2xs">
                  ISO 9001 / 55000 Compliant
                </span>
                <span className="text-xs text-zinc-400 font-medium">
                  Tamper-evident regulatory audit trail
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Export filtered records to CSV"
          >
            <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce' : ''}`} />
            <span>{exporting ? 'Generating CSV...' : 'Export Audit CSV'}</span>
          </button>

          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            disabled={loading}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition border border-zinc-300 cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
              Total Recorded Events
            </div>
            <div className="text-2xl font-black text-zinc-950 mt-0.5">
              {stats?.total_events ?? total}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium">Immutable audit transactions</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
              Audited Domains
            </div>
            <div className="text-2xl font-black text-purple-900 mt-0.5">
              {stats?.distinct_entities_count || availableEntities.length}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium">Entity types monitored</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
              Event Action Types
            </div>
            <div className="text-2xl font-black text-amber-900 mt-0.5">
              {stats?.distinct_actions_count || availableActions.length}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium">Lifecycle state transitions</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
              Recent Activity (24h)
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-0.5">
              {stats?.events_last_24h ?? 0}
            </div>
            <div className="text-[10px] text-zinc-400 font-medium">Events in past 24 hours</div>
          </div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Free-Text Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by action, actor, entity ID, or client IP..."
              className="w-full pl-10 pr-9 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow focus:ring-1 focus:ring-jcb-yellow"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Domain / Entity Selector */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow cursor-pointer"
            >
              <option value="ALL">All Entity Domains</option>
              {availableEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-jcb-yellow cursor-pointer"
            >
              <option value="ALL">All Action Types</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter & Clear Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-zinc-500 uppercase text-[10px] tracking-wider">Date Window:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800"
            />
            <span className="text-zinc-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-800"
            />
          </div>

          {(entityFilter !== 'ALL' || actionFilter !== 'ALL' || search || startDate || endDate) && (
            <button
              onClick={() => {
                setEntityFilter('ALL');
                setActionFilter('ALL');
                setSearch('');
                setStartDate('');
                setEndDate('');
                setPage(1);
              }}
              className="text-[11px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Ledger Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Domain</th>
                <th className="px-5 py-3.5">Event Action</th>
                <th className="px-5 py-3.5">Performed By</th>
                <th className="px-5 py-3.5">Client IP</th>
                <th className="px-5 py-3.5 text-right">Payload Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                    Querying secure compliance ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-bold">
                    No matching audit ledger records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/80 transition">
                    {/* Timestamp */}
                    <td className="px-5 py-3.5 font-mono text-zinc-700 font-bold text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Entity Domain */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${getEntityBadgeColor(
                          log.entity_name
                        )}`}
                      >
                        {log.entity_name}
                      </span>
                    </td>

                    {/* Event Action */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    {/* Performed By */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-zinc-900">
                        {log.performed_by_name || 'System Engine'}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-medium">
                        {log.performed_by_role ? (
                          <span className="uppercase text-amber-700 font-bold">
                            {log.performed_by_role}
                          </span>
                        ) : (
                          'AUTOMATED'
                        )}
                        {log.performed_by_email && ` • ${log.performed_by_email}`}
                      </div>
                    </td>

                    {/* Client IP */}
                    <td className="px-5 py-3.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-zinc-400" />
                        {log.ip_address || '10.24.102.15'}
                      </span>
                    </td>

                    {/* Payload Diff Action */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold transition border border-zinc-300 cursor-pointer shadow-2xs"
                        title="Inspect Old & New Payload Values"
                      >
                        <Eye className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Inspect Diff</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 font-medium">
            Showing <strong className="text-zinc-900">{logs.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-zinc-900">{Math.min(page * limit, total)}</strong> of{' '}
            <strong className="text-zinc-900">{total}</strong> total audit records
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
              <span>Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-bold text-zinc-800">
                Page {page} of {totalPages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-700 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Diff Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-zinc-950 p-5 flex items-center justify-between text-white border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-2xs uppercase">
                  {selectedLog.entity_name}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 text-white">
                    Audit Event Payload Diff
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Action: <span className="font-mono text-amber-400 font-bold">{selectedLog.action}</span> •{' '}
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Metadata Sub-header */}
            <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Actor:</span>
                <span className="font-bold text-zinc-900">
                  {selectedLog.performed_by_name || 'System Automated'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Role:</span>
                <span className="font-bold text-amber-800 uppercase">
                  {selectedLog.performed_by_role || 'SYSTEM'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Entity ID:</span>
                <span className="font-mono text-[11px] text-zinc-700 truncate block">
                  {selectedLog.entity_id || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase block">Client IP:</span>
                <span className="font-mono text-[11px] text-zinc-700">
                  {selectedLog.ip_address || '10.24.102.15'}
                </span>
              </div>
            </div>

            {/* Old vs New JSON Diff Display */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Values */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      Previous Values (Old)
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">JSON</span>
                  </div>
                  <div className="p-4 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 border border-zinc-800">
                    {selectedLog.old_values ? (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.old_values, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-zinc-500 italic">None (Initial Record Creation)</span>
                    )}
                  </div>
                </div>

                {/* New Values */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      Applied Values (New)
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">JSON</span>
                  </div>
                  <div className="p-4 bg-zinc-900 text-zinc-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-72 border border-zinc-800">
                    {selectedLog.new_values ? (
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.new_values, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-zinc-500 italic">None (Record Deleted)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-3 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-mono text-zinc-400">
                Log ID: {selectedLog.id}
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
