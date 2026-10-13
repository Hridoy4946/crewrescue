import { useState } from 'react';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';
import { HardHat, Radio, ShieldCheck, Siren } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail]   = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState('TECHNICIAN');
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
          role,
          ...(orgName.trim() ? { orgName: orgName.trim() } : {}),
        });
        if (data.pendingApproval) {
          toast.success('Registration submitted. Wait for admin approval before signing in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
          return;
        }
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
    <main role="main" style={{
      minHeight: '100dvh',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflowY: 'auto',
      padding: '20px 16px',
      background: "#080f22 url('/field-response.jpg') center / cover no-repeat fixed",
    }}>
      {/* Dark Ambient Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(8,15,34,0.74) 0%, rgba(8,15,34,0.94) 100%), linear-gradient(180deg, rgba(8,15,34,0.84) 0%, rgba(15,23,42,0.96) 100%)',
        backdropFilter: 'blur(3px)',
        pointerEvents: 'none',
      }} />

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 400,
          boxSizing: 'border-box',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(34, 197, 94, 0.32)',
          borderRadius: 20,
          padding: '24px 22px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Compact Logo inside Card */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px',
            background: 'linear-gradient(135deg, #10b981, #0284c7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.35)',
          }}>
            <Siren size={24} />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 2, letterSpacing: '-0.01em' }}>CrewRescue Field</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Dhaka Power · Emergency Operations</p>
          <div className="login-status"><span /> Secure field network online</div>
        </div>

        {mode === 'login' && <div className="quick-login">
          <div className="quick-login-heading">Field team quick access</div>
          <div className="quick-login-grid">
            {quickLoginRoles.map((demo) => (
              <button
                key={demo.label}
                type="button"
                className={`quick-login-card${email === demo.email ? ' selected' : ''}`}
                style={{ '--quick-login-color': demo.color }}
                onClick={() => { setEmail(demo.email); setPassword(demo.password); }}
              >
                <span className="quick-login-icon"><demo.icon size={15} /></span>
                <span>
                  <strong>{demo.label}</strong>
                  <small>{demo.description}</small>
                </span>
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
            <div>
              <label style={labelStyle}>Requested Role</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {roleOptions.map((option) => (
                  <button key={option.value} type="button" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-start', padding: '8px 9px', fontSize: '0.7rem', borderColor: role === option.value ? option.color : 'rgba(255,255,255,0.1)', color: role === option.value ? '#fff' : 'var(--text-secondary)', boxShadow: role === option.value ? `0 0 0 1px ${option.color}` : 'none' }} onClick={() => setRole(option.value)}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: option.color, flex: '0 0 auto' }} />{option.label}
                  </button>
                ))}
              </div>
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
    </main>
  );
}

const labelStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted)',
  display: 'block',
  marginBottom: 6,
  fontWeight: 600,
};

const roleOptions = [
  { value: 'TECHNICIAN', label: 'Technician', color: '#22c55e' },
  { value: 'FIELD_SUPERVISOR', label: 'Field Supervisor', color: '#06b6d4' },
  { value: 'DISPATCHER', label: 'Dispatcher', color: '#3b82f6' },
  { value: 'EMERGENCY_MANAGER', label: 'Emergency Manager', color: '#f97316' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory', color: '#a855f7' },
  { value: 'FLEET_MANAGER', label: 'Fleet', color: '#eab308' },
  { value: 'AUDITOR', label: 'Auditor', color: '#94a3b8' },
  { value: 'EXECUTIVE', label: 'Executive', color: '#ec4899' },
];

const quickLoginRoles = [
  { label: 'Technician 1', description: 'Field assignments', email: 'tech1@dhakapower.bd', password: 'Tech@2025', color: '#22c55e', icon: HardHat },
  { label: 'Technician 2', description: 'Field assignments', email: 'tech2@dhakapower.bd', password: 'Tech@2025', color: '#14b8a6', icon: Radio },
  { label: 'Supervisor', description: 'Crew coordination', email: 'supervisor@dhakapower.bd', password: 'Supervisor@2025', color: '#06b6d4', icon: ShieldCheck },
];
