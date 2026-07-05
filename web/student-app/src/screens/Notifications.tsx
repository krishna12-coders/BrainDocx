import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

interface Announcement {
  id: string;
  title: string;
  body: string;
  sentAt: any;
}

export const Notifications: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;

    // Retrieve notifications that are public ('all') or targeted specifically to this student
    const notifQuery = query(
      collection(db, 'notifications'),
      where('target', 'in', ['all', user.uid])
    );

    const unsubscribe = onSnapshot(notifQuery, (snap) => {
      const items: Announcement[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          title: data.title,
          body: data.body,
          sentAt: data.sentAt,
        } as Announcement);
      });

      // Sort client-side because composite indexes may not be created in dev emulators
      items.sort((a, b) => {
        const timeA = a.sentAt ? a.sentAt.seconds : 0;
        const timeB = b.sentAt ? b.sentAt.seconds : 0;
        return timeB - timeA; // newest first
      });

      setAnnouncements(items);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const renderItem = ({ item }: { item: Announcement }) => {
    const dateStr = item.sentAt
      ? new Date(item.sentAt.seconds * 1000).toLocaleString()
      : 'Just now';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
        <Text style={styles.cardBody}>{item.body}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={styles.emptyText}>No notifications or announcements at this time.</Text>
            </View>
          }
        />
      )}

      {/* Custom Bottom Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navText}>Library</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Bookmarks')}>
          <Text style={styles.navIcon}>🔖</Text>
          <Text style={styles.navText}>Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <Text style={[styles.navIcon, styles.activeNavText]}>🔔</Text>
          <Text style={[styles.navText, styles.activeNavText]}>News</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  listContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  cardBody: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
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
