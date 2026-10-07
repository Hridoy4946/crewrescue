import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Search, RefreshCw, UserCheck,
  X, ChevronRight, Clock, Zap, Filter, Plus,
  CheckCircle2, AlertCircle, Circle, Phone, MapPin,
  Shield, User, ArrowRight, MessageSquare, ExternalLink,
  ChevronDown
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow, isPast } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEV_CONFIG = {
  CRITICAL: { color: 'var(--critical)', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.3)', label: 'CRITICAL' },
  HIGH:     { color: 'var(--warning)',  bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', label: 'HIGH' },
  MEDIUM:   { color: 'var(--info)',     bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.25)', label: 'MEDIUM' },
  LOW:      { color: '#9CA3AF',         bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.2)', label: 'LOW' },
};

const STATUS_CONFIG = {
  CREATED:            { label: 'Created',       color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
  TRIAGED:            { label: 'Triaged',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  PENDING_ASSIGNMENT: { label: 'Pending',       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  ASSIGNED:           { label: 'Assigned',      color: 'var(--brand-400)', bg: 'rgba(59,130,246,0.12)' },
  EN_ROUTE:           { label: 'En Route',      color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  ARRIVED:            { label: 'Arrived',       color: '#A855F7', bg: 'rgba(168,85,247,0.15)' },
  IN_PROGRESS:        { label: 'In Progress',   color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  RESOLVED:           { label: 'Resolved',      color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  CLOSED:             { label: 'Closed',        color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

function formatSLATime(deadline, breached) {
  if (!deadline) return { text: '—', color: 'var(--text-muted)', isBreached: false };
  const d = new Date(deadline);
  const now = Date.now();
  const diffMs = d.getTime() - now;

  if (diffMs < 0 || breached) {
    const overdueMins = Math.abs(Math.round(diffMs / 60000));
    if (overdueMins < 60) {
      return { text: `Breached (-${overdueMins}m)`, color: 'var(--critical)', isBreached: true };
    }
    const overdueHours = Math.round(overdueMins / 60);
    if (overdueHours < 24) {
      return { text: `Breached (-${overdueHours}h)`, color: 'var(--critical)', isBreached: true };
    }
    const overdueDays = Math.round(overdueHours / 24);
    return { text: `Breached (-${overdueDays}d)`, color: 'var(--critical)', isBreached: true };
  }

  const minsLeft = Math.round(diffMs / 60000);
  if (minsLeft < 60) {
    return { text: `${minsLeft}m remaining`, color: 'var(--critical)', isBreached: false };
  }
  const hoursLeft = Math.round(minsLeft / 60);
  if (hoursLeft < 4) {
    return { text: `${hoursLeft}h remaining`, color: 'var(--warning)', isBreached: false };
  }
  if (hoursLeft < 24) {
    return { text: `${hoursLeft}h remaining`, color: 'var(--brand-400)', isBreached: false };
  }
  const daysLeft = Math.round(hoursLeft / 24);
  return { text: `${daysLeft}d remaining`, color: 'var(--success)', isBreached: false };
}

function SLABadge({ deadline, breached }) {
  const info = formatSLATime(deadline, breached);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {info.isBreached && <AlertCircle size={12} style={{ color: 'var(--critical)', flexShrink: 0 }} />}
      <span style={{
        color: info.color,
        fontSize: '0.72rem',
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {info.text}
      </span>
    </div>
  );
}

// ── Assign Modal ──────────────────────────────────────────────────────────────
function AssignModal({ incident, onClose, onAssigned }) {
  const [technicians, setTechnicians] = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [assigning, setAssigning]     = useState(null);

  useEffect(() => {
    // Fetch all active technicians
    api.get('/technicians?limit=100')
      .then(r => setTechnicians(r.data.technicians ?? []))
      .catch(() => toast.error('Could not load technicians'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const required = incident.requiredSkills ?? [];
  const filtered = technicians.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    (t.employeeId ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.territory ?? '').toLowerCase().includes(search.toLowerCase()) ||
    t.skills?.some(s => s.skillId?.toLowerCase().includes(search.toLowerCase()))
  );

  function skillMatch(tech) {
    if (!required.length) return true;
    const ids = tech.skills?.map(s => s.skillId) ?? [];
    return required.some(r => ids.includes(r));
  }

  async function assign(tech) {
    if (assigning) return;
    setAssigning(tech._id);
    try {
      await api.patch(`/incidents/${incident._id}/assign`, { technicianId: tech._id });
      const empId = tech.employeeId || 'ID-' + tech._id.slice(-4).toUpperCase();
      toast.success(`Assigned to ${tech.name} (${empId})`);
      onAssigned();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Assignment failed');
      setAssigning(null);
    }
  }

  const matchedTechs = filtered.filter(t => skillMatch(t));
  const otherTechs   = filtered.filter(t => !skillMatch(t));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: 620,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} style={{ color: 'var(--brand-400)' }} />
                Assign Field Worker
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                Ticket: <span style={{ fontFamily: 'monospace', color: 'var(--brand-400)', fontWeight: 700 }}>{incident.workOrderNumber}</span>
                {' · '}<span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{incident.title}</span>
              </div>
              {required.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target Skills:</span>
                  {required.map(s => (
                    <span key={s} style={{
                      fontSize: '0.65rem', padding: '1px 7px', borderRadius: 10,
                      background: 'rgba(59,130,246,0.15)', color: 'var(--brand-400)',
                      border: '1px solid rgba(59,130,246,0.25)', fontWeight: 700,
                    }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-icon btn-ghost" onClick={onClose} style={{ flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginTop: 14 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              placeholder="Search by worker name, Employee ID (e.g. EMP-1022), district or skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, height: 38, fontSize: '0.82rem' }}
              autoFocus
            />
          </div>
        </div>

        {/* Counter strip */}
        <div style={{
          padding: '8px 24px', background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)',
        }}>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>
            ✓ {matchedTechs.length} skill-matched
          </span>
          <span>·</span>
          <span>{filtered.length} total workers</span>
          {loading && <div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 1.5, marginLeft: 'auto' }} />}
        </div>

        {/* Worker list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 68, marginBottom: 8, borderRadius: 12 }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 44, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <UserCheck size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />
              No technicians match the query
            </div>
          ) : (
            <>
              {matchedTechs.length > 0 && (
                <>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--success)', padding: '6px 4px', marginBottom: 2 }}>
                    ✓ Recommended Skill Matches ({matchedTechs.length})
                  </div>
                  {matchedTechs.map(tech => (
                    <WorkerAssignRow
                      key={tech._id}
                      tech={tech}
                      required={required}
                      assigning={assigning}
                      onAssign={assign}
                      isMatch
                    />
                  ))}
                </>
              )}
              {otherTechs.length > 0 && (
                <>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '10px 4px 4px', marginBottom: 2 }}>
                    All Fleet Technicians ({otherTechs.length})
                  </div>
                  {otherTechs.map(tech => (
                    <WorkerAssignRow
                      key={tech._id}
                      tech={tech}
                      required={required}
                      assigning={assigning}
                      onAssign={assign}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkerAssignRow({ tech, required, assigning, onAssign, isMatch }) {
  const isAssigning = assigning === tech._id;
  const empId = tech.employeeId || 'EMP-' + tech._id.toString().slice(-4).toUpperCase();
  const isAvailable = tech.status === 'AVAILABLE';

  return (
    <div
      onClick={() => !assigning && onAssign(tech)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
        borderRadius: 12, marginBottom: 6, cursor: assigning ? 'not-allowed' : 'pointer',
        border: `1px solid ${isMatch ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'}`,
        background: isMatch ? 'rgba(16,185,129,0.04)' : 'var(--bg-elevated)',
        opacity: assigning && !isAssigning ? 0.45 : 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { if (!assigning) e.currentTarget.style.borderColor = 'var(--brand-500)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isMatch ? 'rgba(16,185,129,0.25)' : 'var(--border-subtle)'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--brand-600), #7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', fontWeight: 800, color: '#fff',
        boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
      }}>
        {tech.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{tech.name}</span>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 6,
            background: 'rgba(59,130,246,0.12)', color: 'var(--brand-400)',
            border: '1px solid rgba(59,130,246,0.2)', fontFamily: 'monospace',
          }}>
            {empId}
          </span>
          <span style={{
            fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8,
            background: isAvailable ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: isAvailable ? 'var(--success)' : 'var(--warning)',
          }}>
            {tech.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {tech.territory && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📍 {tech.territory}</span>
          )}
          {tech.phone && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>📞 {tech.phone}</span>
          )}
          {tech.performance?.rating && (
            <span style={{ fontSize: '0.68rem', color: '#FBBF24', fontWeight: 600 }}>★ {tech.performance.rating}</span>
          )}
        </div>

        {tech.skills?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {tech.skills.slice(0, 4).map(s => {
              const matched = required.includes(s.skillId);
              return (
                <span key={s.skillId} style={{
                  fontSize: '0.6rem', padding: '1px 6px', borderRadius: 6,
                  background: matched ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                  color: matched ? 'var(--success)' : 'var(--text-muted)',
                  border: matched ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border-subtle)',
                  fontWeight: matched ? 700 : 400,
                }}>
                  {s.skillId}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0 }}>
        {isAssigning ? (
          <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
        ) : (
          <button
            className="btn btn-sm btn-primary"
            style={{ fontSize: '0.72rem', height: 32, paddingInline: 12, borderRadius: 8 }}
          >
            Assign
          </button>
        )}
      </div>
    </div>
  );
}

// ── Incident Details Drawer ───────────────────────────────────────────────────
function IncidentDrawer({ incident, onClose, onAssignClick, onStatusChange }) {
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes]       = useState(incident?.notes ?? []);
  const [newNote, setNewNote]   = useState('');
  const [addingNote, setAddingNote] = useState(false);

  if (!incident) return null;

  const sevCfg = SEV_CONFIG[incident.severity] ?? SEV_CONFIG.LOW;
  const statusCfg = STATUS_CONFIG[incident.status] ?? STATUS_CONFIG.CREATED;
  const assigned = incident.assignedTechnicianId;
  const empId = assigned?.employeeId || (assigned?._id ? 'EMP-' + assigned._id.slice(-4).toUpperCase() : null);

  const workflowSteps = ['CREATED', 'TRIAGED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const currentStepIdx = workflowSteps.indexOf(incident.status);

  async function handleStatus(nextStatus) {
    setUpdating(true);
    try {
      await api.patch(`/incidents/${incident._id}/status`, { status: nextStatus, reason: 'Dispatcher update' });
      toast.success(`Status updated to ${nextStatus}`);
      onStatusChange();
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await api.post(`/incidents/${incident._id}/notes`, { text: newNote.trim() });
      setNotes(res.data.notes ?? []);
      setNewNote('');
      toast.success('Note logged');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 8500,
        display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(5px)',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540, height: '100%', background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.8)', animation: 'slideInRight 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--brand-400)', fontSize: '0.95rem' }}>
                {incident.workOrderNumber}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12,
                background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.border}`,
              }}>
                {incident.severity}
              </span>
              {incident.isEmergency && <span title="Emergency ticket">🚨 EMERGENCY</span>}
            </div>
            <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={16} /></button>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.3, marginBottom: 8, color: 'var(--text-primary)' }}>
            {incident.title}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>📍 {incident.location?.area || 'Metro Dhaka'}</span>
            <span>⏱ Created {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Workflow Stepper */}
          <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Incident Lifecycle Progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
              {['ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'RESOLVED'].map((st, i) => {
                const isPassed = workflowSteps.indexOf(incident.status) >= workflowSteps.indexOf(st);
                const isCurrent = incident.status === st;
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                    <div style={{
                      height: 6, flex: 1, borderRadius: 4,
                      background: isPassed ? 'var(--brand-500)' : 'rgba(255,255,255,0.08)',
                      boxShadow: isCurrent ? '0 0 8px var(--brand-500)' : 'none',
                    }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              <span>Assigned</span>
              <span>En Route</span>
              <span>In Progress</span>
              <span>Resolved</span>
            </div>
          </div>

          {/* SLA & Financial Exposure */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '14px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>SLA Resolution Deadline</div>
              <SLABadge deadline={incident.sla?.resolutionDeadline} breached={incident.sla?.resolutionBreached} />
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: '14px', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Financial SLA Exposure</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--warning)', fontFamily: 'JetBrains Mono, monospace' }}>
                ${(incident.sla?.financialExposure ?? 2500).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Assigned Technician Profile */}
          <div style={{ background: 'var(--bg-elevated)', padding: '18px', borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                Assigned Field Technician
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => { onClose(); onAssignClick(incident); }}
                style={{ fontSize: '0.7rem', color: 'var(--brand-400)' }}
              >
                {assigned ? 'Re-assign' : '+ Assign Worker'}
              </button>
            </div>

            {assigned ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--brand-600), #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.9rem', fontWeight: 800, color: '#fff',
                }}>
                  {assigned.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{assigned.name}</span>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                      background: 'rgba(59,130,246,0.15)', color: 'var(--brand-400)',
                      border: '1px solid rgba(59,130,246,0.25)', fontFamily: 'monospace',
                    }}>
                      {empId}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 10, marginBottom: 6 }}>
                    <span>Status: <strong style={{ color: 'var(--success)' }}>{assigned.status || 'ASSIGNED'}</strong></span>
                    {assigned.phone && <span>📞 {assigned.phone}</span>}
                  </div>
                  {assigned.skills?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {assigned.skills.slice(0, 4).map(s => (
                        <span key={typeof s === 'string' ? s : s.skillId} style={{
                          fontSize: '0.62rem', padding: '1px 6px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {typeof s === 'string' ? s : s.skillId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(245,158,11,0.06)', borderRadius: 10, border: '1px dashed rgba(245,158,11,0.3)' }}>
                <AlertTriangle size={24} style={{ color: 'var(--warning)', margin: '0 auto 6px' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--warning)', marginBottom: 4 }}>No Worker Assigned</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12 }}>This incident is currently unassigned and at risk of SLA breach.</div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => { onClose(); onAssignClick(incident); }}
                >
                  <UserCheck size={13} /> Select Qualified Worker
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Incident Description
            </div>
            <div style={{
              padding: '14px', background: 'var(--bg-elevated)', borderRadius: 12,
              border: '1px solid var(--border-subtle)', fontSize: '0.82rem', lineHeight: 1.6,
              color: 'var(--text-secondary)',
            }}>
              {incident.description || 'No detailed description logged by reporting user.'}
            </div>
          </div>

          {/* Quick Lifecycle Action Buttons */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Advance Status
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {incident.status !== 'EN_ROUTE' && (
                <button className="btn btn-sm btn-ghost" disabled={updating} onClick={() => handleStatus('EN_ROUTE')}>
                  Mark En Route
                </button>
              )}
              {incident.status !== 'ARRIVED' && (
                <button className="btn btn-sm btn-ghost" disabled={updating} onClick={() => handleStatus('ARRIVED')}>
                  Mark Arrived
                </button>
              )}
              {incident.status !== 'IN_PROGRESS' && (
                <button className="btn btn-sm btn-ghost" disabled={updating} onClick={() => handleStatus('IN_PROGRESS')}>
                  Mark In Progress
                </button>
              )}
              {incident.status !== 'RESOLVED' && (
                <button className="btn btn-sm btn-success" disabled={updating} onClick={() => handleStatus('RESOLVED')}>
                  <CheckCircle2 size={13} /> Resolve Incident
                </button>
              )}
            </div>
          </div>

          {/* Notes Log */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Operational Activity Notes ({notes.length})
            </div>
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                className="form-input"
                placeholder="Add dispatcher note or field update…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                style={{ height: 36, fontSize: '0.78rem' }}
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={addingNote || !newNote.trim()}>
                Post
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notes.length === 0 ? (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes logged yet.</div>
              ) : (
                notes.map((n, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.65rem', marginBottom: 2 }}>
                      <strong>{n.author?.name || 'Dispatcher'}</strong>
                      <span>{n.at ? formatDistanceToNow(new Date(n.at), { addSuffix: true }) : 'recent'}</span>
                    </div>
                    <div>{n.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main IncidentsPage ────────────────────────────────────────────────────────
export default function IncidentsPage() {
  const [incidents, setIncidents]               = useState([]);
  const [total, setTotal]                       = useState(0);
  const [loading, setLoading]                   = useState(true);
  const [page, setPage]                         = useState(1);
  const [search, setSearch]                     = useState('');
  const [filterSev, setFilterSev]               = useState('');
  const [filterStatus, setFilterStatus]         = useState('');
  const [filterUnassigned, setFilterUnassigned] = useState(false);
  const [filterEmergency, setFilterEmergency]   = useState(false);
  const [assignTarget, setAssignTarget]         = useState(null);
  const [drawerIncident, setDrawerIncident]     = useState(null);
  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterSev)        params.set('severity', filterSev);
      if (filterStatus)     params.set('status', filterStatus);
      if (filterUnassigned) params.set('unassigned', 'true');
      if (filterEmergency)  params.set('emergency', 'true');
      const { data } = await api.get(`/incidents?${params}`);
      setIncidents(data.incidents ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load incidents'); }
    finally { setLoading(false); }
  }, [page, filterSev, filterStatus, filterUnassigned, filterEmergency]);

  useEffect(() => { load(); }, [load]);

  const displayed = search.trim()
    ? incidents.filter(i =>
        i.workOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        i.title?.toLowerCase().includes(search.toLowerCase()) ||
        i.location?.area?.toLowerCase().includes(search.toLowerCase()) ||
        i.assignedTechnicianId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        i.assignedTechnicianId?.employeeId?.toLowerCase().includes(search.toLowerCase())
      )
    : incidents;

  const pages = Math.ceil(total / LIMIT);

  function resetFilters() {
    setFilterSev(''); setFilterStatus(''); setFilterUnassigned(false); setFilterEmergency(false); setPage(1);
  }

  const hasFilters = filterSev || filterStatus || filterUnassigned || filterEmergency;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL').length;
  const unassignedCount = incidents.filter(i => !i.assignedTechnicianId).length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.02em' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #EF4444, #F97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }}>
              <AlertTriangle size={18} style={{ color: '#fff' }} />
            </div>
            Incident Management & Dispatch
          </h2>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{total.toLocaleString()} total incidents</span>
            {criticalCount > 0 && <span style={{ color: 'var(--critical)', fontWeight: 700 }}>⚡ {criticalCount} critical</span>}
            {unassignedCount > 0 && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>⚠ {unassignedCount} unassigned</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && (criticalCount > 0 || unassignedCount > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {criticalCount > 0 && (
            <div style={{
              padding: '10px 16px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.22)', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
            }}>
              <AlertTriangle size={15} style={{ color: 'var(--critical)' }} />
              <span style={{ color: 'var(--critical)', fontWeight: 800 }}>{criticalCount} Critical Priority Incidents</span>
              <span style={{ color: 'var(--text-muted)' }}>— Immediate dispatch required</span>
            </div>
          )}
          {unassignedCount > 0 && (
            <div style={{
              padding: '10px 16px', background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.22)', borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
            }}>
              <UserCheck size={15} style={{ color: 'var(--warning)' }} />
              <span style={{ color: 'var(--warning)', fontWeight: 800 }}>{unassignedCount} Pending Worker Assignment</span>
              <button
                className="btn btn-sm"
                style={{ padding: '2px 10px', height: 24, fontSize: '0.68rem', background: 'rgba(245,158,11,0.18)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, fontWeight: 700 }}
                onClick={() => { setFilterUnassigned(true); setPage(1); }}
              >
                Filter Unassigned
              </button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            placeholder="Search WO #, title, area, worker name, or Employee ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, height: 36, fontSize: '0.8rem' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>

        <select
          className="form-select"
          value={filterSev}
          onChange={e => { setFilterSev(e.target.value); setPage(1); }}
          style={{ height: 36, fontSize: '0.8rem', width: 140 }}
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">⚡ Critical</option>
          <option value="HIGH">⚠ High</option>
          <option value="MEDIUM">📋 Medium</option>
          <option value="LOW">ℹ Low</option>
        </select>

        <select
          className="form-select"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          style={{ height: 36, fontSize: '0.8rem', width: 170 }}
        >
          <option value="">All Statuses</option>
          <option value="CREATED">Created</option>
          <option value="TRIAGED">Triaged</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="EN_ROUTE">En Route</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <button
          className={`btn btn-sm ${filterUnassigned ? 'btn-warning' : 'btn-ghost'}`}
          onClick={() => { setFilterUnassigned(v => !v); setPage(1); }}
        >
          <UserCheck size={13} /> Unassigned Only
        </button>

        <button
          className={`btn btn-sm ${filterEmergency ? 'btn-danger' : 'btn-ghost'}`}
          onClick={() => { setFilterEmergency(v => !v); setPage(1); }}
        >
          🚨 Emergency Only
        </button>

        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={resetFilters} style={{ color: 'var(--text-muted)' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Incidents Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>WO #</th>
              <th>Incident Title</th>
              <th style={{ width: 105 }}>Severity</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 230 }}>Assigned Field Worker</th>
              <th style={{ width: 150 }}>SLA Deadline</th>
              <th style={{ width: 130 }}>District Area</th>
              <th style={{ width: 90, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 18, width: j === 1 ? 180 : 80 }} /></td>
                  ))}
                </tr>
              ))
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
                  <AlertTriangle size={36} style={{ opacity: 0.15, display: 'block', margin: '0 auto 12px' }} />
                  No incidents match the selected filters
                </td>
              </tr>
            ) : displayed.map(inc => {
              const sevCfg = SEV_CONFIG[inc.severity] ?? SEV_CONFIG.LOW;
              const statusCfg = STATUS_CONFIG[inc.status] ?? STATUS_CONFIG.CREATED;
              const tech = inc.assignedTechnicianId;
              const techName = tech?.name;
              const techEmpId = tech?.employeeId || (tech?._id ? 'EMP-' + tech._id.slice(-4).toUpperCase() : null);
              const isAssigned = !!tech;

              return (
                <tr
                  key={inc._id}
                  onClick={() => setDrawerIncident(inc)}
                  style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                >
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--brand-400)', fontWeight: 700 }}>
                      {inc.workOrderNumber}
                    </span>
                    {inc.isEmergency && <span style={{ marginLeft: 5 }} title="Emergency Ticket">🚨</span>}
                  </td>

                  <td style={{ maxWidth: 280 }}>
                    <div className="truncate" style={{ fontWeight: 600, fontSize: '0.84rem' }} title={inc.title}>
                      {inc.title}
                    </div>
                    {inc.category && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {inc.category.replace(/_/g, ' ')}
                      </div>
                    )}
                  </td>

                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      padding: '3px 9px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 800,
                      background: sevCfg.bg, color: sevCfg.color, border: `1px solid ${sevCfg.border}`,
                      letterSpacing: '0.04em',
                    }}>
                      {inc.severity}
                    </span>
                  </td>

                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 8px', borderRadius: 8,
                      fontSize: '0.72rem', fontWeight: 700,
                      background: statusCfg.bg, color: statusCfg.color,
                    }}>
                      {inc.status === 'IN_PROGRESS' && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'blink 1s ease-in-out infinite', flexShrink: 0 }} />
                      )}
                      {statusCfg.label}
                    </span>
                  </td>

                  <td onClick={e => e.stopPropagation()}>
                    {isAssigned ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--brand-500), #7C3AED)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 800, color: '#fff',
                        }}>
                          {(techName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {techName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: '0.65rem', color: 'var(--brand-400)', fontFamily: 'monospace',
                              fontWeight: 700, background: 'rgba(59,130,246,0.1)', padding: '0 4px', borderRadius: 4,
                            }}>
                              {techEmpId}
                            </span>
                            <button
                              onClick={() => setAssignTarget(inc)}
                              style={{
                                background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.62rem',
                                cursor: 'pointer', padding: 0, textDecoration: 'underline',
                              }}
                            >
                              re-assign
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.7rem', height: 28, paddingInline: 12,
                          background: 'rgba(245,158,11,0.12)',
                          color: 'var(--warning)',
                          border: '1px solid rgba(245,158,11,0.3)',
                          borderRadius: 8,
                          fontWeight: 700,
                        }}
                        onClick={() => setAssignTarget(inc)}
                      >
                        <UserCheck size={12} /> + Assign Worker
                      </button>
                    )}
                  </td>

                  <td>
                    <SLABadge deadline={inc.sla?.resolutionDeadline} breached={inc.sla?.resolutionBreached} />
                  </td>

                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      📍 {inc.location?.area || 'Metro Dhaka'}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      className="btn btn-icon btn-ghost btn-sm"
                      onClick={() => setDrawerIncident(inc)}
                      title="View Details"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0 8px' }}>
            Page {page} of {pages}
          </span>
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
          onAssigned={() => { load(); if (drawerIncident?._id === assignTarget._id) setDrawerIncident(null); }}
        />
      )}

      {/* Incident Detail Drawer */}
      {drawerIncident && (
        <IncidentDrawer
          incident={drawerIncident}
          onClose={() => setDrawerIncident(null)}
          onAssignClick={inc => setAssignTarget(inc)}
          onStatusChange={() => { load(); setDrawerIncident(null); }}
        />
      )}
    </div>
  );
}
