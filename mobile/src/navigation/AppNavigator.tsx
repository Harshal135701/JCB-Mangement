import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/constants';

// Screens
import { LoginScreen } from '../modules/auth/LoginScreen';
import { OperatorDashboardScreen } from '../modules/operator/OperatorDashboardScreen';
import { ReportBreakdownScreen } from '../modules/breakdowns/ReportBreakdownScreen';
import { WorkOrdersScreen } from '../modules/technician/WorkOrdersScreen';
import { WorkOrderDetailScreen } from '../modules/work-orders/WorkOrderDetailScreen';
import { PartSearchScreen } from '../modules/inventory/PartSearchScreen';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.secondary }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {!user ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : user.role === 'technician' ? (
          <>
            <Stack.Screen
              name="WorkOrders"
              component={WorkOrdersScreen}
              options={{ title: 'JCB Maintenance WOs' }}
            />
            <Stack.Screen
              name="WorkOrderDetail"
              component={WorkOrderDetailScreen}
              options={{ title: 'Work Order Execution' }}
            />
            <Stack.Screen
              name="PartSearch"
              component={PartSearchScreen}
              options={{ title: '160k Spares Catalog' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="OperatorDashboard"
              component={OperatorDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReportBreakdown"
              component={ReportBreakdownScreen}
              options={{ title: 'Report Breakdown' }}
            />
            <Stack.Screen
              name="PartSearch"
              component={PartSearchScreen}
              options={{ title: '160k Spares Catalog' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

