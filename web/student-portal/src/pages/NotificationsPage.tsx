import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

interface Notification {
  id: string;
  title: string;
  body: string;
  target: 'all' | string;
  createdAt: number;
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, 'notifications'), snap => {
      const arr: Notification[] = [];
      snap.forEach(c => {
        const d = c.val();
        if (d.target === 'all' || d.target === user.uid) {
          arr.push({ id: c.key!, ...d });
        }
      });
      setNotifications(arr.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <div className="page-title">🔔 Notifications</div>
          <div className="page-subtitle">Announcements and updates from your institution</div>
        </div>
        {notifications.length > 0 && (
          <div style={{
            background: 'rgba(79,110,247,0.15)',
            border: '1px solid rgba(79,110,247,0.3)',
            borderRadius: '99px',
            padding: '6px 16px',
            fontSize: '13px',
            color: 'var(--accent)',
            fontWeight: 600,
          }}>
            {notifications.length} messages
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📬</div>
          <div className="empty-state-title">No notifications yet</div>
          <div className="empty-state-text">
            Your institution will send announcements and updates here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((n, i) => (
            <div className="notification-item" key={n.id}>
              <div className="notification-dot" style={{
                background: i === 0 ? 'var(--accent)' : 'var(--border-bright)',
              }} />
              <div style={{ flex: 1 }}>
                <div className="notification-title">{n.title}</div>
                <div className="notification-body">{n.body}</div>
                <div className="notification-time">
                  🕐 {timeAgo(n.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
