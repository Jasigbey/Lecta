import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Search,
  Plus,
  Edit3,
  CheckCheck,
  Check,
  Pin,
  Trash2,
  CheckCircle2,
  Archive,
  FolderKanban,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { safeStorage } from '../../lib/storage';
import { parseMessageContent } from '../../lib/chat-attachments';

export interface ChatItemData {
  id: string;
  name: string;
  subtitle: string;
  time: string;
  timestamp?: number;
  unread: number;
  isGroup: boolean;
  initials: string;
  bgColor: string;
  textColor: string;
  avatarUrl?: string | null;
  isRead?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

const formatLastMessagePreview = (rawContent?: string): string => {
  if (!rawContent) return 'No messages yet';
  const parsed = parseMessageContent(rawContent);
  if (parsed.attachment) {
    if (parsed.attachment.type === 'image') {
      return parsed.text ? `📷 Photo: ${parsed.text}` : '📷 Photo';
    }
    if (parsed.attachment.type === 'document') {
      return parsed.text ? `📄 ${parsed.text}` : `📄 ${parsed.attachment.name || 'Document'}`;
    }
    if (parsed.attachment.type === 'audio') {
      return '🎤 Voice note';
    }
  }
  return parsed.text || 'No messages yet';
};

const filterCategoryTabs = ['All', 'Groups', 'Direct'];

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
};

export default function ChatScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<ChatItemData[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();

  const fetchChats = useCallback(async () => {
    if (!user) return;
    
    // Step 1: Fetch all participant rows with their conversations in one query
    const { data: participantsData, error } = await supabase
      .from('chat_participants')
      .select('is_pinned, is_archived, joined_at, chat_conversations(*)')
      .eq('user_id', user.id)
      .eq('is_archived', false);

    if (error) {
      console.error('Error fetching chats:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const participants = participantsData || [];
    if (participants.length === 0) {
      setChats([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Step 2: Collect all conversation IDs in one shot
    const conversationIds = participants
      .map((p: any) => {
        const conv = Array.isArray(p.chat_conversations) ? p.chat_conversations[0] : p.chat_conversations;
        return conv?.id;
      })
      .filter(Boolean);

    // Step 3: Fetch the LATEST message for ALL conversations in a SINGLE query
    // We use a workaround: fetch recent messages ordered by created_at desc,
    // then pick the first one per conversation_id on the client side.
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('conversation_id, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(conversationIds.length * 5); // a reasonable upper bound

    // Step 4: Build a map of conversationId -> latest message
    const latestMessageMap: Record<string, { content: string; created_at: string }> = {};
    for (const msg of allMessages || []) {
      if (!latestMessageMap[msg.conversation_id]) {
        latestMessageMap[msg.conversation_id] = {
          content: msg.content,
          created_at: msg.created_at,
        };
      }
    }

    // Step 5: Fetch other participants' profiles (including avatars) for direct chats
    const { data: otherParticipants } = await supabase
      .from('chat_participants')
      .select('conversation_id, user_id, profiles(full_name, avatar_url)')
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id);

    const participantProfileMap: Record<string, { full_name?: string; avatar_url?: string }> = {};
    for (const op of otherParticipants || []) {
      const prof = Array.isArray(op.profiles) ? op.profiles[0] : op.profiles;
      if (prof) {
        participantProfileMap[op.conversation_id] = prof;
      }
    }

    // Step 6: Map everything together
    const mappedChats: ChatItemData[] = participants
      .map((p: any) => {
        const conv = Array.isArray(p.chat_conversations) ? p.chat_conversations[0] : p.chat_conversations;
        if (!conv) return null;

        const otherProf = participantProfileMap[conv.id];
        const lastMessage = latestMessageMap[conv.id];
        const chatName = conv.is_group
          ? (conv.title || 'Group Chat')
          : (otherProf?.full_name || conv.title || 'Direct Message');
        const avatarUrl = conv.is_group ? null : (otherProf?.avatar_url || null);

        return {
          id: conv.id,
          name: chatName,
          subtitle: formatLastMessagePreview(lastMessage?.content),
          time: lastMessage ? formatTime(lastMessage.created_at) : formatTime(p.joined_at),
          timestamp: lastMessage
            ? new Date(lastMessage.created_at).getTime()
            : new Date(p.joined_at).getTime(),
          unread: 0,
          isGroup: conv.is_group,
          initials: chatName.substring(0, 2).toUpperCase(),
          bgColor: conv.color_bg || '#dbeafe',
          textColor: conv.color_text || '#1d4ed8',
          avatarUrl,
          isRead: true,
          isPinned: p.is_pinned,
          isArchived: p.is_archived,
        } as ChatItemData;
      })
      .filter(Boolean) as ChatItemData[];

    setChats(mappedChats);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [fetchChats])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchChats();
  };

  const toggleSelectChat = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredChats.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredChats.map((c) => c.id));
    }
  };

  const handleArchiveSelected = async () => {
    if (!user) return;
    for (const id of selectedIds) {
      await supabase
        .from('chat_participants')
        .update({ is_archived: true })
        .eq('user_id', user.id)
        .eq('conversation_id', id);
    }
    setChats((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    setIsEditMode(false);
    Alert.alert('Archived', 'Conversations archived.');
  };

  const handlePinSelected = async () => {
    if (!user) return;
    for (const id of selectedIds) {
      const chat = chats.find(c => c.id === id);
      const newPinState = !chat?.isPinned;
      await supabase
        .from('chat_participants')
        .update({ is_pinned: newPinState })
        .eq('user_id', user.id)
        .eq('conversation_id', id);
    }
    setChats((prev) =>
      prev.map((chat) =>
        selectedIds.includes(chat.id) ? { ...chat, isPinned: !chat.isPinned } : chat
      )
    );
    setSelectedIds([]);
    setIsEditMode(false);
  };

  // 1. Filter out archived
  let activeChats = chats.filter((c) => !c.isArchived);

  // 2. Filter by search query
  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    activeChats = activeChats.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQ) ||
        c.subtitle.toLowerCase().includes(lowerQ)
    );
  }

  // 3. Filter by active Tab
  if (activeFilterTab === 'Groups') {
    activeChats = activeChats.filter((c) => c.isGroup);
  } else if (activeFilterTab === 'Direct') {
    activeChats = activeChats.filter((c) => !c.isGroup);
  }

  // 4. Sort by pinned, then by timestamp descending
  const filteredChats = activeChats.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => {
              setIsEditMode(!isEditMode);
              setSelectedIds([]);
            }}
          >
            {isEditMode ? <Check size={20} color={colors.primary} /> : <Edit3 size={20} color={colors.text} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, styles.primaryIconBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/new-chat')}
          >
            <Plus size={20} color={'#ffffff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search and Archive Row */}
      <View style={[styles.searchRow, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search messages..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.archiveBtnRow, { backgroundColor: colors.background }]}
        onPress={() => router.push('/archived-chats')}
      >
        <Archive size={18} color={colors.textSecondary} />
        <Text style={[styles.archiveBtnText, { color: colors.textSecondary }]}>Archived Chats</Text>
      </TouchableOpacity>

      {/* Filter Tabs */}
      <View style={[styles.filterScroll, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {filterCategoryTabs.map((tab) => {
            const isSelected = activeFilterTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilterTab(tab)}
                style={[
                  styles.filterPill,
                  { backgroundColor: isSelected ? colors.primary : colors.card },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, { color: isSelected ? '#ffffff' : colors.textSecondary }]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Edit Mode Toolbar */}
      {isEditMode && (
        <View style={[styles.editToolbar, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.toolbarBtn}>
            <CheckCircle2 size={18} color={colors.text} />
            <Text style={[styles.toolbarText, { color: colors.text }]}>Select All</Text>
          </TouchableOpacity>
          <View style={styles.toolbarRight}>
            <TouchableOpacity onPress={handlePinSelected} style={styles.toolbarBtn} disabled={selectedIds.length === 0}>
              <Pin size={18} color={selectedIds.length ? colors.text : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleArchiveSelected} style={styles.toolbarBtn} disabled={selectedIds.length === 0}>
              <Archive size={18} color={selectedIds.length ? colors.text : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filteredChats.length === 0 ? (
            <View style={styles.emptyState}>
              <FolderKanban size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No chats found</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {searchQuery ? 'Try adjusting your search.' : 'Start a new conversation to see it here.'}
              </Text>
            </View>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = selectedIds.includes(chat.id);
              return (
                <TouchableOpacity
                  key={chat.id}
                  style={[
                    styles.chatItem,
                    isSelected && [styles.chatItemSelected, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff' }],
                  ]}
                  onPress={() => {
                    if (isEditMode) toggleSelectChat(chat.id);
                    else router.push(`/chat-detail?id=${chat.id}`);
                  }}
                  onLongPress={() => {
                    if (isEditMode) return;
                    Alert.alert(
                      chat.name,
                      'Conversation Options',
                      [
                        {
                          text: chat.isPinned ? 'Unpin' : 'Pin',
                          onPress: async () => {
                            await supabase
                              .from('chat_participants')
                              .update({ is_pinned: !chat.isPinned })
                              .eq('user_id', user?.id)
                              .eq('conversation_id', chat.id);
                            fetchChats();
                          }
                        },
                        {
                          text: 'Archive',
                          onPress: async () => {
                            await supabase
                              .from('chat_participants')
                              .update({ is_archived: true })
                              .eq('user_id', user?.id)
                              .eq('conversation_id', chat.id);
                            fetchChats();
                          }
                        },
                        {
                          text: 'Delete / Leave',
                          style: 'destructive',
                          onPress: async () => {
                            await supabase
                              .from('chat_participants')
                              .delete()
                              .eq('user_id', user?.id)
                              .eq('conversation_id', chat.id);
                            fetchChats();
                          }
                        },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  {isEditMode && (
                    <View style={[styles.checkbox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.textMuted }]}>
                      {isSelected && <Check size={12} color={'#ffffff'} />}
                    </View>
                  )}

                  {/* Avatar */}
                  {chat.avatarUrl ? (
                    <View style={{ marginRight: 14 }}>
                      <Image source={{ uri: chat.avatarUrl }} style={styles.avatarImage} />
                      {chat.unread > 0 && <View style={styles.unreadDot} />}
                    </View>
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: chat.bgColor }]}>
                      <Text style={[styles.avatarText, { color: chat.textColor }]}>{chat.initials}</Text>
                      {chat.unread > 0 && <View style={styles.unreadDot} />}
                    </View>
                  )}

                  {/* Content */}
                  <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                      <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                        {chat.name}
                      </Text>
                      <View style={styles.timeRow}>
                        {chat.isPinned && <Pin size={12} color={colors.textMuted} style={{ marginRight: 4 }} />}
                        <Text style={[styles.chatTime, chat.unread > 0 ? { color: colors.primary, fontWeight: '700' } : { color: colors.textMuted }]}>
                          {chat.time}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.chatSubHeader}>
                      <Text
                        style={[
                          styles.chatMessage,
                          { color: chat.unread > 0 ? colors.text : colors.textSecondary },
                          chat.unread > 0 && styles.messageUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {chat.subtitle}
                      </Text>
                      {chat.unread > 0 ? (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.unreadBadgeText, { color: '#ffffff' }]}>{chat.unread}</Text>
                        </View>
                      ) : (
                        chat.isRead && <CheckCheck size={14} color={colors.primary} style={styles.readStatus} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIconBtn: { borderWidth: 0 },
  
  searchRow: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },

  archiveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  archiveBtnText: { fontSize: 13, fontWeight: '600' },

  filterScroll: { borderBottomWidth: 1 },
  filterScrollContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  editToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  toolbarText: { fontSize: 14, fontWeight: '600' },
  toolbarRight: { flexDirection: 'row', gap: 16 },

  chatList: { flex: 1 },
  chatListContent: { paddingBottom: 40 },
  
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chatItemSelected: {},
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {},

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 20,
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  chatContent: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  chatTime: { fontSize: 12, fontWeight: '500' },
  timeUnread: { fontWeight: '700' },
  
  chatSubHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatMessage: { fontSize: 14, flex: 1, paddingRight: 12 },
  messageUnread: { fontWeight: '600' },
  
  unreadBadge: {
    paddingHorizontal: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { fontSize: 11, fontWeight: '700' },
  readStatus: { marginLeft: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});

