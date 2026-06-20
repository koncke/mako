'use client';

// =============================================================================
// ChartIA — botón de IA sobre un gráfico → pop-up con el gráfico aislado + chat
// =============================================================================
// Reutilizable en cualquier gráfico. Al abrir, Claude genera automáticamente el
// primer análisis (datos del gráfico vía `contexto`) y se puede seguir charlando.
// El historial se guarda por `chartKey` (tabla chart_chats) → persiste entre visitas.

import { useEffect, useRef, useState, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Msg = { role: 'user' | 'assistant'; content: string };

export function ChartIA({
  chartKey,
  titulo,
  contexto,
  children,
}: {
  chartKey: string;
  titulo: string;
  contexto: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cargado, setCargado] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Al abrir por primera vez: POST sin mensaje → trae el hilo o genera el análisis.
  useEffect(() => {
    if (!open || cargado) return;
    let alive = true;
    setPensando(true); setErr(null);
    fetch('/api/chart-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartKey, titulo, contexto }),
    })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (j.error) setErr(j.error); else { setMessages(j.messages ?? []); setCargado(true); } })
      .catch((e) => { if (alive) setErr(String(e)); })
      .finally(() => { if (alive) setPensando(false); });
    return () => { alive = false; };
  }, [open, cargado, chartKey, titulo, contexto]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pensando]);

  const enviar = async () => {
    const txt = input.trim();
    if (!txt || pensando) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: txt }]);
    setPensando(true); setErr(null);
    try {
      const r = await fetch('/api/chart-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartKey, titulo, contexto, mensaje: txt }),
      });
      const j = await r.json();
      if (j.error) setErr(j.error);
      else setMessages(j.messages ?? []);
    } catch (e) {
      setErr(String(e));
    } finally {
      setPensando(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Conclusiones con IA"
        style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.10)', color: '#9A6A09', fontFamily: SANS, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
      >
        ✨ Conclusiones IA
      </button>

      {children}

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto', fontFamily: SANS }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 24px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>✨ Conclusiones IA · Claude</div>
                <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--ink)', marginTop: 2 }}>{titulo}</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }} ref={scrollRef}>
              {/* gráfico aislado */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flex: 'none' }}>{children}</div>

              {/* chat */}
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)', color: m.role === 'user' ? '#171511' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderRadius: 14, padding: '11px 14px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {m.content}
                  </div>
                ))}
                {pensando && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>Claude está pensando…</div>}
                {err && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '10px 14px', color: 'var(--bad)', fontSize: 13 }}>{err}</div>}
              </div>
            </div>

            {/* input */}
            <div style={{ display: 'flex', gap: 10, padding: '14px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flex: 'none' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Preguntale algo sobre este gráfico…"
                disabled={pensando}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }}
              />
              <button type="button" onClick={enviar} disabled={pensando || !input.trim()} style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: pensando || !input.trim() ? 'default' : 'pointer', opacity: pensando || !input.trim() ? 0.55 : 1 }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
