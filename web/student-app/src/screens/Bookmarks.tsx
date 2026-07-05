import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface Bookmark {
  id: string;
  pdfId: string;
  pageNumber: number;
  createdAt: any;
}

interface ReadingProgress {
  id: string;
  pdfId: string;
  lastPage: number;
  totalPages: number;
  updatedAt: any;
}

interface PDFMetadata {
  id: string;
  title: string;
}

export const Bookmarks: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [progresses, setProgresses] = useState<ReadingProgress[]>([]);
  const [pdfs, setPdfs] = useState<PDFMetadata[]>([]);

  useEffect(() => {
    if (!user) return;

    // 1. Listen to PDFs (to resolve titles)
    const unsubPdfs = onSnapshot(collection(db, 'pdfs'), (snap) => {
      const items: PDFMetadata[] = [];
      snap.forEach(doc => {
        items.push({ id: doc.id, title: doc.data().title } as PDFMetadata);
      });
      setPdfs(items);
    });

    // 2. Listen to Bookmarks
    const bookmarksQuery = query(collection(db, 'bookmarks'), where('userId', '==', user.uid));
    const unsubBookmarks = onSnapshot(bookmarksQuery, (snap) => {
      const items: Bookmark[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        items.push({ id: doc.id, pdfId: data.pdfId, pageNumber: data.pageNumber, createdAt: data.createdAt } as Bookmark);
      });
      setBookmarks(items);
    });

    // 3. Listen to Reading Progress
    const progressQuery = query(collection(db, 'readingProgress'), where('userId', '==', user.uid));
    const unsubProgress = onSnapshot(progressQuery, (snap) => {
      const items: ReadingProgress[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        items.push({ id: doc.id, pdfId: data.pdfId, lastPage: data.lastPage, totalPages: data.totalPages, updatedAt: data.updatedAt } as ReadingProgress);
      });
      setProgresses(items);
      setLoading(false);
    });

    return () => {
      unsubPdfs();
      unsubBookmarks();
      unsubProgress();
    };
  }, [user]);

  const handleDeleteBookmark = async (bookmarkId: string) => {
    try {
      await deleteDoc(doc(db, 'bookmarks', bookmarkId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove bookmark.');
    }
  };

  const getPdfTitle = (pdfId: string) => {
    return pdfs.find(p => p.id === pdfId)?.title || 'Unknown Document';
  };

  const renderBookmarkItem = ({ item }: { item: Bookmark }) => {
    const pdfTitle = getPdfTitle(item.pdfId);
    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.pdfTitle}>{pdfTitle}</Text>
          <Text style={styles.metaText}>Bookmarked Page {item.pageNumber}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn]}
            onPress={() => navigation.navigate('Viewer', { pdfId: item.pdfId, title: pdfTitle, startPage: item.pageNumber })}
          >
            <Text style={styles.btnText}>Open Page</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn]}
            onPress={() => handleDeleteBookmark(item.id)}
          >
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProgressItem = ({ item }: { item: ReadingProgress }) => {
    const pdfTitle = getPdfTitle(item.pdfId);
    const percentage = ((item.lastPage / item.totalPages) * 100).toFixed(0);

    return (
      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.pdfTitle}>{pdfTitle}</Text>
          <Text style={styles.metaText}>
            Progress: {percentage}% ({item.lastPage} of {item.totalPages} pages)
          </Text>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.btn, styles.accentBtn]}
          onPress={() => navigation.navigate('Viewer', { pdfId: item.pdfId, title: pdfTitle, startPage: item.lastPage })}
        >
          <Text style={styles.btnText}>Resume</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Progress</Text>
      </View>

      <ScrollViewSection title="Continue Reading" count={progresses.length}>
        <FlatList
          data={progresses}
          keyExtractor={item => item.id}
          renderItem={renderProgressItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No reading history recorded. Open a PDF to start reading.</Text>
          }
        />
      </ScrollViewSection>

      <ScrollViewSection title="Saved Bookmarks" count={bookmarks.length}>
        <FlatList
          data={bookmarks}
          keyExtractor={item => item.id}
          renderItem={renderBookmarkItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No saved bookmarks. Mark pages in the PDF reader to save them here.</Text>
          }
        />
      </ScrollViewSection>

      {/* Custom Bottom Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navText}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.activeNavText]}>🔖</Text>
          <Text style={[styles.navText, styles.activeNavText]}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.navIcon}>🔔</Text>
          <Text style={styles.navText}>News</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// Helper section component to avoid heavy rendering hierarchy warnings in React Native
const ScrollViewSection: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      {title} {count > 0 ? `(${count})` : ''}
    </Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  section: {
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  pdfTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  metaText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  progressBg: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginTop: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
  },
  accentBtn: {
    backgroundColor: '#10b981',
  },
  deleteBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  navBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
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
