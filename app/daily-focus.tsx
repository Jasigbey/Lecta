import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
  Flame,
  Target,
  Clock,
  Plus,
  Trash2,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { safeStorage } from '../lib/storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface FocusTask {
  id: string;
  title: string;
  course: string;
  time: string;
  done: boolean;
}

const initialTasks: FocusTask[] = [];

const getTodayStorageKey = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  return `@lecta_daily_focus_tasks_${todayStr}`;
};

const parseMinutesFromTime = (timeStr: string): number => {
  if (!timeStr) return 25;
  const cleaned = timeStr.trim().toLowerCase();
  if (cleaned.includes('hour') || cleaned.includes('hr')) {
    const match = cleaned.match(/(\d+(\.\d+)?)/);
    if (match) {
      return Math.round(parseFloat(match[1]) * 60);
    }
    return 60;
  }
  const match = cleaned.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 25;
};

const TIMER_PRESETS = [15, 25, 30, 45, 60];

export default function DailyFocusScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<FocusTask[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState<number>(25);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);

  // Add Task Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [newTime, setNewTime] = useState('');

  const completedCount = tasks.filter((t) => t.done).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const loadTasks = useCallback(async () => {
    try {
      const key = getTodayStorageKey();
      const stored = await safeStorage.getItem(key);
      if (stored) {
        setTasks(JSON.parse(stored));
      } else {
        setTasks([]);
        await safeStorage.setItem(key, JSON.stringify([]));
      }
    } catch (err) {
      console.error('Error loading daily focus tasks:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const saveTasksToStorage = async (updated: FocusTask[]) => {
    setTasks(updated);
    try {
      const key = getTodayStorageKey();
      await safeStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving daily focus tasks:', err);
    }
  };

  const handleSelectPreset = (mins: number) => {
    setTimerRunning(false);
    setSessionMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  const handleSelectTaskForFocus = (task: FocusTask) => {
    setSelectedTaskId(task.id);
    const parsedMins = parseMinutesFromTime(task.time);
    handleSelectPreset(parsedMins);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerRunning && secondsLeft === 0) {
      setTimerRunning(false);
      let focusedTaskTitle = '';

      if (selectedTaskId) {
        setTasks((prevTasks) => {
          const updated = prevTasks.map((t) => {
            if (t.id === selectedTaskId) {
              focusedTaskTitle = t.title;
              return { ...t, done: true };
            }
            return t;
          });
          const key = getTodayStorageKey();
          safeStorage.setItem(key, JSON.stringify(updated));
          return updated;
        });
      }

      saveFocusSession(sessionMinutes, completedCount + 1);

      if (focusedTaskTitle) {
        Alert.alert(
          '🎉 Session & Task Complete!',
          `Great job! You stayed focused for ${sessionMinutes} mins and completed:\n\n"${focusedTaskTitle}"`
        );
      } else {
        Alert.alert(
          '🎉 Session Complete!',
          `Great job staying focused for ${sessionMinutes} minutes.`
        );
      }

      setSelectedTaskId(null);
    }
    return () => clearInterval(interval);
  }, [timerRunning, secondsLeft, sessionMinutes, selectedTaskId, completedCount]);

  const saveFocusSession = async (duration: number, tasksCompleted: number) => {
    if (!user) return;
    const { error } = await supabase.from('focus_sessions').insert({
      user_id: user.id,
      duration_minutes: duration,
      tasks_completed: tasksCompleted,
    });
    if (error) console.error('Error saving focus session:', error);
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    saveTasksToStorage(updated);
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id);
    saveTasksToStorage(updated);
  };

  const handleAddTask = () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your focus task.');
      return;
    }
    const newTask: FocusTask = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      course: newCourse.trim().toUpperCase() || 'GENERAL',
      time: newTime.trim() || '30 mins',
      done: false,
    };
    const updated = [...tasks, newTask];
    saveTasksToStorage(updated);
    setNewTitle('');
    setNewCourse('');
    setNewTime('');
    setIsModalVisible(false);
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Top Header Card */}
        <View style={styles.heroSection}>
          <Image
            source={require('../assets/dashboard_hero.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />

          <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 24, justifyContent: 'space-between', flex: 1 }}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <ChevronLeft size={22} color="#ffffff" />
              </TouchableOpacity>

              <View style={styles.tagPill}>
                <Sparkles size={14} color="#2563eb" />
                <Text style={styles.tagPillText}>DAILY FOCUS</Text>
              </View>
            </View>

            <View style={styles.heroTextContent}>
              <Text style={styles.heroQuote}>
                "Protecting your study time is the most productive thing you'll do all week."
              </Text>

              <View style={styles.streakRow}>
                <View style={styles.streakBadge}>
                  <Flame size={16} color="#f97316" />
                  <Text style={styles.streakText}>5 Day Study Streak!</Text>
                </View>

                <View style={styles.progressBadge}>
                  <Target size={16} color="#34d399" />
                  <Text style={styles.progressText}>{progressPercent}% Goal Met</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Content Body */}
        <View style={[styles.bodyContent, { backgroundColor: colors.background }]}>
          {/* Pomodoro Focus Timer Card */}
          <View style={[styles.timerCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.timerHeader}>
              <View style={styles.timerTitleRow}>
                <Clock size={18} color="#2563eb" />
                <Text style={[styles.timerTitle, { color: colors.text }]}>Focus Timer</Text>
              </View>
              <Text style={[styles.timerSubtitle, { color: colors.textSecondary }]}>
                Pomodoro • {sessionMinutes} Min Session
              </Text>
              {selectedTaskId && (
                <View style={styles.activeTaskTag}>
                  <Text style={styles.activeTaskTagText} numberOfLines={1}>
                    Focusing: {tasks.find(t => t.id === selectedTaskId)?.title || 'Selected Task'}
                  </Text>
                </View>
              )}
            </View>

            {/* Presets Row */}
            <View style={styles.presetsRow}>
              {TIMER_PRESETS.map((mins) => {
                const isActive = sessionMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[
                      styles.presetPill,
                      { backgroundColor: isActive ? '#2563eb' : colors.inputBg },
                    ]}
                    onPress={() => handleSelectPreset(mins)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetPillText, { color: isActive ? '#ffffff' : colors.textSecondary }]}>
                      {mins}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.timerDisplay}>{formatTimer(secondsLeft)}</Text>

            <View style={styles.timerControls}>
              <TouchableOpacity
                style={[
                  styles.playBtn,
                  timerRunning && styles.pauseBtn,
                ]}
                onPress={() => setTimerRunning(!timerRunning)}
                activeOpacity={0.85}
              >
                {timerRunning ? (
                  <>
                    <Pause size={20} color="#ffffff" />
                    <Text style={styles.playBtnText}>Pause</Text>
                  </>
                ) : (
                  <>
                    <Play size={20} color="#ffffff" />
                    <Text style={styles.playBtnText}>Start Focus</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => {
                  setTimerRunning(false);
                  setSecondsLeft(sessionMinutes * 60);
                }}
              >
                <RotateCcw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Today's Tasks Checklist */}
          <View style={styles.tasksSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Focus Tasks</Text>
                <Text style={styles.taskCountText}>
                  {completedCount}/{tasks.length} Completed
                </Text>
              </View>

              <TouchableOpacity
                style={styles.addTaskHeaderBtn}
                onPress={() => setIsModalVisible(true)}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.addTaskHeaderBtnText}>Add Task</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.taskList}>
              {tasks.length === 0 ? (
                <View style={[styles.emptyTaskCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.emptyTaskText, { color: colors.textMuted }]}>
                    No tasks for today. Tap "+ Add Task" to set your goals!
                  </Text>
                </View>
              ) : (
                tasks.map((item) => {
                  const isFocused = selectedTaskId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.taskCard,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder },
                        isFocused && { borderColor: '#2563eb', borderWidth: 2 },
                        item.done && styles.taskCardDone,
                      ]}
                      onPress={() => handleSelectTaskForFocus(item)}
                      activeOpacity={0.8}
                    >
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          toggleTask(item.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <CheckCircle2
                          size={22}
                          color={item.done ? '#10b981' : colors.textMuted}
                          style={{ marginRight: 12 }}
                        />
                      </TouchableOpacity>

                      <View style={styles.taskInfo}>
                        <Text
                          style={[
                            styles.taskTitleText,
                            { color: colors.text },
                            item.done && [styles.taskTitleDone, { color: colors.textMuted }],
                          ]}
                        >
                          {item.title}
                        </Text>
                        <View style={styles.taskMetaRow}>
                          <Text style={styles.courseTag}>{item.course}</Text>
                          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
                          <Text style={[styles.taskTimeText, { color: colors.textSecondary }]}>{item.time}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleDeleteTask(item.id);
                        }}
                        style={styles.deleteTaskBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Add Task Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Custom Focus Task</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Task Title *</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
              placeholder="e.g. Read Embedded System Microcontrollers Ch. 2"
              placeholderTextColor={colors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Course Tag (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
              placeholder="e.g. EMBEDSYS, DS2, FINACCT"
              placeholderTextColor={colors.textMuted}
              value={newCourse}
              onChangeText={setNewCourse}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Estimated Duration (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
              placeholder="e.g. 30 mins, 1 hour"
              placeholderTextColor={colors.textMuted}
              value={newTime}
              onChangeText={setNewTime}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveTaskBtn}
                onPress={handleAddTask}
                activeOpacity={0.85}
              >
                <Text style={styles.saveTaskBtnText}>Save Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },

  /* Hero Section */
  heroSection: {
    minHeight: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  heroTextContent: {
    marginTop: 20,
  },
  heroQuote: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 28,
    marginBottom: 16,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 10,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fb923c',
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },

  /* Body Content */
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },

  /* Timer Card */
  timerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  timerHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  timerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  timerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activeTaskTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    maxWidth: 240,
  },
  activeTaskTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 2,
    marginVertical: 8,
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  pauseBtn: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  playBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Tasks Section */
  tasksSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  taskCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  taskList: {
    gap: 10,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  taskCardDone: {
    backgroundColor: '#f8fafc',
    opacity: 0.65,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#64748b',
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courseTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
  },
  dotSeparator: {
    color: '#94a3b8',
  },
  taskTimeText: {
    fontSize: 11,
    color: '#64748b',
  },

  /* Add Task & Modal Styles */
  addTaskHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addTaskHeaderBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteTaskBtn: {
    padding: 6,
    marginLeft: 8,
  },
  emptyTaskCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTaskText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#0f172a',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveTaskBtn: {
    flex: 1.5,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTaskBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
