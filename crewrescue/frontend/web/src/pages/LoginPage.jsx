import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === 'register' && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const { data } = await api.post('/auth/register', {
          name: name.trim(),
          email: email.trim(),
          password,
          ...(orgName.trim() ? { orgName: orgName.trim() } : {}),
        });
        localStorage.setItem('accessToken', data.accessToken);
        useAuthStore.setState({ user: data.user, isAuthenticated: true });
      } else {
        await login(email.trim(), password);
      }
      toast.dismiss(); // clear any lingering error toasts
      toast.success(mode === 'register' ? 'Account created' : 'Welcome back', { duration: 3000 });
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error ?? (mode === 'register' ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />


      <div className="login-card fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🚨</div>
            <div className="login-title">CrewRescue AI</div>
          <div className="login-sub">Emergency Field Operations Platform</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="name">Full Name</label>
                  <input id="name" type="text" className="form-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="org-name">Organization <span className="text-muted">(first setup only)</span></label>
                  <input id="org-name" type="text" className="form-input" placeholder="Your organization" value={orgName} onChange={(e) => setOrgName(e.target.value)} autoComplete="organization" />
                </div>
              </>
            )}
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
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input id="confirm-password" type="password" className="form-input" placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg login-submit"
            disabled={loading}
          >
            {loading ? (
              <><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</>
            ) : mode === 'register' ? 'Create Account' : 'Sign In to CrewRescue'}
          </button>
        </form>

        <div className="login-switch">
          <span className="text-xs text-muted">
            {mode === 'register' ? 'Already have an account?' : 'New to CrewRescue?'}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
            {mode === 'register' ? 'Sign in' : 'Register as a user'}
          </button>
        </div>
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
