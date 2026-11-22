import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');
const JCB_MACHINE_HERO = require('../../assets/jcb_backhoe_loader.webp');
const RIGHT_SIDE_WAVE = require('../../assets/right_side_wave.png');
const TOP_LEFT_ACCENT = require('../../assets/top_left_accent.png');

const SAVED_IDENTIFIER_KEY = '@jcb_saved_identifier';

interface LoginScreenProps {
  onNavigateToRegister?: () => void;
  onNavigateToTechRegister?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
  onNavigateToTechRegister,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_IDENTIFIER_KEY)
      .then((saved) => {
        if (saved) {
          setIdentifier(saved);
          setRememberMe(true);
        }
      })
      .catch(() => { });
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Required', 'Please enter your Employee ID / Email and password.');
      return;
    }

    try {
      setLoading(true);

      if (rememberMe) {
        await AsyncStorage.setItem(SAVED_IDENTIFIER_KEY, identifier.trim());
      } else {
        await AsyncStorage.removeItem(SAVED_IDENTIFIER_KEY);
      }

      await login(identifier.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const scrollToInput = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={false} />

      {/* Decorative Side Accents from JCB Brand System */}
      <View style={styles.backgroundAccentsContainer} pointerEvents="none">
        {/* 1. Top-Left Corner Geometric Accent */}
        <Image
          source={TOP_LEFT_ACCENT}
          style={styles.topLeftCorner}
          resizeMode="contain"
        />

        {/* 2. Right-Side Smooth Organic Yellow Wave Curve */}
        <Image
          source={RIGHT_SIDE_WAVE}
          style={styles.rightSideWave}
          resizeMode="stretch"
        />

        {/* 3. Bottom-Right Corner Geometric Accent */}
        <View style={styles.bottomRightCorner}>
          <View style={styles.bottomRightYellowRibbon} />
          <View style={styles.bottomRightBlackWedge} />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Clean Industrial Top Header */}
          <View style={[styles.heroHeader, { paddingTop: Math.max(insets.top + 34, 48) }]}>
            {/* Top Navigation Row: Official JCB Badge & Tagline */}
            <View style={styles.topNavRow}>
              <View style={styles.logoBadgeContainer}>
                <Image
                  source={JCB_OFFICIAL_BADGE}
                  style={styles.officialBadge}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTagline}>Keep Your Machine Unstoppable</Text>
            </View>

            {/* JCB Machine Showcase */}
            <View style={styles.machineStageContainer}>
              <Image
                source={JCB_MACHINE_HERO}
                style={styles.machineImage}
                resizeMode="contain"
              />
              <View style={styles.groundPlatformShadow} />
            </View>
          </View>

          {/* Floating White Login Card with Rounded Side Curves */}
          <View style={styles.cardContainer}>
            {/* Card Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sign In</Text>
              <View style={styles.securitySeal}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#000000" />
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Employee ID / Email */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>EMPLOYEE ID / EMAIL</Text>
                  {focusedField === 'identifier' && <View style={styles.activeLabelPip} />}
                </View>
                <View
                  style={[
                    styles.inputField,
                    focusedField === 'identifier' && styles.inputFieldFocused,
                  ]}
                >
                  <View
                    style={[
                      styles.fieldIconBox,
                      focusedField === 'identifier' && styles.fieldIconBoxFocused,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="badge-account-outline"
                      size={20}
                      color={focusedField === 'identifier' ? '#000000' : '#475569'}
                    />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="EMP ID or work email"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onFocus={() => {
                      setFocusedField('identifier');
                      scrollToInput();
                    }}
                    onBlur={() => setFocusedField(null)}
                  />
                  {identifier.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setIdentifier('')}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.clearBtn}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  {focusedField === 'password' && <View style={styles.activeLabelPip} />}
                </View>
                <View
                  style={[
                    styles.inputField,
                    focusedField === 'password' && styles.inputFieldFocused,
                  ]}
                >
                  <View
                    style={[
                      styles.fieldIconBox,
                      focusedField === 'password' && styles.fieldIconBoxFocused,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={20}
                      color={focusedField === 'password' ? '#000000' : '#475569'}
                    />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    onFocus={() => {
                      setFocusedField('password');
                      scrollToInput();
                    }}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.eyeBtn}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={19}
                      color={showPassword ? '#0F172A' : '#94A3B8'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Password Option */}
              <View style={styles.metaRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <MaterialCommunityIcons name="check-bold" size={12} color="#000000" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember this password</Text>
                </TouchableOpacity>
              </View>

              {/* Full-width Sign In Action Button */}
              <TouchableOpacity
                style={styles.primaryLoginBtn}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <Text style={styles.primaryLoginBtnText}>SIGN IN</Text>
                )}
              </TouchableOpacity>

              {/* Register Links: Operator & Technician */}
              <View style={styles.registerButtonsRow}>
                {onNavigateToRegister && (
                  <TouchableOpacity
                    style={styles.registerLinkBtn}
                    onPress={onNavigateToRegister}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="hard-hat" size={15} color="#D97706" />
                    <Text style={styles.registerLinkText}>
                      Operator <Text style={styles.registerLinkHighlight}>Register</Text>
                    </Text>
                  </TouchableOpacity>
                )}

                {onNavigateToTechRegister && (
                  <TouchableOpacity
                    style={styles.registerLinkBtn}
                    onPress={onNavigateToTechRegister}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="wrench" size={15} color="#2563EB" />
                    <Text style={styles.registerLinkText}>
                      Technician <Text style={[styles.registerLinkHighlight, { color: '#2563EB' }]}>Register</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Bottom Brand Divider */}
              <View style={styles.cardFooterDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.cardFooterText}>JCB India</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 0,
  },

  /* Decorative Side Accents System */
  backgroundAccentsContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },

  /* 1. Top-Left Corner Geometric Accent */
  topLeftCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 145,
    height: 135,
  },

  /* 2. Right-Side Smooth Organic Yellow Wave Curve */
  rightSideWave: {
    position: 'absolute',
    right: 0,
    top: 155,
    width: 82,
    height: 195,
  },

  /* 3. Bottom-Right Corner Geometric Accent */
  bottomRightCorner: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 160,
    height: 100,
    overflow: 'hidden',
  },
  bottomRightYellowRibbon: {
    position: 'absolute',
    bottom: -15,
    right: -20,
    width: 180,
    height: 65,
    backgroundColor: '#F9B101',
    transform: [{ rotate: '-30deg' }],
  },
  bottomRightBlackWedge: {
    position: 'absolute',
    bottom: -22,
    right: -20,
    width: 110,
    height: 48,
    backgroundColor: '#111827',
    transform: [{ rotate: '-30deg' }],
  },

  /* Clean Industrial Header */
  heroHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  topNavRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 0,
  },
  logoBadgeContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  officialBadge: {
    width: 150,
    height: 49,
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 0,
  },

  /* Machine Showcase */
  machineStageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    backgroundColor: 'transparent',
  },
  machineImage: {
    width: SCREEN_WIDTH * 0.94,
    height: 182,
  },
  groundPlatformShadow: {
    width: SCREEN_WIDTH * 0.82,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    marginTop: -6,
    marginBottom: 4,
  },

  /* Elevated Modern Login Sheet (Full Width, Flat Bottom, Rounded Top) */
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'android' ? 24 : 34,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  securitySeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Form Fields */
  formContainer: {
    marginBottom: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    paddingHorizontal: 2,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  activeLabelPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F9B101',
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 52,
  },
  inputFieldFocused: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 3,
  },
  fieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fieldIconBoxFocused: {
    backgroundColor: '#F9B101',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },

  /* Meta Options */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 18,
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F9B101',
    borderColor: '#F9B101',
  },
  checkboxLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },

  /* Full Width Action Button */
  primaryLoginBtn: {
    width: '100%',
    backgroundColor: '#F9B101',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryLoginBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
    textAlign: 'center',
  },

  /* Card Footer Divider */
  cardFooterDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  cardFooterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  registerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    gap: 8,
  },
  registerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  registerLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  registerLinkHighlight: {
    color: '#0F172A',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
