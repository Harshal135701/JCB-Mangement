import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../api/client';
import {
  HardHat,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  Building2,
  Wrench,
  AlertCircle,
  Repeat,
  ShieldAlert,
  Loader2,
  Info,
} from 'lucide-react';
import {
  MachineAvailabilityItem,
  PermanentMachineInfo,
  OperatorMachineAssignment,
} from '../types/operator-assignment.types';

interface RequestNewMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  user: any;
  permanentMachine?: PermanentMachineInfo | null;
  currentAssignment?: OperatorMachineAssignment | null;
  hierarchy?: any;
}

export const RequestNewMachineModal: React.FC<RequestNewMachineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
  permanentMachine,
  currentAssignment,
  hierarchy,
}) => {
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [machines, setMachines] = useState<MachineAvailabilityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('Shift A (06:00 - 14:00)');
  const [notes, setNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Plants from hierarchy
  const plants = hierarchy?.plants || [];

  // Filter shops by selected plant
  const availableShops = useMemo(() => {
    if (!selectedPlantId || !hierarchy?.shops) return [];
    return hierarchy.shops.filter((s: any) => s.plant_id === selectedPlantId);
  }, [selectedPlantId, hierarchy]);

  // Initial facility assignment
  useEffect(() => {
    if (!isOpen) return;

    const initialPlantId =
      permanentMachine?.plant_id ||
      user?.plantId ||
      (plants.length > 0 ? plants[0].id : '');
    setSelectedPlantId(initialPlantId);

    const initialShopId =
      permanentMachine?.shop_id ||
      user?.shopId ||
      '';
    setSelectedShopId(initialShopId);

    setSelectedMachineId('');
    setErrorMessage(null);

    // Default note mentioning the permanent machine if broken
    if (permanentMachine) {
      const breakdownText = permanentMachine.active_breakdown?.complaint_number
        ? ` (Breakdown #${permanentMachine.active_breakdown.complaint_number}: ${permanentMachine.active_breakdown.problem_title})`
        : '';
      setNotes(`Temporary replacement for ${permanentMachine.machine_code}${breakdownText}`);
    } else {
      setNotes('');
    }
  }, [isOpen, permanentMachine, user, plants]);

  // Auto-select first matching shop when plant changes
  useEffect(() => {
    if (!isOpen || !selectedPlantId) return;
    if (availableShops.length > 0) {
      const userShopMatch = availableShops.find(
        (s: any) => s.id === (permanentMachine?.shop_id || user?.shopId)
      );
      setSelectedShopId(userShopMatch ? userShopMatch.id : availableShops[0].id);
    } else {
      setSelectedShopId('');
    }
  }, [selectedPlantId, availableShops, isOpen, permanentMachine, user]);

  // Fetch available machines when shop or plant changes
  const fetchMachines = async (shopId: string, plantId: string) => {
    if (!shopId) {
      setMachines([]);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await apiClient.get('/machines/operator/available-machines', {
        params: { shop_id: shopId, plant_id: plantId },
      });
      setMachines(res.data?.data || []);
    } catch (err: any) {
      console.error('Failed to load shop machines:', err);
      setErrorMessage(
        err.response?.data?.message || 'Unable to retrieve machine availability from database.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedShopId && selectedPlantId) {
      fetchMachines(selectedShopId, selectedPlantId);
    }
  }, [isOpen, selectedShopId, selectedPlantId]);

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchSearch =
        m.machine_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.bay_line_location || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat =
        filterCategory === 'all' ||
        (m.category || '').toLowerCase() === filterCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [machines, searchQuery, filterCategory]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    machines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [machines]);

  // Handle Request Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) {
      setErrorMessage('Please select an available machine from the list.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        machine_id: selectedMachineId,
        shop_id: selectedShopId,
        plant_id: selectedPlantId,
        shift: selectedShift,
        notes: notes.trim() || undefined,
        assignment_type: 'temporary',
        replacement_for_machine_id: permanentMachine?.id || undefined,
        breakdown_id: permanentMachine?.active_breakdown?.id || undefined,
      };

      await apiClient.post('/machines/operator/sign-in', payload);

      const chosen = machines.find((m) => m.id === selectedMachineId);
      onSuccess(
        `Temporary machine request for ${chosen?.machine_code || 'machine'} submitted! Awaiting manager approval.`
      );
      onClose();
    } catch (err: any) {
      console.error('Failed to submit machine request:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to submit temporary machine request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Active check guards
  const isTemporaryActive =
    currentAssignment &&
    currentAssignment.status === 'approved' &&
    currentAssignment.assignment_type === 'temporary';

  const isPending =
    currentAssignment && currentAssignment.status === 'pending';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-extrabold shadow-2xs shrink-0">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 tracking-tight">
                  Request Temporary Machine
                </h3>
                <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  Manager Approval Required
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Select an available shop floor machine to operate while your permanent asset is undergoing maintenance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs text-red-800">
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

          {/* Active Guard: If Operator already has an active temporary assignment */}
          {isTemporaryActive && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Temporary Machine Already Active</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                You are currently working on temporary machine{' '}
                <strong>{currentAssignment.machine_code}</strong> (replaces permanent asset{' '}
                <strong>{currentAssignment.replacement_for_machine_code || permanentMachine?.machine_code || 'Permanent Asset'}</strong>).
                To request another machine, you must first release your existing temporary assignment from the dashboard.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-900 text-amber-400 font-bold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Pending Guard: If Operator already has a pending request */}
          {!isTemporaryActive && isPending && (
            <div className="p-4 bg-blue-50 border border-blue-300 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Sign-In Request Currently Pending</span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                You currently have a pending request for machine{' '}
                <strong>{currentAssignment.machine_code}</strong> submitted at{' '}
                {new Date(currentAssignment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                Please wait for manager review or cancel that request from your dashboard before selecting another machine.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-zinc-900 text-white font-bold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!isTemporaryActive && !isPending && (
            <>
              {/* Permanent Machine Reference Box */}
              {permanentMachine && (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-2xs font-bold uppercase tracking-wider text-zinc-500">
                        Replacing Permanent Asset
                      </div>
                      <div className="font-extrabold text-zinc-900 text-xs">
                        {permanentMachine.machine_code} • {permanentMachine.name}
                      </div>
                      {permanentMachine.active_breakdown && (
                        <div className="text-2xs text-red-600 font-semibold mt-0.5">
                          Breakdown Ticket #{permanentMachine.active_breakdown.complaint_number}:{' '}
                          {permanentMachine.active_breakdown.problem_title}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-2xs font-extrabold uppercase shrink-0 ${
                      permanentMachine.status === 'breakdown'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {permanentMachine.status}
                  </span>
                </div>
              )}

              {/* Facility Scoping Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-2xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-zinc-400" /> Plant Facility
                  </label>
                  <select
                    value={selectedPlantId}
                    onChange={(e) => setSelectedPlantId(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {plants.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.plant_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-zinc-400" /> Authorized Shop Floor
                  </label>
                  <select
                    value={selectedShopId}
                    onChange={(e) => setSelectedShopId(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {availableShops.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.shop_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Machine Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search available machines by code, name, or location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {categories.length > 0 && (
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full sm:w-40 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Machines List */}
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-zinc-100/70 border-b border-zinc-200 text-2xs font-extrabold uppercase text-zinc-600 flex items-center justify-between">
                  <span>Available Machines in {availableShops.find((s: any) => s.id === selectedShopId)?.shop_name || 'Shop'}</span>
                  <span>{filteredMachines.length} Assets Registered</span>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100">
                  {loading ? (
                    <div className="py-10 text-center text-zinc-400 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-amber-600 mb-2" />
                      <span>Checking machine availability...</span>
                    </div>
                  ) : filteredMachines.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500">
                      No machines found matching your selection.
                    </div>
                  ) : (
                    filteredMachines.map((m) => {
                      const isOwnPermanent = permanentMachine && m.id === permanentMachine.id;
                      const isAvailable = m.assignment_status === 'available' && m.is_selectable && !isOwnPermanent;
                      const isSelected = selectedMachineId === m.id;

                      let unavailText = m.unavailability_reason || 'Unavailable';
                      if (isOwnPermanent) {
                        unavailText = 'Your Permanent Asset (Cannot be chosen as replacement)';
                      }

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (isAvailable) setSelectedMachineId(m.id);
                          }}
                          className={`p-3 flex items-center justify-between gap-3 transition ${
                            isAvailable
                              ? isSelected
                                ? 'bg-amber-500/15 border-l-4 border-amber-500'
                                : 'hover:bg-zinc-50 cursor-pointer'
                              : 'opacity-50 bg-zinc-50/60 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="selectedMachine"
                              checked={isSelected}
                              disabled={!isAvailable}
                              onChange={() => setSelectedMachineId(m.id)}
                              className="w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-black text-zinc-900">
                                <span className="font-mono text-xs">{m.machine_code}</span>
                                <span>•</span>
                                <span className="font-semibold text-zinc-800 text-xs">{m.name}</span>
                              </div>
                              <div className="text-2xs text-zinc-500 mt-0.5">
                                {m.category} {m.bay_line_location ? `• ${m.bay_line_location}` : ''}{' '}
                                {m.operating_hours != null ? `• ${Number(m.operating_hours).toLocaleString()} h` : ''}
                              </div>
                              {!isAvailable && (
                                <div className="text-2xs text-red-600 font-semibold mt-0.5 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>{unavailText}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {isAvailable ? (
                              <span className="px-2 py-0.5 rounded text-2xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                AVAILABLE
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-2xs font-extrabold uppercase ${
                                  m.assignment_status === 'occupied'
                                    ? 'bg-blue-100 text-blue-800'
                                    : m.assignment_status === 'breakdown'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                {isOwnPermanent ? 'PERMANENT' : m.assignment_status}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Shift and Reason Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-2xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-400" /> Target Shift
                  </label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Shift A (06:00 - 14:00)">Shift A (06:00 - 14:00)</option>
                    <option value="Shift B (14:00 - 22:00)">Shift B (14:00 - 22:00)</option>
                    <option value="Shift C (22:00 - 06:00)">Shift C (22:00 - 06:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-2xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1">
                    Quick Preset Notes
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Overheating issue',
                      'Hydraulic line down',
                      'Scheduled PM replacement',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setNotes(
                            `Temporary replacement: ${preset} on permanent machine ${permanentMachine?.machine_code || ''}`
                          )
                        }
                        className="px-2 py-0.5 rounded text-2xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reason / Notes Text Area */}
              <div>
                <label className="block text-2xs font-extrabold text-zinc-500 uppercase tracking-wider mb-1">
                  Reason / Operational Notes for Plant Manager
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter reason for requesting this temporary replacement machine..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!isTemporaryActive && !isPending && (
          <div className="p-4 sm:p-5 border-t border-zinc-100 flex items-center justify-between bg-zinc-50">
            <div className="text-2xs text-zinc-500">
              {selectedMachineId ? (
                <span className="font-bold text-zinc-900">
                  Selected: {machines.find((m) => m.id === selectedMachineId)?.machine_code}
                </span>
              ) : (
                'Select an available machine above to proceed'
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !selectedMachineId}
                className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-400 text-black rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Request...</span>
                  </>
                ) : (
                  <>
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Send Request to Manager</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
