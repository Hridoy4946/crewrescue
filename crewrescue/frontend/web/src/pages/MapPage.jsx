import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../lib/api.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  Layers, Radio, Users, AlertTriangle, Warehouse, RefreshCw,
  Search, X, ChevronDown, ChevronUp, Navigation, Zap,
  Filter, Clock, Phone, MapPin, Shield, CheckCircle2,
  Compass, ExternalLink, Crosshair
} from 'lucide-react';

// ── Custom Marker Icons ────────────────────────────────────────────────────────
function createPinIcon(emoji, bg, size = 32, glow = false) {
  return L.divIcon({
    html: `<div style="
      position:relative;
      width:${size}px;height:${size + 8}px;
      display:flex;flex-direction:column;align-items:center;
    ">
      <div style="
        width:${size}px;height:${size}px;
        background:${bg};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid rgba(255,255,255,0.8);
        display:flex;align-items:center;justify-content:center;
        box-shadow:${glow ? `0 0 16px ${bg}, 0 4px 14px rgba(0,0,0,0.7)` : '0 4px 12px rgba(0,0,0,0.6)'};
      ">
        <span style="transform:rotate(45deg);font-size:${size * 0.48}px;line-height:1">${emoji}</span>
      </div>
      <div style="
        width:6px;height:6px;border-radius:50%;
        background:rgba(0,0,0,0.5);margin-top:2px;
      "></div>
    </div>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    className: '',
  });
}

const ICONS = {
  AVAILABLE:   createPinIcon('👷', '#10B981', 32, true),
  BUSY:        createPinIcon('🔧', '#F59E0B', 28),
  EN_ROUTE:    createPinIcon('🚐', '#3B82F6', 32, true),
  ON_SITE:     createPinIcon('📍', '#8B5CF6', 28),
  UNAVAILABLE: createPinIcon('❌', '#EF4444', 26),
  OFFLINE:     createPinIcon('💤', '#4B5563', 24),
  CRITICAL:    createPinIcon('⚡', '#EF4444', 36, true),
  HIGH:        createPinIcon('⚠', '#F97316', 30),
  MEDIUM:      createPinIcon('📋', '#F59E0B', 24),
  LOW:         createPinIcon('ℹ', '#6B7280', 22),
  DEPOT:       createPinIcon('🏭', '#0EA5E9', 34),
};

const DISTRICT_COORDS = {
  'Gulshan':    [23.7925, 90.4078],
  'Dhanmondi':  [23.7461, 90.3742],
  'Mirpur':     [23.8071, 90.3686],
  'Uttara':     [23.8759, 90.3795],
  'Motijheel':  [23.7330, 90.4172],
  'Tejgaon':    [23.7598, 90.3912],
  'Mohammadpur':[23.7658, 90.3584],
  'Badda':      [23.7805, 90.4267],
};

function MapFlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 14, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const [technicians, setTechnicians] = useState([]);
  const [incidents, setIncidents]     = useState([]);
  const [depots, setDepots]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [layers, setLayers]           = useState({ technicians: true, incidents: true, depots: true });
  const [sevFilter, setSevFilter]     = useState('CRITICAL_HIGH'); // 'CRITICAL_ONLY', 'CRITICAL_HIGH', 'ALL'
  const [activeDistrict, setActiveDistrict] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarTab, setSidebarTab]   = useState('incidents'); // 'incidents', 'techs', 'depots'
  const { socket } = useSocket();

  async function load() {
    setLoading(true);
    try {
      const [tRes, iRes, dRes] = await Promise.all([
        api.get('/technicians/map'),
        api.get('/incidents/map'),
        api.get('/depots'),
      ]);
      setTechnicians(tRes.data.technicians ?? []);
      setIncidents(iRes.data.incidents ?? []);
      setDepots(dRes.data.depots ?? []);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Map load error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket?.on) return;
    const locHandler = ({ technicianId, location }) => {
      setTechnicians(prev => prev.map(t =>
        t._id === technicianId
          ? { ...t, currentLocation: { type: 'Point', coordinates: [location.lng, location.lat] }, lastLocationUpdate: new Date() }
          : t
      ));
    };
    const incHandler = ({ incident }) => {
      if (incident?.location?.coordinates) {
        setIncidents(prev => [incident, ...prev]);
      }
    };
    socket.on('technician:location_updated', locHandler);
    socket.on('incident:created', incHandler);
    return () => {
      socket.off?.('technician:location_updated', locHandler);
      socket.off?.('incident:created', incHandler);
    };
  }, [socket]);

  // Filter incidents for display
  const filteredIncidents = useMemo(() => {
    let list = incidents;
    if (sevFilter === 'CRITICAL_ONLY') {
      list = list.filter(i => i.severity === 'CRITICAL');
    } else if (sevFilter === 'CRITICAL_HIGH') {
      list = list.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.workOrderNumber?.toLowerCase().includes(q) || i.title?.toLowerCase().includes(q) || i.location?.area?.toLowerCase().includes(q));
    }
    // Limit to max 120 on the live map for clean visibility
    return list.slice(0, 120);
  }, [incidents, sevFilter, searchQuery]);

  const filteredTechs = useMemo(() => {
    let list = technicians;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q) || t.employeeId?.toLowerCase().includes(q) || t.territory?.toLowerCase().includes(q));
    }
    return list;
  }, [technicians, searchQuery]);

  const toggleLayer = key => setLayers(p => ({ ...p, [key]: !p[key] }));

  const availableTechs = technicians.filter(t => t.status === 'AVAILABLE').length;
  const criticalCount  = incidents.filter(i => i.severity === 'CRITICAL').length;

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 48px)', background: '#050810', overflow: 'hidden' }}>
      {/* Top Header Floating Nav */}
      <div style={{
        position: 'absolute', top: 12, left: 16, right: 360, zIndex: 1001,
        background: 'rgba(9, 13, 26, 0.88)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 14,
        padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Title & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', animation: 'blink 1.8s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Live Operations GIS</span>
          </div>

          <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span><strong style={{ color: '#10B981' }}>{availableTechs}</strong> Available Techs</span>
            <span>·</span>
            <span><strong style={{ color: '#EF4444' }}>{criticalCount}</strong> Critical Tickets</span>
            <span>·</span>
            <span><strong style={{ color: '#0EA5E9' }}>{depots.length}</strong> Operational Depots</span>
          </div>
        </div>

        {/* District Quick Zoom Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>District:</span>
          {Object.keys(DISTRICT_COORDS).slice(0, 5).map(dist => (
            <button
              key={dist}
              onClick={() => setActiveDistrict(DISTRICT_COORDS[dist])}
              style={{
                padding: '3px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700,
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {dist}
            </button>
          ))}
          <button
            onClick={load}
            className="btn btn-ghost btn-sm"
            style={{ padding: '3px 8px', height: 26, fontSize: '0.7rem', marginLeft: 6 }}
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Layer & Severity Toggles (Left overlay) */}
      <div style={{
        position: 'absolute', top: 76, left: 16, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Layer checkboxes */}
        <div style={{
          background: 'rgba(9, 13, 26, 0.88)', backdropFilter: 'blur(16px)',
          borderRadius: 12, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            Map Overlays
          </div>
          {[
            { key: 'technicians', label: `👷 Technicians (${technicians.length})`, color: '#10B981' },
            { key: 'incidents',   label: `⚡ Incidents (${filteredIncidents.length})`, color: '#EF4444' },
            { key: 'depots',      label: `🏭 Depots (${depots.length})`, color: '#0EA5E9' },
          ].map(l => (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              style={{
                padding: '5px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700,
                background: layers[l.key] ? l.color + '22' : 'transparent',
                color: layers[l.key] ? l.color : 'var(--text-muted)',
                border: `1px solid ${layers[l.key] ? l.color + '55' : 'rgba(255,255,255,0.05)'}`,
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>{l.label}</span>
              <span style={{ fontSize: '0.75rem' }}>{layers[l.key] ? '✓' : ''}</span>
            </button>
          ))}
        </div>

        {/* Priority Filter */}
        {layers.incidents && (
          <div style={{
            background: 'rgba(9, 13, 26, 0.88)', backdropFilter: 'blur(16px)',
            borderRadius: 12, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              Incident Filter
            </div>
            {[
              { id: 'CRITICAL_ONLY', label: '⚡ Critical Only (P1)' },
              { id: 'CRITICAL_HIGH', label: '⚠ High + Critical' },
              { id: 'ALL',           label: 'All Active Tickets' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSevFilter(f.id)}
                style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
                  background: sevFilter === f.id ? 'var(--brand-glow)' : 'transparent',
                  color: sevFilter === f.id ? 'var(--brand-400)' : 'var(--text-muted)',
                  border: `1px solid ${sevFilter === f.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Map Canvas */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapContainer
          center={[23.8103, 90.4125]}
          zoom={12}
          style={{ height: '100%', width: '100%', background: '#050810' }}
          zoomControl={false}
        >
          {/* OSM tiles with CSS dark invert filter — no API key, always free */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            subdomains={['a', 'b', 'c']}
            maxZoom={20}
            className="dark-tiles"
          />

          {activeDistrict && <MapFlyTo center={activeDistrict} zoom={14} />}
          {selectedEntity?.coords && <MapFlyTo center={selectedEntity.coords} zoom={15} />}

          {/* Technician Markers */}
          {layers.technicians && filteredTechs.map(tech => {
            if (!tech.currentLocation?.coordinates?.length) return null;
            const [lng, lat] = tech.currentLocation.coordinates;
            const empId = tech.employeeId || 'EMP-' + tech._id.slice(-4).toUpperCase();
            return (
              <Marker
                key={tech._id}
                position={[lat, lng]}
                icon={ICONS[tech.status] ?? ICONS.OFFLINE}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 210, padding: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>{tech.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: '#EEF2FF', color: '#4F46E5', fontFamily: 'monospace',
                      }}>
                        {empId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
                        background: tech.status === 'AVAILABLE' ? '#D1FAE5' : '#FEF3C7',
                        color: tech.status === 'AVAILABLE' ? '#065F46' : '#92400E',
                      }}>
                        {tech.status}
                      </span>
                      {tech.territory && <span style={{ fontSize: 11, color: '#6B7280' }}>📍 {tech.territory}</span>}
                    </div>
                    {tech.skills?.length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                        {tech.skills.slice(0, 3).map(s => (
                          <span key={s.skillId} style={{
                            fontSize: 9, background: '#F3F4F6', color: '#374151',
                            padding: '1px 5px', borderRadius: 4,
                          }}>
                            {s.skillId}
                          </span>
                        ))}
                      </div>
                    )}
                    {tech.phone && (
                      <div style={{ fontSize: 10, color: '#6B7280' }}>📞 {tech.phone}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Incident Markers */}
          {layers.incidents && filteredIncidents.map(inc => {
            if (!inc.location?.coordinates?.length) return null;
            const [lng, lat] = inc.location.coordinates;
            const isCritical = inc.severity === 'CRITICAL';
            return (
              <Marker
                key={inc._id}
                position={[lat, lng]}
                icon={ICONS[inc.severity] ?? ICONS.LOW}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 220, padding: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 12, color: '#2563EB', fontFamily: 'monospace' }}>
                        {inc.workOrderNumber}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 4,
                        background: isCritical ? '#FEE2E2' : '#FEF3C7',
                        color: isCritical ? '#DC2626' : '#D97706',
                      }}>
                        {inc.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1F2937', marginBottom: 6 }}>
                      {inc.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                      <span>📍 {inc.location?.area || 'Metro Area'}</span>
                      <span>Status: <strong>{inc.status}</strong></span>
                    </div>
                    <a
                      href="/incidents"
                      style={{
                        display: 'block', textAlign: 'center', padding: '5px',
                        background: '#2563EB', color: '#fff', borderRadius: 6,
                        fontSize: 11, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      Assign Field Worker →
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Depot Markers */}
          {layers.depots && depots.map(depot => {
            if (!depot.location?.coordinates?.length) return null;
            const [lng, lat] = depot.location.coordinates;
            return (
              <Marker key={depot._id} position={[lat, lng]} icon={ICONS.DEPOT}>
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160, padding: 2 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0369A1' }}>{depot.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280', margin: '3px 0' }}>{depot.code} · {depot.address || 'Dhaka Base'}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#D1FAE5', padding: '1px 6px', borderRadius: 4, display: 'inline-block' }}>
                      ● {depot.status || 'OPERATIONAL'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Right Dispatcher Operations Drawer */}
      <div style={{
        position: 'absolute', top: 12, right: 16, bottom: 12, width: 330, zIndex: 1001,
        background: 'rgba(9, 13, 26, 0.92)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
      }}>
        {/* Drawer Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Operational Entities
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              Live Telemetry
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              placeholder="Search WO #, name, Employee ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 28, height: 32, fontSize: '0.75rem' }}
            />
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8 }}>
            {[
              { id: 'incidents', label: `Incidents (${filteredIncidents.length})` },
              { id: 'techs',     label: `Techs (${filteredTechs.length})` },
              { id: 'depots',    label: `Depots (${depots.length})` },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setSidebarTab(t.id)}
                style={{
                  flex: 1, padding: '4px 6px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700,
                  background: sidebarTab === t.id ? 'var(--brand-glow)' : 'transparent',
                  color: sidebarTab === t.id ? 'var(--brand-400)' : 'var(--text-muted)',
                  border: `1px solid ${sidebarTab === t.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {sidebarTab === 'incidents' && (
            filteredIncidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: '0.78rem' }}>No incidents match</div>
            ) : (
              filteredIncidents.map(inc => {
                const [lng, lat] = inc.location?.coordinates || [];
                return (
                  <div
                    key={inc._id}
                    onClick={() => {
                      if (lat && lng) setSelectedEntity({ coords: [lat, lng], item: inc });
                    }}
                    style={{
                      padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 10,
                      border: '1px solid var(--border-subtle)', marginBottom: 6, cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-500)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 800, color: 'var(--brand-400)' }}>
                        {inc.workOrderNumber}
                      </span>
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                        background: inc.severity === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: inc.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)',
                      }}>
                        {inc.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.title}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      📍 {inc.location?.area || 'Dhaka Metro'}
                    </div>
                  </div>
                );
              })
            )
          )}

          {sidebarTab === 'techs' && (
            filteredTechs.map(tech => {
              const [lng, lat] = tech.currentLocation?.coordinates || [];
              const empId = tech.employeeId || 'EMP-' + tech._id.slice(-4).toUpperCase();
              return (
                <div
                  key={tech._id}
                  onClick={() => {
                    if (lat && lng) setSelectedEntity({ coords: [lat, lng], item: tech });
                  }}
                  style={{
                    padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 10,
                    border: '1px solid var(--border-subtle)', marginBottom: 6, cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-500)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>{tech.name}</span>
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(59,130,246,0.1)', color: 'var(--brand-400)', fontFamily: 'monospace',
                    }}>
                      {empId}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: tech.status === 'AVAILABLE' ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                      ● {tech.status}
                    </span>
                    {tech.territory && <span>· 📍 {tech.territory}</span>}
                  </div>
                </div>
              );
            })
          )}

          {sidebarTab === 'depots' && (
            depots.map(depot => {
              const [lng, lat] = depot.location?.coordinates || [];
              return (
                <div
                  key={depot._id}
                  onClick={() => {
                    if (lat && lng) setSelectedEntity({ coords: [lat, lng], item: depot });
                  }}
                  style={{
                    padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 10,
                    border: '1px solid var(--border-subtle)', marginBottom: 6, cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: 2 }}>
                    {depot.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {depot.code} · <span style={{ color: 'var(--success)' }}>● {depot.status}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
