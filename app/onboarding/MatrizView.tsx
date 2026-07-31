'use client';

// =============================================================================
// MatrizView — la MATRIZ 3×3 (avatar × razón), con pop-up rico por celda
// =============================================================================
// La tabla: filas = avatares, columnas = las razones de ESE avatar. Cada celda es un
// anuncio en potencia; al hacer clic se abre un modal (tamaño FIJO, scroll interno)
// con tabs: Contexto (copy + avatar + razón + lead magnet, todo desplegable),
// Guiones, Imagen y Video. Crear un guion NUNCA pide redactar nada (pedido
// explícito: "la IA facilita"): o MaKo lo hace SOLO en un clic (elige ángulo,
// estructura y escribe), o el dueño "elige con MaKo" — la IA sugiere el ángulo y
// convierte sus preguntas en CERRADAS con opciones ya escritas; solo se toca un
// botón. Lee /api/onboarding/razones.

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { formatoPorId, type Medio } from '@/lib/angulos-data';
import { SeccionCard, parsearSecciones, type Seccion } from '../components/SeccionCard';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type GuionItem = { id: string; anguloId: string; anguloNombre: string; texto: string };
type Avatar = { id: string; nombre: string; segmento: string; senalesMeta: string; situacion: string; dolor: string };
type Celda = { id: string; avatarId: string; nombre: string; descripcion: string; copy: string; guiones: GuionItem[]; imagenUrl: string; anguloImagen: string; anguloVideo: string };
type AnguloGuionLite = { id: string; nombre: string; emoji: string; cuando: string; estructuras: string[] };
type EstructuraLite = { id: string; nombre: string; emoji: string; cuando: string };
type Estado = { razones: Celda[]; avatares: Avatar[]; tieneAvatares: boolean; tieneBrief: boolean; angulosGuion: AnguloGuionLite[]; estructurasGuion: EstructuraLite[]; siguientePasoDefault: string };
type Entregable = { id: string; nombre: string; tipo: string; queEs: string; fomo: string };
type TabModal = 'contexto' | 'guiones' | 'imagen' | 'video';
type PreguntaCerrada = { pregunta: string; opciones: string[] };

const btnPrimary: CSSProperties = { padding: '12px 22px', borderRadius: 11, border: 'none', background: 'var(--primary)', color: '#fff', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost: CSSProperties = { padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const btnMini: CSSProperties = { padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 };
const eyebrow: CSSProperties = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)' };

// Ícono por sección del guion (las etiquetas salen de las estructuras del catálogo).
const ICONO_GUION: Record<string, string> = {
  GANCHO: '🎣', HISTORIA: '📖', VALOR: '🎓', PROPUESTA: '💥', CTA: '👉',
  PROBLEMA: '😖', AGITACION: '🔥', SOLUCION: '💡',
  ATENCION: '🧲', INTERES: '👀', DESEO: '✨',
  ANTES: '⏮️', DESPUES: '⏭️', PUENTE: '🌉',
  PROMESA: '🤝', PINTURA: '🖼️', PRUEBA: '✅',
};
// Reconstruye el guion completo tras editar UNA sección (las tarjetas son
// independientes; el campo guardado sigue siendo un solo string con etiquetas).
const reconstruirGuion = (secciones: Seccion[]) => secciones.map((s) => `${s.titulo}\n${s.texto}`).join('\n\n');

function Edit({ valor, onSave, multiline, style }: { valor: string; onSave: (v: string) => void; multiline?: boolean; style?: CSSProperties }) {
  return (
    <div className="mtz-edit" contentEditable suppressContentEditableWarning spellCheck={false}
      onBlur={(e) => { const raw = e.currentTarget.innerText || ''; const nv = multiline ? raw.replace(/\n{3,}/g, '\n\n').trim() : raw.replace(/\s+/g, ' ').trim(); if (nv !== (valor ?? '').trim()) onSave(nv); }}
      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '4px 8px', margin: '0 -8px', whiteSpace: multiline ? 'pre-wrap' : 'normal', ...style }}
    >{valor}</div>
  );
}

export function MatrizView({ onListo }: { onListo?: (listo: boolean) => void } = {}) {
  const [est, setEst] = useState<Estado | null>(null);
  const [entregables, setEntregables] = useState<Entregable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [tabModal, setTabModal] = useState<TabModal>('contexto');
  const [genGuion, setGenGuion] = useState<false | 'auto' | 'manual'>(false);
  const [genAngulo, setGenAngulo] = useState<Medio | null>(null);
  // "Nuevo guion" en modo SUGERIDO. null = viendo la lista. Nunca hay campos
  // abiertos: MaKo sugiere el ángulo (+ por qué), la estructura y preguntas
  // CERRADAS con opciones ya escritas; el dueño solo toca botones.
  const [nuevo, setNuevo] = useState<NuevoGuion | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [jr, je] = await Promise.all([
        (await fetch('/api/onboarding/razones')).json(),
        (await fetch('/api/onboarding/entregable')).json().catch(() => ({})),
      ]);
      if (jr.ok) setEst(jr as Estado); else setErr(jr.error);
      if (je && Array.isArray(je.entregables)) setEntregables(je.entregables as Entregable[]);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { onListo?.(!!est && est.razones.length > 0); }, [est, onListo]);

  const generar = async () => {
    setGen(true); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generar' }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar la matriz.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGen(false); }
  };

  const guardar = async (razones: Celda[]) => {
    setEst((e) => (e ? { ...e, razones } : e));
    const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guardar', razones }) })).json();
    if (j.ok) setEst(j as Estado);
  };
  const editar = (id: string, campo: keyof Celda, v: unknown) => {
    if (!est) return;
    guardar(est.razones.map((r) => (r.id === id ? { ...r, [campo]: v } : r)));
  };
  const generarGuion = async (id: string, params: { anguloId: string; estructuraId: string; siguientePaso: string; respuestasAngulo: Array<{ pregunta: string; respuesta: string }> }) => {
    setGenGuion('manual'); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guion', id, ...params }) })).json();
      if (j.ok) { setEst(j as Estado); setNuevo(null); } else setErr(j.error || 'No se pudo generar el guion.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGenGuion(false); }
  };
  // "MaKo lo hace solo": un clic — la IA elige ángulo + estructura y escribe.
  const generarGuionAuto = async (id: string) => {
    setGenGuion('auto'); setErr(null); setNuevo(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guion-auto', id }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo generar el guion.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGenGuion(false); }
  };
  // "Elegir con MaKo": pide la sugerencia (ángulo + estructura + preguntas
  // cerradas). Si anguloId viene, el dueño lo fijó a mano y solo se piden las
  // preguntas cerradas de ESE ángulo. Si la IA falla, se degrada a elegir el
  // ángulo a mano sin preguntas — nunca un dead-end ni un campo abierto.
  const sugerirGuion = async (id: string, anguloId?: string) => {
    setErr(null);
    setNuevo({ fase: 'cargando', anguloId: anguloId ?? '', porQue: '', estructuraId: '', preguntas: [], elegidas: [], siguientePaso: est?.siguientePasoDefault ?? '', cambiandoAngulo: false });
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'guion-sugerir', id, ...(anguloId ? { anguloId } : {}) }) })).json();
      if (j.ok) {
        const s = j.sugerencia as { anguloId: string; porQue: string; estructuraId: string; preguntas: PreguntaCerrada[] };
        setNuevo({ fase: 'elegir', anguloId: s.anguloId, porQue: s.porQue, estructuraId: s.estructuraId, preguntas: s.preguntas, elegidas: s.preguntas.map(() => null), siguientePaso: est?.siguientePasoDefault ?? '', cambiandoAngulo: false });
      } else {
        setNuevo({ fase: 'elegir', anguloId: anguloId ?? '', porQue: '', estructuraId: '', preguntas: [], elegidas: [], siguientePaso: est?.siguientePasoDefault ?? '', cambiandoAngulo: !anguloId });
      }
    } catch {
      setNuevo({ fase: 'elegir', anguloId: anguloId ?? '', porQue: '', estructuraId: '', preguntas: [], elegidas: [], siguientePaso: est?.siguientePasoDefault ?? '', cambiandoAngulo: !anguloId });
    }
  };
  const elegirAngulo = async (id: string, medio: Medio) => {
    setGenAngulo(medio); setErr(null);
    try {
      const j = await (await fetch('/api/onboarding/razones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'angulo', id, medio }) })).json();
      if (j.ok) setEst(j as Estado); else setErr(j.error || 'No se pudo elegir el ángulo.');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGenAngulo(null); }
  };

  const copiarGuion = async (g: GuionItem) => {
    try { await navigator.clipboard.writeText(g.texto); setCopiado(g.id); setTimeout(() => setCopiado(null), 1600); }
    catch { setErr('No se pudo copiar al portapapeles.'); }
  };
  const descargarGuion = (celda: Celda, g: GuionItem) => {
    const nombre = `guion-${(g.anguloNombre || 'general').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}-${celda.nombre.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, '-')}.md`;
    const md = `# Guion · ${celda.nombre}\n\nÁngulo: ${g.anguloNombre}\n\n${g.texto}\n`;
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
  };

  const css = <style>{'@keyframes mtz-spin{to{transform:rotate(360deg)}}@keyframes mtz-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}.mtz-edit:hover{background:var(--surface-2)}.mtz-edit:focus{background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--border-strong)}.mtz-cell:hover{background:var(--surface-2)!important;border-color:var(--primary)!important}.mtz-cell:hover .mtz-arrow{color:var(--primary)!important}.mtz-angulo:hover{border-color:var(--primary)!important;background:var(--primary-bg)!important}'}</style>;

  if (cargando) return <div style={{ ...eyebrow, padding: '18px 0', textAlign: 'center' }}>Cargando tu matriz…</div>;

  const razones = est?.razones ?? [];
  const avatares = est?.avatares ?? [];
  const razonesDe = (avId: string) => razones.filter((r) => r.avatarId === avId);
  const maxCols = Math.max(1, ...avatares.map((a) => razonesDe(a.id).length));

  if (gen) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {css}
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mtz-spin .8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 22 }}>MaKo está armando tu matriz</div>
      </div>
    );
  }

  if (!est?.tieneAvatares) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 12px', lineHeight: 1.25 }}>Tu matriz de anuncios</h2>
        <div style={{ fontSize: 13.5, color: 'var(--warn)', lineHeight: 1.6 }}>Primero define tus avatares (y sube tu negocio en El Archivero).</div>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  if (!razones.length) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '48px 0' }}>
        {css}
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
        <h2 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 24px', lineHeight: 1.25 }}>Tu matriz de anuncios</h2>
        <button type="button" onClick={generar} style={btnPrimary}>✦ Armar mi matriz</button>
        {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 16 }}>{err}</div>}
      </div>
    );
  }

  const celda = abierta ? razones.find((r) => r.id === abierta) : null;
  const avatarDe = (id: string) => avatares.find((a) => a.id === id);
  const abrir = (id: string) => { setAbierta(id); setTabModal('contexto'); setNuevo(null); };

  return (
    <div>
      {css}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ ...eyebrow }}>Tu matriz de anuncios</div>
        <button type="button" onClick={generar} style={btnGhost}>↺ Regenerar</button>
      </div>

      {/* La grilla entra sin scroll horizontal: columnas flexibles (minmax 0,1fr) y la
          columna Avatar angosta. El detalle de cada anuncio vive en el pop-up. */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `minmax(88px, 124px) repeat(${maxCols}, minmax(0, 1fr))` }}>
          {/* Cabecera */}
          <div style={{ ...eyebrow, padding: '11px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>Avatar</div>
          {Array.from({ length: maxCols }, (_, i) => (
            <div key={i} style={{ ...eyebrow, padding: '11px 12px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface-2)' }}>Razón {i + 1}</div>
          ))}

          {avatares.map((av) => {
            const rs = razonesDe(av.id);
            return (
              <div key={av.id} style={{ display: 'contents' }}>
                <div style={{ padding: '11px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.nombre}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{av.segmento}</div>
                </div>
                {Array.from({ length: maxCols }, (_, i) => {
                  const r = rs[i];
                  return (
                    <button key={i} type="button" className={r ? 'mtz-cell' : undefined} onClick={() => r && abrir(r.id)}
                      style={{ position: 'relative', textAlign: 'left', font: 'inherit', cursor: r ? 'pointer' : 'default', padding: '11px 26px 11px 12px', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: 'var(--surface)', transition: 'all .12s', minHeight: 52, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                      {r ? (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{r.nombre}</span>
                          {/* Flechita: señal de que la celda se abre. */}
                          <svg className="mtz-arrow" aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', top: 9, right: 9, color: 'var(--faint)', transition: 'color .12s' }}><path d="M7 17L17 7" /><path d="M7 7h10v10" /></svg>
                        </>
                      ) : <span style={{ fontSize: 12, color: 'var(--faint)' }}>—</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {err && !celda && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}

      {/* ── MODAL con tabs internas ── */}
      {celda && (() => {
        const av = avatarDe(celda.avatarId);
        const tabs: Array<{ k: TabModal; label: string }> = [
          { k: 'contexto', label: 'Contexto' }, { k: 'guiones', label: `Guiones${celda.guiones.length ? ` · ${celda.guiones.length}` : ''}` }, { k: 'imagen', label: 'Imagen' }, { k: 'video', label: 'Video' },
        ];
        return (
          <div onClick={() => setAbierta(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            {/* Alto FIJO (pedido explícito): el modal no cambia de tamaño según la
                tab — el cuerpo scrollea por dentro. */}
            <div onClick={(e) => e.stopPropagation()} style={{ animation: 'mtz-in .18s ease-out', width: 'min(680px, 100%)', height: 'min(640px, calc(100vh - 80px))', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: 16, boxShadow: '0 20px 60px rgba(18,21,27,.25)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 22px 12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...eyebrow, color: 'var(--accent)' }}>Anuncio · {av?.nombre || 'Avatar'}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2, marginTop: 3 }}>{celda.nombre}</div>
                </div>
                <button type="button" onClick={() => setAbierta(null)} aria-label="Cerrar" style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', fontSize: 15 }}>✕</button>
              </div>
              {/* Tabs internas — con WRAP: nunca scrollean de costado (pedido explícito). */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
                {tabs.map((t) => {
                  const on = tabModal === t.k;
                  return <button key={t.k} type="button" onClick={() => { setTabModal(t.k); setNuevo(null); }} style={{ border: 'none', borderBottom: `2px solid ${on ? 'var(--primary)' : 'transparent'}`, background: 'none', color: on ? 'var(--ink)' : 'var(--dim)', fontFamily: SANS, fontWeight: on ? 600 : 500, fontSize: 13, padding: '9px 10px', cursor: 'pointer', flex: 'none' }}>{t.label}</button>;
                })}
              </div>
              {/* Cuerpo — flex:1/minHeight:0 explícito: header y tabs SIEMPRE fijos arriba,
                  solo este bloque scrollea, sin importar cuán largo salga el contenido. */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px 22px' }}>
                {tabModal === 'contexto' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Todo desplegable (pedido explícito): copy abierto, el resto cerrado. */}
                    <SeccionCard s={{ titulo: 'Copy / hook del anuncio', texto: '' }} abiertoDefault icono="✍️" size="sm">
                      <Edit valor={celda.copy} multiline onSave={(v) => editar(celda.id, 'copy', v)} style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5, minHeight: 40 }} />
                    </SeccionCard>
                    <SeccionCard s={{ titulo: 'Avatar · a quién le hablas', texto: '' }} abiertoDefault={false} icono="👤" size="sm">
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{av?.nombre || '—'}</div>
                      {av && <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginTop: 6 }}><b>Segmento:</b> {av.segmento}<br /><b>Situación:</b> {av.situacion}<br /><b>Dolor:</b> {av.dolor}{av.senalesMeta && <><br /><b>Señales en Meta:</b> {av.senalesMeta}</>}</div>}
                    </SeccionCard>
                    <SeccionCard s={{ titulo: 'Razón de compra · la motivación', texto: '' }} abiertoDefault={false} icono="🧠" size="sm">
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{celda.nombre}</div>
                      <Edit valor={celda.descripcion} onSave={(v) => editar(celda.id, 'descripcion', v)} style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginTop: 6 }} />
                    </SeccionCard>
                    <SeccionCard s={{ titulo: 'Lead Magnet · el elemento tangible', texto: '' }} abiertoDefault={false} icono="🎁" size="sm">
                      {entregables.length
                        ? entregables.map((e) => (
                            <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '12px 14px', marginBottom: 10 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{e.nombre} <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', marginLeft: 6 }}>{e.tipo}</span></div>
                              <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, marginTop: 4 }}>{e.queEs}</div>
                              {e.fomo && <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.5, marginTop: 6 }}>“{e.fomo}”</div>}
                            </div>
                          ))
                        : <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6 }}>Todavía no definiste tu lead magnet — hazlo en la tab <b>Lead Magnet</b> del onboarding.</div>}
                    </SeccionCard>
                  </div>
                )}
                {tabModal === 'guiones' && (
                  <GuionesTab
                    celda={celda}
                    angulos={est?.angulosGuion ?? []}
                    estructuras={est?.estructurasGuion ?? []}
                    siguientePasoDefault={est?.siguientePasoDefault ?? ''}
                    nuevo={nuevo} setNuevo={setNuevo}
                    genGuion={genGuion}
                    copiado={copiado}
                    onAuto={() => generarGuionAuto(celda.id)}
                    onSugerir={(anguloId) => sugerirGuion(celda.id, anguloId)}
                    onGenerar={(params) => generarGuion(celda.id, params)}
                    onEditarGuion={(guionId, texto) => editar(celda.id, 'guiones', celda.guiones.map((g) => (g.id === guionId ? { ...g, texto } : g)))}
                    onBorrarGuion={(guionId) => editar(celda.id, 'guiones', celda.guiones.filter((g) => g.id !== guionId))}
                    onCopiar={copiarGuion}
                    onDescargar={(g) => descargarGuion(celda, g)}
                  />
                )}
                {tabModal === 'imagen' && (
                  <AnguloTab medio="imagen" formatoId={celda.anguloImagen} cargando={genAngulo === 'imagen'}
                    onElegir={() => elegirAngulo(celda.id, 'imagen')}
                    nota="Con este formato y la persona de marca, acá vas a generar la imagen del anuncio (próximamente)." />
                )}
                {tabModal === 'video' && (
                  <AnguloTab medio="video" formatoId={celda.anguloVideo} cargando={genAngulo === 'video'}
                    onElegir={() => elegirAngulo(celda.id, 'video')}
                    nota="Cada guion de la tab Guiones sigue este formato. Con eso, acá vas a generar el video (próximamente)." />
                )}
                {err && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 14, textAlign: 'center' }}>{err}</div>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Tab Guiones: la lista + "Nuevo guion" (MaKo solo, o elegir con MaKo) ──────
// Regla dura (pedido explícito): acá NUNCA hay un campo de texto abierto. MaKo
// sugiere el ángulo y la estructura; las preguntas del ángulo llegan CERRADAS
// (opciones ya escritas con el negocio real) y el CTA se elige entre chips.
type NuevoGuion = {
  fase: 'cargando' | 'elegir';
  anguloId: string;
  porQue: string;
  estructuraId: string;
  preguntas: PreguntaCerrada[];
  /** índice de la opción elegida por pregunta; null = que MaKo decida. */
  elegidas: Array<number | null>;
  siguientePaso: string;
  cambiandoAngulo: boolean;
};
function GuionesTab({ celda, angulos, estructuras, siguientePasoDefault, nuevo, setNuevo, genGuion, copiado, onAuto, onSugerir, onGenerar, onEditarGuion, onBorrarGuion, onCopiar, onDescargar }: {
  celda: Celda;
  angulos: AnguloGuionLite[];
  estructuras: EstructuraLite[];
  siguientePasoDefault: string;
  nuevo: NuevoGuion | null;
  setNuevo: (n: NuevoGuion | null) => void;
  genGuion: false | 'auto' | 'manual';
  copiado: string | null;
  onAuto: () => void;
  onSugerir: (anguloId?: string) => void;
  onGenerar: (params: { anguloId: string; estructuraId: string; siguientePaso: string; respuestasAngulo: Array<{ pregunta: string; respuesta: string }> }) => void;
  onEditarGuion: (guionId: string, texto: string) => void;
  onBorrarGuion: (guionId: string) => void;
  onCopiar: (g: GuionItem) => void;
  onDescargar: (g: GuionItem) => void;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(celda.guiones[0]?.id ?? null);

  const spinner = (texto: string) => (
    <div style={{ textAlign: 'center', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'mtz-spin .8s linear infinite' }} />
      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', marginTop: 18 }}>{texto}</div>
    </div>
  );
  if (genGuion) return spinner(genGuion === 'auto' ? 'MaKo está eligiendo el ángulo y escribiendo el guion…' : 'MaKo está escribiendo el guion…');
  if (nuevo?.fase === 'cargando') return spinner('MaKo está preparando las opciones con tu negocio…');

  // ── "Elegir con MaKo": todo sugerido, todo con botones ─────────────────────
  if (nuevo) {
    const angulo = angulos.find((a) => a.id === nuevo.anguloId);
    const compatibles = (angulo?.estructuras ?? []).map((id) => estructuras.find((e) => e.id === id)).filter((e): e is EstructuraLite => !!e);
    const opcionesEstructura = compatibles.length ? compatibles : estructuras;
    const chipCta = (o: string, on: boolean, onClick: () => void) => (
      <button key={o} type="button" onClick={onClick}
        style={{ fontFamily: SANS, fontSize: 11.5, padding: '6px 11px', borderRadius: 999, cursor: 'pointer', textAlign: 'left', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)', fontWeight: on ? 600 : 500 }}>
        {o}
      </button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={eyebrow}>Nuevo guion · MaKo sugiere, tú confirmas</div>
          <button type="button" onClick={() => setNuevo(null)} style={btnMini}>✕ Cancelar</button>
        </div>

        {/* El ÁNGULO: sugerido por MaKo (con su por qué), cambiable con un clic. */}
        {nuevo.cambiandoAngulo || !angulo ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Elige el ángulo{nuevo.porQue ? '' : ' (MaKo no pudo sugerir uno esta vez)'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 9 }}>
              {angulos.map((a) => (
                <button key={a.id} type="button" className="mtz-angulo" onClick={() => onSugerir(a.id)}
                  style={{ textAlign: 'left', cursor: 'pointer', fontFamily: SANS, padding: '12px 14px', borderRadius: 12, border: `1px solid ${a.id === nuevo.anguloId ? 'var(--primary)' : 'var(--border-strong)'}`, background: 'var(--surface)', transition: 'all .12s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden style={{ fontSize: 16 }}>{a.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{a.nombre}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45, marginTop: 5 }}>{a.cuando}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ border: '1px solid var(--primary)', background: 'var(--primary-bg)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span aria-hidden style={{ fontSize: 18, flex: 'none' }}>{angulo.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{angulo.nombre} <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--primary)', marginLeft: 6 }}>sugerido por MaKo</span></div>
              {nuevo.porQue && <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 3 }}>{nuevo.porQue}</div>}
            </div>
            <button type="button" onClick={() => setNuevo({ ...nuevo, cambiandoAngulo: true })} style={{ ...btnMini, flex: 'none' }}>Cambiar</button>
          </div>
        )}

        {angulo && !nuevo.cambiandoAngulo && (
          <>
            {opcionesEstructura.length > 1 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>¿Con qué estructura lo contamos?</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {opcionesEstructura.map((e) => {
                    const on = nuevo.estructuraId ? nuevo.estructuraId === e.id : e.id === opcionesEstructura[0].id;
                    return (
                      <button key={e.id} type="button" onClick={() => setNuevo({ ...nuevo, estructuraId: e.id })} title={e.cuando}
                        style={{ fontFamily: SANS, fontSize: 12, padding: '7px 12px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--primary)' : 'var(--dim)', fontWeight: on ? 600 : 500 }}>
                        {e.emoji} {e.nombre}{e.id === nuevo.estructuraId && nuevo.porQue ? ' · sugerida' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Las preguntas del ángulo, ya CERRADAS por MaKo: solo tocar un botón.
                Volver a tocar la elegida la des-elige (= que MaKo decida). */}
            {nuevo.preguntas.map((p, i) => (
              <div key={i}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{p.pregunta} <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--faint)' }}>(si no eliges, MaKo decide)</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.opciones.map((o, j) => {
                    const on = nuevo.elegidas[i] === j;
                    return (
                      <button key={j} type="button"
                        onClick={() => setNuevo({ ...nuevo, elegidas: nuevo.elegidas.map((e, k) => (k === i ? (on ? null : j) : e)) })}
                        style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.45, textAlign: 'left', padding: '9px 13px', borderRadius: 11, cursor: 'pointer', border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', color: on ? 'var(--ink)' : 'var(--dim)', fontWeight: on ? 600 : 500 }}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>¿Qué ve o recibe la persona justo después de hacer clic?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {[siguientePasoDefault, 've un video de ventas (VSL) y después puede agendar una llamada', 'recibe un recurso gratis por WhatsApp', 'recibe una cotización por WhatsApp', 'se registra a un webinar en vivo', 'compra directo en la página'].filter((o, i, arr) => o && arr.indexOf(o) === i).map((o) =>
                  chipCta(o, nuevo.siguientePaso === o, () => setNuevo({ ...nuevo, siguientePaso: o })))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button"
                onClick={() => onGenerar({
                  anguloId: nuevo.anguloId,
                  estructuraId: nuevo.estructuraId || opcionesEstructura[0]?.id || '',
                  siguientePaso: nuevo.siguientePaso || siguientePasoDefault,
                  respuestasAngulo: nuevo.preguntas.map((p, i) => (nuevo.elegidas[i] == null ? null : { pregunta: p.pregunta, respuesta: p.opciones[nuevo.elegidas[i] as number] })).filter((r): r is { pregunta: string; respuesta: string } => !!r),
                })}
                style={btnPrimary}>✦ Generar guion</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── La lista de guiones de la celda ────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={eyebrow}>Guiones · solo lo que se dice</div>
        <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
          <button type="button" onClick={() => onSugerir()} style={btnMini}>Elegir con MaKo</button>
          <button type="button" onClick={onAuto} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 12.5 }}>✦ MaKo lo hace solo</button>
        </div>
      </div>
      {celda.guiones.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, textAlign: 'center', padding: '28px 0' }}>
          Todavía no hay guiones. Con <b>✦ MaKo lo hace solo</b>, MaKo elige el ángulo y escribe el guion con tu voz, en un clic.
          <br />Puedes tener varios por anuncio — uno por ángulo — y testearlos por separado.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {celda.guiones.map((g) => {
          const abierto = abiertoId === g.id;
          const secciones = parsearSecciones(g.texto, undefined, 20);
          return (
            <div key={g.id} style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--surface-2)', borderBottom: abierto ? '1px solid var(--border)' : 'none' }}>
                <button type="button" onClick={() => setAbiertoId(abierto ? null : g.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: SANS, padding: 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 999, padding: '3px 10px', flex: 'none' }}>{g.anguloNombre}</span>
                  <span aria-hidden style={{ marginLeft: 'auto', flex: 'none', color: 'var(--faint)', fontSize: 12, transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                </button>
                <button type="button" onClick={() => onCopiar(g)} style={btnMini} title="Copiar todo el guion">{copiado === g.id ? '✓ Copiado' : '📋 Copiar'}</button>
                <button type="button" onClick={() => onDescargar(g)} style={btnMini} title="Descargar como .md">⬇ .md</button>
                <button type="button" onClick={() => onBorrarGuion(g.id)} aria-label="Borrar guion" style={{ ...btnMini, padding: '5px 8px' }}>✕</button>
              </div>
              {abierto && (
                <div style={{ padding: 12 }}>
                  {secciones.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {secciones.map((s, i) => (
                        <SeccionCard key={s.titulo + i} s={s} abiertoDefault={i < 1} icono={ICONO_GUION[s.titulo] ?? '🎬'} size="sm">
                          <Edit valor={s.texto} multiline
                            onSave={(v) => onEditarGuion(g.id, reconstruirGuion(secciones.map((sec, j) => (j === i ? { ...sec, texto: v } : sec))))}
                            style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6 }} />
                        </SeccionCard>
                      ))}
                    </div>
                  ) : (
                    // Guion sin las etiquetas esperadas (texto viejo u otro formato):
                    // no lo perdemos, se ve entero y editable igual.
                    <Edit valor={g.texto} multiline onSave={(v) => onEditarGuion(g.id, v)} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', margin: 0 }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tab Imagen/Video: el FORMATO elegido por la IA para ese medio, o el botón para
// que MaKo lo elija de la biblioteca. La generación real de imagen/video llega después.
function AnguloTab({ medio, formatoId, cargando, onElegir, nota }: { medio: Medio; formatoId: string; cargando: boolean; onElegir: () => void; nota: string }) {
  const fmt = formatoId ? formatoPorId(formatoId) : undefined;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={eyebrow}>Formato de {medio === 'imagen' ? 'imagen' : 'video'}</div>
        {fmt && <button type="button" onClick={onElegir} disabled={cargando} style={{ ...btnGhost, opacity: cargando ? 0.6 : 1 }}>{cargando ? 'Eligiendo…' : '↺ Que la IA cambie el formato'}</button>}
      </div>
      {fmt ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmt.nombre}</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.55, marginTop: 5 }}>{fmt.descripcion}</div>
          <div style={{ fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' }}>Ej: {fmt.ejemplo}</div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '26px 14px', border: '1px dashed var(--border-strong)', borderRadius: 12, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.55, marginBottom: 14, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>MaKo elige el mejor formato de {medio} de su biblioteca para este anuncio.</div>
          <button type="button" onClick={onElegir} disabled={cargando} style={{ ...btnPrimary, opacity: cargando ? 0.6 : 1 }}>{cargando ? 'Eligiendo…' : '✦ Que la IA elija el formato'}</button>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>{nota}</div>
    </div>
  );
}
