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
import { ChevronLeft, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function ChangePasswordScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Requirements checks
  const hasMinLength = newPassword.length >= 8;
  const hasNumber    = /\d/.test(newPassword);
  const hasSpecial   = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isMatching   = newPassword.length > 0 && newPassword === confirmPassword;

  const isValid = currentPassword.length > 0 && hasMinLength && hasNumber && isMatching;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) {
      Alert.alert('Validation Error', 'Please ensure all password requirements and field matches are satisfied.');
      return;
    }

    if (!user?.email) {
      Alert.alert('Error', 'You must be logged in to change your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Verify current password by re-authenticating with Supabase
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setIsSubmitting(false);
        Alert.alert('Incorrect Password', 'Your current password is incorrect. Please check and try again.');
        return;
      }

      // 2. Update user's password on Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      setIsSubmitting(false);

      if (updateError) {
        Alert.alert('Update Failed', updateError.message);
        return;
      }

      Alert.alert('Password Changed! 🎉', 'Your password has been updated successfully. Please use your new password next time you log in.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      setIsSubmitting(false);
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Change Password</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Update your account security</Text>
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

          {/* Banner Card */}
          <View style={[styles.bannerCard, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff', borderColor: isDarkMode ? '#334155' : '#bfdbfe' }]}>
            <ShieldCheck size={28} color="#2563eb" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>Secure Your Account</Text>
              <Text style={[styles.bannerSub, { color: colors.textSecondary }]}>Choose a strong password with at least 8 characters including numbers and symbols.</Text>
            </View>
          </View>

          {/* Current Password */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Current Password</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Lock size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showCurrent}
            />
            <TouchableOpacity onPress={() => setShowCurrent((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {showCurrent ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>New Password</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Lock size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showNew}
            />
            <TouchableOpacity onPress={() => setShowNew((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {showNew ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* Confirm New Password */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Confirm New Password</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: isMatching ? '#10b981' : colors.cardBorder }]}>
            <Lock size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {showConfirm ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* Requirements Checklist */}
          <View style={[styles.checklistCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.checklistTitle, { color: colors.textMuted }]}>PASSWORD REQUIREMENTS</Text>

            <View style={styles.checkItem}>
              {hasMinLength ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color={colors.textMuted} />}
              <Text style={[styles.checkText, { color: hasMinLength ? colors.text : colors.textMuted }]}>At least 8 characters long</Text>
            </View>

            <View style={styles.checkItem}>
              {hasNumber ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color={colors.textMuted} />}
              <Text style={[styles.checkText, { color: hasNumber ? colors.text : colors.textMuted }]}>Contains at least one number (0-9)</Text>
            </View>

            <View style={styles.checkItem}>
              {hasSpecial ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color={colors.textMuted} />}
              <Text style={[styles.checkText, { color: hasSpecial ? colors.text : colors.textMuted }]}>Contains special symbol (optional/recommended)</Text>
            </View>

            <View style={styles.checkItem}>
              {isMatching ? <CheckCircle2 size={16} color="#10b981" /> : <AlertCircle size={16} color={colors.textMuted} />}
              <Text style={[styles.checkText, { color: isMatching ? colors.text : colors.textMuted }]}>New passwords match</Text>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, (!isValid || isSubmitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>Update Password</Text>
            )}
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

  content: { paddingHorizontal: 20, paddingTop: 20 },

  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 20,
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  bannerSub: { fontSize: 12, lineHeight: 17 },

  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },

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

  checklistCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 24,
    gap: 10,
  },
  checklistTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkText: { fontSize: 13, fontWeight: '500' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94a3b8' },
  submitText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});
