import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { TextInput, Button, SegmentedButtons, Surface, Switch, IconButton, Icon } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, Task } from '../types';
import { COLORS } from '../constants/Theme';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { cancelTaskReminder, scheduleTaskReminder } from '../utils/notifications';
import { useTheme, AppColors } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetails'>;
const API_URL = 'https://taskmanager-pn0w.onrender.com/tasks';

type SubtaskDraft = { title: string; description: string; estimateMinutes: string };

export default function TaskDetailsScreen({ navigation, route }: Props) {
  const { task } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle]               = useState(task.title);
  const [description, setDescription]   = useState(task.description || '');
  const [priority, setPriority]         = useState<'low' | 'medium' | 'high'>(task.priority || 'medium');
  const [dueDate, setDueDate]           = useState<Date | null>(task.dueDate ? new Date(task.dueDate) : null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted]       = useState(task.completed);
  const [tagsInput, setTagsInput]       = useState(task.tags?.join(', ') ?? '');
  const [category, setCategory]         = useState(task.category || 'General');
  const totalMins = task.estimateMinutes ?? 30;
  const [estimateHours,   setEstimateHours]   = useState(String(Math.floor(totalMins / 60)));
  const [estimateMinutes, setEstimateMinutes] = useState(String(totalMins % 60));
  const [energy, setEnergy]             = useState<'high' | 'medium' | 'low' | null>(task.energy ?? null);
  const [saving, setSaving]             = useState(false);

  // Existing subtasks
  const [subtasks, setSubtasks]               = useState<Task[]>([]);
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [newSubTitle, setNewSubTitle]         = useState('');
  const [newSubDesc, setNewSubDesc]           = useState('');
  const [newSubEst, setNewSubEst]             = useState('30');

  useEffect(() => {
    // Load subtasks for this task
    fetch(`${API_URL}?parentTaskId=${task.id}`)
      .then(r => r.json())
      .then((data: Task[]) => {
        const sorted = [...data].sort((a, b) =>
          new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
        );
        setSubtasks(sorted);
      })
      .catch(() => {});
  }, [task.id]);

  const addSubtask = async () => {
    if (!newSubTitle.trim()) return;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:           newSubTitle.trim(),
          description:     newSubDesc.trim(),
          category,
          priority,
          dueDate:         dueDate?.toISOString() ?? null,
          estimateMinutes: parseInt(newSubEst) || 30,
          parentTaskId:    task.id,
        }),
      });
      const created: Task = await res.json();
      setSubtasks(prev => [...prev, created]);
      setNewSubTitle('');
      setNewSubDesc('');
      setNewSubEst('30');
      setShowSubtaskForm(false);
    } catch {
      Alert.alert('Error', 'Could not add subtask');
    }
  };

  const toggleSubtask = async (sub: Task) => {
    try {
      await fetch(`${API_URL}/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !sub.completed }),
      });
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s));
    } catch {}
  };

  const deleteSubtask = async (sub: Task) => {
    try {
      await fetch(`${API_URL}/${sub.id}`, { method: 'DELETE' });
      setSubtasks(prev => prev.filter(s => s.id !== sub.id));
    } catch {}
  };

  const updateTask = async () => {
    if (!title.trim()) return;
    const parsedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      setSaving(true);
      await fetch(`${API_URL}/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, priority,
          dueDate: dueDate?.toISOString() || null,
          completed,
          category: category.trim() || 'General',
          tags: parsedTags,
          estimateMinutes: (parseInt(estimateHours) || 0) * 60 + (parseInt(estimateMinutes) || 0) || 30,
          energy,
        }),
      });
      if (completed) {
        await cancelTaskReminder(task.id);
      } else if (dueDate) {
        await scheduleTaskReminder(task.id, title, dueDate.toISOString());
      }
      navigation.goBack();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const isSubtask = !!task.parentTaskId;
  const nextIncomplete = subtasks.find(s => !s.completed);
  const doneCount = subtasks.filter(s => s.completed).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <TextInput label="Title" value={title} onChangeText={setTitle}
        mode="outlined" style={styles.input} outlineColor={colors.border} activeOutlineColor={COLORS.primary}
        backgroundColor={colors.surface} />

      <TextInput label="Description" value={description} onChangeText={setDescription}
        mode="outlined" multiline numberOfLines={3} style={styles.input}
        outlineColor={colors.border} activeOutlineColor={COLORS.primary}
        backgroundColor={colors.surface} />

      {/* Next step — derived from subtasks, read-only */}
      {nextIncomplete && (
        <Surface style={styles.nextStepBanner} elevation={0}>
          <Text style={styles.nextStepLabel}>Next step</Text>
          <Text style={styles.nextStepTitle}>{nextIncomplete.title}</Text>
          {!!nextIncomplete.description && (
            <Text style={styles.nextStepDesc}>{nextIncomplete.description}</Text>
          )}
        </Surface>
      )}

      {/* Time estimate — hours + minutes */}
      <Text style={styles.label}>Time Estimate</Text>
      <View style={styles.estimateRow}>
        <TextInput
          label="hr"
          value={estimateHours}
          onChangeText={setEstimateHours}
          mode="outlined"
          keyboardType="number-pad"
          style={styles.estimateInput}
          outlineColor={colors.border}
          activeOutlineColor={COLORS.primary}
          backgroundColor={colors.surface}
          left={<TextInput.Icon icon="timer-outline" />}
        />
        <TextInput
          label="min"
          value={estimateMinutes}
          onChangeText={setEstimateMinutes}
          mode="outlined"
          keyboardType="number-pad"
          style={styles.estimateInput}
          outlineColor={colors.border}
          activeOutlineColor={COLORS.primary}
          backgroundColor={colors.surface}
        />
      </View>

      {/* Energy */}
      <Text style={styles.label}>Energy Required</Text>
      <SegmentedButtons
        value={energy ?? ''}
        onValueChange={v => setEnergy(v === energy ? null : v as any)}
        buttons={[
          { value: 'high',   label: 'High',   icon: 'lightning-bolt' },
          { value: 'medium', label: 'Medium', icon: 'weather-partly-cloudy' },
          { value: 'low',    label: 'Low',    icon: 'weather-night' },
        ]}
        style={styles.segmented}
      />

      {/* Priority */}
      <Text style={styles.label}>Priority</Text>
      <SegmentedButtons
        value={priority}
        onValueChange={v => setPriority(v as any)}
        buttons={[
          { value: 'low',    label: 'Low',    icon: 'chevron-down' },
          { value: 'medium', label: 'Medium', icon: 'minus' },
          { value: 'high',   label: 'High',   icon: 'chevron-up' },
        ]}
        style={styles.segmented}
      />

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <Surface style={styles.pickerSurface} elevation={0}>
        <Picker selectedValue={category} onValueChange={setCategory} style={styles.picker}>
          <Picker.Item label="General"  value="General" />
          <Picker.Item label="Work"     value="Work" />
          <Picker.Item label="Personal" value="Personal" />
          <Picker.Item label="Study"    value="Study" />
        </Picker>
      </Surface>

      {/* Tags */}
      <TextInput label="Tags (comma-separated)" value={tagsInput} onChangeText={setTagsInput}
        mode="outlined" placeholder="e.g. Urgent, Shopping" style={styles.input}
        outlineColor={colors.border} activeOutlineColor={COLORS.primary}
        backgroundColor={colors.surface}
        left={<TextInput.Icon icon="tag-multiple-outline" />} />

      {/* Due date */}
      <Text style={styles.label}>Due Date</Text>
      <Button mode="outlined" icon="calendar" onPress={() => setShowDatePicker(true)}
        style={styles.dateButton} textColor={dueDate ? COLORS.primary : colors.textMuted}>
        {dueDate ? dayjs(dueDate).format('DD MMM YYYY') : 'Select date'}
      </Button>
      {dueDate && (
        <Button mode="text" onPress={() => setDueDate(null)} textColor={COLORS.danger}
          compact style={{ alignSelf: 'flex-end', marginTop: -8 }}>Clear</Button>
      )}
      {showDatePicker && (
        <DateTimePicker value={dueDate || new Date()} mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => { setShowDatePicker(Platform.OS === 'ios'); if (date) setDueDate(date); }} />
      )}

      {/* ── Subtasks + AI card — only for top-level tasks ── */}
      {!isSubtask && (
        <>
          <View style={styles.subtasksHeader}>
            <View>
              <Text style={styles.label}>Subtasks</Text>
              {subtasks.length > 0 && (
                <Text style={styles.subtaskProgress}>{doneCount}/{subtasks.length} done</Text>
              )}
            </View>
            <Button mode="text" compact icon="plus" textColor={COLORS.primary}
              onPress={() => setShowSubtaskForm(v => !v)}>Add</Button>
          </View>

          {subtasks.map((s) => (
            <Surface key={s.id} style={[styles.subtaskRow, s.completed && styles.subtaskRowDone]} elevation={0}>
              <IconButton
                icon={s.completed ? 'check-circle' : 'circle-outline'}
                iconColor={s.completed ? COLORS.secondary : colors.textDisabled}
                size={22}
                onPress={() => toggleSubtask(s)}
                style={{ margin: 0 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.subtaskTitle, s.completed && styles.subtaskTitleDone]}>{s.title}</Text>
                {!!s.description && <Text style={styles.subtaskDesc} numberOfLines={2}>{s.description}</Text>}
                <Text style={styles.subtaskEst}>{s.estimateMinutes ?? 30} min</Text>
              </View>
              <IconButton icon="pencil-outline" iconColor={colors.textDisabled} size={18}
                onPress={() => navigation.navigate('TaskDetails', { task: s })} style={{ margin: 0 }} />
              <IconButton icon="delete-outline" iconColor={colors.border} size={18}
                onPress={() => deleteSubtask(s)} style={{ margin: 0 }} />
            </Surface>
          ))}

          {showSubtaskForm && (
            <Surface style={styles.subtaskForm} elevation={0}>
              <TextInput label="Subtask title" value={newSubTitle} onChangeText={setNewSubTitle}
                mode="outlined" style={styles.subInput} outlineColor={colors.border} activeOutlineColor={COLORS.primary}
                backgroundColor={colors.surface} dense />
              <TextInput label="Description (optional)" value={newSubDesc} onChangeText={setNewSubDesc}
                mode="outlined" style={styles.subInput} outlineColor={colors.border} activeOutlineColor={COLORS.primary}
                backgroundColor={colors.surface} dense />
              <TextInput label="Estimate (minutes)" value={newSubEst} onChangeText={setNewSubEst}
                mode="outlined" keyboardType="number-pad" style={styles.subInput}
                outlineColor={colors.border} activeOutlineColor={COLORS.primary}
                backgroundColor={colors.surface} dense />
              <View style={styles.subFormActions}>
                <Button mode="text" textColor={colors.textMuted} compact onPress={() => setShowSubtaskForm(false)}>Cancel</Button>
                <Button mode="contained" buttonColor={COLORS.primary} compact onPress={addSubtask}
                  disabled={!newSubTitle.trim()}>Add subtask</Button>
              </View>
            </Surface>
          )}

          <Surface style={styles.aiPromptCard} elevation={0}>
            <Icon source="head-cog-outline" size={22} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.aiPromptTitle}>Need a plan?</Text>
              <Text style={styles.aiPromptSub}>Let AI break it into subtasks.</Text>
            </View>
            <Button mode="contained" compact buttonColor={COLORS.primary}
              onPress={() => navigation.navigate('AIPlanner', {
                title: title.trim(), description, category, priority,
                dueDate: dueDate?.toISOString() ?? null,
                existingTaskId: task.id,
              })}>
              Plan it
            </Button>
          </Surface>
        </>
      )}

      {/* Completed toggle */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Mark as Completed</Text>
        <Switch value={completed} onValueChange={setCompleted} color={COLORS.primary} />
      </View>

      <Button mode="contained" onPress={updateTask} loading={saving}
        disabled={!title.trim() || saving} style={styles.saveButton}
        contentStyle={styles.saveButtonContent} buttonColor={COLORS.primary}>
        Update Task
      </Button>
    </ScrollView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 48 },

    input: { backgroundColor: colors.surface, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
    segmented: { marginBottom: 16 },

    nextStepBanner: {
      backgroundColor: COLORS.primary + '10', borderRadius: 10,
      padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    },
    nextStepLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    nextStepTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
    nextStepDesc: { fontSize: 12, color: colors.textSecondary },

    pickerSurface: { backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 16, overflow: 'hidden' },
    picker: { width: '100%' },
    dateButton: { borderColor: colors.border, marginBottom: 8, justifyContent: 'flex-start' },

    subtasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    subtaskProgress: { fontSize: 12, color: colors.textMuted, marginTop: -4 },

    subtaskRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: colors.surface, borderRadius: 10, padding: 8, marginBottom: 8,
      borderWidth: 1, borderColor: colors.borderLight,
    },
    subtaskRowDone: { opacity: 0.5 },
    subtaskTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    subtaskTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
    subtaskDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    subtaskEst: { fontSize: 11, color: COLORS.primary, marginTop: 2 },

    subtaskForm: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.borderLight },
    subInput: { backgroundColor: colors.surface, marginBottom: 8 },
    subFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },

    switchRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colors.surface, padding: 14, borderRadius: 10,
      borderWidth: 1, borderColor: colors.border, marginBottom: 20, marginTop: 8,
    },
    switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    estimateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    estimateInput: { flex: 1, backgroundColor: colors.surface },

    aiPromptCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: COLORS.primary + '10', borderRadius: 12, padding: 14, marginBottom: 14,
    },
    aiPromptTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
    aiPromptSub: { fontSize: 12, color: colors.textMuted },

    saveButton: { borderRadius: 10, marginTop: 4 },
    saveButtonContent: { paddingVertical: 6 },
  });
}
