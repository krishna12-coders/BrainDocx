import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as ScreenCapture from 'expo-screen-capture';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { functions, db } from '../services/firebase';
import { SecureViewerService } from '../services/SecureViewerService';

export const Viewer: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { pdfId, title, startPage } = route.params;
  const { user, deviceId } = useAuth();
  
  const webViewRef = useRef<WebView>(null);
  
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Securing environment...');
  const [hasError, setHasError] = useState(false);

  // Secure data payloads (only in RAM, cleared on unmount)
  const secureDataRef = useRef<{
    encryptedBase64: string | null;
    decryptionKey: string | null;
    watermark: any | null;
  }>({
    encryptedBase64: null,
    decryptionKey: null,
    watermark: null,
  });

  useEffect(() => {
    // 1. Prevent screenshots and screen recording immediately
    const enableSecurity = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
        console.log('Screenshot protection active.');
      } catch (e) {
        console.warn('Screenshot protection not supported on this platform:', e);
      }
    };
    enableSecurity();

    // 2. Fetch profile, download key and read local file
    const loadDocument = async () => {
      try {
        if (!user || !deviceId) {
          throw new Error('User session or Device ID is missing.');
        }

        // Step A: Fetch student user name from Firestore profile
        setStatusText('Checking license details...');
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userName = userSnap.exists() ? userSnap.data()?.name : user.email;

        // Step B: Call secure Cloud Function to request decryption key
        // Function verifies active purchase, device binding limits, and integrity
        setStatusText('Requesting decryption key...');
        const getDecryptionKeyFn = httpsCallable(functions, 'getDecryptionKey');
        const keyResult: any = await getDecryptionKeyFn({ pdfId, deviceId });
        
        const key = keyResult.data.key;
        if (!key) {
          throw new Error('Unauthorized key delivery request.');
        }
        secureDataRef.current.decryptionKey = key;

        // Step C: Read local encrypted file as Base64 string into memory (RAM)
        setStatusText('Reading encrypted cache...');
        const localFilePath = `${FileSystem.documentDirectory}secured_pdfs/${pdfId}.enc`;
        
        const fileInfo = await FileSystem.getInfoAsync(localFilePath);
        if (!fileInfo.exists) {
          throw new Error('Encrypted file not found. Please download it first.');
        }

        const base64Content = await FileSystem.readAsStringAsync(localFilePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        secureDataRef.current.encryptedBase64 = base64Content;

        // Step D: Construct dynamic watermark metadata
        secureDataRef.current.watermark = {
          userName: userName || 'Student',
          userId: user.uid,
          deviceId: deviceId,
          timestamp: Date.now(),
        };

        setStatusText('Injecting secure sandboxed context...');
        setLoading(false);
      } catch (error: any) {
        console.error('Failed to load secure document:', error);
        setHasError(true);
        setStatusText(error.message || 'Verification failed.');
        Alert.alert('Access Denied', error.message || 'Verification failed.');
      }
    };

    loadDocument();

    // Cleanup: Allow screenshots again and explicitly empty secure data in memory
    return () => {
      const disableSecurity = async () => {
        try {
          await ScreenCapture.allowScreenCaptureAsync();
          console.log('Screenshot protection released.');
        } catch (e) {
          console.log(e);
        }
      };
      disableSecurity();

      // Clear memory buffers to prevent memory leaks or heap inspection
      secureDataRef.current = {
        encryptedBase64: null,
        decryptionKey: null,
        watermark: null,
      };
      console.log('Secure PDF payload cleared from memory.');
    };
  }, [pdfId, user, deviceId]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Handle messages sent from WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'VIEWER_READY') {
        console.log('WebView is ready, transmitting key and encrypted bytes...');
        
        const dataPayload = {
          type: 'LOAD_PDF',
          encryptedData: secureDataRef.current.encryptedBase64,
          key: secureDataRef.current.decryptionKey,
          watermark: secureDataRef.current.watermark,
          startPage: startPage || 1,
        };

        webViewRef.current?.postMessage(JSON.stringify(dataPayload));
      } else if (message.type === 'PAGE_CHANGED') {
        setCurrentPage(message.page);
        setTotalPages(message.total);

        // Sync reading progress to Firestore (merge: true)
        if (user) {
          const progressId = `${user.uid}_${pdfId}`;
          const progressRef = doc(db, 'readingProgress', progressId);
          // Set progress asynchronously without blocking UI
          setDoc(progressRef, {
            userId: user.uid,
            pdfId: pdfId,
            lastPage: message.page,
            totalPages: message.total,
            updatedAt: new Date(), // Using local JS date for offline-friendly sync support
          }, { merge: true }).catch(err => {
            console.log('Failed to sync reading progress to Firestore:', err);
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add a bookmark for the current page
  const handleBookmarkPage = async () => {
    if (!user || !currentPage) return;
    try {
      const bookmarkId = `${user.uid}_${pdfId}_${currentPage}`;
      await setDoc(doc(db, 'bookmarks', bookmarkId), {
        userId: user.uid,
        pdfId: pdfId,
        pageNumber: currentPage,
        createdAt: new Date(),
      });
      Alert.alert('Bookmark Saved', `Page ${currentPage} has been bookmarked.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save bookmark.');
    }
  };

  // HTML viewer source with correct baseUrl for referencing local assets relative to documents directory
  const localViewerHtmlUri = SecureViewerService.getViewerUri();

  if (hasError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorView}>
          <Text style={styles.errorText}>Viewer Initialization Blocked</Text>
          <Text style={styles.errorDesc}>{statusText}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.closeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>◀ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.bookmarkBtn} onPress={handleBookmarkPage} disabled={loading}>
          <Text style={[styles.bookmarkBtnText, loading && styles.disabledText]}>🔖 Mark</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: localViewerHtmlUri }}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            mixedContentMode="always"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
            style={styles.webView}
            mediaPlaybackRequiresUserAction={true}
            geolocationEnabled={false}
          />
        )}
      </View>

      {!loading && (
        <View style={styles.footerBar}>
          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages}
          </Text>
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${(currentPage / totalPages) * 100}%` }
              ]} 
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  appBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  bookmarkBtn: {
    padding: 8,
  },
  bookmarkBtnText: {
    color: '#f97316',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledText: {
    color: '#475569',
  },
  content: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#1e293b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorDesc: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  closeBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  footerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
    justifyContent: 'space-between',
  },
  pageText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: 3,
  },
});
