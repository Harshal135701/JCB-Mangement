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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const UserManagementScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const isAdmin = user?.role === 'admin';

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    role: 'technician',
    department: 'Mechanical Maintenance',
    designation: 'Senior Maintenance Technician',
    shift: 'Shift A',
    password: 'password123',
    is_active: true,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/auth/users');
      if (res?.success && res.data) {
        setUsersList(res.data);
      }
    } catch (e) {
      console.warn('Failed to load users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = (presetRole: string = 'technician') => {
    setEditingUser(null);
    const prefix =
      presetRole === 'technician'
        ? 'TCH'
        : presetRole === 'operator'
        ? 'OPR'
        : presetRole === 'store_manager'
        ? 'STM'
        : presetRole === 'manager'
        ? 'MGR'
        : 'ADM';
    setFormData({
      employee_code: `JCB-${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      email: '',
      phone: '',
      role: presetRole,
      department:
        presetRole === 'operator'
          ? 'Production Operations'
          : presetRole === 'store_manager'
          ? 'Central Stores & Inventory'
          : 'Mechanical Maintenance',
      designation:
        presetRole === 'technician'
          ? 'Maintenance Technician'
          : presetRole === 'operator'
          ? 'CNC Line Operator'
          : presetRole === 'store_manager'
          ? 'Store Manager'
          : 'Maintenance Engineer',
      shift: 'Shift A',
      password: 'password123',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setFormData({
      employee_code: u.employee_code,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone || '',
      role: u.role,
      department: u.department || 'Mechanical Maintenance',
      designation: u.designation || 'Technician',
      shift: u.shift || 'Shift A',
      password: '',
      is_active: u.is_active !== false,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.employee_code || !formData.full_name.trim() || !formData.email.trim()) {
      Alert.alert('Required', 'Please fill employee ID, full name, and email.');
      return;
    }

    try {
      setActionLoading(true);
      if (editingUser) {
        const res: any = await apiClient.put(`/auth/users/${editingUser.id}`, formData);
        if (res?.success) {
          Alert.alert('Success', `Personnel ${formData.full_name} updated successfully.`);
          setIsModalOpen(false);
          fetchUsers();
        }
      } else {
        const res: any = await apiClient.post('/auth/users', formData);
        if (res?.success) {
          Alert.alert(
            'Enrolled',
            `Personnel ${formData.full_name} (${formData.employee_code}) enrolled successfully.`
          );
          setIsModalOpen(false);
          fetchUsers();
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Operation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = (id: string, name: string) => {
    Alert.alert(
      'Confirm Deactivate',
      `Are you sure you want to deactivate ${name}? They will no longer be able to log in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await apiClient.delete(`/auth/users/${id}`);
              if (res?.success) {
                Alert.alert('Status Updated', res.message || `${name} deactivated.`);
                fetchUsers();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update user status.');
            }
          },
        },
      ]
    );
  };

  const filtered = useMemo(() => {
    return usersList.filter((u) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.employee_code && u.employee_code.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.department && u.department.toLowerCase().includes(q)) ||
        (u.designation && u.designation.toLowerCase().includes(q));

      const matchesRole = selectedRole === 'all' || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [usersList, search, selectedRole]);

  const techCount = usersList.filter((u) => u.role === 'technician').length;
  const oprCount = usersList.filter((u) => u.role === 'operator').length;
  const mgrCount = usersList.filter((u) => u.role === 'manager').length;

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Plant Personnel"
        icon="account-group-outline"
        sectionTitle="User Management & Access"
        sectionSubtitle="Operators, technicians & line managers roster"
        showBack={canGoBack}
        onBack={() => navigation.goBack()}
        rightAction={
          isAdmin ? (
            <TouchableOpacity
              style={styles.addUserBtn}
              onPress={() => openCreateModal('technician')}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="account-plus" size={16} color="#000000" />
              <Text style={styles.addUserBtnText}>Enroll</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* KPI Stats Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{usersList.length}</Text>
          <Text style={styles.kpiLabel}>Total</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{techCount}</Text>
          <Text style={styles.kpiLabel}>Techs</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#047857' }]}>{oprCount}</Text>
          <Text style={styles.kpiLabel}>Operators</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#7C3AED' }]}>{mgrCount}</Text>
          <Text style={styles.kpiLabel}>Managers</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Name, ID, Department, Email..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {['all', 'technician', 'operator', 'store_manager', 'manager', 'admin'].map((role) => {
            const active = selectedRole === role;
            return (
              <TouchableOpacity
                key={role}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedRole(role)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {role === 'all'
                    ? 'All Roles'
                    : role === 'store_manager'
                    ? 'STORE MANAGER'
                    : role.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Staff List */}
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchUsers}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="account-search" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Personnel Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search query or role filter</Text>
          </View>
        ) : (
          filtered.map((u) => {
            const roleColor =
              u.role === 'admin'
                ? '#DC2626'
                : u.role === 'manager'
                ? '#7C3AED'
                : u.role === 'store_manager'
                ? '#D97706'
                : u.role === 'operator'
                ? '#047857'
                : '#2563EB';

            const roleBg =
              u.role === 'admin'
                ? '#FEF2F2'
                : u.role === 'manager'
                ? '#F5F3FF'
                : u.role === 'store_manager'
                ? '#FEF3C7'
                : u.role === 'operator'
                ? '#ECFDF5'
                : '#EFF6FF';

            return (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userTopRow}>
                  {/* Avatar */}
                  <View style={[styles.avatarBox, { backgroundColor: roleBg }]}>
                    <Text style={[styles.avatarText, { color: roleColor }]}>
                      {(u.full_name || 'U')[0].toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName}>{u.full_name}</Text>
                      <View style={[styles.roleBadge, { backgroundColor: roleBg }]}>
                        <Text style={[styles.roleText, { color: roleColor }]}>
                          {(u.role || 'USER').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.empCode}>{u.employee_code}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.detailsBox}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="briefcase-outline" size={14} color="#64748B" />
                    <Text style={styles.detailText}>{u.designation || 'Staff'} • {u.department || 'Plant'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="email-outline" size={14} color="#64748B" />
                    <Text style={styles.detailText}>{u.email}</Text>
                  </View>
                  {u.shift && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="clock-time-four-outline" size={14} color="#64748B" />
                      <Text style={styles.detailText}>{u.shift}</Text>
                    </View>
                  )}
                </View>

                {/* Actions for Admin */}
                {isAdmin && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEditModal(u)}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={14} color="#0F172A" />
                      <Text style={styles.editBtnText}>Edit Details</Text>
                    </TouchableOpacity>

                    {u.is_active !== false ? (
                      <TouchableOpacity
                        style={styles.deactivateBtn}
                        onPress={() => handleDeactivate(u.id, u.full_name)}
                      >
                        <MaterialCommunityIcons name="account-cancel-outline" size={14} color="#DC2626" />
                        <Text style={styles.deactivateBtnText}>Deactivate</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveText}>Deactivated</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Enroll / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingUser ? 'Edit Personnel' : 'Enroll New Personnel'}
                </Text>
                <Text style={styles.modalSubtitle}>Manage role, credentials and assignments</Text>
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
              <Text style={styles.inputLabel}>Employee Code *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.employee_code}
                onChangeText={(t) => setFormData({ ...formData, employee_code: t })}
                placeholder="e.g. JCB-TCH-101"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.full_name}
                onChangeText={(t) => setFormData({ ...formData, full_name: t })}
                placeholder="First and last name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.email}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
                placeholder="email@jcb.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                placeholder="+91 9876543210"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Role Designation</Text>
              <View style={styles.roleSelectGrid}>
                {['technician', 'operator', 'store_manager', 'manager', 'admin'].map((r) => {
                  const selected = formData.role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleSelectChip, selected && styles.roleSelectChipActive]}
                      onPress={() => setFormData({ ...formData, role: r })}
                    >
                      <Text style={[styles.roleSelectText, selected && styles.roleSelectTextActive]}>
                        {r === 'store_manager' ? 'STORE' : r.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput
                style={styles.textInput}
                value={formData.department}
                onChangeText={(t) => setFormData({ ...formData, department: t })}
                placeholder="e.g. Mechanical Maintenance"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Shift Assignment</Text>
              <View style={styles.shiftRow}>
                {['Shift A', 'Shift B', 'Shift C'].map((s) => {
                  const selected = formData.shift === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.shiftChip, selected && styles.shiftChipActive]}
                      onPress={() => setFormData({ ...formData, shift: s })}
                    >
                      <Text style={[styles.shiftChipText, selected && styles.shiftChipTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!editingUser && (
                <>
                  <Text style={styles.inputLabel}>Default Password</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.password}
                    onChangeText={(t) => setFormData({ ...formData, password: t })}
                    placeholder="password123"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                  />
                </>
              )}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingUser ? 'Save Changes' : 'Enroll Personnel'}
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
  addUserBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addUserBtnText: {
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
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  userTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  empCode: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deactivateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  inactiveBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inactiveText: {
    fontSize: 10.5,
    color: '#94A3B8',
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
  roleSelectGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  roleSelectChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleSelectChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleSelectText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  roleSelectTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  shiftRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shiftChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  shiftChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  shiftChipTextActive: {
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
