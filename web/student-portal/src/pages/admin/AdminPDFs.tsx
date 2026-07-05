import React, { useEffect, useState, useRef } from 'react';
import { ref as dbRef, onValue, set, remove, push } from 'firebase/database';
import { ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';

interface Category { id: string; name: string; }
interface Subject { id: string; name: string; categoryId: string; }
interface PDFMeta {
  id: string; title: string; description: string;
  categoryId: string; subjectId: string;
  encryptedStoragePath: string; sizeInBytes: number; price?: number;
}

// Simple AES-GCM encryption using Web Crypto API
async function encryptFile(file: File): Promise<{ encryptedData: ArrayBuffer; key: CryptoKey; iv: Uint8Array }> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, fileBuffer);
  return { encryptedData, key, iv };
}

async function exportKeyHex(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AdminPDFs: React.FC = () => {
  const [tab, setTab] = useState<'pdfs'|'categories'|'subjects'>('pdfs');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pdfs, setPdfs] = useState<PDFMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Forms
  const [catName, setCatName] = useState('');
  const [subName, setSubName] = useState(''); const [subCatId, setSubCatId] = useState('');
  const [pdfTitle, setPdfTitle] = useState(''); const [pdfDesc, setPdfDesc] = useState('');
  const [pdfCatId, setPdfCatId] = useState(''); const [pdfSubId, setPdfSubId] = useState('');
  const [pdfPrice, setPdfPrice] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPdfForm, setShowPdfForm] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const u1 = onValue(dbRef(db, 'categories'), snap => {
      const arr: Category[] = []; snap.forEach(c => arr.push({ id: c.key!, ...c.val() })); setCategories(arr);
    });
    const u2 = onValue(dbRef(db, 'subjects'), snap => {
      const arr: Subject[] = []; snap.forEach(c => arr.push({ id: c.key!, ...c.val() })); setSubjects(arr);
    });
    const u3 = onValue(dbRef(db, 'pdfs'), snap => {
      const arr: PDFMeta[] = []; snap.forEach(c => arr.push({ id: c.key!, ...c.val() })); setPdfs(arr); setLoading(false);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const addCategory = async () => {
    if (!catName.trim()) return;
    await push(dbRef(db, 'categories'), { name: catName.trim() });
    setCatName(''); showToast('✅ Category added!');
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    await remove(dbRef(db, `categories/${id}`));
    showToast('🗑️ Category deleted');
  };

  const addSubject = async () => {
    if (!subName.trim() || !subCatId) return;
    await push(dbRef(db, 'subjects'), { name: subName.trim(), categoryId: subCatId });
    setSubName(''); setSubCatId(''); showToast('✅ Subject added!');
  };

  const deleteSubject = async (id: string) => {
    if (!confirm('Delete this subject?')) return;
    await remove(dbRef(db, `subjects/${id}`));
    showToast('🗑️ Subject deleted');
  };

  const uploadPdf = async () => {
    if (!selectedFile || !pdfTitle.trim() || !pdfCatId) {
      showToast('⚠️ Please fill all required fields and select a PDF file.');
      return;
    }
    setUploading(true);
    try {
      const { encryptedData, key, iv } = await encryptFile(selectedFile);
      const keyHex = await exportKeyHex(key);
      const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
      const pdfRef = push(dbRef(db, 'pdfs'));
      const pdfId = pdfRef.key!;
      const storagePath = `encrypted_pdfs/${pdfId}.enc`;
      const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
      await uploadBytes(storageRef(storage, storagePath), blob);
      await set(pdfRef, {
        title: pdfTitle.trim(), description: pdfDesc.trim(),
        categoryId: pdfCatId, subjectId: pdfSubId,
        encryptedStoragePath: storagePath,
        sizeInBytes: selectedFile.size,
        price: pdfPrice ? parseFloat(pdfPrice) : 0,
        createdAt: Date.now(),
      });
      await set(dbRef(db, `pdf_keys/${pdfId}`), { keyHex, ivHex });
      setPdfTitle(''); setPdfDesc(''); setPdfCatId(''); setPdfSubId(''); setPdfPrice(''); setSelectedFile(null);
      setShowPdfForm(false);
      showToast('✅ PDF encrypted and uploaded successfully!');
    } catch (e: any) {
      showToast('❌ Upload failed: ' + (e.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const deletePdf = async (pdf: PDFMeta) => {
    if (!confirm(`Delete "${pdf.title}"? This cannot be undone.`)) return;
    try {
      await remove(dbRef(db, `pdfs/${pdf.id}`));
      await remove(dbRef(db, `pdf_keys/${pdf.id}`));
      if (pdf.encryptedStoragePath) await deleteObject(storageRef(storage, pdf.encryptedStoragePath)).catch(() => {});
      showToast('🗑️ PDF deleted');
    } catch (e: any) { showToast('❌ ' + e.message); }
  };

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '13px' };
  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const tdStyle: React.CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', verticalAlign: 'middle' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {toast && <div className="error-alert" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7', position: 'fixed', top: '20px', right: '20px', zIndex: 200, minWidth: '280px' }}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">📄 PDF Management</div>
          <div className="page-subtitle">Upload, categorise and manage study materials</div>
        </div>
        {tab === 'pdfs' && (
          <button className="btn btn-primary" onClick={() => setShowPdfForm(!showPdfForm)}>
            {showPdfForm ? '✕ Cancel' : '+ Upload PDF'}
          </button>
        )}
      </div>

      <div className="tabs">
        {['pdfs','categories','subjects'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t as any)}>
            {t === 'pdfs' ? '📄 PDFs' : t === 'categories' ? '🏷️ Categories' : '📂 Subjects'}
          </button>
        ))}
      </div>

      {/* PDF Upload Form */}
      {tab === 'pdfs' && showPdfForm && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '20px' }}>📤 Upload New PDF</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={pdfTitle} onChange={e => setPdfTitle(e.target.value)} placeholder="e.g. Organic Chemistry Vol. 1" /></div>
            <div className="form-group"><label className="form-label">Price (₹)</label><input className="form-input" type="number" value={pdfPrice} onChange={e => setPdfPrice(e.target.value)} placeholder="0" /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Description</label><input className="form-input" value={pdfDesc} onChange={e => setPdfDesc(e.target.value)} placeholder="Brief description of content" /></div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" value={pdfCatId} onChange={e => setPdfCatId(e.target.value)}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <select className="form-input" value={pdfSubId} onChange={e => setPdfSubId(e.target.value)}>
                <option value="">Select subject...</option>
                {subjects.filter(s => !pdfCatId || s.categoryId === pdfCatId).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">PDF File *</label>
              <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} type="button">📂 Choose PDF</button>
                <span style={{ fontSize: '13px', color: selectedFile ? 'var(--success)' : 'var(--text-muted)' }}>
                  {selectedFile ? `✓ ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB)` : 'No file selected'}
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={uploadPdf} disabled={uploading} style={{ marginTop: '8px' }}>
            {uploading ? '⏳ Encrypting & Uploading...' : '🔐 Encrypt & Upload'}
          </button>
        </div>
      )}

      {/* PDFs Table */}
      {tab === 'pdfs' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
          : pdfs.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No PDFs uploaded yet. Click "Upload PDF" to add one.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead><tr><th style={thStyle}>Title</th><th style={thStyle}>Category</th><th style={thStyle}>Size</th><th style={thStyle}>Price</th><th style={thStyle}>Actions</th></tr></thead>
                <tbody>
                  {pdfs.map(pdf => (
                    <tr key={pdf.id}>
                      <td style={tdStyle}><div style={{ fontWeight: 600 }}>{pdf.title}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{pdf.description}</div></td>
                      <td style={tdStyle}>{categories.find(c => c.id === pdf.categoryId)?.name || '—'}</td>
                      <td style={tdStyle}>{(pdf.sizeInBytes / 1024 / 1024).toFixed(1)} MB</td>
                      <td style={tdStyle}>{pdf.price ? `₹${pdf.price}` : 'Free'}</td>
                      <td style={tdStyle}><button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => deletePdf(pdf)}>🗑️ Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {tab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input className="form-input" style={{ flex: 1 }} value={catName} onChange={e => setCatName(e.target.value)} placeholder="Category name (e.g. Science, Mathematics)" onKeyDown={e => e.key === 'Enter' && addCategory()} />
            <button className="btn btn-primary" onClick={addCategory}>+ Add</button>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {categories.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No categories yet.</div>
            : <table style={tableStyle}><thead><tr><th style={thStyle}>Category Name</th><th style={thStyle}>PDFs</th><th style={thStyle}>Actions</th></tr></thead>
              <tbody>{categories.map(cat => (
                <tr key={cat.id}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{cat.name}</span></td>
                  <td style={tdStyle}>{pdfs.filter(p => p.categoryId === cat.id).length}</td>
                  <td style={tdStyle}><button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => deleteCategory(cat.id)}>🗑️ Delete</button></td>
                </tr>
              ))}</tbody>
            </table>}
          </div>
        </div>
      )}

      {/* Subjects */}
      {tab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input className="form-input" style={{ flex: 1 }} value={subName} onChange={e => setSubName(e.target.value)} placeholder="Subject name" />
            <select className="form-input" style={{ width: '200px' }} value={subCatId} onChange={e => setSubCatId(e.target.value)}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn-primary" onClick={addSubject}>+ Add</button>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {subjects.length === 0 ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No subjects yet.</div>
            : <table style={tableStyle}><thead><tr><th style={thStyle}>Subject</th><th style={thStyle}>Category</th><th style={thStyle}>Actions</th></tr></thead>
              <tbody>{subjects.map(sub => (
                <tr key={sub.id}>
                  <td style={tdStyle}>{sub.name}</td>
                  <td style={tdStyle}>{categories.find(c => c.id === sub.categoryId)?.name || '—'}</td>
                  <td style={tdStyle}><button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: '12px' }} onClick={() => deleteSubject(sub.id)}>🗑️ Delete</button></td>
                </tr>
              ))}</tbody>
            </table>}
          </div>
        </div>
      )}
    </div>
  );
};
