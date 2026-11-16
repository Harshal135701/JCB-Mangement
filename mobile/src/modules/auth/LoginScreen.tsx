import React, { useState, useRef } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JCB_OFFICIAL_BADGE = require('../../assets/jcb_official_badge.png');
const JCB_MACHINE_HERO = require('../../assets/jcb_backhoe_loader.webp');

type RoleType = 'admin' | 'manager' | 'operator' | 'technician';

interface RoleItem {
  id: RoleType;
  label: string;
  roleTitle: string;
  icon: string;
  email: string;
}

const ROLES: RoleItem[] = [
  {
    id: 'admin',
    label: 'Admin',
    roleTitle: 'Full Plant Control',
    icon: 'shield-crown',
    email: 'admin@jcb.com',
  },
  {
    id: 'manager',
    label: 'Manager',
    roleTitle: 'Operations & Shift',
    icon: 'clipboard-account',
    email: 'manager@jcb.com',
  },
  {
    id: 'operator',
    label: 'Operator',
    roleTitle: 'Machine Operator',
    icon: 'hard-hat',
    email: 'operator@jcb.com',
  },
  {
    id: 'technician',
    label: 'Technician',
    roleTitle: 'Maintenance Technician',
    icon: 'wrench-cog',
    email: 'technician@jcb.com',
  },
];

export const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const { login } = useAuth();

  const [selectedRole, setSelectedRole] = useState<RoleType>('admin');
  const [identifier, setIdentifier] = useState('admin@jcb.com');
  const [password, setPassword] = useState('ValidPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);

  const activeRoleData = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  const handleSelectRole = (role: RoleItem) => {
    setSelectedRole(role.id);
    setIdentifier(role.email);
    setPassword('ValidPassword123!');
  };

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Required', 'Please enter your Employee ID / Email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(identifier.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = () => {
    Alert.alert(
      'Biometric Sign In',
      `Logging in with stored credentials for ${activeRoleData.label} (${identifier})...`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Authenticate', onPress: () => handleLogin() },
      ]
    );
  };

  const scrollToInput = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" translucent={false} />

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
          <View style={[styles.heroHeader, { paddingTop: Math.max(insets.top, 14) }]}>
            {/* Top Navigation Row: Official JCB Badge & Plant Info */}
            <View style={styles.topNavRow}>
              <View style={styles.logoBadgeContainer}>
                <Image
                  source={JCB_OFFICIAL_BADGE}
                  style={styles.officialBadge}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.plantInfoBox}>
                <Text style={styles.plantNameText}>BALLABGARH PLANT</Text>
                <Text style={styles.plantSubText}>Smart CMMS Portal</Text>
              </View>
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

          {/* Clean Elevated White Login Sheet */}
          <View style={styles.cardContainer}>
            {/* Card Header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Sign In</Text>
                <Text style={styles.sheetSubtitle}>
                  Select your role to access maintenance portal
                </Text>
              </View>
              <View style={styles.securitySeal}>
                <MaterialCommunityIcons name="shield-check" size={20} color="#000000" />
              </View>
            </View>

            {/* Role Quick Selector */}
            <View style={styles.roleSelectionBox}>
              <Text style={styles.roleSectionTitle}>SELECT PROFILE</Text>

              <View style={styles.roleGrid}>
                {ROLES.map((role) => {
                  const isActive = selectedRole === role.id;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[
                        styles.roleCard,
                        isActive ? styles.roleCardActive : styles.roleCardInactive,
                      ]}
                      onPress={() => handleSelectRole(role)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.roleIconCircle,
                          isActive ? styles.roleIconCircleActive : styles.roleIconCircleInactive,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={role.icon}
                          size={18}
                          color={isActive ? '#000000' : '#475569'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleName,
                          isActive ? styles.roleNameActive : styles.roleNameInactive,
                        ]}
                      >
                        {role.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Employee ID / Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>EMPLOYEE ID / EMAIL</Text>
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
                      name="badge-account-horizontal-outline"
                      size={20}
                      color={focusedField === 'identifier' ? '#000000' : '#64748B'}
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
                    >
                      <MaterialCommunityIcons name="close-circle" size={17} color="#CBD5E1" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>PASSWORD</Text>
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
                      color={focusedField === 'password' ? '#000000' : '#64748B'}
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
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me & Help Options */}
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
                  <Text style={styles.checkboxLabel}>Save on this terminal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(
                      'Plant IT Helpdesk',
                      'Contact Ballabgarh Works IT Support:\n📞 Ext: 4021 / 4022\n📧 support.cmms@jcb.com\n🏢 Bay-4 IT Control Center'
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotPassLink}>Need Help?</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons: Sign In + Biometrics */}
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.primaryLoginBtn}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <View style={styles.primaryLoginBtnContent}>
                      <Text style={styles.primaryLoginBtnText}>SIGN IN</Text>
                      <View style={styles.arrowIconBubble}>
                        <MaterialCommunityIcons name="arrow-right-bold" size={16} color="#F9B101" />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricAuth}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="fingerprint" size={26} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Industrial Plant Trust Badge Footer */}
            <View style={styles.sheetFooter}>
              <View style={styles.trustBadge}>
                <MaterialCommunityIcons name="shield-check" size={14} color="#166534" />
                <Text style={styles.trustBadgeText}>JCB Enterprise Network</Text>
              </View>
              <Text style={styles.legalNotice}>
                Authorized personnel only. All access is logged.
              </Text>
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
    backgroundColor: '#0B0F19',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },

  /* Clean Industrial Header */
  heroHeader: {
    backgroundColor: '#0B0F19',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  logoBadgeContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    elevation: 3,
  },
  officialBadge: {
    width: 90,
    height: 34,
  },
  plantInfoBox: {
    alignItems: 'flex-end',
  },
  plantNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F9B101',
    letterSpacing: 0.5,
  },
  plantSubText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8',
  },

  /* Machine Showcase */
  machineStageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  machineImage: {
    width: SCREEN_WIDTH * 0.92,
    height: 146,
  },
  groundPlatformShadow: {
    width: SCREEN_WIDTH * 0.78,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    marginTop: -4,
    marginBottom: 4,
  },

  /* Elevated Modern Login Card */
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  securitySeal: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9B101',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Role Selection */
  roleSelectionBox: {
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleSectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 5,
  },
  roleCardActive: {
    backgroundColor: '#F9B101',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 2,
  },
  roleCardInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconCircleActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  roleIconCircleInactive: {
    backgroundColor: '#F1F5F9',
  },
  roleName: {
    fontSize: 11,
  },
  roleNameActive: {
    fontWeight: '900',
    color: '#000000',
  },
  roleNameInactive: {
    fontWeight: '700',
    color: '#475569',
  },

  /* Form Fields */
  formContainer: {
    marginBottom: 6,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 48,
  },
  inputFieldFocused: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFFFF',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fieldIconBoxFocused: {
    backgroundColor: '#FEF9C3',
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: 0,
  },

  /* Meta Options */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  forgotPassLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },

  /* Action Buttons */
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryLoginBtn: {
    flex: 1,
    backgroundColor: '#F9B101',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryLoginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLoginBtnText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.6,
  },
  arrowIconBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Sheet Footer */
  sheetFooter: {
    marginTop: 18,
    alignItems: 'center',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
    marginBottom: 6,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#166534',
  },
  legalNotice: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },
});
