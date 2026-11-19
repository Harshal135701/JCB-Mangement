import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_HEADER_BADGE = require('../../assets/jcb_header_badge.png');
const JCB_EXCAVATOR_THUMB = require('../../assets/jcb_excavator_thumb.png');

export const ShopFloorDashboardScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();

  const [stats, setStats] = useState<any>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [downtimeData, setDowntimeData] = useState<any>(null);
  const [pmPlans, setPmPlans] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'running' | 'breakdown' | 'under_maintenance'>('ALL');
  const [selectedMachine, setSelectedMachine] = useState<any | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Live');

  // Enterprise Multi-Plant & Operator Authorization States
  const [pendingOperatorsCount, setPendingOperatorsCount] = useState(0);
  const [selectedPlant, setSelectedPlant] = useState('All Plants');
  const [selectedShift, setSelectedShift] = useState('Shift A');
  const [plantsList, setPlantsList] = useState<string[]>(['All Plants', 'Chakan', 'PCMC', 'Talegaon']);

  // Swipe-to-dismiss states for Action Required alert banner
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 80) {
          const toValue = gestureState.dx > 0 ? SCREEN_WIDTH + 80 : -SCREEN_WIDTH - 80;
          Animated.timing(panX, {
            toValue,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setIsAlertDismissed(true);
            panX.setValue(0);
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Detect role dynamically (Admin vs Manager vs other)
  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'plant_admin' || role === 'enterprise_admin';
  const isManager = role === 'manager';

  const userRoleBadge = isAdmin
    ? 'ADMIN'
    : isManager
    ? 'MANAGER'
    : (user?.role ? user.role.toUpperCase() : 'USER');

  const fetchData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setIsAlertDismissed(false);
      }
      const [kpiRes, machinesRes, dtRes, pmRes, woRes, pendingRes, orgRes]: any[] = await Promise.allSettled([
        apiClient.get('/reports/dashboard-kpis'),
        apiClient.get('/machines?limit=100'),
        apiClient.get('/downtime'),
        apiClient.get('/pm/plans'),
        apiClient.get('/work-orders?limit=50'),
        apiClient.get('/auth/pending-operators'),
        apiClient.get('/auth/plants'),
      ]);

      if (kpiRes.status === 'fulfilled' && kpiRes.value) {
        setStats(kpiRes.value.data || kpiRes.value);
      }
      if (machinesRes.status === 'fulfilled' && machinesRes.value?.data) {
        setMachines(machinesRes.value.data);
      }
      if (dtRes.status === 'fulfilled' && dtRes.value?.data) {
        setDowntimeData(dtRes.value.data);
      }
      if (pmRes.status === 'fulfilled' && pmRes.value?.data) {
        setPmPlans(pmRes.value.data);
      }
      if (woRes.status === 'fulfilled' && woRes.value?.data) {
        setWorkOrders(woRes.value.data);
      }
      if (pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value?.data)) {
        setPendingOperatorsCount(pendingRes.value.data.length);
      }
      if (orgRes.status === 'fulfilled' && Array.isArray(orgRes.value?.data)) {
        const pNames = ['All Plants', ...orgRes.value.data.map((p: any) => p.plant_name)];
        setPlantsList(pNames);
      }
      const now = new Date();
      setLastSyncedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Real-time automatic polling every 20 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesSearch =
        m.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
        m.name?.toLowerCase().includes(search.toLowerCase()) ||
        m.bay_line_location?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ? true : m.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [machines, search, statusFilter]);

  // Real-time dynamic counts computed purely from real database values
  const totalMachinesCount = useMemo(() => {
    if (machines.length > 0) return machines.length;
    if (stats?.totalMachines !== undefined) return stats.totalMachines;
    return 0;
  }, [machines, stats]);

  const runningCount = useMemo(() => {
    if (machines.length > 0) {
      return machines.filter((m) => m.status === 'running' || m.status === 'operational').length;
    }
    return stats?.operationalCount ?? 0;
  }, [machines, stats]);

  const idleCount = useMemo(() => {
    if (machines.length > 0) {
      return machines.filter((m) => m.status === 'idle' || m.status === 'awaiting_parts' || m.status === 'standby').length;
    }
    return stats?.awaitingPartsCount ?? 0;
  }, [machines, stats]);

  const breakdownCount = useMemo(() => {
    if (machines.length > 0) {
      return machines.filter((m) => m.status === 'breakdown').length;
    }
    return stats?.breakdownCount ?? stats?.breakdownMachinesCount ?? 0;
  }, [machines, stats]);

  const underMaintenanceCount = useMemo(() => {
    if (machines.length > 0) {
      return machines.filter((m) => m.status === 'under_maintenance').length;
    }
    return stats?.maintenanceCount ?? 0;
  }, [machines, stats]);

  const pendingRequestsCount = useMemo(() => {
    if (workOrders.length > 0) {
      return workOrders.filter((w) => w.status !== 'verified_closed' && w.status !== 'completed').length;
    }
    return stats?.openWorkOrdersCount ?? stats?.openWorkOrders ?? 0;
  }, [workOrders, stats]);

  // Real Percentage calculations from actual numbers
  const total = totalMachinesCount > 0 ? totalMachinesCount : 1;
  const runningPercent = totalMachinesCount > 0 ? ((runningCount / total) * 100).toFixed(1) : '0.0';
  const idlePercent = totalMachinesCount > 0 ? ((idleCount / total) * 100).toFixed(1) : '0.0';
  const breakdownPercent = totalMachinesCount > 0 ? ((breakdownCount / total) * 100).toFixed(1) : '0.0';
  const underMaintenancePercent = totalMachinesCount > 0 ? ((underMaintenanceCount / total) * 100).toFixed(1) : '0.0';

  // Real downtime metrics
  const totalDowntimeMinutes = stats?.totalDowntimeMinutes ?? downtimeData?.summary?.total_downtime_minutes ?? 0;
  const totalDowntimeDisplay = totalDowntimeMinutes >= 60
    ? `${(totalDowntimeMinutes / 60).toFixed(1)} Hrs`
    : `${totalDowntimeMinutes} Mins`;

  const avgRepairMinutes = stats?.avgMTTRMinutes ?? Math.round(parseFloat(downtimeData?.summary?.mttr_active_wrench_minutes || '0')) ?? 0;
  const avgRepairDisplay = avgRepairMinutes > 0
    ? `${avgRepairMinutes} Mins`
    : `${totalDowntimeMinutes > 0 ? Math.round(totalDowntimeMinutes / (breakdownCount || 1)) : 0} Mins`;

  const machineAvailability = stats?.machineAvailabilityPercent ?? (totalMachinesCount > 0 ? parseFloat(runningPercent) : 100);
  const downtimeRate = (100 - machineAvailability).toFixed(1);
  const isDowntimeActive = breakdownCount > 0;

  // Real upcoming PM schedule from database
  const upcomingPM = useMemo(() => {
    if (!pmPlans || pmPlans.length === 0) return null;
    const sorted = [...pmPlans].filter((p) => p.next_pm_date).sort((a, b) => {
      return new Date(a.next_pm_date).getTime() - new Date(b.next_pm_date).getTime();
    });
    return sorted[0] || pmPlans[0];
  }, [pmPlans]);

  const upcomingDateDisplay = useMemo(() => {
    if (!upcomingPM?.next_pm_date) return 'Today';
    const d = new Date(upcomingPM.next_pm_date);
    return isNaN(d.getTime()) ? String(upcomingPM.next_pm_date) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [upcomingPM]);

  const upcomingTitleDisplay = upcomingPM
    ? (upcomingPM.title || `${upcomingPM.machine_code || 'JCB'} Scheduled PM`)
    : 'All PMs Up to Date';

  const upcomingScheduleTimeDisplay = upcomingPM
    ? `${upcomingPM.frequency ? upcomingPM.frequency.toUpperCase() : 'SCHEDULED'} PM ROUTINE`
    : '100% Compliant';

  // Dynamic 4-week trend calculated from actual work orders and PM records
  const trendWeekly = useMemo(() => {
    const now = new Date();
    const corrective = [0, 0, 0, 0];
    const preventive = [0, 0, 0, 0];

    if (workOrders && workOrders.length > 0) {
      workOrders.forEach((wo) => {
        const d = wo.created_at ? new Date(wo.created_at) : now;
        const diffDays = Math.max(0, Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
        const weekIndex = Math.min(3, Math.floor(diffDays / 7));
        const colIdx = 3 - weekIndex;
        if (wo.wo_type === 'PM' || wo.category === 'Preventive') {
          preventive[colIdx] = (preventive[colIdx] || 0) + 1;
        } else {
          corrective[colIdx] = (corrective[colIdx] || 0) + 1;
        }
      });
    }

    const maxVal = Math.max(6, ...corrective, ...preventive);
    const getY = (val: number) => Math.max(10, Math.min(68, Math.round(68 - (val / maxVal) * 56)));

    return {
      corrective,
      preventive,
      maxVal,
      cDots: corrective.map(getY),
      pDots: preventive.map(getY),
    };
  }, [workOrders]);

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        {/* Top-left yellow corner wedge */}
        <View style={styles.headerYellowSlice} />

        {/* Left: Menu & Brand */}
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
              source={JCB_HEADER_BADGE}
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

        {/* Right: User Chip */}
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
              {user?.fullName?.split(' ')[0] || (isAdmin ? 'Admin' : 'Specialist')}
            </Text>
            <View style={styles.userRoleRow}>
              <Text style={styles.userRoleText}>{userRoleBadge}</Text>
              <MaterialCommunityIcons name="chevron-down" size={12} color="#94A3B8" />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => fetchData(false)}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Plant Status & Sync Row */}
        <View style={styles.topStatusRow}>
          <View style={styles.topStatusLeft}>
            <View style={styles.yellowIndicatorBar} />
            <Text style={styles.topStatusText}>Plant Operations Overview</Text>
          </View>
          <Text style={styles.syncTimeText}>Synced: {lastSyncedTime}</Text>
        </View>

        {/* Global Plant Selector (Admin & Manager) */}
        {(isAdmin || isManager) && (
          <View style={styles.plantSelectorWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.plantSelectorScroll}>
              {plantsList.map((pName) => {
                const active = selectedPlant === pName;
                return (
                  <TouchableOpacity
                    key={pName}
                    style={[styles.plantPill, active && styles.plantPillActive]}
                    onPress={() => setSelectedPlant(pName)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.plantPillText, active && styles.plantPillTextActive]}>{pName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Operator Registration Action Alert Banner with Swipe-to-Dismiss */}
        {pendingOperatorsCount > 0 && !isAlertDismissed && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.swipeAlertWrapper,
              {
                transform: [{ translateX: panX }],
                opacity: panX.interpolate({
                  inputRange: [-180, 0, 180],
                  outputRange: [0.3, 1, 0.3],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.pendingAlertCard}
              onPress={() => navigation.navigate('UserManagement')}
              activeOpacity={0.9}
            >
              <View style={styles.pendingAlertLeft}>
                <View style={styles.alertIconBadge}>
                  <MaterialCommunityIcons name="hard-hat" size={22} color="#000000" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.alertHeaderRow}>
                    <Text style={styles.alertTagText}>ACTION REQUIRED</Text>
                    <View style={styles.pulseCountBadge}>
                      <Text style={styles.pulseCountText}>{pendingOperatorsCount} PENDING</Text>
                    </View>
                  </View>
                  <Text style={styles.alertDescText}>
                    {pendingOperatorsCount === 1
                      ? '1 factory operator registered & awaiting authorization.'
                      : `${pendingOperatorsCount} factory operators registered & awaiting authorization.`}
                  </Text>
                  <View style={styles.swipeHintRow}>
                    <MaterialCommunityIcons name="gesture-swipe-horizontal" size={13} color="#D97706" />
                    <Text style={styles.swipeHintText}>Swipe to dismiss</Text>
                  </View>
                </View>
              </View>
              <View style={styles.alertRightActions}>
                <View style={styles.authorizeBtn}>
                  <Text style={styles.authorizeBtnText}>Review</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color="#000000" />
                </View>
                <TouchableOpacity
                  style={styles.dismissCloseBtn}
                  onPress={() => {
                    Animated.timing(panX, {
                      toValue: SCREEN_WIDTH + 60,
                      duration: 200,
                      useNativeDriver: true,
                    }).start(() => {
                      setIsAlertDismissed(true);
                      panX.setValue(0);
                    });
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={15} color="#92400E" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Metric Cards - Access-based */}
        <View style={styles.kpiGrid}>
          {/* 1. Total Machines */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="tractor" size={22} color="#000000" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{totalMachinesCount}</Text>
              <Text style={styles.kpiLabelText}>Total Machines</Text>
              <Text style={styles.trendPositiveText}>{runningPercent}% Operating</Text>
            </View>
          </View>

          {/* 2. Running Machines / Fleet Availability */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="play-circle-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{runningCount}</Text>
              <Text style={styles.kpiLabelText}>Fleet Availability</Text>
              <Text style={styles.trendPositiveText}>{machineAvailability}% Uptime</Text>
            </View>
          </View>

          {/* 3. Breakdown Machines */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('TriageTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="wrench-outline" size={20} color="#EF4444" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={[styles.kpiValueText, { color: '#EF4444' }]}>{breakdownCount}</Text>
              <Text style={styles.kpiLabelText}>Critical Breakdowns</Text>
              <Text style={breakdownCount > 0 ? styles.trendNegativeText : styles.trendPositiveText}>
                {breakdownCount > 0 ? `${breakdownPercent}% Fleet Down` : 'Zero Stoppages'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 4. Maintenance Status */}
          <TouchableOpacity
            style={styles.kpiCard}
            onPress={() => navigation.navigate('TriageTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.kpiIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{pendingRequestsCount}</Text>
              <Text style={styles.kpiLabelText}>Maintenance Status</Text>
              <Text style={styles.trendPositiveText}>
                {pendingRequestsCount > 0 ? `${pendingRequestsCount} In Pipeline` : 'All Clear'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Admin-Only Access Analytics Cards */}
          {isAdmin && (
            <>
              {/* 5. Purchase Requests */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => navigation.navigate('Procurement')}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <MaterialCommunityIcons name="file-sign" size={20} color="#0284C7" />
                </View>
                <View style={styles.kpiContentCol}>
                  <Text style={[styles.kpiValueText, { color: '#0284C7' }]}>
                    {stats?.pendingApprovals ?? 0}
                  </Text>
                  <Text style={styles.kpiLabelText}>Purchase Requests</Text>
                  <Text style={styles.trendWarningText}>PR Sign-off</Text>
                </View>
              </TouchableOpacity>

              {/* 6. Low Stock Spares Alert */}
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => navigation.navigate('SparesTab')}
                activeOpacity={0.8}
              >
                <View style={[styles.kpiIconCircle, { backgroundColor: '#FFEDD5' }]}>
                  <MaterialCommunityIcons name="alert-octagon-outline" size={20} color="#EA580C" />
                </View>
                <View style={styles.kpiContentCol}>
                  <Text style={[styles.kpiValueText, { color: '#EA580C' }]}>
                    {stats?.lowStockItemsCount ?? 0}
                  </Text>
                  <Text style={styles.kpiLabelText}>Low Stock Parts</Text>
                  <Text style={styles.trendWarningText}>Reorder Warning</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Machine Status Overview Card with Donut Chart */}
        <View style={styles.chartOverviewCard}>
          <View style={styles.chartCardHeader}>
            <View style={styles.chartHeaderLeft}>
              <MaterialCommunityIcons name="chart-bar" size={18} color="#F59E0B" />
              <Text style={styles.chartCardTitle}>Machine Status</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('MachinesTab')}>
              <Text style={styles.viewAllOrangeText}>View All ({totalMachinesCount}) →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.donutLayoutRow}>
            {/* Donut Visual Representation */}
            <View style={styles.donutChartContainer}>
              <View
                style={[
                  styles.donutOuterRing,
                  breakdownCount === 0 && { borderTopColor: '#10B981' },
                ]}
              >
                <View style={styles.donutInnerHole}>
                  <Text style={styles.donutTotalNumber}>{totalMachinesCount}</Text>
                  <Text style={styles.donutTotalLabel}>TOTAL</Text>
                </View>
              </View>
            </View>

            {/* Legend Stats Table */}
            <View style={styles.donutLegendCol}>
              <View style={styles.legendItemRow}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendLabel}>Running ({runningCount})</Text>
                <Text style={styles.legendValue}>(≈) {runningPercent}%</Text>
              </View>

              <View style={styles.legendItemRow}>
                <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
                <Text style={styles.legendLabel}>Idle ({idleCount})</Text>
                <Text style={styles.legendValue}>(≈) {idlePercent}%</Text>
              </View>

              <View style={styles.legendItemRow}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendLabel}>Breakdown ({breakdownCount})</Text>
                <Text style={styles.legendValue}>(≈) {breakdownPercent}%</Text>
              </View>

              <View style={styles.legendItemRow}>
                <View style={[styles.legendDot, { backgroundColor: '#1E3A8A' }]} />
                <Text style={styles.legendLabel}>Under Maint ({underMaintenanceCount})</Text>
                <Text style={styles.legendValue}>(≈) {underMaintenancePercent}%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Maintenance Trend Line Chart Card */}
        <View style={styles.trendCard}>
          <View style={styles.trendHeaderRow}>
            <View style={styles.trendHeaderLeft}>
              <MaterialCommunityIcons name="chart-line-variant" size={18} color="#F59E0B" />
              <Text style={styles.chartCardTitle}>Maintenance Trend</Text>
            </View>

            <View style={styles.trendLegendRow}>
              <View style={styles.legendItemSmall}>
                <View style={[styles.miniDot, { backgroundColor: '#000000' }]} />
                <Text style={styles.miniLegendText}>Corrective</Text>
              </View>
              <View style={styles.legendItemSmall}>
                <View style={[styles.miniDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={styles.miniLegendText}>Preventive</Text>
              </View>
            </View>
          </View>

          {/* Clean Line Chart Canvas */}
          <View style={styles.chartPlotArea}>
            {/* Horizontal Grid lines */}
            <View style={styles.gridLineRow}>
              <Text style={styles.axisLabel}>{trendWeekly.maxVal}</Text>
              <View style={styles.gridLine} />
            </View>
            <View style={styles.gridLineRow}>
              <Text style={styles.axisLabel}>{Math.round(trendWeekly.maxVal * 0.66)}</Text>
              <View style={styles.gridLine} />
            </View>
            <View style={styles.gridLineRow}>
              <Text style={styles.axisLabel}>{Math.round(trendWeekly.maxVal * 0.33)}</Text>
              <View style={styles.gridLine} />
            </View>
            <View style={styles.gridLineRow}>
              <Text style={styles.axisLabel}>0</Text>
              <View style={styles.gridLine} />
            </View>

            {/* Dynamic Curves Overlay */}
            <View style={styles.chartCurvesOverlay}>
              {/* Yellow Preventive Line */}
              <View style={styles.preventiveLine} />
              <View style={[styles.pointDot, { left: '16%', top: trendWeekly.pDots[0], backgroundColor: '#F59E0B' }]} />
              <View style={[styles.pointDot, { left: '42%', top: trendWeekly.pDots[1], backgroundColor: '#F59E0B' }]} />
              <View style={[styles.pointDot, { left: '68%', top: trendWeekly.pDots[2], backgroundColor: '#F59E0B' }]} />
              <View style={[styles.pointDot, { left: '92%', top: trendWeekly.pDots[3], backgroundColor: '#F59E0B' }]} />

              {/* Black Corrective Line & Dots */}
              <View style={[styles.pointDot, { left: '16%', top: trendWeekly.cDots[0], backgroundColor: '#000000' }]} />
              <View style={[styles.pointDot, { left: '42%', top: trendWeekly.cDots[1], backgroundColor: '#000000' }]} />
              <View style={[styles.pointDot, { left: '68%', top: trendWeekly.cDots[2], backgroundColor: '#000000' }]} />
              <View style={[styles.pointDot, { left: '92%', top: trendWeekly.cDots[3], backgroundColor: '#000000' }]} />
            </View>

            {/* X-Axis Labels */}
            <View style={styles.xAxisRow}>
              <Text style={styles.xAxisText}>Week 1</Text>
              <Text style={styles.xAxisText}>Week 2</Text>
              <Text style={styles.xAxisText}>Week 3</Text>
              <Text style={styles.xAxisText}>Week 4</Text>
            </View>
          </View>
        </View>

        {/* Bottom Two-Column Split Cards */}
        <View style={styles.bottomSplitRow}>
          {/* Left: Downtime Analysis */}
          <View style={styles.downtimeCard}>
            <View style={styles.splitCardHeader}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#F59E0B" />
              <Text style={styles.splitCardTitle}>Downtime Analysis</Text>
            </View>

            <View style={styles.downtimeBodyRow}>
              {/* Semi-circular gauge */}
              <View style={styles.gaugeContainer}>
                <View style={styles.gaugeCircle}>
                  <Text style={styles.gaugePercentText}>{downtimeRate}%</Text>
                  <Text style={styles.gaugeSubText}>Downtime Rate</Text>
                </View>
              </View>

              {/* Stats column */}
              <View style={styles.gaugeStatsCol}>
                <View style={styles.statMetricItem}>
                  <Text style={styles.statMetricLabel}>Total Downtime</Text>
                  <View style={styles.statValueRow}>
                    <MaterialCommunityIcons name="clock-outline" size={13} color="#64748B" />
                    <Text style={styles.statBigText}>{totalDowntimeDisplay}</Text>
                    <View style={isDowntimeActive ? styles.badgeRed : styles.badgeGreen}>
                      <Text style={isDowntimeActive ? styles.badgeRedText : styles.badgeGreenText}>
                        {isDowntimeActive ? `Active` : 'Normal'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.statMetricItem, { marginTop: 8 }]}>
                  <Text style={styles.statMetricLabel}>Avg. Repair Time</Text>
                  <View style={styles.statValueRow}>
                    <MaterialCommunityIcons name="wrench-outline" size={13} color="#64748B" />
                    <Text style={styles.statBigText}>{avgRepairDisplay}</Text>
                    <View style={styles.badgeGreen}>
                      <Text style={styles.badgeGreenText}>On Track</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Right: Upcoming Maintenance */}
          <View style={styles.upcomingCard}>
            <View style={styles.upcomingHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color="#F59E0B" />
                <Text style={styles.splitCardTitle}>Upcoming Maintenance</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('PMCalendar')}>
                <Text style={styles.viewCalendarLink}>View Calendar →</Text>
              </TouchableOpacity>
            </View>

            {/* Subcard Box */}
            <View style={styles.upcomingSubcard}>
              <Image
                source={JCB_EXCAVATOR_THUMB}
                style={styles.upcomingThumb}
                resizeMode="contain"
              />
              <View style={styles.upcomingDetailsCol}>
                <Text style={styles.upcomingDateText}>{upcomingDateDisplay}</Text>
                <Text style={styles.upcomingEventTitle} numberOfLines={1}>{upcomingTitleDisplay}</Text>
                <View style={styles.upcomingTimeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={12} color="#64748B" />
                  <Text style={styles.upcomingTimeText} numberOfLines={1}>{upcomingScheduleTimeDisplay}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Admin Enterprise Overview: Top Downtime Loss Equipment */}
        {isAdmin && stats?.topDowntimeMachines && stats.topDowntimeMachines.length > 0 && (
          <View style={styles.topDowntimeCard}>
            <View style={styles.topDowntimeHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="alert-octagon" size={18} color="#DC2626" />
                <Text style={styles.topDowntimeTitle}>Top Downtime Loss Equipment</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('DowntimeAnalytics')}>
                <Text style={styles.viewAnalyticsLink}>Pareto Trends →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.topDowntimeList}>
              {stats.topDowntimeMachines.map((m: any, idx: number) => (
                <View key={idx} style={styles.topDowntimeItem}>
                  <View style={styles.topDowntimeRankBox}>
                    <Text style={styles.topDowntimeRank}>#{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topDowntimeCode}>{m.machine_code} • {m.name}</Text>
                    <Text style={styles.topDowntimeShop}>{m.shop_name}</Text>
                  </View>
                  <View style={styles.topDowntimeMetrics}>
                    <Text style={styles.topDowntimeLoss}>{m.downtime_minutes} mins</Text>
                    <Text style={styles.topDowntimeFailures}>
                      {m.failure_count} stoppage{m.failure_count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Admin Governance Quick Links */}
        {isAdmin && (
          <View style={styles.adminShortcutsCard}>
            <Text style={styles.adminShortcutsTitle}>ADMIN MANAGEMENT & AUDIT</Text>
            <View style={styles.adminShortcutsGrid}>
              <TouchableOpacity
                style={styles.adminShortcutBtn}
                onPress={() => navigation.navigate('UserManagement')}
              >
                <MaterialCommunityIcons name="account-group" size={20} color="#7C3AED" />
                <Text style={styles.adminShortcutText}>Users & Staff</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminShortcutBtn}
                onPress={() => navigation.navigate('Procurement')}
              >
                <MaterialCommunityIcons name="cart-outline" size={20} color="#0284C7" />
                <Text style={styles.adminShortcutText}>PR Approvals</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminShortcutBtn}
                onPress={() => navigation.navigate('DowntimeAnalytics')}
              >
                <MaterialCommunityIcons name="chart-bell-curve" size={20} color="#EA580C" />
                <Text style={styles.adminShortcutText}>Pareto Loss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminShortcutBtn}
                onPress={() => navigation.navigate('AuditLogs')}
              >
                <MaterialCommunityIcons name="shield-check" size={20} color="#16A34A" />
                <Text style={styles.adminShortcutText}>Audit Ledger</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live Shop Floor Machines Directory */}
        <View style={styles.machineSectionHeader}>
          <Text style={styles.machineSectionTitle}>Shop Floor Equipment</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MachinesTab')}>
            <Text style={styles.viewAllOrangeText}>Full Directory ({machines.length}) →</Text>
          </TouchableOpacity>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search equipment code, bay, model..."
            placeholderTextColor="#94A3B8"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPillsScroll}>
          {[
            { key: 'ALL', label: `All (${machines.length})` },
            { key: 'running', label: `Running (${machines.filter((m) => m.status === 'running').length})` },
            { key: 'breakdown', label: `Breakdown (${machines.filter((m) => m.status === 'breakdown').length})` },
            { key: 'under_maintenance', label: 'Under Maintenance' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterPill,
                statusFilter === tab.key && styles.filterPillActive,
              ]}
              onPress={() => setStatusFilter(tab.key as any)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === tab.key && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Machine Cards List */}
        {filteredMachines.slice(0, 6).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.machineRowCard}
            onPress={() => setSelectedMachine(item)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.machineStatusStripe,
                {
                  backgroundColor:
                    item.status === 'running'
                      ? '#10B981'
                      : item.status === 'breakdown'
                      ? '#EF4444'
                      : '#F59E0B',
                },
              ]}
            />
            <View style={styles.machineRowContent}>
              <View style={styles.machineRowTop}>
                <Text style={styles.machineCodeText}>{item.machine_code}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === 'running'
                          ? '#ECFDF5'
                          : item.status === 'breakdown'
                          ? '#FEF2F2'
                          : '#FFFBEB',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          item.status === 'running'
                            ? '#047857'
                            : item.status === 'breakdown'
                            ? '#DC2626'
                            : '#B45309',
                      },
                    ]}
                  >
                    {item.status?.toUpperCase() || 'RUNNING'}
                  </Text>
                </View>
              </View>
              <Text style={styles.machineNameText}>{item.name}</Text>
              <Text style={styles.machineBayText}>
                {item.bay_line_location || 'Bay 1 • Heavy Line'} • Health: {item.health_score ?? 98}%
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Machine Quick Action Modal */}
      {selectedMachine && (
        <Modal
          visible={!!selectedMachine}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedMachine(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedMachine.name}</Text>
                  <Text style={styles.modalSubtitle}>{selectedMachine.machine_code}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedMachine(null)}>
                  <MaterialCommunityIcons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    const mach = selectedMachine;
                    setSelectedMachine(null);
                    navigation.navigate('ReportBreakdown', { preselectedMachine: mach });
                  }}
                >
                  <MaterialCommunityIcons name="alert-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.modalBtnText}>Report Breakdown</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#0F172A' }]}
                  onPress={() => {
                    setSelectedMachine(null);
                    navigation.navigate('SparesTab');
                  }}
                >
                  <MaterialCommunityIcons name="package-variant" size={18} color="#FFFFFF" />
                  <Text style={styles.modalBtnText}>View Spares</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Top Header Bar
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
    width: 66,
    height: 26,
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
  // Multi-Plant Selector Bar
  plantSelectorWrap: {
    marginBottom: 14,
  },
  plantSelectorScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  plantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  plantPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  plantPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  plantPillTextActive: {
    color: '#F9B101',
  },
  // Pending Operator Authorization Alert Banner
  pendingAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alertIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  alertTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  pulseCountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pulseCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  alertDescText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  authorizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  authorizeBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  alertRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dismissCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  swipeAlertWrapper: {
    marginBottom: 0,
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  swipeHintText: {
    fontSize: 10,
    color: '#B45309',
    fontWeight: '700',
  },
  // Top Plant Status Row
  topStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  topStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topStatusText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
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
  liveTelemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 4,
  },
  livePulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveTelemetryText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  sectionSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginLeft: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  syncTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
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
  trendWarningText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#D97706',
    marginTop: 2,
  },
  // Machine Status Overview Card
  chartOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllOrangeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  donutLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  donutChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutOuterRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: '#10B981',
    borderTopColor: '#EF4444',
    borderLeftColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutInnerHole: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotalNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  donutTotalLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  donutLegendCol: {
    flex: 1,
    marginLeft: 18,
    gap: 7,
  },
  legendItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  legendValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  // Maintenance Trend Card
  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  trendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniLegendText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  chartPlotArea: {
    height: 120,
    justifyContent: 'space-between',
    position: 'relative',
    marginTop: 4,
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  axisLabel: {
    width: 14,
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 6,
  },
  chartCurvesOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 22,
    left: 20,
    right: 0,
  },
  preventiveLine: {
    position: 'absolute',
    top: 70,
    left: '12%',
    right: '6%',
    height: 2,
    backgroundColor: '#F59E0B',
  },
  pointDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 20,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  xAxisText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  // Bottom Split Row
  bottomSplitRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  downtimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  splitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  splitCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  downtimeBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeContainer: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 7,
    borderColor: '#F9B101',
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePercentText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  gaugeSubText: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '600',
  },
  gaugeStatsCol: {
    flex: 1,
    marginLeft: 14,
  },
  statMetricItem: {},
  statMetricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statBigText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeRedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  badgeGreenText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
  },
  // Upcoming Maintenance Card
  upcomingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  upcomingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  viewCalendarLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  upcomingSubcard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upcomingThumb: {
    width: 52,
    height: 42,
  },
  upcomingDetailsCol: {
    flex: 1,
  },
  upcomingDateText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  upcomingEventTitle: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
    marginTop: 1,
  },
  upcomingTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  upcomingTimeText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
  // Machines Directory
  machineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  machineSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterPillsScroll: {
    marginBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  filterPillActive: {
    backgroundColor: '#F9B101',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  machineRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  machineStatusStripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  machineRowContent: {
    flex: 1,
    marginLeft: 6,
  },
  machineRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  machineCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  machineNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  machineBayText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  modalActionButtons: {
    gap: 10,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Admin Enterprise Analytics Styles
  topDowntimeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  topDowntimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topDowntimeTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  viewAnalyticsLink: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  topDowntimeList: {
    gap: 8,
  },
  topDowntimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  topDowntimeRankBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topDowntimeRank: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
  },
  topDowntimeCode: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  topDowntimeShop: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  topDowntimeMetrics: {
    alignItems: 'flex-end',
  },
  topDowntimeLoss: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#DC2626',
  },
  topDowntimeFailures: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },
  adminShortcutsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminShortcutsTitle: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.6,
    paddingHorizontal: 2,
  },
  adminShortcutsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  adminShortcutBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
    elevation: 1,
  },
  adminShortcutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
});
