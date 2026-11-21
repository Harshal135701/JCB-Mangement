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

export const RDCScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const [rdcs, setRdcs] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    rdc_type: 'RDC',
    vendor_party_name: '',
    purpose: 'Spindle Bearing Overhaul & Dynamic Balancing',
    machine_id: '',
    expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  const fetchRDCs = async () => {
    try {
      setLoading(true);
      const [rdcRes, machRes]: any[] = await Promise.all([
        apiClient.get('/rdc'),
        apiClient.get('/machines?limit=50'),
      ]);

      setRdcs(rdcRes?.data || []);
      setMachines(machRes?.data || []);
    } catch (e) {
      console.warn('Failed to load RDCs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRDCs();
  }, []);

  const handleCreateRDC = async () => {
    if (!formData.vendor_party_name.trim() || !formData.purpose.trim()) {
      Alert.alert('Required', 'Please fill vendor name and overhaul purpose.');
      return;
    }

    try {
      setActionLoading(true);
      const res: any = await apiClient.post('/rdc', formData);
      if (res?.success) {
        Alert.alert(
          'RDC Authorized',
          `Gate Pass Challan ${res.data?.challan_number || ''} issued successfully!`
        );
        setIsModalOpen(false);
        setFormData({
          rdc_type: 'RDC',
          vendor_party_name: '',
          purpose: 'Spindle Bearing Overhaul & Dynamic Balancing',
          machine_id: '',
          expected_return_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        });
        fetchRDCs();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create RDC.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const gatePassNum = 'GP-' + Math.floor(10000 + Math.random() * 90000);
      const res: any = await apiClient.put(`/rdc/${id}/approve`, {
        gate_pass_number: gatePassNum,
      });
      if (res?.success) {
        Alert.alert('Pass Authorized', `Factory Security Gate Pass: ${gatePassNum}`);
        fetchRDCs();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Approval failed.');
    }
  };

  const handleDispatch = async (id: string) => {
    try {
      const vehicleNum = 'HR-29-BA-' + Math.floor(1000 + Math.random() * 9000);
      const res: any = await apiClient.post(`/rdc/${id}/dispatch`, {
        vehicle_number: vehicleNum,
      });
      if (res?.success) {
        Alert.alert('Dispatched', `Outward verified at Gate 1 (Vehicle: ${vehicleNum}).`);
        fetchRDCs();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Dispatch update failed.');
    }
  };

  const handleReturn = async (id: string) => {
    try {
      const res: any = await apiClient.post(`/rdc/${id}/return`, {
        received_items: [{ item_id: 'sample', quantity_returned: 1, quality_status: 'ACCEPTED' }],
        security_inward_pass: 'SEC-IN-' + Math.floor(1000 + Math.random() * 9000),
      });
      if (res?.success) {
        Alert.alert('Inward Verified', 'Asset received back with QC sign-off and restored to active pool.');
        fetchRDCs();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Return failed.');
    }
  };

  // Filtered RDCs
  const filteredRdcs = useMemo(() => {
    return rdcs.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.challan_number && item.challan_number.toLowerCase().includes(q)) ||
        (item.gate_pass_number && item.gate_pass_number.toLowerCase().includes(q)) ||
        (item.vendor_party_name && item.vendor_party_name.toLowerCase().includes(q)) ||
        (item.purpose && item.purpose.toLowerCase().includes(q));

      const isItemOverdue =
        item.status === 'dispatched' &&
        item.expected_return_date &&
        new Date(item.expected_return_date).getTime() < Date.now();

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'overdue' && isItemOverdue) ||
        item.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [rdcs, searchQuery, statusFilter]);

  // Dynamic KPI counts
  const kpiStats = useMemo(() => {
    const total = rdcs.length;
    const pending = rdcs.filter((r) => r.status === 'pending_approval').length;
    const dispatched = rdcs.filter((r) => r.status === 'dispatched').length;
    const returned = rdcs.filter((r) => r.status === 'fully_returned').length;
    const overdue = rdcs.filter(
      (r) =>
        r.status === 'dispatched' &&
        r.expected_return_date &&
        new Date(r.expected_return_date).getTime() < Date.now()
    ).length;
    return { total, pending, dispatched, returned, overdue };
  }, [rdcs]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="RDC Passes"
        icon="truck-fast-outline"
        sectionTitle="Returnable Gate Passes (RDC)"
        sectionSubtitle="Factory outward repair & vendor movement"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
        rightAction={
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => setIsModalOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="plus" size={16} color="#000000" />
            <Text style={styles.newBtnText}>New Pass</Text>
          </TouchableOpacity>
        }
      />

      {/* KPI Stats Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpiStats.total}</Text>
          <Text style={styles.kpiLabel}>Total Passes</Text>
        </View>
        <View style={[styles.kpiCard, kpiStats.pending > 0 && styles.kpiCardPending]}>
          <Text style={[styles.kpiValue, kpiStats.pending > 0 && { color: '#B45309' }]}>
            {kpiStats.pending}
          </Text>
          <Text style={styles.kpiLabel}>Pending</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{kpiStats.dispatched}</Text>
          <Text style={styles.kpiLabel}>At Vendor</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#047857' }]}>{kpiStats.returned}</Text>
          <Text style={styles.kpiLabel}>Inwarded</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Challan#, Pass#, Vendor, Purpose..."
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
            { id: 'ALL', label: 'All Passes' },
            { id: 'pending_approval', label: 'Pending Gate Pass' },
            { id: 'approved', label: 'Pass Authorized' },
            { id: 'dispatched', label: 'At Vendor' },
            { id: 'overdue', label: `Overdue (${kpiStats.overdue})` },
            { id: 'fully_returned', label: 'Inwarded & Closed' },
          ].map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setStatusFilter(chip.id)}
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

      {/* Main RDC List */}
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchRDCs}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filteredRdcs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="shield-car" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery || statusFilter !== 'ALL' ? 'No Matching Gate Passes' : 'No Active Movement'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your search terms or filters'
                : 'Create returnable delivery challans to track parts sent for external repair'}
            </Text>
            {(searchQuery || statusFilter !== 'ALL') && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
              >
                <Text style={styles.clearFilterBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredRdcs.map((rdc) => {
            const isPending = rdc.status === 'pending_approval';
            const isApproved = rdc.status === 'approved';
            const isDispatched = rdc.status === 'dispatched';
            const isReturned = rdc.status === 'fully_returned';
            const isOverdue =
              isDispatched &&
              rdc.expected_return_date &&
              new Date(rdc.expected_return_date).getTime() < Date.now();

            return (
              <View key={rdc.id} style={styles.card}>
                {/* Header: Challan # & Status Badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.challanBadge}>
                    <Text style={styles.challanText}>{rdc.challan_number || 'CHALLAN'}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isOverdue
                        ? styles.statusOverdue
                        : isReturned
                        ? styles.statusReturned
                        : isDispatched
                        ? styles.statusDispatched
                        : isApproved
                        ? styles.statusApproved
                        : styles.statusPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isOverdue
                          ? styles.statusTextOverdue
                          : isReturned
                          ? styles.statusTextReturned
                          : isDispatched
                          ? styles.statusTextDispatched
                          : isApproved
                          ? styles.statusTextApproved
                          : styles.statusTextPending,
                      ]}
                    >
                      {isOverdue
                        ? 'OVERDUE RETURN'
                        : isReturned
                        ? 'RETURNED & CLOSED'
                        : isDispatched
                        ? 'OUTWARD AT VENDOR'
                        : isApproved
                        ? 'PASS ISSUED'
                        : 'PENDING APPROVAL'}
                    </Text>
                  </View>
                </View>

                {/* Vendor Party */}
                <View style={styles.vendorRow}>
                  <MaterialCommunityIcons name="domain" size={18} color="#B45309" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vendorName}>{rdc.vendor_party_name || 'Vendor Service Partner'}</Text>
                    <Text style={styles.purposeText} numberOfLines={2}>
                      {rdc.purpose || 'External Machining / Overhaul'}
                    </Text>
                  </View>
                </View>

                {/* Gate Pass & Vehicle Info */}
                <View style={styles.detailsGrid}>
                  {rdc.gate_pass_number ? (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="shield-check" size={14} color="#2563EB" />
                      <Text style={styles.detailLabel}>Gate Pass:</Text>
                      <Text style={styles.detailValueBlue}>{rdc.gate_pass_number}</Text>
                    </View>
                  ) : null}

                  {rdc.vehicle_number ? (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="truck" size={14} color="#64748B" />
                      <Text style={styles.detailLabel}>Vehicle:</Text>
                      <Text style={styles.detailValue}>{rdc.vehicle_number}</Text>
                    </View>
                  ) : null}

                  <View style={styles.detailItem}>
                    <MaterialCommunityIcons name="calendar" size={14} color="#64748B" />
                    <Text style={styles.detailLabel}>Expected Return:</Text>
                    <Text style={styles.detailValue}>
                      {rdc.expected_return_date
                        ? new Date(rdc.expected_return_date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'Within 7 Days'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionDivider} />

                {isPending && isManager && (
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleApprove(rdc.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="check-circle" size={16} color="#000000" />
                    <Text style={styles.approveBtnText}>Authorize Gate Pass</Text>
                  </TouchableOpacity>
                )}

                {isApproved && (
                  <TouchableOpacity
                    style={styles.dispatchBtn}
                    onPress={() => handleDispatch(rdc.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="truck-delivery" size={16} color="#FFFFFF" />
                    <Text style={styles.dispatchBtnText}>Security Gate Outward Dispatch</Text>
                  </TouchableOpacity>
                )}

                {isDispatched && (
                  <TouchableOpacity
                    style={styles.returnBtn}
                    onPress={() => handleReturn(rdc.id)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="check-decagram" size={16} color="#FFFFFF" />
                    <Text style={styles.returnBtnText}>Inward & QC Verify Return</Text>
                  </TouchableOpacity>
                )}

                {isReturned && (
                  <View style={styles.closedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#047857" />
                    <Text style={styles.closedText}>Re-integrated to Plant Operations</Text>
                  </View>
                )}

                {isPending && !isManager && (
                  <View style={styles.pendingBadge}>
                    <MaterialCommunityIcons name="clock-outline" size={15} color="#B45309" />
                    <Text style={styles.pendingText}>Awaiting Security & Manager Approval</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* New RDC Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Issue Outward Gate Pass (RDC)</Text>
                <Text style={styles.modalSubtitle}>Dispatch machine components for outside repair</Text>
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
              <Text style={styles.inputLabel}>Vendor / Service Partner *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.vendor_party_name}
                onChangeText={(t) => setFormData({ ...formData, vendor_party_name: t })}
                placeholder="e.g. Renishaw India Metrology Services"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Work Order / Purpose *</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                value={formData.purpose}
                onChangeText={(t) => setFormData({ ...formData, purpose: t })}
                placeholder="Reason for taking component outside..."
                placeholderTextColor="#94A3B8"
                multiline
              />

              <Text style={styles.inputLabel}>Machine Asset Source</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                <TouchableOpacity
                  style={[styles.selectCard, !formData.machine_id && styles.selectCardActive]}
                  onPress={() => setFormData({ ...formData, machine_id: '' })}
                >
                  <Text style={[styles.selectCardTitle, !formData.machine_id && styles.selectCardTitleActive]}>
                    General Asset
                  </Text>
                </TouchableOpacity>
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

              <Text style={styles.inputLabel}>Expected Return Date</Text>
              <TextInput
                style={styles.textInput}
                value={formData.expected_return_date}
                onChangeText={(t) => setFormData({ ...formData, expected_return_date: t })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            {/* Pinned Sticky Footer Actions - NEVER CUT OFF */}
            <View style={styles.modalBtnRowPinned}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateRDC}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Issue Gate Pass</Text>
                )}
              </TouchableOpacity>
            </View>
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
  newBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newBtnText: {
    color: '#000000',
    fontSize: 11.5,
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
  kpiCardPending: {
    borderColor: '#FDE68A',
    backgroundColor: '#FEFCE8',
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
  challanBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  challanText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPending: {
    backgroundColor: '#FEFCE8',
  },
  statusApproved: {
    backgroundColor: '#EFF6FF',
  },
  statusDispatched: {
    backgroundColor: '#EFF6FF',
  },
  statusReturned: {
    backgroundColor: '#ECFDF5',
  },
  statusOverdue: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextApproved: {
    color: '#1D4ED8',
  },
  statusTextDispatched: {
    color: '#2563EB',
  },
  statusTextReturned: {
    color: '#047857',
  },
  statusTextOverdue: {
    color: '#DC2626',
    fontWeight: '900',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  vendorName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  purposeText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  detailsGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  detailValueBlue: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '800',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  approveBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  dispatchBtn: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dispatchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  returnBtn: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  returnBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    borderRadius: 8,
  },
  closedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEFCE8',
    paddingVertical: 8,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B45309',
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
  horizontalScroll: {
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
    minWidth: 110,
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
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  modalBtnRowPinned: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
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
});
