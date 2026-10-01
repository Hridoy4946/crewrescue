import { useState } from 'react';
import {
  Settings, User, Bell, Shield, Palette, Database,
  Save, Check, Moon, Sun, Monitor,
} from 'lucide-react';
import { useAuthStore } from '../store/index.js';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

const SECTIONS = [
  { id: 'profile',   label: 'Profile',        icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance',label: 'Appearance',     icon: Palette },
  { id: 'security',  label: 'Security',       icon: Shield },
  { id: 'system',    label: 'System Info',    icon: Database },
];

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{label}</div>
        {description && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: checked ? 'var(--brand-500)' : 'var(--border-default)',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s',
          boxShadow: checked ? '0 0 8px var(--brand-glow)' : 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    criticalIncidents: true,
    emergencyDeclarations: true,
    optimizationComplete: true,
    technicianAlerts: false,
    dailyDigest: true,
    weeklyReport: false,
  });

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me', profileForm);
      toast.success('Profile updated');
    } catch { toast.error('Failed to update profile'); }
    finally { setSavingProfile(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return toast.error('Passwords do not match');
    if (pwForm.next.length < 8) return toast.error('Password must be at least 8 characters');
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success('Password changed');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.error ?? 'Failed to change password'); }
    finally { setSavingPw(false); }
  }

  const ROLE_BADGE_COLORS = {
    SUPER_ADMIN: '#7C3AED', ORG_ADMIN: '#3B82F6', DISPATCHER: '#10B981',
    EMERGENCY_MANAGER: '#EF4444', FIELD_SUPERVISOR: '#F59E0B',
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} style={{ color: 'var(--text-muted)' }} /> Settings
        </h2>
        <div className="text-xs text-muted">Manage your account, notifications and system preferences</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Side nav */}
        <div className="card" style={{ padding: '8px 0', position: 'sticky', top: 20 }}>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 16px', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                color: activeSection === id ? 'var(--brand-400)' : 'var(--text-secondary)',
                background: activeSection === id ? 'rgba(59,130,246,0.08)' : 'transparent',
                fontSize: '0.82rem', fontWeight: activeSection === id ? 600 : 400,
                borderLeft: `2px solid ${activeSection === id ? 'var(--brand-500)' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Content panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Profile ─────────────────────────────────────────────────────── */}
          {activeSection === 'profile' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title"><User size={14} /> Profile</div>
              </div>
              <div className="card-body">
                {/* Avatar + role */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--brand-500), var(--purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.4rem', fontWeight: 800, color: '#fff',
                    boxShadow: '0 0 20px var(--brand-glow)',
                  }}>
                    {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>{user?.email}</div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700,
                      background: `${ROLE_BADGE_COLORS[user?.role] ?? '#6B7280'}22`,
                      color: ROLE_BADGE_COLORS[user?.role] ?? '#6B7280',
                      border: `1px solid ${ROLE_BADGE_COLORS[user?.role] ?? '#6B7280'}44`,
                    }}>
                      {user?.role?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label">Display Name</label>
                      <input
                        className="form-input"
                        value={profileForm.name}
                        onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input
                        className="form-input"
                        type="email"
                        value={profileForm.email}
                        onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone / Contact</label>
                    <input
                      className="form-input"
                      value={profileForm.phone}
                      placeholder="+880 1XXX-XXXXXX"
                      onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                      style={{ maxWidth: 300 }}
                    />
                  </div>
                  <div>
                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                      {savingProfile
                        ? <><div className="loading-spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Saving…</>
                        : <><Save size={13} /> Save Profile</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Notifications ────────────────────────────────────────────────── */}
          {activeSection === 'notifications' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title"><Bell size={14} /> Notification Preferences</div>
              </div>
              <div className="card-body">
                {[
                  { key: 'criticalIncidents',      label: 'Critical Incidents',        description: 'Alert when a CRITICAL severity incident is created' },
                  { key: 'emergencyDeclarations',  label: 'Emergency Declarations',    description: 'Alert when an emergency is declared or resolved' },
                  { key: 'optimizationComplete',   label: 'Optimization Complete',     description: 'Alert when an optimization run finishes with results' },
                  { key: 'technicianAlerts',       label: 'Technician Status Changes', description: 'Alert when a technician becomes unavailable' },
                  { key: 'dailyDigest',            label: 'Daily Operations Digest',   description: 'Summary email at 07:00 with overnight stats' },
                  { key: 'weeklyReport',           label: 'Weekly Performance Report', description: 'Full SLA and performance report every Monday' },
                ].map(pref => (
                  <ToggleSwitch
                    key={pref.key}
                    checked={notifPrefs[pref.key]}
                    onChange={v => {
                      setNotifPrefs(p => ({ ...p, [pref.key]: v }));
                      toast.success(`${pref.label} ${v ? 'enabled' : 'disabled'}`);
                    }}
                    label={pref.label}
                    description={pref.description}
                  />
                ))}
                <div style={{ marginTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => toast.success('Notification preferences saved')}>
                    <Save size={12} /> Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Appearance ───────────────────────────────────────────────────── */}
          {activeSection === 'appearance' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title"><Palette size={14} /> Appearance</div>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label" style={{ marginBottom: 10 }}>Color Theme</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { id: 'dark',   label: 'Dark',   icon: <Moon size={18} />,    active: true },
                      { id: 'light',  label: 'Light',  icon: <Sun size={18} />,     active: false },
                      { id: 'system', label: 'System', icon: <Monitor size={18} />, active: false },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => { if (!t.active) toast('Light mode coming soon — dark mode is locked in 🔒'); }}
                        style={{
                          padding: '12px 20px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          border: `2px solid ${t.active ? 'var(--brand-500)' : 'var(--border-default)'}`,
                          background: t.active ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated)',
                          color: t.active ? 'var(--brand-400)' : 'var(--text-muted)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          fontSize: '0.78rem', fontWeight: t.active ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {t.icon}
                        {t.label}
                        {t.active && <span style={{ fontSize: '0.6rem', color: 'var(--success)' }}><Check size={10} /> Active</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="form-label" style={{ marginBottom: 10 }}>Accent Color</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[
                      { color: '#3B82F6', label: 'Blue',   active: true },
                      { color: '#8B5CF6', label: 'Purple', active: false },
                      { color: '#10B981', label: 'Green',  active: false },
                      { color: '#F59E0B', label: 'Amber',  active: false },
                      { color: '#EF4444', label: 'Red',    active: false },
                    ].map(c => (
                      <button
                        key={c.color}
                        onClick={() => toast(`${c.label} accent — theming engine coming soon`)}
                        style={{
                          width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                          background: c.color, border: c.active ? `3px solid ${c.color}` : '3px solid transparent',
                          outline: c.active ? `3px solid rgba(255,255,255,0.3)` : 'none',
                          outlineOffset: 2,
                          transition: 'all 0.15s',
                          boxShadow: c.active ? `0 0 12px ${c.color}` : 'none',
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────────── */}
          {activeSection === 'security' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title"><Shield size={14} /> Security</div>
              </div>
              <div className="card-body">
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input
                      className="form-input"
                      type="password"
                      value={pwForm.current}
                      onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      value={pwForm.next}
                      onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      className="form-input"
                      type="password"
                      value={pwForm.confirm}
                      onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingPw || !pwForm.current || !pwForm.next}>
                    {savingPw
                      ? <><div className="loading-spinner" style={{ width: 13, height: 13, borderWidth: 2 }} /> Changing…</>
                      : <><Shield size={13} /> Change Password</>}
                  </button>
                </form>

                <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--brand-500)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 6 }}>Active Session</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div>Role: <span style={{ color: 'var(--text-primary)' }}>{user?.role?.replace(/_/g, ' ')}</span></div>
                    <div>Organization: <span style={{ color: 'var(--text-primary)' }}>DhakaPower Utilities</span></div>
                    <div>Token: <span style={{ color: 'var(--success)' }}>✓ Valid (15min rotation)</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── System Info ──────────────────────────────────────────────────── */}
          {activeSection === 'system' && (
            <div className="card fade-in">
              <div className="card-header">
                <div className="card-title"><Database size={14} /> System Information</div>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Platform', value: 'CrewRescue AI v1.0.0' },
                    { label: 'Organization', value: 'DhakaPower Utilities' },
                    { label: 'API Server', value: 'Express.js + Socket.IO · :5000' },
                    { label: 'Database', value: 'MongoDB 7 (Docker)' },
                    { label: 'Cache', value: 'Redis 7 Alpine (Docker)' },
                    { label: 'Frontend', value: 'React 18 + Vite 8 · :5173' },
                    { label: 'AI Engine', value: 'Google Gemini 1.5 Flash' },
                    { label: 'Map Engine', value: 'Leaflet + OpenStreetMap' },
                    { label: 'Optimization', value: 'Greedy Solver (SA/GA in Phase 3)' },
                    { label: 'Auth', value: 'JWT (RS256) + Refresh Tokens' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                    All systems operational · API healthy · WebSocket connected
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
