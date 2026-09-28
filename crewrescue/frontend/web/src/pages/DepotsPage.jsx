import { useState, useEffect } from 'react';
import { Warehouse, RefreshCw, MapPin, Package, Users, Truck, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  OPERATIONAL: 'var(--success)',
  REDUCED_CAPACITY: 'var(--warning)',
  CLOSED: 'var(--critical)',
  EMERGENCY_ONLY: 'var(--purple)',
};
const STATUS_LABELS = {
  OPERATIONAL: 'Operational',
  REDUCED_CAPACITY: 'Reduced Capacity',
  CLOSED: 'Closed',
  EMERGENCY_ONLY: 'Emergency Only',
};

function CapacityBar({ current, max, color }) {
  if (!max) return null;
  const pct = Math.round((current / max) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 3 }}>
        <span>Capacity</span>
        <span style={{ fontWeight: 700, color }}>{current}/{max}</span>
      </div>
      <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function DepotCard({ depot, onToggleStatus }) {
  const color = STATUS_COLORS[depot.status] ?? '#6B7280';
  const [toggling, setToggling] = useState(false);

  async function toggle() {
    const newStatus = depot.status === 'OPERATIONAL' ? 'CLOSED' : 'OPERATIONAL';
    setToggling(true);
    try { await onToggleStatus(depot._id, newStatus); }
    finally { setToggling(false); }
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Status bar */}
      <div style={{ height: 4, background: color, borderRadius: '16px 16px 0 0' }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{depot.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{depot.code}</span>
              <span style={{ color: 'var(--border-default)' }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{STATUS_LABELS[depot.status] ?? depot.status}</span>
              </div>
            </div>
          </div>
          <button
            onClick={toggle}
            disabled={toggling}
            title={depot.status === 'OPERATIONAL' ? 'Close depot' : 'Reopen depot'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: depot.status === 'OPERATIONAL' ? 'var(--success)' : 'var(--critical)',
              padding: 0, flexShrink: 0,
            }}
          >
            {depot.status === 'OPERATIONAL'
              ? <ToggleRight size={24} />
              : <ToggleLeft size={24} />}
          </button>
        </div>

        {/* Address */}
        {(depot.address?.area || depot.address?.city || typeof depot.address === 'string') && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>
            <MapPin size={11} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              {typeof depot.address === 'string'
                ? depot.address
                : [depot.address?.area, depot.address?.city, depot.address?.country].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { icon: <Users size={11} />, label: 'Techs', value: depot.currentTechnicianCount ?? '—' },
            { icon: <Truck size={11} />, label: 'Vehicles', value: depot.currentVehicleCount ?? '—' },
            { icon: <Package size={11} />, label: 'Zones', value: depot.coverageZones?.length ?? 0 },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Capacity bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <CapacityBar
            current={depot.currentTechnicianCount ?? 0}
            max={depot.capacity?.technicians}
            color="var(--brand-400)"
          />
          <CapacityBar
            current={depot.currentVehicleCount ?? 0}
            max={depot.capacity?.vehicles}
            color="var(--warning)"
          />
        </div>

        {/* Coverage zones */}
        {depot.coverageZones?.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {depot.coverageZones.slice(0, 5).map(z => (
              <span key={z} style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: 20, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.12)', color: 'var(--brand-400)' }}>
                {z}
              </span>
            ))}
            {depot.coverageZones.length > 5 && (
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{depot.coverageZones.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DepotsPage() {
  const [depots, setDepots]   = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/depots');
      setDepots(data.depots ?? []);
    } catch { toast.error('Failed to load depots'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  async function toggleStatus(depotId, newStatus) {
    try {
      await api.patch(`/depots/${depotId}/status`, { status: newStatus });
      toast.success(`Depot ${newStatus === 'OPERATIONAL' ? 'reopened' : 'closed'}`);
      load();
    } catch { toast.error('Failed to update depot status'); }
  }

  const operational = depots.filter(d => d.status === 'OPERATIONAL').length;
  const closed      = depots.filter(d => d.status === 'CLOSED').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Warehouse size={18} style={{ color: 'var(--brand-400)' }} /> Depot Network
          </h2>
          <div className="text-xs text-muted">
            {depots.length} depots · {operational} operational · {closed > 0 && <span style={{ color: 'var(--critical)' }}>{closed} closed</span>}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Closed alert */}
      {closed > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--critical)', display: 'flex', alignItems: 'center', gap: 8 }}>
          🏭 <strong>{closed} depot{closed !== 1 ? 's' : ''} closed</strong> — resource re-routing may be required
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 260, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {depots.map(d => <DepotCard key={d._id} depot={d} onToggleStatus={toggleStatus} />)}
        </div>
      )}
    </div>
  );
}
