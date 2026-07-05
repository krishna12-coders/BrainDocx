import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { ref as dbRef, onValue, set, remove, push } from 'firebase/database';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '../utils/firebase';
import { encryptFile } from '../utils/crypto';

interface Category {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  categoryId: string;
}

interface PDFMetadata {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  subjectId: string;
  encryptedStoragePath: string;
  sizeInBytes: number;
  createdAt: any;
}

export const PDFs: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Collections state
  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pdfs, setPdfs] = useState<PDFMetadata[]>([]);

  // Category Form State
  const [categoryName, setCategoryName] = useState('');
  
  // Subject Form State
  const [subjectName, setSubjectName] = useState('');
  const [subjectCategoryId, setSubjectCategoryId] = useState('');

  // PDF Form State
  const [openPdfDialog, setOpenPdfDialog] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfDesc, setPdfDesc] = useState('');
  const [pdfCategory, setPdfCategory] = useState('');
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  useEffect(() => {
    // Real-time updates for Categories
    const unsubCats = onValue(dbRef(db, 'categories'), (snap) => {
      const items: Category[] = [];
      if (snap.exists()) {
        snap.forEach((doc) => {
          items.push({ id: doc.key, ...doc.val() } as Category);
        });
      }
      setCategories(items);
    });

    // Real-time updates for Subjects
    const unsubSubs = onValue(dbRef(db, 'subjects'), (snap) => {
      const items: Subject[] = [];
      if (snap.exists()) {
        snap.forEach((doc) => {
          items.push({ id: doc.key, ...doc.val() } as Subject);
        });
      }
      setSubjects(items);
    });

    // Real-time updates for PDFs
    const unsubPdfs = onValue(dbRef(db, 'pdfs'), (snap) => {
      const items: PDFMetadata[] = [];
      if (snap.exists()) {
        snap.forEach((doc) => {
          items.push({ id: doc.key, ...doc.val() } as PDFMetadata);
        });
      }
      setPdfs(items);
    });

    return () => {
      unsubCats();
      unsubSubs();
      unsubPdfs();
    };
  }, []);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 1. Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      const catRef = push(dbRef(db, 'categories'));
      const id = catRef.key;
      await set(catRef, { id, name: categoryName, createdAt: Date.now() });
      setCategoryName('');
      showMessage('Category created successfully.');
    } catch (err: any) {
      showMessage(err.message || 'Failed to create category', 'error');
    }
  };

  // 2. Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCategoryId) return;

    try {
      const subRef = push(dbRef(db, 'subjects'));
      const id = subRef.key;
      await set(subRef, {
        id,
        name: subjectName,
        categoryId: subjectCategoryId,
        createdAt: Date.now(),
      });
      setSubjectName('');
      showMessage('Subject created successfully.');
    } catch (err: any) {
      showMessage(err.message || 'Failed to create subject', 'error');
    }
  };

  // 3. Delete Category/Subject
  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this category? All associated subjects and PDFs will remain but category reference will be lost.')) {
      try {
        await remove(dbRef(db, `categories/${id}`));
        showMessage('Category deleted.');
      } catch (err: any) {
        showMessage(err.message, 'error');
      }
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (window.confirm('Are you sure?')) {
      try {
        await remove(dbRef(db, `subjects/${id}`));
        showMessage('Subject deleted.');
      } catch (err: any) {
        showMessage(err.message, 'error');
      }
    }
  };

  // 4. Secure PDF Upload with Client-Side Encryption
  const handleUploadPdf = async () => {
    if (!pdfTitle || !pdfCategory || !pdfSubject || !pdfFile) {
      showMessage('Please fill out all fields and select a PDF file.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Step A: Encrypt PDF client-side using Web Crypto
      showMessage('Encrypting file locally with AES-256-GCM...');
      const { encryptedBlob, keyBase64 } = await encryptFile(pdfFile);

      // Create a unique document ID
      const pdfRef = push(dbRef(db, 'pdfs'));
      const pdfId = pdfRef.key || 'pdf_' + Math.random().toString(36).substring(2);

      // Step B: Upload encrypted file to Firebase Storage
      showMessage('Uploading encrypted file to Firebase Storage...');
      const fileRef = ref(storage, `pdfs/${pdfId}`);
      await uploadBytes(fileRef, encryptedBlob, {
        contentType: 'application/octet-stream', // Binary stream instead of pdf mime to obscure file type
      });

      // Step C: Save decryption key to private RTDB collection
      showMessage('Saving decryption key securely...');
      await set(dbRef(db, `pdf_keys/${pdfId}`), {
        key: keyBase64,
        createdAt: Date.now(),
      });

      // Step D: Save metadata to public PDFs node
      showMessage('Publishing PDF metadata...');
      await set(pdfRef, {
        id: pdfId,
        title: pdfTitle,
        description: pdfDesc,
        categoryId: pdfCategory,
        subjectId: pdfSubject,
        encryptedStoragePath: `pdfs/${pdfId}`,
        sizeInBytes: pdfFile.size,
        createdAt: Date.now(),
      });

      // Reset PDF Form
      setPdfTitle('');
      setPdfDesc('');
      setPdfCategory('');
      setPdfSubject('');
      setPdfFile(null);
      setOpenPdfDialog(false);
      showMessage('PDF uploaded and secured successfully!');
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || 'Failed to upload PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 5. Delete PDF
  const handleDeletePdf = async (pdf: PDFMetadata) => {
    if (window.confirm(`Are you sure you want to delete "${pdf.title}"?`)) {
      try {
        setLoading(true);
        // Delete encrypted file from Storage
        const fileRef = ref(storage, pdf.encryptedStoragePath);
        await deleteObject(fileRef).catch(e => console.log('Storage file did not exist or failed to delete:', e));

        // Delete metadata & key from RTDB
        await remove(dbRef(db, `pdfs/${pdf.id}`));
        await remove(dbRef(db, `pdf_keys/${pdf.id}`)).catch(e => console.log('Private key failed to delete:', e));

        showMessage('PDF successfully removed.');
      } catch (err: any) {
        showMessage(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ mb: 3 }}>
        <Tab label="PDF Library" />
        <Tab label="Categories & Subjects" />
      </Tabs>

      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              Library Management
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenPdfDialog(true)}>
              Upload Premium PDF
            </Button>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'action.selected' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Subject</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Document ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pdfs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No secure PDFs in library. Click "Upload Premium PDF" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  pdfs.map((pdf) => {
                    const cat = categories.find((c) => c.id === pdf.categoryId)?.name || 'Unknown';
                    const sub = subjects.find((s) => s.id === pdf.subjectId)?.name || 'Unknown';
                    return (
                      <TableRow key={pdf.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: '500' }}>{pdf.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{pdf.description}</Typography>
                        </TableCell>
                        <TableCell>{cat}</TableCell>
                        <TableCell>{sub}</TableCell>
                        <TableCell>{(pdf.sizeInBytes / (1024 * 1024)).toFixed(2)} MB</TableCell>
                        <TableCell sx={{ fontClassName: 'monospace', fontSize: 12 }}>{pdf.id}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleDeletePdf(pdf)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Categories card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Categories
                </Typography>
                <Box component="form" onSubmit={handleCreateCategory} sx={{ display: 'flex', gap: 1, mb: 3 }}>
                  <TextField
                    label="New Category"
                    size="small"
                    fullWidth
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                  />
                  <Button type="submit" variant="contained">
                    Add
                  </Button>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categories.map((cat) => (
                        <TableRow key={cat.id}>
                          <TableCell>{cat.name}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => handleDeleteCategory(cat.id)} color="error" size="small">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Subjects card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Subjects
                </Typography>
                <Box component="form" onSubmit={handleCreateSubject} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      label="New Subject"
                      size="small"
                      fullWidth
                      value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}
                    />
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={subjectCategoryId}
                        label="Category"
                        onChange={(e) => setSubjectCategoryId(e.target.value)}
                      >
                        {categories.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button type="submit" variant="contained">
                      Add
                    </Button>
                  </Box>
                </Box>
                <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Subject</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {subjects.map((sub) => {
                        const cat = categories.find((c) => c.id === sub.categoryId)?.name || 'Unknown';
                        return (
                          <TableRow key={sub.id}>
                            <TableCell>{sub.name}</TableCell>
                            <TableCell>{cat}</TableCell>
                            <TableCell align="right">
                              <IconButton onClick={() => handleDeleteSubject(sub.id)} color="error" size="small">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* PDF Upload Dialog */}
      <Dialog open={openPdfDialog} onClose={() => !loading && setOpenPdfDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Upload and Encrypt PDF</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2 }}>
          <TextField
            label="Document Title"
            fullWidth
            required
            disabled={loading}
            value={pdfTitle}
            onChange={(e) => setPdfTitle(e.target.value)}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            disabled={loading}
            value={pdfDesc}
            onChange={(e) => setPdfDesc(e.target.value)}
          />
          <FormControl fullWidth required>
            <InputLabel>Category</InputLabel>
            <Select
              value={pdfCategory}
              label="Category"
              disabled={loading}
              onChange={(e) => setPdfCategory(e.target.value)}
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl fullWidth required>
            <InputLabel>Subject</InputLabel>
            <Select
              value={pdfSubject}
              label="Subject"
              disabled={loading || !pdfCategory}
              onChange={(e) => setPdfSubject(e.target.value)}
            >
              {subjects
                .filter((s) => s.categoryId === pdfCategory)
                .map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Box sx={{ border: '1px dashed grey', p: 3, textAlign: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>
            <input
              accept="application/pdf"
              style={{ display: 'none' }}
              id="raised-button-file"
              type="file"
              disabled={loading}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPdfFile(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="raised-button-file">
              <Button variant="outlined" component="span" startIcon={<UploadIcon />} disabled={loading}>
                Select PDF
              </Button>
            </label>
            {pdfFile && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: '500', color: 'success.main' }}>
                Selected: {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(2)} MB)
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenPdfDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleUploadPdf} disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Encrypt & Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
