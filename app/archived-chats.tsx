import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  ArchiveRestore,
  Archive,
  Trash2,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ChatItemData } from './(tabs)/chat';

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export default function ArchivedChatsScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  
  const [archivedList, setArchivedList] = useState<ChatItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchArchivedChats = useCallback(async () => {
    if (!user) return;
    
    const { data: participantsData, error } = await supabase
      .from('chat_participants')
      .select('is_pinned, is_archived, joined_at, chat_conversations(*)')
      .eq('user_id', user.id)
      .eq('is_archived', true);

    if (error) {
      console.error('Error fetching archived chats:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const mappedChats: ChatItemData[] = [];
    for (const p of participantsData || []) {
      const conv = Array.isArray(p.chat_conversations) ? p.chat_conversations[0] : p.chat_conversations;
      if (!conv) continue;

      const { data: messages } = await supabase
        .from('chat_messages')
        .select('content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = messages?.[0];
      const chatName = conv.title || 'Direct Message';
      const initials = chatName.substring(0, 2).toUpperCase();

      mappedChats.push({
        id: conv.id,
        name: chatName,
        subtitle: lastMessage?.content || 'No messages yet',
        time: lastMessage ? formatTime(lastMessage.created_at) : formatTime(p.joined_at),
        unread: 0,
        isGroup: conv.is_group,
        initials: initials,
        bgColor: conv.color_bg || '#dbeafe',
        textColor: conv.color_text || '#1d4ed8',
        isPinned: p.is_pinned,
        isArchived: p.is_archived,
      });
    }

    setArchivedList(mappedChats);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchArchivedChats();
    }, [fetchArchivedChats])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchArchivedChats();
  };

  const handleUnarchive = (id: string, name: string) => {
    Alert.alert(
      'Unarchive Conversation',
      `Move "${name}" back to your active chat inbox?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unarchive',
          onPress: async () => {
            if (!user) return;
            await supabase
              .from('chat_participants')
              .update({ is_archived: false })
              .eq('user_id', user.id)
              .eq('conversation_id', id);
            
            setArchivedList((prev) => prev.filter((item) => item.id !== id));
          },
        },
      ]
    );
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Leave / Delete Chat',
      `Permanently remove "${name}" from archives?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            // Simply remove participant
            await supabase
              .from('chat_participants')
              .delete()
              .eq('user_id', user.id)
              .eq('conversation_id', id);

            setArchivedList((prev) => prev.filter((item) => item.id !== id));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Archived Chats</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {archivedList.length} archived conversation(s)
          </Text>
        </View>

        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
      >
        <View style={styles.content}>
          {archivedList.length === 0 ? (
            <View style={styles.emptyState}>
              <Archive size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Archived Chats</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Chats you archive from the Chat screen will appear here.
              </Text>
            </View>
          ) : (
            archivedList.map((chat) => (
              <View
                key={chat.id}
                style={[styles.chatCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <View style={[styles.avatarWrap, { backgroundColor: isDarkMode ? chat.textColor + '30' : chat.bgColor }]}>
                  <Text style={[styles.avatarText, { color: chat.textColor }]}>{chat.initials}</Text>
                </View>

                <View style={styles.chatDetails}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>
                      {chat.name}
                    </Text>
                  </View>
                  <Text style={[styles.chatSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {chat.subtitle}
                  </Text>
                  <Text style={[styles.chatTime, { color: colors.textMuted }]}>{chat.time}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.inputBg }]}
                    onPress={() => handleUnarchive(chat.id, chat.name)}
                    activeOpacity={0.8}
                  >
                    <ArchiveRestore size={18} color="#2563eb" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.inputBg }]}
                    onPress={() => handleDelete(chat.id, chat.name)}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },

  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  
  chatDetails: { flex: 1, paddingRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  chatName: { fontSize: 15, fontWeight: '700' },
  chatSub: { fontSize: 13, marginBottom: 2 },
  chatTime: { fontSize: 11, fontWeight: '500' },

  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
