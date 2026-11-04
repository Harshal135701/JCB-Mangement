import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { FileText, CheckCircle, Truck, AlertTriangle } from 'lucide-react';

export const RDCPage: React.FC = () => {
  const [rdcs, setRdcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRDCs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/rdc');
      if (res.data.success) {
        setRdcs(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load RDCs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRDCs();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await apiClient.put(`/rdc/${id}/approve`, {
        gate_pass_number: 'GP-' + Math.floor(10000 + Math.random() * 90000),
      });
      alert('RDC approved and authorized for factory gate outward!');
      fetchRDCs();
    } catch (e: any) {
      alert(e.message || 'Approval failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">RETURNABLE DELIVERY CHALLAN (RDC)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track capital spindle, servo motor, and PCB vendor repairs and outward movements</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Challan No</th>
                <th className="px-6 py-3.5">Vendor / Party</th>
                <th className="px-6 py-3.5">Purpose</th>
                <th className="px-6 py-3.5">Gate Pass</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rdcs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No active delivery challans logged.
                  </td>
                </tr>
              ) : (
                rdcs.map((rdc) => (
                  <tr key={rdc.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-extrabold text-slate-900">{rdc.challan_number}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{rdc.vendor_party_name}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-600">{rdc.purpose}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-700">{rdc.gate_pass_number || 'Awaiting Gate Pass'}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-900">
                        {rdc.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {rdc.status === 'pending_approval' ? (
                        <button
                          onClick={() => handleApprove(rdc.id)}
                          className="px-3 py-1 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-bold rounded text-xs shadow-sm"
                        >
                          Approve & Generate Gate Pass
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-bold text-xs flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Dispatched
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
