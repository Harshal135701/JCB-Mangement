import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/client';
import { useSocket } from '../../../context/SocketContext';
import {
  HardHat,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Layers,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { OperatorMachineAssignment } from '../../operator/types/operator-assignment.types';

interface OperatorMachineRequestsCardProps {
  selectedPlantId?: string;
}

export const OperatorMachineRequestsCard: React.FC<OperatorMachineRequestsCardProps> = ({
  selectedPlantId,
}) => {
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');
  const [pendingRequests, setPendingRequests] = useState<OperatorMachineAssignment[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<OperatorMachineAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reject Modal State
  const [rejectingItem, setRejectingItem] = useState<OperatorMachineAssignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Force Sign Out Modal
  const [releasingItem, setReleasingItem] = useState<OperatorMachineAssignment | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const [pendingRes, activeRes] = await Promise.all([
        apiClient.get('/machines/operator/requests/pending', {
          params: selectedPlantId ? { plant_id: selectedPlantId } : {},
        }),
        apiClient.get('/machines/operator/assignments/active', {
          params: selectedPlantId ? { plant_id: selectedPlantId } : {},
        }),
      ]);

      setPendingRequests(pendingRes.data?.data || []);
      setActiveAssignments(activeRes.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load operator machine requests:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to fetch operator machine sign-in requests.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedPlantId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time Socket.IO Listeners for live updates on manager dashboard
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchRequests();
    };

    socket.on('operator:machine_requested', handleUpdate);
    socket.on('operator:machine_approved', handleUpdate);
    socket.on('operator:machine_rejected', handleUpdate);
    socket.on('operator:machine_released', handleUpdate);

    return () => {
      socket.off('operator:machine_requested', handleUpdate);
      socket.off('operator:machine_approved', handleUpdate);
      socket.off('operator:machine_rejected', handleUpdate);
      socket.off('operator:machine_released', handleUpdate);
    };
  }, [socket, fetchRequests]);

  // Action: Manager Approves Request
  const handleApprove = async (assignment: OperatorMachineAssignment) => {
    try {
      setActionLoadingId(assignment.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      await apiClient.post(`/machines/operator/requests/${assignment.id}/approve`);

      setSuccessMessage(
        `Approved sign-in for ${assignment.operator_name || 'operator'} on machine ${assignment.machine_code}. Machine marked occupied.`
      );
      fetchRequests();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to approve machine sign-in request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Manager Rejects Request
  const handleConfirmReject = async () => {
    if (!rejectingItem) return;

    try {
      setActionLoadingId(rejectingItem.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      await apiClient.post(`/machines/operator/requests/${rejectingItem.id}/reject`, {
        rejection_reason: rejectionReason.trim() || undefined,
      });

      setSuccessMessage(
        `Rejected sign-in request for machine ${rejectingItem.machine_code}. Machine reservation released.`
      );
      setRejectingItem(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to reject machine sign-in request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Manager Force Release / Sign Out
  const handleConfirmRelease = async () => {
    if (!releasingItem) return;

    try {
      setActionLoadingId(releasingItem.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      await apiClient.post(`/machines/operator/sign-out`, {
        assignment_id: releasingItem.id,
      });

      setSuccessMessage(
        `Machine ${releasingItem.machine_code} released successfully. Shift session ended.`
      );
      setReleasingItem(null);
      fetchRequests();
    } catch (err: any) {
      console.error('Release failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to release machine session.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden">
      {/* Top Banner Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-extrabold shadow-2xs shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                Operator Machine Sign-In & Floor Supervision
              </h3>
              {pendingRequests.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-black bg-amber-500 text-black animate-pulse">
                  {pendingRequests.length} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Review real-time machine sign-in requests, manage shift occupancy, and approve floor sessions.
            </p>
          </div>
        </div>

        {/* Action Controls & Tab Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-bold text-zinc-600">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                  : 'hover:text-zinc-900'
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                  : 'hover:text-zinc-900'
              }`}
            >
              Active Sessions ({activeAssignments.length})
            </button>
          </div>

          <button
            onClick={fetchRequests}
            disabled={loading}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            title="Refresh requests"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="mx-4 sm:mx-5 mt-4 p-3 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-800 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mx-4 sm:mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-800 font-bold px-2 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab Content 1: PENDING REQUESTS QUEUE */}
      {activeTab === 'pending' && (
        <div className="p-4 sm:p-5">
          {loading && pendingRequests.length === 0 ? (
            <div className="space-y-3">
              {[1, 2].map((n) => (
                <div key={n} className="h-20 bg-zinc-50 rounded-xl animate-pulse border border-zinc-100" />
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="py-8 text-center bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-zinc-700">All machine sign-in requests reviewed</p>
              <p className="text-2xs text-zinc-500 mt-0.5">
                New operator requests will appear here instantly via real-time sync.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-2xs font-extrabold text-zinc-500 uppercase tracking-wider bg-zinc-50/80">
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3">Machine</th>
                    <th className="py-2.5 px-3">Shop & Plant</th>
                    <th className="py-2.5 px-3">Shift & Time</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-amber-50/20 transition">
                      {/* Operator Info */}
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-zinc-900">
                          {req.operator_name || req.operator_code || 'Operator'}
                        </div>
                        <div className="text-2xs text-zinc-500">
                          Code: {req.operator_code || 'N/A'} {req.operator_email ? `• ${req.operator_email}` : ''}
                        </div>
                      </td>

                      {/* Machine Info */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-black text-zinc-900">
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-2xs font-mono font-bold">
                            {req.machine_code}
                          </span>
                          <span className="truncate max-w-[160px]">{req.machine_name}</span>
                        </div>
                        <div className="text-2xs text-zinc-500 mt-0.5">
                          {req.machine_category} {req.bay_line_location ? `• ${req.bay_line_location}` : ''}
                        </div>
                      </td>

                      {/* Shop & Plant */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-800">{req.shop_name}</div>
                        <div className="text-2xs text-zinc-500">{req.plant_name}</div>
                      </td>

                      {/* Shift & Time */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-700">{req.shift || 'Shift A'}</div>
                        <div className="text-2xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          {new Date(req.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Actions: Approve / Reject */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req)}
                            disabled={actionLoadingId === req.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{actionLoadingId === req.id ? 'Approving...' : 'Approve'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingItem(req);
                              setRejectionReason('');
                            }}
                            disabled={actionLoadingId === req.id}
                            className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
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

      {/* Tab Content 2: ACTIVE SHOP FLOOR SESSIONS */}
      {activeTab === 'active' && (
        <div className="p-4 sm:p-5">
          {activeAssignments.length === 0 ? (
            <div className="py-8 text-center bg-zinc-50/60 rounded-xl border border-dashed border-zinc-200">
              <HardHat className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-zinc-700">No active operator machine sessions</p>
              <p className="text-2xs text-zinc-500 mt-0.5">
                Approved machine assignments will appear here during live shifts.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-2xs font-extrabold text-zinc-500 uppercase tracking-wider bg-zinc-50/80">
                    <th className="py-2.5 px-3">Machine</th>
                    <th className="py-2.5 px-3">Assigned Operator</th>
                    <th className="py-2.5 px-3">Shop & Plant</th>
                    <th className="py-2.5 px-3">Signed In At</th>
                    <th className="py-2.5 px-3 text-right">Floor Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {activeAssignments.map((session) => (
                    <tr key={session.id} className="hover:bg-zinc-50 transition">
                      {/* Machine */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-black text-zinc-900">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-2xs font-mono font-bold">
                            {session.machine_code}
                          </span>
                          <span>{session.machine_name}</span>
                        </div>
                        <div className="text-2xs text-zinc-500 mt-0.5">
                          {session.bay_line_location || 'Shop Floor'}
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-zinc-900">{session.operator_name || 'Operator'}</div>
                        <div className="text-2xs text-zinc-500">
                          ID: {session.operator_code || 'N/A'} • {session.shift || 'Shift A'}
                        </div>
                      </td>

                      {/* Shop & Plant */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-800">{session.shop_name}</div>
                        <div className="text-2xs text-zinc-500">{session.plant_name}</div>
                      </td>

                      {/* Signed In At */}
                      <td className="py-3 px-3">
                        <div className="text-zinc-700 font-medium">
                          {session.signed_in_at
                            ? new Date(session.signed_in_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Active'}
                        </div>
                        {session.approver_name && (
                          <div className="text-2xs text-zinc-500">By {session.approver_name}</div>
                        )}
                      </td>

                      {/* Floor Action: Force Release */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setReleasingItem(session)}
                          className="px-2.5 py-1 text-2xs font-extrabold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition cursor-pointer"
                        >
                          Release Machine
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-zinc-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-zinc-900">
                  Reject Machine Sign-In Request
                </h4>
                <p className="text-2xs text-zinc-500">
                  {rejectingItem.operator_name} requested machine {rejectingItem.machine_code}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Rejecting this request will immediately release the machine reservation so other operators can access it. Please specify a reason for the operator:
            </p>

            {/* Quick Reason Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Assigned to different line today',
                'Scheduled for PM / maintenance',
                'Machine reserved for high-priority order',
                'Shift schedule mismatch',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setRejectionReason(chip)}
                  className={`px-2.5 py-1 rounded-lg text-2xs font-semibold border transition cursor-pointer ${
                    rejectionReason === chip
                      ? 'bg-red-50 border-red-300 text-red-800 font-bold'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Reason Text Area */}
            <textarea
              rows={3}
              placeholder="Enter custom rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-red-400"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingItem(null);
                  setRejectionReason('');
                }}
                disabled={actionLoadingId === rejectingItem.id}
                className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoadingId === rejectingItem.id}
                className="px-4 py-1.5 text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === rejectingItem.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Release Confirmation Modal */}
      {releasingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-zinc-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-zinc-900">
                  Release Machine Session?
                </h4>
                <p className="text-2xs text-zinc-500">
                  {releasingItem.machine_code} ({releasingItem.operator_name})
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to release machine <strong>{releasingItem.machine_code}</strong>?
              This will end the active operator floor session and return the machine to available status.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReleasingItem(null)}
                disabled={actionLoadingId === releasingItem.id}
                className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelease}
                disabled={actionLoadingId === releasingItem.id}
                className="px-4 py-1.5 text-xs font-extrabold bg-zinc-900 hover:bg-black text-amber-400 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoadingId === releasingItem.id ? 'Releasing...' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
