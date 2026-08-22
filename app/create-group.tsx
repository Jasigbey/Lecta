import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft,
  Users,
  Search,
  Check,
  Shield,
  Pin,
  Sparkles,
  Camera,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const colorOptions = [
  { bg: '#ffedd5', text: '#c2410c', name: 'Orange' },
  { bg: '#e0e7ff', text: '#4338ca', name: 'Indigo' },
  { bg: '#dbeafe', text: '#1d4ed8', name: 'Blue' },
  { bg: '#f3e8ff', text: '#6b21a8', name: 'Purple' },
  { bg: '#dcfce7', text: '#15803d', name: 'Green' },
  { bg: '#ffe4e6', text: '#be123c', name: 'Rose' },
];

const courseTags = ['General', 'DS2', 'COMPARCH', 'EMBEDSYS', 'COMPGRAPH', 'FINACCT', 'MINI-PROJECT'];

const mockContacts = [
  { id: '1', name: 'Sarah Connor', role: 'Student', dept: 'Computer Science', initials: 'SC', bg: '#dbeafe', text: '#1d4ed8' },
  { id: '2', name: 'David Miller', role: 'Student', dept: 'Computer Science', initials: 'DM', bg: '#fed7aa', text: '#ea580c' },
  { id: '3', name: 'Eliah (Class Rep)', role: 'Course Rep', dept: 'Computer Science', initials: 'EC', bg: '#e0e7ff', text: '#4338ca' },
  { id: '4', name: 'Marcus Vance', role: 'Student', dept: 'Electrical Eng.', initials: 'MV', bg: '#f3e8ff', text: '#6b21a8' },
  { id: '5', name: 'Chloe Bennett', role: 'Student', dept: 'Computer Science', initials: 'CB', bg: '#dcfce7', text: '#15803d' },
  { id: '6', name: 'Dr. Alan Turing', role: 'Lecturer', dept: 'Computer Science', initials: 'AT', bg: '#ffe4e6', text: '#be123c' },
  { id: '7', name: 'Daniel Kim', role: 'Student', dept: 'Software Eng.', initials: 'DK', bg: '#fef08a', text: '#a16207' },
];

export default function CreateGroupScreen() {
  const { colors, isDarkMode } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [selectedTag, setSelectedTag] = useState('General');
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(['3']); // Default include Course Rep
  const [memberQuery, setMemberQuery] = useState('');
  const [broadcastOnly, setBroadcastOnly] = useState(false);
  const [pinGroup, setPinGroup] = useState(false);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for your group chat.');
      return;
    }

    Alert.alert(
      'Group Chat Created!',
      `"${groupName.trim()}" has been created with ${selectedMembers.length} members.`,
      [
        {
          text: 'Open Chat',
          onPress: () => {
            router.replace({
              pathname: '/chat-detail',
              params: { name: groupName.trim() },
            });
          },
        },
      ]
    );
  };

  const filteredContacts = mockContacts.filter((c) =>
    c.name.toLowerCase().includes(memberQuery.toLowerCase()) ||
    c.dept.toLowerCase().includes(memberQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>New Group Chat</Text>

        <TouchableOpacity
          style={[
            styles.createBtn,
            { backgroundColor: groupName.trim() ? '#2563eb' : colors.cardBorder },
          ]}
          onPress={handleCreate}
          disabled={!groupName.trim()}
          activeOpacity={0.8}
        >
          <Text style={[styles.createBtnText, { color: groupName.trim() ? '#ffffff' : colors.textMuted }]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Avatar & Group Name Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.avatarRow}>
              <View style={[styles.groupAvatar, { backgroundColor: selectedColor.bg }]}>
                <Text style={[styles.groupAvatarText, { color: selectedColor.text }]}>
                  {groupName.trim() ? getInitials(groupName) : 'GP'}
                </Text>
                <View style={styles.cameraBadge}>
                  <Camera size={12} color="#ffffff" />
                </View>
              </View>

              <View style={styles.nameInputWrap}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text }]}
                  placeholder="Group Name (e.g. DS2 Project Team)"
                  placeholderTextColor={colors.textMuted}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={40}
                />
                <Text style={[styles.charCount, { color: colors.textMuted }]}>
                  {groupName.length}/40
                </Text>
              </View>
            </View>

            {/* Color Selector */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Theme Color</Text>
            <View style={styles.colorRow}>
              {colorOptions.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c.bg, borderColor: c.text },
                    selectedColor.name === c.name && styles.colorDotSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  {selectedColor.name === c.name && <Check size={14} color={c.text} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Subject / Course Tag Selector */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Course / Tag</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
              {courseTags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setSelectedTag(tag)}
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: active ? '#2563eb' : colors.inputBg,
                        borderColor: active ? '#2563eb' : colors.cardBorder,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tagText, { color: active ? '#ffffff' : colors.textSecondary }]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Group Options Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Group Settings</Text>

            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Shield size={18} color="#2563eb" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Announcements Only</Text>
                  <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                    Only Course Reps & Admins can send messages
                  </Text>
                </View>
              </View>
              <Switch
                value={broadcastOnly}
                onValueChange={setBroadcastOnly}
                trackColor={{ false: colors.cardBorder, true: '#2563eb' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />

            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>
                <Pin size={18} color="#3b82f6" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Pin Group to Top</Text>
                  <Text style={[styles.optionSub, { color: colors.textSecondary }]}>
                    Keep this group chat pinned at top of list
                  </Text>
                </View>
              </View>
              <Switch
                value={pinGroup}
                onValueChange={setPinGroup}
                trackColor={{ false: colors.cardBorder, true: '#2563eb' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Member Selection Section */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.memberHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginBottom: 0 }]}>
                Add Members ({selectedMembers.length})
              </Text>
            </View>

            {/* Member Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search classmates by name or department..."
                placeholderTextColor={colors.textMuted}
                value={memberQuery}
                onChangeText={setMemberQuery}
              />
            </View>

            {/* Contacts List */}
            {filteredContacts.map((contact) => {
              const isSelected = selectedMembers.includes(contact.id);
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.contactRow, { borderBottomColor: colors.cardBorder }]}
                  onPress={() => toggleMember(contact.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.contactAvatar, { backgroundColor: isDarkMode ? contact.text + '25' : contact.bg }]}>
                    <Text style={[styles.contactAvatarText, { color: contact.text }]}>
                      {contact.initials}
                    </Text>
                  </View>

                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                    <Text style={[styles.contactSub, { color: colors.textSecondary }]}>
                      {contact.dept} • {contact.role}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: isSelected ? '#2563eb' : 'transparent',
                        borderColor: isSelected ? '#2563eb' : colors.cardBorder,
                      },
                    ]}
                  >
                    {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
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
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  createBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  groupAvatarText: {
    fontSize: 22,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563eb',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  nameInputWrap: {
    flex: 1,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  colorDotSelected: {
    transform: [{ scale: 1.1 }],
  },
  tagRow: {
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  contactAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
  },
  contactSub: {
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
