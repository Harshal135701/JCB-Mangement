import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import * as rns from 'react-native-screens';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';

// Guarantee compatibilityFlags is an object on all screen stacks
const rnsAny = rns as any;
if (!rnsAny.compatibilityFlags || typeof rnsAny.compatibilityFlags !== 'object') {
  try {
    rnsAny.compatibilityFlags = {
      isNewBackTitleImplementation: true,
      usesHeaderFlexboxImplementation: true,
      usesNewAndroidHeaderHeightImplementation: false,
    };
  } catch (e) {}
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
