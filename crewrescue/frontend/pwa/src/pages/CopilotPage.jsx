import { useState } from 'react';
import { Bot, Send, Sparkles } from 'lucide-react';
import api from '../lib/api.js';

const QUICK_PROMPTS = [
  'How do I isolate an 11kV transformer fault?',
  'Arc flash PPE requirements for 480V panel?',
  'Emergency generator won\'t start — what to check?',
  'Fiber OTDR splice loss acceptance criteria?',
  'Confined space oxygen level requirements?',
];

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? 'var(--brand)' : 'rgba(139,92,246,0.2)',
        fontSize: '0.8rem',
      }}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div style={{
        maxWidth: '80%', padding: '10px 14px', borderRadius: 16,
        borderTopRightRadius: isUser ? 4 : 16,
        borderTopLeftRadius:  isUser ? 16 : 4,
        background: isUser ? 'rgba(99,102,241,0.2)' : 'var(--bg-elevated)',
        border: `1px solid ${isUser ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
      }}>
        {msg.loading ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div className="spinner" style={{ width: 14, height: 14 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Thinking…</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            {msg.sources?.length > 0 && (
              <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                {msg.sources.map((s, i) => (
                  <div key={i} style={{ fontSize: '0.65rem', color: 'var(--brand-light)', marginTop: 2 }}>
                    📖 {s.title}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState([{
    role: 'assistant', content: 'Hi! I\'m your field copilot. Ask me about equipment troubleshooting, safety procedures, or fault codes.', timestamp: Date.now(),
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(text) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: q, timestamp: Date.now() }, { role: 'assistant', loading: true, timestamp: Date.now() }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/copilot', { query: q });
      setMessages(p => [...p.slice(0, -1), { role: 'assistant', content: data.response, sources: data.sources, timestamp: Date.now() }]);
    } catch {
      setMessages(p => [...p.slice(0, -1), { role: 'assistant', content: '❌ Offline — try connecting to WiFi.', timestamp: Date.now() }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Bot size={18} style={{ color: '#8B5CF6' }} />
        <span style={{ fontWeight: 700 }}>Field Copilot</span>
        <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 700 }}>RAG</span>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}

        {messages.length === 1 && (
          <div style={{ marginTop: 10 }}>
            <div className="section-label" style={{ marginBottom: 8 }}>Quick Questions</div>
            {QUICK_PROMPTS.map((p, i) => (
              <button key={i} onClick={() => send(p)} style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: 8,
                padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                fontSize: '0.78rem', color: 'var(--text-secondary)',
              }}>
                <Sparkles size={11} style={{ color: '#8B5CF6', verticalAlign: 'middle', marginRight: 6 }} />{p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <textarea
          className="input"
          rows={1}
          placeholder="Ask about troubleshooting, safety, fault codes…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ flex: 1, resize: 'none' }}
          disabled={loading}
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={!input.trim() || loading}
          style={{ padding: '10px 14px', background: 'linear-gradient(135deg, #8B5CF6, var(--brand))' }}>
          {loading ? <div className="spinner" style={{ width: 15, height: 15 }} /> : <Send size={15} />}
        </button>
      </div>
    </div>
  );
}
