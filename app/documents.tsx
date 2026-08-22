import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Search,
  Folder,
  FileText,
  Download,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  File,
  Trash2,
  CheckCircle2,
  HardDrive,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  openInAppFile,
  downloadFileOffline,
  getOfflineFilesMap,
  OfflineFileRecord,
} from '../lib/file-viewer';

interface Document {
  id: string;
  name: string;
  size: string;
  date: string;
  author: string;
  type: string;
  file_url: string;
}

interface CourseGroup {
  id: string;
  code: string;
  title: string;
  instructor: string;
  color: string;
  bgColor: string;
  documents: Document[];
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  if (diff < 60) return `${diff} mins ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
  const days = Math.floor(diff / 1440);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const getFileType = (url: string): string => {
  if (!url) return 'pdf';
  const ext = url.split('.').pop()?.toLowerCase() || 'pdf';
  if (['pptx', 'ppt'].includes(ext)) return 'pptx';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  if (ext === 'zip') return 'zip';
  return 'pdf';
};

const courseColorMap: Record<string, { color: string; bgColor: string }> = {
  DS2:        { color: '#2563eb', bgColor: '#eff6ff' },
  COMPARCH:   { color: '#7c3aed', bgColor: '#f3e8ff' },
  COMPGRAPH:  { color: '#10b981', bgColor: '#ecfdf5' },
  EMBEDSYS:   { color: '#f59e0b', bgColor: '#fffbeb' },
  FINACCT:    { color: '#0284c7', bgColor: '#f0f9ff' },
  ECOMM:      { color: '#4f46e5', bgColor: '#eef2ff' },
  OPRESEARCH: { color: '#db2777', bgColor: '#fdf2f8' },
  RESMETHOD:  { color: '#059669', bgColor: '#ecfdf5' },
};

function getFileIcon(type: string, color: string) {
  if (type === 'pptx') return <BookOpen size={18} color={color} />;
  if (type === 'zip')  return <File     size={18} color={color} />;
  return <FileText size={18} color={color} />;
}

export default function CourseDocumentsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseGroups, setCourseGroups] = useState<CourseGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'all' | 'offline'>('all');
  const [offlineMap, setOfflineMap] = useState<Record<string, OfflineFileRecord>>({});
  const [downloadingMap, setDownloadingMap] = useState<Record<string, boolean>>({});

  const { role, user } = useAuth();
  const { colors, isDarkMode } = useTheme();

  const fetchMaterials = useCallback(async () => {
    const offlineData = await getOfflineFilesMap();
    setOfflineMap(offlineData);

    const { data, error } = await supabase
      .from('course_materials')
      .select('*, courses(id, code, title, instructor, accent_color, bg_color), profiles(full_name)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Group by course
      const grouped: Record<string, CourseGroup> = {};
      data.forEach((m: any) => {
        const courseCode = m.courses?.code || 'GENERAL';
        const courseColors = courseColorMap[courseCode] || { color: '#2563eb', bgColor: '#eff6ff' };

        if (!grouped[courseCode]) {
          grouped[courseCode] = {
            id: m.courses?.id || courseCode,
            code: courseCode,
            title: m.courses?.title || courseCode,
            instructor: m.courses?.instructor || 'Instructor',
            color: m.courses?.accent_color || courseColors.color,
            bgColor: m.courses?.bg_color || courseColors.bgColor,
            documents: [],
          };
        }

        grouped[courseCode].documents.push({
          id: m.id,
          name: m.title,
          size: m.file_size || 'Unknown',
          date: formatDate(m.created_at),
          author: m.profiles?.full_name || 'Course Rep',
          type: getFileType(m.file_url),
          file_url: m.file_url,
        });
      });

      const groupList = Object.values(grouped);
      setCourseGroups(groupList);

      // Auto-expand all courses
      const expanded: Record<string, boolean> = {};
      groupList.forEach((g) => { expanded[g.code] = true; });
      setExpandedCourses(expanded);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMaterials();
    }, [fetchMaterials])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMaterials();
  };

  const handleDeleteMaterial = async (id: string, courseCode: string) => {
    Alert.alert('Delete Material', 'Are you sure you want to delete this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('course_materials').delete().eq('id', id);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            setCourseGroups((prev) =>
              prev.map((g) =>
                g.code === courseCode
                  ? { ...g, documents: g.documents.filter((d) => d.id !== id) }
                  : g
              ).filter((g) => g.documents.length > 0)
            );
          }
        },
      },
    ]);
  };

  const handleOpenFile = async (doc: Document) => {
    const offlineRecord = offlineMap[doc.id];
    const localUri = offlineRecord?.localUri;
    await openInAppFile(doc.file_url, doc.name, localUri);
  };

  const handleDownloadOffline = async (doc: Document) => {
    if (downloadingMap[doc.id]) return;
    setDownloadingMap((prev) => ({ ...prev, [doc.id]: true }));

    const localUri = await downloadFileOffline(doc.id, doc.file_url, doc.name);
    setDownloadingMap((prev) => ({ ...prev, [doc.id]: false }));

    if (localUri) {
      const map = await getOfflineFilesMap();
      setOfflineMap(map);
      Alert.alert('Downloaded! 🎉', `'${doc.name}' is now saved for offline viewing.`);
    }
  };

  const toggleCourse = (code: string) => {
    setExpandedCourses((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Filter
  const filtered = courseGroups
    .map((g) => ({
      ...g,
      documents: g.documents.filter((d) => {
        const matchesSearch =
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.author.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab = activeTab === 'all' || !!offlineMap[d.id];
        return matchesSearch && matchesTab;
      }),
    }))
    .filter((g) => g.documents.length > 0 || searchQuery === '');

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Course Materials</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {filtered.reduce((acc, g) => acc + g.documents.length, 0)} files
          </Text>
        </View>
        {role === 'rep' && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => router.push('/upload-material')}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#ffffff" />
            <Text style={styles.uploadBtnText}>Upload</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search & Filter Bar */}
      <View style={[styles.searchRow, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search files or author..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs: All vs Offline */}
        <View style={styles.tabFilterRow}>
          <TouchableOpacity
            style={[
              styles.tabFilterBtn,
              { backgroundColor: activeTab === 'all' ? '#2563eb' : colors.inputBg },
            ]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabFilterBtnText, { color: activeTab === 'all' ? '#ffffff' : colors.textSecondary }]}>
              All Files
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabFilterBtn,
              { backgroundColor: activeTab === 'offline' ? '#10b981' : colors.inputBg },
            ]}
            onPress={() => setActiveTab('offline')}
            activeOpacity={0.8}
          >
            <HardDrive size={14} color={activeTab === 'offline' ? '#ffffff' : '#10b981'} style={{ marginRight: 4 }} />
            <Text style={[styles.tabFilterBtnText, { color: activeTab === 'offline' ? '#ffffff' : colors.textSecondary }]}>
              Offline ({Object.keys(offlineMap).length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>
            Loading materials...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                {activeTab === 'offline' ? 'No Offline Files Yet' : 'No materials uploaded yet'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {activeTab === 'offline'
                  ? 'Tap the download icon on any material to save it for offline reading.'
                  : role === 'rep'
                  ? 'Tap Upload to share the first file with your class.'
                  : 'Pull down to refresh or check back later.'}
              </Text>
            </View>
          ) : (
            filtered.map((group) => {
              const isExpanded = !!expandedCourses[group.code];
              return (
                <View key={group.code} style={[styles.courseCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                  {/* Course Header */}
                  <TouchableOpacity
                    style={styles.courseHeader}
                    onPress={() => toggleCourse(group.code)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.courseIconBg, { backgroundColor: group.bgColor }]}>
                      <Folder size={20} color={group.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.courseCode, { color: group.color }]}>{group.code}</Text>
                      <Text style={[styles.courseTitle, { color: colors.text }]}>{group.title}</Text>
                      <Text style={[styles.courseInstructor, { color: colors.textSecondary }]}>
                        {group.instructor} • {group.documents.length} file{group.documents.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {isExpanded
                      ? <ChevronUp size={18} color={colors.textMuted} />
                      : <ChevronDown size={18} color={colors.textMuted} />
                    }
                  </TouchableOpacity>

                  {/* Documents List */}
                  {isExpanded && (
                    <View style={[styles.docsList, { borderTopColor: colors.cardBorder }]}>
                      {group.documents.map((doc, i) => {
                        const isDownloaded = !!offlineMap[doc.id];
                        const isDownloading = !!downloadingMap[doc.id];
                        return (
                          <View key={doc.id}>
                            {i > 0 && <View style={[styles.docDivider, { backgroundColor: colors.cardBorder }]} />}
                            <TouchableOpacity
                              style={styles.docRow}
                              onPress={() => handleOpenFile(doc)}
                              activeOpacity={0.75}
                            >
                              <View style={[styles.docIconBg, { backgroundColor: isDarkMode ? '#1e293b' : group.bgColor }]}>
                                {getFileIcon(doc.type, group.color)}
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.docName, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                                    {doc.name}
                                  </Text>
                                  {isDownloaded && (
                                    <View style={styles.offlineBadge}>
                                      <CheckCircle2 size={10} color="#10b981" />
                                      <Text style={styles.offlineBadgeText}>Offline</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[styles.docMeta, { color: colors.textMuted }]}>
                                  {doc.size} • {doc.author} • {doc.date}
                                </Text>
                              </View>
                              <View style={styles.docActions}>
                                <TouchableOpacity
                                  style={styles.actionBtn}
                                  onPress={() => handleDownloadOffline(doc)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  disabled={isDownloading}
                                >
                                  {isDownloading ? (
                                    <ActivityIndicator size="small" color="#2563eb" />
                                  ) : (
                                    <Download size={16} color={isDownloaded ? '#10b981' : '#2563eb'} />
                                  )}
                                </TouchableOpacity>
                                {role === 'rep' && (
                                  <TouchableOpacity
                                    style={styles.actionBtn}
                                    onPress={() => handleDeleteMaterial(doc.id, group.code)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Trash2 size={16} color="#ef4444" />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  searchRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  tabFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  tabFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },

  content: { paddingHorizontal: 16, paddingTop: 8 },

  courseCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  courseIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseCode: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  courseTitle: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  courseInstructor: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  docsList: { borderTopWidth: 1 },
  docDivider: { height: 1, marginLeft: 70 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  docIconBg: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  docMeta: { fontSize: 11, fontWeight: '500' },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
});
