import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const PMCalendarScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const isAdminOrMgr = user?.role === 'admin' || user?.role === 'manager';

  const [plans, setPlans] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('ALL');

  // Harshal Feature: PM Execution & Tabs
  const [activeTab, setActiveTab] = useState<'routines' | 'executions'>('routines');
  const [executionsList, setExecutionsList] = useState<any[]>([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);

  // Execution Modal State
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [executingPlan, setExecutingPlan] = useState<any | null>(null);
  const [eligibleMachines, setEligibleMachines] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [selectedExecMachineId, setSelectedExecMachineId] = useState('');
  const [checklistItems, setChecklistItems] = useState<
    Array<{ step: number; task: string; status: 'pass' | 'fail' | 'na'; notes: string }>
  >([]);
  const [overallStatus, setOverallStatus] = useState<'pass' | 'fail'>('pass');
  const [workPerformed, setWorkPerformed] = useState('');
  const [technicianRemarks, setTechnicianRemarks] = useState('');
  const [submittingExec, setSubmittingExec] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    machine_id: '',
    title: 'Monthly Hydraulic Oil & Filter Replacement',
    frequency: 'monthly',
    interval_days: 30,
    operating_hour_threshold: 500,
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const [pmRes, machRes]: any[] = await Promise.all([
        apiClient.get('/pm/plans'),
        apiClient.get('/machines?limit=50'),
      ]);

      setPlans(pmRes?.data || []);
      setMachines(machRes?.data || []);

      if (machRes?.data?.length > 0 && !formData.machine_id) {
        setFormData((prev) => ({ ...prev, machine_id: machRes.data[0].id }));
      }
    } catch (e) {
      console.warn('Failed to load PM plans:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      setLoadingExecutions(true);
      const res: any = await apiClient.get('/pm/executions');
      if (res?.success && Array.isArray(res.data)) {
        setExecutionsList(res.data);
      }
    } catch (e) {
      console.warn('Failed to load PM executions:', e);
    } finally {
      setLoadingExecutions(false);
    }
  };

  const handleOpenExecution = async (plan: any) => {
    setExecutingPlan(plan);
    setWorkPerformed('Preventive maintenance routine executed as per factory standards.');
    setTechnicianRemarks('');
    setOverallStatus('pass');

    let items: any[] = [];
    if (Array.isArray(plan.checklist_template) && plan.checklist_template.length > 0) {
      items = plan.checklist_template.map((c: any, idx: number) => ({
        step: c.step || idx + 1,
        task: c.task || c.description || `Inspection Task ${idx + 1}`,
        status: 'pass',
        notes: '',
      }));
    } else {
      items = [
        { step: 1, task: 'Hydraulic fluid level check & top-up', status: 'pass', notes: '' },
        { step: 2, task: 'Pressure hoses & coupling leak inspection', status: 'pass', notes: '' },
        { step: 3, task: 'Air & engine oil filter inspection/cleaning', status: 'pass', notes: '' },
        { step: 4, task: 'Grease pivot joints & boom linkages', status: 'pass', notes: '' },
        { step: 5, task: 'Emergency stop & electrical circuit verification', status: 'pass', notes: '' },
      ];
    }
    setChecklistItems(items);
    setSelectedExecMachineId(plan.machine_id || '');
    setExecModalOpen(true);

    try {
      setLoadingEligible(true);
      const res: any = await apiClient.get(`/pm/plans/${plan.id}/eligible-machines`);
      if (res?.success && Array.isArray(res.data)) {
        setEligibleMachines(res.data);
        if (!plan.machine_id && res.data.length > 0) {
          setSelectedExecMachineId(res.data[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to load eligible machines:', e);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleChecklistStatusChange = (index: number, newStatus: 'pass' | 'fail' | 'na') => {
    setChecklistItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: newStatus };
      return copy;
    });
  };

  const handleChecklistNotesChange = (index: number, notes: string) => {
    setChecklistItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], notes };
      return copy;
    });
  };

  const handleSubmitExecution = async () => {
    if (!executingPlan) return;
    const targetMachine = selectedExecMachineId || executingPlan.machine_id;
    if (!targetMachine) {
      Alert.alert('Required', 'Please select a target machine for this PM routine.');
      return;
    }
    try {
      setSubmittingExec(true);
      const payload = {
        machine_id: targetMachine,
        checklist_responses: checklistItems,
        overall_status: overallStatus,
        work_performed: workPerformed.trim() || 'PM Routine Executed',
        technician_remarks: technicianRemarks.trim() || undefined,
      };
      const res: any = await apiClient.post(`/pm/plans/${executingPlan.id}/execute`, payload);
      if (res?.success) {
        Alert.alert(
          'PM Execution Logged',
          `Routine checklist completed successfully for ${executingPlan.title}.`
        );
        setExecModalOpen(false);
        fetchPlans();
        fetchExecutions();
      }
    } catch (err: any) {
      Alert.alert('Execution Error', err.message || 'Failed to submit PM execution.');
    } finally {
      setSubmittingExec(false);
    }
  };

  useEffect(() => {
    fetchPlans();
    fetchExecutions();
  }, []);

  const handleTriggerEngine = async () => {
    try {
      setGenerating(true);
      const res: any = await apiClient.post('/pm/generate-due');
      if (res?.success) {
        Alert.alert(
          'PM Engine Executed',
          res.message || 'Due maintenance routines generated into active Work Orders.'
        );
        fetchPlans();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'PM auto-generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreatePMPlan = async () => {
    if (!formData.machine_id || !formData.title.trim()) {
      Alert.alert('Required', 'Please select a machine and enter routine title.');
      return;
    }

    try {
      setActionLoading(true);
      const res: any = await apiClient.post('/pm/plans', {
        ...formData,
        checklist_template: [
          'Inspect hydraulic fluid level, pressure and viscosity',
          'Replace suction and return line oil filters',
          'Inspect valve blocks and hoses for seal leakage',
          'Verify emergency stop and safety interlocks',
        ],
      });
      if (res?.success) {
        Alert.alert('Success', 'Preventive Maintenance plan configured.');
        setIsModalOpen(false);
        fetchPlans();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save PM plan.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Plans
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (plan.plan_code && plan.plan_code.toLowerCase().includes(q)) ||
        (plan.title && plan.title.toLowerCase().includes(q)) ||
        (plan.machine_code && plan.machine_code.toLowerCase().includes(q));

      const matchesFrequency =
        frequencyFilter === 'ALL' ||
        plan.frequency?.toLowerCase() === frequencyFilter.toLowerCase();

      return matchesSearch && matchesFrequency;
    });
  }, [plans, searchQuery, frequencyFilter]);

  // Dynamic KPI counts
  const kpiStats = useMemo(() => {
    const total = plans.length;
    const dueNow = plans.filter((p) => p.next_pm_date && new Date(p.next_pm_date) <= new Date()).length;
    const monthly = plans.filter((p) => p.frequency === 'monthly').length;
    const runHourTriggered = plans.filter((p) => (p.operating_hour_threshold || 0) > 0).length;
    return { total, dueNow, monthly, runHourTriggered };
  }, [plans]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="PM Maintenance"
        icon="calendar-clock"
        sectionTitle="Preventive Maintenance"
        sectionSubtitle="Periodic schedules & run-hour service routines"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
        rightAction={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.runEngineBtn}
              onPress={handleTriggerEngine}
              disabled={generating}
              activeOpacity={0.8}
            >
              {generating ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <MaterialCommunityIcons name="play" size={14} color="#000000" />
                  <Text style={styles.runEngineBtnText}>Run</Text>
                </View>
              )}
            </TouchableOpacity>

            {isAdminOrMgr && (
              <TouchableOpacity
                style={styles.addPlanBtn}
                onPress={() => setIsModalOpen(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#000000" />
                <Text style={styles.addPlanBtnText}>Plan</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Segmented Tab Bar: Routines vs Executions */}
      <View style={styles.segmentTabBar}>
        <TouchableOpacity
          style={[styles.segmentTabItem, activeTab === 'routines' && styles.segmentTabItemActive]}
          onPress={() => setActiveTab('routines')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="calendar-clock"
            size={18}
            color={activeTab === 'routines' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.segmentTabLabel, activeTab === 'routines' && styles.segmentTabLabelActive]}>
            PM Routines ({plans.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentTabItem, activeTab === 'executions' && styles.segmentTabItemActive]}
          onPress={() => setActiveTab('executions')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="clipboard-list-outline"
            size={18}
            color={activeTab === 'executions' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.segmentTabLabel, activeTab === 'executions' && styles.segmentTabLabelActive]}>
            Execution Logs ({executionsList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpiStats.total}</Text>
          <Text style={styles.kpiLabel}>Total Plans</Text>
        </View>
        <View style={[styles.kpiCard, kpiStats.dueNow > 0 && styles.kpiCardUrgent]}>
          <Text style={[styles.kpiValue, kpiStats.dueNow > 0 && { color: '#DC2626' }]}>
            {kpiStats.dueNow}
          </Text>
          <Text style={styles.kpiLabel}>Due Today</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#B45309' }]}>{kpiStats.monthly}</Text>
          <Text style={styles.kpiLabel}>Monthly</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#047857' }]}>{kpiStats.runHourTriggered}</Text>
          <Text style={styles.kpiLabel}>By Hours</Text>
        </View>
      </View>

      {activeTab === 'routines' ? (
        <>
          {/* Search Bar */}
          <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plans, machines, codes..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {[
            { id: 'ALL', label: 'All Plans' },
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'quarterly', label: 'Quarterly' },
            { id: 'yearly', label: 'Yearly' },
          ].map((chip) => {
            const active = frequencyFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFrequencyFilter(chip.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content List */}
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchPlans}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filteredPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="calendar-check" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery || frequencyFilter !== 'ALL' ? 'No Matching PM Plans' : 'No PM Plans Configured'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || frequencyFilter !== 'ALL'
                ? 'Try adjusting your search terms or filters'
                : 'Configure periodic maintenance schedules to keep machines running smoothly'}
            </Text>
            {(searchQuery || frequencyFilter !== 'ALL') && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  setFrequencyFilter('ALL');
                }}
              >
                <Text style={styles.clearFilterBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredPlans.map((plan) => {
            const isDue = plan.next_pm_date && new Date(plan.next_pm_date) <= new Date();
            const dueDateStr = plan.next_pm_date
              ? new Date(plan.next_pm_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Continuous';

            return (
              <View key={plan.id} style={styles.card}>
                {/* Card Top: Code & Status Badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{plan.plan_code || 'PM-PLAN'}</Text>
                  </View>
                  <View style={[styles.statusBadge, isDue ? styles.statusBadgeDue : styles.statusBadgeNominal]}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isDue ? '#DC2626' : '#10B981' },
                      ]}
                    />
                    <Text style={[styles.statusBadgeText, isDue ? styles.statusTextDue : styles.statusTextNominal]}>
                      {isDue ? 'DUE NOW' : 'SCHEDULED'}
                    </Text>
                  </View>
                </View>

                {/* Plan Title */}
                <Text style={styles.planTitle}>{plan.title}</Text>

                {/* Machine Assignment Pill */}
                <View style={styles.machineRow}>
                  <MaterialCommunityIcons name="robot-industrial" size={16} color="#64748B" />
                  <Text style={styles.machineLabel}>Target:</Text>
                  <Text style={styles.machineCode}>{plan.machine_code || 'Plant-wide Asset'}</Text>
                  {plan.machine_name && (
                    <Text style={styles.machineName} numberOfLines={1}>
                      • {plan.machine_name}
                    </Text>
                  )}
                </View>

                {/* Meta Grid */}
                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#64748B" />
                    <Text style={styles.metaLabel}>Cadence:</Text>
                    <Text style={styles.metaValue}>
                      {plan.frequency ? plan.frequency.toUpperCase() : 'MONTHLY'} ({plan.interval_days || 30}d)
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="speedometer" size={14} color="#64748B" />
                    <Text style={styles.metaLabel}>Threshold:</Text>
                    <Text style={styles.metaValue}>
                      {plan.operating_hour_threshold ? `${plan.operating_hour_threshold} hrs` : 'Calendar Only'}
                    </Text>
                  </View>

                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="calendar-clock" size={14} color={isDue ? '#DC2626' : '#64748B'} />
                    <Text style={styles.metaLabel}>Next Due:</Text>
                    <Text style={[styles.metaValue, isDue && { color: '#DC2626', fontWeight: '800' }]}>
                      {dueDateStr}
                    </Text>
                  </View>
                </View>

                {/* Harshal Feature: Execute Checklist Action */}
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    style={styles.executeRoutineBtn}
                    onPress={() => handleOpenExecution(plan)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="clipboard-check" size={16} color="#000000" />
                    <Text style={styles.executeRoutineBtnText}>EXECUTE PM CHECKLIST</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  ) : (
    /* Executions History Tab */
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loadingExecutions}
            onRefresh={fetchExecutions}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {executionsList.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Execution Records Found</Text>
            <Text style={styles.emptySubtitle}>
              Completed preventive maintenance routines will appear here with verification logs.
            </Text>
          </View>
        ) : (
          executionsList.map((ex) => {
            const isPass = ex.overall_status === 'pass' || ex.status === 'completed' || ex.status === 'verified';
            return (
              <View key={ex.id} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.codeBadge}>
                    <Text style={styles.codeText}>{ex.execution_number || ex.plan_code || 'PM-EXEC'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isPass ? styles.statusBadgeNominal : styles.statusBadgeDue,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isPass ? styles.statusTextNominal : styles.statusTextDue,
                      ]}
                    >
                      {(ex.overall_status || ex.status || 'COMPLETED').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.planTitle}>{ex.plan_title || ex.routine_title || 'Maintenance Routine'}</Text>

                <View style={styles.machineRow}>
                  <MaterialCommunityIcons name="robot-industrial" size={16} color="#64748B" />
                  <Text style={styles.machineLabel}>Machine:</Text>
                  <Text style={styles.machineCode}>{ex.machine_code || 'Plant Machinery'}</Text>
                </View>

                {ex.work_performed ? (
                  <Text style={styles.execWorkText} numberOfLines={2}>
                    Work: {ex.work_performed}
                  </Text>
                ) : null}

                <View style={styles.execFooterRow}>
                  <Text style={styles.execTechText}>
                    Tech: {ex.technician_name || ex.executed_by_name || 'Plant Technician'}
                  </Text>
                  <Text style={styles.execDateText}>
                    {ex.executed_at || ex.completed_at
                      ? new Date(ex.executed_at || ex.completed_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : 'Recently'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    )}

      {/* New PM Plan Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New PM Schedule</Text>
                <Text style={styles.modalSubtitle}>Create automated maintenance routine</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.inputLabel}>Routine Title *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.title}
                onChangeText={(t) => setFormData({ ...formData, title: t })}
                placeholder="e.g. Monthly Hydraulic Filter Replacement"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Select Machine *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.machineScroll}>
                {machines.map((m) => {
                  const selected = formData.machine_id === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.selectCard, selected && styles.selectCardActive]}
                      onPress={() => setFormData({ ...formData, machine_id: m.id })}
                    >
                      <Text style={[styles.selectCardTitle, selected && styles.selectCardTitleActive]}>
                        {m.machine_code}
                      </Text>
                      <Text style={[styles.selectCardSub, selected && styles.selectCardSubActive]} numberOfLines={1}>
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.freqRow}>
                {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map((f) => {
                  const selected = formData.frequency === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.freqChip, selected && styles.freqChipActive]}
                      onPress={() => setFormData({ ...formData, frequency: f })}
                    >
                      <Text style={[styles.freqChipText, selected && styles.freqChipTextActive]}>
                        {f.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Interval (Calendar Days)</Text>
              <TextInput
                style={styles.textInput}
                value={String(formData.interval_days)}
                onChangeText={(t) => setFormData({ ...formData, interval_days: parseInt(t, 10) || 1 })}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Operating Hour Threshold (Run Hours)</Text>
              <TextInput
                style={styles.textInput}
                value={String(formData.operating_hour_threshold)}
                onChangeText={(t) => setFormData({ ...formData, operating_hour_threshold: parseInt(t, 10) || 0 })}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            <View style={styles.modalBtnRowPinned}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreatePMPlan}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save PM Routine</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Harshal Feature: PM Routine Execution & Checklist Modal */}
      <Modal
        visible={execModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setExecModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalContainer, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Execute: {executingPlan?.title || 'PM Routine'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Code: {executingPlan?.plan_code || 'PM-PLAN'} • Checklist Verification
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setExecModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Target Machine Selection */}
              <Text style={styles.inputLabel}>TARGET MACHINERY *</Text>
              {loadingEligible ? (
                <ActivityIndicator size="small" color="#F9B101" style={{ marginVertical: 6 }} />
              ) : eligibleMachines.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {eligibleMachines.map((m) => {
                    const isSel = selectedExecMachineId === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.execMachPill, isSel && styles.execMachPillActive]}
                        onPress={() => setSelectedExecMachineId(m.id)}
                      >
                        <Text style={[styles.execMachCode, isSel && styles.execMachCodeActive]}>
                          {m.machine_code}
                        </Text>
                        <Text style={[styles.execMachName, isSel && styles.execMachNameActive]} numberOfLines={1}>
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.defaultMachBox}>
                  <Text style={styles.defaultMachText}>
                    Assigned Machine: {executingPlan?.machine_code || 'All Plant Machinery'}
                  </Text>
                </View>
              )}

              {/* Overall Status Toggle */}
              <Text style={styles.inputLabel}>OVERALL OUTCOME *</Text>
              <View style={styles.outcomeRow}>
                <TouchableOpacity
                  style={[styles.outcomeBtn, overallStatus === 'pass' && styles.outcomeBtnPass]}
                  onPress={() => setOverallStatus('pass')}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={overallStatus === 'pass' ? '#16A34A' : '#64748B'}
                  />
                  <Text style={[styles.outcomeText, overallStatus === 'pass' && styles.outcomeTextPass]}>
                    PASS / NOMINAL
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.outcomeBtn, overallStatus === 'fail' && styles.outcomeBtnFail]}
                  onPress={() => setOverallStatus('fail')}
                >
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={18}
                    color={overallStatus === 'fail' ? '#DC2626' : '#64748B'}
                  />
                  <Text style={[styles.outcomeText, overallStatus === 'fail' && styles.outcomeTextFail]}>
                    FAIL / ACTION REQ
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Interactive Checklist Steps */}
              <Text style={styles.inputLabel}>PM CHECKLIST STEPS ({checklistItems.length})</Text>
              {checklistItems.map((item, idx) => {
                return (
                  <View key={item.step || idx} style={styles.checkItemCard}>
                    <View style={styles.checkItemHeader}>
                      <View style={styles.stepCircle}>
                        <Text style={styles.stepNum}>{item.step || idx + 1}</Text>
                      </View>
                      <Text style={styles.checkTaskText}>{item.task}</Text>
                    </View>

                    {/* Step Status Toggles */}
                    <View style={styles.stepStatusRow}>
                      {(['pass', 'fail', 'na'] as const).map((st) => {
                        const isSelected = item.status === st;
                        return (
                          <TouchableOpacity
                            key={st}
                            style={[
                              styles.stepStatusPill,
                              isSelected &&
                                (st === 'pass'
                                  ? styles.pillPassActive
                                  : st === 'fail'
                                  ? styles.pillFailActive
                                  : styles.pillNaActive),
                            ]}
                            onPress={() => handleChecklistStatusChange(idx, st)}
                          >
                            <Text
                              style={[
                                styles.stepStatusPillText,
                                isSelected &&
                                  (st === 'pass'
                                    ? styles.textPassActive
                                    : st === 'fail'
                                    ? styles.textFailActive
                                    : styles.textNaActive),
                              ]}
                            >
                              {st.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Step Notes */}
                    <TextInput
                      style={styles.stepNotesInput}
                      placeholder="Step remarks or measurements..."
                      placeholderTextColor="#94A3B8"
                      value={item.notes}
                      onChangeText={(txt) => handleChecklistNotesChange(idx, txt)}
                    />
                  </View>
                );
              })}

              {/* Work Performed */}
              <Text style={styles.inputLabel}>WORK PERFORMED</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 50 }]}
                placeholder="Details of servicing performed..."
                placeholderTextColor="#94A3B8"
                value={workPerformed}
                onChangeText={setWorkPerformed}
                multiline
              />

              {/* Technician Remarks */}
              <Text style={styles.inputLabel}>TECHNICIAN REMARKS</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 50 }]}
                placeholder="Observations, oil level, future recommendation..."
                placeholderTextColor="#94A3B8"
                value={technicianRemarks}
                onChangeText={setTechnicianRemarks}
                multiline
              />

              {/* Submit Execution Button */}
              <TouchableOpacity
                style={styles.submitExecBtn}
                onPress={handleSubmitExecution}
                disabled={submittingExec}
                activeOpacity={0.88}
              >
                {submittingExec ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-decagram" size={20} color="#000000" />
                    <Text style={styles.submitExecBtnText}>COMPLETE & LOG PM EXECUTION</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  brandBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  titleColumn: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  runEngineBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runEngineBtnText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  addPlanBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPlanBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardUrgent: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    paddingVertical: 0,
  },
  chipsScroll: {
    marginTop: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  listScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeDue: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeNominal: {
    backgroundColor: '#ECFDF5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTextDue: {
    color: '#DC2626',
  },
  statusTextNominal: {
    color: '#047857',
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
    gap: 6,
  },
  machineLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  machineCode: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  machineName: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
  },
  metaGrid: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 5,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  clearFilterBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearFilterBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: 18,
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0F172A',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    fontWeight: '500',
  },
  machineScroll: {
    marginBottom: 6,
  },
  selectCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 100,
  },
  selectCardActive: {
    backgroundColor: '#FEF3C7',
    borderColor: COLORS.primary,
  },
  selectCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectCardTitleActive: {
    color: '#92400E',
  },
  selectCardSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  selectCardSubActive: {
    color: '#B45309',
  },
  freqRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  freqChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  freqChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  freqChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  modalBtnRowPinned: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  // Harshal Feature: PM Execution Styles
  segmentTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  segmentTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentTabItemActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F9B101',
  },
  segmentTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTabLabelActive: {
    color: '#000000',
    fontWeight: '900',
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 10,
  },
  executeRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F9B101',
    borderRadius: 8,
    paddingVertical: 9,
  },
  executeRoutineBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  execWorkText: {
    fontSize: 11.5,
    color: '#334155',
    marginBottom: 6,
  },
  execFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  execTechText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  execDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  execMachPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    minWidth: 90,
  },
  execMachPillActive: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFBEB',
  },
  execMachCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  execMachCodeActive: {
    color: '#000000',
  },
  execMachName: {
    fontSize: 10,
    color: '#64748B',
  },
  execMachNameActive: {
    color: '#334155',
  },
  defaultMachBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  defaultMachText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  outcomeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  outcomeBtnPass: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  outcomeBtnFail: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  outcomeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  outcomeTextPass: {
    color: '#16A34A',
    fontWeight: '900',
  },
  outcomeTextFail: {
    color: '#DC2626',
    fontWeight: '900',
  },
  checkItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  checkItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  checkTaskText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    lineHeight: 18,
  },
  stepStatusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  stepStatusPill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  stepStatusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  pillPassActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  textPassActive: {
    color: '#16A34A',
    fontWeight: '900',
  },
  pillFailActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  textFailActive: {
    color: '#DC2626',
    fontWeight: '900',
  },
  pillNaActive: {
    backgroundColor: '#E2E8F0',
    borderColor: '#94A3B8',
  },
  textNaActive: {
    color: '#334155',
    fontWeight: '900',
  },
  stepNotesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: '#0F172A',
  },
  submitExecBtn: {
    backgroundColor: '#F9B101',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  submitExecBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
