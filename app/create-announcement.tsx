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
  Send,
  Paperclip,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  ChevronDown,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { sendInstantNotification } from '../lib/notifications';

type Priority = 'urgent' | 'info' | 'success' | 'reminder';
type Category = 'EXAM' | 'DEADLINE' | 'MATERIAL' | 'NOTICE' | 'SCHEDULE';

const priorityOptions: { value: Priority; label: string; color: string; icon: any }[] = [
  { value: 'urgent',   label: 'Urgent',   color: '#ef4444', icon: AlertTriangle },
  { value: 'info',     label: 'Info',     color: '#2563eb', icon: Bell },
  { value: 'success',  label: 'Success',  color: '#10b981', icon: CheckCircle2 },
  { value: 'reminder', label: 'Reminder', color: '#f59e0b', icon: Clock },
];

const categoryOptions: Category[] = ['EXAM', 'DEADLINE', 'MATERIAL', 'NOTICE', 'SCHEDULE'];

export default function CreateAnnouncementScreen() {
  const { colors, isDarkMode } = useTheme();

  const [title, setTitle]           = useState('');
  const [body, setBody]             = useState('');
  const [category, setCategory]     = useState<Category | null>(null);
  const [priority, setPriority]     = useState<Priority | null>(null);
  const [pinned, setPinned]         = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [showCatPicker, setShowCatPicker]     = useState(false);
  const [showPrioPicker, setShowPrioPicker]   = useState(false);
  const [publishing, setPublishing] = useState(false);

  const selectedPriority = priorityOptions.find((p) => p.value === priority);
  const isValid = title.trim().length > 0 && body.trim().length > 0 && !!category && !!priority;

  // Map UI priority to DB priority
  const mapPriorityToDB = (p: Priority): string => {
    if (p === 'urgent') return 'HIGH';
    if (p === 'info') return 'MEDIUM';
    return 'NORMAL';
  };

  // Map UI category to DB check constraint ('EXAM', 'LECTURE', 'ASSIGNMENT', 'GENERAL')
  const mapCategoryToDB = (c: Category): string => {
    if (c === 'EXAM') return 'EXAM';
    if (c === 'DEADLINE') return 'ASSIGNMENT';
    return 'GENERAL';
  };

  const handlePublish = async () => {
    if (!isValid) {
      Alert.alert('Missing Fields', 'Please fill in the title, body, category, and priority before publishing.');
      return;
    }
    setPublishing(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setPublishing(false);
      Alert.alert('Error', 'You must be logged in to publish an announcement.');
      return;
    }

    const { error } = await supabase.from('announcements').insert({
      author_id: user.id,
      title: title.trim(),
      body: body.trim(),
      category: mapCategoryToDB(category!),
      priority: mapPriorityToDB(priority!),
      pinned,
      attachment_url: attachment ?? null,
    });

    setPublishing(false);

    if (error) {
      console.error('Publish Announcement Error:', error);
      Alert.alert('Failed to Publish', error.message);
      return;
    }

    // Trigger native pop-up notification on device
    await sendInstantNotification(
      `📢 ${title.trim()}`,
      body.trim(),
      { targetRoute: '/announcements' },
      priority === 'urgent' ? 'lecta-urgent' : 'lecta-default'
    );

    Alert.alert(
      'Announcement Published',
      'Your announcement has been sent to all students.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const handleAttach = () => {
    Alert.alert('Attach File', 'File picker would open here.\n(Requires expo-document-picker in production)', [
      { text: 'Simulate Attachment', onPress: () => setAttachment('LectureNotes_Week8.pdf') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Announcement</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Course Rep only</Text>
        </View>

        <TouchableOpacity
          style={[styles.publishBtn, !isValid && styles.publishBtnDisabled]}
          onPress={handlePublish}
          activeOpacity={0.8}
        >
          <Send size={15} color="#ffffff" />
          <Text style={styles.publishBtnText}>Publish</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Category */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: category ? '#2563eb' : colors.cardBorder }]}
            onPress={() => { setShowCatPicker((v) => !v); setShowPrioPicker(false); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.selectorText, { color: category ? colors.text : colors.textMuted }]}>
              {category ?? 'Select a category…'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {showCatPicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {categoryOptions.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.pickerOption,
                    category === cat && styles.pickerOptionActive,
                    { borderBottomColor: colors.cardBorder },
                  ]}
                  onPress={() => { setCategory(cat); setShowCatPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerOptionText, { color: category === cat ? '#2563eb' : colors.text }]}>
                    {cat}
                  </Text>
                  {category === cat && <CheckCircle2 size={16} color="#2563eb" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Priority */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>
            Priority <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.selectorBtn, { backgroundColor: colors.card, borderColor: priority ? selectedPriority!.color : colors.cardBorder }]}
            onPress={() => { setShowPrioPicker((v) => !v); setShowCatPicker(false); }}
            activeOpacity={0.8}
          >
            {selectedPriority && (
              <View style={[styles.priorityDot, { backgroundColor: selectedPriority.color }]} />
            )}
            <Text style={[styles.selectorText, { color: priority ? colors.text : colors.textMuted }]}>
              {selectedPriority ? selectedPriority.label : 'Select priority…'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {showPrioPicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {priorityOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.pickerOption,
                      priority === opt.value && styles.pickerOptionActive,
                      { borderBottomColor: colors.cardBorder },
                    ]}
                    onPress={() => { setPriority(opt.value); setShowPrioPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Icon size={16} color={opt.color} />
                    <Text style={[styles.pickerOptionText, { color: priority === opt.value ? opt.color : colors.text, marginLeft: 8, flex: 1 }]}>
                      {opt.label}
                    </Text>
                    {priority === opt.value && <CheckCircle2 size={16} color={opt.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Title */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: title ? '#2563eb' : colors.cardBorder }]}>
            <TextInput
              style={[styles.titleInput, { color: colors.text }]}
              placeholder="e.g. Mid-Semester Exams — Timetable Released"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />
          </View>
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/120</Text>

          {/* Message Body */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Message <Text style={styles.required}>*</Text>
          </Text>
          <View style={[styles.inputWrap, styles.bodyWrap, { backgroundColor: colors.card, borderColor: body ? '#2563eb' : colors.cardBorder }]}>
            <TextInput
              style={[styles.bodyInput, { color: colors.text }]}
              placeholder="Write your announcement here…"
              placeholderTextColor={colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              maxLength={600}
            />
          </View>
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{body.length}/600</Text>

          {/* Options Row */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.optionChip, { backgroundColor: colors.card, borderColor: pinned ? '#2563eb' : colors.cardBorder }]}
              onPress={() => setPinned((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>📌</Text>
              <Text style={[styles.optionChipText, { color: pinned ? '#2563eb' : colors.textSecondary }]}>
                {pinned ? 'Pinned' : 'Pin'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionChip, { backgroundColor: colors.card, borderColor: attachment ? '#10b981' : colors.cardBorder }]}
              onPress={handleAttach}
              activeOpacity={0.8}
            >
              <Paperclip size={15} color={attachment ? '#10b981' : colors.textSecondary} />
              <Text style={[styles.optionChipText, { color: attachment ? '#10b981' : colors.textSecondary }]}>
                {attachment ? 'Attached' : 'Attach File'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Attachment pill */}
          {attachment && (
            <View style={[styles.attachmentPill, { backgroundColor: isDarkMode ? '#1a2e22' : '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <Paperclip size={14} color="#10b981" />
              <Text style={styles.attachmentName} numberOfLines={1}>{attachment}</Text>
              <TouchableOpacity onPress={() => setAttachment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color="#10b981" />
              </TouchableOpacity>
            </View>
          )}

          {/* Live Preview Card */}
          {(title.length > 0 || body.length > 0) && (
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.previewLabel, { color: colors.textMuted }]}>PREVIEW</Text>
              {category && (
                <Text style={styles.previewCategory}>{category}</Text>
              )}
              <Text style={[styles.previewTitle, { color: title ? colors.text : colors.textMuted }]}>
                {title || 'Untitled announcement…'}
              </Text>
              {body.length > 0 && (
                <Text style={[styles.previewBody, { color: colors.textSecondary }]} numberOfLines={3}>
                  {body}
                </Text>
              )}
              {selectedPriority && (
                <View style={[styles.previewPriorityTag, { backgroundColor: selectedPriority.color + '20', borderColor: selectedPriority.color + '60' }]}>
                  <View style={[styles.priorityDot, { backgroundColor: selectedPriority.color }]} />
                  <Text style={[styles.previewPriorityText, { color: selectedPriority.color }]}>
                    {selectedPriority.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Publish Button */}
          <TouchableOpacity
            style={[styles.publishBottomBtn, (!isValid || publishing) && styles.publishBtnDisabled]}
            onPress={handlePublish}
            activeOpacity={0.85}
            disabled={publishing}
          >
            <Send size={18} color="#ffffff" />
            <Text style={styles.publishBottomText}>
              {publishing ? 'Publishing...' : 'Publish Announcement'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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

  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  publishBtnDisabled: { backgroundColor: '#2563eb' },
  publishBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  content: { paddingHorizontal: 16, paddingTop: 20 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
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
  priorityDot: { width: 10, height: 10, borderRadius: 5 },

  pickerDropdown: {
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
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  pickerOptionActive: { backgroundColor: '#eff6ff' },
  pickerOptionText: { fontSize: 14, fontWeight: '600' },

  inputWrap: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleInput: { fontSize: 15, fontWeight: '500', padding: 0 },
  bodyWrap: { minHeight: 140 },
  bodyInput: { fontSize: 15, lineHeight: 22, padding: 0, minHeight: 120 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 2 },

  optionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  optionChipText: { fontSize: 13, fontWeight: '600' },

  attachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  attachmentName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#10b981' },

  previewCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 20,
  },
  previewLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  previewCategory: { fontSize: 11, fontWeight: '800', color: '#2563eb', letterSpacing: 0.7, marginBottom: 4 },
  previewTitle: { fontSize: 15, fontWeight: '800', lineHeight: 21, marginBottom: 6 },
  previewBody: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  previewPriorityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewPriorityText: { fontSize: 11, fontWeight: '700' },

  publishBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  publishBottomText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});
