import { useEffect, useRef, useState } from 'react';
import { Plane, Send, X, Bot, User, RotateCcw } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AssistantView from './assistant/AssistantCards';
import ChatTypingIndicator from './ChatTypingIndicator';

const ROLE_LABEL = { employee: 'Employee', manager: 'Manager', admin: 'Admin' };

function loadingLabel(message) {
  const m = (message || '').toLowerCase();
  if (/plan_form|plan a trip|trip plan/.test(m)) return 'Planning your trip…';
  if (/hotel_form|hotel|stay|accommodation/.test(m)) return 'Finding hotels…';
  if (/flight|fly/.test(m)) return 'Searching flights…';
  if (/cheapest|compare|best value/.test(m)) return 'Comparing prices…';
  if (/invoice/.test(m)) return 'Loading invoice…';
  if (/ticket/.test(m)) return 'Loading ticket…';
  if (/approve|reject/.test(m)) return 'Processing decision…';
  if (/book|payment/.test(m)) return 'Processing booking…';
  if (/spend|cost|analytics|summary|how many/.test(m)) return 'Analyzing travel data…';
  if (/request|trip/.test(m)) return 'Loading requests…';
  if (/policy/.test(m)) return 'Checking travel policy…';
  return 'Working on it…';
}

/**
 * Error states are deliberately distinguished so an infrastructure failure is
 * never confused with an unknown intent:
 *   - network / proxy 502  -> "temporarily unavailable" + Retry
 *   - 401                 -> session expired (axios interceptor redirects to login)
 *   - 5xx                 -> assistant service failure + role options remain usable
 *   - 4xx with message    -> invalid request (message shown)
 */
function classifyError(err) {
  const status = err.response?.status;
  if (!err.response || status === 502 || status === 504) {
    return { kind: 'unavailable', text: 'Travel Assistant is temporarily unavailable. Please try again.' };
  }
  if (status === 401) return { kind: 'auth', text: 'Your session has expired. Please log in again.' };
  if (status >= 500) {
    return { kind: 'service', text: "I'm having trouble connecting to the AI service right now. You can still use the travel options below." };
  }
  return { kind: 'error', text: err.response?.data?.message || 'I ran into a problem. Please try again.' };
}

export default function TravelAssistant() {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [quickReplies, setQuickReplies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [startFailed, setStartFailed] = useState(false);
  const [retryText, setRetryText] = useState('');
  const [sessionId] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `s${Date.now()}`));
  const scrollRef = useRef(null);
  const startedRef = useRef(false);

  const loadStart = async () => {
    try {
      const res = await client.get('/assistant/start');
      setStartFailed(false);
      setMessages([{ role: 'assistant', text: res.data.welcome, view: { type: 'welcome', role: res.data.role } }]);
      setQuickReplies(res.data.quickActions || []);
    } catch (err) {
      setStartFailed(true);
      const { text } = classifyError(err);
      setMessages([{ role: 'assistant', text, errorKind: 'start' }]);
    }
  };

  useEffect(() => {
    if (!open || startedRef.current) return;
    startedRef.current = true;
    loadStart();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy, open]);

  const send = async (raw, retryOf) => {
    const message = String(raw || '').trim();
    if (!message || busy) return;
    setInput('');
    setRetryText('');
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const res = await client.post('/assistant/chat', { message, sessionId });
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply, view: data.view, actions: data.actions || [] },
      ]);
      if (data.quickReplies && data.quickReplies.length) {
        setQuickReplies(data.quickReplies.map((q) => ({ label: q, command: q })));
      }
    } catch (err) {
      const { kind, text } = classifyError(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text, view: { type: 'result', ok: false, message: text }, errorKind: kind },
      ]);
      if (kind === 'unavailable' || kind === 'service') setRetryText(retryOf || message);
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (command, downloadRequestId) => {
    if (downloadRequestId) {
      // Admin invoice download reuses the existing authenticated download endpoint.
      try {
        const res = await client.get(`/invoices/${downloadRequestId}/download`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${downloadRequestId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Invoice downloaded.');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Invoice download failed.');
      }
      return;
    }
    send(command);
  };

  const roleName = ROLE_LABEL[user?.role] || (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '');

  return (
    <>
      {/* Floating launcher */}
      <button
        className="btn btn-lift d-inline-flex align-items-center gap-2 text-white fw-semibold shadow"
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 1100,
          background: 'linear-gradient(135deg, #134e4a, #0f9488)',
          border: 'none',
          borderRadius: '2rem',
          padding: '0.65rem 1.1rem',
          boxShadow: '0 8px 24px rgba(15, 118, 110, 0.35)',
        }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle travel assistant"
      >
        <Plane size={18} /> Travel AI
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="d-flex flex-column bg-white rounded-4 shadow-lg overflow-hidden assistant-panel anim-scale-in"
          style={{ position: 'fixed', right: 20, bottom: 80, zIndex: 1100, width: 'min(400px, calc(100vw - 40px))', maxHeight: 'min(640px, calc(100vh - 120px))' }}
        >
          {/* Header */}
          <div className="bg-brand-gradient text-white px-3 py-2 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span className="rounded-circle d-inline-flex align-items-center justify-content-center" style={{ width: 30, height: 30, background: 'rgba(255,255,255,0.18)' }}>
                <Bot size={16} />
              </span>
              <div>
                <div className="fw-bold small lh-sm">Corporate Travel Assistant</div>
                <span className="badge text-bg-light" style={{ fontSize: '0.62rem' }}>{roleName || '—'}</span>
              </div>
            </div>
            <button className="btn btn-sm text-white p-1 border-0" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-grow-1 p-3 overflow-auto" style={{ background: '#f8fafc', minHeight: 280 }}>
            {messages.map((m, i) => (
              <div key={i} className={`d-flex mb-3 ${m.role === 'user' ? 'justify-content-end chat-message-out' : 'justify-content-start chat-message-in'}`}>
                {m.role === 'assistant' && (
                  <span className="rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 me-2" style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #134e4a, #0f9488)', marginTop: 4 }}>
                    <Bot size={14} />
                  </span>
                )}
                <div className={`rounded-3 px-3 py-2 ${m.role === 'user' ? 'bg-brand-gradient text-white' : 'bg-white border'}`} style={{ maxWidth: '82%' }}>
                  {m.role === 'user' ? (
                    <div className="small" style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                  ) : (
                    <>
                      <div className="small" style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                      <AssistantView view={m.view} role={user?.role} onAction={handleAction} />
                      {m.actions && m.actions.length > 0 && (
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          {m.actions.map((a, j) =>
                            a.link ? (
                              <a key={j} href={a.link} className={`btn btn-sm ${a.variant === 'primary' ? 'btn-primary' : 'btn-outline-secondary'}`}>{a.label}</a>
                            ) : (
                              <button key={j} className={`btn btn-sm btn-lift ${a.variant === 'primary' ? 'btn-primary' : a.variant === 'success' ? 'btn-success' : a.variant === 'danger' ? 'btn-danger' : 'btn-outline-secondary'}`} onClick={() => (a.type === 'download_invoice' ? handleAction(null, a.requestId) : handleAction(a.command))}>
                                {a.label}
                              </button>
                            )
                          )}
                        </div>
                      )}
                      {m.errorKind && (
                        <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 mt-2" onClick={() => (m.errorKind === 'start' ? loadStart() : retryText ? send(retryText, retryText) : null)}>
                          <RotateCcw size={12} /> Retry
                        </button>
                      )}
                    </>
                  )}
                </div>
                {m.role === 'user' && (
                  <span className="rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 ms-2" style={{ width: 28, height: 28, background: '#64748b', marginTop: 4 }}>
                    <User size={14} />
                  </span>
                )}
              </div>
            ))}
            {busy && <ChatTypingIndicator label={loadingLabel(messages[messages.length - 1]?.text)} />}
            {startFailed && !busy && messages.length === 1 && (
              <div className="small text-muted">
                The assistant couldn't load. Make sure the backend is running on port 5000 (the frontend proxies /api to it).
              </div>
            )}
          </div>

          {/* Quick replies */}
          {quickReplies.length > 0 && (
            <div className="px-3 pt-2 d-flex flex-wrap gap-1" style={{ background: '#f8fafc' }}>
              {quickReplies.slice(0, 6).map((q, i) => (
                <button key={i} className="btn btn-sm btn-outline-primary rounded-pill quick-action-btn" disabled={busy} onClick={() => send(q.command || q.label)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-2 border-top d-flex gap-2" style={{ background: '#fff' }}>
            <input
              className="form-control form-control-sm"
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
              disabled={busy}
            />
            <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" disabled={busy || !input.trim()} onClick={() => send(input)}>
              {busy ? <span className="spinner-border spinner-border-sm" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
