import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import { COLORS } from '../../config/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_LOGO = require('../../assets/jcb_logo.png');
const JCB_MACHINE_HERO = require('../../assets/jcb_backhoe_loader.webp');

export const SplashScreen = () => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle breathing pulse for loading text
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Smooth horizontal progress bar sweep
    Animated.loop(
      Animated.timing(barAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      })
    ).start();
  }, [pulseAnim, barAnim]);

  const progressWidth = barAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['10%', '75%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Top JCB Brand Accent Strip */}
      <View style={styles.topAccentBar} />

      {/* Main Content Core */}
      <View style={styles.centerBox}>
        {/* Official JCB Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={JCB_LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* System Title */}
        <Text style={styles.mainTitle}>SMART CMMS</Text>
        <Text style={styles.subTitle}>Plant Maintenance & Asset Reliability</Text>

        {/* Yellow Brand Accent Divider */}
        <View style={styles.accentDivider} />

        {/* JCB Machine Hero Showcase */}
        <View style={styles.machineContainer}>
          <Image
            source={JCB_MACHINE_HERO}
            style={styles.machineImage}
            resizeMode="contain"
          />
          <View style={styles.groundShadow} />
        </View>

        {/* Sleek Enterprise Loading Progress */}
        <View style={styles.loaderContainer}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Animated.Text style={[styles.loadingText, { opacity: pulseAnim }]}>
            INITIALIZING PLANT OPERATIONS...
          </Animated.Text>
        </View>
      </View>

      {/* Clean Industrial Footer */}
      <View style={styles.footer}>
        <View style={styles.plantRow}>
          <Text style={styles.plantText}>BALLABGARH</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.plantText}>PUNE</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.plantText}>JAIPUR</Text>
        </View>
        <Text style={styles.certText}>ISO 9001:2015 Industrial Platform</Text>
        <Text style={styles.versionText}>v1.0.0 Enterprise Release</Text>
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
    backgroundColor: COLORS.primary,
  },
  bottomAccentBar: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.primary,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: -10,
  },
  logoContainer: {
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 45,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  accentDivider: {
    width: 44,
    height: 3.5,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 12,
  },
  machineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    width: '100%',
  },
  machineImage: {
    width: SCREEN_WIDTH * 0.88,
    height: 170,
  },
  groundShadow: {
    width: SCREEN_WIDTH * 0.72,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    marginTop: -4,
  },
  loaderContainer: {
    alignItems: 'center',
    marginTop: 22,
    width: '100%',
  },
  progressBarTrack: {
    width: 160,
    height: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1,
    marginTop: 8,
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  plantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  plantText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 1.2,
  },
  dot: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  certText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  versionText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '500',
  },
});
