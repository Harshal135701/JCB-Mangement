import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { useSocket } from '../../../context/SocketContext';
import {
  HardHat,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  LogOut,
  Building2,
  Layers,
  Wrench,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Info,
  ArrowRight,
  Repeat,
  ShieldCheck,
} from 'lucide-react';
import {
  OperatorMachineAssignment,
  MachineAvailabilityItem,
  PermanentMachineInfo,
} from '../types/operator-assignment.types';

interface OperatorMachineSignInCardProps {
  permanentMachine?: PermanentMachineInfo | null;
  canRequestTemporary?: boolean;
  currentAssignment: OperatorMachineAssignment | null;
  recentRejected: OperatorMachineAssignment | null;
  hierarchy: any;
  user: any;
  onAssignmentChange: () => void;
  onRequestTemporaryClick?: () => void;
}

export const OperatorMachineSignInCard: React.FC<OperatorMachineSignInCardProps> = ({
  permanentMachine,
  canRequestTemporary = false,
  currentAssignment,
  recentRejected,
  hierarchy,
  user,
  onAssignmentChange,
  onRequestTemporaryClick,
}) => {
  const { socket } = useSocket();

  // Selection states
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [availableMachines, setAvailableMachines] = useState<MachineAvailabilityItem[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('Shift A');
  const [signInNotes, setSignInNotes] = useState<string>('');

  // UI state
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [showTemporaryRequestDrawer, setShowTemporaryRequestDrawer] = useState(false);
  const [dismissedRejectedId, setDismissedRejectedId] = useState<string | null>(null);

  // Available plants from hierarchy
  const plants = hierarchy?.plants || [];

  // Filter shops by selected plant
  const availableShops = React.useMemo(() => {
    if (!selectedPlantId || !hierarchy?.shops) return [];
    return hierarchy.shops.filter((s: any) => s.plant_id === selectedPlantId);
  }, [selectedPlantId, hierarchy]);

  // Initial plant & shop setup: default to user's plant and shop if available
  useEffect(() => {
    if (plants.length > 0 && !selectedPlantId) {
      const defaultPlant = user?.plantId
        ? plants.find((p: any) => p.id === user.plantId)
        : plants[0];
      if (defaultPlant) {
        setSelectedPlantId(defaultPlant.id);
      }
    }
  }, [plants, user, selectedPlantId]);

  useEffect(() => {
    if (availableShops.length > 0) {
      const matchShop = user?.shopId
        ? availableShops.find((s: any) => s.id === user.shopId)
        : null;
      setSelectedShopId(matchShop ? matchShop.id : availableShops[0].id);
    } else {
      setSelectedShopId('');
    }
  }, [selectedPlantId, availableShops, user]);

  // Fetch machines whenever selectedShopId changes
  const fetchAvailableMachines = async (shopId: string, plantId: string) => {
    if (!shopId) {
      setAvailableMachines([]);
      return;
    }
    try {
      setLoadingMachines(true);
      setErrorMessage(null);
      const res = await apiClient.get('/machines/operator/available-machines', {
        params: { shop_id: shopId, plant_id: plantId },
      });
      setAvailableMachines(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to fetch machines for shop:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to fetch machines for the selected shop.'
      );
    } finally {
      setLoadingMachines(false);
    }
  };

  useEffect(() => {
    if (selectedShopId && selectedPlantId && (!currentAssignment || showTemporaryRequestDrawer)) {
      fetchAvailableMachines(selectedShopId, selectedPlantId);
    }
  }, [selectedShopId, selectedPlantId, currentAssignment, showTemporaryRequestDrawer]);

  // Real-time socket event listeners for live availability and approval status
  useEffect(() => {
    if (!socket) return;

    const handleApproved = (payload: any) => {
      if (payload.operator_id === user?.id) {
        setSuccessMessage(`Sign-in approved! You are now assigned to machine ${payload.machine_code}.`);
        setShowTemporaryRequestDrawer(false);
        onAssignmentChange();
      } else if (payload.shop_id === selectedShopId) {
        fetchAvailableMachines(selectedShopId, selectedPlantId);
      }
    };

    const handleRejected = (payload: any) => {
      if (payload.operator_id === user?.id) {
        onAssignmentChange();
      }
    };

    const handleReleased = (payload: any) => {
      if (payload.operator_id === user?.id) {
        setSuccessMessage('Machine released successfully.');
        onAssignmentChange();
      }
      if (payload.shop_id === selectedShopId) {
        fetchAvailableMachines(selectedShopId, selectedPlantId);
      }
    };

    const handleRequested = (payload: any) => {
      if (payload.shop_id === selectedShopId && payload.operator_id !== user?.id) {
        fetchAvailableMachines(selectedShopId, selectedPlantId);
      }
    };

    socket.on('operator:machine_approved', handleApproved);
    socket.on('operator:machine_rejected', handleRejected);
    socket.on('operator:machine_released', handleReleased);
    socket.on('operator:machine_requested', handleRequested);

    return () => {
      socket.off('operator:machine_approved', handleApproved);
      socket.off('operator:machine_rejected', handleRejected);
      socket.off('operator:machine_released', handleReleased);
      socket.off('operator:machine_requested', handleRequested);
    };
  }, [socket, user, selectedShopId, selectedPlantId]);

  // Operator Action: Submit Machine Sign-In or Temporary Request
  const handleRequestSignIn = async (isTemporary: boolean = false) => {
    if (!selectedMachineId) {
      setErrorMessage('Please select an available machine before submitting request.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const defaultNotes = isTemporary && permanentMachine
        ? `Temporary replacement for ${permanentMachine.machine_code} due to machine unavailability.`
        : signInNotes.trim();

      await apiClient.post('/machines/operator/sign-in', {
        machine_id: selectedMachineId,
        shop_id: selectedShopId,
        plant_id: selectedPlantId,
        shift: selectedShift,
        notes: signInNotes.trim() || defaultNotes || undefined,
        assignment_type: isTemporary ? 'temporary' : 'shift',
        replacement_for_machine_id: isTemporary && permanentMachine ? permanentMachine.id : undefined,
        breakdown_id: isTemporary && permanentMachine?.active_breakdown ? permanentMachine.active_breakdown.id : undefined,
      });

      setSuccessMessage(
        isTemporary
          ? 'Temporary machine request submitted! Awaiting plant manager approval.'
          : 'Sign-in request submitted! Waiting for manager approval.'
      );
      setSelectedMachineId('');
      setSignInNotes('');
      setShowTemporaryRequestDrawer(false);
      onAssignmentChange();
    } catch (err: any) {
      console.error('Request failed:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to submit machine sign-in request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Operator Action: Cancel Pending Request
  const handleCancelRequest = async () => {
    if (!currentAssignment || currentAssignment.status !== 'pending') return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await apiClient.post('/machines/operator/cancel-request', {
        assignment_id: currentAssignment.id,
      });

      setSuccessMessage('Sign-in request cancelled. Machine reservation released.');
      onAssignmentChange();
    } catch (err: any) {
      console.error('Failed to cancel request:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to cancel request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Operator Action: Release Machine / Sign Out / Return to Permanent Machine
  const handleSignOut = async (isReturningToPermanent: boolean = false) => {
    if (!currentAssignment || currentAssignment.status !== 'approved') return;

    try {
      setSubmitting(true);
      setErrorMessage(null);

      await apiClient.post('/machines/operator/sign-out', {
        assignment_id: currentAssignment.id,
      });

      setShowSignOutConfirm(false);
      setShowReturnConfirm(false);
      setSuccessMessage(
        isReturningToPermanent
          ? `Temporary machine released. Restored ${permanentMachine?.machine_code || 'Permanent Machine'} as your default working asset!`
          : 'Successfully signed out from machine. Shift session closed.'
      );
      onAssignmentChange();
    } catch (err: any) {
      console.error('Failed to sign out:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to sign out of machine.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMachine = availableMachines.find((m) => m.id === selectedMachineId);

  // Status helper for permanent machine
  const permStatus = (permanentMachine?.status || 'RUNNING').toUpperCase();
  const isPermanentBroken =
    permStatus === 'BREAKDOWN' ||
    permStatus === 'UNDER_MAINTENANCE' ||
    permStatus === 'AWAITING_PARTS' ||
    permStatus === 'AWAITING_VERIFICATION' ||
    !!permanentMachine?.active_breakdown;

  // Is current working machine different from permanent machine?
  const isTemporaryActive =
    currentAssignment &&
    currentAssignment.status === 'approved' &&
    (currentAssignment.assignment_type === 'temporary' ||
      !!currentAssignment.replacement_for_machine_id ||
      (permanentMachine && currentAssignment.machine_id !== permanentMachine.id));

  const isPermanentRepairedAndReady =
    isTemporaryActive &&
    permanentMachine &&
    !isPermanentBroken &&
    (permStatus === 'RUNNING' || permStatus === 'IDLE');

  return (
    <div className="space-y-4">
      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs text-red-800 shadow-2xs">
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
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
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

      {/* Recent Rejection Alert */}
      {recentRejected && recentRejected.id !== dismissedRejectedId && !currentAssignment && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Previous Request Notice
              </div>
              <div className="text-sm font-extrabold text-amber-950 mt-0.5">
                Machine Sign-In for {recentRejected.machine_code} was not approved
              </div>
              <div className="text-xs text-amber-800 mt-1">
                <span className="font-semibold">Reason:</span>{' '}
                {recentRejected.rejection_reason || 'Shift assignment rearranged by plant management.'}
              </div>
              {recentRejected.approver_name && (
                <div className="text-2xs text-amber-700 mt-0.5">
                  Reviewed by {recentRejected.approver_name}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setDismissedRejectedId(recentRejected.id)}
            className="text-amber-700 hover:text-amber-950 text-xs font-bold px-2 py-1 rounded bg-amber-100/70 hover:bg-amber-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* =====================================================================
          PERMANENT MACHINE SHOWCASE CARD (PART 2 REQUIREMENT)
          Prominently displays operator's permanent/default machine relationship.
          ===================================================================== */}
      {permanentMachine && (
        <div className="bg-white border-2 border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center shrink-0 shadow-xs font-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-zinc-100 text-zinc-800 border border-zinc-300">
                    PERMANENT DEFAULT ASSET
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold border ${
                      permStatus === 'RUNNING'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : isPermanentBroken
                        ? 'bg-red-50 text-red-700 border-red-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        permStatus === 'RUNNING'
                          ? 'bg-emerald-500 animate-pulse'
                          : isPermanentBroken
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}
                    ></span>
                    {permStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-zinc-900 mt-1 tracking-tight">
                  {permanentMachine.machine_code} • {permanentMachine.name}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 mt-1">
                  <span>
                    <strong>Shop:</strong> {permanentMachine.shop_name || 'Fabrication'}
                  </span>
                  <span>
                    <strong>Location:</strong> {permanentMachine.bay_line_location || 'Shop Floor'}
                  </span>
                  <span>
                    <strong>Plant:</strong> {permanentMachine.plant_name || 'Plant 1'}
                  </span>
                  {permanentMachine.operating_hours != null && (
                    <span>
                      <strong>Meter:</strong> {Number(permanentMachine.operating_hours).toLocaleString()} h
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* If permanent machine has breakdown / unavailable, show Request Temporary Machine Action */}
            {isPermanentBroken && !currentAssignment && (
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <button
                  onClick={() => {
                    if (onRequestTemporaryClick) {
                      onRequestTemporaryClick();
                    } else {
                      setShowTemporaryRequestDrawer(true);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl transition shadow-xs cursor-pointer border border-amber-600"
                >
                  <Repeat className="w-4 h-4" />
                  <span>Request Temporary Machine</span>
                </button>
              </div>
            )}
          </div>

          {/* Breakdown Alert Box and Repair Progress Tracker */}
          {permanentMachine.active_breakdown && (
            <div className="mt-3.5 p-3.5 bg-red-50/90 border border-red-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-extrabold flex items-center gap-2">
                      <span>Active Breakdown Ticket #{permanentMachine.active_breakdown.complaint_number || 'OPEN'}</span>
                      <span className="px-1.5 py-0.2 rounded text-2xs uppercase bg-red-200 text-red-900 font-black">
                        {permanentMachine.active_breakdown.priority || 'CRITICAL'}
                      </span>
                    </div>
                    <div className="text-2xs text-red-800 mt-0.5">
                      <strong>Issue:</strong> {permanentMachine.active_breakdown.problem_title}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-2xs font-extrabold bg-red-100 text-red-800 border border-red-300 uppercase shrink-0">
                  {permanentMachine.active_breakdown.status || 'Under Repair'}
                </span>
              </div>

              {/* 4-Step Maintenance / Work Order Progress */}
              <div className="pt-2 border-t border-red-200/70">
                <div className="text-2xs font-extrabold uppercase text-red-800 mb-1.5 flex items-center justify-between">
                  <span>Maintenance &amp; Work-Order Progress</span>
                  <span className="font-mono text-zinc-500 lowercase">workflow active</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center text-2xs">
                  <div className="p-1.5 rounded-lg bg-red-600 text-white font-extrabold shadow-2xs">
                    1. Reported
                  </div>
                  <div
                    className={`p-1.5 rounded-lg font-bold border transition ${
                      ['assigned', 'in_progress', 'verified'].includes(
                        String(permanentMachine.active_breakdown.status || '').toLowerCase()
                      )
                        ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold'
                        : 'bg-white/80 text-zinc-400 border-zinc-200'
                    }`}
                  >
                    2. Tech Assigned
                  </div>
                  <div
                    className={`p-1.5 rounded-lg font-bold border transition ${
                      ['in_progress', 'verified'].includes(
                        String(permanentMachine.active_breakdown.status || '').toLowerCase()
                      )
                        ? 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold'
                        : 'bg-white/80 text-zinc-400 border-zinc-200'
                    }`}
                  >
                    3. Under Repair
                  </div>
                  <div
                    className={`p-1.5 rounded-lg font-bold border transition ${
                      String(permanentMachine.active_breakdown.status || '').toLowerCase() === 'verified'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-2xs'
                        : 'bg-white/80 text-zinc-400 border-zinc-200'
                    }`}
                  >
                    4. Verified
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STATE 1: OPERATOR HAS AN APPROVED ACTIVE WORKING MACHINE
          ===================================================================== */}
      {currentAssignment && currentAssignment.status === 'approved' && (
        <div
          className={`border-2 rounded-2xl p-5 shadow-sm bg-white ${
            isTemporaryActive
              ? 'border-amber-500 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white'
              : 'border-emerald-500/80 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-white'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-extrabold ${
                  isTemporaryActive
                    ? 'bg-amber-500 text-black'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {isTemporaryActive ? <Repeat className="w-6 h-6" /> : <HardHat className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-black border ${
                      isTemporaryActive
                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    {isTemporaryActive ? 'TEMPORARY REPLACEMENT ASSET' : 'ACTIVE OPERATOR SESSION'}
                  </span>
                </div>
                <h3 className="text-lg font-black text-zinc-900 mt-1 tracking-tight">
                  {currentAssignment.machine_code} • {currentAssignment.machine_name}
                </h3>
                {isTemporaryActive && (
                  <div className="text-xs font-bold text-amber-900 mt-0.5">
                    Replaces Permanent Asset:{' '}
                    <span className="font-extrabold underline">
                      {currentAssignment.replacement_for_machine_code || permanentMachine?.machine_code || 'Default Machine'}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 mt-1">
                  <span>
                    <strong>Shop:</strong> {currentAssignment.shop_name}
                  </span>
                  <span>
                    <strong>Plant:</strong> {currentAssignment.plant_name}
                  </span>
                  {currentAssignment.bay_line_location && (
                    <span>
                      <strong>Location:</strong> {currentAssignment.bay_line_location}
                    </span>
                  )}
                  {currentAssignment.signed_in_at && (
                    <span className="text-zinc-500">
                      <strong>Started:</strong>{' '}
                      {new Date(currentAssignment.signed_in_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Return to Permanent Machine or Sign Out */}
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              {isTemporaryActive ? (
                <>
                  {isPermanentRepairedAndReady && (
                    <button
                      onClick={() => setShowReturnConfirm(true)}
                      disabled={submitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs cursor-pointer"
                    >
                      <Repeat className="w-3.5 h-3.5 text-white" />
                      <span>Return to Permanent Machine</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-amber-400" />
                    <span>Release Temporary Machine</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowSignOutConfirm(true)}
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-amber-400" />
                  <span>End Shift / Sign Out</span>
                </button>
              )}
            </div>
          </div>

          {/* Banner if Permanent Machine has been repaired and is available */}
          {isPermanentRepairedAndReady && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Permanent Machine Available:</strong> {permanentMachine?.machine_code} has been repaired and verified operational! You can return to your permanent machine at any time.
                </span>
              </div>
              <button
                onClick={() => setShowReturnConfirm(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-2xs rounded-lg transition shrink-0 ml-2"
              >
                Return Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Return to Permanent Machine Confirmation Modal */}
      {showReturnConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-zinc-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-emerald-700" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-900">
                Return to Permanent Machine?
              </h4>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              This will release your temporary working machine (<strong>{currentAssignment?.machine_code}</strong>) and make it available for other operators. Your active assignment will revert to your permanent machine (<strong>{permanentMachine?.machine_code}</strong>).
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReturnConfirm(false)}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSignOut(true)}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer"
              >
                {submitting ? 'Releasing...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-zinc-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <LogOut className="w-5 h-5" />
              </div>
              <h4 className="text-base font-extrabold text-zinc-900">
                {isTemporaryActive ? 'Release Temporary Machine?' : 'Sign Out of Machine?'}
              </h4>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Are you sure you want to release <strong>{currentAssignment?.machine_code}</strong>?
              This will close your active operator session and make the machine available for the shop floor.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                disabled={submitting}
                className="px-3.5 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSignOut(false)}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-extrabold bg-zinc-900 hover:bg-black text-amber-400 rounded-lg transition shadow-xs cursor-pointer"
              >
                {submitting ? 'Signing out...' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 2: OPERATOR HAS A PENDING REQUEST (TEMPORARY OR SHIFT)
          ===================================================================== */}
      {currentAssignment && currentAssignment.status === 'pending' && (
        <div className="bg-amber-50/80 border-2 border-amber-400 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-400 text-zinc-900 flex items-center justify-center shrink-0 shadow-2xs font-extrabold">
                <Clock className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-black bg-amber-200 text-amber-900 border border-amber-300">
                    {currentAssignment.assignment_type === 'temporary'
                      ? 'TEMPORARY MACHINE REQUEST PENDING'
                      : 'AWAITING MANAGER APPROVAL'}
                  </span>
                  <span className="text-2xs font-bold text-amber-800">
                    Machine Reserved
                  </span>
                </div>
                <h3 className="text-base font-black text-zinc-900 mt-1">
                  Requested Machine: {currentAssignment.machine_code} • {currentAssignment.machine_name}
                </h3>
                {currentAssignment.replacement_for_machine_code && (
                  <p className="text-xs text-amber-900 font-bold mt-0.5">
                    Replacement for: {currentAssignment.replacement_for_machine_code}
                  </p>
                )}
                <p className="text-xs text-zinc-600 mt-0.5">
                  Shop: <strong>{currentAssignment.shop_name}</strong> • Plant: <strong>{currentAssignment.plant_name}</strong>
                </p>
                <p className="text-2xs text-amber-800 font-semibold mt-1">
                  Real-time notification routed to your Plant Manager. While pending, this machine cannot be reserved by other operators.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCancelRequest}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                <span>{submitting ? 'Cancelling...' : 'Cancel Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 3: TEMPORARY MACHINE REQUEST STATION / REGULAR SIGN-IN STATION
          Displayed when operator has no active assignment OR clicks "Request Temporary Machine"
          ===================================================================== */}
      {(!currentAssignment || showTemporaryRequestDrawer) && (
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs space-y-5">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-amber-400 text-black">
                  {showTemporaryRequestDrawer || isPermanentBroken ? <Repeat className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                </span>
                <h3 className="text-sm font-black text-zinc-900 tracking-tight">
                  {showTemporaryRequestDrawer || isPermanentBroken
                    ? 'Request Temporary Replacement Machine'
                    : 'Operator Machine Selection Station'}
                </h3>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {showTemporaryRequestDrawer || isPermanentBroken
                  ? `Select an operational machine in your shop to maintain production while ${permanentMachine?.machine_code || 'your machine'} is under repair.`
                  : 'Choose your shop and an operational machine to sign in.'}
              </p>
            </div>

            {/* Plant & Shop Selectors */}
            <div className="flex flex-wrap items-center gap-2">
              {showTemporaryRequestDrawer && currentAssignment && (
                <button
                  onClick={() => setShowTemporaryRequestDrawer(false)}
                  className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-lg transition"
                >
                  Close
                </button>
              )}

              {/* Plant Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={selectedPlantId}
                  onChange={(e) => setSelectedPlantId(e.target.value)}
                  className="bg-transparent text-zinc-800 font-bold focus:outline-hidden cursor-pointer"
                >
                  {plants.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.plant_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shop Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs">
                <Layers className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={selectedShopId}
                  onChange={(e) => {
                    setSelectedShopId(e.target.value);
                    setSelectedMachineId('');
                  }}
                  disabled={availableShops.length === 0}
                  className="bg-transparent text-zinc-800 font-bold focus:outline-hidden cursor-pointer disabled:opacity-50"
                >
                  {availableShops.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.shop_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Machine Availability Grid */}
          <div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-extrabold text-zinc-700 uppercase tracking-wider text-2xs">
                Available Machines in Shop ({availableMachines.length})
              </span>
              <div className="flex items-center gap-3 text-2xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Occupied
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Maintenance
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> Breakdown
                </span>
              </div>
            </div>

            {loadingMachines ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 animate-pulse space-y-2 h-28"
                  ></div>
                ))}
              </div>
            ) : availableMachines.length === 0 ? (
              <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl space-y-2">
                <Info className="w-6 h-6 text-zinc-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-700">
                  No active machines found for this shop.
                </p>
                <p className="text-2xs text-zinc-500">
                  Select a different shop or plant from the selectors above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableMachines.map((machine) => {
                  const isSelected = selectedMachineId === machine.id;
                  const isSelectable = machine.is_selectable;

                  // Status badge configurations
                  let badgeBg = 'bg-zinc-100 text-zinc-700 border-zinc-200';
                  let statusLabel = 'Available';

                  if (machine.assignment_status === 'available') {
                    badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                    statusLabel = 'Available';
                  } else if (machine.assignment_status === 'occupied') {
                    badgeBg = 'bg-blue-50 text-blue-800 border-blue-200';
                    statusLabel = `Occupied • ${machine.current_operator?.full_name || 'Operator'}`;
                  } else if (machine.assignment_status === 'pending') {
                    badgeBg = 'bg-amber-50 text-amber-800 border-amber-300';
                    statusLabel = `Pending • ${machine.pending_operator?.full_name || 'Pending'}`;
                  } else if (machine.assignment_status === 'maintenance') {
                    badgeBg = 'bg-purple-50 text-purple-800 border-purple-200';
                    statusLabel = 'Maintenance';
                  } else if (machine.assignment_status === 'breakdown') {
                    badgeBg = 'bg-red-50 text-red-800 border-red-200';
                    statusLabel = 'Breakdown';
                  }

                  return (
                    <div
                      key={machine.id}
                      onClick={() => {
                        if (isSelectable) {
                          setSelectedMachineId(isSelected ? '' : machine.id);
                        }
                      }}
                      className={`relative p-3.5 rounded-xl border-2 transition text-left flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/40 shadow-xs ring-2 ring-amber-400/50'
                          : isSelectable
                          ? 'border-zinc-200 bg-white hover:border-amber-400 hover:shadow-2xs cursor-pointer'
                          : 'border-zinc-200/80 bg-zinc-50/70 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      {/* Top Row: Machine Code & Status Badge */}
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                            {machine.machine_code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-2xs font-extrabold border ${badgeBg} truncate max-w-[170px]`}
                            title={machine.unavailability_reason || statusLabel}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-800 truncate" title={machine.name}>
                          {machine.name}
                        </h4>
                        <div className="text-2xs text-zinc-500 mt-0.5">
                          {machine.category} • {machine.bay_line_location || 'Shop Floor'}
                        </div>
                      </div>

                      {/* Bottom Info: Hours & Selectability */}
                      <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-2xs">
                        <span className="text-zinc-500">
                          {machine.operating_hours != null
                            ? `${Number(machine.operating_hours).toLocaleString()} hrs`
                            : '0 hrs'}
                        </span>

                        {isSelectable ? (
                          <span
                            className={`font-black flex items-center gap-1 ${
                              isSelected ? 'text-amber-800' : 'text-zinc-600'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 fill-amber-100" />
                                Selected
                              </>
                            ) : (
                              'Click to Select'
                            )}
                          </span>
                        ) : (
                          <span
                            className="text-zinc-400 font-semibold truncate max-w-[150px]"
                            title={machine.unavailability_reason || 'Unavailable'}
                          >
                            {machine.unavailability_reason || 'Unavailable'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sign-In Action Drawer */}
          {selectedMachine && (
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-black flex items-center justify-center font-black">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-2xs font-extrabold text-amber-950 uppercase tracking-wider">
                      {isPermanentBroken || showTemporaryRequestDrawer ? 'Ready to Request Temporary Replacement' : 'Ready to Sign In'}
                    </div>
                    <div className="text-sm font-black text-zinc-900">
                      {selectedMachine.machine_code} • {selectedMachine.name}
                    </div>
                  </div>
                </div>

                {/* Shift Selector */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-zinc-700">Shift:</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-800 focus:outline-hidden"
                  >
                    <option value="Shift A">Shift A (06:00 - 14:00)</option>
                    <option value="Shift B">Shift B (14:00 - 22:00)</option>
                    <option value="Shift C">Shift C (22:00 - 06:00)</option>
                  </select>
                </div>
              </div>

              {/* Notes Input & Sign In Button */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder={
                    isPermanentBroken || showTemporaryRequestDrawer
                      ? `Reason for temporary request (e.g. permanent ${permanentMachine?.machine_code || 'machine'} is under repair)...`
                      : 'Optional shift notes (e.g. starting routine task)...'
                  }
                  value={signInNotes}
                  onChange={(e) => setSignInNotes(e.target.value)}
                  className="flex-1 bg-white border border-amber-300/80 rounded-xl px-3 py-2 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 w-full"
                />

                <button
                  onClick={() => handleRequestSignIn(isPermanentBroken || showTemporaryRequestDrawer)}
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                >
                  {isPermanentBroken || showTemporaryRequestDrawer ? <Repeat className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                  <span>
                    {submitting
                      ? 'Submitting...'
                      : isPermanentBroken || showTemporaryRequestDrawer
                      ? 'Send Temporary Request'
                      : 'Sign In to Machine'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
