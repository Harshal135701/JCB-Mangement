import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  RdcChallan,
  RdcItem,
  RdcStatus,
  RdcType,
  RdcPriority,
  RdcDashboardMetrics,
  RdcAuditLog,
  OverdueRdc,
} from './rdc.types';
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
  Send,
  Boxes,
  Clock,
  Ban,
  Eye,
  ShieldAlert,
  Archive,
  ChevronLeft,
  ChevronRight,
  Package,
  Check,
  Building,
  User,
  Info,
  Layers,
  Sparkles,
  ExternalLink,
  Trash2,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// STYLING & STATUS HELPERS (JCB INDUSTRIAL DESIGN SYSTEM)
// ============================================================================

const getStatusBadge = (status: RdcStatus) => {
  switch (status) {
    case 'draft':
      return {
        label: 'Draft',
        classes: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        dot: 'bg-zinc-500',
      };
    case 'pending_approval':
      return {
        label: 'Pending Approval',
        classes: 'bg-amber-950/70 text-amber-300 border-amber-600/50',
        dot: 'bg-amber-400 animate-pulse',
      };
    case 'approved':
      return {
        label: 'Approved / Ready',
        classes: 'bg-blue-950/70 text-blue-300 border-blue-600/50',
        dot: 'bg-blue-400',
      };
    case 'dispatched':
      return {
        label: 'In Transit / Dispatched',
        classes: 'bg-purple-950/70 text-purple-300 border-purple-600/50',
        dot: 'bg-purple-400',
      };
    case 'partially_returned':
      return {
        label: 'Partially Returned',
        classes: 'bg-yellow-950/70 text-yellow-300 border-yellow-600/50',
        dot: 'bg-yellow-400',
      };
    case 'fully_returned':
      return {
        label: 'Fully Returned',
        classes: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50',
        dot: 'bg-emerald-400',
      };
    case 'closed':
      return {
        label: 'Closed & Reconciled',
        classes: 'bg-zinc-900 text-zinc-400 border-zinc-700',
        dot: 'bg-emerald-500',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        classes: 'bg-red-950/70 text-red-300 border-red-600/50',
        dot: 'bg-red-400',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-zinc-900 text-zinc-500 border-zinc-800 line-through',
        dot: 'bg-zinc-600',
      };
    default:
      return {
        label: status,
        classes: 'bg-zinc-800 text-zinc-300 border-zinc-700',
        dot: 'bg-zinc-400',
      };
  }
};

const getPriorityBadge = (priority: RdcPriority) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-600 text-white font-black animate-pulse';
    case 'high':
      return 'bg-amber-500 text-black font-extrabold';
    case 'medium':
      return 'bg-blue-600 text-white font-bold';
    case 'low':
      return 'bg-zinc-700 text-zinc-200 font-medium';
    default:
      return 'bg-zinc-700 text-zinc-200 font-medium';
  }
};

// ============================================================================
// MAIN ENTERPRISE RDC PAGE
// ============================================================================

export const RDCPage: React.FC = () => {
  const { user } = useAuth();

  // Role permissions
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || isAdmin;
  const isStoreManager = user?.role === 'store_manager' || isManager;
  const isTechnician = user?.role === 'technician';

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'challans' | 'overdue' | 'quarantine'>('challans');

  // List State
  const [rdcs, setRdcs] = useState<RdcChallan[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Operational Dashboard Metrics
  const [metrics, setMetrics] = useState<RdcDashboardMetrics>({
    total_rdc: 0,
    total_nrdc: 0,
    pending_approval: 0,
    approved: 0,
    dispatched: 0,
    partially_returned: 0,
    fully_returned: 0,
    closed: 0,
    cancelled: 0,
    overdue_returns: 0,
    total_outstanding_quantity: 0,
  });

  // Overdue List State
  const [overdueList, setOverdueList] = useState<OverdueRdc[]>([]);
  const [loadingOverdue, setLoadingOverdue] = useState(false);

  // Auxiliary data
  const [machines, setMachines] = useState<any[]>([]);
  const [inventoryParts, setInventoryParts] = useState<any[]>([]);

  // Feedback Notification Banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Drawer / Inspection Panel State
  const [selectedChallan, setSelectedChallan] = useState<RdcChallan | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'items' | 'history'>('items');
  const [challanHistory, setChallanHistory] = useState<RdcAuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Initial Multi-Item Creation Form
  const [createForm, setCreateForm] = useState({
    rdc_type: 'RDC' as RdcType,
    priority: 'medium' as RdcPriority,
    vendor_party_name: '',
    vendor_gstin: '',
    vendor_address: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    purpose: '',
    machine_id: '',
    document_reference: '',
    expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    submission_notes: '',
    save_as_draft: false,
    items: [
      {
        part_id: '',
        item_description: '',
        serial_number: '',
        quantity_dispatched: 1,
        unit_cost: 0,
        remarks: '',
      },
    ],
  });

  // Interactive Action Modals State
  const [activeActionModal, setActiveActionModal] = useState<
    | null
    | 'submit'
    | 'reject'
    | 'dispatch'
    | 'return'
    | 'replacement'
    | 'damage'
    | 'writeoff'
    | 'cancel'
    | 'close'
  >(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Action Form Inputs
  const [submitNotes, setSubmitNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [dispatchData, setDispatchData] = useState({
    vehicle_number: '',
    transporter_name: '',
  });
  const [returnItemForm, setReturnItemForm] = useState({
    item_id: '',
    returned_quantity: 1,
    remarks: '',
  });
  const [replacementItemForm, setReplacementItemForm] = useState({
    item_id: '',
    replacement_quantity: 1,
    new_serial_number: '',
    remarks: '',
  });
  const [damageItemForm, setDamageItemForm] = useState({
    item_id: '',
    damaged_quantity: 1,
    reason: '',
  });
  const [writeOffItemForm, setWriteOffItemForm] = useState({
    item_id: '',
    writeoff_quantity: 1,
    reason: '',
  });
  const [cancellationReason, setCancellationReason] = useState('');

  // --------------------------------------------------------------------------
  // API CALLS & DATA FETCHING
  // --------------------------------------------------------------------------

  // Fetch Dashboard Metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await apiClient.get('/rdc/dashboard');
      if (res.data?.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load RDC dashboard metrics:', err);
    }
  }, []);

  // Fetch Paginated Delivery Challans
  const fetchChallans = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (statusFilter !== 'ALL') params.append('status', statusFilter.toLowerCase());
      if (typeFilter !== 'ALL') params.append('rdc_type', typeFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter.toLowerCase());
      if (search.trim()) params.append('search', search.trim());

      const res = await apiClient.get(`/rdc?${params.toString()}`);
      if (res.data?.success) {
        setRdcs(res.data.data || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalCount(res.data.pagination.totalCount || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load RDCs:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retrieve Delivery Challans.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter, priorityFilter, search]);

  // Fetch Overdue Challans
  const fetchOverdue = useCallback(async () => {
    try {
      setLoadingOverdue(true);
      const res = await apiClient.get('/rdc/overdue');
      if (res.data?.success) {
        setOverdueList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load overdue RDCs:', err);
    } finally {
      setLoadingOverdue(false);
    }
  }, []);

  // Fetch Machines & Inventory for Dropdown selection
  const fetchAuxiliaryData = useCallback(async () => {
    try {
      const [machRes, invRes] = await Promise.allSettled([
        apiClient.get('/machines?limit=100'),
        apiClient.get('/inventory?limit=100'),
      ]);
      if (machRes.status === 'fulfilled' && machRes.value.data?.data) {
        setMachines(machRes.value.data.data);
      }
      if (invRes.status === 'fulfilled' && invRes.value.data?.data) {
        setInventoryParts(invRes.value.data.data);
      }
    } catch (err) {
      console.error('Failed to load auxiliary dropdown data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMetrics();
    fetchChallans();
    fetchOverdue();
    fetchAuxiliaryData();
  }, [fetchMetrics, fetchChallans, fetchOverdue, fetchAuxiliaryData]);

  // Refetch when filters change
  useEffect(() => {
    fetchChallans();
  }, [fetchChallans]);

  // Open Challan Details Drawer
  const openDrawer = async (challan: RdcChallan) => {
    setSelectedChallan(challan);
    setIsDrawerOpen(true);
    setDrawerTab('items');

    // Fetch full challan details including latest line item status
    try {
      const detailRes = await apiClient.get(`/rdc/${challan.id}`);
      if (detailRes.data?.success) {
        setSelectedChallan(detailRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch full challan details:', err);
    }

    // Fetch history
    try {
      setLoadingHistory(true);
      const histRes = await apiClient.get(`/rdc/${challan.id}/history`);
      if (histRes.data?.success) {
        setChallanHistory(histRes.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load challan history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Close Drawer
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedChallan(null);
    setChallanHistory([]);
  };

  // Refresh current challan in drawer
  const refreshCurrentChallan = async () => {
    if (!selectedChallan) return;
    try {
      const res = await apiClient.get(`/rdc/${selectedChallan.id}`);
      if (res.data?.success) {
        setSelectedChallan(res.data.data);
      }
      const histRes = await apiClient.get(`/rdc/${selectedChallan.id}/history`);
      if (histRes.data?.success) {
        setChallanHistory(histRes.data.data || []);
      }
      fetchChallans();
      fetchMetrics();
      fetchOverdue();
    } catch (err) {
      console.error('Error refreshing challan:', err);
    }
  };

  // --------------------------------------------------------------------------
  // CREATE CHALLAN HANDLERS
  // --------------------------------------------------------------------------

  const handleAddItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          part_id: '',
          item_description: '',
          serial_number: '',
          quantity_dispatched: 1,
          unit_cost: 0,
          remarks: '',
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    if (createForm.items.length <= 1) return;
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setCreateForm((prev) => {
      const updated = [...prev.items];
      const item = { ...updated[index], [field]: value };

      // Auto-fill description & cost if part selected
      if (field === 'part_id') {
        const found = inventoryParts.find((p) => p.id === value);
        if (found) {
          item.item_description = found.part_name || found.description || item.item_description;
          if (found.unit_cost) item.unit_cost = Number(found.unit_cost);
        }
      }

      updated[index] = item;
      return { ...prev, items: updated };
    });
  };

  const calculatedTotalApproxValue = useMemo(() => {
    return createForm.items.reduce(
      (sum, it) => sum + (Number(it.quantity_dispatched) || 0) * (Number(it.unit_cost) || 0),
      0
    );
  }, [createForm.items]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.vendor_party_name.trim()) {
      setFeedback({ type: 'error', message: 'Vendor Party Name is mandatory.' });
      return;
    }
    if (!createForm.purpose.trim()) {
      setFeedback({ type: 'error', message: 'Dispatch Purpose is mandatory.' });
      return;
    }
    if (createForm.rdc_type === 'RDC' && !createForm.expected_return_date) {
      setFeedback({
        type: 'error',
        message: 'Expected Return Date is mandatory for Returnable Delivery Challans (RDC).',
      });
      return;
    }

    // Validate items
    for (let i = 0; i < createForm.items.length; i++) {
      const it = createForm.items[i];
      if (!it.item_description.trim()) {
        setFeedback({
          type: 'error',
          message: `Line item #${i + 1} requires a valid item description.`,
        });
        return;
      }
      if (Number(it.quantity_dispatched) <= 0) {
        setFeedback({
          type: 'error',
          message: `Line item #${i + 1} quantity must be a positive number.`,
        });
        return;
      }
    }

    try {
      setCreateSubmitting(true);
      const payload: any = {
        rdc_type: createForm.rdc_type,
        priority: createForm.priority,
        vendor_party_name: createForm.vendor_party_name.trim(),
        vendor_gstin: createForm.vendor_gstin.trim() || undefined,
        vendor_address: createForm.vendor_address.trim() || undefined,
        contact_person: createForm.contact_person.trim() || undefined,
        contact_phone: createForm.contact_phone.trim() || undefined,
        contact_email: createForm.contact_email.trim() || undefined,
        purpose: createForm.purpose.trim(),
        machine_id: createForm.machine_id || undefined,
        document_reference: createForm.document_reference.trim() || undefined,
        expected_return_date:
          createForm.rdc_type === 'RDC' ? createForm.expected_return_date : undefined,
        status: createForm.save_as_draft ? 'draft' : 'pending_approval',
        submission_notes: createForm.submission_notes.trim() || undefined,
        items: createForm.items.map((it) => ({
          part_id: it.part_id || undefined,
          item_description: it.item_description.trim(),
          serial_number: it.serial_number.trim() || undefined,
          quantity_dispatched: Number(it.quantity_dispatched),
          unit_cost: Number(it.unit_cost) || 0,
          remarks: it.remarks.trim() || undefined,
        })),
      };

      const res = await apiClient.post('/rdc', payload);
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Delivery Challan ${res.data.data?.challan_number || ''} created successfully!`,
        });
        setIsCreateModalOpen(false);
        // Reset form
        setCreateForm({
          rdc_type: 'RDC',
          priority: 'medium',
          vendor_party_name: '',
          vendor_gstin: '',
          vendor_address: '',
          contact_person: '',
          contact_phone: '',
          contact_email: '',
          purpose: '',
          machine_id: '',
          document_reference: '',
          expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          submission_notes: '',
          save_as_draft: false,
          items: [
            {
              part_id: '',
              item_description: '',
              serial_number: '',
              quantity_dispatched: 1,
              unit_cost: 0,
              remarks: '',
            },
          ],
        });
        fetchChallans();
        fetchMetrics();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to create Delivery Challan.',
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // LIFECYCLE ACTION HANDLERS
  // --------------------------------------------------------------------------

  // Submit Draft for Approval
  const handleSubmitDraft = async () => {
    if (!selectedChallan) return;
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/submit`, {
        submission_notes: submitNotes.trim() || undefined,
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Challan ${selectedChallan.challan_number} submitted for manager review.`,
        });
        setActiveActionModal(null);
        setSubmitNotes('');
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to submit challan for approval.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Approve Challan
  const handleApprove = async () => {
    if (!selectedChallan) return;
    // Check self-approval guard
    if (selectedChallan.created_by === user?.id) {
      setFeedback({
        type: 'error',
        message: 'Self-Approval Prohibited: You cannot approve a challan you created.',
      });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/approve`, {});
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Challan ${selectedChallan.challan_number} approved! Ready for physical dispatch.`,
        });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Approval failed.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Reject Challan
  const handleReject = async () => {
    if (!selectedChallan) return;
    if (!rejectionReason.trim()) {
      setFeedback({ type: 'error', message: 'Rejection reason is strictly mandatory.' });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/reject`, {
        reason: rejectionReason.trim(),
      });
      if (res.data?.success) {
        setFeedback({
          type: 'info',
          message: `Challan ${selectedChallan.challan_number} marked as rejected.`,
        });
        setActiveActionModal(null);
        setRejectionReason('');
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to reject challan.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Dispatch Materials & Issue Gate Pass
  const handleDispatch = async () => {
    if (!selectedChallan) return;
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/dispatch`, {
        vehicle_number: dispatchData.vehicle_number.trim() || undefined,
        transporter_name: dispatchData.transporter_name.trim() || undefined,
      });
      if (res.data?.success) {
        const gp = res.data.data?.gate_pass_number;
        setFeedback({
          type: 'success',
          message: `Materials dispatched! Security Gate Pass: ${gp}. Inventory movement logged.`,
        });
        setActiveActionModal(null);
        setDispatchData({ vehicle_number: '', transporter_name: '' });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Dispatch authorization failed.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Record Usable Return
  const handleRecordReturn = async () => {
    if (!selectedChallan || !returnItemForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select a line item to inward.' });
      return;
    }
    if (Number(returnItemForm.returned_quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Returned quantity must be greater than zero.' });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/return`, {
        item_id: returnItemForm.item_id,
        returned_quantity: Number(returnItemForm.returned_quantity),
        remarks: returnItemForm.remarks.trim() || undefined,
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Usable return recorded! Stock returned to warehouse inventory. Status: ${res.data.data?.status}`,
        });
        setActiveActionModal(null);
        setReturnItemForm({ item_id: '', returned_quantity: 1, remarks: '' });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record item return.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Record Replacement Unit
  const handleRecordReplacement = async () => {
    if (!selectedChallan || !replacementItemForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select a line item.' });
      return;
    }
    if (Number(replacementItemForm.replacement_quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Replacement quantity must be greater than zero.' });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/replacement`, {
        item_id: replacementItemForm.item_id,
        replacement_quantity: Number(replacementItemForm.replacement_quantity),
        new_serial_number: replacementItemForm.new_serial_number.trim() || undefined,
        remarks: replacementItemForm.remarks.trim() || undefined,
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Replacement item received & inventoried. New serial logged.`,
        });
        setActiveActionModal(null);
        setReplacementItemForm({
          item_id: '',
          replacement_quantity: 1,
          new_serial_number: '',
          remarks: '',
        });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to record replacement unit.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Report Damaged Material (Strict Quarantine)
  const handleRecordDamage = async () => {
    if (!selectedChallan || !damageItemForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select a line item.' });
      return;
    }
    if (Number(damageItemForm.damaged_quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Damaged quantity must be greater than zero.' });
      return;
    }
    if (!damageItemForm.reason.trim()) {
      setFeedback({ type: 'error', message: 'Damage reason/inspection report is mandatory.' });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/damage`, {
        item_id: damageItemForm.item_id,
        damaged_quantity: Number(damageItemForm.damaged_quantity),
        reason: damageItemForm.reason.trim(),
      });
      if (res.data?.success) {
        setFeedback({
          type: 'info',
          message: `Material marked as damaged and moved to quarantine segregation! Usable inventory NOT increased.`,
        });
        setActiveActionModal(null);
        setDamageItemForm({ item_id: '', damaged_quantity: 1, reason: '' });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to report damaged goods.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Authorize Write-off
  const handleRecordWriteOff = async () => {
    if (!selectedChallan || !writeOffItemForm.item_id) {
      setFeedback({ type: 'error', message: 'Please select an item for write-off.' });
      return;
    }
    if (Number(writeOffItemForm.writeoff_quantity) <= 0) {
      setFeedback({ type: 'error', message: 'Write-off quantity must be greater than zero.' });
      return;
    }
    if (!writeOffItemForm.reason.trim()) {
      setFeedback({
        type: 'error',
        message: 'Formal write-off justification / managerial authorization reason is required.',
      });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/writeoff`, {
        item_id: writeOffItemForm.item_id,
        writeoff_quantity: Number(writeOffItemForm.writeoff_quantity),
        reason: writeOffItemForm.reason.trim(),
      });
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Managerial write-off authorized. Material balance written off. Status: ${res.data.data?.status}`,
        });
        setActiveActionModal(null);
        setWriteOffItemForm({ item_id: '', writeoff_quantity: 1, reason: '' });
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to authorize write-off.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Close Reconciled Challan
  const handleCloseChallan = async () => {
    if (!selectedChallan) return;
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/close`, {});
      if (res.data?.success) {
        setFeedback({
          type: 'success',
          message: `Challan ${selectedChallan.challan_number} closed and marked reconciled!`,
        });
        setActiveActionModal(null);
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to close challan.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Cancel Delivery Challan
  const handleCancelChallan = async () => {
    if (!selectedChallan) return;
    if (!cancellationReason.trim()) {
      setFeedback({ type: 'error', message: 'Cancellation reason is mandatory.' });
      return;
    }

    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/rdc/${selectedChallan.id}/cancel`, {
        reason: cancellationReason.trim(),
      });
      if (res.data?.success) {
        setFeedback({
          type: 'info',
          message: `Delivery Challan ${selectedChallan.challan_number} cancelled.`,
        });
        setActiveActionModal(null);
        setCancellationReason('');
        refreshCurrentChallan();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to cancel challan.',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Check if current challan has zero outstanding quantity across all items
  const isChallanFullyReconciled = useMemo(() => {
    if (!selectedChallan || !selectedChallan.items || selectedChallan.items.length === 0) {
      return false;
    }
    return selectedChallan.items.every((it) => {
      const accounted =
        Number(it.quantity_returned || 0) +
        Number(it.quantity_replacement || 0) +
        Number(it.quantity_damaged || 0) +
        Number(it.quantity_written_off || 0);
      return accounted >= Number(it.quantity_dispatched || 0);
    });
  }, [selectedChallan]);

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* 1. PAGE HEADER & QUICK ACTIONS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-black flex items-center justify-center font-black shadow-lg shadow-amber-400/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase text-zinc-100 flex items-center gap-2">
                RDC & NRDC Material Gate Passes
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700">
                  v2.4 Enterprise
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Authorized material movement, external repair tracking, gate security authorization
                & inventory reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMetrics();
              fetchChallans();
              fetchOverdue();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition"
            title="Refresh Table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>

          {/* Technicians, Store Managers, Managers & Admins can issue Delivery Challans */}
          {(isTechnician || isStoreManager) && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-400/20"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Issue Delivery Challan
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* FEEDBACK BANNER */}
      {/* ---------------------------------------------------------------------- */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-medium transition ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-red-950/80 border-red-500/50 text-red-200'
              : 'bg-blue-950/80 border-blue-500/50 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {feedback.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
            {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-zinc-200 text-xs font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 2. OPERATIONAL KPI METRICS CARDS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total RDC */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Returnable</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">{metrics.total_rdc}</span>
            <span className="text-[10px] text-zinc-500 font-bold">RDC Challans</span>
          </div>
        </div>

        {/* Total NRDC */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Non-Return</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">{metrics.total_nrdc}</span>
            <span className="text-[10px] text-zinc-500 font-bold">NRDC Challans</span>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden">
          {metrics.pending_approval > 0 && (
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-bl-full pointer-events-none" />
          )}
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Pending Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-300">{metrics.pending_approval}</span>
            <span className="text-[10px] text-amber-500 font-bold">Requires Action</span>
          </div>
        </div>

        {/* In Transit / Dispatched */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>In Transit</span>
            <Truck className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-purple-400">{metrics.dispatched}</span>
            <span className="text-[10px] text-zinc-500 font-bold">Active Passes</span>
          </div>
        </div>

        {/* Overdue Returns */}
        <div
          className={`border rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition ${
            metrics.overdue_returns > 0
              ? 'bg-red-950/40 border-red-700/60 hover:bg-red-950/60'
              : 'bg-zinc-900/90 border-zinc-800'
          }`}
          onClick={() => setActiveTab('overdue')}
        >
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span className={metrics.overdue_returns > 0 ? 'text-red-400 font-black' : ''}>
              Overdue
            </span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${metrics.overdue_returns > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-600'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-black ${metrics.overdue_returns > 0 ? 'text-red-400' : 'text-zinc-300'}`}
            >
              {metrics.overdue_returns}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold">Past Return Date</span>
          </div>
        </div>

        {/* Total Outstanding Balance Units */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase tracking-wider">
            <span>Outstanding</span>
            <Boxes className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-100">
              {metrics.total_outstanding_quantity}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold">Units Dispatched</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* 3. NAVIGATION TABS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('challans')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'challans'
              ? 'border-amber-400 text-amber-400 bg-zinc-900/40'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Delivery Challans
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-800 text-zinc-300">
            {totalCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('overdue')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition ${
            activeTab === 'overdue'
              ? 'border-red-500 text-red-400 bg-red-950/20'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Overdue Returns
          {metrics.overdue_returns > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-black animate-pulse">
              {metrics.overdue_returns}
            </span>
          )}
        </button>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: ALL DELIVERY CHALLANS TABLE VIEW */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'challans' && (
        <div className="space-y-4">
          {/* FILTER TOOLBAR */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search Challan #, Gate Pass #, Vendor, Purpose..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                'ALL',
                'DRAFT',
                'PENDING_APPROVAL',
                'APPROVED',
                'DISPATCHED',
                'PARTIALLY_RETURNED',
                'FULLY_RETURNED',
                'CLOSED',
                'REJECTED',
              ].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition ${
                    statusFilter === st
                      ? 'bg-amber-400 text-black shadow-md'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Type & Priority Dropdowns */}
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-amber-400 font-bold"
              >
                <option value="ALL">All Types</option>
                <option value="RDC">RDC (Returnable)</option>
                <option value="NRDC">NRDC (Non-Returnable)</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-amber-400 font-bold"
              >
                <option value="ALL">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-black tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Challan / Gate Pass</th>
                    <th className="py-3.5 px-4">Type & Priority</th>
                    <th className="py-3.5 px-4">Vendor / Destination</th>
                    <th className="py-3.5 px-4">Plant & Shop</th>
                    <th className="py-3.5 px-4">Purpose / Asset</th>
                    <th className="py-3.5 px-4 text-center">Items & Value</th>
                    <th className="py-3.5 px-4">Return Target</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                        Loading Delivery Challans...
                      </td>
                    </tr>
                  ) : rdcs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        No delivery challans found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    rdcs.map((rdc) => {
                      const st = getStatusBadge(rdc.status);
                      const isOverdue =
                        rdc.status === 'dispatched' &&
                        rdc.expected_return_date &&
                        new Date(rdc.expected_return_date) < new Date();

                      return (
                        <tr
                          key={rdc.id}
                          className="hover:bg-zinc-800/40 transition cursor-pointer"
                          onClick={() => openDrawer(rdc)}
                        >
                          {/* Challan & Gate Pass */}
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-amber-400 flex items-center gap-1.5">
                              {rdc.challan_number}
                            </div>
                            {rdc.gate_pass_number ? (
                              <div className="font-mono text-[10px] text-purple-400 font-semibold flex items-center gap-1 mt-0.5">
                                <Truck className="w-3 h-3" />
                                {rdc.gate_pass_number}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600 italic">No Gate Pass</span>
                            )}
                          </td>

                          {/* Type & Priority */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                  rdc.rdc_type === 'RDC'
                                    ? 'bg-amber-400 text-black'
                                    : 'bg-cyan-900/70 text-cyan-200 border border-cyan-700/50'
                                }`}
                              >
                                {rdc.rdc_type}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider ${getPriorityBadge(
                                  rdc.priority
                                )}`}
                              >
                                {rdc.priority}
                              </span>
                            </div>
                          </td>

                          {/* Vendor */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-zinc-200 truncate max-w-[180px]">
                              {rdc.vendor_party_name}
                            </div>
                            {rdc.contact_person && (
                              <div className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                                Attn: {rdc.contact_person}
                              </div>
                            )}
                          </td>

                          {/* Plant / Shop */}
                          <td className="py-3 px-4">
                            <div className="text-zinc-300 font-semibold">
                              {rdc.plant_name || 'Plant General'}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {rdc.shop_name || 'Main Bay'}
                            </div>
                          </td>

                          {/* Purpose / Asset */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="text-zinc-300 truncate" title={rdc.purpose}>
                              {rdc.purpose}
                            </div>
                            {rdc.machine_code && (
                              <div className="text-[10px] text-amber-500/80 font-mono">
                                Machine: {rdc.machine_code}
                              </div>
                            )}
                          </td>

                          {/* Items count & Approx Value */}
                          <td className="py-3 px-4 text-center">
                            <div className="font-bold text-zinc-200">
                              {rdc.items ? rdc.items.length : 1} Line(s)
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              ₹
                              {(Number(rdc.approximate_value) || 0).toLocaleString('en-IN', {
                                maximumFractionDigits: 0,
                              })}
                            </div>
                          </td>

                          {/* Return Target Date */}
                          <td className="py-3 px-4">
                            {rdc.rdc_type === 'RDC' && rdc.expected_return_date ? (
                              <div>
                                <div
                                  className={`font-mono text-xs ${isOverdue ? 'text-red-400 font-black' : 'text-zinc-300'}`}
                                >
                                  {new Date(rdc.expected_return_date).toLocaleDateString()}
                                </div>
                                {isOverdue && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-800 text-[9px] font-black uppercase">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600">N/A (Non-Return)</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${st.classes}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openDrawer(rdc)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                                title="Inspect Challan & Line Items"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Quick Submit for Draft */}
                              {(rdc.status === 'draft' || rdc.status === 'rejected') && (
                                <button
                                  onClick={() => {
                                    setSelectedChallan(rdc);
                                    setActiveActionModal('submit');
                                  }}
                                  className="px-2 py-1 rounded bg-amber-400/20 hover:bg-amber-400 text-amber-300 hover:text-black font-extrabold text-[10px] transition border border-amber-400/40"
                                  title="Submit for Approval"
                                >
                                  Submit
                                </button>
                              )}

                              {/* Quick Approve for Manager */}
                              {rdc.status === 'pending_approval' && isManager && (
                                <button
                                  disabled={rdc.created_by === user?.id}
                                  onClick={() => {
                                    setSelectedChallan(rdc);
                                    handleApprove();
                                  }}
                                  className={`px-2 py-1 rounded text-[10px] font-extrabold transition border ${
                                    rdc.created_by === user?.id
                                      ? 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                                      : 'bg-emerald-950/80 hover:bg-emerald-500 text-emerald-300 hover:text-black border-emerald-600/50'
                                  }`}
                                  title={
                                    rdc.created_by === user?.id
                                      ? 'Self-approval blocked'
                                      : 'Approve Challan'
                                  }
                                >
                                  Approve
                                </button>
                              )}

                              {/* Quick Dispatch for Store Manager */}
                              {rdc.status === 'approved' && isStoreManager && (
                                <button
                                  onClick={() => {
                                    setSelectedChallan(rdc);
                                    setActiveActionModal('dispatch');
                                  }}
                                  className="px-2 py-1 rounded bg-purple-950/80 hover:bg-purple-600 text-purple-300 hover:text-white text-[10px] font-extrabold transition border border-purple-600/50 flex items-center gap-1"
                                  title="Dispatch & Issue Gate Pass"
                                >
                                  <Truck className="w-3 h-3" />
                                  Dispatch
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

            {/* PAGINATION FOOTER */}
            <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-3 flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span>Showing</span>
                <span className="font-bold text-zinc-200">{rdcs.length}</span>
                <span>of</span>
                <span className="font-bold text-zinc-200">{totalCount}</span>
                <span>Challans</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-[11px]">
                  <span>Rows:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-300"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono text-[11px] font-bold text-zinc-200">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: OVERDUE RETURNS TRACKING VIEW */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'overdue' && (
        <div className="space-y-4">
          <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <h2 className="text-sm font-black text-red-200 uppercase tracking-wider">
                  Overdue Returnable Delivery Challans (RDC)
                </h2>
                <p className="text-xs text-red-300/80">
                  Material dispatched to external vendors past the committed return deadline.
                  Requires vendor follow-up or formal write-off.
                </p>
              </div>
            </div>
            <button
              onClick={fetchOverdue}
              className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverdue ? 'animate-spin' : ''}`} />
              Refresh Overdue
            </button>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-black tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Challan / Gate Pass</th>
                  <th className="py-3.5 px-4">Vendor & Contact</th>
                  <th className="py-3.5 px-4">Plant</th>
                  <th className="py-3.5 px-4">Committed Return</th>
                  <th className="py-3.5 px-4 text-center">Overdue Days</th>
                  <th className="py-3.5 px-4">Outstanding Material</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {loadingOverdue ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-400 mb-2" />
                      Loading Overdue Challans...
                    </td>
                  </tr>
                ) : overdueList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                      All returnable challans are on track! Zero overdue returns.
                    </td>
                  </tr>
                ) : (
                  overdueList.map((od) => (
                    <tr
                      key={od.id}
                      className="hover:bg-zinc-800/40 transition cursor-pointer"
                      onClick={() => openDrawer(od as any)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-amber-400">{od.challan_number}</div>
                        {od.gate_pass_number && (
                          <div className="font-mono text-[10px] text-purple-400 flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            {od.gate_pass_number}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-200">{od.vendor_party_name}</div>
                        {od.contact_phone && (
                          <div className="text-[10px] text-zinc-400">Tel: {od.contact_phone}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-300">
                        {od.plant_name || 'Plant General'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-zinc-300">
                        {new Date(od.expected_return_date).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded bg-red-950 text-red-300 border border-red-700 font-mono font-black text-xs inline-block animate-pulse">
                          +{od.days_overdue} Days
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {od.items.map((it) => (
                            <div key={it.id} className="text-[11px] text-zinc-300">
                              <span className="font-bold text-amber-400">
                                {it.outstanding_quantity} qty
                              </span>{' '}
                              — {it.item_description}
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDrawer(od as any)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase transition shadow-md shadow-red-600/20"
                        >
                          Inspect & Inward
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

      {/* ---------------------------------------------------------------------- */}
      {/* 4. CHALLAN DETAIL & GOVERNANCE DRAWER */}
      {/* ---------------------------------------------------------------------- */}
      {isDrawerOpen && selectedChallan && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* DRAWER HEADER */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      selectedChallan.rdc_type === 'RDC'
                        ? 'bg-amber-400 text-black'
                        : 'bg-cyan-900/70 text-cyan-200 border border-cyan-700/50'
                    }`}
                  >
                    {selectedChallan.rdc_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getPriorityBadge(
                      selectedChallan.priority
                    )}`}
                  >
                    {selectedChallan.priority}
                  </span>
                  <h2 className="text-xl font-mono font-black text-amber-400">
                    {selectedChallan.challan_number}
                  </h2>
                </div>
                {selectedChallan.gate_pass_number && (
                  <div className="mt-1 flex items-center gap-2 text-xs text-purple-400 font-mono font-semibold">
                    <Truck className="w-3.5 h-3.5" />
                    Security Gate Pass: {selectedChallan.gate_pass_number}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Status Badge */}
                {(() => {
                  const st = getStatusBadge(selectedChallan.status);
                  return (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${st.classes}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  );
                })()}

                <button
                  onClick={closeDrawer}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* DRAWER TABS */}
            <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-5">
              <button
                onClick={() => setDrawerTab('items')}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition ${
                  drawerTab === 'items'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Line Items & Materials ({selectedChallan.items?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab('history')}
                className={`py-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition ${
                  drawerTab === 'history'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Audit Trail & History
              </button>
            </div>

            {/* DRAWER CONTENT BODY */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* TAB 1: LINE ITEMS & OVERVIEW */}
              {drawerTab === 'items' && (
                <>
                  {/* METADATA GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800/80 text-xs">
                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Vendor Party
                      </span>
                      <span className="text-zinc-100 font-bold block mt-0.5">
                        {selectedChallan.vendor_party_name}
                      </span>
                      {selectedChallan.vendor_gstin && (
                        <span className="text-[10px] font-mono text-zinc-400 block">
                          GST: {selectedChallan.vendor_gstin}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Dispatch Purpose
                      </span>
                      <span className="text-zinc-200 block mt-0.5">
                        {selectedChallan.purpose}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Plant / Shop
                      </span>
                      <span className="text-zinc-200 font-semibold block mt-0.5">
                        {selectedChallan.plant_name || 'General'}
                        {selectedChallan.shop_name ? ` • ${selectedChallan.shop_name}` : ''}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Expected Return
                      </span>
                      <span className="text-zinc-200 font-mono font-bold block mt-0.5">
                        {selectedChallan.expected_return_date
                          ? new Date(selectedChallan.expected_return_date).toLocaleDateString()
                          : 'N/A (Non-Returnable)'}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Created By
                      </span>
                      <span className="text-zinc-200 font-semibold block mt-0.5">
                        {selectedChallan.created_by_name || selectedChallan.created_by_code || 'User'}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                        Document Ref
                      </span>
                      <span className="text-zinc-300 font-mono block mt-0.5">
                        {selectedChallan.document_reference || 'None specified'}
                      </span>
                    </div>

                    {selectedChallan.vehicle_number && (
                      <div>
                        <span className="text-zinc-500 font-semibold block text-[10px] uppercase">
                          Transport Vehicle
                        </span>
                        <span className="text-purple-300 font-mono font-bold block mt-0.5">
                          {selectedChallan.vehicle_number}{' '}
                          {selectedChallan.transporter_name
                            ? `(${selectedChallan.transporter_name})`
                            : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* SPECIAL REASON BANNERS */}
                  {selectedChallan.rejection_reason && (
                    <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200">
                      <span className="font-black uppercase text-[10px] block text-red-400">
                        Manager Rejection Reason:
                      </span>
                      {selectedChallan.rejection_reason}
                    </div>
                  )}

                  {selectedChallan.cancellation_reason && (
                    <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-300">
                      <span className="font-black uppercase text-[10px] block text-zinc-400">
                        Cancellation Justification:
                      </span>
                      {selectedChallan.cancellation_reason}
                    </div>
                  )}

                  {/* LINE ITEMS BREAKDOWN */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                      <span>Line Items & Inventory Traceability</span>
                      <span className="font-mono text-amber-400">
                        Total Value: ₹
                        {(Number(selectedChallan.approximate_value) || 0).toLocaleString('en-IN')}
                      </span>
                    </h3>

                    <div className="space-y-3">
                      {selectedChallan.items?.map((item, idx) => {
                        const dispatched = Number(item.quantity_dispatched) || 0;
                        const returned = Number(item.quantity_returned) || 0;
                        const replacement = Number(item.quantity_replacement) || 0;
                        const damaged = Number(item.quantity_damaged) || 0;
                        const writtenOff = Number(item.quantity_written_off) || 0;
                        const accounted = returned + replacement + damaged + writtenOff;
                        const outstanding = Math.max(0, dispatched - accounted);
                        const progressPct = dispatched > 0 ? Math.min(100, Math.round((accounted / dispatched) * 100)) : 100;

                        return (
                          <div
                            key={item.id || idx}
                            className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-black text-sm text-zinc-100 block">
                                  #{idx + 1}. {item.item_description}
                                </span>
                                {item.serial_number && (
                                  <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                                    Serial / Asset Tag: {item.serial_number}
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-mono font-bold text-amber-400 block">
                                  {dispatched} Dispatched
                                </span>
                                {item.unit_cost && (
                                  <span className="text-[10px] font-mono text-zinc-500 block">
                                    @ ₹{Number(item.unit_cost).toLocaleString('en-IN')}/unit
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* QUANTITY PILLS */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                  Usable Return
                                </span>
                                <span className="font-mono font-bold text-emerald-400 text-sm">
                                  {returned}
                                </span>
                              </div>

                              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                  Replacement
                                </span>
                                <span className="font-mono font-bold text-cyan-400 text-sm">
                                  {replacement}
                                </span>
                              </div>

                              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                  Quarantine / Damaged
                                </span>
                                <span className="font-mono font-bold text-red-400 text-sm">
                                  {damaged}
                                </span>
                              </div>

                              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                                <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                  Written Off
                                </span>
                                <span className="font-mono font-bold text-zinc-400 text-sm">
                                  {writtenOff}
                                </span>
                              </div>

                              <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 col-span-2 sm:col-span-1">
                                <span className="text-[9px] uppercase font-bold text-amber-500 block">
                                  Outstanding
                                </span>
                                <span
                                  className={`font-mono font-black text-sm ${
                                    outstanding > 0 ? 'text-amber-400' : 'text-zinc-600'
                                  }`}
                                >
                                  {outstanding}
                                </span>
                              </div>
                            </div>

                            {/* RECONCILIATION PROGRESS BAR */}
                            <div>
                              <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold mb-1">
                                <span>Reconciliation Progress</span>
                                <span>{progressPct}% Accounted</span>
                              </div>
                              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    progressPct === 100
                                      ? 'bg-emerald-500'
                                      : progressPct > 0
                                      ? 'bg-amber-400'
                                      : 'bg-zinc-700'
                                  }`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: AUDIT TRAIL TIMELINE */}
              {drawerTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Regulatory Audit Log & Event Timeline
                  </h3>

                  {loadingHistory ? (
                    <div className="py-8 text-center text-zinc-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                      Loading audit timeline...
                    </div>
                  ) : challanHistory.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-xs">
                      No historical events recorded for this delivery challan.
                    </div>
                  ) : (
                    <div className="relative border-l border-zinc-800 ml-3 space-y-6">
                      {challanHistory.map((log) => (
                        <div key={log.id} className="relative pl-6">
                          <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-zinc-950" />
                          <div className="bg-zinc-900 border border-zinc-800/80 rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-amber-400 text-[11px] uppercase">
                                {log.action.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>

                            <div className="text-zinc-300 font-medium">
                              By: <span className="text-zinc-100 font-bold">{log.actor_name || log.performed_by}</span>
                            </div>

                            {log.new_state && (
                              <pre className="bg-zinc-950 p-2 rounded text-[10px] font-mono text-zinc-400 overflow-x-auto border border-zinc-800/50">
                                {JSON.stringify(log.new_state, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DRAWER ACTION TOOLBAR */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Cancel (Draft, Pending Approval, or Approved) */}
                {['draft', 'pending_approval', 'approved', 'rejected'].includes(
                  selectedChallan.status
                ) && (
                  <button
                    onClick={() => setActiveActionModal('cancel')}
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-red-950/40 hover:text-red-300 text-zinc-400 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel Challan
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* 1. Submit for Approval (Draft or Rejected) */}
                {(selectedChallan.status === 'draft' || selectedChallan.status === 'rejected') && (
                  <button
                    onClick={() => setActiveActionModal('submit')}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-400/20 flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    Submit for Approval
                  </button>
                )}

                {/* 2. Approve & Reject (Pending Approval, Manager/Admin only) */}
                {selectedChallan.status === 'pending_approval' && isManager && (
                  <>
                    <button
                      onClick={() => setActiveActionModal('reject')}
                      className="px-3 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 font-bold text-xs uppercase transition flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>

                    <button
                      disabled={selectedChallan.created_by === user?.id || actionSubmitting}
                      onClick={handleApprove}
                      className={`px-4 py-2 rounded-lg font-extrabold text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg ${
                        selectedChallan.created_by === user?.id
                          ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      }`}
                      title={
                        selectedChallan.created_by === user?.id
                          ? 'Self-Approval Prohibited by Governance Rules'
                          : 'Approve Material Dispatch'
                      }
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {actionSubmitting ? 'Approving...' : 'Approve Challan'}
                    </button>
                  </>
                )}

                {/* 3. Dispatch & Issue Gate Pass (Approved status, Store Manager/Manager) */}
                {selectedChallan.status === 'approved' && isStoreManager && (
                  <button
                    onClick={() => setActiveActionModal('dispatch')}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-purple-600/20 flex items-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    Dispatch & Issue Gate Pass
                  </button>
                )}

                {/* 4. Inward Actions for Dispatched or Partially Returned Challans */}
                {['dispatched', 'partially_returned'].includes(selectedChallan.status) &&
                  isStoreManager && (
                    <>
                      {/* Record Return */}
                      <button
                        onClick={() => {
                          const first = selectedChallan.items?.[0];
                          if (first) {
                            setReturnItemForm({
                              item_id: first.id,
                              returned_quantity: Math.max(
                                1,
                                Number(first.quantity_dispatched) -
                                  (Number(first.quantity_returned) +
                                    Number(first.quantity_replacement) +
                                    Number(first.quantity_damaged) +
                                    Number(first.quantity_written_off))
                              ),
                              remarks: '',
                            });
                          }
                          setActiveActionModal('return');
                        }}
                        className="px-3 py-2 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-200 font-extrabold text-xs uppercase transition flex items-center gap-1"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        Inward Return
                      </button>

                      {/* Receive Replacement */}
                      <button
                        onClick={() => {
                          const first = selectedChallan.items?.[0];
                          if (first) {
                            setReplacementItemForm({
                              item_id: first.id,
                              replacement_quantity: 1,
                              new_serial_number: '',
                              remarks: '',
                            });
                          }
                          setActiveActionModal('replacement');
                        }}
                        className="px-3 py-2 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-600/60 text-cyan-200 font-extrabold text-xs uppercase transition flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Replacement
                      </button>

                      {/* Report Damaged */}
                      <button
                        onClick={() => {
                          const first = selectedChallan.items?.[0];
                          if (first) {
                            setDamageItemForm({
                              item_id: first.id,
                              damaged_quantity: 1,
                              reason: '',
                            });
                          }
                          setActiveActionModal('damage');
                        }}
                        className="px-3 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 font-extrabold text-xs uppercase transition flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Report Damaged
                      </button>

                      {/* Write-off (Manager Only) */}
                      {isManager && (
                        <button
                          onClick={() => {
                            const first = selectedChallan.items?.[0];
                            if (first) {
                              setWriteOffItemForm({
                                item_id: first.id,
                                writeoff_quantity: 1,
                                reason: '',
                              });
                            }
                            setActiveActionModal('writeoff');
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs uppercase transition"
                        >
                          Write-Off
                        </button>
                      )}
                    </>
                  )}

                {/* 5. Close Challan (When Fully Returned or all items fully accounted) */}
                {(selectedChallan.status === 'fully_returned' ||
                  (isChallanFullyReconciled &&
                    ['dispatched', 'partially_returned'].includes(selectedChallan.status))) &&
                  isStoreManager && (
                    <button
                      onClick={() => setActiveActionModal('close')}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Close Reconciled Challan
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. CREATE DELIVERY CHALLAN MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            {/* MODAL HEADER */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/90 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Issue Delivery Challan
                </h2>
                <p className="text-xs text-zinc-400">
                  Generate authorized material movement gate pass with real-time stock allocation
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM BODY */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* CHALLAN TYPE & PRIORITY */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Challan Type <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, rdc_type: 'RDC' }))}
                      className={`py-2 text-xs font-black uppercase rounded-lg border transition ${
                        createForm.rdc_type === 'RDC'
                          ? 'bg-amber-400 text-black border-amber-400 shadow-md shadow-amber-400/20'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850'
                      }`}
                    >
                      Returnable (RDC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm((f) => ({ ...f, rdc_type: 'NRDC' }))}
                      className={`py-2 text-xs font-black uppercase rounded-lg border transition ${
                        createForm.rdc_type === 'NRDC'
                          ? 'bg-cyan-500 text-black border-cyan-500 shadow-md shadow-cyan-500/20'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-850'
                      }`}
                    >
                      Non-Return (NRDC)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Priority <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, priority: e.target.value as RdcPriority }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent / Critical Breakdown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Associated Machine (Optional)
                  </label>
                  <select
                    value={createForm.machine_id}
                    onChange={(e) => setCreateForm((f) => ({ ...f, machine_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">No machine attached</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* VENDOR DETAILS */}
              <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Building className="w-4 h-4" />
                  Vendor / Destination Party Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Vendor / Party Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SKF Bearings & Overhauling Services Ltd."
                      value={createForm.vendor_party_name}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, vendor_party_name: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Vendor GSTIN
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 27AABCU9603R1ZM"
                      value={createForm.vendor_gstin}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, vendor_gstin: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Sharma"
                      value={createForm.contact_person}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, contact_person: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +91 9876543210"
                      value={createForm.contact_phone}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, contact_phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. service@vendor.com"
                      value={createForm.contact_email}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, contact_email: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Vendor Address / Destination Facility
                  </label>
                  <input
                    type="text"
                    placeholder="Plot 45, MIDC Industrial Area, Chakan, Pune - 410501"
                    value={createForm.vendor_address}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, vendor_address: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* DISPATCH PURPOSE & DEADLINES */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Dispatch Purpose & Technical Scope <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. External Spindle Re-Balancing & Grinding under warranty"
                    value={createForm.purpose}
                    onChange={(e) => setCreateForm((f) => ({ ...f, purpose: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {createForm.rdc_type === 'RDC' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Expected Return Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={createForm.expected_return_date}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, expected_return_date: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* DOCUMENT REFERENCE */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Supporting Document Reference (e.g. PO #, Service Order #, Waybill)
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-2026-00451 / WO-9821"
                  value={createForm.document_reference}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, document_reference: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              {/* MULTI-ITEM ROW BUILDER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    Challan Line Items ({createForm.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-zinc-700 text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Another Item
                  </button>
                </div>

                <div className="space-y-3">
                  {createForm.items.map((row, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-amber-400">
                          Item #{idx + 1}
                        </span>
                        {createForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-zinc-500 hover:text-red-400 p-1 transition"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Item Description <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. CNC Spindle Unit Assembly"
                            value={row.item_description}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'item_description', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Inventory Part Lookup
                          </label>
                          <select
                            value={row.part_id}
                            onChange={(e) => handleItemFieldChange(idx, 'part_id', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                          >
                            <option value="">Non-Inventory Item</option>
                            {inventoryParts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.part_name || p.part_number} (Avail: {p.quantity_on_hand || 0})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Serial / Tag Number
                          </label>
                          <input
                            type="text"
                            placeholder="SN-981248-A"
                            value={row.serial_number}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'serial_number', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Dispatched Quantity <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={row.quantity_dispatched}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'quantity_dispatched', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Unit Cost (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.unit_cost}
                            onChange={(e) =>
                              handleItemFieldChange(idx, 'unit_cost', e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                            Line Total Estimate
                          </label>
                          <div className="px-3 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs text-amber-400 font-mono font-bold">
                            ₹
                            {(
                              (Number(row.quantity_dispatched) || 0) * (Number(row.unit_cost) || 0)
                            ).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUMMARY & SUBMISSION CONTROLS */}
              <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="saveAsDraft"
                    checked={createForm.save_as_draft}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, save_as_draft: e.target.checked }))
                    }
                    className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-amber-400 focus:ring-amber-400"
                  />
                  <label htmlFor="saveAsDraft" className="text-xs text-zinc-300 font-semibold cursor-pointer">
                    Save as editable draft (do not submit for approval yet)
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                      Total Approximate Value
                    </span>
                    <span className="text-base font-mono font-black text-amber-400">
                      ₹{calculatedTotalApproxValue.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-400/20"
                  >
                    {createSubmitting
                      ? 'Creating...'
                      : createForm.save_as_draft
                      ? 'Save as Draft'
                      : 'Submit Challan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. MODALS FOR LIFECYCLE ACTIONS */}
      {/* ---------------------------------------------------------------------- */}

      {/* MODAL: SUBMIT DRAFT */}
      {activeActionModal === 'submit' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-amber-400 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Submit Delivery Challan for Approval
            </h3>
            <p className="text-xs text-zinc-400">
              Challan <span className="font-mono text-zinc-200">{selectedChallan.challan_number}</span> will transition to pending_approval for manager review.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Submission Notes / Remarks (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Critical breakdown part for Line 1; expedited quote approved."
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleSubmitDraft}
                className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REJECT CHALLAN */}
      {activeActionModal === 'reject' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-red-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-red-400 flex items-center gap-2">
              <X className="w-4 h-4" />
              Reject Delivery Challan
            </h3>
            <p className="text-xs text-zinc-400">
              Please provide the mandatory rejection reason. The creator will be notified and can revise the challan.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Vendor not authorized for electrical overhaul; please re-route to Plant B vendor."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleReject}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISPATCH & GATE PASS */}
      {activeActionModal === 'dispatch' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-purple-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-purple-400 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Authorize Dispatch & Generate Gate Pass
            </h3>
            <p className="text-xs text-zinc-400">
              Issuing Gate Pass will record inventory movement, decrement available stock, and authorize physical security exit.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Vehicle / Transport Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MH 12 AB 1234"
                  value={dispatchData.vehicle_number}
                  onChange={(e) =>
                    setDispatchData((d) => ({ ...d, vehicle_number: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Transporter / Logistics Carrier Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRL Logistics / Blue Dart"
                  value={dispatchData.transporter_name}
                  onChange={(e) =>
                    setDispatchData((d) => ({ ...d, transporter_name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleDispatch}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Generating...' : 'Authorize Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INWARD RETURN */}
      {activeActionModal === 'return' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-emerald-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-emerald-400 flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4" />
              Inward Returned Goods (Usable Stock)
            </h3>
            <p className="text-xs text-zinc-400">
              Material will be returned to usable stock and stock ledger incremented.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Select Line Item <span className="text-red-400">*</span>
                </label>
                <select
                  value={returnItemForm.item_id}
                  onChange={(e) =>
                    setReturnItemForm((f) => ({ ...f, item_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {selectedChallan.items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_description} (Dispatched: {it.quantity_dispatched}, Returned: {it.quantity_returned})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Returned Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={returnItemForm.returned_quantity}
                  onChange={(e) =>
                    setReturnItemForm((f) => ({
                      ...f,
                      returned_quantity: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Remarks / Inward Inspection Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Visual check OK; tested on test bench."
                  value={returnItemForm.remarks}
                  onChange={(e) =>
                    setReturnItemForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleRecordReturn}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Inwarding...' : 'Confirm Inward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE REPLACEMENT */}
      {activeActionModal === 'replacement' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-cyan-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-cyan-400 flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Receive Replacement Material
            </h3>
            <p className="text-xs text-zinc-400">
              Record receipt of new replacement unit from vendor. Serial number will be updated in inventory ledger.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Select Line Item <span className="text-red-400">*</span>
                </label>
                <select
                  value={replacementItemForm.item_id}
                  onChange={(e) =>
                    setReplacementItemForm((f) => ({ ...f, item_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                >
                  {selectedChallan.items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_description} (Dispatched: {it.quantity_dispatched})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Replacement Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={replacementItemForm.replacement_quantity}
                  onChange={(e) =>
                    setReplacementItemForm((f) => ({
                      ...f,
                      replacement_quantity: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  New Serial / Tag Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-2026-REPL-01"
                  value={replacementItemForm.new_serial_number}
                  onChange={(e) =>
                    setReplacementItemForm((f) => ({
                      ...f,
                      new_serial_number: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleRecordReplacement}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Recording...' : 'Accept Replacement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REPORT DAMAGED */}
      {activeActionModal === 'damage' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-red-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Report Damaged / Defective Material (Quarantine)
            </h3>
            <p className="text-xs text-zinc-400">
              Damaged goods are segregated into physical quarantine. Usable warehouse stock will NOT be increased until disposition.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Select Line Item <span className="text-red-400">*</span>
                </label>
                <select
                  value={damageItemForm.item_id}
                  onChange={(e) =>
                    setDamageItemForm((f) => ({ ...f, item_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                >
                  {selectedChallan.items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_description} (Dispatched: {it.quantity_dispatched})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Damaged Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={damageItemForm.damaged_quantity}
                  onChange={(e) =>
                    setDamageItemForm((f) => ({
                      ...f,
                      damaged_quantity: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Damage Description / Quarantine Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Spindle bearing scored and housing cracked in transit."
                  value={damageItemForm.reason}
                  onChange={(e) =>
                    setDamageItemForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleRecordDamage}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Quarantining...' : 'Confirm Quarantine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUTHORIZE WRITE-OFF */}
      {activeActionModal === 'writeoff' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-700 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-zinc-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Authorize Managerial Material Write-Off
            </h3>
            <p className="text-xs text-zinc-400">
              Only authorized managers can write off unrecoverable or destroyed material balances. Regulatory scrap entry will be recorded.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Select Line Item <span className="text-red-400">*</span>
                </label>
                <select
                  value={writeOffItemForm.item_id}
                  onChange={(e) =>
                    setWriteOffItemForm((f) => ({ ...f, item_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  {selectedChallan.items?.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.item_description} (Dispatched: {it.quantity_dispatched})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Write-off Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={writeOffItemForm.writeoff_quantity}
                  onChange={(e) =>
                    setWriteOffItemForm((f) => ({
                      ...f,
                      writeoff_quantity: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                  Managerial Justification / Write-off Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Total loss in vendor facility fire; insurance claim filed under Ref #9910."
                  value={writeOffItemForm.reason}
                  onChange={(e) =>
                    setWriteOffItemForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleRecordWriteOff}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Authorizing...' : 'Authorize Write-Off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE CHALLAN */}
      {activeActionModal === 'close' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-emerald-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Close Delivery Challan
            </h3>
            <p className="text-xs text-zinc-300">
              All materials for challan <span className="font-mono text-amber-400">{selectedChallan.challan_number}</span> are fully accounted for. Closing will mark this transaction formally completed and archived.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleCloseChallan}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Closing...' : 'Confirm Closure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL CHALLAN */}
      {activeActionModal === 'cancel' && selectedChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-red-900/60 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase text-red-400 flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Cancel Delivery Challan
            </h3>
            <p className="text-xs text-zinc-400">
              Challan <span className="font-mono text-zinc-200">{selectedChallan.challan_number}</span> has not been physically dispatched. Cancelling will release any draft reservations.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                Cancellation Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Work order cancelled; vendor quote rejected."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setActiveActionModal(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-300 text-xs font-bold"
              >
                Back
              </button>
              <button
                disabled={actionSubmitting}
                onClick={handleCancelChallan}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider"
              >
                {actionSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RDCPage;
