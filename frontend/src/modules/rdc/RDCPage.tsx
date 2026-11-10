import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, 
  CheckCircle2, 
  Truck, 
  AlertTriangle, 
  Plus, 
  X, 
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowDownLeft,
  ShieldCheck,
  Send
} from 'lucide-react';

interface RDCItem {
  id: string;
  rdc_id: string;
  part_id?: string | null;
  item_description: string;
  serial_number?: string | null;
  quantity_dispatched: number;
  quantity_returned: number;
  approximate_value?: number;
}

interface RDCChallan {
  id: string;
  challan_number: string;
  rdc_type: string;
  work_order_id?: string | null;
  machine_id?: string | null;
  machine_code?: string | null;
  vendor_party_name: string;
  vendor_gstin?: string | null;
  vendor_address?: string | null;
  contact_person?: string | null;
  purpose: string;
  expected_return_date?: string | null;
  gate_pass_number?: string | null;
  status: 'pending_approval' | 'dispatched' | 'partially_returned' | 'fully_returned' | 'cancelled';
  created_by?: string;
  created_by_name?: string;
  approved_by?: string | null;
  created_at: string;
  items?: RDCItem[];
}

export const RDCPage: React.FC = () => {
  const { user } = useAuth();
  const canManageRDC = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'store_manager';

  const [rdcs, setRdcs] = useState<RDCChallan[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    rdc_type: 'RDC',
    vendor_party_name: '',
    vendor_gstin: '',
    vendor_address: '',
    contact_person: '',
    purpose: 'Spindle Bearing Overhaul & Dynamic Balancing',
    machine_id: '',
    expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    item_description: 'High-Speed CNC Spindle Assembly',
    serial_number: '',
    quantity_dispatched: 1,
    approximate_value: 45000,
  });

  // Return Modal State
  const [returnModalChallan, setReturnModalChallan] = useState<RDCChallan | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [returnQty, setReturnQty] = useState(1);

  const fetchRDCs = useCallback(async () => {
    try {
      setLoading(true);
      const [rdcRes, machRes] = await Promise.all([
        apiClient.get('/rdc'),
        apiClient.get('/machines?limit=100'),
      ]);
      setRdcs(rdcRes.data?.data || []);
      setMachines(machRes.data?.data || []);
    } catch (e: any) {
      console.error('Failed to load RDCs:', e);
      setFeedback({ type: 'error', message: 'Failed to retrieve Returnable Delivery Challans.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRDCs();
  }, [fetchRDCs]);

  const handleCreateRDC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_party_name.trim() || !formData.purpose.trim() || !formData.item_description.trim()) {
      setFeedback({ type: 'error', message: 'Vendor name, dispatch purpose, and item description are required.' });
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        rdc_type: formData.rdc_type,
        vendor_party_name: formData.vendor_party_name.trim(),
        vendor_gstin: formData.vendor_gstin.trim() || undefined,
        vendor_address: formData.vendor_address.trim() || undefined,
        contact_person: formData.contact_person.trim() || undefined,
        purpose: formData.purpose,
        machine_id: formData.machine_id || undefined,
        expected_return_date: formData.expected_return_date,
        items: [
          {
            item_description: formData.item_description.trim(),
            serial_number: formData.serial_number.trim() || undefined,
            quantity_dispatched: Number(formData.quantity_dispatched) || 1,
            approximate_value: Number(formData.approximate_value) || 0,
          },
        ],
      };

      const res = await apiClient.post('/rdc', payload);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || `RDC Challan ${res.data.data?.challan_number || ''} issued successfully!`,
        });
        setIsModalOpen(false);
        fetchRDCs();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to issue RDC Challan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveAndDispatch = async (id: string) => {
    try {
      setActionLoading(true);
      const res = await apiClient.put(`/rdc/${id}/approve`, {});
      if (res.data?.success) {
        const gp = res.data.data?.gate_pass_number;
        setFeedback({
          type: 'success',
          message: `RDC approved! Security Gate Pass generated: ${gp || 'GP-ISSUED'}. Material marked dispatched.`,
        });
        fetchRDCs();
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Approval & dispatch failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const openReturnModal = (rdc: RDCChallan) => {
    setReturnModalChallan(rdc);
    const firstItem = rdc.items && rdc.items.length > 0 ? rdc.items[0] : null;
    if (firstItem) {
      setSelectedItemId(firstItem.id);
      const pending = Math.max(1, firstItem.quantity_dispatched - (firstItem.quantity_returned || 0));
      setReturnQty(pending);
    } else {
      setSelectedItemId('');
      setReturnQty(1);
    }
  };

  const handleRecordReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalChallan || !selectedItemId) {
      setFeedback({ type: 'error', message: 'Please select an item to inward.' });
      return;
    }
    if (returnQty <= 0) {
      setFeedback({ type: 'error', message: 'Returned quantity must be greater than zero.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post(`/rdc/${returnModalChallan.id}/return`, {
        item_id: selectedItemId,
        returned_quantity: Number(returnQty),
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || 'Returned material inwarded through Factory Security with Quality sign-off!',
        });
        setReturnModalChallan(null);
        fetchRDCs();
      }
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.response?.data?.message || 'Inward return registration failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRDCs = rdcs.filter((rdc) => {
    const matchesStatus = statusFilter === 'ALL' || rdc.status === statusFilter;
    const term = search.toLowerCase().trim();
    if (!term) return matchesStatus;
    return (
      matchesStatus &&
      (rdc.challan_number?.toLowerCase().includes(term) ||
        rdc.vendor_party_name?.toLowerCase().includes(term) ||
        rdc.purpose?.toLowerCase().includes(term) ||
        rdc.gate_pass_number?.toLowerCase().includes(term) ||
        rdc.machine_code?.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 bg-white min-h-full font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">RETURNABLE DELIVERY CHALLAN (RDC)</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Factory Gate Control
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Track capital spindle overhauls, servo motor rewinding, hydraulic cylinder rebuilds, and outward vendor movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRDCs}
            disabled={loading}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition border border-zinc-300 cursor-pointer"
            title="Refresh Challans"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
          </button>
          {canManageRDC && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE RDC GATE PASS</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border shadow-sm transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-500 hover:text-black p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Challan #, Vendor, Gate Pass, or Machine Code..."
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'pending_approval', 'dispatched', 'partially_returned', 'fully_returned'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-zinc-950 text-white font-black shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {st === 'ALL' ? 'All Challans' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* RDC Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Challan Number</th>
                <th className="px-6 py-3.5">External Vendor / Party</th>
                <th className="px-6 py-3.5">Overhaul Purpose</th>
                <th className="px-6 py-3.5">Line Items</th>
                <th className="px-6 py-3.5">Expected Return</th>
                <th className="px-6 py-3.5">Security Gate Pass</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Gate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-jcb-yellowDark mb-2" />
                    Loading factory gate movement records...
                  </td>
                </tr>
              ) : filteredRDCs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    No matching returnable delivery challans found.
                  </td>
                </tr>
              ) : (
                filteredRDCs.map((rdc) => {
                  const isPending = rdc.status === 'pending_approval';
                  const isDispatched = rdc.status === 'dispatched';
                  const isPartiallyReturned = rdc.status === 'partially_returned';
                  const isFullyReturned = rdc.status === 'fully_returned';

                  return (
                    <tr key={rdc.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-mono text-xs font-black text-amber-700">{rdc.challan_number}</div>
                        <div className="text-[10px] text-zinc-400 font-bold">{rdc.rdc_type}</div>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-zinc-950">
                        {rdc.vendor_party_name}
                        {rdc.contact_person && (
                          <div className="text-[10px] text-zinc-400 font-normal">Attn: {rdc.contact_person}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-700 font-medium max-w-xs truncate" title={rdc.purpose}>
                        <div>{rdc.purpose}</div>
                        {rdc.machine_code && (
                          <span className="font-mono text-[10px] text-zinc-400">Asset: {rdc.machine_code}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {rdc.items && rdc.items.length > 0 ? (
                          <div className="space-y-0.5">
                            {rdc.items.map((it) => (
                              <div key={it.id} className="font-medium text-zinc-800">
                                <span>{it.item_description}</span>{' '}
                                <span className="font-mono font-bold text-zinc-500">
                                  ({it.quantity_returned || 0}/{it.quantity_dispatched})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">No line items</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 font-mono font-bold text-zinc-800">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>
                            {rdc.expected_return_date
                              ? new Date(rdc.expected_return_date).toLocaleDateString('en-IN')
                              : '7 Days'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                        {rdc.gate_pass_number || (
                          <span className="text-zinc-400 font-normal italic">Awaiting Approval</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isFullyReturned
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isPartiallyReturned
                              ? 'bg-yellow-50 text-yellow-900 border-yellow-300'
                              : isDispatched
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                          }`}
                        >
                          {rdc.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canManageRDC && isPending && (
                            <button
                              onClick={() => handleApproveAndDispatch(rdc.id)}
                              disabled={actionLoading}
                              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm border border-amber-500 uppercase tracking-wider transition cursor-pointer disabled:opacity-50"
                            >
                              Approve & Dispatch
                            </button>
                          )}
                          {(isDispatched || isPartiallyReturned) && canManageRDC && (
                            <button
                              onClick={() => openReturnModal(rdc)}
                              disabled={actionLoading}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>Inward Return</span>
                            </button>
                          )}
                          {isFullyReturned && (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Closed</span>
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

      {/* Modal: Create RDC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-300 overflow-hidden">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  RDC
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  ISSUE RETURNABLE DELIVERY CHALLAN
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRDC} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Challan Type *
                  </label>
                  <select
                    value={formData.rdc_type}
                    onChange={(e) => setFormData({ ...formData, rdc_type: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="RDC">Returnable Delivery Challan (RDC)</option>
                    <option value="NRDC">Non-Returnable Delivery Challan (NRDC)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Expected Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expected_return_date}
                    onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Vendor / Service Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vendor_party_name}
                  onChange={(e) => setFormData({ ...formData, vendor_party_name: e.target.value })}
                  placeholder="e.g. Bosch Rexroth Hydraulics / Siemens Spindle Care"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Vendor GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_gstin}
                    onChange={(e) => setFormData({ ...formData, vendor_gstin: e.target.value })}
                    placeholder="e.g. 06AAACJ1234F1Z8"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Contact Person / Rep
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. Amit Kumar (Engineer)"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Outward Purpose / Service Required *
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="Spindle Bearing Overhaul & Dynamic Balancing">Spindle Bearing Overhaul & Balancing</option>
                  <option value="AC Servo Motor Stator Rewinding">AC Servo Motor Stator Rewinding</option>
                  <option value="Hydraulic Cylinder Seal & Rod Reconditioning">Hydraulic Cylinder Seal & Rod Reconditioning</option>
                  <option value="CNC Controller PCB Calibration & Repair">CNC Controller PCB Calibration & Repair</option>
                  <option value="Heavy Gearbox Re-shimming">Heavy Gearbox Re-shimming</option>
                </select>
              </div>

              {/* Line Item Section */}
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="text-[11px] font-black text-zinc-800 uppercase tracking-wider">
                  Outward Item Specification
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                    Item Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.item_description}
                    onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
                    placeholder="e.g. Main Spindle Cartridge Unit #4"
                    className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.serial_number}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                      placeholder="e.g. SN-8849-01"
                      className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.quantity_dispatched}
                      onChange={(e) => setFormData({ ...formData, quantity_dispatched: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">
                      Approx Value (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.approximate_value}
                      onChange={(e) => setFormData({ ...formData, approximate_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Associated Machine Asset
                </label>
                <select
                  value={formData.machine_id}
                  onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Standalone Component (Not Mounted) --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Issuing...' : 'Issue RDC Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Inward Return */}
      {returnModalChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-300 overflow-hidden">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-black text-white tracking-wide">
                  RECORD RDC INWARD RETURN
                </h3>
              </div>
              <button
                onClick={() => setReturnModalChallan(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-zinc-50 border-b border-zinc-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Challan #:</span>
                <strong className="font-mono text-zinc-900">{returnModalChallan.challan_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Vendor Party:</span>
                <strong className="text-zinc-900">{returnModalChallan.vendor_party_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Gate Pass #:</span>
                <strong className="font-mono text-zinc-900">{returnModalChallan.gate_pass_number || 'N/A'}</strong>
              </div>
            </div>

            <form onSubmit={handleRecordReturn} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Select Item Returned *
                </label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    const it = returnModalChallan.items?.find((i) => i.id === e.target.value);
                    if (it) {
                      setReturnQty(Math.max(1, it.quantity_dispatched - (it.quantity_returned || 0)));
                    }
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {returnModalChallan.items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_description} (Dispatched: {it.quantity_dispatched}, Returned so far: {it.quantity_returned || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Quantity Received Back *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReturnModalChallan(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Recording...' : 'Record Gate Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
