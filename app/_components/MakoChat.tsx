'use client';

// =============================================================================
// MakoChat — chat con MaKo (Claude) con sesiones, reutilizable
// =============================================================================
// Sesiones (New Chat + renombrar/pinear/archivar/borrar), gráfico fijo arriba
// (colapsable) con scroll de mensajes independiente, sugerencias en una línea.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { MakoLoader } from './MakoLoader';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

// Preguntas sugeridas por defecto: si un gráfico no trae las suyas, igual
// SIEMPRE aparecen sugerencias (en todos los gráficos).
const DEFAULT_SUGERENCIAS = [
  '¿Qué es lo más importante acá?',
  '¿Qué está fallando?',
  '¿Qué hago esta semana?',
  '¿Cómo lo mejoro?',
];

type Msg = { role: 'user' | 'assistant'; content: string };
type Session = { id: number; titulo: string | null; updated_at: string; pinned?: boolean };

function renderInline(text: string, k: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={`${k}-${i}`}>{p.slice(2, -2)}</strong> : <span key={`${k}-${i}`}>{p}</span>,
  );
}
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (!bullets.length) return;
    const items = bullets;
    blocks.push(<ul key={`ul-${blocks.length}`} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>{items.map((b, i) => <li key={i} style={{ lineHeight: 1.5 }}>{renderInline(b, `li-${blocks.length}-${i}`)}</li>)}</ul>);
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    flush();
    if (t === '') return;
    if (/^---+$/.test(t)) { blocks.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) { const lvl = h[1].length; blocks.push(<div key={idx} style={{ fontWeight: 600, fontSize: lvl === 1 ? 16 : lvl === 2 ? 15 : 14, color: 'var(--ink)', margin: '6px 0 2px' }}>{renderInline(h[2], `h-${idx}`)}</div>); return; }
    blocks.push(<p key={idx} style={{ margin: '3px 0', lineHeight: 1.55 }}>{renderInline(t, `p-${idx}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

const icoBtn = { width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const;

export function MakoChat({
  chartKey, titulo, contexto = '', sugerencias = [], chart, initialSessionId,
}: {
  chartKey: string; titulo: string; contexto?: string; sugerencias?: string[]; chart?: ReactNode; initialSessionId?: number;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(initialSessionId ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [pensando, setPensando] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [verChats, setVerChats] = useState(false);
  const [chartAbierto, setChartAbierto] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sugerencias efectivas: las del gráfico, o el set por defecto si no trae.
  const sugs = sugerencias.length ? sugerencias : DEFAULT_SUGERENCIAS;

  const refrescarSesiones = async () => {
    const j = await fetch(`/api/chart-insights?chartKey=${encodeURIComponent(chartKey)}`).then((r) => r.json());
    setSessions(j.sessions ?? []);
    return (j.sessions ?? []) as Session[];
  };

  useEffect(() => {
    let alive = true;
    setErr(null);
    (async () => {
      try {
        if (initialSessionId) {
          const [mRes, sRes] = await Promise.all([
            fetch(`/api/chart-insights?sessionId=${initialSessionId}`).then((r) => r.json()),
            fetch(`/api/chart-insights?chartKey=${encodeURIComponent(chartKey)}`).then((r) => r.json()),
          ]);
          if (!alive) return;
          setMessages(mRes.messages ?? []); setSessions(sRes.sessions ?? []); setSessionId(initialSessionId);
        } else {
          setPensando(true);
          const j = await fetch('/api/chart-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', chartKey, titulo, contexto }) }).then((r) => r.json());
          if (!alive) return;
          if (j.error) setErr(j.error); else { setSessions(j.sessions ?? []); setSessionId(j.session?.id ?? null); setMessages(j.messages ?? []); }
        }
      } catch (e) { if (alive) setErr(String(e)); } finally { if (alive) setPensando(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, initialSessionId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, pensando]);

  const nuevoChat = async () => {
    if (pensando) return;
    setPensando(true); setErr(null); setVerChats(false); setMessages([]);
    try {
      const j = await fetch('/api/chart-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'new', chartKey, titulo, contexto }) }).then((r) => r.json());
      if (j.error) setErr(j.error); else { setSessions(j.sessions ?? []); setSessionId(j.session?.id ?? null); setMessages(j.messages ?? []); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  const abrirSesion = async (id: number) => {
    setVerChats(false);
    if (id === sessionId) return;
    setPensando(true); setErr(null);
    try {
      const j = await fetch(`/api/chart-insights?sessionId=${id}`).then((r) => r.json());
      if (j.error) setErr(j.error); else { setMessages(j.messages ?? []); setSessionId(id); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  const accion = async (a: 'pin' | 'archive' | 'delete' | 'rename', id: number, extra: { valor?: boolean; titulo?: string } = {}) => {
    await fetch('/api/chart-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: a, sessionId: id, ...extra }) });
    const lista = await refrescarSesiones();
    if (a === 'delete' && id === sessionId) {
      const otra = lista[0];
      if (otra) abrirSesion(otra.id); else nuevoChat();
    }
  };

  const enviar = async (texto?: string) => {
    const txt = (texto ?? input).trim();
    if (!txt || pensando || !sessionId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: txt }]);
    setPensando(true); setErr(null);
    try {
      const j = await fetch('/api/chart-insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', sessionId, mensaje: txt }) }).then((r) => r.json());
      if (j.error) setErr(j.error); else { setMessages(j.messages ?? []); refrescarSesiones(); }
    } catch (e) { setErr(String(e)); } finally { setPensando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontFamily: SANS }}>
      {/* barra de sesiones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)', flex: 'none', position: 'relative' }}>
        <button type="button" onClick={() => setVerChats((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, cursor: 'pointer' }}>Chats <span style={{ color: 'var(--faint)' }}>({sessions.length})</span> <span style={{ fontSize: 10 }}>▾</span></button>
        <button type="button" onClick={nuevoChat} disabled={pensando} style={{ padding: '6px 11px', borderRadius: 9, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.6 : 1 }}>+ Nuevo chat</button>
        {chart && <button type="button" onClick={() => setChartAbierto((v) => !v)} style={{ marginLeft: 'auto', padding: '6px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: 'pointer' }}>{chartAbierto ? 'Ocultar gráfico' : 'Ver gráfico'}</button>}
        {verChats && (
          <>
            <div onClick={() => setVerChats(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} aria-hidden />
            <div style={{ position: 'absolute', top: 46, left: 16, zIndex: 2, width: 330, maxWidth: '88vw', maxHeight: '54vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 18px 44px rgba(23,21,17,.2)' }}>
              {sessions.length === 0 ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--faint)' }}>Sin chats previos.</div> : sessions.map((s) => (
                <div key={s.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', background: s.id === sessionId ? 'var(--surface-2)' : 'transparent' }}>
                  {editId === s.id ? (
                    <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} onBlur={() => { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (editVal.trim()) accion('rename', s.id, { titulo: editVal.trim() }); setEditId(null); } if (e.key === 'Escape') setEditId(null); }} style={{ width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13, outline: 'none' }} />
                  ) : (
                    <button type="button" onClick={() => abrirSesion(s.id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontFamily: SANS }}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: s.id === sessionId ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.pinned ? '📌 ' : ''}{s.titulo || 'Chat'}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{fmtDDMMYYYY(s.updated_at.slice(0, 10))}</div>
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button title={s.pinned ? 'Despinear' : 'Pinear'} onClick={() => accion('pin', s.id, { valor: !s.pinned })} style={icoBtn}>{s.pinned ? '📌' : '📍'}</button>
                    <button title="Renombrar" onClick={() => { setEditId(s.id); setEditVal(s.titulo || ''); }} style={icoBtn}>✎</button>
                    <button title="Archivar" onClick={() => accion('archive', s.id, { valor: true })} style={icoBtn}>🗄</button>
                    <button title="Borrar" onClick={() => { if (confirm('¿Borrar este chat?')) accion('delete', s.id); }} style={icoBtn}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {chart && chartAbierto && <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flex: 'none', maxHeight: '40vh', overflowY: 'auto' }}>{chart}</div>}

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)', color: m.role === 'user' ? '#171511' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderRadius: 14, padding: '11px 14px', fontSize: 14 }}>
            {m.role === 'assistant' ? <Markdown text={m.content} /> : <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
          </div>
        ))}
        {pensando && <div style={{ alignSelf: 'flex-start', padding: '2px 0' }}><MakoLoader width={92} /></div>}
        {err && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '10px 14px', color: 'var(--bad)', fontSize: 13 }}>{err}</div>}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flex: 'none' }}>
        {sugs.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', padding: '12px 20px 0' }}>
            {sugs.map((s) => <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando} style={{ flex: 'none', whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.55 : 1 }}>{s}</button>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, padding: '12px 20px 14px' }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} placeholder="Preguntale a MaKo…" disabled={pensando} style={{ flex: 1, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }} />
          <button type="button" onClick={() => enviar()} disabled={pensando || !input.trim()} style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: '#171511', color: '#F3F0E7', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: pensando || !input.trim() ? 'default' : 'pointer', opacity: pensando || !input.trim() ? 0.55 : 1 }}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
