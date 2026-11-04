import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  ShoppingCart, 
  Plus, 
  CheckCircle2, 
  Clock, 
  Truck, 
  ShieldAlert, 
  X, 
  AlertCircle,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';

export const ProcurementPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const [prs, setPrs] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    part_id: '',
    machine_id: '',
    quantity_required: 2,
    urgency: 'critical',
    technical_justification: 'Zero-stock emergency replacement to recover Class A bottleneck asset.',
  });

  const fetchPRs = async () => {
    try {
      setLoading(true);
      const [prRes, partsRes, machRes] = await Promise.all([
        apiClient.get('/procurement/pr'),
        apiClient.get('/inventory/search?limit=50'),
        apiClient.get('/machines?limit=50'),
      ]);
      setPrs(prRes.data.data || []);
      setParts(partsRes.data.data || []);
      setMachines(machRes.data.data || []);
      if (partsRes.data.data?.length > 0 && !formData.part_id) {
        setFormData(prev => ({ ...prev, part_id: partsRes.data.data[0].id }));
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

  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_id) {
      alert('Please choose a spare part.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/procurement/pr', formData);
      if (res.data.success) {
        alert(res.data.message || 'Purchase requisition initiated successfully.');
        setIsModalOpen(false);
        fetchPRs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create PR.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePR = async (prId: string) => {
    try {
      const poNum = `PO-JCB-${Math.floor(10000 + Math.random() * 90000)}`;
      const res = await apiClient.put(`/procurement/pr/${prId}`, {
        status: 'approved',
        po_number: poNum,
        supplier_name: 'JCB India Genuine Spares Hub',
      });
      if (res.data.success) {
        alert(`PR approved! Purchase Order generated: ${poNum}`);
        fetchPRs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Approval failed.');
    }
  };

  const handleGRN = async (prId: string, qty: number) => {
    try {
      const res = await apiClient.post(`/procurement/pr/${prId}/grn`, {
        received_quantity: qty || 1,
        remarks: 'Physical inspection completed at JCB Factory Gate. QC verified and inwarded.',
      });
      if (res.data.success) {
        alert('GRN posted successfully! Inventory stock balance updated.');
        fetchPRs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'GRN failed.');
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">PURCHASE REQUISITION & GRN CENTER</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Procurement Queue
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Procurement workflow for zero-stock breakdown components, emergency spare requisitions, and Goods Receipt Notes (GRN).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
          >
            <Plus className="w-4 h-4" />
            <span>RAISE PURCHASE REQUISITION</span>
          </button>
        </div>
      </div>

      {/* PR Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">PR Number</th>
                <th className="px-6 py-3.5">Spare Part Details</th>
                <th className="px-6 py-3.5">Qty Req</th>
                <th className="px-6 py-3.5">Machine Target</th>
                <th className="px-6 py-3.5">Urgency</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Procurement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    Loading purchase requisitions...
                  </td>
                </tr>
              ) : prs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    No active purchase requisitions in queue.
                  </td>
                </tr>
              ) : (
                prs.map((pr) => {
                  const isNew = pr.status === 'new';
                  const isApproved = pr.status === 'approved';
                  const isReceived = pr.status === 'grn_received';

                  return (
                    <tr key={pr.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-mono text-xs font-black text-amber-700">{pr.pr_number}</div>
                        {pr.po_number && (
                          <div className="font-mono text-[10px] text-zinc-400">PO: {pr.po_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-black text-sm text-zinc-950">{pr.part_number || 'N/A'}</div>
                        <div className="text-zinc-600 font-medium">{pr.part_name || 'Component'}</div>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                        {pr.quantity_required} Units
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-zinc-800">
                        {pr.machine_code || 'General Stock'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          pr.urgency === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {pr.urgency}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isReceived 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : isApproved 
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          {pr.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isManager && isNew && (
                            <button
                              onClick={() => handleApprovePR(pr.id)}
                              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm border border-amber-500 uppercase tracking-wider"
                            >
                              Approve PR
                            </button>
                          )}
                          {isApproved && (
                            <button
                              onClick={() => handleGRN(pr.id, pr.quantity_required)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider flex items-center gap-1"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Inward GRN</span>
                            </button>
                          )}
                          {isReceived && (
                            <span className="text-emerald-700 text-[11px] font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Stock Updated</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create PR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  PR
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  RAISE PURCHASE REQUISITION
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePR} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Select Required Spare Part *
                </label>
                <select
                  required
                  value={formData.part_id}
                  onChange={(e) => setFormData({ ...formData, part_id: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose spare part SKU --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} - {p.name} (Available: {p.available_stock || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Target Machine Asset
                  </label>
                  <select
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="">-- General Stock Reorder --</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Quantity Required *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity_required}
                    onChange={(e) => setFormData({ ...formData, quantity_required: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Procurement Urgency
                </label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="critical">Critical (Machine Stoppage / Bottleneck)</option>
                  <option value="high">High (Lead Time &gt; 3 Days)</option>
                  <option value="medium">Medium (Preventive Maintenance Spare)</option>
                  <option value="low">Low (Standard Safety Stock Refill)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Technical Justification *
                </label>
                <textarea
                  rows={2}
                  required
                  value={formData.technical_justification}
                  onChange={(e) => setFormData({ ...formData, technical_justification: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Authorize PR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
