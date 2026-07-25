import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { TextInput, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const HERO_BG = '#0d0b1a';

function Ring({ size, top, left, right, opacity = 0.18 }: {
  size: number; top?: number; left?: number; right?: number; opacity?: number;
}) {
  return (
    <View style={{
      position: 'absolute',
      width: size, height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: `rgba(99,102,241,${opacity})`,
      top, left, right,
    }} />
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { colors } = useTheme();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: HERO_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Ring size={160} top={-50} right={-40} />
          <Ring size={90}  top={20}  right={15}  opacity={0.25} />
          <Ring size={55}  top={70}  right={70}  />
          <Ring size={65}  top={20}  left={-20}  opacity={0.25} />
        </View>

        {/* Wave transition */}
        <View style={{ backgroundColor: HERO_BG }}>
          <Svg width="100%" height={28} viewBox="0 0 375 28" preserveAspectRatio="none">
            <Path d="M0,28 C100,0 275,26 375,10 L375,28 Z" fill={colors.background} />
          </Svg>
        </View>

        {/* Form sheet */}
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Welcome back</Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
            backgroundColor={colors.surface}
            left={<TextInput.Icon icon="email-outline" />}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPass}
            autoCapitalize="none"
            autoComplete="password"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.input}
            backgroundColor={colors.surface}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={showPass ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPass(v => !v)} />}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            buttonColor={colors.primary}
            style={styles.btn}
            contentStyle={styles.btnContent}
          >
            Log in
          </Button>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          </View>

          <Button
            mode="outlined"
            onPress={() => navigation.navigate('SignUp')}
            textColor={colors.primary}
            style={[styles.btn, { borderColor: colors.primary }]}
            contentStyle={styles.btnContent}
          >
            Sign up
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 180,
    backgroundColor: HERO_BG,
    overflow: 'hidden',
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  sheetTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  input: { marginBottom: 14 },
  btn: { borderRadius: 12, marginTop: 4 },
  btnContent: { paddingVertical: 6 },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 12,
  },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13 },
});
