import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const DowntimeAnalyticsScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const sidebar = useSidebar();

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Time & Search Filter
  const [timeRange, setTimeRange] = useState('LIVE_TODAY');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/downtime');
      if (res?.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (e) {
      console.warn('Failed to load downtime analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalDowntime = analytics?.summary?.total_downtime_minutes || 1;

  // Filtered Pareto Machines
  const filteredMachines = useMemo(() => {
    const list = analytics?.paretoTopMachines || [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (m: any) =>
        (m.machine_code && m.machine_code.toLowerCase().includes(q)) ||
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.shop_name && m.shop_name.toLowerCase().includes(q))
    );
  }, [analytics, searchQuery]);

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={styles.container}>
      <AppHeader
        title="Downtime & Analytics"
        icon="chart-timeline-variant"
        sectionTitle="Plant Downtime & Reliability"
        sectionSubtitle="MTTR, MTBF availability & 80/20 root cause analysis"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
      />

      {/* Time Period Filter Chips */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {[
            { id: 'LIVE_TODAY', label: '🔴 Live Today' },
            { id: 'SHIFT_A', label: 'Shift A' },
            { id: 'SHIFT_B', label: 'Shift B' },
            { id: 'LAST_7D', label: 'Last 7 Days' },
            { id: 'LAST_30D', label: 'Last 30 Days' },
          ].map((chip) => {
            const active = timeRange === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setTimeRange(chip.id)}
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

      <ScrollView
        contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchAnalytics}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Total Machine Downtime</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
                {analytics?.summary?.total_downtime_minutes || 0}
              </Text>
              <Text style={styles.kpiUnit}>Mins</Text>
            </View>
            <Text style={styles.kpiDesc}>Stoppage to verified line restart</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>MTTR (Active Repair)</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
                {Math.round(parseFloat(analytics?.summary?.mttr_active_wrench_minutes || 0))}
              </Text>
              <Text style={styles.kpiUnit}>Mins</Text>
            </View>
            <Text style={styles.kpiDesc}>Technician arrival to repair sign-off</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Response Delay</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.kpiValue, { color: '#B45309' }]}>
                {Math.round(parseFloat(analytics?.summary?.avg_response_delay_minutes || 0))}
              </Text>
              <Text style={styles.kpiUnit}>Mins</Text>
            </View>
            <Text style={styles.kpiDesc}>Report logged to technician assignment</Text>
          </View>
        </View>

        {/* Pareto 80/20 Section Header */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Top Bottleneck Machines (Pareto 80/20)</Text>
            <Text style={styles.sectionSubtitle}>
              Assets causing the majority of plant production loss
            </Text>
          </View>
        </View>

        {/* Search Input for Pareto */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter machines by code or name..."
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

        {/* Pareto List */}
        {filteredMachines.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={36} color="#10B981" />
            <Text style={styles.emptyTitle}>Zero Production Bottlenecks</Text>
            <Text style={styles.emptySubtitle}>All plant equipment is running nominally within target OEE</Text>
          </View>
        ) : (
          filteredMachines.map((m: any, index: number) => {
            const lostMins = m.total_downtime_minutes || 0;
            const percentage = Math.min(
              100,
              Math.round((lostMins / Math.max(totalDowntime, 1)) * 100)
            );

            return (
              <View key={m.id || index} style={styles.machineCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.machineInfoRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.machineCode}>{m.machine_code || 'ASSET'}</Text>
                      <Text style={styles.machineName}>{m.name || 'Machine'}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.criticalityBadge,
                      m.criticality === 'class_a' ? styles.badgeClassA : styles.badgeClassB,
                    ]}
                  >
                    <Text
                      style={[
                        styles.criticalityText,
                        m.criticality === 'class_a' ? styles.textClassA : styles.textClassB,
                      ]}
                    >
                      {m.criticality?.replace('_', ' ')?.toUpperCase() || 'CLASS A'}
                    </Text>
                  </View>
                </View>

                {/* Sub details: Shop and Breakdown count */}
                <View style={styles.metaRow}>
                  <Text style={styles.shopText}>Shop: {m.shop_name || 'CNC Fabrication'}</Text>
                  <Text style={styles.metaDivider}>•</Text>
                  <Text style={styles.failureCount}>{m.failure_count || 1} Breakdowns</Text>
                </View>

                {/* Impact Bar */}
                <View style={styles.impactContainer}>
                  <View style={styles.impactHeader}>
                    <Text style={styles.impactLabel}>Downtime Share</Text>
                    <Text style={styles.impactPercent}>{percentage}% of Plant Loss</Text>
                  </View>
                  <View style={styles.impactTrack}>
                    <View
                      style={[
                        styles.impactFill,
                        {
                          width: `${percentage}%`,
                          backgroundColor: percentage > 35 ? '#DC2626' : COLORS.primary,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Card Bottom: Total lost time */}
                <View style={styles.cardFooter}>
                  <Text style={styles.footerLabel}>Total Lost Production:</Text>
                  <Text style={styles.footerValue}>{lostMins} Mins</Text>
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
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chipsScroll: {
    marginTop: 2,
  },
  filterChip: {
    backgroundColor: '#F1F5F9',
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
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  kpiContainer: {
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  kpiUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  kpiDesc: {
    fontSize: 11,
    color: '#94A3B8',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
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
    marginBottom: 12,
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
  machineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  machineInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
  },
  machineCode: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  machineName: {
    fontSize: 11.5,
    color: '#64748B',
  },
  criticalityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeClassA: {
    backgroundColor: '#FEF2F2',
  },
  badgeClassB: {
    backgroundColor: '#FFFBEB',
  },
  criticalityText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  textClassA: {
    color: '#DC2626',
  },
  textClassB: {
    color: '#B45309',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  shopText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  metaDivider: {
    color: '#CBD5E1',
    fontSize: 10,
  },
  failureCount: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  impactContainer: {
    marginBottom: 10,
  },
  impactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
  },
  impactPercent: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  impactTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  impactFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  footerLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  footerValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
});
