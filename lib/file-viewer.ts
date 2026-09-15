import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as LegacyFS from 'expo-file-system/legacy';
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
 * Opens any document (PDF, Word, PPT, Excel, etc.) or Data URI seamlessly:
 * - Remote HTTP/HTTPS links: Opens in-app Safari / Chrome viewer with full zoom and scroll.
 * - Base64 Data URIs: Decodes to cache and opens via native document viewer/share sheet.
 * - Offline/Local files: Launches native viewer / share sheet.
 */
export const openInAppFile = async (url: string, name: string, localUri?: string): Promise<void> => {
  try {
    const targetUri = (localUri || url || '').trim();
    if (!targetUri) {
      Alert.alert('No File URL', 'This document does not have a valid file link.');
      return;
    }

    const safeName = (name || `document_${Date.now()}`).trim();
    const hasExt = safeName.includes('.');
    const ext = hasExt ? '' : (targetUri.includes('.pdf') || targetUri.includes('pdf') ? '.pdf' : '.pdf');
    const filename = `${safeName.replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`;

    // 1. Web
    if (Platform.OS === 'web') {
      if (targetUri.startsWith('data:')) {
        const win = window.open();
        if (win) {
          win.document.write(`<iframe src="${targetUri}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        }
      } else {
        window.open(targetUri, '_blank');
      }
      return;
    }

    // 2. Remote HTTP / HTTPS URL (Supabase or public URL)
    if (targetUri.startsWith('http://') || targetUri.startsWith('https://')) {
      try {
        await WebBrowser.openBrowserAsync(targetUri);
        return;
      } catch (browserErr) {
        console.warn('WebBrowser open failed, falling back to Linking:', browserErr);
        await Linking.openURL(targetUri);
        return;
      }
    }

    // 3. Base64 Data URI (data:application/pdf;base64,...)
    if (targetUri.startsWith('data:')) {
      const cacheDir = LegacyFS?.cacheDirectory || LegacyFS?.documentDirectory || '';
      const cacheUri = `${cacheDir}${Date.now()}_${filename}`;
      const base64Data = targetUri.includes(',') ? targetUri.split(',')[1] : targetUri;

      try {
        await LegacyFS.writeAsStringAsync(cacheUri, base64Data, {
          encoding: LegacyFS.EncodingType?.Base64 || 'base64',
        });
        const isShareAvailable = await Sharing.isAvailableAsync();
        if (isShareAvailable) {
          await Sharing.shareAsync(cacheUri, { dialogTitle: `Open ${name}` });
          return;
        }
      } catch (writeErr) {
        console.warn('Could not write base64 to cache:', writeErr);
      }
    }

    // 4. Local file URI (file:// or content://)
    if (targetUri.startsWith('file://') || targetUri.startsWith('content://')) {
      const isShareAvailable = await Sharing.isAvailableAsync();
      if (isShareAvailable) {
        await Sharing.shareAsync(targetUri, { dialogTitle: `Open ${name}` });
        return;
      }
      await Linking.openURL(targetUri);
      return;
    }

    // 5. Fallback
    await Linking.openURL(targetUri);
  } catch (err: any) {
    console.error('Error opening file:', err);
    try {
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to Open File', `Could not open '${name}'.`);
      }
    } catch {
      Alert.alert('Unable to Open File', `Could not open '${name}'.`);
    }
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
      await WebBrowser.openBrowserAsync(url);
      return;
    }

    // Check if url is already a local file
    if (url.startsWith('file://') || url.startsWith('content://')) {
      await Sharing.shareAsync(url, { dialogTitle: `Share ${filename}` });
      return;
    }

    // Base64 data URI
    if (url.startsWith('data:')) {
      const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const localUri = (LegacyFS.cacheDirectory ?? '') + sanitizedName;
      const base64Data = url.includes(',') ? url.split(',')[1] : url;
      await LegacyFS.writeAsStringAsync(localUri, base64Data, {
        encoding: LegacyFS.EncodingType.Base64,
      });
      await Sharing.shareAsync(localUri, { dialogTitle: `Share ${filename}` });
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
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Share Failed', 'Could not share this file.');
    }
  }
};
