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

interface OperatorSignUpScreenProps {
  onBackToLogin: () => void;
}

export const OperatorSignUpScreen: React.FC<OperatorSignUpScreenProps> = ({ onBackToLogin }) => {
  const insets = useSafeAreaInsets();

  // Form Fields
  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plantId, setPlantId] = useState('');
  const [shopId, setShopId] = useState('');
  const [shift, setShift] = useState('Shift A');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    }
  };

  const handleSubmit = async () => {
    const cleanCode = employeeCode.trim().toUpperCase();
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanCode) {
      Alert.alert('Required', 'Please enter your Employee ID (e.g. EMP-OPR-010).');
      return;
    }
    if (!cleanName) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    if (!cleanEmail) {
      Alert.alert('Required', 'Please enter your Email address.');
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
        phone: phone.trim() || undefined,
        plant_id: plantId,
        shop_id: shopId,
        department: 'Production Operations',
        designation: 'Machine Operator',
        shift,
        password,
      };

      const res: any = await apiClient.post('/auth/register-operator', payload);
      if (res?.success) {
        setSubmittedUser({
          ...res.data,
          plantName: plants.find((p) => p.id === plantId)?.plant_name,
          shopName: shops.find((s) => s.id === shopId)?.shop_name,
        });
      }
    } catch (err: any) {
      Alert.alert(
        'Registration Failed',
        err.message || 'Unable to register operator. Please verify your details.'
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
            <MaterialCommunityIcons name="check-circle" size={54} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Registration Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your factory operator account has been registered and is pending Plant Manager approval.
          </Text>

          <View style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>EMPLOYEE ID</Text>
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
          <Text style={styles.headerTitle}>Operator Registration</Text>
          <Text style={styles.headerSubtitle}>JCB Plant Portal Access Request</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Notice Card */}
        <View style={styles.infoNoticeCard}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#B45309" style={{ marginTop: 2 }} />
          <Text style={styles.infoNoticeText}>
            For plant floor operators only. Your Plant Supervisor will review and authorize your account before access is activated.
          </Text>
        </View>

        {/* 1. Employee Code */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EMPLOYEE ID *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="badge-account-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={employeeCode}
              onChangeText={setEmployeeCode}
              placeholder="e.g. EMP-OPR-010"
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
              placeholder="e.g. Ramesh Chandra"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* 3. Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>WORK EMAIL *</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="e.g. ramesh.opr@jcb.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* 4. Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PHONE NUMBER (OPTIONAL)</Text>
          <View style={styles.inputWrap}>
            <MaterialCommunityIcons name="phone-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* 5. Plant Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PLANT FACILITY *</Text>
          {loadingOrg ? (
            <ActivityIndicator size="small" color="#F9B101" style={{ marginVertical: 8 }} />
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
                      {p.plant_name}
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

        {/* 7. Shift Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ASSIGNED SHIFT *</Text>
          <View style={styles.pillsRow}>
            {['Shift A (06:00 - 14:00)', 'Shift B (14:00 - 22:00)', 'Shift C (22:00 - 06:00)'].map((s) => {
              const val = s.split(' ')[0] + ' ' + s.split(' ')[1];
              const isSelected = shift === val;
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

        {/* 8. Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>PASSWORD (MIN 8 CHARS) *</Text>
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

        {/* 9. Confirm Password */}
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
            <Text style={styles.primaryBtnText}>SUBMIT REGISTRATION</Text>
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
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    padding: 18,
  },
  infoNoticeCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoNoticeText: {
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
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  backLinkWrap: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  backLinkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  backLinkHighlight: {
    color: '#0F172A',
    fontWeight: '900',
    textDecorationLine: 'underline',
  },

  // Success view
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 26,
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
    color: '#64748B',
    letterSpacing: 0.4,
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
  },
});
