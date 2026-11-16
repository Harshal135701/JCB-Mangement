import React, { useState, useEffect } from 'react';
import { StatusBar, View, StyleSheet } from 'react-native';
import * as rns from 'react-native-screens';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SplashScreen } from './src/modules/splash/SplashScreen';

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
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics}
      style={[styles.root, { backgroundColor: showSplash ? '#FFFFFF' : '#0F172A' }]}
    >
      <StatusBar
        barStyle={showSplash ? 'dark-content' : 'light-content'}
        backgroundColor={showSplash ? '#FFFFFF' : '#0F172A'}
      />
      {showSplash ? (
        <SplashScreen />
      ) : (
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9B101',
  },
});
