'use client';

// =============================================================================
// ChartIA — gráfico con conclusiones IA de "MaKo" (Claude)
// =============================================================================
// Renderiza el título + el gráfico + un botón "Conclusiones con MaKo". Al abrir,
// MaKo (Claude con la voz de Martín) tira el insight más importante y se puede
// seguir charlando. Historial por `chartKey` (tabla chart_chats). Reutilizable.

import { useEffect, useRef, useState, type ReactNode } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGERENCIAS_DEFAULT = [
  '¿Qué es lo más importante acá?',
  '¿Qué hago la semana que viene?',
];

function MaKoLogo({ size = 16 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mako.svg" alt="MaKo" width={size} height={size} style={{ display: 'block', borderRadius: 4 }} />;
}

// ── Markdown mínimo (negritas, títulos, viñetas, separadores) ──
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
    blocks.push(
      <ul key={`ul-${blocks.length}`} style={{ margin: '4px 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((b, i) => <li key={i} style={{ lineHeight: 1.5 }}>{renderInline(b, `li-${blocks.length}-${i}`)}</li>)}
      </ul>,
    );
    bullets = [];
  };
  lines.forEach((raw, idx) => {
    const t = raw.trim();
    if (/^[-*•]\s+/.test(t)) { bullets.push(t.replace(/^[-*•]\s+/, '')); return; }
    flush();
    if (t === '') return;
    if (/^---+$/.test(t)) { blocks.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />); return; }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      blocks.push(<div key={idx} style={{ fontWeight: 600, fontSize: lvl === 1 ? 16 : lvl === 2 ? 15 : 14, color: 'var(--ink)', margin: '6px 0 2px' }}>{renderInline(h[2], `h-${idx}`)}</div>);
      return;
    }
    blocks.push(<p key={idx} style={{ margin: '3px 0', lineHeight: 1.55 }}>{renderInline(t, `p-${idx}`)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

export function ChartIA({
  chartKey,
  titulo,
  contexto,
  sugerencias = SUGERENCIAS_DEFAULT,
  children,
}: {
  chartKey: string;
  titulo: string;
  contexto: string;
  sugerencias?: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cargado, setCargado] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const enviar = async (texto?: string) => {
    const txt = (texto ?? input).trim();
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
    <div>
      {/* header: título + botón MaKo (no se superpone al gráfico) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <h2 style={{ fontWeight: 600, fontSize: 25, letterSpacing: '-0.015em', margin: 0, color: 'var(--ink)' }}>{titulo}</h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Conclusiones con MaKo"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 999, border: '1px solid var(--accent)', background: 'rgba(200,135,12,.08)', color: '#9A6A09', fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <MaKoLogo size={16} /> Conclusiones con MaKo
        </button>
      </div>

      {children}

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(23,21,17,.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto', fontFamily: SANS }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, boxShadow: '0 30px 70px rgba(23,21,17,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 80px)' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 24px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <MaKoLogo size={30} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Conclusiones con MaKo</div>
                  <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', fontFamily: SANS }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }} ref={scrollRef}>
              {/* gráfico aislado */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', flex: 'none' }}>{children}</div>

              {/* chat */}
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--surface-2)', color: m.role === 'user' ? '#171511' : 'var(--ink)', border: m.role === 'user' ? 'none' : '1px solid var(--border)', borderRadius: 14, padding: '11px 14px', fontSize: 14 }}>
                    {m.role === 'assistant' ? <Markdown text={m.content} /> : <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>}
                  </div>
                ))}
                {pensando && <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'var(--faint)', fontFamily: MONO }}>MaKo está pensando…</div>}
                {err && <div style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad)', borderRadius: 12, padding: '10px 14px', color: 'var(--bad)', fontSize: 13 }}>{err}</div>}
              </div>
            </div>

            {/* sugerencias + input */}
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flex: 'none' }}>
              {sugerencias.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 24px 0' }}>
                  {sugerencias.map((s) => (
                    <button key={s} type="button" onClick={() => enviar(s)} disabled={pensando} style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12.5, cursor: pensando ? 'default' : 'pointer', opacity: pensando ? 0.55 : 1 }}>{s}</button>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, padding: '12px 24px 14px' }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder="Preguntale a MaKo sobre este gráfico…"
                  disabled={pensando}
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14, outline: 'none' }}
                />
                <button type="button" onClick={() => enviar()} disabled={pensando || !input.trim()} style={{ padding: '11px 18px', borderRadius: 11, border: 'none', background: 'var(--accent-soft)', color: '#171511', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: pensando || !input.trim() ? 'default' : 'pointer', opacity: pensando || !input.trim() ? 0.55 : 1 }}>Enviar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
