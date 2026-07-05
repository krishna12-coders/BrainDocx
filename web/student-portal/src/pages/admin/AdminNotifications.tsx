import React, { useEffect, useState } from 'react';
import { ref, onValue, push, remove, set } from 'firebase/database';
import { db } from '../../firebase';

interface Notification { id: string; title: string; body: string; target: string; createdAt: number; }

export const AdminNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<'all'|'specific'>('all');
  const [targetId, setTargetId] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const unsub = onValue(ref(db, 'notifications'), snap => {
      const arr: Notification[] = [];
      if (snap.exists()) snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotifications(arr);
      setLoading(false);
    });
    return unsub;
  }, []);

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) { showToast('⚠️ Please fill title and message.'); return; }
    if (targetType === 'specific' && !targetId.trim()) { showToast('⚠️ Please enter a student UID.'); return; }
    setSending(true);
    try {
      await push(ref(db, 'notifications'), {
        title: title.trim(),
        body: body.trim(),
        target: targetType === 'all' ? 'all' : targetId.trim(),
        createdAt: Date.now(),
      });
      setTitle(''); setBody(''); setTargetId(''); setTargetType('all');
      showToast('✅ Notification sent!');
    } catch (e: any) { showToast('❌ ' + e.message); }
    finally { setSending(false); }
  };

  const deleteNotification = async (id: string) => {
    await remove(ref(db, `notifications/${id}`));
    showToast('🗑️ Notification deleted');
  };

  const timeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return 'Just now';
    const mins = Math.floor(secs / 60); if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60); if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">📢 Notifications</div>
          <div className="page-subtitle">Send announcements to all students or specific users</div>
        </div>
      </div>

      {/* Compose */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px' }}>✍️ Compose Announcement</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Title *</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Announcement title..." />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Message *</label>
            <textarea className="form-input" value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message here..." rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
              <label className="form-label">Recipient</label>
              <select className="form-input" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                <option value="all">🌐 All Students</option>
                <option value="specific">👤 Specific Student (UID)</option>
              </select>
            </div>
            {targetType === 'specific' && (
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label className="form-label">Student UID</label>
                <input className="form-input" value={targetId} onChange={e => setTargetId(e.target.value)} placeholder="Paste student UID..." />
              </div>
            )}
            <button className="btn btn-primary" onClick={sendNotification} disabled={sending} style={{ flexShrink: 0 }}>
              {sending ? '⏳ Sending...' : '📤 Send Notification'}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="section-title">
          📋 Sent History
          <span className="section-count">{notifications.length}</span>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📬</div>
            <div className="empty-state-title">No notifications sent yet</div>
            <div className="empty-state-text">Compose and send your first announcement above.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map(n => (
              <div key={n.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '20px', flexShrink: 0 }}>
                  {n.target === 'all' ? '🌐' : '👤'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{n.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.body}</div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>🕐 {timeAgo(n.createdAt)}</span>
                    <span>→ {n.target === 'all' ? 'All students' : `User: ${n.target.substring(0, 12)}...`}</span>
                  </div>
                </div>
                <button onClick={() => deleteNotification(n.id)} style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: 'var(--danger)', flexShrink: 0 }}>
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
