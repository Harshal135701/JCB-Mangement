import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');

export const WorkOrdersScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS'>('ALL');

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/work-orders');
      if (res.success && res.data) {
        setWorkOrders(res.data);
      }
    } catch (e) {
      console.warn('WO fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const filteredOrders = workOrders.filter((wo) => {
    if (activeTab === 'ASSIGNED') return wo.status === 'assigned';
    if (activeTab === 'IN_PROGRESS') return wo.status === 'in_progress';
    return true;
  });

  const assignedCount = workOrders.filter((wo) => wo.status === 'assigned').length;
  const inProgressCount = workOrders.filter((wo) => wo.status === 'in_progress').length;

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerYellowSlice} />

        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.hamburgerBtn}
            onPress={openSidebar}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="menu" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.brandBadgeWrap}>
            <Image
              source={JCB_OFFICIAL_BADGE}
              style={styles.headerJcbLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.headerDivider} />

          <View style={styles.headerTitleCol}>
            <Text style={styles.smartCmmsTitle}>SMART CMMS</Text>
            <Text style={styles.smartCmmsSub}>JCB Intelligent Work</Text>
          </View>
        </View>

        <View style={styles.headerRightRow}>
          <TouchableOpacity
            style={styles.scanQrBtn}
            onPress={() => navigation.navigate('MachinesTab')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="qrcode-scan" size={15} color="#000000" />
            <Text style={styles.scanQrText}>Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.userProfileChip}
            onPress={openSidebar}
            activeOpacity={0.8}
          >
            <View style={styles.userAvatarCircle}>
              <MaterialCommunityIcons name="account" size={18} color="#0F172A" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchWorkOrders}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Section Title Header */}
        <View style={styles.sectionTitleBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.yellowIndicatorBar} />
            <Text style={styles.sectionMainTitle}>Technician Workbench</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Overview of assigned repair orders & field maintenance
          </Text>
        </View>

        {/* 4 Metric Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Assigned Work Orders */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="wrench-clock" size={20} color="#000000" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{assignedCount || 3}</Text>
              <Text style={styles.kpiLabelText}>Assigned Orders</Text>
              <Text style={styles.trendPositiveText}>↑ 1.5%</Text>
            </View>
          </View>

          {/* In Progress */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="play-circle-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{inProgressCount || 1}</Text>
              <Text style={styles.kpiLabelText}>In Progress</Text>
              <Text style={styles.trendPositiveText}>Active Wrench</Text>
            </View>
          </View>

          {/* Active Breakdowns */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('TriageTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={[styles.kpiValueText, { color: '#EF4444' }]}>{workOrders.length || 2}</Text>
              <Text style={styles.kpiLabelText}>Open Tickets</Text>
              <Text style={styles.trendNegativeText}>Urgent</Text>
            </View>
          </TouchableOpacity>

          {/* Spares Inventory */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('SparesTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={[styles.kpiValueText, { color: '#8B5CF6' }]}>142</Text>
              <Text style={styles.kpiLabelText}>Spares in Stock</Text>
              <Text style={styles.trendPositiveText}>Ready to Issue</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabBar}>
          <TouchableOpacity
            style={[styles.filterTabItem, activeTab === 'ALL' && styles.filterTabItemActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.filterTabText, activeTab === 'ALL' && styles.filterTabTextActive]}>
              All ({workOrders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTabItem, activeTab === 'ASSIGNED' && styles.filterTabItemActive]}
            onPress={() => setActiveTab('ASSIGNED')}
          >
            <Text style={[styles.filterTabText, activeTab === 'ASSIGNED' && styles.filterTabTextActive]}>
              Assigned ({assignedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTabItem, activeTab === 'IN_PROGRESS' && styles.filterTabItemActive]}
            onPress={() => setActiveTab('IN_PROGRESS')}
          >
            <Text style={[styles.filterTabText, activeTab === 'IN_PROGRESS' && styles.filterTabTextActive]}>
              In Progress ({inProgressCount})
            </Text>
          </TouchableOpacity>
        </View>

        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="wrench-clock" size={40} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No active work orders</Text>
            <Text style={styles.emptySubtitle}>
              You currently have zero pending repair tasks. Check the Breakdowns queue for open issues.
            </Text>
            <TouchableOpacity
              style={styles.triageQueueBtn}
              onPress={() => navigation.navigate('TriageTab')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#000000" style={{ marginRight: 6 }} />
              <Text style={styles.triageQueueBtnText}>View Open Breakdowns</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((wo) => {
            const isProgress = wo.status === 'in_progress';
            const isCrit = wo.priority === 'critical';

            return (
              <TouchableOpacity
                key={wo.id}
                style={[styles.card, isProgress && styles.cardProgress]}
                onPress={() => navigation.navigate('WorkOrderDetail', { workOrder: wo })}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.woNumber}>{wo.wo_number || 'WO-TASK'}</Text>
                    <Text style={styles.machineTitle} numberOfLines={1}>
                      {wo.machine_code} • {wo.machine_name}
                    </Text>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={[styles.priorityBadge, isCrit ? styles.badgeCrit : styles.badgeNormal]}>
                      <Text style={[styles.priorityText, isCrit ? { color: '#B91C1C' } : { color: '#475569' }]}>
                        {(wo.priority || 'NORMAL').toUpperCase()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, isProgress ? styles.statusProgress : styles.statusAssigned]}>
                      <Text style={[styles.statusText, isProgress ? { color: '#1D4ED8' } : { color: '#B45309' }]}>
                        {isProgress ? 'In Progress' : 'Assigned'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardBottomRow}>
                  <View style={styles.locationMeta}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748B" />
                    <Text style={styles.locationText}>{wo.bay_line_location || 'Bay 1 / Line 4'}</Text>
                  </View>

                  <View style={styles.actionPrompt}>
                    <Text style={styles.actionPromptText}>{isProgress ? 'Continue Work' : 'Start Repair'}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#0F172A" />
                  </View>
                </View>
              </TouchableOpacity>
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
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  headerYellowSlice: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 50,
    borderLeftWidth: 50,
    borderTopColor: '#F9B101',
    borderLeftColor: '#F9B101',
    borderRightWidth: 20,
    borderRightColor: 'transparent',
    borderBottomWidth: 20,
    borderBottomColor: 'transparent',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  hamburgerBtn: {
    padding: 6,
    marginRight: 6,
  },
  brandBadgeWrap: {
    width: 58,
    height: 24,
    justifyContent: 'center',
    marginRight: 6,
  },
  headerJcbLogo: {
    width: 58,
    height: 24,
  },
  headerDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  headerTitleCol: {
    justifyContent: 'center',
  },
  smartCmmsTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  smartCmmsSub: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '500',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9B101',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  scanQrText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  userProfileChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 3,
    borderRadius: 16,
  },
  userAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // Breadcrumb Yellow Banner
  breadcrumbBanner: {
    backgroundColor: '#F9B101',
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  breadcrumbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbTitle: {
    color: '#000000',
    fontSize: 15.5,
    fontWeight: '800',
  },
  // Section Main Header Block
  sectionTitleBlock: {
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yellowIndicatorBar: {
    width: 4,
    height: 18,
    backgroundColor: '#F9B101',
    borderRadius: 2,
    marginRight: 8,
  },
  sectionMainTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginLeft: 12,
  },
  // 4 KPI Cards Grid
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  kpiIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiContentCol: {
    flex: 1,
  },
  kpiValueText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 26,
  },
  kpiLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  trendPositiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#16A34A',
    marginTop: 2,
  },
  trendNegativeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#DC2626',
    marginTop: 2,
  },
  filterTabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  filterTabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  triageQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9B101',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 14,
  },
  triageQueueBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#000000',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  cardProgress: {
    borderColor: '#93C5FD',
    backgroundColor: '#FBFDFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  woNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  machineTitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 4,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCrit: {
    backgroundColor: '#FEE2E2',
  },
  badgeNormal: {
    backgroundColor: '#F1F5F9',
  },
  priorityText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusProgress: {
    backgroundColor: '#DBEAFE',
  },
  statusAssigned: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#64748B',
  },
  actionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionPromptText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
});
