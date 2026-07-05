import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { auth, db } from '../utils/firebase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      // Save administrator profile directly under users/{uid}
      await set(ref(db, `users/${uid}`), {
        email,
        name: name.trim() || 'Administrator',
        role: 'admin',
        status: 'active',
        createdAt: Date.now(),
      });
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create administrator account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="xs">
        <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ mb: 3, textAlign: 'center' }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                BrainDocx
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {isSignUp ? 'Create Admin Account' : 'Secure PDF Admin Console'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
              {isSignUp && (
                <TextField
                  label="Full Name"
                  type="text"
                  fullWidth
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
              <TextField
                label="Admin Email"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{ py: 1.5, fontWeight: 'bold', mb: 2 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : isSignUp ? (
                  'Register Admin'
                ) : (
                  'Log In'
                )}
              </Button>
            </form>

            {!isSignUp && (
              <>
                <Divider sx={{ my: 2 }}>OR</Divider>

                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  startIcon={<GoogleIcon />}
                  sx={{
                    py: 1.5,
                    fontWeight: 'bold',
                    borderColor: 'grey.300',
                    color: 'text.primary',
                    '&:hover': {
                      borderColor: 'grey.400',
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  Sign In with Google
                </Button>
              </>
            )}

            <Button
              onClick={() => {
                setError('');
                setIsSignUp(!isSignUp);
              }}
              fullWidth
              sx={{ mt: 2, textTransform: 'none' }}
            >
              {isSignUp ? 'Already have an account? Log In' : 'Create Admin Account (First-Time Setup)'}
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
