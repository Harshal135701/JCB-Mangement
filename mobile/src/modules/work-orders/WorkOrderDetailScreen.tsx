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
} from 'react-native';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

export const WorkOrderDetailScreen = ({ route, navigation }: any) => {
  const { workOrder } = route.params;
  const [currentStatus, setCurrentStatus] = useState(workOrder.status);
  const [loading, setLoading] = useState(false);

  // RCA Form states
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [diagnosis, setDiagnosis] = useState('Proportional solenoid spool stuck due to hydraulic fluid varnish');
  const [rootCause, setRootCause] = useState('Why 1: Spool failed to actuate -> Why 2: High friction -> Why 3: Oil varnish -> Why 4: Filter saturation');
  const [correctiveAction, setCorrectiveAction] = useState('Replaced proportional valve 332/Y2415 and flushed line filter');

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
          Alert.alert('Status Updated', `Action ${action} recorded in machine downtime ledger.`);
        }
      }
    } catch (e: any) {
      Alert.alert('Milestone Error', e.message || 'Failed to update work order.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* WO Header Banner */}
      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <Text style={styles.woNumber}>{workOrder.wo_number}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{currentStatus.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.machineName}>{workOrder.machine_code} - {workOrder.machine_name}</Text>
        <Text style={styles.location}>Location: {workOrder.bay_line_location || 'Bay 1 / Line 4'}</Text>
      </View>

      {/* Safety LOTO Warning */}
      <View style={styles.safetyBox}>
        <Text style={styles.safetyTitle}>⚠️ MANDATORY SAFETY INSTRUCTIONS</Text>
        <Text style={styles.safetyText}>
          Lockout/Tagout (LOTO) key must be attached to the breaker panel prior to opening hydraulic valve blocks.
        </Text>
      </View>

      {/* Spare Parts Action */}
      <TouchableOpacity
        style={styles.sparesBtn}
        onPress={() => navigation.navigate('PartSearch', { workOrderId: workOrder.id })}
      >
        <Text style={styles.sparesIcon}>🔍</Text>
        <View style={styles.sparesTextContainer}>
          <Text style={styles.sparesTitle}>Search & Reserve Spare Parts (160k Catalog)</Text>
          <Text style={styles.sparesSub}>Lookup JCB part number, bin rack & check stock</Text>
        </View>
      </TouchableOpacity>

      {/* Milestone Action Timer Buttons */}
      <Text style={styles.sectionTitle}>Execution Milestones</Text>

      {currentStatus === 'assigned' && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
          onPress={() => triggerMilestone('ARRIVED')}
          disabled={loading}
        >
          <Text style={styles.actionBtnText}>ARRIVED AT MACHINE</Text>
        </TouchableOpacity>
      )}

      {currentStatus !== 'in_progress' && currentStatus !== 'repair_completed' && currentStatus !== 'verified_closed' && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.statusRunning }]}
          onPress={() => triggerMilestone('START_WORK')}
          disabled={loading}
        >
          <Text style={styles.actionBtnText}>START ACTIVE REPAIR TIMER</Text>
        </TouchableOpacity>
      )}

      {currentStatus === 'in_progress' && (
        <>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => triggerMilestone('PAUSE')}
            disabled={loading}
          >
            <Text style={styles.actionBtnText}>PAUSE (AWAITING PARTS / SHIFT HANDOVER)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
            onPress={() => setShowRcaModal(true)}
            disabled={loading}
          >
            <Text style={[styles.actionBtnText, { color: '#000000' }]}>FINISH REPAIR & SUBMIT RCA</Text>
          </TouchableOpacity>
        </>
      )}

      {/* RCA 5-Why Modal / Inputs */}
      {showRcaModal && (
        <View style={styles.rcaBox}>
          <Text style={styles.rcaHeading}>5-Why Root Cause Analysis (RCA)</Text>

          <Text style={styles.inputLabel}>Technician Diagnosis</Text>
          <TextInput
            style={styles.input}
            value={diagnosis}
            onChangeText={setDiagnosis}
          />

          <Text style={styles.inputLabel}>5-Why Failure Analysis</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={rootCause}
            onChangeText={setRootCause}
            multiline
          />

          <Text style={styles.inputLabel}>Corrective Action Taken</Text>
          <TextInput
            style={styles.input}
            value={correctiveAction}
            onChangeText={setCorrectiveAction}
          />

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.statusRunning, marginTop: 12 }]}
            onPress={() => triggerMilestone('COMPLETE')}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionBtnText}>CONFIRM & SUBMIT FOR QA</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  woNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  machineName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  location: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  safetyBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  safetyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 16,
  },
  sparesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  sparesIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  sparesTextContainer: {
    flex: 1,
  },
  sparesTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  sparesSub: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },
  actionBtn: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rcaBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rcaHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
});

