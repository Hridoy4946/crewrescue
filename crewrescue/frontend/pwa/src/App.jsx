import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  ClipboardList, Bot, User as UserIcon,
} from 'lucide-react';

import { useAuthStore, useGPSStore, syncOutbox } from './store/index.js';
import LoginPage          from './pages/LoginPage.jsx';
import WorkOrdersPage     from './pages/WorkOrdersPage.jsx';
import WorkOrderDetailPage from './pages/WorkOrderDetailPage.jsx';
import CopilotPage        from './pages/CopilotPage.jsx';
import ProfilePage        from './pages/ProfilePage.jsx';

import './index.css';

// ── PWA update toast ──────────────────────────────────────────────────────────
function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) { console.log('SW registered', r); },
    onRegisterError(err) { console.error('SW error', err); },
  });

  useEffect(() => {
    if (needRefresh) {
      toast(
        (t) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 600 }}>App update available</span>
            <button
              onClick={() => { updateServiceWorker(true); toast.dismiss(t.id); }}
              style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
            >
              Update Now
            </button>
          </div>
        ),
        { duration: Infinity }
      );
    }
  }, [needRefresh]);

  return null;
}

// ── Offline/online banner ────────────────────────────────────────────────────
function NetworkBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => { setOnline(true);  toast.success('Back online — syncing…'); syncOutbox(); };
    const off = () => { setOnline(false); toast.error('You\'re offline — changes saved locally'); };
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (online) return null;
  return (
    <div className="offline-banner">
      ⚠ OFFLINE — Changes saved locally, will sync when connected
    </div>
  );
}

// ── Bottom navigation ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'orders',  label: 'My Jobs',  icon: ClipboardList },
  { id: 'copilot', label: 'Copilot',  icon: Bot },
  { id: 'profile', label: 'Profile',  icon: UserIcon },
];

export default function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { startTracking } = useGPSStore();

  const [tab,          setTab]          = useState('orders');
  const [selectedWOId, setSelectedWOId] = useState(null); // work order detail mode

  useEffect(() => {
    checkAuth();
  }, []);

  // Start GPS tracking after login
  useEffect(() => {
    if (isAuthenticated) {
      startTracking();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 12, background: 'var(--bg-deep)' }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-center" toastOptions={{ style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.82rem' } }} />
        <LoginPage />
      </>
    );
  }

  return (
    <div className="app">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.82rem', maxWidth: '360px' },
          success: { iconTheme: { primary: 'var(--success)',  secondary: 'var(--bg-elevated)' } },
          error:   { iconTheme: { primary: 'var(--critical)', secondary: 'var(--bg-elevated)' } },
          duration: 3000,
        }}
      />
      <PWAUpdatePrompt />
      <NetworkBanner />

      {/* Top bar */}
      <header className="topbar">
        <a href="#" className="topbar-logo" onClick={e => { e.preventDefault(); setSelectedWOId(null); setTab('orders'); }}>
          <div className="topbar-logo-icon">🚨</div>
          <span>CrewRescue</span>
        </a>
        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600 }}>Field App</span>
      </header>

      {/* Main page content */}
      <main className="page">
        {/* Work order detail overlay */}
        {selectedWOId ? (
          <WorkOrderDetailPage
            workOrderId={selectedWOId}
            onBack={() => setSelectedWOId(null)}
          />
        ) : tab === 'orders' ? (
          <WorkOrdersPage onSelect={wo => setSelectedWOId(wo._id)} />
        ) : tab === 'copilot' ? (
          <CopilotPage />
        ) : (
          <ProfilePage />
        )}
      </main>

      {/* Bottom navigation — hidden when in WO detail view */}
      {!selectedWOId && (
        <nav className="bottom-nav">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`bottom-nav-item ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={20} />
                {t.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
