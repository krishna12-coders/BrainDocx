import React, { useEffect, useState } from 'react';
import { ref, onValue, set, remove, push } from 'firebase/database';
import { db } from '../../firebase';

interface Purchase { id: string; userId: string; pdfId: string; status: string; purchaseDate: number; }
interface Coupon { id: string; code: string; discountPercent: number; usageLimit: number; usedCount: number; }

export const AdminPurchases: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'purchases'|'coupons'>('purchases');
  const [toast, setToast] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('');
  const [couponLimit, setCouponLimit] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const u1 = onValue(ref(db, 'purchases'), snap => {
      const arr: Purchase[] = [];
      if (snap.exists()) snap.forEach(userSnap => userSnap.forEach(p => arr.push({ id: p.key!, userId: userSnap.key!, pdfId: p.key!, ...p.val() })));
      arr.sort((a, b) => (b.purchaseDate || 0) - (a.purchaseDate || 0));
      setPurchases(arr);
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'coupons'), snap => {
      const arr: Coupon[] = [];
      if (snap.exists()) snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setCoupons(arr);
    });
    return () => { u1(); u2(); };
  }, []);

  const revokePurchase = async (userId: string, pdfId: string) => {
    if (!confirm('Revoke this purchase? The student will lose access.')) return;
    try {
      await set(ref(db, `purchases/${userId}/${pdfId}/status`), 'revoked');
      showToast('🚫 Purchase revoked');
    } catch (e: any) { showToast('❌ ' + e.message); }
  };

  const addCoupon = async () => {
    if (!couponCode.trim() || !couponDiscount) return;
    try {
      await push(ref(db, 'coupons'), {
        code: couponCode.trim().toUpperCase(),
        discountPercent: parseFloat(couponDiscount),
        usageLimit: parseInt(couponLimit) || 100,
        usedCount: 0,
        createdAt: Date.now(),
      });
      setCouponCode(''); setCouponDiscount(''); setCouponLimit('');
      showToast('✅ Coupon created!');
    } catch (e: any) { showToast('❌ ' + e.message); }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    await remove(ref(db, `coupons/${id}`));
    showToast('🗑️ Coupon deleted');
  };

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">🛒 Purchases & Coupons</div>
          <div className="page-subtitle">Manage sales and promotional discount codes</div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{purchases.length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Sales</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)' }}>{purchases.filter(p => p.status === 'active').length}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Active</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'purchases' ? 'active' : ''}`} onClick={() => setTab('purchases')}>🛒 Purchase History</button>
        <button className={`tab ${tab === 'coupons' ? 'active' : ''}`} onClick={() => setTab('coupons')}>🏷️ Coupons</button>
      </div>

      {tab === 'purchases' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          : purchases.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No purchases yet.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>PDF ID</th><th style={thStyle}>Student ID</th><th style={thStyle}>Status</th><th style={thStyle}>Date</th><th style={thStyle}>Action</th></tr></thead>
                <tbody>
                  {purchases.map((p, i) => (
                    <tr key={p.userId + '_' + p.pdfId + '_' + i}>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.pdfId}</span></td>
                      <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{(p.userId || '').substring(0, 14)}...</span></td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: p.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: p.status === 'active' ? 'var(--success)' : 'var(--danger)' }}>
                          {p.status === 'active' ? '✓ Active' : '✗ Revoked'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)' }}>{p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : '—'}</td>
                      <td style={tdStyle}>
                        {p.status === 'active' && (
                          <button onClick={() => revokePurchase(p.userId, p.pdfId)} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: 'var(--danger)' }}>
                            🚫 Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'coupons' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1', minWidth: '140px', marginBottom: 0 }}>
              <label className="form-label">Coupon Code</label>
              <input className="form-input" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="e.g. SAVE20" style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
              <label className="form-label">Discount %</label>
              <input className="form-input" type="number" value={couponDiscount} onChange={e => setCouponDiscount(e.target.value)} placeholder="20" />
            </div>
            <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
              <label className="form-label">Usage Limit</label>
              <input className="form-input" type="number" value={couponLimit} onChange={e => setCouponLimit(e.target.value)} placeholder="100" />
            </div>
            <button className="btn btn-primary" onClick={addCoupon}>+ Create Coupon</button>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {coupons.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No coupons created yet.</div>
            : <table style={tableStyle}>
                <thead><tr><th style={thStyle}>Code</th><th style={thStyle}>Discount</th><th style={thStyle}>Used / Limit</th><th style={thStyle}>Actions</th></tr></thead>
                <tbody>{coupons.map(c => (
                  <tr key={c.id}>
                    <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: 'var(--accent)' }}>{c.code}</span></td>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: 'var(--success)' }}>{c.discountPercent}% OFF</span></td>
                    <td style={tdStyle}>{c.usedCount || 0} / {c.usageLimit}</td>
                    <td style={tdStyle}><button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => deleteCoupon(c.id)}>🗑️ Delete</button></td>
                  </tr>
                ))}</tbody>
              </table>
            }
          </div>
        </div>
      )}
    </div>
  );
};
