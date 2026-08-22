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
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageSquare,
  Send,
  Mail,
  CheckCircle2,
  Bug,
  Sparkles,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeStorage } from '../lib/storage';

type FeedbackType = 'bug' | 'feature' | 'question';

const faqs = [
  {
    question: 'How do course announcements work?',
    answer: 'Announcements are posted by your Course Reps and Lecturers. Important updates like exam timetables or venue changes are pinned at the top. Tap any card to expand full details.',
  },
  {
    question: 'Where can I find lecture slides and notes?',
    answer: 'Navigate to the Course Materials page (via Dashboard or Quick Actions) where all course slides, PDFs, and assignment sheets are organized by course code.',
  },
  {
    question: 'How does the Lecta AI Assistant work?',
    answer: 'The floating AI button (sparkle icon) opens your personal study assistant. You can ask for explanations, study schedules, or summary notes for any of your courses.',
  },
  {
    question: 'How do I track my daily study focus?',
    answer: 'Use the Daily Focus timer accessible from your Dashboard. Set your target focus minutes, start the timer during study sessions, and review your weekly productivity trends.',
  },
  {
    question: 'Can I change between Light and Dark mode?',
    answer: 'Yes! Go to Settings and toggle the Dark Mode switch at any time. Lecta adapts all screens seamlessly.',
  },
];

const feedbackTypes: { value: FeedbackType; label: string; icon: any }[] = [
  { value: 'bug',      label: 'Bug Report',      icon: Bug },
  { value: 'feature',  label: 'Feature Request', icon: Sparkles },
  { value: 'question', label: 'Question / Other', icon: HelpCircle },
];

export default function HelpFeedbackScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const [expandedFaq, setExpandedFaq]         = useState<number | null>(0);
  const [feedbackType, setFeedbackType]       = useState<FeedbackType>('bug');
  const [subject, setSubject]                 = useState('');
  const [message, setMessage]                 = useState('');
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);

  const loadFeedbackHistory = React.useCallback(async () => {
    try {
      const stored = await safeStorage.getItem('@lecta_feedback_history');
      if (stored) {
        setFeedbackHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Error loading feedback history:', e);
    }
  }, []);

  React.useEffect(() => {
    loadFeedbackHistory();
  }, [loadFeedbackHistory]);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const isValid = subject.trim().length > 0 && message.trim().length > 0;

  const handleSubmitFeedback = async () => {
    if (!isValid || isSubmitting) {
      Alert.alert('Missing Fields', 'Please enter a subject and message before sending feedback.');
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackEntry = {
        id: `fb_${Date.now()}`,
        user_id: user?.id || 'anonymous',
        user_email: user?.email || 'guest@lecta.edu',
        type: feedbackType,
        subject: subject.trim(),
        message: message.trim(),
        created_at: new Date().toISOString(),
      };

      // 1. Save to local feedback history
      try {
        const storedHistory = await safeStorage.getItem('@lecta_feedback_history');
        const history = storedHistory ? JSON.parse(storedHistory) : [];
        history.unshift(feedbackEntry);
        await safeStorage.setItem('@lecta_feedback_history', JSON.stringify(history));
      } catch (storageErr) {
        console.warn('Storage feedback warning:', storageErr);
      }

      // 2. Try to sync with Supabase feedback table if available
      try {
        await supabase.from('feedback').insert({
          user_id: user?.id || null,
          feedback_type: feedbackType,
          subject: subject.trim(),
          message: message.trim(),
        });
      } catch (dbErr) {
        console.log('Database feedback fallback:', dbErr);
      }

      // 3. Format email for direct delivery to lectaapp.support@gmail.com
      const email = 'lectaapp.support@gmail.com';
      const typeLabel = feedbackType === 'bug' ? 'BUG REPORT' : (feedbackType === 'feature' ? 'FEATURE REQUEST' : 'QUESTION');
      const emailSubject = encodeURIComponent(`[Lecta ${typeLabel}] ${subject.trim()}`);
      const emailBody = encodeURIComponent(
        `Category: ${typeLabel}\n` +
        `User: ${user?.email || 'Student'}\n` +
        `Date: ${new Date().toLocaleString()}\n` +
        `Platform: ${Platform.OS}\n\n` +
        `Subject: ${subject.trim()}\n\n` +
        `Message:\n${message.trim()}\n`
      );
      const mailtoUrl = `mailto:${email}?subject=${emailSubject}&body=${emailBody}`;

      setIsSubmitting(false);
      setSubject('');
      setMessage('');
      await loadFeedbackHistory();

      Alert.alert(
        'Feedback Recorded! ✓',
        'Your feedback has been saved. Would you like to also open your email app to send it directly to lectaapp.support@gmail.com?',
        [
          { text: 'Later', style: 'cancel', onPress: () => router.back() },
          {
            text: 'Send Email',
            onPress: async () => {
              try {
                await Linking.openURL(mailtoUrl);
              } catch (e) {
                console.warn('Mailto error:', e);
              }
              router.back();
            },
          },
        ]
      );
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Error', 'Could not send feedback. Please try again.');
    }
  };

  const handleDirectEmailSupport = async () => {
    const email = 'lectaapp.support@gmail.com';
    const emailSubject = encodeURIComponent('Lecta App Support Inquiry');
    const mailtoUrl = `mailto:${email}?subject=${emailSubject}`;
    try {
      await Linking.openURL(mailtoUrl);
    } catch (e) {
      Alert.alert('Contact Support', `Please email our support team directly at: ${email}`);
    }
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Help & Feedback</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>FAQs and support center</Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* FAQ Section */}
          <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>FREQUENTLY ASKED QUESTIONS</Text>
          <View style={styles.faqList}>
            {faqs.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <View
                  key={index}
                  style={[styles.faqCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <TouchableOpacity
                    style={styles.faqHeader}
                    onPress={() => toggleFaq(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.faqQuestion, { color: colors.text }]}>{faq.question}</Text>
                    {isOpen ? <ChevronUp size={18} color="#2563eb" /> : <ChevronDown size={18} color={colors.textSecondary} />}
                  </TouchableOpacity>
                  {isOpen && (
                    <View style={styles.faqBodyWrap}>
                      <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>{faq.answer}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Feedback Form Section */}
          <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginTop: 24 }]}>SEND US FEEDBACK</Text>
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>

            {/* Type selector chips */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Feedback Type</Text>
            <View style={styles.typeRow}>
              {feedbackTypes.map((t) => {
                const Icon = t.icon;
                const isSel = feedbackType === t.value;
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      styles.typeChip,
                      { backgroundColor: isSel ? '#2563eb' : (isDarkMode ? '#0f172a' : '#f1f5f9'), borderColor: isSel ? '#2563eb' : colors.cardBorder },
                    ]}
                    onPress={() => setFeedbackType(t.value)}
                    activeOpacity={0.8}
                  >
                    <Icon size={14} color={isSel ? '#ffffff' : colors.textSecondary} />
                    <Text style={[styles.typeChipText, { color: isSel ? '#ffffff' : colors.text }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Subject */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Subject</Text>
            <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#0f172a' : '#f8faff', borderColor: subject ? '#2563eb' : colors.cardBorder }]}>
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                placeholder="Brief summary of your feedback…"
                placeholderTextColor={colors.textMuted}
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            {/* Message */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Message Details</Text>
            <View style={[styles.inputWrap, styles.msgWrap, { backgroundColor: isDarkMode ? '#0f172a' : '#f8faff', borderColor: message ? '#2563eb' : colors.cardBorder }]}>
              <TextInput
                style={[styles.msgInput, { color: colors.text }]}
                placeholder="Describe your issue or suggestion in detail…"
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.sendBtn, (!isValid || isSubmitting) && styles.sendBtnDisabled]}
              onPress={handleSubmitFeedback}
              activeOpacity={0.85}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Send size={16} color="#ffffff" />
                  <Text style={styles.sendBtnText}>Send Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Direct Support Card */}
          <TouchableOpacity
            style={[styles.supportCard, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', borderColor: isDarkMode ? '#2563eb' : '#bfdbfe' }]}
            onPress={handleDirectEmailSupport}
            activeOpacity={0.85}
          >
            <Mail size={22} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.supportTitle, { color: colors.text }]}>Need Direct Support?</Text>
              <Text style={[styles.supportSub, { color: colors.textSecondary }]}>Email lectaapp.support@gmail.com · Tap to compose email.</Text>
            </View>
          </TouchableOpacity>

          {/* Recent Submitted Feedback History */}
          {feedbackHistory.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>YOUR SUBMITTED TICKETS ({feedbackHistory.length})</Text>
              <View style={{ gap: 10 }}>
                {feedbackHistory.slice(0, 5).map((item) => (
                  <View
                    key={item.id}
                    style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  >
                    <View style={styles.historyHeader}>
                      <View style={[
                        styles.historyBadge,
                        { backgroundColor: item.type === 'bug' ? '#fef2f2' : (item.type === 'feature' ? '#f0fdf4' : '#eff6ff') }
                      ]}>
                        <Text style={[
                          styles.historyBadgeText,
                          { color: item.type === 'bug' ? '#dc2626' : (item.type === 'feature' ? '#16a34a' : '#2563eb') }
                        ]}>
                          {item.type.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                        {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[styles.historySubject, { color: colors.text }]} numberOfLines={1}>{item.subject}</Text>
                    <Text style={[styles.historyMessage, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

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

  content: { paddingHorizontal: 20, paddingTop: 20 },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },

  faqList: { gap: 10 },
  faqCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 10,
  },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  faqBodyWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAnswer: { fontSize: 13, lineHeight: 20 },

  formCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },

  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipText: { fontSize: 12, fontWeight: '700' },

  inputWrap: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: { fontSize: 14, fontWeight: '500', padding: 0 },

  msgWrap: { minHeight: 110 },
  msgInput: { fontSize: 14, lineHeight: 20, padding: 0, minHeight: 90 },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 15,
    marginTop: 18,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sendBtnDisabled: { backgroundColor: '#94a3b8' },
  sendBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  supportTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  supportSub: { fontSize: 12, lineHeight: 17 },

  historyCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  historyDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  historySubject: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
});
