import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Calendar, Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export const PMCalendarPage: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/pm/plans');
      if (res.data.success) {
        setPlans(res.data.data);
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
        alert(res.data.message);
        fetchPlans();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'PM generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">PREVENTIVE MAINTENANCE (PM) ENGINE</h2>
          <p className="text-xs text-slate-500 mt-0.5">Dual-trigger automated maintenance: calendar intervals and machine operating hours</p>
        </div>

        <button
          onClick={handleTriggerEngine}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          {generating ? 'Processing Engine...' : 'Run Scheduled PM Generator'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Plan Code</th>
                <th className="px-6 py-3.5">Machine Asset</th>
                <th className="px-6 py-3.5">Servicing Title</th>
                <th className="px-6 py-3.5">Frequency</th>
                <th className="px-6 py-3.5">Current Hours</th>
                <th className="px-6 py-3.5">Next Due Date</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No active preventive maintenance schedules configured.
                  </td>
                </tr>
              ) : (
                plans.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-3.5 font-extrabold text-slate-900">{p.plan_code}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{p.machine_code}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">{p.title}</td>
                    <td className="px-6 py-3.5 capitalize font-semibold text-slate-600">{p.frequency}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{parseFloat(p.current_machine_hours || 0).toLocaleString()} hrs</td>
                    <td className="px-6 py-3.5 font-semibold text-amber-900">
                      {new Date(p.next_pm_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                        Active Schedule
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

