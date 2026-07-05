import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Book as BookIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  DeveloperMode as DeviceIcon,
} from '@mui/icons-material';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebase';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => (
  <Card sx={{ height: '100%', boxShadow: 1, borderRadius: 2 }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: '500', mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          {value}
        </Typography>
      </Box>
      <AvatarIconBox color={color}>{icon}</AvatarIconBox>
    </CardContent>
  </Card>
);

const AvatarIconBox: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 56,
      height: 56,
      borderRadius: '50%',
      bgcolor: `${color}.light`,
      color: `${color}.main`,
    }}
  >
    {children}
  </Box>
);

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pdfs: 0,
    users: 0,
    purchases: 0,
    devices: 0,
  });
  const [recentPurchases, setRecentPurchases] = useState<any[]>([]);

  useEffect(() => {
    // 1. Setup real-time listeners for stats
    const unsubPdfs = onSnapshot(collection(db, 'pdfs'), (snap) => {
      setStats(prev => ({ ...prev, pdfs: snap.size }));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setStats(prev => ({ ...prev, users: snap.size }));
    });

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      setStats(prev => ({ ...prev, purchases: snap.size }));
    });

    const unsubDevices = onSnapshot(collection(db, 'devices'), (snap) => {
      setStats(prev => ({ ...prev, devices: snap.size }));
    });

    // 2. Fetch 5 recent purchases
    const purchasesQuery = query(
      collection(db, 'purchases'),
      orderBy('purchaseDate', 'desc'),
      limit(5)
    );
    const unsubRecentPurchases = onSnapshot(purchasesQuery, (snap) => {
      const items: any[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setRecentPurchases(items);
      setLoading(false);
    });

    return () => {
      unsubPdfs();
      unsubUsers();
      unsubPurchases();
      unsubDevices();
      unsubRecentPurchases();
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Premium PDFs"
            value={stats.pdfs}
            icon={<BookIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Registered Students"
            value={stats.users}
            icon={<PeopleIcon />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Purchases"
            value={stats.purchases}
            icon={<ShoppingCartIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Bound Devices"
            value={stats.devices}
            icon={<DeviceIcon />}
            color="warning"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: 1, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Recent Purchases
              </Typography>
              {recentPurchases.length === 0 ? (
                <Typography color="text.secondary">No purchases recorded yet.</Typography>
              ) : (
                <List>
                  {recentPurchases.map((purchase, index) => (
                    <React.Fragment key={purchase.id}>
                      <ListItem sx={{ py: 1.5 }}>
                        <ListItemText
                          primary={`PDF ID: ${purchase.pdfId}`}
                          secondary={`User ID: ${purchase.userId} | Date: ${
                            purchase.purchaseDate
                              ? new Date(purchase.purchaseDate.seconds * 1000).toLocaleString()
                              : 'Pending'
                          }`}
                        />
                      </ListItem>
                      {index < recentPurchases.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: 1, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                System Status
              </Typography>
              <Box sx={{ py: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Symmetric Key Management: <strong>Active (AES-256-GCM)</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  App Check Enforcement: <strong>Enabled (Production Device Attestation)</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Max Active Devices: <strong>2 per student account</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Private Storage Check-ins: <strong>Active</strong>
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
