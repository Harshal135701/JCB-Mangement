import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { ShoppingCart, Plus, CheckCircle2, Clock, Truck, ShieldAlert } from 'lucide-react';

export const ProcurementPage: React.FC = () => {
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/procurement/pr');
      if (res.data.success) {
        setPrs(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load PRs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, []);

  const handleGRN = async (prId: string) => {
    try {
      const res = await apiClient.post(`/procurement/pr/${prId}/grn`, {
        received_quantity: 5,
        remarks: 'Physical inspection completed at JCB Factory Gate. Quality verified.',
      });
      if (res.data.success) {
        alert('GRN Inwarding posted! Inventory stock balance updated and technician notified.');
        fetchPRs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'GRN failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">PURCHASE REQUISITION & GRN CENTER</h2>
          <p className="text-xs text-slate-500 mt-0.5">Procurement work queue for machine zero-stock breakdown parts</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">PR Number</th>
                <th className="px-6 py-3.5">Spare Part Details</th>
                <th className="px-6 py-3.5">Qty Req</th>
                <th className="px-6 py-3.5">Machine</th>
                <th className="px-6 py-3.5">Urgency</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No active purchase requisitions in queue.
                  </td>
                </tr>
              ) : (
                prs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-extrabold text-slate-900">{pr.pr_number}</td>
                    <td className="px-6 py-3.5">
                      <div className="font-bold text-slate-800">{pr.part_number}</div>
                      <div className="text-[11px] text-slate-500">{pr.part_name}</div>
                    </td>
                    <td className="px-6 py-3.5 font-black text-sm text-slate-900">{pr.quantity_required}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">{pr.machine_code || 'All Machines'}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-800 border border-red-200">
                        {pr.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">
                        {pr.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {pr.status !== 'fully_received' ? (
                        <button
                          onClick={() => handleGRN(pr.id)}
                          className="px-3 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-bold rounded shadow-sm transition"
                        >
                          Post GRN Receipt
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-bold text-xs flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Stocked In
                        </span>
                      )}
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
