import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, Filter, RefreshCw, UserCheck,
  Clock, ChevronRight, X, Check, Zap,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format, isPast } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEV_VARIANT = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
const STATUS_LABEL = {
  CREATED: 'Created', TRIAGED: 'Triaged', PENDING_ASSIGNMENT: 'Pending',
  ASSIGNED: 'Assigned', EN_ROUTE: 'En Route', ARRIVED: 'Arrived',
  IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

function SLACountdown({ deadline, breached }) {
  if (!deadline) return <span className="text-muted">—</span>;
  const d = new Date(deadline);
  const past = isPast(d);
  const color = past || breached ? 'var(--critical)' : new Date(d) - Date.now() < 2 * 3600000 ? 'var(--warning)' : 'var(--success)';
  return (
    <span style={{ color, fontSize: '0.78rem', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
      {past ? '⚠ ' : ''}
      {formatDistanceToNow(d, { addSuffix: true })}
    </span>
  );
}

// ── Assignment Modal ──────────────────────────────────────────────────────────
function AssignModal({ incident, onClose, onAssigned }) {
  const [technicians, setTechnicians] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    api.get('/technicians?status=AVAILABLE&limit=100')
      .then(r => setTechnicians(r.data.technicians ?? []))
      .catch(() => toast.error('Could not load technicians'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = technicians.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    t.skills?.some(s => s.skillId.toLowerCase().includes(search.toLowerCase()))
  );

  async function assign(tech) {
    setAssigning(tech._id);
    try {
      await api.patch(`/incidents/${incident._id}/assign`, { technicianId: tech._id });
      toast.success(`Assigned to ${tech.name}`);
      onAssigned();
      onClose();
    } catch { toast.error('Assignment failed'); }
    finally { setAssigning(null); }
  }

  // Check skill match
  const required = incident.requiredSkills ?? [];
  function skillMatch(tech) {
    if (!required.length) return true;
    const ids = tech.skills?.map(s => s.skillId) ?? [];
    return required.every(r => ids.includes(r));
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 560,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Assign Technician</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {incident.workOrderNumber} · {incident.title}
            </div>
            {required.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: 4 }}>Required:</span>
                {required.map(s => (
                  <span key={s} className="badge brand" style={{ fontSize: '0.62rem' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              placeholder="Search by name, ID or skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 6, borderRadius: 8 }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No available technicians match
            </div>
          ) : filtered.map(tech => {
            const match = skillMatch(tech);
            return (
              <div key={tech._id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: `1px solid ${match ? 'rgba(59,130,246,0.15)' : 'var(--border-subtle)'}`,
                background: match ? 'rgba(59,130,246,0.04)' : 'transparent',
                marginBottom: 4,
                transition: 'all 0.15s',
              }} onClick={() => assign(tech)}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--brand-500), var(--purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                }}>
                  {tech.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2 }}>{tech.name}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{tech.employeeId}</span>
                    {tech.skills?.slice(0, 3).map(s => (
                      <span key={s.skillId} className={`badge ${required.includes(s.skillId) ? 'success' : ''}`} style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                        {s.skillId}
                      </span>
                    ))}
                  </div>
                </div>
                {match && <span className="badge success" style={{ fontSize: '0.62rem', flexShrink: 0 }}>✓ Match</span>}
                {assigning === tech._id ? (
                  <div className="loading-spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  <UserCheck size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [incidents, setIncidents]     = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [filterSev, setFilterSev]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterEmergency, setFilterEmergency]   = useState(false);
  const [assignTarget, setAssignTarget]         = useState(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterSev)         params.set('severity', filterSev);
      if (filterStatus)      params.set('status', filterStatus);
      if (filterUnassigned)  params.set('unassigned', 'true');
      if (filterEmergency)   params.set('emergency', 'true');
      const { data } = await api.get(`/incidents?${params}`);
      setIncidents(data.incidents ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load incidents'); }
    finally { setLoading(false); }
  }, [page, filterSev, filterStatus, filterUnassigned, filterEmergency]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const displayed = search.trim()
    ? incidents.filter(i =>
        i.workOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        i.title?.toLowerCase().includes(search.toLowerCase()) ||
        i.location?.area?.toLowerCase().includes(search.toLowerCase())
      )
    : incidents;

  const pages = Math.ceil(total / LIMIT);

  function resetFilters() {
    setFilterSev(''); setFilterStatus(''); setFilterUnassigned(false); setFilterEmergency(false); setPage(1);
  }

  const hasFilters = filterSev || filterStatus || filterUnassigned || filterEmergency;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: 'var(--critical)' }} /> Incident Management
          </h2>
          <div className="text-xs text-muted">
            {total.toLocaleString()} total incidents · page {page} of {pages || 1}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            placeholder="Search WO #, title, area…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, height: 34, fontSize: '0.8rem' }}
          />
        </div>

        <select
          className="form-select"
          value={filterSev}
          onChange={e => { setFilterSev(e.target.value); setPage(1); }}
          style={{ height: 34, fontSize: '0.8rem', width: 140 }}
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          className="form-select"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height: 34, fontSize: '0.8rem', width: 160 }}
        >
          <option value="">All Statuses</option>
          <option value="CREATED">Created</option>
          <option value="PENDING_ASSIGNMENT">Pending</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>

        <button
          className={`btn btn-sm ${filterUnassigned ? 'btn-warning' : 'btn-ghost'}`}
          onClick={() => { setFilterUnassigned(v => !v); setPage(1); }}
        >
          Unassigned
        </button>

        <button
          className={`btn btn-sm ${filterEmergency ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => { setFilterEmergency(v => !v); setPage(1); }}
        >
          🚨 Emergency
        </button>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ color: 'var(--text-muted)' }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>WO #</th>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>SLA Deadline</th>
              <th>Area</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 16, width: j === 1 ? 160 : 80 }} /></td>
                  ))}
                </tr>
              ))
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No incidents match the current filters
                </td>
              </tr>
            ) : displayed.map(inc => (
              <tr key={inc._id} style={{ cursor: 'default' }}>
                <td>
                  <span className="mono text-xs" style={{ color: 'var(--brand-400)' }}>{inc.workOrderNumber}</span>
                  {inc.isEmergency && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>🚨</span>}
                </td>
                <td style={{ maxWidth: 260 }}>
                  <div className="truncate" style={{ fontWeight: 500, fontSize: '0.82rem' }} title={inc.title}>
                    {inc.title}
                  </div>
                </td>
                <td><span className={`badge ${SEV_VARIANT[inc.severity] ?? 'low'}`}>{inc.severity}</span></td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem',
                    color: inc.status === 'IN_PROGRESS' ? 'var(--success)' : inc.status === 'ASSIGNED' ? 'var(--brand-400)' : 'var(--text-secondary)',
                  }}>
                    {inc.status === 'IN_PROGRESS' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'blink 1s ease-in-out infinite' }} />}
                    {STATUS_LABEL[inc.status] ?? inc.status}
                  </span>
                </td>
                <td>
                  {inc.assignedTechnicianId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand-glow)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                        {inc.assignedTechnicianId.name?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? '?'}
                      </div>
                      <span style={{ fontSize: '0.78rem' }}>{inc.assignedTechnicianId.name ?? '—'}</span>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: '0.72rem', height: 26, color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)' }}
                      onClick={() => setAssignTarget(inc)}
                    >
                      <UserCheck size={11} /> Assign
                    </button>
                  )}
                </td>
                <td>
                  <SLACountdown
                    deadline={inc.sla?.resolutionDeadline}
                    breached={inc.sla?.resolutionBreached}
                  />
                </td>
                <td>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {inc.location?.area ?? '—'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-icon btn-ghost"
                    onClick={() => setAssignTarget(inc)}
                    title="Assign technician"
                    style={{ opacity: inc.assignedTechnicianId ? 0.3 : 1 }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </button>
          {Array.from({ length: Math.min(7, pages) }, (_, i) => {
            const p = page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > pages) return null;
            return (
              <button
                key={p}
                className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(p)}
                style={{ minWidth: 34 }}
              >
                {p}
              </button>
            );
          })}
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
            Next →
          </button>
        </div>
      )}

      {/* Assignment Modal */}
      {assignTarget && (
        <AssignModal
          incident={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={load}
        />
      )}
    </div>
  );
}
