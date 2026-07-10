import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';

interface UserProfile { id: string; name: string; email: string; role: string; status: 'active'|'blocked'; createdAt: number; }
interface Device { id: string; userId: string; deviceModel: string; osVersion: string; registeredAt: number; }

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'users'|'devices'>('users');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const u1 = onValue(ref(db, 'users'), snap => {
      const arr: UserProfile[] = [];
      if (snap.exists()) snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setUsers(arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'devices'), snap => {
      const arr: Device[] = [];
      if (snap.exists()) snap.forEach(userSnap => userSnap.forEach(dev => arr.push({ id: dev.key!, userId: userSnap.key!, ...dev.val() })));
      setDevices(arr);
    });
    return () => { u1(); u2(); };
  }, []);

  const toggleStatus = async (user: UserProfile) => {
    setActionId(user.id);
    try {
      const fn = httpsCallable(functions, 'setUserStatus');
      await fn({ targetUserId: user.id, status: user.status === 'active' ? 'blocked' : 'active' });
      showToast(user.status === 'active' ? '🚫 User blocked' : '✅ User reactivated');
    } catch (e: any) { showToast('❌ ' + e.message); }
    finally { setActionId(null); }
  };

  const unbindDevice = async (userId: string, deviceId: string) => {
    if (!confirm('Unbind this device from the student account?')) return;
    setActionId(deviceId);
    try {
      await remove(ref(db, `devices/${userId}/${deviceId}`));
      showToast('✅ Device unbound successfully');
    } catch (e: any) { showToast('❌ ' + e.message); }
    finally { setActionId(null); }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">👥 Student Management</div>
          <div className="page-subtitle">Manage student accounts and device bindings</div>
        </div>
        <div className="search-bar" style={{ maxWidth: '280px' }}>
          <span className="search-icon">🔍</span>
          <input className="search-input" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>👥 Students ({users.length})</button>
        <button className={`tab ${tab === 'devices' ? 'active' : ''}`} onClick={() => setTab('devices')}>📱 Devices ({devices.length})</button>
      </div>

      {tab === 'users' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading students...</div>
          : filteredUsers.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Devices</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}>Action</th>
                </tr></thead>
                <tbody>
                  {filteredUsers.map(u => {
                    const devCount = devices.filter(d => d.userId === u.id).length;
                    return (
                      <tr key={u.id}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.role === 'admin' ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'linear-gradient(135deg,var(--accent),var(--accent-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', color: '#fff', flexShrink: 0 }}>
                              {(u.name || u.email || 'S')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{u.name || '—'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: u.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'rgba(79,110,247,0.15)', color: u.role === 'admin' ? '#f87171' : 'var(--accent)' }}>
                            {u.role === 'admin' ? '🛡️ Admin' : '🎓 Student'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: u.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.status === 'active' ? 'var(--success)' : 'var(--danger)' }}>
                            {u.status === 'active' ? '✓ Active' : '✗ Blocked'}
                          </span>
                        </td>
                        <td style={tdStyle}>{devCount} / 2</td>
                        <td style={tdStyle} style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                        <td style={tdStyle}>
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => toggleStatus(u)}
                              disabled={actionId === u.id}
                              style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: u.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: u.status === 'active' ? 'var(--danger)' : 'var(--success)' }}
                            >
                              {actionId === u.id ? '...' : u.status === 'active' ? '🚫 Block' : '✅ Unblock'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'devices' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {devices.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No registered devices yet.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr>
                  <th style={thStyle}>Device</th>
                  <th style={thStyle}>OS</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Registered</th>
                  <th style={thStyle}>Action</th>
                </tr></thead>
                <tbody>
                  {devices.map(dev => {
                    const owner = users.find(u => u.id === dev.userId);
                    return (
                      <tr key={dev.id}>
                        <td style={tdStyle}><div style={{ fontWeight: 600 }}>📱 {dev.deviceModel || 'Unknown Device'}</div></td>
                        <td style={tdStyle}><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{dev.osVersion || '—'}</span></td>
                        <td style={tdStyle}><div style={{ fontSize: '12px' }}>{owner?.name || owner?.email || dev.userId?.substring(0, 10) + '...'}</div></td>
                        <td style={tdStyle} style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)' }}>{dev.registeredAt ? new Date(dev.registeredAt).toLocaleDateString() : '—'}</td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => unbindDevice(dev.userId, dev.id)}
                            disabled={actionId === dev.id}
                            style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: 'var(--danger)' }}
                          >
                            {actionId === dev.id ? '...' : '🔓 Unbind'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
