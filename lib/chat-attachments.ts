import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';

export interface ChatAttachment {
  url: string;
  type: 'image' | 'document' | 'audio';
  name?: string;
  size?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface ParsedMessageContent {
  text: string;
  attachment?: ChatAttachment;
}

export interface PickedMedia {
  uri: string;
  name: string;
  size: string;
  mimeType: string;
  width?: number;
  height?: number;
}

/**
 * Format bytes to clean human-readable size string (e.g. 450 KB, 2.4 MB).
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'File';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file details (extension badge, color, label) based on filename.
 */
export function getDocumentTypeInfo(filename?: string): { ext: string; color: string; bgColor: string } {
  if (!filename) return { ext: 'FILE', color: '#64748b', bgColor: '#f1f5f9' };
  const ext = (filename.split('.').pop() || 'FILE').toUpperCase();

  switch (ext) {
    case 'PDF':
      return { ext: 'PDF', color: '#dc2626', bgColor: '#fef2f2' };
    case 'DOC':
    case 'DOCX':
      return { ext: 'DOC', color: '#2563eb', bgColor: '#eff6ff' };
    case 'XLS':
    case 'XLSX':
    case 'CSV':
      return { ext: 'XLS', color: '#16a34a', bgColor: '#f0fdf4' };
    case 'PPT':
    case 'PPTX':
      return { ext: 'PPT', color: '#ea580c', bgColor: '#fff7ed' };
    case 'ZIP':
    case 'RAR':
    case '7Z':
      return { ext: 'ZIP', color: '#9333ea', bgColor: '#faf5ff' };
    case 'TXT':
      return { ext: 'TXT', color: '#475569', bgColor: '#f8fafc' };
    default:
      return { ext: ext.length > 4 ? ext.substring(0, 4) : ext, color: '#2563eb', bgColor: '#eff6ff' };
  }
}

/**
 * Parse message content safely. Supports both legacy plain text strings and JSON structured messages.
 */
export function parseMessageContent(rawContent: string): ParsedMessageContent {
  if (!rawContent) return { text: '' };
  
  const trimmed = rawContent.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && (parsed.text !== undefined || parsed.attachment !== undefined)) {
        return {
          text: parsed.text || '',
          attachment: parsed.attachment,
        };
      }
    } catch {
      // Fallback to plain text
    }
  }

  return { text: rawContent };
}

/**
 * Serialize a message with optional attachment into storage format.
 */
export function serializeMessageContent(text: string, attachment?: ChatAttachment): string {
  if (!attachment) {
    return text;
  }
  return JSON.stringify({
    text: text || '',
    attachment,
  });
}

/**
 * Convert any local file URI into a Base64 string safely across all platforms.
 */
export async function uriToBase64(uri: string): Promise<string> {
  // Method 1: Fetch blob and use FileReader
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = (reader.result as string) || '';
        const data = res.includes(',') ? res.split(',')[1] : res;
        resolve(data);
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
    if (b64) return b64;
  } catch (blobErr) {
    // Continue to next method
  }

  // Method 2: expo-file-system / legacy
  try {
    const LegacyFS = require('expo-file-system/legacy');
    if (LegacyFS?.readAsStringAsync) {
      const b64 = await LegacyFS.readAsStringAsync(uri, {
        encoding: LegacyFS.EncodingType?.Base64 || 'base64',
      });
      if (b64) return b64;
    }
  } catch {}

  try {
    const FileSystem = require('expo-file-system');
    if (FileSystem?.readAsStringAsync) {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType?.Base64 || 'base64',
      });
      if (b64) return b64;
    }
  } catch {}

  return '';
}

/**
 * Upload any local file URI to Supabase Storage with binary ArrayBuffer conversion.
 */
export async function uploadChatAttachment(
  localUri: string,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<string> {
  const sanitizedName = (fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `chat_${userId || 'guest'}/${Date.now()}_${sanitizedName}`;

  const base64String = await uriToBase64(localUri);
  const fallbackUri = base64String
    ? `data:${mimeType || 'image/jpeg'};base64,${base64String}`
    : localUri;

  let binaryData: any = null;
  if (base64String) {
    try {
      binaryData = decode(base64String);
    } catch {}
  }

  if (!binaryData) {
    try {
      const response = await fetch(localUri);
      binaryData = await response.blob();
    } catch {}
  }

  if (!binaryData) {
    return fallbackUri;
  }

  try {
    let uploadedBucket: string | null = null;
    const candidateBuckets = ['chat-attachments', 'course-materials', 'avatars'];

    for (const bucket of candidateBuckets) {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, binaryData, {
          contentType: mimeType || 'application/octet-stream',
          upsert: true,
        });

      if (!uploadError) {
        uploadedBucket = bucket;
        break;
      } else {
        console.warn(`Upload to '${bucket}' failed:`, uploadError.message);
      }
    }

    if (uploadedBucket) {
      const { data: urlData } = supabase.storage.from(uploadedBucket).getPublicUrl(storagePath);
      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }
    }

    return fallbackUri;
  } catch (err) {
    console.warn('Error during storage upload, using local fallback:', err);
    return fallbackUri;
  }
}

/**
 * Pick an image from gallery or take a photo with the camera safely.
 */
export async function pickChatImage(fromCamera: boolean = false): Promise<PickedMedia | null> {
  try {
    if (fromCamera) {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings to take photos.');
          return null;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return null;
      const asset = result.assets[0];
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const sizeBytes = asset.fileSize ?? (asset as any).size;
      return {
        uri: asset.uri,
        name,
        size: formatFileSize(sizeBytes),
        mimeType: asset.mimeType || 'image/jpeg',
        width: asset.width,
        height: asset.height,
      };
    } else {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Photo Library Permission Required', 'Please enable photo library access in your device settings to select images.');
          return null;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return null;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = asset.mimeType || (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const name = asset.fileName || `image_${Date.now()}.${ext}`;
      const sizeBytes = asset.fileSize ?? (asset as any).size;
      return {
        uri: asset.uri,
        name,
        size: formatFileSize(sizeBytes),
        mimeType,
        width: asset.width,
        height: asset.height,
      };
    }
  } catch (err: any) {
    console.error('Pick chat image error:', err);
    Alert.alert('Camera / Photo Error', err?.message || 'Could not open camera or photo library.');
    return null;
  }
}

/**
 * Pick a document (PDF, Word, zip, text, etc.) from device storage safely.
 */
export async function pickChatDocument(): Promise<PickedMedia | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    const asset = result.assets[0];
    const sizeBytes = asset.size ?? (asset as any).fileSize;
    return {
      uri: asset.uri,
      name: asset.name || `document_${Date.now()}`,
      size: formatFileSize(sizeBytes),
      mimeType: asset.mimeType || 'application/octet-stream',
    };
  } catch (err: any) {
    console.error('Pick chat document error:', err);
    Alert.alert('Document Picker Error', err?.message || 'Could not open files app.');
    return null;
  }
}
