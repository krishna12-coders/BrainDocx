import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import * as FileSystem from 'expo-file-system';
import { db, storage, functions } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { SecureViewerService } from '../services/SecureViewerService';

interface Category {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  categoryId: string;
}

interface PDFMetadata {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  subjectId: string;
  encryptedStoragePath: string;
  sizeInBytes: number;
}

interface Purchase {
  id: string;
  pdfId: string;
  status: 'active' | 'revoked';
}

export const Home: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'library' | 'store'>('library');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Firestore Sync State
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pdfs, setPdfs] = useState<PDFMetadata[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  
  // Local File States
  const [downloadedPdfs, setDownloadedPdfs] = useState<string[]>([]); // list of pdfIds
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Directory for secure storage
  const SECURE_PDF_DIR = `${FileSystem.documentDirectory}secured_pdfs/`;

  useEffect(() => {
    // 1. Prepare Secure PDF directories and cache viewer assets
    const initStorage = async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(SECURE_PDF_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(SECURE_PDF_DIR, { intermediates: true });
        }
        
        // Cache pdf.js files inside Expo DocumentDirectory
        await SecureViewerService.ensureViewerAssets();
        
        // Check already downloaded files
        await refreshDownloadedList();
      } catch (e) {
        console.error(e);
      }
    };
    initStorage();

    // 2. Setup Firestore Listeners
    if (!user) return;

    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      const items: Category[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Category));
      setCategories(items);
    });

    const unsubSubs = onSnapshot(collection(db, 'subjects'), (snap) => {
      const items: Subject[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(items);
    });

    const unsubPdfs = onSnapshot(collection(db, 'pdfs'), (snap) => {
      const items: PDFMetadata[] = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() } as PDFMetadata));
      setPdfs(items);
      setLoading(false);
    });

    // Real-time purchase sync
    const purchasesQuery = query(collection(db, 'purchases'), where('userId', '==', user.uid));
    const unsubPurchases = onSnapshot(purchasesQuery, (snap) => {
      const items: Purchase[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        items.push({ id: doc.id, pdfId: data.pdfId, status: data.status } as Purchase);
      });
      setPurchases(items);
      
      // Perform local cache pruning: if a purchase is revoked or deleted, remove the local encrypted file!
      pruneLocalCaches(items);
    });

    return () => {
      unsubCats();
      unsubSubs();
      unsubPdfs();
      unsubPurchases();
    };
  }, [user]);

  // Scan local file system for downloaded encrypted files
  const refreshDownloadedList = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(SECURE_PDF_DIR);
      // Files are saved as {pdfId}.enc
      const pdfIds = files
        .filter(file => file.endsWith('.enc'))
        .map(file => file.replace('.enc', ''));
      setDownloadedPdfs(pdfIds);
    } catch (e) {
      console.error(e);
    }
  };

  // Automatically delete encrypted local files if purchase is revoked/refunded
  const pruneLocalCaches = async (activePurchases: Purchase[]) => {
    try {
      const files = await FileSystem.readDirectoryAsync(SECURE_PDF_DIR);
      for (const file of files) {
        if (file.endsWith('.enc')) {
          const pdfId = file.replace('.enc', '');
          const purchase = activePurchases.find(p => p.pdfId === pdfId);
          // If no purchase document or status is revoked, delete the local file immediately!
          if (!purchase || purchase.status !== 'active') {
            await FileSystem.deleteAsync(SECURE_PDF_DIR + file, { idempotent: true });
            console.log(`Pruned revoked local PDF cache: ${pdfId}`);
          }
        }
      }
      await refreshDownloadedList();
    } catch (e) {
      console.error(e);
    }
  };

  // 1. Purchase PDF Function
  const handlePurchase = async (pdfId: string) => {
    Alert.alert(
      'Simulate Purchase',
      'Confirm checkout for this study material?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const purchasePdfFn = httpsCallable(functions, 'purchasePdf');
              await purchasePdfFn({ pdfId });
              Alert.alert('Success', 'PDF purchased successfully!');
            } catch (err: any) {
              Alert.alert('Checkout Failed', err.message || 'Payment processing error.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 2. Secure Download PDF Function
  const handleDownload = async (pdf: PDFMetadata) => {
    setDownloadingId(pdf.id);
    try {
      // Get download URL from storage reference
      const fileRef = ref(storage, pdf.encryptedStoragePath);
      const url = await getDownloadURL(fileRef);

      const targetPath = `${SECURE_PDF_DIR}${pdf.id}.enc`;
      
      // Download encrypted payload securely to App document sandbox
      await FileSystem.downloadAsync(url, targetPath);
      
      await refreshDownloadedList();
      Alert.alert('Download Complete', `"${pdf.title}" is now available for secure offline reading.`);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Download Failed', err.message || 'Unable to download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Filter lists based on search & category
  const activePurchaseIds = purchases.filter(p => p.status === 'active').map(p => p.pdfId);
  
  const filteredPdfs = pdfs.filter(pdf => {
    const matchesSearch = pdf.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          pdf.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? pdf.categoryId === selectedCategory : true;
    
    if (activeTab === 'library') {
      return matchesSearch && matchesCategory && activePurchaseIds.includes(pdf.id);
    } else {
      return matchesSearch && matchesCategory && !activePurchaseIds.includes(pdf.id);
    }
  });

  const renderPdfItem = ({ item }: { item: PDFMetadata }) => {
    const isPurchased = activePurchaseIds.includes(item.id);
    const isDownloaded = downloadedPdfs.includes(item.id);

    return (
      <View style={styles.pdfCard}>
        <View style={styles.cardInfo}>
          <Text style={styles.pdfTitle}>{item.title}</Text>
          <Text style={styles.pdfDesc} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.pdfMeta}>
            Size: {(item.sizeInBytes / (1024 * 1024)).toFixed(2)} MB
          </Text>
        </View>

        <View style={styles.cardActions}>
          {isPurchased ? (
            isDownloaded ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.readBtn]}
                onPress={() => navigation.navigate('Viewer', { pdfId: item.id, title: item.title })}
              >
                <Text style={styles.btnText}>Read PDF</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn]}
                onPress={() => handleDownload(item)}
                disabled={downloadingId !== null}
              >
                {downloadingId === item.id ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.btnText}>Download Offline</Text>
                )}
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.buyBtn]}
              onPress={() => handlePurchase(item.id)}
            >
              <Text style={styles.btnText}>Unlock PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BrainDocx Library</Text>
          <Text style={styles.headerSubtitle}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'library' && styles.activeTab]}
          onPress={() => setActiveTab('library')}
        >
          <Text style={[styles.tabText, activeTab === 'library' && styles.activeTabText]}>My Library</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'store' && styles.activeTab]}
          onPress={() => setActiveTab('store')}
        >
          <Text style={[styles.tabText, activeTab === 'store' && styles.activeTabText]}>Store</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Category Filter */}
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.catChip, !selectedCategory && styles.activeCatChip]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.catChipText, !selectedCategory && styles.activeCatChipText]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, selectedCategory === cat.id && styles.activeCatChip]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.catChipText, selectedCategory === cat.id && styles.activeCatChipText]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={filteredPdfs}
          keyExtractor={item => item.id}
          renderItem={renderPdfItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>
                {activeTab === 'library'
                  ? 'No purchased PDFs found. Browse the store to unlock study materials!'
                  : 'All available documents have been unlocked!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Custom Bottom Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.activeNavText]}>📚</Text>
          <Text style={[styles.navText, styles.activeNavText]}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Bookmarks')}>
          <Text style={styles.navIcon}>🔖</Text>
          <Text style={styles.navText}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.navIcon}>🔔</Text>
          <Text style={styles.navText}>News</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#ffffff',
  },
  filterContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderColor: '#334155',
    borderWidth: 1,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  categoryScroll: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  activeCatChip: {
    backgroundColor: '#3b82f6',
  },
  catChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeCatChipText: {
    color: '#ffffff',
  },
  listContainer: {
    padding: 20,
  },
  pdfCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardInfo: {
    marginBottom: 14,
  },
  pdfTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  pdfDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 18,
  },
  pdfMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 8,
  },
  cardActions: {
    alignItems: 'flex-end',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 120,
  },
  buyBtn: {
    backgroundColor: '#f97316',
  },
  downloadBtn: {
    backgroundColor: '#3b82f6',
  },
  readBtn: {
    backgroundColor: '#10b981',
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  navBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0, // adjust for iOS home indicator
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
    color: '#94a3b8',
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  activeNavText: {
    color: '#4f46e5',
  },
});
