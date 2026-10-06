import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const DEMO_ROLES = [
    { key: 'admin',      label: 'Admin',        email: 'admin@dhakapower.bd',      pw: 'Admin@CrewRescue2025' },
    { key: 'dispatcher', label: 'Dispatcher',   email: 'dispatcher@dhakapower.bd', pw: 'Dispatch@2025' },
    { key: 'emergency',  label: 'Emergency Mgr',email: 'emergency@dhakapower.bd',  pw: 'Emergency@2025' },
    { key: 'supervisor', label: 'Supervisor',   email: 'supervisor@dhakapower.bd', pw: 'Supervisor@2025' },
    { key: 'executive',  label: 'Executive',    email: 'executive@dhakapower.bd',  pw: 'Executive@2025' },
  ];

  function fillDemo(r) {
    setEmail(r.email);
    setPassword(r.pw);
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' } }} />

      <div className="login-card fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🚨</div>
          <div className="login-title">CrewRescue AI</div>
          <div className="login-sub">Emergency Field Operations Platform</div>
        </div>

        {/* Quick fill buttons */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Demo Logins
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DEMO_ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '0.72rem', padding: '4px 8px', borderRadius: 8,
                  background: email === r.email ? 'var(--brand-glow)' : 'rgba(255,255,255,0.04)',
                  borderColor: email === r.email ? 'var(--brand-500)' : 'var(--border-subtle)',
                }}
                onClick={() => fillDemo(r)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg login-submit"
            disabled={loading}
          >
            {loading ? (
              <><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</>
            ) : 'Sign In to CrewRescue'}
          </button>
        </form>

        <div className="divider" />
        <div style={{ textAlign: 'center' }}>
          <span className="text-xs text-muted">
            DhakaPower Utilities · Emergency Operations
          </span>
        </div>
      </div>
    </div>
  );
}
