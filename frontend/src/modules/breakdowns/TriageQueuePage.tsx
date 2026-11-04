import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  AlertCircle, 
  UserCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Plus, 
  X, 
  Wrench, 
  Play, 
  Search,
  Check,
  AlertTriangle,
  FileText
} from 'lucide-react';

export const TriageQueuePage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isTechnician = user?.role === 'technician';
  const isOperator = user?.role === 'operator';

  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [selectedWO, setSelectedWO] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Report Breakdown Form
  const [reportForm, setReportForm] = useState({
    machine_id: '',
    shift: 'Shift A',
    issue_category: 'Hydraulic',
    priority: 'high',
    problem_title: '',
    description: '',
    hour_meter_reading: 4500,
  });

  // Assign Modal Form
  const [assignTechId, setAssignTechId] = useState('');
  const [slaHours, setSlaHours] = useState('2');
  const [instructions, setInstructions] = useState('Inspect valve body, check sensor telemetry, adhere to Lockout-Tagout (LOTO).');

  // Verify Modal Form
  const [verifyNotes, setVerifyNotes] = useState('Trial run verified. Machine operating under nominal cycle tolerances.');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsRes, woRes, machRes] = await Promise.all([
        apiClient.get('/breakdowns'),
        apiClient.get('/work-orders'),
        apiClient.get('/machines?limit=100'),
      ]);
      setBreakdowns(ticketsRes.data.data || []);
      setWorkOrders(woRes.data.data || []);
      setMachines(machRes.data.data || []);

      // If manager or admin, fetch technicians list
      try {
        const usersRes = await apiClient.get('/auth/users');
        if (usersRes.data.success) {
          const techs = usersRes.data.data.filter((u: any) => u.role === 'technician' && u.is_active !== false);
          setTechnicians(techs);
          if (techs.length > 0 && !assignTechId) {
            setAssignTechId(techs[0].id);
          }
        }
      } catch (uErr) {
        // Fallback default technician
        setTechnicians([
          { id: 'f0000000-0000-0000-0000-000000000003', full_name: 'Sunil Yadav', employee_code: 'EMP-TCH-001' }
        ]);
        setAssignTechId('f0000000-0000-0000-0000-000000000003');
      }
    } catch (e) {
      console.error('Failed to load triage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.machine_id) {
      alert('Please select a machine.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/breakdowns', reportForm);
      if (res.data.success) {
        alert(res.data.message || `Breakdown ticket ${res.data.data?.complaint_number} registered!`);
        setIsReportModalOpen(false);
        setReportForm({
          machine_id: '',
          shift: 'Shift A',
          issue_category: 'Hydraulic',
          priority: 'high',
          problem_title: '',
          description: '',
          hour_meter_reading: 4500,
        });
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit breakdown ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !assignTechId) return;

    try {
      setActionLoading(true);
      const payload = {
        complaint_id: selectedTicket.id,
        technician_id: assignTechId,
        sla_hours: parseInt(slaHours, 10) || 2,
        work_instructions: instructions,
      };

      const res = await apiClient.post('/work-orders/assign', payload);
      if (res.data.success) {
        alert(res.data.message || 'Work order created and technician dispatched!');
        setSelectedTicket(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to allocate technician.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMilestone = async (woId: string, milestone: string) => {
    try {
      const res = await apiClient.post(`/work-orders/${woId}/milestone`, { milestone });
      if (res.data.success) {
        alert(`Status updated: ${milestone.replace('_', ' ').toUpperCase()}`);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Status update failed.');
    }
  };

  const handleVerifySubmit = async (result: 'APPROVED' | 'REJECTED') => {
    if (!selectedWO) return;
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/work-orders/${selectedWO.id}/verify`, {
        verification_result: result,
        verification_notes: verifyNotes,
      });
      if (res.data.success) {
        alert(res.data.message || `Work order ${result === 'APPROVED' ? 'closed and verified' : 'returned for rework'}.`);
        setSelectedWO(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">BREAKDOWN TRIAGE & WORK ORDER ENGINE</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Explicit separation of Operator Breakdown Complaints (CMP) and Technician Maintenance Work Orders (WO) with dual downtime clock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>REPORT BREAKDOWN (CMP)</span>
          </button>
        </div>
      </div>

      {/* Grid: 2 Columns (Left: Open Complaints Triage | Right: Active Work Orders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Operator Breakdown Complaints (CMP) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                Unassigned Breakdown Complaints ({breakdowns.filter(b => b.status === 'new' || b.status === 'pending_review').length})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {breakdowns.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border-2 border-zinc-200 text-center text-zinc-400 text-xs font-bold">
                No active operator complaints. All machines operational.
              </div>
            ) : (
              breakdowns.map((ticket) => (
                <div 
                  key={ticket.id}
                  className="bg-white p-5 rounded-2xl border-2 border-zinc-200 hover:border-zinc-400 shadow-sm transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-amber-700">{ticket.complaint_number}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          ticket.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-950 mt-1">{ticket.problem_title}</h4>
                      <p className="text-xs text-zinc-500 font-medium">
                        Machine: <strong className="text-black">{ticket.machine_code}</strong> ({ticket.machine_name})
                      </p>
                    </div>

                    <span className="text-[11px] text-zinc-400 font-mono font-bold">
                      {ticket.reported_at ? new Date(ticket.reported_at).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 font-medium">
                    {ticket.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs">
                    <span className="text-zinc-500 font-semibold">Category: <strong>{ticket.issue_category}</strong></span>

                    {isManager && ticket.status !== 'work_order_created' && ticket.status !== 'closed' && (
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm border border-amber-500 uppercase tracking-wider"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Dispatch Tech</span>
                      </button>
                    )}
                    {ticket.status === 'work_order_created' && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-1 rounded text-[10px] font-black uppercase">
                        WO Dispatched
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Active Maintenance Work Orders (WO) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                Work Orders in Progress ({workOrders.filter(w => w.status !== 'verified_closed').length})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {workOrders.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border-2 border-zinc-200 text-center text-zinc-400 text-xs font-bold">
                No active work orders in execution.
              </div>
            ) : (
              workOrders.map((wo) => {
                const isAssigned = wo.status === 'assigned';
                const isDiagnosis = wo.status === 'under_diagnosis';
                const isInProgress = wo.status === 'in_progress';
                const isSubmitted = wo.status === 'submitted_verification';
                const isClosed = wo.status === 'verified_closed';

                return (
                  <div
                    key={wo.id}
                    className="bg-white p-5 rounded-2xl border-2 border-zinc-200 hover:border-zinc-400 shadow-sm transition space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-zinc-950">{wo.wo_number}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            isClosed ? 'bg-zinc-100 text-zinc-600' : 'bg-blue-100 text-blue-900'
                          }`}>
                            {wo.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-zinc-950 mt-1">Machine: {wo.machine_code || 'Industrial Asset'}</h4>
                        <p className="text-xs text-zinc-500 font-medium">
                          Technician: <strong className="text-black">{wo.technician_name || 'Assigned Tech'}</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          SLA: {wo.sla_deadline ? new Date(wo.sla_deadline).toLocaleTimeString() : '2 hrs'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 font-medium">
                      Instructions: {wo.work_instructions || 'Diagnose and restore machine operating condition.'}
                    </p>

                    {/* Milestone & Verification Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                      <div className="flex items-center gap-2">
                        {/* Technician Milestone Buttons */}
                        {(isTechnician || isManager) && !isClosed && (
                          <div className="flex items-center gap-1.5">
                            {isAssigned && (
                              <button
                                onClick={() => handleMilestone(wo.id, 'accepted')}
                                className="bg-zinc-900 hover:bg-black text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              >
                                Accept Job
                              </button>
                            )}
                            {(isAssigned || wo.status === 'accepted') && (
                              <button
                                onClick={() => handleMilestone(wo.id, 'under_diagnosis')}
                                className="bg-amber-500 hover:bg-amber-600 text-black text-[11px] font-black px-2.5 py-1 rounded-lg"
                              >
                                Under Diagnosis
                              </button>
                            )}
                            {isDiagnosis && (
                              <button
                                onClick={() => handleMilestone(wo.id, 'in_progress')}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              >
                                In Progress
                              </button>
                            )}
                            {isInProgress && (
                              <button
                                onClick={() => handleMilestone(wo.id, 'submitted_verification')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-2.5 py-1 rounded-lg"
                              >
                                Submit Complete
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Manager Verification */}
                      {isManager && isSubmitted && (
                        <button
                          onClick={() => setSelectedWO(wo)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-lg text-xs shadow flex items-center gap-1 uppercase tracking-wider"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify & Close</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal: Report Breakdown Complaint (Operator) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-red-600 text-white font-black text-xl px-2.5 py-0.5 rounded shadow">
                  CMP
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  REPORT MACHINE BREAKDOWN COMPLAINT
                </h3>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Select Machine Asset *
                </label>
                <select
                  required
                  value={reportForm.machine_id}
                  onChange={(e) => setReportForm({ ...reportForm, machine_id: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="">-- Choose machine from plant registry --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.machine_code} - {m.name} ({m.bay_line_location || 'Bay 1'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Issue Category *
                  </label>
                  <select
                    value={reportForm.issue_category}
                    onChange={(e) => setReportForm({ ...reportForm, issue_category: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="Hydraulic">Hydraulic System</option>
                    <option value="Mechanical">Mechanical Drive / Gearbox</option>
                    <option value="Electrical">Electrical / Motor / Drive</option>
                    <option value="PLC / Automation">PLC / CNC Controller / Sensors</option>
                    <option value="Pneumatic">Pneumatics / Air Pressure</option>
                    <option value="Tooling">Spindle / Tooling Jam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Breakdown Severity / Priority
                  </label>
                  <select
                    value={reportForm.priority}
                    onChange={(e) => setReportForm({ ...reportForm, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="critical">Critical (Line Stoppage / Bottleneck)</option>
                    <option value="high">High (Machine Down / Secondary Available)</option>
                    <option value="medium">Medium (Abnormal Noise / Vibration)</option>
                    <option value="low">Low (Minor Sensor / Warning Light)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Problem Title *
                </label>
                <input
                  type="text"
                  required
                  value={reportForm.problem_title}
                  onChange={(e) => setReportForm({ ...reportForm, problem_title: e.target.value })}
                  placeholder="e.g. Spindle servo error 401 or Hydraulic pressure drop"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Symptoms & Observations *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  placeholder="Detail visible symptoms, smell, hydraulic leaks, or error codes displayed on HMI panel..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow disabled:opacity-50"
                >
                  {actionLoading ? 'Logging...' : 'Submit Breakdown Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Dispatch Technician & Create WO (Manager) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-base font-black text-white tracking-wide">
                DISPATCH TECHNICIAN: {selectedTicket.complaint_number}
              </h3>
              <button onClick={() => setSelectedTicket(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <p className="font-bold text-zinc-950">{selectedTicket.problem_title}</p>
                <p className="text-zinc-500 mt-1">Machine: <strong>{selectedTicket.machine_code}</strong></p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Assign Maintenance Technician *
                </label>
                <select
                  required
                  value={assignTechId}
                  onChange={(e) => setAssignTechId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.employee_code}) - {t.department || 'Mechanical'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Expected Resolution SLA (Hours) *
                </label>
                <select
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="1">1 Hour (Critical Line Stop)</option>
                  <option value="2">2 Hours (Standard Breakdown SLA)</option>
                  <option value="4">4 Hours (Complex Electrical / Hydraulic)</option>
                  <option value="8">8 Hours (Scheduled Shift Repair)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Work Instructions & Safety SOP
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow border border-amber-500 disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Authorize & Dispatch WO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Verify & Close Work Order (Manager) */}
      {selectedWO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <h3 className="text-base font-black text-white tracking-wide">
                VERIFY WORK ORDER: {selectedWO.wo_number}
              </h3>
              <button onClick={() => setSelectedWO(null)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-200 text-xs">
                <p className="font-bold text-zinc-950">Machine: {selectedWO.machine_code}</p>
                <p className="text-zinc-500 mt-1">Technician: {selectedWO.technician_name}</p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Manager Verification Notes *
                </label>
                <textarea
                  rows={3}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Verify cycle time test, part alignment, safety interlocks restored..."
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div className="pt-4 border-t border-zinc-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleVerifySubmit('REJECTED')}
                  disabled={actionLoading}
                  className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 font-bold px-4 py-2 rounded-xl text-xs uppercase transition"
                >
                  Rework Required
                </button>
                <button
                  type="button"
                  onClick={() => handleVerifySubmit('APPROVED')}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-2 rounded-xl text-xs uppercase tracking-wider transition shadow"
                >
                  Approve & Close Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
