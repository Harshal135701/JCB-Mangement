import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import { AdminSidebar } from '../components/AdminSidebar';
import { COLORS } from '../config/constants';

// Screens
import { LoginScreen } from '../modules/auth/LoginScreen';
import { OperatorSignUpScreen } from '../modules/auth/OperatorSignUpScreen';
import { ShopFloorDashboardScreen } from '../modules/manager/ShopFloorDashboardScreen';
import { TriageQueueScreen } from '../modules/breakdowns/TriageQueueScreen';
import { MachineMasterScreen } from '../modules/machines/MachineMasterScreen';
import { InventoryCatalogScreen } from '../modules/inventory/InventoryCatalogScreen';
import { OperationsHubScreen } from '../modules/operations/OperationsHubScreen';

// Sub / Detail Screens
import { ProcurementScreen } from '../modules/procurement/ProcurementScreen';
import { RDCScreen } from '../modules/rdc/RDCScreen';
import { PreShiftInspectionScreen } from '../modules/inspections/PreShiftInspectionScreen';
import { PMCalendarScreen } from '../modules/pm/PMCalendarScreen';
import { DowntimeAnalyticsScreen } from '../modules/downtime/DowntimeAnalyticsScreen';
import { AuditLogsScreen } from '../modules/audit/AuditLogsScreen';
import { UserManagementScreen } from '../modules/users/UserManagementScreen';
import { WorkOrdersScreen } from '../modules/technician/WorkOrdersScreen';
import { WorkOrderDetailScreen } from '../modules/work-orders/WorkOrderDetailScreen';
import { PartSearchScreen } from '../modules/inventory/PartSearchScreen';
import { ReportBreakdownScreen } from '../modules/breakdowns/ReportBreakdownScreen';
import { OperatorDashboardScreen } from '../modules/operator/OperatorDashboardScreen';
import { SplashScreen } from '../modules/splash/SplashScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

interface TabIconProps {
  focused: boolean;
  activeIcon: string;
  inactiveIcon: string;
  badge?: number | string;
}

const BlinkitTabIcon = React.memo(({ focused, activeIcon, inactiveIcon, badge }: TabIconProps) => {
  return (
    <View style={tabStyles.iconWrapper}>
      {focused && <View style={tabStyles.activeTopPip} />}
      <View style={[tabStyles.iconContainer, focused && tabStyles.activeIconContainer]}>
        <MaterialCommunityIcons
          name={focused ? activeIcon : inactiveIcon}
          size={focused ? 21 : 20}
          color={focused ? '#000000' : '#64748B'}
        />
        {badge !== undefined && (
          <View style={tabStyles.badgeContainer}>
            <Text style={tabStyles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const tabStyles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  activeTopPip: {
    position: 'absolute',
    top: -6,
    width: 22,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.primary,
  },
  iconContainer: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeIconContainer: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  badgeContainer: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});

const navStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screensArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  activePillBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9B101',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 22,
    gap: 6,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  activePillLabel: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 48,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
    color: '#64748B',
  },
});

const MainTabNavigator = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isOpen, openSidebar, closeSidebar } = useSidebar();
  const role = (user?.role || 'admin').toLowerCase();

  const isOperator = role === 'operator';
  const isTechnician = role === 'technician' || role === 'maintenance_engineer';
  const isStoreManager = role === 'store_manager' || role === 'store' || role === 'store_keeper';

  const defaultTab = isOperator
    ? 'OperatorTab'
    : isTechnician
    ? 'WorkOrdersTab'
    : isStoreManager
    ? 'SparesTab'
    : 'ShopfloorTab';
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Android system navigation bar clearance
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 22 : 12);

  // Active bottom tabs for current logged-in role
  const activeTabIds = React.useMemo(() => {
    if (isOperator) return ['OperatorTab', 'MachinesTab', 'ReportBreakdownTab', 'TriageTab'];
    if (isTechnician) return ['WorkOrdersTab', 'TriageTab', 'MachinesTab', 'SparesTab'];
    if (isStoreManager) return ['SparesTab', 'ProcurementTab', 'RDCTab', 'AuditTab'];
    return ['ShopfloorTab', 'MachinesTab', 'TriageTab', 'OperationsTab'];
  }, [isOperator, isTechnician, isStoreManager]);

  // Tab switching proxy for child screens & sidebar:
  // If the target tab is not in the active bottom tabs for this role, smoothly open it as a full stack screen
  const tabToStackMap: Record<string, string> = {
    ShopfloorTab: 'MainTabs',
    OperatorTab: 'MainTabs',
    WorkOrdersTab: 'WorkOrders',
    SparesTab: 'InventoryCatalog',
    OperationsTab: 'OperationsHub',
    MachinesTab: 'MachinesMaster',
    TriageTab: 'TriageQueue',
    ProcurementTab: 'Procurement',
    RDCTab: 'RDC',
    AuditTab: 'AuditLogs',
    ReportBreakdownTab: 'ReportBreakdown',
  };

  const tabNavigation = React.useMemo(
    () => ({
      ...navigation,
      navigate: (name: string, params?: any) => {
        if (activeTabIds.includes(name)) {
          setActiveTab(name);
          return;
        }
        if (tabToStackMap[name]) {
          navigation.navigate(tabToStackMap[name], params);
          return;
        }
        navigation.navigate(name, params);
      },
    }),
    [navigation, activeTabIds]
  );

  let tabs: Array<{
    id: string;
    label: string;
    activeIcon: string;
    inactiveIcon: string;
    badge?: string;
    component: React.ReactNode;
  }> = [];

  if (isOperator) {
    tabs = [
      {
        id: 'OperatorTab',
        label: 'Home',
        activeIcon: 'home',
        inactiveIcon: 'home-outline',
        component: <OperatorDashboardScreen navigation={tabNavigation} />,
      },
      {
        id: 'MachinesTab',
        label: 'Machines',
        activeIcon: 'tractor',
        inactiveIcon: 'tractor',
        component: <MachineMasterScreen navigation={tabNavigation} />,
      },
      {
        id: 'ReportBreakdownTab',
        label: 'Report',
        activeIcon: 'alert-circle',
        inactiveIcon: 'alert-circle-outline',
        badge: 'NEW',
        component: <ReportBreakdownScreen navigation={tabNavigation} />,
      },
      {
        id: 'TriageTab',
        label: 'Faults',
        activeIcon: 'ticket-confirmation',
        inactiveIcon: 'ticket-confirmation-outline',
        component: <TriageQueueScreen navigation={tabNavigation} />,
      },
    ];
  } else if (isTechnician) {
    tabs = [
      {
        id: 'WorkOrdersTab',
        label: 'Maintenance',
        activeIcon: 'wrench-clock',
        inactiveIcon: 'wrench-clock',
        component: <WorkOrdersScreen navigation={tabNavigation} />,
      },
      {
        id: 'TriageTab',
        label: 'Faults',
        activeIcon: 'alert-circle',
        inactiveIcon: 'alert-circle-outline',
        component: <TriageQueueScreen navigation={tabNavigation} />,
      },
      {
        id: 'MachinesTab',
        label: 'Machines',
        activeIcon: 'tractor',
        inactiveIcon: 'tractor',
        component: <MachineMasterScreen navigation={tabNavigation} />,
      },
      {
        id: 'SparesTab',
        label: 'Spare Parts',
        activeIcon: 'package-variant-closed',
        inactiveIcon: 'package-variant-closed',
        component: <InventoryCatalogScreen navigation={tabNavigation} />,
      },
    ];
  } else if (isStoreManager) {
    tabs = [
      {
        id: 'SparesTab',
        label: 'Spare Parts',
        activeIcon: 'package-variant-closed',
        inactiveIcon: 'package-variant-closed',
        component: <InventoryCatalogScreen navigation={tabNavigation} />,
      },
      {
        id: 'ProcurementTab',
        label: 'Purchase',
        activeIcon: 'cart',
        inactiveIcon: 'cart-outline',
        component: <ProcurementScreen />,
      },
      {
        id: 'RDCTab',
        label: 'Gate Pass',
        activeIcon: 'truck-fast',
        inactiveIcon: 'truck-fast-outline',
        component: <RDCScreen />,
      },
      {
        id: 'AuditTab',
        label: 'Activity Logs',
        activeIcon: 'shield-check',
        inactiveIcon: 'shield-check-outline',
        component: <AuditLogsScreen />,
      },
    ];
  } else {
    // Admin / Manager
    tabs = [
      {
        id: 'ShopfloorTab',
        label: 'Home',
        activeIcon: 'home',
        inactiveIcon: 'home-outline',
        component: <ShopFloorDashboardScreen navigation={tabNavigation} />,
      },
      {
        id: 'MachinesTab',
        label: 'Machines',
        activeIcon: 'tractor',
        inactiveIcon: 'tractor',
        component: <MachineMasterScreen navigation={tabNavigation} />,
      },
      {
        id: 'TriageTab',
        label: 'Faults',
        activeIcon: 'alert-circle',
        inactiveIcon: 'alert-circle-outline',
        component: <TriageQueueScreen navigation={tabNavigation} />,
      },
      {
        id: 'OperationsTab',
        label: 'Reports',
        activeIcon: 'poll',
        inactiveIcon: 'poll',
        component: <OperationsHubScreen navigation={tabNavigation} />,
      },
    ];
  }

  return (
    <View style={navStyles.container}>
      {/* Screen Area: strictly render the selected active tab */}
      <View style={navStyles.screensArea}>
        {(tabs.find((tab) => tab.id === activeTab) || tabs[0])?.component}
      </View>

      {/* JCB Bottom Tab Bar */}
      <View
        style={[
          navStyles.tabBar,
          { height: 62 + safeBottom, paddingBottom: safeBottom },
        ]}
      >
        {tabs.map((tab) => {
          const isFocused = activeTab === tab.id;
          if (isFocused) {
            return (
              <TouchableOpacity
                key={tab.id}
                style={navStyles.activePillBtn}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.85}
              >
                <View style={navStyles.activePillContainer}>
                  <MaterialCommunityIcons name={tab.activeIcon} size={18} color="#000000" />
                  <Text style={navStyles.activePillLabel}>{tab.label}</Text>
                </View>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={tab.id}
              style={navStyles.tabButton}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={tab.inactiveIcon} size={21} color="#64748B" />
              <Text style={navStyles.tabLabel}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* More Tab Button to open Sidebar */}
        <TouchableOpacity
          style={navStyles.tabButton}
          onPress={openSidebar}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={22} color="#64748B" />
          <Text style={navStyles.tabLabel}>More</Text>
        </TouchableOpacity>
      </View>

      {/* Global Admin Sidebar */}
      <AdminSidebar
        visible={isOpen}
        onClose={closeSidebar}
        navigation={tabNavigation}
        user={user}
        logout={logout}
      />
    </View>
  );
};

const AuthNavigator = () => {
  const [authView, setAuthView] = React.useState<'login' | 'register'>('login');

  if (authView === 'register') {
    return <OperatorSignUpScreen onBackToLogin={() => setAuthView('login')} />;
  }

  return <LoginScreen onNavigateToRegister={() => setAuthView('register')} />;
};

export const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  // If user is not logged in, render AuthNavigator (Login + Operator Self-Registration)
  if (!user) {
    return <AuthNavigator />;
  }

  return (
    <SidebarProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen
            name="MainTabs"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          {/* Extended Enterprise CMMS Screens */}
          <Stack.Screen
            name="Procurement"
            component={ProcurementScreen}
            options={{ title: 'Spare Parts Purchase Request' }}
          />
          <Stack.Screen
            name="RDC"
            component={RDCScreen}
            options={{ title: 'Gate Pass' }}
          />
          <Stack.Screen
            name="DailyInspection"
            component={PreShiftInspectionScreen}
            options={{ title: 'Daily AM Checklist' }}
          />
          <Stack.Screen
            name="InventoryCatalog"
            component={InventoryCatalogScreen}
            options={{ title: 'Spare Parts Management' }}
          />
          <Stack.Screen
            name="TriageQueue"
            component={TriageQueueScreen}
            options={{ title: 'Fault Reports' }}
          />
          <Stack.Screen
            name="OperationsHub"
            component={OperationsHubScreen}
            options={{ title: 'Reports' }}
          />
          <Stack.Screen
            name="Reports"
            component={OperationsHubScreen}
            options={{ title: 'Reports' }}
          />
          <Stack.Screen
            name="MachinesMaster"
            component={MachineMasterScreen}
            options={{ title: 'Machines Management' }}
          />
          <Stack.Screen
            name="PMCalendar"
            component={PMCalendarScreen}
            options={{ title: 'Maintenance Schedule' }}
          />
          <Stack.Screen
            name="DowntimeAnalytics"
            component={DowntimeAnalyticsScreen}
            options={{ title: 'Machine Status' }}
          />
          <Stack.Screen
            name="AuditLogs"
            component={AuditLogsScreen}
            options={{ title: 'Activity Logs' }}
          />
          <Stack.Screen
            name="UserManagement"
            component={UserManagementScreen}
            options={{ title: 'Staff Management' }}
          />
          <Stack.Screen
            name="WorkOrders"
            component={WorkOrdersScreen}
            options={{ title: 'Maintenance Status' }}
          />
          <Stack.Screen
            name="WorkOrderDetail"
            component={WorkOrderDetailScreen}
            options={{ title: 'Work Order Execution' }}
          />
          <Stack.Screen
            name="PartSearch"
            component={PartSearchScreen}
            options={{ title: 'Spare Parts Catalog' }}
          />
          <Stack.Screen
            name="ReportBreakdown"
            component={ReportBreakdownScreen}
            options={{ title: 'Report Breakdown' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SidebarProvider>
  );
};
