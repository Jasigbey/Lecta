import '../global.css';
import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { registerForPushNotificationsAsync } from '../lib/notifications';

function NotificationObserver() {
  const { user } = useAuth();

  useEffect(() => {
    // Request permission & setup Android notification channel
    registerForPushNotificationsAsync(user?.id);

    // Handle user tapping on a native system notification banner
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.targetRoute) {
        router.push(data.targetRoute as any);
      } else {
        router.push('/notifications');
      }
    });

    return () => {
      responseSubscription.remove();
    };
  }, [user]);

  return null;
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationObserver />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="ai-helper" options={{ headerShown: false }} />
            <Stack.Screen name="chat-detail" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="documents" options={{ headerShown: false }} />
            <Stack.Screen name="announcements" options={{ headerShown: false }} />
            <Stack.Screen name="create-announcement" options={{ headerShown: false }} />
            <Stack.Screen name="upload-material" options={{ headerShown: false }} />
            <Stack.Screen name="edit-timetable" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
            <Stack.Screen name="help-feedback" options={{ headerShown: false }} />
            <Stack.Screen name="daily-focus" options={{ headerShown: false }} />
            <Stack.Screen name="create-group" options={{ headerShown: false }} />
            <Stack.Screen name="new-chat" options={{ headerShown: false }} />
            <Stack.Screen name="archived-chats" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
