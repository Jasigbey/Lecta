import React, { useState, useCallback } from 'react';
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
  ChevronDown,
  ChevronUp,
  Megaphone,
  Pin,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';

type Priority = 'urgent' | 'info' | 'success' | 'reminder';

interface Announcement {
  id: string;
  title: string;
  body: string;
  time: string;
  date: string;
  from: string;
  category: string;
  priority: Priority;
  pinned?: boolean;
  read: boolean;
}

const categories = ['ALL', 'EXAM', 'DEADLINE', 'MATERIAL', 'NOTICE', 'SCHEDULE', 'GENERAL'];

const priorityConfig: Record<Priority, { bg: string; border: string; dot: string; icon: any; iconColor: string }> = {
  urgent:   { bg: '#fff1f2', border: '#fecdd3', dot: '#ef4444', icon: AlertTriangle, iconColor: '#ef4444' },
  info:     { bg: '#eff6ff', border: '#bfdbfe', dot: '#2563eb', icon: Bell,           iconColor: '#2563eb' }, // dynamic overrides applied at render
  success:  { bg: '#f0fdf4', border: '#bbf7d0', dot: '#10b981', icon: CheckCircle2,   iconColor: '#10b981' },
  reminder: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', icon: Clock,          iconColor: '#f59e0b' },
};

// Map Supabase priority to UI priority
const mapPriority = (p: string): Priority => {
  if (p === 'HIGH') return 'urgent';
  if (p === 'MEDIUM') return 'info';
  return 'reminder';
};

// Format a date string nicely
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function AnnouncementsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readItems, setReadItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { role, user } = useAuth();
  const { colors, isDarkMode } = useTheme();

  const fetchAnnouncements = useCallback(async () => {
    let { data, error } = await supabase
      .from('announcements')
      .select('*, profiles(full_name, role)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    // Fallback if join failed
    if (error) {
      console.warn('Announcement join fetch error, falling back to simple select:', error);
      const res = await supabase
        .from('announcements')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error('Fetch Announcements Error:', error);
    } else if (data) {
      const mapped: Announcement[] = data.map((a: any) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        time: new Date(a.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: formatDate(a.created_at),
        from: a.profiles?.full_name || 'Course Rep',
        category: a.category,
        priority: mapPriority(a.priority),
        pinned: a.pinned,
        read: false,
      }));
      setAnnouncements(mapped);

      // Fetch which ones the user has already read
      if (user) {
        const { data: reads } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('user_id', user.id);
        const readMap: Record<string, boolean> = {};
        reads?.forEach((r: any) => { readMap[r.announcement_id] = true; });
        setReadItems(readMap);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchAnnouncements();
    }, [fetchAnnouncements])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const markRead = async (id: string) => {
    setReadItems((prev) => ({ ...prev, [id]: true }));
    if (user) {
      await supabase.from('announcement_reads').upsert({
        announcement_id: id,
        user_id: user.id,
      });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('announcements').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          }
        },
      },
    ]);
  };

  const filtered = announcements.filter(
    (a) => selectedCategory === 'ALL' || a.category === selectedCategory
  );

  const pinned = filtered.filter((a) => a.pinned);
  const rest = filtered.filter((a) => !a.pinned);
  const unreadCount = announcements.filter((a) => !readItems[a.id]).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Announcements</Text>
          {unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Category filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterContainer, { borderBottomColor: colors.cardBorder }]}
        contentContainerStyle={styles.filterRow}
      >
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[
                styles.filterPill,
                { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.cardBorder },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, { color: active ? '#ffffff' : colors.textSecondary }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>Loading announcements...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.content}>

            {/* Pinned section */}
            {pinned.length > 0 && (
              <>
                <View style={styles.sectionLabel}>
                  <Pin size={13} color={colors.primary} />
                  <Text style={styles.sectionLabelText}>PINNED</Text>
                </View>
                {pinned.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    item={item}
                    isRead={!!readItems[item.id]}
                    onPress={() => markRead(item.id)}
                    onDelete={role === 'rep' ? () => handleDeleteAnnouncement(item.id) : undefined}
                  />
                ))}
              </>
            )}

            {/* Rest */}
            {rest.length > 0 && (
              <>
                <View style={styles.sectionLabel}>
                  <Megaphone size={13} color={colors.textSecondary} />
                  <Text style={[styles.sectionLabelText, { color: colors.textSecondary }]}>LATEST</Text>
                </View>
                {rest.map((item) => (
                  <AnnouncementCard
                    key={item.id}
                    item={item}
                    isRead={!!readItems[item.id]}
                    onPress={() => markRead(item.id)}
                    onDelete={role === 'rep' ? () => handleDeleteAnnouncement(item.id) : undefined}
                  />
                ))}
              </>
            )}

            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={[styles.emptyText, { color: colors.text }]}>No announcements yet</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {role === 'rep' ? 'Tap + to post the first announcement.' : 'Check back later or pull down to refresh.'}
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      )}

      {/* FAB for Course Reps */}
      {role === 'rep' && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]} activeOpacity={0.8} onPress={() => router.push('/create-announcement')}>
          <Plus size={24} color={'#ffffff'} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function AnnouncementCard({
  item,
  isRead,
  onPress,
  onDelete,
}: {
  item: Announcement;
  isRead: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const { colors, isDarkMode } = useTheme();
  const cfg = priorityConfig[item.priority];
  const Icon = cfg.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: isDarkMode
            ? (isRead ? colors.card : '#1e293b')
            : (isRead ? '#ffffff' : cfg.bg),
          borderColor: isDarkMode
            ? colors.cardBorder
            : (isRead ? '#e2e8f0' : cfg.border),
        },
      ]}
      activeOpacity={0.82}
      onPress={() => setExpanded((prev) => !prev)}
    >
      {/* Top row */}
      <View style={styles.cardTopRow}>
        <View style={[styles.cardIconWrap, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Icon size={16} color={cfg.iconColor} />
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardCategory}>{item.category}</Text>
          <Text style={[styles.cardFrom, { color: colors.text }]}>{item.from}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardTime, { color: colors.textSecondary }]}>{item.time}</Text>
          <Text style={[styles.cardDate, { color: colors.textMuted }]}>{item.date}</Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
            style={{ marginLeft: 6, padding: 2 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
        {!isRead && <View style={[styles.unreadDot, { backgroundColor: cfg.dot }]} />}
      </View>

      {/* Title */}
      <Text style={[styles.cardTitle, { color: isRead ? colors.textSecondary : colors.text }]}>{item.title}</Text>

      {/* Body — collapses to 3 lines, expands on tap */}
      <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 3}>
        {item.body}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          {item.pinned && (
            <View style={styles.pinnedTag}>
              <Pin size={10} color="#ffffff" />
              <Text style={styles.pinnedTagText}>Pinned</Text>
            </View>
          )}
          {/* Expand / collapse label */}
          <View style={styles.expandHint}>
            {expanded
              ? <ChevronUp size={13} color={colors.textSecondary} />
              : <ChevronDown size={13} color={colors.textSecondary} />}
            <Text style={[styles.expandHintText, { color: colors.textSecondary }]}>
              {expanded ? 'Show less' : 'Show more'}
            </Text>
          </View>
        </View>

        {/* Mark as read — separate tap target */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onPress(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.tapToRead, { color: isRead ? colors.primary : cfg.dot }]}>
            {isRead ? 'Read ✓' : 'Mark read'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  unreadBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },

  /* Filter pills */
  filterContainer: {
    height: 60,
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 15,
    paddingVertical:15,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterPillText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  filterPillTextActive: { color: '#ffffff' },

  /* Scroll */
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  /* Section labels */
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
    marginTop: 6,
  },
  sectionLabelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 1,
  },

  /* Card */
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardMeta: { flex: 1 },
  cardCategory: { fontSize: 13, fontWeight: '800', color: '#2563eb', letterSpacing: 0.7 },
  cardFrom: { fontSize: 13, fontWeight: '900', color: '#1e293b', marginTop: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardTime: { fontSize: 13, fontWeight: '900', color: '#64748b' },
  cardDate: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 20,
  },
  cardBody: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinnedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pinnedTagText: { fontSize: 10, fontWeight: '900', color: 'white' },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expandHintText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  tapToRead: { fontSize: 11, fontWeight: '600' },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#94a3b8' },
  emptySub: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    bottom: 50,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});
