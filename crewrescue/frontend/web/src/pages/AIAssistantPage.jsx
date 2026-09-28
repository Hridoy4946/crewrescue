import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, Trash2, Zap, AlertTriangle, Users, Ticket, Sparkles, ChevronDown, Copy, Check, StopCircle } from 'lucide-react';
import api from '../lib/api.js';
import ReactMarkdown from 'react-markdown';

// ── Suggested starter prompts ─────────────────────────────────────────────────
const STARTERS = [
  { icon: '🚨', text: 'What are the most critical tickets right now?' },
  { icon: '👷', text: 'How many technicians are available and where?' },
  { icon: '📊', text: 'Give me the full operational status summary' },
  { icon: '⚡', text: 'How do I respond to a transformer explosion?' },
  { icon: '📡', text: 'Steps to isolate a fiber cut affecting 500+ customers' },
  { icon: '🔧', text: 'Who should I dispatch for an 11kV switchgear fault?' },
];

// ── Simple markdown renderer (inline safe) ────────────────────────────────────
function MessageContent({ text }) {
  return (
    <div className="ai-message-md">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.65 }}>{children}</p>,
          strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{children}</strong>,
          ul: ({ children }) => <ul style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ul>,
          ol: ({ children }) => <ol style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>,
          li: ({ children }) => <li style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{children}</li>,
          code: ({ children }) => <code style={{ background: 'rgba(139,92,246,0.15)', padding: '2px 6px', borderRadius: 4, fontSize: '0.8em', color: 'var(--brand-300)', fontFamily: 'monospace' }}>{children}</code>,
          h1: ({ children }) => <h1 style={{ fontSize: '1rem', fontWeight: 700, margin: '10px 0 6px', color: 'var(--text-primary)' }}>{children}</h1>,
          h2: ({ children }) => <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '10px 0 5px', color: 'var(--text-primary)' }}>{children}</h2>,
          h3: ({ children }) => <h3 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '8px 0 4px', color: 'var(--text-secondary)' }}>{children}</h3>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Context status pill ───────────────────────────────────────────────────────
function ContextPill({ ctx }) {
  if (!ctx) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
        <Ticket size={10} /> {ctx.openTickets} open ({ctx.criticalTickets} critical)
      </span>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
        <Users size={10} /> {ctx.availableTechs}/{ctx.totalTechs} available
      </span>
      {ctx.emergencyActive && (
        <span style={{ fontSize: '0.65rem', color: 'var(--critical)', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
          <AlertTriangle size={10} /> EMERGENCY ACTIVE
        </span>
      )}
    </div>
  );
}

// ── Single message bubble ─────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  function copy() {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      animation: 'fadeSlideIn 0.25s ease',
    }}>
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, var(--brand-600), var(--brand-400))'
          : 'linear-gradient(135deg, #1e1b4b, #312e81)',
        border: `2px solid ${isUser ? 'var(--brand-500)' : 'rgba(139,92,246,0.3)'}`,
        boxShadow: isUser ? '0 0 12px rgba(139,92,246,0.4)' : '0 0 12px rgba(99,102,241,0.3)',
      }}>
        {isUser
          ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>ME</span>
          : <Bot size={16} style={{ color: '#a5b4fc' }} />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '78%', minWidth: 0 }}>
        <div style={{
          padding: '12px 16px',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          background: isUser
            ? 'linear-gradient(135deg, var(--brand-600), var(--brand-500))'
            : 'var(--bg-card)',
          border: isUser ? 'none' : '1px solid var(--border-default)',
          boxShadow: isUser
            ? '0 4px 16px rgba(139,92,246,0.35)'
            : '0 2px 8px rgba(0,0,0,0.2)',
          fontSize: '0.84rem',
          color: isUser ? '#fff' : 'var(--text-secondary)',
          lineHeight: 1.6,
          position: 'relative',
        }}>
          {msg.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--brand-400)',
                    animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>CrewRescue AI is thinking…</span>
            </div>
          ) : isUser ? (
            <span>{msg.text}</span>
          ) : (
            <>
              <MessageContent text={msg.text} />
              {msg.context && <ContextPill ctx={msg.context} />}
            </>
          )}

          {/* Copy button for AI messages */}
          {!isUser && !msg.loading && (
            <button
              onClick={copy}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer',
                padding: 4, borderRadius: 4, display: 'flex',
                opacity: 0.6, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
              title="Copy response"
            >
              {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 4, textAlign: isUser ? 'right' : 'left' }}>
          {isUser ? 'You' : '🤖 CrewRescue AI · Gemini 3.8 Flash'} · {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ── Main AI Assistant Page ────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm **CrewRescue AI**, your intelligent operations assistant powered by Gemini 3.8 Flash.\n\nI have real-time access to your live operational data — ticket queues, technician availability, emergency status, and SLA breaches. I can also help with technical procedures, dispatch planning, and field safety.\n\n**What can I help you with today?**",
      ts: Date.now(),
      context: null,
    }
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const inputRef                = useRef(null);
  const [showScroll, setShowScroll] = useState(false);
  const chatRef                 = useRef(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll-to-bottom detector
  function onScroll() {
    const el = chatRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScroll(distFromBottom > 120);
  }

  const sendMessage = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    // Append user message
    const userMsg = { role: 'user', text: userText, ts: Date.now() };
    // Append loading indicator
    const loadingMsg = { role: 'assistant', text: '', loading: true, ts: Date.now() + 1 };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setLoading(true);

    // Build history (exclude loading placeholder, error messages, and greetings)
    const historyForAPI = messages
      .filter(m => !m.loading && !m.text?.startsWith('❌ **Error:**'))
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));

    try {
      const { data } = await api.post('/ai/chat', {
        message: userText,
        history: historyForAPI,
      });

      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        {
          role: 'assistant',
          text: data.reply,
          context: data.context,
          ts: Date.now(),
        }
      ]);
    } catch (err) {
      const errText = err.response?.data?.error || 'Failed to get a response. Please try again.';
      setMessages(prev => [
        ...prev.filter(m => !m.loading),
        { role: 'assistant', text: `❌ **Error:** ${errText}`, ts: Date.now() }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage();
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      text: "Chat cleared. I'm ready for your next question!",
      ts: Date.now(),
    }]);
    setInput('');
  }

  return (
    <div className="page-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0 }}>
      {/* Keyframe styles */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1; }
        }
        .ai-message-md > *:last-child { margin-bottom: 0 !important; }
        .starter-btn:hover {
          border-color: var(--brand-500) !important;
          background: rgba(139,92,246,0.1) !important;
          color: var(--brand-300) !important;
          transform: translateY(-1px);
        }
        .send-btn:hover:not(:disabled) { transform: scale(1.05); }
        .send-btn:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-card)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(139,92,246,0.5)',
            animation: 'pulse 3s ease-in-out infinite',
          }}>
            <Sparkles size={18} style={{ color: '#c4b5fd' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              CrewRescue AI Assistant
              <span style={{
                fontSize: '0.6rem', padding: '2px 7px', borderRadius: 20,
                background: 'linear-gradient(90deg, rgba(79,70,229,0.3), rgba(124,58,237,0.3))',
                color: '#a5b4fc', fontWeight: 600, border: '1px solid rgba(139,92,246,0.3)',
              }}>
                Gemini 3.8 Flash
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
              Live telemetry · Multi-turn conversation · Field operations expert
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--critical)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <Trash2 size={13} /> Clear chat
        </button>
      </div>

      {/* ── Message Area ── */}
      <div
        ref={chatRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          background: 'var(--bg-base)',
        }}
      >
        {/* Welcome starter grid — show when only 1 message (the greeting) */}
        {messages.length === 1 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
              Quick Starters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {STARTERS.map(s => (
                <button
                  key={s.text}
                  className="starter-btn"
                  onClick={() => sendMessage(s.text)}
                  disabled={loading}
                  style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: '0.78rem', textAlign: 'left', lineHeight: 1.4,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '1.1rem', marginBottom: 4 }}>{s.icon}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Scroll-to-bottom fab */}
      {showScroll && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            position: 'absolute', bottom: 96, right: 32,
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--brand-600)', border: 'none',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139,92,246,0.4)',
            transition: 'transform 0.15s',
          }}
        >
          <ChevronDown size={16} />
        </button>
      )}

      {/* ── Input Bar ── */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-card)',
        flexShrink: 0,
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{
            flex: 1, position: 'relative',
            background: 'var(--bg-elevated)',
            borderRadius: 14,
            border: `1px solid ${loading ? 'var(--brand-500)' : 'var(--border-default)'}`,
            transition: 'border-color 0.2s',
            boxShadow: loading ? '0 0 0 3px rgba(139,92,246,0.15)' : 'none',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask anything… e.g. 'Which critical tickets need immediate attention?'"
              rows={1}
              disabled={loading}
              style={{
                width: '100%', resize: 'none', border: 'none', outline: 'none',
                background: 'transparent', padding: '12px 16px',
                color: 'var(--text-primary)', fontSize: '0.875rem',
                fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 160, overflowY: 'auto',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: '0.62rem', color: 'var(--text-muted)',
            }}>
              Enter to send · Shift+Enter for newline
            </div>
          </div>

          <button
            type="submit"
            className="send-btn"
            disabled={!input.trim() || loading}
            style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, var(--brand-600), var(--brand-500))'
                : 'var(--bg-elevated)',
              border: `1px solid ${input.trim() && !loading ? 'transparent' : 'var(--border-default)'}`,
              color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: input.trim() && !loading ? '0 4px 16px rgba(139,92,246,0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {loading
              ? <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <Send size={18} />}
          </button>
        </form>

        <div style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          <Zap size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
          AI responses are grounded in live DB data · Always verify critical decisions with your team
        </div>
      </div>
    </div>
  );
}
