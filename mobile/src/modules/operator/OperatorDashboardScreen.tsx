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
  TextInput,
  Alert,
  ActivityIndicator,
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

  // Harshal's Operator Machine Assignment & Live Maintenance States
  const [currentAssignment, setCurrentAssignment] = useState<any | null>(null);
  const [availableMachines, setAvailableMachines] = useState<any[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedShift, setSelectedShift] = useState('Shift A');
  const [hourMeterReading, setHourMeterReading] = useState('');
  const [signInNotes, setSignInNotes] = useState('');
  const [submittingSignIn, setSubmittingSignIn] = useState(false);
  const [cancelingReq, setCancelingReq] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [maintenanceOverview, setMaintenanceOverview] = useState<any | null>(null);

  const fetchAssignmentData = async () => {
    try {
      const [assignRes, maintRes]: any = await Promise.all([
        apiClient.get('/machines/operator/current-assignment').catch(() => ({ data: {} })),
        apiClient.get('/machines/operator/maintenance-status').catch(() => ({ data: {} })),
      ]);
      const aData = assignRes?.data || assignRes;
      if (aData?.currentAssignment) {
        setCurrentAssignment(aData.currentAssignment);
      } else {
        setCurrentAssignment(null);
      }
      const mData = maintRes?.data || maintRes;
      if (mData?.permanent_machine || mData?.temporary_machine) {
        setMaintenanceOverview(mData.temporary_machine || mData.permanent_machine);
      } else {
        setMaintenanceOverview(null);
      }
    } catch (e) {
      console.warn('Failed to load operator assignment:', e);
    }
  };

  const fetchAvailableMachines = async () => {
    try {
      setLoadingMachines(true);
      const res: any = await apiClient.get('/machines/operator/available-machines', {
        params: { shop_id: user?.shopId, plant_id: user?.plantId },
      });
      if (res?.success && Array.isArray(res.data)) {
        setAvailableMachines(res.data);
        if (res.data.length > 0 && !selectedMachineId) {
          setSelectedMachineId(res.data[0].id);
        }
      } else {
        const fRes: any = await apiClient.get('/machines?limit=50');
        if (fRes?.success && Array.isArray(fRes.data)) {
          setAvailableMachines(fRes.data);
          if (fRes.data.length > 0 && !selectedMachineId) {
            setSelectedMachineId(fRes.data[0].id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load available machines:', e);
    } finally {
      setLoadingMachines(false);
    }
  };

  const handleRequestSignIn = async () => {
    if (!selectedMachineId) {
      Alert.alert('Required', 'Please select a machine to sign in.');
      return;
    }
    try {
      setSubmittingSignIn(true);
      const payload = {
        machine_id: selectedMachineId,
        shift: selectedShift,
        hour_meter_reading: hourMeterReading ? parseFloat(hourMeterReading) : undefined,
        notes: signInNotes.trim() || undefined,
      };
      const res: any = await apiClient.post('/machines/operator/sign-in', payload);
      if (res?.success) {
        Alert.alert(
          'Sign-In Requested',
          res.message || 'Your sign-in request has been sent for Shop Manager approval.'
        );
        fetchAssignmentData();
        fetchDashboardData();
      }
    } catch (err: any) {
      Alert.alert('Sign-In Error', err.message || 'Failed to submit machine sign-in request.');
    } finally {
      setSubmittingSignIn(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!currentAssignment?.id) return;
    Alert.alert(
      'Cancel Sign-In Request',
      'Are you sure you want to cancel your pending machine sign-in request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelingReq(true);
              const res: any = await apiClient.post('/machines/operator/cancel-request', {
                request_id: currentAssignment.id,
              });
              if (res?.success) {
                Alert.alert('Cancelled', 'Your sign-in request was cancelled.');
                fetchAssignmentData();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel request.');
            } finally {
              setCancelingReq(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    if (!currentAssignment?.id) return;
    Alert.alert(
      'Sign Out Machine',
      `Are you sure you want to sign out from ${currentAssignment.machine_code || 'the machine'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setSigningOut(true);
              const res: any = await apiClient.post('/machines/operator/sign-out', {
                assignment_id: currentAssignment.id,
              });
              if (res?.success) {
                Alert.alert('Signed Out', 'You have successfully signed out from this machine.');
                fetchAssignmentData();
                fetchDashboardData();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to sign out.');
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

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
    fetchAssignmentData();
    fetchAvailableMachines();
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
          </View>
        </View>

        {/* Right: Bell Notification */}
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="bell-outline" size={22} color="#FFFFFF" />
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
        {/* Section Title Header */}
        <View style={styles.sectionTitleBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.yellowIndicatorBar} />
            <Text style={styles.sectionMainTitle}>Operator Dashboard</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Overview of assigned machinery & shopfloor line operations
          </Text>
        </View>

        {/* 4 Metric Cards (2x2 Grid) */}
        <View style={styles.kpiGrid}>
          {/* My Machine */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="tractor" size={22} color="#000000" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{stats.assignedMachines}</Text>
              <Text style={styles.kpiLabelText}>My Machine</Text>
              <Text style={styles.trendPositiveText}>Active</Text>
            </View>
          </View>

          {/* Fleet Running */}
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="play-circle-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.kpiContentCol}>
              <Text style={styles.kpiValueText}>{stats.operational}</Text>
              <Text style={styles.kpiLabelText}>Fleet Running</Text>
              <Text style={styles.trendPositiveText}>Nominal</Text>
            </View>
          </View>

          {/* Reported Problems */}
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
              <Text style={styles.kpiLabelText}>Reported Problems</Text>
              <Text style={styles.trendNegativeText}>Active</Text>
            </View>
          </TouchableOpacity>

          {/* Daily AM Checklist */}
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
              <Text style={styles.kpiLabelText}>Daily AM Checklist</Text>
              <Text style={styles.trendPositiveText}>✓ Completed</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------- */}
        {/* HARSHAL FEATURE: MACHINE SIGN-IN & LIVE ASSIGNMENT   */}
        {/* ---------------------------------------------------- */}
        <Text style={styles.sectionHeaderTitle}>MACHINE SIGN-IN & STATUS</Text>

        {currentAssignment && currentAssignment.status === 'approved' ? (
          <View style={styles.assignedMachineCard}>
            <View style={styles.assignedCardHeader}>
              <View style={styles.assignedBadgeRow}>
                <View style={styles.activeGreenDot} />
                <Text style={styles.assignedBadgeText}>ACTIVE SHIFT ASSIGNMENT</Text>
              </View>
              <View style={styles.shiftPillSmall}>
                <Text style={styles.shiftPillSmallText}>{currentAssignment.shift || 'Shift A'}</Text>
              </View>
            </View>

            <View style={styles.assignedMachineBody}>
              <View style={styles.assignedIconBox}>
                <MaterialCommunityIcons name="tractor" size={28} color="#000000" />
              </View>
              <View style={styles.assignedMachineInfo}>
                <Text style={styles.assignedMachineCode}>
                  {currentAssignment.machine_code || 'JCB-ASSET'}
                </Text>
                <Text style={styles.assignedMachineName} numberOfLines={1}>
                  {currentAssignment.machine_name || 'Heavy Equipment'}
                </Text>
                {currentAssignment.bay_line_location ? (
                  <Text style={styles.assignedMachineLoc}>
                    📍 {currentAssignment.bay_line_location}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.assignedFooterRow}>
              <View style={styles.assignedMetaCol}>
                <Text style={styles.assignedMetaLabel}>Meter Reading</Text>
                <Text style={styles.assignedMetaValue}>
                  {currentAssignment.hour_meter_reading ? `${currentAssignment.hour_meter_reading} hrs` : 'N/A'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.signOutBtn}
                onPress={handleSignOut}
                disabled={signingOut}
                activeOpacity={0.8}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="logout" size={15} color="#DC2626" />
                    <Text style={styles.signOutBtnText}>Sign Out</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : currentAssignment && currentAssignment.status === 'pending' ? (
          <View style={styles.pendingRequestCard}>
            <View style={styles.pendingReqHeader}>
              <View style={styles.pendingBadgeRow}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#B45309" />
                <Text style={styles.pendingReqBadgeText}>SIGN-IN PENDING APPROVAL</Text>
              </View>
              <View style={styles.shiftPillSmallAmber}>
                <Text style={styles.shiftPillSmallAmberText}>{currentAssignment.shift || 'Shift A'}</Text>
              </View>
            </View>
            <Text style={styles.pendingReqMachineText}>
              Machine: {currentAssignment.machine_code || 'JCB Asset'}
            </Text>
            <Text style={styles.pendingReqDesc}>
              Your sign-in request is awaiting floor manager review. You will be notified once approved.
            </Text>
            <TouchableOpacity
              style={styles.cancelReqBtn}
              onPress={handleCancelRequest}
              disabled={cancelingReq}
              activeOpacity={0.8}
            >
              {cancelingReq ? (
                <ActivityIndicator size="small" color="#64748B" />
              ) : (
                <Text style={styles.cancelReqBtnText}>Cancel Request</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.signInFormCard}>
            <View style={styles.signInFormHeader}>
              <View style={styles.signInIconBox}>
                <MaterialCommunityIcons name="login-variant" size={20} color="#000000" />
              </View>
              <View>
                <Text style={styles.signInFormTitle}>Daily Machine Sign-In</Text>
                <Text style={styles.signInFormSub}>Choose your machine to start shift logging</Text>
              </View>
            </View>

            {/* Shift Picker Tabs */}
            <Text style={styles.signInFieldLabel}>CURRENT SHIFT</Text>
            <View style={styles.shiftPillsRow}>
              {['Shift A', 'Shift B', 'Shift C'].map((sh) => {
                const isSel = selectedShift === sh;
                return (
                  <TouchableOpacity
                    key={sh}
                    style={[styles.shiftPill, isSel && styles.shiftPillActive]}
                    onPress={() => setSelectedShift(sh)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.shiftPillText, isSel && styles.shiftPillTextActive]}>{sh}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Machine Picker */}
            <Text style={styles.signInFieldLabel}>SELECT SHOP MACHINE</Text>
            {loadingMachines ? (
              <ActivityIndicator size="small" color="#F9B101" style={{ marginVertical: 8 }} />
            ) : availableMachines.length === 0 ? (
              <Text style={styles.noMachText}>No machines available in your shop floor.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.machPillsScroll}>
                {availableMachines.map((m) => {
                  const isSel = selectedMachineId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.machSelectPill, isSel && styles.machSelectPillActive]}
                      onPress={() => setSelectedMachineId(m.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="tractor"
                        size={16}
                        color={isSel ? '#000000' : '#64748B'}
                      />
                      <Text style={[styles.machSelectCode, isSel && styles.machSelectCodeActive]}>
                        {m.machine_code}
                      </Text>
                      {m.name ? (
                        <Text style={[styles.machSelectName, isSel && styles.machSelectNameActive]} numberOfLines={1}>
                          {m.name}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Hour Meter & Notes */}
            <View style={styles.meterInputRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.signInFieldLabel}>HOUR METER (OPTIONAL)</Text>
                <TextInput
                  style={styles.meterTextInput}
                  placeholder="e.g. 1420.5"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={hourMeterReading}
                  onChangeText={setHourMeterReading}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.signInFieldLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={styles.meterTextInput}
                  placeholder="Pre-shift condition"
                  placeholderTextColor="#94A3B8"
                  value={signInNotes}
                  onChangeText={setSignInNotes}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitSignInBtn}
              onPress={handleRequestSignIn}
              disabled={submittingSignIn}
              activeOpacity={0.88}
            >
              {submittingSignIn ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Text style={styles.submitSignInBtnText}>REQUEST MACHINE SIGN-IN</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#000000" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ---------------------------------------------------- */}
        {/* HARSHAL FEATURE: LIVE MAINTENANCE STATUS TRACKING    */}
        {/* ---------------------------------------------------- */}
        {maintenanceOverview ? (
          <View style={styles.maintStatusCard}>
            <View style={styles.maintHeaderRow}>
              <View style={styles.maintHeaderLeft}>
                <MaterialCommunityIcons name="shield-check" size={18} color="#16A34A" />
                <Text style={styles.maintHeaderTitle}>Live Maintenance Telemetry</Text>
              </View>
              <View
                style={[
                  styles.maintConditionBadge,
                  maintenanceOverview.maintenance_condition === 'under_breakdown'
                    ? styles.condBreakdown
                    : maintenanceOverview.maintenance_condition === 'under_maintenance'
                    ? styles.condMaintenance
                    : styles.condRunning,
                ]}
              >
                <Text
                  style={[
                    styles.maintConditionText,
                    maintenanceOverview.maintenance_condition === 'under_breakdown'
                      ? styles.condTextBreakdown
                      : maintenanceOverview.maintenance_condition === 'under_maintenance'
                      ? styles.condTextMaintenance
                      : styles.condTextRunning,
                  ]}
                >
                  {(maintenanceOverview.maintenance_condition || 'OPERATIONAL').replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Active Breakdown Alert if present */}
            {maintenanceOverview.active_breakdown ? (
              <View style={styles.maintAlertBox}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.maintAlertTitle}>
                    Breakdown Ticket: {maintenanceOverview.active_breakdown.complaint_number || 'OPEN'}
                  </Text>
                  <Text style={styles.maintAlertDesc} numberOfLines={2}>
                    {maintenanceOverview.active_breakdown.problem_title}
                  </Text>
                  {maintenanceOverview.active_breakdown.assigned_technician_name ? (
                    <Text style={styles.maintTechText}>
                      Technician Assigned: {maintenanceOverview.active_breakdown.assigned_technician_name}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Active Work Order if present */}
            {maintenanceOverview.active_work_order ? (
              <View style={styles.maintWOBox}>
                <View style={styles.maintWORow}>
                  <Text style={styles.maintWOTitle}>
                    WO #{maintenanceOverview.active_work_order.wo_number}
                  </Text>
                  <Text style={styles.maintWOStatus}>
                    {(maintenanceOverview.active_work_order.status || 'IN PROGRESS').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.maintWODesc} numberOfLines={1}>
                  {maintenanceOverview.active_work_order.title}
                </Text>
                {maintenanceOverview.active_work_order.progress_percentage !== undefined ? (
                  <View style={styles.progressBarWrap}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${Math.min(100, maintenanceOverview.active_work_order.progress_percentage)}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

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
            <Text style={styles.actionTitle}>Report Breakdown</Text>
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
            <Text style={styles.actionTitle}>Daily AM Checklist</Text>
            <Text style={styles.actionSubtitle}>Pre-shift safety, oil level and pressure check</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#64748B" />
        </TouchableOpacity>

        {/* My Reported Problems */}
        <Text style={styles.sectionHeaderTitle}>MY REPORTED PROBLEMS</Text>

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
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
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
  // Assigned Machine Card
  assignedMachineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  assignedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  assignedBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#16A34A',
    letterSpacing: 0.6,
  },
  shiftPillSmall: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  shiftPillSmallText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  assignedMachineBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  assignedIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedMachineInfo: {
    flex: 1,
  },
  assignedMachineCode: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  assignedMachineName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  assignedMachineLoc: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  assignedFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  assignedMetaCol: {
    flexDirection: 'column',
  },
  assignedMetaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  assignedMetaValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  signOutBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  // Pending Request Card
  pendingRequestCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  pendingReqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingReqBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  shiftPillSmallAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftPillSmallAmberText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  pendingReqMachineText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
    marginBottom: 4,
  },
  pendingReqDesc: {
    fontSize: 11.5,
    color: '#92400E',
    lineHeight: 16,
    marginBottom: 10,
  },
  cancelReqBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelReqBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  // Sign In Form Card
  signInFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#F9B101',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },
  signInFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  signInIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInFormTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  signInFormSub: {
    fontSize: 11,
    color: '#64748B',
  },
  signInFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  shiftPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  shiftPillActive: {
    borderColor: '#F9B101',
    backgroundColor: '#FEF3C7',
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  shiftPillTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  noMachText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginVertical: 4,
  },
  machPillsScroll: {
    marginVertical: 4,
  },
  machSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    minWidth: 100,
  },
  machSelectPillActive: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFBEB',
  },
  machSelectCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  machSelectCodeActive: {
    color: '#000000',
  },
  machSelectName: {
    fontSize: 10,
    color: '#64748B',
  },
  machSelectNameActive: {
    color: '#334155',
  },
  meterInputRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  meterTextInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  submitSignInBtn: {
    backgroundColor: '#F9B101',
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  submitSignInBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  // Maintenance Telemetry Card
  maintStatusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  maintHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  maintHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  maintHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  maintConditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  condRunning: {
    backgroundColor: '#DCFCE7',
  },
  condBreakdown: {
    backgroundColor: '#FEE2E2',
  },
  condMaintenance: {
    backgroundColor: '#FFEDD5',
  },
  maintConditionText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  condTextRunning: {
    color: '#16A34A',
  },
  condTextBreakdown: {
    color: '#DC2626',
  },
  condTextMaintenance: {
    color: '#EA580C',
  },
  maintAlertBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  maintAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  maintAlertDesc: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 2,
  },
  maintTechText: {
    fontSize: 10.5,
    color: '#991B1B',
    fontWeight: '600',
    marginTop: 4,
  },
  maintWOBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  maintWORow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  maintWOTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  maintWOStatus: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  maintWODesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
  },
  progressBarWrap: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F9B101',
  },
});
