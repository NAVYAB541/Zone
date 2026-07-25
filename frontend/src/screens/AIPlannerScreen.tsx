import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import {
  TextInput,
  Button,
  Surface,
  Icon,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, AISubtask, AIPlanResult } from '../types';
import { COLORS } from '../constants/Theme';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme, AppColors } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const BASE_URL = 'https://taskmanager-pn0w.onrender.com';
type Props = NativeStackScreenProps<RootStackParamList, 'AIPlanner'>;

type AttachedFile = {
  uri: string;
  mimeType: string;
  name: string;
  base64: string;
};

const ENERGY_COLOR = {
  high: COLORS.danger,
  medium: '#f59e0b',
  low: COLORS.secondary,
};

export default function AIPlannerScreen({ navigation, route }: Props) {
  const { title, description: initialDesc, category, priority, dueDate, existingTaskId } = route.params;
  const { colors } = useTheme();
  const { authFetch } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [description, setDescription] = useState(initialDesc);
  const [totalHours, setTotalHours] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIPlanResult | null>(null);
  const [subtasks, setSubtasks] = useState<AISubtask[]>([]);
  const [saving, setSaving] = useState(false);

  // ─── File pickers ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow photo access to attach images.');

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });

    if (!picked.canceled && picked.assets[0]) {
      const asset = picked.assets[0];
      setFiles(prev => [...prev, {
        uri: asset.uri,
        mimeType: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'image.jpg',
        base64: asset.base64 ?? '',
      }]);
    }
  };

  const pickDocument = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!picked.canceled && picked.assets[0]) {
      const asset = picked.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      });
      setFiles(prev => [...prev, {
        uri: asset.uri,
        mimeType: 'application/pdf',
        name: asset.name,
        base64,
      }]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Call AI ───────────────────────────────────────────────────────────────
  const runAI = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await authFetch(`${BASE_URL}/ai/plan-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          totalHours: totalHours ? parseFloat(totalHours) : undefined,
          files: files.map(f => ({ mimeType: f.mimeType, base64: f.base64 })),
        }),
      });
      const data: AIPlanResult = await res.json();
      if (!data.subtasks) throw new Error('Bad response');
      setResult(data);
      setSubtasks(data.subtasks);
    } catch {
      Alert.alert('Error', 'AI planning failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Save all tasks ────────────────────────────────────────────────────────
  const saveAll = async () => {
    // If there's an existing task, check if it already has subtasks
    if (existingTaskId) {
      const res = await authFetch(`${BASE_URL}/tasks?parentTaskId=${existingTaskId}`);
      const existing: { id: string }[] = await res.json();
      if (existing.length > 0) {
        await new Promise<void>((resolve, reject) => {
          Alert.alert(
            'Subtasks already exist',
            `This task already has ${existing.length} subtask${existing.length > 1 ? 's' : ''}. What would you like to do?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
              {
                text: 'Add to existing',
                onPress: () => resolve(),
              },
              {
                text: 'Replace all',
                style: 'destructive',
                onPress: async () => {
                  await Promise.all(existing.map(t => authFetch(`${BASE_URL}/tasks/${t.id}`, { method: 'DELETE' })));
                  resolve();
                },
              },
            ]
          );
        });
      }
    }

    setSaving(true);
    try {
      let parentId = existingTaskId;

      if (!parentId) {
        // Create the parent task only if we don't have an existing one
        const parentRes = await authFetch(`${BASE_URL}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            priority,
            dueDate,
            category,
            estimateMinutes: subtasks.reduce((sum, s) => sum + s.estimateMinutes, 0),
          }),
        });
        const parent = await parentRes.json();
        parentId = parent.id;
      }

      // Bulk-create subtasks linked to parent
      await authFetch(`${BASE_URL}/tasks/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: subtasks.map(s => ({
            title:           s.title,
            description:     s.description,
            category,
            priority,
            dueDate,
            estimateMinutes: s.estimateMinutes,
            energy:          s.energy,
            nextAction:      s.nextAction,
            parentTaskId:    parentId,
          })),
        }),
      });

      navigation.navigate('TaskList');
    } catch {
      Alert.alert('Error', 'Could not save tasks. Try again.');
      setSaving(false);
    }
  };

  const updateSubtask = (index: number, field: keyof AISubtask, value: string | number) => {
    setSubtasks(prev =>
      prev.map((s, i) => i === index ? { ...s, [field]: value } : s)
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Task being planned */}
      <Surface style={styles.taskHeader} elevation={0}>
        <Icon source="head-cog-outline" size={22} color={COLORS.primary} />
        <Text style={styles.taskHeaderTitle} numberOfLines={2}>{title}</Text>
      </Surface>

      {/* Only show input form if AI hasn't responded yet */}
      {!result && (
        <>
          <TextInput
            label="Describe the task in more detail (optional)"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={COLORS.primary}
            backgroundColor={colors.surface}
          />

          <TextInput
            label="How many hours can you give this? (e.g. 2)"
            value={totalHours}
            onChangeText={setTotalHours}
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={COLORS.primary}
            backgroundColor={colors.surface}
            left={<TextInput.Icon icon="clock-outline" />}
          />

          {/* Attachments */}
          <Text style={styles.sectionLabel}>Attach for more context (optional)</Text>
          <View style={styles.attachRow}>
            <Button
              mode="outlined"
              icon="image-outline"
              onPress={pickImage}
              style={styles.attachBtn}
              textColor={COLORS.primary}
            >
              Photo
            </Button>
            <Button
              mode="outlined"
              icon="file-pdf-box"
              onPress={pickDocument}
              style={styles.attachBtn}
              textColor={COLORS.primary}
            >
              PDF
            </Button>
          </View>

          {files.map((f, i) => (
            <Surface key={i} style={styles.fileChip} elevation={0}>
              {f.mimeType.startsWith('image') ? (
                <Image source={{ uri: f.uri }} style={styles.fileThumb} />
              ) : (
                <Icon source="file-pdf-box" size={28} color={COLORS.danger} />
              )}
              <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
              <Button mode="text" compact textColor={colors.textMuted} onPress={() => removeFile(i)}>✕</Button>
            </Surface>
          ))}

          <Button
            mode="contained"
            icon="auto-fix"
            onPress={runAI}
            loading={loading}
            disabled={loading}
            buttonColor={COLORS.primary}
            style={styles.planBtn}
            contentStyle={styles.planBtnContent}
          >
            Plan it with AI
          </Button>
        </>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Breaking it down for you...</Text>
        </View>
      )}

      {/* AI Result */}
      {result && !loading && (
        <>
          {/* Feasibility banner */}
          <Surface
            style={[styles.feasBanner, { borderLeftColor: result.feasibility.ok ? COLORS.secondary : '#f59e0b' }]}
            elevation={0}
          >
            <Icon
              source={result.feasibility.ok ? 'check-circle-outline' : 'alert-circle-outline'}
              size={20}
              color={result.feasibility.ok ? COLORS.secondary : '#f59e0b'}
            />
            <Text style={styles.feasText}>{result.feasibility.message}</Text>
          </Surface>

          <Text style={styles.sectionLabel}>Your subtasks — edit before saving</Text>

          {subtasks.map((s, i) => (
            <Surface key={i} style={styles.subtaskCard} elevation={1}>
              <View style={styles.subtaskTop}>
                <View style={[styles.subtaskIndex, { backgroundColor: COLORS.primary + '18' }]}>
                  <Text style={styles.subtaskIndexText}>{i + 1}</Text>
                </View>
                <TextInput
                  value={s.title}
                  onChangeText={v => updateSubtask(i, 'title', v)}
                  mode="flat"
                  style={styles.subtaskTitle}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  dense
                />
              </View>

              {!!s.description && (
                <Text style={styles.subtaskDesc}>{s.description}</Text>
              )}

              <View style={styles.subtaskNextAction}>
                <Icon source="arrow-right-circle-outline" size={15} color={COLORS.primary} />
                <TextInput
                  value={s.nextAction}
                  onChangeText={v => updateSubtask(i, 'nextAction', v)}
                  mode="flat"
                  style={styles.subtaskNextInput}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  placeholder="First step..."
                  dense
                  multiline
                />
              </View>

              <View style={styles.subtaskMeta}>
                <Chip
                  compact
                  icon="timer-outline"
                  mode="flat"
                  style={styles.timeBadge}
                  textStyle={styles.timeBadgeText}
                >
                  {s.estimateMinutes} min
                </Chip>
                <Chip
                  compact
                  mode="flat"
                  style={[styles.energyBadge, { backgroundColor: ENERGY_COLOR[s.energy] + '22' }]}
                  textStyle={[styles.energyBadgeText, { color: ENERGY_COLOR[s.energy] }]}
                >
                  {s.energy} energy
                </Chip>
              </View>
            </Surface>
          ))}

          <View style={styles.actionRow}>
            <Button
              mode="outlined"
              icon="refresh"
              onPress={runAI}
              style={styles.replanBtn}
              textColor={COLORS.primary}
            >
              Re-plan
            </Button>
            <Button
              mode="contained"
              icon="check"
              onPress={saveAll}
              loading={saving}
              disabled={saving}
              buttonColor={COLORS.secondary}
              style={styles.saveBtn}
            >
              Save all tasks
            </Button>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 60 },

    taskHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: COLORS.primary + '12',
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    taskHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.primary },

    input: { backgroundColor: colors.surface, marginBottom: 16 },

    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },

    attachRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    attachBtn: { flex: 1, borderColor: colors.border },

    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    fileThumb: { width: 36, height: 36, borderRadius: 6 },
    fileName: { flex: 1, fontSize: 13, color: colors.textSecondary },

    planBtn: { borderRadius: 12, marginTop: 8 },
    planBtnContent: { paddingVertical: 6 },

    loadingBlock: { alignItems: 'center', paddingTop: 40, gap: 16 },
    loadingText: { fontSize: 15, color: colors.textMuted },

    feasBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 20,
      borderLeftWidth: 4,
    },
    feasText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

    subtaskCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    subtaskTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    subtaskIndex: {
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    subtaskIndexText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
    subtaskTitle: { flex: 1, backgroundColor: 'transparent', fontSize: 15, fontWeight: '600' },

    subtaskDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },

    subtaskNextAction: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      backgroundColor: COLORS.primary + '08',
      borderRadius: 8,
      padding: 8,
      marginBottom: 10,
    },
    subtaskNextInput: { flex: 1, backgroundColor: 'transparent', fontSize: 13 },

    subtaskMeta: { flexDirection: 'row', gap: 8 },
    timeBadge: { backgroundColor: COLORS.primary + '15' },
    timeBadgeText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
    energyBadge: {},
    energyBadgeText: { fontSize: 12, fontWeight: '600' },

    actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    replanBtn: { flex: 1, borderColor: COLORS.primary },
    saveBtn: { flex: 2, borderRadius: 10 },
  });
}
