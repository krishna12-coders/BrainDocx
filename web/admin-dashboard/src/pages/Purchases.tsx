import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
  Chip,
  IconButton,
  Tabs,
  Tab,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Block as RevokeIcon,
  CheckCircle as ActivateIcon,
} from '@mui/icons-material';
import { ref, onValue, set, remove, update } from 'firebase/database';
import { db } from '../utils/firebase';

interface Purchase {
  id: string;
  userId: string;
  pdfId: string;
  purchaseDate: any;
  status: 'active' | 'revoked';
  discountApplied: number;
}

interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string;
  active: boolean;
}

export const Purchases: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  
  // Coupon Form State
  const [couponCode, setCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number | ''>('');
  const [expiryDate, setExpiryDate] = useState('');
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    // Listen to Purchases (nested under purchases/{userId}/{pdfId})
    const unsubPurchases = onValue(ref(db, 'purchases'), (snap) => {
      const items: Purchase[] = [];
      if (snap.exists()) {
        snap.forEach((userPurchasesSnap) => {
          const userId = userPurchasesSnap.key;
          userPurchasesSnap.forEach((purchaseDoc) => {
            items.push({
              id: `${userId}_${purchaseDoc.key}`,
              userId,
              pdfId: purchaseDoc.key,
              ...purchaseDoc.val(),
            } as Purchase);
          });
        });
      }
      setPurchases(items);
      setLoading(false);
    });

    // Listen to Coupons
    const unsubCoupons = onValue(ref(db, 'coupons'), (snap) => {
      const items: Coupon[] = [];
      if (snap.exists()) {
        snap.forEach((doc) => {
          items.push({ id: doc.key, ...doc.val() } as Coupon);
        });
      }
      setCoupons(items);
    });

    return () => {
      unsubPurchases();
      unsubCoupons();
    };
  }, []);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Revoke purchase (blocks access inside Storage and App check-ins)
  const handleTogglePurchaseStatus = async (purchase: Purchase) => {
    const nextStatus = purchase.status === 'active' ? 'revoked' : 'active';
    if (!window.confirm(`Are you sure you want to change purchase status to ${nextStatus}?`)) {
      return;
    }

    try {
      await update(ref(db, `purchases/${purchase.userId}/${purchase.pdfId}`), {
        status: nextStatus,
      });
      showMessage(`Purchase status set to ${nextStatus}.`);
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  // Create Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || discountPercent === '' || !expiryDate) {
      showMessage('Please fill all fields for coupon creation.', 'error');
      return;
    }

    const codeUpper = couponCode.trim().toUpperCase();

    try {
      await set(ref(db, `coupons/${codeUpper}`), {
        code: codeUpper,
        discountPercent: Number(discountPercent),
        expiresAt: expiryDate,
        active: true,
        createdAt: Date.now(),
      });
      setCouponCode('');
      setDiscountPercent('');
      setExpiryDate('');
      showMessage('Coupon created successfully.');
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  // Toggle Coupon Active Status
  const handleToggleCoupon = async (coupon: Coupon) => {
    try {
      await update(ref(db, `coupons/${coupon.id}`), {
        active: !coupon.active,
      });
      showMessage('Coupon status updated.');
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async (id: string) => {
    if (window.confirm('Delete this coupon?')) {
      try {
        await remove(ref(db, `coupons/${id}`));
        showMessage('Coupon deleted.');
      } catch (err: any) {
        showMessage(err.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ mb: 3 }}>
        <Tab label="Purchases Ledger" />
        <Tab label="Coupons Management" />
      </Tabs>

      {activeTab === 0 && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
            Purchase History
          </Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
            <Table>
              <TableHead sx={{ bgcolor: 'action.selected' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Purchase ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Student UID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>PDF ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Discount Applied</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      No purchases recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell sx={{ fontSize: 13, fontClassName: 'monospace' }}>{purchase.id}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{purchase.userId}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{purchase.pdfId}</TableCell>
                      <TableCell>{purchase.discountApplied || 0}%</TableCell>
                      <TableCell>
                        {purchase.purchaseDate
                          ? new Date(purchase.purchaseDate.seconds * 1000).toLocaleString()
                          : 'Pending'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={purchase.status}
                          color={purchase.status === 'active' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          color={purchase.status === 'active' ? 'error' : 'success'}
                          startIcon={purchase.status === 'active' ? <RevokeIcon /> : <ActivateIcon />}
                          onClick={() => handleTogglePurchaseStatus(purchase)}
                        >
                          {purchase.status === 'active' ? 'Revoke Access' : 'Restore'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Coupon Form */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Create Coupon
                </Typography>
                <Box component="form" onSubmit={handleCreateCoupon} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <TextField
                    label="Coupon Code"
                    placeholder="e.g. SAVE25"
                    fullWidth
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <TextField
                    label="Discount Percent (%)"
                    type="number"
                    fullWidth
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <TextField
                    label="Expiry Date"
                    type="date"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                  <Button type="submit" variant="contained" fullWidth size="large">
                    Create Coupon
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Coupon List */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                  Active Coupons
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Discount</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Expiry</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {coupons.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                            No coupons created yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        coupons.map((coupon) => (
                          <TableRow key={coupon.id}>
                            <TableCell sx={{ fontWeight: 'bold' }}>{coupon.code}</TableCell>
                            <TableCell>{coupon.discountPercent}%</TableCell>
                            <TableCell>{coupon.expiresAt}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={coupon.active ? 'Active' : 'Disabled'}
                                color={coupon.active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton onClick={() => handleToggleCoupon(coupon)} color={coupon.active ? 'warning' : 'success'}>
                                {coupon.active ? <RevokeIcon fontSize="small" /> : <ActivateIcon fontSize="small" />}
                              </IconButton>
                              <IconButton onClick={() => handleDeleteCoupon(coupon.id)} color="error">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

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
