import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { AppHeader } from '../../components/AppHeader';

export const WorkOrderDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { workOrder } = route.params;
  const [currentStatus, setCurrentStatus] = useState(workOrder.status);
  const [loading, setLoading] = useState(false);

  // RCA Form states
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [diagnosis, setDiagnosis] = useState('Proportional solenoid spool stuck due to hydraulic fluid varnish');
  const [rootCause, setRootCause] = useState('Spool stuck -> High friction -> Oil varnish -> Filter saturation');
  const [correctiveAction, setCorrectiveAction] = useState('Replaced proportional valve and flushed line filter');

  const triggerMilestone = async (action: string) => {
    try {
      setLoading(true);
      const payload: any = { action };

      if (action === 'COMPLETE') {
        payload.diagnosis = diagnosis;
        payload.root_cause_analysis = rootCause;
        payload.corrective_action = correctiveAction;
      }

      const res: any = await apiClient.post(`/work-orders/${workOrder.id}/milestone`, payload);

      if (res.success) {
        if (action === 'START_WORK') setCurrentStatus('in_progress');
        if (action === 'PAUSE') setCurrentStatus('on_hold_parts');
        if (action === 'COMPLETE') {
          setCurrentStatus('repair_completed');
          setShowRcaModal(false);
          Alert.alert('Work Completed', 'Repair submitted for Manager Quality Verification & Handover.');
        } else {
          Alert.alert('Status Updated', `Action ${action} recorded in downtime ledger.`);
        }
      }
    } catch (e: any) {
      Alert.alert('Milestone Error', e.message || 'Failed to update work order.');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = currentStatus === 'repair_completed' || currentStatus === 'verified_closed';
  const isInProgress = currentStatus === 'in_progress';

  return (
    <View style={styles.container}>
      <AppHeader
        title={workOrder.wo_number || 'Work Order'}
        icon="wrench"
        sectionTitle="Work Order Execution"
        sectionSubtitle="Step-by-step repair, parts usage & LOTO compliance"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* WO Overview Card */}
        <View style={styles.overviewCard}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.machineCode}>{workOrder.machine_code || 'JCB-MACH'}</Text>
              <Text style={styles.machineName}>{workOrder.machine_name || 'Machining Center'}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isInProgress
                  ? styles.statusBadgeActive
                  : isCompleted
                  ? styles.statusBadgeDone
                  : styles.statusBadgeAssigned,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  isInProgress
                    ? { color: '#1D4ED8' }
                    : isCompleted
                    ? { color: '#047857' }
                    : { color: '#B45309' },
                ]}
              >
                {(currentStatus || 'ASSIGNED').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue}>{workOrder.bay_line_location || 'Bay 1 / Line 4'}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Assigned Tech</Text>
              <Text style={styles.metaValue}>{workOrder.technician_name || 'Assigned Crew'}</Text>
            </View>
          </View>

          {workOrder.problem_description ? (
            <View style={styles.issueBox}>
              <Text style={styles.issueLabel}>Issue Description:</Text>
              <Text style={styles.issueText}>{workOrder.problem_description}</Text>
            </View>
          ) : null}
        </View>

        {/* Safety LOTO Warning */}
        <View style={styles.safetyCard}>
          <MaterialCommunityIcons name="shield-alert" size={24} color="#D97706" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.safetyTitle}>Mandatory Safety Rule (LOTO)</Text>
            <Text style={styles.safetyText}>
              Ensure Lockout/Tagout (LOTO) key is attached to the main breaker before opening valve blocks or electrical panels.
            </Text>
          </View>
        </View>

        {/* Spare Parts Action Button */}
        <TouchableOpacity
          style={styles.sparesTile}
          onPress={() => navigation.navigate('PartSearch', { workOrderId: workOrder.id })}
          activeOpacity={0.8}
        >
          <View style={styles.sparesIconBox}>
            <MaterialCommunityIcons name="package-variant-closed" size={22} color="#000000" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.sparesTitle}>Find & Reserve Spare Parts</Text>
            <Text style={styles.sparesSubtitle}>Check bin rack locations & reserve stock</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Execution Milestones */}
        <View style={styles.milestoneSection}>
          <Text style={styles.sectionHeading}>Repair Milestones</Text>

          {currentStatus === 'assigned' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
              onPress={() => triggerMilestone('ARRIVED')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="map-marker-check" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Confirm Arrival at Machine</Text>
            </TouchableOpacity>
          )}

          {!isInProgress && !isCompleted && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 10 }]}
              onPress={() => triggerMilestone('START_WORK')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="timer-play-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Start Active Repair Timer</Text>
            </TouchableOpacity>
          )}

          {isInProgress && (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                onPress={() => triggerMilestone('PAUSE')}
                disabled={loading}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="pause-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Pause Repair (Awaiting Parts)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
                onPress={() => setShowRcaModal(true)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color="#000000" style={{ marginRight: 8 }} />
                <Text style={[styles.actionBtnText, { color: '#000000' }]}>Complete Repair & Submit Handover</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* RCA 5-Why Modal */}
        {showRcaModal && (
          <View style={styles.rcaCard}>
            <Text style={styles.rcaHeading}>Root Cause Analysis (RCA)</Text>

            <Text style={styles.inputLabel}>Technician Diagnosis *</Text>
            <TextInput
              style={styles.textInput}
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder="What specifically failed on the machine?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>5-Why Failure Analysis</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={rootCause}
              onChangeText={setRootCause}
              placeholder="Why did it happen? (e.g. Oil contamination -> Filter saturated)"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <Text style={styles.inputLabel}>Corrective Action Taken *</Text>
            <TextInput
              style={styles.textInput}
              value={correctiveAction}
              onChangeText={setCorrectiveAction}
              placeholder="What repair/replacement was performed?"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 14 }]}
              onPress={() => triggerMilestone('COMPLETE')}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionBtnText}>Confirm & Submit Quality Handover</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  brandBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  brandBadgeText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  machineCode: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  machineName: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeAssigned: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeActive: {
    backgroundColor: '#DBEAFE',
  },
  statusBadgeDone: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  issueBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  issueLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  issueText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  safetyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  safetyText: {
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  sparesTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sparesIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  sparesSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  milestoneSection: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  rcaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rcaHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 12.5,
    color: '#0F172A',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
});
