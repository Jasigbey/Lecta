import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Upload,
  Paperclip,
  CheckCircle2,
  ChevronDown,
  X,
  FileText,
  File,
  BookOpen,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFS from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { sendInstantNotification } from '../lib/notifications';

type FileType = 'pdf' | 'pptx' | 'docx' | 'zip' | 'other';

const courseOptions = [
  { code: 'DS2',        title: 'Data Structures II',          color: '#2563eb' },
  { code: 'COMPARCH',   title: 'Computer Architecture',        color: '#7c3aed' },
  { code: 'COMPGRAPH',  title: 'Computer Graphics',            color: '#10b981' },
  { code: 'EMBEDSYS',   title: 'Embedded System',              color: '#f59e0b' },
  { code: 'FINACCT',    title: 'Financial Accounting',         color: '#0284c7' },
  { code: 'ECOMM',      title: 'E-Commerce',                   color: '#4f46e5' },
  { code: 'OPRESEARCH', title: 'Operations Research II',       color: '#db2777' },
  { code: 'RESMETHOD',  title: 'Research Method & IT Project', color: '#059669' },
];

const fileTypeOptions: { value: FileType; label: string; ext: string }[] = [
  { value: 'pdf',   label: 'PDF Document',      ext: '.pdf'  },
  { value: 'pptx',  label: 'PowerPoint Slides', ext: '.pptx' },
  { value: 'docx',  label: 'Word Document',     ext: '.docx' },
  { value: 'zip',   label: 'ZIP Archive',       ext: '.zip'  },
  { value: 'other', label: 'Other',             ext: ''      },
];

function getFileIcon(type: FileType | null, color: string) {
  if (type === 'pptx') return <BookOpen size={22} color={color} />;
  if (type === 'zip')  return <File     size={22} color={color} />;
  return <FileText size={22} color={color} />;
}

export default function UploadMaterialScreen() {
  const { colors, isDarkMode } = useTheme();

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedType, setSelectedType]     = useState<FileType | null>(null);
  const [attachment, setAttachment]         = useState<string | null>(null);

  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [showTypePicker, setShowTypePicker]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedFileUri, setPickedFileUri]   = useState<string | null>(null);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [pickedFileSize, setPickedFileSize] = useState<string>('Unknown');
  const [pickedFileMimeType, setPickedFileMimeType] = useState<string>('application/octet-stream');

  const course       = courseOptions.find((c) => c.code === selectedCourse);
  const fileTypeInfo = fileTypeOptions.find((f) => f.value === selectedType);
  const isValid      = !!selectedCourse && !!selectedType && !!pickedFileUri;

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      setPickedFileUri(asset.uri);
      setPickedFileName(asset.name);
      setAttachment(asset.name);
      setPickedFileMimeType(asset.mimeType || 'application/octet-stream');

      // Format file size
      if (asset.size) {
        const kb = asset.size / 1024;
        const mb = kb / 1024;
        setPickedFileSize(mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(kb)} KB`);
      }

      // Auto-detect file type
      const ext = asset.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') setSelectedType('pdf');
      else if (ext === 'pptx' || ext === 'ppt') setSelectedType('pptx');
      else if (ext === 'docx' || ext === 'doc') setSelectedType('docx');
      else if (ext === 'zip') setSelectedType('zip');
      else setSelectedType('other');
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file.');
    }
  };

  const handleUpload = async () => {
    if (!isValid) {
      Alert.alert('Missing Fields', 'Please select a course, file type, and attach a file before uploading.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to upload materials.');
      return;
    }

    setUploading(true);

    // Find course_id from courses table
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('code', selectedCourse)
      .single();

    if (courseError || !courseData) {
      setUploading(false);
      Alert.alert(
        'Course Not Found',
        `The course "${selectedCourse}" is not set up in the database yet. Please add it to the courses table first.`
      );
      return;
    }

    let fileUrl = '';

    // Upload file to Supabase Storage
    if (pickedFileUri) {
      const fileName = pickedFileName || `file_${Date.now()}`;
      const storagePath = `materials/${user.id}/${Date.now()}_${fileName}`;

      let fileData: any;

      try {
        if (Platform.OS === 'web') {
          const response = await fetch(pickedFileUri);
          fileData = await response.blob();
        } else {
          // Read file as Base64 on Android/iOS
          const base64 = await LegacyFS.readAsStringAsync(pickedFileUri, {
            encoding: LegacyFS.EncodingType.Base64,
          });
          // Decode Base64 to ArrayBuffer (official Supabase React Native format)
          fileData = decode(base64);
        }
      } catch (readErr: any) {
        setUploading(false);
        console.error('File read error:', readErr);
        Alert.alert('Upload Failed', 'Could not read the selected file.');
        return;
      }

      const { data: storageData, error: storageError } = await supabase.storage
        .from('course-materials')
        .upload(storagePath, fileData, {
          contentType: pickedFileMimeType || 'application/octet-stream',
          upsert: false,
        });

      if (storageError) {
        setUploading(false);
        console.error('Storage Upload Error:', storageError);
        Alert.alert('Upload Failed', storageError.message);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('course-materials')
        .getPublicUrl(storagePath);

      fileUrl = urlData?.publicUrl || storagePath;
    }

    const { error } = await supabase.from('course_materials').insert({
      course_id: courseData.id,
      uploaded_by: user.id,
      title: title.trim() || pickedFileName || 'Untitled',
      description: description.trim() || null,
      file_url: fileUrl,
      file_size: pickedFileSize,
      file_type: selectedType || 'pdf',
    });

    setUploading(false);

    if (error) {
      console.error('Upload Material Error:', error);
      Alert.alert('Upload Failed', error.message);
      return;
    }

    // Trigger native pop-up notification on device
    await sendInstantNotification(
      `📁 Material Uploaded: ${title || pickedFileName}`,
      `Shared to ${course?.title || selectedCourse}`,
      { targetRoute: '/documents' }
    );

    Alert.alert(
      'File Uploaded! 🎉',
      `"${title || pickedFileName}" has been shared to ${course?.title}.`,
      [{ text: 'Done', onPress: () => router.back() }]
    );
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Upload Material</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Share files with your class</Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadHeaderBtn, !isValid && styles.uploadBtnDisabled]}
          onPress={handleUpload}
          activeOpacity={0.8}
        >
          <Upload size={15} color="#ffffff" />
          <Text style={styles.uploadHeaderBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* File Drop Zone */}
          <TouchableOpacity
            style={[
              styles.dropZone,
              {
                backgroundColor: attachment
                  ? (isDarkMode ? '#0c2a1a' : '#f0fdf4')
                  : (isDarkMode ? colors.card : '#f8faff'),
                borderColor: attachment ? '#10b981' : colors.cardBorder,
              },
            ]}
            onPress={handlePickFile}
            activeOpacity={0.8}
          >
            {attachment ? (
              <>
                <View style={[styles.dropZoneIcon, { backgroundColor: '#dcfce7' }]}>
                  {getFileIcon(selectedType, '#10b981')}
                </View>
                <Text style={[styles.dropZoneFileText, { color: '#10b981' }]} numberOfLines={1}>
                  {attachment}
                </Text>
                <Text style={[styles.dropZoneHint, { color: colors.textMuted }]}>Tap to change file</Text>
                <TouchableOpacity
                  style={styles.removeAttachBtn}
                  onPress={() => setAttachment(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={16} color="#ef4444" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.dropZoneIcon, { backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff' }]}>
                  <Paperclip size={28} color="#2563eb" />
                </View>
                <Text style={[styles.dropZoneTitle, { color: colors.text }]}>Tap to attach a file</Text>
                <Text style={[styles.dropZoneHint, { color: colors.textMuted }]}>
                  PDF, PPTX, DOCX, ZIP — up to 50 MB
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Course Selector */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Course <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.selectorBtn,
              { backgroundColor: colors.card, borderColor: selectedCourse ? (course?.color ?? '#2563eb') : colors.cardBorder },
            ]}
            onPress={() => { setShowCoursePicker((v) => !v); setShowTypePicker(false); }}
            activeOpacity={0.8}
          >
            {course && <View style={[styles.courseDot, { backgroundColor: course.color }]} />}
            <Text style={[styles.selectorText, { color: selectedCourse ? colors.text : colors.textMuted }]}>
              {course ? `${course.code} — ${course.title}` : 'Select a course…'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {showCoursePicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {courseOptions.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.pickerOption,
                    selectedCourse === c.code && styles.pickerOptionActive,
                    { borderBottomColor: colors.cardBorder },
                  ]}
                  onPress={() => { setSelectedCourse(c.code); setShowCoursePicker(false); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.courseDot, { backgroundColor: c.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerOptionCode, { color: c.color }]}>{c.code}</Text>
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>{c.title}</Text>
                  </View>
                  {selectedCourse === c.code && <CheckCircle2 size={16} color={c.color} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* File Type Selector */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>
            File Type <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.selectorBtn,
              { backgroundColor: colors.card, borderColor: selectedType ? '#2563eb' : colors.cardBorder },
            ]}
            onPress={() => { setShowTypePicker((v) => !v); setShowCoursePicker(false); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.selectorText, { color: selectedType ? colors.text : colors.textMuted }]}>
              {fileTypeInfo ? `${fileTypeInfo.label} (${fileTypeInfo.ext || 'any'})` : 'Select file type…'}
            </Text>
            <ChevronDown size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {showTypePicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {fileTypeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.pickerOption,
                    selectedType === opt.value && styles.pickerOptionActive,
                    { borderBottomColor: colors.cardBorder },
                  ]}
                  onPress={() => { setSelectedType(opt.value); setShowTypePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerOptionText, { color: selectedType === opt.value ? '#2563eb' : colors.text, flex: 1 }]}>
                    {opt.label}
                    {opt.ext ? <Text style={{ color: colors.textMuted }}> {opt.ext}</Text> : null}
                  </Text>
                  {selectedType === opt.value && <CheckCircle2 size={16} color="#2563eb" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Title (optional) */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 18 }]}>
            Display Title <Text style={[styles.optional, { color: colors.textMuted }]}>(optional)</Text>
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: title ? '#2563eb' : colors.cardBorder }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="e.g. Week 4 Lecture Notes — Trees"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              returnKeyType="next"
            />
          </View>
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/100</Text>

          {/* Description (optional) */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Description <Text style={[styles.optional, { color: colors.textMuted }]}>(optional)</Text>
          </Text>
          <View style={[styles.inputWrap, styles.descWrap, { backgroundColor: colors.card, borderColor: description ? '#2563eb' : colors.cardBorder }]}>
            <TextInput
              style={[styles.descInput, { color: colors.text }]}
              placeholder="Add a short description to help classmates…"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              maxLength={300}
            />
          </View>
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{description.length}/300</Text>

          {/* Summary Preview */}
          {isValid && (
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: course?.color ?? '#2563eb' }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>READY TO UPLOAD</Text>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryIcon, { backgroundColor: (course?.color ?? '#2563eb') + '20' }]}>
                  {getFileIcon(selectedType, course?.color ?? '#2563eb')}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryFileName, { color: colors.text }]} numberOfLines={1}>
                    {title || attachment}
                  </Text>
                  <Text style={[styles.summaryCourse, { color: course?.color }]}>
                    {course?.code} — {course?.title}
                  </Text>
                  <Text style={[styles.summaryType, { color: colors.textSecondary }]}>
                    {fileTypeInfo?.label}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Upload Button */}
          <TouchableOpacity
            style={[styles.uploadBottomBtn, (!isValid || uploading) && styles.uploadBtnDisabled]}
            onPress={handleUpload}
            activeOpacity={0.85}
            disabled={uploading}
          >
            <Upload size={18} color="#ffffff" />
            <Text style={styles.uploadBottomText}>
              {uploading ? 'Uploading...' : 'Upload to Course'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Header */
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

  uploadHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  uploadBtnDisabled: { backgroundColor: '#2563eb' },
  uploadHeaderBtnText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  /* Content */
  content: { paddingHorizontal: 16, paddingTop: 20 },

  /* Drop zone */
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginBottom: 24,
    position: 'relative',
  },
  dropZoneIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropZoneTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  dropZoneFileText: { fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  dropZoneHint: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  removeAttachBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Labels */
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  required: { color: '#ef4444' },
  optional: { fontSize: 11, fontWeight: '500', textTransform: 'none' },

  /* Selectors */
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  selectorText: { flex: 1, fontSize: 15, fontWeight: '500' },
  courseDot: { width: 10, height: 10, borderRadius: 5 },

  pickerDropdown: {
    borderWidth: 1.5,
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 10,
  },
  pickerOptionActive: { backgroundColor: '#eff6ff' },
  pickerOptionCode: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  pickerOptionText: { fontSize: 14, fontWeight: '600' },

  /* Inputs */
  inputWrap: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textInput: { fontSize: 15, fontWeight: '500', padding: 0 },
  descWrap: { minHeight: 100 },
  descInput: { fontSize: 15, lineHeight: 22, padding: 0, minHeight: 80 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 2 },

  /* Summary Card */
  summaryCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryFileName: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  summaryCourse: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  summaryType: { fontSize: 12, fontWeight: '500' },

  /* Upload Button */
  uploadBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 17,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  uploadBottomText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
});
