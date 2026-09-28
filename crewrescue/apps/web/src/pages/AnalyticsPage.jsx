import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Activity, RefreshCw, AlertTriangle, Bell, Sparkles, ShieldAlert } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

// ── Pure CSS bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, colorFn, labelKey = '_id', valueKey = 'count', title }) {
  if (!data?.length) return <div className="text-muted text-sm">No data</div>;
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div>
      {title && <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i) => {
          const pct = max > 0 ? (d[valueKey] / max) * 100 : 0;
          const color = colorFn ? colorFn(d[labelKey]) : `hsl(${220 + i * 30}, 70%, 60%)`;
          return (
            <div key={d[labelKey] ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 130, fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(d[labelKey] ?? '—').replace(/_/g, ' ')}
              </div>
              <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 4, height: 20, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                  borderRadius: 4,
                  transition: 'width 0.6s ease',
                  minWidth: pct > 0 ? 4 : 0,
                }} />
              </div>
              <div style={{ width: 36, fontSize: '0.78rem', fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>
                {d[valueKey]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Donut / ring chart (pure CSS) ─────────────────────────────────────────────
function DonutChart({ segments, size = 120 }) {
  if (!segments?.length) return null;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let cumulativePct = 0;
  const gradientParts = segments.map(seg => {
    const pct = total > 0 ? (seg.value / total) * 100 : 0;
    const part = `${seg.color} ${cumulativePct}% ${cumulativePct + pct}%`;
    cumulativePct += pct;
    return part;
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(${gradientParts.join(', ')})`,
        mask: `radial-gradient(circle, transparent ${size * 0.32}px, black ${size * 0.33}px)`,
        WebkitMask: `radial-gradient(circle, transparent ${size * 0.32}px, black ${size * 0.33}px)`,
      }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: s.color, marginLeft: 'auto', minWidth: 28, textAlign: 'right' }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sparkline bar trend ────────────────────────────────────────────────────────
function TrendBars({ data }) {
  if (!data?.length) return <div className="text-muted text-sm">No trend data yet</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
        {data.map((d, i) => (
          <div key={d._id ?? i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: '100%', borderRadius: '3px 3px 0 0',
              background: `linear-gradient(180deg, var(--brand-400), var(--brand-600))`,
              height: `${Math.max(4, (d.count / max) * 60)}px`,
              transition: 'height 0.5s ease',
              boxShadow: '0 0 8px var(--brand-glow)',
            }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={d._id ?? i} style={{ flex: 1, textAlign: 'center', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
            {d._id?.slice(5)} {/* MM-DD */}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={d._id ?? i} style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-400)' }}>
            {d.count}
          </div>
        ))}
      </div>
    </div>
  );
}

const SEV_COLORS = { CRITICAL: 'var(--critical)', HIGH: 'var(--warning)', MEDIUM: 'var(--info)', LOW: 'var(--text-muted)' };

export default function AnalyticsPage() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [slaData, setSlaData]       = useState(null);
  const [slaLoading, setSlaLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/analytics');
      setData(res.data.analytics);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const loadSlaPredictions = async () => {
    setSlaLoading(true);
    try {
      const res = await api.get('/sla/predictions');
      if (res.data?.success) {
        setSlaData(res.data);
      }
    } catch {
      // quiet fallback
    } finally {
      setSlaLoading(false);
    }
  };

  const handleTestNotification = async (type = 'SLA_BREACH_WARNING') => {
    setSendingTest(true);
    try {
      await api.post('/sla/notifications/test', { type });
      toast.success('Live notification dispatched across active channels');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to dispatch test notification');
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    load();
    loadSlaPredictions();
  }, []);

  const sevSegments = data?.severityBreakdown?.map(s => ({
    label: s._id, value: s.count, color: SEV_COLORS[s._id] ?? '#6B7280',
  })) ?? [];

  const totalTechs = data?.techUtilByTerritory?.reduce((s, t) => s + t.total, 0) ?? 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} style={{ color: 'var(--brand-400)' }} /> Analytics & Reporting
          </h2>
          <div className="text-xs text-muted">DhakaPower Utilities · Live operational intelligence</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 200, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Row 1 — Severity + 7-day trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title"><Activity size={14} /> Incident Severity Mix</div>
              </div>
              <div className="card-body">
                <DonutChart segments={sevSegments} size={130} />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title"><TrendingUp size={14} /> 7-Day Resolution Trend</div>
              </div>
              <div className="card-body">
                {data?.completionTrend?.length > 0
                  ? <TrendBars data={data.completionTrend} />
                  : <div className="text-muted text-sm">Seed some closed WOs to see trend</div>}
              </div>
            </div>
          </div>

          {/* Row 2 — Category breakdown + Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">📂 Incident Categories (Top 8)</div>
              </div>
              <div className="card-body">
                <BarChart
                  data={data?.categoryBreakdown}
                  colorFn={() => 'var(--brand-400)'}
                />
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">📋 Work Order Status Distribution</div>
              </div>
              <div className="card-body">
                <BarChart
                  data={data?.statusBreakdown}
                  colorFn={(status) => {
                    if (status === 'IN_PROGRESS') return 'var(--success)';
                    if (status === 'ASSIGNED') return 'var(--brand-400)';
                    if (status === 'PENDING_ASSIGNMENT' || status === 'CREATED') return 'var(--warning)';
                    return '#6B7280';
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 3 — Tech utilization by territory */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title"><Users size={14} /> Technician Utilization by Territory</div>
              <span className="text-xs text-muted">{totalTechs} total</span>
            </div>
            <div className="card-body">
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Territory</th>
                      <th>Total</th>
                      <th>Available</th>
                      <th>On Job</th>
                      <th>Utilization</th>
                      <th style={{ width: 200 }}>Breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.techUtilByTerritory?.map(row => {
                      const utilPct = row.total > 0 ? Math.round((row.busy / row.total) * 100) : 0;
                      return (
                        <tr key={row._id}>
                          <td style={{ fontWeight: 600 }}>{row._id ?? 'Unassigned'}</td>
                          <td style={{ fontWeight: 700 }}>{row.total}</td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>{row.available}</td>
                          <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{row.busy}</td>
                          <td>
                            <span style={{ color: utilPct > 80 ? 'var(--critical)' : utilPct > 60 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                              {utilPct}%
                            </span>
                          </td>
                          <td>
                            <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${utilPct}%`, borderRadius: 4,
                                background: utilPct > 80 ? 'var(--critical)' : utilPct > 60 ? 'var(--warning)' : 'var(--success)',
                                transition: 'width 0.5s',
                              }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 4 — SLA compliance by category */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">⏱ SLA Compliance by Category</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data?.slaByCategory?.map(cat => {
                  const compliancePct = cat.total > 0 ? Math.round(((cat.total - cat.breached) / cat.total) * 100) : 100;
                  return (
                    <div key={cat._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 180, fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {(cat._id ?? '—').replace(/_/g, ' ')}
                      </div>
                      <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 4, height: 16, overflow: 'hidden', position: 'relative' }}>
                        <div style={{
                          width: `${compliancePct}%`, height: '100%',
                          background: compliancePct >= 95 ? 'var(--success)' : compliancePct >= 80 ? 'var(--warning)' : 'var(--critical)',
                          borderRadius: 4, transition: 'width 0.5s',
                        }} />
                      </div>
                      <div style={{ width: 44, fontWeight: 700, fontSize: '0.82rem', color: compliancePct >= 95 ? 'var(--success)' : compliancePct >= 80 ? 'var(--warning)' : 'var(--critical)', textAlign: 'right', flexShrink: 0 }}>
                        {compliancePct}%
                      </div>
                      <div style={{ width: 52, fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>
                        {cat.total} WOs
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 5 — AI SLA Breach Predictor & Proactive Alerts */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: 'var(--brand-400)' }} />
                <div className="card-title">AI SLA Breach Predictor & Early Warning</div>
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Logistic Regression ML</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={loadSlaPredictions}
                  disabled={slaLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={12} className={slaLoading ? 'spin' : ''} />
                  <span>Re-score</span>
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleTestNotification('SLA_BREACH_WARNING')}
                  disabled={sendingTest}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Bell size={12} />
                  <span>{sendingTest ? 'Sending...' : 'Test Multi-Channel Alert'}</span>
                </button>
              </div>
            </div>

            <div className="card-body">
              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--critical)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>High Breach Risk</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--critical)', marginTop: 4 }}>
                    {slaData?.summary?.highRiskCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>&gt;70% breach probability</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--warning)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Medium Risk</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', marginTop: 4 }}>
                    {slaData?.summary?.mediumRiskCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>40% - 70% breach risk</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--success)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Risk (Safe)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>
                    {slaData?.summary?.lowRiskCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>&lt;40% breach risk</div>
                </div>

                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--brand-400)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Assessed</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--brand-400)', marginTop: 4 }}>
                    {slaData?.summary?.totalAssessed ?? 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active unverified tickets</div>
                </div>
              </div>

              {/* Table of Top Predicted Risks */}
              {slaData?.predictions?.length ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>TICKET</th>
                        <th style={{ padding: '8px 10px' }}>TITLE</th>
                        <th style={{ padding: '8px 10px' }}>SEVERITY</th>
                        <th style={{ padding: '8px 10px' }}>BREACH PROBABILITY</th>
                        <th style={{ padding: '8px 10px' }}>RISK FACTORS</th>
                        <th style={{ padding: '8px 10px' }}>RECOMMENDED ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaData.predictions.slice(0, 10).map((item) => {
                        const probPct = Math.round((item.prediction?.probability ?? 0) * 100);
                        const isHigh = item.prediction?.riskLevel === 'HIGH';
                        const isMed = item.prediction?.riskLevel === 'MEDIUM';
                        const badgeColor = isHigh ? 'var(--critical)' : isMed ? 'var(--warning)' : 'var(--success)';
                        const badgeBg = isHigh ? 'rgba(239, 68, 68, 0.12)' : isMed ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                        return (
                          <tr key={item.workOrderId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace' }}>
                              {item.workOrderNumber}
                            </td>
                            <td style={{ padding: '8px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
                                background: item.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: item.severity === 'CRITICAL' ? 'var(--critical)' : 'var(--warning)',
                              }}>
                                {item.severity}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ padding: '3px 8px', borderRadius: 12, fontWeight: 700, fontSize: '0.7rem', color: badgeColor, background: badgeBg }}>
                                  {probPct}% ({item.prediction?.riskLevel})
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                              {item.prediction?.topFactors?.slice(0, 2).map(f => f.factor).join(', ') || 'Normal queue load'}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: isHigh ? 'var(--critical)' : 'var(--text-secondary)' }}>
                              {item.prediction?.recommendedAction || 'Monitor progress'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {slaLoading ? 'Calculating machine learning breach probabilities...' : 'All active work orders are within healthy SLA margins.'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
