import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as LegacyFS from 'expo-file-system/legacy';
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
 * Upload any local file URI to Supabase Storage with binary ArrayBuffer conversion.
 */
export async function uploadChatAttachment(
  localUri: string,
  fileName: string,
  mimeType: string,
  userId: string
): Promise<string> {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `chat_${userId}/${Date.now()}_${sanitizedName}`;

  let binaryData: any;

  if (Platform.OS === 'web') {
    const response = await fetch(localUri);
    binaryData = await response.blob();
  } else {
    // Read file as Base64 on mobile
    const base64 = await LegacyFS.readAsStringAsync(localUri, {
      encoding: LegacyFS.EncodingType.Base64,
    });
    binaryData = decode(base64);
  }

  try {
    // Try uploading to 'chat-attachments' bucket, or fallback to 'course-materials' or 'avatars'
    let bucketName = 'chat-attachments';
    let { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, binaryData, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      bucketName = 'course-materials';
      const fallback = await supabase.storage
        .from(bucketName)
        .upload(storagePath, binaryData, {
          contentType: mimeType,
          upsert: true,
        });

      if (fallback.error) {
        bucketName = 'avatars';
        const lastTry = await supabase.storage
          .from(bucketName)
          .upload(storagePath, binaryData, {
            contentType: mimeType,
            upsert: true,
          });

        if (lastTry.error) {
          console.warn('Storage upload error, using local file URI fallback:', uploadError || fallback.error || lastTry.error);
          return localUri;
        }
      }
    }

    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return urlData?.publicUrl || localUri;
  } catch (err) {
    console.warn('Error during storage upload, using local URI fallback:', err);
    return localUri;
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
          Alert.alert('Camera Permission', 'Camera permission is required to capture photos. Please enable it in device settings.');
          return null;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return null;
      const asset = result.assets[0];
      const name = `photo_${Date.now()}.jpg`;
      return {
        uri: asset.uri,
        name,
        size: formatFileSize(asset.fileSize),
        mimeType: 'image/jpeg',
        width: asset.width,
        height: asset.height,
      };
    } else {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Photo Permission', 'Photo library permission is required to select photos. Please enable it in device settings.');
          return null;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return null;
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const name = asset.fileName || `image_${Date.now()}.${ext}`;
      return {
        uri: asset.uri,
        name,
        size: formatFileSize(asset.fileSize),
        mimeType,
        width: asset.width,
        height: asset.height,
      };
    }
  } catch (err: any) {
    console.error('Pick chat image error:', err);
    Alert.alert('Selection Error', err.message || 'Could not open camera or photo gallery.');
    return null;
  }
}

/**
 * Pick a document (PDF, Word, zip, text, etc.) from device storage safely.
 */
export function pickChatDocument(): Promise<PickedMedia | null> {
  return new Promise((resolve) => {
    DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    })
      .then((result) => {
        if (result.canceled || !result.assets || result.assets.length === 0) {
          resolve(null);
          return;
        }
        const asset = result.assets[0];
        resolve({
          uri: asset.uri,
          name: asset.name || `doc_${Date.now()}`,
          size: formatFileSize(asset.size),
          mimeType: asset.mimeType || 'application/octet-stream',
        });
      })
      .catch((err) => {
        console.error('Pick chat document error:', err);
        Alert.alert('Selection Error', err?.message || 'Could not open files app.');
        resolve(null);
      });
  });
}
