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

// Authentic Official JCB App Logo & Hero Excavator
const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');
const JCB_EXCAVATOR_HERO = require('../../assets/jcb_excavator_hero.jpg');

/**
 * Animated Running JCB Machine Driving from Left to Right
 */
const JcbRunningLoader = () => {
  const driveAnim = useRef(new Animated.Value(0)).current;
  const wheelSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(driveAnim, {
        toValue: 1,
        duration: 2600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(wheelSpin, {
        toValue: 1,
        duration: 400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [driveAnim, wheelSpin]);

  const spin = wheelSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={loaderStyles.trackContainer}>
      {/* Road / Surface line with highway dashes */}
      <View style={loaderStyles.roadBed}>
        <View style={loaderStyles.roadAsphalt} />
        <View style={loaderStyles.roadStripes}>
          {Array.from({ length: 14 }).map((_, i) => (
            <View key={i} style={loaderStyles.roadDash} />
          ))}
        </View>
      </View>

      {/* Animated Moving JCB Backhoe Machine */}
      <Animated.View
        style={[
          loaderStyles.jcbVehicle,
          {
            transform: [
              {
                translateX: driveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-90, SCREEN_WIDTH + 40],
                }),
              },
            ],
          },
        ]}
      >
        <View style={loaderStyles.vehicleBody}>
          {/* Rear Backhoe Boom & Digger Bucket */}
          <View style={loaderStyles.rearArm}>
            <View style={loaderStyles.boomBar} />
            <View style={loaderStyles.bucketArm} />
            <View style={loaderStyles.rearBucket} />
          </View>

          {/* Main Operator Cab */}
          <View style={loaderStyles.cab}>
            <View style={loaderStyles.roof} />
            <View style={loaderStyles.cabWindow} />
          </View>

          {/* Engine Body Hood */}
          <View style={loaderStyles.hood}>
            <Text style={loaderStyles.jcbLabel}>JCB</Text>
          </View>

          {/* Front Loader Arm & Shovel */}
          <View style={loaderStyles.frontShovel}>
            <View style={loaderStyles.shovelArm} />
            <View style={loaderStyles.shovelBlade} />
          </View>

          {/* Big Rear Heavy Industrial Tire */}
          <Animated.View style={[loaderStyles.rearWheel, { transform: [{ rotate: spin }] }]}>
            <View style={loaderStyles.wheelTread} />
            <View style={loaderStyles.wheelRim} />
          </Animated.View>

          {/* Small Front Steer Tire */}
          <Animated.View style={[loaderStyles.frontWheel, { transform: [{ rotate: spin }] }]}>
            <View style={loaderStyles.wheelTread} />
            <View style={loaderStyles.wheelRim} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

export const SplashScreen = () => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={true} />

      {/* Top-left yellow diagonal wedge matching Image 1 */}
      <View style={styles.topYellowCorner} />
      {/* Bottom-right yellow corner accents */}
      <View style={styles.bottomYellowCorner} />

      {/* Top Hazard Warning Stripes */}
      <View style={styles.hazardStrip}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View
            key={`top-${i}`}
            style={[styles.hazardBar, i % 2 === 0 ? styles.hazardYellow : styles.hazardBlack]}
          />
        ))}
      </View>

      {/* Main Brand & Identity Core */}
      <View style={styles.centerBox}>
        {/* Prominent Official JCB Logo Badge */}
        <View style={styles.logoBadgeContainer}>
          <Image
            source={JCB_OFFICIAL_BADGE}
            style={styles.officialJcbBadge}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.mainTitle}>Smart Machine</Text>
        <Text style={styles.subMainTitle}>Maintenance Management System</Text>

        {/* Yellow Horizontal Accent Line */}
        <View style={styles.yellowPillBar} />

        {/* Tagline */}
        <Text style={styles.tagline}>Keep Machines Running. Always.</Text>

        {/* Authentic JCB Excavator Hero Image */}
        <View style={styles.excavatorContainer}>
          <Image
            source={JCB_EXCAVATOR_HERO}
            style={styles.excavatorImage}
            resizeMode="contain"
          />
        </View>

        {/* Dynamic Running JCB Machine Loader */}
        <View style={styles.loaderBox}>
          <JcbRunningLoader />
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

      {/* Bottom Hazard Warning Stripes */}
      <View style={styles.hazardStrip}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View
            key={`bot-${i}`}
            style={[styles.hazardBar, i % 2 === 0 ? styles.hazardBlack : styles.hazardYellow]}
          />
        ))}
      </View>
    </View>
  );
};

const loaderStyles = StyleSheet.create({
  trackContainer: {
    width: SCREEN_WIDTH - 40,
    height: 70,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
    marginTop: 24,
  },
  roadBed: {
    width: '100%',
    height: 14,
    position: 'relative',
  },
  roadAsphalt: {
    width: '100%',
    height: 4,
    backgroundColor: '#0F172A',
    borderRadius: 2,
  },
  roadStripes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 3,
  },
  roadDash: {
    width: 14,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  jcbVehicle: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    width: 82,
    height: 48,
  },
  vehicleBody: {
    width: 82,
    height: 48,
    position: 'relative',
  },
  cab: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    width: 22,
    height: 24,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 3,
    overflow: 'hidden',
  },
  roof: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.primary,
  },
  cabWindow: {
    width: 14,
    height: 12,
    backgroundColor: '#93C5FD',
    marginTop: 3,
    marginLeft: 4,
    borderRadius: 2,
    opacity: 0.9,
  },
  hood: {
    position: 'absolute',
    bottom: 12,
    left: 42,
    width: 22,
    height: 16,
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  jcbLabel: {
    color: '#000000',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  frontShovel: {
    position: 'absolute',
    bottom: 10,
    left: 62,
    width: 18,
    height: 20,
  },
  shovelArm: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 12,
    height: 3,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '15deg' }],
  },
  shovelBlade: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 16,
    backgroundColor: '#0F172A',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 2,
  },
  rearArm: {
    position: 'absolute',
    bottom: 14,
    left: 4,
    width: 18,
    height: 22,
  },
  boomBar: {
    position: 'absolute',
    top: 2,
    left: 6,
    width: 4,
    height: 14,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '-35deg' }],
    borderRadius: 1,
  },
  bucketArm: {
    position: 'absolute',
    bottom: 2,
    left: 1,
    width: 10,
    height: 3,
    backgroundColor: COLORS.primary,
    transform: [{ rotate: '-15deg' }],
  },
  rearBucket: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 6,
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  rearWheel: {
    position: 'absolute',
    bottom: 0,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frontWheel: {
    position: 'absolute',
    bottom: 2,
    left: 48,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelTread: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: '#475569',
  },
  wheelRim: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean Crisp White Background as requested
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  topYellowCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 80,
    borderTopWidth: 80,
    borderRightColor: 'transparent',
    borderTopColor: '#F9B101',
    zIndex: 1,
  },
  bottomYellowCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 60,
    borderBottomWidth: 60,
    borderLeftColor: 'transparent',
    borderBottomColor: '#F9B101',
    zIndex: 1,
  },
  hazardStrip: {
    width: '100%',
    height: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 2,
  },
  hazardBar: {
    flex: 1,
    height: '100%',
  },
  hazardYellow: {
    backgroundColor: COLORS.primary,
  },
  hazardBlack: {
    backgroundColor: '#0F172A',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    zIndex: 2,
  },
  logoBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  officialJcbBadge: {
    width: 236,
    height: 94,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subMainTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  yellowPillBar: {
    width: 44,
    height: 4,
    backgroundColor: '#F9B101',
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 10,
  },
  excavatorContainer: {
    width: SCREEN_WIDTH - 28,
    height: 185,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  excavatorImage: {
    width: '100%',
    height: '100%',
  },
  loaderBox: {
    marginTop: 6,
    alignItems: 'center',
    width: '100%',
  },
  footer: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  plantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  plantText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1,
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
    marginBottom: 3,
  },
  versionText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontWeight: '600',
  },
});
