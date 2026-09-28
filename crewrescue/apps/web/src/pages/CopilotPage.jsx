import { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, BookOpen, Search, ChevronDown,
  Sparkles, User, AlertCircle, RefreshCw, Trash2,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

// ── Knowledge base categories ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: '',             label: 'All Categories', icon: '🔍' },
  { id: 'TRANSFORMER',  label: 'Transformer',    icon: '⚡' },
  { id: 'GENERATOR',    label: 'Generator',      icon: '🔋' },
  { id: 'HVAC',         label: 'HVAC',           icon: '❄️' },
  { id: 'HIGH_VOLTAGE', label: 'High Voltage',   icon: '⚠️' },
  { id: 'FIBER_OPTIC',  label: 'Fiber Optic',    icon: '💡' },
  { id: 'WATER_PUMP',   label: 'Water Pump',     icon: '💧' },
  { id: 'PLC',          label: 'PLC',            icon: '🖥️' },
  { id: 'SOLAR_INVERTER', label: 'Solar',        icon: '☀️' },
  { id: 'SAFETY',       label: 'Safety',         icon: '🦺' },
  { id: 'GENERAL',      label: 'General',        icon: '📋' },
];

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  'How do I isolate an ABB T400 transformer fault safely?',
  'What are the PPE requirements for arc flash category 3?',
  'How do I perform an emergency start on a Cummins QSB7 generator?',
  'What does a Buchholz relay alarm indicate on a transformer?',
  'How do I test a fiber optic splice with an OTDR?',
  'What atmospheric tests are required before entering a utility manhole?',
  'How do I reset a Siemens S7-300 PLC from STOP mode?',
  'What does Fronius Symo state code 307 mean?',
];

// ── Chat message component ─────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10, alignItems: 'flex-start', marginBottom: 16,
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? 'var(--brand-400)' : 'rgba(139,92,246,0.2)',
        border: `1px solid ${isUser ? 'var(--brand-500)' : 'rgba(139,92,246,0.4)'}`,
      }}>
        {isUser
          ? <User size={15} style={{ color: '#fff' }} />
          : <Bot size={15} style={{ color: '#8B5CF6' }} />
        }
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '75%', padding: '12px 16px', borderRadius: 16,
        borderTopRightRadius: isUser ? 4 : 16,
        borderTopLeftRadius:  isUser ? 16 : 4,
        background: isUser
          ? 'rgba(99,102,241,0.15)'
          : 'var(--bg-elevated)',
        border: `1px solid ${isUser ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
      }}>
        {msg.loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Thinking…</span>
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '0.83rem', lineHeight: 1.6, color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>

            {/* Sources */}
            {msg.sources?.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                  Sources
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {msg.sources.map((src, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 8px', background: 'var(--bg-surface)', borderRadius: 6,
                      fontSize: '0.68rem', color: 'var(--text-secondary)',
                    }}>
                      <BookOpen size={10} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{src.title}</span>
                      {src.pageRef && <span style={{ color: 'var(--text-muted)' }}>— {src.pageRef}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Method badge */}
            {msg.method && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: '0.6rem', padding: '2px 6px', borderRadius: 10,
                  background: msg.method === 'gemini_rag' ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.1)',
                  color: msg.method === 'gemini_rag' ? '#8B5CF6' : 'var(--text-muted)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  fontWeight: 600,
                }}>
                  {msg.method === 'gemini_rag' ? '🤖 Gemini + RAG' : msg.method === 'keyword_stub' ? '🔍 Keyword Search' : msg.method}
                </span>
              </div>
            )}

            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Knowledge Base Document list ─────────────────────────────────────────────
function KnowledgePanel({ visible }) {
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]       = useState('');

  const loadDocs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (catFilter) params.category = catFilter;
      if (search)    params.search   = search;
      const { data } = await api.get('/ai/knowledge', { params });
      setDocs(data.docs ?? []);
    } catch { toast.error('Failed to load knowledge base'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (visible) loadDocs(); }, [visible, catFilter]);

  if (!visible) return null;

  return (
    <div style={{
      borderTop: '1px solid var(--border-subtle)', paddingTop: 16,
      maxHeight: 320, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <BookOpen size={13} style={{ color: 'var(--brand-400)' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Knowledge Base ({docs.length} documents)
        </span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', padding: '2px 8px', height: 24 }} onClick={loadDocs}>
          <RefreshCw size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.slice(0, 6).map(cat => (
          <button
            key={cat.id}
            onClick={() => setCatFilter(cat.id)}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
              background: catFilter === cat.id ? 'var(--brand-400)' : 'var(--bg-elevated)',
              color: catFilter === cat.id ? '#fff' : 'var(--text-muted)',
              border: `1px solid ${catFilter === cat.id ? 'var(--brand-400)' : 'var(--border-subtle)'}`,
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)
          : docs.map(doc => (
            <div key={doc._id} style={{
              padding: '7px 10px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{doc.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                {doc.source ?? doc.category} {doc.pageRef && `· ${doc.pageRef}`}
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Main CopilotPage ──────────────────────────────────────────────────────────
export default function CopilotPage() {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [category, setCategory]       = useState('');
  const [showKB, setShowKB]           = useState(false);
  const scrollRef                     = useRef(null);

  // Welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `👋 Hi, I'm **CrewRescue Copilot** — your AI field service expert.\n\nI can help you with:\n• Equipment troubleshooting (transformers, generators, HVAC, fiber, HV switchgear)\n• Safety procedures and PPE requirements\n• Emergency response protocols\n• Optimization of your crew schedule\n\nAsk me anything — I'll search the knowledge base and draw on equipment manuals to give you precise, actionable guidance.`,
      timestamp: Date.now(),
      method: null,
    }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const q = (text ?? input).trim();
    if (!q) return;

    const userMsg = { role: 'user', content: q, timestamp: Date.now() };
    const loadingMsg = { role: 'assistant', content: '', loading: true, timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/copilot', { query: q, category: category || undefined });
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role:      'assistant',
          content:   data.response,
          sources:   data.sources ?? [],
          method:    data.method,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role:      'assistant',
          content:   `❌ Sorry, I couldn't process your query right now. ${err.response?.data?.error ?? 'Please try again.'}`,
          sources:   [],
          timestamp: Date.now(),
        },
      ]);
    } finally { setLoading(false); }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} style={{ color: '#8B5CF6' }} />
            CrewRescue Copilot
            <span style={{
              fontSize: '0.62rem', padding: '2px 8px', borderRadius: 10,
              background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
              border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700,
            }}>RAG-Powered</span>
          </h2>
          <div className="text-xs text-muted">
            AI field service expert · Equipment manuals · Safety protocols · Powered by Gemini + knowledge base
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowKB(v => !v)}
            style={{ gap: 4 }}
          >
            <BookOpen size={13} />
            Knowledge Base
            <ChevronDown size={12} style={{ transform: showKB ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMessages(messages.slice(0, 1))}
            style={{ color: 'var(--text-muted)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            style={{
              padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
              background: category === cat.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-elevated)',
              color: category === cat.id ? '#8B5CF6' : 'var(--text-muted)',
              border: `1px solid ${category === cat.id ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
              transition: 'all 0.2s',
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {messages.map((msg, i) => (
            <ChatMessage key={i} msg={msg} />
          ))}

          {/* Suggestions (only when only 1 message = welcome) */}
          {messages.length === 1 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Try asking…
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    style={{
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                      textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <Sparkles size={11} style={{ color: '#8B5CF6', marginRight: 6, verticalAlign: 'middle' }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Knowledge Base panel */}
        {showKB && (
          <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
            <KnowledgePanel visible={showKB} />
          </div>
        )}

        {/* Input area */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about equipment troubleshooting, safety procedures, fault codes…"
            rows={1}
            style={{
              flex: 1, resize: 'none', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
              padding: '10px 14px', color: 'var(--text-primary)', fontSize: '0.83rem',
              outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.5)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; }}
            disabled={loading}
          />
          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              padding: '10px 14px', flexShrink: 0,
              background: 'linear-gradient(135deg, #8B5CF6, var(--brand-400))',
              borderColor: 'transparent',
            }}
          >
            {loading
              ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              : <Send size={15} />
            }
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6, flexShrink: 0 }}>
        Copilot retrieves from 15 equipment manual sections · Powered by Gemini 1.5 Flash + text-embedding-004 · Answers may vary — always verify with official documentation
      </div>
    </div>
  );
}
