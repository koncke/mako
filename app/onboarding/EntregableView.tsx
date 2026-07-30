'use client';

// =============================================================================
// EntregableView — el elemento TANGIBLE de la oferta (el que genera FOMO)
// =============================================================================
// Self-contained: /api/onboarding/entregable. MaKo propone 1-3 entregables tangibles
// (dashboard/excel/metodología…) desde el brief; cada uno con qué ES y una línea de
// FOMO. Además el cliente puede CARGAR EL SUYO directo ("+ Agregar el mío") — muchas
// veces ya lo tiene claro. Edición inline. Corre con la IA gratis del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
type Estado = { entregables: Entregable[]; tieneBrief: boolean };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

function Edit({ valor, ph, onSave, style }: { valor: string; ph?: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ent-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Escribe…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

type PreguntaEnt = { pregunta: string; opciones: string[] };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

// Loader inline para botones que disparan una llamada a IA — sin esto un "Preparando…"
// sin nada que gire parece que el botón se trabó (pedido de Martín, en varios lados).
function MiniSpin({ light }: { light?: boolean }) {
  return <span style={{ width: 13, height: 13, borderRadius: '50%', border: `2px solid ${light ? 'rgba(255,255,255,.35)' : 'var(--border)'}`, borderTopColor: light ? '#fff' : 'var(--primary)', animation: 'ent-spin .8s linear infinite', display: 'inline-block', flex: 'none' }} />;
}

export function EntregableView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Preguntas personalizadas antes de detectar (por si ya tiene uno específico).
  const [preguntas, setPreguntas] = useState<PreguntaEnt[] | null>(null);
  const [pregIdx, setPregIdx] = useState(0);
  // Por ÍNDICE (no por inserción): así "← Atrás" puede pisar la respuesta anterior
  // aunque alguna pregunta de en medio se haya saltado.
  const [respuestas, setRespuestas] = useState<Array<string | null>>([]);
  const [cargandoPreg, setCargandoPreg] = useState(false);
  // Escape hatch: "ya lo tengo" — el dueño lo cuenta (texto + imagen opcional) en vez
  // de contestar las preguntas genéricas, y MaKo solo le da forma.
  const [capturando, setCapturando] = useState(false);
  const [capturaTexto, setCapturaTexto] = useState('');
  const [capturaFile, setCapturaFile] = useState<File | null>(null);
  const [capturaBusy, setCapturaBusy] = useState(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/entregable')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.entregables.length > 0); }, [est, onListo]);

  // Arrancar: MaKo SIEMPRE pregunta primero (personalizado al negocio) y luego detecta.
  const empezar = async () => {
    setCargandoPreg(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preguntas' }) })).json();
      if (j.ok && Array.isArray(j.preguntas) && j.preguntas.length) { setPreguntas(j.preguntas as PreguntaEnt[]); setPregIdx(0); setRespuestas([]); }
      else generar([]); // sin preguntas usables → detectar directo
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargandoPreg(false); }
  };

  const generar = async (rs: Array<{ pregunta: string; respuesta: string }>) => {
    setPreguntas(null); setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', respuestas: rs }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo detectar el entregable.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const responderPreg = (respuesta: string | null) => {
    if (!preguntas) return;
    const arr = [...respuestas]; arr[pregIdx] = respuesta;
    setRespuestas(arr);
    if (pregIdx + 1 >= preguntas.length) {
      const rs = preguntas.map((q, i) => ({ pregunta: q.pregunta, respuesta: arr[i] })).filter((x): x is { pregunta: string; respuesta: string } => !!x.respuesta);
      generar(rs);
    } else setPregIdx((i) => i + 1);
  };
  const atrasPreg = () => setPregIdx((i) => Math.max(0, i - 1));

  // "Ya lo tengo" — lo cuenta (y opcionalmente adjunta algo) en vez de contestar
  // las preguntas genéricas; MaKo solo le da forma, no inventa nada.
  const enviarPropio = async () => {
    if (!capturaTexto.trim() && !capturaFile) return;
    setCapturaBusy(true); setErr(null);
    try {
      let imagenDataUrl: string | undefined;
      if (capturaFile) {
        imagenDataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
          r.readAsDataURL(capturaFile);
        });
      }
      setPreguntas(null); setCapturando(false); setGen(true);
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'propio', texto: capturaTexto.trim(), imagenDataUrl }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo guardar tu entregable.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setGen(false); setCapturaBusy(false); }
  };

  const guardar = async (entregables: Entregable[]) => {
    setEst((e) => (e ? { ...e, entregables } : e));
    const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', entregables }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Entregable, v: string) => {
    if (!est) return;
    guardar(est.entregables.map((g) => (g.id === id ? { ...g, [campo]: v } : g)));
  };
  const borrar = (id: string) => { if (est) guardar(est.entregables.filter((g) => g.id !== id)); };

  const css = <style>{'@keyframes ent-spin{to{transform:rotate(360deg)}}.ent-edit:hover{background:var(--surface-2)}.ent-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.ent-edit:empty:before{content:attr(data-ph);color:var(--faint)}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu entregable…</div>;

  const entregables = est?.entregables ?? [];

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ent-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está buscando tu entregable</div>
      </div>
    );
  }

  // "Ya lo tengo" — cuenta lo que ya sabe (texto + imagen opcional), sin las preguntas.
  if (capturando) {
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        {css}
        <div style={{ ...eyebrow, marginBottom: 18 }}>Contame tu entregable</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px', lineHeight: 1.3 }}>¿Qué es? Contámelo con tus palabras</h2>
        <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
          <textarea value={capturaTexto} onChange={(e) => setCapturaTexto(e.target.value)} autoFocus
            placeholder="Ej: un dashboard en Google Sheets donde el cliente ve el avance de sus objetivos cada semana…"
            style={{ width: '100%', padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: SANS, fontSize: 14.5, minHeight: 110, resize: 'vertical', lineHeight: 1.5, outline: 'none' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 13px', borderRadius: 10, border: '1px dashed var(--border-strong)', color: 'var(--dim)', fontSize: 13, cursor: 'pointer' }}>
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => setCapturaFile(e.target.files?.[0] ?? null)} />
            📎 {capturaFile ? capturaFile.name : 'Adjuntar una captura o archivo (opcional)'}
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
          <button type="button" onClick={() => { setCapturando(false); }} style={btnGhost}>← Volver a las preguntas</button>
          <button type="button" onClick={enviarPropio} disabled={capturaBusy || (!capturaTexto.trim() && !capturaFile)} style={{ ...btnPrimary, opacity: capturaBusy || (!capturaTexto.trim() && !capturaFile) ? 0.5 : 1 }}>{capturaBusy ? <><MiniSpin light /> Guardando…</> : 'Usar esto →'}</button>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  // Preguntas 1×1 (personalizadas) antes de detectar.
  if (preguntas) {
    const q = preguntas[pregIdx];
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        {css}
        <div style={{ ...eyebrow, marginBottom: 18 }}>Para afinar tu entregable · pregunta {pregIdx + 1} de {preguntas.length}</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.3 }}>{q.pregunta}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
          {q.opciones.map((o, i) => (
            <button key={i} type="button" onClick={() => responderPreg(o)}
              style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.4 }}>{o}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          {pregIdx > 0 && <button type="button" onClick={atrasPreg} style={linkBtn}>← Atrás</button>}
          <button type="button" onClick={() => responderPreg(null)} style={linkBtn}>Saltar esta</button>
          <button type="button" onClick={() => setCapturando(true)} style={linkBtn}>✎ Ya lo tengo — contármelo</button>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!entregables.length) {
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧲</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 20px', lineHeight: 1.25 }}>Tu entregable</h2>
        {est?.tieneBrief
          ? <button type="button" onClick={empezar} disabled={cargandoPreg} style={{ ...btnPrimary, opacity: cargandoPreg ? 0.6 : 1 }}>{cargandoPreg ? <><MiniSpin light /> Preparando…</> : '✦ Que MaKo lo detecte'}</button>
          : <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>.</div>}
        {/* Contexto: para qué es, siempre debajo del botón */}
        <div style={{ marginTop: 22, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <div style={{ ...eyebrow, marginBottom: 7 }}>¿Qué es el entregable?</div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>Es el elemento <b>tangible</b> de tu oferta —un dashboard, una planilla, una metodología con nombre— que se entiende al instante y genera <b>FOMO</b> en tus anuncios. MaKo te hace un par de preguntas y lo detecta desde tu negocio; después lo revisas.</div>
        </div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow }}>Tu entregable · el elemento tangible</div>
        {est?.tieneBrief && <button type="button" onClick={empezar} disabled={cargandoPreg} style={{ ...btnGhost, opacity: cargandoPreg ? 0.6 : 1 }}>{cargandoPreg ? <><MiniSpin /> Preparando…</> : '↺ Regenerar'}</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {entregables.map((g) => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Edit valor={g.tipo} ph="Tipo" onSave={(v) => editar(g.id, 'tipo', v)} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px' }} />
              <button type="button" onClick={() => borrar(g.id)} aria-label="Quitar" style={{ border: 'none', background: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 15, padding: 2 }}>✕</button>
            </div>
            <Edit valor={g.nombre} ph="Nombre del entregable" onSave={(v) => editar(g.id, 'nombre', v)} style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
            <Edit valor={g.queEs} ph="¿Qué es y qué resuelve?" onSave={(v) => editar(g.id, 'queEs', v)} style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55 }} />
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#C8870C', marginBottom: 4 }}>Gancho para el anuncio (FOMO)</div>
              <Edit valor={g.fomo} ph="La línea de FOMO para el ad" onSave={(v) => editar(g.id, 'fomo', v)} style={{ fontSize: 13.5, fontStyle: 'italic', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.45 }} />
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
    </div>
  );
}
