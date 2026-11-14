import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { TopKPICard } from '../../components/dashboard/TopKPICard';
import {
  Boxes,
  Package,
  AlertTriangle,
  ArrowRightLeft,
  ShieldAlert,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  X,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Warehouse,
  MapPin,
  Clock,
  Send,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RotateCcw,
  Trash2,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
  Layers,
  Archive,
  BarChart3,
  Flame,
  FileCheck
} from 'lucide-react';

// ============================================================================
// DATA CONTRACTS
// ============================================================================

interface StoreDashboardData {
  summary: {
    total_parts: number;
    total_physical_stock: number;
    total_reserved_stock: number;
    total_quarantined_stock: number;
    total_available_stock: number;
    low_stock_items_count: number;
    out_of_stock_count: number;
    total_inventory_valuation: number;
  };
  transfers: {
    active_transfers_count: number;
    total_transfers_count: number;
  };
  damaged_stock: {
    total_damaged_reports: number;
    quarantined_units: number;
    scrapped_units: number;
  };
  category_breakdown: Array<{
    category: string;
    part_count: number;
    physical_stock: number;
    available_stock: number;
    valuation: number;
  }>;
  recent_transactions: Array<{
    id: string;
    part_id: string;
    part_number: string;
    part_name: string;
    transaction_type: string;
    quantity: number;
    source_location: string;
    destination_location?: string;
    performed_by_name?: string;
    performed_by_role?: string;
    remarks: string;
    created_at: string;
  }>;
}

interface LowStockAlertItem {
  id: string;
  part_number: string;
  oem_part_number?: string | null;
  name: string;
  category: string;
  bin_location: string;
  warehouse_zone?: string | null;
  current_physical_stock: number;
  reserved_stock: number;
  quarantined_stock: number;
  available_stock: number;
  min_reorder_level: number;
  max_stock_level: number;
  unit_cost: number;
  stock_deficit: number;
  has_open_pr: boolean;
  open_pr_number?: string | null;
  recommended_reorder_qty: number;
}

interface StockTransferItem {
  id: string;
  transfer_number: string;
  part_id: string;
  part_number: string;
  part_name: string;
  quantity: number;
  source_bin: string;
  destination_bin: string;
  source_zone?: string | null;
  destination_zone?: string | null;
  status: string;
  reason?: string | null;
  initiated_by_name?: string | null;
  created_at: string;
  completed_at?: string | null;
}

interface DamagedStockItem {
  id: string;
  report_number: string;
  part_id: string;
  part_number: string;
  part_name: string;
  quantity: number;
  damage_reason?: string;
  reason?: string;
  quarantined_bin?: string;
  location?: string;
  disposition: 'quarantined' | 'scrapped' | 'returned_to_vendor' | 'repaired_restocked';
  reported_by_name?: string | null;
  disposition_by_name?: string | null;
  disposition_remarks?: string | null;
  created_at: string;
  disposition_date?: string | null;
}

interface MovementReportItem {
  transaction_type: string;
  transaction_count: number;
  total_units: number;
  total_units_moved?: number;
}

interface ProcurementDashboardData {
  kpi?: {
    pending_requisitions?: number;
    active_purchase_orders?: number;
    fulfilled_orders?: number;
    overdue_purchase_orders?: number;
    total_expenditure?: number;
  };
  summary?: {
    total_pending_prs?: number;
    active_pos?: number;
    overdue_pos?: number;
    total_spend?: number;
    delivered_this_month?: number;
  };
}

interface ValuationReportData {
  total?: {
    total_skus: number;
    total_physical_stock: number;
    total_valuation: number;
  };
  by_category: Array<{
    category: string;
    sku_count: number;
    total_physical_units: number;
    total_available_units: number;
    category_valuation: number;
    min_unit_cost: number;
    max_unit_cost: number;
    avg_unit_cost: number;
  }>;
  by_zone: Array<{
    warehouse_zone: string;
    sku_count: number;
    total_physical_units: number;
    zone_valuation: number;
  }>;
}

interface TopMovedPartItem {
  id: string;
  part_number: string;
  part_name: string;
  category: string;
  transaction_count: number;
  total_units_moved: number;
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

export const StoreManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'low_stock' | 'transfers' | 'damaged' | 'reports' | 'transactions'>('low_stock');

  // Dashboard Summary State
  const [dashboard, setDashboard] = useState<StoreDashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Procurement KPI State (Live Real-Time)
  const [procurementSummary, setProcurementSummary] = useState<ProcurementDashboardData | null>(null);

  // Low Stock Alerts State
  const [lowStockItems, setLowStockItems] = useState<LowStockAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsSearch, setAlertsSearch] = useState('');
  const [alertsCategory, setAlertsCategory] = useState('ALL');
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [alertsTotalPages, setAlertsTotalPages] = useState(1);

  // Transfers State
  const [transfers, setTransfers] = useState<StockTransferItem[]>([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transfersPage, setTransfersPage] = useState(1);
  const [transfersTotal, setTransfersTotal] = useState(0);

  // Damaged Stock State
  const [damagedItems, setDamagedItems] = useState<DamagedStockItem[]>([]);
  const [loadingDamaged, setLoadingDamaged] = useState(false);
  const [damagedFilter, setDamagedFilter] = useState<'ALL' | 'quarantined' | 'resolved'>('ALL');

  // Reports State
  const [movementReport, setMovementReport] = useState<MovementReportItem[]>([]);
  const [valuationReport, setValuationReport] = useState<ValuationReportData | null>(null);
  const [topMovedParts, setTopMovedParts] = useState<TopMovedPartItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // General Parts Catalog cache (for select dropdowns in modals)
  const [catalogParts, setCatalogParts] = useState<Array<{ id: string; part_number: string; name: string; bin_location: string; available_stock: number; current_physical_stock: number; reserved_stock: number; quarantined_stock: number; warehouse_zone?: string }>>([]);

  // Notifications / Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ============================================================================
  // MODAL STATES
  // ============================================================================

  // 1. Stock Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustPart, setAdjustPart] = useState<any | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');

  // 2. Stock Transfer Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    part_id: '',
    quantity: 1,
    source_bin: '',
    destination_bin: '',
    source_zone: 'Main Store',
    destination_zone: 'Line Sub-Store',
    reason: '',
  });

  // 3. Report Damaged Stock Modal
  const [isDamagedModalOpen, setIsDamagedModalOpen] = useState(false);
  const [damagedForm, setDamagedForm] = useState({
    part_id: '',
    quantity: 1,
    damage_reason: '',
    quarantined_bin: 'QUAR-BIN-01',
  });

  // 4. Update Disposition Modal
  const [selectedDamagedForDisposition, setSelectedDamagedForDisposition] = useState<DamagedStockItem | null>(null);
  const [dispositionChoice, setDispositionChoice] = useState<'scrapped' | 'returned_to_vendor' | 'repaired_restocked'>('scrapped');
  const [dispositionRemarks, setDispositionRemarks] = useState('');

  // 5. Quick PR Modal from Low Stock Alert
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [prForm, setPrForm] = useState({
    part_id: '',
    part_number: '',
    part_name: '',
    quantity_required: 1,
    urgency: 'high' as 'critical' | 'high' | 'medium' | 'low',
    technical_justification: '',
  });

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================

  const fetchDashboardSummary = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const [invRes, procRes] = await Promise.allSettled([
        apiClient.get('/inventory/dashboard'),
        apiClient.get('/procurement/dashboard'),
      ]);

      if (invRes.status === 'fulfilled' && invRes.value.data?.success && invRes.value.data?.data) {
        setDashboard(invRes.value.data.data);
      }
      if (procRes.status === 'fulfilled' && procRes.value.data?.success && procRes.value.data?.data) {
        setProcurementSummary(procRes.value.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load store dashboard summary:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const fetchLowStockAlerts = useCallback(async (cat = alertsCategory, query = alertsSearch, p = alertsPage) => {
    try {
      setLoadingAlerts(true);
      const params = new URLSearchParams();
      if (cat !== 'ALL') params.append('category', cat);
      if (query.trim()) params.append('search', query.trim());
      params.append('page', String(p));
      params.append('limit', '15');

      const res = await apiClient.get(`/inventory/alerts/low-stock?${params.toString()}`);
      if (res.data?.success) {
        setLowStockItems(res.data.data || []);
        if (res.data.pagination) {
          setAlertsTotal(res.data.pagination.total);
          setAlertsTotalPages(res.data.pagination.totalPages || 1);
        } else {
          setAlertsTotal(res.data.data?.length || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load low stock alerts:', err);
    } finally {
      setLoadingAlerts(false);
    }
  }, [alertsCategory, alertsSearch, alertsPage]);

  const fetchTransfers = useCallback(async (p = transfersPage) => {
    try {
      setLoadingTransfers(true);
      const params = new URLSearchParams();
      params.append('page', String(p));
      params.append('limit', '15');
      const res = await apiClient.get(`/inventory/transfers?${params.toString()}`);
      if (res.data?.success) {
        setTransfers(res.data.data || []);
        if (res.data.pagination) {
          setTransfersTotal(res.data.pagination.total);
        }
      }
    } catch (err: any) {
      console.error('Failed to load transfers:', err);
    } finally {
      setLoadingTransfers(false);
    }
  }, [transfersPage]);

  const fetchDamagedStock = useCallback(async (filterMode = damagedFilter) => {
    try {
      setLoadingDamaged(true);
      const params = new URLSearchParams();
      if (filterMode === 'quarantined') params.append('disposition', 'quarantined');
      params.append('limit', '50');
      const res = await apiClient.get(`/inventory/damaged?${params.toString()}`);
      if (res.data?.success) {
        let items = res.data.data || [];
        if (filterMode === 'resolved') {
          items = items.filter((i: DamagedStockItem) => i.disposition !== 'quarantined');
        }
        setDamagedItems(items);
      }
    } catch (err: any) {
      console.error('Failed to load damaged stock:', err);
    } finally {
      setLoadingDamaged(false);
    }
  }, [damagedFilter]);

  const fetchReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      const [moveRes, valRes] = await Promise.allSettled([
        apiClient.get('/inventory/reports/movement'),
        apiClient.get('/inventory/reports/valuation'),
      ]);

      if (moveRes.status === 'fulfilled' && moveRes.value.data?.success) {
        const rawList = moveRes.value.data?.movement_by_type || moveRes.value.data?.data?.movement_by_type || (Array.isArray(moveRes.value.data?.data) ? moveRes.value.data?.data : []);
        const list = rawList.map((m: any) => ({
          ...m,
          total_units: Number(m.total_units ?? m.total_units_moved ?? 0),
        }));
        setMovementReport(list);
        const topParts = (moveRes.value.data?.top_moved_parts || moveRes.value.data?.data?.top_moved_parts || []).map((tp: any) => ({
          ...tp,
          total_units: Number(tp.total_units ?? tp.total_units_moved ?? 0),
        }));
        setTopMovedParts(topParts);
      }
      if (valRes.status === 'fulfilled' && valRes.value.data?.success && valRes.value.data?.data) {
        setValuationReport(valRes.value.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load inventory reports:', err);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const fetchCatalogParts = useCallback(async () => {
    try {
      const res = await apiClient.get('/inventory?limit=200');
      if (res.data?.success) {
        setCatalogParts(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load parts catalog options:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardSummary();
    fetchCatalogParts();
    fetchReports();
  }, [fetchDashboardSummary, fetchCatalogParts, fetchReports]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'low_stock') {
      fetchLowStockAlerts(alertsCategory, alertsSearch, alertsPage);
    } else if (activeTab === 'transfers') {
      fetchTransfers(transfersPage);
    } else if (activeTab === 'damaged') {
      fetchDamagedStock(damagedFilter);
    } else if (activeTab === 'reports') {
      fetchReports();
    }
  }, [activeTab, alertsCategory, alertsSearch, alertsPage, transfersPage, damagedFilter, fetchLowStockAlerts, fetchTransfers, fetchDamagedStock, fetchReports]);

  // Real-time Socket.IO subscriptions for Store operations
  useEffect(() => {
    if (!socket) return;

    const handleAutoRefresh = () => {
      fetchDashboardSummary();
      if (activeTab === 'low_stock') fetchLowStockAlerts(alertsCategory, alertsSearch, alertsPage);
      if (activeTab === 'transfers') fetchTransfers(transfersPage);
      if (activeTab === 'damaged') fetchDamagedStock(damagedFilter);
    };

    socket.on('inventory:stock_adjusted', handleAutoRefresh);
    socket.on('inventory:transfer_created', handleAutoRefresh);
    socket.on('inventory:damaged_reported', handleAutoRefresh);
    socket.on('inventory:disposition_updated', handleAutoRefresh);
    socket.on('procurement:pr_created', handleAutoRefresh);
    socket.on('procurement:grn_received', handleAutoRefresh);

    return () => {
      socket.off('inventory:stock_adjusted', handleAutoRefresh);
      socket.off('inventory:transfer_created', handleAutoRefresh);
      socket.off('inventory:damaged_reported', handleAutoRefresh);
      socket.off('inventory:disposition_updated', handleAutoRefresh);
      socket.off('procurement:pr_created', handleAutoRefresh);
      socket.off('procurement:grn_received', handleAutoRefresh);
    };
  }, [socket, activeTab, alertsCategory, alertsSearch, alertsPage, transfersPage, damagedFilter, fetchDashboardSummary, fetchLowStockAlerts, fetchTransfers, fetchDamagedStock]);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  // 1. Stock Adjustment Submit
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustPart) {
      setFeedback({ type: 'error', message: 'Please select a spare part to adjust.' });
      return;
    }
    if (adjustQuantity === 0) {
      setFeedback({ type: 'error', message: 'Adjustment quantity must be non-zero (+ to add, - to deduct).' });
      return;
    }
    if (!adjustReason.trim()) {
      setFeedback({ type: 'error', message: 'Reason for adjustment is mandatory for compliance audit trail.' });
      return;
    }

    const curPhysical = Number(adjustPart.current_physical_stock || 0);
    const reserved = Number(adjustPart.reserved_stock || 0);
    const quarantined = Number(adjustPart.quarantined_stock || 0);
    const nextPhysical = curPhysical + adjustQuantity;

    if (nextPhysical < 0) {
      setFeedback({
        type: 'error',
        message: `Negative physical stock rejected: Current stock is ${curPhysical}, cannot deduct ${Math.abs(adjustQuantity)}.`,
      });
      return;
    }

    if (nextPhysical < reserved + quarantined) {
      setFeedback({
        type: 'error',
        message: `Cannot reduce physical stock below allocated units (Reserved: ${reserved}, Quarantined: ${quarantined}).`,
      });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/inventory/adjust', {
        part_id: adjustPart.id,
        adjustment_quantity: adjustQuantity,
        reason: adjustReason.trim(),
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || `Stock successfully adjusted for ${adjustPart.part_number}.`,
        });
        setIsAdjustModalOpen(false);
        setAdjustPart(null);
        setAdjustQuantity(0);
        setAdjustReason('');
        fetchDashboardSummary();
        fetchCatalogParts();
        if (activeTab === 'low_stock') fetchLowStockAlerts();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Stock adjustment failed. Please check inputs.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Stock Transfer Submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.part_id) {
      setFeedback({ type: 'error', message: 'Please select a spare part to transfer.' });
      return;
    }
    if (Number(transferForm.quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Transfer quantity must be greater than zero.' });
      return;
    }
    if (!transferForm.source_bin.trim() || !transferForm.destination_bin.trim()) {
      setFeedback({ type: 'error', message: 'Both Source Bin and Destination Bin are mandatory.' });
      return;
    }
    if (transferForm.source_bin.trim().toUpperCase() === transferForm.destination_bin.trim().toUpperCase()) {
      setFeedback({ type: 'error', message: 'Source and Destination bins cannot be identical.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/inventory/transfers', {
        part_id: transferForm.part_id,
        quantity: Number(transferForm.quantity),
        source_bin: transferForm.source_bin.trim(),
        destination_bin: transferForm.destination_bin.trim(),
        source_zone: transferForm.source_zone.trim() || undefined,
        destination_zone: transferForm.destination_zone.trim() || undefined,
        reason: transferForm.reason.trim() || 'Internal store location replenishment',
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || 'Stock transfer executed successfully.',
        });
        setIsTransferModalOpen(false);
        setTransferForm({
          part_id: '',
          quantity: 1,
          source_bin: '',
          destination_bin: '',
          source_zone: 'Main Store',
          destination_zone: 'Line Sub-Store',
          reason: '',
        });
        fetchDashboardSummary();
        fetchCatalogParts();
        if (activeTab === 'transfers') fetchTransfers();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Stock transfer failed. Please verify available stock in source bin.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Report Damaged Stock Submit
  const handleDamagedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damagedForm.part_id) {
      setFeedback({ type: 'error', message: 'Please select a spare part.' });
      return;
    }
    if (Number(damagedForm.quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Damaged quantity must be greater than zero.' });
      return;
    }
    if (!damagedForm.damage_reason.trim()) {
      setFeedback({ type: 'error', message: 'Detailed damage reason is mandatory.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/inventory/damaged', {
        part_id: damagedForm.part_id,
        quantity: Number(damagedForm.quantity),
        damage_reason: damagedForm.damage_reason.trim(),
        quarantined_bin: damagedForm.quarantined_bin.trim() || 'QUAR-BIN-01',
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || 'Damaged stock recorded and moved to quarantine.',
        });
        setIsDamagedModalOpen(false);
        setDamagedForm({
          part_id: '',
          quantity: 1,
          damage_reason: '',
          quarantined_bin: 'QUAR-BIN-01',
        });
        fetchDashboardSummary();
        fetchCatalogParts();
        if (activeTab === 'damaged') fetchDamagedStock();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record damaged stock.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Update Disposition Submit
  const handleDispositionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDamagedForDisposition) return;
    if (!dispositionRemarks.trim()) {
      setFeedback({ type: 'error', message: 'Disposition remarks are required for audit records.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.patch(`/inventory/damaged/${selectedDamagedForDisposition.id}/disposition`, {
        disposition: dispositionChoice,
        remarks: dispositionRemarks.trim(),
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: res.data.message || `Quarantine disposition resolved to ${dispositionChoice}.`,
        });
        setSelectedDamagedForDisposition(null);
        setDispositionRemarks('');
        fetchDashboardSummary();
        fetchCatalogParts();
        if (activeTab === 'damaged') fetchDamagedStock();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update disposition.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Quick PR Submit from Low-Stock Alert
  const handlePRSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prForm.part_id) return;
    if (Number(prForm.quantity_required) <= 0) {
      setFeedback({ type: 'error', message: 'Requisition quantity must be greater than zero.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/procurement/pr', {
        part_id: prForm.part_id,
        quantity_required: Number(prForm.quantity_required),
        urgency: prForm.urgency,
        technical_justification: prForm.technical_justification.trim() || `Automated store reorder trigger: Part ${prForm.part_number} breached minimum safety threshold.`,
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Requisition ${res.data.data?.pr_number || ''} created successfully! Routed to procurement approval queue.`,
        });
        setIsPRModalOpen(false);
        fetchLowStockAlerts();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit purchase requisition.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Quick PR Modal helper
  const openQuickPRModal = (item: LowStockAlertItem) => {
    const recQty = Math.max(item.recommended_reorder_qty || 1, item.stock_deficit || 1);
    setPrForm({
      part_id: item.id,
      part_number: item.part_number,
      part_name: item.name,
      quantity_required: recQty,
      urgency: item.available_stock <= 0 ? 'critical' : 'high',
      technical_justification: `Store reorder trigger: Current available stock is ${item.available_stock} (Min Reorder Level: ${item.min_reorder_level}, Deficit: ${item.stock_deficit}).`,
    });
    setIsPRModalOpen(true);
  };

  // Open Adjust Modal prefilled for a part
  const openAdjustForPart = (p: any) => {
    setAdjustPart(p);
    setAdjustQuantity(0);
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  // Summary shortcuts
  const summary = dashboard?.summary || {
    total_parts: 0,
    total_physical_stock: 0,
    total_reserved_stock: 0,
    total_quarantined_stock: 0,
    total_available_stock: 0,
    low_stock_items_count: 0,
    out_of_stock_count: 0,
    total_inventory_valuation: 0,
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-amber-400 selection:text-black">
      {/* =========================================================================
          TOP COMMAND BANNER / STORE OPERATIONS HEADER
          ========================================================================= */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-jcb-yellow text-black font-black text-xs px-2.5 py-1 rounded-md border border-amber-500 shadow-xs tracking-wider">
              JCB STORES
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              CENTRAL STORE & INVENTORY HUB
            </h1>
            <span className="bg-zinc-100 text-zinc-700 font-bold text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-zinc-300">
              {user?.plantName || (user as any)?.plant_name || 'Central Store Hub'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1.5">
            Real-time material inwarding, stock adjustments, low-stock reorder triggers, quarantine isolation, and bin transfers.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setAdjustPart(null);
              setAdjustQuantity(0);
              setAdjustReason('');
              setIsAdjustModalOpen(true);
            }}
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-jcb-yellow" />
            <span>ADJUST STOCK</span>
          </button>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-black px-3.5 py-2.5 rounded-xl border border-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-zinc-700" />
            <span>NEW TRANSFER</span>
          </button>

          <button
            onClick={() => setIsDamagedModalOpen(true)}
            className="bg-red-50 hover:bg-red-100 text-red-800 text-xs font-black px-3.5 py-2.5 rounded-xl border border-red-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>QUARANTINE STOCK</span>
          </button>

          <button
            onClick={() => {
              fetchDashboardSummary();
              if (activeTab === 'low_stock') fetchLowStockAlerts();
              if (activeTab === 'transfers') fetchTransfers();
              if (activeTab === 'damaged') fetchDamagedStock();
              if (activeTab === 'reports') fetchReports();
            }}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl transition border border-zinc-300 cursor-pointer"
            title="Refresh All Store Data"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDashboard ? 'animate-spin text-jcb-yellowDark' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-500 hover:text-black p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          STORE MANAGER MODULE QUICK NAVIGATION
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 border-2 border-zinc-200 flex items-center justify-between gap-2 overflow-x-auto text-xs shadow-sm">
        <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider px-3 shrink-0 flex items-center gap-1.5">
          <Warehouse className="w-3.5 h-3.5" />
          <span>STORE MODULES:</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/inventory"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>Spare Parts Catalog</span>
          </Link>
          <Link
            to="/procurement"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Requisitions & POs</span>
          </Link>
          <Link
            to="/procurement"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Goods Receipt (GRN)</span>
          </Link>
          <Link
            to="/rdc"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <FileCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>RDC Gate Passes</span>
          </Link>
          <Link
            to="/audit"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-600" />
            <span>Audit Ledger</span>
          </Link>
          <Link
            to="/work-orders"
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold transition flex items-center gap-1.5 border border-zinc-200"
          >
            <ClipboardList className="w-3.5 h-3.5 text-zinc-500" />
            <span>Work Orders (Parts)</span>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          KEY INVENTORY METRICS & TELEMETRY CARDS (11 REAL-TIME DB KPIS)
          ========================================================================= */}
      <div className="space-y-3">
        {/* Row 1: Stock Inventory Balance & Valuation (6 KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Active SKUs */}
          <TopKPICard
            icon={Package}
            label="Active SKUs"
            value={summary.total_parts.toLocaleString('en-IN')}
            subtitle="Catalog master parts"
            accentColor="border-l-4 border-l-zinc-900"
          />

          {/* 2. Total Physical Stock */}
          <TopKPICard
            icon={Boxes}
            iconBgColor="bg-blue-100"
            iconColor="text-blue-800"
            label="Physical Stock"
            value={summary.total_physical_stock.toLocaleString('en-IN')}
            subtitle="Total units in warehouse"
            accentColor="border-l-4 border-l-blue-600"
          />

          {/* 3. Reserved Stock */}
          <TopKPICard
            icon={Layers}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-800"
            label="Reserved Stock"
            value={summary.total_reserved_stock.toLocaleString('en-IN')}
            subtitle="Allocated to work orders"
            accentColor="border-l-4 border-l-amber-500"
          />

          {/* 4. Available Usable Stock */}
          <TopKPICard
            icon={CheckCircle2}
            iconBgColor="bg-emerald-100"
            iconColor="text-emerald-800"
            label="Available Stock"
            value={summary.total_available_stock.toLocaleString('en-IN')}
            subtitle="Physical - Reserved - Quarantined"
            accentColor="border-l-4 border-l-emerald-600"
          />

          {/* 5. Out of Stock SKUs */}
          <TopKPICard
            icon={Archive}
            iconBgColor="bg-rose-100"
            iconColor="text-rose-800"
            label="Out of Stock"
            value={summary.out_of_stock_count}
            trend={summary.out_of_stock_count > 0 ? `${summary.out_of_stock_count} Depleted` : 'Nominal'}
            trendColor={summary.out_of_stock_count > 0 ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold' : undefined}
            subtitle="Zero physical balance"
            accentColor="border-l-4 border-l-rose-600"
          />

          {/* 6. Total Inventory Valuation */}
          <TopKPICard
            icon={DollarSign}
            iconBgColor="bg-amber-100"
            iconColor="text-amber-900"
            label="Total Valuation"
            value={`₹${(Number(summary.total_inventory_valuation || 0) / 100000).toFixed(2)}L`}
            subtitle={`₹${Number(summary.total_inventory_valuation || 0).toLocaleString('en-IN')}`}
            accentColor="border-l-4 border-l-jcb-yellow"
          />
        </div>

        {/* Row 2: Procurement Pipeline & Operations (5 KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 7. Low-Stock Alerts */}
          <TopKPICard
            icon={AlertTriangle}
            iconBgColor={summary.low_stock_items_count > 0 ? "bg-red-100" : "bg-emerald-100"}
            iconColor={summary.low_stock_items_count > 0 ? "text-red-700" : "text-emerald-700"}
            label="Low Stock Alert"
            value={summary.low_stock_items_count}
            trend={summary.low_stock_items_count > 0 ? `${summary.low_stock_items_count} Below Min` : 'Nominal'}
            trendColor={
              summary.low_stock_items_count > 0
                ? 'bg-red-100 text-red-800 font-black border border-red-300'
                : 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-300'
            }
            subtitle={summary.low_stock_items_count > 0 ? 'Safety threshold breached' : 'All stock above safety minimum'}
            accentColor={summary.low_stock_items_count > 0 ? 'border-l-4 border-l-red-600' : 'border-l-4 border-l-emerald-500'}
          />

          {/* 8. Pending Purchase Requisitions */}
          <TopKPICard
            icon={FileText}
            iconBgColor="bg-orange-100"
            iconColor="text-orange-800"
            label="Pending PRs"
            value={procurementSummary?.kpi?.pending_requisitions ?? procurementSummary?.summary?.total_pending_prs ?? 0}
            subtitle="Requisitions awaiting approval"
            accentColor="border-l-4 border-l-orange-500"
          />

          {/* 9. Pending / Active Purchase Orders */}
          <TopKPICard
            icon={ShoppingCart}
            iconBgColor="bg-indigo-100"
            iconColor="text-indigo-800"
            label="Active Orders (PO)"
            value={procurementSummary?.kpi?.active_purchase_orders ?? procurementSummary?.summary?.active_pos ?? 0}
            subtitle="Open vendor purchase orders"
            accentColor="border-l-4 border-l-indigo-600"
          />

          {/* 10. Quarantined Damaged Stock */}
          <TopKPICard
            icon={ShieldAlert}
            iconBgColor="bg-purple-100"
            iconColor="text-purple-800"
            label="Quarantined Units"
            value={summary.total_quarantined_stock}
            subtitle="Defective / hold stock"
            accentColor="border-l-4 border-l-purple-600"
          />

          {/* 11. Transfers In-Transit */}
          <TopKPICard
            icon={ArrowRightLeft}
            iconBgColor="bg-cyan-100"
            iconColor="text-cyan-800"
            label="Transfers In-Transit"
            value={dashboard?.transfers?.active_transfers_count ?? 0}
            subtitle="Sub-store replenishment"
            accentColor="border-l-4 border-l-cyan-600"
          />
        </div>
      </div>

      {/* =========================================================================
          TAB NAVIGATION BAR
          ========================================================================= */}
      <div className="flex items-center gap-2 border-b-2 border-zinc-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('low_stock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'low_stock'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Low-Stock Alerts & Auto-Reorder</span>
          {summary.low_stock_items_count > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {summary.low_stock_items_count}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'transfers'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Stock Transfers</span>
          <span className="bg-zinc-200 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {dashboard?.transfers?.total_transfers_count ?? transfers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('damaged')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'damaged'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Damaged & Quarantine Ledger</span>
          {(dashboard?.damaged_stock?.total_damaged_reports ?? damagedItems.length) > 0 && (
            <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {dashboard?.damaged_stock?.total_damaged_reports ?? damagedItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Category Valuation & Movement</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'transactions'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Ledger (Recent 10)</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LOW-STOCK ALERTS & REORDER QUEUE
          ========================================================================= */}
      {activeTab === 'low_stock' && (
        <div className="space-y-4">
          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search low-stock SKU, part name, or OEM code..."
                value={alertsSearch}
                onChange={(e) => setAlertsSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow shadow-2xs"
              />
              {alertsSearch && (
                <button
                  onClick={() => setAlertsSearch('')}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setAlertsCategory(cat);
                    setAlertsPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                    alertsCategory === cat
                      ? 'bg-jcb-yellow text-black font-black border border-amber-500 shadow-xs'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Low Stock Table */}
          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Spare Part SKU</th>
                    <th className="px-4 py-3.5">Category & Bin</th>
                    <th className="px-3 py-3.5 text-right">Physical</th>
                    <th className="px-3 py-3.5 text-right">Reserved</th>
                    <th className="px-3 py-3.5 text-right">Quarantine</th>
                    <th className="px-4 py-3.5 text-right">Available</th>
                    <th className="px-3 py-3.5 text-right">Reorder Min</th>
                    <th className="px-3 py-3.5 text-right">Deficit</th>
                    <th className="px-4 py-3.5 text-center">PR Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingAlerts ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-jcb-yellowDark mb-2" />
                        Scanning inventory database for low-stock thresholds...
                      </td>
                    </tr>
                  ) : lowStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-emerald-800 font-bold bg-emerald-50/40">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                        All inventory stock levels are nominal! No SKUs currently breach minimum safety thresholds.
                      </td>
                    </tr>
                  ) : (
                    lowStockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/30 transition">
                        {/* Part Info */}
                        <td className="px-5 py-3.5">
                          <div className="font-black text-sm text-zinc-950 font-mono">{item.part_number}</div>
                          <div className="font-semibold text-zinc-700 line-clamp-1">{item.name}</div>
                          {item.oem_part_number && (
                            <div className="text-[10px] text-zinc-400 font-mono">OEM: {item.oem_part_number}</div>
                          )}
                        </td>

                        {/* Category & Location */}
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-zinc-800">{item.category}</div>
                          <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{item.bin_location}</span>
                          </div>
                        </td>

                        {/* Stocks */}
                        <td className="px-3 py-3.5 font-mono font-bold text-zinc-900 text-right">
                          {item.current_physical_stock}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-amber-700 font-bold text-right">
                          {item.reserved_stock}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-purple-700 font-bold text-right">
                          {item.quarantined_stock}
                        </td>

                        {/* Available */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <span className={`text-sm font-black ${item.available_stock <= 0 ? 'text-red-700' : 'text-amber-700'}`}>
                            {item.available_stock}
                          </span>
                        </td>

                        {/* Reorder Level */}
                        <td className="px-3 py-3.5 font-mono text-zinc-700 font-bold text-right">
                          {item.min_reorder_level}
                        </td>

                        {/* Deficit */}
                        <td className="px-3 py-3.5 text-right">
                          <span className="font-mono text-xs font-black text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            -{item.stock_deficit}
                          </span>
                        </td>

                        {/* PR Status */}
                        <td className="px-4 py-3.5 text-center">
                          {item.has_open_pr ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="bg-blue-50 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded border border-blue-200">
                                Open PR
                              </span>
                              <span className="font-mono text-[9px] text-blue-600 font-bold mt-0.5">
                                {item.open_pr_number}
                              </span>
                            </div>
                          ) : (
                            <span className="bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded border border-red-200">
                              No PR Active
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openAdjustForPart(item)}
                              className="p-1.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-lg transition cursor-pointer"
                              title="Manual Stock Adjustment"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => openQuickPRModal(item)}
                              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-amber-500 shadow-2xs transition uppercase flex items-center gap-1 cursor-pointer"
                              title={`Create Purchase Requisition for ${item.part_number}`}
                            >
                              <Send className="w-3 h-3" />
                              <span>Create PR</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="bg-zinc-50 px-6 py-3.5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-zinc-500 font-medium">
                Showing <strong className="text-zinc-900">{lowStockItems.length}</strong> alerts of{' '}
                <strong className="text-zinc-900">{alertsTotal}</strong> breached items
              </div>

              {alertsTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAlertsPage((p) => Math.max(1, p - 1))}
                    disabled={alertsPage <= 1}
                    className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-zinc-800 px-2">
                    Page {alertsPage} of {alertsTotalPages}
                  </span>
                  <button
                    onClick={() => setAlertsPage((p) => Math.min(alertsTotalPages, p + 1))}
                    disabled={alertsPage >= alertsTotalPages}
                    className="p-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: STOCK TRANSFERS
          ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs">
            <div>
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                Intra-Plant & Bin Relocation Ledger
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Audited stock relocations between warehouse zones, high-density racks, and manufacturing shop-floor sub-stores.
              </p>
            </div>
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl border border-amber-500 shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>NEW TRANSFER</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Transfer #</th>
                    <th className="px-5 py-3.5">Spare Part SKU</th>
                    <th className="px-4 py-3.5 text-right">Quantity</th>
                    <th className="px-5 py-3.5">Source Location</th>
                    <th className="px-5 py-3.5">Destination Location</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Initiator</th>
                    <th className="px-4 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingTransfers ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-400 font-bold">
                        Loading stock transfer records...
                      </td>
                    </tr>
                  ) : transfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-400 font-bold">
                        No stock transfers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-5 py-3.5 font-mono font-black text-amber-800">
                          {tx.transfer_number}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-black text-zinc-950 font-mono">{tx.part_number}</div>
                          <div className="text-[11px] text-zinc-600 font-medium line-clamp-1">{tx.part_name}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-black text-zinc-900 text-right">
                          {tx.quantity}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-zinc-800">{tx.source_bin}</div>
                          {tx.source_zone && <div className="text-[10px] text-zinc-400">{tx.source_zone}</div>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-zinc-800">{tx.destination_bin}</div>
                          {tx.destination_zone && <div className="text-[10px] text-zinc-400">{tx.destination_zone}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              tx.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-zinc-800">
                          {tx.initiated_by_name || 'Store Supervisor'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">
                          {new Date(tx.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DAMAGED STOCK & QUARANTINE DISPOSITION
          ========================================================================= */}
      {activeTab === 'damaged' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-xs">
            <div>
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                Damaged & Defective Stock Quarantine
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Physical quarantine isolation preventing defective parts from being reserved or dispatched to technicians.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDamagedFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  damagedFilter === 'ALL'
                    ? 'bg-zinc-900 text-white font-black'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                All Reports
              </button>
              <button
                onClick={() => setDamagedFilter('quarantined')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  damagedFilter === 'quarantined'
                    ? 'bg-purple-600 text-white font-black'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Active Quarantine
              </button>
              <button
                onClick={() => setDamagedFilter('resolved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  damagedFilter === 'resolved'
                    ? 'bg-emerald-600 text-white font-black'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => setIsDamagedModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer ml-2"
              >
                <Plus className="w-4 h-4" />
                <span>REPORT DEFECT</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Report #</th>
                    <th className="px-5 py-3.5">Part SKU & Name</th>
                    <th className="px-4 py-3.5 text-right">Units</th>
                    <th className="px-5 py-3.5">Damage Reason</th>
                    <th className="px-4 py-3.5">Quarantine Bin</th>
                    <th className="px-4 py-3.5">Disposition Status</th>
                    <th className="px-4 py-3.5">Reported By</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingDamaged ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-400 font-bold">
                        Loading damaged stock ledger...
                      </td>
                    </tr>
                  ) : damagedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-zinc-400 font-bold">
                        No damaged stock reported in this category.
                      </td>
                    </tr>
                  ) : (
                    damagedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50/70 transition">
                        <td className="px-5 py-3.5 font-mono font-black text-red-800">
                          {item.report_number}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-black text-zinc-950 font-mono">{item.part_number}</div>
                          <div className="text-[11px] text-zinc-600 font-medium line-clamp-1">{item.part_name}</div>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-black text-red-700 text-right">
                          {item.quantity}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-zinc-800 max-w-xs truncate" title={item.damage_reason || item.reason || 'Unspecified'}>
                          {item.damage_reason || item.reason || 'Unspecified'}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-purple-800">
                          {item.quarantined_bin || item.location || 'QUAR-BIN-01'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              item.disposition === 'quarantined'
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : item.disposition === 'scrapped'
                                ? 'bg-red-100 text-red-900 border-red-300'
                                : item.disposition === 'returned_to_vendor'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                          >
                            {item.disposition.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-zinc-700">
                          {item.reported_by_name || 'QC Inspector'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {item.disposition === 'quarantined' ? (
                            <button
                              onClick={() => {
                                setSelectedDamagedForDisposition(item);
                                setDispositionChoice('scrapped');
                                setDispositionRemarks('');
                              }}
                              className="bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg transition uppercase cursor-pointer"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-bold">Resolved</span>
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
      )}

      {/* =========================================================================
          TAB 4: CATEGORY VALUATION & MOVEMENT REPORTS
          ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Category Valuation Grid */}
          <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                  Inventory Valuation by Category
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  Financial asset breakdown evaluated at weighted unit procurement costs.
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 font-bold uppercase">Total Inventory Asset</div>
                <div className="text-xl font-black text-amber-700 font-mono">
                  ₹{Number(summary.total_inventory_valuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dashboard?.category_breakdown?.map((cat) => {
                const pct = summary.total_inventory_valuation > 0
                  ? ((cat.valuation / summary.total_inventory_valuation) * 100).toFixed(1)
                  : '0';

                return (
                  <div
                    key={cat.category}
                    className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 hover:border-amber-400 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-zinc-900">{cat.category}</span>
                      <span className="text-[10px] font-black bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full">
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between text-zinc-600 font-medium">
                        <span>Catalog SKUs:</span>
                        <strong className="text-zinc-900">{cat.part_count}</strong>
                      </div>
                      <div className="flex justify-between text-zinc-600 font-medium">
                        <span>Physical Units:</span>
                        <strong className="text-zinc-900">{cat.physical_stock.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="flex justify-between text-zinc-600 font-medium">
                        <span>Available Units:</span>
                        <strong className="text-emerald-700">{cat.available_stock.toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="flex justify-between text-zinc-900 font-black pt-2 border-t border-zinc-200 font-mono">
                        <span>Valuation:</span>
                        <span className="text-amber-700">
                          ₹{Number(cat.valuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 30-Day Movement Summary */}
          <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-700" />
                <span>30-Day Inventory Movement Summary</span>
              </h3>
              <p className="text-xs text-zinc-500 font-medium">
                Aggregated ledger velocity covering goods receipt, technician consumption, scrap write-offs, and adjustments.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {movementReport.map((m) => (
                <div key={m.transaction_type} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <div className="text-[11px] font-black text-zinc-600 uppercase tracking-wider">
                    {m.transaction_type.replace('_', ' ')}
                  </div>
                  <div className="text-2xl font-black font-mono text-zinc-950 mt-1">
                    {(m.total_units ?? m.total_units_moved ?? 0) > 0 ? `+${m.total_units ?? m.total_units_moved ?? 0}` : (m.total_units ?? m.total_units_moved ?? 0)}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
                    {m.transaction_count} ledger events
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Storage Zone Distribution */}
          {valuationReport?.by_zone && valuationReport.by_zone.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    <span>Warehouse Zone Distribution & Valuation</span>
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Stock distribution across physical store bays and zones.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {valuationReport.by_zone.map((z) => (
                  <div key={z.warehouse_zone} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-zinc-900">{z.warehouse_zone}</span>
                      <span className="text-[10px] font-bold bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full">
                        {z.sku_count} SKUs
                      </span>
                    </div>
                    <div className="mt-2 text-xs space-y-0.5">
                      <div className="text-zinc-600 font-medium flex justify-between">
                        <span>Physical Units:</span>
                        <strong className="text-zinc-900 font-mono">{Number(z.total_physical_units).toLocaleString('en-IN')}</strong>
                      </div>
                      <div className="text-amber-800 font-black flex justify-between font-mono">
                        <span>Valuation:</span>
                        <span>₹{Number(z.zone_valuation || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Stock Velocity Parts */}
          {topMovedParts.length > 0 && (
            <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Top Stock Velocity Parts (High Turnover SKUs)</span>
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    Fastest-moving spare parts ranked by 30-day ledger consumption and inwarding frequency.
                  </p>
                </div>
                <span className="text-xs font-bold text-zinc-500">Last 30 Days</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 w-12 text-center">Rank</th>
                      <th className="px-5 py-3.5">Spare Part SKU</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-right">Transactions</th>
                      <th className="px-5 py-3.5 text-right">Total Units Moved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {topMovedParts.map((part, idx) => (
                      <tr key={part.id || idx} className="hover:bg-amber-50/30 transition">
                        <td className="px-5 py-3.5 text-center font-mono font-black text-zinc-500">
                          #{idx + 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-black text-zinc-950 font-mono">{part.part_number}</div>
                          <div className="text-[11px] text-zinc-600 font-medium">{part.part_name}</div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-zinc-800">
                          {part.category}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-zinc-700">
                          {part.transaction_count} events
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-black text-amber-700 text-sm">
                          {Number((part as any).total_units_moved ?? (part as any).total_units ?? 0).toLocaleString('en-IN')} units
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: RECENT TRANSACTIONS LEDGER (LAST 10)
          ========================================================================= */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
            <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              Recent Inventory Ledger Transactions
            </h3>
            <span className="text-xs text-zinc-500 font-semibold">
              Live tamper-evident PostgreSQL audit trail
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Transaction Type</th>
                  <th className="px-5 py-3.5">Spare Part</th>
                  <th className="px-4 py-3.5 text-right">Quantity</th>
                  <th className="px-5 py-3.5">Location / Bin</th>
                  <th className="px-4 py-3.5">Authorized By</th>
                  <th className="px-5 py-3.5">Audit Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dashboard?.recent_transactions?.map((tx) => {
                  const isPositive = Number(tx.quantity) > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-5 py-3.5 font-mono text-zinc-600 font-semibold text-[11px]">
                        {new Date(tx.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase bg-zinc-100 text-zinc-900 border border-zinc-300">
                          {tx.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-black text-zinc-950 font-mono">{tx.part_number}</div>
                        <div className="text-[11px] text-zinc-600 font-medium line-clamp-1">{tx.part_name}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-black text-sm">
                        <span className={isPositive ? 'text-emerald-700' : 'text-red-700'}>
                          {isPositive ? `+${tx.quantity}` : tx.quantity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-zinc-800">
                        {tx.source_location}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-zinc-800">
                        {tx.performed_by_name || 'System Operator'}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-600 font-medium max-w-xs truncate" title={tx.remarks}>
                        {tx.remarks}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: STOCK ADJUSTMENT MODAL
          ========================================================================= */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border-2 border-zinc-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-jcb-yellowDark" />
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Stock Level Adjustment
                </h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              {/* Part Selection */}
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Select Spare Part *
                </label>
                <select
                  required
                  value={adjustPart?.id || ''}
                  onChange={(e) => {
                    const sel = catalogParts.find((p) => p.id === e.target.value);
                    setAdjustPart(sel || null);
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose Spare Part from Catalog --</option>
                  {catalogParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name} (Physical: {p.current_physical_stock}, Avail: {p.available_stock})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Metrics Card */}
              {adjustPart && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase">Physical</div>
                    <div className="font-mono font-black text-zinc-900 text-sm mt-0.5">
                      {adjustPart.current_physical_stock}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-700 font-bold uppercase">Reserved</div>
                    <div className="font-mono font-bold text-amber-800 text-sm mt-0.5">
                      {adjustPart.reserved_stock}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-purple-700 font-bold uppercase">Quarantine</div>
                    <div className="font-mono font-bold text-purple-800 text-sm mt-0.5">
                      {adjustPart.quarantined_stock}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-700 font-bold uppercase">Available</div>
                    <div className="font-mono font-black text-emerald-800 text-sm mt-0.5">
                      {adjustPart.available_stock}
                    </div>
                  </div>
                </div>
              )}

              {/* Adjustment Quantity */}
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Adjustment Delta Quantity (+ to Add, - to Deduct) *
                </label>
                <input
                  type="number"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. +10 or -5"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-sm font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
                {adjustPart && adjustQuantity !== 0 && (
                  <p className="text-[11px] text-zinc-500 font-medium mt-1">
                    Projected Physical Stock: <strong className="text-zinc-950 font-mono">{Number(adjustPart.current_physical_stock || 0) + adjustQuantity}</strong> units.
                  </p>
                )}
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Physical cycle count discrepancy reconciliation, damaged during shelf transport..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 font-bold rounded-lg text-xs hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-5 py-2 rounded-lg text-xs border border-amber-500 shadow-sm transition uppercase disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Posting...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: NEW STOCK TRANSFER MODAL
          ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border-2 border-zinc-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Initiate Stock Transfer
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Spare Part *
                </label>
                <select
                  required
                  value={transferForm.part_id}
                  onChange={(e) => {
                    const sel = catalogParts.find((p) => p.id === e.target.value);
                    setTransferForm({
                      ...transferForm,
                      part_id: e.target.value,
                      source_bin: sel?.bin_location || '',
                      source_zone: sel?.warehouse_zone || 'Main Store',
                    });
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose Spare Part --</option>
                  {catalogParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name} (Bin: {p.bin_location}, Available: {p.available_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Transfer Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={transferForm.quantity}
                    onChange={(e) =>
                      setTransferForm({ ...transferForm, quantity: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Source Bin *
                  </label>
                  <input
                    type="text"
                    required
                    value={transferForm.source_bin}
                    onChange={(e) => setTransferForm({ ...transferForm, source_bin: e.target.value })}
                    placeholder="e.g. A1-R02-B05"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Destination Bin *
                  </label>
                  <input
                    type="text"
                    required
                    value={transferForm.destination_bin}
                    onChange={(e) => setTransferForm({ ...transferForm, destination_bin: e.target.value })}
                    placeholder="e.g. SHOP-CNC-LINE1"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Destination Zone
                  </label>
                  <input
                    type="text"
                    value={transferForm.destination_zone}
                    onChange={(e) => setTransferForm({ ...transferForm, destination_zone: e.target.value })}
                    placeholder="e.g. Sub-Store Bay 2"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Transfer Reason / Authorization
                </label>
                <input
                  type="text"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g. Pre-positioning for scheduled line maintenance shift"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 font-bold rounded-lg text-xs hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-cyan-700 hover:bg-cyan-800 text-white font-black px-5 py-2 rounded-lg text-xs shadow-sm transition uppercase disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Processing...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: REPORT DAMAGED STOCK MODAL
          ========================================================================= */}
      {isDamagedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border-2 border-zinc-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Quarantine Damaged / Expired Stock
                </h3>
              </div>
              <button
                onClick={() => setIsDamagedModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDamagedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Spare Part *
                </label>
                <select
                  required
                  value={damagedForm.part_id}
                  onChange={(e) => setDamagedForm({ ...damagedForm, part_id: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose Spare Part --</option>
                  {catalogParts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name} (Available: {p.available_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Damaged Units *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={damagedForm.quantity}
                    onChange={(e) =>
                      setDamagedForm({ ...damagedForm, quantity: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Quarantine Bin Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={damagedForm.quarantined_bin}
                    onChange={(e) => setDamagedForm({ ...damagedForm, quarantined_bin: e.target.value })}
                    placeholder="e.g. QUAR-A1-BIN4"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Detailed Damage Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={damagedForm.damage_reason}
                  onChange={(e) => setDamagedForm({ ...damagedForm, damage_reason: e.target.value })}
                  placeholder="e.g. Moisture ingress, cracked casing during forklift transit, expired seal shelf-life..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsDamagedModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 font-bold rounded-lg text-xs hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-5 py-2 rounded-lg text-xs shadow-sm transition uppercase disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Recording...' : 'Quarantine Units'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: UPDATE DISPOSITION MODAL
          ========================================================================= */}
      {selectedDamagedForDisposition && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl border-2 border-zinc-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Quarantine Disposition Resolution
                </h3>
              </div>
              <button
                onClick={() => setSelectedDamagedForDisposition(null)}
                className="text-zinc-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Report #:</span>
                <strong className="font-mono text-zinc-900">{selectedDamagedForDisposition.report_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Spare Part:</span>
                <strong className="text-zinc-900">{selectedDamagedForDisposition.part_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 font-medium">Quarantined Quantity:</span>
                <strong className="text-purple-700 font-mono">{selectedDamagedForDisposition.quantity} units</strong>
              </div>
            </div>

            <form onSubmit={handleDispositionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Target Disposition *
                </label>
                <select
                  value={dispositionChoice}
                  onChange={(e) => setDispositionChoice(e.target.value as any)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="scrapped">Scrap Write-Off (Deduct permanently from physical stock)</option>
                  <option value="returned_to_vendor">Return to OEM Vendor (RDC Gate Pass warranty claim)</option>
                  <option value="repaired_restocked">Repaired & Restocked (Restore to available stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Mandatory Disposition Remarks *
                </label>
                <textarea
                  required
                  rows={2}
                  value={dispositionRemarks}
                  onChange={(e) => setDispositionRemarks(e.target.value)}
                  placeholder="e.g. Scrapped per Plant Quality Engineer survey certificate #QC-881..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setSelectedDamagedForDisposition(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 font-bold rounded-lg text-xs hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-black px-5 py-2 rounded-lg text-xs shadow-sm transition uppercase disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Updating...' : 'Commit Disposition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: QUICK PURCHASE REQUISITION MODAL (AUTO-REORDER)
          ========================================================================= */}
      {isPRModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border-2 border-zinc-300 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  Auto-Reorder Purchase Requisition
                </h3>
              </div>
              <button
                onClick={() => setIsPRModalOpen(false)}
                className="text-zinc-400 hover:text-black p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
              <div className="font-mono font-black text-amber-900 text-sm">{prForm.part_number}</div>
              <div className="font-semibold text-zinc-700">{prForm.part_name}</div>
            </div>

            <form onSubmit={handlePRSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Requisition Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={prForm.quantity_required}
                    onChange={(e) =>
                      setPrForm({ ...prForm, quantity_required: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                    Urgency Priority *
                  </label>
                  <select
                    value={prForm.urgency}
                    onChange={(e) => setPrForm({ ...prForm, urgency: e.target.value as any })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="critical">Critical (Plant Line Down)</option>
                    <option value="high">High (Breached Min Safety Level)</option>
                    <option value="medium">Medium (Standard Replenishment)</option>
                    <option value="low">Low (Buffer Reorder)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-700 uppercase mb-1">
                  Technical Justification *
                </label>
                <textarea
                  required
                  rows={2}
                  value={prForm.technical_justification}
                  onChange={(e) => setPrForm({ ...prForm, technical_justification: e.target.value })}
                  placeholder="Justification for procurement approval..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsPRModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 font-bold rounded-lg text-xs hover:bg-zinc-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-5 py-2 rounded-lg text-xs border border-amber-500 shadow-sm transition uppercase disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Submitting...' : 'Dispatch Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
