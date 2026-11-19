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

  useEffect(() => {
    fetchPlans();
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
        showBack={canGoBack}
        onBack={() => navigation.goBack()}
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
              </View>
            );
          })
        )}
      </ScrollView>

      {/* New PM Plan Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalBackdrop}>
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

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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

              <View style={styles.modalBtnRow}>
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
            </ScrollView>
          </View>
        </View>
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 10,
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
});
