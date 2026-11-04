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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">IMMUTABLE SYSTEM AUDIT LEDGER</h2>
        <p className="text-xs text-slate-500 mt-0.5">Tamper-evident logs of machine status changes, work orders, approvals, and stock deductions</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Entity</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Performed By</th>
                <th className="px-6 py-3.5">IP / Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Audit ledger is clean.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-mono text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 uppercase">{log.entity_name}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-100 text-zinc-900 border border-zinc-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">
                      {log.performed_by_name || 'System Engine'} ({log.performed_by_role || 'Automation'})
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-400">{log.ip_address || '127.0.0.1'}</td>
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

