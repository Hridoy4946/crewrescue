import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import api from '../lib/api.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  Zap, AlertTriangle, Users, Warehouse, Shield,
  Navigation, Phone, CheckCircle2, Clock, Filter,
  Layers, ChevronRight, UserCheck
} from 'lucide-react';
import { formatDistanceToNow, isPast } from 'date-fns';

// ── Custom SVG Pin Icons ───────────────────────────────────────────────────────
function createMarkerIcon(emoji, bg, size = 32) {
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
        border:2px solid rgba(255,255,255,0.6);
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 4px 10px rgba(0,0,0,0.5);
      ">
        <span style="transform:rotate(45deg);font-size:${size * 0.48}px;line-height:1">${emoji}</span>
      </div>
      <div style="
        width:6px;height:6px;border-radius:50%;
        background:rgba(0,0,0,0.4);margin-top:2px;
      "></div>
    </div>`,
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    className: '',
  });
}

const ICONS = {
  AVAILABLE:   createMarkerIcon('👷', '#10B981', 30),
  BUSY:        createMarkerIcon('🔧', '#F59E0B', 28),
  EN_ROUTE:    createMarkerIcon('🚐', '#3B82F6', 30),
  ON_SITE:     createMarkerIcon('📍', '#8B5CF6', 28),
  UNAVAILABLE: createMarkerIcon('❌', '#EF4444', 26),
  OFFLINE:     createMarkerIcon('💤', '#4B5563', 24),
  // Incidents
  CRITICAL:    createMarkerIcon('🚨', '#EF4444', 34),
  HIGH:        createMarkerIcon('⚠️', '#F97316', 28),
  MEDIUM:      createMarkerIcon('📋', '#F59E0B', 24),
  LOW:         createMarkerIcon('ℹ️', '#6B7280', 22),
  // Depots
  DEPOT:       createMarkerIcon('🏭', '#0EA5E9', 32),
};

function AutoFitBounds({ technicians }) {
  const map = useMap();
  useEffect(() => {
    if (technicians.length > 0) {
      const coords = technicians
        .filter(t => t.currentLocation?.coordinates?.length === 2)
        .map(t => [t.currentLocation.coordinates[1], t.currentLocation.coordinates[0]]);
      if (coords.length > 0) {
        map.fitBounds(coords, { padding: [40, 40], maxZoom: 13 });
      }
    }
  }, [technicians, map]);
  return null;
}

export default function DispatcherMap({ height = '100%' }) {
  const [technicians, setTechnicians] = useState([]);
  const [incidents, setIncidents]     = useState([]);
  const [depots, setDepots]           = useState([]);
  const [layers, setLayers]           = useState({ technicians: true, incidents: true, depots: true });
  const [incidentFilter, setIncidentFilter] = useState('CRITICAL_HIGH'); // 'ALL', 'CRITICAL_HIGH', 'CRITICAL_ONLY'
  const { socket } = useSocket();

  useEffect(() => {
    async function load() {
      try {
        const [tRes, iRes, dRes] = await Promise.all([
          api.get('/technicians/map'),
          api.get('/incidents/map'),
          api.get('/depots'),
        ]);
        setTechnicians(tRes.data.technicians ?? []);
        setIncidents(iRes.data.incidents ?? []);
        setDepots(dRes.data.depots ?? []);
      } catch (err) {
        console.error('Map load failed:', err);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Real-time location updates
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

  // Filtered incidents to prevent map clutter
  const displayedIncidents = useMemo(() => {
    let list = incidents;
    if (incidentFilter === 'CRITICAL_ONLY') {
      list = list.filter(i => i.severity === 'CRITICAL');
    } else if (incidentFilter === 'CRITICAL_HIGH') {
      list = list.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
    }
    // Limit to max 60 on dashboard map for optimal performance and crisp visual clarity
    return list.slice(0, 60);
  }, [incidents, incidentFilter]);

  const toggleLayer = key => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  const availableTechs = technicians.filter(t => t.status === 'AVAILABLE').length;
  const criticalCount  = incidents.filter(i => i.severity === 'CRITICAL').length;

  return (
    <div style={{ height, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      {/* Top Left Floating Layer Filters */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{
          background: 'rgba(9, 13, 26, 0.85)', backdropFilter: 'blur(12px)',
          borderRadius: 10, padding: '4px', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: 4,
        }}>
          <button
            onClick={() => toggleLayer('technicians')}
            style={{
              padding: '5px 9px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
              background: layers.technicians ? 'rgba(16,185,129,0.2)' : 'transparent',
              color: layers.technicians ? '#10B981' : 'var(--text-muted)',
              border: `1px solid ${layers.technicians ? 'rgba(16,185,129,0.3)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            👷 Techs ({technicians.length})
          </button>
          <button
            onClick={() => toggleLayer('incidents')}
            style={{
              padding: '5px 9px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
              background: layers.incidents ? 'rgba(239,68,68,0.2)' : 'transparent',
              color: layers.incidents ? '#EF4444' : 'var(--text-muted)',
              border: `1px solid ${layers.incidents ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            ⚡ Incidents ({displayedIncidents.length})
          </button>
          <button
            onClick={() => toggleLayer('depots')}
            style={{
              padding: '5px 9px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700,
              background: layers.depots ? 'rgba(14,165,233,0.2)' : 'transparent',
              color: layers.depots ? '#0EA5E9' : 'var(--text-muted)',
              border: `1px solid ${layers.depots ? 'rgba(14,165,233,0.3)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            🏭 Depots ({depots.length})
          </button>
        </div>

        {/* Priority Filter Pill */}
        {layers.incidents && (
          <div style={{
            background: 'rgba(9, 13, 26, 0.85)', backdropFilter: 'blur(12px)',
            borderRadius: 8, padding: '3px 6px', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.62rem',
          }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 4 }}>Filter:</span>
            {[
              { id: 'CRITICAL_ONLY', label: 'Critical' },
              { id: 'CRITICAL_HIGH', label: 'P1 + P2' },
              { id: 'ALL',           label: 'All Active' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setIncidentFilter(f.id)}
                style={{
                  padding: '2px 7px', borderRadius: 5, fontSize: '0.62rem', fontWeight: 700,
                  background: incidentFilter === f.id ? 'var(--brand-glow)' : 'transparent',
                  color: incidentFilter === f.id ? 'var(--brand-400)' : 'var(--text-muted)',
                  border: `1px solid ${incidentFilter === f.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top Right Live Telemetry Badges */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        display: 'flex', gap: 6,
      }}>
        <div style={{
          background: 'rgba(9, 13, 26, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10,
          padding: '6px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10B981', lineHeight: 1 }}>{availableTechs}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Available Techs</div>
        </div>
        <div style={{
          background: 'rgba(9, 13, 26, 0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10,
          padding: '6px 14px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#EF4444', lineHeight: 1 }}>{criticalCount}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>Critical Incidents</div>
        </div>
      </div>

      {/* Bottom Floating Legend Bar */}
      <div style={{
        position: 'absolute', bottom: 10, left: 12, right: 12, zIndex: 1000,
        background: 'rgba(9, 13, 26, 0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
        padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.65rem', color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span><span style={{ color: '#10B981', fontWeight: 800 }}>●</span> Available Tech</span>
          <span><span style={{ color: '#3B82F6', fontWeight: 800 }}>●</span> En Route</span>
          <span><span style={{ color: '#EF4444', fontWeight: 800 }}>●</span> Critical Incident</span>
          <span><span style={{ color: '#0EA5E9', fontWeight: 800 }}>●</span> Operations Depot</span>
        </div>
        <div>
          Showing {displayedIncidents.length} of {incidents.length} incidents · High Density Filter
        </div>
      </div>

      <MapContainer
        center={[23.8103, 90.4125]}
        zoom={12}
        style={{ height: '100%', width: '100%', background: '#070b14' }}
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

        <AutoFitBounds technicians={technicians} />

        {/* Technician Markers */}
        {layers.technicians && technicians.map(tech => {
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
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200, padding: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#111827' }}>{tech.name}</div>
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
        {layers.incidents && displayedIncidents.map(inc => {
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
                    Manage & Dispatch Worker →
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
  );
}
