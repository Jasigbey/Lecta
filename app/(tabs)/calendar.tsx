import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Tag,
  Plus,
  X,
  Trash2,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { safeStorage } from '../../lib/storage';
import { useFocusEffect } from 'expo-router';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarEvent {
  id: string;
  course_id: string;
  title: string;
  event_type: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string;
  courses?: { code: string; title: string; accent_color: string };
}

const eventTypeOptions = ['Exam', 'Quiz', 'Assignment', 'Project Deadline', 'Other'];
const priorityOptions: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];

export default function CalendarScreen() {
  const { role, user } = useAuth();
  const { colors, isDarkMode } = useTheme();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Persistent Completed Items using safeStorage
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});

  // Add Event Modal State (for Course Reps)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEventType, setNewEventType] = useState('Exam');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [newTime, setNewTime] = useState('10:00 AM');
  const [newDateStr, setNewDateStr] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setNewDateStr(`${year}-${month}-${day}`);
    }
  }, [selectedDate]);

  const loadCompletedItems = useCallback(async () => {
    if (!user) return;
    try {
      const key = `@lecta_calendar_completed_events_${user.id}`;
      const stored = await safeStorage.getItem(key);
      if (stored) {
        setCompletedItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading completed calendar items:', e);
    }
  }, [user]);

  const toggleComplete = async (id: string) => {
    const updated = { ...completedItems, [id]: !completedItems[id] };
    setCompletedItems(updated);
    if (user) {
      try {
        const key = `@lecta_calendar_completed_events_${user.id}`;
        await safeStorage.setItem(key, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving completed calendar item:', e);
      }
    }
  };

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*, courses(code, title, accent_color)')
      .gte('due_date', startOfMonth.toISOString())
      .lte('due_date', endOfMonth.toISOString())
      .order('due_date', { ascending: true });

    if (!error && data) {
      setEvents(data as CalendarEvent[]);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      loadCompletedItems();
    }, [currentDate.getMonth(), currentDate.getFullYear(), user, loadCompletedItems])
  );

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const generateCalendarMatrix = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const matrix: (number | null)[][] = [];
    let currentWeek: (number | null)[] = Array(7).fill(null);
    let dayCounter = 1;

    for (let i = firstDay; i < 7; i++) {
      currentWeek[i] = dayCounter++;
    }
    matrix.push(currentWeek);

    while (dayCounter <= daysInMonth) {
      currentWeek = Array(7).fill(null);
      for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
        currentWeek[i] = dayCounter++;
      }
      matrix.push(currentWeek);
    }
    return matrix;
  };

  const handleAddEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter an event title.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create calendar events.');
      return;
    }

    setSavingEvent(true);

    let eventDate = new Date(selectedDate);
    if (newDateStr.trim()) {
      const parts = newDateStr.trim().split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          eventDate = new Date(y, m, d);
        }
      } else {
        const parsed = new Date(newDateStr.trim());
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed;
        }
      }
    }

    const timeCleaned = newTime.trim().toUpperCase();
    const isPM = timeCleaned.includes('PM');
    const isAM = timeCleaned.includes('AM');
    const rawTime = timeCleaned.replace(/AM|PM/g, '').trim();
    const timeParts = rawTime.split(':');
    let hours = parseInt(timeParts[0], 10) || 10;
    const minutes = parseInt(timeParts[1], 10) || 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
    eventDate.setHours(hours, minutes, 0, 0);

    const { error } = await supabase.from('calendar_events').insert({
      title: newTitle.trim(),
      event_type: newEventType,
      priority: newPriority,
      due_date: eventDate.toISOString(),
      created_by: user.id,
    });

    setSavingEvent(false);

    if (error) {
      console.error('Error inserting calendar event:', error);
      Alert.alert('Error Creating Event', error.message);
      return;
    }

    Alert.alert('Event Added! ', `"${newTitle.trim()}" has been scheduled.`);
    setIsAddModalOpen(false);
    setNewTitle('');
    fetchEvents();
  };

  const handleDeleteEvent = async (id: string) => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this calendar event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('calendar_events').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            fetchEvents();
          }
        },
      },
    ]);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDayPress = (dayNum: number) => {
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum));
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[currentDate.getMonth()];
  const year = currentDate.getFullYear();
  const matrix = generateCalendarMatrix();

  // Filter events for the currently selected day
  const selectedDayEvents = events.filter((e) => {
    const eventDate = new Date(e.due_date);
    return isSameDay(eventDate, selectedDate);
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>ACADEMIC CALENDAR</Text>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{monthName} {year}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.todayBtn, { borderColor: colors.badgeBorder, backgroundColor: '#eff6ff' }]}
                onPress={handleToday}
              >
                <Text style={[styles.todayBtnText, { color: '#1e40af' }]}>Today</Text>
              </TouchableOpacity>
              <View style={styles.navRow}>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={handlePrevMonth}>
                  <ChevronLeft size={18} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={handleNextMonth}>
                  <ChevronRight size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Month Calendar Card */}
          <View style={[styles.calendarCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {loading ? (
               <View style={{ padding: 40, alignItems: 'center' }}>
                 <ActivityIndicator size="large" color={colors.primary} />
               </View>
            ) : (
              <>
                {/* Days Header */}
                <View style={styles.weekDaysHeader}>
                  {weekDays.map((day, i) => (
                    <Text key={i} style={[styles.weekDayText, { color: colors.textMuted }]}>{day}</Text>
                  ))}
                </View>

                {/* Dates Grid */}
                <View style={styles.gridContainer}>
                  {matrix.map((week, wIndex) => (
                    <View key={wIndex} style={styles.weekRow}>
                      {week.map((dayNum, dIndex) => {
                        if (!dayNum) return <View key={dIndex} style={styles.emptyDayCell} />;
                        
                        const thisDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
                        const isSelected = isSameDay(thisDate, selectedDate);
                        const isToday = isSameDay(thisDate, new Date());
                        
                        // Check if day has events
                        const hasEvent = events.some(e => isSameDay(new Date(e.due_date), thisDate));

                        return (
                          <TouchableOpacity
                            key={dIndex}
                            onPress={() => handleDayPress(dayNum)}
                            style={[
                              styles.dayCell,
                              isSelected && [styles.dayCellSelected, { backgroundColor: colors.primary }],
                              isToday && !isSelected && { borderColor: colors.primary, borderWidth: 1 }
                            ]}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.dayCellText,
                                { color: colors.text },
                                isSelected && [styles.dayCellTextSelected, { color: '#ffffff' }],
                                isToday && !isSelected && { color: colors.primary, fontWeight: '800' }
                              ]}
                            >
                              {dayNum}
                            </Text>
                            {hasEvent && (
                              <View style={[styles.eventDot, { backgroundColor: colors.primary }, isSelected && { backgroundColor: '#ffffff' }]} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Selected Date Section Header */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <CalendarIcon size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {`${monthNames[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`}
              </Text>
            </View>
            <Text style={[styles.countBadge, { backgroundColor: colors.card, color: colors.textSecondary }]}>
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Event' : 'Events'}
            </Text>
          </View>

          {/* Events List for Selected Day */}
          {selectedDayEvents.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <CheckCircle2 size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No events for this date</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Enjoy your free time or schedule a study session!
              </Text>
            </View>
          ) : (
            <View style={styles.eventsContainer}>
              {selectedDayEvents.map((item) => {
                const isCompleted = completedItems[item.id];
                const eventDate = new Date(item.due_date);
                const isPassed = eventDate.getTime() < new Date().getTime();

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.eventCard,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      isCompleted && styles.eventCardCompleted,
                      isPassed && !isCompleted && { opacity: 0.8 },
                      isDarkMode && isCompleted && { borderColor: '#16a34a30', backgroundColor: '#16a34a10' }
                    ]}
                  >
                    <View style={styles.eventLeft}>
                      <TouchableOpacity
                        onPress={() => !isPassed && toggleComplete(item.id)}
                        disabled={isPassed && !isCompleted}
                        style={[styles.checkboxContainer, isPassed && !isCompleted && { opacity: 0.35 }]}
                        activeOpacity={isPassed && !isCompleted ? 1 : 0.7}
                      >
                        <View style={[
                          styles.checkbox,
                          { borderColor: isDarkMode ? '#475569' : '#cbd5e1' },
                          isCompleted && styles.checkboxChecked,
                          isPassed && !isCompleted && { backgroundColor: isDarkMode ? '#334155' : '#e2e8f0', borderColor: isDarkMode ? '#475569' : '#cbd5e1' }
                        ]}>
                          {isCompleted && <CheckCircle2 size={20} color="#ffffff" />}
                        </View>
                      </TouchableOpacity>
                      
                      <View style={[styles.eventDetails, isCompleted && styles.eventDetailsCompleted]}>
                        <View style={styles.eventHeaderRow}>
                          <Text style={[
                            styles.eventCourse, 
                            { color: item.courses?.accent_color || '#2563eb' }
                          ]}>
                            {item.courses?.code || 'DSA'}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <View style={styles.eventTypeTag}>
                              <Text style={styles.eventTypeTagText}>{item.event_type}</Text>
                            </View>

                            {isPassed && !isCompleted && (
                              <View style={[
                                styles.eventTypeTag,
                                {
                                  backgroundColor: isDarkMode ? '#451a1a' : '#fef2f2',
                                  borderColor: isDarkMode ? '#7f1d1d' : '#fecdd3',
                                  borderWidth: 1,
                                }
                              ]}>
                                <Text style={[styles.eventTypeTagText, { color: '#ef4444' }]}>EXPIRED</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={[
                          styles.eventTitle, 
                          { color: colors.text },
                          (isCompleted || isPassed) && { color: colors.textMuted, textDecorationLine: 'line-through' }
                        ]}>
                          {item.title}
                        </Text>
                        
                        <View style={styles.eventFooterRow}>
                          <View style={styles.timeWrap}>
                            <Clock size={12} color={isPassed && !isCompleted ? '#ef4444' : colors.textMuted} />
                            <Text style={[
                              styles.timeText,
                              { color: colors.textSecondary },
                              isPassed && !isCompleted && { color: '#ef4444' }
                            ]}>
                              {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>

                          <View style={styles.priorityWrap}>
                            <AlertCircle
                              size={12}
                              color={
                                item.priority === 'high' ? '#ef4444' :
                                item.priority === 'medium' ? '#f59e0b' : '#3b82f6'
                              }
                            />
                            <Text style={[
                              styles.priorityText,
                              item.priority === 'high' ? { color: '#ef4444' } :
                              item.priority === 'medium' ? { color: '#f59e0b' } : { color: '#3b82f6' }
                            ]}>
                              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} Priority
                            </Text>
                          </View>
                        </View>
                      </View>

                      {role === 'rep' && (
                        <TouchableOpacity
                          onPress={() => handleDeleteEvent(item.id)}
                          style={{ padding: 4, marginLeft: 6 }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Floating Add Event Button for Course Reps */}
      {role === 'rep' && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => setIsAddModalOpen(true)}
        >
          <Plus size={26} color="#0f172a" strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* Add Calendar Event Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule Calendar Event</Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Event Title *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
                placeholder="e.g. Embedded System Mid-Semester Exam"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
                placeholder="YYYY-MM-DD (e.g. 2026-08-25)"
                placeholderTextColor={colors.textMuted}
                value={newDateStr}
                onChangeText={setNewDateStr}
              />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Event Type</Text>
              <View style={styles.pillsRow}>
                {eventTypeOptions.map((type) => {
                  const active = newEventType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.optionPill,
                        { backgroundColor: active ? colors.primary : colors.inputBg },
                      ]}
                      onPress={() => setNewEventType(type)}
                    >
                      <Text style={[styles.optionPillText, { color: active ? '#ffffff' : colors.textSecondary }]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Priority Level</Text>
              <View style={styles.pillsRow}>
                {priorityOptions.map((pri) => {
                  const active = newPriority === pri;
                  return (
                    <TouchableOpacity
                      key={pri}
                      style={[
                        styles.optionPill,
                        {
                          backgroundColor: active
                            ? (pri === 'high' ? '#ef4444' : pri === 'medium' ? '#f59e0b' : '#3b82f6')
                            : colors.inputBg,
                        },
                      ]}
                      onPress={() => setNewPriority(pri)}
                    >
                      <Text style={[styles.optionPillText, { color: active ? '#ffffff' : colors.textSecondary }]}>
                        {pri.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Time (e.g. 10:00 AM)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.cardBorder }]}
                placeholder="10:00 AM"
                placeholderTextColor={colors.textMuted}
                value={newTime}
                onChangeText={setNewTime}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.inputBg }]}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }, savingEvent && { opacity: 0.6 }]}
                onPress={handleAddEvent}
                disabled={savingEvent}
                activeOpacity={0.85}
              >
                {savingEvent ? (
                  <ActivityIndicator size="small" color={'#ffffff'} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: '#ffffff' }]}>Save Event</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridContainer: {
    gap: 12,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emptyDayCell: {
    width: 36,
    height: 36,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: '#2563eb',
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dayCellTextSelected: {
    color: '#ffffff',
    fontWeight: '800',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
    position: 'absolute',
    bottom: 4,
  },
  eventDotSelected: {
    backgroundColor: '#93c5fd',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },

  eventsContainer: {
    gap: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  eventCardCompleted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  eventLeft: {
    flexDirection: 'row',
    gap: 14,
  },
  checkboxContainer: {
    paddingTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
    borderWidth: 0,
  },
  eventDetails: {
    flex: 1,
  },
  eventDetailsCompleted: {
    opacity: 0.6,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventCourse: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  eventTypeTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eventTypeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 20,
  },
  eventFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600',
  },

  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* FAB for Course Reps */
  fab: {
    position: 'absolute',
    bottom: 150,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginTop: 12,
  },
  modalInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  saveBtn: {
    flex: 1.5,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});

