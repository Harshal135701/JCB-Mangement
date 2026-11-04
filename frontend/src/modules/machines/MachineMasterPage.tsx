import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Cpu, 
  QrCode, 
  FileText, 
  Layers, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  CheckCircle2, 
  ShieldCheck,
  Search
} from 'lucide-react';

export const MachineMasterPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    machine_code: '',
    name: '',
    category: 'HMC',
    oem_manufacturer: 'Mazak',
    model_number: '',
    serial_number: '',
    bay_line_location: 'Bay 1 / Line 1',
    criticality: 'class_b',
    status: 'running',
    operating_hours: 0,
  });

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/machines?limit=100');
      if (res.data.success) {
        setMachines(res.data.data);
      }
    } catch (e) {
      console.error('Failed to load machine master:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const openCreateModal = () => {
    setEditingMachine(null);
    setFormData({
      machine_code: `CNC-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'CNC Machining Center',
      oem_manufacturer: 'JCB Heavy Tooling',
      model_number: 'VMC-500-HD',
      serial_number: `SN-${Date.now().toString().slice(-6)}`,
      bay_line_location: 'Bay 2 / Line 3',
      criticality: 'class_b',
      status: 'running',
      operating_hours: 150,
    });
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setEditingMachine(m);
    setFormData({
      machine_code: m.machine_code,
      name: m.name,
      category: m.category || 'HMC',
      oem_manufacturer: m.oem_manufacturer || '',
      model_number: m.model_number || '',
      serial_number: m.serial_number || '',
      bay_line_location: m.bay_line_location || '',
      criticality: m.criticality || 'class_b',
      status: m.status || 'running',
      operating_hours: m.operating_hours || 0,
    });
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setFeedbackMsg(null);

    try {
      if (editingMachine) {
        // Edit existing machine
        const res = await apiClient.put(`/machines/${editingMachine.id}`, formData);
        if (res.data.success) {
          setFeedbackMsg({ type: 'success', text: `Machine ${formData.machine_code} updated successfully!` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchMachines();
          }, 800);
        }
      } else {
        // Create new machine
        const res = await apiClient.post('/machines', formData);
        if (res.data.success) {
          setFeedbackMsg({ type: 'success', text: `Machine ${formData.machine_code} registered successfully!` });
          setTimeout(() => {
            setIsModalOpen(false);
            fetchMachines();
          }, 800);
        }
      }
    } catch (err: any) {
      setFeedbackMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Operation failed. Please verify inputs.' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete / decommission machine ${code}?`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/machines/${id}`);
      if (res.data.success) {
        alert(res.data.message || `Machine ${code} processed successfully.`);
        fetchMachines();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete machine.');
    }
  };

  const filteredMachines = machines.filter(m => 
    m.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.oem_manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
    m.bay_line_location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Admin Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">1,000+ MACHINE ASSET DIRECTORY</h2>
            {isAdmin ? (
              <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
                Admin Full Access (CRUD)
              </span>
            ) : (
              <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                View Only ({user?.role?.toUpperCase()})
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Hierarchical multi-shop plant assets with digital QR codes, criticality classes, and lifecycle tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
            >
              <Plus className="w-4 h-4" />
              <span>REGISTER MACHINE</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter machines by code, name, manufacturer, or bay location..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-jcb-yellow font-medium shadow-sm"
        />
      </div>

      {/* Machine Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Machine Code & UID</th>
                <th className="px-6 py-3.5">Asset Name</th>
                <th className="px-6 py-3.5">OEM / Manufacturer</th>
                <th className="px-6 py-3.5">Location & Bay</th>
                <th className="px-6 py-3.5">Criticality</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Run Hours</th>
                {isAdmin && <th className="px-6 py-3.5 text-right">Admin Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-zinc-400 font-bold">
                    Loading machine inventory...
                  </td>
                </tr>
              ) : filteredMachines.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-zinc-400 font-bold">
                    No matching machines found.
                  </td>
                </tr>
              ) : (
                filteredMachines.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/70 transition">
                    <td className="px-6 py-3.5">
                      <div className="font-black text-sm text-zinc-950">{m.machine_code}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">SN: {m.serial_number || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-zinc-900">{m.name}</td>
                    <td className="px-6 py-3.5 text-zinc-700">
                      <span className="font-bold text-zinc-900">{m.oem_manufacturer}</span>
                      <span className="block text-[11px] text-zinc-500">{m.model_number || 'Standard'}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-zinc-800">{m.shop_name || 'CNC Shop'}</span>
                      <span className="block text-[11px] text-zinc-500">{m.bay_line_location || 'Bay 1'}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                        m.criticality === 'class_a' 
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : m.criticality === 'class_b'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}>
                        {m.criticality?.replace('_', ' ') || 'CLASS B'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        m.status === 'running'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : m.status === 'breakdown'
                          ? 'bg-red-100 text-red-800 font-black'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {m.status || 'running'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-zinc-700 font-bold">
                      {m.operating_hours ? `${Number(m.operating_hours).toFixed(1)} hrs` : '0.0 hrs'}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(m)}
                            className="p-1.5 text-zinc-600 hover:text-black hover:bg-amber-100 rounded-lg transition"
                            title="Edit Machine Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.machine_code)}
                            className="p-1.5 text-zinc-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                            title="Delete / Decommission Machine"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Machine Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  JCB
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  {editingMachine ? `EDIT MACHINE: ${formData.machine_code}` : 'REGISTER NEW MACHINE MASTER'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {feedbackMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedbackMsg.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Machine Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.machine_code}
                    onChange={(e) => setFormData({ ...formData, machine_code: e.target.value })}
                    placeholder="e.g. CNC-042"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Mazak 5-Axis VMC"
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
                    placeholder="HMC, Robotic Welder, Press..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    OEM Manufacturer
                  </label>
                  <input
                    type="text"
                    value={formData.oem_manufacturer}
                    onChange={(e) => setFormData({ ...formData, oem_manufacturer: e.target.value })}
                    placeholder="Mazak, Fanuc, Schuler..."
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    placeholder="e.g. HCN-6800 NEO"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="e.g. SN-89102-JCB"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Bay Location
                  </label>
                  <input
                    type="text"
                    value={formData.bay_line_location}
                    onChange={(e) => setFormData({ ...formData, bay_line_location: e.target.value })}
                    placeholder="Bay 1 / Line 4"
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Criticality
                  </label>
                  <select
                    value={formData.criticality}
                    onChange={(e) => setFormData({ ...formData, criticality: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="class_a">Class A (Bottleneck / High)</option>
                    <option value="class_b">Class B (Medium)</option>
                    <option value="class_c">Class C (Low / Standby)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="running">Running</option>
                    <option value="idle">Idle</option>
                    <option value="breakdown">Breakdown</option>
                    <option value="under_maintenance">Under Maint</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : editingMachine ? 'Update Machine' : 'Create Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
