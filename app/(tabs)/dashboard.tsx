import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { safeStorage } from '../../lib/storage';
import { openInAppFile } from '../../lib/file-viewer';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Bell,
  Calendar as CalendarIcon,
  FileText,
  Sparkles,
  ChevronRight,
  Clock,
  Download,
  MoreVertical,
  BookOpen,
  CheckCircle2,
  Share2,
  Megaphone,
  ShieldCheck,
  Plus,
  AlertCircle,
} from 'lucide-react-native';

const getDynamicDashboardWeek = () => {
  const now = new Date();
  const currentDayNum = now.getDay();
  const distanceToSun = -currentDayNum;
  
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + distanceToSun);

  const dayCodes = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const days = dayCodes.map((code, index) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + index);
    const dateStr = d.getDate().toString().padStart(2, '0');
    const isSelected =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    return {
      day: code,
      date: dateStr,
      isSelected,
      hasStar: isSelected,
    };
  });

  const monthLabel = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const todayDateStr = now.getDate().toString().padStart(2, '0');

  return { days, monthLabel, todayDateStr };
};



const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff} min ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  const days = Math.floor(diff / 1440);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const FILE_TYPE_COLORS: Record<string, { color: string; bgColor: string }> = {
  pdf:  { color: '#ef4444', bgColor: '#fef2f2' },
  pptx: { color: '#f59e0b', bgColor: '#fffbeb' },
  ppt:  { color: '#f59e0b', bgColor: '#fffbeb' },
  docx: { color: '#2563eb', bgColor: '#eff6ff' },
  doc:  { color: '#2563eb', bgColor: '#eff6ff' },
  zip:  { color: '#7c3aed', bgColor: '#f3e8ff' },
};

const getFileColors = (url: string) => {
  const ext = url?.split('.').pop()?.toLowerCase() || 'pdf';
  return FILE_TYPE_COLORS[ext] || { color: '#2563eb', bgColor: '#eff6ff' };
};

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  const isPM = cleaned.includes('PM');
  const isAM = cleaned.includes('AM');
  const rawTime = cleaned.replace(/AM|PM/g, '').trim();
  const parts = rawTime.split(':');
  if (parts.length < 2) return 0;
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

interface UpcomingBannerEvent {
  type: 'lecture' | 'exam';
  category: string;
  title: string;
  subtitle: string;
  isTomorrow: boolean;
  targetRoute: string;
}

interface AnnouncementPreviewItem {
  id: string;
  title: string;
  isRead: boolean;
}

interface RecentFile {
  id: string;
  name: string;
  size: string;
  time: string;
  file_url: string;
  color: string;
  bgColor: string;
}

export default function DashboardScreen() {
  const dashboardWeek = getDynamicDashboardWeek();
  const daysData = dashboardWeek.days;

  // Today's date is always the active day — locked, not interactive
  const { colors, isDarkMode } = useTheme();
  const { role, user } = useAuth();
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [nextLecture, setNextLecture] = useState<UpcomingBannerEvent | null>(null);
  const [nextExamEvent, setNextExamEvent] = useState<UpcomingBannerEvent | null>(null);

  const [announcementsPreview, setAnnouncementsPreview] = useState<AnnouncementPreviewItem[]>([]);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState<number>(0);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState<boolean>(true);
  const [focusProgress, setFocusProgress] = useState<number>(50);

  const fetchFocusProgress = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const key = `@lecta_daily_focus_tasks_${todayStr}`;
      const stored = await safeStorage.getItem(key);
      if (stored) {
        const storedTasks = JSON.parse(stored);
        if (Array.isArray(storedTasks)) {
          if (storedTasks.length === 0) {
            setFocusProgress(0);
            return;
          }
          const completed = storedTasks.filter((t: any) => t.done).length;
          setFocusProgress(Math.round((completed / storedTasks.length) * 100));
          return;
        }
      }
      setFocusProgress(0);
    } catch (err) {
      console.error('Error loading focus progress:', err);
    }
  }, []);

  const fetchAnnouncementsPreview = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, pinned, created_at')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoadingAnnouncements(false);
      return;
    }

    let readMap: Record<string, boolean> = {};
    if (user) {
      const { data: reads } = await supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', user.id);
      reads?.forEach((r: any) => {
        readMap[r.announcement_id] = true;
      });
    }

    const unreadCount = data.filter((a: any) => !readMap[a.id]).length;
    setUnreadAnnouncementsCount(unreadCount);

    const top3 = data.slice(0, 3).map((a: any) => ({
      id: a.id,
      title: a.title,
      isRead: !!readMap[a.id],
    }));

    setAnnouncementsPreview(top3);
    setLoadingAnnouncements(false);
  }, [user]);

  const fetchNextUpcomingEvent = useCallback(async () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayCode = DAY_CODES[now.getDay()];

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowCode = DAY_CODES[tomorrow.getDay()];

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();

    // 1. Query upcoming calendar events (Exams / Tests / Quizzes / Assignments)
    const { data: calData } = await supabase
      .from('calendar_events')
      .select('*, courses(code, title, accent_color)')
      .gte('due_date', todayStart)
      .order('due_date', { ascending: true });

    const upcomingExams = (calData || []).filter((e: any) => new Date(e.due_date).getTime() >= now.getTime());

    if (upcomingExams.length > 0) {
      const firstExam = upcomingExams[0];
      const examDate = new Date(firstExam.due_date);
      const isToday = examDate.getDate() === now.getDate() && examDate.getMonth() === now.getMonth();
      const isTom = examDate.getDate() === tomorrow.getDate() && examDate.getMonth() === tomorrow.getMonth();

      let category = 'NEXT EXAM';
      if (isToday) category = 'NEXT EXAM • TODAY';
      else if (isTom) category = 'NEXT EXAM • TOMORROW';
      else category = `NEXT EXAM • ${examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;

      const timeStr = examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setNextExamEvent({
        type: 'exam',
        category,
        title: firstExam.title || firstExam.courses?.title || 'Exam',
        subtitle: `${firstExam.courses?.code || 'Course'} • ${timeStr}`,
        isTomorrow: isTom,
        targetRoute: '/calendar',
      });
    } else {
      setNextExamEvent(null);
    }

    // 2. Query timetable_events for Next Lecture
    const { data: ttData } = await supabase
      .from('timetable_events')
      .select('*, courses(title, instructor, accent_color)')
      .order('start_time', { ascending: true });

    const eventsList = ttData || [];
    let lectureFound: UpcomingBannerEvent | null = null;

    // Check today's remaining lectures (if before 8:00 PM)
    if (currentMinutes < 1200) {
      const todayLectures = eventsList.filter((e: any) => e.day_of_week === todayCode);
      const remainingLectures = todayLectures.filter((e: any) => {
        const endMins = parseTimeToMinutes(e.end_time || e.start_time);
        const startMins = parseTimeToMinutes(e.start_time);
        return endMins > currentMinutes || startMins >= currentMinutes;
      });

      if (remainingLectures.length > 0) {
        remainingLectures.sort((a: any, b: any) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time));
        const first = remainingLectures[0];
        let title = first.courses?.title || 'Class';
        let location = first.venue || 'TBA';
        if (first.venue && first.venue.includes(' • ')) {
          const parts = first.venue.split(' • ');
          title = parts[0];
          location = parts[1];
        }
        lectureFound = {
          type: 'lecture',
          category: 'NEXT LECTURE',
          title,
          subtitle: `${location} • ${first.start_time}`,
          isTomorrow: false,
          targetRoute: '/timetable',
        };
      }
    }

    // If no remaining lecture today, check tomorrow
    if (!lectureFound) {
      const tomorrowLectures = eventsList.filter((e: any) => e.day_of_week === tomorrowCode);
      if (tomorrowLectures.length > 0) {
        tomorrowLectures.sort((a: any, b: any) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time));
        const first = tomorrowLectures[0];
        let title = first.courses?.title || 'Class';
        let location = first.venue || 'TBA';
        if (first.venue && first.venue.includes(' • ')) {
          const parts = first.venue.split(' • ');
          title = parts[0];
          location = parts[1];
        }
        lectureFound = {
          type: 'lecture',
          category: 'NEXT LECTURE • TOMORROW',
          title,
          subtitle: `${location} • ${first.start_time}`,
          isTomorrow: true,
          targetRoute: '/timetable',
        };
      }
    }

    // Check future days in week
    if (!lectureFound) {
      for (let offset = 2; offset <= 6; offset++) {
        const futureDate = new Date(now);
        futureDate.setDate(now.getDate() + offset);
        const futureCode = DAY_CODES[futureDate.getDay()];
        const futureLectures = eventsList.filter((e: any) => e.day_of_week === futureCode);
        if (futureLectures.length > 0) {
          futureLectures.sort((a: any, b: any) => parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time));
          const first = futureLectures[0];
          let title = first.courses?.title || 'Class';
          let location = first.venue || 'TBA';
          if (first.venue && first.venue.includes(' • ')) {
            const parts = first.venue.split(' • ');
            title = parts[0];
            location = parts[1];
          }
          const dayLabel = futureDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          lectureFound = {
            type: 'lecture',
            category: `NEXT LECTURE • ${dayLabel}`,
            title,
            subtitle: `${location} • ${first.start_time}`,
            isTomorrow: false,
            targetRoute: '/timetable',
          };
          break;
        }
      }
    }

    if (!lectureFound) {
      lectureFound = {
        type: 'lecture',
        category: 'SCHEDULE',
        title: 'No Upcoming Lectures',
        subtitle: 'Enjoy your free time!',
        isTomorrow: false,
        targetRoute: '/timetable',
      };
    }

    setNextLecture(lectureFound);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNextUpcomingEvent();
      fetchAnnouncementsPreview();
      fetchFocusProgress();
    }, [fetchNextUpcomingEvent, fetchAnnouncementsPreview, fetchFocusProgress])
  );

  const fetchRecentFiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('course_materials')
      .select('id, title, file_url, file_size, created_at')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!error && data) {
      setRecentFiles(
        data.map((m: any) => {
          const { color, bgColor } = getFileColors(m.file_url || '');
          return {
            id: m.id,
            name: m.title || 'Untitled',
            size: m.file_size || '',
            time: formatRelativeTime(m.created_at),
            file_url: m.file_url || '',
            color,
            bgColor,
          };
        })
      );
    }
    setLoadingFiles(false);
  }, []);

  useEffect(() => {
    fetchRecentFiles();
  }, [fetchRecentFiles]);

  const handleOpenFile = async (url: string, name: string = 'Material') => {
    if (!url) return;
    await openInAppFile(url, name);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>WELCOME BACK</Text>
                {role === 'rep' && (
                  <View style={styles.repBadgeSm}>
                    <ShieldCheck size={12} color="#ffffff" />
                    <Text style={styles.repBadgeTextSm}>Rep</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.headerTitleBold, { color: colors.text }]}>Today's </Text>
                <Text style={[styles.headerTitleBold, { color: colors.text }]}>Overview</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.notificationBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              activeOpacity={0.7}
              onPress={() => router.push('/notifications')}
            >
              <Bell size={20} color={colors.text} />
              {unreadAnnouncementsCount > 0 && <View style={styles.notificationBadge} />}
            </TouchableOpacity>
          </View>

          {/* Date Selector Strip (Inspired by Top Calendar Bar) */}
          <View style={styles.dateStripContainer}>
            <View style={[styles.daysRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {daysData.map((item) => {
                const isSelected = item.isSelected;
                return (
                  <View
                    key={item.date}
                    style={[
                      styles.dayCard,
                      isSelected && [styles.dayCardSelected, { backgroundColor: colors.primary, borderColor: colors.primary }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: colors.text },
                        isSelected && [styles.dayTextSelected, { color: '#ffffff' }],
                      ]}
                    >
                      {item.day}
                    </Text>
                    {item.hasStar && !isSelected && (
                      <View style={[styles.starIndicator, { backgroundColor: colors.primary }]} />
                    )}
                    <View
                      style={[
                        styles.dateCircle,
                        isSelected && [
                          styles.dateCircleSelected,
                          { backgroundColor: 'rgba(255,255,255,0.25)' },
                        ],
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          { color: colors.text },
                          isSelected && [styles.dateTextSelected, { color: '#ffffff' }],
                        ]}
                      >
                        {item.date}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Month Badge Button */}
            <TouchableOpacity style={[styles.monthBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} activeOpacity={0.8}>
              <CalendarIcon size={20} color={colors.primary} />
              <Text style={[styles.monthText, { color: colors.text }]}>{dashboardWeek.monthLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* ── COURSE REP CONTROL CENTER ── */}
          {role === 'rep' && (
            <View style={[styles.repControlCenter, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
              {/* Abstract decorative shapes */}
              <View style={[styles.repBgShape, { top: -20, right: -20, backgroundColor: '#ffffff', opacity: 0.12 }]} />
              <View style={[styles.repBgShape, { bottom: -30, left: -10, backgroundColor: '#ffffff', opacity: 0.08 }]} />
              
              <View style={styles.repControlHeader}>
                <View style={styles.repControlTitleRow}>
                  <ShieldCheck size={20} color={'#ffffff'} />
                  <Text style={[styles.repControlTitle, { color: '#ffffff' }]}>COURSE REP PORTAL</Text>
                </View>
                <Text style={[styles.repControlSubtitle, { color: '#ffffff', opacity: 0.85 }]}>Manage classes & announcements</Text>
              </View>
              
              <View style={styles.repActionRow}>
                <TouchableOpacity
                  style={styles.repActionBtn}
                  onPress={() => router.push('/create-announcement')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.repActionIconBg, { backgroundColor: '#ffffff' }]}>
                    <Megaphone size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.repActionText, { color: '#ffffff' }]}>Announce</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.repActionBtn}
                  onPress={() => router.push('/upload-material')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.repActionIconBg, { backgroundColor: '#ffffff' }]}>
                    <FileText size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.repActionText, { color: '#ffffff' }]}>Upload</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.repActionBtn}
                  onPress={() => router.push('/edit-timetable')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.repActionIconBg, { backgroundColor: '#ffffff' }]}>
                    <CalendarIcon size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.repActionText, { color: '#ffffff' }]}>Schedule</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Announcements Preview Card */}
          <TouchableOpacity
            style={[styles.announcementCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
            activeOpacity={0.88}
            onPress={() => router.push('/announcements')}
          >
            {/* Header row */}
            <View style={styles.announcementCardHeader}>
              <View style={[styles.announcementIconBg, { backgroundColor: '#ffffff' }]}>
                <Megaphone size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.announcementCardLabel, { color: '#ffffff' }]}>ANNOUNCEMENTS</Text>
                <Text style={[styles.announcementCardMeta, { color: '#ffffff', opacity: 0.85 }]}>
                  {loadingAnnouncements
                    ? 'Loading...'
                    : unreadAnnouncementsCount > 0
                    ? `${unreadAnnouncementsCount} unread`
                    : 'Up to date'}
                </Text>
              </View>
              {unreadAnnouncementsCount > 0 && (
                <View style={[styles.announcementBadge, { backgroundColor: '#ffffff' }]}>
                  <Text style={[styles.announcementBadgeText, { color: colors.primary }]}>
                    {unreadAnnouncementsCount}
                  </Text>
                </View>
              )}
              <ChevronRight size={18} color={'#ffffff'} style={{ marginLeft: 6 }} />
            </View>

            {/* Preview items */}
            <View style={styles.announcementPreviewList}>
              {loadingAnnouncements ? (
                <ActivityIndicator size="small" color={'#ffffff'} style={{ marginVertical: 10 }} />
              ) : announcementsPreview.length === 0 ? (
                <View style={styles.announcementPreviewItem}>
                  <Text style={[styles.announcementPreviewText, { color: '#ffffff', opacity: 0.8 }]}>
                    No announcements posted yet
                  </Text>
                </View>
              ) : (
                announcementsPreview.map((item) => (
                  <View key={item.id} style={styles.announcementPreviewItem}>
                    <View
                      style={[
                        styles.announcementDot,
                        { backgroundColor: '#ffffff' },
                        item.isRead && { opacity: 0.4 },
                      ]}
                    />
                    <Text style={[styles.announcementPreviewText, { color: '#ffffff' }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <Text style={[styles.announcementSeeAll, { color: '#ffffff', opacity: 0.95 }]}>View all announcements →</Text>
          </TouchableOpacity>

          {/* Quick Action Pills (Dual Card Row) */}
          <View style={styles.quickPillsRow}>
            <TouchableOpacity
              style={[styles.quickPillCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              activeOpacity={0.85}
              onPress={() => router.push('/documents')}
            >
              <View style={[styles.quickPillIconBg, { backgroundColor: '#eff6ff' }]}>
                <FileText size={18} color={colors.primary} />
              </View>
              <View style={styles.quickPillTextWrap}>
                <Text style={[styles.quickPillCategory, { color: colors.textMuted }]}>DOCUMENTS</Text>
                <Text style={[styles.quickPillTitle, { color: colors.text }]}>Course Materials</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickPillCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              activeOpacity={0.85}
              onPress={() => router.push('/ai-helper')}
            >
              <View style={[styles.quickPillIconBg, { backgroundColor: '#eff6ff' }]}>
                <Sparkles size={18} color={colors.primary} />
              </View>
              <View style={styles.quickPillTextWrap}>
                <Text style={[styles.quickPillCategory, { color: colors.textMuted }]}>AI TUTOR</Text>
                <Text style={[styles.quickPillTitle, { color: colors.text }]}>Ask Assistant</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Expanded Upcoming Schedule Container */}
          {(nextLecture || nextExamEvent) && (
            <View style={[styles.expandedEventsContainer, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
              {/* Next Lecture Row */}
              {nextLecture && (
                <TouchableOpacity
                  style={styles.eventRowItem}
                  activeOpacity={0.85}
                  onPress={() => router.push('/timetable')}
                >
                  <View style={[styles.eventRowIconBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Clock size={18} color={'#ffffff'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventRowCategoryLecture, { color: '#ffffff', opacity: 0.85 }]}>{nextLecture.category}</Text>
                    <Text style={[styles.eventRowTitle, { color: '#ffffff' }]} numberOfLines={1}>{nextLecture.title}</Text>
                    <Text style={[styles.eventRowSubtitleLecture, { color: '#ffffff', opacity: 0.9 }]} numberOfLines={1}>{nextLecture.subtitle}</Text>
                  </View>
                  <View style={[styles.eventChevronBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <ChevronRight size={18} color={'#ffffff'} />
                  </View>
                </TouchableOpacity>
              )}

              {/* Divider if both exist */}
              {nextLecture && nextExamEvent && (
                <View style={[styles.eventRowDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              )}

              {/* Next Exam Row */}
              {nextExamEvent && (
                <TouchableOpacity
                  style={styles.eventRowItem}
                  activeOpacity={0.85}
                  onPress={() => router.push('/calendar')}
                >
                  <View style={[styles.eventRowIconBgExam, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <AlertCircle size={18} color={'#ffffff'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventRowCategoryExam, { color: '#ffffff', opacity: 0.85 }]}>{nextExamEvent.category}</Text>
                    <Text style={[styles.eventRowTitle, { color: '#ffffff' }]} numberOfLines={1}>{nextExamEvent.title}</Text>
                    <Text style={[styles.eventRowSubtitleExam, { color: '#ffffff', opacity: 0.9 }]} numberOfLines={1}>{nextExamEvent.subtitle}</Text>
                  </View>
                  <View style={[styles.eventChevronBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <ChevronRight size={18} color={'#ffffff'} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Hero Feature Card (Daily Focus) */}
          <TouchableOpacity style={styles.heroCard} activeOpacity={0.92} onPress={() => router.push('/daily-focus')}>
            <Image
              source={require('../../assets/dashboard_hero.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay} />

            <View style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <View style={styles.heroTagPill}>
                  <Sparkles size={14} color="#2563eb" />
                  <Text style={styles.heroTagText}>DAILY FOCUS</Text>
                </View>
                <TouchableOpacity style={styles.heroArrowBtn} onPress={() => router.push('/daily-focus')}>
                  <ChevronRight size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.heroQuote}>
                "Protecting your study time is the most productive thing you'll do all week."
              </Text> 

              <View style={styles.heroFooter}>
                <View style={styles.heroFooterLeft}>
                  <View style={styles.heroAvatarBadge}>
                    <Text style={styles.heroAvatarText}>L</Text>
                  </View>
                  <View>
                    <Text style={styles.heroFooterCategory}>ACADEMIC GOALS</Text>
                    <Text style={styles.heroFooterTitle}>Smart Learning Pace</Text>
                  </View>
                </View>
                <View style={styles.progressBadge}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <Text style={styles.progressBadgeText}>{focusProgress}% Done</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Recent Files Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Files</Text>
            <TouchableOpacity onPress={() => router.push('/documents')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filesList}>
            {loadingFiles ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 24 }} />
            ) : recentFiles.length === 0 ? (
              <View style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, justifyContent: 'center', paddingVertical: 24 }]}>
                <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>No files uploaded yet.</Text>
              </View>
            ) : (
              recentFiles.map((file) => (
                <TouchableOpacity
                  key={file.id}
                  style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                  activeOpacity={0.75}
                  onPress={() => handleOpenFile(file.file_url)}
                >
                  <View style={[styles.fileIconBg, { backgroundColor: file.bgColor }]}>
                    <FileText size={22} color={file.color} />
                  </View>

                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={[styles.fileDetails, { color: colors.textSecondary }]}>
                      {file.size ? `${file.size} • ` : ''}{file.time}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.fileActionBtn} onPress={() => handleOpenFile(file.file_url)}>
                    <Download size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleBold: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerTitleLight: {
    fontSize: 28,
    fontWeight: '300',
    color: '#334155',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },

  /* Date Selector Strip */
  dateStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  dayCardSelected: {
    backgroundColor: '#2563eb',
  },
  dayText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'black',
    marginBottom: 4,
  },
  dayTextSelected: {
    color: 'white',
  },
  starIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
    position: 'absolute',
    top: 6,
    right: 6,
  },
  dateCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircleSelected: {
    backgroundColor: '#2563eb',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  dateTextSelected: {
    color: '#ffffff',
  },
  monthBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  monthText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },

  /* Quick Action Pills */
  quickPillsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickPillCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickPillIconBg: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPillTextWrap: {
    flex: 1,
  },
  quickPillCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  quickPillTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },

  /* Highlight Event Banner */
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2563eb',
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  /* Expanded Upcoming Schedule Container */
  expandedEventsContainer: {
    backgroundColor: '#2563eb',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  eventRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 14,
  },
  eventRowIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventRowIconBgExam: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventRowCategoryLecture: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93c5fd',
    letterSpacing: 1,
  },
  eventRowCategoryExam: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  eventRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  eventRowSubtitleLecture: {
    fontSize: 12,
    color: '#bfdbfe',
    marginTop: 1,
  },
  eventRowSubtitleExam: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 1,
  },
  eventRowDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 12,
  },
  eventChevronBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero Feature Card */
  heroCard: {
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  heroArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroQuote: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 28,
    marginVertical: 12,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroAvatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  heroAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroFooterCategory: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  heroFooterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 1,
  },
  progressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  progressBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
  },

  /* Recent Files Section */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  filesList: {
    gap: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
    shadowColor: '#64748b',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  fileIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  fileActionBtn: {
    padding: 8,
  },

  /* Announcements Preview Card */
  announcementCard: {
    marginHorizontal: 0,
    marginBottom: 20,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 17,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  announcementCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  announcementIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  
  // Rep specific styles
  repBadgeSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563eb',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  repBadgeTextSm: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  repControlCenter: {
    marginHorizontal: 0,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  repBgShape: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    filter: 'blur(20px)',
  },
  repControlHeader: {
    marginBottom: 20,
  },
  repControlTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  repControlTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#e0e7ff',
  },
  repControlSubtitle: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 4,
    fontWeight: '500',
  },
  repActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  repActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  repActionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  repActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  announcementCardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.6,
  },
  announcementCardMeta: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
    marginTop: 1,
  },
  announcementBadge: {
    backgroundColor: 'white',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  announcementBadgeText: {
    color: 'black',
    fontSize: 15,
    fontWeight: '700',
  },
  announcementPreviewList: {
    gap: 10,
    marginBottom: 14,
  },
  announcementPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  announcementDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'white',
    flexShrink: 0,
  },
  announcementPreviewText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
    flex: 1,
  },
  announcementSeeAll: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
    textAlign: 'right',
  },
});

