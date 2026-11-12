import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  FileText,
  DollarSign,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Building,
  Check,
  Ban,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Send,
  Boxes,
  ClipboardList,
  Sparkles,
  Info
} from 'lucide-react';
import { EditPRModal } from './components/EditPRModal';
import { DeletePRModal } from './components/DeletePRModal';

// ============================================================================
// TYPES & CONTRACTS
// ============================================================================

export type PRStatus =
  | 'new'
  | 'under_review'
  | 'vendor_selected'
  | 'approval_pending'
  | 'po_created'
  | 'ordered'
  | 'partially_received'
  | 'fully_received'
  | 'cancelled'
  | 'rejected';

export type PRUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface PurchaseRequisition {
  id: string;
  pr_number: string;
  part_id: string;
  part_number: string;
  part_name: string;
  category?: string;
  quantity_required: number;
  urgency: PRUrgency;
  technical_justification: string;
  machine_id?: string | null;
  machine_code?: string | null;
  machine_name?: string | null;
  work_order_id?: string | null;
  wo_number?: string | null;
  plant_id?: string | null;
  plant_name?: string | null;
  status: PRStatus;
  po_number?: string | null;
  supplier_name?: string | null;
  unit_price?: number | null;
  total_spend?: number | null;
  expected_delivery_date?: string | null;
  received_quantity?: number;
  requested_by?: string;
  requested_by_name?: string | null;
  requested_by_code?: string | null;
  requester_name?: string;
  requester_role?: string;
  approved_by?: string | null;
  approver_name?: string | null;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  pr_number: string;
  po_number: string;
  supplier_name: string;
  unit_price: number;
  total_spend: number;
  quantity_required: number;
  received_quantity: number;
  expected_delivery_date?: string | null;
  status: PRStatus;
  part_number: string;
  part_name: string;
  created_at: string;
  days_overdue?: number;
  is_overdue?: boolean;
}

export interface VendorSummary {
  vendor_name: string;
  total_orders: number;
  active_orders: number;
  total_parts_supplied: number;
  total_spend: number;
  on_time_delivery_rate: number;
}

export interface ProcurementDashboardData {
  summary: {
    total_pending_prs: number;
    active_pos: number;
    overdue_pos: number;
    total_spend: number;
    delivered_this_month: number;
  };
  recent_prs: Array<{
    id: string;
    pr_number: string;
    part_name: string;
    part_number: string;
    quantity_required: number;
    urgency: string;
    status: string;
    created_at: string;
  }>;
  overdue_pos_list: Array<{
    id: string;
    pr_number: string;
    po_number: string;
    supplier_name: string;
    expected_delivery_date: string;
    days_overdue: number;
    outstanding_value: number;
  }>;
  kpi?: {
    pending_requisitions: number;
    active_purchase_orders: number;
    fulfilled_orders: number;
    cancelled_orders: number;
    rejected_orders: number;
    overdue_purchase_orders: number;
    overdue_value: number;
    total_expenditure: number;
  };
}

export const DEFAULT_PROCUREMENT_DASHBOARD: ProcurementDashboardData = {
  summary: {
    total_pending_prs: 0,
    active_pos: 0,
    overdue_pos: 0,
    total_spend: 0,
    delivered_this_month: 0,
  },
  recent_prs: [],
  overdue_pos_list: [],
};

export interface PRDetails extends PurchaseRequisition {
  audit_logs?: Array<{
    id: string;
    action: string;
    performed_by_name: string;
    performed_by_role: string;
    created_at: string;
    details?: any;
    new_values?: any;
  }>;
  grn_receipts?: Array<{
    id: string;
    grn_number: string;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
    rejection_reason?: string | null;
    delivery_note_number: string;
    invoice_number?: string | null;
    delivery_date?: string;
    remarks?: string | null;
    received_by_name?: string;
    created_at: string;
  }>;
}

interface SparePartOption {
  id: string;
  part_number: string;
  name: string;
  category?: string;
  available_stock: number;
  unit_cost?: number;
}

interface MachineOption {
  id: string;
  machine_code: string;
  name: string;
  plant_name?: string;
}

interface WorkOrderOption {
  id: string;
  wo_number: string;
  machine_code: string;
  machine_id?: string;
  problem_title: string;
  status: string;
}

// Status badge styling helper
const getStatusBadge = (status: PRStatus) => {
  switch (status) {
    case 'new':
      return { label: 'New Requisition', color: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'under_review':
      return { label: 'Under Review', color: 'bg-blue-100 text-blue-900 border-blue-300' };
    case 'vendor_selected':
      return { label: 'Vendor Selected', color: 'bg-purple-100 text-purple-900 border-purple-300' };
    case 'approval_pending':
      return { label: 'Approval Pending', color: 'bg-orange-100 text-orange-900 border-orange-300' };
    case 'po_created':
      return { label: 'PO Created', color: 'bg-cyan-100 text-cyan-900 border-cyan-300' };
    case 'ordered':
      return { label: 'Ordered / Dispatched', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' };
    case 'partially_received':
      return { label: 'Partially Received', color: 'bg-yellow-100 text-yellow-900 border-yellow-400' };
    case 'fully_received':
      return { label: 'Fully Received (GRN)', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    case 'rejected':
      return { label: 'Rejected', color: 'bg-red-100 text-red-900 border-red-300' };
    case 'cancelled':
      return { label: 'Cancelled', color: 'bg-zinc-200 text-zinc-800 border-zinc-300' };
    default:
      return { label: status, color: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
  }
};

const getUrgencyBadge = (urgency: PRUrgency) => {
  switch (urgency) {
    case 'critical':
      return 'bg-red-600 text-white font-black';
    case 'high':
      return 'bg-amber-500 text-black font-black';
    case 'medium':
      return 'bg-blue-100 text-blue-800 font-bold';
    case 'low':
      return 'bg-zinc-100 text-zinc-700 font-medium';
  }
};

// ============================================================================
// MAIN PROCUREMENT COMPONENT
// ============================================================================

export const ProcurementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStoreManager = user?.role === 'store_manager';
  const isManager = user?.role === 'manager' || isAdmin || isStoreManager;
  const isTechnician = user?.role === 'technician';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'prs' | 'pos' | 'vendors' | 'analytics'>('prs');

  // PR List State
  const [prs, setPrs] = useState<PurchaseRequisition[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPRCount, setTotalPRCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('ALL');

  // PO List State
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [poPage, setPoPage] = useState(1);
  const [poTotalPages, setPoTotalPages] = useState(1);
  const [poTotalCount, setPoTotalCount] = useState(0);
  const [poFilterOverdue, setPoFilterOverdue] = useState(false);

  // Vendor Directory State
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');

  // Dashboard Overview State
  const [dashboardData, setDashboardData] = useState<ProcurementDashboardData>(DEFAULT_PROCUREMENT_DASHBOARD);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Catalog Options
  const [parts, setParts] = useState<SparePartOption[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderOption[]>([]);

  // Action Loading & Notifications
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPRForEdit, setSelectedPRForEdit] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForDelete, setSelectedPRForDelete] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForApprove, setSelectedPRForApprove] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForReject, setSelectedPRForReject] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForCancel, setSelectedPRForCancel] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForPO, setSelectedPRForPO] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForGRN, setSelectedPRForGRN] = useState<PurchaseRequisition | null>(null);
  const [selectedPRForDetails, setSelectedPRForDetails] = useState<PRDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Create PR Form State
  const [createForm, setCreateForm] = useState({
    part_id: '',
    machine_id: '',
    work_order_id: '',
    quantity_required: 1,
    urgency: 'high' as PRUrgency,
    expected_delivery_date: '',
    technical_justification: '',
  });

  // Action Form States
  const [approveRemarks, setApproveRemarks] = useState('');
  const [approveTargetStatus, setApproveTargetStatus] = useState<'vendor_selected' | 'approval_pending'>('vendor_selected');

  const [rejectRemarks, setRejectRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const [poForm, setPoForm] = useState({
    supplier_name: '',
    unit_price: 0,
    expected_delivery_date: '',
    mark_as_ordered: true,
    po_number: '',
  });

  const [grnForm, setGrnForm] = useState({
    delivery_note_number: '',
    invoice_number: '',
    delivery_date: new Date().toISOString().split('T')[0],
    accepted_quantity: 1,
    rejected_quantity: 0,
    rejection_reason: '',
    remarks: '',
  });

  // Request race-condition counter
  const prRequestIdRef = useRef(0);

  // Auto-clear feedback after 6 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================

  const fetchPRs = useCallback(async () => {
    const curReq = ++prRequestIdRef.current;
    try {
      setLoadingPRs(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (urgencyFilter !== 'ALL') params.append('urgency', urgencyFilter);

      const res = await apiClient.get(`/procurement/pr?${params.toString()}`);
      if (curReq !== prRequestIdRef.current) return;

      if (res.data?.success) {
        setPrs(Array.isArray(res.data.data) ? res.data.data : []);
        if (res.data.pagination) {
          setTotalPRCount(Number(res.data.pagination.total) || 0);
          setTotalPages(Number(res.data.pagination.totalPages) || 1);
        }
      } else {
        setPrs([]);
      }
    } catch (err: any) {
      console.error('Failed to load PRs:', err);
      if (curReq === prRequestIdRef.current) {
        setPrs([]);
      }
    } finally {
      if (curReq === prRequestIdRef.current) setLoadingPRs(false);
    }
  }, [page, limit, searchQuery, statusFilter, urgencyFilter]);

  const fetchDashboardData = useCallback(async () => {
    if (!isManager) return;
    try {
      setLoadingDashboard(true);
      const res = await apiClient.get('/procurement/dashboard');
      if (res.data?.success && res.data.data) {
        const raw = res.data.data;
        const kpi = raw.kpi || {};
        const summary = raw.summary || {
          total_pending_prs: kpi.pending_requisitions ?? 0,
          active_pos: kpi.active_purchase_orders ?? 0,
          overdue_pos: kpi.overdue_purchase_orders ?? 0,
          total_spend: kpi.total_expenditure ?? 0,
          delivered_this_month: kpi.fulfilled_orders ?? 0,
        };

        let overdueList = Array.isArray(raw.overdue_pos_list) ? raw.overdue_pos_list : [];

        // If overdue_pos > 0 but overdue_pos_list is empty, fetch overdue POs to populate the list
        if (overdueList.length === 0 && Number(summary.overdue_pos ?? kpi.overdue_purchase_orders ?? 0) > 0) {
          try {
            const poRes = await apiClient.get('/procurement/po?is_overdue=true&limit=20');
            if (poRes.data?.success && Array.isArray(poRes.data.data)) {
              overdueList = poRes.data.data.map((item: any) => {
                const target = item.expected_delivery_date ? new Date(item.expected_delivery_date).getTime() : Date.now();
                const diffDays = Math.max(1, Math.floor((Date.now() - target) / (1000 * 60 * 60 * 24)));
                return {
                  id: item.id,
                  pr_number: item.pr_number,
                  po_number: item.po_number,
                  supplier_name: item.supplier_name || 'N/A',
                  expected_delivery_date: item.expected_delivery_date,
                  days_overdue: diffDays,
                  outstanding_value: Number(item.total_order_value || item.unit_price * item.quantity_required || 0),
                };
              });
            }
          } catch (poErr) {
            console.error('Failed to fetch overdue PO details for dashboard:', poErr);
          }
        }

        setDashboardData({
          summary: {
            total_pending_prs: Number(summary.total_pending_prs ?? kpi.pending_requisitions ?? 0),
            active_pos: Number(summary.active_pos ?? kpi.active_purchase_orders ?? 0),
            overdue_pos: Number(summary.overdue_pos ?? kpi.overdue_purchase_orders ?? 0),
            total_spend: Number(summary.total_spend ?? kpi.total_expenditure ?? 0),
            delivered_this_month: Number(summary.delivered_this_month ?? kpi.fulfilled_orders ?? 0),
          },
          recent_prs: Array.isArray(raw.recent_prs) ? raw.recent_prs : Array.isArray(raw.recent_activity) ? raw.recent_activity : [],
          overdue_pos_list: overdueList,
        });
      }
    } catch (err: any) {
      console.error('Failed to load procurement dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, [isManager]);

  const fetchPOs = useCallback(async () => {
    if (!isManager) return;
    try {
      setLoadingPOs(true);
      const params = new URLSearchParams();
      params.append('page', String(poPage));
      params.append('limit', '10');
      if (poFilterOverdue) params.append('is_overdue', 'true');

      const res = await apiClient.get(`/procurement/po?${params.toString()}`);
      if (res.data?.success) {
        setPos(res.data.data || []);
        if (res.data.pagination) {
          setPoTotalCount(res.data.pagination.total);
          setPoTotalPages(res.data.pagination.totalPages || 1);
        }
      }
    } catch (err: any) {
      console.error('Failed to load POs:', err);
    } finally {
      setLoadingPOs(false);
    }
  }, [isManager, poPage, poFilterOverdue]);

  const fetchVendors = useCallback(async () => {
    if (!isManager) return;
    try {
      setLoadingVendors(true);
      const params = new URLSearchParams();
      if (vendorSearch.trim()) params.append('search', vendorSearch.trim());
      const res = await apiClient.get(`/procurement/vendors?${params.toString()}`);
      if (res.data?.success) {
        setVendors(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoadingVendors(false);
    }
  }, [isManager, vendorSearch]);

  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const [partsRes, machRes, woRes] = await Promise.allSettled([
        apiClient.get('/inventory?limit=100'),
        apiClient.get('/machines?limit=100'),
        apiClient.get('/work-orders?limit=100&status=waiting_for_parts,assigned,in_progress'),
      ]);

      if (partsRes.status === 'fulfilled' && partsRes.value.data?.success) {
        setParts(partsRes.value.data.data || []);
      }
      if (machRes.status === 'fulfilled' && machRes.value.data?.success) {
        setMachines(machRes.value.data.data || []);
      }
      if (woRes.status === 'fulfilled' && woRes.value.data?.success) {
        setWorkOrders(woRes.value.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load auxiliary catalog data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPRs();
    fetchAuxiliaryData();
    if (isManager) {
      fetchDashboardData();
    }
  }, [fetchPRs, fetchAuxiliaryData, fetchDashboardData, isManager]);

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'prs') fetchPRs();
    if (activeTab === 'pos') fetchPOs();
    if (activeTab === 'vendors') fetchVendors();
    if (activeTab === 'analytics') fetchDashboardData();
  }, [activeTab, fetchPRs, fetchPOs, fetchVendors, fetchDashboardData]);

  // Reset to page 1 on filter changes
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleStatusFilterChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleUrgencyFilterChange = (val: string) => {
    setUrgencyFilter(val);
    setPage(1);
  };

  // Open PR Details Modal
  const handleOpenDetails = async (prId: string) => {
    try {
      setLoadingDetails(true);
      const res = await apiClient.get(`/procurement/pr/${prId}`);
      if (res.data?.success) {
        setSelectedPRForDetails(res.data.data);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load requisition details.',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // ============================================================================
  // WORKFLOW ACTION HANDLERS
  // ============================================================================

  // 1. Create Purchase Requisition
  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.part_id) {
      setFeedback({ type: 'error', message: 'Please select a valid spare part catalog SKU.' });
      return;
    }
    if (!createForm.quantity_required || createForm.quantity_required < 1) {
      setFeedback({ type: 'error', message: 'Quantity required must be a positive integer.' });
      return;
    }
    if (createForm.technical_justification.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'Technical justification is mandatory and must be at least 5 characters.',
      });
      return;
    }

    try {
      setActionLoading(true);
      const payload: any = {
        part_id: createForm.part_id,
        quantity_required: Number(createForm.quantity_required),
        urgency: createForm.urgency,
        technical_justification: createForm.technical_justification.trim(),
      };
      if (createForm.machine_id) payload.machine_id = createForm.machine_id;
      if (createForm.work_order_id) payload.work_order_id = createForm.work_order_id;
      if (createForm.expected_delivery_date) {
        payload.expected_delivery_date = createForm.expected_delivery_date;
      }

      const res = await apiClient.post('/procurement/pr', payload);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Requisition ${res.data.data?.pr_number || ''} submitted successfully!`,
        });
        setIsCreateModalOpen(false);
        setCreateForm({
          part_id: '',
          machine_id: '',
          work_order_id: '',
          quantity_required: 1,
          urgency: 'high',
          expected_delivery_date: '',
          technical_justification: '',
        });
        fetchPRs();
        if (isManager) fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create purchase requisition.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Approve Requisition
  const handleApprovePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPRForApprove) return;

    if (selectedPRForApprove.requested_by === user?.id) {
      setFeedback({
        type: 'error',
        message: 'Separation of duties violation: Requesters cannot approve their own requisitions.',
      });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post(`/procurement/pr/${selectedPRForApprove.id}/approve`, {
        target_status: approveTargetStatus,
        remarks: approveRemarks.trim() || undefined,
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Requisition ${selectedPRForApprove.pr_number} approved and moved to '${approveTargetStatus.replace('_', ' ')}'.`,
        });
        setSelectedPRForApprove(null);
        setApproveRemarks('');
        fetchPRs();
        fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Approval action failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Reject Requisition
  const handleRejectPR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPRForReject) return;

    if (rejectRemarks.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'Rejection remarks are mandatory and must be at least 5 characters.',
      });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post(`/procurement/pr/${selectedPRForReject.id}/reject`, {
        remarks: rejectRemarks.trim(),
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Requisition ${selectedPRForReject.pr_number} rejected.`,
        });
        setSelectedPRForReject(null);
        setRejectRemarks('');
        fetchPRs();
        fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Rejection action failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Cancel Requisition
  const handleCancelPR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPRForCancel) return;

    if (cancelReason.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'Cancellation reason is mandatory and must be at least 5 characters.',
      });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post(`/procurement/pr/${selectedPRForCancel.id}/cancel`, {
        reason: cancelReason.trim(),
      });

      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Requisition ${selectedPRForCancel.pr_number} has been cancelled.`,
        });
        setSelectedPRForCancel(null);
        setCancelReason('');
        fetchPRs();
        fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Cancellation action failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Issue Purchase Order (PO)
  const handleIssuePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPRForPO) return;

    if (!poForm.supplier_name.trim()) {
      setFeedback({ type: 'error', message: 'Supplier/Vendor name is required.' });
      return;
    }
    if (poForm.unit_price <= 0) {
      setFeedback({ type: 'error', message: 'Unit price must be a positive number.' });
      return;
    }

    try {
      setActionLoading(true);
      const payload: any = {
        supplier_name: poForm.supplier_name.trim(),
        unit_price: Number(poForm.unit_price),
        mark_as_ordered: poForm.mark_as_ordered,
      };
      if (poForm.expected_delivery_date) {
        payload.expected_delivery_date = poForm.expected_delivery_date;
      }
      if (poForm.po_number.trim()) {
        payload.po_number = poForm.po_number.trim();
      }

      const res = await apiClient.post(`/procurement/pr/${selectedPRForPO.id}/po`, payload);
      if (res.data?.success) {
        const issuedPo = res.data.data?.po_number;
        setFeedback({
          type: 'success',
          message: `Purchase Order ${issuedPo || ''} issued successfully with status '${res.data.data?.status || 'ordered'}'.`,
        });
        setSelectedPRForPO(null);
        setPoForm({
          supplier_name: '',
          unit_price: 0,
          expected_delivery_date: '',
          mark_as_ordered: true,
          po_number: '',
        });
        fetchPRs();
        fetchPOs();
        fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to issue Purchase Order.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Inward GRN & Quality Inspection
  const handleInwardGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPRForGRN) return;

    const accepted = Number(grnForm.accepted_quantity);
    const rejected = Number(grnForm.rejected_quantity);
    const totalBatch = accepted + rejected;

    if (totalBatch <= 0) {
      setFeedback({
        type: 'error',
        message: 'Delivered batch total (Accepted + Rejected) must be greater than zero.',
      });
      return;
    }
    if (!grnForm.delivery_note_number.trim()) {
      setFeedback({
        type: 'error',
        message: 'Delivery Note / DC Number is mandatory for GRN receipt audit.',
      });
      return;
    }
    if (rejected > 0 && grnForm.rejection_reason.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'Quality rejection reason is mandatory (min 5 chars) when rejected quantity > 0.',
      });
      return;
    }

    try {
      setActionLoading(true);
      const payload: any = {
        received_quantity: totalBatch,
        accepted_quantity: accepted,
        rejected_quantity: rejected,
        delivery_note_number: grnForm.delivery_note_number.trim(),
        remarks: grnForm.remarks.trim() || 'QC Verified & Store Inwarded',
      };
      if (grnForm.invoice_number.trim()) payload.invoice_number = grnForm.invoice_number.trim();
      if (grnForm.delivery_date) payload.delivery_date = grnForm.delivery_date;
      if (rejected > 0) payload.rejection_reason = grnForm.rejection_reason.trim();

      const res = await apiClient.post(`/procurement/pr/${selectedPRForGRN.id}/grn`, payload);
      if (res.data?.success) {
        const grnNum = res.data.data?.grn_number;
        setFeedback({
          type: 'success',
          message: `GRN ${grnNum || ''} posted successfully! Usable stock increased by ${accepted} units.`,
        });
        setSelectedPRForGRN(null);
        setGrnForm({
          delivery_note_number: '',
          invoice_number: '',
          delivery_date: new Date().toISOString().split('T')[0],
          accepted_quantity: 1,
          rejected_quantity: 0,
          rejection_reason: '',
          remarks: '',
        });
        fetchPRs();
        fetchPOs();
        fetchDashboardData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'GRN Inwarding failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to open PO modal prefilled
  const openPOModal = (pr: PurchaseRequisition) => {
    setSelectedPRForPO(pr);
    // Suggest price from part catalog if available
    const part = parts.find((p) => p.id === pr.part_id);
    setPoForm({
      supplier_name: pr.supplier_name || 'JCB Genuine Parts Co.',
      unit_price: pr.unit_price || part?.unit_cost || 1000,
      expected_delivery_date: pr.expected_delivery_date ? pr.expected_delivery_date.split('T')[0] : '',
      mark_as_ordered: true,
      po_number: '',
    });
  };

  // Helper to open GRN modal prefilled
  const openGRNModal = (pr: PurchaseRequisition) => {
    setSelectedPRForGRN(pr);
    const remaining = Math.max(1, (pr.quantity_required || 1) - (pr.received_quantity || 0));
    setGrnForm({
      delivery_note_number: `DC-${Math.floor(100000 + Math.random() * 900000)}`,
      invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      delivery_date: new Date().toISOString().split('T')[0],
      accepted_quantity: remaining,
      rejected_quantity: 0,
      rejection_reason: '',
      remarks: 'Goods verified in satisfactory condition against JCB PO specifications.',
    });
  };

  // ============================================================================
  // RENDER INTERFACE
  // ============================================================================

  return (
    <div className="space-y-6 bg-zinc-50 min-h-screen p-2 sm:p-6 font-sans">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-bold transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-500/50 shadow-emerald-950/20'
              : 'bg-red-950 text-red-100 border-red-500/50 shadow-red-950/20'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="leading-snug">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="ml-2 text-zinc-400 hover:text-white p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-1 rounded-lg border border-amber-500 shadow-sm">
              JCB
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
              PROCUREMENT &amp; GOODS RECEIPT (GRN) CENTER
            </h1>
            <span className="bg-zinc-900 text-jcb-yellow text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              CMMS MODULE 4
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            End-to-end industrial spare parts requisitioning, PO generation, and Goods Receipt Note (GRN) quality inspection.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => {
              fetchPRs();
              if (isManager) {
                fetchDashboardData();
                fetchPOs();
                fetchVendors();
              }
            }}
            className="p-2.5 text-zinc-600 hover:text-black hover:bg-zinc-100 rounded-xl border border-zinc-200 transition"
            title="Refresh Requisition Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500 hover:shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>RAISE PURCHASE REQUISITION</span>
          </button>
        </div>
      </div>

      {/* Manager KPI Metrics Header (Only for Managers & Admins) */}
      {isManager && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Pending PRs</span>
              <ClipboardList className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900">
              {dashboardData?.summary?.total_pending_prs ?? 0}
            </div>
            <div className="text-[10px] font-bold text-amber-600 mt-1">Awaiting Review/PO</div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Active POs</span>
              <Truck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-zinc-900">
              {dashboardData?.summary?.active_pos ?? 0}
            </div>
            <div className="text-[10px] font-bold text-blue-600 mt-1">Dispatched / In-Transit</div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Overdue Deliveries</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-black text-red-600">
              {dashboardData?.summary?.overdue_pos ?? 0}
            </div>
            <div className="text-[10px] font-bold text-red-600 mt-1">Past Delivery Target</div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Spend</span>
              <DollarSign className="w-4 h-4 text-zinc-900" />
            </div>
            <div className="text-2xl font-black text-zinc-900">
              ₹{Number(dashboardData?.summary?.total_spend || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] font-bold text-zinc-500 mt-1">Active Commitments</div>
          </div>

          <div className="bg-white p-4 rounded-xl border-2 border-zinc-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Delivered This Month</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {dashboardData?.summary?.delivered_this_month ?? 0}
            </div>
            <div className="text-[10px] font-bold text-emerald-600 mt-1">GRNs Completed</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b-2 border-zinc-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('prs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
            activeTab === 'prs'
              ? 'bg-zinc-900 text-white shadow'
              : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Requisition Queue</span>
          {totalPRCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'prs' ? 'bg-jcb-yellow text-black' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              {totalPRCount}
            </span>
          )}
        </button>

        {isManager && (
          <>
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'pos'
                  ? 'bg-zinc-900 text-white shadow'
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Purchase Orders (POs)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  activeTab === 'pos' ? 'bg-blue-400 text-black' : 'bg-zinc-200 text-zinc-700'
                }`}
              >
                {dashboardData?.summary?.active_pos ?? 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                activeTab === 'vendors'
                  ? 'bg-zinc-900 text-white shadow'
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Vendor Directory</span>
            </button>

            {(dashboardData?.summary?.overdue_pos ?? 0) > 0 && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                  activeTab === 'analytics'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Overdue Alerts</span>
                <span className="bg-white text-red-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                  {dashboardData?.summary?.overdue_pos ?? 0}
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: PURCHASE REQUISITION QUEUE                                   */}
      {/* ==================================================================== */}
      {activeTab === 'prs' && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search PR number, part SKU, part name, machine code, or requester..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-jcb-yellow"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-500 uppercase">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-zinc-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="new">New Requisition</option>
                  <option value="under_review">Under Review</option>
                  <option value="vendor_selected">Vendor Selected</option>
                  <option value="approval_pending">Approval Pending</option>
                  <option value="po_created">PO Created</option>
                  <option value="ordered">Ordered</option>
                  <option value="partially_received">Partially Received</option>
                  <option value="fully_received">Fully Received</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-black text-zinc-500 uppercase">Urgency:</span>
                <select
                  value={urgencyFilter}
                  onChange={(e) => handleUrgencyFilterChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-zinc-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Urgencies</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {(searchQuery || statusFilter !== 'ALL' || urgencyFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setUrgencyFilter('ALL');
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-black hover:bg-zinc-100 rounded-xl transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* PR Table */}
          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">PR Details</th>
                    <th className="px-5 py-3.5">Spare Part Catalog</th>
                    <th className="px-5 py-3.5">Quantities</th>
                    <th className="px-5 py-3.5">Machine &amp; Plant</th>
                    <th className="px-5 py-3.5">Urgency</th>
                    <th className="px-5 py-3.5">Workflow Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingPRs ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-jcb-yellow" />
                          <span className="font-bold">Loading purchase requisitions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : prs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-400">
                        <div className="max-w-xs mx-auto space-y-2">
                          <ShoppingCart className="w-8 h-8 mx-auto text-zinc-300" />
                          <div className="font-black text-zinc-800">No Purchase Requisitions Found</div>
                          <p className="text-xs text-zinc-500 font-medium">
                            No requisitions match your active search or filter criteria.
                          </p>
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-jcb-yellow text-black text-xs font-black px-3.5 py-1.5 rounded-lg shadow-sm mt-2"
                          >
                            Raise PR Now
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    prs.map((pr) => {
                      const badge = getStatusBadge(pr.status);
                      const isOwnPR = pr.requested_by === user?.id;
                      const canApprove = isManager && ['new', 'under_review'].includes(pr.status);
                      const canIssuePO =
                        isManager && ['vendor_selected', 'approval_pending'].includes(pr.status);
                      const canGRN =
                        isManager &&
                        ['ordered', 'partially_received', 'po_created'].includes(pr.status);
                      const canCancel =
                        isManager &&
                        !['fully_received', 'cancelled', 'rejected'].includes(pr.status);

                      return (
                        <tr key={pr.id} className="hover:bg-zinc-50/80 transition">
                          {/* PR Details */}
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-xs font-black text-amber-800">
                              {pr.pr_number}
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {new Date(pr.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            {pr.po_number && (
                              <div className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block mt-1">
                                PO: {pr.po_number}
                              </div>
                            )}
                          </td>

                          {/* Spare Part */}
                          <td className="px-5 py-3.5">
                            <div className="font-black text-xs text-zinc-950">
                              {pr.part_number}
                            </div>
                            <div className="text-zinc-600 font-medium line-clamp-1">
                              {pr.part_name}
                            </div>
                            {pr.category && (
                              <span className="text-[9px] font-black uppercase text-zinc-400">
                                {pr.category}
                              </span>
                            )}
                          </td>

                          {/* Quantities */}
                          <td className="px-5 py-3.5">
                            <div className="font-mono font-bold text-zinc-900">
                              Req: <span className="font-black">{pr.quantity_required}</span>
                            </div>
                            <div className="font-mono text-[11px] text-zinc-500">
                              Recv: <span className="font-bold text-emerald-700">{pr.received_quantity || 0}</span>
                            </div>
                          </td>

                          {/* Machine & Plant */}
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-zinc-900">
                              {pr.machine_code || 'General Stock'}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {pr.plant_name || 'Plant Scoped'}
                            </div>
                            {pr.wo_number && (
                              <div className="font-mono text-[10px] text-amber-700">
                                WO: {pr.wo_number}
                              </div>
                            )}
                          </td>

                          {/* Urgency */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${getUrgencyBadge(
                                pr.urgency
                              )}`}
                            >
                              {pr.urgency}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                            {pr.rejection_reason && (
                              <div className="text-[10px] text-red-600 font-medium mt-1 line-clamp-1" title={pr.rejection_reason}>
                                Reason: {pr.rejection_reason}
                              </div>
                            )}
                          </td>

                          {/* Contextual Action Buttons */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Details Inspection */}
                              <button
                                onClick={() => handleOpenDetails(pr.id)}
                                className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-lg transition"
                                title="View PR Full Details, Audit Logs & GRNs"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Edit Requisition */}
                              <button
                                onClick={() => setSelectedPRForEdit(pr)}
                                className={`p-1.5 rounded-lg transition ${
                                  ['new', 'under_review'].includes(pr.status)
                                    ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-100'
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                                }`}
                                title={
                                  ['new', 'under_review'].includes(pr.status)
                                    ? 'Edit Purchase Requisition'
                                    : `Requisition is '${pr.status}' (Specifications read-only)`
                                }
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              {/* Delete Requisition */}
                              <button
                                onClick={() => setSelectedPRForDelete(pr)}
                                className={`p-1.5 rounded-lg transition ${
                                  pr.po_number || ['po_created', 'ordered', 'partially_received', 'fully_received'].includes(pr.status)
                                    ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
                                    : 'text-red-600 hover:text-red-800 hover:bg-red-100'
                                }`}
                                title={
                                  pr.po_number || ['po_created', 'ordered', 'partially_received', 'fully_received'].includes(pr.status)
                                    ? 'Deletion restricted: PO issued or items received'
                                    : 'Delete Purchase Requisition'
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>

                              {/* Manager Approve */}
                              {canApprove && (
                                <button
                                  onClick={() => {
                                    setSelectedPRForApprove(pr);
                                    setApproveTargetStatus('vendor_selected');
                                  }}
                                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-amber-500 shadow-sm transition uppercase"
                                >
                                  Review
                                </button>
                              )}

                              {/* Manager Reject */}
                              {canApprove && (
                                <button
                                  onClick={() => setSelectedPRForReject(pr)}
                                  className="border border-red-300 hover:bg-red-50 text-red-700 text-[10px] font-black px-2 py-1.5 rounded-lg transition uppercase"
                                >
                                  Reject
                                </button>
                              )}

                              {/* Issue PO */}
                              {canIssuePO && (
                                <button
                                  onClick={() => openPOModal(pr)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-sm transition uppercase flex items-center gap-1"
                                >
                                  <Truck className="w-3 h-3" />
                                  <span>Issue PO</span>
                                </button>
                              )}

                              {/* Inward GRN */}
                              {canGRN && (
                                <button
                                  onClick={() => openGRNModal(pr)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-sm transition uppercase flex items-center gap-1"
                                >
                                  <Boxes className="w-3 h-3" />
                                  <span>GRN Receipt</span>
                                </button>
                              )}

                              {/* Cancel */}
                              {canCancel && (
                                <button
                                  onClick={() => setSelectedPRForCancel(pr)}
                                  className="text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 p-1.5 rounded-lg transition"
                                  title="Cancel Requisition"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
                <span className="font-semibold">
                  Page <span className="font-black text-zinc-900">{page}</span> of {totalPages} ({totalPRCount} requisitions)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: PURCHASE ORDERS (POS)                                         */}
      {/* ==================================================================== */}
      {activeTab === 'pos' && isManager && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-zinc-700 uppercase">Filter:</span>
              <button
                onClick={() => {
                  setPoFilterOverdue(!poFilterOverdue);
                  setPoPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition ${
                  poFilterOverdue
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {poFilterOverdue ? 'Overdue POs Only' : 'Show All POs'}
              </button>
            </div>
            <div className="text-xs text-zinc-500 font-semibold">
              Total Active POs: <span className="font-black text-zinc-900">{poTotalCount}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700 font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">PO Number</th>
                    <th className="px-5 py-3.5">Supplier / Vendor</th>
                    <th className="px-5 py-3.5">Component</th>
                    <th className="px-5 py-3.5">Unit Price &amp; Total</th>
                    <th className="px-5 py-3.5">Delivery Target</th>
                    <th className="px-5 py-3.5">Fulfillment</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loadingPOs ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        Loading Purchase Orders...
                      </td>
                    </tr>
                  ) : pos.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-bold">
                        No purchase orders matching the filter.
                      </td>
                    </tr>
                  ) : (
                    pos.map((po) => {
                      const badge = getStatusBadge(po.status);
                      return (
                        <tr key={po.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-xs font-black text-blue-700">
                              {po.po_number}
                            </div>
                            <div className="font-mono text-[10px] text-zinc-400">PR: {po.pr_number}</div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-zinc-900">
                            {po.supplier_name || 'N/A'}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-black text-zinc-900">{po.part_number}</div>
                            <div className="text-zinc-500 line-clamp-1">{po.part_name}</div>
                          </td>
                          <td className="px-5 py-3.5 font-mono">
                            <div className="font-bold text-zinc-900">
                              ₹{Number(po.unit_price || 0).toLocaleString('en-IN')} / unit
                            </div>
                            <div className="text-[10px] text-zinc-500 font-semibold">
                              Total: ₹{Number(po.total_spend || 0).toLocaleString('en-IN')}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {po.expected_delivery_date ? (
                              <div className="space-y-0.5">
                                <div className="text-xs font-semibold text-zinc-800">
                                  {new Date(po.expected_delivery_date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </div>
                                {po.is_overdue && (
                                  <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                                    Overdue by {po.days_overdue}d
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400">Not specified</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-mono text-xs font-bold">
                              {po.received_quantity || 0} / {po.quantity_required} Units
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${badge.color} inline-block mt-1`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {['ordered', 'partially_received', 'po_created'].includes(po.status) && (
                                <button
                                  onClick={() => {
                                    // Map PO to PR structure for GRN modal
                                    openGRNModal({
                                      id: po.id,
                                      pr_number: po.pr_number,
                                      part_id: '',
                                      part_number: po.part_number,
                                      part_name: po.part_name,
                                      quantity_required: po.quantity_required,
                                      urgency: 'high',
                                      technical_justification: '',
                                      status: po.status,
                                      po_number: po.po_number,
                                      supplier_name: po.supplier_name,
                                      received_quantity: po.received_quantity,
                                      created_at: po.created_at,
                                      updated_at: po.created_at,
                                    });
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm transition uppercase flex items-center gap-1"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Inward GRN</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenDetails(po.id)}
                                className="p-1.5 text-zinc-500 hover:text-black hover:bg-zinc-200 rounded-lg transition"
                                title="Inspect Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* PO Pagination */}
            {poTotalPages > 1 && (
              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-600">
                <span className="font-semibold">
                  Page <span className="font-black text-zinc-900">{poPage}</span> of {poTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={poPage <= 1}
                    onClick={() => setPoPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={poPage >= poTotalPages}
                    onClick={() => setPoPage((p) => Math.min(poTotalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-white transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: VENDOR PERFORMANCE DIRECTORY                                  */}
      {/* ==================================================================== */}
      {activeTab === 'vendors' && isManager && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border-2 border-zinc-200 shadow-sm flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search vendor / supplier directory..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
              />
            </div>
            <button
              onClick={() => fetchVendors()}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-xs font-black rounded-xl transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingVendors ? (
              <div className="col-span-full py-12 text-center text-zinc-400 font-bold">
                Loading vendor directory...
              </div>
            ) : vendors.length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-400 font-bold">
                No vendor profiles found.
              </div>
            ) : (
              vendors.map((v, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border-2 border-zinc-200 shadow-sm hover:border-zinc-300 transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-black text-sm text-zinc-950">{v.vendor_name}</h3>
                      <div className="text-[10px] font-bold text-zinc-400">JCB Certified Supplier</div>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                      {v.on_time_delivery_rate}% On-Time
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        Total Orders
                      </span>
                      <span className="font-black text-zinc-900">{v.total_orders} Orders</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        Active In-Flight
                      </span>
                      <span className="font-black text-blue-600">{v.active_orders} Orders</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        Parts Supplied
                      </span>
                      <span className="font-black text-zinc-900">
                        {v.total_parts_supplied} Units
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        Cumulative Spend
                      </span>
                      <span className="font-black text-zinc-900">
                        ₹{Number(v.total_spend || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: OVERDUE ALERTS SUMMARY                                        */}
      {/* ==================================================================== */}
      {/* ==================================================================== */}
      {/* TAB 4: OVERDUE ALERTS SUMMARY                                        */}
      {/* ==================================================================== */}
      {activeTab === 'analytics' && isManager && (
        <div className="bg-white p-6 rounded-2xl border-2 border-red-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white p-2 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-red-950">
                CRITICAL OVERDUE PURCHASE ORDERS ({dashboardData?.overdue_pos_list?.length ?? 0})
              </h2>
              <p className="text-xs text-red-700 font-medium">
                Deliveries exceeding promised supply SLA. Immediate vendor follow-up required.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-red-50 text-red-900 font-black uppercase">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-4 py-3">Days Overdue</th>
                  <th className="px-4 py-3">Outstanding Value</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {(!dashboardData?.overdue_pos_list || dashboardData.overdue_pos_list.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500 font-medium">
                      No overdue purchase orders. All vendor commitments are on schedule.
                    </td>
                  </tr>
                ) : (
                  dashboardData.overdue_pos_list.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-red-950">{item.po_number}</td>
                      <td className="px-4 py-3 font-bold text-zinc-900">{item.supplier_name}</td>
                      <td className="px-4 py-3 font-medium text-zinc-700">
                        {item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-red-600 text-white font-black px-2 py-0.5 rounded text-[10px]">
                          +{item.days_overdue} Days Late
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-zinc-900">
                        ₹{Number(item.outstanding_value || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenDetails(item.id)}
                          className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg uppercase"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: RAISE PURCHASE REQUISITION                                  */}
      {/* ==================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  PR
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-wide">
                    RAISE PURCHASE REQUISITION
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Submit spare part procurement request to plant maintenance authority.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePR} className="p-6 space-y-4 overflow-y-auto">
              {/* Part Selector */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Required Spare Part Catalog SKU *
                </label>
                <select
                  required
                  value={createForm.part_id}
                  onChange={(e) => setCreateForm({ ...createForm, part_id: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose spare part SKU --</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_number} — {p.name} (Stock: {p.available_stock} | ₹{p.unit_cost || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Target Machine Asset
                  </label>
                  <select
                    value={createForm.machine_id}
                    onChange={(e) => setCreateForm({ ...createForm, machine_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
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
                    step="1"
                    required
                    value={createForm.quantity_required}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        quantity_required: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* Linked Work Order & Expected Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Linked Work Order (Optional)
                  </label>
                  <select
                    value={createForm.work_order_id}
                    onChange={(e) => {
                      const selectedWo = workOrders.find((w) => w.id === e.target.value);
                      setCreateForm({
                        ...createForm,
                        work_order_id: e.target.value,
                        machine_id: selectedWo?.machine_id || createForm.machine_id,
                      });
                    }}
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="">-- No linked work order --</option>
                    {workOrders.map((wo) => (
                      <option key={wo.id} value={wo.id}>
                        {wo.wo_number} ({wo.machine_code}) — {wo.problem_title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={createForm.expected_delivery_date}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, expected_delivery_date: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Procurement Urgency *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['critical', 'high', 'medium', 'low'] as PRUrgency[]).map((urg) => (
                    <button
                      type="button"
                      key={urg}
                      onClick={() => setCreateForm({ ...createForm, urgency: urg })}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition border ${
                        createForm.urgency === urg
                          ? 'bg-zinc-900 text-white border-black shadow'
                          : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {urg}
                    </button>
                  ))}
                </div>
              </div>

              {/* Justification */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Technical Justification * (Min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this spare part is required and the operational impact if not procured..."
                  value={createForm.technical_justification}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, technical_justification: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Authorize Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: APPROVE REQUISITION                                         */}
      {/* ==================================================================== */}
      {selectedPRForApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-base font-black text-white">APPROVE REQUISITION</h3>
              </div>
              <button
                onClick={() => setSelectedPRForApprove(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApprovePR} className="p-6 space-y-4">
              <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200 text-xs space-y-1">
                <div className="font-mono font-black text-amber-800">
                  {selectedPRForApprove.pr_number}
                </div>
                <div className="font-black text-zinc-900">{selectedPRForApprove.part_number} — {selectedPRForApprove.part_name}</div>
                <div className="text-zinc-500">
                  Quantity Required: <span className="font-bold text-zinc-800">{selectedPRForApprove.quantity_required} Units</span>
                </div>
                <div className="text-zinc-500">
                  Requester: <span className="font-bold text-zinc-800">{selectedPRForApprove.requester_name || 'Technician'}</span>
                </div>
              </div>

              {/* Separation of duties warning */}
              {selectedPRForApprove.requested_by === user?.id && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-xs text-red-800 font-bold">
                  <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Separation of duties: You cannot approve a requisition you created yourself.</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Next Lifecycle Stage *
                </label>
                <select
                  value={approveTargetStatus}
                  onChange={(e: any) => setApproveTargetStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="vendor_selected">Vendor Selected (Ready to issue PO)</option>
                  <option value="approval_pending">Pending Plant Management Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Approval Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Approved for immediate PO issuance. Supplier vetted."
                  value={approveRemarks}
                  onChange={(e) => setApproveRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPRForApprove(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || selectedPRForApprove.requested_by === user?.id}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-40"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: REJECT REQUISITION                                          */}
      {/* ==================================================================== */}
      {selectedPRForReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-red-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-950 p-5 flex items-center justify-between border-b border-red-900">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-black text-white">REJECT REQUISITION</h3>
              </div>
              <button
                onClick={() => setSelectedPRForReject(null)}
                className="text-red-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectPR} className="p-6 space-y-4">
              <p className="text-xs text-zinc-600 font-medium">
                Rejecting requisition <span className="font-mono font-bold text-red-900">{selectedPRForReject.pr_number}</span> will permanently set its status to <span className="font-bold text-red-800">rejected</span>.
              </p>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Mandatory Rejection Remarks * (Min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detail the technical or commercial reason for rejecting this requisition..."
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPRForReject(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || rejectRemarks.trim().length < 5}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-40"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject PR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: CANCEL REQUISITION                                          */}
      {/* ==================================================================== */}
      {selectedPRForCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-900 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">CANCEL REQUISITION</h3>
              </div>
              <button
                onClick={() => setSelectedPRForCancel(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelPR} className="p-6 space-y-4">
              <p className="text-xs text-zinc-600 font-medium">
                Are you sure you want to cancel requisition{' '}
                <span className="font-mono font-bold text-zinc-900">{selectedPRForCancel.pr_number}</span>?
              </p>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Cancellation Reason * (Min 5 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify why this requisition is being cancelled (e.g. Duplicate entry, machine scrapped, alternate part used)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPRForCancel(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || cancelReason.trim().length < 5}
                  className="bg-zinc-900 hover:bg-black text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-40"
                >
                  {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: ISSUE PURCHASE ORDER (PO)                                   */}
      {/* ==================================================================== */}
      {selectedPRForPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-jcb-yellow" />
                <h3 className="text-base font-black text-white">ISSUE PURCHASE ORDER</h3>
              </div>
              <button
                onClick={() => setSelectedPRForPO(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIssuePO} className="p-6 space-y-4">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <div className="font-mono font-bold text-amber-800">{selectedPRForPO.pr_number}</div>
                <div className="font-black text-zinc-900">
                  {selectedPRForPO.part_number} — {selectedPRForPO.part_name}
                </div>
                <div className="text-zinc-500 font-semibold mt-0.5">
                  Quantity Required: <span className="font-black text-zinc-900">{selectedPRForPO.quantity_required} Units</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bosch Rexroth India, SKF Bearings Ltd"
                  value={poForm.supplier_name}
                  onChange={(e) => setPoForm({ ...poForm, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Agreed Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={poForm.unit_price}
                    onChange={(e) =>
                      setPoForm({ ...poForm, unit_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Total Order Value (₹)
                  </label>
                  <div className="w-full px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-black text-zinc-900">
                    ₹{(poForm.unit_price * selectedPRForPO.quantity_required).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poForm.expected_delivery_date}
                    onChange={(e) =>
                      setPoForm({ ...poForm, expected_delivery_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Custom PO Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Auto: PO-YYYY-XXXXX"
                    value={poForm.po_number}
                    onChange={(e) => setPoForm({ ...poForm, po_number: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mark_ordered"
                  checked={poForm.mark_as_ordered}
                  onChange={(e) => setPoForm({ ...poForm, mark_as_ordered: e.target.checked })}
                  className="rounded border-zinc-300 text-jcb-yellow focus:ring-0 w-4 h-4"
                />
                <label htmlFor="mark_ordered" className="text-xs font-bold text-zinc-800">
                  Mark as Ordered / Dispatched immediately (Transitions status to 'ordered')
                </label>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPRForPO(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !poForm.supplier_name.trim() || poForm.unit_price <= 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-40"
                >
                  {actionLoading ? 'Issuing PO...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: INWARD GRN & QUALITY INSPECTION                             */}
      {/* ==================================================================== */}
      {selectedPRForGRN && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <Boxes className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-black text-white">GOODS RECEIPT NOTE (GRN) &amp; QC</h3>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Store gate receipt inspection &amp; inventory update
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPRForGRN(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInwardGRN} className="p-6 space-y-4 overflow-y-auto">
              {/* Order Context */}
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-amber-800">{selectedPRForGRN.pr_number}</span>
                  {selectedPRForGRN.po_number && (
                    <span className="font-black text-blue-700">PO: {selectedPRForGRN.po_number}</span>
                  )}
                </div>
                <div className="font-black text-zinc-950">{selectedPRForGRN.part_name}</div>
                <div className="flex items-center justify-between text-zinc-600 font-semibold pt-1 border-t border-zinc-200">
                  <span>Total Ordered: {selectedPRForGRN.quantity_required}</span>
                  <span>Received So Far: {selectedPRForGRN.received_quantity || 0}</span>
                  <span className="text-emerald-700 font-black">
                    Remaining: {Math.max(0, selectedPRForGRN.quantity_required - (selectedPRForGRN.received_quantity || 0))}
                  </span>
                </div>
              </div>

              {/* Delivery Note & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Delivery Note / DC Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="DC-98421"
                    value={grnForm.delivery_note_number}
                    onChange={(e) => setGrnForm({ ...grnForm, delivery_note_number: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Invoice Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="INV-2026-4412"
                    value={grnForm.invoice_number}
                    onChange={(e) => setGrnForm({ ...grnForm, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* Quantities Inspection */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                <div>
                  <label className="block text-[11px] font-black text-emerald-800 uppercase mb-1">
                    Accepted / Usable Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={grnForm.accepted_quantity}
                    onChange={(e) =>
                      setGrnForm({
                        ...grnForm,
                        accepted_quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-black text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    Added to Store Inventory
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-red-800 uppercase mb-1">
                    Rejected / Damaged Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={grnForm.rejected_quantity}
                    onChange={(e) =>
                      setGrnForm({
                        ...grnForm,
                        rejected_quantity: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-red-300 rounded-xl text-xs font-black text-red-950 focus:outline-none focus:border-red-500"
                  />
                  <span className="text-[10px] text-red-700 font-semibold block mt-0.5">
                    Quarantined / Returned
                  </span>
                </div>
              </div>

              {/* Total Batch Info */}
              <div className="flex items-center justify-between text-xs px-2 text-zinc-600 font-bold">
                <span>Total Received in Batch:</span>
                <span className="font-mono text-zinc-950 text-sm font-black">
                  {grnForm.accepted_quantity + grnForm.rejected_quantity} Units
                </span>
              </div>

              {/* Quality Rejection Reason (Mandatory if rejected > 0) */}
              {grnForm.rejected_quantity > 0 && (
                <div>
                  <label className="block text-[11px] font-black text-red-700 uppercase mb-1">
                    Quality Rejection Reason * (Min 5 chars)
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Defective seal, dimensional mismatch, shipping damage..."
                    value={grnForm.rejection_reason}
                    onChange={(e) => setGrnForm({ ...grnForm, rejection_reason: e.target.value })}
                    className="w-full px-3 py-2 bg-red-50 border border-red-300 rounded-xl text-xs font-medium text-red-950 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Inspection Remarks
                </label>
                <textarea
                  rows={2}
                  value={grnForm.remarks}
                  onChange={(e) => setGrnForm({ ...grnForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedPRForGRN(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    actionLoading ||
                    grnForm.accepted_quantity + grnForm.rejected_quantity <= 0 ||
                    !grnForm.delivery_note_number.trim() ||
                    (grnForm.rejected_quantity > 0 && grnForm.rejection_reason.trim().length < 5)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-40"
                >
                  {actionLoading ? 'Posting GRN...' : 'Post GRN to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: FULL PR DETAILS & REGULATORY AUDIT LOGS                    */}
      {/* ==================================================================== */}
      {selectedPRForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  PR
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-mono">
                    {selectedPRForDetails.pr_number}
                  </h3>
                  <div className="text-[10px] text-zinc-400">
                    Requisition Specifications &amp; Regulatory Audit Trail
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedPRForDetails(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Header Info Banner */}
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Status</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      getStatusBadge(selectedPRForDetails.status).color
                    }`}
                  >
                    {getStatusBadge(selectedPRForDetails.status).label}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Urgency</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase ${getUrgencyBadge(
                      selectedPRForDetails.urgency
                    )}`}
                  >
                    {selectedPRForDetails.urgency}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Quantity</span>
                  <span className="font-mono font-black text-xs text-zinc-900">
                    {selectedPRForDetails.received_quantity || 0} / {selectedPRForDetails.quantity_required} Units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">PO Number</span>
                  <span className="font-mono font-bold text-xs text-blue-700">
                    {selectedPRForDetails.po_number || 'Not Issued'}
                  </span>
                </div>
              </div>

              {/* Component & Asset Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Spare Part</span>
                  <div className="font-black text-zinc-900">{selectedPRForDetails.part_number}</div>
                  <div className="text-zinc-600 font-medium">{selectedPRForDetails.part_name}</div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Target Machine</span>
                  <div className="font-black text-zinc-900">
                    {selectedPRForDetails.machine_code || 'General Stock Refill'}
                  </div>
                  <div className="text-zinc-500 font-medium">{selectedPRForDetails.machine_name}</div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Requester</span>
                  <div className="font-bold text-zinc-900">{selectedPRForDetails.requester_name || 'Technician'}</div>
                  <div className="text-[10px] text-zinc-500 uppercase">{selectedPRForDetails.requester_role}</div>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase block">Approved By</span>
                  <div className="font-bold text-zinc-900">{selectedPRForDetails.approver_name || 'Pending Review'}</div>
                </div>
              </div>

              {/* Technical Justification */}
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">
                  Technical Justification
                </span>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-800 leading-relaxed">
                  {selectedPRForDetails.technical_justification}
                </div>
              </div>

              {/* GRN Receipts Section */}
              {selectedPRForDetails.grn_receipts && selectedPRForDetails.grn_receipts.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Inwarded Goods Receipt Notes (GRNs)</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedPRForDetails.grn_receipts.map((grn) => (
                      <div
                        key={grn.id}
                        className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-emerald-900">{grn.grn_number}</span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(grn.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                          <div>
                            Accepted: <span className="font-bold text-emerald-700">{grn.accepted_quantity}</span>
                          </div>
                          <div>
                            Rejected: <span className="font-bold text-red-700">{grn.rejected_quantity}</span>
                          </div>
                          <div>
                            DC: <span className="font-bold text-zinc-800">{grn.delivery_note_number}</span>
                          </div>
                        </div>
                        {grn.rejection_reason && (
                          <div className="text-[10px] text-red-700 font-medium">
                            Rejection Reason: {grn.rejection_reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Logs Trail */}
              {selectedPRForDetails.audit_logs && selectedPRForDetails.audit_logs.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Regulatory Audit Trail</span>
                  </h4>
                  <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 text-xs">
                    {selectedPRForDetails.audit_logs.map((log) => (
                      <div key={log.id} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-zinc-900">{log.action}</span>
                          <div className="text-[10px] text-zinc-500">
                            By {log.performed_by_name} ({log.performed_by_role})
                          </div>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end shrink-0">
              <button
                onClick={() => setSelectedPRForDetails(null)}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Purchase Requisition Modal */}
      <EditPRModal
        isOpen={Boolean(selectedPRForEdit)}
        onClose={() => setSelectedPRForEdit(null)}
        onSuccess={(updatedPR) => {
          setFeedback({
            type: 'success',
            message: `Purchase Requisition ${updatedPR.pr_number} updated successfully!`,
          });
          fetchPRs();
          if (isManager) fetchDashboardData();
        }}
        pr={selectedPRForEdit}
        parts={parts}
        machines={machines}
        userRole={user?.role}
        userId={user?.id}
      />

      {/* Delete Purchase Requisition Modal */}
      <DeletePRModal
        isOpen={Boolean(selectedPRForDelete)}
        onClose={() => setSelectedPRForDelete(null)}
        onSuccess={() => {
          setFeedback({
            type: 'success',
            message: 'Purchase requisition deleted successfully from database.',
          });
          fetchPRs();
          if (isManager) fetchDashboardData();
        }}
        pr={selectedPRForDelete}
        userRole={user?.role}
        userId={user?.id}
      />
    </div>
  );
};
