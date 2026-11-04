import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Package, 
  MapPin, 
  AlertTriangle, 
  Layers, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  SlidersHorizontal,
  AlertCircle 
} from 'lucide-react';

export const InventoryCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canAdjust = isAdmin || isManager;

  const [query, setQuery] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock Count Verification');

  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    part_number: '',
    oem_part_number: '',
    name: '',
    description: '',
    category: 'Hydraulic',
    bin_location: 'A-01-01',
    current_physical_stock: 10,
    min_reorder_level: 5,
    max_stock_level: 100,
    unit_cost: 1500,
    supplier_name: 'JCB Genuine Parts',
  });

  const fetchParts = async (search = '') => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/inventory/search?query=${encodeURIComponent(search)}&limit=50`);
      if (res.data.success) {
        setParts(res.data.data);
        setTotalCount(res.data.pagination?.total || res.data.data.length);
      }
    } catch (e) {
      console.error('Failed to load parts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts('');
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(query);
  };

  const openCreateModal = () => {
    setEditingPart(null);
    setFormData({
      part_number: `JCB-${Math.floor(10000 + Math.random() * 90000)}`,
      oem_part_number: `OEM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      description: 'Heavy duty replacement component',
      category: 'Hydraulic',
      bin_location: `BIN-${String.fromCharCode(65 + Math.floor(Math.random() * 6))}-${Math.floor(1 + Math.random() * 9)}`,
      current_physical_stock: 25,
      min_reorder_level: 5,
      max_stock_level: 150,
      unit_cost: 3200,
      supplier_name: 'JCB Heavy Machinery Parts Ltd.',
    });
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setEditingPart(p);
    setFormData({
      part_number: p.part_number,
      oem_part_number: p.oem_part_number || '',
      name: p.name,
      description: p.description || '',
      category: p.category || 'Mechanical',
      bin_location: p.bin_location || 'A-01-01',
      current_physical_stock: p.current_physical_stock || 0,
      min_reorder_level: p.min_reorder_level || 5,
      max_stock_level: p.max_stock_level || 100,
      unit_cost: p.unit_cost || 0,
      supplier_name: p.supplier_name || 'JCB Genuine Parts',
    });
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      if (editingPart) {
        const res = await apiClient.put(`/inventory/${editingPart.id}`, formData);
        if (res.data.success) {
          setFeedbackMsg({ type: 'success', text: `Part ${formData.part_number} updated successfully.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(query);
          }, 800);
        }
      } else {
        const res = await apiClient.post('/inventory', formData);
        if (res.data.success) {
          setFeedbackMsg({ type: 'success', text: `Part ${formData.part_number} added to catalog.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(query);
          }, 800);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save part. Please check inputs.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePart = async (id: string, partNo: string) => {
    if (!window.confirm(`Are you sure you want to remove part ${partNo} from active catalog?`)) {
      return;
    }
    try {
      const res = await apiClient.delete(`/inventory/${id}`);
      if (res.data.success) {
        alert(res.data.message || `Part ${partNo} removed.`);
        fetchParts(query);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete part.');
    }
  };

  const openAdjustModal = (p: any) => {
    setAdjustingPart(p);
    setAdjustQty(0);
    setAdjustReason('Physical stock audit count');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPart || adjustQty === 0) return;

    try {
      setActionLoading(true);
      const res = await apiClient.post('/inventory/adjust', {
        part_id: adjustingPart.id,
        adjustment_quantity: adjustQty,
        reason: adjustReason,
      });
      if (res.data.success) {
        alert(res.data.message);
        setIsAdjustModalOpen(false);
        fetchParts(query);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Adjustment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">160,000 SKU SPARE PARTS CATALOG</h2>
            {isAdmin ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
                Admin Full Access (CRUD)
              </span>
            ) : canAdjust ? (
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-300">
                Stock Adjust Access ({user?.role?.toUpperCase()})
              </span>
            ) : (
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                Search & View ({user?.role?.toUpperCase()})
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            PostgreSQL GIN Trigram indexed sub-10ms search with segregated stock arithmetic: Available = Physical - Reserved - Quarantined.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
            >
              <Plus className="w-4 h-4" />
              <span>ADD SPARE PART</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              fetchParts(e.target.value);
            }}
            placeholder="Sub-10ms Trigram Search: Part number (e.g. HYD-10025, 332/Y2415), name, or OEM code..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow"
        >
          Search
        </button>
      </form>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Part Details</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Warehouse Location</th>
                <th className="px-6 py-3.5">Physical</th>
                <th className="px-6 py-3.5">Reserved</th>
                <th className="px-6 py-3.5">Available Stock</th>
                <th className="px-6 py-3.5">Unit Price</th>
                {(isAdmin || canAdjust) && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-zinc-400 font-bold">
                    Scanning 160,000 SKUs...
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-zinc-400 font-bold">
                    No matching spare parts found.
                  </td>
                </tr>
              ) : (
                parts.map((p) => {
                  const physical = p.current_physical_stock || 0;
                  const reserved = p.reserved_stock || 0;
                  const available = p.available_stock !== undefined ? p.available_stock : (physical - reserved);
                  const isLow = available <= (p.min_reorder_level || 5);

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-black text-sm text-zinc-950">{p.part_number}</div>
                        <div className="font-semibold text-zinc-700">{p.name}</div>
                        {p.oem_part_number && (
                          <div className="text-[10px] text-zinc-400 font-mono">OEM: {p.oem_part_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-bold text-zinc-800">{p.category}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{p.bin_location}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">{p.warehouse_zone || 'Main Store'}</div>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">{physical}</td>
                      <td className="px-6 py-3.5 font-mono text-amber-700 font-bold">{reserved}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-sm font-black ${isLow ? 'text-red-700' : 'text-emerald-700'}`}>
                            {available}
                          </span>
                          {isLow && (
                            <span className="bg-red-50 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                              Low Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-zinc-700 font-bold">
                        ₹{Number(p.unit_cost || 0).toLocaleString('en-IN')}
                      </td>
                      {(isAdmin || canAdjust) && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAdjust && (
                              <button
                                onClick={() => openAdjustModal(p)}
                                className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition"
                                title="Adjust Stock Quantity"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition"
                                  title="Edit Part Details"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePart(p.id, p.part_number)}
                                  className="p-1.5 text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                  title="Delete Part"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Part Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  JCB
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  {editingPart ? `EDIT PART: ${formData.part_number}` : 'ADD NEW SPARE PART MASTER'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-6 space-y-4">
              {feedbackMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    JCB Part Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="e.g. HYD-20015"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Part Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Hydraulic Proportional Valve"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Hydraulic, Electrical, Mechanical..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Warehouse Bin Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.bin_location}
                    onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                    placeholder="e.g. A-02-04"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Physical Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.current_physical_stock}
                    onChange={(e) => setFormData({ ...formData, current_physical_stock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Min Reorder Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_reorder_level}
                    onChange={(e) => setFormData({ ...formData, min_reorder_level: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Unit Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
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
                  {actionLoading ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && adjustingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-sm font-black text-white tracking-wide">
                ADJUST STOCK: {adjustingPart.part_number}
              </h3>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <p className="font-bold text-zinc-900">{adjustingPart.name}</p>
                <p className="text-zinc-500 mt-1">Current Physical: <strong className="text-black">{adjustingPart.current_physical_stock}</strong></p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Quantity Adjustment (+ or -)
                </label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. +5 or -2"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <span className="text-[10px] text-zinc-500 font-medium">Use positive numbers to add stock, negative to reduce.</span>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory count correction"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || adjustQty === 0}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
