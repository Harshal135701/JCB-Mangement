import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../../services/api';
import { COLORS } from '../../config/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PlantOption {
  id: string;
  plant_code: string;
  plant_name: string;
  city: string;
  state: string;
}

interface ShopOption {
  id: string;
  plant_id: string;
  shop_code: string;
  shop_name: string;
}

const PREDEFINED_DEPARTMENTS = [
  'Mechanical Maintenance',
  'Electrical & Automation',
  'Hydraulics Maintenance',
  'Robotics Maintenance',
  'Preventive Maintenance',
];

const PREDEFINED_SHIFTS = [
  'Shift A (06:00 - 14:30)',
  'Shift B (14:30 - 23:00)',
  'Shift C (23:00 - 06:00)',
  'General Shift (09:00 - 17:30)',
];

const AVAILABLE_SKILLS = [
  'Mechanical',
  'Electrical',
  'Hydraulic',
  'PLC',
  'Robotics',
  'Welding',
  'Pneumatics',
  'Instrumentation',
];

interface TechnicianSignUpScreenProps {
  onBackToLogin: () => void;
}

export const TechnicianSignUpScreen: React.FC<TechnicianSignUpScreenProps> = ({ onBackToLogin }) => {
  const insets = useSafeAreaInsets();

  // Personal Information
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Work Information
  const [plantId, setPlantId] = useState('');
  const [shopId, setShopId] = useState('');
  const [department, setDepartment] = useState('Mechanical Maintenance');
  const [designation, setDesignation] = useState('Maintenance Specialist');
  const [shift, setShift] = useState('Shift A');

  // Technical Skills (multi-select)
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Mechanical']);

  // Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [submittedUser, setSubmittedUser] = useState<any | null>(null);

  // Facility Options
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        setLoadingOrg(true);
        const res: any = await apiClient.get('/auth/registration-options');
        if (res?.success && res.data) {
          const plantsList: PlantOption[] = res.data.plants || [];
          setPlants(plantsList);

          if (plantsList.length > 0) {
            const firstPlant = plantsList[0];
            setPlantId(firstPlant.id);

            if (Array.isArray(res.data.shops)) {
              const plantShops = res.data.shops.filter(
                (s: ShopOption) => s.plant_id === firstPlant.id
              );
              setShops(plantShops);
              if (plantShops.length > 0) {
                setShopId(plantShops[0].id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load registration options:', err);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrgData();
  }, []);

  const handlePlantSelect = async (pId: string) => {
    setPlantId(pId);
    setShopId('');
    try {
      const res: any = await apiClient.get(`/auth/plants/${pId}/shops`);
      if (res?.success && Array.isArray(res.data)) {
        setShops(res.data);
        if (res.data.length > 0) {
          setShopId(res.data[0].id);
        } else {
          setShopId('');
        }
      }
    } catch (e) {
      console.warn('Failed to load shops for plant:', e);
      setShops([]);
      setShopId('');
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async () => {
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanCode) {
      Alert.alert('Required', 'Please enter your Employee ID (e.g. EMP-TECH-015).');
      return;
    }
    if (!cleanName) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    if (!cleanEmail) {
      Alert.alert('Required', 'Please enter your official Email address.');
      return;
    }
    if (!cleanPhone) {
      Alert.alert('Required', 'Phone number is required for maintenance dispatch.');
      return;
    }
    if (cleanPhone.length < 7 || cleanPhone.length > 50) {
      Alert.alert('Validation', 'Please enter a valid phone number (7-50 characters).');
      return;
    }
    if (!plantId) {
      Alert.alert('Required', 'Please select your Plant facility.');
      return;
    }
    if (!shopId) {
      Alert.alert('Required', 'Please select your Shop Floor.');
      return;
    }
    if (selectedSkills.length === 0) {
      Alert.alert('Required', 'Please select at least one technical competency skill.');
      return;
    }
    if (!password) {
      Alert.alert('Required', 'Please enter a Password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Validation', 'Password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        employee_code: cleanCode,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        plant_id: plantId,
        shop_id: shopId,
        department,
        designation,
        shift: shift.split(' ')[0] + ' ' + (shift.split(' ')[1] || ''),
        skills: selectedSkills,
        password,
      };

      const res: any = await apiClient.post('/auth/register-technician', payload);
      if (res?.success) {
        setSubmittedUser({
          ...res.data,
          plantName: plants.find((p) => p.id === plantId)?.plant_name,
          shopName: shops.find((s) => s.id === shopId)?.shop_name,
          skillsList: selectedSkills,
        });
      }
    } catch (err: any) {
      Alert.alert(
        'Registration Failed',
        err.message || 'Unable to register technician. Please verify your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (submittedUser) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <MaterialCommunityIcons name="shield-check" size={54} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Registration Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your maintenance technician profile has been registered and is pending Shop Floor Manager authorization.
          </Text>

          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>TECHNICIAN ID</Text>
              <Text style={styles.receiptVal}>{submittedUser.employee_code}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>NAME</Text>
              <Text style={styles.receiptVal}>{submittedUser.full_name}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>PLANT</Text>
              <Text style={styles.receiptVal}>{submittedUser.plantName || 'Plant'}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>SHOP FLOOR</Text>
              <Text style={styles.receiptVal}>{submittedUser.shopName || 'Shop'}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>DEPARTMENT</Text>
              <Text style={styles.receiptVal}>{submittedUser.department || department}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>SKILLS</Text>
              <Text style={[styles.receiptVal, { color: '#B45309', fontWeight: '800' }]}>
                {selectedSkills.join(', ')}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>STATUS</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={onBackToLogin} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>BACK TO SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Header Row */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBackToLogin} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Technician Registration</Text>
          <Text style={styles.headerSubtitle}>JCB Plant Maintenance Access Request</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Banner */}
        <View style={styles.bannerCard}>
          <MaterialCommunityIcons name="wrench" size={24} color="#D97706" />
          <Text style={styles.bannerText}>
            Maintenance technicians receive breakdown work orders, execute PM routines, and request spare parts.
          </Text>
        </View>

        {/* 1. Employee ID */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMPLOYEE CODE / BADGE ID *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="badge-account-horizontal-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={employeeCode}
              onChangeText={setEmployeeCode}
              placeholder="e.g. EMP-TECH-015"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* 2. Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>FULL NAME *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* 3. Official Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>OFFICIAL EMAIL *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="technician@jcb.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* 4. Contact Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CONTACT PHONE *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="phone-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* 5. Plant Facility Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PLANT FACILITY *</Text>
          {loadingOrg ? (
            <ActivityIndicator size="small" color="#F9B101" />
          ) : (
            <View style={styles.pillsRow}>
              {plants.map((p) => {
                const isSelected = plantId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                    onPress={() => handlePlantSelect(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                      {p.plant_name} ({p.plant_code})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 6. Shop Floor Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>SHOP FLOOR BAY *</Text>
          {shops.length === 0 ? (
            <Text style={styles.mutedHelper}>No shops registered for this plant.</Text>
          ) : (
            <View style={styles.pillsRow}>
              {shops.map((s) => {
                const isSelected = shopId === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                    onPress={() => setShopId(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                      {s.shop_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* 7. Department */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>MAINTENANCE DEPARTMENT *</Text>
          <View style={styles.pillsRow}>
            {PREDEFINED_DEPARTMENTS.map((dept) => {
              const isSelected = department === dept;
              return (
                <TouchableOpacity
                  key={dept}
                  style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                  onPress={() => setDepartment(dept)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 8. Designation */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DESIGNATION *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="briefcase-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g. Senior Maintenance Specialist"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* 9. Shift Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ASSIGNED SHIFT *</Text>
          <View style={styles.pillsRow}>
            {PREDEFINED_SHIFTS.map((s) => {
              const val = s.split(' ')[0] + ' ' + (s.split(' ')[1] || '');
              const isSelected = shift.startsWith(s.split(' ')[0]);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                  onPress={() => setShift(val)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 10. Technical Competency Skills (Multi-Select) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>TECHNICAL COMPETENCY SKILLS *</Text>
          <Text style={styles.fieldHelpText}>Select all disciplines you are certified or trained in:</Text>
          <View style={styles.skillsGrid}>
            {AVAILABLE_SKILLS.map((sk) => {
              const isChecked = selectedSkills.includes(sk);
              return (
                <TouchableOpacity
                  key={sk}
                  style={[styles.skillChip, isChecked && styles.skillChipActive]}
                  onPress={() => toggleSkill(sk)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={isChecked ? 'check-circle' : 'circle-outline'}
                    size={16}
                    color={isChecked ? '#000000' : '#64748B'}
                  />
                  <Text style={[styles.skillChipText, isChecked && styles.skillChipTextActive]}>
                    {sk}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 11. Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD (MIN 8 CHARACTERS) *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="lock-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Create password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 12. Confirm Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CONFIRM PASSWORD *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'} size={19} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.88}>
          {loading ? (
            <ActivityIndicator color="#000000" size="small" />
          ) : (
            <Text style={styles.primaryBtnText}>SUBMIT TECHNICIAN REGISTRATION</Text>
          )}
        </TouchableOpacity>

        {/* Back to Login Link */}
        <TouchableOpacity style={styles.backLinkWrap} onPress={onBackToLogin} activeOpacity={0.7}>
          <Text style={styles.backLinkText}>
            Already registered? <Text style={styles.backLinkHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldHelpText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginLeft: 10,
    paddingVertical: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  pillBtnActive: {
    backgroundColor: '#F9B101',
    borderColor: '#E09E00',
  },
  pillBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  pillBtnTextActive: {
    color: '#000000',
    fontWeight: '900',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  skillChipActive: {
    borderColor: '#F9B101',
    backgroundColor: '#FFFBEB',
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  skillChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  mutedHelper: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  primaryBtn: {
    backgroundColor: '#F9B101',
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#F9B101',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.6,
  },
  backLinkWrap: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  backLinkHighlight: {
    color: '#000000',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  // Success View Styles
  successContainer: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptKey: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  receiptVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.5,
  },
});
