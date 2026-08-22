import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Search,
  Users,
  MessageSquare,
  Bot,
  BadgeCheck,
  Megaphone,
  ChevronRight,
  UserCheck,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeStorage } from '../lib/storage';

interface Contact {
  id: string;
  name: string;
  role: string;
  dept: string;
  idNum: string;
  initials: string;
  bgColor: string;
  textColor: string;
  isVerified?: boolean;
}

const categoryTabs = ['All', 'Student', 'Rep', 'Lecturer'];

export default function NewChatScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id);

    if (error) {
      console.error('Error fetching contacts:', error);
      setLoading(false);
      return;
    }

    const mappedContacts = (data || []).map(p => {
      let initials = 'U';
      if (p.full_name) {
        const parts = p.full_name.split(' ');
        initials = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].substring(0, 2);
      }
      return {
        id: p.id,
        name: p.full_name || p.email,
        role: p.role === 'rep' ? 'Course Rep' : (p.role === 'lecturer' ? 'Lecturer' : 'Student'),
        dept: p.department || 'General',
        idNum: p.student_id || 'N/A',
        initials: initials.toUpperCase(),
        bgColor: '#dbeafe',
        textColor: '#1d4ed8',
        isVerified: p.role === 'rep' || p.role === 'lecturer',
        rawRole: p.role,
        avatar_url: p.avatar_url || null,
      };
    });

    setContacts(mappedContacts as any);
    setLoading(false);
  };

  const filteredContacts = contacts.filter((c: any) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.idNum.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesTab = true;
    if (activeTab === 'Student') matchesTab = c.rawRole === 'student';
    if (activeTab === 'Rep') matchesTab = c.rawRole === 'rep';
    if (activeTab === 'Lecturer') matchesTab = c.rawRole === 'lecturer';

    return matchesSearch && matchesTab;
  });

  const startChat = async (contact: Contact) => {
    if (!user) return;

    // Check if user disabled direct messages in privacy settings
    try {
      const myPrivacyStr = await safeStorage.getItem(`@lecta_privacy_settings_${user.id}`);
      if (myPrivacyStr) {
        const myPrivacy = JSON.parse(myPrivacyStr);
        if (myPrivacy.allowDms === false && (contact as any).rawRole !== 'rep' && (contact as any).rawRole !== 'lecturer') {
          Alert.alert(
            'Direct Messaging Disabled',
            'You have disabled direct messages in Privacy Settings. Enable "Allow Direct Messages" in Settings → Privacy to message classmates.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Privacy Settings', onPress: () => router.push('/privacy-settings') },
            ]
          );
          return;
        }
      }
    } catch (privErr) {
      console.warn('Privacy check warning:', privErr);
    }

    setCreating(true);

    try {
      // Create a direct message conversation
      const { data: convData, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          title: contact.name,
          is_group: false,
          category: 'Direct',
          created_by: user.id,
        })
        .select()
        .single();

      if (convError || !convData) throw convError;

      const conversationId = convData.id;

      // Add both participants
      const { error: partError } = await supabase
        .from('chat_participants')
        .insert([
          { conversation_id: conversationId, user_id: user.id, role: 'admin' },
          { conversation_id: conversationId, user_id: contact.id, role: 'member' },
        ]);

      if (partError) throw partError;

      router.replace(`/chat-detail?id=${conversationId}`);
    } catch (err: any) {
      console.error('Error creating chat:', err);
      Alert.alert('Error', `Could not create conversation: ${err?.message || JSON.stringify(err)}`);
      setCreating(false);
    }
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
          disabled={creating}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Chat</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={[styles.searchRow, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search name, ID, or department..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      </View>

      {/* Horizontal Filter Tabs */}
      <View style={[styles.filterScroll, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
          {categoryTabs.map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  styles.filterPill,
                  { backgroundColor: isSelected ? '#2563eb' : colors.card },
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

      {/* Main List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {creating && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={{ marginTop: 8, color: colors.textSecondary }}>Starting conversation...</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Contacts on Lecta</Text>
        
        {filteredContacts.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>No users found.</Text>
          </View>
        ) : (
          <View style={[styles.contactCardContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {filteredContacts.map((contact: any, index: number) => {
              const isLast = index === filteredContacts.length - 1;
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={[
                    styles.contactRow,
                    !isLast && { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
                  ]}
                  onPress={() => startChat(contact)}
                  activeOpacity={0.7}
                  disabled={creating}
                >
                  {contact.avatar_url ? (
                    <Image source={{ uri: contact.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: contact.bgColor }]}>
                      <Text style={[styles.avatarText, { color: contact.textColor }]}>{contact.initials}</Text>
                    </View>
                  )}

                  <View style={styles.contactContent}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
                        {contact.name}
                      </Text>
                      {contact.isVerified && <BadgeCheck size={14} color="#2563eb" style={{ marginLeft: 4 }} />}
                    </View>
                    <Text style={[styles.contactRole, { color: colors.textSecondary }]} numberOfLines={1}>
                      {contact.role} • {contact.dept}
                    </Text>
                    <Text style={[styles.contactId, { color: colors.textMuted }]}>{contact.idNum}</Text>
                  </View>

                  <ChevronRight size={18} color={colors.textMuted} />
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', padding: 0 },

  filterScroll: { borderBottomWidth: 1 },
  filterScrollContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },

  contactCardContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  contactContent: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  contactName: { fontSize: 15, fontWeight: '700' },
  contactRole: { fontSize: 13, marginTop: 2 },
  contactId: { fontSize: 11, marginTop: 1 },
});
