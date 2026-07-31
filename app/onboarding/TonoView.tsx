'use client';

// =============================================================================
// TonoView — el TONO y la personalidad del creador (humaniza guiones y copy)
// =============================================================================
// Self-contained: /api/onboarding/tono. Preguntas cerradas (chips) + 2 campos
// libres (muletillas, ejemplos). Guarda al elegir/blur — sin botón "guardar".
// Futuro (pedido explícito): conectar Meta y transcribir los anuncios reales
// para DERIVAR el tono en vez de preguntarlo — esto es el arranque manual.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { TONO_PREGUNTAS, TONO_TEXTOS, TONO_VACIO, tonoCompleto, type Tono } from '@/lib/tono';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

export function TonoView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [tono, setTonoState] = useState<Tono>(TONO_VACIO);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Guardado con debounce para los campos de texto (no un POST por tecla).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding/tono')).json();
      if (j.ok) setTonoState(j.tono as Tono); else setErr(j.error || 'No se pudo cargar.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(tonoCompleto(tono)); }, [tono, onListo]);

  const persistir = useCallback((t: Tono) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch('/api/onboarding/tono', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tono: t }) })
        .then((r) => r.json()).then((j) => { if (!j.ok) setErr(j.error || 'No se pudo guardar.'); })
        .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    }, 500);
  }, []);

  const elegir = (key: string, opcion: string) => {
    const t: Tono = { ...tono, respuestas: { ...tono.respuestas, [key]: opcion } };
    setTonoState(t); persistir(t);
  };
  const escribir = (key: 'muletillas' | 'ejemplos', valor: string) => {
    const t: Tono = { ...tono, [key]: valor };
    setTonoState(t); persistir(t);
  };

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu tono…</div>;

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' }}>
      {TONO_PREGUNTAS.map((p) => (
        <div key={p.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <span aria-hidden style={{ fontSize: 15 }}>{p.emoji}</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{p.pregunta}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {p.opciones.map((o) => {
              const on = tono.respuestas[p.key] === o;
              return (
                <button key={o} type="button" onClick={() => elegir(p.key, o)}
                  style={{ fontFamily: SANS, fontSize: 13, fontWeight: on ? 600 : 500, padding: '9px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)' }}>
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {TONO_TEXTOS.map((c) => (
        <div key={c.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span aria-hidden style={{ fontSize: 15 }}>{c.emoji}</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{c.label}</span>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>(opcional)</span>
          </div>
          <textarea value={tono[c.key]} placeholder={c.placeholder} rows={2}
            onChange={(e) => escribir(c.key, e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, lineHeight: 1.5, resize: 'vertical', outline: 'none' }} />
        </div>
      ))}
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>
        <b style={{ color: 'var(--ink)' }}>¿Para qué es esto?</b> Con tu tono, los guiones y el copy que MaKo escribe suenan a TI, no a una IA — tus anuncios se sienten del creador de verdad. Pronto MaKo también va a poder analizar tus anuncios ya publicados en Meta para afinarlo solo.
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
