import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Bell,
  Clock,
  FileText,
  BookOpen,
  Sparkles,
  Award,
  CheckCheck,
  Trash2,
  Calendar,
  ChevronRight,
  Inbox,
  AlertTriangle,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeStorage } from '../lib/storage';

const filterCategories = ['All', 'Unread', 'Academic', 'Announcement', 'System'];

const categoryIconMap: Record<string, any> = {
  Academic:     FileText,
  Announcement: Bell,
  System:       Sparkles,
  Schedule:     Calendar,
};

const categoryColorMap: Record<string, { color: string; bgColor: string }> = {
  Academic:     { color: '#2563eb', bgColor: '#eff6ff' },
  Announcement: { color: '#dc2626', bgColor: '#fef2f2' },
  System:       { color: '#7c3aed', bgColor: '#f3e8ff' },
  Schedule:     { color: '#d97706', bgColor: '#fffbeb' },
};

export interface NotificationItem {
  id: string;
  dbId?: string;
  title: string;
  message: string;
  time: string;
  createdAt: string;
  category: 'Academic' | 'Announcement' | 'System' | 'Schedule';
  isRead: boolean;
  color: string;
  bgColor: string;
  icon: any;
  targetRoute?: string;
}

const formatTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  if (Math.floor(diff / 1440) === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function NotificationsScreen() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();

  const readStorageKey = `@lecta_read_notifications_${user?.id || 'guest'}`;
  const deletedStorageKey = `@lecta_deleted_notifications_${user?.id || 'guest'}`;

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // 1. Load locally tracked read & deleted sets
      const [storedRead, storedDeleted] = await Promise.all([
        safeStorage.getItem(readStorageKey),
        safeStorage.getItem(deletedStorageKey),
      ]);

      const readIds = new Set<string>(storedRead ? JSON.parse(storedRead) : []);
      const deletedIds = new Set<string>(storedDeleted ? JSON.parse(storedDeleted) : []);

      // 2. Fetch explicit notifications from notifications table
      const { data: dbNotifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 3. Fetch announcements
      const { data: announcements } = await supabase
        .from('announcements')
        .select('id, title, body, category, priority, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      // 4. Fetch course materials
      const { data: materials } = await supabase
        .from('course_materials')
        .select('id, title, file_url, created_at, courses(code, title)')
        .order('created_at', { ascending: false })
        .limit(15);

      const items: NotificationItem[] = [];

      // Process explicit notifications
      (dbNotifs || []).forEach((n: any) => {
        const id = `db_${n.id}`;
        if (deletedIds.has(id)) return;

        const cat = (n.category || 'System') as any;
        const colorData = categoryColorMap[cat] || categoryColorMap['System'];
        const icon = categoryIconMap[cat] || Bell;
        const isRead = n.is_read || readIds.has(id);

        items.push({
          id,
          dbId: n.id,
          title: n.title,
          message: n.body,
          time: formatTime(n.created_at),
          createdAt: n.created_at,
          category: cat,
          isRead,
          color: colorData.color,
          bgColor: colorData.bgColor,
          icon,
          targetRoute: n.target_route || undefined,
        });
      });

      // Process announcements as live notifications
      (announcements || []).forEach((a: any) => {
        const id = `announcement_${a.id}`;
        if (deletedIds.has(id)) return;

        const isUrgent = a.priority === 'HIGH' || a.priority === 'urgent';
        const colorData = isUrgent
          ? { color: '#ef4444', bgColor: '#fef2f2' }
          : categoryColorMap['Announcement'];

        items.push({
          id,
          title: `Announcement: ${a.title}`,
          message: a.body,
          time: formatTime(a.created_at),
          createdAt: a.created_at,
          category: 'Announcement',
          isRead: readIds.has(id),
          color: colorData.color,
          bgColor: colorData.bgColor,
          icon: isUrgent ? AlertTriangle : Bell,
          targetRoute: '/announcements',
        });
      });

      // Process course materials as live academic notifications
      (materials || []).forEach((m: any) => {
        const id = `material_${m.id}`;
        if (deletedIds.has(id)) return;

        const courseCode = m.courses?.code || 'Course';
        const colorData = categoryColorMap['Academic'];

        items.push({
          id,
          title: `New Material: ${m.title || 'Course Document'}`,
          message: `New study material posted for ${courseCode}. Tap to view or download.`,
          time: formatTime(m.created_at),
          createdAt: m.created_at,
          category: 'Academic',
          isRead: readIds.has(id),
          color: colorData.color,
          bgColor: colorData.bgColor,
          icon: BookOpen,
          targetRoute: '/documents',
        });
      });

      // Sort combined feed by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(items);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, readStorageKey, deletedStorageKey]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // Real-time live subscription
  useEffect(() => {
    if (!user) return;

    const notifSub = supabase
      .channel('public_notifications_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'course_materials' },
        () => fetchNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifSub);
    };
  }, [user, fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markItemAsRead = async (item: NotificationItem) => {
    if (item.isRead) return;

    // Update state immediately
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );

    // Save to local storage
    try {
      const stored = await safeStorage.getItem(readStorageKey);
      const readIds: string[] = stored ? JSON.parse(stored) : [];
      if (!readIds.includes(item.id)) {
        readIds.push(item.id);
        await safeStorage.setItem(readStorageKey, JSON.stringify(readIds));
      }
    } catch (e) {
      console.error('Error saving read notification locally:', e);
    }

    // If it's a DB notification, update Supabase
    if (item.dbId) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.dbId);
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    await markItemAsRead(item);

    if (item.targetRoute) {
      router.push(item.targetRoute as any);
    }
  };

  const markAllRead = async () => {
    if (notifications.length === 0) return;

    const allIds = notifications.map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await safeStorage.setItem(readStorageKey, JSON.stringify(allIds));
    } catch (e) {
      console.error('Error marking all read:', e);
    }

    if (user) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    }
  };

  const deleteNotification = async (id: string, dbId?: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    try {
      const stored = await safeStorage.getItem(deletedStorageKey);
      const deletedIds: string[] = stored ? JSON.parse(stored) : [];
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        await safeStorage.setItem(deletedStorageKey, JSON.stringify(deletedIds));
      }
    } catch (e) {
      console.error('Error deleting notification locally:', e);
    }

    if (dbId) {
      await supabase.from('notifications').delete().eq('id', dbId);
    }
  };

  const clearAllNotifications = () => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to dismiss all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const allIds = notifications.map((n) => n.id);
            setNotifications([]);

            try {
              const stored = await safeStorage.getItem(deletedStorageKey);
              const existing: string[] = stored ? JSON.parse(stored) : [];
              const combined = Array.from(new Set([...existing, ...allIds]));
              await safeStorage.setItem(deletedStorageKey, JSON.stringify(combined));
            } catch (e) {
              console.error('Error clearing notifications locally:', e);
            }

            if (user) {
              await supabase.from('notifications').delete().eq('user_id', user.id);
            }
          },
        },
      ]
    );
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === 'Unread') return !item.isRead;
    if (activeFilter === 'Academic') return item.category === 'Academic';
    if (activeFilter === 'Announcement') return item.category === 'Announcement';
    if (activeFilter === 'System') return item.category === 'System' || item.category === 'Schedule';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAllNotifications} activeOpacity={0.7} style={styles.clearHeaderBtn}>
              <Trash2 size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        {filterCategories.map((cat) => {
          const isSelected = activeFilter === cat;
          const count = cat === 'Unread' ? unreadCount : undefined;

          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveFilter(cat)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected ? '#2563eb' : colors.card,
                  borderColor: isSelected ? '#2563eb' : colors.cardBorder,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: isSelected ? '#ffffff' : colors.textSecondary },
                ]}
              >
                {cat} {count !== undefined && count > 0 ? `(${count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        >
          {filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Inbox size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Notifications</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {activeFilter === 'Unread'
                  ? "You have no unread notifications right now."
                  : "You're all caught up! Academic and announcement updates will appear here."}
              </Text>
            </View>
          ) : (
            <View style={styles.notificationsList}>
              {filteredNotifications.map((item) => {
                const IconComp = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    onPress={() => handleNotificationPress(item)}
                    style={[
                      styles.notificationCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: !item.isRead ? '#2563eb' : colors.cardBorder,
                        borderLeftWidth: !item.isRead ? 4 : 1,
                        borderLeftColor: !item.isRead ? '#2563eb' : colors.cardBorder,
                      },
                    ]}
                  >
                    {/* Left Icon Badge */}
                    <View
                      style={[
                        styles.iconBadge,
                        { backgroundColor: isDarkMode ? item.color + '25' : item.bgColor },
                      ]}
                    >
                      <IconComp size={20} color={item.color} />
                    </View>

                    {/* Card Content */}
                    <View style={styles.cardContent}>
                      <View style={styles.cardTopRow}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!item.isRead && <View style={styles.unreadDot} />}
                      </View>

                      <Text style={[styles.cardMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.message}
                      </Text>

                      <View style={styles.cardBottomRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Clock size={11} color={colors.textMuted} />
                          <Text style={[styles.cardTime, { color: colors.textMuted }]}>{item.time}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {item.targetRoute && (
                            <View style={styles.viewBadge}>
                              <Text style={styles.viewBadgeText}>Tap to open</Text>
                              <ChevronRight size={12} color="#2563eb" />
                            </View>
                          )}

                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              deleteNotification(item.id, item.dbId);
                            }}
                            style={styles.deleteBtn}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Trash2 size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  clearHeaderBtn: {
    padding: 4,
  },

  /* Filter Tabs */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Content */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  viewBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  deleteBtn: {
    padding: 4,
  },

  /* Empty State */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
});
