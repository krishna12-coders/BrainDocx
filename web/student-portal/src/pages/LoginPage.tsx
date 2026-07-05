import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ref, set } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';

export const LoginPage: React.FC = () => {
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        if (!name.trim()) { setError('Please enter your full name.'); setLoading(false); return; }
        if (isAdminRoute) {
          // Register as admin
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          await set(ref(db, `users/${cred.user.uid}`), {
            email: email.trim(),
            name: name.trim(),
            role: 'admin',
            status: 'active',
            createdAt: Date.now(),
          });
          navigate('/admin/dashboard');
        } else {
          await register(email.trim(), password, name.trim());
          navigate('/');
        }
      } else {
        const role = await login(email.trim(), password);
        if (isAdminRoute) {
          if (role !== 'admin') {
            setError('Access denied. This login page is for administrators only.');
            await import('firebase/auth').then(m => m.signOut(auth));
            setLoading(false);
            return;
          }
          navigate('/admin/dashboard');
        } else {
          if (role === 'admin') {
            navigate('/admin/dashboard');
          } else {
            navigate('/');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const role = await loginWithGoogle();
      if (isAdminRoute && role !== 'admin') {
        setError('Google account is not registered as an administrator.');
        setLoading(false);
        return;
      }
      navigate(role === 'admin' ? '/admin/dashboard' : '/');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">{isAdminRoute ? '🛡️' : '📚'}</div>
          <div className="auth-title">BrainDocx</div>
          <div className="auth-subtitle">
            {isAdminRoute ? 'Admin Console' : 'Student Study Portal'}
          </div>
          {isAdminRoute && (
            <div style={{
              display: 'inline-block',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '99px',
              padding: '3px 12px',
              fontSize: '11px',
              color: '#f87171',
              fontWeight: 700,
              marginTop: '8px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
            }}>
              🔒 Admin Access Only
            </div>
          )}
        </div>

        <div className="auth-mode-title">
          {isSignUp
            ? (isAdminRoute ? 'Create Admin Account' : 'Create Student Account')
            : 'Welcome Back'}
        </div>

        {error && <div className="error-alert">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder={isAdminRoute ? 'Administrator Name' : 'John Doe'}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder={isAdminRoute ? 'admin@institution.com' : 'student@example.com'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{
              marginTop: '8px',
              background: isAdminRoute
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : undefined,
              boxShadow: isAdminRoute ? '0 4px 12px rgba(239,68,68,0.3)' : undefined,
            }}
            disabled={loading}
          >
            {loading ? '⏳ Please wait...' : isSignUp
              ? (isAdminRoute ? '🛡️ Create Admin Account' : '🚀 Create Account')
              : (isAdminRoute ? '🔐 Admin Sign In' : '🔐 Sign In')}
          </button>
        </form>

        {!isAdminRoute && (
          <>
            <div className="divider">or</div>
            <button
              className="btn btn-secondary btn-full"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <button
          className="btn btn-ghost btn-full"
          style={{ marginTop: '16px' }}
          onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
          disabled={loading}
        >
          {isSignUp
            ? 'Already have an account? Sign In →'
            : (isAdminRoute ? 'First time? Create Admin Account →' : "Don't have an account? Sign Up →")}
        </button>

        {/* Link between portals */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          {isAdminRoute ? (
            <a href="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
              ← Back to Student Portal
            </a>
          ) : (
            <a href="/admin" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
              Are you an admin? → Admin Console
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
