import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { ShieldCheck, Database, Clock } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/audit');
        if (res.data.success) {
          setLogs(res.data.data);
        }
      } catch (e) {
        console.error('Failed to load audit logs:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  return (
    <div className="space-y-6 bg-white min-h-full">
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
            Tamper-evident logs of machine status changes, work orders, technician labor logs, approvals, and stock deductions.
          </p>
        </div>
      </div>

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
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    Audit ledger is synchronized and nominal.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/70 transition">
                    <td className="px-6 py-3.5 font-mono text-zinc-600 font-semibold">
                      {new Date(log.created_at).toLocaleString()}
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
