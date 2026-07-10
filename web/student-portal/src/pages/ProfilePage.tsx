import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { useAuth } from '../AuthContext';

interface PDFItem {
  id: string; title: string; description: string;
  encryptedStoragePath: string; sizeInBytes: number;
}
interface Purchase { pdfId: string; status: 'active'|'revoked'; }
interface DeviceItem {
  id: string;
  deviceModel: string;
  osVersion: string;
  registeredAt: number;
  lastUsedAt: number;
  status: 'active' | 'blocked';
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pdfs, setPdfs] = useState<PDFItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [loadingPin, setLoadingPin] = useState<boolean>(false);
  const [errorPin, setErrorPin] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    const u1 = onValue(ref(db, `users/${user.uid}`), snap => {
      if (snap.exists()) setProfile(snap.val());
    });
    const u2 = onValue(ref(db, `purchases/${user.uid}`), snap => {
      const arr: Purchase[] = [];
      snap.forEach(c => {
        arr.push({ pdfId: c.key!, ...c.val() });
      });
      setPurchases(arr);
    });
    const u3 = onValue(ref(db, 'pdfs'), snap => {
      const arr: PDFItem[] = [];
      snap.forEach(c => {
        arr.push({ id: c.key!, ...c.val() });
      });
      setPdfs(arr);
    });
    const u4 = onValue(ref(db, `devices/${user.uid}`), snap => {
      const arr: DeviceItem[] = [];
      snap.forEach(c => {
        arr.push({ id: c.key!, ...c.val() });
      });
      setDevices(arr);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [user]);

  const handleGeneratePin = async () => {
    setLoadingPin(true);
    setErrorPin('');
    try {
      const genPinFn = httpsCallable(functions, 'generatePin');
      const res: any = await genPinFn();
      if (res.data && res.data.pin) {
        setGeneratedPin(res.data.pin);
      }
    } catch (err: any) {
      setErrorPin(err.message || 'Failed to generate PIN.');
    } finally {
      setLoadingPin(false);
    }
  };

  const handleRevokePin = async () => {
    if (!confirm('Are you sure you want to revoke the App PIN? This will log out all active mobile app sessions immediately.')) return;
    setLoadingPin(true);
    setErrorPin('');
    try {
      const revokePinFn = httpsCallable(functions, 'revokePin');
      await revokePinFn();
      setGeneratedPin('');
      alert('✅ Mobile App PIN access successfully revoked.');
    } catch (err: any) {
      setErrorPin(err.message || 'Failed to revoke PIN.');
    } finally {
      setLoadingPin(false);
    }
  };

  const activePurchases = purchases.filter(p => p.status === 'active');
  const initials = (profile?.name || user?.email || 'S')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const isPinActive = profile?.appPinHash && profile?.pinStatus === 'active';

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

      {/* ── Secure App Login PIN Section ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>🔑 App Login PIN</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Authenticate your companion mobile app securely without typing passwords.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={handleGeneratePin} 
              disabled={loadingPin}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              {loadingPin ? '⏳ Wait...' : isPinActive ? '🔄 Regenerate PIN' : '✨ Generate PIN'}
            </button>
            {isPinActive && (
              <button 
                className="btn btn-danger" 
                onClick={handleRevokePin} 
                disabled={loadingPin}
                style={{ fontSize: '13px', padding: '8px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
              >
                Revoke PIN
              </button>
            )}
          </div>
        </div>

        {errorPin && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>⚠️ {errorPin}</div>}

        <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>App Authentication PIN</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: generatedPin ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '2px', marginTop: '6px' }}>
              {generatedPin ? generatedPin : (isPinActive ? '••••••' : 'Not Generated')}
            </div>
            {generatedPin && (
              <div style={{ fontSize: '11px', color: 'var(--orange)', marginTop: '8px', fontWeight: 600 }}>
                ⚠️ Copy this PIN now. For security, it will not be displayed again after you leave this page.
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: '99px',
              fontSize: '11px',
              fontWeight: 700,
              background: isPinActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: isPinActive ? 'var(--success)' : 'var(--danger)',
              border: isPinActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)'
            }}>
              {isPinActive ? '● Active' : '○ Disabled'}
            </span>
            {profile?.pinLastUsed && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Last used: {new Date(profile.pinLastUsed).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Connected Devices Section ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>📱 Connected Devices</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            List of mobile devices currently bound to your account.
          </div>
        </div>
        {devices.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            No devices connected yet. Log into the mobile app to authorize this device.
          </div>
        ) : (
          devices.map((device, idx) => (
            <div key={device.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: idx === devices.length - 1 ? 'none' : '1px solid var(--border)',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {device.deviceModel}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  ID: {device.id} • OS: {device.osVersion}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  borderRadius: '99px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: device.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                  color: device.status === 'active' ? 'var(--success)' : 'var(--danger)',
                }}>
                  {device.status === 'active' ? 'Active' : 'Blocked'}
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Last Checked In: {new Date(device.lastUsedAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
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

