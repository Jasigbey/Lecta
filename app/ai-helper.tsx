import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send,
  Bot,
  User,
  ArrowLeft,
  Sparkles,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Calendar,
  Lightbulb,
  AlertCircle,
  Copy,
  Check,
  History,
  Plus,
  Trash2,
  MessageSquare,
  X,
  Paperclip,
  Camera,
  Image as ImageIcon,
  FileText,
} from 'lucide-react-native';
import * as LegacyFS from 'expo-file-system/legacy';
import { safeStorage } from '../lib/storage';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { callGemini, GeminiMessage, GeminiAttachment } from '../lib/gemini';
import { pickChatImage, pickChatDocument } from '../lib/chat-attachments';

const SESSIONS_STORAGE_KEY = '@lecta_ai_study_sessions_v2';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isError?: boolean;
  attachment?: {
    uri: string;
    name: string;
    mimeType: string;
    type: 'image' | 'document';
  };
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const QUICK_PROMPTS = [
  { id: '1', title: 'Summarize', icon: BookOpen, prompt: 'Can you summarize the key concepts of ' },
  { id: '2', title: 'Quiz Me', icon: HelpCircle, prompt: 'Generate 5 multiple choice quiz questions about ' },
  { id: '3', title: 'Study Plan', icon: Calendar, prompt: 'Create a 3-day revision study plan for ' },
  { id: '4', title: 'Explain', icon: Lightbulb, prompt: 'Explain the concept of ' },
];

function formatTime(date: Date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `Today at ${formatTime(date)}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AIHelperScreen() {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const studentName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';

  const initialGreeting = `Hi ${studentName}! I'm your Lecta AI Study Assistant powered by Gemini.

I can help you:
• Summarize lecture notes & textbooks
• Break down difficult course concepts
• Create study schedules & exam revision plans
• Generate practice quizzes & flashcards

What are we studying today?`;

  const createInitialSession = (id = `session_${Date.now()}`): ChatSession => ({
    id,
    title: 'New Study Chat',
    updatedAt: Date.now(),
    messages: [
      {
        id: 'welcome',
        sender: 'ai',
        text: initialGreeting,
        timestamp: formatTime(),
      },
    ],
  });

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    type: 'image' | 'document';
    base64Data?: string;
  } | null>(null);

  const getBase64FromUri = async (uri: string): Promise<string> => {
    try {
      if (uri.startsWith('data:')) {
        return uri.split(',')[1] || '';
      }
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = (reader.result as string) || '';
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
      } else {
        return await LegacyFS.readAsStringAsync(uri, {
          encoding: LegacyFS.EncodingType.Base64,
        });
      }
    } catch (err) {
      console.warn('Base64 conversion notice:', err);
      return '';
    }
  };

  const handlePickImage = (fromCamera: boolean) => {
    setShowAttachMenu(false);
    setTimeout(async () => {
      try {
        const picked = await pickChatImage(fromCamera);
        if (!picked) return;
        const base64Data = await getBase64FromUri(picked.uri);
        setPendingAttachment({
          uri: picked.uri,
          name: picked.name,
          mimeType: picked.mimeType,
          type: 'image',
          base64Data,
        });
      } catch (err: any) {
        console.error('AI image selection error:', err);
      }
    }, Platform.OS === 'web' ? 0 : 250);
  };

  const handlePickDocument = () => {
    setShowAttachMenu(false);
    setTimeout(async () => {
      try {
        const picked = await pickChatDocument();
        if (!picked) return;
        const base64Data = await getBase64FromUri(picked.uri);
        setPendingAttachment({
          uri: picked.uri,
          name: picked.name,
          mimeType: picked.mimeType,
          type: 'document',
          base64Data,
        });
      } catch (err: any) {
        console.error('AI document selection error:', err);
      }
    }, Platform.OS === 'web' ? 0 : 250);
  };

  // Load all sessions from safeStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await safeStorage.getItem(SESSIONS_STORAGE_KEY);
        if (saved) {
          const parsed: ChatSession[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            // Default to most recent session
            const mostRecent = parsed[0];
            setCurrentSessionId(mostRecent.id);
            setChat(mostRecent.messages);
            return;
          }
        }
        // Fallback: create fresh first session
        const fresh = createInitialSession();
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
        setChat(fresh.messages);
      } catch (e) {
        console.warn('Failed to load AI sessions:', e);
        const fresh = createInitialSession();
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
        setChat(fresh.messages);
      }
    })();
  }, []);

  // Save session list to storage
  const persistSessions = async (updatedSessions: ChatSession[]) => {
    try {
      await safeStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (e) {
      console.warn('Failed to persist AI sessions:', e);
    }
  };

  // Auto-scroll on new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [chat, loading]);

  const handleSend = async (customPrompt?: string) => {
    const promptText = (customPrompt || message).trim();
    const currentAttachment = pendingAttachment;
    if ((!promptText && !currentAttachment) || loading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: promptText || (currentAttachment?.type === 'image' ? '[Sent Image]' : '[Sent Document]'),
      timestamp: formatTime(),
      attachment: currentAttachment
        ? {
            uri: currentAttachment.uri,
            name: currentAttachment.name,
            mimeType: currentAttachment.mimeType,
            type: currentAttachment.type,
          }
        : undefined,
    };

    // Update current chat
    const updatedChat = [...chat, userMsg];
    setChat(updatedChat);
    setMessage('');
    setPendingAttachment(null);
    setLoading(true);

    // Generate or update session title if it's the first question
    const activeSession = sessions.find((s) => s.id === currentSessionId);
    let sessionTitle = activeSession?.title || 'Study Session';
    if (!activeSession || activeSession.title === 'New Study Chat') {
      const displayTitle = promptText || currentAttachment?.name || 'Study Question';
      sessionTitle = displayTitle.length > 32 ? `${displayTitle.substring(0, 32)}...` : displayTitle;
    }

    const updateSessionsWithChat = (chatMessages: ChatMessage[]) => {
      setSessions((prevSessions) => {
        const exists = prevSessions.some((s) => s.id === currentSessionId);
        let nextSessions: ChatSession[];
        if (exists) {
          nextSessions = prevSessions.map((s) =>
            s.id === currentSessionId
              ? { ...s, title: sessionTitle, updatedAt: Date.now(), messages: chatMessages }
              : s
          );
        } else {
          nextSessions = [
            { id: currentSessionId, title: sessionTitle, updatedAt: Date.now(), messages: chatMessages },
            ...prevSessions,
          ];
        }
        persistSessions(nextSessions);
        return nextSessions;
      });
    };

    // Persist immediately with user message
    updateSessionsWithChat(updatedChat);

    try {
      // Build conversation history for multi-turn Gemini reasoning
      const history: GeminiMessage[] = updatedChat
        .filter((m) => m.id !== 'welcome' && !m.isError)
        .slice(0, -1) // exclude latest user message
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      const geminiAttachment: GeminiAttachment | undefined = currentAttachment?.base64Data
        ? {
            mimeType: currentAttachment.mimeType,
            base64Data: currentAttachment.base64Data,
            fileName: currentAttachment.name,
          }
        : undefined;

      const aiResponseText = await callGemini(history, promptText, geminiAttachment);

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        timestamp: formatTime(),
      };

      const finalChat = [...updatedChat, aiMsg];
      setChat(finalChat);
      updateSessionsWithChat(finalChat);
    } catch (err: any) {
      console.error('AI chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: err?.message || 'Sorry, I ran into an issue connecting to Gemini. Please try again.',
        timestamp: formatTime(),
        isError: true,
      };
      const errorChat = [...updatedChat, errorMsg];
      setChat(errorChat);
      updateSessionsWithChat(errorChat);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewChat = () => {
    const newSession = createInitialSession();
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setCurrentSessionId(newSession.id);
    setChat(newSession.messages);
    setMessage('');
    setShowHistoryModal(false);
    persistSessions(updated);
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setChat(session.messages);
    setShowHistoryModal(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this study conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const filtered = sessions.filter((s) => s.id !== sessionId);
          if (filtered.length === 0) {
            const fresh = createInitialSession();
            setSessions([fresh]);
            setCurrentSessionId(fresh.id);
            setChat(fresh.messages);
            persistSessions([fresh]);
          } else {
            setSessions(filtered);
            if (currentSessionId === sessionId) {
              setCurrentSessionId(filtered[0].id);
              setChat(filtered[0].messages);
            }
            persistSessions(filtered);
          }
        },
      },
    ]);
  };

  const handleCopy = (msg: ChatMessage) => {
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to render basic markdown bold/bullets
  const renderFormattedText = (text: string, isMe: boolean) => {
    return text.split('\n').map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <Text key={lineIdx} style={[styles.msgLine, isMe ? styles.userMsgText : { color: colors.text }]}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <Text key={partIdx} style={{ fontWeight: '800' }}>
                  {part.slice(2, -2)}
                </Text>
              );
            }
            return part;
          })}
        </Text>
      );
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.aiBadge, { backgroundColor: '#eff6ff', borderColor: colors.badgeBorder }]}>
            <Bot size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {sessions.find((s) => s.id === currentSessionId)?.title || 'Study Assistant'}
              </Text>
              <View style={[styles.sparkleTag, { backgroundColor: '#eff6ff' }]}>
                <Sparkles size={11} color={colors.primary} />
                <Text style={[styles.sparkleTagText, { color: '#1e40af' }]}>AI</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {loading ? 'Thinking...' : 'Online • Ready to help'}
            </Text>
          </View>
        </View>

        {/* History & New Chat Buttons */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            onPress={() => setShowHistoryModal(true)}
            activeOpacity={0.7}
            accessibilityLabel="Past Chats"
          >
            <History size={18} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={handleStartNewChat}
            activeOpacity={0.8}
            accessibilityLabel="New Chat"
          >
            <Plus size={18} color={'#ffffff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {chat.map((msg) => {
          const isMe = msg.sender === 'user';
          return (
            <View
              key={msg.id}
              style={[styles.msgRow, isMe ? styles.userRow : styles.aiRow]}
            >
              {!isMe && (
                <View
                  style={[
                    styles.aiAvatar,
                    {
                      backgroundColor: msg.isError ? '#fef2f2' : '#eff6ff',
                      borderColor: msg.isError ? '#fca5a5' : colors.badgeBorder,
                    },
                  ]}
                >
                  {msg.isError ? (
                    <AlertCircle size={18} color="#ef4444" />
                  ) : (
                    <Bot size={18} color={colors.primary} />
                  )}
                </View>
              )}

              <View
                style={[
                  styles.bubble,
                  isMe
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [
                        styles.aiBubble,
                        {
                          backgroundColor: msg.isError
                            ? (isDarkMode ? '#450a0a' : '#fef2f2')
                            : colors.card,
                          borderColor: msg.isError
                            ? '#f87171'
                            : colors.cardBorder,
                        },
                      ],
                ]}
              >
                {msg.attachment && (
                  <View style={{ marginBottom: 6 }}>
                    {msg.attachment.type === 'image' ? (
                      <Image
                        source={{ uri: msg.attachment.uri }}
                        style={{ width: 180, height: 135, borderRadius: 12, marginBottom: 4 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.inputBg, marginBottom: 4 }}>
                        <FileText size={18} color={isMe ? '#ffffff' : colors.primary} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isMe ? '#ffffff' : colors.text, flex: 1 }} numberOfLines={1}>
                          {msg.attachment.name}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {renderFormattedText(msg.text, isMe)}

                <View style={styles.bubbleFooter}>
                  <Text
                    style={[
                      styles.timeText,
                      isMe ? styles.userTimeText : { color: colors.textMuted },
                    ]}
                  >
                    {msg.timestamp}
                  </Text>
                  {!isMe && !msg.isError && (
                    <TouchableOpacity
                      onPress={() => handleCopy(msg)}
                      style={styles.copyBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {copiedId === msg.id ? (
                        <Check size={13} color="#16a34a" />
                      ) : (
                        <Copy size={13} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {isMe && (
                <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                  <User size={18} color={'#ffffff'} />
                </View>
              )}
            </View>
          );
        })}

        {/* Typing / Thinking Indicator */}
        {loading && (
          <View style={[styles.msgRow, styles.aiRow]}>
            <View
              style={[
                styles.aiAvatar,
                {
                  backgroundColor: '#eff6ff',
                  borderColor: colors.badgeBorder,
                },
              ]}
            >
              <Bot size={18} color={colors.primary} />
            </View>
            <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                Lecta AI is analyzing...
              </Text>
            </View>
          </View>
        )}

        {/* Quick Suggestion Chips (when only initial message or user wants inspiration) */}
        {chat.length <= 2 && !loading && (
          <View style={styles.quickPromptsSection}>
            <Text style={[styles.quickPromptsTitle, { color: colors.textSecondary }]}>
              Suggested Study Topics
            </Text>
            <View style={styles.quickPromptsGrid}>
              {QUICK_PROMPTS.map((qp) => {
                const IconComponent = qp.icon;
                return (
                  <TouchableOpacity
                    key={qp.id}
                    style={[
                      styles.quickPromptChip,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      setMessage(qp.prompt);
                      setTimeout(() => textInputRef.current?.focus(), 50);
                    }}
                    activeOpacity={0.7}
                  >
                    <IconComponent size={15} color={colors.primary} />
                    <Text style={[styles.quickPromptChipText, { color: colors.text }]}>
                      {qp.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Pending Attachment Preview Chip */}
        {pendingAttachment && (
          <View style={[styles.aiPendingPreview, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.aiPendingInfo}>
              {pendingAttachment.type === 'image' ? (
                <Image source={{ uri: pendingAttachment.uri }} style={styles.aiPendingImageThumb} />
              ) : (
                <View style={[styles.aiPendingDocIconBg, { backgroundColor: '#eff6ff' }]}>
                  <FileText size={18} color={colors.primary} />
                </View>
              )}
              <Text style={[styles.aiPendingFileName, { color: colors.text }]} numberOfLines={1}>
                {pendingAttachment.name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPendingAttachment(null)} style={styles.aiPendingCloseBtn}>
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputArea, { backgroundColor: colors.background, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowAttachMenu(true)}
            disabled={loading}
          >
            <Paperclip size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            ref={textInputRef}
            style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.text }]}
            placeholder="Ask AI or attach study notes/photos..."
            placeholderTextColor={colors.textMuted}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={1000}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            style={[
              styles.sendBtn,
              (message.trim() || pendingAttachment) && !loading
                ? [styles.sendBtnActive, { backgroundColor: colors.primary, shadowColor: colors.primary }]
                : [styles.sendBtnDisabled, { backgroundColor: colors.inputBg }],
            ]}
            disabled={(!message.trim() && !pendingAttachment) || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={'#ffffff'} />
            ) : (
              <Send size={19} color={(message.trim() || pendingAttachment) ? '#ffffff' : colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ATTACHMENT SELECTION MODAL */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowAttachMenu(false)}
          />
          <View style={[styles.historySheet, { backgroundColor: colors.card, borderColor: colors.cardBorder, paddingBottom: 24 }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.historyTitle, { color: colors.text, marginBottom: 16 }]}>Attach Study Material</Text>
            <View style={styles.aiAttachRow}>
              <TouchableOpacity style={styles.aiAttachOption} onPress={() => handlePickImage(true)} activeOpacity={0.75}>
                <View style={[styles.aiAttachIconBg, { backgroundColor: '#f0fdf4' }]}>
                  <Camera size={26} color="#16a34a" />
                </View>
                <Text style={[styles.aiAttachText, { color: colors.text }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiAttachOption} onPress={() => handlePickImage(false)} activeOpacity={0.75}>
                <View style={[styles.aiAttachIconBg, { backgroundColor: '#eff6ff' }]}>
                  <ImageIcon size={26} color="#2563eb" />
                </View>
                <Text style={[styles.aiAttachText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.aiAttachOption} onPress={() => handlePickDocument()} activeOpacity={0.75}>
                <View style={[styles.aiAttachIconBg, { backgroundColor: '#fef2f2' }]}>
                  <FileText size={26} color="#dc2626" />
                </View>
                <Text style={[styles.aiAttachText, { color: colors.text }]}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PAST CHATS / SESSIONS MODAL */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowHistoryModal(false)}
          />
          <View style={[styles.historySheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.sheetHandle} />
            
            <View style={styles.historyHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={20} color={colors.primary} />
                <Text style={[styles.historyTitle, { color: colors.text }]}>Study Chat History</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.newChatCard, { backgroundColor: colors.primary }]}
              onPress={handleStartNewChat}
              activeOpacity={0.8}
            >
              <Plus size={18} color={'#ffffff'} />
              <Text style={[styles.newChatCardText, { color: '#ffffff' }]}>Start New Study Session</Text>
            </TouchableOpacity>

            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isActive = item.id === currentSessionId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.sessionItem,
                      {
                        backgroundColor: isActive
                          ? '#eff6ff'
                          : (isDarkMode ? '#1e293b' : '#f8fafc'),
                        borderColor: isActive ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => handleSelectSession(item)}
                    activeOpacity={0.7}
                  >
                    <MessageSquare size={18} color={isActive ? colors.primary : colors.textMuted} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text
                        style={[
                          styles.sessionTitle,
                          { color: isActive ? colors.primary : colors.text, fontWeight: isActive ? '800' : '600' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.sessionDate, { color: colors.textSecondary }]}>
                        {formatDate(item.updatedAt)} • {item.messages.length} messages
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.sessionDeleteBtn}
                      onPress={() => handleDeleteSession(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    maxWidth: 130,
  },
  sparkleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sparkleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 1,
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 18,
  },
  aiBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
    shadowColor: '#64748b',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  userBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  msgLine: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 2,
  },
  userMsgText: {
    color: '#ffffff',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  copyBtn: {
    padding: 2,
  },
  quickPromptsSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  quickPromptsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  quickPromptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickPromptChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14.5,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },

  /* SESSIONS / HISTORY MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historySheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  newChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 14,
  },
  newChatCardText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 14,
  },
  sessionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  sessionDeleteBtn: {
    padding: 6,
  },

  /* AI ATTACHMENT STYLES */
  attachBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPendingPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  aiPendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiPendingImageThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  aiPendingDocIconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPendingFileName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  aiPendingCloseBtn: {
    padding: 6,
  },
  aiAttachRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  aiAttachOption: {
    alignItems: 'center',
    gap: 6,
  },
  aiAttachIconBg: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAttachText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

