import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';
import { BarChart3, Radio, ShieldCheck, Siren } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [role, setRole] = useState('TECHNICIAN');
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
    <main className="login-page" role="main">
      <div className="login-bg" />


      <div className="login-card fade-in">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon"><Siren size={28} /></div>
            <div className="login-title">CrewRescue AI</div>
          <div className="login-sub">Dhaka Power · Emergency Operations</div>
          <div className="login-status"><span /> Secure command network online</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
            {mode === 'login' && (
              <div className="quick-login">
                <div className="quick-login-heading">Quick access</div>
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
              </div>
            )}
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
                <div className="form-group">
                  <label className="form-label" htmlFor="role">Requested Role</label>
                  <div className="role-options">
                    {roleOptions.map((option) => (
                      <button key={option.value} type="button" className={`role-option${role === option.value ? ' selected' : ''}`} style={{ '--role-color': option.color }} onClick={() => setRole(option.value)}>
                        <span className="role-dot" />{option.label}
                      </button>
                    ))}
                  </div>
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
    </main>
  );
}

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
  { label: 'Administrator', description: 'Full dashboard access', email: 'admin@dhakapower.bd', password: 'Admin@CrewRescue2025', color: '#8b5cf6', icon: ShieldCheck },
  { label: 'Dispatcher', description: 'Dispatch operations', email: 'dispatcher@dhakapower.bd', password: 'Dispatch@2025', color: '#3b82f6', icon: Radio },
  { label: 'Emergency Manager', description: 'Emergency response', email: 'emergency@dhakapower.bd', password: 'Emergency@2025', color: '#f97316', icon: Siren },
  { label: 'Executive', description: 'Executive overview', email: 'executive@dhakapower.bd', password: 'Executive@2025', color: '#ec4899', icon: BarChart3 },
];
