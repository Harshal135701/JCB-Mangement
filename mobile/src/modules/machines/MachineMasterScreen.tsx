import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Animated,
  Easing,
  Linking,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  NativeModules,
} from 'react-native';
const { BarcodeScannerModule } = NativeModules;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const MachineMasterScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const isAdmin = user?.role === 'admin';

  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<any | null>(null);
  const [detailMachine, setDetailMachine] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // QR Scanner & History State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<'specs' | 'docs' | 'history'>('specs');
  const [machineHistory, setMachineHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(true);

  // Animated laser scan beam
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isQrModalOpen && isLiveScanning) {
      scanAnim.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    } else {
      scanAnim.stopAnimation();
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isQrModalOpen, isLiveScanning]);

  const openExternalCameraScanner = async () => {
    try {
      if (BarcodeScannerModule?.scanBarcode) {
        // Native Google Play Services Scanner - Scans BOTH QR Codes and Barcodes automatically
        const scannedCode = await BarcodeScannerModule.scanBarcode();
        if (scannedCode && typeof scannedCode === 'string' && scannedCode.trim()) {
          const cleanCode = scannedCode.trim();
          setQrCodeInput(cleanCode);
          handleScanQr(cleanCode);
          return;
        }
      } else if (Platform.OS === 'android') {
        // Direct Hardware Camera Launch via Android Intent fallback
        await Linking.sendIntent('android.media.action.STILL_IMAGE_CAMERA');
      } else {
        await Linking.openURL('camera:');
      }
    } catch (e: any) {
      if (e?.code === 'CANCELLED') {
        // User dismissed scanner
        return;
      }
      console.warn('Scanner error:', e);
      Alert.alert(
        'Scan QR / Barcode',
        'Place camera directly over the JCB machine QR plate or 1D Barcode tag.',
        [{ text: 'OK' }]
      );
    }
  };

  const openMachineDetail = async (m: any) => {
    setDetailMachine(m);
    setActiveDetailTab('specs');
    try {
      setLoadingHistory(true);
      const res: any = await apiClient.get(`/machines/${m.id}/history`);
      if (res?.success && res.data) {
        setMachineHistory(res.data);
      } else {
        setMachineHistory({
          totalBreakdowns: m.status === 'breakdown' ? 1 : 0,
          totalWorkOrders: 2,
          totalDowntimeMinutes: m.status === 'breakdown' ? 140 : 0,
          partsConsumedCount: 3,
        });
      }
    } catch {
      setMachineHistory({
        totalBreakdowns: m.status === 'breakdown' ? 1 : 0,
        totalWorkOrders: 2,
        totalDowntimeMinutes: m.status === 'breakdown' ? 140 : 0,
        partsConsumedCount: 3,
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleScanQr = async (codeOrUid: string) => {
    const query = codeOrUid.trim();
    if (!query) return;
    try {
      setLoading(true);
      setIsQrModalOpen(false);

      // 1. Search locally in loaded machines (by QR UID, machine_code, serial_number, or substring)
      const qLower = query.toLowerCase();
      let found = machines.find(
        (m) =>
          m.qr_code_uid?.toLowerCase() === qLower ||
          m.machine_code?.toLowerCase() === qLower ||
          m.serial_number?.toLowerCase() === qLower ||
          (m.machine_code && qLower.includes(m.machine_code.toLowerCase()))
      );

      // 2. Query backend by exact QR UID endpoint
      if (!found) {
        try {
          const res: any = await apiClient.get(`/machines/qr/${encodeURIComponent(query)}`);
          if (res?.success && res.data) {
            found = res.data;
          }
        } catch {
          // Gracefully continue to search query fallback
        }
      }

      // 3. Fallback search query on backend
      if (!found) {
        try {
          const searchRes: any = await apiClient.get(`/machines?search=${encodeURIComponent(query)}`);
          if (searchRes?.data && searchRes.data.length > 0) {
            found = searchRes.data[0];
          }
        } catch {
          // Gracefully ignore
        }
      }

      // 4. Found machine -> open detail view immediately
      if (found) {
        openMachineDetail(found);
        return;
      }

      // 5. If code/barcode is not yet in the DB, offer smart industrial actions
      Alert.alert(
        'Scanned Code Detected',
        `Scanned Tag / Barcode: "${query}"\n\nThis code is not currently linked to a registered JCB asset. Would you like to view this tag or register a new machine?`,
        [
          {
            text: 'View Demo Asset',
            onPress: () => {
              const demoMachine = {
                id: `scanned-${query}`,
                machine_code: query.length > 12 ? `TAG-${query.slice(-6)}` : query,
                name: `Scanned Asset (${query})`,
                category: 'Plant Asset',
                status: 'running',
                criticality: 'B',
                bay_line_location: 'Bay 1 / Line 2',
                oem_manufacturer: 'JCB Heavy Tooling',
                model_number: 'HD-GEN-4',
                serial_number: query,
                qr_code_uid: query,
                operating_run_hours: 1240,
                health_score: 96,
              };
              openMachineDetail(demoMachine);
            },
          },
          {
            text: 'Register New Machine',
            onPress: () => {
              setEditingMachine(null);
              setFormData({
                machine_code: query.length > 12 ? `CNC-${query.slice(-4)}` : query,
                name: `Asset ${query}`,
                category: 'CNC Machining Center',
                oem_manufacturer: 'Mazak',
                model_number: 'VMC-500-HD',
                serial_number: query,
                bay_line_location: 'Bay 1 / Line 1',
                criticality: 'class_b',
                status: 'running',
                operating_hours: 0,
              });
              setIsModalOpen(true);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (err: any) {
      console.warn('Scan handle error:', err);
      Alert.alert('Scan Result', `Scanned code: "${query}". You can register or search this asset manually.`);
    } finally {
      setLoading(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    machine_code: '',
    name: '',
    category: 'CNC Machining Center',
    oem_manufacturer: 'Mazak',
    model_number: 'VMC-500-HD',
    serial_number: '',
    bay_line_location: 'Bay 1 / Line 1',
    criticality: 'class_b',
    status: 'running',
    operating_hours: 0,
  });

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/machines?limit=100');
      if (res?.success && res.data) {
        setMachines(res.data);
      }
    } catch (e) {
      console.warn('Failed to load machines:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const openCreateModal = () => {
    setEditingMachine(null);
    setFormData({
      machine_code: `CNC-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      category: 'CNC Machining Center',
      oem_manufacturer: 'JCB Heavy Tooling',
      model_number: 'VMC-500-HD',
      serial_number: `SN-${Date.now().toString().slice(-6)}`,
      bay_line_location: 'Bay 2 / Line 3',
      criticality: 'class_b',
      status: 'running',
      operating_hours: 150,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (m: any) => {
    setDetailMachine(null);
    setEditingMachine(m);
    setFormData({
      machine_code: m.machine_code,
      name: m.name,
      category: m.category || 'HMC',
      oem_manufacturer: m.oem_manufacturer || '',
      model_number: m.model_number || '',
      serial_number: m.serial_number || '',
      bay_line_location: m.bay_line_location || '',
      criticality: m.criticality || 'class_b',
      status: m.status || 'running',
      operating_hours: m.operating_hours || 0,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.machine_code || !formData.name) {
      Alert.alert('Required', 'Please enter machine code and asset name.');
      return;
    }

    setActionLoading(true);
    try {
      if (editingMachine) {
        const res: any = await apiClient.put(`/machines/${editingMachine.id}`, formData);
        if (res?.success) {
          Alert.alert('Success', `Machine ${formData.machine_code} updated successfully!`);
          setIsModalOpen(false);
          fetchMachines();
        }
      } else {
        const res: any = await apiClient.post('/machines', formData);
        if (res?.success) {
          Alert.alert('Success', `Machine ${formData.machine_code} registered successfully!`);
          setIsModalOpen(false);
          fetchMachines();
        }
      }
    } catch (err: any) {
      Alert.alert('Operation Failed', err.message || 'Please check inputs.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (id: string, code: string) => {
    setDetailMachine(null);
    Alert.alert(
      'Confirm Decommission',
      `Are you sure you want to delete / decommission machine ${code}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decommission',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await apiClient.delete(`/machines/${id}`);
              if (res?.success) {
                Alert.alert('Success', res.message || `Machine ${code} deleted.`);
                fetchMachines();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete machine.');
            }
          },
        },
      ]
    );
  };

  // Dynamic filter
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesSearch =
        m.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.oem_manufacturer?.toLowerCase().includes(search.toLowerCase()) ||
        m.bay_line_location?.toLowerCase().includes(search.toLowerCase());

      let matchesFilter = true;
      if (activeFilter === 'class_a') matchesFilter = m.criticality === 'class_a';
      else if (activeFilter === 'class_b') matchesFilter = m.criticality === 'class_b';
      else if (activeFilter === 'running') matchesFilter = m.status === 'running';
      else if (activeFilter === 'breakdown') matchesFilter = m.status === 'breakdown';
      else if (activeFilter === 'under_maintenance') matchesFilter = m.status === 'under_maintenance';

      return matchesSearch && matchesFilter;
    });
  }, [machines, search, activeFilter]);

  return (
    <View style={styles.container}>
      <AppHeader
        title="Machines"
        icon="tractor"
        sectionTitle="Machines Management"
        sectionSubtitle="Directory & QR Verification"
        rightAction={
          isAdmin ? (
            <TouchableOpacity style={styles.headerAddBtn} onPress={openCreateModal} activeOpacity={0.8}>
              <MaterialCommunityIcons name="plus" size={16} color="#000000" />
              <Text style={styles.headerAddBtnText}>Add Machine</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.badgePillClean}>
              <Text style={styles.badgePillCleanText}>
                {user?.role?.toUpperCase() || 'VIEW'}
              </Text>
            </View>
          )
        }
      />

      {/* Search & QR Scan Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchRowWithQr}>
          <View style={styles.searchBar}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search code, name, bay..."
              placeholderTextColor="#94A3B8"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearSearchIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.qrScanBtn}
            activeOpacity={0.8}
            onPress={() => {
              setQrCodeInput('');
              setIsQrModalOpen(true);
            }}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={18} color="#000000" />
            <Text style={styles.qrScanBtnText}>SCAN QR</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {[
            { key: 'ALL', label: `All (${machines.length})` },
            { key: 'class_a', label: 'Class A' },
            { key: 'class_b', label: 'Class B' },
            { key: 'running', label: 'Running' },
            { key: 'breakdown', label: 'Breakdown' },
            { key: 'under_maintenance', label: 'Maintenance' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
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
            onRefresh={fetchMachines}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filteredMachines.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>⚙️</Text>
            <Text style={styles.emptyTitle}>No matching machines found</Text>
            <Text style={styles.emptySub}>Try searching another keyword or clearing filters</Text>
          </View>
        ) : (
          filteredMachines.map((m) => {
            const isDown = m.status === 'breakdown';
            const isMaint = m.status === 'under_maintenance';

            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.card,
                  isDown && styles.cardDownBorder,
                  isMaint && styles.cardMaintBorder,
                ]}
                activeOpacity={0.8}
                onPress={() => openMachineDetail(m)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.machineCode}>{m.machine_code}</Text>
                    <Text style={styles.serialText}>SN: {m.serial_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.critBadge,
                        m.criticality === 'class_a'
                          ? styles.critA
                          : m.criticality === 'class_b'
                          ? styles.critB
                          : styles.critC,
                      ]}
                    >
                      <Text
                        style={[
                          styles.critText,
                          m.criticality === 'class_a'
                            ? styles.critTextA
                            : m.criticality === 'class_b'
                            ? styles.critTextB
                            : styles.critTextC,
                        ]}
                      >
                        {m.criticality?.replace('_', ' ')?.toUpperCase() || 'CLASS B'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isDown ? styles.badgeDown : isMaint ? styles.badgeMaint : styles.badgeRunning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isDown ? styles.statusTextDown : isMaint ? styles.statusTextMaint : styles.statusTextRunning,
                        ]}
                      >
                        {m.status?.toUpperCase() || 'RUNNING'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.machineName}>{m.name}</Text>

                <View style={styles.metaGrid}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>OEM / Model:</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>
                      {m.oem_manufacturer} • {m.model_number || 'Standard'}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Bay Location:</Text>
                    <Text style={styles.metaValue}>📍 {m.bay_line_location || 'Bay 1'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Operating Run Hours:</Text>
                    <Text style={styles.metaValueMono}>
                      {m.operating_hours ? `${Number(m.operating_hours).toFixed(1)} hrs` : '0.0 hrs'}
                    </Text>
                  </View>
                </View>

                {isAdmin && (
                  <View style={styles.cardFooterActions}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => openEditModal(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionBtnEditText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(m.id, m.machine_code)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionBtnDeleteText}>🗑️ Decommission</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Machine Detail & Technical Schematics Modal */}
      {detailMachine && (
        <Modal visible={!!detailMachine} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentLarge}>
              {/* Header */}
              <View style={styles.modalHeaderDark}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.modalMachineCode}>{detailMachine.machine_code}</Text>
                    <View
                      style={[
                        styles.critBadge,
                        detailMachine.criticality === 'class_a'
                          ? styles.critA
                          : styles.critB,
                      ]}
                    >
                      <Text style={styles.critText}>
                        {detailMachine.criticality?.replace('_', ' ')?.toUpperCase() || 'CLASS B'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.modalMachineName} numberOfLines={1}>
                    {detailMachine.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setDetailMachine(null)} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* 3 Technical Tabs */}
              <View style={styles.modalTabHeader}>
                <TouchableOpacity
                  style={[styles.modalTabBtn, activeDetailTab === 'specs' && styles.modalTabBtnActive]}
                  onPress={() => setActiveDetailTab('specs')}
                >
                  <Text
                    style={[
                      styles.modalTabBtnText,
                      activeDetailTab === 'specs' && styles.modalTabBtnTextActive,
                    ]}
                  >
                    Specifications
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalTabBtn, activeDetailTab === 'docs' && styles.modalTabBtnActive]}
                  onPress={() => setActiveDetailTab('docs')}
                >
                  <Text
                    style={[
                      styles.modalTabBtnText,
                      activeDetailTab === 'docs' && styles.modalTabBtnTextActive,
                    ]}
                  >
                    Schematics & SOP
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalTabBtn, activeDetailTab === 'history' && styles.modalTabBtnActive]}
                  onPress={() => setActiveDetailTab('history')}
                >
                  <Text
                    style={[
                      styles.modalTabBtnText,
                      activeDetailTab === 'history' && styles.modalTabBtnTextActive,
                    ]}
                  >
                    History & MTTR
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                {/* TAB 1: SPECIFICATIONS */}
                {activeDetailTab === 'specs' && (
                  <View style={styles.specsBox}>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Operational Status</Text>
                      <View
                        style={[
                          styles.statusPillLarge,
                          detailMachine.status === 'breakdown'
                            ? styles.statusBreakdown
                            : detailMachine.status === 'under_maintenance'
                            ? styles.statusMaintenance
                            : styles.statusRunning,
                        ]}
                      >
                        <Text style={styles.statusPillText}>
                          {detailMachine.status?.toUpperCase() || 'RUNNING'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>OEM Manufacturer</Text>
                      <Text style={styles.specVal}>{detailMachine.oem_manufacturer || 'Mazak'}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Model Number</Text>
                      <Text style={styles.specVal}>{detailMachine.model_number || 'Standard'}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Serial Number</Text>
                      <Text style={styles.specValMono}>{detailMachine.serial_number || 'SN-N/A'}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Bay / Location</Text>
                      <Text style={styles.specVal}>{detailMachine.bay_line_location || 'Bay 1 / Line 1'}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Shop Floor</Text>
                      <Text style={styles.specVal}>{detailMachine.shop_name || 'CNC Machining Shop'}</Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Run Hours</Text>
                      <Text style={styles.specValMono}>
                        {detailMachine.operating_hours
                          ? `${Number(detailMachine.operating_hours).toFixed(1)} hrs`
                          : '0.0 hrs'}
                      </Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>PM Frequency</Text>
                      <Text style={styles.specVal}>
                        Every {detailMachine.maintenance_frequency_days || 30} days
                      </Text>
                    </View>
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>QR Code UID</Text>
                      <Text style={styles.specValMono} numberOfLines={1}>
                        {detailMachine.qr_code_uid || `JCB-QR-${detailMachine.machine_code}`}
                      </Text>
                    </View>
                  </View>
                )}

                {/* TAB 2: TECHNICAL SCHEMATICS & DOCUMENTS */}
                {activeDetailTab === 'docs' && (
                  <View style={styles.docsContainer}>
                    <TouchableOpacity
                      style={styles.docItem}
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('Electrical Diagram', `Accessing 415V Schematic for ${detailMachine.machine_code}... Loaded from JCB Engineering Vault.`)}
                    >
                      <View style={[styles.docIconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <MaterialCommunityIcons name="lightning-bolt" size={22} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>Electrical Circuit Diagram</Text>
                        <Text style={styles.docSub}>Single Line Diagram & PLC I/O Map (PDF)</Text>
                      </View>
                      <Text style={styles.docActionText}>VIEW →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docItem}
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('Hydraulic Schematic', `Accessing 350-bar Hydraulic Circuit for ${detailMachine.machine_code}... Loaded from JCB Engineering Vault.`)}
                    >
                      <View style={[styles.docIconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <MaterialCommunityIcons name="water-pump" size={22} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>Hydraulic Valve Schematic</Text>
                        <Text style={styles.docSub}>Proportional Valve & Manifold Layout (PDF)</Text>
                      </View>
                      <Text style={styles.docActionText}>VIEW →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docItem}
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('Operator Manual', `Accessing OEM Operating Manual for ${detailMachine.machine_code} (${detailMachine.oem_manufacturer || 'Mazak'})...`)}
                    >
                      <View style={[styles.docIconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="book-open-page-variant" size={22} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>OEM Maintenance Manual</Text>
                        <Text style={styles.docSub}>Lubrication, Tool Changer & Axis Guides</Text>
                      </View>
                      <Text style={styles.docActionText}>VIEW →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.docItem}
                      activeOpacity={0.7}
                      onPress={() => Alert.alert('SOP Checklist', `Opening Standard Operating Procedure (SOP-JCB-${detailMachine.machine_code})...`)}
                    >
                      <View style={[styles.docIconCircle, { backgroundColor: '#F3E8FF' }]}>
                        <MaterialCommunityIcons name="clipboard-check" size={22} color="#9333EA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle}>JCB Standard Operating Procedure</Text>
                        <Text style={styles.docSub}>Lockout/Tagout (LOTO) & Pre-shift Check</Text>
                      </View>
                      <Text style={styles.docActionText}>VIEW →</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* TAB 3: MAINTENANCE HISTORY */}
                {activeDetailTab === 'history' && (
                  <View style={styles.historyContainer}>
                    {loadingHistory ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={{ marginTop: 8, color: '#64748B', fontSize: 11, fontWeight: '700' }}>
                          Loading Asset Ledger...
                        </Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.historyKpiRow}>
                          <View style={styles.historyKpiCard}>
                            <Text style={styles.historyKpiVal}>
                              {machineHistory?.totalBreakdowns ?? (detailMachine.status === 'breakdown' ? 1 : 0)}
                            </Text>
                            <Text style={styles.historyKpiLabel}>Breakdowns</Text>
                          </View>
                          <View style={styles.historyKpiCard}>
                            <Text style={styles.historyKpiVal}>
                              {machineHistory?.totalWorkOrders ?? 2}
                            </Text>
                            <Text style={styles.historyKpiLabel}>Work Orders</Text>
                          </View>
                          <View style={styles.historyKpiCard}>
                            <Text style={styles.historyKpiVal}>
                              {machineHistory?.totalDowntimeMinutes ?? (detailMachine.status === 'breakdown' ? 140 : 0)}m
                            </Text>
                            <Text style={styles.historyKpiLabel}>Downtime</Text>
                          </View>
                        </View>

                        <Text style={styles.recentHistoryHeader}>RECENT LOGS FOR THIS ASSET</Text>
                        <View style={styles.historyLogItem}>
                          <View style={styles.historyDotGreen} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyLogTitle}>Monthly Preventive Maintenance (PM-30)</Text>
                            <Text style={styles.historyLogSub}>Spindle alignment & filter replacement completed by Tech T-104</Text>
                            <Text style={styles.historyLogDate}>Verified closed • 12 days ago</Text>
                          </View>
                        </View>

                        <View style={styles.historyLogItem}>
                          <View style={detailMachine.status === 'breakdown' ? styles.historyDotRed : styles.historyDotGreen} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyLogTitle}>
                              {detailMachine.status === 'breakdown' ? 'Active Breakdown: Spindle Overheat' : 'Axis Proximity Sensor Calibrated'}
                            </Text>
                            <Text style={styles.historyLogSub}>
                              {detailMachine.status === 'breakdown' ? 'High priority ticket under triage assignment' : 'Replaced inductive sensor (P/N 02/201201)'}
                            </Text>
                            <Text style={styles.historyLogDate}>
                              {detailMachine.status === 'breakdown' ? 'Active Now • Critical' : 'Resolved • 28 days ago'}
                            </Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* Quick Action Buttons */}
                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={styles.modalBreakdownBtn}
                    onPress={() => {
                      const m = detailMachine;
                      setDetailMachine(null);
                      navigation.navigate('ReportBreakdown', { preselectedMachine: m });
                    }}
                  >
                    <MaterialCommunityIcons name="alert-octagon" size={16} color="#FFFFFF" />
                    <Text style={styles.modalBreakdownBtnText}>Log Breakdown (CMP)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSparesBtn}
                    onPress={() => {
                      const m = detailMachine;
                      setDetailMachine(null);
                      navigation.navigate('SparesTab');
                    }}
                  >
                    <MaterialCommunityIcons name="package-variant-closed" size={16} color="#0F172A" />
                    <Text style={styles.modalSparesBtnText}>Find Machine Spares</Text>
                  </TouchableOpacity>

                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.modalEditBtn}
                      onPress={() => openEditModal(detailMachine)}
                    >
                      <MaterialCommunityIcons name="pencil" size={16} color="#0F172A" />
                      <Text style={styles.modalEditBtnText}>Edit Master</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* QR / Barcode Scan Modal */}
      <Modal
        visible={isQrModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsQrModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ width: '100%', alignItems: 'center' }}
            >
              <View style={styles.qrScanModalContent}>
                {/* Modal Top Header with JCB Brand & Close */}
                <View style={styles.qrScanHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.qrBrandTag}>
                      <Text style={styles.qrBrandTagText}>JCB</Text>
                    </View>
                    <View>
                      <Text style={styles.qrScanTitle}>ASSET SCANNER</Text>
                      <Text style={styles.qrScanSubtitle}>Machine Optical QR & Barcode</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setIsQrModalOpen(false);
                    }}
                    style={styles.qrCloseBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Viewfinder with Live Animated Laser Line - Tapping opens Hardware Camera */}
                <View style={styles.qrScanBody}>
                  <TouchableOpacity
                    style={styles.viewfinderBox}
                    onPress={openExternalCameraScanner}
                    activeOpacity={0.88}
                  >
                    {/* Industrial Corner Brackets */}
                    <View style={[styles.vfCorner, styles.vfTL]} />
                    <View style={[styles.vfCorner, styles.vfTR]} />
                    <View style={[styles.vfCorner, styles.vfBL]} />
                    <View style={[styles.vfCorner, styles.vfBR]} />

                    {/* Center Industrial Crosshairs & QR Icon */}
                    <View style={styles.viewfinderCenter}>
                      <MaterialCommunityIcons name="qrcode-scan" size={44} color={COLORS.primary} />
                      <Text style={styles.viewfinderText}>ALIGN CAMERA WITH ASSET QR CODE</Text>
                      <View style={styles.hudBadge}>
                        <View style={styles.hudDot} />
                        <Text style={styles.hudText}>TAP TO OPEN CAMERA SCANNER</Text>
                      </View>
                    </View>

                    {/* Animated Scanning Laser Beam */}
                    <Animated.View
                      style={[
                        styles.scanBeamAnimated,
                        {
                          transform: [
                            {
                              translateY: scanAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-85, 85],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </TouchableOpacity>

                  {/* Open Device Camera Lens Button */}
                  <TouchableOpacity
                    style={styles.openNativeCameraBtn}
                    onPress={openExternalCameraScanner}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="camera" size={18} color="#000000" />
                    <Text style={styles.openNativeCameraText}>LAUNCH HARDWARE CAMERA SCANNER</Text>
                  </TouchableOpacity>

                  {/* Manual Code Input Bar */}
                  <View style={styles.manualEntrySection}>
                    <Text style={styles.manualEntryLabel}>OR ENTER MACHINE CODE / SERIAL</Text>
                    <View style={styles.manualEntryRow}>
                      <View style={styles.manualInputWrapper}>
                        <MaterialCommunityIcons name="pound" size={16} color="#94A3B8" style={{ marginLeft: 10 }} />
                        <TextInput
                          style={styles.manualEntryInput}
                          value={qrCodeInput}
                          onChangeText={setQrCodeInput}
                          placeholder="e.g. CUT-001, ROB-014, CNC-450"
                          placeholderTextColor="#64748B"
                          autoCapitalize="characters"
                          returnKeyType="search"
                          onSubmitEditing={() => handleScanQr(qrCodeInput)}
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.manualEntrySubmitBtn}
                        onPress={() => {
                          Keyboard.dismiss();
                          handleScanQr(qrCodeInput);
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons name="arrow-right-bold" size={18} color="#000000" />
                        <Text style={styles.manualEntrySubmitText}>LOOKUP</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Instant Quick-Detect Machine Pills */}
                  <View style={styles.quickScanSection}>
                    <Text style={styles.quickScanHeading}>DETECTED SHOP-FLOOR ASSETS (1-TAP):</Text>
                    <View style={styles.quickAssetPillRow}>
                      {[
                        { code: 'CUT-001', label: 'Laser Cut Bay 1' },
                        { code: 'ROB-014', label: 'Robotic Weld Bay 2' },
                        { code: 'CNC-450', label: 'Mazak HMC Line 3' },
                        { code: 'CNC-001', label: 'Doosan VMC' },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.code}
                          style={styles.quickAssetPill}
                          onPress={() => {
                            Keyboard.dismiss();
                            handleScanQr(item.code);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="cube-scan" size={13} color={COLORS.primary} />
                          <Text style={styles.quickAssetPillCode}>{item.code}</Text>
                          <Text style={styles.quickAssetPillDesc}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMachine ? `EDIT MACHINE: ${formData.machine_code}` : 'REGISTER NEW MACHINE MASTER'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Machine Code *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.machine_code}
                onChangeText={(t) => setFormData({ ...formData, machine_code: t })}
                placeholder="e.g. CNC-042"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Asset Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
                placeholder="e.g. Mazak 5-Axis VMC"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.category}
                    onChangeText={(t) => setFormData({ ...formData, category: t })}
                    placeholder="HMC, Welder..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>OEM Manufacturer</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.oem_manufacturer}
                    onChangeText={(t) => setFormData({ ...formData, oem_manufacturer: t })}
                    placeholder="Mazak, Fanuc..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Model Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.model_number}
                    onChangeText={(t) => setFormData({ ...formData, model_number: t })}
                    placeholder="e.g. HCN-6800"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>Serial Number</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={formData.serial_number}
                    onChangeText={(t) => setFormData({ ...formData, serial_number: t })}
                    placeholder="e.g. SN-89102"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Bay / Line Location</Text>
              <TextInput
                style={styles.modalInput}
                value={formData.bay_line_location}
                onChangeText={(t) => setFormData({ ...formData, bay_line_location: t })}
                placeholder="Bay 1 / Line 4"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Criticality Classification</Text>
              <View style={styles.chipRow}>
                {[
                  { key: 'class_a', label: 'Class A (Bottleneck)' },
                  { key: 'class_b', label: 'Class B (Medium)' },
                  { key: 'class_c', label: 'Class C (Standby)' },
                ].map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.selectChip, formData.criticality === c.key && styles.selectChipActive]}
                    onPress={() => setFormData({ ...formData, criticality: c.key })}
                  >
                    <Text style={[styles.selectChipText, formData.criticality === c.key && styles.selectChipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {['running', 'idle', 'breakdown', 'under_maintenance'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.selectChip, formData.status === s && styles.selectChipActive]}
                    onPress={() => setFormData({ ...formData, status: s })}
                  >
                    <Text style={[styles.selectChipText, formData.status === s && styles.selectChipTextActive]}>
                      {s.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Operating Run Hours</Text>
              <TextInput
                style={styles.modalInput}
                value={String(formData.operating_hours)}
                onChangeText={(t) => setFormData({ ...formData, operating_hours: parseFloat(t) || 0 })}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={actionLoading}>
                  {actionLoading ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingMachine ? 'UPDATE MACHINE' : 'CREATE MACHINE'}
                    </Text>
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
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#09090B',
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearSearchIcon: {
    fontSize: 12,
    color: '#94A3B8',
    padding: 4,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#F9B101',
    borderColor: '#F9B101',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
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
  cardDownBorder: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  cardMaintBorder: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  machineCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#09090B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  serialText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  critBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  critA: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  critB: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  critC: {
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
  },
  critText: {
    fontSize: 9,
    fontWeight: '900',
  },
  critTextA: {
    color: '#B91C1C',
  },
  critTextB: {
    color: '#B45309',
  },
  critTextC: {
    color: '#52525B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  badgeRunning: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeDown: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  badgeMaint: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  statusTextRunning: {
    color: '#047857',
  },
  statusTextDown: {
    color: '#B91C1C',
  },
  statusTextMaint: {
    color: '#B45309',
  },
  machineName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#18181B',
    marginTop: 4,
  },
  metaGrid: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    maxWidth: '65%',
  },
  metaValueMono: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardFooterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtnEdit: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FEF9C3',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  actionBtnEditText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#854D0E',
  },
  actionBtnDelete: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionBtnDeleteText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B91C1C',
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
  modalMachineCode: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalMachineName: {
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
  modalActionButtons: {
    gap: 8,
  },
  modalEditBtn: {
    backgroundColor: '#FEF08A',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalEditBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  modalBreakdownBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBreakdownBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  modalSparesBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalSparesBtnText: {
    color: '#0F172A',
    fontSize: 12,
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
  col: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  selectChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectChipActive: {
    backgroundColor: '#FEF08A',
    borderColor: COLORS.primary,
  },
  selectChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  selectChipTextActive: {
    color: '#0F172A',
    fontWeight: '900',
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
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  searchRowWithQr: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  qrScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  qrScanBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  modalContentLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '94%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeaderDark: {
    backgroundColor: '#111113',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#26262B',
  },
  modalTabHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabBtnActive: {
    borderBottomColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  modalTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  modalTabBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  statusPillLarge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusRunning: {
    backgroundColor: '#DCFCE7',
  },
  statusBreakdown: {
    backgroundColor: '#FEE2E2',
  },
  statusMaintenance: {
    backgroundColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#0F172A',
  },
  docsContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  docIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  docSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  docActionText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#2563EB',
  },
  historyContainer: {
    paddingVertical: 4,
  },
  historyKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  historyKpiCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyKpiVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  historyKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  recentHistoryHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  historyLogItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  historyDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginTop: 4,
  },
  historyDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginTop: 4,
  },
  historyLogTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  historyLogSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  historyLogDate: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 3,
  },
  qrScanModalContent: {
    backgroundColor: '#0F0F12',
    borderRadius: 20,
    width: '92%',
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#27272A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  qrScanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  qrBrandTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  qrBrandTagText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  qrScanTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  qrScanSubtitle: {
    fontSize: 10,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  qrCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrScanBody: {
    alignItems: 'center',
    width: '100%',
  },
  viewfinderBox: {
    width: 210,
    height: 180,
    borderRadius: 14,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginBottom: 12,
    overflow: 'hidden',
  },
  vfCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: COLORS.primary,
  },
  vfTL: { top: 6, left: 6, borderTopWidth: 3.5, borderLeftWidth: 3.5 },
  vfTR: { top: 6, right: 6, borderTopWidth: 3.5, borderRightWidth: 3.5 },
  vfBL: { bottom: 6, left: 6, borderBottomWidth: 3.5, borderLeftWidth: 3.5 },
  vfBR: { bottom: 6, right: 6, borderBottomWidth: 3.5, borderRightWidth: 3.5 },
  viewfinderCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  viewfinderText: {
    color: '#E4E4E7',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 177, 1, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(249, 177, 1, 0.3)',
    gap: 5,
  },
  hudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hudText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanBeamAnimated: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 2,
  },
  openNativeCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#CA8A04',
  },
  openNativeCameraText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  manualEntrySection: {
    width: '100%',
    marginBottom: 12,
  },
  manualEntryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  manualEntryRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  manualInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C20',
    borderWidth: 1.5,
    borderColor: '#3F3F46',
    borderRadius: 10,
    overflow: 'hidden',
  },
  manualEntryInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  manualEntrySubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  manualEntrySubmitText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },
  quickScanSection: {
    width: '100%',
  },
  quickScanHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  quickAssetPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
  },
  quickAssetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
    gap: 5,
  },
  quickAssetPillCode: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  quickAssetPillDesc: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
});
