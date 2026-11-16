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

export const OperatorDashboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    assignedMachines: 4,
    operational: 3,
    activeBreakdowns: 1,
    checklistStatus: 'Done',
  });
  const [recentBreakdowns, setRecentBreakdowns] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/breakdowns');
      if (res.success && res.data) {
        setRecentBreakdowns(res.data.slice(0, 5));
        const activeCount = res.data.filter(
          (b: any) => b.status !== 'verified_closed' && b.status !== 'rejected'
        ).length;
        setStats((prev) => ({
          ...prev,
          activeBreakdowns: activeCount,
        }));
      }
    } catch (e) {
      console.warn('Operator Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

        <TouchableOpacity
          style={styles.userProfileChip}
          onPress={openSidebar}
          activeOpacity={0.8}
        >
          <View style={styles.userAvatarCircle}>
            <MaterialCommunityIcons name="account" size={18} color="#0F172A" />
          </View>
          <View style={styles.userInfoCol}>
            <Text style={styles.userNameText} numberOfLines={1}>
              {user?.fullName?.split(' ')[0] || 'Operator'}
            </Text>
            <View style={styles.userRoleRow}>
              <Text style={styles.userRoleText}>OPERATOR</Text>
              <MaterialCommunityIcons name="chevron-down" size={12} color="#94A3B8" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.contentScroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDashboardData}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Yellow Breadcrumb Banner */}
        <TouchableOpacity
          style={styles.breadcrumbBanner}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('OperatorTab')}
        >
          <View style={styles.breadcrumbLeft}>
            <MaterialCommunityIcons name="home-outline" size={22} color="#000000" />
            <Text style={styles.breadcrumbTitle}>Dashboard</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#000000" />
        </TouchableOpacity>

        {/* Section Title Header */}
        <View style={styles.sectionTitleBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.yellowIndicatorBar} />
            <Text style={styles.sectionMainTitle}>Operator Station</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Overview of assigned machinery & shopfloor line operations
          </Text>
        </View>

        {/* 4 Metric Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* Assigned Machines */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="tractor" size={22} color="#000000" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{stats.assignedMachines}</Text>
              <Text style={styles.kpiLabelText}>Assigned Machines</Text>
              <Text style={styles.trendPositiveText}>↑ 1.5%</Text>
            </View>
          </View>

          {/* Running Nominally */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="play-circle-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{stats.operational}</Text>
              <Text style={styles.kpiLabelText}>Running Normally</Text>
              <Text style={styles.trendPositiveText}>↑ 0.5%</Text>
            </View>
          </View>

          {/* Active Issues */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('TriageTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="wrench-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={[styles.kpiValueText, { color: '#EF4444' }]}>{stats.activeBreakdowns}</Text>
              <Text style={styles.kpiLabelText}>Active Breakdowns</Text>
              <Text style={styles.trendNegativeText}>↑ 1.0%</Text>
            </View>
          </TouchableOpacity>

          {/* Daily Checklist */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('DailyInspection')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={[styles.kpiValueText, { color: '#8B5CF6' }]}>PASS</Text>
              <Text style={styles.kpiLabelText}>Pre-Shift Inspection</Text>
              <Text style={styles.trendPositiveText}>✓ Completed</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Big Action Buttons */}
        <Text style={styles.sectionHeaderTitle}>SHOPFLOOR ACTIONS</Text>

        <TouchableOpacity
          style={styles.breakdownActionBtn}
          onPress={() => navigation.navigate('ReportBreakdown')}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconCircle}>
            <MaterialCommunityIcons name="alert-octagon" size={24} color="#000000" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Report Machine Breakdown</Text>
            <Text style={styles.actionSubtitle}>Tap to report stoppage, hydraulic fault or issue</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inspectionActionBtn}
          onPress={() => navigation.navigate('DailyInspection')}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconCircle, { backgroundColor: '#F1F5F9' }]}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#0F172A" />
          </View>
          <View style={styles.actionTextContainer}>
            <Text style={styles.actionTitle}>Daily Inspection Checklist</Text>
            <Text style={styles.actionSubtitle}>Pre-shift safety, oil level and pressure check</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#64748B" />
        </TouchableOpacity>

        {/* My Reported Issues */}
        <Text style={styles.sectionHeaderTitle}>MY REPORTED ISSUES</Text>

        {recentBreakdowns.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="check-circle-outline" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>All Machines Running Smoothly</Text>
            <Text style={styles.emptySubtitle}>No open breakdown tickets on your assigned line</Text>
          </View>
        ) : (
          recentBreakdowns.map((t) => {
            const isClosed = t.status === 'verified_closed';
            return (
              <View key={t.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketNo}>{t.complaint_number || t.ticket_number || 'TICKET'}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isClosed ? styles.statusClosed : styles.statusOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isClosed ? styles.statusTextClosed : styles.statusTextOpen,
                      ]}
                    >
                      {(t.status || 'NEW').replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.ticketMachineRow}>
                  <MaterialCommunityIcons name="tractor" size={15} color="#64748B" />
                  <Text style={styles.ticketMachineCode}>{t.machine_code || 'JCB-CNC-001'}</Text>
                  {t.machine_name && (
                    <Text style={styles.ticketMachineName} numberOfLines={1}>
                      • {t.machine_name}
                    </Text>
                  )}
                </View>

                <Text style={styles.ticketIssueText} numberOfLines={2}>
                  {t.problem_title || t.description || 'Machine breakdown reported'}
                </Text>

                <View style={styles.ticketFooter}>
                  <Text style={styles.ticketMeta}>
                    Category: {t.issue_category || 'Hydraulic'}
                  </Text>
                  <Text style={styles.ticketMetaDivider}>•</Text>
                  <Text style={styles.ticketMeta}>
                    Priority: {(t.priority || 'Medium').toUpperCase()}
                  </Text>
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
  userProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 6,
    zIndex: 2,
  },
  userAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoCol: {
    alignItems: 'flex-start',
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  userRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  userRoleText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  contentScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // Yellow Breadcrumb Banner
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
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  breakdownActionBtn: {
    backgroundColor: '#F9B101',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  inspectionActionBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    elevation: 1,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNo: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusOpen: {
    backgroundColor: '#FEE2E2',
  },
  statusClosed: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusTextOpen: {
    color: '#DC2626',
  },
  statusTextClosed: {
    color: '#16A34A',
  },
  ticketMachineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ticketMachineCode: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  ticketMachineName: {
    fontSize: 11,
    color: '#64748B',
  },
  ticketIssueText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '500',
    marginBottom: 8,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  ticketMeta: {
    fontSize: 10,
    color: '#64748B',
  },
  ticketMetaDivider: {
    marginHorizontal: 6,
    color: '#CBD5E1',
  },
});
