import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  Search, Package, MapPin, AlertTriangle, Plus, Edit2, Trash2, X,
  CheckCircle2, SlidersHorizontal, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, Info, Filter, Boxes, ShoppingCart, ArrowRight, Eye,
  ArrowUpDown, ArrowUp, ArrowDown, Building2, Layers, DollarSign,
  XCircle, TrendingDown
} from 'lucide-react';

interface Plant {
  id: string;
  plant_name: string;
  plant_code: string;
  status: string;
}

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
  plant_id?: string | null;
  plant_name?: string | null;
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
  'ALL', 'Mechanical', 'Hydraulic', 'Electrical',
  'Bearings', 'Seals', 'Pneumatic', 'Consumables'
];

type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
type SortField = 'part_number' | 'name' | 'category' | 'available_stock' | 'current_physical_stock' | 'unit_cost' | 'created_at';
type SortOrder = 'ASC' | 'DESC';

const INITIAL_FORM_DATA = {
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
  plant_id: ''
};

export const InventoryCatalogPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isStoreManager = user?.role === 'store_manager';
  const canAdjust = !isAdmin && (isManager || isStoreManager);
  const canManageParts = !isAdmin && (isManager || isStoreManager);
  const canAccessStoreDashboard = isAdmin || isManager || isStoreManager;

  const userPlantId = (user as any)?.plant_id as string | undefined;

  // Search and filter state
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPlantId, setSelectedPlantId] = useState(isAdmin ? 'ALL' : (userPlantId || ''));
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('part_number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Plant state
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(false);
  const [plantsError, setPlantsError] = useState<string | null>(null);

  // Catalog state
  const [parts, setParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // KPI Summary State from backend dashboard API
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(false);

  const requestIdRef = useRef(0);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [viewingPart, setViewingPart] = useState<SparePart | null>(null);

  // Stock adjustment modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<SparePart | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Delete confirmation
  const [partToDelete, setPartToDelete] = useState<SparePart | null>(null);

  // Purchase requisition modal
  const [prPart, setPrPart] = useState<SparePart | null>(null);
  const [prQuantity, setPrQuantity] = useState<number>(5);
  const [prUrgency, setPrUrgency] = useState<'critical' | 'high' | 'medium' | 'low'>('high');
  const [prJustification, setPrJustification] = useState('');
  const [prLoading, setPrLoading] = useState(false);

  const { socket } = useSocket();

  const [actionLoading, setActionLoading] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [pageFeedback, setPageFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    redirectLabel?: string;
    redirectUrl?: string;
  } | null>(null);

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Load active plants for spare-part assignment and plant filtering.
  useEffect(() => {
    let cancelled = false;

    const fetchPlants = async () => {
      try {
        setPlantsLoading(true);
        setPlantsError(null);

        const res = await apiClient.get('/org/plants');
        const responseData = res.data?.data;

        const plantList: Plant[] = Array.isArray(responseData)
          ? responseData
          : Array.isArray(responseData?.plants)
            ? responseData.plants
            : [];

        if (cancelled) return;

        let activePlants = plantList.filter(
          (plant) => plant.status?.toLowerCase() === 'active'
        );

        // Non-admins restricted strictly to their assigned plant
        if (!isAdmin && userPlantId) {
          activePlants = activePlants.filter(
            (plant) => plant.id === userPlantId
          );
          setSelectedPlantId(userPlantId);
        }

        setPlants(activePlants);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load plants:', err);
        setPlantsError(
          err.response?.data?.message || 'Unable to load active plants.'
        );
      } finally {
        if (!cancelled) setPlantsLoading(false);
      }
    };

    fetchPlants();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, userPlantId]);

  // Fetch KPI Summary metrics from backend
  const fetchKPISummary = useCallback(async () => {
    if (!canAccessStoreDashboard) return;

    try {
      setKpiLoading(true);
      const plantParams = selectedPlantId && selectedPlantId !== 'ALL'
        ? { plant_id: selectedPlantId }
        : {};

      const res = await apiClient.get('/inventory/dashboard', {
        params: plantParams
      });

      if (res.data?.success && res.data.data?.summary) {
        setDashboardSummary(res.data.data.summary);
      }
    } catch (err) {
      console.warn('Dashboard summary not accessible for role or failed:', err);
    } finally {
      setKpiLoading(false);
    }
  }, [canAccessStoreDashboard, selectedPlantId]);

  // Fetch spare parts with search, category, plant, and sorting parameters.
  const fetchParts = useCallback(async (
    searchTerm = searchInput,
    category = selectedCategory,
    pageNum = page,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder
  ) => {
    const currentRequestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setFetchError(null);

      const params = new URLSearchParams();

      if (searchTerm.trim()) {
        params.append('query', searchTerm.trim());
      }

      if (category !== 'ALL') {
        params.append('category', category);
      }

      // Apply plant filter safely respecting roles
      if (selectedPlantId && selectedPlantId !== 'ALL') {
        params.append('plant_id', selectedPlantId);
      }

      params.append('page', String(pageNum));
      params.append('limit', String(limit));
      params.append('sort_by', currentSortBy);
      params.append('sort_order', currentSortOrder);

      const res = await apiClient.get(`/inventory?${params.toString()}`);

      if (currentRequestId !== requestIdRef.current) return;

      if (res.data?.success) {
        const result = res.data.data || [];
        setParts(result);

        if (res.data.pagination) {
          setTotalCount(res.data.pagination.total);
          setTotalPages(res.data.pagination.totalPages || 1);
        } else {
          setTotalCount(result.length);
          setTotalPages(1);
        }
      }
    } catch (err: any) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error('Failed to load parts catalog:', err);
      setFetchError(
        err.response?.data?.message ||
        'Failed to connect to spare parts catalog. Please check server status.'
      );
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    searchInput,
    selectedCategory,
    selectedPlantId,
    page,
    limit,
    sortBy,
    sortOrder
  ]);

  // Debounced search and filter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchParts(searchInput, selectedCategory, 1, sortBy, sortOrder);
      fetchKPISummary();
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, selectedCategory, selectedPlantId, sortBy, sortOrder, fetchParts, fetchKPISummary]);

  // Real-time inventory updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleRemoteUpdate = () => {
      fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder);
      fetchKPISummary();
    };

    const events = [
      'inventory:stock_adjusted',
      'inventory:part_created',
      'inventory:part_updated',
      'inventory:part_deleted',
      'inventory:transfer_created',
      'inventory:damaged_reported',
      'inventory:disposition_updated',
      'procurement:grn_received'
    ];

    events.forEach((event) => socket.on(event, handleRemoteUpdate));

    return () => {
      events.forEach((event) => socket.off(event, handleRemoteUpdate));
    };
  }, [socket, searchInput, selectedCategory, selectedPlantId, page, sortBy, sortOrder, fetchParts, fetchKPISummary]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchParts(searchInput, selectedCategory, 1, sortBy, sortOrder);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handlePlantChange = (plantId: string) => {
    setSelectedPlantId(plantId);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchParts(searchInput, selectedCategory, newPage, sortBy, sortOrder);
  };

  const handleSortToggle = (field: SortField) => {
    if (sortBy === field) {
      const nextOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
      setSortOrder(nextOrder);
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSelectedCategory('ALL');
    setSelectedPlantId(isAdmin ? 'ALL' : userPlantId || 'ALL');
    setStockStatusFilter('ALL');
    setSortBy('part_number');
    setSortOrder('ASC');
    setPage(1);
  };

  const isFiltersActive =
    Boolean(searchInput.trim()) ||
    selectedCategory !== 'ALL' ||
    (isAdmin && selectedPlantId !== 'ALL') ||
    stockStatusFilter !== 'ALL' ||
    sortBy !== 'part_number' ||
    sortOrder !== 'ASC';

  // Client-filtered parts by stock status
  const displayedParts = useMemo(() => {
    if (stockStatusFilter === 'ALL') return parts;

    return parts.filter((part) => {
      const physical = Number(part.current_physical_stock ?? 0);
      const reserved = Number(part.reserved_stock ?? 0);
      const quarantined = Number(part.quarantined_stock ?? 0);
      const available = part.available_stock !== undefined
        ? Number(part.available_stock)
        : physical - reserved - quarantined;
      const reorderLevel = Number(part.min_reorder_level ?? 5);

      if (stockStatusFilter === 'OUT_OF_STOCK') {
        return physical === 0 || available <= 0;
      }
      if (stockStatusFilter === 'LOW_STOCK') {
        return available <= reorderLevel && physical > 0 && available > 0;
      }
      if (stockStatusFilter === 'IN_STOCK') {
        return available > reorderLevel;
      }
      return true;
    });
  }, [parts, stockStatusFilter]);

  // Dynamic KPI Metrics (combines backend summary with fallback calculations)
  const totalPartsCount = dashboardSummary?.total_parts ?? totalCount;
  const outOfStockCount = dashboardSummary?.out_of_stock_count ?? parts.filter(p => Number(p.current_physical_stock ?? 0) === 0).length;
  const lowStockCount = dashboardSummary?.low_stock_items_count ?? parts.filter(p => {
    const avail = p.available_stock ?? (Number(p.current_physical_stock || 0) - Number(p.reserved_stock || 0) - Number(p.quarantined_stock || 0));
    return avail <= Number(p.min_reorder_level || 5) && Number(p.current_physical_stock || 0) > 0;
  }).length;
  const inStockCount = Math.max(0, totalPartsCount - outOfStockCount - lowStockCount);
  const availableStockUnits = dashboardSummary?.total_available_stock ?? parts.reduce((acc, p) => acc + Number(p.available_stock || 0), 0);
  const totalValuation = dashboardSummary?.total_inventory_valuation ?? parts.reduce((acc, p) => acc + (Number(p.current_physical_stock || 0) * Number(p.unit_cost || 0)), 0);

  // Form modals handling
  const openCreateModal = () => {
    if (isAdmin) return; // Admin cannot create parts
    setEditingPart(null);
    setFormData({
      ...INITIAL_FORM_DATA,
      plant_id: userPlantId || (plants[0]?.id || '')
    });
    setModalFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (part: SparePart) => {
    setEditingPart(part);
    setFormData({
      ...INITIAL_FORM_DATA,
      part_number: part.part_number,
      oem_part_number: part.oem_part_number || '',
      name: part.name,
      description: part.description || '',
      category: part.category || 'Mechanical',
      subcategory: part.subcategory || '',
      uom: part.uom || 'Nos',
      warehouse_zone: part.warehouse_zone || 'Main Store',
      bin_location: part.bin_location || '',
      min_reorder_level: part.min_reorder_level ?? 5,
      max_stock_level: part.max_stock_level ?? 100,
      unit_cost: part.unit_cost ?? 0,
      supplier_name: part.supplier_name || 'JCB Genuine Parts',
      plant_id: part.plant_id || ''
    });
    setModalFeedback(null);
    setIsModalOpen(true);
  };

  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.part_number.trim() ||
      !formData.name.trim() ||
      !formData.bin_location.trim()
    ) {
      setModalFeedback({
        type: 'error',
        text: 'Part Number, Name, and Bin Location are mandatory.'
      });
      return;
    }

    if (!editingPart && !formData.plant_id) {
      setModalFeedback({
        type: 'error',
        text: 'Please select an assigned plant before creating the spare part.'
      });
      return;
    }

    try {
      setActionLoading(true);
      setModalFeedback(null);

      if (editingPart) {
        const { plant_id: _preservedPlantId, ...updatePayload } = formData;
        const res = await apiClient.put(`/inventory/${editingPart.id}`, updatePayload);

        if (res.data.success) {
          setModalFeedback({
            type: 'success',
            text: `Part ${formData.part_number} updated successfully.`
          });

          setPageFeedback({
            type: 'success',
            text: `Part ${formData.part_number} specifications updated in master ledger.`,
            redirectLabel: 'View in Store Dashboard',
            redirectUrl: '/store/dashboard'
          });

          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder);
            fetchKPISummary();
          }, 800);
        }
      } else {
        const createPayload = { ...formData, plant_id: formData.plant_id };
        const res = await apiClient.post('/inventory', createPayload);

        if (res.data.success) {
          setModalFeedback({
            type: 'success',
            text: `Part ${formData.part_number} registered successfully.`
          });

          setPageFeedback({
            type: 'success',
            text: `Part ${formData.part_number} added to active warehouse catalog.`,
            redirectLabel: 'View in Store Dashboard',
            redirectUrl: '/store/dashboard'
          });

          setTimeout(() => {
            setIsModalOpen(false);
            fetchParts(searchInput, selectedCategory, 1, sortBy, sortOrder);
            fetchKPISummary();
            setPage(1);
          }, 800);
        }
      }
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save part. Please check inputs and ensure Part Number is unique.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Stock Adjustment Handlers
  const openAdjustModal = (part: SparePart) => {
    setAdjustingPart(part);
    setAdjustQty(0);
    setAdjustReason('');
    setModalFeedback(null);
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPart) return;

    if (adjustQty === 0) {
      setModalFeedback({
        type: 'error',
        text: 'Adjustment quantity must be non-zero (+ to add stock, - to deduct stock).'
      });
      return;
    }

    if (!adjustReason.trim()) {
      setModalFeedback({
        type: 'error',
        text: 'Adjustment reason is mandatory for compliance audit logs.'
      });
      return;
    }

    const currentPhysical = Number(adjustingPart.current_physical_stock || 0);
    const reserved = Number(adjustingPart.reserved_stock || 0);
    const quarantined = Number(adjustingPart.quarantined_stock || 0);
    const expectedPhysical = currentPhysical + adjustQty;

    if (expectedPhysical < 0) {
      setModalFeedback({
        type: 'error',
        text: `Negative physical stock rejected: Current stock is ${currentPhysical}, cannot deduct ${Math.abs(adjustQty)}.`
      });
      return;
    }

    if (expectedPhysical < reserved + quarantined) {
      setModalFeedback({
        type: 'error',
        text: `Cannot reduce physical stock below allocated stock (Reserved: ${reserved}, Quarantined: ${quarantined}).`
      });
      return;
    }

    try {
      setActionLoading(true);
      setModalFeedback(null);

      const res = await apiClient.post('/inventory/adjust', {
        part_id: adjustingPart.id,
        adjustment_quantity: adjustQty,
        reason: adjustReason.trim()
      });

      if (res.data.success) {
        setModalFeedback({
          type: 'success',
          text: res.data.message
        });

        setPageFeedback({
          type: 'success',
          text: `Stock adjusted for ${adjustingPart.part_number}: ${res.data.message}`
        });

        setTimeout(() => {
          setIsAdjustModalOpen(false);
          fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder);
          fetchKPISummary();
        }, 900);
      }
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Stock adjustment failed. Please verify quantities.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete / Inactivation Handlers
  const confirmDelete = async () => {
    if (!partToDelete) return;

    try {
      setActionLoading(true);
      const res = await apiClient.delete(`/inventory/${partToDelete.id}`);

      if (res.data.success) {
        setPageFeedback({
          type: 'success',
          text: res.data.message
        });
        setPartToDelete(null);
        fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder);
        fetchKPISummary();
      }
    } catch (err: any) {
      setPageFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to delete/deactivate part.'
      });
      setPartToDelete(null);
    } finally {
      setActionLoading(false);
    }
  };

  // Purchase Requisition Handlers
  const openPRModal = (part: SparePart) => {
    setPrPart(part);
    setPrQuantity(Math.max(1, part.min_reorder_level || 5));
    setPrUrgency('high');

    const available = part.available_stock !== undefined
      ? Number(part.available_stock)
      : Number(part.current_physical_stock || 0) - Number(part.reserved_stock || 0) - Number(part.quarantined_stock || 0);

    setPrJustification(
      `Spare part replenishment request: Current available inventory is ${available} ${part.uom || 'Nos'}.`
    );
    setModalFeedback(null);
  };

  const handlePRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prPart || prQuantity <= 0) return;

    try {
      setPrLoading(true);
      const res = await apiClient.post('/procurement/pr', {
        part_id: prPart.id,
        quantity_required: prQuantity,
        urgency: prUrgency,
        technical_justification: prJustification.trim() || `Replenishment request for part ${prPart.part_number}`,
        plant_id: prPart.plant_id || userPlantId || (plants.length > 0 ? plants[0].id : undefined),
      });

      if (res.data?.success) {
        setPageFeedback({
          type: 'success',
          text: `Purchase Requisition ${res.data.data?.pr_number || ''} submitted successfully for manager approval!`
        });
        setPrPart(null);
      }
    } catch (err: any) {
      setModalFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit purchase requisition.'
      });
    } finally {
      setPrLoading(false);
    }
  };

  const selectedPlantName = (part: SparePart) =>
    part.plant_name ||
    plants.find((plant) => plant.id === part.plant_id)?.plant_name ||
    'Plant assignment unavailable';

  return (
    <div className="space-y-6 min-h-full pb-10">
      {/* =========================================================================
          TOP BANNER & ACTIONS BAR
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              Spare Part Inventory
            </h1>

            {isAdmin ? (
              <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-blue-300 shadow-2xs">
                Global Read-Only (ADMIN)
              </span>
            ) : canManageParts ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-2xs">
                Franchise Management: {plants.find(p => p.id === userPlantId)?.plant_name || user?.role?.toUpperCase()}
              </span>
            ) : (
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                Catalog View ({user?.role?.toUpperCase()})
              </span>
            )}
          </div>
{/* 
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Enterprise warehouse stock ledger with real-time allocation logic:{' '}
            <strong className="text-zinc-800">
              Available = Physical - Reserved - Quarantined
            </strong>
          </p> */}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* {canAccessStoreDashboard && (
            <Link
              to="/store/dashboard"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-zinc-800 rounded-xl text-xs font-bold transition border border-slate-300 shadow-2xs flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4 text-amber-600" />
              <span>Store Dashboard</span>
            </Link>
          )} */}

          <Link
            to="/procurement"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-zinc-800 rounded-xl text-xs font-bold transition border border-slate-300 shadow-2xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            <span>Procurement PRs</span>
          </Link>

          <button
            onClick={() => {
              fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder);
              fetchKPISummary();
            }}
            disabled={loading}
            title="Refresh Inventory Catalog"
            className="p-2.5 bg-white hover:bg-slate-50 text-zinc-700 rounded-xl transition border border-slate-300 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>

          {canManageParts && (
            <button
              onClick={openCreateModal}
              disabled={plantsLoading || plants.length === 0}
              className="bg-jcb-yellow hover:bg-amber-400 text-black text-xs font-black px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 border border-amber-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>{plantsLoading ? 'LOADING PLANTS...' : 'ADD SPARE PART'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global alert feedback banner */}
      {pageFeedback && (
        <div className={`p-4 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-3 border shadow-2xs ${
          pageFeedback.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
            : 'bg-red-50 text-red-900 border-red-300'
        }`}>
          <div className="flex items-center gap-2">
            {pageFeedback.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
            <span>{pageFeedback.text}</span>
          </div>

          <div className="flex items-center gap-3">
            {pageFeedback.redirectUrl && canAccessStoreDashboard && (
              <Link
                to={pageFeedback.redirectUrl}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition text-[11px]"
              >
                <span>{pageFeedback.redirectLabel || 'View in Store Dashboard'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            <button
              onClick={() => setPageFeedback(null)}
              className="text-zinc-500 hover:text-black p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          1. INVENTORY OVERVIEW — ENTERPRISE KPI CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Spare Parts */}
        <div
          onClick={() => setStockStatusFilter('ALL')}
          className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 cursor-pointer border-l-4 border-l-blue-600 ${
            stockStatusFilter === 'ALL'
              ? 'border-blue-300 ring-2 ring-blue-500/20'
              : 'border-slate-200/90 hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100/80 text-blue-800 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
              ₹{Number(totalValuation).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight leading-none">
              {kpiLoading ? '—' : totalPartsCount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mt-1.5">
              Total Spare Parts
            </p>
            <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
              {availableStockUnits.toLocaleString('en-IN')} Units Available Across Plants
            </p>
          </div>
        </div>

        {/* Card 2: In-Stock Items */}
        <div
          onClick={() => setStockStatusFilter('IN_STOCK')}
          className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 cursor-pointer border-l-4 border-l-emerald-600 ${
            stockStatusFilter === 'IN_STOCK'
              ? 'border-emerald-300 ring-2 ring-emerald-500/20'
              : 'border-slate-200/90 hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-100/80 text-emerald-800 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Optimal Level
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight leading-none">
              {kpiLoading ? '—' : inStockCount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mt-1.5">
              In-Stock Items
            </p>
            <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
              Above Reorder Safety Threshold
            </p>
          </div>
        </div>

        {/* Card 3: Low-Stock Items */}
        <div
          onClick={() => setStockStatusFilter('LOW_STOCK')}
          className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 cursor-pointer border-l-4 border-l-amber-500 ${
            stockStatusFilter === 'LOW_STOCK'
              ? 'border-amber-300 ring-2 ring-amber-500/20'
              : 'border-slate-200/90 hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100/80 text-amber-800 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
              Action Required
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono tracking-tight leading-none">
              {kpiLoading ? '—' : lowStockCount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mt-1.5">
              Low-Stock Items
            </p>
            <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
              At or Below Minimum Reorder Level
            </p>
          </div>
        </div>

        {/* Card 4: Out-of-Stock Items */}
        <div
          onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
          className={`bg-white rounded-2xl border p-5 shadow-xs transition-all duration-200 cursor-pointer border-l-4 border-l-red-600 ${
            stockStatusFilter === 'OUT_OF_STOCK'
              ? 'border-red-300 ring-2 ring-red-500/20'
              : 'border-slate-200/90 hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100/80 text-red-800 shadow-2xs">
              <XCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
              Stockout Risk
            </span>
          </div>
          <div className="mt-3.5">
            <div className="text-2xl sm:text-3xl font-black text-red-700 font-mono tracking-tight leading-none">
              {kpiLoading ? '—' : outOfStockCount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mt-1.5">
              Out-of-Stock Items
            </p>
            <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
              Zero Physical Inventory on Hand
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ADMIN: FRANCHISE INVENTORY OVERVIEW
          ========================================================================= */}
      {isAdmin && dashboardSummary?.franchise_breakdown && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-600" />
            Franchise Inventory Overview
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* All Franchises card */}
            <div
              onClick={() => handlePlantChange('ALL')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                selectedPlantId === 'ALL'
                  ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20'
                  : 'border-slate-200 bg-slate-50/50 hover:border-amber-300 hover:shadow-sm'
              }`}
            >
              <div className="text-xs font-black text-zinc-900 mb-1">All Franchises</div>
              <div className="text-lg font-black text-amber-700 font-mono">{totalPartsCount}</div>
              <div className="text-[10px] text-zinc-500 font-medium">Total parts across all plants</div>
            </div>

            {/* Individual franchise cards */}
            {(dashboardSummary.franchise_breakdown as any[]).map((franchise: any) => (
              <div
                key={franchise.plant_name}
                onClick={() => {
                  const matchedPlant = plants.find(p => p.plant_name === franchise.plant_name);
                  if (matchedPlant) handlePlantChange(matchedPlant.id);
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                  plants.find(p => p.plant_name === franchise.plant_name)?.id === selectedPlantId
                    ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-400/20'
                    : 'border-slate-200 bg-slate-50/50 hover:border-amber-300 hover:shadow-sm'
                }`}
              >
                <div className="text-xs font-black text-zinc-900 mb-1">{franchise.plant_name}</div>
                <div className="text-lg font-black text-zinc-800 font-mono">{franchise.total_parts}</div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium mt-0.5">
                  <span className="text-emerald-600">✓ {franchise.available_stock} avail</span>
                  {franchise.low_stock > 0 && <span className="text-amber-600">⚠ {franchise.low_stock} low</span>}
                  {franchise.out_of_stock > 0 && <span className="text-red-600">✕ {franchise.out_of_stock} out</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          3. ADVANCED SEARCH, FILTERING & SORTING TOOLBAR
          ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        {/* Row 1: Search Bar & Core Selectors */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Trigram Search Input */}
          <form onSubmit={handleManualSearch} className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Part Number, Part Name, or OEM code..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-amber-400 focus:bg-white font-medium shadow-2xs transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Plant Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Plant:
            </span>
            {isAdmin ? (
              <select
                value={selectedPlantId}
                onChange={(e) => handlePlantChange(e.target.value)}
                disabled={plantsLoading || plants.length === 0}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:cursor-not-allowed shadow-2xs"
              >
                <option value="ALL">All Plants (Global)</option>
                {plants.map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.plant_name} ({plant.plant_code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 shadow-2xs inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                {plants.find(p => p.id === userPlantId)?.plant_name || 'My Franchise'}
              </span>
            )}
          </div>

          {/* Sorting Dropdown & Order Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as SortField);
                setPage(1);
              }}
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-800 focus:outline-none focus:border-amber-400 shadow-2xs"
            >
              <option value="part_number">Part Number</option>
              <option value="name">Part Name</option>
              <option value="category">Category</option>
              <option value="available_stock">Available Stock</option>
              <option value="current_physical_stock">Physical Stock</option>
              <option value="unit_cost">Unit Cost</option>
              <option value="created_at">Date Added</option>
            </select>

            <button
              onClick={() => {
                const next = sortOrder === 'ASC' ? 'DESC' : 'ASC';
                setSortOrder(next);
                setPage(1);
              }}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-zinc-700 shadow-2xs cursor-pointer transition"
              title={`Sorting ${sortOrder === 'ASC' ? 'Ascending' : 'Descending'}`}
            >
              {sortOrder === 'ASC' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Reset Filters */}
          {isFiltersActive && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-zinc-700 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        {/* Row 2: Stock Status Pills & Category Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Stock Status Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
              Stock Status:
            </span>
            {[
              { key: 'ALL', label: 'All Items' },
              { key: 'IN_STOCK', label: 'In Stock' },
              { key: 'LOW_STOCK', label: 'Low Stock' },
              { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStockStatusFilter(st.key as StockStatusFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stockStatusFilter === st.key
                    ? 'bg-zinc-950 text-white shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-zinc-600 border border-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1 shrink-0">
              <Filter className="w-3 h-3 inline mr-1 text-amber-500" />
              Category:
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-black border border-amber-500 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-zinc-600 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SPARE PART INVENTORY TABLE — REDESIGNED ENTERPRISE UI
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {fetchError && (
          <div className="p-5 bg-red-50 border-b border-red-200 text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => fetchParts(searchInput, selectedCategory, page, sortBy, sortOrder)}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-zinc-600 font-black uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  onClick={() => handleSortToggle('part_number')}
                  className="px-5 py-3.5 cursor-pointer hover:text-zinc-950 transition select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Spare Part Identification</span>
                    {sortBy === 'part_number' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSortToggle('category')}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-950 transition select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category & UOM</span>
                    {sortBy === 'category' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </th>

                <th className="px-4 py-3.5">Warehouse Location</th>
                <th className="px-4 py-3.5">Plant</th>

                <th
                  onClick={() => handleSortToggle('available_stock')}
                  className="px-4 py-3.5 cursor-pointer hover:text-zinc-950 transition select-none w-44"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Available Stock Level</span>
                    {sortBy === 'available_stock' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSortToggle('current_physical_stock')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-zinc-950 transition select-none font-mono"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Physical / Alloc</span>
                    {sortBy === 'current_physical_stock' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </th>

                <th className="px-4 py-3.5 text-center">Status</th>

                <th
                  onClick={() => handleSortToggle('unit_cost')}
                  className="px-4 py-3.5 text-right cursor-pointer hover:text-zinc-950 transition select-none font-mono"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Unit Cost</span>
                    {sortBy === 'unit_cost' && (
                      sortOrder === 'ASC' ? <ArrowUp className="w-3 h-3 text-amber-600" /> : <ArrowDown className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </th>

                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-zinc-500 font-bold">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="w-7 h-7 animate-spin text-amber-600" />
                      <span className="text-zinc-700">Loading spare parts inventory records...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedParts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-zinc-400">
                    <Package className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
                    <p className="font-bold text-zinc-800 text-sm">No matching spare parts found</p>
                    <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                      No inventory items match your current search criteria or active filter parameters.
                    </p>

                    {isFiltersActive && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-zinc-800 rounded-xl text-xs font-bold transition shadow-2xs"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayedParts.map((part) => {
                  const physical = Number(part.current_physical_stock ?? 0);
                  const reserved = Number(part.reserved_stock ?? 0);
                  const quarantined = Number(part.quarantined_stock ?? 0);
                  const available = part.available_stock !== undefined
                    ? Number(part.available_stock)
                    : physical - reserved - quarantined;

                  const reorderThreshold = Number(part.min_reorder_level ?? 5);
                  const maxLevel = Number(part.max_stock_level ?? 100);

                  const isOut = physical === 0 || available <= 0;
                  const isLow = !isOut && available <= reorderThreshold;
                  const isOptimal = !isOut && !isLow;

                  // Stock bar calculation (relative to max level or 2x reorder)
                  const targetMax = Math.max(maxLevel, reorderThreshold * 2, 1);
                  const fillPercentage = Math.min(100, Math.max(0, (available / targetMax) * 100));

                  return (
                    <tr
                      key={part.id}
                      className="hover:bg-amber-50/30 transition-colors duration-150 group"
                    >
                      {/* Part Identification */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-zinc-900 px-2 py-0.5 rounded border border-slate-200">
                            {part.part_number}
                          </span>
                          {part.oem_part_number && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              OEM: {part.oem_part_number}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-zinc-900 text-xs mt-1 group-hover:text-amber-950 transition-colors">
                          {part.name}
                        </div>
                        {part.supplier_name && (
                          <div className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                            {part.supplier_name}
                          </div>
                        )}
                      </td>

                      {/* Category & UOM */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-zinc-800 text-xs block">
                          {part.category}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase font-mono">
                          Unit: {part.uom || 'Nos'}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{part.bin_location}</span>
                        </div>
                        <div className="text-[10px] text-zinc-400 font-medium">
                          {part.warehouse_zone || 'Main Store'}
                        </div>
                      </td>

                      {/* Plant */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-zinc-700 border border-slate-200">
                          <Building2 className="w-3 h-3 text-zinc-400" />
                          <span>{selectedPlantName(part)}</span>
                        </span>
                      </td>

                      {/* Available Stock & Progress Bar */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-zinc-700">
                              <strong className={`font-mono text-sm ${
                                isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {available}
                              </strong>
                              {' '}{part.uom || 'Nos'}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">
                              Min: {reorderThreshold}
                            </span>
                          </div>

                          {/* Visual Stock Bar */}
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOut
                                  ? 'bg-red-500 w-0'
                                  : isLow
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${isOut ? 0 : Math.max(fillPercentage, 5)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Physical & Allocation Numbers */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs">
                        <div className="font-bold text-zinc-900">
                          {physical}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          R: {reserved} | Q: {quarantined}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Low Stock (≤{reorderThreshold})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Unit Price */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-900 text-xs">
                        ₹{Number(part.unit_cost || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick View Details Button — always visible */}
                          <button
                            onClick={() => setViewingPart(part)}
                            className="p-1.5 text-zinc-500 hover:text-black hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="View Part Details & Specifications"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Raise PR Button — hidden for Admin */}
                          {!isAdmin && (
                            <button
                              onClick={() => openPRModal(part)}
                              className="p-1.5 text-amber-700 hover:text-black hover:bg-amber-100 rounded-lg transition cursor-pointer"
                              title="Raise Purchase Requisition (PR)"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}

                          {/* Adjust Stock Button (Manager, Store Manager only — not Admin) */}
                          {canAdjust && (
                            <button
                              onClick={() => openAdjustModal(part)}
                              className="p-1.5 text-zinc-600 hover:text-black hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Stock Adjustment (Cycle Count)"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit & Delete Part (Manager, Store Manager only — not Admin) */}
                          {canManageParts && (
                            <>
                              <button
                                onClick={() => openEditModal(part)}
                                className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                title="Edit Part Metadata"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setPartToDelete(part)}
                                className="p-1.5 text-zinc-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Deactivate / Delete Part"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

        {/* Pagination & Footer */}
        <div className="bg-slate-50/80 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-zinc-500 font-medium">
            Showing{' '}
            <strong className="text-zinc-950 font-mono font-bold">
              {displayedParts.length > 0 ? (page - 1) * limit + 1 : 0}
            </strong>
            {' '}to{' '}
            <strong className="text-zinc-950 font-mono font-bold">
              {Math.min(page * limit, totalCount)}
            </strong>
            {' '}of{' '}
            <strong className="text-zinc-950 font-mono font-bold">{totalCount}</strong> parts
          </div>

          <div className="flex items-center gap-3">
            {/* Rows per page selector */}
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span className="text-[11px] font-bold">Per Page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-zinc-800 focus:outline-none"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Next buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-zinc-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-bold text-zinc-800 px-2 font-mono text-xs">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-zinc-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. MODAL: VIEW SPARE PART DETAILS
          ========================================================================= */}
      {viewingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-xs uppercase tracking-wider">
                  JCB Part
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    {viewingPart.part_number}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    {viewingPart.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingPart(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
              {/* Stock Status Banner */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-500 uppercase tracking-wider text-[11px]">
                    Current Inventory Status
                  </span>
                  <span className="text-xs font-bold text-zinc-600">
                    Plant: <strong className="text-zinc-950">{selectedPlantName(viewingPart)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Physical</span>
                    <strong className="text-base font-black text-zinc-900">{viewingPart.current_physical_stock}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Reserved</span>
                    <strong className="text-base font-black text-amber-700">{viewingPart.reserved_stock}</strong>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Quarantined</span>
                    <strong className="text-base font-black text-purple-700">{viewingPart.quarantined_stock}</strong>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Available</span>
                    <strong className="text-base font-black text-emerald-700">{viewingPart.available_stock}</strong>
                  </div>
                </div>
              </div>

              {/* Warehouse & Technical Specifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Storage & Location
                  </h4>
                  <div className="space-y-1.5 text-zinc-600">
                    <div className="flex justify-between">
                      <span>Warehouse Zone:</span>
                      <strong className="text-zinc-900">{viewingPart.warehouse_zone || 'Main Store'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Bin Location:</span>
                      <strong className="text-zinc-900 font-mono">{viewingPart.bin_location}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Unit of Measure:</span>
                      <strong className="text-zinc-900">{viewingPart.uom || 'Nos'}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    Cost & Thresholds
                  </h4>
                  <div className="space-y-1.5 text-zinc-600">
                    <div className="flex justify-between">
                      <span>Unit Cost:</span>
                      <strong className="text-zinc-900 font-mono">₹{Number(viewingPart.unit_cost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Reorder Level:</span>
                      <strong className="text-zinc-900 font-mono">{viewingPart.min_reorder_level}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Stock Level:</span>
                      <strong className="text-zinc-900 font-mono">{viewingPart.max_stock_level}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Valuation:</span>
                      <strong className="text-zinc-900 font-mono">
                        ₹{(Number(viewingPart.current_physical_stock || 0) * Number(viewingPart.unit_cost || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vendor & Description */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between text-zinc-600 pb-1 border-b border-slate-100">
                  <span className="font-bold text-zinc-500 uppercase tracking-wider text-[11px]">Primary Supplier:</span>
                  <strong className="text-zinc-900">{viewingPart.supplier_name || 'JCB Genuine Parts'}</strong>
                </div>
                {viewingPart.description && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mt-1">Specifications:</span>
                    <p className="text-zinc-700 mt-0.5 leading-relaxed">{viewingPart.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setViewingPart(null)}
                className="px-4 py-2 border border-slate-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingPart;
                      setViewingPart(null);
                      openPRModal(target);
                    }}
                    className="px-4 py-2 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                    <span>Raise PR</span>
                  </button>
                )}

                {canAdjust && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingPart;
                      setViewingPart(null);
                      openAdjustModal(target);
                    }}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-zinc-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Adjust Stock</span>
                  </button>
                )}

                {canManageParts && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingPart;
                      setViewingPart(null);
                      openEditModal(target);
                    }}
                    className="px-4 py-2 bg-jcb-yellow hover:bg-amber-400 text-black border border-amber-500 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Part</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MODAL: REGISTER NEW SPARE PART / EDIT PART MASTER
          ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded shadow-xs uppercase tracking-wider">
                  JCB
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight">
                    {editingPart
                      ? `EDIT SPARE PART MASTER: ${editingPart.part_number}`
                      : 'REGISTER NEW SPARE PART'}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    {editingPart ? 'Update master catalog metadata and location' : 'Add new industrial asset to plant warehouse'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePart} className="p-6 space-y-5">
              {modalFeedback && (
                <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              {/* Plant Assignment & Live Status Notice */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase tracking-wider mb-1">
                    Facility Plant Assignment *
                  </label>

                  {editingPart ? (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-zinc-800">
                      {selectedPlantName(editingPart)}
                      <p className="text-[10px] text-zinc-500 font-medium mt-1">
                        Plant assignment is locked to preserve regulatory asset hierarchy.
                      </p>
                    </div>
                  ) : !isAdmin && userPlantId ? (
                    <div className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-amber-600" />
                      {plants.find(p => p.id === userPlantId)?.plant_name || 'My Franchise'}
                      <p className="text-[10px] text-zinc-500 font-medium ml-2">
                        (Locked to your franchise)
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.plant_id}
                      disabled={actionLoading || plantsLoading || plants.length === 0}
                      onChange={(e) => setFormData({ ...formData, plant_id: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-amber-400"
                    >
                      <option value="">
                        {plantsLoading ? 'Loading active plants...' : 'Select Target Plant'}
                      </option>
                      {plants.map((plant) => (
                        <option key={plant.id} value={plant.id}>
                          {plant.plant_name} ({plant.plant_code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* If Editing, display current physical / available stock notice */}
                {editingPart && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                      <div>Physical: <strong>{editingPart.current_physical_stock}</strong></div>
                      <div>Reserved: <strong className="text-amber-700">{editingPart.reserved_stock}</strong></div>
                      <div>Quarantined: <strong className="text-purple-700">{editingPart.quarantined_stock}</strong></div>
                      <div>Available: <strong className="text-emerald-700">{editingPart.available_stock}</strong></div>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-medium mt-2 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Physical inventory balances must be updated via Stock Adjustment to preserve the audit trail.
                    </p>
                  </div>
                )}
              </div>

              {/* Section 1: Part Identification */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  1. Identification & Nomenclature
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      JCB Part Number *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingPart) || actionLoading}
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                      placeholder="e.g. HYD-20015 or 332/Y2415"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:text-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      OEM Part Code
                    </label>
                    <input
                      type="text"
                      disabled={actionLoading}
                      value={formData.oem_part_number}
                      onChange={(e) => setFormData({ ...formData, oem_part_number: e.target.value })}
                      placeholder="e.g. REX-4WRKE-25"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                    Part Name *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={actionLoading}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. High Pressure Hydraulic Proportional Valve"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      disabled={actionLoading}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-amber-400"
                    >
                      {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      disabled={actionLoading}
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      placeholder="Valves, O-Rings, etc."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Unit of Measure (UOM)
                    </label>
                    <input
                      type="text"
                      disabled={actionLoading}
                      value={formData.uom}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                      placeholder="Nos, Sets, Mtr..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Warehouse Location */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  2. Warehouse Storage Location
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Bin Location *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={actionLoading}
                      value={formData.bin_location}
                      onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                      placeholder="e.g. A-02-04 or B-102"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Warehouse Zone
                    </label>
                    <input
                      type="text"
                      disabled={actionLoading}
                      value={formData.warehouse_zone}
                      onChange={(e) => setFormData({ ...formData, warehouse_zone: e.target.value })}
                      placeholder="Main Store, Bay Store..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Reorder Thresholds & Commercials */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-1 border-b border-slate-100">
                  3. Stock Levels & Pricing
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Min Reorder Level
                    </label>
                    <input
                      type="number"
                      min="0"
                      disabled={actionLoading}
                      value={formData.min_reorder_level}
                      onChange={(e) => setFormData({ ...formData, min_reorder_level: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Max Stock Level
                    </label>
                    <input
                      type="number"
                      min="1"
                      disabled={actionLoading}
                      value={formData.max_stock_level}
                      onChange={(e) => setFormData({ ...formData, max_stock_level: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                      Unit Cost (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={actionLoading}
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-700 uppercase mb-1">
                    Primary Supplier Name
                  </label>
                  <input
                    type="text"
                    disabled={actionLoading}
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    placeholder="e.g. Bosch Rexroth India Ltd."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading || (!editingPart && (plantsLoading || !formData.plant_id || plants.length === 0))}
                  className="bg-jcb-yellow hover:bg-amber-400 text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Saving...' : editingPart ? 'Update Part Master' : 'Register Part Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MODAL: STOCK ADJUSTMENT (AUDIT CONTROLLED)
          ========================================================================= */}
      {isAdjustModalOpen && adjustingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black tracking-wide">
                  STOCK ADJUSTMENT: {adjustingPart.part_number}
                </h3>
              </div>

              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4 text-xs">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <span className="font-black text-zinc-950 text-sm">
                    {adjustingPart.name}
                  </span>
                  <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                    Location: {adjustingPart.bin_location} ({adjustingPart.warehouse_zone || 'Main Store'})
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center font-mono">
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Physical</div>
                    <div className="font-bold text-zinc-900">{adjustingPart.current_physical_stock}</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Reserved</div>
                    <div className="font-bold text-amber-700">{adjustingPart.reserved_stock}</div>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-slate-200">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold">Quarantined</div>
                    <div className="font-bold text-purple-700">{adjustingPart.quarantined_stock}</div>
                  </div>
                  <div className="bg-emerald-50 p-1.5 rounded border border-emerald-200">
                    <div className="text-[9px] uppercase text-emerald-800 font-bold">Available</div>
                    <div className="font-bold text-emerald-700">{adjustingPart.available_stock}</div>
                  </div>
                </div>
              </div>

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
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-black text-zinc-900 focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-zinc-500 font-medium mt-1 block">
                  Positive integers add inventory; negative integers deduct stock. Must be non-zero.
                </span>
              </div>

              {adjustQty !== 0 && (
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-900">
                    Live Stock Arithmetic Preview:
                  </div>

                  <div className="flex items-center justify-between font-mono">
                    <span className="text-zinc-600">Expected Physical Stock:</span>
                    <strong className={Number(adjustingPart.current_physical_stock) + adjustQty < 0 ? 'text-red-700' : 'text-zinc-950'}>
                      {Number(adjustingPart.current_physical_stock) + adjustQty}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between font-mono">
                    <span className="text-zinc-600">Expected Available Stock:</span>
                    <strong className="text-emerald-700">
                      {Number(adjustingPart.current_physical_stock) + adjustQty -
                        Number(adjustingPart.reserved_stock) -
                        Number(adjustingPart.quarantined_stock)}
                    </strong>
                  </div>
                </div>
              )}

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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading || adjustQty === 0 || !adjustReason.trim()}
                  className="bg-jcb-yellow hover:bg-amber-400 text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Recording Ledger...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MODAL: DELETE / INACTIVATE PART CONFIRMATION
          ========================================================================= */}
      {partToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-600 p-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="text-sm font-black tracking-wide">
                  CONFIRM PART DELETION / DEACTIVATION
                </h3>
              </div>

              <button
                onClick={() => setPartToDelete(null)}
                className="text-red-200 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-zinc-700 font-medium">
                Are you sure you want to delete or deactivate spare part{' '}
                <strong className="text-zinc-950 font-mono">{partToDelete.part_number}</strong>
                {' '}({partToDelete.name})?
              </p>

              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0 text-amber-700" />
                  Referential Integrity Safeguard:
                </p>
                <p className="text-[11px] leading-relaxed">
                  If this part has historical work orders or stock movement logs, it will be marked as inactive rather than hard-deleted to preserve regulatory audit trails.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setPartToDelete(null)}
                  className="px-4 py-2 border border-slate-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Processing...' : 'Deactivate / Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MODAL: PURCHASE REQUISITION (PR)
          ========================================================================= */}
      {prPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    RAISE PURCHASE REQUISITION
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    Store replenishment request for manager approval
                  </p>
                </div>
              </div>

              <button
                onClick={() => setPrPart(null)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePRSubmit} className="p-6 space-y-4 text-xs">
              {modalFeedback && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="font-mono font-black text-amber-800">
                  {prPart.part_number}
                </div>
                <div className="font-black text-zinc-900 text-sm">{prPart.name}</div>

                <div className="flex justify-between text-zinc-500 pt-1 font-mono text-[11px]">
                  <span>
                    Available Stock:{' '}
                    <strong className="text-zinc-900">
                      {prPart.available_stock ??
                        (Number(prPart.current_physical_stock || 0) -
                          Number(prPart.reserved_stock || 0) -
                          Number(prPart.quarantined_stock || 0))}
                    </strong>
                  </span>
                  <span>
                    Min Reorder Level:{' '}
                    <strong className="text-zinc-900 font-bold">
                      {prPart.min_reorder_level || 5}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Quantity Required *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={prQuantity}
                    onChange={(e) => setPrQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-zinc-900 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Urgency Priority *
                  </label>
                  <select
                    value={prUrgency}
                    onChange={(e) => setPrUrgency(e.target.value as typeof prUrgency)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-amber-400"
                  >
                    <option value="critical">Critical (Zero Stock / Line Risk)</option>
                    <option value="high">High Urgency</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Technical Justification * (Min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  value={prJustification}
                  onChange={(e) => setPrJustification(e.target.value)}
                  placeholder="Detail operational requirement or maintenance demand..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={prLoading}
                  onClick={() => setPrPart(null)}
                  className="px-4 py-2 border border-slate-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={prLoading || prQuantity <= 0 || prJustification.trim().length < 5}
                  className="bg-jcb-yellow hover:bg-amber-400 text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50 cursor-pointer"
                >
                  {prLoading ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
