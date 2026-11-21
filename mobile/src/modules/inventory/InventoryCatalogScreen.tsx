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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const InventoryCatalogScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'plant_admin' || role === 'enterprise_admin';
  const isManager = role === 'manager';
  const isStoreManager = role === 'store_manager' || role === 'store' || role === 'store_keeper';
  const canAdjust = isAdmin || isManager || isStoreManager;

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingPart, setAdjustingPart] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock Count Verification');
  const [detailPart, setDetailPart] = useState<any | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    part_number: '',
    oem_part_number: '',
    name: '',
    description: '',
    category: 'Hydraulic',
    bin_location: 'A-01-01',
    current_physical_stock: 10,
    min_reorder_level: 5,
    max_stock_level: 100,
    unit_cost: 1500,
    supplier_name: 'JCB Genuine Parts',
  });

  const fetchParts = async (search = '') => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(
        `/inventory/search?query=${encodeURIComponent(search)}&limit=50`
      );
      if (res?.success && res.data) {
        setParts(res.data);
      }
    } catch (e) {
      console.warn('Failed to load parts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts('');
  }, []);

  const openCreateModal = () => {
    setEditingPart(null);
    setFormData({
      part_number: `JCB-${Math.floor(10000 + Math.random() * 90000)}`,
      oem_part_number: `OEM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      description: 'Heavy duty replacement component',
      category: 'Hydraulic',
      bin_location: `BIN-${String.fromCharCode(65 + Math.floor(Math.random() * 6))}-${Math.floor(
        1 + Math.random() * 9
      )}`,
      current_physical_stock: 25,
      min_reorder_level: 5,
      max_stock_level: 150,
      unit_cost: 3200,
      supplier_name: 'JCB Heavy Machinery Parts Ltd.',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: any) => {
    setDetailPart(null);
    setEditingPart(p);
    setFormData({
      part_number: p.part_number,
      oem_part_number: p.oem_part_number || '',
      name: p.name,
      description: p.description || '',
      category: p.category || 'Mechanical',
      bin_location: p.bin_location || 'A-01-01',
      current_physical_stock: p.current_physical_stock || 0,
      min_reorder_level: p.min_reorder_level || 5,
      max_stock_level: p.max_stock_level || 100,
      unit_cost: p.unit_cost || 0,
      supplier_name: p.supplier_name || 'JCB Genuine Parts',
    });
    setIsModalOpen(true);
  };

  const handleSavePart = async () => {
    if (!formData.part_number || !formData.name) {
      Alert.alert('Required', 'Please enter part number and name.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingPart) {
        const res: any = await apiClient.put(`/inventory/${editingPart.id}`, formData);
        if (res?.success) {
          Alert.alert('Success', `Part ${formData.part_number} updated successfully.`);
          setIsModalOpen(false);
          fetchParts(query);
        }
      } else {
        const res: any = await apiClient.post('/inventory', formData);
        if (res?.success) {
          Alert.alert('Success', `Part ${formData.part_number} added to catalog.`);
          setIsModalOpen(false);
          fetchParts(query);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save part.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePart = (id: string, partNo: string) => {
    setDetailPart(null);
    Alert.alert('Confirm Delete', `Are you sure you want to remove part ${partNo}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res: any = await apiClient.delete(`/inventory/${id}`);
            if (res?.success) {
              Alert.alert('Success', res.message || `Part ${partNo} removed.`);
              fetchParts(query);
            }
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete part.');
          }
        },
      },
    ]);
  };

  const openAdjustModal = (p: any) => {
    setDetailPart(null);
    setAdjustingPart(p);
    setAdjustQty(0);
    setAdjustReason('Physical stock audit count');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async () => {
    if (!adjustingPart || adjustQty === 0) return;

    try {
      setActionLoading(true);
      const res: any = await apiClient.post('/inventory/adjust', {
        part_id: adjustingPart.id,
        adjustment_quantity: adjustQty,
        reason: adjustReason,
      });
      if (res?.success) {
        Alert.alert('Stock Adjusted', res.message || 'Stock adjustment applied.');
        setIsAdjustModalOpen(false);
        fetchParts(query);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Adjustment failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered parts by category
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'LOW_STOCK') {
        const physical = p.current_physical_stock || 0;
        const reserved = p.reserved_stock || 0;
        const available = p.available_stock !== undefined ? p.available_stock : physical - reserved;
        return available <= (p.min_reorder_level || 5);
      }
      return p.category?.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [parts, selectedCategory]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Spare Parts"
        icon="package-variant-closed"
        sectionTitle="Spare Parts Management"
        sectionSubtitle="Workshop & Warehouse Stock Levels"
        rightAction={
          isAdmin ? (
            <TouchableOpacity style={styles.headerAddBtn} onPress={openCreateModal} activeOpacity={0.8}>
              <MaterialCommunityIcons name="plus" size={16} color="#000000" />
              <Text style={styles.headerAddBtnText}>Add Part</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Search Input & Category Pills */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              fetchParts(text);
            }}
            placeholder="Search part number, name, OEM..."
            placeholderTextColor="#94A3B8"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); fetchParts(''); }}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {[
            { key: 'ALL', label: `All (${parts.length})` },
            { key: 'LOW_STOCK', label: '⚠️ Low Stock' },
            { key: 'Hydraulic', label: 'Hydraulic' },
            { key: 'Mechanical', label: 'Mechanical' },
            { key: 'Electrical', label: 'Electrical' },
            { key: 'Pneumatic', label: 'Pneumatic' },
          ].map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catChip, selectedCategory === cat.key && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Text style={[styles.catChipText, selectedCategory === cat.key && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => fetchParts(query)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filteredParts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No matching spare parts found</Text>
            <Text style={styles.emptySub}>Search by part number, OEM reference, or category</Text>
          </View>
        ) : (
          filteredParts.map((p) => {
            const physical = p.current_physical_stock || 0;
            const reserved = p.reserved_stock || 0;
            const available = p.available_stock !== undefined ? p.available_stock : physical - reserved;
            const isLow = available <= (p.min_reorder_level || 5);

            return (
              <TouchableOpacity
                key={p.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setDetailPart(p)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.partNum}>{p.part_number}</Text>
                    {p.oem_part_number ? (
                      <Text style={styles.oemNum}>OEM: {p.oem_part_number}</Text>
                    ) : null}
                  </View>
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{p.category}</Text>
                  </View>
                </View>

                <Text style={styles.partName}>{p.name}</Text>

                <View style={styles.stockGrid}>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Bin Location</Text>
                    <Text style={styles.stockValBold}>📍 {p.bin_location}</Text>
                  </View>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Physical</Text>
                    <Text style={styles.stockVal}>{physical}</Text>
                  </View>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Reserved</Text>
                    <Text style={[styles.stockVal, { color: '#B45309' }]}>{reserved}</Text>
                  </View>
                  <View style={styles.stockItem}>
                    <Text style={styles.stockLabel}>Available</Text>
                    <Text style={[styles.stockValBold, isLow ? { color: '#B91C1C' } : { color: '#047857' }]}>
                      {available} {isLow ? '⚠️' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.unitCost}>
                    Unit Price: <Text style={styles.costVal}>₹{Number(p.unit_cost || 0).toLocaleString('en-IN')}</Text>
                  </Text>

                  {(isAdmin || canAdjust) && (
                    <View style={styles.actionBtnRow}>
                      {canAdjust && (
                        <TouchableOpacity
                          style={styles.adjustBtn}
                          onPress={() => openAdjustModal(p)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.adjustBtnText}>⚙️ Adjust</Text>
                        </TouchableOpacity>
                      )}
                      {isAdmin && (
                        <>
                          <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => openEditModal(p)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.editBtnText}>✏️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeletePart(p.id, p.part_number)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.deleteBtnText}>🗑️</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Part Detail Bottom Sheet / Modal */}
      {detailPart && (
        <Modal visible={!!detailPart} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalPartNum}>{detailPart.part_number}</Text>
                  <Text style={styles.modalPartName}>{detailPart.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setDetailPart(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.specsBox}>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Category</Text>
                    <Text style={styles.specVal}>{detailPart.category}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>OEM Reference</Text>
                    <Text style={styles.specValMono}>{detailPart.oem_part_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Bin Location</Text>
                    <Text style={styles.specVal}>📍 {detailPart.bin_location} ({detailPart.warehouse_zone || 'Zone A'})</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Physical Stock</Text>
                    <Text style={styles.specVal}>{detailPart.current_physical_stock || 0} Units</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Reserved Stock</Text>
                    <Text style={[styles.specVal, { color: '#B45309' }]}>{detailPart.reserved_stock || 0} Units</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Available for Issuance</Text>
                    <Text style={[styles.specVal, { color: '#16A34A', fontWeight: '900' }]}>
                      {detailPart.available_stock !== undefined
                        ? detailPart.available_stock
                        : (detailPart.current_physical_stock || 0) - (detailPart.reserved_stock || 0)} Units
                    </Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Unit Price</Text>
                    <Text style={styles.specValMono}>₹{Number(detailPart.unit_cost || 0).toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Supplier</Text>
                    <Text style={styles.specVal}>{detailPart.supplier_name || 'JCB Genuine Parts'}</Text>
                  </View>
                </View>

                {canAdjust && (
                  <TouchableOpacity
                    style={styles.modalAdjustBtn}
                    onPress={() => openAdjustModal(detailPart)}
                  >
                    <Text style={styles.modalAdjustBtnText}>⚙️ Adjust Stock Quantity</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && adjustingPart && (
        <Modal visible={isAdjustModalOpen} animationType="slide" transparent onRequestClose={() => setIsAdjustModalOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>ADJUST STOCK: {adjustingPart.part_number}</Text>
                <TouchableOpacity onPress={() => setIsAdjustModalOpen(false)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={{ paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.summaryBox}>
                  <Text style={styles.boldText}>{adjustingPart.name}</Text>
                  <Text style={styles.summarySub}>
                    Current Physical Stock: <Text style={styles.boldText}>{adjustingPart.current_physical_stock}</Text>
                  </Text>
                  {adjustQty !== 0 && (
                    <Text style={styles.previewStockText}>
                      New Physical Stock will be: {(adjustingPart.current_physical_stock || 0) + adjustQty} Units
                    </Text>
                  )}
                </View>

                <Text style={styles.fieldLabel}>Quantity Adjustment (+ or -) *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={String(adjustQty)}
                  onChangeText={(t) => setAdjustQty(parseInt(t, 10) || 0)}
                  keyboardType="numeric"
                  placeholder="e.g. +5 or -2"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.helpText}>Use positive numbers to add stock, negative to reduce.</Text>

                <Text style={styles.fieldLabel}>Reason for Adjustment *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={adjustReason}
                  onChangeText={setAdjustReason}
                  placeholder="e.g. Physical stock audit count"
                  placeholderTextColor="#94A3B8"
                />
              </ScrollView>

              {/* Sticky Action Footer */}
              <View style={styles.modalActionsPinned}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAdjustModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleAdjustSubmit}
                  disabled={actionLoading || adjustQty === 0}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <Text style={styles.applyBtnText}>APPLY STOCK ADJUSTMENT</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Add / Edit Part Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPart ? `EDIT PART: ${formData.part_number}` : 'ADD NEW SPARE PART MASTER'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={{ paddingBottom: 28 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.fieldLabel}>JCB Part Number *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.part_number}
                onChangeText={(t) => setFormData({ ...formData, part_number: t })}
                placeholder="e.g. HYD-20015"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Part Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
                placeholder="e.g. Hydraulic Proportional Valve"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.category}
                    onChangeText={(t) => setFormData({ ...formData, category: t })}
                    placeholder="Hydraulic, Electrical..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Warehouse Bin Location *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.bin_location}
                    onChangeText={(t) => setFormData({ ...formData, bin_location: t })}
                    placeholder="e.g. A-02-04"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.threeCol}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Physical Stock</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(formData.current_physical_stock)}
                    onChangeText={(t) =>
                      setFormData({ ...formData, current_physical_stock: parseInt(t, 10) || 0 })
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Min Reorder</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(formData.min_reorder_level)}
                    onChangeText={(t) =>
                      setFormData({ ...formData, min_reorder_level: parseInt(t, 10) || 0 })
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Unit Cost (₹)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={String(formData.unit_cost)}
                    onChangeText={(t) =>
                      setFormData({ ...formData, unit_cost: parseFloat(t) || 0 })
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Pinned Sticky Footer Actions - NEVER CUT OFF */}
            <View style={styles.modalActionsPinned}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleSavePart} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.applyBtnText}>{editingPart ? 'UPDATE PART' : 'ADD PART'}</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hamburgerBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  screenTitle: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  screenSubtitle: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerAddBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  badgePillClean: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgePillCleanText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  searchSection: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#09090B',
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearSearchIcon: {
    fontSize: 12,
    color: '#94A3B8',
    padding: 4,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  catChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#F9B101',
    borderColor: '#F9B101',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  scroll: {
    padding: 14,
    paddingBottom: 30,
    gap: 12,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  emptyIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  emptySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  partNum: {
    fontSize: 14,
    fontWeight: '900',
    color: '#09090B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  oemNum: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  catBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#334155',
  },
  partName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 4,
  },
  stockGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  stockItem: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  stockVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  stockValBold: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  unitCost: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  costVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#09090B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  adjustBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  adjustBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  editBtn: {
    backgroundColor: '#FEF9C3',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  editBtnText: {
    fontSize: 12,
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    fontSize: 12,
  },
  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    backgroundColor: '#09090B',
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalPartNum: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalPartName: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '900',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  closeIcon: {
    color: '#A1A1AA',
    fontSize: 18,
    fontWeight: '900',
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  specsBox: {
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#09090B',
  },
  specValMono: {
    fontSize: 12,
    fontWeight: '900',
    color: '#09090B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalAdjustBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  modalAdjustBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  summarySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  previewStockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    marginTop: 4,
  },
  boldText: {
    color: '#000000',
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  helpText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  modalInput: {
    height: 42,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    fontWeight: '600',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  threeCol: {
    flexDirection: 'row',
    gap: 6,
  },
  col: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalActionsPinned: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  applyBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
});
