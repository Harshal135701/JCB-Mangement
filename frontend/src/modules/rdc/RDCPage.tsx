import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  FileText, 
  CheckCircle, 
  Truck, 
  AlertTriangle, 
  Plus, 
  X, 
  CheckCircle2, 
  Clock, 
  Calendar 
} from 'lucide-react';

export const RDCPage: React.FC = () => {
  const { user } = useAuth();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const [rdcs, setRdcs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    rdc_type: 'RDC',
    vendor_party_name: '',
    purpose: 'Spindle Bearing Overhaul & Dynamic Balancing',
    machine_id: '',
    expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  const fetchRDCs = async () => {
    try {
      setLoading(true);
      const [rdcRes, machRes] = await Promise.all([
        apiClient.get('/rdc'),
        apiClient.get('/machines?limit=50'),
      ]);
      setRdcs(rdcRes.data.data || []);
      setMachines(machRes.data.data || []);
    } catch (e) {
      console.error('Failed to load RDCs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRDCs();
  }, []);

  const handleCreateRDC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendor_party_name || !formData.purpose) {
      alert('Please fill vendor and purpose.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post('/rdc', formData);
      if (res.data.success) {
        alert(res.data.message || `RDC Challan ${res.data.data?.challan_number} created!`);
        setIsModalOpen(false);
        fetchRDCs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create RDC.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const gatePassNum = 'GP-' + Math.floor(10000 + Math.random() * 90000);
      const res = await apiClient.put(`/rdc/${id}/approve`, {
        gate_pass_number: gatePassNum,
      });
      if (res.data.success) {
        alert(`RDC approved! Factory Gate Pass issued: ${gatePassNum}`);
        fetchRDCs();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Approval failed.');
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      const res = await apiClient.put(`/rdc/${id}/dispatch`, {
        vehicle_number: 'HR-29-BA-' + Math.floor(1000 + Math.random() * 9000),
      });
      if (res.data.success) {
        alert('RDC marked outward dispatched through factory security gate.');
        fetchRDCs();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Dispatch update failed.');
    }
  };

  const handleReturn = async (id: string) => {
    try {
      const res = await apiClient.post(`/rdc/${id}/return`, {
        received_items: [{ item_id: 'sample', quantity_returned: 1, quality_status: 'ACCEPTED' }],
        security_inward_pass: 'SEC-IN-' + Math.floor(1000 + Math.random() * 9000),
      });
      if (res.data.success) {
        alert('Material inwarded and closed with Quality acceptance!');
        fetchRDCs();
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Return failed.');
    }
  };

  return (
    <div className="space-y-6 bg-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border-2 border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">RETURNABLE DELIVERY CHALLAN (RDC)</h2>
            <span className="bg-jcb-yellow text-black text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500 shadow-sm">
              Factory Gate Control
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-medium mt-1">
            Track capital spindle overhauls, servo motor rewinding, hydraulic cylinder rebuilds, and outward vendor movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-xs font-black px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 border border-amber-500"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE RDC GATE PASS</span>
          </button>
        </div>
      </div>

      {/* RDC Table */}
      <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-black uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Challan Number</th>
                <th className="px-6 py-3.5">External Vendor / Party</th>
                <th className="px-6 py-3.5">Overhaul Purpose</th>
                <th className="px-6 py-3.5">Expected Return</th>
                <th className="px-6 py-3.5">Security Gate Pass</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Gate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    Loading challans...
                  </td>
                </tr>
              ) : rdcs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-zinc-400 font-bold">
                    No active returnable challans in movement.
                  </td>
                </tr>
              ) : (
                rdcs.map((rdc) => {
                  const isPending = rdc.status === 'pending_approval';
                  const isApproved = rdc.status === 'approved';
                  const isDispatched = rdc.status === 'dispatched';
                  const isReturned = rdc.status === 'fully_returned';

                  return (
                    <tr key={rdc.id} className="hover:bg-zinc-50/70 transition">
                      <td className="px-6 py-3.5">
                        <div className="font-mono text-xs font-black text-amber-700">{rdc.challan_number}</div>
                        <div className="text-[10px] text-zinc-400 font-bold">{rdc.rdc_type}</div>
                      </td>
                      <td className="px-6 py-3.5 font-bold text-zinc-950">
                        {rdc.vendor_party_name}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-700 font-medium">
                        {rdc.purpose}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 font-mono font-bold text-zinc-800">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{rdc.expected_return_date ? new Date(rdc.expected_return_date).toLocaleDateString() : '7 Days'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono font-bold text-zinc-900">
                        {rdc.gate_pass_number || 'Awaiting Approval'}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isReturned 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : isDispatched 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isApproved 
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}>
                          {rdc.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isManager && isPending && (
                            <button
                              onClick={() => handleApprove(rdc.id)}
                              className="bg-jcb-yellow hover:bg-jcb-yellowDark text-black text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm border border-amber-500 uppercase tracking-wider"
                            >
                              Approve
                            </button>
                          )}
                          {isApproved && (
                            <button
                              onClick={() => handleDispatch(rdc.id)}
                              className="bg-zinc-900 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider"
                            >
                              Dispatch Gate
                            </button>
                          )}
                          {isDispatched && (
                            <button
                              onClick={() => handleReturn(rdc.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider"
                            >
                              Inward Return
                            </button>
                          )}
                          {isReturned && (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Closed</span>
                            </span>
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
      </div>

      {/* Modal: Create RDC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="bg-jcb-yellow text-black font-black text-xl px-2.5 py-0.5 rounded shadow">
                  RDC
                </div>
                <h3 className="text-base font-black text-white tracking-wide">
                  ISSUE RETURNABLE DELIVERY CHALLAN
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRDC} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Vendor / Service Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vendor_party_name}
                  onChange={(e) => setFormData({ ...formData, vendor_party_name: e.target.value })}
                  placeholder="e.g. Siemens Drive Care Center / Rexroth Hydraulics"
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                  Outward Purpose / Service Required *
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                >
                  <option value="Spindle Bearing Overhaul & Dynamic Balancing">Spindle Bearing Overhaul & Balancing</option>
                  <option value="AC Servo Motor Stator Rewinding">AC Servo Motor Stator Rewinding</option>
                  <option value="Hydraulic Cylinder Seal & Rod Reconditioning">Hydraulic Cylinder Seal & Rod Reconditioning</option>
                  <option value="CNC Controller PCB Calibration & Repair">CNC Controller PCB Calibration & Repair</option>
                  <option value="Heavy Gearbox Re-shimming">Heavy Gearbox Re-shimming</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Related Machine Asset
                  </label>
                  <select
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-jcb-yellow"
                  >
                    <option value="">-- Standalone Component --</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.machine_code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-zinc-700 uppercase mb-1">
                    Expected Return Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expected_return_date}
                    onChange={(e) => setFormData({ ...formData, expected_return_date: e.target.value })}
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
                  {actionLoading ? 'Creating...' : 'Issue RDC Gate Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
