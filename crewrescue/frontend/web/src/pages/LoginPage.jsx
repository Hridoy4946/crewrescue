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

  function fillDemo(role) {
    if (role === 'admin') {
      setEmail('admin@dhakapower.bd');
      setPassword('Admin@CrewRescue2025');
    } else {
      setEmail('dispatcher@dhakapower.bd');
      setPassword('Dispatch@2025');
    }
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className="btn btn-ghost btn-sm w-full" style={{ flex: 1 }} onClick={() => fillDemo('admin')}>
            Fill Admin
          </button>
          <button className="btn btn-ghost btn-sm w-full" style={{ flex: 1 }} onClick={() => fillDemo('dispatcher')}>
            Fill Dispatcher
          </button>
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
