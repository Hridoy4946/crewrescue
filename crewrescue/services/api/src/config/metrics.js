import client from 'prom-client';

// Enable default Node.js metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ── Custom business metrics ────────────────────────────────────────────────────
export const metrics = {
  httpDuration: new client.Histogram({
    name: 'crewrescue_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register],
  }),

  optimizationDuration: new client.Histogram({
    name: 'crewrescue_optimization_duration_seconds',
    help: 'Optimization run duration in seconds',
    labelNames: ['algorithm'],
    buckets: [1, 5, 10, 15, 20, 30, 60],
    registers: [register],
  }),

  slaRiskCount: new client.Gauge({
    name: 'crewrescue_sla_risk_count',
    help: 'Number of incidents currently at SLA breach risk',
    registers: [register],
  }),

  activeEmergencyLevel: new client.Gauge({
    name: 'crewrescue_active_emergency_level',
    help: 'Current emergency declaration level (0-4)',
    registers: [register],
  }),

  unassignedIncidents: new client.Gauge({
    name: 'crewrescue_unassigned_incidents_total',
    help: 'Number of unassigned incidents',
    registers: [register],
  }),

  optimizationRuns: new client.Counter({
    name: 'crewrescue_optimization_runs_total',
    help: 'Total optimization runs executed',
    labelNames: ['algorithm', 'status'],
    registers: [register],
  }),

  reassignmentCount: new client.Counter({
    name: 'crewrescue_reassignment_count_total',
    help: 'Total technician reassignments performed',
    registers: [register],
  }),
};

// ── Express middleware ─────────────────────────────────────────────────────────
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    metrics.httpDuration
      .labels(req.method, route, String(res.statusCode))
      .observe((Date.now() - start) / 1000);
  });
  next();
}

export async function metricsHandler(_req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
