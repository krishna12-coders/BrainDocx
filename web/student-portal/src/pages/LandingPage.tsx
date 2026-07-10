import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeDrmStep, setActiveDrmStep] = useState(0);

  // Rotate DRM showcase steps automatically for dynamic feel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDrmStep((prev) => (prev + 1) % 3);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing-container">
      {/* ── Navbar ── */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <span className="landing-logo-icon">📚</span>
          <span>BrainDocx</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#security" className="landing-nav-link">Security</a>
          <a href="#stats" className="landing-nav-link">Stats</a>
          <button className="btn-glass" onClick={() => navigate('/login')}>
            Sign In
          </button>
          <button className="btn-glass btn-accent" onClick={() => navigate('/login')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <header className="landing-hero">
        <div className="hero-content">
          <div className="hero-tag">✨ Advanced Study Platform</div>
          <h1 className="hero-title">
            Secure, Encrypted <span>Study Materials</span> for Modern Students
          </h1>
          <p className="hero-desc">
            Access, read, and purchase premium educational documents with state-of-the-art intellectual property protection. Learn confidently with cross-device progression sync.
          </p>
          <div className="hero-ctas">
            <button className="btn-glass btn-accent" onClick={() => navigate('/login')}>
              Explore Library 🚀
            </button>
            <button className="btn-glass" onClick={() => {
              const el = document.getElementById('features');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Learn More
            </button>
          </div>
        </div>

        <div className="hero-graphic-container">
          <div className="hero-glow-orb"></div>
          <div className="hero-card-preview">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📖</span>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Active Study Session</span>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>Active</span>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Advanced Biochemistry Lecture Notes</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Size: 4.8 MB • Pages: 120</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <span>Reading Progress</span>
                <span>72% Completed</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{ width: '72%', height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>14</div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>Total Unlocked</div>
              </div>
              <div style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 800 }}>8.5h</div>
                <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '2px' }}>Study Time</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Features Section ── */}
      <section id="features" className="section-wrapper">
        <div className="section-header">
          <h2 className="section-title">Designed for Next-Gen Study Environments</h2>
          <p className="section-subtitle">
            BrainDocx merges beautiful reading interfaces with robust security layers, providing an unmatched educational experience.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">🔒</div>
            <h3 className="feature-title">Secure Encrypted PDFs</h3>
            <p className="feature-text">
              Our custom DRM engine keeps documents fully encrypted at rest and in transit, preventing unauthorized distribution while ensuring premium readability.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">📊</div>
            <h3 className="feature-title">Progress Synchronization</h3>
            <p className="feature-text">
              Never lose your spot. BrainDocx automatically saves your active page, total study time, and learning milestones across all browser instances.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🛒</div>
            <h3 className="feature-title">Integrated Document Store</h3>
            <p className="feature-text">
              Directly purchase materials vetted by verified administrators and institutional educators, instantly unlocking them to your personal shelf.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">📢</div>
            <h3 className="feature-title">Real-Time Broadcasts</h3>
            <p className="feature-text">
              Stay in the loop with broadcast announcements, study schedule updates, and syllabus changes sent directly from the admin command center.
            </p>
          </div>
        </div>
      </section>

      {/* ── DRM Security Showcase ── */}
      <section id="security" className="section-wrapper" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="drm-showcase">
          <div>
            <div className="hero-tag" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>Intellectual Property Protection</div>
            <h2 className="section-title" style={{ marginTop: '16px', marginBottom: '20px' }}>Bulletproof DRM Pipeline</h2>
            <p className="section-subtitle" style={{ textAlign: 'left', marginBottom: '24px' }}>
              We employ advanced client-side cryptographic layers. Study materials are never stored in cache or download folders, keeping creators' and publishers' intellectual property entirely secure.
            </p>
            <button className="btn-glass" onClick={() => navigate('/login')}>
              Get Secured Access
            </button>
          </div>

          <div className="drm-visual">
            <div className={`drm-step ${activeDrmStep === 0 ? 'active' : ''}`}>
              <span style={{ fontSize: '20px' }}>🔑</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>1. AES-256 Encryption</strong>
                <span style={{ color: 'var(--text-secondary)' }}>Files are encrypted immediately upon upload by administrators.</span>
              </div>
            </div>
            <div className={`drm-step ${activeDrmStep === 1 ? 'active' : ''}`}>
              <span style={{ fontSize: '20px' }}>📡</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>2. Single-Session Token Sync</strong>
                <span style={{ color: 'var(--text-secondary)' }}>Decryption keys are negotiated in real-time with Firebase Auth tokens.</span>
              </div>
            </div>
            <div className={`drm-step ${activeDrmStep === 2 ? 'active' : ''}`}>
              <span style={{ fontSize: '20px' }}>🖥️</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>3. Memory-Only Render</strong>
                <span style={{ color: 'var(--text-secondary)' }}>Documents are decrypted locally in-memory inside our sandboxed viewer.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section id="stats" className="section-wrapper">
        <div className="section-header">
          <h2 className="section-title">Trusted by Thousands of Students</h2>
          <p className="section-subtitle">Our platform runs 24/7 providing instant, lag-free academic access.</p>
        </div>

        <div className="landing-stats-grid">
          <div className="landing-stat-card">
            <div className="landing-stat-number">10k+</div>
            <div className="landing-stat-label">Active Learners</div>
          </div>
          <div className="landing-stat-card">
            <div className="landing-stat-number">250k+</div>
            <div className="landing-stat-label">Pages Read Daily</div>
          </div>
          <div className="landing-stat-card">
            <div className="landing-stat-number">99.9%</div>
            <div className="landing-stat-label">Service Uptime</div>
          </div>
        </div>
      </section>

      {/* ── Pre-Footer CTA ── */}
      <section className="section-wrapper" style={{ textAlign: 'center', background: 'radial-gradient(ellipse at 50% 50%, rgba(79, 110, 247, 0.08) 0%, transparent 60%)' }}>
        <h2 className="section-title">Ready to Transform Your Learning Journey?</h2>
        <p className="section-subtitle" style={{ maxWidth: '500px', margin: '12px auto 24px' }}>
          Sign up now and get instant access to your classes' notes, lecture slides, and supplementary academic files.
        </p>
        <button className="btn-glass btn-accent" style={{ padding: '16px 36px', fontSize: '16px' }} onClick={() => navigate('/login')}>
          Create Account Now
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-row">
          <div className="landing-logo">
            <span className="landing-logo-icon">📚</span>
            <span>BrainDocx</span>
          </div>
          <div className="footer-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#security" className="landing-nav-link">Security</a>
            <a href="#stats" className="landing-nav-link">Stats</a>
            <a href="/admin" className="landing-nav-link" style={{ color: 'var(--accent)' }}>Admin Portal</a>
          </div>
        </div>
        <div className="footer-row">
          <div className="footer-copyright">
            &copy; {new Date().getFullYear()} BrainDocx. All rights reserved. Secure material DRM system.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Designed for secure educational distribution.
          </div>
        </div>
      </footer>
    </div>
  );
};
