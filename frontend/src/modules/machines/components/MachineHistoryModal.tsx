import React, { useState, useEffect } from 'react';
import apiClient from '../../../api/client';
import { Machine, MachineHistoryResponse } from '../types';
import { StatusBadge } from '../../../components/common/StatusBadge';
import {
  X,
  History,
  AlertTriangle,
  FileCheck2,
  Calendar,
  Package,
  Shield,
  Activity,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  FileText,
  Truck,
  RotateCw,
} from 'lucide-react';

interface MachineHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string | null;
}

export const MachineHistoryModal: React.FC<MachineHistoryModalProps> = ({
  isOpen,
  onClose,
  machineId,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'breakdowns' | 'workOrders' | 'pm' | 'parts' | 'audit'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<MachineHistoryResponse | null>(null);

  const fetchHistory = async () => {
    if (!machineId) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await apiClient.get(`/machines/${machineId}/history?limit=50`);
      if (res.data.success) {
        setHistoryData(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load machine history:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load maintenance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && machineId) {
      fetchHistory();
      setActiveTab('overview');
    } else {
      setHistoryData(null);
    }
  }, [isOpen, machineId]);

  if (!isOpen) return null;

  const machine = historyData?.machine;
  const metrics = historyData?.metrics;
  const history = historyData?.history;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border-2 border-zinc-200 overflow-hidden my-8 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-zinc-950 p-5 flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-jcb-yellow text-black font-black text-lg px-2.5 py-0.5 rounded shadow">
              JCB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-wide">
                  MACHINE MAINTENANCE LIFECYCLE HISTORY
                </h3>
                {machine && (
                  <span className="font-mono text-xs px-2 py-0.5 bg-zinc-800 text-amber-400 font-bold rounded">
                    {machine.machine_code}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                Consolidated Work Orders, Breakdowns, PMs, Parts & Compliance Audit Trail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition"
              title="Refresh History"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Machine Summary Bar */}
        {machine && (
          <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
            <div>
              <span className="font-black text-zinc-950 text-sm block">{machine.name}</span>
              <span className="text-[11px] text-zinc-500">
                {machine.plant_name || 'Plant'} &bull; {machine.shop_name || 'Shop'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] font-black text-zinc-400 uppercase block">Operating Meter</span>
                <span className="font-mono font-bold text-zinc-800">
                  {machine.operating_hours ? `${Number(machine.operating_hours).toFixed(1)} hrs` : '0.0 hrs'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black text-zinc-400 uppercase block mb-0.5">Asset Status</span>
                <StatusBadge status={machine.status} />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-zinc-200 bg-white overflow-x-auto text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'overview'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Activity className="w-4 h-4 text-amber-600" />
            <span>Metrics Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('breakdowns')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'breakdowns'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>Breakdowns ({history?.breakdowns?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('workOrders')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'workOrders'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Wrench className="w-4 h-4 text-blue-500" />
            <span>Work Orders ({history?.workOrders?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('pm')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'pm'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>PM & Inspections</span>
          </button>

          <button
            onClick={() => setActiveTab('parts')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'parts'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Package className="w-4 h-4 text-purple-600" />
            <span>Parts & Procurement</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
              activeTab === 'audit'
                ? 'border-jcb-yellow text-zinc-950 font-black'
                : 'border-transparent text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Shield className="w-4 h-4 text-zinc-600" />
            <span>Audit Trail ({history?.auditLogs?.length || 0})</span>
          </button>
        </div>

        {/* Modal Body / Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center text-zinc-400 font-bold text-xs flex flex-col items-center gap-2">
              <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
              <span>Retrieving consolidated machine maintenance records...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl text-xs flex items-center gap-2 bg-red-50 text-red-800 border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & METRICS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl">
                      <div className="flex items-center justify-between text-red-700 text-xs font-black uppercase">
                        <span>Breakdowns</span>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-black text-red-950 mt-1">
                        {metrics?.totalBreakdowns ?? 0}
                      </div>
                      <div className="text-[10px] text-red-600 font-medium mt-0.5">
                        Historical incidents
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="flex items-center justify-between text-blue-700 text-xs font-black uppercase">
                        <span>Work Orders</span>
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-black text-blue-950 mt-1">
                        {metrics?.totalWorkOrders ?? 0}
                      </div>
                      <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                        Maintenance orders executed
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <div className="flex items-center justify-between text-amber-800 text-xs font-black uppercase">
                        <span>Total Downtime</span>
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-black text-amber-950 mt-1">
                        {metrics?.totalDowntimeMinutes ?? 0} <span className="text-xs font-bold">mins</span>
                      </div>
                      <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                        Cumulative stoppage time
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between text-emerald-800 text-xs font-black uppercase">
                        <span>Inspections & PM</span>
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-black text-emerald-950 mt-1">
                        {(metrics?.totalInspections || 0) + (metrics?.totalPmPlans || 0)}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                        Preventive & safety checks
                      </div>
                    </div>
                  </div>

                  {/* Summary Information */}
                  <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider">
                      Asset Operational Profile
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500 text-[11px] block">Active Repair Duration</span>
                        <span className="font-bold text-zinc-900">{metrics?.activeRepairMinutes ?? 0} minutes</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[11px] block">Parts Consumed</span>
                        <span className="font-bold text-zinc-900">{metrics?.totalPartsConsumed ?? 0} components</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[11px] block">Purchase Requisitions</span>
                        <span className="font-bold text-zinc-900">{metrics?.totalPurchaseRequisitions ?? 0} PRs</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[11px] block">RDC External Repairs</span>
                        <span className="font-bold text-zinc-900">{metrics?.totalRdcChallans ?? 0} Challans</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[11px] block">System Audit Events</span>
                        <span className="font-bold text-zinc-900">{metrics?.totalAuditLogs ?? 0} events recorded</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BREAKDOWN COMPLAINTS */}
              {activeTab === 'breakdowns' && (
                <div className="space-y-3">
                  {(!history?.breakdowns || history.breakdowns.length === 0) ? (
                    <div className="py-12 text-center text-zinc-400 font-medium text-xs">
                      No breakdown complaints recorded for this machine.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                      {history.breakdowns.map((b: any) => (
                        <div key={b.id} className="p-4 hover:bg-zinc-50 transition space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-zinc-950">
                                {b.complaint_number}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-zinc-100 text-zinc-700">
                                {b.priority || 'Medium'}
                              </span>
                            </div>
                            <StatusBadge status={b.status} />
                          </div>
                          <div className="text-xs font-bold text-zinc-900">
                            {b.problem_title}
                          </div>
                          {b.description && (
                            <p className="text-xs text-zinc-600 font-medium">{b.description}</p>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium pt-1">
                            <span>Reported by: {b.reported_by_name || b.reported_by_code || 'Operator'}</span>
                            <span>
                              {b.reported_at ? new Date(b.reported_at).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: WORK ORDERS */}
              {activeTab === 'workOrders' && (
                <div className="space-y-3">
                  {(!history?.workOrders || history.workOrders.length === 0) ? (
                    <div className="py-12 text-center text-zinc-400 font-medium text-xs">
                      No work orders executed on this machine asset.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                      {history.workOrders.map((wo: any) => (
                        <div key={wo.id} className="p-4 hover:bg-zinc-50 transition space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-zinc-950">
                                {wo.wo_number}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                {wo.classification?.replace('_', ' ') || 'Maintenance'}
                              </span>
                            </div>
                            <StatusBadge status={wo.status} />
                          </div>
                          {wo.diagnosis && (
                            <div className="text-xs text-zinc-800">
                              <span className="font-bold text-zinc-950">Diagnosis: </span>
                              {wo.diagnosis}
                            </div>
                          )}
                          {wo.corrective_action && (
                            <div className="text-xs text-emerald-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                              <span className="font-bold">Corrective Action: </span>
                              {wo.corrective_action}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 pt-1 border-t border-zinc-100">
                            <span>Technician: {wo.assigned_technician_name || 'Unassigned'}</span>
                            <span>Downtime: {wo.total_downtime_minutes ?? 0} mins</span>
                            <span>Labor: {wo.labour_hours || '0'} hrs</span>
                            <span>{wo.created_at ? new Date(wo.created_at).toLocaleDateString() : ''}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PM & INSPECTIONS */}
              {activeTab === 'pm' && (
                <div className="space-y-6">
                  {/* PM Plans */}
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                      Preventive Maintenance Schedules
                    </h4>
                    {(!history?.pmPlans || history.pmPlans.length === 0) ? (
                      <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400 font-medium">
                        No scheduled PM plans configured for this machine.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        {history.pmPlans.map((pm: any) => (
                          <div key={pm.id} className="p-3 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-zinc-900 block">{pm.title || pm.pm_name || 'Scheduled PM'}</span>
                              <span className="text-[11px] text-zinc-500 font-mono">
                                Frequency: {pm.frequency_days ? `Every ${pm.frequency_days} days` : 'Periodic'}
                              </span>
                            </div>
                            <StatusBadge status={pm.status || 'active'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pre-Shift Inspections */}
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                      Pre-Shift Safety Inspections
                    </h4>
                    {(!history?.inspections || history.inspections.length === 0) ? (
                      <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400 font-medium">
                        No inspection logs recorded for this machine.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        {history.inspections.map((insp: any) => (
                          <div key={insp.id} className="p-3 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-zinc-900 block">
                                Shift {insp.shift || 'A'} Inspection
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                Inspected by: {insp.operator_name || 'Operator'} &bull; {insp.created_at ? new Date(insp.created_at).toLocaleString() : ''}
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              insp.result === 'pass'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {insp.result || 'PASS'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: PARTS & PROCUREMENT */}
              {activeTab === 'parts' && (
                <div className="space-y-6">
                  {/* Spare Parts Consumed */}
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                      Spare Parts Consumed
                    </h4>
                    {(!history?.partsConsumed || history.partsConsumed.length === 0) ? (
                      <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400 font-medium">
                        No spare parts consumed for this machine yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        {history.partsConsumed.map((part: any, idx: number) => (
                          <div key={idx} className="p-3 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-zinc-900 block">{part.part_name || 'Spare Part'}</span>
                              <span className="text-[11px] font-mono text-zinc-500">
                                Part Code: {part.part_code || part.part_number || 'N/A'}
                              </span>
                            </div>
                            <span className="font-bold text-zinc-800">
                              Qty: {part.quantity || part.quantity_consumed || 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Purchase Requisitions */}
                  <div>
                    <h4 className="text-xs font-black text-zinc-900 uppercase tracking-wider mb-2">
                      Linked Purchase Requisitions (PR)
                    </h4>
                    {(!history?.purchaseRequisitions || history.purchaseRequisitions.length === 0) ? (
                      <div className="p-4 bg-zinc-50 rounded-xl text-center text-xs text-zinc-400 font-medium">
                        No purchase requisitions linked to this machine.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                        {history.purchaseRequisitions.map((pr: any) => (
                          <div key={pr.id} className="p-3 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-zinc-900 block font-mono">
                                {pr.pr_number || 'PR-REF'}
                              </span>
                              <span className="text-[11px] text-zinc-500">
                                Requested on {pr.created_at ? new Date(pr.created_at).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <StatusBadge status={pr.status || 'pending'} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  {(!history?.auditLogs || history.auditLogs.length === 0) ? (
                    <div className="py-12 text-center text-zinc-400 font-medium text-xs">
                      No audit log records for this machine.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white">
                      {history.auditLogs.map((log: any, idx: number) => (
                        <div key={log.id || idx} className="p-3.5 text-xs hover:bg-zinc-50 transition space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-zinc-900 px-2 py-0.5 bg-zinc-100 rounded text-[11px]">
                              {log.action}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-600">
                            User: <span className="font-semibold text-zinc-800">{log.user_name || log.user_id || 'System'}</span>
                          </div>
                          {log.new_values && (
                            <div className="font-mono text-[10px] bg-zinc-50 p-2 rounded border border-zinc-200 text-zinc-700 overflow-x-auto">
                              {typeof log.new_values === 'object' ? JSON.stringify(log.new_values) : log.new_values}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 px-6 py-3 border-t border-zinc-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs transition shadow"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
