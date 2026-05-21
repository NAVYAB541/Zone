import React, { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  Chip,
  Button,
  Surface,
  ProgressBar,
  IconButton,
  Menu,
  ActivityIndicator,
  Icon,
} from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, Task } from '../types';
import { COLORS } from '../constants/Theme';
import dayjs from 'dayjs';
import { cancelTaskReminder } from '../utils/notifications';
import { useTheme, AppColors } from '../context/ThemeContext';

const API_URL = 'https://taskmanager-pn0w.onrender.com/tasks';

const TAG_PALETTE = ['#FF6B6B', '#4ECDC4', '#556270', '#C7F464', '#FFA500'];
function tagColor(tag: string) {
  const hash = tag.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

function priorityColor(p?: string) {
  if (p === 'high') return COLORS.danger;
  if (p === 'medium') return COLORS.primary;
  return COLORS.secondary;
}

function ZoneLogo({ colors, theme }: { colors: AppColors; theme: string }) {
  // Light mode: dark badge exactly like the app icon
  // Dark mode: subtle indigo-tinted surface so it reads as contained without clashing
  const badgeBg    = theme === 'dark' ? 'rgba(99,102,241,0.15)' : '#1e1b4b';
  const ringColor  = theme === 'dark' ? colors.primary : '#a5b4fc';
  const dotColor   = theme === 'dark' ? colors.primary : '#c4b5fd';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: badgeBg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Svg width={20} height={20} viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r="50" fill="none" stroke={ringColor} strokeOpacity={0.3} strokeWidth={10} />
          <Circle cx="60" cy="60" r="36" fill="none" stroke={ringColor} strokeOpacity={0.6} strokeWidth={10} />
          <Circle cx="60" cy="60" r="22" fill="none" stroke={ringColor} strokeWidth={10} />
          <Circle cx="60" cy="60" r="7"  fill={dotColor} />
        </Svg>
      </View>
      <Text style={{ fontSize: 19, fontWeight: '800', color: colors.primary, letterSpacing: -0.4 }}>
        Zone
      </Text>
    </View>
  );
}


function ProductivityBadge({ score, colors }: { score: number; colors: AppColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ringColor = score >= 80 ? '#4CAF50' : score >= 50 ? colors.primary : '#FF9800';
  const iconName = score >= 80 ? 'rocket-launch' : score >= 50 ? 'lightning-bolt' : 'sprout';
  return (
    <Surface style={styles.scoreCard} elevation={1}>
      <Icon source={iconName} size={34} color={ringColor} />
      <View style={{ flex: 1 }}>
        <Text style={styles.scoreLabel}>Productivity Score</Text>
        <Text style={[styles.scoreValue, { color: ringColor }]}>{score}/100</Text>
        <ProgressBar
          progress={score / 100}
          color={ringColor}
          style={styles.progressBar}
        />
      </View>
    </Surface>
  );
}

const CATEGORIES = ['all', 'General', 'Work', 'Personal', 'Study'];

const SORT_OPTIONS: { label: string; value: 'priority' | 'dueDate' | 'title'; icon: string }[] = [
  { label: 'Due Date',    value: 'dueDate',   icon: 'calendar' },
  { label: 'Priority',   value: 'priority',  icon: 'fire' },
  { label: 'Title (A–Z)', value: 'title',    icon: 'sort-alphabetical-ascending' },
];

export default function TaskListScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'TaskList'>) {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTopLevel, setAllTopLevel] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'title'>('dueDate');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [subtasksByParent, setSubtasksByParent] = useState<Record<string, Task[]>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <ZoneLogo colors={colors} theme={theme} />,
      headerTitleAlign: 'center',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('About')}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="About Zone"
          accessibilityRole="button"
          accessibilityHint="Opens app info and features"
          style={{ marginLeft: 14 }}
        >
          <Icon source="information-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          style={{ marginRight: 14 }}
        >
          <Icon source="cog-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      ),
    });
  }, [theme, colors]);

  const toggleExpanded = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const computeProductivityScore = (list: Task[], subMap: Record<string, Task[]>) => {
    if (!list.length) return 0;
    let totalWeight = 0;
    let doneWeight = 0;
    for (const t of list) {
      const weight = t.priority === 'high' ? 3 : t.priority === 'medium' ? 2 : 1;
      const subs = subMap[t.id] ?? [];
      if (subs.length > 0) {
        const ratio = subs.filter(s => s.completed).length / subs.length;
        doneWeight += weight * ratio;
      } else {
        if (t.completed) doneWeight += weight;
      }
      totalWeight += weight;
    }
    return totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0;
  };

  const productivityScore = computeProductivityScore(allTopLevel, subtasksByParent);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      const all: Task[] = await res.json();

      // Collect tags from top-level tasks only
      const tagsSet = new Set<string>();
      all.filter(t => !t.parentTaskId).forEach(t => t.tags?.forEach(tag => tagsSet.add(tag)));
      setAllTags(Array.from(tagsSet).sort());

      // Separate subtasks from top-level tasks
      const subtaskMap: Record<string, Task[]> = {};
      all.forEach(t => {
        if (t.parentTaskId) {
          if (!subtaskMap[t.parentTaskId]) subtaskMap[t.parentTaskId] = [];
          subtaskMap[t.parentTaskId].push(t);
        }
      });
      // Sort subtasks by creation order
      Object.values(subtaskMap).forEach(subs =>
        subs.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
      );

      // Only top-level tasks go through filters
      const topLevel = all.filter(t => !t.parentTaskId);
      setAllTopLevel(topLevel);
      let data = topLevel.slice();
      if (filter === 'completed') data = data.filter(t => t.completed);
      if (filter === 'pending')   data = data.filter(t => !t.completed);
      if (categoryFilter !== 'all') data = data.filter(t => t.category === categoryFilter);
      if (tagFilter !== 'all')      data = data.filter(t => t.tags?.includes(tagFilter));
      data.sort((a, b) => {
        if (sortBy === 'priority') {
          const o = { high: 1, medium: 2, low: 3 };
          return (o[a.priority || 'medium'] || 2) - (o[b.priority || 'medium'] || 2);
        }
        if (sortBy === 'dueDate') return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
        return a.title.localeCompare(b.title);
      });

      setTasks(data);
      setSubtasksByParent(subtaskMap);
    } catch {
      Alert.alert('Error', 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadTasks(); }, [filter, sortBy, categoryFilter, tagFilter]));

  const toggleTask = async (task: Task) => {
    try {
      await fetch(`${API_URL}/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, completed: !task.completed }),
      });
      loadTasks();
    } catch { Alert.alert('Error', 'Could not update task'); }
  };

  const deleteTask = (task: Task) => {
    Alert.alert('Delete task', `Remove "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await cancelTaskReminder(task.id);
            await fetch(`${API_URL}/${task.id}`, { method: 'DELETE' });
            loadTasks();
          } catch { Alert.alert('Error', 'Could not delete task'); }
        },
      },
    ]);
  };

  const renderTask = ({ item }: { item: Task }) => {
    const subtasks = subtasksByParent[item.id] ?? [];
    const isOverdue = item.dueDate && !item.completed && dayjs(item.dueDate).isBefore(dayjs());
    const pColor = priorityColor(item.priority);
    const nextIncomplete = subtasks.find(s => !s.completed);
    const doneCount = subtasks.filter(s => s.completed).length;
    const hasSubtasks = subtasks.length > 0;
    const isExpanded = expandedTasks.has(item.id);

    return (
      <View key={item.id}>
        {/* ── Parent / standalone task card ── */}
        <Surface
          style={[styles.task, { borderLeftColor: pColor }, isOverdue && styles.overdueTask]}
          elevation={1}
        >
          <TouchableOpacity
            style={styles.taskInner}
            onPress={() => navigation.navigate('TaskDetails', { task: item })}
            activeOpacity={0.7}
          >
            <IconButton
              icon={item.completed ? 'check-circle' : 'circle-outline'}
              iconColor={item.completed ? '#4CAF50' : pColor}
              size={24}
              onPress={() => toggleTask(item)}
              style={styles.checkBtn}
            />

            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, item.completed && styles.completedTitle]} numberOfLines={2}>
                {item.title}
              </Text>

              <View style={styles.metaRow}>
                <Chip compact mode="flat"
                  style={[styles.priorityChip, { backgroundColor: pColor + '22' }]}
                  textStyle={[styles.priorityChipText, { color: pColor }]}>
                  {item.priority?.toUpperCase()}
                </Chip>
                {item.category && (
                  <Chip compact mode="flat" style={styles.categoryChip} textStyle={styles.categoryChipText}>
                    {item.category}
                  </Chip>
                )}
                {isOverdue && (
                  <Chip compact mode="flat" icon="alert" style={styles.overdueChip} textStyle={styles.overdueChipText}>
                    Overdue
                  </Chip>
                )}
                {hasSubtasks && (
                  <Chip compact mode="flat" style={styles.subtaskCountChip} textStyle={styles.subtaskCountText}>
                    {doneCount}/{subtasks.length} done
                  </Chip>
                )}
              </View>

              {(item.tags || []).length > 0 && (
                <View style={styles.tagRow}>
                  {(item.tags || []).map(tag => (
                    <Chip key={tag} compact mode="flat"
                      style={[styles.tagChip, { backgroundColor: tagColor(tag) }]}
                      textStyle={styles.tagChipText}>{tag}</Chip>
                  ))}
                </View>
              )}

              {/* Next step: derived from first incomplete subtask */}
              {!item.completed && nextIncomplete && (
                <View style={styles.nextActionRow}>
                  <Icon source="arrow-right-circle-outline" size={13} color={colors.primary} />
                  <Text style={styles.nextActionText} numberOfLines={1}>{nextIncomplete.title}</Text>
                </View>
              )}

              {item.dueDate && (
                <View style={styles.dueDateRow}>
                  <Icon source="calendar" size={13} color={isOverdue ? colors.danger : colors.textMuted} />
                  <Text style={[styles.dueDate, isOverdue && { color: colors.danger }]}>
                    {dayjs(item.dueDate).format('DD MMM YYYY')}
                  </Text>
                </View>
              )}
            </View>

            <IconButton icon="delete-outline" iconColor={colors.textDisabled} size={20}
              onPress={() => deleteTask(item)} style={styles.deleteBtn} />
          </TouchableOpacity>

          {/* ── Accordion toggle row ── */}
          {hasSubtasks && (
            <TouchableOpacity style={styles.accordionRow} onPress={() => toggleExpanded(item.id)} activeOpacity={0.6}>
              <View style={styles.accordionProgress}>
                <View style={[styles.accordionProgressFill, { width: `${Math.round((doneCount / subtasks.length) * 100)}%` as any }]} />
              </View>
              <Text style={styles.accordionLabel}>
                {doneCount}/{subtasks.length} subtasks
              </Text>
              <Icon
                source={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </Surface>

        {/* ── Collapsible subtask list ── */}
        {hasSubtasks && isExpanded && (
          <View style={styles.subtaskGroup}>
            {subtasks.map(sub => (
              <Surface key={sub.id} style={[styles.subtaskItem, sub.completed && styles.subtaskItemDone]} elevation={0}>
                <IconButton
                  icon={sub.completed ? 'check-circle' : 'circle-outline'}
                  iconColor={sub.completed ? colors.secondary : colors.textDisabled}
                  size={20}
                  onPress={() => toggleTask(sub)}
                  style={{ margin: 0 }}
                />
                <TouchableOpacity
                  style={styles.subtaskContent}
                  onPress={() => navigation.navigate('TaskDetails', { task: sub })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.subtaskItemTitle, sub.completed && styles.subtaskItemDoneText]} numberOfLines={1}>
                      {sub.title}
                    </Text>
                    {!!sub.description && (
                      <Text style={styles.subtaskItemDesc} numberOfLines={1}>{sub.description}</Text>
                    )}
                    <Text style={styles.subtaskItemEst}>{sub.estimateMinutes ?? 30} min</Text>
                  </View>
                  <Icon source="chevron-right" size={16} color={colors.border} />
                </TouchableOpacity>
              </Surface>
            ))}
          </View>
        )}
      </View>
    );
  };

  const currentSort = SORT_OPTIONS.find(o => o.value === sortBy)!;

  return (
    <View style={styles.container}>
      <ProductivityBadge score={productivityScore} colors={colors} />

      {/* ── Filters ── */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {(['all', 'pending', 'completed'] as const).map(f => (
              <Chip
                key={f}
                selected={filter === f}
                onPress={() => setFilter(f)}
                style={styles.filterChip}
                selectedColor={colors.primary}
                compact
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Chip>
            ))}
          </ScrollView>

          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                icon={currentSort.icon}
                onPress={() => setSortMenuVisible(true)}
                compact
                textColor={colors.primary}
                style={styles.sortBtn}
              >
                {currentSort.label}
              </Button>
            }
          >
            {SORT_OPTIONS.map(opt => (
              <Menu.Item
                key={opt.value}
                leadingIcon={opt.icon}
                title={opt.label}
                trailingIcon={sortBy === opt.value ? 'check' : undefined}
                onPress={() => { setSortBy(opt.value); setSortMenuVisible(false); }}
              />
            ))}
          </Menu>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {CATEGORIES.map(cat => (
            <Chip
              key={cat}
              selected={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
              style={styles.filterChip}
              selectedColor="#6C63FF"
              compact
            >
              {cat === 'all' ? 'All Categories' : cat}
            </Chip>
          ))}
        </ScrollView>

        {allTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Chip
              selected={tagFilter === 'all'}
              onPress={() => setTagFilter('all')}
              style={styles.filterChip}
              selectedColor="#FF6B6B"
              compact
            >
              All Tags
            </Chip>
            {allTags.map(tag => (
              <Chip
                key={tag}
                selected={tagFilter === tag}
                onPress={() => setTagFilter(tag)}
                style={styles.filterChip}
                selectedColor={tagColor(tag)}
                compact
              >
                {tag}
              </Chip>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Launch Me ── */}
      <Button
        mode="contained"
        icon="lightning-bolt"
        onPress={() => navigation.navigate('LaunchMe')}
        style={styles.launchButton}
        contentStyle={styles.launchButtonContent}
        buttonColor="#7c3aed"
      >
        Launch Me
      </Button>

      {/* ── Add Task ── */}
      <Button
        mode="contained"
        icon="plus"
        onPress={() => navigation.navigate('AddTask')}
        style={styles.addButton}
        contentStyle={styles.addButtonContent}
        buttonColor={colors.primary}
      >
        Add Task
      </Button>

      {/* ── Task list ── */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
      ) : tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon source="check-circle-outline" size={64} color={colors.textDisabled} />
          <Text style={styles.emptyText}>No tasks here</Text>
          <Text style={styles.emptySubtext}>Try changing your filters or add a new task.</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={renderTask}
          contentContainerStyle={{ paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: colors.background },

    // Productivity card
    scoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.surface,
      padding: 14,
      borderRadius: 14,
      marginBottom: 12,
    },
    scoreLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500', marginBottom: 2 },
    scoreValue: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    progressBar: { borderRadius: 4, height: 6 },

    // Filters
    filterSection: { gap: 6, marginBottom: 12 },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chipScroll: { paddingVertical: 2, paddingRight: 8, gap: 6, flexDirection: 'row' },
    filterChip: { backgroundColor: colors.surfaceVariant },
    sortBtn: { borderColor: colors.primary, flexShrink: 0 },

    // Launch Me
    launchButton: { borderRadius: 12, marginBottom: 10 },
    launchButtonContent: { paddingVertical: 4 },

    // Add button
    addButton: { borderRadius: 12, marginBottom: 14 },
    addButtonContent: { paddingVertical: 4 },

    // Task card
    task: {
      marginBottom: 10,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderLeftWidth: 4,
      overflow: 'hidden',
    },
    taskInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 10,
      gap: 4,
    },
    overdueTask: { backgroundColor: colors.overdueBackground },
    checkBtn: { margin: 0 },
    deleteBtn: { margin: 0 },
    taskTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6, marginTop: 4 },
    completedTitle: { textDecorationLine: 'line-through', color: colors.textMuted },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
    priorityChip: {},
    priorityChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    categoryChip: { backgroundColor: colors.categoryChipBg },
    categoryChipText: { fontSize: 11, color: colors.categoryChipText, fontWeight: '600' },
    overdueChip: { backgroundColor: '#ffebee' },
    overdueChipText: { fontSize: 11, color: '#e53935', fontWeight: '700' },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
    tagChip: {},
    tagChipText: { color: 'white', fontSize: 11, fontWeight: '600' },

    subtaskCountChip: { backgroundColor: colors.surfaceVariant },
    subtaskCountText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

    accordionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 14, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: colors.borderLight,
    },
    accordionProgress: {
      flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, overflow: 'hidden',
    },
    accordionProgressFill: { height: '100%', backgroundColor: colors.secondary, borderRadius: 2 },
    accordionLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

    subtaskGroup: { marginLeft: 16, marginTop: 2, marginBottom: 8 },
    subtaskItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 10, marginBottom: 4,
      borderWidth: 1, borderColor: colors.borderLight, paddingRight: 10,
    },
    subtaskItemDone: { opacity: 0.5 },
    subtaskContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    subtaskItemTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
    subtaskItemDoneText: { textDecorationLine: 'line-through', color: colors.textDisabled },
    subtaskItemDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    subtaskItemEst: { fontSize: 11, color: colors.primary, marginTop: 1 },

    nextActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    nextActionText: { fontSize: 12, color: colors.primary, flex: 1, fontStyle: 'italic' },

    dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    dueDate: { fontSize: 12, color: colors.textMuted },

    // Empty state
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, gap: 8 },
    emptyText: { fontSize: 18, fontWeight: '700', color: colors.text },
    emptySubtext: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  });
}
