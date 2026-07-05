import React, { useEffect, useState } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

interface Bookmark {
  id: string; pdfId: string; pageNumber: number; createdAt: number;
}
interface Progress {
  pdfId: string; lastPage: number; totalPages: number; updatedAt: number;
}
interface PDFMeta { id: string; title: string; }

interface Props {
  onResume: (pdfId: string, title: string, page: number) => void;
}

export const ProgressPage: React.FC<Props> = ({ onResume }) => {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [progresses, setProgresses] = useState<Progress[]>([]);
  const [pdfs, setPdfs] = useState<PDFMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string|null>(null);

  useEffect(() => {
    if (!user) return;
    const u1 = onValue(ref(db, 'pdfs'), snap => {
      const arr: PDFMeta[] = [];
      snap.forEach(c => arr.push({ id: c.key!, title: c.val().title }));
      setPdfs(arr);
    });
    const u2 = onValue(ref(db, `bookmarks/${user.uid}`), snap => {
      const arr: Bookmark[] = [];
      snap.forEach(c => arr.push({ id: c.key!, ...c.val() }));
      setBookmarks(arr.sort((a, b) => b.createdAt - a.createdAt));
    });
    const u3 = onValue(ref(db, `readingProgress/${user.uid}`), snap => {
      const arr: Progress[] = [];
      snap.forEach(c => arr.push({ pdfId: c.key!, ...c.val() }));
      setProgresses(arr.sort((a, b) => b.updatedAt - a.updatedAt));
      setLoading(false);
    });
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const getTitle = (pdfId: string) => pdfs.find(p => p.id === pdfId)?.title || 'Unknown Document';

  const deleteBookmark = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await remove(ref(db, `bookmarks/${user.uid}/${id}`));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        Loading progress...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Study Progress</div>
          <div className="page-subtitle">Track your reading history and saved bookmarks</div>
        </div>
      </div>

      {/* Continue Reading */}
      <div>
        <div className="section-title">
          🔄 Continue Reading
          <span className="section-count">{progresses.length}</span>
        </div>
        {progresses.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">📖</div>
            <div className="empty-state-title">No reading history</div>
            <div className="empty-state-text">Start reading a PDF to track your progress here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progresses.map(p => {
              const pct = p.totalPages > 0 ? Math.round((p.lastPage / p.totalPages) * 100) : 0;
              const title = getTitle(p.pdfId);
              return (
                <div className="progress-card" key={p.pdfId}>
                  <div className="progress-card-icon">📘</div>
                  <div className="progress-card-info">
                    <div className="progress-card-title">{title}</div>
                    <div className="progress-card-meta">
                      Page {p.lastPage} of {p.totalPages} · {pct}% complete
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="progress-card-actions">
                    <button
                      className="btn btn-read btn-sm"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                      onClick={() => onResume(p.pdfId, title, p.lastPage)}
                    >
                      ▶ Resume
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bookmarks */}
      <div>
        <div className="section-title">
          🔖 Saved Bookmarks
          <span className="section-count">{bookmarks.length}</span>
        </div>
        {bookmarks.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">🔖</div>
            <div className="empty-state-title">No bookmarks saved</div>
            <div className="empty-state-text">Bookmark pages while reading to save them here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bookmarks.map(bm => {
              const title = getTitle(bm.pdfId);
              return (
                <div className="progress-card" key={bm.id}>
                  <div className="progress-card-icon">🔖</div>
                  <div className="progress-card-info">
                    <div className="progress-card-title">{title}</div>
                    <div className="progress-card-meta">
                      Bookmarked Page {bm.pageNumber} ·{' '}
                      {new Date(bm.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="progress-card-actions">
                    <button
                      className="btn-sm btn-read"
                      style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                      onClick={() => onResume(bm.pdfId, title, bm.pageNumber)}
                    >
                      Open Page
                    </button>
                    <button
                      className="btn-sm btn-danger"
                      style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '6px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                      onClick={() => deleteBookmark(bm.id)}
                      disabled={deletingId === bm.id}
                    >
                      {deletingId === bm.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
