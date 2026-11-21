import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const AuditLogsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const sidebar = useSidebar();

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('ALL');

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/audit');
      if (res?.success && res.data) {
        setLogs(res.data);
      }
    } catch (e) {
      console.warn('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.performed_by_name && log.performed_by_name.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q));

      const matchesEntity =
        entityFilter === 'ALL' ||
        log.entity_name?.toLowerCase() === entityFilter.toLowerCase();

      return matchesSearch && matchesEntity;
    });
  }, [logs, searchQuery, entityFilter]);

  // Dynamic KPI counts
  const kpiStats = useMemo(() => {
    const total = logs.length;
    const machines = logs.filter((l) => l.entity_name === 'machine').length;
    const workOrders = logs.filter((l) => l.entity_name === 'work_order').length;
    const inventory = logs.filter((l) => l.entity_name === 'inventory').length;
    return { total, machines, workOrders, inventory };
  }, [logs]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Audit Trail"
        icon="shield-check-outline"
        sectionTitle="Audit & Security Ledger"
        sectionSubtitle="Immutable ISO 9001 compliance activity trail"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
        rightAction={
          <View style={styles.isoBadge}>
            <Text style={styles.isoBadgeText}>ISO 9001</Text>
          </View>
        }
      />

      {/* KPI Stats Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{kpiStats.total}</Text>
          <Text style={styles.kpiLabel}>Total Logs</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#2563EB' }]}>{kpiStats.machines}</Text>
          <Text style={styles.kpiLabel}>Machines</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#B45309' }]}>{kpiStats.workOrders}</Text>
          <Text style={styles.kpiLabel}>Orders</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, { color: '#047857' }]}>{kpiStats.inventory}</Text>
          <Text style={styles.kpiLabel}>Spares</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search action, user, entity, IP..."
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
            { id: 'ALL', label: 'All Events' },
            { id: 'machine', label: 'Machines' },
            { id: 'work_order', label: 'Work Orders' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'procurement', label: 'Procurement' },
            { id: 'auth', label: 'Auth & Access' },
          ].map((chip) => {
            const active = entityFilter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setEntityFilter(chip.id)}
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

      {/* Main Audit Logs List */}
      <ScrollView
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAudit}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="file-document-outline" size={36} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No Audit Records Found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search terms or entity filters</Text>
          </View>
        ) : (
          filteredLogs.map((log) => {
            const action = (log.action || 'EVENT').toUpperCase();
            const dateStr = log.created_at
              ? new Date(log.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent';

            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionText}>{action}</Text>
                  </View>
                  <Text style={styles.timeText}>{dateStr}</Text>
                </View>

                {/* Entity info */}
                <View style={styles.entityRow}>
                  <MaterialCommunityIcons
                    name={
                      log.entity_name === 'machine'
                        ? 'robot-industrial'
                        : log.entity_name === 'work_order'
                        ? 'wrench'
                        : log.entity_name === 'inventory'
                        ? 'package-variant-closed'
                        : 'shield-account'
                    }
                    size={16}
                    color="#0F172A"
                  />
                  <Text style={styles.entityText}>
                    {log.entity_name?.toUpperCase() || 'SYSTEM'} #{log.entity_id ? log.entity_id.slice(0, 8) : ''}
                  </Text>
                </View>

                {/* Performed by & IP */}
                <View style={styles.performedRow}>
                  <MaterialCommunityIcons name="account-check" size={14} color="#64748B" />
                  <Text style={styles.performedText}>
                    By: <Text style={styles.performerName}>{log.performed_by_name || 'System Auto'}</Text>
                  </Text>
                  {log.ip_address && (
                    <>
                      <Text style={styles.dotDivider}>•</Text>
                      <Text style={styles.ipText}>{log.ip_address}</Text>
                    </>
                  )}
                </View>
              </View>
            );
          })
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
  isoBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  isoBadgeText: {
    color: '#047857',
    fontSize: 11,
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
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
  },
  timeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  entityText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  performedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performedText: {
    fontSize: 11,
    color: '#64748B',
  },
  performerName: {
    color: '#0F172A',
    fontWeight: '700',
  },
  dotDivider: {
    color: '#CBD5E1',
    fontSize: 10,
  },
  ipText: {
    fontSize: 10.5,
    color: '#94A3B8',
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
});
