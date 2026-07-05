import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';
import { useAuth } from '../AuthContext';

interface Category { id: string; name: string; }
interface PDFItem {
  id: string; title: string; description: string;
  categoryId: string; subjectId: string;
  encryptedStoragePath: string; sizeInBytes: number;
  price?: number;
}
interface Purchase { pdfId: string; status: 'active' | 'revoked'; }

const COVERS = ['cover-1','cover-2','cover-3','cover-4','cover-5'];
const EMOJIS = ['📘','📗','📕','📙','📓'];

interface Props {
  onOpenViewer: (pdf: PDFItem) => void;
}

export const LibraryPage: React.FC<Props> = ({ onOpenViewer }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'library'|'store'>('library');
  const [categories, setCategories] = useState<Category[]>([]);
  const [pdfs, setPdfs] = useState<PDFItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string|null>(null);
  const [purchasing, setPurchasing] = useState<string|null>(null);

  useEffect(() => {
    if (!user) return;
    const u1 = onValue(ref(db, 'categories'), snap => {
      const arr: Category[] = [];
      snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setCategories(arr);
    });
    const u2 = onValue(ref(db, 'pdfs'), snap => {
      const arr: PDFItem[] = [];
      snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setPdfs(arr);
      setLoading(false);
    });
    const u3 = onValue(ref(db, `purchases/${user.uid}`), snap => {
      const arr: Purchase[] = [];
      snap.forEach(c => arr.push({ pdfId: c.key!, status: c.val().status }));
      setPurchases(arr);
    });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const activePurchaseIds = purchases.filter(p => p.status === 'active').map(p => p.pdfId);

  const filtered = pdfs.filter(pdf => {
    const matchSearch = pdf.title.toLowerCase().includes(search.toLowerCase()) ||
                        pdf.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCat ? pdf.categoryId === selectedCat : true;
    if (tab === 'library') return matchSearch && matchCat && activePurchaseIds.includes(pdf.id);
    return matchSearch && matchCat && !activePurchaseIds.includes(pdf.id);
  });

  const handlePurchase = async (pdfId: string) => {
    if (!confirm('Confirm purchase of this study material?')) return;
    setPurchasing(pdfId);
    try {
      const fn = httpsCallable(functions, 'purchasePdf');
      await fn({ pdfId });
      alert('✅ PDF unlocked! It\'s now in your library.');
    } catch (err: any) {
      alert('❌ Purchase failed: ' + (err.message || 'Unknown error'));
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📚 Study Library</div>
          <div className="page-subtitle">Browse and manage your premium study materials</div>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'library' ? 'active' : ''}`} onClick={() => setTab('library')}>
            My Library
          </button>
          <button className={`tab ${tab === 'store' ? 'active' : ''}`} onClick={() => setTab('store')}>
            🛒 Store
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-chips">
          <button className={`chip ${!selectedCat ? 'active' : ''}`} onClick={() => setSelectedCat(null)}>
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`chip ${selectedCat === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading library...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{tab === 'library' ? '📭' : '🛒'}</div>
          <div className="empty-state-title">
            {tab === 'library' ? 'Your library is empty' : 'No materials found'}
          </div>
          <div className="empty-state-text">
            {tab === 'library'
              ? 'Purchase study materials from the Store tab to start learning.'
              : 'All available documents are already in your library!'}
          </div>
          {tab === 'library' && (
            <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => setTab('store')}>
              Browse Store →
            </button>
          )}
        </div>
      ) : (
        <div className="pdf-grid">
          {filtered.map((pdf, i) => {
            const owned = activePurchaseIds.includes(pdf.id);
            const coverClass = COVERS[i % COVERS.length];
            const emoji = EMOJIS[i % EMOJIS.length];
            return (
              <div className="pdf-card" key={pdf.id}>
                <div className={`pdf-card-cover ${coverClass}`}>
                  <span>{emoji}</span>
                  {owned && <span className="pdf-badge badge-owned">✓ Owned</span>}
                  {!owned && pdf.price && <span className="pdf-badge">₹{pdf.price}</span>}
                </div>
                <div className="pdf-card-body">
                  <div className="pdf-card-title">{pdf.title}</div>
                  <div className="pdf-card-desc">{pdf.description}</div>
                  <div className="pdf-card-meta">
                    <span>📄 {(pdf.sizeInBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    {categories.find(c => c.id === pdf.categoryId) && (
                      <span>🏷️ {categories.find(c => c.id === pdf.categoryId)?.name}</span>
                    )}
                  </div>
                </div>
                <div className="pdf-card-footer">
                  {owned ? (
                    <button className="btn-sm btn-read" onClick={() => onOpenViewer(pdf)}>
                      📖 Read Now
                    </button>
                  ) : (
                    <button
                      className="btn-sm btn-buy"
                      onClick={() => handlePurchase(pdf.id)}
                      disabled={purchasing === pdf.id}
                    >
                      {purchasing === pdf.id ? '⏳ Unlocking...' : '🔓 Unlock PDF'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
