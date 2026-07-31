'use client';

// =============================================================================
// PersonalidadView — el QUIZ de personalidad (la voz de los anuncios), 1 x 1
// =============================================================================
// Self-contained: /api/onboarding/personalidad. De a UNA pregunta (como todos
// los formularios de la app), con "← Atrás". Cada pregunta muestra FRASES
// concretas de anuncio — personalizadas al negocio real por IA (el server cae a
// las genéricas si la IA falla; el quiz nunca se traba). Al terminar: muletillas
// (opcional) y el resumen de la voz descubierta, con opción de re-hacerlo.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PERSONALIDAD_PREGUNTAS, personalidadCompleta, type Personalidad, type PersonalidadPregunta } from '@/lib/personalidad';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };

const TOTAL = PERSONALIDAD_PREGUNTAS.length;

export function PersonalidadView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [pers, setPers] = useState<Personalidad | null>(null);
  const [idx, setIdx] = useState(0);
  // 'quiz' → contestando; 'muletillas' → el campo libre final; 'listo' → resumen.
  const [etapa, setEtapa] = useState<'quiz' | 'muletillas' | 'listo'>('quiz');
  const [pregunta, setPregunta] = useState<PersonalidadPregunta | null>(null);
  const [cargandoPreg, setCargandoPreg] = useState(false);
  const [muletillas, setMuletillas] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const post = useCallback(async (body: Record<string, unknown>) => {
    try { return await (await fetch('/api/onboarding/personalidad', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
  }, []);

  // La pregunta idx, personalizada al negocio por el server (fallback: estática).
  const cargarPregunta = useCallback(async (i: number) => {
    setCargandoPreg(true); setErr(null);
    const j = await post({ action: 'pregunta', idx: i });
    if (j.ok) setPregunta(j.pregunta as PersonalidadPregunta);
    else { setErr(String(j.error ?? 'No se pudo preparar la pregunta.')); setPregunta(PERSONALIDAD_PREGUNTAS[i]); }
    setCargandoPreg(false);
  }, [post]);

  useEffect(() => {
    (async () => {
      try {
        const j = await (await fetch('/api/onboarding/personalidad')).json();
        if (!j.ok) { setErr(j.error || 'No se pudo cargar.'); return; }
        const p = j.personalidad as Personalidad;
        setPers(p);
        setMuletillas(p.muletillas);
        if (personalidadCompleta(p)) { setEtapa('listo'); return; }
        // Retomar en la primera sin contestar.
        const primera = PERSONALIDAD_PREGUNTAS.findIndex((q) => !p.respuestas[q.key]);
        const i = primera < 0 ? 0 : primera;
        setIdx(i);
        void cargarPregunta(i);
      } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    })();
  }, [cargarPregunta]);

  useEffect(() => { onListo?.(!!pers && personalidadCompleta(pers)); }, [pers, onListo]);

  const responder = async (rasgo: string, texto: string) => {
    if (!pregunta || !pers) return;
    const nuevo: Personalidad = { ...pers, respuestas: { ...pers.respuestas, [pregunta.key]: { rasgo, texto } } };
    setPers(nuevo);
    void post({ action: 'responder', key: pregunta.key, rasgo, texto });
    if (idx + 1 < TOTAL) { setIdx(idx + 1); void cargarPregunta(idx + 1); }
    else setEtapa('muletillas');
  };
  const atras = () => {
    if (etapa === 'muletillas') { setEtapa('quiz'); setIdx(TOTAL - 1); void cargarPregunta(TOTAL - 1); return; }
    if (idx > 0) { setIdx(idx - 1); void cargarPregunta(idx - 1); }
  };
  const terminar = async () => {
    await post({ action: 'muletillas', muletillas });
    setPers((p) => (p ? { ...p, muletillas } : p));
    setEtapa('listo');
  };
  const reiniciar = async () => {
    await post({ action: 'reiniciar' });
    setPers({ respuestas: {}, muletillas: '' });
    setMuletillas('');
    setEtapa('quiz'); setIdx(0);
    void cargarPregunta(0);
  };

  const css = <style>{'@keyframes prs-spin{to{transform:rotate(360deg)}}'}</style>;

  if (!pers && !err) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu personalidad…</div>;

  // ── Resumen final (quiz completo) ──────────────────────────────────────────
  if (etapa === 'listo' && pers) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'left' }}>
        {css}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--good-bg)', border: '1px solid var(--good)', borderRadius: 12, padding: '13px 15px', marginBottom: 14 }}>
          <span style={{ color: 'var(--good)', fontSize: 16, flex: 'none', marginTop: 1 }}>✓</span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Tu personalidad quedó definida</div>
            <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>Cada guion que MaKo escriba va a sonar así — a ti, no a una IA.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {PERSONALIDAD_PREGUNTAS.map((q) => {
            const r = pers.respuestas[q.key];
            if (!r) return null;
            return (
              <div key={q.key} style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', padding: '10px 13px' }}>
                <div style={{ ...eyebrow, fontSize: 9.5, marginBottom: 3 }}>{q.dimension}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r.rasgo}</div>
                {r.texto && <div style={{ fontSize: 12, color: 'var(--dim)', fontStyle: 'italic', marginTop: 3, lineHeight: 1.45 }}>“{r.texto}”</div>}
              </div>
            );
          })}
          {pers.muletillas && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', padding: '10px 13px' }}>
              <div style={{ ...eyebrow, fontSize: 9.5, marginBottom: 3 }}>muletillas</div>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{pers.muletillas}</div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button type="button" onClick={reiniciar} style={btnGhost}>↺ Volver a hacer el quiz</button>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12, textAlign: 'center' }}>{err}</div>}
      </div>
    );
  }

  // ── Muletillas (paso final, opcional) ──────────────────────────────────────
  if (etapa === 'muletillas') {
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center' }}>
        {css}
        <div style={{ ...eyebrow, marginBottom: 16 }}>Última — {TOTAL + 1} de {TOTAL + 1}</div>
        <h2 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.3 }}>¿Muletillas o frases que SIEMPRE dices?</h2>
        <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 14 }}>Opcional — MaKo las mete en tus guiones de forma natural.</div>
        <textarea value={muletillas} rows={2} placeholder={'ej: "ojo con esto", "te lo juro", "va de nuevo"…'}
          onChange={(e) => setMuletillas(e.target.value)}
          style={{ width: '100%', padding: '11px 13px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 13.5, lineHeight: 1.5, resize: 'vertical', outline: 'none', textAlign: 'left' }} />
        <div style={{ marginTop: 16, display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" onClick={atras} style={linkBtn}>← Atrás</button>
          <button type="button" onClick={terminar} style={{ padding: '11px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Terminar →</button>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{err}</div>}
      </div>
    );
  }

  // ── El quiz, de a una ──────────────────────────────────────────────────────
  if (cargandoPreg || !pregunta) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'prs-spin .8s linear infinite' }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 18 }}>Preparando la pregunta con TU negocio…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      {css}
      <div style={{ ...eyebrow, marginBottom: 16 }}>Tu personalidad · pregunta {idx + 1} de {TOTAL}</div>
      <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px', lineHeight: 1.35 }}>{pregunta.pregunta}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, textAlign: 'left' }}>
        {pregunta.opciones.map((o, i) => (
          <button key={i} type="button" onClick={() => responder(o.rasgo, o.texto)}
            style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14, fontStyle: 'italic', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.5 }}>
            “{o.texto}”
          </button>
        ))}
      </div>
      {idx > 0 && <div style={{ marginTop: 18 }}><button type="button" onClick={atras} style={linkBtn}>← Atrás</button></div>}
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14 }}>{err}</div>}
    </div>
  );
}
