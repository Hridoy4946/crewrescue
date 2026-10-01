// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue Field App — Zustand Store
// Global state: auth, work orders, GPS, online status, outbox sync
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api from '../lib/api.js';
import {
  saveAuthToken, clearAuth, cacheWorkOrders, getCachedWorkOrders,
  getCachedWorkOrder, updateCachedWorkOrderStatus, enqueueAction,
  getPendingActions, clearOutboxItem,
} from '../lib/db.js';

// ── Auth Store ────────────────────────────────────────────────────────────────
export const useAuthStore = create(
  persist(
    (set, _get) => ({
      user:            null,
      token:           null,
      isAuthenticated: false,
      isLoading:       true,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        const { accessToken, user } = data;
        localStorage.setItem('pwa_token', accessToken);
        await saveAuthToken(accessToken);
        set({ user, token: accessToken, isAuthenticated: true });
        return user;
      },

      logout: async () => {
        try { await api.post('/auth/logout'); } catch {}
        localStorage.removeItem('pwa_token');
        await clearAuth();
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch {
          localStorage.removeItem('pwa_token');
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name: 'pwa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
);

// ── Work Orders Store ─────────────────────────────────────────────────────────
export const useWorkOrderStore = create((set, _get) => ({
  workOrders:  [],
  activeWO:    null,
  isLoading:   false,
  isOffline:   false,

  // Fetch assigned work orders for the current technician
  fetchMy: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/incidents?limit=50&assignedToMe=true');
      const wos = data.incidents ?? [];
      await cacheWorkOrders(wos);
      set({ workOrders: wos, isLoading: false, isOffline: false });
    } catch (_err) {
      // Fall back to IndexedDB cache
      const cached = await getCachedWorkOrders();
      set({ workOrders: cached, isLoading: false, isOffline: true });
    }
  },

  fetchOne: async (id) => {
    try {
      const { data } = await api.get(`/incidents/${id}`);
      const wo = data.incident;
      set({ activeWO: wo });
      return wo;
    } catch {
      const cached = await getCachedWorkOrder(id);
      set({ activeWO: cached, isOffline: true });
      return cached;
    }
  },

  // 1-tap status transition
  transitionStatus: async (id, status, note = '') => {
    // Optimistic update
    await updateCachedWorkOrderStatus(id, status);
    set(s => ({
      workOrders: s.workOrders.map(w => w._id === id ? { ...w, status } : w),
      activeWO: s.activeWO?._id === id ? { ...s.activeWO, status } : s.activeWO,
    }));

    const action = {
      type: 'STATUS_TRANSITION',
      payload: { incidentId: id, status, note, timestamp: new Date().toISOString() },
    };

    if (!navigator.onLine) {
      await enqueueAction(action);
      return { queued: true };
    }

    try {
      const { data } = await api.patch(`/incidents/${id}/status`, { status, reason: note });
      return { queued: false, incident: data.incident };
    } catch {
      await enqueueAction(action);
      return { queued: true };
    }
  },

  // Add a note to a work order
  addNote: async (id, text) => {
    const action = { type: 'ADD_NOTE', payload: { incidentId: id, text, timestamp: new Date().toISOString() } };
    if (!navigator.onLine) {
      await enqueueAction(action);
      return { queued: true };
    }
    try {
      await api.post(`/incidents/${id}/notes`, { text });
      return { queued: false };
    } catch {
      await enqueueAction(action);
      return { queued: true };
    }
  },

  setActiveWO: (wo) => set({ activeWO: wo }),
  setOffline: (v) => set({ isOffline: v }),
}));

// ── GPS Store — 30-second heartbeat ──────────────────────────────────────────
export const useGPSStore = create((set, get) => ({
  position:        null,
  watchId:         null,
  lastPingAt:      null,
  gpsEnabled:      false,
  pingInterval:    null,

  startTracking: () => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        set({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy },
          gpsEnabled: true,
        });
      },
      (err) => { console.warn('GPS error:', err); set({ gpsEnabled: false }); },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    set({ watchId });

    // Ping location to server every 30 seconds
    const pingInterval = setInterval(() => get().pingLocation(), 30_000);
    set({ pingInterval });
  },

  stopTracking: () => {
    const { watchId, pingInterval } = get();
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    if (pingInterval) clearInterval(pingInterval);
    set({ watchId: null, pingInterval: null, gpsEnabled: false });
  },

  pingLocation: async () => {
    const { position } = get();
    if (!position) return;
    const payload = {
      type:    'GPS_PING',
      payload: { lat: position.lat, lng: position.lng, timestamp: new Date().toISOString() },
    };
    if (!navigator.onLine) {
      await enqueueAction(payload);
      return;
    }
    try {
      await api.post('/technicians/me/location', { lat: position.lat, lng: position.lng });
      set({ lastPingAt: Date.now() });
    } catch {
      await enqueueAction(payload);
    }
  },
}));

// ── Outbox Sync ───────────────────────────────────────────────────────────────
export async function syncOutbox() {
  if (!navigator.onLine) return 0;
  const pending = await getPendingActions();
  if (!pending.length) return 0;

  let synced = 0;
  for (const [key, action] of Object.entries(pending)) {
    try {
      if (action.type === 'STATUS_TRANSITION') {
        await api.patch(`/incidents/${action.payload.incidentId}/status`, {
          status: action.payload.status,
          reason: action.payload.note,
        });
      } else if (action.type === 'ADD_NOTE') {
        await api.post(`/incidents/${action.payload.incidentId}/notes`, { text: action.payload.text });
      } else if (action.type === 'GPS_PING') {
        await api.post('/technicians/me/location', { lat: action.payload.lat, lng: action.payload.lng });
      }
      await clearOutboxItem(Number(key));
      synced++;
    } catch {
      // Keep in outbox, retry next time
    }
  }
  return synced;
}
