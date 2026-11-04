import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { AlertCircle, UserCheck, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';

export const TriageQueuePage: React.FC = () => {
  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Allocation Modal State
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [slaHours, setSlaHours] = useState('2');
  const [instructions, setInstructions] = useState('Inspect proportional valve block, verify sensor feedback, adhere to LOTO.');
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsRes, woRes] = await Promise.all([
        apiClient.get('/breakdowns'),
        apiClient.get('/work-orders'),
      ]);
      setBreakdowns(ticketsRes.data.data);
      setWorkOrders(woRes.data.data);
    } catch (e) {
      console.error('Failed to load triage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      setAssigning(true);
      // Hardcoded seeded technician ID for quick allocation: Sunil Yadav ('f0000000-0000-0000-0000-000000000003')
      const payload = {
        ticket_id: selectedTicket.id,
        technician_id: 'f0000000-0000-0000-0000-000000000003',
        sla_hours: parseInt(slaHours, 10) || 2,
        work_instructions: instructions,
      };

      await apiClient.post('/work-orders/assign', payload);
      setSelectedTicket(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to allocate technician.');
    } finally {
      setAssigning(false);
    }
  };

  const handleVerify = async (woId: string, result: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.post(`/work-orders/${woId}/verify`, {
        result,
        remarks: result === 'APPROVED' ? 'Restoration accepted. Machine operational.' : 'Rework requested.',
      });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Verification failed.');
    }
  };

  const unassignedTickets = breakdowns.filter((b) => b.status === 'reported');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">BREAKDOWN TRIAGE & DISPATCH CENTER</h2>
        <p className="text-xs text-slate-500 mt-0.5">Filter incoming operator slips, assign technicians and verify repair quality</p>
      </div>

      {/* Unassigned Incoming Slips */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-amber-500/10 px-6 py-3 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Unassigned Breakdown Slips ({unassignedTickets.length})
            </h3>
          </div>
          <span className="text-xs text-amber-800 font-semibold">Immediate allocation required</span>
        </div>

        {unassignedTickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Zero unassigned tickets. All breakdowns have technicians dispatched.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {unassignedTickets.map((t) => (
              <div key={t.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-sm text-slate-900">{t.ticket_number}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                      {t.priority}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{t.machine_code} - {t.machine_name}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">{t.problem_title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.description}</p>
                </div>

                <button
                  onClick={() => setSelectedTicket(t)}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-bold rounded-lg shadow-sm transition shrink-0 flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Dispatch Technician
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Work Orders & Verification Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Active Work Orders & Handover Verification</h3>
          <p className="text-xs text-slate-500">Track active repair timers, root causes and sign off machine restoration</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">WO Number</th>
                <th className="px-6 py-3">Machine</th>
                <th className="px-6 py-3">Assigned Tech</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Downtime Minutes</th>
                <th className="px-6 py-3 text-right">Manager Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workOrders.map((wo) => {
                const isCompleted = wo.status === 'repair_completed';
                const isClosed = wo.status === 'verified_closed';

                return (
                  <tr key={wo.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{wo.wo_number}</td>
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-800">{wo.machine_code}</div>
                      <div className="text-[11px] text-slate-400">{wo.machine_name}</div>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-700">{wo.technician_name || 'Sunil Yadav'}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        isClosed ? 'bg-emerald-100 text-emerald-800' : isCompleted ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {wo.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-700">
                      {wo.total_downtime_minutes || wo.active_repair_minutes || 0} mins
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {isCompleted ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerify(wo.id, 'APPROVED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] shadow-sm transition"
                          >
                            Verify & Restore Machine
                          </button>
                          <button
                            onClick={() => handleVerify(wo.id, 'REJECTED')}
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded text-[11px] transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : isClosed ? (
                        <span className="text-[11px] font-semibold text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Machine Restored
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Repair in progress</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Dispatch Technician for {selectedTicket.ticket_number}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Machine: {selectedTicket.machine_code} ({selectedTicket.machine_name})
            </p>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Specialist</label>
                <input
                  type="text"
                  disabled
                  value="Sunil Yadav (Senior Electrical & PLC Tech - Shift A Roster)"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">SLA Resolution Hours</label>
                <select
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="1">1 Hour (Class A Critical Bottleneck)</option>
                  <option value="2">2 Hours (Standard Breakdown SLA)</option>
                  <option value="4">4 Hours (Non-Critical Machine)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Work & Safety Instructions</label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="px-4 py-2 bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-bold rounded-lg shadow-sm"
                >
                  {assigning ? 'Allocating...' : 'Confirm Work Order Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

