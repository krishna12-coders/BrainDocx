import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

interface PDFItem {
  id: string; title: string; description: string;
  encryptedStoragePath: string; sizeInBytes: number;
}
interface Purchase { pdfId: string; status: 'active'|'revoked'; }

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pdfs, setPdfs] = useState<PDFItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const u1 = onValue(ref(db, `users/${user.uid}`), snap => {
      if (snap.exists()) setProfile(snap.val());
    });
    const u2 = onValue(ref(db, `purchases/${user.uid}`), snap => {
      const arr: Purchase[] = [];
      snap.forEach(c => arr.push({ pdfId: c.key!, ...c.val() }));
      setPurchases(arr);
    });
    const u3 = onValue(ref(db, 'pdfs'), snap => {
      const arr: PDFItem[] = [];
      snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setPdfs(arr);
    });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const activePurchases = purchases.filter(p => p.status === 'active');
  const initials = (profile?.name || user?.email || 'S')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="page-header">
        <div>
          <div className="page-title">👤 My Profile</div>
          <div className="page-subtitle">Manage your student account and preferences</div>
        </div>
      </div>

      {/* Profile Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(79,110,247,0.05) 100%)',
      } as React.CSSProperties}>
        <div style={{
          width: '80px', height: '80px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 800,
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 4px 20px var(--accent-glow)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {profile?.name || 'Student'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {user?.email}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            marginTop: '10px',
            background: 'rgba(16,185,129,0.15)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: '99px',
            padding: '3px 12px',
            fontSize: '12px',
            color: 'var(--success)',
            fontWeight: 600,
          }}>
            ✓ Active Student
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="cols-2">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">📚</div>
          <div>
            <div className="stat-value">{activePurchases.length}</div>
            <div className="stat-label">PDFs Purchased</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green">🎓</div>
          <div>
            <div className="stat-value">{pdfs.length}</div>
            <div className="stat-label">Total Available</div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Account Details</div>
        </div>
        {[
          { label: 'Name', value: profile?.name || '—' },
          { label: 'Email', value: user?.email || '—' },
          { label: 'Role', value: 'Student' },
          { label: 'Status', value: profile?.status || 'Active' },
          { label: 'Member Since', value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</span>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Danger Zone */}
      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--danger)', marginBottom: '12px' }}>⚠️ Sign Out</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          You will be returned to the login screen.
        </div>
        <button className="btn btn-danger" onClick={() => { if (confirm('Sign out of your account?')) logout(); }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
};
