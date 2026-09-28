import { useState } from 'react';
import { Zap, Send, Tag, Wrench, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const SEV_COLORS = { CRITICAL: 'var(--critical)', HIGH: 'var(--warning)', MEDIUM: 'var(--info)', LOW: 'var(--text-muted)' };
const URGENCY_COLORS = { IMMEDIATE: 'var(--critical)', URGENT: 'var(--warning)', STANDARD: 'var(--info)', ROUTINE: 'var(--text-muted)' };

const EXAMPLES = [
  'Complete power outage at Gulshan-2 residential tower. Server room temperature rising — UPS activated.',
  'HVAC compressor failure at Motijheel data center. Room at 32°C and climbing fast.',
  'Fiber cable damaged by road construction near Mirpur-10. 500 customers affected.',
  'Transformer explosion at Tejgaon industrial area. Sparks visible, area evacuated.',
];

export default function AITriagePage() {
  const [text, setText]                 = useState('');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [creating, setCreating]         = useState(false);
  const [created, setCreated]           = useState(null);
  const [dispatcherQuery, setDispatcherQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult]   = useState(null);

  async function handleTriage(e) {
    e.preventDefault();
    if (text.trim().length < 10) return toast.error('Please enter a more detailed description');
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/ai/triage', { text });
      setResult(data.classification);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Triage failed');
    } finally { setLoading(false); }
  }

  async function handleCreateIncident() {
    if (!result) return;
    setCreating(true);
    try {
      const count = await api.get('/incidents?limit=1').then(r => r.data.total ?? 0);
      const { data } = await api.post('/incidents', {
        title: `[AI] ${result.category.replace(/_/g, ' ')} — Auto-triaged`,
        description: text,
        category: result.category,
        severity: result.severity,
        type: result.sla_urgency === 'IMMEDIATE' ? 'EMERGENCY' : 'BREAK_FIX',
        isEmergency: result.sla_urgency === 'IMMEDIATE',
        requiredSkills: result.required_skills ?? [],
        location: { type: 'Point', coordinates: [90.4125, 23.8103], area: 'Dhaka Metropolitan' },
      });
      setCreated(data.incident);
      toast.success(`Incident ${data.incident.workOrderNumber} created`);
    } catch (err) {
      toast.error(err.response?.data?.error ?? 'Failed to create incident');
    } finally { setCreating(false); }
  }

  async function handleDispatcherQuery(e) {
    e.preventDefault();
    if (!dispatcherQuery.trim()) return;
    setQueryLoading(true);
    setQueryResult(null);
    try {
      const { data } = await api.post('/ai/dispatcher-query', { query: dispatcherQuery });
      setQueryResult(data.response);
    } catch { toast.error('Query failed'); }
    finally { setQueryLoading(false); }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: 'var(--brand-400)' }} /> AI Triage Assistant
        </h2>
        <div className="text-xs text-muted">
          Powered by Gemini 1.5 Flash · Automatic incident classification and skill recommendation
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Triage input */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title"><Send size={14} /> Incident Triage</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleTriage} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Incident Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the incident in plain language…"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    style={{ minHeight: 120, resize: 'vertical' }}
                  />
                </div>

                {/* Example buttons */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Examples</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {EXAMPLES.map((ex, i) => (
                      <button
                        key={i} type="button"
                        onClick={() => setText(ex)}
                        style={{
                          textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', fontSize: '0.72rem', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.target.style.borderColor = 'var(--brand-500)'}
                        onMouseLeave={e => e.target.style.borderColor = 'var(--border-subtle)'}
                      >
                        {ex.length > 80 ? ex.slice(0, 80) + '…' : ex}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading || text.trim().length < 10}>
                  {loading
                    ? <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Analyzing…</>
                    : <><Zap size={13} /> Classify Incident</>}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <div className="card fade-in" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div className="card-title"><CheckCircle size={14} style={{ color: 'var(--success)' }} /> Classification Result</div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>via {result.method === 'gemini' ? '✨ Gemini AI' : '🔤 Keyword Fallback'}</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Summary */}
                <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)', borderLeft: `3px solid var(--brand-500)` }}>
                  {result.summary}
                </div>

                {/* Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Category', value: result.category?.replace(/_/g, ' '), icon: <Tag size={12} /> },
                    {
                      label: 'Severity',
                      value: result.severity,
                      color: SEV_COLORS[result.severity],
                      icon: <AlertTriangle size={12} />,
                    },
                    {
                      label: 'SLA Urgency',
                      value: result.sla_urgency,
                      color: URGENCY_COLORS[result.sla_urgency],
                      icon: <Clock size={12} />,
                    },
                  ].map(m => (
                    <div key={m.label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {m.icon}{m.label}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: m.color ?? 'var(--text-primary)' }}>
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Required skills */}
                {result.required_skills?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Wrench size={11} /> Required Skills
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.required_skills.map(s => (
                        <span key={s} className="badge brand">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended parts */}
                {result.recommended_parts?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      🔩 Recommended Parts
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.recommended_parts.map(p => (
                        <span key={p} style={{ padding: '3px 8px', borderRadius: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create button */}
                {!created ? (
                  <button
                    className={`btn ${result.severity === 'CRITICAL' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={handleCreateIncident}
                    disabled={creating}
                  >
                    {creating
                      ? <><div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
                      : `Create ${result.severity} Incident`}
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)' }}>
                    <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>
                      Created: {created.workOrderNumber}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)',
            }}>
              <Zap size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
              <div style={{ fontSize: '0.85rem' }}>Classification results will appear here</div>
            </div>
          )}

          {/* Dispatcher Assistant */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">💬 Dispatcher Assistant</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleDispatcherQuery} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  className="form-input"
                  placeholder="Ask anything… e.g. 'Who is best for fiber optic work in Gulshan?'"
                  value={dispatcherQuery}
                  onChange={e => setDispatcherQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-ghost btn-sm" disabled={queryLoading || !dispatcherQuery.trim()}>
                  {queryLoading ? <><div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Thinking…</> : 'Ask AI'}
                </button>
              </form>
              {queryResult && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, borderLeft: '3px solid var(--brand-500)' }}>
                  {queryResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
