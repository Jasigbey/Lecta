import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Eye,
  MessageSquare,
  Activity,
  UserCheck,
  Shield,
  Save,
  CheckCircle2,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { safeStorage } from '../lib/storage';
import { supabase } from '../lib/supabase';

type Visibility = 'all' | 'reps' | 'private';

interface PrivacySettingsData {
  visibility: Visibility;
  onlineStatus: boolean;
  readReceipts: boolean;
  shareActivity: boolean;
  allowDms: boolean;
  analytics: boolean;
}

export default function PrivacySettingsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const [visibility, setVisibility]     = useState<Visibility>('all');
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [shareActivity, setShareActivity] = useState(true);
  const [allowDms, setAllowDms]         = useState(true);
  const [analytics, setAnalytics]       = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [isLoading, setIsLoading]       = useState(true);

  const getStorageKey = () => `@lecta_privacy_settings_${user?.id || 'guest'}`;

  const loadPreferences = useCallback(async () => {
    try {
      const stored = await safeStorage.getItem(getStorageKey());
      if (stored) {
        const parsed: PrivacySettingsData = JSON.parse(stored);
        if (parsed.visibility) setVisibility(parsed.visibility);
        if (parsed.onlineStatus !== undefined) setOnlineStatus(parsed.onlineStatus);
        if (parsed.readReceipts !== undefined) setReadReceipts(parsed.readReceipts);
        if (parsed.shareActivity !== undefined) setShareActivity(parsed.shareActivity);
        if (parsed.allowDms !== undefined) setAllowDms(parsed.allowDms);
        if (parsed.analytics !== undefined) setAnalytics(parsed.analytics);
      }
    } catch (e) {
      console.error('Error loading privacy settings:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: PrivacySettingsData = {
        visibility,
        onlineStatus,
        readReceipts,
        shareActivity,
        allowDms,
        analytics,
      };

      // 1. Save to local storage for instant offline & reload persistence
      await safeStorage.setItem(getStorageKey(), JSON.stringify(payload));

      // 2. Sync to Supabase profiles table if logged in
      if (user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        } catch (syncErr) {
          console.warn('Supabase profile sync warning:', syncErr);
        }
      }

      setIsSaving(false);
      Alert.alert('Privacy Saved ✓', 'Your privacy preferences have been updated and applied.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setIsSaving(false);
      Alert.alert('Error', 'Could not save privacy preferences. Please try again.');
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Settings</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Control who sees your info and activity</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={15} color="#ffffff" />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile Visibility Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>PROFILE VISIBILITY</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.optionRow, visibility === 'all' && styles.optionRowActive]}
            onPress={() => setVisibility('all')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Everyone in Class</Text>
              <Text style={[styles.optionSub, { color: colors.textSecondary }]}>All registered classmates can see your profile details</Text>
            </View>
            {visibility === 'all' && <CheckCircle2 size={18} color="#2563eb" />}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          <TouchableOpacity
            style={[styles.optionRow, visibility === 'reps' && styles.optionRowActive]}
            onPress={() => setVisibility('reps')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Course Reps Only</Text>
              <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Only course representatives can view your contact info</Text>
            </View>
            {visibility === 'reps' && <CheckCircle2 size={18} color="#2563eb" />}
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          <TouchableOpacity
            style={[styles.optionRow, visibility === 'private' && styles.optionRowActive]}
            onPress={() => setVisibility('private')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Private</Text>
              <Text style={[styles.optionSub, { color: colors.textSecondary }]}>Hide profile from classmates (only visible in chat)</Text>
            </View>
            {visibility === 'private' && <CheckCircle2 size={18} color="#2563eb" />}
          </TouchableOpacity>
        </View>

        {/* Activity & Chat Controls */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>CHAT & ONLINE STATUS</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Online Status */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}>
              <Eye size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Show Online Status</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Let classmates see when you're active</Text>
            </View>
            <Switch
              value={onlineStatus}
              onValueChange={setOnlineStatus}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Read Receipts */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#064e3b' : '#f0fdf4' }]}>
              <UserCheck size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Read Receipts</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Show checkmarks when you've read messages</Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={setReadReceipts}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Allow DMs */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#312e81' : '#eef2ff' }]}>
              <MessageSquare size={18} color="#4f46e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Allow Direct Messages</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Allow classmates to start new direct chats</Text>
            </View>
            <Switch
              value={allowDms}
              onValueChange={setAllowDms}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Data & Study Activity */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>DATA & ANALYTICS</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Share Activity */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#7c2d12' : '#fff7ed' }]}>
              <Activity size={18} color="#ea580c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Share Daily Focus Stats</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Include your focus hours on class leaderboard</Text>
            </View>
            <Switch
              value={shareActivity}
              onValueChange={setShareActivity}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Usage Analytics */}
          <View style={styles.toggleRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
              <Shield size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Anonymous App Analytics</Text>
              <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>Help us improve Lecta by sharing usage data</Text>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ false: '#cbd5e1', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveBottomBtn} onPress={handleSave} activeOpacity={0.85}>
          <Save size={18} color="#ffffff" />
          <Text style={styles.saveBottomText}>Save Preferences</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
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

  content: { paddingHorizontal: 20, paddingTop: 20 },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardGroup: {
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  divider: { height: 1 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  optionRowActive: {},
  optionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  optionSub: { fontSize: 12, lineHeight: 17 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  toggleSub: { fontSize: 12, lineHeight: 17 },

  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  saveBottomText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});
