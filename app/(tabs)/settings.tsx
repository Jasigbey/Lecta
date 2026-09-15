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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { deleteUserAccount } from '../../lib/account';

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

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleOpenDeleteModal = () => {
    if (!user) return;
    setConfirmText('');
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!user) return;

    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm.');
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError(null);

      const result = await deleteUserAccount(user.id);

      if (!result.success) {
        setIsDeleting(false);
        setDeleteError(result.error || 'Could not delete account. Please try again.');
        return;
      }

      setShowDeleteModal(false);
      setIsDeleting(false);

      await logout();
      router.replace('/login');

      Alert.alert(
        'Account Deleted',
        result.message || 'Your account and all associated data have been permanently removed.'
      );
    } catch (err: any) {
      setIsDeleting(false);
      console.error('Delete account error:', err);
      setDeleteError(err.message || 'Could not delete account. Please try again.');
    }
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
              onPress={handleOpenDeleteModal}
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

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setShowDeleteModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, isDarkMode && styles.darkModalCard]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBadge}>
                  <Trash2 size={20} color="#dc2626" />
                </View>
                <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Delete Account</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isDeleting) setShowDeleteModal(false);
                }}
                disabled={isDeleting}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={isDarkMode ? '#94a3b8' : '#64748b'} />
              </TouchableOpacity>
            </View>

            {/* Warning Content */}
            <View style={[styles.modalWarningBox, isDarkMode && styles.darkModalWarningBox]}>
              <AlertTriangle size={18} color="#dc2626" style={{ marginTop: 2 }} />
              <Text style={[styles.modalWarningText, isDarkMode && styles.darkWarningText]}>
                This action is permanent and cannot be undone. All of your data will be permanently wiped:
              </Text>
            </View>

            <View style={styles.bulletList}>
              <Text style={[styles.bulletItem, isDarkMode && styles.darkBulletItem]}>• Profile and personal account information</Text>
              <Text style={[styles.bulletItem, isDarkMode && styles.darkBulletItem]}>• All chat messages and conversations</Text>
              <Text style={[styles.bulletItem, isDarkMode && styles.darkBulletItem]}>• Saved calendar events and daily study tasks</Text>
              <Text style={[styles.bulletItem, isDarkMode && styles.darkBulletItem]}>• Notifications and local preferences</Text>
            </View>

            {/* Confirmation Input */}
            <Text style={[styles.inputLabel, isDarkMode && styles.darkText]}>
              Type <Text style={{ fontWeight: '800', color: '#dc2626' }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={[
                styles.confirmInput,
                isDarkMode && styles.darkConfirmInput,
                confirmText.trim().toUpperCase() === 'DELETE' && styles.confirmInputValid,
              ]}
              value={confirmText}
              onChangeText={(val) => {
                setConfirmText(val);
                if (deleteError) setDeleteError(null);
              }}
              placeholder="DELETE"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
            />

            {deleteError && (
              <View style={styles.errorContainer}>
                <AlertCircle size={15} color="#dc2626" />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, isDarkMode && styles.darkCancelBtn]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.modalCancelText, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  (confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting) && styles.modalDeleteBtnDisabled,
                ]}
                onPress={handleConfirmDelete}
                disabled={confirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
              >
                {isDeleting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.modalDeleteText}>Deleting...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalDeleteText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen Loading Overlay during Deletion */}
      {isDeleting && (
        <View style={styles.fullscreenLoading}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.fullscreenLoadingText}>Permanently deleting account...</Text>
          <Text style={styles.fullscreenLoadingSubtext}>Wiping database records and signing out</Text>
        </View>
      )}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  darkModalCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 14,
  },
  darkModalWarningBox: {
    backgroundColor: '#450a0a',
    borderColor: '#7f1d1d',
  },
  modalWarningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#991b1b',
    fontWeight: '500',
  },
  darkWarningText: {
    color: '#fca5a5',
  },
  bulletList: {
    marginBottom: 16,
    paddingLeft: 4,
    gap: 6,
  },
  bulletItem: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 17,
  },
  darkBulletItem: {
    color: '#94a3b8',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    letterSpacing: 2,
  },
  darkConfirmInput: {
    borderColor: '#475569',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
  },
  confirmInputValid: {
    borderColor: '#dc2626',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCancelBtn: {
    backgroundColor: '#334155',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modalDeleteBtn: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  fullscreenLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    paddingHorizontal: 30,
  },
  fullscreenLoadingText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
  },
  fullscreenLoadingSubtext: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 6,
    textAlign: 'center',
  },
});
