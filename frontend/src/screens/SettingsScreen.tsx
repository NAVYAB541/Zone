import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Surface, SegmentedButtons } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, AppColors, ThemeType } from '../context/ThemeContext';

type EnergyLevel = 'high' | 'medium' | 'low';
type EnergyPrefs = {
  morning: EnergyLevel;
  afternoon: EnergyLevel;
  evening: EnergyLevel;
};

const DEFAULT_PREFS: EnergyPrefs = { morning: 'high', afternoon: 'medium', evening: 'low' };
const ENERGY_PREFS_KEY = 'energy_prefs';

const ENERGY_SLOTS = [
  { key: 'morning'   as const, label: 'Morning',   sub: '6am – 12pm', emoji: '🌅' },
  { key: 'afternoon' as const, label: 'Afternoon', sub: '12pm – 6pm', emoji: '☀️' },
  { key: 'evening'   as const, label: 'Evening',   sub: '6pm – 6am',  emoji: '🌙' },
];

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [prefs, setPrefs] = useState<EnergyPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(ENERGY_PREFS_KEY).then(raw => {
      if (raw) {
        try { setPrefs(JSON.parse(raw)); } catch {}
      }
    });
  }, []);

  const updatePref = async (key: keyof EnergyPrefs, value: EnergyLevel) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    await AsyncStorage.setItem(ENERGY_PREFS_KEY, JSON.stringify(updated));
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Appearance ── */}
      <Text style={styles.sectionLabel}>Appearance</Text>
      <Surface style={styles.card} elevation={1}>
        <Text style={styles.rowTitle}>Theme</Text>
        <Text style={styles.rowSub}>Choose how Zone looks</Text>
        <SegmentedButtons
          value={theme}
          onValueChange={v => setTheme(v as ThemeType)}
          buttons={[
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark',  label: 'Dark',  icon: 'moon-waning-crescent' },
          ]}
          style={styles.themeSegmented}
        />
      </Surface>

      {/* ── Energy Schedule ── */}
      <Text style={[styles.sectionLabel, { marginTop: 32 }]}>Energy Schedule</Text>
      <Text style={styles.sectionDesc}>
        Launch Me uses these to surface the right tasks for each part of your day.
      </Text>
      <Surface style={styles.card} elevation={1}>
        {ENERGY_SLOTS.map(({ key, label, sub, emoji }, i) => (
          <View key={key}>
            <View style={styles.energyRow}>
              <Text style={styles.energyEmoji}>{emoji}</Text>
              <View style={styles.energyMeta}>
                <Text style={styles.rowTitle}>{label}</Text>
                <Text style={styles.rowSub}>{sub}</Text>
              </View>
            </View>
            <SegmentedButtons
              value={prefs[key]}
              onValueChange={v => updatePref(key, v as EnergyLevel)}
              buttons={[
                { value: 'high',   label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low',    label: 'Low' },
              ]}
              style={styles.energySegmented}
            />
            {i < ENERGY_SLOTS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </Surface>

      {/* ── Footer spacer ── */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 40,
    },

    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 10,
    },
    sectionDesc: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
      marginTop: -6,
      marginBottom: 12,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },

    rowTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 2,
    },
    rowSub: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 14,
    },

    themeSegmented: {
      // let it stretch full width
    },

    energyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    energyEmoji: {
      fontSize: 22,
    },
    energyMeta: {
      flex: 1,
    },
    energySegmented: {
      marginBottom: 4,
    },

    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 18,
    },
  });
}
