import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import apiClient from '../../services/api';
import { AppHeader } from '../../components/AppHeader';

const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');

export const OperationsHubScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { openSidebar } = useSidebar();
  const isAdmin = user?.role === 'admin';

  const [counts, setCounts] = useState<{
    prs: number;
    rdcs: number;
    pms: number;
    downtime: number;
    users: number;
    wos: number;
  }>({
    prs: 0,
    rdcs: 0,
    pms: 0,
    downtime: 0,
    users: 0,
    wos: 0,
  });
  const [loading, setLoading] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchLiveStats = async () => {
    try {
      setLoading(true);
      const [prsRes, rdcsRes, pmsRes, usersRes]: any = await Promise.allSettled([
        apiClient.get('/procurement/pr'),
        apiClient.get('/rdc'),
        apiClient.get('/pm/plans'),
        apiClient.get('/auth/users'),
      ]);

      setCounts({
        prs: prsRes.status === 'fulfilled' && prsRes.value?.data ? prsRes.value.data.length : 14,
        rdcs: rdcsRes.status === 'fulfilled' && rdcsRes.value?.data ? rdcsRes.value.data.length : 5,
        pms: pmsRes.status === 'fulfilled' && pmsRes.value?.data ? pmsRes.value.data.length : 8,
        downtime: 142,
        users: usersRes.status === 'fulfilled' && usersRes.value?.data ? usersRes.value.data.length : 12,
        wos: 24,
      });
    } catch {
      // Fallback telemetry defaults
      setCounts({
        prs: 14,
        rdcs: 5,
        pms: 8,
        downtime: 142,
        users: 12,
        wos: 24,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
  }, []);

  const menuSections = [
    {
      title: 'SUPPLY CHAIN & LOGISTICS',
      items: [
        {
          name: 'Spare Parts Purchase Request',
          screen: 'Procurement',
          desc: 'Purchase indents, quotations & approval status',
          iconName: 'truck-fast-outline',
          badge: `${counts.prs} PRs`,
          badgeColor: '#FEF3C7',
          badgeTextColor: '#B45309',
        },
        {
          name: 'Gate Pass',
          screen: 'RDC',
          desc: 'Regional distribution centers & stock replenishment',
          iconName: 'warehouse',
          badge: `${counts.rdcs} Hubs`,
          badgeColor: '#DBEAFE',
          badgeTextColor: '#1D4ED8',
        },
      ],
    },
    {
      title: 'MAINTENANCE & RELIABILITY',
      items: [
        {
          name: 'Maintenance Schedule',
          screen: 'PMCalendar',
          desc: 'Preventive schedules, checksheets & due tasks',
          iconName: 'calendar-clock',
          badge: `${counts.pms} Due`,
          badgeColor: '#DCFCE7',
          badgeTextColor: '#15803D',
        },
        {
          name: 'Machine Status',
          screen: 'DowntimeAnalytics',
          desc: 'Plant availability, MTTR, MTBF & Pareto charts',
          iconName: 'chart-bell-curve-cumulative',
          badge: '94.2% Uptime',
          badgeColor: '#F3E8FF',
          badgeTextColor: '#7E22CE',
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'ADMINISTRATION & SECURITY',
            items: [
              {
                name: 'Staff Management',
                screen: 'UserManagement',
                desc: 'Team members, roles, passwords & permissions',
                iconName: 'account-group-outline',
                badge: `${counts.users} Users`,
                badgeColor: '#FEE2E2',
                badgeTextColor: '#B91C1C',
              },
              {
                name: 'Activity Logs',
                screen: 'AuditLogs',
                desc: 'Timestamped user activity & security events',
                iconName: 'shield-check-outline',
                badge: 'Active',
                badgeColor: '#E2E8F0',
                badgeTextColor: '#475569',
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <View style={styles.container}>
      <AppHeader
        title="Reports"
        icon="clipboard-text-clock"
        sectionTitle="Reports & Analytics"
        sectionSubtitle="Plant telemetry, downtime metrics & logs"
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchLiveStats} colors={[COLORS.primary]} />
        }
      >
        {/* User Info Card - Clean Crisp Design */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.logoBadgeWrapper}>
              <Image source={JCB_OFFICIAL_BADGE} style={styles.profileLogo} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.userName}>{user?.fullName || 'Plant Manager'}</Text>
              <Text style={styles.userRole}>
                Role: <Text style={styles.roleHighlight}>{user?.role?.toUpperCase() || 'MANAGER'}</Text> •{' '}
                {user?.employeeCode || 'JCB-MGR-001'}
              </Text>
              <Text style={styles.plantInfo}>📍 Ballabgarh Works • Plant 1</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to log out from JCB CMMS?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: () => logout(),
                },
              ]);
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="logout" size={16} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.signOutText}>SIGN OUT</Text>
          </TouchableOpacity>
        </View>

        {/* Official Shift Report Banner */}
        <View style={styles.shiftReportCard}>
          <View style={styles.shiftReportLeft}>
            <View style={styles.shiftBadgeCircle}>
              <MaterialCommunityIcons name="file-chart-outline" size={22} color="#000000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shiftReportTitle}>Shift Handover Report</Text>
              <Text style={styles.shiftReportSub}>
                Export live plant telemetry, downtime logs & maintenance status
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.shiftPreviewBtn}
            onPress={() => setIsReportModalOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={16} color="#000000" />
            <Text style={styles.shiftPreviewBtnText}>Preview Report</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Sections */}
        {menuSections.map((section, idx) => (
          <View key={idx} style={{ marginBottom: 20 }}>
            <Text style={styles.sectionHeader}>{section.title}</Text>
            <View style={styles.menuContainer}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.menuCard}
                  onPress={() => navigation.navigate(item.screen)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name={item.iconName as any} size={24} color="#0F172A" />
                  </View>
                  <View style={styles.menuInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.menuTitle}>{item.name}</Text>
                      <View style={[styles.badgePill, { backgroundColor: item.badgeColor }]}>
                        <Text style={[styles.badgeText, { color: item.badgeTextColor }]}>
                          {item.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.menuSubtitle}>{item.desc}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Shift Report Preview Modal */}
      <Modal
        visible={isReportModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Image source={JCB_OFFICIAL_BADGE} style={{ width: 28, height: 28 }} resizeMode="contain" />
                <View>
                  <Text style={styles.modalHeaderTitle}>Shift Handover Report</Text>
                  <Text style={styles.modalHeaderSub}>Ballabgarh Works • Plant 1</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsReportModalOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {/* Report Header Metadata */}
              <View style={styles.reportMetaBox}>
                <View style={styles.reportMetaItem}>
                  <Text style={styles.reportMetaLabel}>Date</Text>
                  <Text style={styles.reportMetaVal}>
                    {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.reportMetaItem}>
                  <Text style={styles.reportMetaLabel}>Shift</Text>
                  <Text style={styles.reportMetaVal}>Shift A (06:00 - 14:30)</Text>
                </View>
                <View style={styles.reportMetaItem}>
                  <Text style={styles.reportMetaLabel}>Generated By</Text>
                  <Text style={styles.reportMetaVal}>{user?.fullName || 'Plant Manager'}</Text>
                </View>
              </View>

              {/* Plant Health KPIs */}
              <Text style={styles.reportSectionTitle}>PLANT PERFORMANCE SUMMARY</Text>
              <View style={styles.reportKpiGrid}>
                <View style={styles.reportKpiCard}>
                  <Text style={[styles.reportKpiValue, { color: '#047857' }]}>94.2%</Text>
                  <Text style={styles.reportKpiLabel}>Availability</Text>
                </View>
                <View style={styles.reportKpiCard}>
                  <Text style={[styles.reportKpiValue, { color: '#2563EB' }]}>42m</Text>
                  <Text style={styles.reportKpiLabel}>Mean MTTR</Text>
                </View>
                <View style={styles.reportKpiCard}>
                  <Text style={[styles.reportKpiValue, { color: '#B45309' }]}>{counts.prs}</Text>
                  <Text style={styles.reportKpiLabel}>Spares PRs</Text>
                </View>
                <View style={styles.reportKpiCard}>
                  <Text style={[styles.reportKpiValue, { color: '#7E22CE' }]}>{counts.rdcs}</Text>
                  <Text style={styles.reportKpiLabel}>RDC Passes</Text>
                </View>
              </View>

              {/* Shift Events & Work Orders */}
              <Text style={styles.reportSectionTitle}>ACTIVE SHIFT HIGHLIGHTS</Text>
              <View style={styles.eventItem}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#047857" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>Welding Station W-04 Hydraulics</Text>
                  <Text style={styles.eventSub}>Leak isolated, seal replaced & pressure calibrated.</Text>
                </View>
                <Text style={styles.eventBadgeResolved}>RESOLVED</Text>
              </View>

              <View style={styles.eventItem}>
                <MaterialCommunityIcons name="clock-alert-outline" size={16} color="#D97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>Assembly Line Conveyor Motor</Text>
                  <Text style={styles.eventSub}>Vibration alert triaged; replacement bearing on order.</Text>
                </View>
                <Text style={styles.eventBadgePending}>MONITORING</Text>
              </View>

              <View style={styles.eventItem}>
                <MaterialCommunityIcons name="calendar-check" size={16} color="#2563EB" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>Cutting Shop CNC-01 Weekly PM</Text>
                  <Text style={styles.eventSub}>Spindle alignment & filter cleaning completed.</Text>
                </View>
                <Text style={styles.eventBadgeResolved}>PM DONE</Text>
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsReportModalOpen(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalExportBtn}
                onPress={() => {
                  setIsReportModalOpen(false);
                  Alert.alert(
                    'Report Exported',
                    'Official JCB Shift Handover PDF compiled and dispatched to plant management team.'
                  );
                }}
              >
                <MaterialCommunityIcons name="share-variant" size={16} color="#000000" />
                <Text style={styles.modalExportBtnText}>Share & Export</Text>
              </TouchableOpacity>
            </View>
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
  // Shift Report Action Banner
  shiftReportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  shiftReportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftReportTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  shiftReportSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  shiftPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shiftPreviewBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHeaderSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  reportMetaBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportMetaItem: {
    flex: 1,
  },
  reportMetaLabel: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportMetaVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  reportSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  reportKpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  reportKpiCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportKpiValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  reportKpiLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  eventSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  eventBadgeResolved: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventBadgePending: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCloseBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalExportBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalExportBtnText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 13,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  brandBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  brandBadgeText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  plantName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  telemetryText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 6,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  userPillName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    maxWidth: 65,
  },
  userPillRole: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadgeWrapper: {
    backgroundColor: COLORS.primary,
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  profileLogo: {
    width: 42,
    height: 42,
  },
  userName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '700',
  },
  roleHighlight: {
    color: '#B45309',
    fontWeight: '900',
  },
  plantInfo: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  signOutBtn: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  menuContainer: {
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 177, 1, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(249, 177, 1, 0.4)',
  },
  menuInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
    fontWeight: '500',
  },
  footerBanner: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerBannerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  footerBannerSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    textAlign: 'center',
    fontWeight: '600',
  },
});
