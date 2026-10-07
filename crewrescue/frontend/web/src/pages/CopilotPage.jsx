import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, BookOpen, Search, ChevronDown, ChevronUp,
  Sparkles, User, RefreshCw, Trash2, X, Zap, Copy, Check,
  AlertCircle,
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

// ── Knowledge base categories ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: '',             label: 'All',          icon: '🔍' },
  { id: 'TRANSFORMER',  label: 'Transformer',  icon: '⚡' },
  { id: 'GENERATOR',    label: 'Generator',    icon: '🔋' },
  { id: 'HVAC',         label: 'HVAC',         icon: '❄️' },
  { id: 'HIGH_VOLTAGE', label: 'High Voltage', icon: '⚠️' },
  { id: 'FIBER_OPTIC',  label: 'Fiber Optic',  icon: '💡' },
  { id: 'WATER_PUMP',   label: 'Water Pump',   icon: '💧' },
  { id: 'PLC',          label: 'PLC',          icon: '🖥️' },
  { id: 'SOLAR_INVERTER', label: 'Solar',      icon: '☀️' },
  { id: 'SAFETY',       label: 'Safety',       icon: '🦺' },
  { id: 'GENERAL',      label: 'General',      icon: '📋' },
];

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

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={copy} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6,
      color: copied ? 'var(--success)' : 'var(--text-muted)',
      transition: 'color 0.2s',
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ── Chat message component ─────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  const hasError = msg.isError;

  return (
    <div style={{
      display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10, alignItems: 'flex-start', marginBottom: 18,
      animation: 'fadeIn 0.25s ease',
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, var(--brand-500), #6366f1)'
          : hasError
            ? 'rgba(239,68,68,0.15)'
            : 'linear-gradient(135deg, #1e1b4b, #312e81)',
        border: `2px solid ${isUser ? 'var(--brand-500)' : hasError ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.4)'}`,
        boxShadow: isUser ? '0 0 14px rgba(59,130,246,0.3)' : '0 0 14px rgba(99,102,241,0.2)',
      }}>
        {isUser
          ? <User size={14} style={{ color: '#fff' }} />
          : hasError
            ? <AlertCircle size={14} style={{ color: 'var(--critical)' }} />
            : <Bot size={14} style={{ color: '#a5b4fc' }} />
        }
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(59,130,246,0.2))'
            : hasError
              ? 'rgba(239,68,68,0.06)'
              : 'var(--bg-card)',
          border: `1px solid ${isUser
            ? 'rgba(99,102,241,0.3)'
            : hasError
              ? 'rgba(239,68,68,0.2)'
              : 'var(--border-subtle)'}`,
        }}>
          {msg.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#8B5CF6',
                    animation: `blink 1.4s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Searching knowledge base…</span>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: '0.83rem', lineHeight: 1.7, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
              </div>

              {/* Sources */}
              {msg.sources?.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
                    📚 Sources
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {msg.sources.map((src, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', background: 'var(--bg-elevated)',
                        borderRadius: 6, fontSize: '0.68rem', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        <BookOpen size={9} style={{ color: 'var(--brand-400)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{src.title}</span>
                        {src.pageRef && <span style={{ color: 'var(--text-muted)' }}>— {src.pageRef}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Method badge + copy */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                {msg.method && (
                  <span style={{
                    fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10,
                    background: msg.method === 'gemini_rag' ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.1)',
                    color: msg.method === 'gemini_rag' ? '#8B5CF6' : 'var(--text-muted)',
                    border: '1px solid rgba(139,92,246,0.2)', fontWeight: 600,
                  }}>
                    {msg.method === 'gemini_rag' ? '🤖 Gemini + RAG' : msg.method === 'keyword_stub' ? '🔍 Keyword Search' : msg.method}
                  </span>
                )}
                {!isUser && msg.content && <CopyBtn text={msg.content} />}
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Knowledge Base Panel ─────────────────────────────────────────────────────
function KnowledgePanel({ onClose }) {
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (catFilter) params.category = catFilter;
      if (search)    params.search   = search;
      const { data } = await api.get('/ai/knowledge', { params });
      setDocs(data.docs ?? []);
      setHasLoaded(true);
    } catch { toast.error('Failed to load knowledge base'); }
    finally { setLoading(false); }
  }, [catFilter, search]);

  useEffect(() => { loadDocs(); }, [catFilter]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 8000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 720, maxHeight: '70vh',
        background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-default)', borderBottom: 'none',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.9rem' }}>
              <BookOpen size={15} style={{ color: 'var(--brand-400)' }} />
              Knowledge Base
              <span style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10,
                background: 'var(--brand-glow)', color: 'var(--brand-400)',
                border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600,
              }}>{docs.length} docs</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={loadDocs} disabled={loading}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
              </button>
              <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={14} /></button>
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCatFilter(cat.id)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
                background: catFilter === cat.id ? 'var(--brand-glow)' : 'var(--bg-elevated)',
                color: catFilter === cat.id ? 'var(--brand-400)' : 'var(--text-muted)',
                border: `1px solid ${catFilter === cat.id ? 'rgba(59,130,246,0.3)' : 'var(--border-subtle)'}`,
                transition: 'all 0.15s',
              }}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              placeholder="Search knowledge base…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadDocs()}
              style={{ paddingLeft: 30, height: 34, fontSize: '0.78rem' }}
            />
          </div>
        </div>

        {/* Document list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 20px' }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10, marginBottom: 6 }} />)
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {hasLoaded ? 'No documents found' : 'Loading knowledge base…'}
            </div>
          ) : docs.map(doc => (
            <div key={doc._id} style={{
              padding: '10px 14px', background: 'var(--bg-elevated)',
              borderRadius: 10, border: '1px solid var(--border-subtle)',
              marginBottom: 5, cursor: 'default',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 2, color: 'var(--text-primary)' }}>{doc.title}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                <span style={{ background: 'rgba(59,130,246,0.08)', color: 'var(--brand-400)', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>{doc.category}</span>
                <span>{doc.source}</span>
                {doc.pageRef && <span>{doc.pageRef}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main CopilotPage ──────────────────────────────────────────────────────────
export default function CopilotPage() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [category, setCategory]   = useState('');
  const [showKB, setShowKB]       = useState(false);
  const scrollRef                 = useRef(null);
  const inputRef                  = useRef(null);

  // Welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `👋 Hi! I'm **CrewRescue Copilot** — your AI field service expert.\n\nI can help you with:\n• Equipment troubleshooting (transformers, generators, HVAC, fiber optic, HV switchgear)\n• Safety procedures and PPE requirements\n• Emergency response protocols\n• Fault codes and diagnostic procedures\n\nSelect a category above or ask me anything — I'll search the knowledge base and give you precise, actionable guidance.`,
      timestamp: Date.now(),
    }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg    = { role: 'user', content: q, timestamp: Date.now() };
    const loadingMsg = { role: 'assistant', content: '', loading: true, timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/copilot', {
        query: q,
        category: category || undefined,
      });

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
      const errorMsg = err.response?.data?.error ?? err.message ?? 'Please try again.';
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role:      'assistant',
          content:   `Sorry, I couldn't process your query right now.\n\nError: ${errorMsg}`,
          sources:   [],
          isError:   true,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages(prev => prev.slice(0, 1)); // keep welcome message
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', gap: 0, paddingBottom: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, letterSpacing: '-0.02em' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #8B5CF6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}>
              <Bot size={15} style={{ color: '#fff' }} />
            </div>
            CrewRescue Copilot
            <span style={{
              fontSize: '0.6rem', padding: '2px 8px', borderRadius: 10,
              background: 'rgba(139,92,246,0.15)', color: '#8B5CF6',
              border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700,
            }}>RAG · Gemini</span>
          </h2>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            AI field service expert · Powered by Gemini + equipment knowledge base
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowKB(true)}
          >
            <BookOpen size={13} /> Knowledge Base
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearChat}
            style={{ color: 'var(--text-muted)' }}
            title="Clear chat"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0 }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
            padding: '4px 11px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
            background: category === cat.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-elevated)',
            color: category === cat.id ? '#8B5CF6' : 'var(--text-muted)',
            border: `1px solid ${category === cat.id ? 'rgba(139,92,246,0.4)' : 'var(--border-subtle)'}`,
            transition: 'all 0.15s',
          }}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 0,
      }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}

          {/* Suggestions (show when only welcome message) */}
          {messages.length === 1 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Try asking…
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 7 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    padding: '9px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)',
                    transition: 'all 0.15s', lineHeight: 1.4,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.background = 'rgba(139,92,246,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <Sparkles size={11} style={{ color: '#8B5CF6', marginRight: 7, verticalAlign: 'middle' }} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding: '12px 16px 14px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.01)',
        }}>
          {category && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8B5CF6' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Filtering by: <strong style={{ color: '#8B5CF6' }}>{CATEGORIES.find(c => c.id === category)?.label}</strong>
              </span>
              <button onClick={() => setCategory('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, marginLeft: 2, display: 'flex', alignItems: 'center' }}>
                <X size={11} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about equipment troubleshooting, safety procedures, fault codes…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, resize: 'none',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px', color: 'var(--text-primary)',
                fontSize: '0.83rem', outline: 'none', lineHeight: 1.5,
                maxHeight: 140, overflowY: 'auto', fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                padding: '10px 16px', flexShrink: 0, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #8B5CF6, #6366f1)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (!input.trim() || loading) ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: '0 2px 12px rgba(139,92,246,0.4)',
              }}
            >
              {loading
                ? <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                : <Send size={15} style={{ color: '#fff' }} />
              }
            </button>
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Enter to send · Shift+Enter for newline · Powered by Gemini Flash + RAG
          </div>
        </div>
      </div>

      {/* Knowledge Base Modal */}
      {showKB && <KnowledgePanel onClose={() => setShowKB(false)} />}
    </div>
  );
}
