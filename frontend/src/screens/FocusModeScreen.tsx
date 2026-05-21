import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Alert, Modal,
  Keyboard, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { Button, Surface, Icon, TouchableRipple, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/Theme';
import { useTheme, AppColors } from '../context/ThemeContext';

const API_URL = 'https://taskmanager-pn0w.onrender.com/tasks';
type Props = NativeStackScreenProps<RootStackParamList, 'FocusMode'>;
type FeelingRating = 'easy' | 'okay' | 'hard';
type ModalStep = 'feeling' | 'completed' | 'next-action' | null;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RATINGS: { value: FeelingRating; icon: string; label: string; color: string }[] = [
  { value: 'easy', icon: 'emoticon-happy-outline',   label: 'Easy', color: COLORS.secondary },
  { value: 'okay', icon: 'emoticon-neutral-outline',  label: 'Okay', color: COLORS.primary },
  { value: 'hard', icon: 'emoticon-sad-outline',      label: 'Hard', color: COLORS.danger },
];

export default function FocusModeScreen({ navigation, route }: Props) {
  const { task } = route.params;
  const { colors } = useTheme();
  const modalStyles = useMemo(() => makeModalStyles(colors), [colors]);

  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [modalStep, setModalStep] = useState<ModalStep>(null);
  const [feelingRating, setFeelingRating] = useState<FeelingRating | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState(task.nextAction ?? '');
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleFinish = () => {
    setRunning(false);
    setModalStep('feeling');
  };

  const handleFeelingPicked = (rating: FeelingRating) => {
    setFeelingRating(rating);
    setModalStep('completed');
  };

  const handleTaskCompletion = (taskCompleted: boolean) => {
    if (taskCompleted) {
      saveAndExit(true);
    } else {
      // Not done yet — ask them to update the next action before leaving
      setModalStep('next-action');
    }
  };

  const saveAndExit = async (taskCompleted: boolean) => {
    if (!feelingRating) return;
    setSubmitting(true);
    setModalStep(null);
    try {
      const actualMinutes = Math.max(1, Math.round(seconds / 60));
      await fetch(`${API_URL}/${task.id}/complete-focus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualMinutes, feelingRating }),
      });
      const updates: Record<string, unknown> = {};
      if (taskCompleted) updates.completed = true;
      if (nextActionDraft.trim() !== (task.nextAction ?? '')) {
        updates.nextAction = nextActionDraft.trim();
      }
      if (Object.keys(updates).length) {
        await fetch(`${API_URL}/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
      }
      navigation.navigate('TaskList');
    } catch {
      Alert.alert('Error', 'Could not save session');
      setSubmitting(false);
    }
  };

  const estimateSecs = (task.estimateMinutes ?? 30) * 60;
  const isOverTime = seconds > estimateSecs;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.focusLabel}>FOCUS MODE</Text>
        <Text style={styles.taskTitle}>{task.title}</Text>

        {!!task.nextAction && (
          <Surface style={styles.nextActionBox} elevation={0}>
            <Icon source="arrow-right-circle" size={18} color="#a78bfa" />
            <Text style={styles.nextActionText}>{task.nextAction}</Text>
          </Surface>
        )}
      </View>

      {/* Timer */}
      <View style={styles.timerSection}>
        <Surface
          style={[styles.timerRing, isOverTime && styles.timerRingOver]}
          elevation={4}
        >
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
          <Text style={styles.timerSub}>Est. {task.estimateMinutes ?? 30} min</Text>
        </Surface>

        {isOverTime && (
          <Surface style={styles.overTimeBadge} elevation={0}>
            <Icon source="clock-alert-outline" size={16} color="#f59e0b" />
            <Text style={styles.overTimeText}>Over estimate — keep going!</Text>
          </Surface>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Button
          mode="contained"
          icon={running ? 'pause' : 'play'}
          onPress={() => setRunning(r => !r)}
          style={styles.controlBtn}
          contentStyle={styles.controlBtnContent}
          buttonColor={running ? '#374151' : COLORS.secondary}
        >
          {running ? 'Pause' : 'Resume'}
        </Button>

        <Button
          mode="contained"
          icon="check"
          onPress={handleFinish}
          style={styles.controlBtn}
          contentStyle={styles.controlBtnContent}
          buttonColor={COLORS.primary}
        >
          Finish
        </Button>
      </View>

      {/* Step 1 — Feeling rating */}
      <Modal visible={modalStep === 'feeling'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Surface style={modalStyles.modalCard} elevation={4}>
            <Text style={modalStyles.modalTitle}>How'd that feel?</Text>
            <Text style={modalStyles.modalSub}>
              You focused for {formatTime(seconds)}
              {task.estimateMinutes ? ` · estimated ${task.estimateMinutes} min` : ''}
            </Text>
            <View style={styles.ratingRow}>
              {RATINGS.map(r => (
                <TouchableRipple
                  key={r.value}
                  onPress={() => handleFeelingPicked(r.value)}
                  style={styles.ratingBtn}
                  borderless
                >
                  <View style={styles.ratingBtnInner}>
                    <Icon source={r.icon} size={48} color={r.color} />
                    <Text style={[styles.ratingLabel, { color: r.color }]}>{r.label}</Text>
                  </View>
                </TouchableRipple>
              ))}
            </View>
          </Surface>
        </View>
      </Modal>

      {/* Step 3 — Update next action (only when "Not yet") */}
      <Modal visible={modalStep === 'next-action'} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Backdrop — tap anywhere above the card to dismiss keyboard */}
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={Keyboard.dismiss} />
          {/* Card — sibling of backdrop so taps here don't trigger backdrop */}
          <Surface style={modalStyles.modalCard} elevation={4}>
            <View style={{ alignSelf: 'center', marginBottom: 12 }}>
              <Icon source="arrow-right-circle-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={modalStyles.modalTitle}>Where did you leave off?</Text>
            <Text style={modalStyles.modalSub}>Set your next action so you know exactly where to pick up.</Text>
            <TextInput
              value={nextActionDraft}
              onChangeText={setNextActionDraft}
              mode="outlined"
              placeholder="e.g. Write the conclusion paragraph"
              outlineColor={colors.border}
              activeOutlineColor={COLORS.primary}
              style={modalStyles.nextActionInput}
              backgroundColor={colors.surface}
              multiline
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <Button
              mode="contained"
              onPress={() => saveAndExit(false)}
              disabled={submitting}
              buttonColor={COLORS.primary}
              style={styles.completionBtn}
            >
              Save & exit
            </Button>
            <Button
              mode="text"
              onPress={() => saveAndExit(false)}
              disabled={submitting}
              textColor={colors.textMuted}
              compact
            >
              Skip
            </Button>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>

      {/* Step 2 — Task completion */}
      <Modal visible={modalStep === 'completed'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Surface style={modalStyles.modalCard} elevation={4}>
            <View style={{ alignSelf: 'center', marginBottom: 12 }}>
              <Icon source="checkbox-marked-circle-outline" size={48} color={COLORS.primary} />
            </View>
            <Text style={modalStyles.modalTitle}>Did you finish the task?</Text>
            <Text style={modalStyles.modalSub}>"{task.title}"</Text>
            <View style={styles.completionRow}>
              <Button
                mode="contained"
                icon="check"
                onPress={() => handleTaskCompletion(true)}
                disabled={submitting}
                style={styles.completionBtn}
                buttonColor={COLORS.secondary}
              >
                Yes, done!
              </Button>
              <Button
                mode="outlined"
                icon="clock-outline"
                onPress={() => handleTaskCompletion(false)}
                disabled={submitting}
                style={styles.completionBtn}
                textColor={COLORS.primary}
              >
                Not yet
              </Button>
            </View>
          </Surface>
        </View>
      </Modal>
    </View>
  );
}

// Modal-specific styles that respond to theme
function makeModalStyles(colors: AppColors) {
  return StyleSheet.create({
    modalCard: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 28,
      paddingBottom: 52,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    modalSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 28 },
    nextActionInput: { backgroundColor: colors.surface, marginBottom: 16 },
  });
}

// Main screen styles — always dark (immersive focus mode)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0c29', padding: 24 },

  header: { marginTop: 40, marginBottom: 40 },
  focusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 3,
    marginBottom: 12,
  },
  taskTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: 'white',
    marginBottom: 16,
    lineHeight: 32,
  },
  nextActionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(79,70,229,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  nextActionText: { flex: 1, fontSize: 15, color: '#c4b5fd', lineHeight: 22 },

  timerSection: { alignItems: 'center', marginBottom: 52 },
  timerRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79,70,229,0.12)',
  },
  timerRingOver: { borderColor: '#f59e0b' },
  timerText: { fontSize: 44, fontWeight: '800', color: 'white' },
  timerSub: { fontSize: 13, color: '#666', marginTop: 4 },
  overTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  overTimeText: { color: '#f59e0b', fontWeight: '600', fontSize: 13 },

  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: { flex: 1, borderRadius: 14 },
  controlBtnContent: { paddingVertical: 8 },

  // Rating modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ratingBtn: { borderRadius: 16, overflow: 'hidden' },
  ratingBtnInner: { alignItems: 'center', padding: 16, gap: 8 },
  ratingLabel: { fontSize: 14, fontWeight: '700' },

  completionRow: { flexDirection: 'column', gap: 10, marginTop: 8 },
  completionBtn: { borderRadius: 10, marginBottom: 8 },
});
