import { useEffect } from 'react';
import { useGPSStore, useAuthStore } from '../store/index.js';
import { MapPin, Navigation, Wifi, WifiOff, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const { position, gpsEnabled, lastPingAt, startTracking, stopTracking, pingLocation } = useGPSStore();
  const online = navigator.onLine;

  useEffect(() => {
    startTracking();
    return () => {}; // Keep tracking active even if tab changes
  }, []);

  async function handleManualPing() {
    await pingLocation();
    toast.success('Location sent to dispatcher');
  }

  return (
    <div>
      {/* User info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--brand), #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem',
            }}>
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{user?.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {user?.role?.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* GPS Status */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div style={{ fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Navigation size={14} style={{ color: gpsEnabled ? 'var(--success)' : 'var(--text-muted)' }} />
          GPS Tracking
        </div></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: gpsEnabled ? 'var(--success)' : 'var(--critical)',
                boxShadow: gpsEnabled ? '0 0 8px var(--success)' : 'none',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: gpsEnabled ? 'var(--success)' : 'var(--critical)' }}>
                {gpsEnabled ? 'GPS Active' : 'GPS Disabled'}
              </span>
            </div>

            {position && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', padding: '8px 10px', background: 'var(--bg-deep)', borderRadius: 8 }}>
                Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}<br />
                Accuracy: ±{Math.round(position.accuracy)}m
              </div>
            )}

            {lastPingAt && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} /> Last sync: {formatDistanceToNow(lastPingAt)} ago
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleManualPing} disabled={!gpsEnabled || !online} style={{ flex: 1 }}>
                <MapPin size={12} /> Send Location Now
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={gpsEnabled ? stopTracking : startTracking}
                style={{ flex: 1 }}
              >
                {gpsEnabled ? 'Pause' : 'Start'} Tracking
              </button>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              📡 Automatic 30-second heartbeat to dispatcher map
            </div>
          </div>
        </div>
      </div>

      {/* Network status */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {online
              ? <Wifi size={16} style={{ color: 'var(--success)' }} />
              : <WifiOff size={16} style={{ color: 'var(--warning)' }} />
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: online ? 'var(--success)' : 'var(--warning)' }}>
                {online ? 'Online' : 'Offline Mode'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {online
                  ? 'Connected — all changes sync immediately'
                  : 'Changes are saved locally and will sync when connected'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* App info */}
      <div style={{ padding: '0 4px', marginBottom: 16 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span>📱 CrewRescue Field App v1.0.0 — Progressive Web App</span>
          <span>💾 Offline-first via IndexedDB · Workbox Service Worker</span>
          <span>🔐 Auth token stored securely in IndexedDB</span>
          <span>📡 GPS heartbeat every 30s · Outbox queue for offline actions</span>
        </div>
      </div>

      {/* Sign out */}
      <button
        className="btn btn-ghost w-full"
        onClick={logout}
        style={{ padding: '14px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.3)', color: 'var(--critical)' }}
      >
        Sign Out
      </button>
    </div>
  );
}
