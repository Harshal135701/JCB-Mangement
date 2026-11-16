import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  BackHandler,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../config/constants';

const JCB_HEADER_BADGE = require('../assets/jcb_header_badge.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

interface AdminSidebarProps {
  visible: boolean;
  onClose: () => void;
  navigation: any;
  user: any;
  logout?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  iconBg: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  visible,
  onClose,
  navigation,
  user,
  logout,
}) => {
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : insets.top;
  const safeTopPadding = Math.max(statusBarHeight, insets.top, 20);

  // Close drawer on Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const backAction = () => {
      onClose();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [visible, onClose]);

  const handleNavigate = (screenName: string, params?: any) => {
    onClose();
    setTimeout(() => {
      navigation?.navigate?.(screenName, params);
    }, 120);
  };

  const role = (user?.role || 'operator').toLowerCase();
  const isOperator = role === 'operator';
  const isTechnician = role === 'technician' || role === 'maintenance_engineer';
  const isManager = role === 'manager';
  const isAdmin = role === 'admin' || role === 'plant_admin' || role === 'enterprise_admin';

  // Role metadata and styling (English only)
  const roleDisplay = React.useMemo(() => {
    if (isAdmin) {
      return {
        title: 'System Admin',
        subtitle: 'Enterprise Control',
        icon: 'shield-crown',
        color: '#7C3AED',
        bg: '#EDE9FE',
      };
    }
    if (isManager) {
      return {
        title: 'Plant Manager',
        subtitle: 'Shift & Operations',
        icon: 'clipboard-check',
        color: '#059669',
        bg: '#D1FAE5',
      };
    }
    if (isTechnician) {
      return {
        title: 'Technician',
        subtitle: 'Maintenance Specialist',
        icon: 'wrench',
        color: '#2563EB',
        bg: '#DBEAFE',
      };
    }
    return {
      title: 'Machine Operator',
      subtitle: 'Line Operations',
      icon: 'hard-hat',
      color: '#D97706',
      bg: '#FEF3C7',
    };
  }, [isAdmin, isManager, isTechnician]);

  // Clean, simple English menu sections
  const menuSections: MenuSection[] = React.useMemo(() => {
    // 1. Operator Menu: Flat, clean 5 big buttons
    if (isOperator) {
      return [
        {
          title: 'MAIN MENU',
          items: [
            {
              id: 'OperatorTab',
              label: 'Home',
              icon: 'home',
              iconColor: '#0F172A',
              iconBg: '#F1F5F9',
            },
            {
              id: 'ReportBreakdownTab',
              label: 'Report Breakdown',
              icon: 'alert-circle',
              iconColor: '#DC2626',
              iconBg: '#FEE2E2',
            },
            {
              id: 'MachinesTab',
              label: 'Machines & QR Scan',
              icon: 'tractor',
              iconColor: '#B45309',
              iconBg: '#FEF3C7',
            },
            {
              id: 'DailyInspection',
              label: 'Daily Checklist',
              icon: 'clipboard-check',
              iconColor: '#16A34A',
              iconBg: '#DCFCE7',
            },
            {
              id: 'TriageTab',
              label: 'My Tickets',
              icon: 'ticket-confirmation',
              iconColor: '#2563EB',
              iconBg: '#DBEAFE',
            },
          ],
        },
      ];
    }

    // 2. Technician Menu: Simple 5 big buttons
    if (isTechnician) {
      return [
        {
          title: 'MAINTENANCE MENU',
          items: [
            {
              id: 'WorkOrdersTab',
              label: 'My Work Orders',
              icon: 'wrench-clock',
              iconColor: '#2563EB',
              iconBg: '#DBEAFE',
            },
            {
              id: 'TriageTab',
              label: 'Breakdowns Queue',
              icon: 'alert-circle',
              iconColor: '#DC2626',
              iconBg: '#FEE2E2',
            },
            {
              id: 'MachinesTab',
              label: 'Machines & QR Scan',
              icon: 'tractor',
              iconColor: '#B45309',
              iconBg: '#FEF3C7',
            },
            {
              id: 'SparesTab',
              label: 'Spare Parts',
              icon: 'package-variant-closed',
              iconColor: '#7C3AED',
              iconBg: '#EDE9FE',
            },
            {
              id: 'PMCalendar',
              label: 'PM Schedule',
              icon: 'calendar-clock',
              iconColor: '#059669',
              iconBg: '#D1FAE5',
            },
          ],
        },
      ];
    }

    // 3. Admin & Manager: Categorized, clean English sections
    const sections: MenuSection[] = [
      {
        title: 'SHOPFLOOR OPERATIONS',
        items: [
          {
            id: 'ShopfloorTab',
            label: 'Shop Floor Overview',
            icon: 'view-dashboard',
            iconColor: '#0F172A',
            iconBg: '#F1F5F9',
          },
          {
            id: 'TriageTab',
            label: 'Breakdowns & Triage',
            icon: 'alert-circle',
            iconColor: '#DC2626',
            iconBg: '#FEE2E2',
          },
          {
            id: 'MachinesTab',
            label: 'Machines & Assets',
            icon: 'tractor',
            iconColor: '#B45309',
            iconBg: '#FEF3C7',
          },
          {
            id: 'SparesTab',
            label: 'Spare Parts Inventory',
            icon: 'package-variant-closed',
            iconColor: '#7C3AED',
            iconBg: '#EDE9FE',
          },
        ],
      },
      {
        title: 'PLANNING & REPORTS',
        items: [
          {
            id: 'OperationsTab',
            label: 'Operations Hub & KPIs',
            icon: 'chart-box-outline',
            iconColor: '#2563EB',
            iconBg: '#DBEAFE',
          },
          {
            id: 'PMCalendar',
            label: 'PM Maintenance Plan',
            icon: 'calendar-clock',
            iconColor: '#059669',
            iconBg: '#D1FAE5',
          },
          {
            id: 'DowntimeAnalytics',
            label: 'Downtime Analytics',
            icon: 'chart-timeline-variant',
            iconColor: '#EA580C',
            iconBg: '#FFEDD5',
          },
          {
            id: 'Procurement',
            label: 'Procurement Approvals',
            icon: 'cart-outline',
            iconColor: '#0284C7',
            iconBg: '#E0F2FE',
          },
          {
            id: 'RDC',
            label: 'RDC Gate Passes',
            icon: 'truck-fast-outline',
            iconColor: '#475569',
            iconBg: '#F1F5F9',
          },
        ],
      },
    ];

    if (isAdmin) {
      sections.push({
        title: 'ADMIN & SECURITY',
        items: [
          {
            id: 'UserManagement',
            label: 'Users & Permissions',
            icon: 'account-group-outline',
            iconColor: '#7C3AED',
            iconBg: '#EDE9FE',
          },
          {
            id: 'AuditLogs',
            label: 'Audit Trail Ledger',
            icon: 'shield-check-outline',
            iconColor: '#16A34A',
            iconBg: '#DCFCE7',
          },
        ],
      });
    }

    return sections;
  }, [isOperator, isTechnician, isAdmin]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      {/* Drawer Container */}
      <View
        style={[
          styles.drawerContainer,
          {
            width: DRAWER_WIDTH,
            paddingTop: safeTopPadding,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* Simple & Clean Header */}
        <View style={styles.header}>
          <Image
            source={JCB_HEADER_BADGE}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* User / Worker Profile Card */}
        <View style={styles.workerCard}>
          <View
            style={[
              styles.workerAvatar,
              isAdmin && styles.adminAvatar,
            ]}
          >
            <Text style={styles.avatarLetter}>
              {String(user?.fullName || user?.employeeCode || (isAdmin ? 'A' : 'W')).charAt(0).toUpperCase()}
            </Text>
            {isAdmin && (
              <View style={styles.adminCrownBadge}>
                <MaterialCommunityIcons name="crown" size={11} color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.workerInfo}>
            <Text style={styles.workerName} numberOfLines={1}>
              {user?.fullName || (isAdmin ? 'System Administrator' : 'JCB Worker')}
            </Text>
            <View style={[styles.roleTag, { backgroundColor: roleDisplay.bg }]}>
              <MaterialCommunityIcons
                name={roleDisplay.icon}
                size={13}
                color={roleDisplay.color}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.roleText, { color: roleDisplay.color }]}>
                {roleDisplay.title}
              </Text>
            </View>
          </View>
        </View>

        {/* Big, Easy Tap Menu Buttons Grouped by Section */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {menuSections.map((section, sIdx) => (
            <View key={sIdx} style={styles.sectionWrap}>
              <View style={styles.menuDivider}>
                <Text style={styles.menuHeading}>{section.title}</Text>
              </View>

              <View style={styles.sectionItemsList}>
                {section.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.menuItemBtn}
                    onPress={() => handleNavigate(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Big Colorful Icon Box */}
                    <View style={[styles.itemIconBox, { backgroundColor: item.iconBg }]}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={22}
                        color={item.iconColor}
                      />
                    </View>

                    {/* Clean English Label */}
                    <Text style={styles.menuItemLabel}>{item.label}</Text>

                    {/* Chevron Arrow */}
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color="#CBD5E1"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Big Clean Sign Out Button */}
        {logout && (
          <View style={styles.footerArea}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                onClose();
                logout();
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={styles.plantTag}>JCB Ballabgarh Works • Shift A</Text>
          </View>
        )}
      </View>

      {/* Tap outside to close backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    flex: 1,
    height: '100%',
  },
  drawerContainer: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 20,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 16,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerLogo: {
    width: 80,
    height: 32,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Worker & Admin Profile Card */
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  adminAvatar: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
  },
  adminCrownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Sections */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  sectionWrap: {
    marginBottom: 12,
  },
  menuDivider: {
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuHeading: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  sectionItemsList: {
    gap: 7,
  },

  /* Big Touch Target Menu Item (English Only) */
  menuItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    gap: 12,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Footer */
  footerArea: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#DC2626',
  },
  plantTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
});
