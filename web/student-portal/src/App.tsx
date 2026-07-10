import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './AuthContext';

// Student pages
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProgressPage } from './pages/ProgressPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { PDFViewerModal } from './components/PDFViewerModal';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminPDFs } from './pages/admin/AdminPDFs';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminPurchases } from './pages/admin/AdminPurchases';
import { AdminNotifications } from './pages/admin/AdminNotifications';

/* ── Shared Loading Screen ── */
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="spinner" />
    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Loading BrainDocx...</div>
  </div>
);

/* ══════════════════════════════════════════
   STUDENT PORTAL SHELL
══════════════════════════════════════════ */
type StudentPage = 'library' | 'progress' | 'notifications' | 'profile';
const STUDENT_NAV = [
  { id: 'library', label: 'Library', icon: '📚' },
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'profile', label: 'Profile', icon: '👤' },
] as const;

const StudentShell: React.FC = () => {
  const { user, userRole, logout } = useAuth();
  const [page, setPage] = useState<StudentPage>('library');
  const [viewer, setViewer] = useState<{ pdf: any; startPage?: number } | null>(null);

  // If logged in as admin, redirect to admin area
  if (userRole === 'admin') return <Navigate to="/admin/dashboard" replace />;

  const initials = (user?.displayName || user?.email || 'S')
    .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  const renderPage = () => {
    switch (page) {
      case 'library': return (
        <LibraryPage onOpenViewer={(pdf) => setViewer({ pdf })} />
      );
      case 'progress': return (
        <ProgressPage onResume={(pdfId, title, lastPage) =>
          setViewer({ pdf: { id: pdfId, title, description: '', encryptedStoragePath: '', sizeInBytes: 0 }, startPage: lastPage })
        } />
      );
      case 'notifications': return <NotificationsPage />;
      case 'profile': return <ProfilePage />;
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>📚</span>
          <span style={{ fontWeight: 800, fontSize: '16px' }}>BrainDocx</span>
        </div>
        <button className="mobile-logout-btn" onClick={() => { if (confirm('Sign out?')) logout(); }}>🚪</button>
      </header>

      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon">📚</div>
            <div>
              <div className="sidebar-logo-text">BrainDocx</div>
              <div className="sidebar-logo-sub">Student Portal</div>
            </div>
          </div>
        </div>
        <div className="sidebar-nav">
          {STUDENT_NAV.map(item => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id as StudentPage)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-chip" onClick={() => setPage('profile')}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.displayName || user?.email}</div>
              <div className="user-role">Student</div>
            </div>
          </div>
          <button className="logout-btn" onClick={() => { if (confirm('Sign out?')) logout(); }}>🚪 Sign Out</button>
        </div>
      </nav>
      <main className="main-content">{renderPage()}</main>
      
      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {STUDENT_NAV.map(item => (
          <button key={item.id} className={`bottom-nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id as StudentPage)}>
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {viewer && (
        <PDFViewerModal pdf={viewer.pdf} startPage={viewer.startPage} onClose={() => setViewer(null)} />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════
   ADMIN PORTAL SHELL
══════════════════════════════════════════ */
type AdminPage = 'dashboard' | 'pdfs' | 'users' | 'purchases' | 'notifications';
const ADMIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'pdfs', label: 'PDF Library', icon: '📄' },
  { id: 'users', label: 'Students', icon: '👥' },
  { id: 'purchases', label: 'Purchases', icon: '🛒' },
  { id: 'notifications', label: 'Broadcasts', icon: '📢' },
] as const;

const AdminShell: React.FC = () => {
  const { user, userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Derive current page from URL path
  const pathSegment = location.pathname.split('/').pop() as AdminPage;
  const activePage: AdminPage = ADMIN_NAV.find(n => n.id === pathSegment) ? pathSegment : 'dashboard';

  // If not admin, send back to admin login
  if (userRole === 'student') return <Navigate to="/admin" replace />;

  const initials = (user?.displayName || user?.email || 'A')
    .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <AdminDashboard />;
      case 'pdfs': return <AdminPDFs />;
      case 'users': return <AdminUsers />;
      case 'purchases': return <AdminPurchases />;
      case 'notifications': return <AdminNotifications />;
    }
  };

  const handleNav = (target: string) => {
    navigate(target);
    setSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Mobile Top Header */}
      <header className="mobile-header" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <span style={{ fontWeight: 800, fontSize: '16px', color: '#f87171' }}>Admin Console</span>
        </div>
        <button className="mobile-logout-btn" onClick={() => { if (confirm('Sign out?')) logout(); }}>🚪</button>
      </header>

      <nav className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ borderRight: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>🛡️</div>
            <div>
              <div className="sidebar-logo-text" style={{ background: 'linear-gradient(135deg,#f87171,#fca5a5)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>BrainDocx</div>
              <div className="sidebar-logo-sub">Admin Console</div>
            </div>
          </div>
          <div style={{ marginTop: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 10px', fontSize: '10px', color: '#f87171', fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' }}>
            🔒 ADMIN ACCESS
          </div>
        </div>
        <div className="sidebar-nav">
          {ADMIN_NAV.map(item => (
            <button key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              style={activePage === item.id ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' } : {}}
              onClick={() => handleNav(`/admin/${item.id}`)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar" style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)' }}>{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.displayName || user?.email}</div>
              <div className="user-role" style={{ color: '#f87171' }}>Administrator</div>
            </div>
          </div>
          <button className="logout-btn" onClick={() => { if (confirm('Sign out of admin console?')) logout(); }}>🚪 Sign Out</button>
          <a href="/" style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', textDecoration: 'none' }} onClick={() => setSidebarOpen(false)}>
            ← Student Portal
          </a>
        </div>
      </nav>
      <main className="main-content">{renderPage()}</main>
    </div>
  );
};

/* ══════════════════════════════════════════
   ROOT ROUTER
══════════════════════════════════════════ */
const AppRouter: React.FC = () => {
  const { user, userRole, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* ── Student Routes ── */}
      <Route path="/"
        element={user && userRole === 'student' ? <StudentShell /> : user && userRole === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <LandingPage />}
      />

      <Route path="/login"
        element={user && userRole === 'student' ? <Navigate to="/" replace /> : user && userRole === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <LoginPage />}
      />

      {/* ── Admin Login ── */}
      <Route path="/admin"
        element={user && userRole === 'admin' ? <Navigate to="/admin/dashboard" replace /> : user && userRole === 'student' ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* ── Admin Dashboard Routes ── */}
      <Route path="/admin/dashboard" element={user && userRole === 'admin' ? <AdminShell /> : <Navigate to="/admin" replace />} />
      <Route path="/admin/pdfs"      element={user && userRole === 'admin' ? <AdminShell /> : <Navigate to="/admin" replace />} />
      <Route path="/admin/users"     element={user && userRole === 'admin' ? <AdminShell /> : <Navigate to="/admin" replace />} />
      <Route path="/admin/purchases" element={user && userRole === 'admin' ? <AdminShell /> : <Navigate to="/admin" replace />} />
      <Route path="/admin/notifications" element={user && userRole === 'admin' ? <AdminShell /> : <Navigate to="/admin" replace />} />

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
