import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Modal } from 'react-native';
import {
  Button,
  Surface,
  Chip,
  Icon,
  ActivityIndicator,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList, Task } from '../types';
import { COLORS } from '../constants/Theme';
import dayjs from 'dayjs';
import { useTheme, AppColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const API_URL = 'https://taskmanager-pn0w.onrender.com/tasks';
const TIME_WINDOWS = [15, 30, 60, 90, 120] as const;
type TimeWindow = typeof TIME_WINDOWS[number];
type EnergyLevel = 'high' | 'medium' | 'low';
type Props = NativeStackScreenProps<RootStackParamList, 'LaunchMe'>;

const ENERGY_PREFS_KEY = 'energy_prefs';

type EnergyPrefs = {
  morning: EnergyLevel;   // 6–12
  afternoon: EnergyLevel; // 12–18
  evening: EnergyLevel;   // 18–6
};

const DEFAULT_PREFS: EnergyPrefs = { morning: 'high', afternoon: 'medium', evening: 'low' };

function getEnergyFromPrefs(prefs: EnergyPrefs): EnergyLevel {
  const h = new Date().getHours();
  if (h >= 6 && h < 12)  return prefs.morning;
  if (h >= 12 && h < 18) return prefs.afternoon;
  return prefs.evening;
}

function fmtTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const ENERGY_META: Record<EnergyLevel, { icon: string; color: string; label: string }> = {
  high:   { icon: 'lightning-bolt',        color: '#f59e0b', label: 'High energy' },
  medium: { icon: 'weather-partly-cloudy', color: COLORS.primary, label: 'Medium energy' },
  low:    { icon: 'weather-night',         color: '#6366f1', label: 'Low energy' },
};

type LaunchItem = {
  task: Task;
  nextSubtask?: Task;
  effectiveMinutes: number;
};

export default function LaunchMeScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [window, setWindow]       = useState<TimeWindow>(30);
  const [items, setItems]         = useState<LaunchItem[]>([]);
  const [loading, setLoading]     = useState(false);
  const [prefs, setPrefs]         = useState<EnergyPrefs>(DEFAULT_PREFS);
  const [showSettings, setShowSettings] = useState(false);
  const [draftPrefs, setDraftPrefs]     = useState<EnergyPrefs>(DEFAULT_PREFS);

  const loadPrefs = async () => {
    try {
      const raw = await AsyncStorage.getItem(ENERGY_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as EnergyPrefs;
        setPrefs(p);
        return p;
      }
    } catch {}
    return DEFAULT_PREFS;
  };

  const savePrefs = async (p: EnergyPrefs) => {
    await AsyncStorage.setItem(ENERGY_PREFS_KEY, JSON.stringify(p));
    setPrefs(p);
    setShowSettings(false);
  };

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const currentPrefs = await loadPrefs();
      const res = await authFetch(`${API_URL}?completed=false`);
      const all: Task[] = await res.json();

      // Separate top-level tasks and subtasks
      const subtaskMap: Record<string, Task[]> = {};
      all.forEach(t => {
        if (t.parentTaskId) {
          if (!subtaskMap[t.parentTaskId]) subtaskMap[t.parentTaskId] = [];
          subtaskMap[t.parentTaskId].push(t);
        }
      });
      Object.values(subtaskMap).forEach(subs =>
        subs.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
      );

      const topLevel = all.filter(t => !t.parentTaskId);

      // Build launch items
      const launchItems: LaunchItem[] = [];
      for (const task of topLevel) {
        const subs = subtaskMap[task.id] ?? [];
        const incompleteSubs = subs.filter(s => !s.completed);

        if (subs.length > 0) {
          // Project with subtasks — only surface the first incomplete subtask
          const next = incompleteSubs[0];
          if (!next) continue; // all subtasks done, skip
          const effectiveMinutes = next.estimateMinutes ?? 30;
          if (effectiveMinutes <= window) {
            launchItems.push({ task, nextSubtask: next, effectiveMinutes });
          }
        } else {
          // Standalone task
          const effectiveMinutes = task.estimateMinutes ?? 30;
          if (effectiveMinutes <= window) {
            launchItems.push({ task, effectiveMinutes });
          }
        }
      }

      // Sort by urgency
      launchItems.sort((a, b) => {
        const aOverdue = a.task.dueDate && dayjs(a.task.dueDate).isBefore(dayjs()) ? 0 : 1;
        const bOverdue = b.task.dueDate && dayjs(b.task.dueDate).isBefore(dayjs()) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        if (a.task.dueDate && b.task.dueDate) return dayjs(a.task.dueDate).valueOf() - dayjs(b.task.dueDate).valueOf();
        if (a.task.dueDate) return -1;
        if (b.task.dueDate) return 1;
        return (PRIORITY_ORDER[a.task.priority ?? 'medium']) - (PRIORITY_ORDER[b.task.priority ?? 'medium']);
      });

      setItems(launchItems.slice(0, 3));
      setPrefs(currentPrefs);
    } catch {
      Alert.alert('Error', 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [window]);

  useFocusEffect(useCallback(() => { loadTasks(); }, [loadTasks]));

  const energyNow = getEnergyFromPrefs(prefs);
  const energyMeta = ENERGY_META[energyNow];

  const startTask = (item: LaunchItem) => {
    // Focus on the subtask if it's a project, else the task itself
    navigation.navigate('FocusMode', { task: item.nextSubtask ?? item.task });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Energy banner */}
      <Surface style={styles.energyBanner} elevation={0}>
        <Icon source={energyMeta.icon} size={24} color={energyMeta.color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.energyLabel}>Right now</Text>
          <Text style={[styles.energyValue, { color: energyMeta.color }]}>
            {energyMeta.label}
          </Text>
        </View>
        <IconButton
          icon="cog-outline"
          size={20}
          iconColor={colors.textMuted}
          onPress={() => { setDraftPrefs(prefs); setShowSettings(true); }}
          style={{ margin: 0 }}
        />
      </Surface>

      {/* Time window picker */}
      <Text style={styles.sectionLabel}>I have...</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.windowRow}>
        {TIME_WINDOWS.map(w => (
          <Chip
            key={w}
            selected={window === w}
            onPress={() => setWindow(w)}
            selectedColor={colors.primary}
            style={[styles.windowChip, window === w && styles.windowChipSelected]}
            showSelectedCheck={false}
          >
            {fmtTime(w)}
          </Chip>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Best tasks for right now</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon source="check-all" size={56} color={colors.border} />
          <Text style={styles.emptyText}>No tasks fit in {fmtTime(window)}</Text>
          <Text style={styles.emptySubtext}>
            Try a longer window, or add tasks with shorter estimates.
          </Text>
        </View>
      ) : (
        items.map((item, index) => (
          <Surface key={item.task.id} style={styles.taskCard} elevation={1}>
            <View style={styles.taskRank}>
              <Text style={styles.taskRankText}>#{index + 1}</Text>
            </View>

            <View style={{ flex: 1 }}>
              {item.nextSubtask ? (
                <>
                  <Text style={styles.projectLabel} numberOfLines={1}>{item.task.title}</Text>
                  <Text style={styles.taskTitle} numberOfLines={2}>{item.nextSubtask.title}</Text>
                  {!!item.nextSubtask.description && (
                    <Text style={styles.taskDesc} numberOfLines={2}>{item.nextSubtask.description}</Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.taskTitle} numberOfLines={2}>{item.task.title}</Text>
                  {!!item.task.nextAction && (
                    <View style={styles.nextActionRow}>
                      <Icon source="arrow-right" size={14} color={colors.textMuted} />
                      <Text style={styles.nextActionText} numberOfLines={1}>{item.task.nextAction}</Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.metaRow}>
                <Chip
                  compact
                  icon="timer-outline"
                  mode="flat"
                  style={styles.timeBadge}
                  textStyle={styles.timeBadgeText}
                >
                  {fmtTime(item.effectiveMinutes)}
                </Chip>

                {item.task.dueDate && (
                  <Chip
                    compact
                    icon="calendar"
                    mode="flat"
                    style={styles.dateBadge}
                    textStyle={styles.dateBadgeText}
                  >
                    {dayjs(item.task.dueDate).format('DD MMM')}
                  </Chip>
                )}
              </View>
            </View>

            <Button
              mode="contained"
              onPress={() => startTask(item)}
              buttonColor={colors.primary}
              style={styles.startBtn}
              compact
            >
              Start
            </Button>
          </Surface>
        ))
      )}

      {/* Energy settings modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={4}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Energy Schedule</Text>
              <IconButton icon="close" size={20} onPress={() => setShowSettings(false)} style={{ margin: 0 }} />
            </View>
            <Text style={styles.modalSub}>Set when you feel most productive so Launch Me picks the right tasks.</Text>

            {([
              { key: 'morning',   label: 'Morning (6am–12pm)' },
              { key: 'afternoon', label: 'Afternoon (12pm–6pm)' },
              { key: 'evening',   label: 'Evening (6pm–6am)' },
            ] as { key: keyof EnergyPrefs; label: string }[]).map(({ key, label }) => (
              <View key={key} style={styles.prefRow}>
                <Text style={styles.prefLabel}>{label}</Text>
                <SegmentedButtons
                  value={draftPrefs[key]}
                  onValueChange={v => setDraftPrefs(p => ({ ...p, [key]: v as EnergyLevel }))}
                  buttons={[
                    { value: 'high',   label: 'High' },
                    { value: 'medium', label: 'Med' },
                    { value: 'low',    label: 'Low' },
                  ]}
                  style={styles.prefSegmented}
                />
              </View>
            ))}

            <Button mode="contained" buttonColor={colors.primary} onPress={() => savePrefs(draftPrefs)} style={{ marginTop: 8 }}>
              Save
            </Button>
          </Surface>
        </View>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40 },

    energyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 24,
    },
    energyLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
    energyValue: { fontSize: 17, fontWeight: '700' },

    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },

    windowRow: { flexDirection: 'row', gap: 8, marginBottom: 28, paddingBottom: 4 },
    windowChip: { backgroundColor: colors.surfaceVariant },
    windowChipSelected: { backgroundColor: colors.primary + '20' },

    taskCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },
    taskRank: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    taskRankText: { fontSize: 13, fontWeight: '800', color: colors.primary },

    projectLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    taskTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
    taskDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 6, lineHeight: 17 },

    nextActionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 8 },
    nextActionText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    timeBadge: { backgroundColor: colors.primary + '15' },
    timeBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
    dateBadge: { backgroundColor: colors.surfaceVariant },
    dateBadgeText: { fontSize: 12, color: colors.textSecondary },

    startBtn: { borderRadius: 10, flexShrink: 0 },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 17, fontWeight: '700', color: colors.text },
    emptySubtext: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

    // Settings modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalSub: { fontSize: 13, color: colors.textMuted, marginBottom: 20, lineHeight: 18 },
    prefRow: { marginBottom: 16 },
    prefLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    prefSegmented: {},
  });
}
