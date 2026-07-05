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
  Chip,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircle as ActiveIcon,
  DeleteForever as UnbindIcon,
} from '@mui/icons-material';
import { ref, onValue, remove } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../utils/firebase';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'blocked';
  createdAt: any;
}

interface Device {
  id: string;
  userId: string;
  deviceModel: string;
  osVersion: string;
  registeredAt: any;
  lastUsedAt: any;
  status: 'active' | 'blocked';
}

export const Users: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    // Listen to Users
    const unsubUsers = onValue(ref(db, 'users'), (snap) => {
      const items: UserProfile[] = [];
      if (snap.exists()) {
        snap.forEach((doc) => {
          const data = doc.val();
          if (data.role !== 'admin') {
            items.push({ id: doc.key, ...data } as UserProfile);
          }
        });
      }
      setUsers(items);
      setLoading(false);
    });

    // Listen to Devices (Nested devices/{userId}/{deviceId})
    const unsubDevices = onValue(ref(db, 'devices'), (snap) => {
      const items: Device[] = [];
      if (snap.exists()) {
        snap.forEach((userDevicesSnap) => {
          userDevicesSnap.forEach((devSnap) => {
            items.push({ id: devSnap.key, userId: userDevicesSnap.key, ...devSnap.val() } as Device);
          });
        });
      }
      setDevices(items);
    });

    return () => {
      unsubUsers();
      unsubDevices();
    };
  }, []);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Toggle user active/blocked status via Cloud Function
  const handleToggleUserStatus = async (userId: string, currentStatus: 'active' | 'blocked') => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    if (!window.confirm(`Are you sure you want to change this student's status to ${newStatus}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const setUserStatusFn = httpsCallable(functions, 'setUserStatus');
      await setUserStatusFn({ targetUserId: userId, status: newStatus });
      showMessage(`Successfully changed user status to ${newStatus}.`);
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || 'Failed to update user status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Unbind a device (delete device document in RTDB)
  const handleUnbindDevice = async (userId: string, deviceId: string) => {
    if (!window.confirm('Are you sure you want to unbind this device? This will release one of the user\'s slots.')) {
      return;
    }

    setActionLoading(true);
    try {
      await remove(ref(db, `devices/${userId}/${deviceId}`));
      showMessage('Device successfully unbound.');
    } catch (err: any) {
      console.error(err);
      showMessage(err.message || 'Failed to unbind device.', 'error');
    } finally {
      setActionLoading(false);
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
      <Grid container spacing={3}>
        {/* Students List */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Student Registry
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Name & Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Devices</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          No students registered yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => {
                        const userDevices = devices.filter((d) => d.userId === user.id);
                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: '500' }}>
                                {user.name || 'No Name'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {user.email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={user.status === 'active' ? 'Active' : 'Blocked'}
                                color={user.status === 'active' ? 'success' : 'error'}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: '500' }}>
                                {userDevices.length} / 2
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                color={user.status === 'active' ? 'error' : 'success'}
                                startIcon={user.status === 'active' ? <BlockIcon /> : <ActiveIcon />}
                                disabled={actionLoading}
                                onClick={() => handleToggleUserStatus(user.id, user.status)}
                              >
                                {user.status === 'active' ? 'Block' : 'Unblock'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Bound Devices List */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Bound Devices ({devices.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Model & OS</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Student Email</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Unbind</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {devices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                          No active devices bound.
                        </TableCell>
                      </TableRow>
                    ) : (
                      devices.map((device) => {
                        const owner = users.find((u) => u.id === device.userId);
                        return (
                          <TableRow key={device.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: '500' }}>
                                {device.deviceModel}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                OS: {device.osVersion}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{owner ? owner.email : 'Unknown'}</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                color="error"
                                disabled={actionLoading}
                                onClick={() => handleUnbindDevice(device.userId, device.id)}
                              >
                                <UnbindIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
