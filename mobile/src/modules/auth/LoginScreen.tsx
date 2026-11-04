import React, { useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../config/constants';

export const LoginScreen = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('operator@jcb.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Required', 'Please enter your Employee ID / Email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(identifier, password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials or server unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (role: 'operator' | 'technician') => {
    if (role === 'operator') {
      setIdentifier('operator@jcb.com');
      setPassword('password123');
    } else {
      setIdentifier('technician@jcb.com');
      setPassword('password123');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* JCB Header Brand Banner */}
        <View style={styles.brandBox}>
          <View style={styles.jcbBadge}>
            <Text style={styles.jcbBadgeText}>JCB</Text>
          </View>
          <Text style={styles.headerTitle}>Smart Machine CMMS</Text>
          <Text style={styles.headerSubtitle}>Ballabgarh Manufacturing Works</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {/* Quick Demo Switcher */}
          <Text style={styles.labelMuted}>Quick Role Switcher (Demo):</Text>
          <View style={styles.demoRow}>
            <TouchableOpacity
              style={[styles.demoBtn, identifier.includes('operator') && styles.demoBtnActive]}
              onPress={() => setDemoRole('operator')}
            >
              <Text style={styles.demoBtnText}>Operator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoBtn, identifier.includes('technician') && styles.demoBtnActive]}
              onPress={() => setDemoRole('technician')}
            >
              <Text style={styles.demoBtnText}>Technician</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Employee ID or Email</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="e.g. EMP-OPR-001 or email"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1E1E1E" />
            ) : (
              <Text style={styles.loginBtnText}>SIGN IN</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.secondary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  jcbBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  jcbBadgeText: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  labelMuted: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  demoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  demoBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoBtnActive: {
    backgroundColor: '#FEF08A',
    borderColor: COLORS.primary,
  },
  demoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

