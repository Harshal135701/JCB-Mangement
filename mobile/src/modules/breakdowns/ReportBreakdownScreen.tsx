import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { AppHeader } from '../../components/AppHeader';

const DEFAULT_MACHINES = [
  { id: '10000000-0000-0000-0000-000000000001', code: 'JCB-CNC-042', name: 'Mazak HMC 42' },
  { id: '10000000-0000-0000-0000-000000000002', code: 'JCB-ROB-108', name: 'Fanuc Robotic Welder' },
  { id: '10000000-0000-0000-0000-000000000003', code: 'JCB-PRS-015', name: 'Schuler 1000T Press' },
  { id: '10000000-0000-0000-0000-000000000004', code: 'JCB-LSR-007', name: 'Trumpf Fiber Laser' },
];

const CATEGORIES = [
  { id: 'Hydraulic', label: 'Hydraulic', icon: 'water-pump' },
  { id: 'Mechanical', label: 'Mechanical', icon: 'cog-sync' },
  { id: 'Electrical', label: 'Electrical', icon: 'lightning-bolt' },
  { id: 'PLC / Automation', label: 'PLC / Auto', icon: 'memory' },
  { id: 'Pneumatic', label: 'Pneumatic', icon: 'air-conditioner' },
  { id: 'Tooling', label: 'Tooling', icon: 'hammer-wrench' },
];

const PRIORITIES = [
  { id: 'Critical', label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  { id: 'High', label: 'High', color: '#EA580C', bg: '#FFF7ED' },
  { id: 'Medium', label: 'Medium', color: '#D97706', bg: '#FFFBEB' },
  { id: 'Low', label: 'Low', color: '#2563EB', bg: '#EFF6FF' },
];

export const ReportBreakdownScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const preselected = route?.params?.preselectedMachine;

  const [machines, setMachines] = useState<any[]>(DEFAULT_MACHINES);
  const [selectedMachine, setSelectedMachine] = useState<any>(preselected || DEFAULT_MACHINES[0]);
  const [category, setCategory] = useState('Hydraulic');
  const [priority, setPriority] = useState('Critical');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hourMeter, setHourMeter] = useState('4500');
  const [pressure, setPressure] = useState('38.0');
  const [temperature, setTemperature] = useState('42.5');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res: any = await apiClient.get('/machines?limit=100');
        if (res?.success && res.data && res.data.length > 0) {
          const mapped = res.data.map((m: any) => ({
            id: m.id,
            code: m.machine_code,
            name: m.name,
          }));
          setMachines(mapped);
          if (!preselected) {
            setSelectedMachine(mapped[0]);
          }
        }
      } catch (e) {
        // use fallback
      }
    };
    fetchMachines();
  }, [preselected]);

  const handleSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Required Fields', 'Please enter a problem title and description.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        machine_id: selectedMachine.id,
        issue_category: category,
        priority: priority.toLowerCase(),
        problem_title: title,
        description,
        hour_meter_reading: parseFloat(hourMeter) || 0,
        pressure: parseFloat(pressure) || 0,
        temperature: parseFloat(temperature) || 0,
        shift: 'Shift A',
      };

      const res: any = await apiClient.post('/breakdowns', payload);

      if (res.success) {
        Alert.alert(
          'Breakdown Logged',
          `Ticket ${res.data?.ticket_number || 'CMP'} created. Maintenance crew notified.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Duplicate Warning')) {
        Alert.alert('Duplicate Slip Detected', err.message);
      } else {
        Alert.alert('Submission Error', err.message || 'Unable to log breakdown ticket.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Report Breakdown"
        icon="alert-octagon"
        sectionTitle="Report Machine Breakdown"
        sectionSubtitle="Alert Maintenance Line Supervisor Immediately"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Machine Selection Card */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Select Machine</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {machines.map((m) => {
              const isSelected = selectedMachine?.id === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.machineChip, isSelected && styles.machineChipActive]}
                  onPress={() => setSelectedMachine(m)}
                >
                  <Text style={[styles.machineChipCode, isSelected && styles.machineChipCodeActive]}>
                    {m.code}
                  </Text>
                  <Text style={[styles.machineChipName, isSelected && styles.machineChipNameActive]} numberOfLines={1}>
                    {m.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Issue Category */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Issue Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryTile, active && styles.categoryTileActive]}
                  onPress={() => setCategory(cat.id)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={20}
                    color={active ? '#000000' : '#64748B'}
                  />
                  <Text style={[styles.categoryTileText, active && styles.categoryTileTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Priority Severity */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.priorityBtn,
                    { borderColor: active ? p.color : '#E2E8F0' },
                    active && { backgroundColor: p.bg },
                  ]}
                  onPress={() => setPriority(p.id)}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      { color: active ? p.color : '#64748B' },
                      active && { fontWeight: '900' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Stoppage Details */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Stoppage Details</Text>

          <Text style={styles.inputLabel}>Problem Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Spindle overheated & hydraulic alarm tripped"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.inputLabel}>Detailed Description *</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe symptoms, noise, warning codes or visible leaks..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Live Gauges & Meter */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Operating Parameters</Text>
          <View style={styles.readingRow}>
            <View style={styles.readingCol}>
              <Text style={styles.inputLabel}>Hour Meter</Text>
              <TextInput
                style={styles.textInput}
                value={hourMeter}
                onChangeText={setHourMeter}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={styles.readingCol}>
              <Text style={styles.inputLabel}>Pressure (Bar)</Text>
              <TextInput
                style={styles.textInput}
                value={pressure}
                onChangeText={setPressure}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="alert-octagon" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Submit Breakdown Report</Text>
            </>
          )}
        </TouchableOpacity>
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
    gap: 16,
  },
  cardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  machineChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    minWidth: 110,
  },
  machineChipActive: {
    backgroundColor: '#F9B101',
    borderColor: '#F9B101',
  },
  machineChipCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  machineChipCodeActive: {
    color: '#000000',
  },
  machineChipName: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  machineChipNameActive: {
    color: '#000000',
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryTile: {
    width: '31%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
  },
  categoryTileActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  categoryTileText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  categoryTileTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  priorityBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0F172A',
  },
  textArea: {
    height: 75,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  readingRow: {
    flexDirection: 'row',
  },
  readingCol: {
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
