'use client';

// =============================================================================
// Los casos que MaKo no supo manejar — y cómo se le enseñan
// =============================================================================
// Cuando un lead escribe algo que no encaja en ningún escenario de la secuencia,
// MaKo no contesta: avisa por el grupo y deja el mensaje acá. Esta pantalla es
// la otra mitad del protocolo — la que convierte ese silencio en aprendizaje.
//
// El dueño lee lo que escribió el lead y dice cómo se responde de ahora en más.
// Eso queda como un escenario de la secuencia, así que la próxima vez que
// alguien diga algo parecido, MaKo ya sabe.

import { useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const btn: CSSProperties = { padding: '8px 14px', borderRadius: 9, border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

export type Handoff = {
  id: number; leadId: number | null; secuenciaId: number | null;
  mensaje: string; motivo: string | null; createdAt: string;
  leadNombre: string | null; secuenciaNombre: string | null;
};

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function HandoffsPanel({ handoffs, onCambio }: { handoffs: Handoff[]; onCambio: () => void }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('');
  const [cuando, setCuando] = useState('');
  const [comoResponder, setComoResponder] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function abrir(h: Handoff) {
    setAbierto(h.id === abierto ? null : h.id);
    setTitulo(''); setCuando(h.mensaje.slice(0, 120)); setComoResponder(''); setErr(null);
  }

  async function resolver(h: Handoff) {
    if (!titulo.trim() || !cuando.trim()) return;
    setBusy(true); setErr(null);
    try {
      const j = await (await fetch('/api/chat-agent/secuencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolver-handoff', handoffId: h.id,
          escenario: { titulo: titulo.trim(), cuando: cuando.trim(), comoResponder: comoResponder.trim() },
        }),
      })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo guardar el caso.'); return; }
      setAbierto(null); onCambio();
    } catch { setErr('Sin conexión — vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }

  if (!handoffs.length) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--warn)', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 4 }}>
        {handoffs.length === 1 ? 'Un lead escribió algo que no supe manejar' : `${handoffs.length} leads escribieron algo que no supe manejar`}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 12 }}>
        No les contesté nada: prefiero no improvisar con alguien real. Contéstales tú, y si es un caso que se va a repetir, enséñamelo acá.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {handoffs.map((h) => (
          <div key={h.id} style={{ borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <button type="button" onClick={() => abrir(h)}
              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>«{h.mensaje.slice(0, 160)}{h.mensaje.length > 160 ? '…' : ''}»</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', marginTop: 3 }}>
                  {h.leadNombre || 'Lead sin nombre'}{h.secuenciaNombre ? ` · ${h.secuenciaNombre}` : ''} · {fmtFecha(h.createdAt)}
                </span>
              </span>
              <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abierto === h.id ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
            </button>

            {abierto === h.id && (
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus
                  placeholder="¿Cómo se llama este caso? (ej: Pide factura)" style={inp} />
                <input value={cuando} onChange={(e) => setCuando(e.target.value)}
                  placeholder="¿Cuándo aplica? (con tus palabras)" style={inp} />
                <textarea value={comoResponder} onChange={(e) => setComoResponder(e.target.value)} rows={3}
                  placeholder="¿Qué hay que contestarle en estos casos?" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
                {err && <div style={{ fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => void resolver(h)} disabled={busy || !titulo.trim() || !cuando.trim()}
                    style={{ ...btn, opacity: busy || !titulo.trim() || !cuando.trim() ? 0.5 : 1 }}>
                    {busy ? 'Guardando…' : 'Enseñarle este caso'}
                  </button>
                  <button onClick={() => setAbierto(null)} style={btnGhost}>Ahora no</button>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.5 }}>
                  Al guardarlo, la secuencia de este lead vuelve a correr y la próxima vez que alguien escriba algo parecido, ya sé qué contestar.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
