import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const HERO_BG = '#0d0b1a';

function Ring({ size, top, bottom, left, right, opacity = 0.18 }: {
  size: number; top?: number; bottom?: number; left?: number; right?: number; opacity?: number;
}) {
  return (
    <View style={{
      position: 'absolute',
      width: size, height: size,
      borderRadius: size / 2,
      borderWidth: 1.5,
      borderColor: `rgba(99,102,241,${opacity})`,
      top, bottom, left, right,
    }} />
  );
}

export default function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <Ring size={200} top={-60}  right={-60}              />
      <Ring size={120} top={30}   right={20}   opacity={0.25} />
      <Ring size={80}  top={100}  right={80}               />
      <Ring size={100} top={160}  left={-30}   opacity={0.25} />
      <Ring size={55}  top={80}   left={40}                />
      <Ring size={140} bottom={130} left={-50} opacity={0.25} />
      <Ring size={70}  bottom={170} right={30}             />

      <View style={styles.logoSection}>
        <Svg width={88} height={88} viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r="50" fill="none" stroke="#4f46e5" strokeOpacity={0.25} strokeWidth={8} />
          <Circle cx="60" cy="60" r="36" fill="none" stroke="#6366f1" strokeOpacity={0.55} strokeWidth={8} />
          <Circle cx="60" cy="60" r="22" fill="none" stroke="#818cf8" strokeWidth={8} />
          <Circle cx="60" cy="60" r="7"  fill="#818cf8" />
        </Svg>
        <Text style={styles.appName}>Zone</Text>
        <Text style={styles.tagline}>Less overwhelm. More momentum.</Text>
      </View>

      <View style={styles.btns}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Log in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnOutline}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnOutlineText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HERO_BG,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  appName: {
    fontSize: 44,
    fontWeight: '900',
    color: '#818cf8',
    letterSpacing: -2,
    marginTop: 18,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: '#55556a',
    fontStyle: 'italic',
  },
  btns: {
    gap: 12,
    zIndex: 2,
  },
  btnPrimary: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: 'rgba(99,102,241,0.45)',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#818cf8',
    fontSize: 16,
    fontWeight: '700',
  },
});
