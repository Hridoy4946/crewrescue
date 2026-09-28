import { useState, useEffect, useRef } from 'react';
import {
  Zap, Play, ChevronRight, Clock, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity,
  BarChart2, GitMerge, Cpu, Shuffle,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { useSocket } from '../hooks/useSocket.js';

// ── Algorithm descriptions ────────────────────────────────────────────────────
const ALGO_INFO = {
  GREEDY: {
    icon: '⚡',
    label: 'Greedy',
    badge: 'Fast — <1s',
    badgeColor: 'var(--success)',
    desc: 'Assigns the highest-priority unassigned work orders to the least-loaded eligible technician. Deterministic. Best for quick re-scheduling during normal operations.',
    complexity: 'O(n × m)',
    candidates: 'n',
    mode: 'sync',
  },
  SIMULATED_ANNEALING: {
    icon: '🌡️',
    label: 'Simulated Annealing',
    badge: 'Near-optimal — ~5-15s',
    badgeColor: 'var(--warning)',
    desc: 'Probabilistic hill-climbing algorithm. Starts from the Greedy solution and iteratively applies random swap/reassign mutations, accepting worse solutions with probability e^(−ΔCost/T). Cools from T=100 to T=0.1 over 12,000 iterations.',
    complexity: 'O(iterations × n)',
    candidates: '12,000',
    mode: 'async',
  },
  GENETIC_ALGORITHM: {
    icon: '🧬',
    label: 'Genetic Algorithm',
    badge: 'Evolutionary — ~10-30s',
    badgeColor: '#8B5CF6',
    desc: 'Population-based evolutionary search. Initializes 60 candidate schedules (chromosomes), selects parents via tournament selection, produces offspring via uniform crossover, and mutates genes. Elitist replacement preserves the best solution across 200 generations.',
    complexity: 'O(popSize × generations × n)',
    candidates: '12,000',
    mode: 'async',
  },
  HYBRID: {
    icon: '🔀',
    label: 'Hybrid SA+GA',
    badge: 'Combined — ~5-15s',
    badgeColor: 'var(--brand-400)',
    desc: 'Runs the Greedy algorithm as baseline. Falls back to Simulated Annealing if Redis/BullMQ worker is available. Best overall solution quality for emergency re-scheduling scenarios.',
    complexity: 'O(n × iterations)',
    candidates: '12,000',
    mode: 'async',
  },
};

// ── Before/After comparison bar ───────────────────────────────────────────────
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

// ── Live progress panel (for async SA/GA jobs) ────────────────────────────────
function LiveProgressPanel({ progress, algo }) {
  if (!progress) return null;
  const isGA = algo === 'GENETIC_ALGORITHM';

  return (
    <div style={{
      marginTop: 16, padding: '14px 18px',
      background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Activity size={14} style={{ color: '#8B5CF6', animation: 'blink 1s ease-in-out infinite' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#8B5CF6' }}>
          {isGA ? `Generation ${progress.generation}/${progress.generations}` : `Iteration ${progress.iteration?.toLocaleString()}`}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {progress.pctComplete}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%', width: `${progress.pctComplete}%`,
          background: 'linear-gradient(90deg, #8B5CF6, var(--brand-400))',
          borderRadius: 2, transition: 'width 0.3s ease',
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {isGA ? (
          <>
            <div style={statStyle}>
              <span style={statLabel}>Best Cost</span>
              <span style={statVal}>{progress.bestCost?.toFixed(2)}</span>
            </div>
            <div style={statStyle}>
              <span style={statLabel}>Gen Best</span>
              <span style={statVal}>{progress.genBestCost?.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <>
            <div style={statStyle}>
              <span style={statLabel}>Temperature</span>
              <span style={statVal}>{progress.temperature?.toFixed(3)}</span>
            </div>
            <div style={statStyle}>
              <span style={statLabel}>Best Cost</span>
              <span style={statVal}>{progress.bestCost?.toFixed(2)}</span>
            </div>
            <div style={statStyle}>
              <span style={statLabel}>Accepted Moves</span>
              <span style={statVal}>{progress.accepted?.toLocaleString()}</span>
            </div>
            <div style={statStyle}>
              <span style={statLabel}>Improvements</span>
              <span style={statVal}>{progress.improved?.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const statStyle = { display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 };
const statLabel  = { fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };
const statVal    = { fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' };

// ── Single run card ───────────────────────────────────────────────────────────
function RunCard({ run, onApprove, onReject, expanded, onToggle, liveProgress }) {
  const statusColors = {
    PENDING: 'var(--text-muted)', RUNNING: 'var(--warning)',
    COMPLETED: 'var(--brand-400)', FAILED: 'var(--critical)',
    APPROVED: 'var(--success)', REJECTED: 'var(--critical)',
  };
  const algoInfo = ALGO_INFO[run.algorithm] ?? {};

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Summary row */}
      <div
        style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={onToggle}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: statusColors[run.status] ?? 'var(--text-muted)',
          boxShadow: run.status === 'RUNNING' ? `0 0 8px ${statusColors[run.status]}` : 'none',
          animation: run.status === 'RUNNING' ? 'blink 1s ease-in-out infinite' : 'none',
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: '0.9rem' }}>{algoInfo.icon ?? '⚙️'}</span>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{algoInfo.label ?? run.algorithm}</span>
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
            {run.candidateSolutions > 0 && <span style={{ marginLeft: 8 }}>· <strong style={{ color: 'var(--brand-400)' }}>{run.candidateSolutions?.toLocaleString()}</strong> candidates</span>}
            {run.assignments?.length > 0 && <span style={{ marginLeft: 8 }}>· <strong style={{ color: 'var(--success)' }}>{run.assignments.length}</strong> assignments</span>}
          </div>
        </div>

        <ChevronRight
          size={16}
          style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </div>

      {/* Live progress for running async jobs */}
      {run.status === 'RUNNING' && liveProgress && (
        <div style={{ padding: '0 20px 16px', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <LiveProgressPanel progress={liveProgress} algo={run.algorithm} />
        </div>
      )}

      {/* Expanded content */}
      {expanded && run.status === 'COMPLETED' && run.before && run.after && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
          {/* Before/After grid */}
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

          {/* Solver stats (SA/GA) */}
          {run.inputSnapshot?.solverStats && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Solver Statistics</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                {run.inputSnapshot.solverStats.iterations && (
                  <span>Iterations: <strong style={{ color: 'var(--text-primary)' }}>{run.inputSnapshot.solverStats.iterations?.toLocaleString()}</strong></span>
                )}
                {run.inputSnapshot.solverStats.generations && (
                  <span>Generations: <strong style={{ color: 'var(--text-primary)' }}>{run.inputSnapshot.solverStats.generations}</strong></span>
                )}
                {run.inputSnapshot.solverStats.improvementPct != null && (
                  <span>Improvement: <strong style={{ color: 'var(--success)' }}>{run.inputSnapshot.solverStats.improvementPct}%</strong></span>
                )}
                {run.inputSnapshot.solverStats.finalCost != null && (
                  <span>Final Cost: <strong style={{ color: 'var(--brand-400)' }}>{run.inputSnapshot.solverStats.finalCost?.toFixed(3)}</strong></span>
                )}
                {run.inputSnapshot.solverStats.acceptedMoves != null && (
                  <span>Accepted Moves: <strong style={{ color: 'var(--text-primary)' }}>{run.inputSnapshot.solverStats.acceptedMoves?.toLocaleString()}</strong></span>
                )}
              </div>
            </div>
          )}

          {/* Assignments preview */}
          {run.assignments?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Proposed Assignments ({run.assignments.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {run.assignments.slice(0, 12).map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem',
                  }}>
                    <span className="mono text-xs" style={{ color: 'var(--brand-400)', flexShrink: 0 }}>
                      {a.workOrderId?.workOrderNumber ?? `WO-${i + 1}`}
                    </span>
                    <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{a.newTechnician?.name ?? 'Technician'}</span>
                    {a.reason && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason}</span>}
                  </div>
                ))}
                {run.assignments.length > 12 && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '4px 10px' }}>
                    + {run.assignments.length - 12} more assignments…
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
          <div className="badge critical" style={{ fontSize: '0.78rem' }}>{run.errorMessage ?? 'Unknown error'}</div>
        </div>
      )}

      {expanded && run.status === 'RUNNING' && !liveProgress && (
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Solver running asynchronously via job queue…</span>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OptimizationPage() {
  const [runs, setRuns]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [algo, setAlgo]             = useState('GREEDY');
  const [liveProgress, setLiveProgress] = useState({}); // runId → progress data
  const [queueStatus, setQueueStatus]   = useState(null);
  const { socket }                  = useSocket();
  const pollRef                     = useRef(null);

  const selectedAlgoInfo = ALGO_INFO[algo] ?? ALGO_INFO.GREEDY;

  const loadRuns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/optimization/runs');
      setRuns(data.runs ?? []);
      const first = data.runs?.find(r => r.status === 'COMPLETED');
      if (first && !expandedId) setExpandedId(first._id);
    } catch { toast.error('Failed to load optimization runs'); }
    finally { setLoading(false); }
  };

  const loadQueueStatus = async () => {
    try {
      const { data } = await api.get('/optimization/queue/status');
      setQueueStatus(data.queue);
    } catch {}
  };

  useEffect(() => {
    loadRuns();
    loadQueueStatus();
  }, []);

  // ── Socket.IO live updates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket?.on) return;

    socket.on('optimization:progress', (data) => {
      setLiveProgress(prev => ({ ...prev, [data.runId]: data }));
    });

    socket.on('optimization:completed', (data) => {
      toast.success(`${ALGO_INFO[data.algorithm]?.label ?? data.algorithm} complete — ${data.assigned} assignments`, { icon: '✅' });
      setLiveProgress(prev => { const n = { ...prev }; delete n[data.runId]; return n; });
      loadRuns();
    });

    socket.on('optimization:failed', (data) => {
      toast.error(`Optimization failed: ${data.message}`, { icon: '❌' });
      loadRuns();
    });

    return () => {
      socket.off?.('optimization:progress');
      socket.off?.('optimization:completed');
      socket.off?.('optimization:failed');
    };
  }, [socket]);

  // Poll for running sync jobs
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === 'RUNNING');
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(loadRuns, 3000);
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runs]);

  async function handleRun() {
    setRunning(true);
    try {
      const { data } = await api.post('/optimization/run', { algorithm: algo, trigger: 'MANUAL' });
      const mode = data.mode === 'async' ? 'async (live progress via Socket.IO)' : 'synchronous';
      toast.success(`${selectedAlgoInfo.label} optimization started — ${mode}`);
      setExpandedId(data.runId);
      setTimeout(loadRuns, 1500);
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
      await api.post(`/optimization/runs/${runId}/reject`, { reason: 'Rejected by dispatcher' });
      toast('Run rejected');
      loadRuns();
    } catch { toast('Run marked as reviewed'); loadRuns(); }
  }

  const pendingCount = runs.filter(r => r.status === 'COMPLETED').length;
  const runningCount = runs.filter(r => r.status === 'RUNNING').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} style={{ color: 'var(--brand-400)' }} /> Optimization Engine
          </h2>
          <div className="text-xs text-muted">
            Multi-objective AI workforce re-optimization · {pendingCount} run{pendingCount !== 1 ? 's' : ''} awaiting approval
            {runningCount > 0 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>· {runningCount} running</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {queueStatus?.available && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '4px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              Queue: <strong>{queueStatus.active}</strong> active · <strong>{queueStatus.waiting}</strong> waiting
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { loadRuns(); loadQueueStatus(); }} disabled={loading}>
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
          {/* Algorithm selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
            {Object.entries(ALGO_INFO).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setAlgo(key)}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  background: algo === key ? 'rgba(99,102,241,0.12)' : 'var(--bg-elevated)',
                  border: `1px solid ${algo === key ? 'var(--brand-400)' : 'var(--border-subtle)'}`,
                  display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.1rem' }}>{info.icon}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: algo === key ? 'var(--brand-400)' : 'var(--text-primary)' }}>
                    {info.label}
                  </span>
                </div>
                <span style={{ fontSize: '0.62rem', color: info.badgeColor, fontWeight: 600 }}>{info.badge}</span>
              </button>
            ))}
          </div>

          {/* Selected algorithm description */}
          <div style={{
            padding: '12px 16px', background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)', marginBottom: 16,
            borderLeft: `3px solid ${selectedAlgoInfo.badgeColor}`,
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
              {selectedAlgoInfo.desc}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              <span>Complexity: <strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{selectedAlgoInfo.complexity}</strong></span>
              <span>Candidate Solutions: <strong style={{ color: 'var(--text-secondary)' }}>{selectedAlgoInfo.candidates}</strong></span>
              <span>Execution: <strong style={{ color: selectedAlgoInfo.mode === 'async' ? 'var(--warning)' : 'var(--success)' }}>
                {selectedAlgoInfo.mode === 'async' ? 'Async (BullMQ + Socket.IO)' : 'Synchronous'}
              </strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleRun}
              disabled={running}
              style={{ whiteSpace: 'nowrap', minWidth: 200 }}
            >
              {running
                ? <><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Starting…</>
                : <><Zap size={15} /> Run {selectedAlgoInfo.label}</>}
            </button>
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

      {/* Algorithm comparison summary (if multiple runs exist) */}
      {runs.filter(r => r.status !== 'FAILED').length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title"><BarChart2 size={14} /> Algorithm Comparison</div>
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {runs.filter(r => ['COMPLETED', 'APPROVED'].includes(r.status)).slice(0, 4).map(run => (
                <div key={run._id} style={{
                  padding: '10px 14px', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span>{ALGO_INFO[run.algorithm]?.icon ?? '⚙️'}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{ALGO_INFO[run.algorithm]?.label ?? run.algorithm}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>SLA: <strong style={{ color: 'var(--success)' }}>{run.after?.slaCompliancePct ?? '—'}%</strong></span>
                    <span>Runtime: <strong style={{ color: 'var(--text-secondary)' }}>{run.runtimeMs ? `${(run.runtimeMs/1000).toFixed(2)}s` : '—'}</strong></span>
                    <span>Assigned: <strong style={{ color: 'var(--brand-400)' }}>{run.assignments?.length ?? 0}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            <div>No optimization runs yet. Select an algorithm and run your first optimization above.</div>
          </div>
        ) : runs.map(run => (
          <RunCard
            key={run._id}
            run={run}
            expanded={expandedId === run._id}
            onToggle={() => setExpandedId(expandedId === run._id ? null : run._id)}
            onApprove={handleApprove}
            onReject={handleReject}
            liveProgress={liveProgress[run._id]}
          />
        ))}
      </div>
    </div>
  );
}
