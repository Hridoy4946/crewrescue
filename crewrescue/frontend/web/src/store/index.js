import { create } from 'zustand';
import api from '../lib/api.js';

export const useAuthStore = create((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    set({ user: data.user, isAuthenticated: true });
    return data.user;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export const useDashboardStore = create((set) => ({
  stats: null,
  slaHealth: null,
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const [statsRes, slaRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/sla-health'),
      ]);
      set({ stats: statsRes.data.stats, slaHealth: slaRes.data.slaHealth, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));

export const useEmergencyStore = create((set) => ({
  active: null,

  fetchActive: async () => {
    try {
      const { data } = await api.get('/emergency/active');
      set({ active: data.emergency });
    } catch {}
  },

  declare: async (payload) => {
    const { data } = await api.post('/emergency/declare', payload);
    set({ active: data.emergency });
    return data.emergency;
  },

  resolve: async (id, notes) => {
    await api.post(`/emergency/${id}/resolve`, { notes });
    set({ active: null });
  },
}));
