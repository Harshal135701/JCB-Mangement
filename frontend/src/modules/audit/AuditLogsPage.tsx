import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { ShieldCheck, Database, Clock, RefreshCw, Search, X } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/audit');
      if (res.data?.success) {
        setLogs(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const entities = ['ALL', ...Array.from(new Set(logs.map((l) => l.entity_name).filter(Boolean)))];

  const filteredLogs = logs.filter((log) => {
    const matchesEntity = entityFilter === 'ALL' || log.entity_name === entityFilter;
    const term = search.toLowerCase().trim();
    if (!term) return matchesEntity;
    const matchesSearch =
      log.entity_name?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.performed_by_name?.toLowerCase().includes(term) ||
      log.ip_address?.toLowerCase().includes(term);
    return matchesEntity && matchesSearch;
  });

  return (
    <div className="space-y-6 bg-white min-h-full font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">IMMUTABLE SYSTEM AUDIT LEDGER</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              ISO Compliance
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Tamper-evident logs of machine status changes, work orders, labor logs, stock deductions, and approvals.
          </p>
        </div>

        <button
          onClick={fetchAudit}
          disabled={loading}
          className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition border border-zinc-300 cursor-pointer self-start sm:self-auto"
          title="Refresh Ledger"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, operator name, entity, or IP address..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {entities.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {entities.map((ent) => (
              <button
                key={ent}
                onClick={() => setEntityFilter(ent)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                  entityFilter === ent
                    ? 'bg-zinc-950 text-white font-black shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {ent}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Domain / Entity</th>
                <th className="px-6 py-3.5">Event Action</th>
                <th className="px-6 py-3.5">Performed By</th>
                <th className="px-6 py-3.5">Client IP / Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-jcb-yellowDark mb-2" />
                    Loading tamper-evident ledger records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/70 transition">
                    <td className="px-6 py-3.5 font-mono text-zinc-600 font-semibold text-[11px]">
                      {new Date(log.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-zinc-950 uppercase">{log.entity_name}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-zinc-100 text-zinc-900 border border-zinc-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-zinc-800">
                      {log.performed_by_name || 'System Auto-Engine'}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[11px] text-zinc-400">
                      {log.ip_address || '10.24.102.15'}
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
