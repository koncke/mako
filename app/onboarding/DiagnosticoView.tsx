'use client';

// =============================================================================
// DiagnosticoView — la tab "Diagnóstico" del hub (las 5 fases)
// =============================================================================
// Self-contained: trae el diagnóstico guardado de /api/onboarding/fase. Si no está
// hecho, muestra el FORMULARIO (una pregunta por vez, con el selector de canal para
// la pregunta de volumen). Si ya está, muestra el RESULTADO (mismo bloque que el
// wizard, vía FaseUI) con opción de rehacerlo. El diagnóstico es el "Norte": alimenta
// a MaKo, los avatares y los ángulos.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PREGUNTAS, VOLUMEN_POR_CANAL, diagnosticar, faseDef, type CanalId, type Diagnostico } from '@/lib/fase-diagnostico';
import { FaseQuiz, CanalSelector, FaseResultado, FaseIcono } from './FaseUI';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

const btnPrimary: CSSProperties = { padding: '11px 20px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

export function DiagnosticoView() {
  const total = PREGUNTAS.length;
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [resp, setResp] = useState<number[]>(() => new Array(total).fill(-1));
  const [canal, setCanal] = useState<CanalId>('llamadas');
  const [idx, setIdx] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/onboarding/fase')).json();
      if (j.ok && j.diag) {
        const d = j.diag as Diagnostico;
        setDiag(d);
        if (Array.isArray(d.respuestas)) setResp(d.respuestas);
        if (d.canal) setCanal(d.canal);
      } else if (!j.ok) setErr(j.error);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (respuestas: number[], canalFinal: CanalId) => {
    setGuardando(true); setErr(null);
    // Instantáneo (recomputado local) y luego confirmado por el server.
    setDiag(diagnosticar(respuestas, canalFinal));
    try {
      const j = await (await fetch('/api/onboarding/fase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuestas, canal: canalFinal }) })).json();
      if (j.ok && j.diag) setDiag(j.diag as Diagnostico); else if (!j.ok) setErr(j.error || 'No se pudo guardar.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGuardando(false); }
  };

  const rehacer = () => { setDiag(null); setIdx(0); setResp(new Array(total).fill(-1)); };

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu diagnóstico…</div>;

  // ── Resultado ────────────────────────────────────────────────────────────────
  if (diag) {
    const fd = faseDef(diag.fase);
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span style={{ color: fd.color, flex: 'none', display: 'inline-flex' }}><FaseIcono id={fd.id} size={30} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...eyebrow, color: 'var(--accent)' }}>✦ Tu fase · Fase {fd.id}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }}>{fd.nombre} <span style={{ fontWeight: 500, color: 'var(--dim)', fontSize: 14 }}>· {fd.subtitulo}</span></div>
            </div>
          </div>
          <button type="button" onClick={rehacer} style={btnGhost}>↺ Rehacer diagnóstico</button>
        </div>
        <FaseResultado diag={diag} />
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
      </div>
    );
  }

  // ── Formulario (una pregunta por vez) ────────────────────────────────────────
  const q = PREGUNTAS[idx];
  const esVolumen = q.id === 'volumen';
  const opciones = esVolumen ? VOLUMEN_POR_CANAL[canal].opciones : q.opciones;
  const texto = esVolumen ? VOLUMEN_POR_CANAL[canal].texto : q.texto;
  const pick = (oi: number) => {
    const nr = [...resp]; nr[idx] = oi; setResp(nr);
    if (idx + 1 >= total) guardar(nr, canal); else setIdx(idx + 1);
  };

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '8px 0' }}>
      <div style={{ ...eyebrow, marginBottom: 16, textAlign: 'center' }}>Pregunta {idx + 1} de {total}</div>
      <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 20px', lineHeight: 1.3, textAlign: 'center' }}>{texto}</h2>
      {esVolumen && <CanalSelector canal={canal} onPick={setCanal} />}
      <FaseQuiz emoji={q.emoji} opciones={opciones} value={resp[idx]} onPick={pick} />
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 22, alignItems: 'center' }}>
        {idx > 0 && <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} style={linkBtn}>← Atrás</button>}
        {resp[idx] >= 0 && idx + 1 < total && <button type="button" onClick={() => setIdx((i) => i + 1)} style={btnPrimary}>Siguiente →</button>}
        {resp[idx] >= 0 && idx + 1 >= total && <button type="button" onClick={() => guardar(resp, canal)} disabled={guardando} style={{ ...btnPrimary, opacity: guardando ? 0.5 : 1 }}>{guardando ? 'Guardando…' : 'Ver mi fase →'}</button>}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
