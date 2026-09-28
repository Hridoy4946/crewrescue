// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue Field App — Axios API Client
// Auto-injects auth token, handles 401 logout, queues offline requests
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { getAuthToken } from './db.js';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Inject token on every request
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('pwa_token') ?? (await getAuthToken());
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pwa_token');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;
