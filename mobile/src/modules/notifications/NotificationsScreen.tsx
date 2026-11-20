import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppHeader } from '../../components/AppHeader';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface NotificationItem {
  id: string;
  recipient_id?: string;
  title: string;
  message: string;
  type?: 'approval' | 'critical' | 'alert' | 'assignment' | 'warning' | 'info' | string;
  link_url?: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userRole = (user?.role || 'operator').toLowerCase();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/notifications?limit=50');
      if (res?.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark single notification as read
  const handleMarkAsRead = async (item: NotificationItem) => {
    if (!item.is_read) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await apiClient.put(`/notifications/${item.id}/read`);
      } catch (err) {
        console.warn('Failed to mark notification as read:', err);
      }
    }

    // Role-aware navigation resolver
    const rawUrl = (item.link_url || '').toLowerCase();
    const entityType = (item.entity_type || '').toLowerCase();

    if (item.type === 'approval' || rawUrl.includes('/users') || entityType === 'user_approval') {
      navigation.navigate('UserManagement');
      return;
    }

    if (
      rawUrl.includes('/breakdowns') ||
      rawUrl.includes('/triage') ||
      entityType === 'maintenance_requests' ||
      entityType === 'breakdowns'
    ) {
      if (userRole === 'technician') {
        navigation.navigate('WorkOrders');
      } else if (userRole === 'operator') {
        navigation.navigate('OperatorTab');
      } else {
        navigation.navigate('TriageQueue');
      }
      return;
    }

    if (rawUrl.includes('/work-orders') || entityType === 'work_orders') {
      navigation.navigate('WorkOrders');
      return;
    }

    if (rawUrl.includes('/procurement') || entityType === 'purchase_requisitions') {
      navigation.navigate('Procurement');
      return;
    }

    if (rawUrl.includes('/rdc') || entityType === 'gate_pass') {
      navigation.navigate('RDC');
      return;
    }

    if (rawUrl.includes('/inspections') || entityType === 'inspections') {
      navigation.navigate('DailyInspection');
      return;
    }

    if (rawUrl.includes('/machines') || entityType === 'machine') {
      navigation.navigate('MachinesMaster');
      return;
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await apiClient.put('/notifications/mark-all-read');
    } catch (err) {
      console.warn('Failed to mark all as read:', err);
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'UNREAD') {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Relative timestamp formatter
  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Helper for notification type visuals
  const getTypeMeta = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'critical':
      case 'alert':
        return {
          icon: 'alert-circle',
          color: '#DC2626',
          bg: '#FEE2E2',
          label: 'CRITICAL',
        };
      case 'approval':
        return {
          icon: 'account-clock',
          color: '#7C3AED',
          bg: '#EDE9FE',
          label: 'APPROVAL',
        };
      case 'assignment':
        return {
          icon: 'wrench-clock',
          color: '#2563EB',
          bg: '#DBEAFE',
          label: 'ASSIGNMENT',
        };
      case 'warning':
        return {
          icon: 'alert-triangle',
          color: '#D97706',
          bg: '#FEF3C7',
          label: 'WARNING',
        };
      default:
        return {
          icon: 'information',
          color: '#0F172A',
          bg: '#F1F5F9',
          label: 'SYSTEM',
        };
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Notifications"
        icon="bell"
        sectionTitle="SYSTEM NOTIFICATIONS"
        sectionSubtitle="Real-time alerts, approvals & assignments"
        showBack={true}
        onBack={() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
          else navigation?.navigate?.('MainTabs');
        }}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="check-all" size={20} color="#000000" />
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeFilter === 'ALL' && styles.tabBtnActive]}
            onPress={() => setActiveFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeFilter === 'ALL' && styles.tabLabelActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeFilter === 'UNREAD' && styles.tabBtnActive]}
            onPress={() => setActiveFilter('UNREAD')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeFilter === 'UNREAD' && styles.tabLabelActive]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.quickMarkAllLink}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="check-all" size={14} color="#D97706" />
            <Text style={styles.quickMarkAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.loadingText}>Fetching system notifications...</Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="bell-off-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySub}>
            {activeFilter === 'UNREAD'
              ? 'You are all caught up! No unread notifications.'
              : 'There are no notifications for your account at this moment.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchNotifications} />}
        >
          {filteredNotifications.map((item) => {
            const meta = getTypeMeta(item.type);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notifCard, !item.is_read && styles.notifCardUnread]}
                onPress={() => handleMarkAsRead(item)}
                activeOpacity={0.8}
              >
                {/* Type Icon */}
                <View style={[styles.notifIconWrap, { backgroundColor: meta.bg }]}>
                  <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
                </View>

                {/* Content */}
                <View style={styles.notifContentCol}>
                  <View style={styles.notifHeaderRow}>
                    <View style={styles.notifTitleWrap}>
                      {!item.is_read && <View style={styles.unreadBlueDot} />}
                      <Text
                        style={[styles.notifTitle, !item.is_read && styles.notifTitleBold]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </View>
                    <Text style={styles.notifTime}>{formatTimeAgo(item.created_at)}</Text>
                  </View>

                  <Text style={styles.notifMessage} numberOfLines={3}>
                    {item.message}
                  </Text>

                  <View style={styles.notifFooterRow}>
                    <View style={[styles.notifTypeBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.notifTypeText, { color: meta.color }]}>
                        {meta.label}
                      </Text>
                    </View>

                    <View style={styles.openActionRow}>
                      <Text style={styles.openActionText}>Open</Text>
                      <MaterialCommunityIcons name="chevron-right" size={16} color="#64748B" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  markAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: '#0F172A',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  quickMarkAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickMarkAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FDE68A',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notifIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContentCol: {
    flex: 1,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notifTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  unreadBlueDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2563EB',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  notifTitleBold: {
    fontWeight: '900',
    color: '#0F172A',
  },
  notifTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  notifMessage: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
    marginBottom: 8,
  },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notifTypeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  openActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  loadingBox: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
