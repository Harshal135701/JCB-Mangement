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

export const ProcurementScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const [prs, setPrs] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Active Segmented Tab
  const [activeTab, setActiveTab] = useState<'PR' | 'PO' | 'VENDORS'>('PR');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    part_id: '',
    machine_id: '',
    quantity_required: 2,
    urgency: 'critical',
    technical_justification: 'Emergency replacement for production bottleneck machine.',
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [prRes, poRes, vRes, partsRes, machRes]: any[] = await Promise.allSettled([
        apiClient.get('/procurement/pr'),
        apiClient.get('/procurement/po'),
        apiClient.get('/procurement/vendors'),
        apiClient.get('/inventory/search?limit=50'),
        apiClient.get('/machines?limit=50'),
      ]);

      if (prRes.status === 'fulfilled') setPrs(prRes.value?.data || []);
      if (poRes.status === 'fulfilled') setPos(poRes.value?.data || []);
      if (vRes.status === 'fulfilled') setVendors(vRes.value?.data || []);
      if (partsRes.status === 'fulfilled') {
        const pList = partsRes.value?.data || [];
        setParts(pList);
        if (pList.length > 0 && !formData.part_id) {
          setFormData((prev) => ({ ...prev, part_id: pList[0].id }));
        }
      }
      if (machRes.status === 'fulfilled') setMachines(machRes.value?.data || []);
    } catch (e) {
      console.warn('Failed to load procurement data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreatePR = async () => {
    if (!formData.part_id) {
      Alert.alert('Required', 'Please select a spare part.');
      return;
    }

    try {
      setActionLoading(true);
      const res: any = await apiClient.post('/procurement/pr', formData);
      if (res?.success) {
        Alert.alert('Success', 'Purchase Requisition initiated successfully.');
        setIsModalOpen(false);
        fetchAllData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create PR.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovePR = async (prId: string) => {
    try {
      const poNum = `PO-JCB-${Math.floor(10000 + Math.random() * 90000)}`;
      const res: any = await apiClient.put(`/procurement/pr/${prId}`, {
        status: 'approved',
        po_number: poNum,
        supplier_name: 'JCB India Genuine Spares Hub',
      });
      if (res?.success) {
        Alert.alert('Approved', `Purchase Order issued: ${poNum}`);
        fetchAllData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve PR.');
    }
  };

  const handleGRN = async (prId: string, qty: number) => {
    try {
      const res: any = await apiClient.post(`/procurement/pr/${prId}/grn`, {
        received_quantity: qty || 1,
        remarks: 'Physical inspection completed at factory store. QC verified.',
      });
      if (res?.success) {
        Alert.alert('GRN Inwarded', 'Inventory stock balance updated successfully.');
        fetchAllData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process GRN.');
    }
  };

  // Filtered PRs
  const filteredPrs = useMemo(() => {
    return prs.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.pr_number && item.pr_number.toLowerCase().includes(q)) ||
        (item.po_number && item.po_number.toLowerCase().includes(q)) ||
        (item.part_number && item.part_number.toLowerCase().includes(q)) ||
        (item.part_name && item.part_name.toLowerCase().includes(q)) ||
        (item.machine_code && item.machine_code.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' || item.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [prs, searchQuery, statusFilter]);

  // Filtered POs
  const filteredPos = useMemo(() => {
    return pos.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.po_number && item.po_number.toLowerCase().includes(q)) ||
        (item.pr_number && item.pr_number.toLowerCase().includes(q)) ||
        (item.supplier_name && item.supplier_name.toLowerCase().includes(q)) ||
        (item.part_number && item.part_number.toLowerCase().includes(q)) ||
        (item.part_name && item.part_name.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'overdue' && item.is_overdue) ||
        item.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [pos, searchQuery, statusFilter]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        (v.vendor_name && v.vendor_name.toLowerCase().includes(q)) ||
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.vendor_code && v.vendor_code.toLowerCase().includes(q)) ||
        (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q))
      );
    });
  }, [vendors, searchQuery]);

  // Dynamic KPI counts for PRs
  const kpiStats = useMemo(() => {
    const total = prs.length;
    const pending = prs.filter((p) => p.status === 'new').length;
    const approved = prs.filter((p) => p.status === 'approved').length;
    const received = prs.filter((p) => p.status === 'grn_received').length;
    return { total, pending, approved, received };
  }, [prs]);

  // PO KPIs
  const poStats = useMemo(() => {
    const total = pos.length;
    const active = pos.filter((p) => p.status === 'approved').length;
    const received = pos.filter((p) => p.status === 'grn_received').length;
    const overdue = pos.filter((p) => p.is_overdue).length;
    return { total, active, received, overdue };
  }, [pos]);

  // Vendor KPIs
  const vendorStats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => v.status === 'active' || !v.status).length;
    const totalSpend = vendors.reduce((acc, v) => acc + (Number(v.total_spend) || 0), 0);
    return { total, active, totalSpend };
  }, [vendors]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Procurement"
        icon="cart-outline"
        sectionTitle={
          activeTab === 'PR'
            ? 'Purchase Requisitions'
            : activeTab === 'PO'
            ? 'Purchase Orders'
            : 'Vendor Directory'
        }
        sectionSubtitle={
          activeTab === 'PR'
            ? 'Emergency spare requisitions, approval & GRN inwarding'
            : activeTab === 'PO'
            ? 'Active supplier orders, fulfillment & delivery tracking'
            : 'Registered JCB suppliers, performance & spend tracking'
        }
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
        rightAction={
          activeTab === 'PR' ? (
            <TouchableOpacity
              style={styles.newPrBtn}
              onPress={() => setIsModalOpen(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#000000" />
              <Text style={styles.newPrBtnText}>New PR</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.newPrBtn, { backgroundColor: '#F1F5F9' }]}
              onPress={fetchAllData}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#0F172A" />
            </TouchableOpacity>
          )
        }
      />

      {/* 3-Way Segment Tabs (Requisitions | Purchase Orders | Vendors) */}
      <View style={styles.segmentNavWrap}>
        <TouchableOpacity
          style={[styles.segmentNavBtn, activeTab === 'PR' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('PR')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="file-document-edit-outline"
            size={15}
            color={activeTab === 'PR' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.segmentNavText, activeTab === 'PR' && styles.segmentNavTextActive]}>
            PRs ({prs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentNavBtn, activeTab === 'PO' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('PO')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={15}
            color={activeTab === 'PO' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.segmentNavText, activeTab === 'PO' && styles.segmentNavTextActive]}>
            POs ({pos.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentNavBtn, activeTab === 'VENDORS' && styles.segmentNavBtnActive]}
          onPress={() => setActiveTab('VENDORS')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="domain"
            size={15}
            color={activeTab === 'VENDORS' ? '#000000' : '#64748B'}
          />
          <Text style={[styles.segmentNavText, activeTab === 'VENDORS' && styles.segmentNavTextActive]}>
            Vendors ({vendors.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* KPI Stats Row for PR */}
      {activeTab === 'PR' && (
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpiStats.total}</Text>
            <Text style={styles.kpiLabel}>Total PRs</Text>
          </View>
          <View style={[styles.kpiCard, kpiStats.pending > 0 && styles.kpiCardPending]}>
            <Text style={[styles.kpiValue, kpiStats.pending > 0 && { color: '#B45309' }]}>
              {kpiStats.pending}
            </Text>
            <Text style={styles.kpiLabel}>Pending</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{kpiStats.approved}</Text>
            <Text style={styles.kpiLabel}>PO Issued</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#047857' }]}>{kpiStats.received}</Text>
            <Text style={styles.kpiLabel}>Inwarded</Text>
          </View>
        </View>
      )}

      {/* KPI Stats Row for PO */}
      {activeTab === 'PO' && (
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{poStats.total}</Text>
            <Text style={styles.kpiLabel}>Total POs</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{poStats.active}</Text>
            <Text style={styles.kpiLabel}>Active</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#047857' }]}>{poStats.received}</Text>
            <Text style={styles.kpiLabel}>Inwarded</Text>
          </View>
          <View style={[styles.kpiCard, poStats.overdue > 0 && styles.kpiCardPending]}>
            <Text style={[styles.kpiValue, poStats.overdue > 0 ? { color: '#EF4444' } : { color: '#64748B' }]}>
              {poStats.overdue}
            </Text>
            <Text style={styles.kpiLabel}>Overdue</Text>
          </View>
        </View>
      )}

      {/* KPI Stats Row for Vendors */}
      {activeTab === 'VENDORS' && (
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{vendorStats.total}</Text>
            <Text style={styles.kpiLabel}>Suppliers</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#047857' }]}>{vendorStats.active}</Text>
            <Text style={styles.kpiLabel}>Active</Text>
          </View>
          <View style={[styles.kpiCard, { flex: 2 }]}>
            <Text style={[styles.kpiValue, { color: '#B45309' }]}>
              ₹{(vendorStats.totalSpend / 100000).toFixed(1)}L
            </Text>
            <Text style={styles.kpiLabel}>Total Spend</Text>
          </View>
        </View>
      )}

      {/* Search Box */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'PR'
                ? 'Search PR#, PO#, Part, Machine...'
                : activeTab === 'PO'
                ? 'Search PO#, Supplier, Part...'
                : 'Search Vendor name, code, contact...'
            }
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

        {/* Filter Chips for PR */}
        {activeTab === 'PR' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {[
              { id: 'ALL', label: 'All PRs' },
              { id: 'new', label: 'Pending Approval' },
              { id: 'approved', label: 'PO Approved' },
              { id: 'grn_received', label: 'Inwarded (GRN)' },
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
        )}

        {/* Filter Chips for PO */}
        {activeTab === 'PO' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'approved', label: 'Active' },
              { id: 'grn_received', label: 'Fulfilled' },
              { id: 'overdue', label: 'Overdue' },
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
        )}
      </View>

      {/* Main List ScrollView */}
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAllData}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Render Tab 1: Requisitions (PR) */}
        {activeTab === 'PR' && (
          filteredPrs.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="package-variant" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'ALL' ? 'No Matching PRs' : 'No Active Requisitions'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try adjusting your search terms or filters'
                  : 'Raise emergency purchase requests to restock critical machine spares'}
              </Text>
            </View>
          ) : (
            filteredPrs.map((pr) => {
              const isNew = pr.status === 'new';
              const isApproved = pr.status === 'approved';
              const isReceived = pr.status === 'grn_received';

              return (
                <View key={pr.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.prCodeBadge}>
                      <Text style={styles.prCodeText}>{pr.pr_number || 'PR-PENDING'}</Text>
                    </View>

                    <View
                      style={[
                        styles.urgencyBadge,
                        pr.urgency === 'critical'
                          ? styles.urgencyCritical
                          : pr.urgency === 'high'
                          ? styles.urgencyHigh
                          : styles.urgencyNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.urgencyText,
                          pr.urgency === 'critical'
                            ? styles.urgencyTextCritical
                            : pr.urgency === 'high'
                            ? styles.urgencyTextHigh
                            : styles.urgencyTextNormal,
                        ]}
                      >
                        {(pr.urgency || 'NORMAL').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.partRow}>
                    <MaterialCommunityIcons name="cog" size={18} color="#B45309" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partNumber}>{pr.part_number || 'JCB Component'}</Text>
                      <Text style={styles.partName} numberOfLines={1}>
                        {pr.part_name || 'Spare Part'}
                      </Text>
                    </View>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyValue}>{pr.quantity_required || 1}</Text>
                      <Text style={styles.qtyLabel}>Units</Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="robot-industrial" size={15} color="#64748B" />
                    <Text style={styles.metaLabel}>Machine:</Text>
                    <Text style={styles.metaValue}>{pr.machine_code || 'General Plant Inventory'}</Text>
                  </View>

                  {pr.po_number && (
                    <View style={styles.poRow}>
                      <MaterialCommunityIcons name="file-document-check-outline" size={15} color="#2563EB" />
                      <Text style={styles.poLabel}>PO Number:</Text>
                      <Text style={styles.poValue}>{pr.po_number}</Text>
                    </View>
                  )}

                  {pr.technical_justification ? (
                    <Text style={styles.justificationText} numberOfLines={2}>
                      "{pr.technical_justification}"
                    </Text>
                  ) : null}

                  <View style={styles.actionDivider} />

                  {isNew && isManager && (
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApprovePR(pr.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="check-circle" size={16} color="#000000" />
                      <Text style={styles.approveBtnText}>Approve & Issue PO</Text>
                    </TouchableOpacity>
                  )}

                  {isApproved && (
                    <TouchableOpacity
                      style={styles.grnBtn}
                      onPress={() => handleGRN(pr.id, pr.quantity_required)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="truck-delivery" size={16} color="#FFFFFF" />
                      <Text style={styles.grnBtnText}>Receive Stock (GRN Inward)</Text>
                    </TouchableOpacity>
                  )}

                  {isReceived && (
                    <View style={styles.completedBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={16} color="#047857" />
                      <Text style={styles.completedText}>Stock Received & Inwarded to Catalog</Text>
                    </View>
                  )}

                  {isNew && !isManager && (
                    <View style={styles.pendingBadge}>
                      <MaterialCommunityIcons name="clock-outline" size={15} color="#B45309" />
                      <Text style={styles.pendingText}>Awaiting Manager Approval</Text>
                    </View>
                  )}
                </View>
              );
            })
          )
        )}

        {/* Render Tab 2: Purchase Orders (PO) */}
        {activeTab === 'PO' && (
          filteredPos.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery || statusFilter !== 'ALL' ? 'No Matching Orders' : 'No Purchase Orders Issued'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Approve pending PRs to automatically issue purchase orders to JCB authorized suppliers
              </Text>
            </View>
          ) : (
            filteredPos.map((po) => {
              const isReceived = po.status === 'grn_received';
              const reqQty = Number(po.quantity_required) || 1;
              const recQty = Number(po.received_quantity) || 0;
              const percent = Math.min(100, Math.round((recQty / reqQty) * 100));

              return (
                <View key={po.id || po.po_number} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.poNumberPill}>
                      <MaterialCommunityIcons name="file-document-check" size={14} color="#1E40AF" />
                      <Text style={styles.poNumberPillText}>{po.po_number || 'PO-PENDING'}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isReceived
                          ? styles.statusBadgeReceived
                          : po.is_overdue
                          ? styles.statusBadgeOverdue
                          : styles.statusBadgeApproved,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isReceived
                            ? styles.statusTextReceived
                            : po.is_overdue
                            ? styles.statusTextOverdue
                            : styles.statusTextApproved,
                        ]}
                      >
                        {po.is_overdue ? 'OVERDUE' : isReceived ? 'INWARDED (GRN)' : 'ISSUED'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.vendorRow}>
                    <MaterialCommunityIcons name="domain" size={16} color="#0F172A" />
                    <Text style={styles.vendorName} numberOfLines={1}>
                      {po.supplier_name || 'JCB Genuine Spares Hub'}
                    </Text>
                    {po.plant_name && (
                      <View style={styles.plantBadge}>
                        <Text style={styles.plantBadgeText}>{po.plant_name}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.partRow}>
                    <MaterialCommunityIcons name="cog" size={16} color="#B45309" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partNumber}>{po.part_number || 'JCB Component'}</Text>
                      <Text style={styles.partName} numberOfLines={1}>
                        {po.part_name || 'Spare Part'}
                      </Text>
                    </View>
                    <View style={styles.poCostBadge}>
                      <Text style={styles.poCostValue}>
                        ₹{Number(po.total_order_value || po.total_order_cost || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.poCostLabel}>Order Value</Text>
                    </View>
                  </View>

                  {/* Fulfillment Progress */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>Fulfillment Progress</Text>
                      <Text style={styles.progressValue}>
                        {recQty} / {reqQty} Units ({percent}%)
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                    </View>
                  </View>

                  {/* Logistics Meta if available */}
                  {(po.expected_delivery_date || po.vehicle_number) && (
                    <View style={styles.logisticsRow}>
                      {po.expected_delivery_date && (
                        <View style={styles.logisticsItem}>
                          <MaterialCommunityIcons name="calendar-clock" size={13} color="#64748B" />
                          <Text style={styles.logisticsText}>
                            ETA: {String(po.expected_delivery_date).split('T')[0]}
                          </Text>
                        </View>
                      )}
                      {po.vehicle_number && (
                        <View style={styles.logisticsItem}>
                          <MaterialCommunityIcons name="truck-outline" size={13} color="#64748B" />
                          <Text style={styles.logisticsText}>{po.vehicle_number}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Inward Action if not completed */}
                  {!isReceived && isManager && (
                    <>
                      <View style={styles.actionDivider} />
                      <TouchableOpacity
                        style={styles.grnBtn}
                        onPress={() => handleGRN(po.id, po.quantity_required)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="truck-delivery" size={16} color="#FFFFFF" />
                        <Text style={styles.grnBtnText}>Receive Stock (GRN Inward)</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })
          )
        )}

        {/* Render Tab 3: Vendors Directory */}
        {activeTab === 'VENDORS' && (
          filteredVendors.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons name="domain" size={36} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No Matching Suppliers' : 'No Vendors Registered'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Suppliers registered in JCB ERP will be displayed here with performance ratings
              </Text>
            </View>
          ) : (
            filteredVendors.map((v) => (
              <View key={v.id || v.vendor_code || v.vendor_name} style={styles.card}>
                <View style={styles.cardTopRow}>
                  <View style={styles.vendorCodePill}>
                    <MaterialCommunityIcons name="shield-check" size={14} color="#047857" />
                    <Text style={styles.vendorCodeText}>{v.vendor_code || 'VEND-AUTH'}</Text>
                  </View>
                  <View style={styles.statusBadgeApproved}>
                    <Text style={styles.statusTextApproved}>
                      {(v.status || 'ACTIVE PARTNER').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.vendorTitle}>{v.vendor_name || v.name || 'JCB Authorized Vendor'}</Text>

                <View style={styles.contactRow}>
                  <MaterialCommunityIcons name="account-tie" size={15} color="#475569" />
                  <Text style={styles.contactText}>
                    {v.contact_person || 'Supply Representative'}
                  </Text>
                  {v.phone && (
                    <>
                      <Text style={styles.contactDivider}>•</Text>
                      <MaterialCommunityIcons name="phone" size={13} color="#2563EB" />
                      <Text style={styles.contactPhone}>{v.phone}</Text>
                    </>
                  )}
                </View>

                {/* Vendor Performance Metrics 4-Grid */}
                <View style={styles.vendorMetricsGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricVal}>{v.total_orders ?? 0}</Text>
                    <Text style={styles.metricLbl}>Orders</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={[styles.metricVal, { color: '#2563EB' }]}>{v.active_orders ?? 0}</Text>
                    <Text style={styles.metricLbl}>Active</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={[styles.metricVal, { color: '#047857' }]}>
                      {v.on_time_delivery_rate != null ? `${v.on_time_delivery_rate}%` : '98.5%'}
                    </Text>
                    <Text style={styles.metricLbl}>On-Time</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={[styles.metricVal, { color: '#B45309' }]}>
                      ₹{v.total_spend ? (Number(v.total_spend) / 100000).toFixed(1) + 'L' : '0.0L'}
                    </Text>
                    <Text style={styles.metricLbl}>Total Spend</Text>
                  </View>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* New PR Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Raise Purchase Requisition</Text>
                <Text style={styles.modalSubtitle}>Request emergency spares or replenishment</Text>
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
              <Text style={styles.inputLabel}>Select Part *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {parts.map((p) => {
                  const selected = formData.part_id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.selectCard, selected && styles.selectCardActive]}
                      onPress={() => setFormData({ ...formData, part_id: p.id })}
                    >
                      <Text style={[styles.selectCardTitle, selected && styles.selectCardTitleActive]}>
                        {p.part_number}
                      </Text>
                      <Text style={[styles.selectCardSub, selected && styles.selectCardSubActive]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.stockNote}>Stock: {p.available_stock || 0}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Target Machine</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                <TouchableOpacity
                  style={[styles.selectCard, !formData.machine_id && styles.selectCardActive]}
                  onPress={() => setFormData({ ...formData, machine_id: '' })}
                >
                  <Text style={[styles.selectCardTitle, !formData.machine_id && styles.selectCardTitleActive]}>
                    General Stock
                  </Text>
                  <Text style={styles.selectCardSub}>Plant-wide</Text>
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

              <Text style={styles.inputLabel}>Quantity Required *</Text>
              <TextInput
                style={styles.textInput}
                value={String(formData.quantity_required)}
                onChangeText={(t) => setFormData({ ...formData, quantity_required: parseInt(t, 10) || 1 })}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Urgency</Text>
              <View style={styles.urgencySelectRow}>
                {[
                  { key: 'critical', label: 'Critical (Line Stop)' },
                  { key: 'high', label: 'High Priority' },
                  { key: 'medium', label: 'Normal PM' },
                ].map((u) => {
                  const selected = formData.urgency === u.key;
                  return (
                    <TouchableOpacity
                      key={u.key}
                      style={[styles.urgencySelectChip, selected && styles.urgencySelectChipActive]}
                      onPress={() => setFormData({ ...formData, urgency: u.key })}
                    >
                      <Text style={[styles.urgencySelectText, selected && styles.urgencySelectTextActive]}>
                        {u.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Reason / Justification</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                value={formData.technical_justification}
                onChangeText={(t) => setFormData({ ...formData, technical_justification: t })}
                placeholder="Reason for ordering..."
                placeholderTextColor="#94A3B8"
                multiline
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
                onPress={handleCreatePR}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Submit PR</Text>
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
  // 3-Way Segmented Tabs
  segmentNavWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segmentNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 9,
  },
  segmentNavBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentNavTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  // PO Card Specific Styles
  poNumberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  poNumberPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeApproved: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusBadgeReceived: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeOverdue: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statusTextApproved: {
    color: '#1E40AF',
  },
  statusTextReceived: {
    color: '#047857',
  },
  statusTextOverdue: {
    color: '#DC2626',
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  vendorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  plantBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plantBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600',
  },
  poCostBadge: {
    alignItems: 'flex-end',
  },
  poCostValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  poCostLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  progressValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F9B101',
    borderRadius: 3,
  },
  logisticsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  logisticsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logisticsText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  // Vendor Card Specific Styles
  vendorCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  vendorCodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  vendorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  contactText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  contactDivider: {
    color: '#CBD5E1',
    marginHorizontal: 2,
  },
  contactPhone: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
  },
  vendorMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLbl: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
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
  newPrBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newPrBtnText: {
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
  prCodeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  prCodeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgencyCritical: {
    backgroundColor: '#FEF2F2',
  },
  urgencyHigh: {
    backgroundColor: '#FFFBEB',
  },
  urgencyNormal: {
    backgroundColor: '#F1F5F9',
  },
  urgencyText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  urgencyTextCritical: {
    color: '#DC2626',
  },
  urgencyTextHigh: {
    color: '#B45309',
  },
  urgencyTextNormal: {
    color: '#475569',
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  partNumber: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  partName: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1,
  },
  qtyBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  qtyValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  qtyLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  poLabel: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  poValue: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '800',
  },
  justificationText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 6,
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
  grnBtn: {
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  grnBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    borderRadius: 8,
  },
  completedText: {
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
  stockNote: {
    fontSize: 9.5,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
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
  urgencySelectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencySelectChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  urgencySelectChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  urgencySelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  urgencySelectTextActive: {
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
