import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, AlertTriangle, Wrench, Users, Truck,
  Warehouse, BarChart3, Zap, Settings, LogOut, Radio, Bot,
} from 'lucide-react';
import { useAuthStore, useEmergencyStore } from '../store/index.js';

const NAV = [
  { label: 'Operations', items: [
    { to: '/',            icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/map',         icon: Map,             label: 'Live Map' },
    { to: '/incidents',   icon: AlertTriangle,   label: 'Incidents',   badgeKey: 'critical' },
    { to: '/optimize',    icon: Zap,             label: 'Optimization' },
    { to: '/emergency',   icon: Radio,           label: 'Emergency Command', badgeKey: 'emergency' },
  ]},
  { label: 'Resources', items: [
    { to: '/technicians', icon: Users,    label: 'Technicians' },
    { to: '/vehicles',    icon: Truck,    label: 'Vehicles' },
    { to: '/depots',      icon: Warehouse,label: 'Depots' },
  ]},
  { label: 'Intelligence', items: [
    { to: '/analytics',   icon: BarChart3, label: 'Analytics' },
    { to: '/ai',          icon: Zap,       label: 'AI Triage' },
    { to: '/copilot',     icon: Bot,       label: 'Copilot (RAG)', badgeNew: true },
  ]},
];

export default function Sidebar({ stats }) {
  const { user, logout } = useAuthStore();
  const { active: emergency } = useEmergencyStore();
  const navigate = useNavigate();

  const criticalCount = stats?.incidents?.critical ?? 0;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">🚨</div>
          <div className="logo-text">
            <div className="logo-title">CrewRescue</div>
            <div className="logo-sub">Emergency Ops</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const badge = item.badgeKey === 'critical' && criticalCount > 0 ? criticalCount
                : item.badgeKey === 'emergency' && emergency ? emergency.level
                : null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <Icon className="nav-item-icon" size={15} />
                  {item.label}
                  {badge != null && (
                    <span className={`nav-badge${item.badgeKey === 'emergency' ? ' info' : ''}`}>
                      {badge}
                    </span>
                  )}
                  {item.badgeNew && (
                    <span style={{
                      marginLeft: 'auto', fontSize: '0.55rem', padding: '1px 5px',
                      borderRadius: 8, background: 'rgba(139,92,246,0.2)',
                      color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700,
                    }}>NEW</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom: user */}
      <div className="sidebar-bottom">
        <NavLink to="/settings" className="nav-item">
          <Settings size={15} className="nav-item-icon" />
          Settings
        </NavLink>
        <div
          className="nav-item"
          onClick={handleLogout}
          style={{ cursor: 'pointer', color: 'var(--critical)', opacity: 0.8 }}
        >
          <LogOut size={15} className="nav-item-icon" />
          Sign Out
        </div>

        {/* User info */}
        <div style={{ marginTop: 12, padding: '10px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {user?.name}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {user?.role?.replace(/_/g, ' ')}
          </div>
        </div>
      </div>
    </aside>
  );
}
