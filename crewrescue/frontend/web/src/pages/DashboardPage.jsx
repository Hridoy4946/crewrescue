import { useEffect, useState } from 'react';
import { useDashboardStore, useEmergencyStore } from '../store/index.js';
import DispatcherMap from '../components/DispatcherMap.jsx';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Users, Truck, DollarSign, Activity, Zap,
  TrendingUp, TrendingDown, Shield, Radio, Clock, CheckCircle2,
  BarChart3, Wifi, WifiOff, RefreshCw,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

// ── Animated counter ───────────────────────────────────────────────────────────
function AnimatedValue({ value, prefix = '', suffix = '', isLoading }) {
  if (isLoading) return <span style={{ color: 'var(--text-disabled)' }}>—</span>;
  return <span>{prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</span>;
}

// ── KPI stat card ──────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, variant = '', icon: Icon, trend, prefix = '', suffix = '', isLoading }) {
  const variantColors = {
    critical: { border: 'rgba(239,68,68,0.3)', glow: 'rgba(239,68,68,0.08)', text: '#EF4444', badge: 'rgba(239,68,68,0.15)' },
    warning:  { border: 'rgba(245,158,11,0.3)',  glow: 'rgba(245,158,11,0.08)',  text: '#F59E0B', badge: 'rgba(245,158,11,0.12)' },
    success:  { border: 'rgba(16,185,129,0.3)',  glow: 'rgba(16,185,129,0.06)',  text: '#10B981', badge: 'rgba(16,185,129,0.12)' },
    brand:    { border: 'rgba(59,130,246,0.3)',  glow: 'rgba(59,130,246,0.06)',  text: '#60A5FA', badge: 'rgba(59,130,246,0.12)' },
    purple:   { border: 'rgba(139,92,246,0.3)',  glow: 'rgba(139,92,246,0.06)',  text: '#8B5CF6', badge: 'rgba(139,92,246,0.12)' },
    '':       { border: 'var(--border-subtle)',  glow: 'transparent',            text: 'var(--text-primary)', badge: 'rgba(255,255,255,0.04)' },
  };
  const c = variantColors[variant] || variantColors[''];

  return (
    <div style={{
      background: `linear-gradient(145deg, var(--bg-card) 0%, ${c.glow} 100%)`,
      border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      cursor: 'default',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 40px ${c.glow}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Subtle gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 100%)', pointerEvents: 'none' }} />

      {/* Icon */}
      {Icon && (
        <div style={{
          position: 'absolute', top: 16, right: 16,
          width: 38, height: 38, borderRadius: 10,
          background: c.badge,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color: c.text, opacity: 0.8 }} />
        </div>
      )}

      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
        {label}
      </div>

      <div style={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: c.text, marginBottom: 8 }}>
        <AnimatedValue value={value} prefix={prefix} suffix={suffix} isLoading={isLoading} />
      </div>

      {sub && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up' && <TrendingUp size={10} style={{ color: 'var(--success)' }} />}
          {trend === 'down' && <TrendingDown size={10} style={{ color: 'var(--critical)' }} />}
          {sub}
        </div>
      )}
    </div>
  );
}

// ── SLA Health bar ─────────────────────────────────────────────────────────────
function SLAHealthBar({ onTrack = 0, atRisk = 0, breachRisk = 0 }) {
  const total = onTrack + atRisk + breachRisk;
  if (total === 0) return <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px 0' }}>No active SLAs</div>;
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', gap: 2, marginBottom: 12 }}>
        <div style={{ flex: onTrack, background: 'linear-gradient(90deg, #10B981, #34D399)', minWidth: onTrack > 0 ? 4 : 0, transition: 'flex 0.5s ease' }} />
        <div style={{ flex: atRisk, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', minWidth: atRisk > 0 ? 4 : 0, transition: 'flex 0.5s ease' }} />
        <div style={{ flex: breachRisk, background: 'linear-gradient(90deg, #EF4444, #F87171)', minWidth: breachRisk > 0 ? 4 : 0, transition: 'flex 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', justifyContent: 'space-between' }}>
        {[
          { label: 'On Track', val: onTrack, color: 'var(--success)' },
          { label: 'At Risk', val: atRisk, color: 'var(--warning)' },
          { label: 'Breach Risk', val: breachRisk, color: 'var(--critical)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: item.color, lineHeight: 1.2 }}>{item.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live activity ticker ───────────────────────────────────────────────────────
function LiveTicker() {
  const [items, setItems] = useState([
    { id: 1, type: 'incident', text: 'WO-00412 CRITICAL — Transformer fault in Gulshan', time: '2m ago', color: 'var(--critical)' },
    { id: 2, type: 'assign', text: 'Tech Rafiqul Islam assigned to WO-00398', time: '5m ago', color: 'var(--success)' },
    { id: 3, type: 'resolve', text: 'WO-00387 resolved — HVAC failure in Dhanmondi', time: '11m ago', color: 'var(--brand-400)' },
    { id: 4, type: 'sla', text: 'SLA breach risk: WO-00401 — 45 min remaining', time: '14m ago', color: 'var(--warning)' },
    { id: 5, type: 'depot', text: 'Mirpur Depot capacity at 92% — alert triggered', time: '22m ago', color: 'var(--purple)' },
  ]);

  const icons = { incident: '⚡', assign: '👷', resolve: '✅', sla: '⏱', depot: '🏭' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, i) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0',
          borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: '0.75rem', flexShrink: 0, marginTop: 1 }}>{icons[item.type]}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.text}</div>
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>{item.time}</div>
        </div>
      ))}
    </div>
  );
}

// ── Workforce ring chart ───────────────────────────────────────────────────────
function WorkforceRing({ available = 0, busy = 0, unavailable = 0 }) {
  const total = available + busy + unavailable || 1;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const availPct = available / total;
  const busyPct = busy / total;

  const avail_dash = availPct * circumference;
  const busy_dash = busyPct * circumference;
  const unav_dash = circumference - avail_dash - busy_dash;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth="8" />
          <circle cx="45" cy="45" r={radius} fill="none" stroke="#10B981" strokeWidth="8"
            strokeDasharray={`${avail_dash} ${circumference - avail_dash}`}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
          <circle cx="45" cy="45" r={radius} fill="none" stroke="#F59E0B" strokeWidth="8"
            strokeDasharray={`${busy_dash} ${circumference - busy_dash}`}
            strokeDashoffset={circumference * 0.25 - avail_dash}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{total}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Available', value: available, color: '#10B981' },
          { label: 'On Job', value: busy, color: '#F59E0B' },
          { label: 'Offline', value: unavailable, color: '#6B7280' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.label}</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: item.color, marginLeft: 'auto' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { stats, slaHealth, fetchStats, isLoading } = useDashboardStore();
  const { active: emergency, fetchActive, declare, resolve } = useEmergencyStore();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('live');

  useEffect(() => {
    fetchStats();
    fetchActive();
    const iv = setInterval(() => {
      fetchStats();
      setLastRefresh(new Date());
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchActive()]);
    setLastRefresh(new Date());
    setIsRefreshing(false);
  }

  async function handleDeclareEmergency() {
    try {
      await declare({ level: 3, title: 'Storm Emergency Response', type: 'STORM', description: 'Severe storm affecting service delivery' });
      toast.success('Emergency declared');
    } catch { toast.error('Failed to declare emergency'); }
  }

  async function handleResolveEmergency() {
    try {
      await resolve(emergency._id, 'Situation normalized');
      toast.success('Emergency resolved');
    } catch { toast.error('Failed to resolve emergency'); }
  }

  async function injectStorm() {
    try {
      await api.post('/simulator/storm', { newIncidents: 85, disableTechnicians: 15, closeDepots: 2 });
      toast.success('Storm scenario injected!');
      setTimeout(() => { fetchStats(); setLastRefresh(new Date()); }, 2000);
    } catch { toast.error('Failed to inject storm'); }
  }

  async function runOptimization() {
    try {
      await api.post('/optimization/run', { algorithm: 'GREEDY', trigger: 'MANUAL' });
      toast.success('Optimization running…');
    } catch { toast.error('Optimization failed'); }
  }

  const s = stats;
  const fmtFinancial = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n ?? 0}`;
  const compPct = s?.sla?.compliancePct ?? 100;
  const compVariant = compPct < 85 ? 'critical' : compPct < 95 ? 'warning' : 'success';

  return (
    <div className="page-container" style={{ paddingBottom: 32 }}>
      {/* Emergency Banner */}
      {emergency && (
        <div style={{
          marginBottom: 20, padding: '14px 20px',
          background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
          border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'emergencyPulse 2s ease-in-out infinite',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--critical)', animation: 'blink 1s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 800, color: 'var(--critical)', marginRight: 10, fontSize: '0.9rem' }}>
              🚨 ACTIVE EMERGENCY — Level {emergency.level}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {emergency.title} · Declared {formatDistanceToNow(new Date(emergency.declaredAt))} ago
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleResolveEmergency} style={{ color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)', flexShrink: 0 }}>
            ✓ Resolve
          </button>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'blink 2s ease-in-out infinite' }} />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Operations Dashboard</h2>
            <span style={{
              fontSize: '0.62rem', padding: '2px 8px', borderRadius: 20,
              background: 'rgba(16,185,129,0.1)', color: 'var(--success)',
              border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700,
            }}>LIVE</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={11} />
            Last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })} · DhakaPower Utilities Network
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw size={12} className={isRefreshing ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-ghost btn-sm" onClick={injectStorm} title="Demo: inject storm">
            🌩️ Storm Sim
          </button>
          <button className="btn btn-primary btn-sm" onClick={runOptimization}>
            <Zap size={13} /> Optimize
          </button>
          {!emergency && (
            <button className="btn btn-danger btn-sm" onClick={handleDeclareEmergency}>
              🚨 Emergency
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard
          label="Critical Incidents"
          value={s?.incidents?.critical ?? 0}
          sub={`${s?.incidents?.unassigned ?? 0} unassigned`}
          variant={s?.incidents?.critical > 0 ? 'critical' : ''}
          icon={AlertTriangle}
          isLoading={isLoading}
        />
        <KPICard
          label="SLA Compliance"
          value={compPct}
          suffix="%"
          sub={`${s?.sla?.atRisk ?? 0} at risk · ${s?.sla?.breached ?? 0} breached`}
          variant={compVariant}
          icon={Activity}
          isLoading={isLoading}
        />
        <KPICard
          label="Available Techs"
          value={s?.technicians?.available ?? 0}
          sub={`of ${s?.technicians?.total ?? 0} total · ${s?.technicians?.busy ?? 0} busy`}
          variant="success"
          icon={Users}
          isLoading={isLoading}
        />
        <KPICard
          label="Financial Risk"
          value={fmtFinancial(s?.sla?.financialExposure ?? 0)}
          sub="SLA penalty exposure"
          variant={s?.sla?.financialExposure > 50000 ? 'critical' : s?.sla?.financialExposure > 20000 ? 'warning' : ''}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <KPICard
          label="Open Work Orders"
          value={s?.workOrders?.open ?? 0}
          sub={`${s?.workOrders?.completedToday ?? 0} completed today`}
          variant="brand"
          icon={Truck}
          isLoading={isLoading}
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* LEFT: Map */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 440,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              background: 'linear-gradient(180deg, rgba(9,13,26,0.9) 0%, transparent 100%)',
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={13} style={{ color: 'var(--brand-400)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Field Operations Map</span>
              </div>
              <div style={{ display: 'flex', gap: 6, pointerEvents: 'all' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 20 }}>
                  <Wifi size={9} /> Live Feed
                </div>
              </div>
            </div>
            <DispatcherMap height="100%" />
          </div>

          {/* Quick stats row below map */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Avg Response Time', value: '18 min', icon: Clock, color: 'var(--brand-400)', sub: '↓ 3 min vs yesterday' },
              { label: 'Resolved Today', value: s?.workOrders?.completedToday ?? 0, icon: CheckCircle2, color: 'var(--success)', sub: 'Across all zones' },
              { label: 'Total Incidents', value: s?.incidents?.total ?? 0, icon: BarChart3, color: 'var(--warning)', sub: 'Active this shift' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>{isLoading ? '—' : item.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.7 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Panels column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* SLA Health */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 600 }}>
                <Shield size={14} style={{ color: compVariant === 'critical' ? 'var(--critical)' : compVariant === 'warning' ? 'var(--warning)' : 'var(--success)' }} />
                SLA Performance
              </div>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Real-time</span>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {slaHealth ? (
                <SLAHealthBar onTrack={slaHealth.onTrack} atRisk={slaHealth.atRisk} breachRisk={slaHealth.breachRisk} />
              ) : (
                <div className="skeleton" style={{ height: 60 }} />
              )}
            </div>
          </div>

          {/* Workforce */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 600 }}>
                <Users size={14} style={{ color: 'var(--brand-400)' }} /> Workforce Status
              </div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              <WorkforceRing
                available={s?.technicians?.available ?? 0}
                busy={s?.technicians?.busy ?? 0}
                unavailable={s?.technicians?.unavailable ?? 0}
              />
            </div>
          </div>

          {/* Live Activity Feed */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 600 }}>
                <Radio size={13} style={{ color: 'var(--success)' }} /> Activity Feed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem', color: 'var(--success)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'blink 1.5s ease-in-out infinite' }} />
                Live
              </div>
            </div>
            <div style={{ padding: '8px 18px 14px', maxHeight: 220, overflowY: 'auto' }}>
              <LiveTicker />
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.82rem', fontWeight: 600 }}>
              <Zap size={14} style={{ color: 'var(--brand-400)' }} /> Quick Actions
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-primary btn-sm w-full" onClick={runOptimization}
                style={{ background: 'linear-gradient(135deg, var(--brand-500), #6366f1)', justifyContent: 'flex-start', gap: 8 }}>
                <Zap size={13} /> Run AI Optimization
              </button>
              <button className="btn btn-ghost btn-sm w-full" onClick={injectStorm}
                style={{ justifyContent: 'flex-start', gap: 8 }}>
                🌩️ Storm Simulation
              </button>
              {!emergency && (
                <button className="btn btn-danger btn-sm w-full" onClick={handleDeclareEmergency}
                  style={{ justifyContent: 'flex-start', gap: 8 }}>
                  🚨 Declare Emergency
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
