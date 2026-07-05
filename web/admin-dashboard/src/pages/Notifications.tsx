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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon, Send as SendIcon } from '@mui/icons-material';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  target: string;
  sentAt: any;
}

export const Notifications: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // Notification Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState('all'); // 'all' or 'specific'
  const [targetUserId, setTargetUserId] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    // Listen to Notifications
    const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snap) => {
      const items: NotificationItem[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as NotificationItem);
      });
      // Sort client-side by time
      items.sort((a, b) => {
        const timeA = a.sentAt ? a.sentAt.seconds : 0;
        const timeB = b.sentAt ? b.sentAt.seconds : 0;
        return timeB - timeA; // newest first
      });
      setNotifications(items);
      setLoading(false);
    });

    return unsubNotifications;
  }, []);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Broadcast Notification
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      showMessage('Please fill in both the title and body of the notification.', 'error');
      return;
    }

    if (targetType === 'specific' && !targetUserId.trim()) {
      showMessage('Please specify a Student UID for targeted notification.', 'error');
      return;
    }

    try {
      const notifDocRef = doc(collection(db, 'notifications'));
      await setDoc(notifDocRef, {
        title: title.trim(),
        body: body.trim(),
        target: targetType === 'all' ? 'all' : targetUserId.trim(),
        sentAt: serverTimestamp(),
      });

      setTitle('');
      setBody('');
      setTargetUserId('');
      showMessage('Notification dispatched successfully!');
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  // Delete notification
  const handleDeleteNotification = async (id: string) => {
    if (window.confirm('Delete this notification log entry? It will also disappear from users\' apps.')) {
      try {
        await deleteDoc(doc(db, 'notifications', id));
        showMessage('Notification removed.');
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
      <Grid container spacing={3}>
        {/* Create Notification Form */}
        <Grid item xs={12} md={5}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Send Announcement
              </Typography>
              <Box component="form" onSubmit={handleSendNotification} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  label="Notification Title"
                  fullWidth
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                
                <TextField
                  label="Message Body"
                  fullWidth
                  multiline
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />

                <FormControl fullWidth>
                  <InputLabel>Recipient Target</InputLabel>
                  <Select
                    value={targetType}
                    label="Recipient Target"
                    onChange={(e) => setTargetType(e.target.value)}
                  >
                    <MenuItem value="all">All Students</MenuItem>
                    <MenuItem value="specific">Specific Student UID</MenuItem>
                  </Select>
                </FormControl>

                {targetType === 'specific' && (
                  <TextField
                    label="Recipient Student UID"
                    placeholder="Enter user document ID"
                    fullWidth
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                  />
                )}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  endIcon={<SendIcon />}
                  fullWidth
                >
                  Broadcast Message
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* History of Sent Notifications */}
        <Grid item xs={12} md={7}>
          <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                Dispatch Log
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableRow sx={{ display: 'none' }} /> {/* Fix MUI Header warning if needed */}
                      <TableCell sx={{ fontWeight: 'bold' }}>Notification</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Target</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date Sent</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }} align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {notifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                          No notifications sent yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      notifications.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.body}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {item.target === 'all' ? (
                              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 'bold' }}>ALL STUDENTS</Typography>
                            ) : (
                              <Typography variant="caption" sx={{ fontClassName: 'monospace' }}>UID: {item.target}</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>
                            {item.sentAt
                              ? new Date(item.sentAt.seconds * 1000).toLocaleString()
                              : 'Pending'}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => handleDeleteNotification(item.id)} color="error" size="small">
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
