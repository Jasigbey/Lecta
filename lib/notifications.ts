import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { safeStorage } from './storage';

/**
 * Check if the user has enabled notifications in Settings.
 */
export async function areNotificationsEnabled(userId?: string): Promise<boolean> {
  try {
    let uid = userId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id;
    }
    const notifKey = `@lecta_notifications_enabled_${uid || 'guest'}`;
    const stored = await safeStorage.getItem(notifKey);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

// 1. Configure foreground notification behavior (Respects Settings toggle)
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const isEnabled = await areNotificationsEnabled();
    return {
      shouldShowAlert: isEnabled,
      shouldShowBanner: isEnabled,
      shouldShowList: isEnabled,
      shouldPlaySound: isEnabled,
      shouldSetBadge: isEnabled,
      shouldPresentAlert: isEnabled,
    };
  },
});

/**
 * Request OS notification permissions and configure notification channels for Android.
 * Returns the Expo Push Token string if successful.
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    // 1. Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 2. If not granted, request permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // 3. Android High-Importance Notification Channels
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lecta-default', {
        name: 'Lecta Alerts & Notices',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('lecta-urgent', {
        name: 'Urgent Announcements',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#ef4444',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // 4. Retrieve Expo Push Token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      if (pushToken && userId) {
        await safeStorage.setItem(`@lecta_push_token_${userId}`, pushToken);

        await supabase
          .from('profiles')
          .update({ push_token: pushToken })
          .eq('id', userId);
      }

      return pushToken;
    } catch (tokenErr) {
      console.log('Could not get push token (simulator or EAS config required for remote push):', tokenErr);
      return null;
    }
  } catch (err) {
    console.error('Error during push notification registration:', err);
    return null;
  }
}

/**
 * Trigger an immediate pop-up notification banner on the device.
 */
export async function sendInstantNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId: string = 'lecta-default'
) {
  if (Platform.OS === 'web') return;

  const isEnabled = await areNotificationsEnabled();
  if (!isEnabled) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#2563eb',
        badge: 1,
      },
      trigger: null,
    });
  } catch (err) {
    console.error('Error scheduling instant notification:', err);
  }
}

/**
 * Schedule a local notification after a given number of seconds.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  secondsFromNow: number,
  data?: Record<string, any>,
  channelId: string = 'lecta-default'
) {
  if (Platform.OS === 'web' || secondsFromNow <= 0) return;

  const isEnabled = await areNotificationsEnabled();
  if (!isEnabled) return;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#2563eb',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
      },
    });

    return id;
  } catch (err) {
    console.error('Error scheduling local notification:', err);
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllScheduledNotifications() {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.error('Error canceling notifications:', e);
  }
}
