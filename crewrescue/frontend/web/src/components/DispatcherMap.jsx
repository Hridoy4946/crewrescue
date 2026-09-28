import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../lib/api.js';
import { useSocket } from '../hooks/useSocket.js';

// ─── Custom marker icons ───────────────────────────────────────────────────────
function createIcon(emoji, bg, size = 28) {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${bg};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2px solid rgba(255,255,255,0.3);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    "><span style="transform:rotate(45deg);font-size:${size*0.5}px">${emoji}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
    className: '',
  });
}

const ICONS = {
  AVAILABLE:   createIcon('👷', '#10B981'),
  BUSY:        createIcon('🔧', '#F59E0B'),
  EN_ROUTE:    createIcon('🚐', '#3B82F6'),
  ON_SITE:     createIcon('📍', '#8B5CF6'),
  UNAVAILABLE: createIcon('❌', '#EF4444'),
  OFFLINE:     createIcon('💤', '#374151'),
  // Incidents
  CRITICAL:    createIcon('⚡', '#EF4444', 32),
  HIGH:        createIcon('⚠', '#F97316', 26),
  MEDIUM:      createIcon('📋', '#F59E0B', 22),
  LOW:         createIcon('ℹ', '#6B7280', 20),
  // Depots
  DEPOT:       createIcon('🏭', '#0EA5E9', 30),
};

function STATUS_COLOR(status) {
  return { AVAILABLE: '#10B981', BUSY: '#F59E0B', EN_ROUTE: '#3B82F6', ON_SITE: '#8B5CF6', UNAVAILABLE: '#EF4444', OFFLINE: '#374151' }[status] ?? '#6B7280';
}

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
  }, [technicians.length]);
  return null;
}

export default function DispatcherMap({ height = '100%' }) {
  const [technicians, setTechnicians] = useState([]);
  const [incidents, setIncidents]     = useState([]);
  const [depots, setDepots]           = useState([]);
  const [layers, setLayers]           = useState({ technicians: true, incidents: true, depots: true });
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
    const interval = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time location updates
  useEffect(() => {
    if (!socket?.on) return;
    const handler = ({ technicianId, location }) => {
      setTechnicians(prev => prev.map(t =>
        t._id === technicianId
          ? { ...t, currentLocation: { type: 'Point', coordinates: [location.lng, location.lat] }, lastLocationUpdate: new Date() }
          : t
      ));
    };
    socket.on('technician:location_updated', handler);
    return () => socket.off?.('technician:location_updated', handler);
  }, [socket]);

  // Listen for new incidents
  useEffect(() => {
    if (!socket?.on) return;
    const handler = ({ incident }) => {
      if (incident?.location?.coordinates) {
        setIncidents(prev => [incident, ...prev]);
      }
    };
    socket.on('incident:created', handler);
    return () => socket.off?.('incident:created', handler);
  }, [socket]);

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  // Stats summary
  const available = technicians.filter(t => t.status === 'AVAILABLE').length;
  const critical  = incidents.filter(i => i.severity === 'CRITICAL').length;

  return (
    <div style={{ height, position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* Layer controls */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {[
          { key: 'technicians', label: `👷 Techs (${technicians.length})`, color: '#10B981' },
          { key: 'incidents',   label: `⚡ Incidents (${incidents.length})`, color: '#EF4444' },
          { key: 'depots',      label: `🏭 Depots (${depots.length})`, color: '#0EA5E9' },
        ].map(l => (
          <button
            key={l.key}
            onClick={() => toggleLayer(l.key)}
            style={{
              padding: '5px 10px',
              background: layers[l.key] ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${layers[l.key] ? l.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6,
              color: layers[l.key] ? l.color : '#6B7280',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Quick stats overlay */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        display: 'flex', gap: 6,
      }}>
        {[
          { label: 'Available', value: available, color: '#10B981' },
          { label: 'Critical',  value: critical,  color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${s.color}33`,
            borderRadius: 8,
            padding: '6px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.62rem', color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <MapContainer
        center={[23.8103, 90.4125]}
        zoom={12}
        style={{ height: '100%', width: '100%', background: '#0d1117' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© OpenStreetMap'
          opacity={0.6}
        />

        <AutoFitBounds technicians={technicians} />

        {/* Technician markers */}
        {layers.technicians && technicians.map((tech) => {
          if (!tech.currentLocation?.coordinates?.length) return null;
          const [lng, lat] = tech.currentLocation.coordinates;
          return (
            <Marker
              key={tech._id}
              position={[lat, lng]}
              icon={ICONS[tech.status] ?? ICONS.OFFLINE}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter', minWidth: 160 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{tech.name}</div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{tech.employeeId}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR(tech.status), flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{tech.status}</span>
                  </div>
                  {tech.skills?.slice(0, 3).map(s => (
                    <span key={s.skillId} style={{ fontSize: 10, background: '#f0f0f0', borderRadius: 4, padding: '1px 5px', marginRight: 3, marginTop: 4, display: 'inline-block' }}>
                      {s.skillId}
                    </span>
                  ))}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Incident markers */}
        {layers.incidents && incidents.map((inc) => {
          if (!inc.location?.coordinates?.length) return null;
          const [lng, lat] = inc.location.coordinates;
          return (
            <Marker
              key={inc._id}
              position={[lat, lng]}
              icon={ICONS[inc.severity] ?? ICONS.LOW}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter', minWidth: 180 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 12 }}>{inc.workOrderNumber}</div>
                  <div style={{ fontSize: 11, marginBottom: 6, color: '#333' }}>{inc.title}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: inc.severity === 'CRITICAL' ? '#fee2e2' : '#fef3c7', color: inc.severity === 'CRITICAL' ? '#ef4444' : '#d97706', borderRadius: 4, padding: '1px 6px' }}>
                      {inc.severity}
                    </span>
                    <span style={{ fontSize: 10, background: '#f0f0f0', borderRadius: 4, padding: '1px 6px' }}>
                      {inc.status}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Depot markers */}
        {layers.depots && depots.map((depot) => {
          if (!depot.location?.coordinates?.length) return null;
          const [lng, lat] = depot.location.coordinates;
          return (
            <Marker key={depot._id} position={[lat, lng]} icon={ICONS.DEPOT}>
              <Popup>
                <div style={{ fontFamily: 'Inter', minWidth: 150 }}>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{depot.name}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{depot.code} · {depot.status}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
