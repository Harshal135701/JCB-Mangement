import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

export const WorkOrdersScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
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

  return (
    <View style={styles.container}>
      {/* Technician Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.userRole}>FIELD MAINTENANCE SPECIALIST</Text>
          <Text style={styles.userName}>{user?.fullName || 'Technician'}</Text>
          <Text style={styles.userShop}>Electrical & Automation Shift Crew</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ALL' && styles.tabItemActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>All WOs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'ASSIGNED' && styles.tabItemActive]}
          onPress={() => setActiveTab('ASSIGNED')}
        >
          <Text style={[styles.tabText, activeTab === 'ASSIGNED' && styles.tabTextActive]}>Assigned</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'IN_PROGRESS' && styles.tabItemActive]}
          onPress={() => setActiveTab('IN_PROGRESS')}
        >
          <Text style={[styles.tabText, activeTab === 'IN_PROGRESS' && styles.tabTextActive]}>Active Wrench</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchWorkOrders} />}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active work orders</Text>
            <Text style={styles.emptySubtitle}>You currently have zero pending emergency tickets.</Text>
          </View>
        ) : (
          filteredOrders.map((wo) => (
            <TouchableOpacity
              key={wo.id}
              style={styles.card}
              onPress={() => navigation.navigate('WorkOrderDetail', { workOrder: wo })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.woNumber}>{wo.wo_number}</Text>
                <View
                  style={[
                    styles.priorityBadge,
                    wo.priority === 'critical' ? styles.badgeCrit : styles.badgeMed,
                  ]}
                >
                  <Text style={styles.priorityText}>{wo.priority?.toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.machineTitle}>
                {wo.machine_code} - {wo.machine_name}
              </Text>
              <Text style={styles.locationText}>Location: {wo.bay_line_location || 'Bay 1 / Line 4'}</Text>
              <Text style={styles.statusText}>Status: <Text style={styles.statusHighlight}>{wo.status?.toUpperCase()}</Text></Text>

              <View style={styles.footerRow}>
                <Text style={styles.timerHint}>Tap to view timer & spares</Text>
                <Text style={styles.arrowIcon}>→</Text>
              </View>
            </TouchableOpacity>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  woNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeCrit: {
    backgroundColor: '#FEE2E2',
  },
  badgeMed: {
    backgroundColor: '#FEF3C7',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
  },
  machineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  statusHighlight: {
    fontWeight: '700',
    color: '#0F172A',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  timerHint: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
});

