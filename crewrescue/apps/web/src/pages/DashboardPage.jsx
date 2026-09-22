import { useEffect } from 'react';
import { useDashboardStore, useEmergencyStore } from '../store/index.js';
import DispatcherMap from '../components/DispatcherMap.jsx';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, Users, Truck, DollarSign, Activity, Zap } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

function StatCard({ label, value, sub, variant = '', icon: Icon }) {
  return (
    <div className={`stat-card ${variant}`}>
      {Icon && <div className="stat-icon"><Icon size={36} /></div>}
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${variant}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function SLAHealthBar({ onTrack = 0, atRisk = 0, breachRisk = 0 }) {
  const total = onTrack + atRisk + breachRisk;
  if (total === 0) return <div className="text-muted text-sm">No active SLAs</div>;
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
        <div style={{ flex: onTrack, background: 'var(--success)', minWidth: onTrack > 0 ? 4 : 0 }} />
        <div style={{ flex: atRisk,   background: 'var(--warning)', minWidth: atRisk > 0 ? 4 : 0 }} />
        <div style={{ flex: breachRisk, background: 'var(--critical)', minWidth: breachRisk > 0 ? 4 : 0 }} />
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
          <span className="text-secondary">On Track</span>
          <span style={{ color: 'var(--success)', fontWeight: 700, marginLeft: 2 }}>{onTrack}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />
          <span className="text-secondary">At Risk</span>
          <span style={{ color: 'var(--warning)', fontWeight: 700, marginLeft: 2 }}>{atRisk}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)', flexShrink: 0 }} />
          <span className="text-secondary">Breach Risk</span>
          <span style={{ color: 'var(--critical)', fontWeight: 700, marginLeft: 2 }}>{breachRisk}</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { stats, slaHealth, fetchStats, isLoading } = useDashboardStore();
  const { active: emergency, fetchActive, declare, resolve } = useEmergencyStore();

  useEffect(() => {
    fetchStats();
    fetchActive();
    const iv = setInterval(fetchStats, 30_000);
    return () => clearInterval(iv);
  }, []);

  async function handleDeclareEmergency() {
    try {
      await declare({
        level: 3,
        title: 'Storm Emergency Response',
        type: 'STORM',
        description: 'Severe storm affecting service delivery',
      });
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
      toast.success('Storm scenario injected — watch the dashboard update');
      setTimeout(fetchStats, 2000);
    } catch { toast.error('Failed to inject storm'); }
  }

  async function runOptimization() {
    try {
      await api.post('/optimization/run', { algorithm: 'GREEDY', trigger: 'MANUAL' });
      toast.success('Optimization running…');
    } catch { toast.error('Optimization failed'); }
  }

  const s = stats;
  const financialFmt = (n) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;

  return (
    <div className="page-container">
      {/* Emergency Banner */}
      {emergency && (
        <div className="emergency-banner" style={{ borderRadius: 'var(--radius-md)', marginBottom: 20, padding: '12px 16px' }}>
          <div className="emergency-dot" />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: 'var(--critical)', marginRight: 8 }}>
              ACTIVE EMERGENCY — Level {emergency.level}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {emergency.title} · Declared {formatDistanceToNow(new Date(emergency.declaredAt))} ago
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleResolveEmergency} style={{ color: 'var(--success)', borderColor: 'rgba(16,185,129,0.3)' }}>
            Resolve
          </button>
        </div>
      )}

      {/* Page header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2 }}>Operations Dashboard</h2>
          <div className="text-xs text-muted">DhakaPower Utilities · Live operations overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={injectStorm} title="Demo: inject storm scenario">
            🌩️ Inject Storm
          </button>
          <button className="btn btn-primary btn-sm" onClick={runOptimization}>
            <Zap size={13} /> Optimize
          </button>
          {!emergency ? (
            <button className="btn btn-danger btn-sm" onClick={handleDeclareEmergency}>
              🚨 Declare Emergency
            </button>
          ) : null}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard
          label="Critical Incidents"
          value={isLoading ? '—' : (s?.incidents?.critical ?? 0)}
          sub={`${s?.incidents?.unassigned ?? 0} unassigned`}
          variant="critical"
          icon={AlertTriangle}
        />
        <StatCard
          label="SLA Compliance"
          value={isLoading ? '—' : `${s?.sla?.compliancePct ?? 100}%`}
          sub={`${s?.sla?.atRisk ?? 0} at risk · ${s?.sla?.breached ?? 0} breached`}
          variant={s?.sla?.compliancePct < 85 ? 'critical' : s?.sla?.compliancePct < 95 ? 'warning' : 'success'}
          icon={Activity}
        />
        <StatCard
          label="Available Technicians"
          value={isLoading ? '—' : (s?.technicians?.available ?? 0)}
          sub={`of ${s?.technicians?.total ?? 0} total · ${s?.technicians?.busy ?? 0} on job`}
          variant="success"
          icon={Users}
        />
        <StatCard
          label="Financial Exposure"
          value={isLoading ? '—' : financialFmt(s?.sla?.financialExposure ?? 0)}
          sub="SLA penalty risk"
          variant={s?.sla?.financialExposure > 50000 ? 'critical' : s?.sla?.financialExposure > 20000 ? 'warning' : ''}
          icon={DollarSign}
        />
        <StatCard
          label="Active Work Orders"
          value={isLoading ? '—' : (s?.workOrders?.open ?? 0)}
          sub={`${s?.workOrders?.completedToday ?? 0} completed today`}
          variant="brand"
          icon={Truck}
        />
      </div>

      {/* Main grid: Map + Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, height: '520px' }}>
        {/* Map */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <DispatcherMap height="100%" />
        </div>

        {/* Right panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          {/* SLA Health */}
          <div className="card" style={{ flex: '0 0 auto' }}>
            <div className="card-header">
              <div className="card-title">
                <Activity size={14} />
                SLA Health
              </div>
              <span className="text-xs text-muted">Live</span>
            </div>
            <div className="card-body">
              {slaHealth ? (
                <SLAHealthBar
                  onTrack={slaHealth.onTrack}
                  atRisk={slaHealth.atRisk}
                  breachRisk={slaHealth.breachRisk}
                />
              ) : (
                <div className="skeleton" style={{ height: 40 }} />
              )}
            </div>
          </div>

          {/* Technician Status */}
          <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
            <div className="card-header">
              <div className="card-title"><Users size={14} /> Workforce Status</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Available', value: s?.technicians?.available ?? 0, color: 'var(--success)' },
                { label: 'On Job / En Route', value: s?.technicians?.busy ?? 0, color: 'var(--warning)' },
                { label: 'Unavailable', value: s?.technicians?.unavailable ?? 0, color: 'var(--critical)' },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{row.label}</div>
                  <div style={{ fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{isLoading ? '—' : row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="card" style={{ flex: '0 0 auto' }}>
            <div className="card-header">
              <div className="card-title"><Zap size={14} /> Quick Actions</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary btn-sm w-full" onClick={runOptimization}>
                Run Optimization
              </button>
              <button className="btn btn-ghost btn-sm w-full" onClick={injectStorm}>
                🌩️ Storm Simulation
              </button>
              {!emergency && (
                <button className="btn btn-danger btn-sm w-full" onClick={handleDeclareEmergency}>
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
