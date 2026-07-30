'use client';

// =============================================================================
// AvataresView — los 3 AVATARES SEGMENTABLES que MaKo propone (el "¿a quién?")
// =============================================================================
// Antes de generar, MaKo SIEMPRE hace preguntas cerradas de segmentación (pedido de
// Mauricio: no hay botón "afinar" aparte — las preguntas van por defecto). Cuando aún
// no hay avatares, se ve SOLO el botón (nada de contexto ni textos). Ya generados: dos
// sub-tabs (Avatares | Contexto). Los avatares son de solo lectura (para cambiarlos, se
// regenera). Corre con la IA gratis del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { CamposNegocio } from './CamposNegocio';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Estado = { avatares: Avatar[]; tieneBrief: boolean };
type Pregunta = { pregunta: string; opciones: string[] };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

// Mismo loader inline que EntregableView — "Preparando…" sin nada que gire parece
// trabado.
function MiniSpin({ light }: { light?: boolean }) {
  return <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${light ? 'rgba(255,255,255,.35)' : 'var(--border)'}`, borderTopColor: light ? '#fff' : 'var(--primary)', animation: 'ava-spin .8s linear infinite', display: 'inline-block', flex: 'none' }} />;
}

// Campo etiquetado de SOLO LECTURA (los avatares no se editan; se regeneran).
function Campo({ label, color, valor }: { label: string; color: string; valor: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{valor}</div>
    </div>
  );
}

export function AvataresView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'avatares' | 'contexto'>('avatares');
  // Preguntas de segmentación (siempre antes de generar).
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [pregIdx, setPregIdx] = useState(0);
  const [respuestas, setRespuestas] = useState<Array<{ pregunta: string; respuesta: string }>>([]);
  const [cargandoPreg, setCargandoPreg] = useState(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/avatares')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.avatares.length > 0); }, [est, onListo]);

  // Arrancar la generación: SIEMPRE pide preguntas primero.
  const empezar = async () => {
    setCargandoPreg(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preguntas' }) })).json();
      if (j.ok && Array.isArray(j.preguntas) && j.preguntas.length) { setPreguntas(j.preguntas as Pregunta[]); setPregIdx(0); setRespuestas([]); }
      else generar([]); // sin preguntas usables → generar directo
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargandoPreg(false); }
  };

  const generar = async (rs: Array<{ pregunta: string; respuesta: string }>) => {
    setPreguntas(null); setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/avatares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'afinar', respuestas: rs }) })).json();
      if (j.ok) { setEst(j as Estado); setSubTab('avatares'); } else setErr(j.error || 'No se pudieron generar los avatares.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const responderPreg = (respuesta: string | null) => {
    if (!preguntas) return;
    const q = preguntas[pregIdx];
    const rs = respuesta ? [...respuestas, { pregunta: q.pregunta, respuesta }] : respuestas;
    setRespuestas(rs);
    if (pregIdx + 1 >= preguntas.length) generar(rs);
    else setPregIdx((i) => i + 1);
  };

  const css = <style>{'@keyframes ava-spin{to{transform:rotate(360deg)}}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tus avatares…</div>;

  const avatares = est?.avatares ?? [];

  // ── Generando ────────────────────────────────────────────────────────────────
  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ava-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está definiendo tus segmentos</div>
      </div>
    );
  }

  // ── Preguntas de segmentación (siempre, antes de generar) ────────────────────
  if (preguntas) {
    const q = preguntas[pregIdx];
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        {css}
        <div style={{ ...eyebrow, marginBottom: 18 }}>Para conocer a tus clientes · pregunta {pregIdx + 1} de {preguntas.length}</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.3 }}>{q.pregunta}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
          {q.opciones.map((o, i) => (
            <button key={i} type="button" onClick={() => responderPreg(o)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.4 }}>{o}</button>
          ))}
        </div>
        <div style={{ marginTop: 22 }}><button type="button" onClick={() => responderPreg(null)} style={linkBtn}>Saltar esta</button></div>
      </div>
    );
  }

  // ── Vacío: SOLO el botón (nada de contexto ni textos) ────────────────────────
  if (!avatares.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '60px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 14 }}>👥</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.25 }}>Tus avatares</h2>
        {est?.tieneBrief ? (
          <button type="button" onClick={empezar} disabled={cargandoPreg} style={{ ...btnPrimary, opacity: cargandoPreg ? 0.6 : 1 }}>{cargandoPreg ? <><MiniSpin light /> Preparando…</> : '✦ Generar mis avatares'}</button>
        ) : (
          <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>.</div>
        )}
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  // ── Ya generados: sub-tabs Avatares | Contexto ───────────────────────────────
  const subPill = (on: boolean): CSSProperties => ({ border: 'none', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--dim)', fontWeight: on ? 600 : 500, fontSize: 12.5, padding: '6px 14px', borderRadius: 999, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(18,21,27,.08)' : 'none', fontFamily: SANS });
  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: 3 }}>
          <button type="button" onClick={() => setSubTab('avatares')} style={subPill(subTab === 'avatares')}>Avatares</button>
          <button type="button" onClick={() => setSubTab('contexto')} style={subPill(subTab === 'contexto')}>Contexto</button>
        </div>
        {subTab === 'avatares' && <button type="button" onClick={empezar} disabled={cargandoPreg} style={btnGhost}>{cargandoPreg ? <><MiniSpin /> Preparando…</> : '↺ Regenerar'}</button>}
      </div>

      {subTab === 'contexto' ? (
        <CamposNegocio titulo="Tu cliente ideal" prefijos={['avatar_']} onSaved={cargar} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {avatares.map((a, i) => (
              <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--faint)', flex: 'none' }}>0{i + 1}</span>
                  <span style={{ fontFamily: SANS, fontSize: 17.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }}>{a.nombre}</span>
                </div>
                <Campo label="Segmento" color="#2F6DDB" valor={a.segmento} />
                <Campo label="Situación" color="var(--faint)" valor={a.situacion} />
                <Campo label="Dolor" color="#CF4E29" valor={a.dolor} />
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 3 }}>Cómo lo targeteas en Meta</div>
                  <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{a.senalesMeta}</div>
                </div>
              </div>
            ))}
          </div>
          {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
        </>
      )}
    </div>
  );
}
