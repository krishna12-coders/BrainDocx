import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebase';

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pdfs: 0, users: 0, purchases: 0, devices: 0 });
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);

  useEffect(() => {
    const u1 = onValue(ref(db, 'pdfs'), snap => setStats(p => ({ ...p, pdfs: snap.exists() ? Object.keys(snap.val()).length : 0 })));
    const u2 = onValue(ref(db, 'users'), snap => setStats(p => ({ ...p, users: snap.exists() ? Object.keys(snap.val()).length : 0 })));
    const u3 = onValue(ref(db, 'purchases'), snap => {
      let total = 0;
      const items: any[] = [];
      if (snap.exists()) {
        snap.forEach(userSnap => {
          total += Object.keys(userSnap.val() || {}).length;
          userSnap.forEach(p => items.push({ id: p.key, userId: userSnap.key, ...p.val() }));
        });
      }
      items.sort((a, b) => (b.purchaseDate || 0) - (a.purchaseDate || 0));
      setStats(p => ({ ...p, purchases: total }));
      setRecentPurchases(items.slice(0, 6));
      setLoading(false);
    });
    const u4 = onValue(ref(db, 'devices'), snap => {
      let total = 0;
      if (snap.exists()) snap.forEach(u => { total += Object.keys(u.val() || {}).length; });
      setStats(p => ({ ...p, devices: total }));
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const METRIC_CARDS = [
    { label: 'Premium PDFs', value: stats.pdfs, icon: '📚', colorClass: 'stat-icon-blue' },
    { label: 'Registered Students', value: stats.users, icon: '👥', colorClass: 'stat-icon-purple' },
    { label: 'Total Purchases', value: stats.purchases, icon: '🛒', colorClass: 'stat-icon-green' },
    { label: 'Bound Devices', value: stats.devices, icon: '📱', colorClass: 'stat-icon-orange' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Admin Dashboard</div>
          <div className="page-subtitle">Platform overview and real-time metrics</div>
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: '99px',
          padding: '6px 14px',
          fontSize: '12px',
          color: '#f87171',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}>🛡️ ADMIN MODE</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {METRIC_CARDS.map(m => (
          <div className="stat-card" key={m.label}>
            <div className={`stat-icon ${m.colorClass}`}>{m.icon}</div>
            <div>
              <div className="stat-value">{loading ? '—' : m.value}</div>
              <div className="stat-label">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="cols-2">
        {/* Recent Purchases */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>🛒 Recent Purchases</span>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          ) : recentPurchases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No purchases yet.</div>
          ) : (
            recentPurchases.map((p, i) => (
              <div key={p.id + i} style={{ padding: '14px 20px', borderBottom: i < recentPurchases.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>PDF: {p.pdfId}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  User: {(p.userId || '').substring(0, 12)}... ·{' '}
                  {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : 'Pending'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* System Status */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>⚙️ System Status</span>
          </div>
          <div style={{ padding: '20px' }}>
            {[
              ['🔐 Encryption', 'AES-256-GCM Active'],
              ['🛡️ App Check', 'Enabled (Production)'],
              ['📱 Device Limit', '2 per student account'],
              ['💾 Storage', 'Firebase Storage (Encrypted)'],
              ['🗄️ Database', 'Realtime Database (RTDB)'],
              ['🔒 Rules', 'Role-based Access Control'],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
