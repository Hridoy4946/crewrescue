import { useState, useEffect, useCallback } from 'react';
import { Warehouse, RefreshCw, MapPin, Package, Users, Truck, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  OPERATIONAL:      { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: 'Operational',      icon: '✅' },
  REDUCED_CAPACITY: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',   label: 'Reduced Capacity', icon: '⚠️' },
  CLOSED:           { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   label: 'Closed',           icon: '🔴' },
  EMERGENCY_ONLY:   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)',   label: 'Emergency Only',   icon: '🚨' },
};

const STATUS_CYCLE = {
  OPERATIONAL: 'CLOSED',
  CLOSED: 'OPERATIONAL',
  REDUCED_CAPACITY: 'OPERATIONAL',
  EMERGENCY_ONLY: 'OPERATIONAL',
};

function CapacityBar({ current, max, color, label }) {
  if (!max) return null;
  const pct = Math.min(100, Math.round((current / max) * 100));
  const barColor = pct > 90 ? '#EF4444' : pct > 70 ? '#F59E0B' : color;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: barColor, fontWeight: 700 }}>{current} / {max}</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
          borderRadius: 3, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// Confirmation modal to prevent accidental depot closures
function ConfirmModal({ depot, newStatus, onConfirm, onCancel }) {
  const isClosing = newStatus === 'CLOSED';
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)', padding: 28, maxWidth: 400, width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 12 }}>
          {isClosing ? '🏭' : '✅'}
        </div>
        <h3 style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', marginBottom: 6 }}>
          {isClosing ? 'Close Depot?' : 'Reopen Depot?'}
        </h3>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          {isClosing
            ? `Closing "${depot.name}" will require rerouting ${depot.currentTechnicianCount ?? 0} technicians and ${depot.currentVehicleCount ?? 0} vehicles.`
            : `Reopening "${depot.name}" will make it available for crew assignments.`
          }
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost w-full" onClick={onCancel}>Cancel</button>
          <button
            className={`btn w-full ${isClosing ? 'btn-danger' : 'btn-success'}`}
            onClick={onConfirm}
          >
            {isClosing ? '🔴 Close Depot' : '✅ Reopen Depot'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DepotCard({ depot, onToggleStatus }) {
  const cfg = STATUS_CONFIG[depot.status] ?? STATUS_CONFIG.OPERATIONAL;
  const [toggling, setToggling] = useState(false);
  const [confirmState, setConfirmState] = useState(null); // { newStatus }

  function requestToggle() {
    const newStatus = STATUS_CYCLE[depot.status] ?? 'OPERATIONAL';
    setConfirmState({ newStatus });
  }

  async function confirmToggle() {
    const { newStatus } = confirmState;
    setConfirmState(null);
    setToggling(true);
    try {
      await onToggleStatus(depot._id, newStatus);
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
        border: `1px solid ${cfg.border}`,
        overflow: 'hidden', position: 'relative',
        transition: 'all 0.25s ease',
        boxShadow: depot.status === 'CLOSED' ? `0 0 0 1px ${cfg.border}, 0 4px 20px rgba(239,68,68,0.08)` : 'none',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 30px rgba(0,0,0,0.2), 0 0 0 1px ${cfg.border}`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = depot.status === 'CLOSED' ? `0 0 0 1px ${cfg.border}, 0 4px 20px rgba(239,68,68,0.08)` : 'none'; }}
      >
        {/* Status accent bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}80)` }} />

        <div style={{ padding: '18px 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 4, letterSpacing: '-0.01em' }}>{depot.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4 }}>{depot.code}</span>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.68rem', fontWeight: 700, color: cfg.color,
                  background: cfg.bg, padding: '2px 8px', borderRadius: 20,
                  border: `1px solid ${cfg.border}`,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, animation: depot.status === 'OPERATIONAL' ? 'blink 3s ease-in-out infinite' : 'none' }} />
                  {cfg.label}
                </div>
              </div>
            </div>

            {/* Toggle button */}
            <button
              onClick={requestToggle}
              disabled={toggling}
              style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                background: depot.status === 'OPERATIONAL' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                border: `1px solid ${depot.status === 'OPERATIONAL' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                color: depot.status === 'OPERATIONAL' ? '#EF4444' : '#10B981',
                fontSize: '0.68rem', fontWeight: 700, cursor: toggling ? 'not-allowed' : 'pointer',
                opacity: toggling ? 0.5 : 1, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
              title={depot.status === 'OPERATIONAL' ? 'Close depot' : 'Reopen depot'}
            >
              {toggling
                ? <div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                : depot.status === 'OPERATIONAL'
                  ? <><XCircle size={12} /> Close</>
                  : <><CheckCircle2 size={12} /> Reopen</>
              }
            </button>
          </div>

          {/* Address */}
          {(depot.address?.area || depot.address?.city || typeof depot.address === 'string') && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              <MapPin size={11} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>
                {typeof depot.address === 'string'
                  ? depot.address
                  : [depot.address?.area, depot.address?.city, depot.address?.country].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { icon: <Users size={12} />, label: 'Techs', value: depot.currentTechnicianCount ?? '—', color: 'var(--brand-400)' },
              { icon: <Truck size={12} />, label: 'Vehicles', value: depot.currentVehicleCount ?? '—', color: 'var(--warning)' },
              { icon: <Package size={12} />, label: 'Zones', value: depot.coverageZones?.length ?? 0, color: 'var(--success)' },
            ].map(stat => (
              <div key={stat.label} style={{
                textAlign: 'center', padding: '8px 6px',
                background: 'var(--bg-elevated)', borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: stat.color, marginBottom: 3 }}>{stat.icon}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Capacity bars */}
          <CapacityBar current={depot.currentTechnicianCount ?? 0} max={depot.capacity?.technicians} color="var(--brand-400)" label="Technician Capacity" />
          <CapacityBar current={depot.currentVehicleCount ?? 0} max={depot.capacity?.vehicles} color="var(--warning)" label="Vehicle Capacity" />

          {/* Coverage zones */}
          {depot.coverageZones?.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {depot.coverageZones.slice(0, 6).map(z => (
                <span key={z} style={{
                  fontSize: '0.6rem', padding: '2px 7px', borderRadius: 20,
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)',
                  color: 'var(--brand-400)',
                }}>{z}</span>
              ))}
              {depot.coverageZones.length > 6 && (
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', padding: '2px 4px' }}>
                  +{depot.coverageZones.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <ConfirmModal
          depot={depot}
          newStatus={confirmState.newStatus}
          onConfirm={confirmToggle}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
}

export default function DepotsPage() {
  const [depots, setDepots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/depots');
      setDepots(data.depots ?? []);
    } catch { toast.error('Failed to load depots'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(depotId, newStatus) {
    try {
      await api.patch(`/depots/${depotId}/status`, { status: newStatus });
      toast.success(newStatus === 'OPERATIONAL' ? '✅ Depot reopened successfully' : '🔴 Depot closed — rerouting required');
      // Re-fetch to get fresh state (prevents race conditions)
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update depot status');
      // Re-fetch to ensure UI is consistent with server state
      await load();
    }
  }

  const operational  = depots.filter(d => d.status === 'OPERATIONAL').length;
  const closed       = depots.filter(d => d.status === 'CLOSED').length;
  const reduced      = depots.filter(d => d.status === 'REDUCED_CAPACITY').length;

  const filtered = filterStatus ? depots.filter(d => d.status === filterStatus) : depots;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
            <Warehouse size={18} style={{ color: 'var(--brand-400)' }} />
            Depot Network
          </h2>
          <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>{depots.length} depots</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>● {operational} operational</span>
            {closed > 0 && <span style={{ color: 'var(--critical)', fontWeight: 600 }}>● {closed} closed</span>}
            {reduced > 0 && <span style={{ color: 'var(--warning)', fontWeight: 600 }}>● {reduced} reduced</span>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Alert for closed depots */}
      {closed > 0 && (
        <div style={{
          marginBottom: 16, padding: '12px 18px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--critical)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={16} />
          <div>
            <strong>{closed} depot{closed !== 1 ? 's' : ''} closed</strong>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>— resource re-routing may be required for affected areas</span>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: '', label: 'All Depots', count: depots.length },
          { id: 'OPERATIONAL', label: 'Operational', count: operational, color: '#10B981' },
          { id: 'CLOSED', label: 'Closed', count: closed, color: '#EF4444' },
          { id: 'REDUCED_CAPACITY', label: 'Reduced', count: reduced, color: '#F59E0B' },
        ].filter(f => f.count > 0 || f.id === '').map(f => (
          <button key={f.id} onClick={() => setFilterStatus(f.id)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
            background: filterStatus === f.id ? (f.color ? f.color + '20' : 'var(--brand-glow)') : 'var(--bg-elevated)',
            color: filterStatus === f.id ? (f.color ?? 'var(--brand-400)') : 'var(--text-muted)',
            border: `1px solid ${filterStatus === f.id ? (f.color ? f.color + '40' : 'rgba(59,130,246,0.3)') : 'var(--border-subtle)'}`,
            transition: 'all 0.15s',
          }}>
            {f.label}
            <span style={{ marginLeft: 5, opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* Depot grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 290, borderRadius: 16 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Warehouse size={36} style={{ opacity: 0.15, display: 'block', margin: '0 auto 12px' }} />
          No depots match filter
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {filtered.map(d => (
            <DepotCard key={d._id} depot={d} onToggleStatus={toggleStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
