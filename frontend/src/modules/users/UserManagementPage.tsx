import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Search, 
  Shield, 
  Wrench, 
  HardHat, 
  Briefcase, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  Mail,
  Clock,
  Boxes,
  Package,
  Building2,
  Factory
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canCreate = isAdmin || isManager;

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  // Plants and Shops
  const [plants, setPlants] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
    plant_id: '',
    shop_id: '',
    department: 'Mechanical Maintenance',
    designation: 'Senior Maintenance Technician',
    shift: 'Shift A',
    password: 'Jcb@Secure2026',
    is_active: true,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/auth/users');
      if (res.data.success) {
        setUsersList(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
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
      const res = await apiClient.get(`/org/plants/${plantId}/shops`);
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

  useEffect(() => {
    fetchUsers();
    fetchPlants();
  }, []);

  const openCreateModal = (presetRole: string = 'technician') => {
    setEditingUser(null);
    // If manager, enforce either technician or operator
    let safeRole = presetRole;
    if (isManager && safeRole !== 'technician' && safeRole !== 'operator') {
      safeRole = 'technician';
    }

    const prefix = safeRole === 'technician' ? 'TCH' : safeRole === 'operator' ? 'OPR' : safeRole === 'manager' ? 'MGR' : safeRole === 'store_manager' ? 'STR' : 'ADM';
    const managerPlantId = user?.plantId || (user as any)?.plant_id || '';
    const initialPlantId = isManager ? managerPlantId : (plants[0]?.id || '');

    setFormData({
      employee_code: `JCB-${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      email: '',
      phone: '',
      role: safeRole,
      plant_id: initialPlantId,
      shop_id: '',
      department: safeRole === 'operator' ? 'Production Operations' : safeRole === 'store_manager' ? 'Central Stores & Inventory' : 'Mechanical Maintenance',
      designation: safeRole === 'technician' ? 'Maintenance Technician' : safeRole === 'operator' ? 'CNC Line Operator' : safeRole === 'store_manager' ? 'Store Manager' : 'Maintenance Engineer',
      shift: 'Shift A',
      password: 'Jcb@Secure2026',
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
      employee_code: u.employee_code,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      plant_id: u.plant_id || '',
      shop_id: u.shop_id || '',
      department: u.department || 'Mechanical Maintenance',
      designation: u.designation || 'Technician',
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
    setActionLoading(true);
    setFeedback(null);

    try {
      const payload: any = {
        employee_code: formData.employee_code,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone?.trim() ? formData.phone.trim() : null,
        role: formData.role,
        department: formData.department,
        designation: formData.designation,
        shift: formData.shift,
        plant_id: formData.plant_id || null,
        shop_id: formData.shop_id || null,
        is_active: formData.is_active,
      };

      if (editingUser) {
        const res = await apiClient.put(`/auth/users/${editingUser.id}`, payload);
        if (res.data.success) {
          setFeedback({ type: 'success', text: `Personnel ${formData.full_name} updated successfully.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchUsers();
          }, 800);
        }
      } else {
        payload.password = formData.password;
        const res = await apiClient.post('/auth/users', payload);
        if (res.data.success) {
          setFeedback({ type: 'success', text: `Personnel ${formData.full_name} (${formData.employee_code}) enrolled successfully.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchUsers();
          }, 800);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Action failed. Please check inputs.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}? They will no longer be able to log in.`)) {
      return;
    }
    try {
      const res = await apiClient.delete(`/auth/users/${id}`);
      if (res.data.success) {
        alert(res.data.message || `${name} deactivated.`);
        fetchUsers();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  const filtered = usersList.filter((u) => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.employee_code?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.department?.toLowerCase().includes(search.toLowerCase());

    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const techCount = usersList.filter(u => u.role === 'technician').length;
  const oprCount = usersList.filter(u => u.role === 'operator').length;
  const mgrCount = usersList.filter(u => u.role === 'manager').length;
  const storeMgrCount = usersList.filter(u => u.role === 'store_manager').length;

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">PLANT PERSONNEL & TECHNICIAN DIRECTORY</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              {isAdmin ? 'Admin Governance' : 'Plant Governance'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            {isManager 
              ? 'Manage field maintenance technicians and machine operators within your assigned plant facility.' 
              : 'Manage field maintenance technicians, machine operators, shift supervisors, store managers, and engineering staff across JCB manufacturing facilities.'}
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openCreateModal('technician')}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5 border border-amber-500"
            >
              <UserPlus className="w-4 h-4" />
              <span>ENROLL TECHNICIAN</span>
            </button>
            <button
              onClick={() => openCreateModal('operator')}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <HardHat className="w-4 h-4" />
              <span>ENROLL OPERATOR</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => openCreateModal('store_manager')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black px-3.5 py-2.5 rounded-xl shadow transition-all flex items-center gap-1.5"
              >
                <Boxes className="w-4 h-4" />
                <span>ENROLL STORE MGR</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white rounded-xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Personnel</div>
          <div className="text-2xl font-black text-zinc-950 mt-1">{usersList.length}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border-2 border-amber-300 bg-amber-50/20 shadow-sm">
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">Field Technicians</div>
          <div className="text-2xl font-black text-black mt-1">{techCount}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border-2 border-blue-200 bg-blue-50/20 shadow-sm">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Machine Operators</div>
          <div className="text-2xl font-black text-zinc-950 mt-1">{oprCount}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border-2 border-purple-200 bg-purple-50/20 shadow-sm">
          <div className="text-xs font-bold text-purple-800 uppercase tracking-wider">Maintenance Managers</div>
          <div className="text-2xl font-black text-zinc-950 mt-1">{mgrCount}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border-2 border-emerald-300 bg-emerald-50/20 shadow-sm">
          <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Store Managers</div>
          <div className="text-2xl font-black text-emerald-950 mt-1">{storeMgrCount}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by personnel name, employee ID (e.g. EMP-TCH-001), department, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'technician', 'operator', 'manager', 'store_manager', 'admin'].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                selectedRole === role
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {role === 'all' ? 'All Roles' : role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Personnel Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Personnel Info</th>
                <th className="px-6 py-3.5">System Role</th>
                <th className="px-6 py-3.5">Department & Title</th>
                <th className="px-6 py-3.5">Assigned Shift</th>
                <th className="px-6 py-3.5">Contact</th>
                <th className="px-6 py-3.5">Status</th>
                {isAdmin && <th className="px-6 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-zinc-400 font-bold">
                    Loading personnel registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-zinc-400 font-bold">
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
                    <tr key={u.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-black text-sm text-zinc-950">{u.full_name}</div>
                        <div className="text-[11px] font-mono font-bold text-amber-700">{u.employee_code}</div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isTech 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isOpr
                            ? 'bg-blue-100 text-blue-900 border border-blue-200'
                            : isMgr
                            ? 'bg-purple-100 text-purple-900 border border-purple-200'
                            : isStore
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-zinc-900 text-white'
                        }`}>
                          {isTech && <Wrench className="w-3 h-3" />}
                          {isOpr && <HardHat className="w-3 h-3" />}
                          {isMgr && <Briefcase className="w-3 h-3" />}
                          {isStore && <Boxes className="w-3 h-3" />}
                          {isAdm && <Shield className="w-3 h-3" />}
                          <span>{u.role.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-zinc-900">{u.department || 'Plant Engineering'}</div>
                        <div className="text-[11px] text-zinc-500 font-medium">{u.designation || 'Staff'}</div>
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
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          u.is_active !== false 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}>
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
                              onClick={() => handleDeactivate(u.id, u.full_name)}
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

      {/* Modal - Enroll / Edit Personnel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  JCB
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  {editingUser ? `EDIT PERSONNEL: ${formData.employee_code}` : 'ENROLL NEW PLANT PERSONNEL'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {feedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
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
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Anil Kumar"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              {/* Plant & Shop Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Assigned Plant Facility {isManager ? '(Locked)' : '*'}
                  </label>
                  {isManager ? (
                    <div>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={
                          plants.find((p) => p.id === formData.plant_id)?.plant_name ||
                          user?.plantName ||
                          (user as any)?.plant_name ||
                          'Assigned Plant Facility'
                        }
                        className="w-full px-3 py-2 bg-zinc-100 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 cursor-not-allowed"
                      />
                      <span className="text-[10px] text-zinc-500 font-medium">Locked to your plant governance jurisdiction.</span>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={formData.plant_id}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setFormData({ ...formData, plant_id: pId, shop_id: '' });
                          fetchShopsForPlant(pId);
                        }}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                      >
                        <option value="">-- No Plant Assigned --</option>
                        {plants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.plant_name || p.name || p.plant_code}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-zinc-500 font-medium">Select enterprise plant facility.</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Assigned Shop / Line
                  </label>
                  <select
                    value={formData.shop_id}
                    onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                    disabled={!formData.plant_id || loadingShops}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow disabled:opacity-50"
                  >
                    <option value="">-- Select Shop (Optional) --</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shop_name || s.name || s.shop_code}
                      </option>
                    ))}
                  </select>
                  {loadingShops ? (
                    <span className="text-[10px] text-zinc-500 font-medium">Loading shops...</span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-medium">Optional shop assignment.</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    System Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    {isManager ? (
                      <>
                        <option value="technician">Field Maintenance Technician</option>
                        <option value="operator">Machine Operator</option>
                      </>
                    ) : (
                      <>
                        <option value="technician">Field Maintenance Technician</option>
                        <option value="operator">Machine Operator</option>
                        <option value="manager">Maintenance Manager / In-Charge</option>
                        <option value="store_manager">Store Manager / Inventory In-Charge</option>
                        <option value="admin">Enterprise Administrator</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="Central Stores & Inventory">Central Stores & Inventory</option>
                    <option value="Mechanical Maintenance">Mechanical Maintenance</option>
                    <option value="Electrical & PLC Automation">Electrical & PLC Automation</option>
                    <option value="Hydraulics & Tooling">Hydraulics & Tooling</option>
                    <option value="Robotic Welding Maintenance">Robotic Welding Maintenance</option>
                    <option value="Press Shop Maintenance">Press Shop Maintenance</option>
                    <option value="Production Operations">Production Operations</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Senior Technician"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Working Shift
                  </label>
                  <select
                    value={formData.shift}
                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="Shift A">Shift A (06:00 - 14:30)</option>
                    <option value="Shift B">Shift B (14:30 - 23:00)</option>
                    <option value="Shift C">Shift C (23:00 - 06:00)</option>
                    <option value="General Shift">General Shift (08:30 - 17:00)</option>
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Initial Password * (Minimum 12 Characters)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={12}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Jcb@Secure2026"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                  <span className="text-[10px] text-zinc-500 font-medium">Default initial password for first login (must be at least 12 characters).</span>
                </div>
              )}

              {/* Actions */}
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
                  {actionLoading ? 'Saving...' : editingUser ? 'Update Personnel' : 'Enroll Personnel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

