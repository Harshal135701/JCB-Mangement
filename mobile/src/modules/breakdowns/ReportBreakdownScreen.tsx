import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

const MACHINES = [
  { id: '10000000-0000-0000-0000-000000000001', code: 'JCB-CNC-042', name: 'Mazak HMC 42' },
  { id: '10000000-0000-0000-0000-000000000002', code: 'JCB-ROB-108', name: 'Fanuc Robotic Welder' },
  { id: '10000000-0000-0000-0000-000000000003', code: 'JCB-PRS-015', name: 'Schuler 1000T Press' },
  { id: '10000000-0000-0000-0000-000000000004', code: 'JCB-LSR-007', name: 'Trumpf Fiber Laser' },
];

const CATEGORIES = ['Hydraulic', 'Mechanical', 'Electrical', 'PLC/Automation', 'CNC', 'Welding'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export const ReportBreakdownScreen = ({ navigation }: any) => {
  const [selectedMachine, setSelectedMachine] = useState(MACHINES[0]);
  const [category, setCategory] = useState('Hydraulic');
  const [priority, setPriority] = useState('Critical');
  const [title, setTitle] = useState('Spindle hydraulic pressure dropped below 45 bar');
  const [description, setDescription] = useState('Machine threw alarm 4022 during heavy roughing cycle. Hydraulic oil temperature elevated.');
  const [hourMeter, setHourMeter] = useState('4320.5');
  const [pressure, setPressure] = useState('38.0');
  const [temperature, setTemperature] = useState('42.5');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !description) {
      Alert.alert('Required Fields', 'Please enter a problem title and brief description.');
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
          `Ticket ${res.data.ticket_number} created successfully. Maintenance supervisor has been alerted.`,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.header}>Report Machine Breakdown</Text>
      <Text style={styles.subHeader}>Fill out stoppage details to alert shift maintenance</Text>

      {/* Machine Selection */}
      <Text style={styles.label}>Select Machine (or Scanned QR)</Text>
      <View style={styles.chipRow}>
        {MACHINES.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.chip, selectedMachine.id === m.id && styles.chipActive]}
            onPress={() => setSelectedMachine(m)}
          >
            <Text style={[styles.chipText, selectedMachine.id === m.id && styles.chipTextActive]}>
              {m.code}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Selection */}
      <Text style={styles.label}>Issue Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Priority Selection */}
      <Text style={styles.label}>Priority Severity</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.chip,
              priority === p && (p === 'Critical' ? styles.chipCritical : styles.chipActive),
            ]}
            onPress={() => setPriority(p)}
          >
            <Text
              style={[
                styles.chipText,
                priority === p && styles.chipTextActive,
                priority === p && p === 'Critical' && { color: '#FFFFFF' },
              ]}
            >
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Numerical Readings */}
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Hour Meter</Text>
          <TextInput
            style={styles.input}
            value={hourMeter}
            onChangeText={setHourMeter}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.spacer} />
        <View style={styles.flex1}>
          <Text style={styles.label}>Pressure (Bar)</Text>
          <TextInput
            style={styles.input}
            value={pressure}
            onChangeText={setPressure}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.label}>Problem Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Brief summary of failure"
      />

      {/* Description */}
      <Text style={styles.label}>Detailed Description / Symptoms</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.submitBtnText}>TRANSMIT BREAKDOWN SLIP</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subHeader: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#FEF08A',
    borderColor: COLORS.primary,
  },
  chipCritical: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginTop: 4,
  },
  flex1: {
    flex: 1,
  },
  spacer: {
    width: 12,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

