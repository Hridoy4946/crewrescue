import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useDashboardStore, useEmergencyStore } from '../store/index.js';

let socketInstance = null;

export function useSocket() {
  const { fetchStats } = useDashboardStore();
  const { fetchActive } = useEmergencyStore();
  const mountedRef = useRef(true);
  const [sock, setSock] = useState(() => socketInstance);

  useEffect(() => {
    mountedRef.current = true;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    if (!socketInstance) {
      socketInstance = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:5000', {
        auth: { token },
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      socketInstance.on('connect', () => {
        console.log('🔌 WebSocket connected');
      });

      socketInstance.on('emergency:declared', ({ emergency }) => {
        if (!mountedRef.current) return;
        toast.error(`🚨 Emergency Declared: ${emergency.title}`, { duration: 8000 });
        fetchActive();
        fetchStats();
      });

      socketInstance.on('emergency:resolved', () => {
        if (!mountedRef.current) return;
        toast.success('✅ Emergency Resolved', { duration: 5000 });
        fetchActive();
        fetchStats();
      });

      socketInstance.on('incident:created', ({ incident }) => {
        if (!mountedRef.current) return;
        if (incident.severity === 'CRITICAL') {
          toast.error(`⚡ Critical Incident: ${incident.title}`, { duration: 6000 });
        }
        fetchStats();
      });

      socketInstance.on('optimization:completed', ({ algorithm, runtimeMs, before, after }) => {
        if (!mountedRef.current) return;
        toast.success(
          `🤖 Optimization Complete (${algorithm}) — SLA: ${before.slaCompliancePct}% → ${after.slaCompliancePct}% in ${(runtimeMs/1000).toFixed(1)}s`,
          { duration: 8000 }
        );
        fetchStats();
      });

      socketInstance.on('schedule:updated', ({ assignmentCount }) => {
        if (!mountedRef.current) return;
        toast.success(`📋 Schedule Updated — ${assignmentCount} assignments applied`);
        fetchStats();
      });

      socketInstance.on('simulator:storm_injected', ({ results }) => {
        if (!mountedRef.current) return;
        toast.error(
          `🌩️ Storm Injected: +${results.created} incidents, -${results.techniciansDisabled} techs, -${results.depotsClosed} depots`,
          { duration: 8000 }
        );
        fetchStats();
      });

      socketInstance.on('disconnect', () => {
        console.warn('WebSocket disconnected');
      });
    }

    if (sock !== socketInstance) {
      setSock(socketInstance);
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const activeSock = sock || socketInstance;

  return {
    socket: activeSock,
    on: (evt, fn) => activeSock?.on?.(evt, fn),
    off: (evt, fn) => activeSock?.off?.(evt, fn),
    emit: (evt, data) => activeSock?.emit?.(evt, data),
  };
}
