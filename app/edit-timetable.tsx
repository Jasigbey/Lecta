import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  Trash2,
  Plus,
  Save,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

type ClassType = 'Lecture' | 'Lab' | 'Tutorial' | 'Test' | 'Other';
type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const courseOptions = [
  { title: 'Data Structures II',          instructor: 'Dr. Panford',       color: '#2563eb' },
  { title: 'Computer Architecture',        instructor: 'Dr. Rosemary',      color: '#7c3aed' },
  { title: 'Computer Graphics',            instructor: 'Prof. Usaph',       color: '#10b981' },
  { title: 'Embedded System',              instructor: 'Dr. Komyo',         color: '#f59e0b' },
  { title: 'Financial Accounting',         instructor: 'Dr. Beatrice',      color: '#0284c7' },
  { title: 'E-Commerce',                   instructor: 'Prof. Teum (Castro)',color: '#4f46e5' },
  { title: 'Operations Research II',       instructor: 'Dr. Owusu',         color: '#db2777' },
  { title: 'Research Method & IT Project', instructor: 'Dr. Eric',          color: '#059669' },
];

const getDynamicDayOptions = (): { value: DayCode; label: string; date: string }[] => {
  const now = new Date();
  const currentDayNum = now.getDay();
  const distanceToMon = currentDayNum === 0 ? -6 : 1 - currentDayNum;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMon);

  const days: { value: DayCode; label: string }[] = [
    { value: 'MON', label: 'Monday' },
    { value: 'TUE', label: 'Tuesday' },
    { value: 'WED', label: 'Wednesday' },
    { value: 'THU', label: 'Thursday' },
    { value: 'FRI', label: 'Friday' },
    { value: 'SAT', label: 'Saturday' },
    { value: 'SUN', label: 'Sunday' },
  ];

  return days.map((d, index) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + index);
    return {
      ...d,
      date: dayDate.getDate().toString().padStart(2, '0'),
    };
  });
};

const dayOptions = getDynamicDayOptions();

const classTypeOptions: ClassType[] = ['Lecture', 'Lab', 'Tutorial', 'Test', 'Other'];

const typeColors: Record<ClassType, string> = {
  Lecture:  '#2563eb',
  Lab:      '#10b981',
  Tutorial: '#f59e0b',
  Test:     '#ef4444',
  Other:    '#64748b',
};

interface Entry {
  id: string;
  day: DayCode;
  title: string;
  time: string;
  venue: string;
  instructor: string;
  color: string;
  type: ClassType;
}

export default function EditTimetableScreen() {
  const { colors, isDarkMode } = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'add'>('edit');

  // Form state
  const [selCourse, setSelCourse]   = useState<typeof courseOptions[0] | null>(null);
  const [selDay, setSelDay]         = useState<typeof dayOptions[0] | null>(null);
  const [selType, setSelType]       = useState<ClassType | null>(null);
  const [startTime, setStartTime]   = useState('');
  const [endTime, setEndTime]       = useState('');
  const [venue, setVenue]           = useState('');

  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [showDayPicker, setShowDayPicker]       = useState(false);
  const [showTypePicker, setShowTypePicker]     = useState(false);

  React.useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('timetable_events')
      .select('*, courses(title, instructor, accent_color)')
      .order('start_time', { ascending: true });

    if (!error) {
      const eventsList = data || [];
      const mapped: Entry[] = eventsList.map((e: any) => {
        let title = e.courses?.title || 'Class';
        let venueText = e.venue || 'TBA';
        let instructorText = e.courses?.instructor || 'Lecturer';

        if (e.venue && e.venue.includes(' • ')) {
          const parts = e.venue.split(' • ');
          title = parts[0];
          venueText = parts[1];
          instructorText = parts[2] || instructorText;
        }

        return {
          id: e.id,
          day: e.day_of_week as DayCode,
          title,
          time: `${e.start_time} → ${e.end_time}`,
          venue: venueText,
          instructor: instructorText,
          color: e.courses?.accent_color || '#2563eb',
          type: (e.class_type as ClassType) || 'Lecture',
        };
      });
      setEntries(mapped);
    }
  };

  const closeAllPickers = () => {
    setShowCoursePicker(false);
    setShowDayPicker(false);
    setShowTypePicker(false);
  };

  const isAddValid = !!selCourse && !!selDay && !!selType && startTime.trim().length > 0 && endTime.trim().length > 0 && venue.trim().length > 0;

  const handleAddEntry = async () => {
    if (!isAddValid) {
      Alert.alert('Missing Fields', 'Please fill in all required fields before adding the class.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'You must be logged in to add a class.');
      return;
    }

    const { data, error } = await supabase
      .from('timetable_events')
      .insert({
        created_by: user.id,
        day_of_week: selDay!.value,
        start_time: startTime.trim(),
        end_time: endTime.trim(),
        venue: `${selCourse!.title} • ${venue.trim()} • ${selCourse!.instructor}`,
        class_type: selType! === 'Test' || selType! === 'Other' ? 'Lecture' : selType!,
      })
      .select();

    if (error) {
      console.error('Add Timetable Event Error:', error);
      Alert.alert('Failed to Add Class', error.message);
      return;
    }

    const newEntry: Entry = {
      id: data && data[0] ? data[0].id : Date.now().toString(),
      day: selDay!.value,
      title: selCourse!.title,
      time: `${startTime.trim()} → ${endTime.trim()}`,
      venue: venue.trim(),
      instructor: selCourse!.instructor,
      color: selCourse!.color,
      type: selType!,
    };
    setEntries((prev) => [...prev, newEntry]);
    setSelCourse(null);
    setSelDay(null);
    setSelType(null);
    setStartTime('');
    setEndTime('');
    setVenue('');
    setActiveTab('edit');
    Alert.alert('Class Added ✓', `${newEntry.title} has been added to ${selDay!.label}.`);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Class', 'Are you sure you want to remove this class from the timetable?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('timetable_events').delete().eq('id', id);
          setEntries((prev) => prev.filter((e) => e.id !== id));
        },
      },
    ]);
  };

  const handleSave = () => {
    Alert.alert('Timetable Saved ✓', 'Your changes have been updated for all students in the class.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  };

  const grouped = dayOptions.map((d) => ({
    ...d,
    classes: entries.filter((e) => e.day === d.value),
  }));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Timetable</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Course Rep · July 2026</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
          <Save size={15} color="#ffffff" />
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Switch */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'edit' && styles.tabActive]}
          onPress={() => setActiveTab('edit')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'edit' && styles.tabTextActive]}>Current Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'add' && styles.tabActive]}
          onPress={() => setActiveTab('add')}
          activeOpacity={0.8}
        >
          <Plus size={14} color={activeTab === 'add' ? '#2563eb' : colors.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'add' && styles.tabTextActive]}>Add Class</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'edit' ? (
        /* Edit Tab */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.editContent} showsVerticalScrollIndicator={false}>
          {grouped.map((day) => (
            <View key={day.value}>
              <View style={[styles.dayHeader, { backgroundColor: colors.background }]}>
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.dayHeaderName, { color: colors.text }]}>{day.label}</Text>
                  <Text style={[styles.dayHeaderDate, { color: colors.textSecondary }]}>July {day.date}</Text>
                </View>
                <View style={[styles.classCountBadge, { backgroundColor: day.classes.length > 0 ? (isDarkMode ? '#1e3a8a' : '#eff6ff') : colors.card }]}>
                  <Text style={[styles.classCountText, { color: day.classes.length > 0 ? '#2563eb' : colors.textMuted }]}>
                    {day.classes.length} {day.classes.length === 1 ? 'class' : 'classes'}
                  </Text>
                </View>
              </View>

              {day.classes.length === 0 ? (
                <View style={[styles.emptyDayCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  <Text style={[styles.emptyDayText, { color: colors.textMuted }]}>No classes — tap "Add Class" to schedule one</Text>
                </View>
              ) : (
                day.classes.map((cls) => (
                  <View key={cls.id} style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <View style={[styles.entryColorBar, { backgroundColor: cls.color }]} />
                    <View style={styles.entryInfo}>
                      <View style={styles.entryTopRow}>
                        <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>{cls.title}</Text>
                        <View style={[styles.typeBadge, { backgroundColor: typeColors[cls.type] + '20' }]}>
                          <Text style={[styles.typeBadgeText, { color: typeColors[cls.type] }]}>{cls.type}</Text>
                        </View>
                      </View>
                      <View style={styles.entryMeta}>
                        <Clock size={12} color={colors.textSecondary} />
                        <Text style={[styles.entryMetaText, { color: colors.textSecondary }]}>{cls.time}</Text>
                      </View>
                      <View style={styles.entryMeta}>
                        <MapPin size={12} color={colors.textSecondary} />
                        <Text style={[styles.entryMetaText, { color: colors.textSecondary }]}>{cls.venue} · {cls.instructor}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(cls.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={17} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* Add Tab */
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.addContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Course */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Course <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: selCourse ? selCourse.color : colors.cardBorder }]}
              onPress={() => { closeAllPickers(); setShowCoursePicker((v) => !v); }}
              activeOpacity={0.8}
            >
              {selCourse && <View style={[styles.dot, { backgroundColor: selCourse.color }]} />}
              <Text style={[styles.selectorText, { color: selCourse ? colors.text : colors.textMuted }]}>
                {selCourse ? selCourse.title : 'Select a course…'}
              </Text>
              <ChevronDown size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {showCoursePicker && (
              <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {courseOptions.map((c) => (
                  <TouchableOpacity
                    key={c.title}
                    style={[styles.dropdownOption, selCourse?.title === c.title && styles.dropdownOptionActive, { borderBottomColor: colors.cardBorder }]}
                    onPress={() => { setSelCourse(c); setShowCoursePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropdownOptionTitle, { color: colors.text }]}>{c.title}</Text>
                      <Text style={[styles.dropdownOptionSub, { color: colors.textSecondary }]}>{c.instructor}</Text>
                    </View>
                    {selCourse?.title === c.title && <CheckCircle2 size={16} color={c.color} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Day */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Day <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: selDay ? '#2563eb' : colors.cardBorder }]}
              onPress={() => { closeAllPickers(); setShowDayPicker((v) => !v); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.selectorText, { color: selDay ? colors.text : colors.textMuted }]}>
                {selDay ? `${selDay.label} (July ${selDay.date})` : 'Select a day…'}
              </Text>
              <ChevronDown size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {showDayPicker && (
              <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {dayOptions.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    style={[styles.dropdownOption, selDay?.value === d.value && styles.dropdownOptionActive, { borderBottomColor: colors.cardBorder }]}
                    onPress={() => { setSelDay(d); setShowDayPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownOptionTitle, { color: selDay?.value === d.value ? '#2563eb' : colors.text, flex: 1 }]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.dropdownOptionSub, { color: colors.textMuted }]}>July {d.date}</Text>
                    {selDay?.value === d.value && <CheckCircle2 size={16} color="#2563eb" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Class Type */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Class Type <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: selType ? typeColors[selType] : colors.cardBorder }]}
              onPress={() => { closeAllPickers(); setShowTypePicker((v) => !v); }}
              activeOpacity={0.8}
            >
              {selType && <View style={[styles.dot, { backgroundColor: typeColors[selType] }]} />}
              <Text style={[styles.selectorText, { color: selType ? colors.text : colors.textMuted }]}>
                {selType ?? 'Select class type…'}
              </Text>
              <ChevronDown size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {showTypePicker && (
              <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                {classTypeOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.dropdownOption, selType === t && styles.dropdownOptionActive, { borderBottomColor: colors.cardBorder }]}
                    onPress={() => { setSelType(t); setShowTypePicker(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dot, { backgroundColor: typeColors[t] }]} />
                    <Text style={[styles.dropdownOptionTitle, { color: selType === t ? typeColors[t] : colors.text, flex: 1 }]}>{t}</Text>
                    {selType === t && <CheckCircle2 size={16} color={typeColors[t]} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Time Row */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Time <Text style={styles.required}>*</Text></Text>
            <View style={styles.timeRow}>
              <View style={[styles.timeWrap, { backgroundColor: colors.card, borderColor: startTime ? '#2563eb' : colors.cardBorder }]}>
                <Clock size={15} color={colors.textSecondary} />
                <TextInput
                  style={[styles.timeInput, { color: colors.text }]}
                  placeholder="Start (e.g. 10:30 AM)"
                  placeholderTextColor={colors.textMuted}
                  value={startTime}
                  onChangeText={setStartTime}
                />
              </View>
              <Text style={[styles.timeSep, { color: colors.textMuted }]}>→</Text>
              <View style={[styles.timeWrap, { backgroundColor: colors.card, borderColor: endTime ? '#2563eb' : colors.cardBorder }]}>
                <Clock size={15} color={colors.textSecondary} />
                <TextInput
                  style={[styles.timeInput, { color: colors.text }]}
                  placeholder="End (e.g. 12:30 PM)"
                  placeholderTextColor={colors.textMuted}
                  value={endTime}
                  onChangeText={setEndTime}
                />
              </View>
            </View>

            {/* Venue */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>Venue <Text style={styles.required}>*</Text></Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: venue ? '#2563eb' : colors.cardBorder }]}>
              <MapPin size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                placeholder="e.g. SF20, TF1, Lecture Theatre 2…"
                placeholderTextColor={colors.textMuted}
                value={venue}
                onChangeText={setVenue}
                returnKeyType="done"
              />
            </View>

            {/* Live Preview Card */}
            {isAddValid && (
              <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: selCourse!.color }]}>
                <Text style={[styles.previewLabel, { color: colors.textMuted }]}>PREVIEW</Text>
                <View style={styles.previewRow}>
                  <View style={[styles.previewBar, { backgroundColor: selCourse!.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.previewTitleRow}>
                      <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={1}>{selCourse!.title}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: typeColors[selType!] + '20' }]}>
                        <Text style={[styles.typeBadgeText, { color: typeColors[selType!] }]}>{selType}</Text>
                      </View>
                    </View>
                    <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>
                      {startTime} → {endTime}
                    </Text>
                    <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>
                      {venue} · {selCourse!.instructor}
                    </Text>
                    <Text style={[styles.previewMeta, { color: '#2563eb' }]}>
                      {selDay!.label}, July {selDay!.date}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Add Button */}
            <TouchableOpacity
              style={[styles.addBtn, !isAddValid && styles.addBtnDisabled]}
              onPress={handleAddEntry}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#ffffff" />
              <Text style={styles.addBtnText}>Add to Timetable</Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  tabTextActive: { color: '#2563eb' },

  editContent: { paddingHorizontal: 16, paddingTop: 8 },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayHeaderName: { fontSize: 15, fontWeight: '800' },
  dayHeaderDate: { fontSize: 13, fontWeight: '500' },
  classCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  classCountText: { fontSize: 11, fontWeight: '700' },

  emptyDayCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyDayText: { fontSize: 13, fontWeight: '500' },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  entryColorBar: { width: 5, alignSelf: 'stretch' },
  entryInfo: { flex: 1, padding: 14 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  entryTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  entryMetaText: { fontSize: 12, fontWeight: '500' },
  deleteBtn: { padding: 16 },

  addContent: { paddingHorizontal: 16, paddingTop: 20 },

  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  required: { color: '#ef4444' },

  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  selectorText: { flex: 1, fontSize: 15, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },

  dropdown: {
    borderWidth: 1.5,
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 10,
  },
  dropdownOptionActive: { backgroundColor: '#eff6ff' },
  dropdownOptionTitle: { fontSize: 14, fontWeight: '600' },
  dropdownOptionSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  timeInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },
  timeSep: { fontSize: 18, fontWeight: '700' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },

  previewCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  previewLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  previewRow: { flexDirection: 'row', gap: 12 },
  previewBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  previewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  previewTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  previewMeta: { fontSize: 13, fontWeight: '500', marginTop: 3 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 15,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  addBtnDisabled: { backgroundColor: '#2563eb' },
  addBtnText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});
