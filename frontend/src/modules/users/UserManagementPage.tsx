
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  UserPlus,
  Search,
  Shield,
  Wrench,
  HardHat,
  Briefcase,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Phone,
  Mail,
  Clock,
  Boxes,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  Check,
  Loader2,
  Cpu,
  Repeat,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canCreate = isAdmin || isManager;

  // Tabs: 'personnel' | 'pending'
  const [activeTab, setActiveTab] = useState<'personnel' | 'pending'>(
    location.search.includes('tab=pending') ? 'pending' : 'personnel'
  );

  // Sub-tabs under Pending Approvals: 'operators' | 'temporary'
  const [pendingSubTab, setPendingSubTab] = useState<'operators' | 'temporary'>(
    location.search.includes('sub=temp') ? 'temporary' : 'operators'
  );

  // Pending Operator Approvals state
  const [pendingOperators, setPendingOperators] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  // Pending Temporary Machine Requests state
  const [pendingTempRequests, setPendingTempRequests] = useState<any[]>([]);
  const [loadingPendingTemp, setLoadingPendingTemp] = useState(false);

  // Rejection modal state for Operators
  const [rejectingUser, setRejectingUser] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Rejection modal state for Temporary Machine Requests
  const [rejectingTempRequest, setRejectingTempRequest] = useState<any | null>(null);
  const [tempRejectionReason, setTempRejectionReason] = useState('');

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  const [plants, setPlants] = useState<any[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState('all');

  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Form fields supported by the backend.
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
    plant_id: '',
    shop_id: '',
    shift: 'Shift A',
    password: '',
    is_active: true,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);

      let page = 1;
      let totalPages = 1;
      const allUsers: any[] = [];

      do {
        const params: Record<string, string | number> = {
          page,
          limit: 100,
        };

        if (isAdmin && selectedPlantId !== 'all') {
          params.plant_id = selectedPlantId;
        }

        const res = await apiClient.get('/auth/users', { params });

        if (!res.data.success) {
          throw new Error('Failed to fetch personnel.');
        }

        const pageUsers = Array.isArray(res.data.data)
          ? res.data.data
          : [];

        allUsers.push(...pageUsers);

        totalPages = Math.max(
          1,
          Number(res.data.pagination?.totalPages) || 1
        );

        page += 1;
      } while (page <= totalPages);

      let fetchedUsers = allUsers;

      if (isAdmin && selectedPlantId !== 'all') {
        fetchedUsers = fetchedUsers.filter(
          (u: any) => u.plant_id === selectedPlantId
        );
      }

      setUsersList(fetchedUsers);
    } catch (e) {
      console.error('Failed to load users:', e);
      setUsersList([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlants = async () => {
    try {
      const res = await apiClient.get('/org/plants');

      if (res.data.success && Array.isArray(res.data.data)) {
        setPlants(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load plants:', e);
    }
  };

  const fetchShopsForPlant = async (plantId: string) => {
    if (!plantId) {
      setShops([]);
      return;
    }

    try {
      setLoadingShops(true);

      const res = await apiClient.get(
        `/org/plants/${plantId}/shops`
      );

      if (res.data.success && Array.isArray(res.data.data)) {
        setShops(res.data.data);
      } else {
        setShops([]);
      }
    } catch (e) {
      console.error('Failed to load shops:', e);
      setShops([]);
    } finally {
      setLoadingShops(false);
    }
  };

  const fetchPendingOperators = async (plantIdToFilter?: string) => {
    try {
      setLoadingPending(true);
      const targetPlant =
        plantIdToFilter !== undefined
          ? plantIdToFilter
          : isAdmin && selectedPlantId && selectedPlantId !== 'all'
          ? selectedPlantId
          : '';
      const url = targetPlant ? `/auth/pending-operators?plant_id=${targetPlant}` : '/auth/pending-operators';
      const res = await apiClient.get(url);
      if (res.data.success && Array.isArray(res.data.data)) {
        setPendingOperators(res.data.data);
      } else {
        setPendingOperators([]);
      }
    } catch (e) {
      console.warn('Failed to load pending operators:', e);
      setPendingOperators([]);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApproveOperator = async (op: any) => {
    if (
      !window.confirm(
        `Approve operator ${op.full_name} (${op.employee_code})? This will activate their account and assign ${op.requested_machine_code ? `machine ${op.requested_machine_code}` : 'the selected machine'} as their permanent default machine.`
      )
    ) {
      return;
    }

    try {
      setPendingActionId(op.id);
      const res = await apiClient.post(`/auth/operators/${op.id}/approve`);
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Operator ${op.full_name} (${op.employee_code}) approved successfully. Permanent machine configured: ${op.requested_machine_code || 'None'}.`,
        });
        fetchPendingOperators();
        fetchUsers();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve operator.',
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingUser) return;
    try {
      setPendingActionId(rejectingUser.id);
      const res = await apiClient.post(`/auth/operators/${rejectingUser.id}/reject`, {
        rejection_reason: rejectionReason.trim() || undefined,
      });
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Registration for ${rejectingUser.full_name} (${rejectingUser.employee_code}) rejected.`,
        });
        setRejectingUser(null);
        setRejectionReason('');
        fetchPendingOperators();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reject operator.',
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const fetchPendingTempRequests = async (plantIdToFilter?: string) => {
    try {
      setLoadingPendingTemp(true);
      const targetPlant =
        plantIdToFilter !== undefined
          ? plantIdToFilter
          : isAdmin && selectedPlantId && selectedPlantId !== 'all'
          ? selectedPlantId
          : isManager
          ? user?.plantId || (user as any)?.plant_id || ''
          : '';
      const params: any = {};
      if (targetPlant) params.plant_id = targetPlant;
      const res = await apiClient.get('/machines/operator/requests/pending', { params });
      if (res.data.success && Array.isArray(res.data.data)) {
        const list = res.data.data.filter(
          (r: any) => r.assignment_type === 'temporary' || Boolean(r.replacement_for_machine_code)
        );
        setPendingTempRequests(list);
      } else {
        setPendingTempRequests([]);
      }
    } catch (e) {
      console.warn('Failed to load pending temporary requests:', e);
      setPendingTempRequests([]);
    } finally {
      setLoadingPendingTemp(false);
    }
  };

  const handleApproveTempRequest = async (req: any) => {
    if (
      !window.confirm(
        `Approve temporary replacement machine ${req.machine_code || 'selected'} for operator ${
          req.operator_name || req.operator_code || 'Operator'
        }?`
      )
    ) {
      return;
    }

    try {
      setPendingActionId(req.id);
      const res = await apiClient.post(`/machines/operator/requests/${req.id}/approve`);
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Temporary machine ${req.machine_code || 'assignment'} approved for ${
            req.operator_name || 'Operator'
          }.`,
        });
        fetchPendingTempRequests();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to approve temporary machine request.',
      });
    } finally {
      setPendingActionId(null);
    }
  };

  const handleConfirmRejectTempRequest = async () => {
    if (!rejectingTempRequest) return;
    try {
      setPendingActionId(rejectingTempRequest.id);
      const res = await apiClient.post(
        `/machines/operator/requests/${rejectingTempRequest.id}/reject`,
        {
          rejection_reason:
            tempRejectionReason.trim() ||
            'Temporary assignment not approved for current shift requirements.',
        }
      );
      if (res.data.success) {
        setFeedback({
          type: 'success',
          text: `Temporary machine request for ${
            rejectingTempRequest.operator_name || 'Operator'
          } rejected.`,
        });
        setRejectingTempRequest(null);
        setTempRejectionReason('');
        fetchPendingTempRequests();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to reject temporary machine request.',
      });
    } finally {
      setPendingActionId(null);
    }
  };

  useEffect(() => {
    fetchPlants();
    if (isAdmin || isManager) {
      fetchPendingOperators();
      fetchPendingTempRequests();
    }
  }, [isAdmin, isManager]);

  useEffect(() => {
    fetchUsers();
    if (activeTab === 'pending' && (isAdmin || isManager)) {
      fetchPendingOperators();
      fetchPendingTempRequests();
    }
  }, [selectedPlantId, activeTab]);

  useEffect(() => {
    if (location.search.includes('tab=pending')) {
      setActiveTab('pending');
      fetchPendingOperators();
      fetchPendingTempRequests();
    }
    if (location.search.includes('sub=temp')) {
      setPendingSubTab('temporary');
    }
  }, [location.search]);

  // Real-time socket notification handler: auto-refresh pending list when an operator signs up or requests a machine
  useEffect(() => {
    if (!socket || (!isAdmin && !isManager)) return;
    const handleNotification = (notif: any) => {
      if (
        notif?.entity_type === 'user_approval' ||
        notif?.type === 'approval' ||
        (typeof notif?.message === 'string' && notif.message.toLowerCase().includes('operator'))
      ) {
        fetchPendingOperators();
      }
    };

    const handleTempUpdate = () => {
      fetchPendingTempRequests();
    };

    socket.on('notification:new', handleNotification);
    socket.on('notification', handleNotification);
    socket.on('operator:machine_requested', handleTempUpdate);
    socket.on('operator:machine_approved', handleTempUpdate);
    socket.on('operator:machine_rejected', handleTempUpdate);
    socket.on('operator:machine_released', handleTempUpdate);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('notification', handleNotification);
      socket.off('operator:machine_requested', handleTempUpdate);
      socket.off('operator:machine_approved', handleTempUpdate);
      socket.off('operator:machine_rejected', handleTempUpdate);
      socket.off('operator:machine_released', handleTempUpdate);
    };
  }, [socket, isAdmin, isManager, selectedPlantId]);

  const openCreateModal = (presetRole: string = 'technician') => {
    setEditingUser(null);

    // Managers can create technicians, operators, and store managers.
    let safeRole = presetRole;

    if (
      isManager &&
      safeRole !== 'technician' &&
      safeRole !== 'operator' &&
      safeRole !== 'store_manager'
    ) {
      safeRole = 'technician';
    }

    const prefixes: Record<string, string> = {
      technician: 'TCH',
      operator: 'OPR',
      manager: 'MGR',
      store_manager: 'STR',
      admin: 'ADM',
    };

    const prefix = prefixes[safeRole] || 'EMP';

    const managerPlantId =
      user?.plantId || (user as any)?.plant_id || '';

    const initialPlantId = isManager
      ? managerPlantId
      : '';

    setFormData({
      employee_code: `JCB-${prefix}-${Math.floor(
        100 + Math.random() * 900
      )}`,
      full_name: '',
      email: '',
      phone: '',
      role: safeRole,
      plant_id: initialPlantId,
      shop_id: '',
      shift: 'Shift A',
      password: '',
      is_active: true,
    });

    if (initialPlantId) {
      fetchShopsForPlant(initialPlantId);
    } else {
      setShops([]);
    }

    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);

    setFormData({
      employee_code: u.employee_code || '',
      full_name: u.full_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role,
      plant_id: u.plant_id || '',
      shop_id: u.shop_id || '',
      shift: u.shift || 'Shift A',
      password: '',
      is_active: u.is_active !== false,
    });

    if (u.plant_id) {
      fetchShopsForPlant(u.plant_id);
    } else {
      setShops([]);
    }

    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFeedback(null);

    if (
      !editingUser &&
      isAdmin &&
      formData.role === 'manager' &&
      !formData.plant_id
    ) {
      setFeedback({
        type: 'error',
        text: 'Please assign a plant to the Manager.',
      });
      return;
    }

    if (!editingUser) {
      if (
        formData.password.length < 12 ||
        formData.password.length > 128
      ) {
        setFeedback({
          type: 'error',
          text: 'Password must contain between 12 and 128 characters.',
        });
        return;
      }
    }

    if (!editingUser && !formData.plant_id && isManager) {
      setFeedback({
        type: 'error',
        text: 'Your Manager account must have an assigned plant.',
      });
      return;
    }

    setActionLoading(true);

    try {
      const payload: any = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || null,
        role: formData.role,
        shift: formData.shift || 'Shift A',
        plant_id: formData.plant_id || null,
        shop_id: formData.shop_id || null,
      };

      if (editingUser) {
        const res = await apiClient.put(
          `/auth/users/${editingUser.id}`,
          {
            ...payload,
            is_active: formData.is_active,
          }
        );

        if (res.data.success) {
          setFeedback({
            type: 'success',
            text: `Personnel ${formData.full_name} updated successfully.`,
          });

          setTimeout(() => {
            setIsModalOpen(false);
            fetchUsers();
          }, 800);
        }
      } else {
        const createPayload = {
          ...payload,
          employee_code: formData.employee_code.trim(),
          email: formData.email.trim(),
          password: formData.password,
        };

        const res = await apiClient.post(
          '/auth/users',
          createPayload
        );

        if (res.data.success) {
          setFeedback({
            type: 'success',
            text: `Personnel ${formData.full_name} (${formData.employee_code}) enrolled successfully.`,
          });

          setTimeout(() => {
            setIsModalOpen(false);
            fetchUsers();
          }, 800);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.message ||
          'Action failed. Please check inputs.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (
    id: string,
    name: string
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to deactivate ${name}? They will no longer be able to log in.`
      )
    ) {
      return;
    }

    try {
      const res = await apiClient.delete(`/auth/users/${id}`);

      if (res.data.success) {
        alert(res.data.message || `${name} deactivated.`);
        fetchUsers();
      }
    } catch (err: any) {
      alert(
        err.response?.data?.message ||
        'Failed to update user status.'
      );
    }
  };

  // Visibility restriction: Managers can only view and manage technician, operator, and store_manager
  const visibleUsers = isManager
    ? usersList.filter((u) => u.role !== 'manager' && u.role !== 'admin')
    : usersList;

  const filtered = visibleUsers.filter((u) => {
    const searchTerm = search.toLowerCase();

    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchTerm) ||
      u.employee_code?.toLowerCase().includes(searchTerm) ||
      u.email?.toLowerCase().includes(searchTerm) ||
      u.department?.toLowerCase().includes(searchTerm);

    const matchesRole =
      selectedRole === 'all' || u.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  const techCount = visibleUsers.filter(
    (u) => u.role === 'technician'
  ).length;

  const oprCount = visibleUsers.filter(
    (u) => u.role === 'operator'
  ).length;

  const mgrCount = usersList.filter(
    (u) => u.role === 'manager'
  ).length;

  const storeMgrCount = visibleUsers.filter(
    (u) => u.role === 'store_manager'
  ).length;

  const selectedPlantName =
    selectedPlantId === 'all'
      ? 'All Plants'
      : plants.find((p) => p.id === selectedPlantId)
        ?.plant_name || 'Selected Plant';

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* PAGE HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">
              USERS &amp; PERSONNEL
            </h2>

            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              {isAdmin ? 'Admin Governance' : 'Plant Governance'}
            </span>
          </div>

          <p className="text-xs text-zinc-500 font-medium mt-1"></p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2 flex-wrap">

            {isAdmin && (
              <button
                onClick={() => openCreateModal('manager')}
                className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                {/* <Briefcase className="w-4 h-4" /> */}
                <span>+ Add Manager</span>
              </button>
            )}

            {(isAdmin || isManager) && (
              <button
                onClick={() => openCreateModal('store_manager')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                {/* <Boxes className="w-4 h-4" /> */}
                <span>+ Add Store Manager</span>
              </button>
            )}
            
            <button
              onClick={() => openCreateModal('operator')}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              {/* <HardHat className="w-4 h-4" /> */}
              <span>+ Add Operator</span>
            </button>

            <button
              onClick={() => openCreateModal('technician')}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 border border-amber-500"
            >
              {/* <UserPlus className="w-4 h-4" /> */}
              <span>+ Add Technician</span>
            </button>



          </div>
        )}
      </div>

      {/* TABS: Active Personnel vs Pending Operator Approvals */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          onClick={() => setActiveTab('personnel')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'personnel'
              ? 'bg-zinc-950 text-white shadow'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Active Staff Directory ({visibleUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-black shadow'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          <HardHat className="w-4 h-4" />
          <span>Pending Approvals</span>
          {pendingOperators.length + pendingTempRequests.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
              {pendingOperators.length + pendingTempRequests.length}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-600">
              0
            </span>
          )}
        </button>
      </div>

      {activeTab === 'personnel' && (
        <>
          {/* PLANT FILTER - ADMIN ONLY */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-black text-zinc-700">
              Filter Personnel by Plant
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedPlantId('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition ${selectedPlantId === 'all'
                ? 'bg-amber-400 border-amber-500 text-black shadow-sm'
                : 'bg-white border-zinc-200 text-zinc-600 hover:border-amber-400'
                }`}
            >
              All Plants
            </button>

            {plants.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlantId(p.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold border transition ${selectedPlantId === p.id
                  ? 'bg-amber-400 border-amber-500 text-black shadow-sm'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:border-amber-400'
                  }`}
              >
                {p.plant_name || p.plant_code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* METRICS BAR */}
      <div className={`grid grid-cols-2 ${isAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
        <div className="p-4 bg-white rounded-xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Total Users
          </div>
          <div className="text-2xl font-black text-zinc-950 mt-1">
            {visibleUsers.length}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border-2 border-amber-300 bg-amber-50/20 shadow-sm">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Technicians
          </div>
          <div className="text-2xl font-black text-black mt-1">
            {techCount}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border-2 border-blue-200 bg-blue-50/20 shadow-sm">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">
            Operators
          </div>
          <div className="text-2xl font-black text-zinc-950 mt-1">
            {oprCount}
          </div>
        </div>

        {isAdmin && (
          <div className="p-4 bg-white rounded-xl border-2 border-purple-200 bg-purple-50/20 shadow-sm">
            <div className="text-xs font-bold text-purple-800 uppercase tracking-wider">
              Managers
            </div>
            <div className="text-2xl font-black text-zinc-950 mt-1">
              {mgrCount}
            </div>
          </div>
        )}

        <div className="p-4 bg-white rounded-xl border-2 border-emerald-300 bg-emerald-50/20 shadow-sm">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Store Managers
          </div>
          <div className="text-2xl font-black text-emerald-950 mt-1">
            {storeMgrCount}
          </div>
        </div>
      </div>

      {/* SEARCH & ROLE FILTER */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by personnel name, employee ID, department, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(isManager
            ? ['all', 'technician', 'operator', 'store_manager']
            : ['all', 'technician', 'operator', 'manager', 'store_manager', 'admin']
          ).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${selectedRole === role
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
            >
              {role === 'all'
                ? 'All Roles'
                : role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVE FILTER INFORMATION */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 font-medium">
          Showing personnel for{' '}
          <span className="font-bold text-zinc-900">
            {selectedPlantName}
          </span>
        </p>

        <p className="text-xs font-bold text-zinc-600">
          {filtered.length} Personnel
        </p>
      </div>

      {/* PERSONNEL TABLE */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Personnel Info</th>
                <th className="px-6 py-3.5">System Role</th>
                <th className="px-6 py-3.5">Department &amp; Title</th>
                <th className="px-6 py-3.5">Assigned Shift</th>
                <th className="px-6 py-3.5">Contact</th>
                <th className="px-6 py-3.5">Status</th>
                {isAdmin && (
                  <th className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center py-10 text-zinc-400 font-bold"
                  >
                    Loading personnel registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center py-10 text-zinc-400 font-bold"
                  >
                    No matching personnel found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isTech = u.role === 'technician';
                  const isOpr = u.role === 'operator';
                  const isMgr = u.role === 'manager';
                  const isStore = u.role === 'store_manager';
                  const isAdm = u.role === 'admin';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-50/70 transition"
                    >
                      <td className="px-6 py-3.5">
                        <div className="font-black text-sm text-zinc-950">
                          {u.full_name}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-amber-700">
                          {u.employee_code}
                        </div>
                      </td>

                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isTech
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isOpr
                              ? 'bg-blue-100 text-blue-900 border border-blue-200'
                              : isMgr
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : isStore
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-zinc-900 text-white'
                            }`}
                        >
                          {isTech && <Wrench className="w-3 h-3" />}
                          {isOpr && <HardHat className="w-3 h-3" />}
                          {isMgr && <Briefcase className="w-3 h-3" />}
                          {isStore && <Boxes className="w-3 h-3" />}
                          {isAdm && <Shield className="w-3 h-3" />}
                          <span>{u.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="font-bold text-zinc-900">
                          {u.department || 'Plant Engineering'}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">
                          {u.designation || 'Staff'}
                        </div>
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-700 font-bold">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{u.shift || 'Shift A'}</span>
                        </div>
                      </td>

                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5 text-zinc-700 font-medium">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span>{u.email}</span>
                        </div>

                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] mt-0.5">
                            <Phone className="w-3 h-3 text-zinc-400" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${u.is_active !== false
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                        >
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {isAdmin && (
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition"
                              title="Edit Personnel Details"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() =>
                                handleDeactivate(u.id, u.full_name)
                              }
                              className="p-1.5 text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                              title="Deactivate Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        </>
      )}

      {/* PENDING APPROVALS TAB */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border-2 border-zinc-200 overflow-hidden shadow-sm">
          {/* Sub-tab Switcher: Operator Registrations vs Temporary Machine Requests */}
          <div className="flex items-center gap-2 px-5 pt-3.5 bg-zinc-50 border-b border-zinc-200">
            <button
              onClick={() => setPendingSubTab('operators')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer ${
                pendingSubTab === 'operators'
                  ? 'border-amber-500 text-zinc-950 bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <HardHat className="w-4 h-4 text-amber-600" />
              <span>Operator Registrations</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  pendingOperators.length > 0
                    ? 'bg-amber-100 text-amber-950 border border-amber-300'
                    : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {pendingOperators.length}
              </span>
            </button>

            <button
              onClick={() => setPendingSubTab('temporary')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer ${
                pendingSubTab === 'temporary'
                  ? 'border-amber-500 text-zinc-950 bg-white rounded-t-xl shadow-xs'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Repeat className="w-4 h-4 text-amber-600" />
              <span>Temporary Machine Requests</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  pendingTempRequests.length > 0
                    ? 'bg-amber-100 text-amber-950 border border-amber-300 animate-pulse'
                    : 'bg-zinc-200 text-zinc-600'
                }`}
              >
                {pendingTempRequests.length}
              </span>
            </button>
          </div>

          {/* SUB-TAB 1: OPERATOR REGISTRATIONS */}
          {pendingSubTab === 'operators' && (
            <div>
              {/* PENDING HEADER */}
              <div className="p-5 border-b border-zinc-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-sm">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                        Pending Operator Registrations
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                        {pendingOperators.length} Awaiting Authorization
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                      {isManager
                        ? 'Self-registered operators awaiting plant manager authorization before portal access is granted.'
                        : 'All factory operator registrations awaiting plant authorization.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => fetchPendingOperators()}
                  disabled={loadingPending}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {loadingPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span>Refresh List</span>
                </button>
              </div>

          {/* PENDING OPERATORS LIST */}
          {loadingPending ? (
            <div className="py-16 text-center text-zinc-500 text-xs font-bold flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span>Loading pending operator registrations...</span>
            </div>
          ) : pendingOperators.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-3 bg-zinc-50/50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="max-w-sm">
                <p className="font-black text-zinc-900 text-sm">No Pending Registrations</p>
                <p className="text-zinc-500 text-xs mt-1">
                  All operator sign-up requests have been reviewed. New operator registrations for your plant facility will appear here in real time.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 uppercase text-[10px] font-black tracking-wider">
                    <th className="py-3 px-4">Operator Name &amp; ID</th>
                    <th className="py-3 px-4">Facility &amp; Shop</th>
                    <th className="py-3 px-4">Requested Permanent Machine</th>
                    <th className="py-3 px-4">Shift &amp; Role</th>
                    <th className="py-3 px-4">Contact Details</th>
                    <th className="py-3 px-4">Department / Designation</th>
                    <th className="py-3 px-4">Submission Date</th>
                    <th className="py-3 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {pendingOperators.map((op) => (
                    <tr key={op.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-zinc-950 text-xs flex items-center gap-2">
                          <span>{op.full_name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Pending
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-600 font-bold mt-0.5 flex items-center gap-1">
                          <span>ID: {op.employee_code}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-900 text-xs flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>{op.plant_name || 'Assigned Plant'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-600 font-medium mt-0.5">
                          Shop: {op.shop_name || 'Assigned Shop'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {op.requested_machine_code ? (
                          <div>
                            <div className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="font-mono">{op.requested_machine_code}</span>
                            </div>
                            <div className="text-[11px] text-zinc-600 truncate max-w-[150px]">
                              {op.requested_machine_name || 'Machine'}
                            </div>
                            {op.requested_machine_location && (
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[150px]">
                                Loc: {op.requested_machine_location}
                              </div>
                            )}
                            <span
                              className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                                op.requested_machine_status === 'active' ||
                                op.requested_machine_status === 'idle' ||
                                op.requested_machine_status === 'running'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : op.requested_machine_status === 'under_maintenance'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                  : op.requested_machine_status === 'breakdown'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                              }`}
                            >
                              {op.requested_machine_status
                                ? op.requested_machine_status === 'running'
                                  ? 'Active'
                                  : op.requested_machine_status.replace(/_/g, ' ')
                                : 'N/A'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">None specified</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase border border-blue-200">
                          {op.shift || 'Shift A'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                          <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{op.email}</span>
                        </div>
                        {op.phone && (
                          <div className="flex items-center gap-1.5 text-zinc-600 text-[11px] mt-0.5">
                            <Phone className="w-3 h-3 text-zinc-400 shrink-0" />
                            <span>{op.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-zinc-900">{op.designation || 'Operator'}</div>
                        <div className="text-[11px] text-zinc-500">{op.department || 'Operations'}</div>
                      </td>

                      <td className="py-3.5 px-4 text-zinc-600 text-[11px] font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>
                            {op.created_at
                              ? new Date(op.created_at).toLocaleString('en-IN', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : 'Recent'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApproveOperator(op)}
                            disabled={pendingActionId === op.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Approve & Activate Operator"
                          >
                            {pendingActionId === op.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectingUser(op);
                              setRejectionReason('');
                            }}
                            disabled={pendingActionId === op.id}
                            className="px-3 py-1.5 bg-zinc-100 hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-zinc-300 hover:border-rose-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Reject Registration"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

          {/* SUB-TAB 2: TEMPORARY MACHINE REQUESTS */}
          {pendingSubTab === 'temporary' && (
            <div>
              {/* PENDING HEADER */}
              <div className="p-5 border-b border-zinc-200 bg-amber-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-sm">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                        Pending Temporary Machine Requests
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200 text-amber-900 border border-amber-300">
                        {pendingTempRequests.length} Awaiting Authorization
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium mt-0.5">
                      Operator replacement requests for temporary machine assignments while permanent machines are under repair or maintenance.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => fetchPendingTempRequests()}
                  disabled={loadingPendingTemp}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {loadingPendingTemp ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span>Refresh List</span>
                </button>
              </div>

              {/* PENDING TEMPORARY REQUESTS LIST */}
              {loadingPendingTemp ? (
                <div className="py-16 text-center text-zinc-500 text-xs font-bold flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span>Loading pending temporary machine requests...</span>
                </div>
              ) : pendingTempRequests.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-3 bg-zinc-50/50">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="max-w-sm">
                    <p className="font-black text-zinc-900 text-sm">No Pending Replacement Requests</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      All operator temporary machine requests have been reviewed and allocated. New replacement requests will appear here in real time.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100/80 border-b border-zinc-200 text-zinc-600 uppercase text-[10px] font-black tracking-wider">
                        <th className="py-3 px-4">Operator Details</th>
                        <th className="py-3 px-4">Facility &amp; Shop</th>
                        <th className="py-3 px-4">Permanent Machine (Broken)</th>
                        <th className="py-3 px-4">Requested Temporary Machine</th>
                        <th className="py-3 px-4">Operator Notes / Reason</th>
                        <th className="py-3 px-4">Requested At</th>
                        <th className="py-3 px-4 text-right">Approval Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {pendingTempRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-black text-zinc-950 text-xs flex items-center gap-2">
                              <span>{req.operator_name || 'Operator'}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Pending Temp
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-600 font-bold mt-0.5">
                              ID: {req.operator_code || 'OP'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900 text-xs flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              <span>{req.plant_name || 'Facility'}</span>
                            </div>
                            <div className="text-[11px] text-zinc-600 font-medium mt-0.5">
                              Shop: {req.shop_name || 'Floor'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                              <span className="font-mono bg-rose-50 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200">
                                {req.replacement_for_machine_code || req.permanent_machine_code || 'Broken Asset'}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-600 mt-0.5 truncate max-w-[160px]">
                              {req.replacement_for_machine_name || req.permanent_machine_name || 'Permanent Asset'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div>
                              <div className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span className="font-mono">{req.machine_code || 'Replacement'}</span>
                              </div>
                              <div className="text-[11px] text-zinc-600 truncate max-w-[150px]">
                                {req.machine_name || 'Machine Asset'}
                              </div>
                              {req.machine_location && (
                                <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[150px]">
                                  Loc: {req.machine_location}
                                </div>
                              )}
                              <span
                                className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                                  req.machine_status === 'active' ||
                                  req.machine_status === 'idle' ||
                                  req.machine_status === 'running'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                                }`}
                              >
                                {req.machine_status ? req.machine_status.replace(/_/g, ' ') : 'Available'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-[200px]">
                            <p className="text-xs text-zinc-700 line-clamp-2">
                              {req.notes || req.request_reason || 'Permanent machine stoppage; temporary machine needed for production.'}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-600 text-[11px] font-medium">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span>
                                {req.created_at
                                  ? new Date(req.created_at).toLocaleString('en-IN', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    })
                                  : 'Recent'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveTempRequest(req)}
                                disabled={pendingActionId === req.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                title="Approve Temporary Allocation"
                              >
                                {pendingActionId === req.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>

                              <button
                                onClick={() => {
                                  setRejectingTempRequest(req);
                                  setTempRejectionReason('');
                                }}
                                disabled={pendingActionId === req.id}
                                className="px-3 py-1.5 bg-zinc-100 hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-zinc-300 hover:border-rose-300 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                title="Reject Temporary Request"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ENROLL / EDIT PERSONNEL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* MODAL HEADER */}
            <div className="bg-white p-5 flex items-center justify-between border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  JCB
                </div>

                <h3 className="text-base font-black text-zinc-950 tracking-wide">
                  {editingUser
                    ? `EDIT PERSONNEL: ${formData.employee_code}`
                    : formData.role === 'manager'
                      ? 'ENROLL NEW PLANT MANAGER'
                      : formData.role === 'store_manager'
                        ? 'ENROLL NEW STORE MANAGER'
                        : 'ENROLL NEW PLANT PERSONNEL'}
                </h3>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 p-1.5 rounded-lg transition"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedback.text}</span>
                </div>
              )}

              {/* SYSTEM ROLE SELECTION */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  System Role *
                </label>
                <select
                  disabled={Boolean(editingUser)}
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const prefixes: Record<string, string> = {
                      technician: 'TCH',
                      operator: 'OPR',
                      manager: 'MGR',
                      store_manager: 'STR',
                      admin: 'ADM',
                    };
                    const oldPrefix = prefixes[formData.role] || 'EMP';
                    const newPrefix = prefixes[newRole] || 'EMP';
                    let newCode = formData.employee_code;
                    if (newCode.startsWith(`JCB-${oldPrefix}-`)) {
                      newCode = newCode.replace(`JCB-${oldPrefix}-`, `JCB-${newPrefix}-`);
                    }
                    setFormData({
                      ...formData,
                      role: newRole,
                      employee_code: newCode,
                    });
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:bg-zinc-100 disabled:cursor-not-allowed"
                >
                  {isManager ? (
                    <>
                      <option value="technician">Technician</option>
                      <option value="operator">Operator</option>
                      <option value="store_manager">Store Manager</option>
                    </>
                  ) : (
                    <>
                      <option value="technician">Technician</option>
                      <option value="operator">Operator</option>
                      <option value="store_manager">Store Manager</option>
                      <option value="manager">Plant Manager</option>
                      <option value="admin">System Administrator</option>
                    </>
                  )}
                </select>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {isManager
                    ? 'Permitted governance roles: Technician, Operator, Store Manager.'
                    : 'System authorization role.'}
                </span>
              </div>

              {/* EMPLOYEE ID AND NAME */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Employee ID *
                  </label>

                  <input
                    type="text"
                    required
                    maxLength={50}
                    value={formData.employee_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employee_code: e.target.value,
                      })
                    }
                    placeholder="e.g. JCB-TCH-084"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Full Name *
                  </label>

                  <input
                    type="text"
                    required
                    maxLength={255}
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        full_name: e.target.value,
                      })
                    }
                    placeholder="e.g. Anil Kumar"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* EMAIL AND PHONE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Email Address *
                  </label>

                  <input
                    type="email"
                    required
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target.value,
                      })
                    }
                    placeholder="e.g. anil.kumar@jcb.com"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Contact Phone
                  </label>

                  <input
                    type="tel"
                    maxLength={50}
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: e.target.value,
                      })
                    }
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* PLANT AND SHOP */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Assigned Plant Facility{' '}
                    {isManager
                      ? '(Locked)'
                      : formData.role === 'manager'
                        ? '*'
                        : '(Optional)'}
                  </label>

                  {isManager ? (
                    <div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={
                          plants.find(
                            (p) => p.id === formData.plant_id
                          )?.plant_name ||
                          user?.plantName ||
                          (user as any)?.plant_name ||
                          'Assigned Plant Facility'
                        }
                        className="w-full px-3 py-2 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 cursor-not-allowed"
                      />

                      <span className="text-[10px] text-zinc-500 font-medium">
                        Locked to your plant governance jurisdiction.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <select
                        required={isAdmin && formData.role === 'manager'}
                        value={formData.plant_id}
                        onChange={(e) => {
                          const pId = e.target.value;

                          setFormData({
                            ...formData,
                            plant_id: pId,
                            shop_id: '',
                          });

                          fetchShopsForPlant(pId);
                        }}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                      >
                        <option value="">
                          {formData.role === 'manager'
                            ? '-- Select Manager Plant * --'
                            : '-- No Plant Assigned --'}
                        </option>

                        {plants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.plant_name || p.name || p.plant_code}
                          </option>
                        ))}
                      </select>

                      <span className="text-[10px] text-zinc-500 font-medium">
                        {formData.role === 'manager'
                          ? 'A plant assignment is required for Managers.'
                          : 'Select enterprise plant facility.'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Assigned Shop / Line
                  </label>

                  <select
                    value={formData.shop_id}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shop_id: e.target.value,
                      })
                    }
                    disabled={!formData.plant_id || loadingShops}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
                  >
                    <option value="">
                      {loadingShops
                        ? 'Loading shops...'
                        : !formData.plant_id
                          ? '-- Select Plant First --'
                          : shops.length === 0
                            ? '-- No Shops Available --'
                            : '-- Select Shop (Optional) --'}
                    </option>

                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.shop_name}
                      </option>
                    ))}
                  </select>

                  <span className="text-[10px] text-zinc-500 font-medium">
                    Optional shop assignment.
                  </span>
                </div>
              </div>

              {/* WORKING SHIFT */}
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Working Shift
                </label>

                <select
                  value={formData.shift}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shift: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="Shift A">
                    Shift A (06:00 - 14:30)
                  </option>
                  <option value="Shift B">
                    Shift B (14:30 - 23:00)
                  </option>
                  <option value="Shift C">
                    Shift C (23:00 - 06:00)
                  </option>
                  <option value="General Shift">
                    General Shift (08:30 - 17:00)
                  </option>
                </select>
              </div>

              {/* INITIAL PASSWORD */}
              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Initial Password * (12–128 Characters)
                  </label>

                  <input
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        password: e.target.value,
                      })
                    }
                    placeholder="Enter a unique initial password"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />

                  <span className="text-[10px] text-zinc-500 font-medium">
                    Use a unique initial password for this employee.
                  </span>
                </div>
              )}

              {/* FORM ACTIONS */}
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
                  {actionLoading
                    ? 'Saving...'
                    : editingUser
                      ? 'Update Personnel'
                      : formData.role === 'manager'
                        ? 'Create Manager'
                        : formData.role === 'store_manager'
                          ? 'Create Store Manager'
                          : 'Enroll Personnel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Reject Operator Registration
                </h3>
              </div>
              <button
                onClick={() => setRejectingUser(null)}
                className="text-zinc-400 hover:text-zinc-800 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-700 leading-relaxed">
                You are about to reject the registration request for{' '}
                <strong className="text-zinc-950 font-black">
                  {rejectingUser.full_name} ({rejectingUser.employee_code})
                </strong>
                {rejectingUser.requested_machine_code && (
                  <span>
                    {' '}• Requested Machine:{' '}
                    <strong className="font-mono text-zinc-900">{rejectingUser.requested_machine_code}</strong>
                  </span>
                )}
                . Their account will remain deactivated and portal access will be denied.
              </p>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Reason for Rejection (Optional)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., Invalid employee code, not found on plant roster, incorrect plant selection..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingUser(null)}
                  disabled={pendingActionId === rejectingUser.id}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={pendingActionId === rejectingUser.id}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pendingActionId === rejectingUser.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* REJECTION MODAL FOR TEMPORARY MACHINE REQUEST */}
      {rejectingTempRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 border-b border-rose-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Decline Temporary Machine Request
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingTempRequest(null)}
                className="text-zinc-400 hover:text-black p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-600">
                You are about to decline the temporary machine request for{' '}
                <strong className="text-zinc-950 font-black">
                  {rejectingTempRequest.operator_name || 'Operator'} ({rejectingTempRequest.operator_code || 'OP'})
                </strong>
                . Requested temporary asset:{' '}
                <strong className="font-mono text-zinc-900">
                  {rejectingTempRequest.machine_code || 'Machine'}
                </strong>
                .
              </p>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Reason for Decline (Optional)
                </label>
                <textarea
                  rows={3}
                  value={tempRejectionReason}
                  onChange={(e) => setTempRejectionReason(e.target.value)}
                  placeholder="e.g., Replacement machine required for higher priority job, maintenance planned, wait for permanent asset..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-medium text-zinc-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingTempRequest(null)}
                  disabled={pendingActionId === rejectingTempRequest.id}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectTempRequest}
                  disabled={pendingActionId === rejectingTempRequest.id}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pendingActionId === rejectingTempRequest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserX className="w-4 h-4" />
                  )}
                  <span>Confirm Decline</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
