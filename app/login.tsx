import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Animated, Modal, Image, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Mail, Lock, User, Phone, Eye, EyeOff,
  CheckCircle2, Clock, ShieldCheck, PartyPopper,
  KeyRound, X, ArrowLeft, AlertCircle, RefreshCw,
} from 'lucide-react-native';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type ApprovalState = 'idle' | 'pending' | 'approved' | 'registered';
type ForgotStep = 'email' | 'otp' | 'new_password' | 'success';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [group, setGroup] = useState('Group 1');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'student' | 'rep'>('student');
  const [approvalState, setApprovalState] = useState<ApprovalState>('idle');
  const [authLoading, setAuthLoading] = useState(false);

  // Forgot Password State
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Animation values for the approval modal
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  const { isAuthenticated } = useAuth();

  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
    setStudentId('');
    setGroup('Group 1');
    setShowPassword(false);
  };

  // Resend OTP Countdown Timer
  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError(null);
    setForgotStep('email');
    setForgotModalVisible(true);
  };

  const handleSendResetCode = async () => {
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      setResetError('Please enter your email address');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        setResetError(error.message);
      } else {
        setForgotStep('otp');
        setResendCountdown(60);
      }
    } catch (err: any) {
      setResetError(err.message || 'An error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmedOtp = resetOtp.trim();
    if (!trimmedOtp || trimmedOtp.length < 6) {
      setResetError('Please enter the verification code sent to your email');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: resetEmail.trim(),
        token: trimmedOtp,
        type: 'recovery',
      });
      if (error) {
        setResetError(error.message || 'Invalid or expired code. Please try again.');
      } else {
        setForgotStep('new_password');
      }
    } catch (err: any) {
      setResetError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setResetError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setResetError(error.message);
      } else {
        setForgotStep('success');
      }
    } catch (err: any) {
      setResetError(err.message || 'Failed to update password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(
        'Supabase Not Configured',
        'Your .env file contains placeholder credentials.\n\nPlease add your actual Supabase URL and Anon Key in .env and restart Expo with:\n\nnpx expo start -c'
      );
      return;
    }

    setAuthLoading(true);
    try {
      if (!isLogin) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              student_id: studentId,
              phone_number: phone,
              role,
              group,
              year_level: 'Level 300',
            },
          },
        });
        setAuthLoading(false);
        
        if (error) {
          Alert.alert('Sign Up Error', error.message);
          return;
        }

        if (role === 'rep') {
          setApprovalState('pending');
        } else {
          setApprovalState('registered');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        setAuthLoading(false);
        
        if (error) {
          Alert.alert('Sign In Error', error.message);
          return;
        }
        
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setAuthLoading(false);
      Alert.alert('Authentication Error', err.message || 'Network request failed. Please check your internet connection.');
    }
  };

  // Drive the approval animation sequence
  useEffect(() => {
    if (approvalState === 'pending') {
      // Fade in the modal
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();

      // After 2.5s → switch to "Approved"
      const timer = setTimeout(() => {
        setApprovalState('approved');
        Animated.spring(checkScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      }, 2500);

      return () => clearTimeout(timer);
    }

    if (approvalState === 'approved') {
      // After 2s showing approved → fade out and go to Login tab with Rep role selected
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setApprovalState('idle');
          fadeAnim.setValue(0);
          scaleAnim.setValue(0.8);
          checkScale.setValue(0);
          setRole('rep');
          switchTab(true);
        });
      }, 2000);

      return () => clearTimeout(timer);
    }

    if (approvalState === 'registered') {
      // Fade in modal
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      ]).start();

      // Bounce the icon
      Animated.spring(checkScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

      // After 2.5s → fade out and switch to Login with Student role selected
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setApprovalState('idle');
          fadeAnim.setValue(0);
          scaleAnim.setValue(0.8);
          checkScale.setValue(0);
          setRole('student');
          switchTab(true);
        });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [approvalState]);

  return (
    <View style={styles.root}>
      {/* Background glow blobs */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

          {/* ── LOGO + HEADER ── */}
          <View style={styles.topSection}>
            <View style={styles.logoWrap}>
              <View style={styles.logoGlow} />
              <View style={styles.logo}>
                <Image
                  source={require('../assets/App_Logo.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
            </View>
            <Text style={styles.appName}>LECTA</Text>
            <Text style={styles.headline}>
              {isLogin ? 'Welcome back!' : 'Create account'}
            </Text>
            <Text style={styles.subtext}>
              {isLogin ? 'Sign in to your classroom' : 'Join your classroom today'}
            </Text>
          </View>

          {/* ── FORM CARD ── */}
          <View style={styles.card}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              {/* Login / Register Toggle */}
              <View style={styles.toggle}>
                <TouchableOpacity
                  onPress={() => switchTab(true)}
                  style={[styles.toggleBtn, isLogin && styles.toggleBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => switchTab(false)}
                  style={[styles.toggleBtn, !isLogin && styles.toggleBtnActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Register</Text>
                </TouchableOpacity>
              </View>
              {/* Full Name — register only */}
              {!isLogin && (
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Full Name</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color="#6b83a8" />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#9db1cc"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                </View>
              )}

              {/* Email */}
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputRow}>
                  <Mail size={18} color="#6b83a8" />
                  <TextInput
                    style={styles.input}
                    placeholder="username@gmail.com"
                    placeholderTextColor="#9db1cc"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.inputWrap}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputRow}>
                  <Lock size={18} color="#6b83a8" />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="#9db1cc"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword
                      ? <EyeOff size={18} color="#6b83a8" />
                      : <Eye size={18} color="#6b83a8" />
                    }
                  </TouchableOpacity>
                </View>
              </View>

              {/* Phone — register only */}
              {!isLogin && (
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputRow}>
                    <Phone size={18} color="#6b83a8" />
                    <TextInput
                      style={styles.input}
                      placeholder="+233 55 533 1234"
                      placeholderTextColor="#9db1cc"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>
              )}

              {/* Student ID — register only */}
              {!isLogin && (
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Student ID</Text>
                  <View style={styles.inputRow}>
                    <User size={18} color="#6b83a8" />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. FCP/CS/22/089"
                      placeholderTextColor="#9db1cc"
                      value={studentId}
                      onChangeText={setStudentId}
                    />
                  </View>
                </View>
              )}

              {/* Group Selection — register only */}
              {!isLogin && (
                <View style={styles.inputWrap}>
                  <Text style={styles.label}>Class Group</Text>
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                    <TouchableOpacity
                      style={[
                        styles.groupOption,
                        group === 'Group 1' && styles.groupOptionActive
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setGroup('Group 1')}
                    >
                      <Text style={[
                        styles.groupOptionText,
                        group === 'Group 1' && styles.groupOptionTextActive
                      ]}>Group 1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.groupOption,
                        group === 'Group 2' && styles.groupOptionActive
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setGroup('Group 2')}
                    >
                      <Text style={[
                        styles.groupOptionText,
                        group === 'Group 2' && styles.groupOptionTextActive
                      ]}>Group 2</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}



              {/* Forgot password — login only */}
              {isLogin && (
                <TouchableOpacity
                  style={{ alignSelf: 'flex-end', marginBottom: 24 }}
                  onPress={openForgotPassword}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {/* Submit */}
              <TouchableOpacity 
                style={[styles.submitBtn, authLoading && { opacity: 0.7 }]} 
                activeOpacity={0.85} 
                onPress={handleAuth}
                disabled={authLoading}
              >
                <Text style={styles.submitText}>
                  {authLoading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                </Text>
              </TouchableOpacity>

            </ScrollView>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── COURSE REP APPROVAL MODAL ── */}
      <Modal visible={approvalState !== 'idle'} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.approvalCard,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            {approvalState === 'pending' ? (
              <>
                <View style={styles.approvalIconWrap}>
                  <Clock size={44} color="#f59e0b" strokeWidth={1.8} />
                </View>
                <Text style={styles.approvalTitle}>Awaiting Approval</Text>
                <Text style={styles.approvalSub}>
                  Your Course Rep account request has been submitted and is pending admin review.
                </Text>
                <View style={styles.dotRow}>
                  <PulsingDot delay={0} />
                  <PulsingDot delay={200} />
                  <PulsingDot delay={400} />
                </View>
              </>
            ) : approvalState === 'approved' ? (
              <>
                <Animated.View
                  style={[styles.approvalIconWrap, { transform: [{ scale: checkScale }] }]}
                >
                  <CheckCircle2 size={50} color="#10b981" strokeWidth={1.8} />
                </Animated.View>
                <Text style={[styles.approvalTitle, { color: '#10b981' }]}>Approved! 🎉</Text>
                <Text style={styles.approvalSub}>
                  Your Course Rep account has been verified. You can now log in with your credentials.
                </Text>
                <View style={styles.approvedBadge}>
                  <ShieldCheck size={14} color="#ffffff" />
                  <Text style={styles.approvedBadgeText}>Course Representative Verified</Text>
                </View>
              </>
            ) : (
              /* ── STUDENT REGISTERED ── */
              <>
                <Animated.View
                  style={[styles.approvalIconWrap, styles.registeredIconWrap, { transform: [{ scale: checkScale }] }]}
                >
                  <PartyPopper size={46} color="#6366f1" strokeWidth={1.8} />
                </Animated.View>
                <Text style={[styles.approvalTitle, { color: '#4f46e5' }]}>
                  You're Registered! 🎊
                </Text>
                <Text style={styles.approvalSub}>
                  Your account has been created successfully. You'll be taken to the login page in a moment.
                </Text>
                <View style={styles.registeredBadge}>
                  <CheckCircle2 size={14} color="#ffffff" />
                  <Text style={styles.approvedBadgeText}>Account Created Successfully</Text>
                </View>
                <Text style={styles.redirectHint}>Redirecting to login…</Text>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ── FORGOT PASSWORD MODAL (3-STEP RECOVERY) ── */}
      <Modal visible={forgotModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.forgotCard}>
            {/* Header / Nav */}
            <View style={styles.forgotHeader}>
              {forgotStep !== 'email' && forgotStep !== 'success' ? (
                <TouchableOpacity
                  onPress={() => {
                    setResetError(null);
                    if (forgotStep === 'otp') setForgotStep('email');
                    if (forgotStep === 'new_password') setForgotStep('otp');
                  }}
                  style={styles.modalNavBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ArrowLeft size={20} color="#64748b" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 32 }} />
              )}

              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {forgotStep === 'email'
                    ? 'Step 1 of 3'
                    : forgotStep === 'otp'
                    ? 'Step 2 of 3'
                    : forgotStep === 'new_password'
                    ? 'Step 3 of 3'
                    : 'Completed'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setForgotModalVisible(false)}
                style={styles.modalNavBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {resetError && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.errorBannerText}>{resetError}</Text>
              </View>
            )}

            {/* STEP 1: Enter Email */}
            {forgotStep === 'email' && (
              <View style={{ width: '100%' }}>
                <View style={styles.stepIconWrap}>
                  <KeyRound size={28} color="#2563eb" />
                </View>
                <Text style={styles.forgotTitle}>Forgot Password?</Text>
                <Text style={styles.forgotSubtitle}>
                  Enter the email associated with your account and we'll send you a 6-digit recovery code.
                </Text>

                <View style={[styles.inputRow, { marginTop: 12, marginBottom: 20 }]}>
                  <Mail size={18} color="#6b83a8" />
                  <TextInput
                    style={styles.input}
                    placeholder="name@gmail.com"
                    placeholderTextColor="#9db1cc"
                    value={resetEmail}
                    onChangeText={(txt) => {
                      setResetEmail(txt);
                      setResetError(null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, resetLoading && { opacity: 0.7 }]}
                  onPress={handleSendResetCode}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  {resetLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitText}>Send Reset Code</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: Enter OTP */}
            {forgotStep === 'otp' && (
              <View style={{ width: '100%' }}>
                <View style={[styles.stepIconWrap, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Mail size={28} color="#2563eb" />
                </View>
                <Text style={styles.forgotTitle}>Enter Recovery Code</Text>
                <Text style={styles.forgotSubtitle}>
                  We sent a verification code to <Text style={{ fontWeight: '700', color: '#1e293b' }}>{resetEmail}</Text>. Enter the code below:
                </Text>

                <View style={[styles.inputRow, styles.otpInputRow, { marginTop: 16, marginBottom: 16 }]}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="••••••••"
                    placeholderTextColor="#9db1cc"
                    value={resetOtp}
                    onChangeText={(txt) => {
                      setResetOtp(txt.replace(/[^0-9]/g, '').slice(0, 8));
                      setResetError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, resetLoading && { opacity: 0.7 }]}
                  onPress={handleVerifyOtp}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  {resetLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitText}>Verify Code</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  {resendCountdown > 0 ? (
                    <Text style={styles.resendCountdownText}>Resend in {resendCountdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleSendResetCode} disabled={resetLoading}>
                      <Text style={styles.resendBtnText}>Resend Code</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* STEP 3: Create New Password */}
            {forgotStep === 'new_password' && (
              <View style={{ width: '100%' }}>
                <View style={[styles.stepIconWrap, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                  <Lock size={28} color="#2563eb" />
                </View>
                <Text style={styles.forgotTitle}>New Password</Text>
                <Text style={styles.forgotSubtitle}>
                  Create a strong password that is at least 6 characters long.
                </Text>

                <View style={[styles.inputRow, { marginTop: 14, marginBottom: 12 }]}>
                  <Lock size={18} color="#6b83a8" />
                  <TextInput
                    style={styles.input}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor="#9db1cc"
                    value={newPassword}
                    onChangeText={(txt) => {
                      setNewPassword(txt);
                      setResetError(null);
                    }}
                    secureTextEntry={!showNewPassword}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 4 }}>
                    {showNewPassword ? <EyeOff size={18} color="#6b83a8" /> : <Eye size={18} color="#6b83a8" />}
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputRow, { marginBottom: 20 }]}>
                  <Lock size={18} color="#6b83a8" />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor="#9db1cc"
                    value={confirmPassword}
                    onChangeText={(txt) => {
                      setConfirmPassword(txt);
                      setResetError(null);
                    }}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 4 }}>
                    {showConfirmPassword ? <EyeOff size={18} color="#6b83a8" /> : <Eye size={18} color="#6b83a8" />}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, resetLoading && { opacity: 0.7 }]}
                  onPress={handleUpdatePassword}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                >
                  {resetLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitText}>Save New Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: Success */}
            {forgotStep === 'success' && (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <View style={[styles.stepIconWrap, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <CheckCircle2 size={36} color="#16a34a" strokeWidth={2} />
                </View>
                <Text style={[styles.forgotTitle, { color: '#16a34a' }]}>Password Reset!</Text>
                <Text style={styles.forgotSubtitle}>
                  Your password has been successfully updated. You can now log in with your new credentials.
                </Text>

                <TouchableOpacity
                  style={[styles.submitBtn, { width: '100%', marginTop: 8 }]}
                  onPress={() => {
                    setForgotModalVisible(false);
                    setEmail(resetEmail);
                    setPassword('');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Small pulsing dot component for the pending animation
function PulsingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={[styles.dot, { opacity: anim }]} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a1628' },

  glowTop: {
    position: 'absolute', top: -60, left: '20%',
    width: 250, height: 220, borderRadius: 120,
    backgroundColor: '#0a1628', opacity: 0.25,
  },
  glowBottom: {
    position: 'absolute', bottom: 100, right: -40,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#7c3aed', opacity: 0.15,
  },

  topSection: { alignItems: 'center', paddingTop: 0, paddingBottom: 32 },
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoGlow: { position: 'absolute', backgroundColor: '#3b82f6', opacity: 0.35 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    backgroundColor: '#1d4ed8',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  appName: { fontSize: 17, fontWeight: '700', color: '#60a5fa', letterSpacing: 3, marginBottom: 5 },
  headline: { fontSize: 30, fontWeight: '800', color: '#ffffff', marginBottom: 15, marginTop: 15 },
  subtext: { fontSize: 14, color: '#7fa0c0', fontWeight: '500' },

  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },

  toggle: {
    flexDirection: 'row', backgroundColor: '#f0f4ff',
    borderRadius: 999, padding: 5, marginBottom: 24,
  },
  toggleBtn: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: 'center' },
  toggleBtnActive: {
    backgroundColor: '#1d4ed8',
    shadowColor: '#1d4ed8', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  toggleText: { fontWeight: '700', fontSize: 15, color: '#94a3b8' },
  toggleTextActive: { color: '#ffffff' },

  inputWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginLeft: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8faff',
    borderWidth: 1.5, borderColor: '#dde5f0',
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 15,
    minHeight: 56,
  },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: '#0f172a', height: 24 },

  forgotText: { color: '#1d4ed8', fontWeight: '700', fontSize: 14 },

  submitBtn: {
    backgroundColor: '#1d4ed8',
    borderRadius: 999, paddingVertical: 18,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  submitText: { color: '#ffffff', fontWeight: '800', fontSize: 17, letterSpacing: 0.5 },

  // Approval Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  approvalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  approvalIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  groupOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  groupOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  groupOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  groupOptionTextActive: {
    color: '#2563eb',
  },
  approvalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  approvalSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  dotRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#f59e0b',
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  approvedBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  registeredIconWrap: {
    backgroundColor: '#f0f0ff',
    borderColor: '#c7d2fe',
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  redirectHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  /* Forgot Password Modal Styles */
  forgotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  forgotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  modalNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  stepBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  stepBadgeText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  stepIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  forgotTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  forgotSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  otpInputRow: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    backgroundColor: '#f8fafc',
  },
  otpInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 6,
    color: '#1d4ed8',
    textAlign: 'center',
    width: '100%',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 13,
    color: '#64748b',
  },
  resendCountdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
