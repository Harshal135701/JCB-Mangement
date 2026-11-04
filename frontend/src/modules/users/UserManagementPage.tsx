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
  Clock
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

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
    department: 'Mechanical Maintenance',
    designation: 'Senior Maintenance Technician',
    shift: 'Shift A',
    password: 'password123',
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = (presetRole: string = 'technician') => {
    setEditingUser(null);
    const prefix = presetRole === 'technician' ? 'TCH' : presetRole === 'operator' ? 'OPR' : presetRole === 'manager' ? 'MGR' : 'ADM';
    setFormData({
      employee_code: `JCB-${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      email: '',
      phone: '',
      role: presetRole,
      department: presetRole === 'operator' ? 'Production Operations' : 'Mechanical Maintenance',
      designation: presetRole === 'technician' ? 'Maintenance Technician' : presetRole === 'operator' ? 'CNC Line Operator' : 'Maintenance Engineer',
      shift: 'Shift A',
      password: 'password123',
      is_active: true,
    });
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
      department: u.department || 'Mechanical Maintenance',
      designation: u.designation || 'Technician',
      shift: u.shift || 'Shift A',
      password: '',
      is_active: u.is_active !== false,
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);

    try {
      if (editingUser) {
        const res = await apiClient.put(`/auth/users/${editingUser.id}`, formData);
        if (res.data.success) {
          setFeedback({ type: 'success', text: `Personnel ${formData.full_name} updated successfully.` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchUsers();
          }, 800);
        }
      } else {
        const res = await apiClient.post('/auth/users', formData);
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

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">PLANT PERSONNEL & TECHNICIAN DIRECTORY</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Admin Governance
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Manage field maintenance technicians, machine operators, shift supervisors, and engineering staff across JCB manufacturing facilities.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreateModal('technician')}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
            >
              <UserPlus className="w-4 h-4" />
              <span>ENROLL TECHNICIAN</span>
            </button>
            <button
              onClick={() => openCreateModal('operator')}
              className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
            >
              <HardHat className="w-4 h-4" />
              <span>ENROLL OPERATOR</span>
            </button>
          </div>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <div className="p-4 bg-white rounded-xl border-2 border-zinc-200 shadow-sm">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Maintenance Managers</div>
          <div className="text-2xl font-black text-zinc-950 mt-1">{mgrCount}</div>
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

        <div className="flex items-center gap-2">
          {['all', 'technician', 'operator', 'manager', 'admin'].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                selectedRole === role
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {role === 'all' ? 'All Roles' : role}
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
                            : 'bg-zinc-900 text-white'
                        }`}>
                          {isTech && <Wrench className="w-3 h-3" />}
                          {isOpr && <HardHat className="w-3 h-3" />}
                          {isMgr && <Briefcase className="w-3 h-3" />}
                          {isAdm && <Shield className="w-3 h-3" />}
                          <span>{u.role}</span>
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
                    <option value="technician">Field Maintenance Technician</option>
                    <option value="operator">Machine Operator</option>
                    <option value="manager">Maintenance Manager / In-Charge</option>
                    <option value="admin">Enterprise Administrator</option>
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
                    Initial Password
                  </label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="password123"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                  <span className="text-[10px] text-zinc-500 font-medium">Default initial password for first login.</span>
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
