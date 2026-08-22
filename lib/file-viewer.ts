import * as LegacyFS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform, Linking, Alert } from 'react-native';
import { encode } from 'base64-arraybuffer';
import { safeStorage } from './storage';

export interface OfflineFileRecord {
  docId: string;
  filename: string;
  localUri: string;
  downloadedAt: string;
}

const STORAGE_KEY = '@lecta_offline_downloaded_files';

export const getOfflineFilesMap = async (): Promise<Record<string, OfflineFileRecord>> => {
  try {
    const data = await safeStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Error reading offline files map:', e);
    return {};
  }
};

export const saveOfflineFilesMap = async (map: Record<string, OfflineFileRecord>): Promise<void> => {
  try {
    await safeStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving offline files map:', e);
  }
};

/**
 * Opens a file URL in the external browser.
 * If the file is downloaded offline, opens it via the system share sheet
 * (so apps like Word, PDF Viewer, etc. can open it directly).
 */
export const openInAppFile = async (url: string, name: string, localUri?: string): Promise<void> => {
  try {
    // If offline file exists, open via system share sheet (opens in Word, PDF viewer, etc.)
    if (localUri && Platform.OS !== 'web') {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(localUri, { dialogTitle: `Open ${name}` });
        return;
      }
    }

    if (!url) {
      Alert.alert('No File URL', 'This material does not have a valid file link.');
      return;
    }

    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }

    // Open in external browser
    await Linking.openURL(url);
  } catch (err: any) {
    console.error('Error opening file:', err);
    Alert.alert('Unable to Open File', `Could not open '${name}'.`);
  }
};

/**
 * Downloads a file from a URL to device storage using fetch + base64 write.
 * Reliable across all Expo SDK versions for binary files (PDF, PPTX, DOCX, ZIP).
 */
export const downloadFileOffline = async (
  docId: string,
  url: string,
  filename: string
): Promise<string | null> => {
  if (!url) {
    Alert.alert('Download Error', 'Invalid file URL.');
    return null;
  }

  try {
    // Web: trigger browser download
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.click();
      return url;
    }

    const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localUri = (LegacyFS.documentDirectory ?? LegacyFS.cacheDirectory ?? '') + sanitizedName;

    // Step 1: Fetch file bytes from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Server error ${response.status}: ${response.statusText}`);
    }

    // Step 2: Read as binary ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Downloaded file is empty. The file may have been removed or the URL is invalid.');
    }

    // Step 3: Convert ArrayBuffer → Base64
    const base64 = encode(arrayBuffer);

    // Step 4: Write to device document directory
    await LegacyFS.writeAsStringAsync(localUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    });

    // Step 5: Verify file exists and has content
    const info = await LegacyFS.getInfoAsync(localUri);
    if (!info.exists || (info as any).size === 0) {
      throw new Error('File was not saved correctly to device storage.');
    }

    // Step 6: Save to offline map
    const map = await getOfflineFilesMap();
    map[docId] = {
      docId,
      filename,
      localUri,
      downloadedAt: new Date().toISOString(),
    };
    await saveOfflineFilesMap(map);

    return localUri;
  } catch (e: any) {
    console.error('Error downloading file offline:', e);
    Alert.alert('Download Failed', e.message || 'Could not download the file. Please check your internet connection and try again.');
    return null;
  }
};

/**
 * Shares a remote or local file by downloading to temp cache if needed, then opening system share sheet.
 */
export const shareRemoteFile = async (url: string, filename: string): Promise<void> => {
  if (!url) {
    Alert.alert('Error', 'No file URL available.');
    return;
  }

  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      // Fallback to opening URL
      await Linking.openURL(url);
      return;
    }

    // Check if url is already a local file
    if (url.startsWith('file://') || url.startsWith('content://')) {
      await Sharing.shareAsync(url, { dialogTitle: `Share ${filename}` });
      return;
    }

    // Download to cache for sharing
    const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localUri = (LegacyFS.cacheDirectory ?? '') + sanitizedName;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not fetch file.');
    const arrayBuffer = await response.arrayBuffer();
    const base64 = encode(arrayBuffer);

    await LegacyFS.writeAsStringAsync(localUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    });

    await Sharing.shareAsync(localUri, { dialogTitle: `Share ${filename}` });
  } catch (err: any) {
    console.error('Share error:', err);
    // Fallback
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Share Failed', 'Could not share this file.');
    }
  }
};

