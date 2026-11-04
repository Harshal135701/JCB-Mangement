import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  X, 
  Wrench, 
  Layers 
} from 'lucide-react';

export const PMCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrMgr = user?.role === 'admin' || user?.role === 'manager';

  const [plans, setPlans] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    machine_id: '',
    title: 'Monthly Hydraulic Oil & Filter Replacement',
    frequency: 'monthly',
    interval_days: 30,
    operating_hour_threshold: 500,
    checklist_template: [
      'Check hydraulic fluid viscosity and contamination level',
      'Replace suction line and return line filter elements',
      'Inspect proportional pressure valves for seal weeping',
      'Verify accumulator nitrogen pre-charge pressure',
    ],
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const [pmRes, machRes] = await Promise.all([
        apiClient.get('/pm/plans'),
        apiClient.get('/machines?limit=50'),
      ]);
      setPlans(pmRes.data.data || []);
      setMachines(machRes.data.data || []);
      if (machRes.data.data?.length > 0 && !formData.machine_id) {
        setFormData(prev => ({ ...prev, machine_id: machRes.data.data[0].id }));
      }
    } catch (e) {
      console.error('Failed to load PM plans:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleTriggerEngine = async () => {
    try {
      setGenerating(true);
      const res = await apiClient.post('/pm/generate-due');
      if (res.data.success) {
        alert(res.data.message || 'PM auto-generation finished. Due jobs dispatched as Work Orders.');
        fetchPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'PM generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreatePMPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.machine_id || !formData.title) {
      alert('Please fill machine and title.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/pm/plans', formData);
      if (res.data.success) {
        alert(res.data.message || 'PM Schedule created successfully!');
        setIsModalOpen(false);
        fetchPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create PM Plan.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">PREVENTIVE MAINTENANCE (PM) ENGINE</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Reliability Standards
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Dual-trigger maintenance scheduler: calendar days interval and machine cumulative operating hours counter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdminOrMgr && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-zinc-900 hover:bg-black text-white text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>CONFIGURE PM PLAN</span>
            </button>
          )}
          <button
            onClick={handleTriggerEngine}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black text-xs uppercase tracking-wider rounded-xl shadow border border-amber-500 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>{generating ? 'Processing Engine...' : 'Run Scheduled PM Generator'}</span>
          </button>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Plan Code & Title</th>
                <th className="px-6 py-3.5">Machine Target</th>
                <th className="px-6 py-3.5">Schedule Cadence</th>
                <th className="px-6 py-3.5">Operating Hours Trigger</th>
                <th className="px-6 py-3.5">Next Due Date</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    Scanning scheduled PM plans...
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    No preventive maintenance schedules configured.
                  </td>
                </tr>
              ) : (
                plans.map((p) => {
                  const isDue = p.next_pm_date && new Date(p.next_pm_date) <= new Date();

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-mono text-xs font-black text-amber-700">{p.plan_code}</div>
                        <div className="font-bold text-sm text-zinc-950">{p.title}</div>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-zinc-800">
                        {p.machine_code || 'All CNC Bay Assets'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="font-black uppercase text-zinc-800">{p.frequency}</span>
                        <span className="block text-[11px] text-zinc-500 font-medium">Every {p.interval_days} Days</span>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                        {p.operating_hour_threshold ? `${p.operating_hour_threshold} hrs` : 'Calendar Only'}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 font-bold">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          <span className={isDue ? 'text-red-700 font-black' : 'text-zinc-800'}>
                            {p.next_pm_date ? new Date(p.next_pm_date).toLocaleDateString() : 'Active'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isDue 
                            ? 'bg-red-50 text-red-800 border border-red-200' 
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {isDue ? 'PM Due Today' : 'Scheduled'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create PM Plan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  PM
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  CONFIGURE PREVENTIVE MAINTENANCE SCHEDULE
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePMPlan} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Target Machine Asset *
                </label>
                <select
                  required
                  value={formData.machine_id}
                  onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose machine from plant registry --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  PM Plan Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Monthly Hydraulic Seal & Filter Replacement"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Frequency
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Interval Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.interval_days}
                    onChange={(e) => setFormData({ ...formData, interval_days: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Hour Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.operating_hour_threshold}
                    onChange={(e) => setFormData({ ...formData, operating_hour_threshold: parseInt(e.target.value, 10) || 0 })}
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
                  {actionLoading ? 'Saving...' : 'Deploy Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
