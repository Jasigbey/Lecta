import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Bell,
  Lock,
  Moon,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
  UserX,
  AlertTriangle,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

import { safeStorage } from '../../lib/storage';
import { cancelAllScheduledNotifications } from '../../lib/notifications';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const notifKey = `@lecta_notifications_enabled_${user?.id || 'guest'}`;

  const loadNotificationsPreference = useCallback(async () => {
    try {
      const stored = await safeStorage.getItem(notifKey);
      if (stored !== null) {
        setNotifications(stored === 'true');
      }
    } catch (e) {
      console.error('Error reading notifications preference:', e);
    }
  }, [user]);

  const handleToggleNotifications = async (value: boolean) => {
    setNotifications(value);
    try {
      await safeStorage.setItem(notifKey, value ? 'true' : 'false');
      if (!value) {
        await cancelAllScheduledNotifications();
      }
    } catch (e) {
      console.error('Error saving notifications preference:', e);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    setLoadingProfile(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
    }
    setLoadingProfile(false);
  };

  useEffect(() => {
    fetchProfile();
    loadNotificationsPreference();
  }, [user, loadNotificationsPreference]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      loadNotificationsPreference();
    }, [user, loadNotificationsPreference])
  );

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Lecta?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (!user) return;

    Alert.alert(
      'Delete Account Permanently',
      'Are you sure you want to permanently delete your Lecta account? All your personal profile data, course bookmarks, focus tasks, tickets, and message history will be permanently deleted. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);

              // 1. Delete user records from Supabase
              await supabase.from('notifications').delete().eq('user_id', user.id);
              await supabase.from('chat_participants').delete().eq('user_id', user.id);
              await supabase.from('feedback').delete().eq('user_id', user.id);
              await supabase.from('profiles').delete().eq('id', user.id);

              // 2. Clear local storage keys for this user
              await safeStorage.removeItem(`@lecta_privacy_settings_${user.id}`);
              await safeStorage.removeItem(`@lecta_notifications_enabled_${user.id}`);
              await safeStorage.removeItem(`@lecta_read_notifications_${user.id}`);
              await safeStorage.removeItem(`@lecta_deleted_notifications_${user.id}`);
              await safeStorage.removeItem(`@lecta_push_token_${user.id}`);

              // 3. Clear scheduled notifications
              await cancelAllScheduledNotifications();

              // 4. Log out of auth session
              await logout();

              setIsDeleting(false);

              Alert.alert(
                'Account Deleted',
                'Your account and all associated data have been permanently removed.',
                [{ text: 'OK', onPress: () => router.replace('/login') }]
              );
            } catch (err: any) {
              setIsDeleting(false);
              console.error('Delete account error:', err);
              Alert.alert('Error', err.message || 'Could not delete account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.darkContainer]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={isDarkMode ? '#0f172a' : '#f8fafc'} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <Text style={[styles.headerTitle, isDarkMode && styles.darkText]}>Settings</Text>

          {/* User Profile Card */}
          <TouchableOpacity
            style={[styles.profileCard, isDarkMode && styles.darkCard]}
            activeOpacity={0.85}
            onPress={() => router.push('/profile')}
          >
            {loadingProfile ? (
              <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <ActivityIndicator size="small" color="#2563eb" />
              </View>
            ) : (
              <>
                <View style={styles.avatarWrap}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(profile?.full_name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={[styles.profileName, isDarkMode && styles.darkText]}>
                    {profile?.full_name || 'Unknown User'}
                  </Text>
                  <Text style={[styles.profileEmail, isDarkMode && styles.darkSubtext]}>
                    {profile?.email || user?.email || '—'}
                  </Text>
                  <Text style={styles.profileRole}>
                    {profile?.department || '—'} • {profile?.year_level || '—'}
                  </Text>
                </View>
                <ChevronRight size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} />
              </>
            )}
          </TouchableOpacity>

          {/* Section: Preferences */}
          <Text style={styles.sectionHeading}>PREFERENCES</Text>
          <View style={[styles.cardGroup, isDarkMode && styles.darkCard]}>
            <View style={styles.settingRow}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}>
                <Bell size={20} color={colors.primary} />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Notifications</Text>
              <Switch
                value={notifications}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />

            <View style={styles.settingRow}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
                <Moon size={20} color={isDarkMode ? '#fbbf24' : '#475569'} />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Dark Mode</Text>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#cbd5e1', true: colors.primary }}
                thumbColor="#ffffff"
              />
            </View>

          </View>

          {/* Section: Account & Security */}
          <Text style={styles.sectionHeading}>ACCOUNT & SECURITY</Text>
          <View style={[styles.cardGroup, isDarkMode && styles.darkCard]}>
            <TouchableOpacity style={styles.settingRowBtn} activeOpacity={0.7} onPress={() => router.push('/edit-profile')}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#064e3b' : '#f0fdf4' }]}>
                <User size={20} color="#16a34a" />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Edit Profile</Text>
              <ChevronRight size={18} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>

            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />

            <TouchableOpacity style={styles.settingRowBtn} activeOpacity={0.7} onPress={() => router.push('/change-password')}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#7c2d12' : '#fff7ed' }]}>
                <Lock size={20} color="#ea580c" />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Change Password</Text>
              <ChevronRight size={18} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>

            <View style={[styles.divider, isDarkMode && styles.darkDivider]} />

            <TouchableOpacity style={styles.settingRowBtn} activeOpacity={0.7} onPress={() => router.push('/privacy-settings')}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#7f1d1d' : '#fef2f2' }]}>
                <ShieldCheck size={20} color="#dc2626" />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Privacy Settings</Text>
              <ChevronRight size={18} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          </View>

          {/* Section: Support */}
          <Text style={styles.sectionHeading}>SUPPORT</Text>
          <View style={[styles.cardGroup, isDarkMode && styles.darkCard]}>
            <TouchableOpacity style={styles.settingRowBtn} activeOpacity={0.7} onPress={() => router.push('/help-feedback')}>
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#312e81' : '#eef2ff' }]}>
                <HelpCircle size={20} color="#4f46e5" />
              </View>
              <Text style={[styles.settingLabel, isDarkMode && styles.darkText]}>Help & Feedback</Text>
              <ChevronRight size={18} color={isDarkMode ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          </View>

          {/* Danger Zone: Account Management */}
          <Text style={[styles.sectionHeading, { color: '#dc2626' }]}>Delete Account</Text>
          <View style={[styles.cardGroup, isDarkMode && styles.darkCard, { borderColor: isDarkMode ? '#451a1a' : '#fee2e2' }]}>
            <TouchableOpacity
              style={styles.settingRowBtn}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
            >
              <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#451a1a' : '#fef2f2' }]}>
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <UserX size={20} color="#dc2626" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: '#dc2626', fontWeight: '700' }]}>
                  {isDeleting ? 'Deleting Account...' : 'Delete Account'}
                </Text>
                <Text style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 1 }}>
                  Permanently remove your account and all data
                </Text>
              </View>
              <ChevronRight size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.signOutBtn, isDarkMode && styles.darkSignOutBtn]}
            activeOpacity={0.8}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="#dc2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  darkContainer: {
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 20,
  },
  darkText: {
    color: '#ffffff',
  },
  darkSubtext: {
    color: '#94a3b8',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
    gap: 14,
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  darkCard: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  avatarWrap: { position: 'relative' },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  profileRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  settingRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  darkDivider: {
    backgroundColor: '#334155',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 20,
    paddingVertical: 16,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  darkSignOutBtn: {
    backgroundColor: '#450a0a',
    borderColor: '#7f1d1d',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#dc2626',
  },
});
