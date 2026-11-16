import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import {
  Calendar,
  Clock,
  AlertTriangle,
  Layers,
  Wrench,
  ShieldCheck,
  Play,
  Plus,
  RefreshCw,
  Activity,
  CheckCircle2,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import {
  PMPlan,
  PMCalendarMap,
  PMCalendarItem,
  PMExecutionItem,
  PMDashboardData,
  PMComplianceData,
  PMTrendItem,
} from './types';
import {
  fetchPMDashboard,
  fetchPMCompliance,
  fetchPMTrends,
  fetchPMByMachine,
  fetchPMCalendar,
  fetchPMUpcoming,
  fetchPMDue,
  fetchPMOverdue,
  fetchPMPlans,
  createPMPlan,
  updatePMPlan,
  activatePMPlan,
  deactivatePMPlan,
  reschedulePM,
  deferPM,
  skipPM,
  triggerGenerateDuePM,
  fetchPMExecutions,
} from './services/pmService';
import { PMKPISummary } from './components/PMKPISummary';
import { PMCalendarView } from './components/PMCalendarView';
import { PMScheduleQueueTable } from './components/PMScheduleQueueTable';
import { PMPlanManagementTable } from './components/PMPlanManagementTable';
import { PMCreateEditPlanModal } from './components/PMCreateEditPlanModal';
import { PMActionModal } from './components/PMActionModals';
import { PMExecutionModal } from './components/PMExecutionModal';
import { PMVerificationModal } from './components/PMVerificationModal';
import { PMPlanDetailModal } from './components/PMPlanDetailModal';
import { PMAnalyticsView } from './components/PMAnalyticsView';
import { PMExecutionQueueTable } from './components/PMExecutionQueueTable';

export const PMCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = (user?.role || 'technician').toLowerCase();
  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
  const isTechnician = userRole === 'technician';

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<
    'calendar' | 'queues' | 'plans' | 'executions' | 'verifications' | 'analytics'
  >(isTechnician ? 'executions' : 'calendar');

  // Calendar State
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  const [calendarData, setCalendarData] = useState<PMCalendarMap>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Dashboard & Metrics State
  const [dashboardData, setDashboardData] = useState<PMDashboardData | null>(null);
  const [complianceData, setComplianceData] = useState<PMComplianceData | null>(null);
  const [trends, setTrends] = useState<PMTrendItem[]>([]);
  const [machineStats, setMachineStats] = useState<any[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Queues State
  const [activeQueue, setActiveQueue] = useState<'due' | 'overdue' | 'upcoming'>('due');
  const [upcomingItems, setUpcomingItems] = useState<any[]>([]);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [queuesLoading, setQueuesLoading] = useState(false);

  // Plans State
  const [plans, setPlans] = useState<PMPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [machines, setMachines] = useState<any[]>([]);

  // Executions State
  const [executions, setExecutions] = useState<PMExecutionItem[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);

  // Engine Trigger State
  const [generating, setGenerating] = useState(false);
  const [globalFeedback, setGlobalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PMPlan | null>(null);
  const [selectedPlanDetailId, setSelectedPlanDetailId] = useState<string | null>(null);

  // Action Modals (Reschedule / Defer / Skip)
  const [actionModal, setActionModal] = useState<{
    type: 'reschedule' | 'defer' | 'skip';
    plan: any;
    isOpen: boolean;
  }>({ type: 'reschedule', plan: null, isOpen: false });

  // Execution & Verification Modals
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [selectedVerificationItem, setSelectedVerificationItem] = useState<PMExecutionItem | null>(null);

  // 1. Fetch Machines for Plan Builder
  useEffect(() => {
    const loadMachines = async () => {
      try {
        const res = await apiClient.get('/machines', { params: { limit: 100 } });
        if (res.data?.success && Array.isArray(res.data.data)) {
          setMachines(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load machine directory for PM:', err);
      }
    };
    loadMachines();
  }, []);

  // 2. Fetch Dashboard & Compliance KPIs
  const loadKPIs = useCallback(async () => {
    try {
      setMetricsLoading(true);
      const [dash, comp, tr, ms] = await Promise.all([
        fetchPMDashboard().catch(() => null),
        fetchPMCompliance().catch(() => null),
        fetchPMTrends().catch(() => []),
        fetchPMByMachine().catch(() => []),
      ]);
      setDashboardData(dash);
      setComplianceData(comp);
      setTrends(tr);
      setMachineStats(ms);
    } catch (err) {
      console.error('Failed to load PM metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKPIs();
  }, [loadKPIs]);

  // 3. Fetch Calendar Data
  const loadCalendar = useCallback(async (month: string) => {
    try {
      setCalendarLoading(true);
      const res = await fetchPMCalendar(month);
      setCalendarData(res.data);
    } catch (err) {
      console.error('Failed to load PM calendar:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      loadCalendar(selectedMonth);
    }
  }, [activeTab, selectedMonth, loadCalendar]);

  // 4. Fetch Schedule Queues
  const loadQueues = useCallback(async () => {
    try {
      setQueuesLoading(true);
      const [due, overdue, upcoming] = await Promise.all([
        fetchPMDue().catch(() => []),
        fetchPMOverdue().catch(() => []),
        fetchPMUpcoming(30).catch(() => []),
      ]);
      setDueItems(due);
      setOverdueItems(overdue);
      setUpcomingItems(upcoming);
    } catch (err) {
      console.error('Failed to load schedule queues:', err);
    } finally {
      setQueuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'queues') {
      loadQueues();
    }
  }, [activeTab, loadQueues]);

  // 5. Fetch PM Plans
  const loadPlans = useCallback(async () => {
    try {
      setPlansLoading(true);
      const res = await fetchPMPlans({ limit: 100 });
      setPlans(res.data);
    } catch (err) {
      console.error('Failed to load PM plans:', err);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'plans') {
      loadPlans();
    }
  }, [activeTab, loadPlans]);

  // 6. Fetch Executions
  const loadExecutions = useCallback(async () => {
    try {
      setExecutionsLoading(true);
      const params: Record<string, any> = { limit: 100 };
      if (activeTab === 'verifications') {
        params.status = 'submitted_verification';
      }
      const res = await fetchPMExecutions(params);
      setExecutions(res.data);
    } catch (err) {
      console.error('Failed to load PM executions:', err);
    } finally {
      setExecutionsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'executions' || activeTab === 'verifications') {
      loadExecutions();
    }
  }, [activeTab, loadExecutions]);

  // Trigger PM Engine
  const handleTriggerEngine = async () => {
    try {
      setGenerating(true);
      setGlobalFeedback(null);
      const res = await triggerGenerateDuePM(3);
      setGlobalFeedback({
        type: 'success',
        text: res.message || 'PM auto-generation finished. Due jobs dispatched as Work Orders.',
      });
      loadKPIs();
      if (activeTab === 'calendar') loadCalendar(selectedMonth);
      if (activeTab === 'queues') loadQueues();
      if (activeTab === 'plans') loadPlans();
      if (activeTab === 'executions') loadExecutions();
    } catch (err: any) {
      setGlobalFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'PM Engine auto-generation failed.',
      });
    } finally {
      setGenerating(false);
    }
  };

  // Plan Management Actions
  const handleSavePlan = async (payload: any) => {
    if (editingPlan) {
      await updatePMPlan(editingPlan.id, payload);
      setGlobalFeedback({ type: 'success', text: 'PM plan updated successfully!' });
    } else {
      await createPMPlan(payload);
      setGlobalFeedback({ type: 'success', text: 'PM schedule deployed successfully!' });
    }
    loadPlans();
    loadKPIs();
    setEditingPlan(null);
  };

  const handleTogglePlanStatus = async (plan: PMPlan) => {
    try {
      if (plan.is_active) {
        await deactivatePMPlan(plan.id);
        setGlobalFeedback({ type: 'success', text: `Plan ${plan.plan_code} deactivated.` });
      } else {
        await activatePMPlan(plan.id);
        setGlobalFeedback({ type: 'success', text: `Plan ${plan.plan_code} activated.` });
      }
      loadPlans();
      loadKPIs();
    } catch (err: any) {
      setGlobalFeedback({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to toggle plan status.',
      });
    }
  };

  // Action Modals Handlers
  const handleRescheduleSubmit = async ({ new_date, reason }: any) => {
    if (!actionModal.plan) return;
    await reschedulePM(actionModal.plan.id, new_date, reason);
    setGlobalFeedback({ type: 'success', text: 'PM scheduled date updated!' });
    loadQueues();
    if (activeTab === 'calendar') loadCalendar(selectedMonth);
  };

  const handleDeferSubmit = async ({ days, reason }: any) => {
    if (!actionModal.plan) return;
    await deferPM(actionModal.plan.id, days, reason);
    setGlobalFeedback({ type: 'success', text: `PM deferred by ${days} days!` });
    loadQueues();
    if (activeTab === 'calendar') loadCalendar(selectedMonth);
  };

  const handleSkipSubmit = async ({ reason }: any) => {
    if (!actionModal.plan) return;
    await skipPM(actionModal.plan.id, reason);
    setGlobalFeedback({ type: 'success', text: 'PM maintenance cycle skipped.' });
    loadQueues();
    if (activeTab === 'calendar') loadCalendar(selectedMonth);
  };

  return (
    <div className="space-y-6 bg-white min-h-full pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-xl border border-zinc-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-black font-black p-2.5 rounded-lg shadow-sm flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-zinc-950 tracking-tight">
                REGULAR PREVENTIVE MAINTENANCE (PM)
              </h1>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Module 9
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">
              Machine service plans, calendar matrix, technician checklist execution, and manager quality sign-off.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isAdminOrManager && (
            <button
              type="button"
              onClick={() => {
                setEditingPlan(null);
                setIsCreatePlanModalOpen(true);
              }}
              className="bg-zinc-900 hover:bg-black text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Plan</span>
            </button>
          )}

          {isAdminOrManager && (
            <button
              type="button"
              onClick={handleTriggerEngine}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-lg shadow-xs border border-amber-500 transition disabled:opacity-50 cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 fill-black ${generating ? 'animate-spin' : ''}`} />
              <span>{generating ? 'Checking Due Jobs...' : 'Check Due Maintenance'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {globalFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
            globalFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {globalFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{globalFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalFeedback(null)}
            className="text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Top Executive KPI Summary Cards */}
      <PMKPISummary data={dashboardData} loading={metricsLoading} />

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
        {/* Calendar View */}
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-amber-500 text-black shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>PM Calendar Matrix</span>
        </button>

        {/* Schedule Queues */}
        <button
          type="button"
          onClick={() => setActiveTab('queues')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'queues'
              ? 'bg-amber-500 text-black shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Schedule Queues (Due/Overdue)</span>
          {dueItems.length + overdueItems.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono">
              {dueItems.length + overdueItems.length}
            </span>
          )}
        </button>

        {/* PM Service Plans */}
        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'plans'
              ? 'bg-amber-500 text-black shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>PM Service Plans</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 text-zinc-700">
            {plans.length}
          </span>
        </button>

        {/* PM Executions Workbench */}
        <button
          type="button"
          onClick={() => setActiveTab('executions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'executions'
              ? 'bg-amber-500 text-black shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>PM Executions Workbench</span>
        </button>

        {/* Manager Verifications */}
        {isAdminOrManager && (
          <button
            type="button"
            onClick={() => setActiveTab('verifications')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'verifications'
                ? 'bg-amber-500 text-black shadow-xs'
                : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Manager Quality Sign-Off</span>
            {dashboardData?.kpis?.pending_verification_count ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-600 text-white font-mono">
                {dashboardData.kpis.pending_verification_count}
              </span>
            ) : null}
          </button>
        )}

        {/* Analytics & Trends */}
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-amber-500 text-black shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Compliance & Trends</span>
        </button>
      </div>

      {/* 4. Tab Content Rendering */}

      {/* Tab A: Calendar View */}
      {activeTab === 'calendar' && (
        <PMCalendarView
          calendarData={calendarData}
          selectedMonth={selectedMonth}
          onMonthChange={(m) => {
            setSelectedMonth(m);
            loadCalendar(m);
          }}
          onSelectPMItem={(item) => setSelectedPlanDetailId(item.id)}
          loading={calendarLoading}
        />
      )}

      {/* Tab B: Schedule Queues */}
      {activeTab === 'queues' && (
        <PMScheduleQueueTable
          upcomingItems={upcomingItems}
          dueItems={dueItems}
          overdueItems={overdueItems}
          activeQueue={activeQueue}
          onQueueChange={(q) => setActiveQueue(q)}
          onReschedule={(plan) => setActionModal({ type: 'reschedule', plan, isOpen: true })}
          onDefer={(plan) => setActionModal({ type: 'defer', plan, isOpen: true })}
          onSkip={(plan) => setActionModal({ type: 'skip', plan, isOpen: true })}
          canManage={isAdminOrManager}
          loading={queuesLoading}
        />
      )}

      {/* Tab C: Service Plans */}
      {activeTab === 'plans' && (
        <PMPlanManagementTable
          plans={plans}
          onEditPlan={(plan) => {
            setEditingPlan(plan);
            setIsCreatePlanModalOpen(true);
          }}
          onToggleStatus={handleTogglePlanStatus}
          onViewPlanDetail={(plan) => setSelectedPlanDetailId(plan.id)}
          onCreateNewPlan={() => {
            setEditingPlan(null);
            setIsCreatePlanModalOpen(true);
          }}
          canManage={isAdminOrManager}
          loading={plansLoading}
        />
      )}

      {/* Tab D: PM Executions Workbench (Technicians & Oversight) */}
      {activeTab === 'executions' && (
        <PMExecutionQueueTable
          executions={executions}
          onOpenExecution={(item) => setSelectedExecutionId(item.execution_id)}
          onOpenVerification={(item) => setSelectedVerificationItem(item)}
          userRole={userRole}
          loading={executionsLoading}
        />
      )}

      {/* Tab E: Manager Verifications */}
      {activeTab === 'verifications' && (
        <PMExecutionQueueTable
          executions={executions}
          onOpenExecution={(item) => setSelectedExecutionId(item.execution_id)}
          onOpenVerification={(item) => setSelectedVerificationItem(item)}
          userRole={userRole}
          loading={executionsLoading}
        />
      )}

      {/* Tab F: Compliance & Trends Analytics */}
      {activeTab === 'analytics' && (
        <PMAnalyticsView
          complianceData={complianceData}
          trends={trends}
          machineStats={machineStats}
          loading={metricsLoading}
        />
      )}

      {/* 5. Modals & Dialogs */}

      {/* Create / Edit Plan Modal */}
      <PMCreateEditPlanModal
        isOpen={isCreatePlanModalOpen}
        onClose={() => {
          setIsCreatePlanModalOpen(false);
          setEditingPlan(null);
        }}
        onSave={handleSavePlan}
        editingPlan={editingPlan}
        machines={machines}
      />

      {/* Action Modals (Reschedule / Defer / Skip) */}
      <PMActionModal
        type={actionModal.type}
        plan={actionModal.plan}
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal((prev) => ({ ...prev, isOpen: false }))}
        onSubmit={
          actionModal.type === 'reschedule'
            ? handleRescheduleSubmit
            : actionModal.type === 'defer'
            ? handleDeferSubmit
            : handleSkipSubmit
        }
      />

      {/* Technician Execution Checklist Modal */}
      <PMExecutionModal
        executionId={selectedExecutionId}
        isOpen={Boolean(selectedExecutionId)}
        onClose={() => setSelectedExecutionId(null)}
        onSuccess={() => {
          loadExecutions();
          loadKPIs();
        }}
        isTechnician={isTechnician}
      />

      {/* Manager Quality Sign-Off Modal */}
      <PMVerificationModal
        execution={selectedVerificationItem}
        isOpen={Boolean(selectedVerificationItem)}
        onClose={() => setSelectedVerificationItem(null)}
        onSuccess={() => {
          loadExecutions();
          loadKPIs();
        }}
      />

      {/* Plan Details & Historical Work Orders Modal */}
      <PMPlanDetailModal
        planId={selectedPlanDetailId}
        isOpen={Boolean(selectedPlanDetailId)}
        onClose={() => setSelectedPlanDetailId(null)}
      />
    </div>
  );
};
