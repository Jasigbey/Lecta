import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, MoreVertical, MapPin, Clock, Calendar } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

interface ClassItem {
  id: string;
  title: string;
  time: string;
  location: string;
  color: string;
  type: string;
}

interface DayGroup {
  day: string;
  date: string;
  monthName: string;
  isToday: boolean;
  classes: ClassItem[];
}

const getDynamicWeekInfo = () => {
  const now = new Date();
  const currentDayNum = now.getDay(); // 0 is Sun, 1 is Mon... 6 is Sat
  const distanceToMon = currentDayNum === 0 ? -6 : 1 - currentDayNum;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMon);

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const dayDateMap: Record<string, { date: string; isToday: boolean; monthName: string }> = {};

  days.forEach((dayCode, index) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + index);
    const dateStr = d.getDate().toString().padStart(2, '0');
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    dayDateMap[dayCode] = {
      date: dateStr,
      isToday,
      monthName,
    };
  });

  const monthYearLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  const todayDateStr = now.getDate().toString().padStart(2, '0');

  return { dayDateMap, monthYearLabel, todayDateStr };
};

const weekInfo = getDynamicWeekInfo();

const initialTimetableData: DayGroup[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayCode) => ({
  day: dayCode,
  date: weekInfo.dayDateMap[dayCode].date,
  monthName: weekInfo.dayDateMap[dayCode].monthName,
  isToday: weekInfo.dayDateMap[dayCode].isToday,
  classes: [],
}));

export default function TimetableScreen() {
  const [selectedDate, setSelectedDate] = useState(weekInfo.todayDateStr);
  const [timetableData, setTimetableData] = useState<DayGroup[]>(initialTimetableData);
  const [loading, setLoading] = useState(false);
  const { role } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const fetchTimetable = useCallback(async () => {
    const dynamicWeek = getDynamicWeekInfo();
    const { data, error } = await supabase
      .from('timetable_events')
      .select('*, courses(title, instructor, accent_color)')
      .order('start_time', { ascending: true });

    if (!error) {
      const eventsList = data || [];
      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const grouped: DayGroup[] = days.map((dayCode) => {
        const dayMeta = dynamicWeek.dayDateMap[dayCode] || { date: '01', isToday: false, monthName: 'AUG' };
        const dayEvents = eventsList.filter((e: any) => e.day_of_week === dayCode);
        const classes = dayEvents.map((e: any) => {
          let title = e.courses?.title || 'Class';
          let location = e.venue || 'TBA';
          if (e.venue && e.venue.includes(' • ')) {
            const parts = e.venue.split(' • ');
            title = parts[0];
            location = `${parts[1]}${parts[2] ? ' • ' + parts[2] : ''}`;
          }
          return {
            id: e.id,
            title,
            time: `${e.start_time} → ${e.end_time}`,
            location,
            color: e.courses?.accent_color || '#2563eb',
            type: e.class_type || 'Lecture',
          };
        });
        return {
          day: dayCode,
          date: dayMeta.date,
          monthName: dayMeta.monthName,
          isToday: dayMeta.isToday,
          classes,
        };
      });
      setTimetableData(grouped);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTimetable();
    }, [fetchTimetable])
  );

  const filteredDays = timetableData.filter((dayGroup) => dayGroup.date === selectedDate);

  return (
    <View style={styles.splitLayout}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Left Dark / Accent Sidebar */}
      <View style={[styles.sidebar, { backgroundColor: colors.primary, borderRightColor: colors.primaryDark, paddingTop: insets.top + 12 }]}>
        {/* Calendar Month Header */}
        <View style={styles.monthHeader}>
          <Calendar size={18} color={'#ffffff'} />
          <Text style={[styles.monthText, { color: '#ffffff' }]}>{weekInfo.monthYearLabel.split(' ')[0].slice(0, 3)}</Text>
        </View>

        {/* Vertical Day Selector */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sidebarScroll}
        >
          {timetableData.map((dayGroup) => {
            const isSelected = selectedDate === dayGroup.date;
            const activePillBg = '#ffffff';
            const activeTextColor = colors.primary;

            return (
              <TouchableOpacity
                key={dayGroup.day}
                style={[
                  styles.dayPill,
                  isSelected && [styles.dayPillActive, { backgroundColor: activePillBg }],
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedDate(dayGroup.date)}
              >
                <Text
                  style={[
                    styles.dayName,
                    { color: '#ffffff', opacity: isSelected ? 1 : 0.75 },
                    isSelected && { color: activeTextColor },
                  ]}
                >
                  {dayGroup.day}
                </Text>
                <Text
                  style={[
                    styles.dateNumber,
                    { color: '#ffffff' },
                    isSelected && { color: activeTextColor },
                  ]}
                >
                  {dayGroup.date}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Right Main Content Area */}
      <View style={[styles.mainContent, { backgroundColor: colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.eventsScrollView}
          contentContainerStyle={[styles.eventsContent, { paddingTop: insets.top + 16 }]}
        >
          {filteredDays.map((dayGroup) => (
            <View key={dayGroup.date} style={styles.daySection}>
              {/* Day Header Bar */}
              <View style={styles.daySectionHeader}>
                <Text style={[styles.daySectionTitle, { color: colors.text }]}>
                  {dayGroup.day}, {dayGroup.monthName} {dayGroup.date}
                </Text>
                {dayGroup.isToday && (
                  <View style={[styles.todayBadge, { backgroundColor: '#eff6ff', borderColor: colors.badgeBorder }]}>
                    <Text style={[styles.todayBadgeText, { color: '#1e40af' }]}>TODAY</Text>
                  </View>
                )}
              </View>

              {/* Class Event Items */}
              {dayGroup.classes.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Text style={[styles.emptyDayText, { color: colors.textSecondary }]}>No classes today</Text>
                  <Text style={[styles.emptyDaySub, { color: colors.textMuted }]}>Friday is free — rest up or get ahead!</Text>
                </View>
                ) : (
                  <View style={styles.classList}>
                    {dayGroup.classes.map((cls) => (
                      <TouchableOpacity
                        key={cls.id}
                        style={[styles.classCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                        activeOpacity={0.75}
                      >
                        {/* Vertical Accent Color Bar */}
                        <View
                          style={[
                            styles.colorBar,
                            { backgroundColor: cls.color },
                          ]}
                        />

                        {/* Class Details */}
                        <View style={styles.classDetails}>
                          <Text style={[styles.classTitle, { color: colors.text }]}>{cls.title}</Text>
                          <Text style={[styles.classTime, { color: colors.textSecondary }]}>{cls.time}</Text>
                          <Text style={[styles.classLocation, { color: colors.textMuted }]}>{cls.location}</Text>
                        </View>

                        {/* Options Button */}
                        <TouchableOpacity style={styles.optionsBtn}>
                          <MoreVertical size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          {/* Floating Add Class Button */}
          {role === 'rep' && (
            <TouchableOpacity
              style={styles.fabBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/edit-timetable')}
            >
              <Plus size={26} color="#0f172a" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  splitLayout: {
    flex: 1,
    flexDirection: 'row',
  },

  /* Left Dark Sidebar */
  sidebar: {
    width: 88,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1d4ed8',
  },
  monthHeader: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  monthText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  sidebarScroll: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 110,
  },
  dayPill: {
    width: 64,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayPillActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  dayNameActive: {
    color: '#2563eb',
  },
  dateNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  dateNumberActive: {
    color: '#2563eb',
  },

  /* Right Main Content Area */
  mainContent: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  eventsScrollView: {
    flex: 1,
  },
  eventsContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  daySection: {
    marginBottom: 24,
  },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  daySectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
  },
  todayBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },

  /* Class Event Items */
  classList: {
    gap: 12,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  colorBar: {
    width: 6,
    height: 44,
    borderRadius: 3,
    marginRight: 14,
  },
  classDetails: {
    flex: 1,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  classTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  classLocation: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  optionsBtn: {
    padding: 6,
  },

  /* Floating Add Class Button */
  fabBtn: {
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

  /* Empty Day State */
  emptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyDayIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyDayText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 6,
  },
  emptyDaySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});

