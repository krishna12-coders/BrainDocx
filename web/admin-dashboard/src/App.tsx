import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';

import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PDFs } from './pages/PDFs';
import { Users } from './pages/Users';
import { Purchases } from './pages/Purchases';
import { Notifications } from './pages/Notifications';

// Slate Indigo & Coral Premium Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#4f46e5', // modern indigo
      light: '#e0e7ff',
      dark: '#3730a3',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f97316', // orange coral
      light: '#ffedd5',
      dark: '#c2410c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Dashboard Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pdfs" element={<ProtectedRoute><PDFs /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute><Purchases /></ProtectedRoute>} />
            <Route path="/coupons" element={<ProtectedRoute><Purchases /></ProtectedRoute>} /> {/* Coupons are inside a tab in Purchases */}
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* Catch-all redirection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
