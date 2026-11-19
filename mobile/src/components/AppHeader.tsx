import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import apiClient from '../services/api';

const JCB_HEADER_BADGE = require('../assets/jcb_header_badge.png');

interface AppHeaderProps {
  title: string;
  icon?: string;
  sectionTitle?: string;
  sectionSubtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  onBreadcrumbPress?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  icon = 'home-outline',
  sectionTitle,
  sectionSubtitle,
  showBack = false,
  onBack,
  rightAction,
  onBreadcrumbPress,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { openSidebar } = useSidebar();

  const [unreadCount, setUnreadCount] = React.useState(0);

  // Poll for live unread notification count
  React.useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res: any = await apiClient.get('/notifications/unread-count');
        if (isMounted) {
          if (typeof res?.unread_count === 'number') {
            setUnreadCount(res.unread_count);
          } else if (typeof res?.data?.unread_count === 'number') {
            setUnreadCount(res.data.unread_count);
          }
        }
      } catch {
        // Non-blocking
      }
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 25000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const displayName = user?.fullName?.split(' ')[0] || user?.employeeCode || 'Vikas Verma';
  const roleName = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
    : 'Manager';

  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" translucent={false} />

      {/* Top Dark Header */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        {/* Top-left yellow corner wedge */}
        <View style={styles.headerYellowSlice} />

        {/* Left Side: Navigation & Brand */}
        <View style={styles.headerLeft}>
          {showBack ? (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.navBtn}
              onPress={openSidebar}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons name="menu" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

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

        {/* Right Side: Bell & User Profile Chip */}
        <View style={styles.headerRightCol}>
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => navigation?.navigate?.('Notifications')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="bell-outline" size={20} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.userProfileChip}
            onPress={openSidebar}
            activeOpacity={0.8}
          >
            <View style={styles.userAvatarCircle}>
              <MaterialCommunityIcons name="account" size={17} color="#0F172A" />
            </View>
            <View style={styles.userInfoCol}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.userRoleRow}>
                <Text style={styles.userRoleText}>{roleName}</Text>
                <MaterialCommunityIcons name="chevron-down" size={11} color="#94A3B8" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Yellow Breadcrumb Banner */}
      <TouchableOpacity
        style={styles.breadcrumbBanner}
        activeOpacity={0.9}
        onPress={onBreadcrumbPress}
      >
        <View style={styles.breadcrumbLeft}>
          <MaterialCommunityIcons name={icon} size={20} color="#000000" />
          <Text style={styles.breadcrumbTitle}>{title}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#000000" />
      </TouchableOpacity>

      {/* Section Title Header (Optional) */}
      {sectionTitle && (
        <View style={styles.sectionTitleBlock}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.yellowIndicatorBar} />
            <Text style={styles.sectionMainTitle}>{sectionTitle}</Text>
            {rightAction && <View style={styles.rightActionWrap}>{rightAction}</View>}
          </View>
          {sectionSubtitle && (
            <Text style={styles.sectionSubtitle}>{sectionSubtitle}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
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
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightWidth: 46,
    borderTopWidth: 46,
    borderRightColor: 'transparent',
    borderTopColor: '#F9B101',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  navBtn: {
    padding: 4,
    marginRight: 8,
  },
  brandBadgeWrap: {
    marginRight: 8,
  },
  headerJcbLogo: {
    width: 66,
    height: 26,
  },
  headerDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#334155',
    marginRight: 8,
  },
  headerTitleCol: {
    justifyContent: 'center',
  },
  smartCmmsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  smartCmmsSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  userProfileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: 140,
    zIndex: 2,
  },
  userAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  userInfoCol: {
    justifyContent: 'center',
  },
  userNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 70,
  },
  userRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  userRoleText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
  breadcrumbBanner: {
    backgroundColor: '#F9B101',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  breadcrumbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.3,
  },
  sectionTitleBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  rightActionWrap: {
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginLeft: 12,
  },
});

