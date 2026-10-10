'use client';

// =============================================================================
// EntregableView — el elemento TANGIBLE de la oferta (el que genera FOMO)
// =============================================================================
// Self-contained: /api/onboarding/entregable. MaKo pregunta de a UNA, ADAPTANDO la
// siguiente pregunta a lo que ya contestaste (si decís que ya tenés algo concreto,
// te puede pedir que lo subas) — nunca un lote fijo de preguntas genéricas, y nunca
// "Saltar": cada pregunta trae opciones cerradas que siempre aplican. Cuando MaKo
// decide que ya sabe suficiente, propone 1-3 entregables tangibles con su línea de
// FOMO. Edición inline. Corre con la IA gratis del cliente.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
type Estado = { entregables: Entregable[]; tieneBrief: boolean };
type PasoHistorial = { pregunta: string; respuesta: string };
type PreguntaDinamica = { pregunta: string; tipo: 'opciones' | 'archivo'; opciones: string[] };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };
const linkBtn: CSSProperties = { background: 'none', border: 'none', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, textDecoration: 'underline', cursor: 'pointer', padding: 0 };

function Edit({ valor, ph, onSave, style }: { valor: string; ph?: string; onSave: (v: string) => void; style?: CSSProperties }) {
  return (
    <div className="ent-edit" contentEditable suppressContentEditableWarning spellCheck={false} data-ph={ph || 'Escribe…'}
      onBlur={(e) => { const nv = (e.currentTarget.textContent || '').replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '2px 6px', margin: '0 -6px', ...style }}
    >{valor}</div>
  );
}

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
  // Conversación de a 1: `historial` son las ya contestadas, `preguntaActual` la que
  // se está mostrando ahora. `vistas[i]` es la pregunta que generó `historial[i]` —
  // así "← Atrás" puede volver a mostrarla sin pedirle otra vez a la IA.
  const [historial, setHistorial] = useState<PasoHistorial[]>([]);
  const [vistas, setVistas] = useState<PreguntaDinamica[]>([]);
  const [preguntaActual, setPreguntaActual] = useState<PreguntaDinamica | null>(null);
  const [cargandoPreg, setCargandoPreg] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const cargar = useCallback(async () => {
    try { const j = await (await fetch('/api/onboarding/entregable')).json(); if (j.ok) setEst(j as Estado); else setErr(j.error); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.entregables.length > 0); }, [est, onListo]);

  const generar = async (rs: PasoHistorial[]) => {
    setPreguntaActual(null); setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar', respuestas: rs }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo detectar el lead magnet.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  // Pide la SIGUIENTE pregunta a la IA, dado el historial acumulado — o directamente
  // genera si la IA ya considera que sabe suficiente.
  const pedirSiguiente = async (hist: PasoHistorial[]) => {
    setCargandoPreg(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'siguiente', historial: hist }) })).json();
      if (!j.ok) { setErr(j.error || 'No se pudo preparar la siguiente pregunta.'); setCargandoPreg(false); return; }
      if (j.terminado) { generar(hist); return; }
      setPreguntaActual(j.pregunta as PreguntaDinamica);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCargandoPreg(false); }
  };

  const empezar = () => { setHistorial([]); setVistas([]); void pedirSiguiente([]); };

  // Cualquier respuesta (opción elegida, archivo subido o declinado) sigue el MISMO
  // camino: se agrega al historial y se pide la próxima pregunta.
  const responder = (respuesta: string) => {
    if (!preguntaActual) return;
    const paso: PasoHistorial = { pregunta: preguntaActual.pregunta, respuesta };
    const nuevoHist = [...historial, paso];
    const nuevasVistas = [...vistas, preguntaActual];
    setHistorial(nuevoHist); setVistas(nuevasVistas);
    void pedirSiguiente(nuevoHist);
  };

  const subirArchivo = async (file: File) => {
    setSubiendoArchivo(true); setErr(null);
    try {
      const imagenDataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        r.readAsDataURL(file);
      });
      const j = await (await fetch('/api/onboarding/entregable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'describir-archivo', imagenDataUrl }) })).json();
      const descripcion = j.ok ? String(j.descripcion) : 'Subió un archivo, pero no pude leerlo.';
      responder(`Subió un archivo — esto se ve: ${descripcion}`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSubiendoArchivo(false); }
  };

  // Vuelve a la pregunta anterior (ya la tenemos guardada, no hace falta pedirle nada
  // a la IA) para poder CAMBIAR la respuesta — de ahí en más sigue todo de nuevo.
  const atras = () => {
    if (!vistas.length) return;
    const prev = vistas[vistas.length - 1];
    setVistas(vistas.slice(0, -1));
    setHistorial(historial.slice(0, -1));
    setPreguntaActual(prev);
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

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu lead magnet…</div>;

  const entregables = est?.entregables ?? [];

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ent-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está buscando tu lead magnet</div>
      </div>
    );
  }

  // Preparando la próxima pregunta — pantalla propia (antes se quedaba sin feedback).
  if (cargandoPreg) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'ent-spin .8s linear infinite' }} />
        <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', marginTop: 18 }}>Preparando la siguiente pregunta…</div>
      </div>
    );
  }

  // Pregunta 1×1, ADAPTATIVA — nunca "Saltar": las opciones siempre cubren el caso.
  if (preguntaActual) {
    const q = preguntaActual;
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '18px 0' }}>
        {css}
        <div style={{ ...eyebrow, marginBottom: 18 }}>Para afinar tu lead magnet · pregunta {historial.length + 1} de hasta 4</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 22px', lineHeight: 1.3 }}>{q.pregunta}</h2>
        {q.tipo === 'archivo' ? (
          <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px', borderRadius: 12, border: '1.5px dashed var(--border-strong)', color: subiendoArchivo ? 'var(--faint)' : 'var(--primary)', fontWeight: 600, fontSize: 14, cursor: subiendoArchivo ? 'default' : 'pointer', background: 'var(--surface-2)' }}>
              <input type="file" accept="image/*,application/pdf" disabled={subiendoArchivo} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirArchivo(f); }} />
              {subiendoArchivo ? <><MiniSpin /> Leyendo…</> : '📎 Subir imagen o archivo'}
            </label>
            <button type="button" disabled={subiendoArchivo} onClick={() => responder('No tiene un archivo para mostrar ahora.')} style={{ ...btnGhost, justifyContent: 'center', opacity: subiendoArchivo ? 0.5 : 1 }}>No tengo, sigamos →</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
            {q.opciones.map((o, i) => (
              <button key={i} type="button" onClick={() => responder(o)}
                style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, fontSize: 14.5, padding: '13px 16px', borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', lineHeight: 1.4 }}>{o}</button>
            ))}
          </div>
        )}
        {historial.length > 0 && <div style={{ marginTop: 22 }}><button type="button" onClick={atras} style={linkBtn}>← Atrás</button></div>}
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!entregables.length) {
    return (
      <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', padding: '40px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧲</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 20px', lineHeight: 1.25 }}>Tu lead magnet</h2>
        {est?.tieneBrief
          ? <button type="button" onClick={empezar} style={btnPrimary}>✦ Que MaKo lo detecte</button>
          : <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero carga tu negocio en <b>El Archivero</b>.</div>}
        {/* Contexto: para qué es, siempre debajo del botón */}
        <div style={{ marginTop: 22, textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px' }}>
          <div style={{ ...eyebrow, marginBottom: 7 }}>¿Qué es el lead magnet?</div>
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
        <div style={{ ...eyebrow }}>Tu lead magnet · el elemento tangible</div>
        {est?.tieneBrief && <button type="button" onClick={empezar} style={btnGhost}>↺ Regenerar</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {entregables.map((g) => (
          <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: 18, display: 'flex', flexDirection: 'column', gap: 11, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Edit valor={g.tipo} ph="Tipo" onSave={(v) => editar(g.id, 'tipo', v)} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px' }} />
              <BotonBorrar talla="sm" onClick={() => borrar(g.id)} title="Borrar este entregable" />
            </div>
            <Edit valor={g.nombre} ph="Nombre del lead magnet" onSave={(v) => editar(g.id, 'nombre', v)} style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }} />
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
