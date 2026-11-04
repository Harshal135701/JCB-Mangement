import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

export const OperatorDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    assignedMachines: 4,
    operational: 3,
    activeBreakdowns: 1,
    checklistStatus: 'Pending',
  });
  const [recentBreakdowns, setRecentBreakdowns] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/breakdowns');
      if (res.success && res.data) {
        setRecentBreakdowns(res.data.slice(0, 5));
      }
    } catch (e) {
      console.warn('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.userRole}>OPERATOR WORKSTATION</Text>
          <Text style={styles.userName}>{user?.fullName || 'Operator'}</Text>
          <Text style={styles.userShop}>CNC Machining Shop - Bay 1</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboardData} />}
      >
        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { borderLeftColor: COLORS.statusRunning }]}>
            <Text style={styles.kpiValue}>3</Text>
            <Text style={styles.kpiLabel}>Operational</Text>
          </View>
          <View style={[styles.kpiCard, { borderLeftColor: COLORS.statusBreakdown }]}>
            <Text style={[styles.kpiValue, { color: COLORS.statusBreakdown }]}>1</Text>
            <Text style={styles.kpiLabel}>Active Down</Text>
          </View>
        </View>

        {/* Primary Action Buttons */}
        <Text style={styles.sectionTitle}>Shopfloor Actions</Text>

        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() => navigation.navigate('ReportBreakdown')}
        >
          <View style={styles.actionIconBox}>
            <Text style={styles.actionIcon}>⚠️</Text>
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>Report Machine Breakdown</Text>
            <Text style={styles.actionSubtitle}>Tap to log stoppage, fault category & photos</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryActionBtn, styles.inspectionActionBtn]}
          onPress={() => navigation.navigate('DailyInspection')}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#E2E8F0' }]}>
            <Text style={styles.actionIcon}>📋</Text>
          </View>
          <View style={styles.actionTextBox}>
            <Text style={styles.actionTitle}>Pre-Shift Daily Checklist</Text>
            <Text style={styles.actionSubtitle}>Record pressure, temperature, safety guards</Text>
          </View>
        </TouchableOpacity>

        {/* Recent Tickets Tracking */}
        <Text style={styles.sectionTitle}>Live Ticket Tracker</Text>

        {recentBreakdowns.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active breakdown tickets recorded.</Text>
          </View>
        ) : (
          recentBreakdowns.map((t) => (
            <View key={t.id} style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketNo}>{t.ticket_number}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    t.status === 'verified_closed'
                      ? styles.badgeClosed
                      : styles.badgeOpen,
                  ]}
                >
                  <Text style={styles.badgeText}>{t.status.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.ticketMachine}>
                Machine: {t.machine_code || 'JCB-CNC-042'} ({t.machine_name || 'HMC 42'})
              </Text>
              <Text style={styles.ticketIssue}>{t.problem_title}</Text>
              <Text style={styles.ticketMeta}>Category: {t.issue_category} | Priority: {t.priority}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.secondary,
    paddingTop: 45,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRole: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  userShop: {
    color: '#94A3B8',
    fontSize: 12,
  },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  logoutBtnText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 10,
    marginTop: 6,
  },
  primaryActionBtn: {
    backgroundColor: '#FEF08A',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inspectionActionBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketNo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeOpen: {
    backgroundColor: '#FEE2E2',
  },
  badgeClosed: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
  },
  ticketMachine: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  ticketIssue: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  ticketMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
});

