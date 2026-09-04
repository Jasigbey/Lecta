import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Paperclip,
  Mic,
  Send,
  CheckCheck,
  Check,
  Info,
  X,
  Edit2,
  Image as ImageIcon,
  Camera,
  FileText,
  Play,
  Pause,
  Trash2,
  Download,
  Share2,
  ExternalLink,
  Volume2,
  Eye,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Audio from 'expo-av/build/Audio';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { safeStorage } from '../lib/storage';
import {
  parseMessageContent,
  serializeMessageContent,
  uploadChatAttachment,
  pickChatImage,
  pickChatDocument,
  getDocumentTypeInfo,
  ChatAttachment,
  PickedMedia,
} from '../lib/chat-attachments';
import { openInAppFile, shareRemoteFile, downloadFileOffline } from '../lib/file-viewer';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_edited?: boolean;
}

const formatTime = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatAudioDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const conversationId = Array.isArray(id) ? id[0] : id;
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);
  const [otherDisplayName, setOtherDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Pre-send attachment preview
  const [pendingAttachment, setPendingAttachment] = useState<{
    picked: PickedMedia;
    type: 'image' | 'document';
    caption: string;
  } | null>(null);

  // Fullscreen Image Viewer Modal
  const [viewingImage, setViewingImage] = useState<{
    url: string;
    name?: string;
    caption?: string;
    time?: string;
    isMe?: boolean;
  } | null>(null);

  // Document action modal
  const [selectedDoc, setSelectedDoc] = useState<{
    id: string;
    url: string;
    name: string;
    size: string;
  } | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  // Audio recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Audio playback
  const [soundObject, setSoundObject] = useState<Audio.Sound | null>(null);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  const [privacySettings, setPrivacySettings] = useState({
    onlineStatus: true,
    readReceipts: true,
  });

  useEffect(() => {
    return () => {
      if (soundObject) {
        soundObject.unloadAsync().catch(() => {});
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [soundObject]);

  const loadPrivacy = useCallback(async () => {
    if (!user) return;
    try {
      const stored = await safeStorage.getItem(`@lecta_privacy_settings_${user.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPrivacySettings({
          onlineStatus: parsed.onlineStatus !== undefined ? parsed.onlineStatus : true,
          readReceipts: parsed.readReceipts !== undefined ? parsed.readReceipts : true,
        });
      }
    } catch (e) {
      console.error('Error loading privacy in chat-detail:', e);
    }
  }, [user]);

  const fetchChatDetails = useCallback(async () => {
    if (!conversationId || !user) return;

    const { data: convData } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (convData) {
      setChatInfo(convData);

      if (!convData.is_group) {
        const { data: otherParticipants } = await supabase
          .from('chat_participants')
          .select('user_id, profiles(full_name, avatar_url)')
          .eq('conversation_id', conversationId)
          .neq('user_id', user.id)
          .limit(1);

        if (otherParticipants && otherParticipants.length > 0) {
          const prof = Array.isArray(otherParticipants[0].profiles)
            ? otherParticipants[0].profiles[0]
            : otherParticipants[0].profiles;
          if (prof) {
            setOtherAvatarUrl(prof.avatar_url || null);
            setOtherDisplayName(prof.full_name || null);
          }
        }
      }
    }

    const { data: msgData } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgData) {
      setMessages(msgData);
    }
    
    setLoading(false);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [conversationId, user]);

  useFocusEffect(
    useCallback(() => {
      loadPrivacy();
      fetchChatDetails();

      if (!conversationId) return;

      const subscription = supabase
        .channel(`public:chat_messages:conversation_id=eq.${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newMsg = payload.new as Message;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                // If there is an optimistic temp message matching this payload, replace it
                const optIndex = prev.findIndex(
                  (m) => m.id.startsWith('temp_') && m.sender_id === newMsg.sender_id && m.content === newMsg.content
                );
                if (optIndex !== -1) {
                  const updated = [...prev];
                  updated[optIndex] = newMsg;
                  return updated;
                }
                return [...prev, newMsg];
              });
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 100);
            } else if (payload.eventType === 'UPDATE') {
              const updatedMsg = payload.new as Message;
              setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setMessages((prev) => prev.filter((m) => m.id !== deletedId));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }, [conversationId, fetchChatDetails, loadPrivacy])
  );

  const sendMessageWithPayload = async (contentPayload: string) => {
    if (!contentPayload.trim() || !conversationId) return;
    const currentUserId = user?.id || 'demo_user';
    
    setSending(true);

    if (editingMsgId) {
      const currentEditId = editingMsgId;
      setEditingMsgId(null);
      setMessage('');
      
      setMessages(prev => prev.map(m => m.id === currentEditId ? { ...m, content: contentPayload, is_edited: true } : m));
      
      const { error } = await supabase
        .from('chat_messages')
        .update({ content: contentPayload, is_edited: true })
        .eq('id', currentEditId);

      if (error) {
        console.error('Update error:', error);
        Alert.alert('Error', 'Failed to update message.');
      }
    } else {
      const tempId = `temp_${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        sender_id: currentUserId,
        content: contentPayload,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);

      const { error, data } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: contentPayload,
      }).select().single();

      if (error) {
        console.error('Send error:', error);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id && m.id !== tempId)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? data : m));
        });
      }
    }
    
    setSending(false);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    const content = message.trim();
    setMessage('');
    sendMessageWithPayload(content);
  };

  const handlePickImage = async (fromCamera: boolean) => {
    setShowAttachMenu(false);
    try {
      const picked = await pickChatImage(fromCamera);
      if (!picked) return;

      // Open pre-send preview modal with existing message as prefilled caption
      setPendingAttachment({
        picked,
        type: 'image',
        caption: message.trim(),
      });
      setMessage('');
    } catch (err: any) {
      console.error('Image pick error:', err);
      Alert.alert('Image Selection Failed', err?.message || 'Could not access photo.');
    }
  };

  const handlePickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const picked = await pickChatDocument();
      if (!picked) return;

      setPendingAttachment({
        picked,
        type: 'document',
        caption: message.trim(),
      });
      setMessage('');
    } catch (err: any) {
      console.error('Document pick error:', err);
      Alert.alert('Document Selection Failed', err?.message || 'Could not select document.');
    }
  };

  const handleSendPendingAttachment = async () => {
    if (!pendingAttachment) return;

    const currentUserId = user?.id || 'demo_user';
    const { picked, type, caption } = pendingAttachment;
    setUploadingAttachment(true);
    setPendingAttachment(null);

    try {
      const publicUrl = await uploadChatAttachment(picked.uri, picked.name, picked.mimeType, currentUserId);
      const attachment: ChatAttachment = {
        url: publicUrl,
        type,
        name: picked.name,
        size: picked.size,
        width: picked.width,
        height: picked.height,
      };
      const payload = serializeMessageContent(caption, attachment);
      await sendMessageWithPayload(payload);
    } catch (err: any) {
      console.error('Upload attachment failed:', err);
      Alert.alert('Upload Failed', err.message || 'Could not upload attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone Permission Required', 'Please allow microphone access to record voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((prev) => prev + 1), 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      Alert.alert('Recording Error', 'Could not access microphone.');
    }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    try {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (e) {
      console.error('Error canceling recording:', e);
    }
  };

  const stopAndSendRecording = async () => {
    if (!recording || !user) return;
    try {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setUploadingAttachment(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) throw new Error('No audio recorded');
      const fileName = `voice_${Date.now()}.m4a`;
      const publicUrl = await uploadChatAttachment(uri, fileName, 'audio/m4a', user.id);
      const attachment: ChatAttachment = { url: publicUrl, type: 'audio', name: fileName, duration: recordingDuration };
      const payload = serializeMessageContent('', attachment);
      await sendMessageWithPayload(payload);
      setRecordingDuration(0);
    } catch (err: any) {
      console.error('Voice note send error:', err);
      Alert.alert('Voice Note Failed', err.message || 'Could not send voice note.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handlePlayAudio = async (audioUrl: string) => {
    try {
      if (soundObject && playingAudioUrl === audioUrl) {
        if (isPlaying) { await soundObject.pauseAsync(); setIsPlaying(false); }
        else { await soundObject.playAsync(); setIsPlaying(true); }
        return;
      }
      if (soundObject) await soundObject.unloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true }, (status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis / 1000);
          setPlaybackDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
          if (status.didJustFinish) { setIsPlaying(false); setPlaybackPosition(0); }
        }
      });
      setSoundObject(sound);
      setPlayingAudioUrl(audioUrl);
      setIsPlaying(true);
    } catch (err) {
      console.error('Audio playback error:', err);
      Alert.alert('Audio Error', 'Could not play voice note.');
    }
  };

  const handleDownloadDoc = async () => {
    if (!selectedDoc) return;
    setDownloadingDoc(true);
    try {
      const localUri = await downloadFileOffline(selectedDoc.id, selectedDoc.url, selectedDoc.name);
      if (localUri) {
        Alert.alert('Saved to Device', `'${selectedDoc.name}' has been downloaded for offline access.`);
      }
    } catch (e: any) {
      Alert.alert('Download Error', e.message || 'Could not download document.');
    } finally {
      setDownloadingDoc(false);
      setSelectedDoc(null);
    }
  };

  const handleShareDoc = async () => {
    if (!selectedDoc) return;
    const docToShare = selectedDoc;
    setSelectedDoc(null);
    await shareRemoteFile(docToShare.url, docToShare.name);
  };

  const handleOpenDocDirectly = async () => {
    if (!selectedDoc) return;
    const docToOpen = selectedDoc;
    setSelectedDoc(null);
    await openInAppFile(docToOpen.url, docToOpen.name);
  };

  const handleMessageLongPress = (msg: Message) => {
    const isMe = msg.sender_id === user?.id;
    const parsed = parseMessageContent(msg.content);
    const options: any[] = [];

    if (parsed.text) {
      options.push({
        text: '📋 Copy Text',
        onPress: async () => {
          await Clipboard.setStringAsync(parsed.text);
          Alert.alert('Copied! 📋', 'Message copied to clipboard.');
        },
      });
    }

    if (isMe) {
      if (parsed.text) {
        options.push({
          text: '✏️ Edit',
          onPress: () => {
            setMessage(parsed.text);
            setEditingMsgId(msg.id);
          },
        });
      }
      options.push({
        text: '🗑️ Delete',
        style: 'destructive',
        onPress: async () => {
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          const { error } = await supabase.from('chat_messages').delete().eq('id', msg.id);
          if (error) Alert.alert('Error', 'Could not delete message.');
        },
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message Options', undefined, options);
  };

  const chatName = chatInfo?.is_group ? (chatInfo?.title || 'Group Chat') : (otherDisplayName || chatInfo?.title || 'Direct Message');
  const initials = chatName.substring(0, 2).toUpperCase();
  const bgColor = chatInfo?.color_bg || '#dbeafe';
  const textColor = chatInfo?.color_text || '#1d4ed8';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={[styles.contactPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>{chatName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {!chatInfo?.is_group && privacySettings.onlineStatus && (
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10b981' }} />
            )}
            <Text style={[styles.contactStatus, { color: colors.textSecondary }]}>
              {chatInfo?.is_group ? 'Group Chat' : (privacySettings.onlineStatus ? 'Active now' : 'Direct Message')}
            </Text>
          </View>
        </View>

        {!chatInfo?.is_group && otherAvatarUrl ? (
          <Image source={{ uri: otherAvatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: bgColor }]}>
            <Text style={[styles.avatarText, { color: textColor }]}>{initials}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.datePillWrap}>
          <View style={[styles.datePill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.datePillText, { color: colors.textSecondary }]}>Beginning of Conversation</Text>
          </View>
        </View>

        {chatInfo?.is_group && (
          <View style={[styles.noticeBox, { backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff', borderColor: isDarkMode ? '#2563eb' : '#bfdbfe' }]}>
            <Info size={14} color="#2563eb" style={{ marginRight: 6, marginTop: 2 }} />
            <Text style={[styles.noticeText, { color: isDarkMode ? '#93c5fd' : '#1e40af' }]}>
              <Text style={{ fontWeight: '800' }}>{chatName}</Text> was created.
            </Text>
          </View>
        )}

        {messages.map((msg, index) => {
          const isMe = msg.sender_id === user?.id;
          const timeString = formatTime(msg.created_at);
          const parsed = parseMessageContent(msg.content);
          const hasAttachment = !!parsed.attachment;

          return (
            <View key={`${msg.id}_${index}`} style={[styles.msgRow, isMe ? styles.userMsgRow : styles.otherMsgRow]}>
              <TouchableOpacity
                onLongPress={() => handleMessageLongPress(msg)}
                delayLongPress={250}
                activeOpacity={0.92}
                style={[
                  styles.bubble,
                  isMe ? styles.userBubble : [styles.otherBubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
                ]}
              >
                {/* 1. IMAGE ATTACHMENT */}
                {hasAttachment && parsed.attachment?.type === 'image' && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setViewingImage({
                      url: parsed.attachment!.url,
                      name: parsed.attachment!.name,
                      caption: parsed.text,
                      time: timeString,
                      isMe,
                    })}
                    style={[
                      styles.imageAttachWrap,
                      { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' },
                    ]}
                  >
                    <Image
                      source={{ uri: parsed.attachment.url }}
                      style={styles.attachedImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {/* 2. DOCUMENT ATTACHMENT */}
                {hasAttachment && parsed.attachment?.type === 'document' && (() => {
                  const docInfo = getDocumentTypeInfo(parsed.attachment!.name);
                  const docUrl = parsed.attachment!.url;
                  const docName = parsed.attachment!.name || 'Document';
                  const docSize = parsed.attachment!.size || 'Document';

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => openInAppFile(docUrl, docName)}
                      onLongPress={() => setSelectedDoc({
                        id: msg.id,
                        url: docUrl,
                        name: docName,
                        size: docSize,
                      })}
                      style={[
                        styles.docAttachCard,
                        {
                          backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : (isDarkMode ? '#1e293b' : '#f8fafc'),
                          borderColor: isMe ? 'rgba(255,255,255,0.3)' : colors.cardBorder,
                        }
                      ]}
                    >
                      <View style={[styles.docIconBg, { backgroundColor: isMe ? '#ffffff' : docInfo.bgColor }]}>
                        <FileText size={20} color={isMe ? '#2563eb' : docInfo.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docName, { color: isMe ? '#ffffff' : colors.text }]} numberOfLines={1}>
                          {docName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <View style={[styles.docBadge, { backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : (isDarkMode ? '#334155' : '#e2e8f0') }]}>
                            <Text style={[styles.docBadgeText, { color: isMe ? '#ffffff' : docInfo.color }]}>
                              {docInfo.ext}
                            </Text>
                          </View>
                          <Text style={[styles.docSize, { color: isMe ? '#bfdbfe' : colors.textSecondary }]}>
                            {docSize}
                          </Text>
                        </View>
                      </View>
                      <ExternalLink size={16} color={isMe ? '#ffffff' : colors.textMuted} />
                    </TouchableOpacity>
                  );
                })()}

                {/* 3. AUDIO ATTACHMENT (Voice Note with Inline Duration, Time & Read Ticks) */}
                {hasAttachment && parsed.attachment?.type === 'audio' && (
                  <View
                    style={[
                      styles.audioAttachCard,
                      {
                        backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                        borderColor: isMe ? 'rgba(255,255,255,0.3)' : colors.cardBorder,
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.audioPlayBtn, { backgroundColor: isMe ? '#ffffff' : '#2563eb' }]}
                      onPress={() => handlePlayAudio(parsed.attachment!.url)}
                      activeOpacity={0.8}
                    >
                      {playingAudioUrl === parsed.attachment.url && isPlaying ? (
                        <Pause size={16} color={isMe ? '#2563eb' : '#ffffff'} />
                      ) : (
                        <Play size={16} color={isMe ? '#2563eb' : '#ffffff'} style={{ marginLeft: 2 }} />
                      )}
                    </TouchableOpacity>
                    <View style={styles.audioWaveformWrap}>
                      <View style={[styles.audioTrackLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.4)' : colors.cardBorder }]}>
                        {playingAudioUrl === parsed.attachment.url && playbackDuration > 0 && (
                          <View
                            style={[
                              styles.audioProgressLine,
                              {
                                width: `${Math.min(100, (playbackPosition / playbackDuration) * 100)}%`,
                                backgroundColor: isMe ? '#ffffff' : '#2563eb',
                              }
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.audioMetaRow}>
                        <Text style={[styles.audioTimeText, { color: isMe ? '#bfdbfe' : colors.textSecondary }]}>
                          {playingAudioUrl === parsed.attachment.url && isPlaying
                            ? formatAudioDuration(playbackPosition)
                            : formatAudioDuration(parsed.attachment.duration || 0)}
                        </Text>

                        {/* Inline Time & Read Receipts on the same row */}
                        <View style={styles.audioInlineTimeWrap}>
                          {msg.is_edited && (
                            <Text style={[styles.editedText, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: colors.textMuted }]}>
                              (edited)
                            </Text>
                          )}
                          <Text style={[styles.timeText, isMe ? styles.userTimeText : { color: colors.textMuted }]}>
                            {timeString}
                          </Text>
                          {isMe && (
                            privacySettings.readReceipts ? (
                              <CheckCheck size={13} color="#93c5fd" style={{ marginLeft: 2 }} />
                            ) : (
                              <Check size={13} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 2 }} />
                            )
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                )}

                {/* Text Message or Caption + Inline Time & Read Receipts on the SAME LINE */}
                {parsed.text ? (
                  <View style={[styles.msgInlineRow, hasAttachment && { marginTop: 6 }]}>
                    <Text style={[styles.msgText, isMe ? styles.userMsgText : { color: colors.text }]}>
                      {parsed.text}
                    </Text>
                    <View style={styles.inlineMetaWrap}>
                      {msg.is_edited && (
                        <Text style={[styles.editedText, isMe ? { color: 'rgba(255,255,255,0.7)' } : { color: colors.textMuted }]}>
                          (edited)
                        </Text>
                      )}
                      <Text style={[styles.timeText, isMe ? styles.userTimeText : { color: colors.textMuted }]}>
                        {timeString}
                      </Text>
                      {isMe && (
                        privacySettings.readReceipts ? (
                          <CheckCheck size={14} color="#93c5fd" style={{ marginLeft: 3 }} />
                        ) : (
                          <Check size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 3 }} />
                        )
                      )}
                    </View>
                  </View>
                ) : (
                  /* If image or document only without text caption (audio already has time inside card) */
                  parsed.attachment?.type !== 'audio' && (
                    <View style={[styles.inlineMetaWrap, { alignSelf: 'flex-end', marginTop: 4 }]}>
                      <Text style={[styles.timeText, isMe ? styles.userTimeText : { color: colors.textMuted }]}>
                        {timeString}
                      </Text>
                      {isMe && (
                        privacySettings.readReceipts ? (
                          <CheckCheck size={14} color="#93c5fd" style={{ marginLeft: 3 }} />
                        ) : (
                          <Check size={14} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 3 }} />
                        )
                      )}
                    </View>
                  )
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
      )}

      {/* COMPOSER & RECORDING CONTROLS */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {uploadingAttachment && (
          <View style={[styles.uploadBanner, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Uploading attachment...</Text>
          </View>
        )}
        {editingMsgId && (
          <View style={[styles.editBanner, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <Edit2 size={16} color="#2563eb" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}><Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '700' }}>Editing Message</Text></View>
            <TouchableOpacity onPress={() => { setEditingMsgId(null); setMessage(''); }}><X size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
        )}
        {isRecording ? (
          <View style={[styles.recordingBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <View style={styles.recDot} />
            <Text style={[styles.recDurationText, { color: '#ef4444' }]}>{formatAudioDuration(recordingDuration)}</Text>
            <Text style={[styles.recHintText, { color: colors.textSecondary }]}>Recording voice note...</Text>
            <TouchableOpacity style={styles.recCancelBtn} onPress={cancelRecording} activeOpacity={0.7}><Trash2 size={20} color="#ef4444" /></TouchableOpacity>
            <TouchableOpacity style={styles.recSendBtn} onPress={stopAndSendRecording} activeOpacity={0.8}><Send size={18} color="#ffffff" /></TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.composerWrap, { backgroundColor: colors.background, borderTopColor: colors.cardBorder, borderTopWidth: editingMsgId || uploadingAttachment ? 0 : 1 }]}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)} disabled={uploadingAttachment}>
              <Paperclip size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Type a message..."
                placeholderTextColor={colors.textMuted}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
                editable={!uploadingAttachment}
              />
              {!message.trim() ? (
                <TouchableOpacity style={styles.micBtn} onPress={startRecording} disabled={uploadingAttachment}>
                  <Mic size={20} color="#2563eb" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.sendBtn, (sending || uploadingAttachment) && { opacity: 0.5 }]} onPress={handleSend} activeOpacity={0.8} disabled={sending || uploadingAttachment}>
                  <Send size={18} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* 1. ATTACHMENT MENU BOTTOM SHEET */}
      {showAttachMenu && (
        <View style={styles.inViewModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowAttachMenu(false)}
          />
          <View style={[styles.attachSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.attachSheetTitle, { color: colors.text }]}>Share Attachment</Text>
            <View style={styles.attachOptionsRow}>
              <TouchableOpacity style={styles.attachOption} onPress={() => handlePickImage(true)} activeOpacity={0.75}>
                <View style={[styles.attachIconBg, { backgroundColor: '#f0fdf4' }]}>
                  <Camera size={26} color="#16a34a" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={() => handlePickImage(false)} activeOpacity={0.75}>
                <View style={[styles.attachIconBg, { backgroundColor: '#eff6ff' }]}>
                  <ImageIcon size={26} color="#2563eb" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachOption} onPress={() => handlePickDocument()} activeOpacity={0.75}>
                <View style={[styles.attachIconBg, { backgroundColor: '#fef2f2' }]}>
                  <FileText size={26} color="#dc2626" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 2. PRE-SEND ATTACHMENT PREVIEW & CAPTION MODAL */}
      <Modal visible={!!pendingAttachment} transparent animationType="slide" onRequestClose={() => setPendingAttachment(null)}>
        <View style={styles.previewModalOverlay}>
          <SafeAreaView style={styles.previewModalContent} edges={['top', 'bottom']}>
            <View style={styles.previewHeader}>
              <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPendingAttachment(null)}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.previewHeaderTitle}>
                {pendingAttachment?.type === 'image' ? 'Send Photo' : 'Send Document'}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.previewMediaContainer}>
              {pendingAttachment?.type === 'image' ? (
                <Image
                  source={{ uri: pendingAttachment.picked.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewDocBox}>
                  <View style={[styles.docPreviewIconBg, { backgroundColor: getDocumentTypeInfo(pendingAttachment?.picked.name).bgColor }]}>
                    <FileText size={48} color={getDocumentTypeInfo(pendingAttachment?.picked.name).color} />
                  </View>
                  <Text style={styles.previewDocName} numberOfLines={2}>
                    {pendingAttachment?.picked.name}
                  </Text>
                  <Text style={styles.previewDocSize}>
                    {pendingAttachment?.picked.size}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.previewBottomBar}>
              <TextInput
                style={styles.previewCaptionInput}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={pendingAttachment?.caption || ''}
                onChangeText={(text) => {
                  if (pendingAttachment) {
                    setPendingAttachment({ ...pendingAttachment, caption: text });
                  }
                }}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={styles.previewSendBtn}
                onPress={handleSendPendingAttachment}
                activeOpacity={0.85}
              >
                <Send size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* 3. FULLSCREEN IN-APP IMAGE VIEWER */}
      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.fullscreenImageViewer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={styles.fullscreenHeader}>
              <TouchableOpacity style={styles.fullscreenIconBtn} onPress={() => setViewingImage(null)}>
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.fullscreenTitle} numberOfLines={1}>
                  {viewingImage?.name || 'Photo'}
                </Text>
                {viewingImage?.time && (
                  <Text style={styles.fullscreenSub}>{viewingImage.time}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.fullscreenIconBtn}
                onPress={() => viewingImage && shareRemoteFile(viewingImage.url, viewingImage.name || 'image.jpg')}
              >
                <Share2 size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.fullscreenBody}>
              {viewingImage && (
                <Image
                  source={{ uri: viewingImage.url }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              )}
            </View>

            {viewingImage?.caption ? (
              <View style={styles.fullscreenFooter}>
                <Text style={styles.fullscreenCaptionText}>{viewingImage.caption}</Text>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>

      {/* 4. DOCUMENT ACTION SHEET MODAL */}
      <Modal visible={!!selectedDoc} transparent animationType="fade" onRequestClose={() => setSelectedDoc(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSelectedDoc(null)}
          />
          <View style={[styles.docActionSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.docActionHeader}>
              <View style={[styles.docIconBg, { backgroundColor: getDocumentTypeInfo(selectedDoc?.name).bgColor, width: 44, height: 44 }]}>
                <FileText size={22} color={getDocumentTypeInfo(selectedDoc?.name).color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.docActionTitle, { color: colors.text }]} numberOfLines={1}>
                  {selectedDoc?.name}
                </Text>
                <Text style={[styles.docActionSub, { color: colors.textSecondary }]}>
                  {selectedDoc?.size}
                </Text>
              </View>
            </View>

            <View style={styles.docActionButtons}>
              <TouchableOpacity
                style={[styles.docActionButton, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff' }]}
                onPress={handleOpenDocDirectly}
                activeOpacity={0.8}
              >
                <Eye size={20} color="#2563eb" />
                <Text style={[styles.docActionButtonText, { color: '#2563eb' }]}>Open / View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docActionButton, { backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4' }]}
                onPress={handleDownloadDoc}
                activeOpacity={0.8}
                disabled={downloadingDoc}
              >
                {downloadingDoc ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Download size={20} color="#16a34a" />
                )}
                <Text style={[styles.docActionButtonText, { color: '#16a34a' }]}>
                  {downloadingDoc ? 'Saving...' : 'Save Offline'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.docActionButton, { backgroundColor: isDarkMode ? '#1e293b' : '#faf5ff' }]}
                onPress={handleShareDoc}
                activeOpacity={0.8}
              >
                <Share2 size={20} color="#9333ea" />
                <Text style={[styles.docActionButtonText, { color: '#9333ea' }]}>Share File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactPill: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  contactName: { fontSize: 15, fontWeight: '700' },
  contactStatus: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },
  datePillWrap: { alignItems: 'center', marginBottom: 24 },
  datePill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  datePillText: { fontSize: 12, fontWeight: '700' },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  noticeText: { fontSize: 12, lineHeight: 18, flex: 1 },
  msgRow: { flexDirection: 'row', marginBottom: 12, width: '100%' },
  userMsgRow: { justifyContent: 'flex-end' },
  otherMsgRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    minWidth: 70,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 18,
    position: 'relative',
  },
  userBubble: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  otherBubble: { borderWidth: 1, borderBottomLeftRadius: 4 },

  msgInlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
    flexShrink: 1,
  },
  userMsgText: { color: '#ffffff' },

  inlineMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    marginBottom: 1,
  },
  editedText: { fontSize: 10.5, fontStyle: 'italic', marginRight: 3 },
  timeText: { fontSize: 10.5, fontWeight: '500' },
  userTimeText: { color: 'rgba(255, 255, 255, 0.7)' },

  /* ATTACHMENT RENDERING STYLES */
  imageAttachWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 4,
  },
  attachedImage: {
    width: Math.min(SCREEN_WIDTH * 0.68, 260),
    height: Math.min(SCREEN_WIDTH * 0.68, 260) * 0.75,
    borderRadius: 14,
  },

  docAttachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    minWidth: 210,
    marginBottom: 4,
  },
  docIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: { fontSize: 13, fontWeight: '700' },
  docBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  docBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  docSize: { fontSize: 11, fontWeight: '500' },

  audioAttachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    minWidth: 220,
    maxWidth: 270,
    marginBottom: 2,
  },
  audioPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioWaveformWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  audioTrackLine: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  audioProgressLine: {
    height: '100%',
    borderRadius: 2,
  },
  audioMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  audioInlineTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  /* COMPOSER */
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  uploadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  attachBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  micBtn: {
    padding: 6,
  },
  sendBtn: {
    backgroundColor: '#2563eb',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  /* VOICE RECORDING BAR */
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  recDurationText: {
    fontSize: 14,
    fontWeight: '700',
  },
  recHintText: {
    flex: 1,
    fontSize: 13,
  },
  recCancelBtn: {
    padding: 8,
  },
  recSendBtn: {
    backgroundColor: '#2563eb',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ATTACHMENT MODAL SHEET */
  inViewModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  attachSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  attachSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  attachOption: {
    alignItems: 'center',
    gap: 8,
  },
  attachIconBg: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  attachOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* PRE-SEND PREVIEW MODAL */
  previewModalOverlay: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  previewModalContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  previewMediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  previewDocBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 32,
    width: '90%',
    maxWidth: 340,
  },
  docPreviewIconBg: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  previewDocName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  previewDocSize: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  previewBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 28,
    gap: 10,
  },
  previewCaptionInput: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    maxHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
  },
  previewSendBtn: {
    backgroundColor: '#2563eb',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* FULLSCREEN IMAGE VIEWER */
  fullscreenImageViewer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  fullscreenIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  fullscreenSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenFooter: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fullscreenCaptionText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },

  /* DOCUMENT ACTION MODAL */
  docActionSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  docActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  docActionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  docActionSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  docActionButtons: {
    gap: 10,
  },
  docActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
  },
  docActionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
