import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');
const JCB_MACHINE_HERO = require('../../assets/jcb_backhoe_loader.webp');

export const SplashScreen = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Top JCB Brand Accent Strip */}
      <View style={styles.topAccentBar} />

      {/* Main Content Core */}
      <Animated.View
        style={[
          styles.centerBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Official JCB Badge */}
        <View style={styles.logoBadgeContainer}>
          <Image
            source={JCB_OFFICIAL_BADGE}
            style={styles.logoBadge}
            resizeMode="contain"
          />
        </View>

        {/* System Title */}
        <Text style={styles.mainTitle}>SMART CMMS</Text>
        <View style={styles.accentDivider} />

        {/* JCB Backhoe Machine Graphic */}
        <View style={styles.machineContainer}>
          <Image
            source={JCB_MACHINE_HERO}
            style={styles.machineImage}
            resizeMode="contain"
          />
          <View style={styles.groundShadow} />
        </View>

        {/* Sleek Loading Indicator */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#F9B101" />
          <Text style={styles.loadingText}>INITIALIZING...</Text>
        </View>
      </Animated.View>

      {/* Clean Industrial Footer */}
      <View style={styles.footer}>
        <View style={styles.plantRow}>
          <Text style={styles.plantText}>BALLABGARH WORKS</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.plantText}>JCB INDIA</Text>
        </View>
        <Text style={styles.versionText}>Enterprise Connected Operations</Text>
      </View>

      {/* Bottom JCB Brand Accent Strip */}
      <View style={styles.bottomAccentBar} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topAccentBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#F9B101',
  },
  bottomAccentBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#F9B101',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  logoBadgeContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  logoBadge: {
    width: 140,
    height: 45,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  accentDivider: {
    width: 36,
    height: 3,
    backgroundColor: '#F9B101',
    borderRadius: 1.5,
    marginTop: 8,
    marginBottom: 10,
  },
  machineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    width: '100%',
  },
  machineImage: {
    width: Math.min(SCREEN_WIDTH * 0.75, 280),
    height: 120,
  },
  groundShadow: {
    width: Math.min(SCREEN_WIDTH * 0.65, 230),
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    marginTop: -4,
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  loadingText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.2,
  },
  footer: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  plantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  plantText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 1,
  },
  dot: {
    color: '#F9B101',
    fontSize: 10,
    fontWeight: '900',
  },
  versionText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
