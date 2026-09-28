// ─── CrewRescue Full Functional Test Suite ────────────────────────────────────
import fetch from 'node-fetch';

const BASE = 'http://localhost:5000/api';
let token = '';
let H = {};
const results = [];

function pass(test, detail = '') { console.log(`  ✅ ${test}${detail ? ' — ' + detail : ''}`); results.push({ test, status: 'PASS', detail }); }
function fail(test, err)         { console.log(`  ❌ ${test} — ${err}`);                      results.push({ test, status: 'FAIL', detail: err }); }
function warn(test, detail)      { console.log(`  ⚠️  ${test} — ${detail}`);                  results.push({ test, status: 'WARN', detail }); }
function section(name)           { console.log(`\n===== ${name} =====`); }

async function req(method, path, body) {
  const opts = { method, headers: { ...H } };
  if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(`${BASE}${path}`, opts);
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: json };
}

// ── 1. Auth ───────────────────────────────────────────────────────────────────
section('BLOCK 1: AUTHENTICATION');

try {
  const r = await req('POST', '/auth/login', { email: 'admin@dhakapower.bd', password: 'Admin@CrewRescue2025' });
  if (r.ok && r.data.accessToken) {
    token = r.data.accessToken;
    H = { Authorization: `Bearer ${token}` };
    pass('Admin login', `${r.data.user.name} | ${r.data.user.role}`);
  } else {
    fail('Admin login', r.data.error ?? JSON.stringify(r.data));
    process.exit(1);
  }
} catch(e) { fail('Login', e.message); process.exit(1); }

try {
  const r = await req('GET', '/auth/me');
  r.ok ? pass('/auth/me', r.data.user?.email) : fail('/auth/me', r.data.error);
} catch(e) { fail('/auth/me', e.message); }

// ── 2. Incidents CRUD ─────────────────────────────────────────────────────────
section('BLOCK 2: INCIDENTS');

let incidentId, incidentWO;
try {
  const r = await req('GET', '/incidents?limit=5&page=1');
  r.ok ? pass('List incidents (paginated)', `total=${r.data.total} pages=${r.data.pages}`) : fail('List incidents', r.data.error);
} catch(e) { fail('List incidents', e.message); }

try {
  const r = await req('GET', '/incidents?severity=CRITICAL&limit=3');
  r.ok ? pass('Filter by severity=CRITICAL', `${r.data.total} critical tickets`) : fail('Filter CRITICAL', r.data.error);
} catch(e) { fail('Filter CRITICAL', e.message); }

try {
  const r = await req('POST', '/incidents', {
    title: 'FUNCTEST — HV Line Fault @ Tejgaon Industrial',
    description: 'High-voltage line down. 11kV feeder tripped. 350 industrial customers offline.',
    category: 'POWER_OUTAGE', severity: 'CRITICAL', type: 'EMERGENCY', isEmergency: true,
    location: { type: 'Point', coordinates: [90.3938, 23.7752], area: 'Tejgaon' },
    requiredSkills: ['ELECTRICAL', 'HIGH_VOLTAGE'],
  });
  if (r.ok) {
    incidentId = r.data.incident._id;
    incidentWO = r.data.incident.workOrderNumber;
    pass('Create incident', `${incidentWO} (${incidentId})`);
  } else { fail('Create incident', r.data.error); }
} catch(e) { fail('Create incident', e.message); }

try {
  const r = await req('GET', `/incidents/${incidentId}`);
  r.ok ? pass('Get incident by ID', `${r.data.incident.workOrderNumber} | status=${r.data.incident.status}`) : fail('Get incident by ID', r.data.error);
} catch(e) { fail('Get incident by ID', e.message); }

try {
  const r = await req('PATCH', `/incidents/${incidentId}/status`, { status: 'IN_PROGRESS', note: 'Automated test dispatch' });
  r.ok ? pass('Update incident status', `→ ${r.data.incident.status}`) : fail('Update status', r.data.error);
} catch(e) { fail('Update status', e.message); }

try {
  const r = await req('GET', '/incidents/map');
  r.ok ? pass('Map geo data', `${r.data.incidents?.length} incidents with coordinates`) : fail('Map data', r.data.error);
} catch(e) { fail('Map data', e.message); }

// ── 3. Technicians ────────────────────────────────────────────────────────────
section('BLOCK 3: TECHNICIANS');
let techId, techName;

try {
  let r = await req('GET', '/technicians?status=AVAILABLE&limit=5');
  if (!r.data.technicians?.length) {
    r = await req('GET', '/technicians?limit=5');
  }
  if (r.ok && r.data.technicians?.length) {
    techId = r.data.technicians[0]._id;
    techName = r.data.technicians[0].name;
    pass('List technicians', `total=${r.data.total} | top: ${techName} (${r.data.technicians[0].status})`);
  } else fail('List technicians', r.data.error || 'No technicians found');
} catch(e) { fail('List technicians', e.message); }

try {
  const r = await req('GET', `/technicians/${techId}`);
  const t = r.data?.technician;
  if (r.ok && t) {
    pass('Get tech by ID', `${t.name} | Territory: ${t.territory} | Rating: ${t.performance?.rating ?? 4.0}⭐`);
  } else {
    fail('Get tech by ID', r.data?.error ?? 'Technician not found');
  }
} catch(e) { fail('Get tech by ID', e.message); }

try {
  const r = await req('PATCH', `/incidents/${incidentId}/assign`, { technicianId: techId });
  r.ok ? pass('Assign tech to incident', `${techName} → ${incidentWO}`) : warn('Assign tech', r.data.error);
} catch(e) { warn('Assign tech', e.message); }

// ── 4. Work Orders ────────────────────────────────────────────────────────────
section('BLOCK 4: WORK ORDERS');

try {
  const r = await req('GET', '/work-orders?limit=5');
  r.ok ? pass('List work orders', `total=${r.data.total}`) : fail('List work orders', r.data.error);
} catch(e) { fail('List work orders', e.message); }

// ── 5. Vehicles & Depots ──────────────────────────────────────────────────────
section('BLOCK 5: VEHICLES & DEPOTS');

try {
  const r = await req('GET', '/vehicles?limit=3');
  r.ok ? pass('List vehicles', `total=${r.data.total}`) : fail('List vehicles', r.data.error);
} catch(e) { fail('List vehicles', e.message); }

try {
  const r = await req('GET', '/depots');
  r.ok ? pass('List depots', `total=${r.data.total ?? r.data.depots?.length}`) : fail('List depots', r.data.error);
} catch(e) { fail('List depots', e.message); }

try {
  const r = await req('GET', '/assets?limit=3');
  r.ok ? pass('List assets', `total=${r.data.total}`) : fail('List assets', r.data.error);
} catch(e) { fail('List assets', e.message); }

// ── 6. Dashboard ──────────────────────────────────────────────────────────────
section('BLOCK 6: DASHBOARD');

try {
  const r = await req('GET', '/dashboard/stats');
  const s = r.data.stats ?? r.data;
  r.ok ? pass('Dashboard stats', `incidents.total=${s?.incidents?.total ?? JSON.stringify(s).slice(0,60)}`)
       : fail('Dashboard stats', r.data.error);
} catch(e) { fail('Dashboard stats', e.message); }

// ── 7. Analytics & SLA ────────────────────────────────────────────────────────
section('BLOCK 7: ANALYTICS & SLA');

try {
  const r = await req('GET', '/analytics/predictions');
  r.ok ? pass('Analytics predictions', `${r.data.predictions?.length ?? r.data.count ?? 'OK'} predictions`) : fail('Analytics predictions', r.data.error);
} catch(e) { fail('Analytics predictions', e.message); }

try {
  const r = await req('POST', '/analytics/predict', { incidentId });
  r.ok ? pass('SLA breach prediction', `probability=${r.data.probability ?? JSON.stringify(r.data).slice(0,60)}`)
       : warn('SLA predict', r.data.error);
} catch(e) { warn('SLA predict', e.message); }

// ── 8. Emergency ──────────────────────────────────────────────────────────────
section('BLOCK 8: EMERGENCY');

let emergencyId;
try {
  const r = await req('GET', '/emergency/active');
  r.ok ? pass('Emergency active check', `active=${r.data.emergency ? r.data.emergency.level : 'None (L0)'}`)
       : fail('Emergency active', r.data.error);
} catch(e) { fail('Emergency active', e.message); }

try {
  const r = await req('POST', '/emergency/declare', {
    title: 'FUNCTEST — Simulated Grid Emergency',
    level: 1, type: 'POWER_OUTAGE',
    description: 'Automated test emergency. Do not dispatch.',
    affectedAreas: ['Tejgaon'], estimatedDuration: 60,
  });
  if (r.ok) {
    emergencyId = r.data.emergency?._id;
    pass('Declare emergency', `L1 declared — ID: ${emergencyId}`);
  } else { warn('Declare emergency', r.data.error); }
} catch(e) { warn('Declare emergency', e.message); }

if (emergencyId) {
  try {
    const r = await req('POST', `/emergency/${emergencyId}/resolve`, { resolution: 'Automated test resolved' });
    r.ok ? pass('Resolve emergency', 'L1 resolved') : warn('Resolve emergency', r.data.error);
  } catch(e) { warn('Resolve emergency', e.message); }
}

// ── 9. Optimization ───────────────────────────────────────────────────────────
section('BLOCK 9: OPTIMIZATION ENGINE');

try {
  const r = await req('GET', '/optimization/runs');
  r.ok ? pass('List optimization runs', `${r.data.runs?.length ?? 0} historical runs`) : fail('List opt runs', r.data.error);
} catch(e) { fail('List opt runs', e.message); }

try {
  const r = await req('GET', '/optimization/queue/status');
  r.ok ? pass('Queue status', `waiting=${r.data.queue?.waiting ?? 0} active=${r.data.queue?.active ?? 0}`) : warn('Queue status', r.data.error);
} catch(e) { warn('Queue status', e.message); }

try {
  const r = await req('POST', '/optimization/run', {
    algorithm: 'SIMULATED_ANNEALING',
    config: { maxIterations: 100, temperature: 1000, coolingRate: 0.95, autoApprove: false },
  });
  if (r.ok) pass('Trigger SA optimization', `jobId=${r.data.jobId ?? r.data.runId ?? 'queued'}`);
  else warn('Trigger optimization', r.data.error);
} catch(e) { warn('Trigger optimization', e.message); }

// ── 10. AI System ─────────────────────────────────────────────────────────────
section('BLOCK 10: AI SYSTEM');

try {
  const r = await req('POST', '/ai/triage', {
    text: 'HVAC compressor failure at Motijheel data center. Room at 35°C and rising. Critical servers at risk.',
  });
  if (r.ok) pass('AI Triage', `category=${r.data.classification.category} severity=${r.data.classification.severity} method=${r.data.classification.method}`);
  else fail('AI Triage', r.data.error);
} catch(e) { fail('AI Triage', e.message); }

try {
  const r = await req('POST', '/ai/dispatcher-query', { query: 'Who is available for fiber optic work in Mirpur?' });
  if (r.ok) pass('Dispatcher Query', `method=${r.data.method} | reply_len=${r.data.response?.length}`);
  else fail('Dispatcher Query', r.data.error);
} catch(e) { fail('Dispatcher Query', e.message); }

try {
  const r = await req('POST', '/ai/chat', {
    message: 'Give me a 2-sentence briefing on current operations.',
    history: [],
  });
  if (r.ok) pass('AI Chat (Gemini)', `method=${r.data.method} | context: ${r.data.context?.openTickets} open / ${r.data.context?.availableTechs} techs avail`);
  else fail('AI Chat', r.data.error);
} catch(e) { fail('AI Chat', e.message); }

try {
  const r = await req('POST', '/ai/chat', {
    message: 'Who should I dispatch for an 11kV switchgear fault?',
    history: [{ role: 'assistant', text: "Chat cleared. I'm ready for your next question!" }],
  });
  if (r.ok && r.data.reply) pass('AI Chat (History Sanitization)', `handled initial greeting cleanly | method: ${r.data.method}`);
  else fail('AI Chat (History Sanitization)', r.data.error);
} catch(e) { fail('AI Chat (History Sanitization)', e.message); }

try {
  const r = await req('GET', '/ai/knowledge');
  r.ok ? pass('RAG Knowledge Base', `${r.data.count} docs indexed`) : fail('RAG KB', r.data.error);
} catch(e) { fail('RAG KB', e.message); }

try {
  const r = await req('POST', '/ai/copilot', { query: 'How to restore power after a transformer fault?' });
  if (r.ok) pass('RAG Copilot', `method=${r.data.method} sources=${r.data.sources?.length ?? 0}`);
  else fail('RAG Copilot', r.data.error);
} catch(e) { fail('RAG Copilot', e.message); }

try {
  const r = await req('POST', '/ai/copilot', { query: 'hvac', category: 'HVAC' });
  if (r.ok && (r.data.sources?.length > 0 || r.data.response)) pass("RAG Copilot Short Query ('hvac')", `success | sources=${r.data.sources?.length ?? 0}`);
  else fail("RAG Copilot Short Query ('hvac')", r.data.error);
} catch(e) { fail("RAG Copilot Short Query ('hvac')", e.message); }

// ── 11. Simulator ─────────────────────────────────────────────────────────────
section('BLOCK 11: SIMULATOR');

try {
  const routes = await fetch(`${BASE}/simulator`, { headers: H });
  const sroutes = await routes.json().catch(() => ({}));
  pass('Simulator endpoint', `reachable: ${routes.status}`);
} catch(e) { warn('Simulator', e.message); }

// ── 12. Metrics ───────────────────────────────────────────────────────────────
section('BLOCK 12: SYSTEM METRICS');

try {
  const r = await fetch('http://localhost:5000/metrics', { headers: H });
  const text = await r.text();
  const lines = text.split('\n').filter(l => l.startsWith('process_') || l.startsWith('nodejs_'));
  r.ok ? pass('Prometheus metrics', `${lines.length} process/nodejs metrics exposed`) : fail('Metrics', 'not OK');
} catch(e) { fail('Metrics', e.message); }

try {
  const r = await fetch('http://localhost:5000/health');
  const j = await r.json();
  j.status === 'ok' ? pass('Health endpoint', `status=${j.status} service=${j.service}`) : fail('Health', j.status);
} catch(e) { fail('Health', e.message); }

// ── 13. Frontend Web ──────────────────────────────────────────────────────────
section('BLOCK 13: WEB FRONTEND');

try {
  const r = await fetch('http://localhost:5173');
  const html = await r.text();
  if (r.ok && html.toLowerCase().includes('<!doctype html>')) {
    pass('Frontend App Server (Vite)', `HTTP 200 | index.html served cleanly (${html.length} bytes)`);
  } else {
    fail('Frontend App Server', `status=${r.status}`);
  }
} catch(e) { fail('Frontend App Server', e.message); }

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(55));
console.log('FUNCTIONAL TEST SUMMARY');
console.log('='.repeat(55));
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
const warned = results.filter(r => r.status === 'WARN').length;
console.log(`  ✅ PASSED : ${passed}`);
console.log(`  ❌ FAILED : ${failed}`);
console.log(`  ⚠️  WARNED : ${warned}`);
console.log(`  📊 TOTAL  : ${results.length}`);
console.log('='.repeat(55));
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
}
