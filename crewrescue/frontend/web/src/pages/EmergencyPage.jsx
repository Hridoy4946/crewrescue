import { useState, useEffect } from 'react';
import {
  Radio, AlertTriangle, CheckCircle, Clock, Zap,
  CloudLightning, RefreshCw, Shield, Activity,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { useEmergencyStore } from '../store/index.js';

const LEVEL_COLORS = ['var(--success)', 'var(--warning)', 'var(--warning)', 'var(--critical)', 'var(--purple)'];
const LEVEL_LABELS = ['Normal', 'Elevated', 'Major', 'Critical', 'Disaster'];
const LEVEL_DESCS  = [
  'Standard operating conditions',
  'Increased incident volume — monitor closely',
  'Significant disruption — activate backup resources',
  'Major infrastructure failure — full emergency protocol',
  'Mass casualty / region-wide outage — disaster response',
];

const EMERGENCY_TYPES = [
  'STORM', 'FLOOD', 'POWER_OUTAGE', 'NETWORK_OUTAGE', 'EQUIPMENT_FAILURE',
  'TECHNICIAN_SHORTAGE', 'DEPOT_CLOSURE', 'ROAD_CLOSURE', 'MASS_OUTAGE', 'CUSTOM',
];

export default function EmergencyPage() {
  const { active, fetchActive, declare, resolve } = useEmergencyStore();
  const [declaring, setDeclaring]   = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [injecting, setInjecting]   = useState(false);
  const [declareForm, setDeclareForm] = useState({
    level: 3, title: '', type: 'STORM', description: '',
  });
  const [simConfig, setSimConfig] = useState({
    newIncidents: 85, disableTechnicians: 15, closeDepots: 2,
  });

  useEffect(() => { fetchActive(); }, []);

  async function handleDeclare(e) {
    e.preventDefault();
    if (!declareForm.title.trim()) return toast.error('Title required');
    setDeclaring(true);
    try {
      await declare(declareForm);
      toast.success(`Level ${declareForm.level} emergency declared`);
      setDeclareForm({ level: 3, title: '', type: 'STORM', description: '' });
    } catch { toast.error('Failed to declare emergency'); }
    finally { setDeclaring(false); }
  }

  async function handleResolve() {
    if (!active) return;
    try {
      await resolve(active._id, 'Situation normalized');
      toast.success('Emergency resolved');
    } catch { toast.error('Failed to resolve emergency'); }
  }

  async function handleInjectStorm() {
    setInjecting(true);
    try {
      const { data } = await api.post('/simulator/storm', simConfig);
      toast.success(
        `Storm injected: +${data.results.created} incidents, ${data.results.techniciansDisabled} techs unavailable, ${data.results.depotsClosed} depots closed`,
        { duration: 8000 }
      );
    } catch { toast.error('Failed to inject storm scenario'); }
    finally { setInjecting(false); }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await api.post('/simulator/reset');
      toast.success('Simulator state reset — technicians restored, depots reopened');
    } catch { toast.error('Reset failed'); }
    finally { setResetting(false); }
  }

  return (
    <div className="page-container">
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={18} style={{ color: active ? 'var(--critical)' : 'var(--text-muted)' }} />
          Emergency Command Center
        </h2>
        <div className="text-xs text-muted">Declare, monitor, and resolve organizational emergencies</div>
      </div>

      {/* Active Emergency Alert */}
      {active ? (
        <div style={{
          padding: '20px 24px', marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.05))',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 'var(--radius-lg)',
          animation: 'emergencyPulse 2s ease-in-out infinite',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'rgba(239,68,68,0.15)', border: '2px solid rgba(239,68,68,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
              }}>🚨</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--critical)' }}>
                    LEVEL {active.level} — {LEVEL_LABELS[active.level] ?? 'EMERGENCY'}
                  </span>
                  <span className="badge critical" style={{ animation: 'blink 1s ease-in-out infinite' }}>ACTIVE</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{active.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {active.type} · Declared {formatDistanceToNow(new Date(active.declaredAt))} ago
                  {active.declaredBy && ` · by ${active.declaredBy.name ?? 'System'}`}
                </div>
              </div>
            </div>
            <button className="btn btn-success" onClick={handleResolve}>
              <CheckCircle size={14} /> Resolve Emergency
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '14px 20px', marginBottom: 24,
          background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <CheckCircle size={15} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
            No active emergency — normal operations
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Emergency Level Guide */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><Shield size={14} /> Emergency Level Guide</div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {LEVEL_LABELS.map((label, level) => (
              <div key={level} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px',
                borderBottom: level < 4 ? '1px solid var(--border-subtle)' : 'none',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `${LEVEL_COLORS[level]}22`, border: `1px solid ${LEVEL_COLORS[level]}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.85rem', color: LEVEL_COLORS[level],
                }}>{level}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: LEVEL_COLORS[level] }}>{label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{LEVEL_DESCS[level]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Declare Emergency */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><AlertTriangle size={14} style={{ color: 'var(--critical)' }} /> Declare Emergency</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleDeclare} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Emergency Level</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4].map(l => (
                    <button
                      key={l} type="button"
                      onClick={() => setDeclareForm(f => ({ ...f, level: l }))}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)',
                        border: `2px solid ${declareForm.level === l ? LEVEL_COLORS[l] : 'var(--border-default)'}`,
                        background: declareForm.level === l ? `${LEVEL_COLORS[l]}18` : 'transparent',
                        color: declareForm.level === l ? LEVEL_COLORS[l] : 'var(--text-muted)',
                        fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >{l}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-input"
                  placeholder="e.g. Cyclone Remal — Infrastructure Response"
                  value={declareForm.title}
                  onChange={e => setDeclareForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={declareForm.type}
                  onChange={e => setDeclareForm(f => ({ ...f, type: e.target.value }))}
                >
                  {EMERGENCY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Situation summary…"
                  value={declareForm.description}
                  onChange={e => setDeclareForm(f => ({ ...f, description: e.target.value }))}
                  style={{ minHeight: 64 }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-danger"
                disabled={declaring || !!active}
                style={{ marginTop: 4 }}
              >
                {declaring
                  ? <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Declaring…</>
                  : <>🚨 Declare Level {declareForm.level} Emergency</>}
              </button>
              {active && (
                <div className="text-xs text-muted" style={{ textAlign: 'center' }}>
                  Resolve the active emergency first before declaring a new one
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Chaos Simulator */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CloudLightning size={14} style={{ color: 'var(--warning)' }} /> Chaos Simulator
          </div>
          <span className="badge high" style={{ fontSize: '0.62rem' }}>DEMO ONLY</span>
        </div>
        <div className="card-body">
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Inject a realistic storm scenario to demonstrate the platform's emergency re-optimization capabilities. This will create emergency work orders, disable technicians, and close depots — simulating what happens during an actual weather event.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'newIncidents',       label: 'New Emergency Incidents', icon: '⚡', max: 200 },
              { key: 'disableTechnicians', label: 'Technicians Disabled',    icon: '👷', max: 50 },
              { key: 'closeDepots',        label: 'Depots Closed',           icon: '🏭', max: 6 },
            ].map(({ key, label, icon, max }) => (
              <div key={key} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '14px 16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="range" min={0} max={max}
                    value={simConfig[key]}
                    onChange={e => setSimConfig(s => ({ ...s, [key]: parseInt(e.target.value) }))}
                    style={{ flex: 1, accentColor: 'var(--brand-500)' }}
                  />
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--warning)', minWidth: 28, textAlign: 'right' }}>
                    {simConfig[key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-warning"
              onClick={handleInjectStorm}
              disabled={injecting}
              style={{ flex: 1 }}
            >
              {injecting
                ? <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#000' }} /> Injecting…</>
                : <>🌩️ Inject Storm Scenario</>}
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting
                ? <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Resetting…</>
                : <><RefreshCw size={13} /> Reset</>}
            </button>
          </div>

          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              💡 <strong style={{ color: 'var(--text-secondary)' }}>Demo flow:</strong> Inject Storm → Go to Dashboard to see stats change → Run Optimization → Approve assignments → Resolve Emergency
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
