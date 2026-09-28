import { useState, useEffect } from 'react';
import { Truck, RefreshCw, MapPin, Fuel, Wrench } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  AVAILABLE:   '#10B981',
  IN_USE:      '#F59E0B',
  MAINTENANCE: '#EF4444',
  OUT_OF_SERVICE: '#6B7280',
};

const TYPE_ICONS = {
  VAN: '🚐', TRUCK: '🚚', PICKUP: '🛻', MOTORCYCLE: '🏍️',
  EMERGENCY_UNIT: '🚨', CRANE_TRUCK: '🏗️',
};

function VehicleCard({ vehicle }) {
  const color  = STATUS_COLORS[vehicle.status] ?? '#6B7280';
  const icon   = TYPE_ICONS[vehicle.type] ?? '🚐';
  const fuelPct = vehicle.fuel?.level != null ? vehicle.fuel.level : null;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: `${color}18`, border: `2px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem',
          }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono">{vehicle.plateNumber}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{vehicle.type?.replace(/_/g, ' ')}</span>
              <span style={{ color: 'var(--border-default)' }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', color, fontWeight: 600 }}>{vehicle.status?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Fuel */}
          {fuelPct != null && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Fuel size={10} /> Fuel</span>
                <span style={{ fontWeight: 700, color: fuelPct < 20 ? 'var(--critical)' : fuelPct < 40 ? 'var(--warning)' : 'var(--success)' }}>
                  {fuelPct}%
                </span>
              </div>
              <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${fuelPct}%`, borderRadius: 3,
                  background: fuelPct < 20 ? 'var(--critical)' : fuelPct < 40 ? 'var(--warning)' : 'var(--success)',
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          )}

          {/* Assigned tech */}
          {vehicle.assignedTechnicianId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--brand-glow)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>
                {vehicle.assignedTechnicianId.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
              </div>
              <span>{vehicle.assignedTechnicianId.name}</span>
            </div>
          )}

          {/* Depot */}
          {vehicle.depotId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <MapPin size={11} /> {vehicle.depotId.name} ({vehicle.depotId.code})
            </div>
          )}

          {/* Odometer */}
          {vehicle.odometerKm != null && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              🛣 {vehicle.odometerKm?.toLocaleString()} km
              {vehicle.lastServiceKm && ` · Service @ ${vehicle.lastServiceKm.toLocaleString()}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const [vehicles, setVehicles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const { data } = await api.get(`/vehicles?${params}`);
      setVehicles(data.vehicles ?? []);
    } catch { toast.error('Failed to load vehicles'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const displayed = filterType
    ? vehicles.filter(v => v.type === filterType)
    : vehicles;

  const statusSummary = vehicles.reduce((a, v) => { a[v.status] = (a[v.status] ?? 0) + 1; return a; }, {});
  const lowFuel = vehicles.filter(v => v.fuel?.level != null && v.fuel.level < 25).length;

  const TYPES = ['VAN', 'TRUCK', 'PICKUP', 'MOTORCYCLE', 'EMERGENCY_UNIT', 'CRANE_TRUCK'];
  const STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE'];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} style={{ color: 'var(--brand-400)' }} /> Fleet Management
          </h2>
          <div className="text-xs text-muted">{vehicles.length} vehicles · DhakaPower Utilities</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Alert: low fuel */}
      {lowFuel > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--critical)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Fuel size={13} /> <strong>{lowFuel} vehicle{lowFuel !== 1 ? 's' : ''}</strong> below 25% fuel — schedule refuelling
        </div>
      )}

      {/* Status strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              borderRadius: 20, cursor: 'pointer',
              background: filterStatus === s ? `${STATUS_COLORS[s]}22` : 'var(--bg-card)',
              border: `1px solid ${filterStatus === s ? STATUS_COLORS[s] : 'var(--border-subtle)'}`,
              color: filterStatus === s ? STATUS_COLORS[s] : 'var(--text-secondary)',
              fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[s] }} />
            {s.replace(/_/g, ' ')} <span style={{ fontWeight: 700 }}>{statusSummary[s] ?? 0}</span>
          </button>
        ))}
        <select
          className="form-select"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ height: 30, fontSize: '0.72rem', width: 150 }}
        >
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 175, borderRadius: 16 }} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Truck size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No vehicles match the current filters</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {displayed.map(v => <VehicleCard key={v._id} vehicle={v} />)}
        </div>
      )}
    </div>
  );
}
