import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Data interfaces
interface ChecklistItem {
  id: string;
  label: string;
  type: 'boolean' | 'number' | 'select';
  unit?: string;
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  required?: boolean;
  is_critical?: boolean;
  options?: string[];
}

interface SensorThresholdItem {
  min?: number;
  max?: number;
  critical_min?: number;
  critical_max?: number;
  unit?: string;
  required?: boolean;
}

interface SensorThresholds {
  temperature?: SensorThresholdItem;
  pressure?: SensorThresholdItem;
  vibration?: SensorThresholdItem;
}

interface InspectionTemplate {
  id: string;
  title: string;
  version?: number;
  machine_category: string;
  checklist: ChecklistItem[];
  sensor_thresholds?: SensorThresholds;
  is_active?: boolean;
}

interface InspectionRecord {
  id: string;
  machine_id: string;
  machine_code?: string;
  machine_name?: string;
  operator_id?: string;
  operator_name?: string;
  shift: string;
  overall_status: 'pass' | 'flagged' | 'fail';
  temperature?: number | null;
  pressure?: number | null;
  vibration?: number | null;
  responses_json?: any;
  created_at: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'chk-1',
    label: 'Hydraulic fluid level in reservoir is within nominal operational sight glass',
    type: 'boolean',
    required: true,
    is_critical: true,
  },
  {
    id: 'chk-2',
    label: 'Emergency stop push-buttons and safety interlock switches fully operational',
    type: 'boolean',
    required: true,
    is_critical: true,
  },
  {
    id: 'chk-3',
    label: 'Coolant fluid concentration and circulation flow rate verified',
    type: 'boolean',
    required: true,
    is_critical: false,
  },
  {
    id: 'chk-4',
    label: 'Visual check for hydraulic hose weeping, air leakage, or oil pooling',
    type: 'boolean',
    required: true,
    is_critical: true,
  },
  {
    id: 'chk-5',
    label: 'Safety guards, chip conveyors, and interlocking enclosure doors intact',
    type: 'boolean',
    required: true,
    is_critical: false,
  },
];

export const PreShiftInspectionScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Mode Tabs: 'run' (Checklist Execution) | 'history' (Inspection Records)
  const [activeTab, setActiveTab] = useState<'run' | 'history'>('run');

  // Machinery Asset State
  const [machines, setMachines] = useState<any[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [loadingMachines, setLoadingMachines] = useState(false);

  // Template State
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Form State
  const [responses, setResponses] = useState<
    Record<string, { value: any; notes: string; status: 'pass' | 'flagged' | 'fail' }>
  >({});
  const [temperature, setTemperature] = useState('42');
  const [pressure, setPressure] = useState('110');
  const [vibration, setVibration] = useState('1.4');
  const [shift, setShift] = useState<'Shift A' | 'Shift B' | 'Shift C'>('Shift A');
  const [isCertified, setIsCertified] = useState(false);
  const [escalateOnFail, setEscalateOnFail] = useState(true);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);

  // Records / History State
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsFilter, setRecordsFilter] = useState<'ALL' | 'PASS' | 'FLAGGED' | 'FAIL'>('ALL');
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<InspectionRecord | null>(null);

  // 1. Fetch Machine Assets
  const fetchMachines = useCallback(async () => {
    try {
      setLoadingMachines(true);
      const res: any = await apiClient.get('/machines?limit=100');
      if (res?.success && Array.isArray(res.data)) {
        setMachines(res.data);
        if (res.data.length > 0 && !selectedMachine) {
          setSelectedMachine(res.data[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load machinery assets:', err);
    } finally {
      setLoadingMachines(false);
    }
  }, [selectedMachine]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  // 2. Fetch Active Template when machine changes
  useEffect(() => {
    if (!selectedMachine) return;
    const fetchTemplate = async () => {
      try {
        setLoadingTemplate(true);
        const category = selectedMachine.category || 'HMC';
        const res: any = await apiClient.get(`/inspections/template?category=${encodeURIComponent(category)}`);

        let activeChecklist = DEFAULT_CHECKLIST;
        if (res?.success && res.data?.checklist && res.data.checklist.length > 0) {
          setTemplate(res.data);
          activeChecklist = res.data.checklist;
        } else {
          setTemplate({
            id: 'default-template',
            title: `${selectedMachine.name || 'JCB Asset'} Standard AM Checklist`,
            machine_category: category,
            checklist: DEFAULT_CHECKLIST,
            sensor_thresholds: {
              temperature: { min: 20, max: 75, critical_max: 85, unit: '°C' },
              pressure: { min: 40, max: 180, critical_min: 20, unit: 'bar' },
              vibration: { max: 2.8, critical_max: 4.5, unit: 'mm/s' },
            },
          });
        }

        // Initialize responses
        const initMap: Record<string, { value: any; notes: string; status: 'pass' | 'flagged' | 'fail' }> = {};
        activeChecklist.forEach((item) => {
          initMap[item.id] = { value: true, notes: '', status: 'pass' };
        });
        setResponses(initMap);
      } catch (err) {
        console.warn('Failed to fetch inspection template, using standard defaults:', err);
        setTemplate({
          id: 'default-template',
          title: `${selectedMachine.name || 'JCB Asset'} Standard AM Checklist`,
          machine_category: selectedMachine.category || 'HMC',
          checklist: DEFAULT_CHECKLIST,
        });
        const initMap: Record<string, { value: any; notes: string; status: 'pass' | 'flagged' | 'fail' }> = {};
        DEFAULT_CHECKLIST.forEach((item) => {
          initMap[item.id] = { value: true, notes: '', status: 'pass' };
        });
        setResponses(initMap);
      } finally {
        setLoadingTemplate(false);
      }
    };

    fetchTemplate();
  }, [selectedMachine]);

  // 3. Fetch Inspection Records (History)
  const fetchRecords = useCallback(async () => {
    try {
      setLoadingRecords(true);
      const res: any = await apiClient.get('/inspections/records');
      if (res?.success && Array.isArray(res.data)) {
        setRecords(res.data);
      }
    } catch (err) {
      console.warn('Failed to load inspection records:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchRecords();
    }
  }, [activeTab, fetchRecords]);

  // Handle checkpoint status toggle
  const handleSetItemStatus = (itemId: string, status: 'pass' | 'flagged' | 'fail') => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { value: true, notes: '' }),
        value: status === 'pass',
        status,
      },
    }));
  };

  const handleSetItemNotes = (itemId: string, notes: string) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { value: true, status: 'pass' }),
        notes,
      },
    }));
  };

  // Sensor threshold dynamic evaluation
  const sensorStatus = useMemo(() => {
    const tNum = parseFloat(temperature);
    const pNum = parseFloat(pressure);
    const vNum = parseFloat(vibration);

    const tempStatus = isNaN(tNum) ? 'pass' : tNum > 85 ? 'fail' : tNum > 65 ? 'flagged' : 'pass';
    const pressStatus = isNaN(pNum) ? 'pass' : pNum < 25 || pNum > 210 ? 'fail' : pNum < 40 || pNum > 190 ? 'flagged' : 'pass';
    const vibStatus = isNaN(vNum) ? 'pass' : vNum > 4.5 ? 'fail' : vNum > 2.8 ? 'flagged' : 'pass';

    return { tempStatus, pressStatus, vibStatus };
  }, [temperature, pressure, vibration]);

  // Overall status evaluation
  const auditSummary = useMemo(() => {
    const checklistItems = template?.checklist || DEFAULT_CHECKLIST;
    let pass = 0;
    let flagged = 0;
    let fail = 0;

    checklistItems.forEach((item) => {
      const resp = responses[item.id];
      const st = resp?.status || 'pass';
      if (st === 'fail') fail++;
      else if (st === 'flagged') flagged++;
      else pass++;
    });

    if (sensorStatus.tempStatus === 'fail') fail++;
    else if (sensorStatus.tempStatus === 'flagged') flagged++;

    if (sensorStatus.pressStatus === 'fail') fail++;
    else if (sensorStatus.pressStatus === 'flagged') flagged++;

    if (sensorStatus.vibStatus === 'fail') fail++;
    else if (sensorStatus.vibStatus === 'flagged') flagged++;

    const overallStatus: 'pass' | 'flagged' | 'fail' = fail > 0 ? 'fail' : flagged > 0 ? 'flagged' : 'pass';

    return { pass, flagged, fail, overallStatus };
  }, [template, responses, sensorStatus]);

  // Submit Handler
  const handleSubmitInspection = async () => {
    if (!selectedMachine) {
      Alert.alert('Machine Required', 'Please select a machinery asset to inspect.');
      return;
    }

    if (!isCertified) {
      Alert.alert(
        'Operator Certification Required',
        'Please certify the physical pre-shift inspection confirmation checkbox before final submission.'
      );
      return;
    }

    try {
      setSubmitting(true);
      const checklistItems = template?.checklist || DEFAULT_CHECKLIST;

      const payloadResponses = checklistItems.map((item) => {
        const resp = responses[item.id] || { value: true, notes: '', status: 'pass' };
        return {
          id: item.id,
          value: item.type === 'number' ? Number(resp.value) : resp.value,
          status: resp.status,
          notes: resp.notes?.trim() || undefined,
        };
      });

      const payload = {
        machine_id: selectedMachine.id,
        template_id: template?.id || 'default-template',
        shift,
        temperature: temperature.trim() ? parseFloat(temperature) : null,
        pressure: pressure.trim() ? parseFloat(pressure) : null,
        vibration: vibration.trim() ? parseFloat(vibration) : null,
        responses: payloadResponses,
        operator_signature_url: `SIGNATURE_VERIFIED_OPERATOR_${user?.employeeCode || 'OPR'}_${Date.now()}`,
        escalate_on_fail: escalateOnFail,
      };

      const res: any = await apiClient.post('/inspections/submit', payload);

      if (res?.success) {
        setSubmissionResult({
          status: res.data?.overall_status || auditSummary.overallStatus,
          machineCode: selectedMachine.code || selectedMachine.name,
          timestamp: new Date().toLocaleTimeString(),
          id: res.data?.id || `INS-${Date.now().toString().slice(-6)}`,
          workOrderId: res.data?.generated_work_order_id,
        });
        setSubmissionModalVisible(true);
      } else {
        Alert.alert('Submission Error', res?.message || 'Failed to submit pre-shift inspection.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Network error occurred while submitting checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Records
  const filteredRecords = useMemo(() => {
    if (recordsFilter === 'ALL') return records;
    return records.filter((r) => r.overall_status?.toUpperCase() === recordsFilter);
  }, [records, recordsFilter]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Daily AM Checklist"
        icon="clipboard-check"
        sectionTitle="OPERATIONAL EXCELLENCE"
        sectionSubtitle="Pre-shift machinery safety & sensor clearance"
        showBack={canGoBack}
        onBack={() => navigation?.goBack?.()}
        rightAction={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => {
              if (activeTab === 'run') fetchMachines();
              else fetchRecords();
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#0F172A" />
          </TouchableOpacity>
        }
      />

      {/* Mode Tabs */}
      <View style={styles.modeTabsBar}>
        <TouchableOpacity
          style={[styles.modeTabBtn, activeTab === 'run' && styles.modeTabBtnActive]}
          onPress={() => setActiveTab('run')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="clipboard-edit-outline"
            size={18}
            color={activeTab === 'run' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.modeTabLabel, activeTab === 'run' && styles.modeTabLabelActive]}>
            Run Inspection
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTabBtn, activeTab === 'history' && styles.modeTabBtnActive]}
          onPress={() => setActiveTab('history')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="history"
            size={18}
            color={activeTab === 'history' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.modeTabLabel, activeTab === 'history' && styles.modeTabLabelActive]}>
            Audit History ({records.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: RUN PRE-SHIFT INSPECTION */}
      {activeTab === 'run' && (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loadingMachines || loadingTemplate} onRefresh={fetchMachines} />
          }
        >
          {/* Machine Selector Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <MaterialCommunityIcons name="tractor" size={18} color="#D97706" />
              <Text style={styles.sectionTitle}>SELECT INDUSTRIAL ASSET</Text>
            </View>
            <Text style={styles.sectionSubBadge}>{machines.length} Machines</Text>
          </View>

          {loadingMachines ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.loadingText}>Loading machinery assets...</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.machinesScroll}
              contentContainerStyle={styles.machinesScrollContent}
            >
              {machines.map((m) => {
                const isSelected = selectedMachine?.id === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.machineChip, isSelected && styles.machineChipActive]}
                    onPress={() => setSelectedMachine(m)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.chipTopRow}>
                      <Text style={[styles.machineChipCode, isSelected && styles.machineChipCodeActive]}>
                        {m.code || 'JCB-MC'}
                      </Text>
                      <View
                        style={[
                          styles.machineStatusDot,
                          { backgroundColor: m.status === 'operational' ? '#10B981' : '#F59E0B' },
                        ]}
                      />
                    </View>
                    <Text
                      style={[styles.machineChipName, isSelected && styles.machineChipNameActive]}
                      numberOfLines={1}
                    >
                      {m.name || 'Machinery'}
                    </Text>
                    <Text style={[styles.machineChipCategory, isSelected && styles.machineChipCategoryActive]}>
                      {m.category || 'Standard'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Selected Machine Card */}
          {selectedMachine && (
            <View style={styles.selectedMachineCard}>
              <View style={styles.selectedMachineLeft}>
                <View style={styles.selectedMachineIcon}>
                  <MaterialCommunityIcons name="cog" size={24} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.selectedMachineTitle}>{selectedMachine.name}</Text>
                  <Text style={styles.selectedMachineSub}>
                    Tag: {selectedMachine.code} • Plant: {selectedMachine.plant || 'Ballabgarh Line 1'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusBadgeGreen}>
                <Text style={styles.statusBadgeGreenText}>
                  {selectedMachine.category || 'HMC Machine'}
                </Text>
              </View>
            </View>
          )}

          {/* Shift & Operator Details Banner */}
          <View style={styles.shiftSelectionCard}>
            <View style={styles.shiftCardRow}>
              <View style={styles.operatorMetaWrap}>
                <MaterialCommunityIcons name="account-circle" size={20} color="#0F172A" />
                <View>
                  <Text style={styles.operatorMetaName}>{user?.fullName || 'Shift Operator'}</Text>
                  <Text style={styles.operatorMetaCode}>
                    Code: {user?.employeeCode || 'OPR-01'} • Role: {user?.role || 'Operator'}
                  </Text>
                </View>
              </View>

              <View style={styles.shiftSelectorPills}>
                {(['Shift A', 'Shift B', 'Shift C'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.shiftPill, shift === s && styles.shiftPillActive]}
                    onPress={() => setShift(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.shiftPillText, shift === s && styles.shiftPillTextActive]}>
                      {s.replace('Shift ', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Checkpoints Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <MaterialCommunityIcons name="format-list-checks" size={18} color="#2563EB" />
              <Text style={styles.sectionTitle}>MANDATORY CHECKPOINTS</Text>
            </View>
            <Text style={styles.sectionSubBadge}>
              {(template?.checklist || DEFAULT_CHECKLIST).length} items
            </Text>
          </View>

          {loadingTemplate ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.loadingText}>Fetching checklist rules...</Text>
            </View>
          ) : (
            (template?.checklist || DEFAULT_CHECKLIST).map((item, index) => {
              const resp = responses[item.id] || { value: true, notes: '', status: 'pass' };
              const currentStatus = resp.status;

              return (
                <View key={item.id} style={styles.checkCard}>
                  <View style={styles.checkCardHeader}>
                    <View style={styles.checkIndexCircle}>
                      <Text style={styles.checkIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.checkTitleCol}>
                      <Text style={styles.checkLabelText}>{item.label}</Text>
                      {item.is_critical && (
                        <View style={styles.criticalBadge}>
                          <MaterialCommunityIcons name="alert-octagon" size={12} color="#DC2626" />
                          <Text style={styles.criticalBadgeText}>CRITICAL SAFETY ITEM</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Pass / Flag / Fail Tri-State Selector */}
                  <View style={styles.triStateRow}>
                    <TouchableOpacity
                      style={[
                        styles.triBtn,
                        styles.triBtnPass,
                        currentStatus === 'pass' && styles.triBtnPassActive,
                      ]}
                      onPress={() => handleSetItemStatus(item.id, 'pass')}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={16}
                        color={currentStatus === 'pass' ? '#FFFFFF' : '#16A34A'}
                      />
                      <Text
                        style={[
                          styles.triBtnLabel,
                          styles.triBtnLabelPass,
                          currentStatus === 'pass' && styles.triBtnLabelActive,
                        ]}
                      >
                        PASS / OK
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.triBtn,
                        styles.triBtnFlag,
                        currentStatus === 'flagged' && styles.triBtnFlagActive,
                      ]}
                      onPress={() => handleSetItemStatus(item.id, 'flagged')}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={16}
                        color={currentStatus === 'flagged' ? '#FFFFFF' : '#D97706'}
                      />
                      <Text
                        style={[
                          styles.triBtnLabel,
                          styles.triBtnLabelFlag,
                          currentStatus === 'flagged' && styles.triBtnLabelActive,
                        ]}
                      >
                        FLAGGED
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.triBtn,
                        styles.triBtnFail,
                        currentStatus === 'fail' && styles.triBtnFailActive,
                      ]}
                      onPress={() => handleSetItemStatus(item.id, 'fail')}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={16}
                        color={currentStatus === 'fail' ? '#FFFFFF' : '#DC2626'}
                      />
                      <Text
                        style={[
                          styles.triBtnLabel,
                          styles.triBtnLabelFail,
                          currentStatus === 'fail' && styles.triBtnLabelActive,
                        ]}
                      >
                        FAIL
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Remark input if flagged or failed */}
                  {(currentStatus === 'flagged' || currentStatus === 'fail') && (
                    <View style={styles.remarkInputWrap}>
                      <TextInput
                        style={styles.remarkInput}
                        placeholder="Specify deviation or reason for flag/failure..."
                        placeholderTextColor="#94A3B8"
                        value={resp.notes}
                        onChangeText={(txt) => handleSetItemNotes(item.id, txt)}
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* SENSORS & TELEMETRY SECTION */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <MaterialCommunityIcons name="gauge" size={18} color="#059669" />
              <Text style={styles.sectionTitle}>PHYSICAL SENSOR TELEMETRY</Text>
            </View>
            <Text style={styles.sectionSubBadge}>3 Inputs</Text>
          </View>

          <View style={styles.sensorContainer}>
            {/* Temperature */}
            <View style={styles.sensorInputCard}>
              <View style={styles.sensorHeader}>
                <MaterialCommunityIcons name="thermometer" size={18} color="#EA580C" />
                <Text style={styles.sensorLabel}>Temperature (°C)</Text>
                <View
                  style={[
                    styles.sensorStatusBadge,
                    {
                      backgroundColor:
                        sensorStatus.tempStatus === 'pass'
                          ? '#DCFCE7'
                          : sensorStatus.tempStatus === 'flagged'
                          ? '#FEF3C7'
                          : '#FEE2E2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sensorStatusText,
                      {
                        color:
                          sensorStatus.tempStatus === 'pass'
                            ? '#16A34A'
                            : sensorStatus.tempStatus === 'flagged'
                            ? '#D97706'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {sensorStatus.tempStatus.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TextInput
                style={styles.sensorTextInput}
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="numeric"
                placeholder="Nominal ≤ 65°C"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.sensorLimitHint}>Nominal: 20-65°C | Critical &gt; 85°C</Text>
            </View>

            {/* Pressure */}
            <View style={styles.sensorInputCard}>
              <View style={styles.sensorHeader}>
                <MaterialCommunityIcons name="speedometer" size={18} color="#2563EB" />
                <Text style={styles.sensorLabel}>Hydraulic Pressure (bar)</Text>
                <View
                  style={[
                    styles.sensorStatusBadge,
                    {
                      backgroundColor:
                        sensorStatus.pressStatus === 'pass'
                          ? '#DCFCE7'
                          : sensorStatus.pressStatus === 'flagged'
                          ? '#FEF3C7'
                          : '#FEE2E2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sensorStatusText,
                      {
                        color:
                          sensorStatus.pressStatus === 'pass'
                            ? '#16A34A'
                            : sensorStatus.pressStatus === 'flagged'
                            ? '#D97706'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {sensorStatus.pressStatus.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TextInput
                style={styles.sensorTextInput}
                value={pressure}
                onChangeText={setPressure}
                keyboardType="numeric"
                placeholder="Nominal: 40-180 bar"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.sensorLimitHint}>Nominal: 40-180 bar | Low &lt; 25 bar</Text>
            </View>

            {/* Vibration */}
            <View style={styles.sensorInputCard}>
              <View style={styles.sensorHeader}>
                <MaterialCommunityIcons name="waveform" size={18} color="#7C3AED" />
                <Text style={styles.sensorLabel}>Spindle Vibration (mm/s)</Text>
                <View
                  style={[
                    styles.sensorStatusBadge,
                    {
                      backgroundColor:
                        sensorStatus.vibStatus === 'pass'
                          ? '#DCFCE7'
                          : sensorStatus.vibStatus === 'flagged'
                          ? '#FEF3C7'
                          : '#FEE2E2',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sensorStatusText,
                      {
                        color:
                          sensorStatus.vibStatus === 'pass'
                            ? '#16A34A'
                            : sensorStatus.vibStatus === 'flagged'
                            ? '#D97706'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {sensorStatus.vibStatus.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TextInput
                style={styles.sensorTextInput}
                value={vibration}
                onChangeText={setVibration}
                keyboardType="numeric"
                placeholder="Nominal: &lt; 2.8 mm/s"
                placeholderTextColor="#94A3B8"
              />
              <Text style={styles.sensorLimitHint}>Nominal: &lt; 2.8 mm/s | Critical &gt; 4.5 mm/s</Text>
            </View>
          </View>

          {/* OVERALL PREVIEW CARD */}
          <View
            style={[
              styles.overallPreviewCard,
              {
                borderColor:
                  auditSummary.overallStatus === 'pass'
                    ? '#10B981'
                    : auditSummary.overallStatus === 'flagged'
                    ? '#F59E0B'
                    : '#EF4444',
              },
            ]}
          >
            <View style={styles.overallPreviewHeader}>
              <Text style={styles.overallPreviewTitle}>PRE-SUBMISSION EVALUATION</Text>
              <View
                style={[
                  styles.overallBadge,
                  {
                    backgroundColor:
                      auditSummary.overallStatus === 'pass'
                        ? '#DCFCE7'
                        : auditSummary.overallStatus === 'flagged'
                        ? '#FEF3C7'
                        : '#FEE2E2',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.overallBadgeText,
                    {
                      color:
                        auditSummary.overallStatus === 'pass'
                          ? '#16A34A'
                          : auditSummary.overallStatus === 'flagged'
                          ? '#D97706'
                          : '#DC2626',
                    },
                  ]}
                >
                  {auditSummary.overallStatus.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statValPass}>{auditSummary.pass}</Text>
                <Text style={styles.statLabel}>Pass</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValFlag}>{auditSummary.flagged}</Text>
                <Text style={styles.statLabel}>Flagged</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={styles.statValFail}>{auditSummary.fail}</Text>
                <Text style={styles.statLabel}>Fail</Text>
              </View>
            </View>
          </View>

          {/* OPERATOR DIGITAL CERTIFICATION */}
          <TouchableOpacity
            style={[styles.certificationCard, isCertified && styles.certificationCardChecked]}
            onPress={() => setIsCertified(!isCertified)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isCertified ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={24}
              color={isCertified ? '#059669' : '#94A3B8'}
            />
            <Text style={styles.certificationText}>
              I solemnly certify that I have conducted physical inspection of this machinery asset in
              accordance with JCB standard safety &amp; operational audit procedures.
            </Text>
          </TouchableOpacity>

          {/* AUTO ESCALATE OPTION */}
          <TouchableOpacity
            style={styles.escalateRow}
            onPress={() => setEscalateOnFail(!escalateOnFail)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={escalateOnFail ? 'toggle-switch' : 'toggle-switch-off'}
              size={28}
              color={escalateOnFail ? '#F9B101' : '#CBD5E1'}
            />
            <Text style={styles.escalateLabel}>
              Auto-escalate breakdown work order if inspection status is FAIL
            </Text>
          </TouchableOpacity>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmitInspection}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-check" size={22} color="#000000" />
                <Text style={styles.submitButtonText}>CERTIFY &amp; SUBMIT INSPECTION</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TAB 2: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <View style={styles.historyContainer}>
          {/* Filter Chips */}
          <View style={styles.historyFiltersRow}>
            {(['ALL', 'PASS', 'FLAGGED', 'FAIL'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  recordsFilter === filter && styles.filterPillActive,
                ]}
                onPress={() => setRecordsFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    recordsFilter === filter && styles.filterPillTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingRecords ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={styles.loadingText}>Loading inspection audit records...</Text>
            </View>
          ) : filteredRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Inspection Records</Text>
              <Text style={styles.emptySub}>
                There are currently no inspection submissions matching the selected filter.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.historyScroll}
              contentContainerStyle={[styles.historyScrollContent, { paddingBottom: insets.bottom + 90 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={loadingRecords} onRefresh={fetchRecords} />}
            >
              {filteredRecords.map((rec) => {
                const st = rec.overall_status?.toLowerCase();
                const statusColor = st === 'pass' ? '#16A34A' : st === 'flagged' ? '#D97706' : '#DC2626';
                const statusBg = st === 'pass' ? '#DCFCE7' : st === 'flagged' ? '#FEF3C7' : '#FEE2E2';

                return (
                  <TouchableOpacity
                    key={rec.id}
                    style={styles.recordCard}
                    onPress={() => setSelectedRecordDetail(rec)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.recordCardTop}>
                      <View style={styles.recordCardLeft}>
                        <Text style={styles.recordMachineCode}>{rec.machine_code || 'JCB-ASSET'}</Text>
                        <Text style={styles.recordMachineName}>{rec.machine_name || 'Machine'}</Text>
                      </View>
                      <View style={[styles.recordStatusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.recordStatusText, { color: statusColor }]}>
                          {rec.overall_status?.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.recordCardMeta}>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="account" size={14} color="#64748B" />
                        <Text style={styles.metaItemText}>{rec.operator_name || 'Operator'}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color="#64748B" />
                        <Text style={styles.metaItemText}>{rec.shift}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="calendar" size={14} color="#64748B" />
                        <Text style={styles.metaItemText}>
                          {new Date(rec.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    {/* Sensor Pills */}
                    <View style={styles.telemetryPillsRow}>
                      {rec.temperature !== null && rec.temperature !== undefined && (
                        <View style={styles.telemetryPill}>
                          <MaterialCommunityIcons name="thermometer" size={12} color="#EA580C" />
                          <Text style={styles.telemetryPillText}>{rec.temperature}°C</Text>
                        </View>
                      )}
                      {rec.pressure !== null && rec.pressure !== undefined && (
                        <View style={styles.telemetryPill}>
                          <MaterialCommunityIcons name="speedometer" size={12} color="#2563EB" />
                          <Text style={styles.telemetryPillText}>{rec.pressure} bar</Text>
                        </View>
                      )}
                      {rec.vibration !== null && rec.vibration !== undefined && (
                        <View style={styles.telemetryPill}>
                          <MaterialCommunityIcons name="waveform" size={12} color="#7C3AED" />
                          <Text style={styles.telemetryPillText}>{rec.vibration} mm/s</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* SUBMISSION CONFIRMATION MODAL */}
      <Modal
        visible={submissionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubmissionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View
              style={[
                styles.modalHeaderIcon,
                {
                  backgroundColor:
                    submissionResult?.status === 'pass'
                      ? '#DCFCE7'
                      : submissionResult?.status === 'flagged'
                      ? '#FEF3C7'
                      : '#FEE2E2',
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  submissionResult?.status === 'pass'
                    ? 'check-circle'
                    : submissionResult?.status === 'flagged'
                    ? 'alert-circle'
                    : 'close-circle'
                }
                size={48}
                color={
                  submissionResult?.status === 'pass'
                    ? '#16A34A'
                    : submissionResult?.status === 'flagged'
                    ? '#D97706'
                    : '#DC2626'
                }
              />
            </View>

            <Text style={styles.modalTitle}>Inspection Recorded</Text>
            <Text style={styles.modalSub}>
              Pre-shift checklist for {submissionResult?.machineCode} has been verified and registered.
            </Text>

            <View style={styles.modalDetailBox}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailKey}>Overall Clearance:</Text>
                <Text
                  style={[
                    styles.modalDetailVal,
                    {
                      color:
                        submissionResult?.status === 'pass'
                          ? '#16A34A'
                          : submissionResult?.status === 'flagged'
                          ? '#D97706'
                          : '#DC2626',
                    },
                  ]}
                >
                  {submissionResult?.status?.toUpperCase()}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailKey}>Audit Reference:</Text>
                <Text style={styles.modalDetailVal}>{submissionResult?.id}</Text>
              </View>
              {submissionResult?.workOrderId && (
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailKey}>Auto Work Order:</Text>
                  <Text style={[styles.modalDetailVal, { color: '#DC2626' }]}>
                    #{submissionResult?.workOrderId}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => {
                setSubmissionModalVisible(false);
                setActiveTab('history');
                fetchRecords();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmBtnText}>VIEW IN AUDIT LOGS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => setSubmissionModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSecondaryBtnText}>Run Another Inspection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RECORD DETAIL MODAL */}
      <Modal
        visible={!!selectedRecordDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedRecordDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.detailModalCard]}>
            <View style={styles.detailModalHeader}>
              <View>
                <Text style={styles.detailModalTitle}>
                  {selectedRecordDetail?.machine_code || 'Machinery Audit'}
                </Text>
                <Text style={styles.detailModalSub}>
                  {selectedRecordDetail?.machine_name} • {selectedRecordDetail?.shift}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedRecordDetail(null)}
                style={styles.detailCloseBtn}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.detailOverviewBox}>
                <View style={styles.detailOverviewRow}>
                  <Text style={styles.detailOverviewKey}>Audit Clearance Status:</Text>
                  <Text
                    style={[
                      styles.detailOverviewVal,
                      {
                        color:
                          selectedRecordDetail?.overall_status === 'pass'
                            ? '#16A34A'
                            : selectedRecordDetail?.overall_status === 'flagged'
                            ? '#D97706'
                            : '#DC2626',
                      },
                    ]}
                  >
                    {selectedRecordDetail?.overall_status?.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailOverviewRow}>
                  <Text style={styles.detailOverviewKey}>Certified By:</Text>
                  <Text style={styles.detailOverviewVal}>
                    {selectedRecordDetail?.operator_name || 'Operator'}
                  </Text>
                </View>
                <View style={styles.detailOverviewRow}>
                  <Text style={styles.detailOverviewKey}>Timestamp:</Text>
                  <Text style={styles.detailOverviewVal}>
                    {selectedRecordDetail?.created_at
                      ? new Date(selectedRecordDetail.created_at).toLocaleString()
                      : '-'}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailSectionHeading}>TELEMETRY SENSORS</Text>
              <View style={styles.detailTelemetryRow}>
                <View style={styles.detailTelemetryBox}>
                  <Text style={styles.detailTelemetryLabel}>Temperature</Text>
                  <Text style={styles.detailTelemetryValue}>
                    {selectedRecordDetail?.temperature ?? 'N/A'}°C
                  </Text>
                </View>
                <View style={styles.detailTelemetryBox}>
                  <Text style={styles.detailTelemetryLabel}>Pressure</Text>
                  <Text style={styles.detailTelemetryValue}>
                    {selectedRecordDetail?.pressure ?? 'N/A'} bar
                  </Text>
                </View>
                <View style={styles.detailTelemetryBox}>
                  <Text style={styles.detailTelemetryLabel}>Vibration</Text>
                  <Text style={styles.detailTelemetryValue}>
                    {selectedRecordDetail?.vibration ?? 'N/A'} mm/s
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setSelectedRecordDetail(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalConfirmBtnText}>CLOSE AUDIT DETAILS</Text>
            </TouchableOpacity>
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
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  modeTabBtnActive: {
    borderBottomColor: '#F9B101',
  },
  modeTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabLabelActive: {
    color: '#000000',
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  sectionSubBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
  machinesScroll: {
    marginHorizontal: -16,
  },
  machinesScrollContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingVertical: 4,
  },
  machineChip: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  machineChipActive: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFBEB',
  },
  chipTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  machineChipCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  machineChipCodeActive: {
    color: '#B45309',
  },
  machineStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  machineChipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  machineChipNameActive: {
    color: '#000000',
  },
  machineChipCategory: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  machineChipCategoryActive: {
    color: '#D97706',
  },
  selectedMachineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedMachineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedMachineIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMachineTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedMachineSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadgeGreen: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeGreenText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
  },
  shiftSelectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  operatorMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  operatorMetaName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  operatorMetaCode: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  shiftSelectorPills: {
    flexDirection: 'row',
    gap: 4,
  },
  shiftPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  shiftPillActive: {
    backgroundColor: '#0F172A',
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  shiftPillTextActive: {
    color: '#FFFFFF',
  },
  checkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkCardHeader: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  checkIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  checkTitleCol: {
    flex: 1,
  },
  checkLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 18,
  },
  criticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  criticalBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  triStateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  triBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  triBtnPass: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  triBtnPassActive: {
    borderColor: '#16A34A',
    backgroundColor: '#16A34A',
  },
  triBtnFlag: {
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  triBtnFlagActive: {
    borderColor: '#D97706',
    backgroundColor: '#D97706',
  },
  triBtnFail: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  triBtnFailActive: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  triBtnLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  triBtnLabelPass: {
    color: '#16A34A',
  },
  triBtnLabelFlag: {
    color: '#D97706',
  },
  triBtnLabelFail: {
    color: '#DC2626',
  },
  triBtnLabelActive: {
    color: '#FFFFFF',
  },
  remarkInputWrap: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  remarkInput: {
    height: 38,
    fontSize: 12,
    color: '#0F172A',
  },
  sensorContainer: {
    gap: 10,
  },
  sensorInputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sensorLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  sensorStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sensorStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  sensorTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sensorLimitHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  overallPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
  },
  overallPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overallPreviewTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  overallBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  overallBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    borderRadius: 8,
  },
  statCol: {
    alignItems: 'center',
  },
  statValPass: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16A34A',
  },
  statValFlag: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D97706',
  },
  statValFail: {
    fontSize: 18,
    fontWeight: '900',
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  certificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  certificationCardChecked: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  certificationText: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 16,
    fontWeight: '600',
  },
  escalateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  escalateLabel: {
    flex: 1,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F9B101',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 16,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  historyContainer: {
    flex: 1,
  },
  historyFiltersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  historyScroll: {
    flex: 1,
  },
  historyScrollContent: {
    padding: 16,
    gap: 10,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recordCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recordCardLeft: {
    flex: 1,
  },
  recordMachineCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  recordMachineName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  recordStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordStatusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  recordCardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  telemetryPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  telemetryPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalHeaderIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  modalDetailBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginVertical: 16,
    gap: 6,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalDetailKey: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  modalDetailVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalConfirmBtn: {
    width: '100%',
    backgroundColor: '#F9B101',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#000000',
  },
  modalSecondaryBtn: {
    paddingVertical: 10,
    marginTop: 6,
  },
  modalSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  detailModalCard: {
    maxHeight: '80%',
    alignItems: 'stretch',
    padding: 18,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
    marginBottom: 12,
  },
  detailModalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  detailModalSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  detailCloseBtn: {
    padding: 4,
  },
  detailModalScroll: {
    marginBottom: 12,
  },
  detailOverviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  detailOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailOverviewKey: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600',
  },
  detailOverviewVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  detailTelemetryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  detailTelemetryBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailTelemetryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailTelemetryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
});
