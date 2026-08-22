import React, { useState, useEffect } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Camera, User, Mail, Phone, BookOpen, GraduationCap, Save, Lock } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function EditProfileScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (!error && data) {
      setFullName(data.full_name || '');
      setEmail(data.email || user?.email || '');
      setPhone(data.phone_number || '');
      setDepartment(data.department || '');
      setYearLevel(data.year_level || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || null);
    }
    setLoading(false);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to update your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);

      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${user!.id}/avatar_${Date.now()}.${ext}`;

      let imageData: any;

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        imageData = await response.blob();
      } else {
        // Read file as Base64 on Android & iOS
        const base64 = await LegacyFS.readAsStringAsync(asset.uri, {
          encoding: LegacyFS.EncodingType.Base64,
        });
        // Decode to ArrayBuffer for Supabase Storage
        imageData = decode(base64);
      }

      const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, imageData, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(publicUrl);

      // Save avatar_url immediately to the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user!.id);

      if (profileError) {
        throw profileError;
      }

      Alert.alert('Photo Updated ✓', 'Your profile picture has been updated.');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload photo. Please check your storage connection.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase.from('profiles').update({
      phone_number: phone.trim() || null,
      year_level: yearLevel.trim() || null,
      bio: bio.trim() || null,
    }).eq('id', user.id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Profile Updated ✓', 'Your changes have been saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Manage your personal information</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={'#ffffff'} />
          ) : (
            <Save size={15} color={'#ffffff'} />
          )}
          <Text style={[styles.saveBtnText, { color: '#ffffff' }]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.cameraBtn}
                activeOpacity={0.8}
                onPress={handlePickImage}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Camera size={16} color="#ffffff" />
                }
              </TouchableOpacity>
            </View>
            <Text style={[styles.changePhotoHint, { color: colors.textSecondary }]}>
              {uploadingAvatar ? 'Uploading...' : 'Tap camera icon to update photo'}
            </Text>
          </View>

          {/* Full Name — Locked */}
          <View style={styles.fieldLabelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
            <Text style={[styles.lockTagText, { color: colors.textMuted }]}>Portal Managed</Text>
          </View>
          <View style={[styles.inputRow, styles.disabledInputRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder }]}>
            <User size={18} color={colors.textMuted} />
            <TextInput style={[styles.input, { color: colors.textMuted }]} value={fullName} editable={false} />
            <Lock size={15} color={colors.textMuted} />
          </View>

          {/* Email — Locked */}
          <View style={[styles.fieldLabelRow, { marginTop: 16 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Institutional Email</Text>
            <Text style={[styles.lockTagText, { color: colors.textMuted }]}>Portal Managed</Text>
          </View>
          <View style={[styles.inputRow, styles.disabledInputRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder }]}>
            <Mail size={18} color={colors.textMuted} />
            <TextInput style={[styles.input, { color: colors.textMuted }]} value={email} editable={false} />
            <Lock size={15} color={colors.textMuted} />
          </View>

          {/* Department — Locked */}
          <View style={[styles.fieldLabelRow, { marginTop: 16 }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Department</Text>
            <Text style={[styles.lockTagText, { color: colors.textMuted }]}>Portal Managed</Text>
          </View>
          <View style={[styles.inputRow, styles.disabledInputRow, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: colors.cardBorder }]}>
            <BookOpen size={18} color={colors.textMuted} />
            <TextInput style={[styles.input, { color: colors.textMuted }]} value={department} editable={false} />
            <Lock size={15} color={colors.textMuted} />
          </View>

          {/* Phone — Editable */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Phone Number</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Phone size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +233 24 123 4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Year of Study — Editable */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Year of Study</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <GraduationCap size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={yearLevel}
              onChangeText={setYearLevel}
              placeholder="e.g. Level 300"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Short Bio — Editable */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Short Bio / Status</Text>
          <View style={[styles.inputRow, styles.bioWrap, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <TextInput
              style={[styles.bioInput, { color: colors.text }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Write a brief status or bio…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveBottomBtn,
              { backgroundColor: colors.primary, shadowColor: colors.primary },
              saving && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={'#ffffff'} />
            ) : (
              <Save size={18} color={'#ffffff'} />
            )}
            <Text style={[styles.saveBottomText, { color: '#ffffff' }]}>
              {saving ? 'Saving...' : 'Save Changes'}
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

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    minWidth: 70,
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#ffffff' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changePhotoHint: { fontSize: 12, fontWeight: '500', marginTop: 8 },

  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockTagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  disabledInputRow: { opacity: 0.8 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },

  bioWrap: { minHeight: 90, alignItems: 'flex-start' },
  bioInput: { flex: 1, fontSize: 15, lineHeight: 22, padding: 0, minHeight: 70 },

  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    marginTop: 28,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  saveBottomText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});

