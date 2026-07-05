import React, { useState, useEffect, useRef } from 'react';
import { ref as dbRef, set, push } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';

interface PDFItem {
  id: string; title: string; description: string;
  encryptedStoragePath: string; sizeInBytes: number;
}

interface Props {
  pdf: PDFItem;
  startPage?: number;
  onClose: () => void;
}

export const PDFViewerModal: React.FC<Props> = ({ pdf, startPage = 1, onClose }) => {
  const { user } = useAuth();
  const TOTAL_PAGES = 12; // simulated page count
  const [currentPage, setCurrentPage] = useState(startPage);
  const [bookmarking, setBookmarking] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  // Save reading progress on page change
  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => {
      set(dbRef(db, `readingProgress/${user.uid}/${pdf.id}`), {
        pdfId: pdf.id,
        lastPage: currentPage,
        totalPages: TOTAL_PAGES,
        updatedAt: Date.now(),
      });
    }, 800); // debounce
    return () => clearTimeout(timeout);
  }, [currentPage, user, pdf.id]);

  const handleBookmark = async () => {
    if (!user || bookmarking) return;
    setBookmarking(true);
    try {
      const key = `${pdf.id}_${currentPage}`;
      await set(dbRef(db, `bookmarks/${user.uid}/${key}`), {
        pdfId: pdf.id,
        pageNumber: currentPage,
        createdAt: Date.now(),
      });
      setBookmarked(true);
      setTimeout(() => setBookmarked(false), 2000);
    } finally {
      setBookmarking(false);
    }
  };

  // Watermark text
  const watermark = user ? `${user.email} | ${user.uid.substring(0, 8)}` : 'BrainDocx';

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">📄 {pdf.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Secure Protected Document
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${bookmarked ? 'btn-read' : 'btn-secondary'}`}
              style={{ padding: '8px 14px', fontSize: '13px' }}
              onClick={handleBookmark}
              disabled={bookmarking}
            >
              {bookmarked ? '✅ Bookmarked!' : '🔖 Bookmark'}
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '18px', lineHeight: 1 }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="modal-body">
          <div className="viewer-placeholder" style={{ userSelect: 'none' }}>
            <div className="viewer-watermark">{watermark}</div>
            <div style={{
              position: 'relative',
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              border: '1px solid var(--border)',
              padding: '32px',
            }}>
              {/* Simulated page content */}
              <div style={{ fontSize: '48px', opacity: 0.4 }}>📝</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {pdf.title}
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                textAlign: 'center',
                maxWidth: '480px',
                lineHeight: 1.6,
              }}>
                {pdf.description}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '8px',
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}>
                📄 Page {currentPage} of {TOTAL_PAGES} · AES-256 Encrypted · Screen Capture Protected
              </div>
              {/* Simulated page lines */}
              <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{
                    height: '10px',
                    borderRadius: '5px',
                    background: 'var(--bg-card)',
                    width: `${60 + Math.sin(i + currentPage) * 30}%`,
                  }} />
                ))}
              </div>
              {/* Visible watermark overlay */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                fontSize: '10px',
                color: 'rgba(79,110,247,0.3)',
                fontWeight: 700,
                letterSpacing: '1px',
                transform: 'rotate(-15deg)',
                pointerEvents: 'none',
              }}>
                🔒 {watermark}
              </div>
            </div>
          </div>
        </div>

        {/* Reader Controls */}
        <div className="reader-controls">
          <button
            className="btn btn-secondary"
            style={{ padding: '8px 20px' }}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ← Prev
          </button>
          <div className="page-indicator">
            Page {currentPage} / {TOTAL_PAGES}
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 20px' }}
            disabled={currentPage >= TOTAL_PAGES}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};
