import { useState } from 'react';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';
import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail]   = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuthStore();

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
        localStorage.setItem('pwa_token', data.accessToken);
        await useAuthStore.setState({ user: data.user, token: data.accessToken, isAuthenticated: true });
        toast.success(`Welcome, ${data.user.name}!`);
      } else {
        const user = await login(email.trim(), password);
        toast.success(`Welcome, ${user.name}!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error ?? (mode === 'register' ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      background: 'linear-gradient(160deg, #0A0F1E 0%, #1E1040 100%)',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem',
          boxShadow: '0 0 40px rgba(99,102,241,0.4)',
        }}>
          🚨
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 6 }}>CrewRescue</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Field Technician App</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 360,
          background: 'rgba(30,41,59,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: '28px 24px',
          backdropFilter: 'blur(12px)',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} style={{ color: 'var(--brand-light)' }} />
          {mode === 'register' ? 'Create account' : 'Sign In'}
        </h2>

        {mode === 'login' && <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Quick Demo Logins:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { label: 'Technician 1', email: 'tech1@dhakapower.bd', pw: 'Tech@2025' },
              { label: 'Technician 2', email: 'tech2@dhakapower.bd', pw: 'Tech@2025' },
              { label: 'Supervisor',   email: 'supervisor@dhakapower.bd', pw: 'Supervisor@2025' },
              { label: 'Dispatcher',   email: 'dispatcher@dhakapower.bd', pw: 'Dispatch@2025' },
            ].map(r => (
              <button
                key={r.label}
                type="button"
                className="btn btn-ghost"
                style={{
                  fontSize: '0.72rem', padding: '6px 8px', borderRadius: 8,
                  background: email === r.email ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                  borderColor: email === r.email ? 'var(--brand-light)' : 'rgba(255,255,255,0.1)',
                  color: email === r.email ? '#fff' : 'var(--text-secondary)',
                }}
                onClick={() => { setEmail(r.email); setPassword(r.pw); }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && <>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input id="pwa-name" type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" autoComplete="name" minLength={2} required />
            </div>
            <div>
              <label style={labelStyle}>Organization <span style={{ opacity: 0.7 }}>(first setup only)</span></label>
              <input id="pwa-org-name" type="text" className="input" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Your organization" autoComplete="organization" />
            </div>
          </>}
          <div>
            <label style={labelStyle}>
              Email Address
            </label>
            <input
              id="pwa-email"
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="technician@company.bd"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>
              Password
            </label>
            <input
              id="pwa-password"
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          {mode === 'register' && <div>
            <label style={labelStyle}>Confirm Password</label>
            <input id="pwa-confirm-password" type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat your password" autoComplete="new-password" minLength={8} required />
          </div>}

          <button
            id="pwa-login-btn"
            type="submit"
            className="btn btn-primary btn-action"
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            {loading
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in…</>
              : mode === 'register' ? 'Create Account' : 'Sign In'
            }
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {mode === 'register' ? 'Already have an account?' : 'New to CrewRescue?'}
          </span>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '4px 8px' }} onClick={() => setMode(mode === 'register' ? 'login' : 'register')}>
            {mode === 'register' ? 'Sign in' : 'Register as a user'}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 24, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        CrewRescue Field App v1.0 · PWA · Works Offline
      </p>
    </div>
  );
}

const labelStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
  fontWeight: 600,
};
