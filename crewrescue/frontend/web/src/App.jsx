import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useDashboardStore } from './store/index.js';
import { useSocket } from './hooks/useSocket.js';

import LoginPage        from './pages/LoginPage.jsx';
import DashboardPage    from './pages/DashboardPage.jsx';
import IncidentsPage    from './pages/IncidentsPage.jsx';
import TechniciansPage  from './pages/TechniciansPage.jsx';
import OptimizationPage from './pages/OptimizationPage.jsx';
import EmergencyPage    from './pages/EmergencyPage.jsx';
import AITriagePage     from './pages/AITriagePage.jsx';
import CopilotPage      from './pages/CopilotPage.jsx';
import AIAssistantPage  from './pages/AIAssistantPage.jsx';
import MapPage          from './pages/MapPage.jsx';
import AnalyticsPage    from './pages/AnalyticsPage.jsx';
import VehiclesPage     from './pages/VehiclesPage.jsx';
import DepotsPage       from './pages/DepotsPage.jsx';
import SettingsPage     from './pages/SettingsPage.jsx';
import Sidebar          from './components/Sidebar.jsx';

// Lazy-loaded pages (stub — full pages added in Phase 2+)
function PlaceholderPage({ title }) {
  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</div>
        <h2 style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>{title}</h2>
        <p className="text-sm">This section is being built. Check the task tracker for progress.</p>
      </div>
    </div>
  );
}

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Interface Error</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 480, fontSize: '0.9rem', marginBottom: 16 }}>
            Something went wrong while rendering this view.
          </p>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: 8, fontSize: '0.75rem', color: '#f87171', maxWidth: 600, overflowX: 'auto', marginBottom: 20 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedLayout() {
  const { stats } = useDashboardStore();
  useSocket(); // Connect WebSocket (establishes singleton connection)
  return (
    <div className="app-shell">
      <Sidebar stats={stats} />
      <main className="main-content" style={{ gridColumn: 2, gridRow: '1 / span 2', overflow: 'auto' }}>
        <ErrorBoundary>
          <Routes>
            <Route path="/"            element={<DashboardPage />} />
            <Route path="/map"         element={<MapPage />} />
            <Route path="/incidents"   element={<IncidentsPage />} />
            <Route path="/optimize"    element={<OptimizationPage />} />
            <Route path="/emergency"   element={<EmergencyPage />} />
            <Route path="/technicians" element={<TechniciansPage />} />
            <Route path="/vehicles"    element={<VehiclesPage />} />
            <Route path="/depots"      element={<DepotsPage />} />
            <Route path="/analytics"   element={<AnalyticsPage />} />
            <Route path="/ai"          element={<AITriagePage />} />
            <Route path="/copilot"     element={<CopilotPage />} />
            <Route path="/assistant"   element={<AIAssistantPage />} />
            <Route path="/settings"    element={<SettingsPage />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AuthGuard({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <div className="loading-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading CrewRescue AI…</span>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            fontSize: '0.82rem',
            maxWidth: '420px',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-elevated)' } },
          error:   { iconTheme: { primary: 'var(--critical)', secondary: 'var(--bg-elevated)' } },
          duration: 4000,
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={
          <AuthGuard>
            <ProtectedLayout />
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  );
}
