import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  Package, 
  MapPin, 
  AlertTriangle, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  Filter
} from 'lucide-react';

interface SparePart {
  id: string;
  part_number: string;
  oem_part_number?: string | null;
  name: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  uom?: string;
  warehouse_zone: string | null;
  bin_location: string;
  rack_number?: string | null;
  shelf_number?: string | null;
  bin_number?: string | null;
  current_physical_stock: number;
  reserved_stock: number;
  quarantined_stock: number;
  available_stock: number;
  min_reorder_level: number;
  max_stock_level: number;
  unit_cost: number;
  supplier_name?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIES = [
  'ALL',
  'Mechanical',
  'Hydraulic',
  'Electrical',
  'Bearings',
  'Seals',
  'Pneumatic',
  'Consumables',
];

export const InventoryCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canAdjust = isAdmin || isManager;

  // Search & Filter state
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Catalog data & loading
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Request race-condition tracking
  const requestIdRef = useRef(0);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  
  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<SparePart | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Delete Confirmation Modal
  const [partToDelete, setPartToDelete] = useState<SparePart | null>(null);

  // Form & Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pageFeedback, setPageFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Create / Edit Form State (Clean defaults - no fabricated sample values)
  const [formData, setFormData] = useState({
    part_number: '',
    oem_part_number: '',
    name: '',
    description: '',
    category: 'Mechanical',
    subcategory: '',
    uom: 'Nos',
    warehouse_zone: 'Main Store',
    bin_location: '',
    min_reorder_level: 5,
    max_stock_level: 100,
    unit_cost: 0,
    supplier_name: 'JCB Genuine Parts',
  });

  // Fetch Parts with debouncing & race-condition cancellation
  const fetchParts = useCallback(async (searchTerm = searchInput, category = selectedCategory, pageNum = page) => {
    const currentRequestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setFetchError(null);

      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('query', searchTerm.trim());
      if (category !== 'ALL') params.append('category', category);
      params.append('page', String(pageNum));
      params.append('limit', String(limit));

      const res = await apiClient.get(`/inventory?${params.toString()}`);

      // Safely discard out-of-order stale responses
      if (currentRequestId !== requestIdRef.current) return;

      if (res.data && res.data.success) {
        setParts(res.data.data || []);
        if (res.data.pagination) {
          setTotalCount(res.data.pagination.total);
          setTotalPages(res.data.pagination.totalPages || 1);
        } else {
          setTotalCount(res.data.data?.length || 0);
          setTotalPages(1);
        }
      }
    } catch (err: any) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('Failed to load parts catalog:', err);
      setFetchError(err.response?.data?.message || 'Failed to connect to spare parts catalog. Please check server status.');
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [searchInput, selectedCategory, page, limit]);

  // Debounced search on input change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchParts(searchInput, selectedCategory, 1);
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, selectedCategory]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParts(searchInput, selectedCategory, 1);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchParts(searchInput, selectedCategory, newPage);
  };

  // Open Create Modal (Clean empty defaults, initial stock always 0)
  const openCreateModal = () => {
    setEditingPart(null);
    setFormData({
      part_number: '',
      oem_part_number: '',
      name: '',
      description: '',
      category: 'Mechanical',
      subcategory: '',
      uom: 'Nos',
      warehouse_zone: 'Main Store',
      bin_location: '',
      min_reorder_level: 5,
      max_stock_level: 100,
      unit_cost: 0,
      supplier_name: 'JCB Genuine Parts',
    });
    setModalFeedback(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal (Preserves exact existing record values, physical stock is read-only)
  const openEditModal = (p: SparePart) => {
    setEditingPart(p);
    setFormData({
      part_number: p.part_number,
      oem_part_number: p.oem_part_number || '',
      name: p.name,
      description: p.description || '',
      category: p.category || 'Mechanical',
      subcategory: p.subcategory || '',
      uom: p.uom || 'Nos',
      warehouse_zone: p.warehouse_zone || 'Main Store',
      bin_location: p.bin_location || '',
      min_reorder_level: p.min_reorder_level !== undefined ? p.min_reorder_level : 5,
      max_stock_level: p.max_stock_level !== undefined ? p.max_stock_level : 100,
      unit_cost: p.unit_cost !== undefined ? p.unit_cost : 0,
      supplier_name: p.supplier_name || 'JCB Genuine Parts',
    });
    setModalFeedback(null);
    setIsModalOpen(true);
  };

  // Save Part (Create or Edit)
  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_number.trim() || !formData.name.trim() || !formData.bin_location.trim()) {
      setModalFeedback({ type: 'error', text: 'Part Number, Name, and Bin Location are mandatory.' });
      return;
    }

    try {
      setActionLoading(true);
      setModalFeedback(null);

      if (editingPart) {
        // Normal edit does NOT allow changing physical stock directly
        const res = await apiClient.put(`/inventory/${editingPart.id}`, formData);
        if (res.data.success) {
          setModalFeedback({ type: 'success', text: `Part ${formData.part_number} updated successfully.` });
          setPageFeedback({ type: 'success', text: `Part ${formData.part_number} metadata updated.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(searchInput, selectedCategory, page);
          }, 800);
        }
      } else {
        const res = await apiClient.post('/inventory', formData);
        if (res.data.success) {
          setModalFeedback({ type: 'success', text: `Part ${formData.part_number} added to master catalog.` });
          setPageFeedback({ type: 'success', text: `Part ${formData.part_number} registered successfully.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(searchInput, selectedCategory, 1);
            setPage(1);
          }, 800);
        }
      }
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save part. Please check inputs and ensure Part Number is unique.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Stock Adjustment Modal
  const openAdjustModal = (p: SparePart) => {
    setAdjustingPart(p);
    setAdjustQty(0);
    setAdjustReason('');
    setModalFeedback(null);
    setIsAdjustModalOpen(true);
  };

  // Submit Stock Adjustment with validation
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPart) return;

    if (adjustQty === 0) {
      setModalFeedback({ type: 'error', text: 'Adjustment quantity must be non-zero (+ to add, - to deduct).' });
      return;
    }

    if (!adjustReason.trim()) {
      setModalFeedback({ type: 'error', text: 'Adjustment reason is mandatory for compliance auditing.' });
      return;
    }

    const currentPhysical = Number(adjustingPart.current_physical_stock || 0);
    const reserved = Number(adjustingPart.reserved_stock || 0);
    const quarantined = Number(adjustingPart.quarantined_stock || 0);
    const expectedPhysical = currentPhysical + adjustQty;

    if (expectedPhysical < 0) {
      setModalFeedback({
        type: 'error',
        text: `Negative physical stock rejected: Current stock is ${currentPhysical}, cannot deduct ${Math.abs(adjustQty)}.`,
      });
      return;
    }

    if (expectedPhysical < (reserved + quarantined)) {
      setModalFeedback({
        type: 'error',
        text: `Cannot reduce physical stock below allocated stock (Reserved: ${reserved}, Quarantined: ${quarantined}).`,
      });
      return;
    }

    try {
      setActionLoading(true);
      setModalFeedback(null);
      const res = await apiClient.post('/inventory/adjust', {
        part_id: adjustingPart.id,
        adjustment_quantity: adjustQty,
        reason: adjustReason.trim(),
      });

      if (res.data.success) {
        setModalFeedback({ type: 'success', text: res.data.message });
        setPageFeedback({ type: 'success', text: res.data.message });
        setTimeout(() => {
          setIsAdjustModalOpen(false);
          fetchParts(searchInput, selectedCategory, page);
        }, 900);
      }
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Stock adjustment failed. Please verify quantities.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete / Inactivate
  const confirmDelete = async () => {
    if (!partToDelete) return;
    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/inventory/${partToDelete.id}`);
      if (res.data.success) {
        setPageFeedback({ type: 'success', text: res.data.message });
        setPartToDelete(null);
        fetchParts(searchInput, selectedCategory, page);
      }
    } catch (err: any) {
      setPageFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete/deactivate part.',
      });
      setPartToDelete(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">SPARE PARTS CATALOG & INVENTORY</h2>
            {isAdmin ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-xs">
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
            Real-time PostgreSQL Trigram indexed search with strict stock arithmetic: <strong className="text-zinc-800">Available = Physical - Reserved - Quarantined</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchParts(searchInput, selectedCategory, page)}
            disabled={loading}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition border border-zinc-300 cursor-pointer"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-jcb-yellowDark' : ''}`} />
          </button>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 border border-amber-500 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ADD SPARE PART</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Alert */}
      {pageFeedback && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
          pageFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-red-50 text-red-900 border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {pageFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
            <span>{pageFeedback.text}</span>
          </div>
          <button onClick={() => setPageFeedback(null)} className="text-zinc-500 hover:text-black p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Category Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs space-y-3">
        <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Part No (e.g. HYD-10025, 332/Y2415), Name, or OEM Part code..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-2xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Search
          </button>
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
        {fetchError && (
          <div className="p-6 bg-red-50 border-b border-red-200 text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => fetchParts(searchInput, selectedCategory, page)}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase transition"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Part Details</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Warehouse Location</th>
                <th className="px-3 py-3.5 text-right font-mono">Physical</th>
                <th className="px-3 py-3.5 text-right font-mono">Reserved</th>
                <th className="px-3 py-3.5 text-right font-mono">Quarantined</th>
                <th className="px-4 py-3.5 text-right font-mono">Available</th>
                <th className="px-4 py-3.5 text-right font-mono">Unit Price</th>
                {(isAdmin || canAdjust) && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin || canAdjust ? 9 : 8} className="text-center py-16 text-zinc-500 font-bold">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-jcb-yellowDark" />
                      <span>Scanning spare parts ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin || canAdjust ? 9 : 8} className="text-center py-16 text-zinc-400">
                    <Package className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                    <p className="font-bold text-zinc-700">No matching spare parts found</p>
                    <p className="text-xs text-zinc-400 mt-1">Try adjusting your search terms or category filter.</p>
                    {(searchInput || selectedCategory !== 'ALL') && (
                      <button
                        onClick={() => { setSearchInput(''); setSelectedCategory('ALL'); }}
                        className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold transition"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                parts.map((p) => {
                  const physical = Number(p.current_physical_stock ?? 0);
                  const reserved = Number(p.reserved_stock ?? 0);
                  const quarantined = Number(p.quarantined_stock ?? 0);
                  const available = p.available_stock !== undefined
                    ? Number(p.available_stock)
                    : (physical - reserved - quarantined);
                  const reorderThreshold = Number(p.min_reorder_level ?? 5);
                  const isLow = available <= reorderThreshold;

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-black text-sm text-zinc-950">{p.part_number}</div>
                        <div className="font-semibold text-zinc-700">{p.name}</div>
                        {p.oem_part_number && (
                          <div className="text-[10px] text-zinc-400 font-mono">OEM: {p.oem_part_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-zinc-800">{p.category}</span>
                        <div className="text-[10px] text-zinc-400">{p.uom || 'Nos'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{p.bin_location}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">{p.warehouse_zone || 'Main Store'}</div>
                      </td>
                      <td className="px-3 py-3.5 font-mono font-bold text-zinc-900 text-right">{physical}</td>
                      <td className="px-3 py-3.5 font-mono text-amber-700 font-bold text-right">{reserved}</td>
                      <td className="px-3 py-3.5 font-mono text-purple-700 font-bold text-right">{quarantined}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono text-sm font-black ${isLow ? 'text-red-700' : 'text-emerald-700'}`}>
                            {available}
                          </span>
                          {isLow && (
                            <span className="bg-red-50 text-red-700 text-[9px] font-black px-1.5 py-0.2 rounded uppercase mt-0.5 border border-red-200">
                              Low Stock (≤{reorderThreshold})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-800 font-bold text-right">
                        ₹{Number(p.unit_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      {(isAdmin || canAdjust) && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAdjust && (
                              <button
                                onClick={() => openAdjustModal(p)}
                                className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer"
                                title="Adjust Stock Quantity"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openEditModal(p)}
                                  className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                  title="Edit Part Metadata"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setPartToDelete(p)}
                                  className="p-1.5 text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Deactivate / Delete Part"
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

        {/* Pagination Footer */}
        <div className="bg-zinc-50 px-6 py-3.5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-zinc-500 font-medium">
            Showing <strong className="text-zinc-900">{parts.length > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-zinc-900">{Math.min(page * limit, totalCount)}</strong> of{' '}
            <strong className="text-zinc-900">{totalCount}</strong> parts
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-zinc-800 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Part Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow-xs">
                  JCB
                </div>
                <h3 className="text-sm font-black text-white tracking-wide">
                  {editingPart ? `EDIT PART MASTER: ${editingPart.part_number}` : 'REGISTER NEW SPARE PART'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-6 space-y-4">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              {/* If editing, show read-only stock metrics bar */}
              {editingPart && (
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs space-y-1">
                  <div className="flex items-center justify-between text-zinc-500 font-bold uppercase text-[10px]">
                    <span>Current Stock Status</span>
                    <span>Available: <strong className="text-emerald-700 font-mono text-xs">{editingPart.available_stock}</strong></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-zinc-800 text-xs">
                    <div>Physical: <strong>{editingPart.current_physical_stock}</strong></div>
                    <div>Reserved: <strong>{editingPart.reserved_stock}</strong></div>
                    <div>Quarantined: <strong>{editingPart.quarantined_stock}</strong></div>
                  </div>
                  <p className="text-[10px] text-amber-800 font-medium pt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" />
                    Physical stock can only be updated via the Stock Adjustment action to preserve regulatory audit trails.
                  </p>
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
                    disabled={!!editingPart || actionLoading}
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="e.g. HYD-20015 or 332/Y2415"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:bg-zinc-100 disabled:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    OEM Part Number
                  </label>
                  <input
                    type="text"
                    disabled={actionLoading}
                    value={formData.oem_part_number}
                    onChange={(e) => setFormData({ ...formData, oem_part_number: e.target.value })}
                    placeholder="e.g. REX-4WRKE-25"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Part Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={actionLoading}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. High Pressure Hydraulic Proportional Valve"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    disabled={actionLoading}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    {CATEGORIES.filter(c => c !== 'ALL').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <input
                    type="text"
                    disabled={actionLoading}
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    placeholder="Nos, Sets, Mtr..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Warehouse Bin Location *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={actionLoading}
                    value={formData.bin_location}
                    onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                    placeholder="e.g. A-02-04 or B-102"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Warehouse Zone
                  </label>
                  <input
                    type="text"
                    disabled={actionLoading}
                    value={formData.warehouse_zone}
                    onChange={(e) => setFormData({ ...formData, warehouse_zone: e.target.value })}
                    placeholder="Main Store, Bay Store..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Min Reorder Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    disabled={actionLoading}
                    value={formData.min_reorder_level}
                    onChange={(e) => setFormData({ ...formData, min_reorder_level: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Max Stock Level
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={actionLoading}
                    value={formData.max_stock_level}
                    onChange={(e) => setFormData({ ...formData, max_stock_level: parseInt(e.target.value, 10) || 1 })}
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
                    step="0.01"
                    disabled={actionLoading}
                    value={formData.unit_cost}
                    onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  disabled={actionLoading}
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  placeholder="e.g. Bosch Rexroth India Ltd."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : editingPart ? 'Update Part' : 'Add Part Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && adjustingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-jcb-yellow" />
                <h3 className="text-sm font-black text-white tracking-wide">
                  STOCK ADJUSTMENT: {adjustingPart.part_number}
                </h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              {/* Current Metrics Card */}
              <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-xs space-y-2">
                <div>
                  <span className="font-black text-zinc-950 text-sm">{adjustingPart.name}</span>
                  <div className="text-[11px] text-zinc-500 font-mono">Location: {adjustingPart.bin_location} ({adjustingPart.warehouse_zone || 'Main Store'})</div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-200 text-center font-mono">
                  <div className="bg-white p-1.5 rounded border border-zinc-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Physical</div>
                    <div className="font-bold text-zinc-900">{adjustingPart.current_physical_stock}</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-zinc-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Reserved</div>
                    <div className="font-bold text-amber-700">{adjustingPart.reserved_stock}</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-zinc-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Quarantined</div>
                    <div className="font-bold text-purple-700">{adjustingPart.quarantined_stock}</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-zinc-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Available</div>
                    <div className="font-bold text-emerald-700">{adjustingPart.available_stock}</div>
                  </div>
                </div>
              </div>

              {/* Input for Adjustment Quantity */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Adjustment Quantity (+ to Add, - to Deduct) *
                </label>
                <input
                  type="number"
                  required
                  disabled={actionLoading}
                  value={adjustQty || ''}
                  onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. +10 or -3"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono font-black text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                <span className="text-[10px] text-zinc-500 font-medium mt-1 block">
                  Positive integers add stock; negative integers deduct stock. Must be non-zero.
                </span>
              </div>

              {/* Live Preview Calculation */}
              {adjustQty !== 0 && (
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-900">Live Stock Arithmetic Preview:</div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-zinc-600">Expected Physical Stock:</span>
                    <strong className={`${Number(adjustingPart.current_physical_stock) + adjustQty < 0 ? 'text-red-700' : 'text-zinc-950'}`}>
                      {Number(adjustingPart.current_physical_stock) + adjustQty}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-zinc-600">Expected Available Stock:</span>
                    <strong className="text-emerald-700">
                      {Number(adjustingPart.current_physical_stock) + adjustQty - Number(adjustingPart.reserved_stock) - Number(adjustingPart.quarantined_stock)}
                    </strong>
                  </div>
                </div>
              )}

              {/* Input for Mandatory Reason */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Reason for Adjustment * (Audit Ledger)
                </label>
                <input
                  type="text"
                  required
                  disabled={actionLoading}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical inventory cycle count adjustment"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || adjustQty === 0 || !adjustReason.trim()}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Recording Ledger...' : 'Commit Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Inactivate Confirmation Dialog */}
      {partToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-950 p-5 flex items-center justify-between border-b border-red-900 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-black tracking-wide">
                  CONFIRM PART DELETION / DEACTIVATION
                </h3>
              </div>
              <button
                onClick={() => setPartToDelete(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-zinc-700 font-medium">
                Are you sure you want to delete or deactivate spare part <strong className="text-zinc-950">{partToDelete.part_number}</strong> ({partToDelete.name})?
              </p>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0 text-amber-700" />
                  Referential Integrity Safeguard:
                </p>
                <p className="text-[11px]">
                  If this part has historical maintenance records, work orders, or inventory transaction history, it will be marked as <strong className="uppercase">inactive</strong> rather than hard deleted to preserve compliance audit trails.
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setPartToDelete(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Processing...' : 'Deactivate / Delete Part'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
