import { useState, useEffect } from 'react';
import {
  Zap, Play, ChevronRight, Clock, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

// ── Before / After comparison bar ─────────────────────────────────────────────
function DeltaMetric({ label, before, after, unit = '', higherIsBetter = true, format: fmt }) {
  const fmtVal = (v) => fmt ? fmt(v) : `${v ?? '—'}${unit}`;
  const improved = higherIsBetter ? after > before : after < before;
  const delta = after - before;
  const pctChange = before !== 0 ? Math.abs(Math.round((delta / before) * 100)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 18px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-secondary)', textDecoration: 'line-through', opacity: 0.6 }}>
          {fmtVal(before)}
        </span>
        <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: improved ? 'var(--success)' : 'var(--critical)' }}>
          {fmtVal(after)}
        </span>
      </div>
      {pctChange != null && delta !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem' }}>
          {improved
            ? <TrendingUp size={12} style={{ color: 'var(--success)' }} />
            : <TrendingDown size={12} style={{ color: 'var(--critical)' }} />}
          <span style={{ color: improved ? 'var(--success)' : 'var(--critical)', fontWeight: 600 }}>
            {improved ? '+' : '-'}{pctChange}% {improved ? 'improvement' : 'degradation'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Single run card ───────────────────────────────────────────────────────────
function RunCard({ run, onApprove, onReject, expanded, onToggle }) {
  const statusColors = {
    PENDING: 'var(--text-muted)', RUNNING: 'var(--warning)',
    COMPLETED: 'var(--brand-400)', FAILED: 'var(--critical)',
    APPROVED: 'var(--success)', REJECTED: 'var(--critical)',
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Summary row */}
      <div
        style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={onToggle}
      >
        {/* Status indicator */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: statusColors[run.status] ?? 'var(--text-muted)',
          boxShadow: run.status === 'RUNNING' ? `0 0 8px ${statusColors[run.status]}` : 'none',
          animation: run.status === 'RUNNING' ? 'blink 1s ease-in-out infinite' : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{run.algorithm}</span>
            <span className={`badge ${run.status === 'APPROVED' ? 'success' : run.status === 'COMPLETED' ? 'brand' : run.status === 'FAILED' ? 'critical' : ''}`} style={{ fontSize: '0.62rem' }}>
              {run.status}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {formatDistanceToNow(new Date(run.createdAt))} ago
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Trigger: <span style={{ color: 'var(--text-secondary)' }}>{run.trigger}</span>
            {run.runtimeMs && <span style={{ marginLeft: 8 }}>· {(run.runtimeMs / 1000).toFixed(2)}s</span>}
            {run.assignments?.length > 0 && <span style={{ marginLeft: 8 }}>· <strong style={{ color: 'var(--brand-400)' }}>{run.assignments.length}</strong> assignments</span>}
          </div>
        </div>

        <ChevronRight
          size={16}
          style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </div>

      {/* Expanded content */}
      {expanded && run.status === 'COMPLETED' && run.before && run.after && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          {/* Before / After grid */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Before → After Comparison
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              <DeltaMetric label="SLA Compliance" before={run.before.slaCompliancePct} after={run.after.slaCompliancePct} unit="%" higherIsBetter />
              <DeltaMetric label="Unassigned Jobs" before={run.before.unassignedCount} after={run.after.unassignedCount} higherIsBetter={false} />
              <DeltaMetric
                label="Financial Risk"
                before={run.before.slaFinancialRisk}
                after={run.after.slaFinancialRisk}
                higherIsBetter={false}
                format={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v ?? 0}`}
              />
            </div>
          </div>

          {/* Assignments preview */}
          {run.assignments?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Proposed Assignments ({run.assignments.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {run.assignments.slice(0, 10).map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                  }}>
                    <span className="mono text-xs" style={{ color: 'var(--brand-400)', flexShrink: 0 }}>
                      {a.workOrderId?.workOrderNumber ?? `WO-${i + 1}`}
                    </span>
                    <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{a.newTechnician?.name ?? 'Technician'}</span>
                    {a.reason && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{a.reason}</span>}
                  </div>
                ))}
                {run.assignments.length > 10 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 10px' }}>
                    + {run.assignments.length - 10} more assignments…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-success"
              onClick={() => onApprove(run._id)}
              style={{ flex: 1 }}
            >
              <CheckCircle size={14} /> Apply {run.assignments?.length} Assignments
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onReject(run._id)}
              style={{ color: 'var(--critical)', borderColor: 'rgba(239,68,68,0.2)' }}
            >
              <XCircle size={14} /> Reject
            </button>
          </div>
        </div>
      )}

      {expanded && run.status === 'APPROVED' && (
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={14} style={{ color: 'var(--success)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
            Approved by {run.approvedBy?.name ?? 'Dispatcher'} · {run.approvedAt ? format(new Date(run.approvedAt), 'MMM d, HH:mm') : ''}
          </span>
        </div>
      )}

      {expanded && run.status === 'FAILED' && (
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div className="badge critical" style={{ fontSize: '0.78rem' }}>{run.errorMessage}</div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OptimizationPage() {
  const [runs, setRuns]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [algo, setAlgo]           = useState('GREEDY');

  const loadRuns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/optimization/runs');
      setRuns(data.runs ?? []);
      // Auto-expand the first completed pending run
      const first = data.runs?.find(r => r.status === 'COMPLETED');
      if (first && !expandedId) setExpandedId(first._id);
    } catch { toast.error('Failed to load optimization runs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRuns(); }, []);

  async function handleRun() {
    setRunning(true);
    try {
      await api.post('/optimization/run', { algorithm: algo, trigger: 'MANUAL' });
      toast.success('Optimization running — results will appear shortly');
      setTimeout(loadRuns, 2000);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Optimization failed');
    } finally { setRunning(false); }
  }

  async function handleApprove(runId) {
    try {
      const { data } = await api.post(`/optimization/runs/${runId}/approve`);
      toast.success(data.message ?? 'Assignments applied!');
      loadRuns();
    } catch (err) { toast.error(err.response?.data?.error ?? 'Approval failed'); }
  }

  async function handleReject(runId) {
    try {
      await api.patch?.(`/optimization/runs/${runId}`, { status: 'REJECTED' });
      toast('Run rejected');
      loadRuns();
    } catch { toast('Run marked as reviewed'); loadRuns(); }
  }

  const pendingCount = runs.filter(r => r.status === 'COMPLETED').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} style={{ color: 'var(--brand-400)' }} /> Optimization Engine
          </h2>
          <div className="text-xs text-muted">
            AI-powered workforce re-optimization · {pendingCount} run{pendingCount !== 1 ? 's' : ''} awaiting approval
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={loadRuns} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Run control panel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title"><Play size={14} /> Run Optimization</div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                The optimizer analyzes all unassigned incidents, available technicians, skill requirements, SLA deadlines and financial exposure to propose the best assignment schedule.
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                  <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Algorithm</label>
                  <select
                    className="form-select"
                    value={algo}
                    onChange={e => setAlgo(e.target.value)}
                    style={{ width: 200, height: 34, fontSize: '0.82rem' }}
                  >
                    <option value="GREEDY">Greedy (Fast — &lt;1s)</option>
                    <option value="SIMULATED_ANNEALING">Simulated Annealing (Phase 2)</option>
                    <option value="GENETIC_ALGORITHM">Genetic Algorithm (Phase 2)</option>
                    <option value="HYBRID">Hybrid SA+GA (Phase 2)</option>
                  </select>
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleRun}
              disabled={running}
              style={{ whiteSpace: 'nowrap' }}
            >
              {running
                ? <><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Running…</>
                : <><Zap size={15} /> Run Optimization</>}
            </button>
          </div>

          {/* How it works */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {[
              { icon: '📋', label: 'Scans all open work orders' },
              { icon: '👷', label: 'Evaluates technician skills & availability' },
              { icon: '📊', label: 'Scores against SLA & financial risk' },
              { icon: '✅', label: 'Proposes assignments for dispatcher approval' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>{s.icon}</span><span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending approval banner */}
      {pendingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px',
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 'var(--radius-md)', marginBottom: 16,
        }}>
          <AlertTriangle size={15} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--brand-400)', fontWeight: 600 }}>
            {pendingCount} optimization result{pendingCount !== 1 ? 's' : ''} awaiting dispatcher approval
          </span>
        </div>
      )}

      {/* Run history */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Run History
        </div>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 70, marginBottom: 10, borderRadius: 16 }} />
          ))
        ) : runs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            <Zap size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div>No optimization runs yet. Run your first optimization above.</div>
          </div>
        ) : runs.map(run => (
          <RunCard
            key={run._id}
            run={run}
            expanded={expandedId === run._id}
            onToggle={() => setExpandedId(expandedId === run._id ? null : run._id)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}
      </div>
    </div>
  );
}
