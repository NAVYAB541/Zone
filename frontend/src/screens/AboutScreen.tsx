import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Icon } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

const APP_VERSION = '1.0.0';

const FEATURES = [
  {
    icon: 'creation',
    color: '#818cf8',
    title: 'AI Planning',
    desc: 'Drop in any task and our AI quietly breaks it into 4 to 7 focused steps, complete with time estimates, energy levels, and a clear first action.',
  },
  {
    icon: 'lightning-bolt',
    color: '#f59e0b',
    title: 'Energy Matching',
    desc: 'Launch Me reads your energy level (high, medium, or low) and surfaces the right task for right now. No decision fatigue.',
  },
  {
    icon: 'timer-outline',
    color: '#34d399',
    title: 'Focus Sessions',
    desc: 'Lock in with a full-screen timer. When you\'re done, log how it felt. Small sessions compound into big progress.',
  },
  {
    icon: 'chart-line',
    color: '#f87171',
    title: 'Productivity Score',
    desc: 'A weighted score that accounts for subtask depth, not just checkboxes. See real momentum, not just busy work.',
  },
];

export default function AboutScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);

  const badgeBg   = theme === 'dark' ? 'rgba(99,102,241,0.15)' : '#1e1b4b';
  const ringColor = theme === 'dark' ? colors.primary : '#a5b4fc';
  const dotColor  = theme === 'dark' ? colors.primary : '#c4b5fd';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Logo + name ── */}
      <View style={styles.hero}>
        <View style={[styles.iconWrap, { backgroundColor: badgeBg }]}>
          <Svg width={80} height={80} viewBox="0 0 120 120">
            <Circle cx="60" cy="60" r="50" fill="none" stroke={ringColor} strokeOpacity={0.3} strokeWidth={8} />
            <Circle cx="60" cy="60" r="36" fill="none" stroke={ringColor} strokeOpacity={0.6} strokeWidth={8} />
            <Circle cx="60" cy="60" r="22" fill="none" stroke={ringColor} strokeWidth={8} />
            <Circle cx="60" cy="60" r="7"  fill={dotColor} />
          </Svg>
        </View>

        <Text style={styles.appName}>Zone</Text>
        <Text style={styles.tagline}>Less overwhelm. More momentum.</Text>
      </View>

      {/* ── Calming paragraph ── */}
      <View style={styles.about}>
        <Text style={styles.aboutText}>
          Some days your to-do list feels like a wall you can't climb. Zone is the quiet voice that says:{' '}
          <Text style={styles.aboutEmphasis}>you don't have to climb it all at once.</Text>
        </Text>
        <Text style={styles.aboutText}>
          We break your biggest, most daunting tasks into small steps, matched to your energy and the time you actually have. Then we help you lock in with focused sessions that feel manageable, not exhausting.
        </Text>
        <Text style={styles.aboutText}>
          You don't need more willpower. You just need a clearer path.{' '}
          <Text style={styles.aboutEmphasis}>Zone clears it for you.</Text>
        </Text>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Features ── */}
      <Text style={styles.sectionTitle}>What Zone does</Text>
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: f.color + '18' }]}>
              <Icon source={f.icon} size={22} color={f.color} />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Built for students and anyone who wants</Text>
        <Text style={styles.footerText}>to stop feeling overwhelmed.</Text>
        <Text style={styles.version}>Version {APP_VERSION}</Text>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof import('../context/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 60,
    },

    // Hero
    hero: {
      alignItems: 'center',
      marginBottom: 36,
    },
    iconWrap: {
      width: 100,
      height: 100,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    appName: {
      fontSize: 40,
      fontWeight: '900',
      color: colors.primary,
      letterSpacing: -1.5,
      marginBottom: 6,
    },
    tagline: {
      fontSize: 15,
      color: colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },

    // About
    about: {
      gap: 14,
      marginBottom: 36,
    },
    aboutText: {
      fontSize: 16,
      lineHeight: 26,
      color: colors.textSecondary,
      textAlign: 'left',
    },
    aboutEmphasis: {
      color: colors.text,
      fontWeight: '600',
    },

    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginBottom: 28,
    },

    // Features
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 16,
    },
    features: {
      gap: 12,
      marginBottom: 36,
    },
    featureCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    featureIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    featureText: {
      flex: 1,
      gap: 4,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    featureDesc: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
    },

    // Footer
    footer: {
      alignItems: 'center',
      gap: 4,
    },
    footerText: {
      fontSize: 13,
      color: colors.textDisabled,
      textAlign: 'center',
    },
    version: {
      fontSize: 12,
      color: colors.textDisabled,
      marginTop: 12,
    },
  });
}
