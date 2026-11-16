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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { AppHeader } from '../../components/AppHeader';

export const TriageQueueScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const isTechnician = user?.role === 'technician';
  const isOperator = user?.role === 'operator';

  const [activeTab, setActiveTab] = useState<'CMP' | 'WO'>('CMP');
  const [breakdowns, setBreakdowns] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [viewTicketDetail, setViewTicketDetail] = useState<any | null>(null);
  const [selectedWO, setSelectedWO] = useState<any | null>(null);

  // Report Form State
  const [reportForm, setReportForm] = useState({
    machine_id: '',
    shift: 'Shift A',
    issue_category: 'Hydraulic',
    priority: 'high',
    problem_title: '',
    description: '',
    hour_meter_reading: 4500,
  });

  // Assign Form State
  const [assignTechId, setAssignTechId] = useState('');
  const [slaHours, setSlaHours] = useState('2');
  const [instructions, setInstructions] = useState(
    'Inspect valve body, check sensor telemetry, adhere to Lockout-Tagout (LOTO).'
  );

  // Verify Form State
  const [verifyNotes, setVerifyNotes] = useState(
    'Trial run verified. Machine operating under nominal cycle tolerances.'
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ticketsRes, woRes, machRes]: any[] = await Promise.all([
        apiClient.get('/breakdowns').catch(() => ({ data: [] })),
        isOperator ? Promise.resolve({ data: [] }) : apiClient.get('/work-orders').catch(() => ({ data: [] })),
        apiClient.get('/machines?limit=100').catch(() => ({ data: [] })),
      ]);

      setBreakdowns(ticketsRes?.data || []);
      setWorkOrders(woRes?.data || []);
      setMachines(machRes?.data || []);

      if (machRes?.data?.length > 0 && !reportForm.machine_id) {
        setReportForm((prev) => ({ ...prev, machine_id: machRes.data[0].id }));
      }

      // Fetch technicians only for Manager or Admin
      if (!isOperator) {
        try {
          const usersRes: any = await apiClient.get('/auth/users');
          if (usersRes?.success && usersRes.data) {
            const techs = usersRes.data.filter(
              (u: any) => u.role === 'technician' && u.is_active !== false
            );
            setTechnicians(techs);
            if (techs.length > 0 && !assignTechId) {
              setAssignTechId(techs[0].id);
            }
          }
        } catch (uErr) {
          setTechnicians([
            { id: 'f0000000-0000-0000-0000-000000000003', full_name: 'Sunil Yadav', employee_code: 'EMP-TCH-001' },
          ]);
          setAssignTechId('f0000000-0000-0000-0000-000000000003');
        }
      }
    } catch (e) {
      console.warn('Failed to load triage data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReportSubmit = async () => {
    if (!reportForm.machine_id) {
      Alert.alert('Required', 'Please select a machine asset.');
      return;
    }
    if (!reportForm.problem_title) {
      Alert.alert('Required', 'Please enter a problem title.');
      return;
    }

    try {
      setActionLoading(true);
      const res: any = await apiClient.post('/breakdowns', reportForm);
      if (res?.success) {
        Alert.alert(
          'Breakdown Registered',
          res.message || `Breakdown ticket ${res.data?.complaint_number || ''} registered!`
        );
        setIsReportModalOpen(false);
        setReportForm({
          machine_id: machines[0]?.id || '',
          shift: 'Shift A',
          issue_category: 'Hydraulic',
          priority: 'high',
          problem_title: '',
          description: '',
          hour_meter_reading: 4500,
        });
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit breakdown ticket.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignSubmit = async () => {
    if (!selectedTicket || !assignTechId) return;

    try {
      setActionLoading(true);
      const payload = {
        complaint_id: selectedTicket.id,
        technician_id: assignTechId,
        sla_hours: parseInt(slaHours, 10) || 2,
        work_instructions: instructions,
      };

      const res: any = await apiClient.post('/work-orders/assign', payload);
      if (res?.success) {
        Alert.alert('Dispatched', res.message || 'Work order created and technician dispatched!');
        setSelectedTicket(null);
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to allocate technician.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMilestone = async (woId: string, milestone: string) => {
    try {
      const res: any = await apiClient.post(`/work-orders/${woId}/milestone`, { milestone });
      if (res?.success) {
        Alert.alert('Status Updated', `Milestone: ${milestone.replace('_', ' ').toUpperCase()}`);
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Status update failed.');
    }
  };

  const handleVerifySubmit = async (result: 'APPROVED' | 'REJECTED') => {
    if (!selectedWO) return;
    try {
      setActionLoading(true);
      const res: any = await apiClient.post(`/work-orders/${selectedWO.id}/verify`, {
        verification_result: result,
        verification_notes: verifyNotes,
      });
      if (res?.success) {
        Alert.alert(
          'Verification Complete',
          res.message || `Work order ${result === 'APPROVED' ? 'closed and verified' : 'returned for rework'}.`
        );
        setSelectedWO(null);
        fetchData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered breakdowns
  const filteredBreakdowns = useMemo(() => {
    return breakdowns.filter((b) => {
      const matchesSearch =
        b.complaint_number?.toLowerCase().includes(search.toLowerCase()) ||
        b.problem_title?.toLowerCase().includes(search.toLowerCase()) ||
        b.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
        b.machine_name?.toLowerCase().includes(search.toLowerCase());

      const matchesPriority =
        priorityFilter === 'ALL' ? true : b.priority?.toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesPriority;
    });
  }, [breakdowns, search, priorityFilter]);

  // Filtered work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      const matchesSearch =
        w.wo_number?.toLowerCase().includes(search.toLowerCase()) ||
        w.machine_code?.toLowerCase().includes(search.toLowerCase()) ||
        w.technician_name?.toLowerCase().includes(search.toLowerCase());

      return matchesSearch;
    });
  }, [workOrders, search]);

  const openComplaintsCount = breakdowns.filter(
    (b) => b.status === 'new' || b.status === 'pending_review'
  ).length;
  const activeWOsCount = workOrders.filter((w) => w.status !== 'verified_closed').length;

  return (
    <View style={styles.container}>
      {/* Smart CMMS Unified AppHeader */}
      <AppHeader
        title="Breakdown Requests"
        icon="alert-octagon"
        sectionTitle="Breakdown Triage"
        sectionSubtitle="Active equipment stoppages & work orders"
        rightAction={
          <TouchableOpacity
            style={styles.headerReportBtn}
            onPress={() => setIsReportModalOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="alert-octagon" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.headerReportBtnText}>Report Issue</Text>
          </TouchableOpacity>
        }
      />

      {/* Segmented Control / Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'CMP' && styles.tabItemActive]}
          onPress={() => setActiveTab('CMP')}
        >
          <Text style={[styles.tabText, activeTab === 'CMP' && styles.tabTextActive]}>
            Breakdowns ({openComplaintsCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'WO' && styles.tabItemActive]}
          onPress={() => setActiveTab('WO')}
        >
          <Text style={[styles.tabText, activeTab === 'WO' && styles.tabTextActive]}>
            Work Orders ({activeWOsCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={activeTab === 'CMP' ? 'Filter complaints by ticket, machine...' : 'Filter work orders by WO, tech...'}
            placeholderTextColor="#94A3B8"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearchIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeTab === 'CMP' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.priorityScroll}>
            {['ALL', 'critical', 'high', 'medium', 'low'].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.pChip, priorityFilter === p && styles.pChipActive]}
                onPress={() => setPriorityFilter(p)}
              >
                <Text style={[styles.pChipText, priorityFilter === p && styles.pChipTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchData}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {activeTab === 'CMP' ? (
          /* Operator Complaints List */
          <View style={styles.listContainer}>
            {filteredBreakdowns.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No operator complaints match your filter.</Text>
                <Text style={styles.emptySub}>All plant machines are running nominal cycle times.</Text>
              </View>
            ) : (
              filteredBreakdowns.map((ticket) => (
                <TouchableOpacity
                  key={ticket.id}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => setViewTicketDetail(ticket)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.rowAlign}>
                      <Text style={styles.ticketNum}>{ticket.complaint_number}</Text>
                      <View
                        style={[
                          styles.priorityBadge,
                          ticket.priority === 'critical' ? styles.badgeCrit : styles.badgeMed,
                        ]}
                      >
                        <Text style={styles.priorityText}>{ticket.priority?.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.timeText}>
                      {ticket.reported_at ? new Date(ticket.reported_at).toLocaleTimeString() : 'Just now'}
                    </Text>
                  </View>

                  <Text style={styles.problemTitle}>{ticket.problem_title}</Text>
                  <Text style={styles.machineInfo}>
                    Machine: <Text style={styles.boldText}>{ticket.machine_code}</Text> ({ticket.machine_name})
                  </Text>

                  {ticket.description ? (
                    <View style={styles.descBox}>
                      <Text style={styles.descText} numberOfLines={2}>
                        {ticket.description}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.categoryText}>
                      Category: <Text style={styles.boldText}>{ticket.issue_category}</Text>
                    </Text>

                    {isManager && ticket.status !== 'work_order_created' && ticket.status !== 'closed' ? (
                      <TouchableOpacity
                        style={styles.dispatchBtn}
                        onPress={() => setSelectedTicket(ticket)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dispatchBtnText}>👤 DISPATCH TECH</Text>
                      </TouchableOpacity>
                    ) : ticket.status === 'work_order_created' ? (
                      <View style={styles.dispatchedBadge}>
                        <Text style={styles.dispatchedBadgeText}>WO DISPATCHED</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          /* Active Work Orders List */
          <View style={styles.listContainer}>
            {filteredWorkOrders.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🛠️</Text>
                <Text style={styles.emptyText}>No active work orders in execution.</Text>
                <Text style={styles.emptySub}>Technicians have resolved all dispatched tickets.</Text>
              </View>
            ) : (
              filteredWorkOrders.map((wo) => {
                const isAssigned = wo.status === 'assigned';
                const isDiagnosis = wo.status === 'under_diagnosis';
                const isInProgress = wo.status === 'in_progress';
                const isSubmitted = wo.status === 'submitted_verification';
                const isClosed = wo.status === 'verified_closed';

                return (
                  <View key={wo.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.rowAlign}>
                        <Text style={styles.woNum}>{wo.wo_number}</Text>
                        <View style={[styles.statusBadge, isClosed ? styles.badgeClosed : styles.badgeBlue]}>
                          <Text style={styles.statusBadgeText}>
                            {wo.status?.replace('_', ' ')?.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.slaBadge}>
                        <Text style={styles.slaText}>
                          SLA: {wo.sla_deadline ? new Date(wo.sla_deadline).toLocaleTimeString() : '2 hrs'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.machineInfo}>
                      Machine: <Text style={styles.boldText}>{wo.machine_code || 'Asset'}</Text>
                    </Text>
                    <Text style={styles.techInfo}>
                      Technician: <Text style={styles.boldText}>{wo.technician_name || 'Assigned Tech'}</Text>
                    </Text>

                    <View style={styles.descBox}>
                      <Text style={styles.descText}>
                        Instructions: {wo.work_instructions || 'Diagnose and restore machine operating condition.'}
                      </Text>
                    </View>

                    {/* Milestones & Actions */}
                    <View style={styles.actionsRow}>
                      {(isTechnician || isManager) && !isClosed && (
                        <View style={styles.milestoneButtonGroup}>
                          {isAssigned && (
                            <TouchableOpacity
                              style={styles.milestoneBtnDark}
                              onPress={() => handleMilestone(wo.id, 'accepted')}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.milestoneBtnTextWhite}>Accept Job</Text>
                            </TouchableOpacity>
                          )}
                          {(isAssigned || wo.status === 'accepted') && (
                            <TouchableOpacity
                              style={styles.milestoneBtnAmber}
                              onPress={() => handleMilestone(wo.id, 'under_diagnosis')}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.milestoneBtnTextBlack}>Under Diagnosis</Text>
                            </TouchableOpacity>
                          )}
                          {isDiagnosis && (
                            <TouchableOpacity
                              style={styles.milestoneBtnBlue}
                              onPress={() => handleMilestone(wo.id, 'in_progress')}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.milestoneBtnTextWhite}>In Progress</Text>
                            </TouchableOpacity>
                          )}
                          {isInProgress && (
                            <TouchableOpacity
                              style={styles.milestoneBtnGreen}
                              onPress={() => handleMilestone(wo.id, 'submitted_verification')}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.milestoneBtnTextWhite}>Submit Complete</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Manager Verification */}
                      {isManager && isSubmitted && (
                        <TouchableOpacity
                          style={styles.verifyBtn}
                          onPress={() => setSelectedWO(wo)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.verifyBtnText}>✓ VERIFY & CLOSE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* MODAL: View Ticket Details */}
      {viewTicketDetail && (
        <Modal visible={!!viewTicketDetail} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTicketNum}>{viewTicketDetail.complaint_number}</Text>
                  <Text style={styles.modalTicketTitle}>{viewTicketDetail.problem_title}</Text>
                </View>
                <TouchableOpacity onPress={() => setViewTicketDetail(null)} style={styles.closeBtn}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Machine Asset</Text>
                    <Text style={styles.detailVal}>
                      {viewTicketDetail.machine_code} ({viewTicketDetail.machine_name})
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Issue Category</Text>
                    <Text style={styles.detailVal}>{viewTicketDetail.issue_category}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Priority / Severity</Text>
                    <Text style={[styles.detailVal, { color: '#B91C1C', fontWeight: '900' }]}>
                      {viewTicketDetail.priority?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Reported Time</Text>
                    <Text style={styles.detailVal}>
                      {viewTicketDetail.reported_at
                        ? new Date(viewTicketDetail.reported_at).toLocaleString()
                        : 'Just now'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Symptoms & Observations</Text>
                <View style={styles.symptomsBox}>
                  <Text style={styles.symptomsText}>
                    {viewTicketDetail.description || 'No additional symptoms reported.'}
                  </Text>
                </View>

                {isManager && viewTicketDetail.status !== 'work_order_created' && (
                  <TouchableOpacity
                    style={styles.modalDispatchBtn}
                    onPress={() => {
                      const t = viewTicketDetail;
                      setViewTicketDetail(null);
                      setSelectedTicket(t);
                    }}
                  >
                    <Text style={styles.modalDispatchBtnText}>👤 Dispatch Maintenance Technician</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL: Report Breakdown (CMP) */}
      <Modal visible={isReportModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.cmpBadge}>
                  <Text style={styles.cmpBadgeText}>CMP</Text>
                </View>
                <Text style={styles.modalTitle}>REPORT BREAKDOWN COMPLAINT</Text>
              </View>
              <TouchableOpacity onPress={() => setIsReportModalOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Select Machine Asset *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {machines.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.selectChip, reportForm.machine_id === m.id && styles.selectChipActive]}
                    onPress={() => setReportForm({ ...reportForm, machine_id: m.id })}
                  >
                    <Text style={[styles.selectChipText, reportForm.machine_id === m.id && styles.selectChipTextActive]}>
                      {m.machine_code} ({m.name})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Issue Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {['Hydraulic', 'Mechanical', 'Electrical', 'PLC / Automation', 'Pneumatic', 'Tooling'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.selectChip, reportForm.issue_category === cat && styles.selectChipActive]}
                    onPress={() => setReportForm({ ...reportForm, issue_category: cat })}
                  >
                    <Text style={[styles.selectChipText, reportForm.issue_category === cat && styles.selectChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Breakdown Severity / Priority *</Text>
              <View style={styles.chipRow}>
                {[
                  { key: 'critical', label: 'Critical (Line Stoppage)' },
                  { key: 'high', label: 'High (Machine Down)' },
                  { key: 'medium', label: 'Medium (Noise/Vibration)' },
                  { key: 'low', label: 'Low (Minor Sensor)' },
                ].map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.selectChip, reportForm.priority === p.key && styles.selectChipActive]}
                    onPress={() => setReportForm({ ...reportForm, priority: p.key })}
                  >
                    <Text style={[styles.selectChipText, reportForm.priority === p.key && styles.selectChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Problem Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={reportForm.problem_title}
                onChangeText={(t) => setReportForm({ ...reportForm, problem_title: t })}
                placeholder="e.g. Spindle servo error 401 or Hydraulic pressure drop"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.fieldLabel}>Symptoms & Observations *</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={reportForm.description}
                onChangeText={(t) => setReportForm({ ...reportForm, description: t })}
                placeholder="Detail visible symptoms, smell, hydraulic leaks, or error codes displayed on HMI panel..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsReportModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitCmpBtn}
                  onPress={handleReportSubmit}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitCmpBtnText}>SUBMIT BREAKDOWN TICKET</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: Dispatch Technician (Manager) */}
      {selectedTicket && (
        <Modal visible={!!selectedTicket} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  DISPATCH TECHNICIAN: {selectedTicket.complaint_number}
                </Text>
                <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.ticketSummaryBox}>
                  <Text style={styles.boldText}>{selectedTicket.problem_title}</Text>
                  <Text style={styles.summarySub}>Machine: {selectedTicket.machine_code}</Text>
                </View>

                <Text style={styles.fieldLabel}>Assign Maintenance Technician *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {technicians.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.selectChip, assignTechId === t.id && styles.selectChipActive]}
                      onPress={() => setAssignTechId(t.id)}
                    >
                      <Text style={[styles.selectChipText, assignTechId === t.id && styles.selectChipTextActive]}>
                        {t.full_name} ({t.employee_code})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Expected Resolution SLA (Hours) *</Text>
                <View style={styles.chipRow}>
                  {['1', '2', '4', '8'].map((hr) => (
                    <TouchableOpacity
                      key={hr}
                      style={[styles.selectChip, slaHours === hr && styles.selectChipActive]}
                      onPress={() => setSlaHours(hr)}
                    >
                      <Text style={[styles.selectChipText, slaHours === hr && styles.selectChipTextActive]}>
                        {hr} Hours
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Work Instructions & Safety SOP</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setSelectedTicket(null)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitDispatchBtn}
                    onPress={handleAssignSubmit}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.submitDispatchBtnText}>AUTHORIZE & DISPATCH WO</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* MODAL: Verify & Close Work Order (Manager) */}
      {selectedWO && (
        <Modal visible={!!selectedWO} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  VERIFY WORK ORDER: {selectedWO.wo_number}
                </Text>
                <TouchableOpacity onPress={() => setSelectedWO(null)}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.ticketSummaryBox}>
                  <Text style={styles.boldText}>Machine: {selectedWO.machine_code}</Text>
                  <Text style={styles.summarySub}>Technician: {selectedWO.technician_name}</Text>
                </View>

                <Text style={styles.fieldLabel}>Manager Verification Notes *</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  value={verifyNotes}
                  onChangeText={setVerifyNotes}
                  placeholder="Verify cycle time test, part alignment, safety interlocks restored..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                />

                <View style={[styles.modalActions, { justifyContent: 'space-between' }]}>
                  <TouchableOpacity
                    style={styles.reworkBtn}
                    onPress={() => handleVerifySubmit('REJECTED')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.reworkBtnText}>Rework Required</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleVerifySubmit('APPROVED')}
                    disabled={actionLoading}
                  >
                    <Text style={styles.approveBtnText}>Approve & Close Ticket</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
  headerReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerReportBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },
  searchFilterRow: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 6,
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
  priorityScroll: {
    flexDirection: 'row',
  },
  pChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pChipActive: {
    backgroundColor: '#F9B101',
    borderColor: '#F9B101',
  },
  pChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  pChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  scroll: {
    padding: 14,
    paddingBottom: 30,
  },
  listContainer: {
    gap: 12,
  },
  emptyBox: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  emptyText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 11,
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
    alignItems: 'center',
    marginBottom: 6,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketNum: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  woNum: {
    fontSize: 13,
    fontWeight: '900',
    color: '#09090B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeCrit: {
    backgroundColor: '#FEE2E2',
  },
  badgeMed: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#991B1B',
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  problemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#09090B',
    marginTop: 2,
  },
  machineInfo: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 2,
  },
  techInfo: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 1,
  },
  boldText: {
    color: '#000000',
    fontWeight: '800',
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 8,
  },
  descText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    lineHeight: 15,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  categoryText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  dispatchBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  dispatchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  dispatchedBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dispatchedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#065F46',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeBlue: {
    backgroundColor: '#EFF6FF',
  },
  badgeClosed: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E40AF',
  },
  slaBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  slaText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 6,
  },
  milestoneButtonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  milestoneBtnDark: {
    backgroundColor: '#18181B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  milestoneBtnAmber: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  milestoneBtnBlue: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  milestoneBtnGreen: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  milestoneBtnTextWhite: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  milestoneBtnTextBlack: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '900',
  },
  verifyBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
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
  modalTicketNum: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalTicketTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cmpBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cmpBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
    flex: 1,
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
  detailGrid: {
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 11,
    color: '#09090B',
    fontWeight: '800',
  },
  symptomsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  symptomsText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  modalDispatchBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  modalDispatchBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
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
  chipScroll: {
    flexDirection: 'row',
    marginBottom: 6,
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
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
    marginBottom: 4,
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
  modalInput: {
    height: 44,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    fontWeight: '600',
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  ticketSummaryBox: {
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
  submitCmpBtn: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  submitCmpBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  submitDispatchBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
  },
  submitDispatchBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
  },
  reworkBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  reworkBtnText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
  },
  approveBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
