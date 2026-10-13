import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, Search, MapPin, ShieldAlert, Navigation, CheckCircle2, UserRound, Radio } from 'lucide-react';
import { useAuthStore, useWorkOrderStore } from '../store/index.js';
import { STATUS_COLORS, STATUS_LABELS, formatSLARemaining } from '../lib/transitions.js';
import toast from 'react-hot-toast';

const SEVERITY_COLOR = {
  CRITICAL: '#EF4444',
  HIGH:     '#F97316',
  MEDIUM:   '#F59E0B',
  LOW:      '#64748B',
};

const FILTER_TABS = [
  { key: 'active',   label: 'Active' },
  { key: 'assigned', label: 'New' },
  { key: 'all',      label: 'All' },
];

function WOItem({ wo, onSelect }) {
  const sla = formatSLARemaining(wo.sla?.resolutionDeadline);
  const color = SEVERITY_COLOR[wo.severity] ?? '#64748B';
  const statusColor = STATUS_COLORS[wo.status] ?? '#64748B';

  return (
    <div
      id={`wo-${wo._id}`}
      className="wo-item"
      onClick={() => onSelect(wo)}
      role="button"
    >
      {/* Severity bar */}
      <div className="wo-item-severity-bar" style={{ background: color }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--brand-light)', fontWeight: 700 }}>
            {wo.workOrderNumber}
          </span>
          <span
            className={`severity-badge severity-${wo.severity}`}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            {wo.severity}
          </span>
        </div>

        {/* Title */}
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {wo.title}
        </div>

        {/* Location + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: statusColor, fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
            {STATUS_LABELS[wo.status] ?? wo.status}
          </span>
          {wo.location?.address && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {wo.location.address}
            </span>
          )}
        </div>

        {/* SLA */}
        {sla && (
          <div style={{
            marginTop: 5, fontSize: '0.68rem', fontWeight: 700,
            color: sla.critical ? '#EF4444' : '#F59E0B',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ⏱ {sla.critical ? '🔴 ' : ''}{sla.text} SLA remaining
          </div>
        )}
      </div>

      {/* Chevron */}
      <div style={{ color: 'var(--text-muted)', fontSize: '1rem', flexShrink: 0, alignSelf: 'center' }}>›</div>
    </div>
  );
}

export default function WorkOrdersPage({ onSelect }) {
  const { user } = useAuthStore();
  const { workOrders, isLoading, isOffline, fetchMy, transitionStatus } = useWorkOrderStore();
  const [tab, setTab]   = useState('active');
  const [search, setSearch] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    fetchMy();
  }, []);

  const filtered = workOrders.filter(wo => {
    const matchTab = tab === 'all'
      ? true
      : tab === 'assigned'
        ? wo.status === 'ASSIGNED'
        : ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(wo.status);

    const matchSearch = !search.trim() || (
      wo.title?.toLowerCase().includes(search.toLowerCase()) ||
      wo.workOrderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      wo.location?.address?.toLowerCase().includes(search.toLowerCase())
    );

    return matchTab && matchSearch;
  });
  const urgentWO = [...workOrders]
    .filter(wo => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(wo.status))
    .sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[a.severity] ?? 4) - ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[b.severity] ?? 4))[0];
  const canTransition = (wo, status) => ({
    EN_ROUTE: ['ACCEPTED'].includes(wo?.status),
    ARRIVED: ['EN_ROUTE'].includes(wo?.status),
    RESOLVED: ['IN_PROGRESS'].includes(wo?.status),
  }[status]);

  async function handleQuickAction(status) {
    if (!urgentWO || !canTransition(urgentWO, status) || transitioning) return;
    setTransitioning(true);
    try {
      const result = await transitionStatus(urgentWO._id, status);
      toast.success(result.queued ? 'Update saved offline and queued for sync' : `Task updated: ${STATUS_LABELS[status]}`);
      await fetchMy();
    } catch {
      toast.error('Unable to update this task');
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <>
      <section className="field-profile-card" aria-label="Technician profile">
        <div className="field-profile-avatar"><UserRound size={20} /></div>
        <div className="field-profile-copy">
          <span>Technician</span>
          <strong>{user?.email ?? 'tech1@dhakapower.bd'}</strong>
        </div>
        <span className="active-unit-badge"><span /> Active Unit 1</span>
      </section>

      {urgentWO && (
        <section className="urgent-dispatch" aria-labelledby="urgent-dispatch-title">
          <div className="hazard-stripe" aria-hidden="true" />
          <div className="urgent-dispatch-body">
            <div className="urgent-kicker"><Radio size={13} /> URGENT DISPATCH</div>
            <div className="urgent-heading-row">
              <div>
                <h1 id="urgent-dispatch-title">{urgentWO.title || 'Substation Error - Dhaka Zone B'}</h1>
                <div className="urgent-location"><MapPin size={14} /> {urgentWO.location?.address || 'Dhaka Zone B'}</div>
              </div>
              <ShieldAlert className="urgent-alert-icon" size={30} />
            </div>
            <div className="urgent-tags">
              <span className="hazard-tag">HAZARD</span>
              <span className="priority-tag">{urgentWO.severity || 'HIGH'} PRIORITY</span>
              <span className="urgent-status">{STATUS_LABELS[urgentWO.status] || urgentWO.status}</span>
            </div>
            {urgentWO.sla?.resolutionDeadline && <div className="urgent-sla">SLA: {formatSLARemaining(urgentWO.sla.resolutionDeadline)?.text} remaining</div>}
            <button className="urgent-view-button" type="button" onClick={() => onSelect(urgentWO)}>View full dispatch details <span>→</span></button>
          </div>
        </section>
      )}

      {urgentWO && (
        <section className="field-actions" aria-label="Dispatch status actions">
          <button type="button" className="field-action action-route" disabled={!canTransition(urgentWO, 'EN_ROUTE') || transitioning} onClick={() => handleQuickAction('EN_ROUTE')}>
            <Navigation size={22} /><span>ON ROUTE</span><small>{canTransition(urgentWO, 'EN_ROUTE') ? 'Start travel' : STATUS_LABELS[urgentWO.status]}</small>
          </button>
          <button type="button" className="field-action action-site" disabled={!canTransition(urgentWO, 'ARRIVED') || transitioning} onClick={() => handleQuickAction('ARRIVED')}>
            <MapPin size={22} /><span>ON SITE</span><small>{canTransition(urgentWO, 'ARRIVED') ? 'Confirm arrival' : 'After On Route'}</small>
          </button>
          <button type="button" className="field-action action-complete" disabled={!canTransition(urgentWO, 'RESOLVED') || transitioning} onClick={() => handleQuickAction('RESOLVED')}>
            <CheckCircle2 size={22} /><span>TASK COMPLETED</span><small>{canTransition(urgentWO, 'RESOLVED') ? 'Mark resolved' : 'After work starts'}</small>
          </button>
        </section>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type="search"
          className="input"
          placeholder="Search by WO number, title, location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {FILTER_TABS.map(t => {
          const count = t.key === 'all'
            ? workOrders.length
            : t.key === 'assigned'
              ? workOrders.filter(w => w.status === 'ASSIGNED').length
              : workOrders.filter(w => ['ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS'].includes(w.status)).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                background: tab === t.key ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      tab === t.key ? '#fff' : 'var(--text-muted)',
                border:     `1px solid ${tab === t.key ? 'var(--brand)' : 'var(--border)'}`,
                gap: 6,
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-deep)',
                  borderRadius: 10, padding: '0 5px', fontSize: '0.62rem',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={fetchMy}
          disabled={isLoading}
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: 'auto' }}
        >
          {isLoading
            ? <div className="spinner" style={{ width: 13, height: 13 }} />
            : <RefreshCw size={13} />
          }
        </button>
      </div>

      {/* Offline notice */}
      {isOffline && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, marginBottom: 12, fontSize: '0.75rem', color: '#F59E0B',
        }}>
          <WifiOff size={13} /> Showing cached data — changes will sync when online
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600 }}>No work orders found</div>
          <div style={{ fontSize: '0.8rem', marginTop: 6 }}>
            {tab === 'active' ? 'No active assignments right now.' : 'Try a different filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(wo => (
            <WOItem key={wo._id} wo={wo} onSelect={onSelect} />
          ))}
        </div>
      )}
    </>
  );
}
