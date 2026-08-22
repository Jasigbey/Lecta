import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  User,
  Mail,
  BookOpen,
  GraduationCap,
  Phone,
  ShieldCheck,
  Edit3,
  Hash,
  Users,
  Quote,
  Lock,
  ChevronRight,
  KeyRound,
  Eye,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  student_id: string;
  department: string;
  year_level: string;
  role: 'student' | 'rep' | 'lecturer';
  phone_number?: string;
  avatar_url?: string;
  bio?: string;
}

export default function ProfileScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Re-fetch when returning from edit-profile
  useFocusEffect(
    useCallback(() => {
      if (user) fetchProfile();
    }, [user])
  );

  const fetchProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  // Generate initials from full name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Role display label
  const getRoleLabel = (role: string) => {
    if (role === 'rep') return 'Course Representative';
    if (role === 'lecturer') return 'Lecturer';
    return 'Student';
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {profile?.role === 'rep' ? 'Rep Profile' : 'Student Profile'}
          </Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Verified University ID</Text>
        </View>

        <TouchableOpacity
          style={styles.editHeaderBtn}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.8}
        >
          <Edit3 size={15} color="#ffffff" />
          <Text style={styles.editHeaderBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >

        {/* Profile Card Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile?.full_name ? getInitials(profile.full_name) : '??'}
                </Text>
              </View>
            )}
            <View style={[styles.verifiedBadge, { backgroundColor: profile?.role === 'rep' ? '#2563eb' : '#16a34a' }]}>
              {profile?.role === 'rep'
                ? <ShieldCheck size={14} color="#ffffff" />
                : <ShieldCheck size={14} color="#ffffff" />
              }
            </View>
          </View>

          <Text style={[styles.profileName, { color: colors.text }]}>
            {profile?.full_name || 'Unknown User'}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {profile?.email || user?.email || '—'}
          </Text>

          <View style={[styles.roleTag, profile?.role === 'rep' && styles.roleTagRep]}>
            <Text style={[styles.roleTagText, profile?.role === 'rep' && styles.roleTagTextRep]}>
              {profile?.department || 'Computer Science'} • {getRoleLabel(profile?.role || 'student')}
            </Text>
          </View>

          {profile?.bio ? (
            <View style={[styles.heroBioBox, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: colors.cardBorder }]}>
              <Quote size={12} color="#2563eb" style={{ marginRight: 6 }} />
              <Text style={[styles.heroBioText, { color: colors.textSecondary }]} numberOfLines={3}>
                {profile.bio}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Non-Editable Credentials Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>ACADEMIC CREDENTIALS</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>

          {/* Student Name */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}>
              <User size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>FULL NAME</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.full_name || '—'}
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>Fixed</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Email Address */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#064e3b' : '#f0fdf4' }]}>
              <Mail size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>INSTITUTIONAL EMAIL</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.email || user?.email || '—'}
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>Fixed</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Student ID */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#312e81' : '#eef2ff' }]}>
              <Hash size={18} color="#4f46e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>STUDENT ID NUMBER</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.student_id || '—'}
              </Text>
            </View>
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeText}>Fixed</Text>
            </View>
          </View>
        </View>

        {/* Academic Details Section */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>PROGRAM & CONTACT</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Department */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#7c2d12' : '#fff7ed' }]}>
              <BookOpen size={18} color="#ea580c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>DEPARTMENT</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.department || '—'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Level / Year */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]}>
              <GraduationCap size={18} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>LEVEL / YEAR</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.year_level || '—'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Role */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}>
              <Users size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>ROLE</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {getRoleLabel(profile?.role || 'student')}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          {/* Contact Phone */}
          <View style={styles.infoRow}>
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#1a2e22' : '#f0fdf4' }]}>
              <Phone size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>PHONE NUMBER</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {profile?.phone_number || 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account & Security Shortcuts */}
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>ACCOUNT & SECURITY</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/change-password')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#3b1c1c' : '#fef2f2' }]}>
              <KeyRound size={18} color="#ef4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Change Password</Text>
              <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Update your account security password</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/privacy-settings')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBg, { backgroundColor: isDarkMode ? '#312e81' : '#eef2ff' }]}>
              <Eye size={18} color="#4f46e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.text }]}>Privacy & Permissions</Text>
              <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Manage read receipts, status & DMs</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Edit Profile Action Button */}
        <TouchableOpacity
          style={[styles.editBottomBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.85}
        >
          <Edit3 size={18} color={'#ffffff'} />
          <Text style={[styles.editBottomText, { color: '#ffffff' }]}>Edit Profile Details</Text>
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

  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  editHeaderBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  heroCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#ffffff' },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  profileName: { fontSize: 22, fontWeight: '800', marginBottom: 3 },
  profileEmail: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  roleTag: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  roleTagRep: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e40af',
  },
  roleTagText: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  roleTagTextRep: { color: '#bfdbfe' },

  heroBioBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '100%',
  },
  heroBioText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    flex: 1,
  },

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

  infoRow: {
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
  infoLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: '700' },

  lockBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockBadgeText: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSub: {
    fontSize: 12,
    marginTop: 1,
  },

  editBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    marginTop: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  editBottomText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});

