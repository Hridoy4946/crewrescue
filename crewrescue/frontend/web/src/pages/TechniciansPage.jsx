import { useState, useEffect, useCallback } from 'react';
import { Users, Search, RefreshCw, MapPin, Star, Briefcase, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const STATUS_COLORS = {
  AVAILABLE: 'var(--success)',
  BUSY: 'var(--warning)',
  EN_ROUTE: 'var(--brand-400)',
  ON_SITE: 'var(--purple)',
  UNAVAILABLE: 'var(--critical)',
  OFFLINE: 'var(--text-disabled)',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available', BUSY: 'Busy', EN_ROUTE: 'En Route',
  ON_SITE: 'On Site', UNAVAILABLE: 'Unavailable', OFFLINE: 'Offline',
};

function SkillBadge({ skill }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 20,
      fontSize: '0.62rem', fontWeight: 600,
      background: 'rgba(59,130,246,0.1)',
      color: 'var(--brand-400)',
      border: '1px solid rgba(59,130,246,0.15)',
    }}>
      {skill.certified && <span>✓</span>}
      {skill.skillId}
      {skill.level !== 'MID' && <span style={{ opacity: 0.6 }}>·{skill.level[0]}</span>}
    </span>
  );
}

function TechnicianCard({ tech }) {
  const color = STATUS_COLORS[tech.status] ?? 'var(--text-muted)';
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${color}33, ${color}11)`,
            border: `2px solid ${color}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 800, color,
          }}>
            {tech.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{tech.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{tech.employeeId}</span>
              <span style={{ color: 'var(--border-default)' }}>·</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0,
                  boxShadow: tech.status === 'AVAILABLE' ? `0 0 6px ${color}` : 'none',
                }} />
                <span style={{ fontSize: '0.72rem', color, fontWeight: 600 }}>
                  {STATUS_LABELS[tech.status] ?? tech.status}
                </span>
              </div>
            </div>
          </div>
          {tech.performance?.rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--warning)' }}>
              <Star size={12} fill="currentColor" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{tech.performance.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Skills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {tech.skills?.slice(0, 5).map(s => <SkillBadge key={s.skillId} skill={s} />)}
          {tech.skills?.length > 5 && (
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', padding: '2px 4px' }}>
              +{tech.skills.length - 5} more
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          {tech.territory && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {tech.territory}
            </span>
          )}
          {tech.performance?.jobsCompleted != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Briefcase size={11} /> {tech.performance.jobsCompleted} jobs
            </span>
          )}
          {tech.performance?.firstTimeFixRate != null && (
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              {Math.round(tech.performance.firstTimeFixRate * 100)}% FTF
            </span>
          )}
          {tech.lastLocationUpdate && (
            <span>📍 {formatDistanceToNow(new Date(tech.lastLocationUpdate))} ago</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSkill, setFilterSkill]   = useState('');
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (filterStatus) params.set('status', filterStatus);
      if (filterSkill)  params.set('skill', filterSkill);
      const { data } = await api.get(`/technicians?${params}`);
      setTechnicians(data.technicians ?? []);
      setTotal(data.total ?? 0);
    } catch { toast.error('Failed to load technicians'); }
    finally { setLoading(false); }
  }, [page, filterStatus, filterSkill]);

  useEffect(() => { load(); }, [load]);

  const displayed = search.trim()
    ? technicians.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
        t.territory?.toLowerCase().includes(search.toLowerCase())
      )
    : technicians;

  const pages = Math.ceil(total / LIMIT);
  const hasFilters = filterStatus || filterSkill;

  // Status summary counts
  const statusCounts = technicians.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const SKILL_OPTIONS = [
    'ELECTRICAL','HVAC','FIBER_OPTIC','NETWORKING','HIGH_VOLTAGE',
    'GENERATOR','HYDRAULICS','MECHANICAL','WELDING','PLC',
    'SOLAR','TRANSFORMER','TELECOM','WATER_SYSTEMS','SAFETY_OFFICER',
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} style={{ color: 'var(--brand-400)' }} /> Technician Workforce
          </h2>
          <div className="text-xs text-muted">{total.toLocaleString()} field technicians · DhakaPower Utilities</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Status summary strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setFilterStatus(filterStatus === key ? '' : key); setPage(1); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              borderRadius: 20, cursor: 'pointer',
              background: filterStatus === key ? `${STATUS_COLORS[key]}22` : 'var(--bg-card)',
              border: `1px solid ${filterStatus === key ? STATUS_COLORS[key] : 'var(--border-subtle)'}`,
              color: filterStatus === key ? STATUS_COLORS[key] : 'var(--text-secondary)',
              fontSize: '0.75rem', fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[key] }} />
            {label}
            <span style={{ fontWeight: 700, opacity: 0.9 }}>{statusCounts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            placeholder="Name, employee ID, territory…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, height: 34, fontSize: '0.8rem' }}
          />
        </div>
        <select
          className="form-select"
          value={filterSkill}
          onChange={e => { setFilterSkill(e.target.value); setPage(1); }}
          style={{ height: 34, fontSize: '0.8rem', width: 180 }}
        >
          <option value="">All Skills</option>
          {SKILL_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {hasFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterSkill(''); setPage(1); }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div>No technicians match the current filters</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {displayed.map(tech => <TechnicianCard key={tech._id} tech={tech} />)}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && !search && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
          <span className="text-sm text-muted">Page {page} of {pages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>Next →</button>
        </div>
      )}
    </div>
  );
}
