'use client';

// =============================================================================
// entidades/llamada — la ficha de UNA llamada, partida en piezas (tanda v5, I3 del contrato)
// =============================================================================
// Martín (12/10/2026): el pop-up es una mini-hoja, y la plantilla «Llamada» es la ficha de hoy partida en piezas
// que quien arma el pop-up pone donde quiere. Esto era el adentro de ./FichaLlamada.tsx (el port del detalle de
// la tab Closing): se mudó acá ENTERO, y la ficha de siempre (la del `?llamada=` y la del
// «Ver llamada» del detalle) es ahora un Modal que monta `CuerpoFichaLlamada` y `PieFichaLlamada`. Una sola
// implementación de cada sección: la pieza suelta y la ficha entera dibujan lo mismo.
//
// Las piezas (PIEZAS_ENTIDAD.llamada, lib/graficos-acciones.ts): la cabecera (puntaje y desenlace), el reproductor
// de Fathom, el resumen, el próximo paso, las dimensiones con su cita, fortalezas y a mejorar, las objeciones, el
// coaching, los momentos, el transcript, y `completo` (la ficha entera, con sus tareas: la que pone la migración).
//
// Lo que no se ve en la firma:
//   · UNA LECTURA POR LLAMADA, la compartan cuantas piezas la compartan (`useLlamada`, un store por recording_id
//     con `useSyncExternalStore`): un pop-up con seis piezas no pide seis veces GET /api/closing/llamada. Después
//     de una tarea (re-analizar, revisar) se vuelve a pedir y se enteran todas.
//   · Cada pedido lleva `signal` con el tope de su ruta (TOPE_MS, lib/llamadas-modelo.ts).
//   · Lo que se dijo (el transcript) se trae de Fathom EN VIVO al abrir esa pieza, una vez por pestaña.
//   · Las TAREAS (revisar, re-analizar) son de admin y closer y las rutas lo vuelven a mirar
//     (app/api/closing/puerta.ts). `soloLectura` las apaga (un link compartido no llega acá: el pop-up no se sirve).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Button, ButtonLink, MONO, Spinner, Tabs } from '@/app/_ui';
import type { ClosingDim, ClosingEdit, ClosingEvidence, ClosingMoment, ClosingObjection, Tone } from '@/lib/closing';
import { colorPuntaje, suave } from '../piezas';
import {
  GRUPOS_DIM, TONO_ROTULO, TOPE_MS, colorDeTono, enMinutos, estadoDeLlamada, fechaDdMm, fmtPuntaje, linkAlSegundo, marcasDeTranscript,
  mmss, nombreDeLlamada, partirResumen, postearTarea, promedio, puntajeEnVivo, reproductorFathom, esLinkHttp,
  type LineaTranscript, type LlamadaFicha,
} from '@/lib/llamadas-modelo';

export const CSS_FICHA = `
.fl-boton { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--primary); background: none; border: none; padding: 0; cursor: pointer; text-align: left; }
.fl-boton:hover { text-decoration: underline; }
.fl-boton:focus-visible, .fl-fila:focus-visible, .fl-seg:focus-visible, .fl-pildora:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 6px; }
.fl-fila { display: flex; width: 100%; align-items: center; gap: 14px; padding: 11px 0; font: inherit; color: inherit; text-align: left; background: none; border: none; cursor: pointer; }
.fl-fila:disabled { cursor: default; }
.fl-fila:hover:not(:disabled) { box-shadow: inset 0 0 0 999px var(--velo-hover); }
.fl-seg { flex: none; font-family: ${MONO}; font-size: 11px; font-weight: 600; background: none; border: none; padding: 0; cursor: pointer; white-space: nowrap; }
.fl-seg:hover { text-decoration: underline; }
.fl-rotulo { font-family: ${MONO}; font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }
.fl-pildoras { display: inline-flex; gap: 2px; padding: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 9px; }
.fl-pildora { font: inherit; font-size: 12.5px; padding: 5px 10px; border: none; border-radius: 7px; cursor: pointer; background: transparent; color: var(--faint); }
.fl-pildora[aria-pressed="true"] { background: var(--surface-2); font-weight: 600; }
.fl-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 28px; }
`;

/** La hoja de estilos de la ficha: React la deduplica por `href`, así que cada pieza la puede poner. */
export const EstilosFicha = () => <style href="dash-ficha-llamada" precedence="medium">{CSS_FICHA}</style>;

type Play = ((seg: number) => void) | null;

// ── La lectura: UNA por llamada, compartida ──────────────────────────────────────────────────

type Lectura = { estado: 'cargando' | 'listo' | 'error'; llamada: LlamadaFicha | null; error: string | null; en: number };
const LECTURAS = new Map<number, Lectura>();
const AVISAR = new Set<() => void>();
const avisar = () => { for (const f of AVISAR) f(); };
const suscribir = (f: () => void) => { AVISAR.add(f); return () => { AVISAR.delete(f); }; };
/** Cuánto vale una lectura: después de esto, una pieza que se monta la vuelve a pedir (la sincronización corre sola). */
const VIGENCIA_MS = 60_000;

function pedirLlamada(id: number): void {
  const previa = LECTURAS.get(id);
  // Si falla una RE-lectura (después de una tarea), se sigue viendo lo que había: el error va arriba.
  LECTURAS.set(id, { estado: 'cargando', llamada: previa?.llamada ?? null, error: null, en: Date.now() });
  avisar();
  fetch(`/api/closing/llamada?recording_id=${id}`, { signal: AbortSignal.timeout(TOPE_MS.llamada), cache: 'no-store' })
    .then(async (r) => {
      const j = (await r.json().catch(() => null)) as { ok?: boolean; llamada?: LlamadaFicha; error?: string } | null;
      const antes = LECTURAS.get(id)?.llamada ?? null;
      LECTURAS.set(id, r.ok && j?.ok && j.llamada
        ? { estado: 'listo', llamada: j.llamada, error: null, en: Date.now() }
        : { estado: 'error', llamada: antes, error: j?.error ?? 'No pude leer la llamada', en: Date.now() });
    })
    .catch((e) => {
      const vencido = e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'TimeoutError';
      LECTURAS.set(id, { estado: 'error', llamada: LECTURAS.get(id)?.llamada ?? null, error: vencido ? 'Tardó demasiado. Prueba de nuevo.' : 'No pude leer la llamada', en: Date.now() });
    })
    .finally(avisar);
}

/** La llamada `id` (una lectura compartida por todas las piezas), y cómo volver a pedirla. */
export function useLlamada(id: number | null): { llamada: LlamadaFicha | null; cargando: boolean; error: string | null; recargar: () => void } {
  const l = useSyncExternalStore(suscribir, () => (id != null ? LECTURAS.get(id) : undefined), () => undefined);
  useEffect(() => {
    if (id == null) return;
    const ya = LECTURAS.get(id);
    if (!ya || (ya.estado !== 'cargando' && Date.now() - ya.en > VIGENCIA_MS)) pedirLlamada(id);
  }, [id]);
  const recargar = useCallback(() => { if (id != null) pedirLlamada(id); }, [id]);
  return { llamada: l?.llamada ?? null, cargando: !l || l.estado === 'cargando', error: l?.estado === 'error' ? l.error : null, recargar };
}

// ── Las piezas ──────────────────────────────────────────────────────────────────────────────

function Rotulo({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div className="fl-rotulo" style={{ ...(color ? { color } : {}), ...style }}>{children}</div>;
}

/** El salto a un segundo: abre la grabación en Fathom en ese segundo (el embed no salta, se probó). */
export function usePlay(llamada: LlamadaFicha | null): Play {
  return useMemo(() => {
    if (!llamada || !esLinkHttp(llamada.share_url)) return null;
    const share = llamada.share_url;
    return (seg: number) => {
      const url = linkAlSegundo(share, seg);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };
  }, [llamada]);
}

export function Cabecera({ llamada }: { llamada: LlamadaFicha }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ flex: 'none', textAlign: 'center', minWidth: 56 }}>
        <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1, color: colorPuntaje(llamada.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtPuntaje(llamada.score)}</div>
        <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 2 }}>/ 10</div>
      </div>
      <div style={{ minWidth: 0, fontSize: 13.5, color: 'var(--dim)' }}>
        {llamada.lead_empresa || llamada.invitee_email || '—'}
        {llamada.closer && <> · Closer <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{llamada.closer}</strong></>}
        {llamada.outcome && <span style={{ color: colorDeTono(llamada.outcome_tone), fontWeight: 600 }}> · {llamada.outcome}</span>}
      </div>
    </div>
  );
}

export function Reproductor({ llamada, ancho = 420 }: { llamada: LlamadaFicha; ancho?: number | string }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const fathom = reproductorFathom(llamada.share_url, llamada.embed_token);
  const caja: CSSProperties = { position: 'relative', width: ancho, maxWidth: '100%', aspectRatio: '16 / 9', borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', flex: 'none' };
  if (!fathom) {
    return esLinkHttp(llamada.share_url)
      ? <a href={llamada.share_url} target="_blank" rel="noopener noreferrer" style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--primary)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>▶ Ver en Fathom ↗</a>
      : <div style={{ ...caja, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--faint)', fontSize: 13 }}>Sin grabación</div>;
  }
  if (reproduciendo) {
    return (
      <div style={{ ...caja, background: '#000' }}>
        <iframe src={fathom.src} title="Grabación de Fathom" allow="autoplay; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: '100%', border: 0 }} />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setReproduciendo(true)} aria-label="Reproducir la grabación"
      style={{ ...caja, padding: 0, cursor: 'pointer', background: 'linear-gradient(135deg, #1E212A, #14161B)', font: 'inherit' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fathom.miniatura} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(18,21,27,.18)' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,.35)' }}>
          <span style={{ marginLeft: 5, borderStyle: 'solid', borderWidth: '10px 0 10px 16px', borderColor: 'transparent transparent transparent #12151B' }} />
        </span>
      </span>
      <span style={{ position: 'absolute', top: 10, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: 'rgba(18,21,27,.6)', fontFamily: MONO, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#EF5B53' }} />Fathom
      </span>
      <span style={{ position: 'absolute', right: 12, bottom: 10, fontFamily: MONO, fontSize: 10.5, color: 'rgba(255,255,255,.85)' }}>{enMinutos(llamada.duration_min)}</span>
    </button>
  );
}

export function Resumen({ llamada }: { llamada: LlamadaFicha }) {
  const { primera, resto } = partirResumen(llamada.summary);
  const tono = llamada.outcome_tone ?? 'warn';
  return (
    <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, flexWrap: 'wrap' }}>
        <Rotulo>Resumen del análisis</Rotulo>
        {llamada.outcome && (
          <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, fontFamily: MONO, color: colorDeTono(tono), background: suave(colorDeTono(tono), 12), border: `1px solid ${colorDeTono(tono)}` }}>{llamada.outcome}</span>
        )}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.38, color: 'var(--ink)' }}>{primera || 'Sin resumen.'}</div>
      {resto && <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--dim)', marginTop: 9 }}>{resto}</div>}
    </div>
  );
}

export function Historial({ ediciones }: { ediciones: ClosingEdit[] }) {
  const [abierto, setAbierto] = useState(false);
  const ultima = ediciones[ediciones.length - 1];
  return (
    <div>
      <button type="button" className="fl-boton" aria-expanded={abierto} onClick={() => setAbierto((o) => !o)} style={{ color: 'var(--faint)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mako)' }} />
        Revisada {ediciones.length === 1 ? 'una vez' : `${ediciones.length} veces`} · la última {ultima.tipo === 'mako' ? 'con MaKo' : 'a mano'} {abierto ? '▾' : '▸'}
      </button>
      {abierto && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
          {[...ediciones].reverse().map((e, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: e.tipo === 'mako' ? 'var(--mako-ink)' : 'var(--dim)' }}>{e.tipo === 'mako' ? '✦ MaKo' : '✎ a mano'}</span>
              {e.score_antes != null && e.score_despues != null && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}> · {fmtPuntaje(e.score_antes)}→{fmtPuntaje(e.score_despues)}</span>}
              {e.resumen && <span> · {e.resumen}</span>}
              <span style={{ color: 'var(--faint)' }}> · {fechaDdMm(e.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Segundo({ seg, onPlay, color }: { seg: number | null | undefined; onPlay: Play; color?: string }) {
  if (seg == null || !Number.isFinite(seg)) return null;
  if (!onPlay) return <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{mmss(seg)}</span>;
  return (
    <button type="button" className="fl-seg" title="Abrir en Fathom desde este minuto" style={{ color: color ?? 'var(--primary)' }}
      onClick={(e) => { e.stopPropagation(); onPlay(seg); }}>▶ {mmss(seg)}</button>
  );
}

export function ProximoPaso({ llamada }: { llamada: LlamadaFicha }) {
  if (!llamada.next_step) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin próximo paso.</p>;
  return (
    <div style={{ background: suave('var(--mako)', 8), border: `1px solid ${suave('var(--mako)', 40)}`, borderRadius: 14, padding: '14px 16px' }}>
      <Rotulo color="var(--mako-ink)" style={{ marginBottom: 5 }}>Próximo paso</Rotulo>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{llamada.next_step}</div>
    </div>
  );
}

export function Dimensiones({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  const dims = llamada.dims ?? [];
  if (!dims.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin dimensiones.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {GRUPOS_DIM.map((g) => {
        const del = dims.filter((d) => d.g === g.key);
        if (!del.length) return null;
        const prom = promedio(del.map((d) => d.score));
        return (
          <div key={g.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <Rotulo>{g.label}</Rotulo>
              <span style={{ fontFamily: MONO, fontSize: 11, color: colorPuntaje(prom) }}>prom {fmtPuntaje(prom)}</span>
            </div>
            {del.map((d, i) => <FilaDimension key={d.label + i} d={d} onPlay={onPlay} />)}
          </div>
        );
      })}
    </div>
  );
}

export function Fortalezas({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  if (!(llamada.strengths?.length ?? 0) && !(llamada.weaknesses?.length ?? 0)) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin fortalezas ni puntos a mejorar.</p>;
  return (
    <div className="fl-cols">
      <Evidencias titulo="Fortalezas" items={llamada.strengths ?? []} color="var(--good)" onPlay={onPlay} />
      <Evidencias titulo="A mejorar" items={llamada.weaknesses ?? []} color="var(--bad)" onPlay={onPlay} />
    </div>
  );
}

export function Objeciones({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  if (!(llamada.objections?.length ?? 0)) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin objeciones.</p>;
  return (
    <div>
      <Rotulo style={{ marginBottom: 6 }}>Objeciones</Rotulo>
      {llamada.objections!.map((o, i) => <FilaObjecion key={i} o={o} onPlay={onPlay} />)}
    </div>
  );
}

export function Coaching({ llamada }: { llamada: LlamadaFicha }) {
  if (!(llamada.recs?.length ?? 0)) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin coaching.</p>;
  return (
    <div style={{ background: suave('var(--mako)', 8), border: `1px solid ${suave('var(--mako)', 36)}`, borderRadius: 14, padding: '16px 18px' }}>
      <Rotulo color="var(--mako-ink)" style={{ marginBottom: 10 }}>Coaching · qué mejorar</Rotulo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {llamada.recs!.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: 'var(--mako)', marginTop: 8 }} />
            <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** La pestaña «Análisis» de la ficha: las secciones de arriba, en su orden. */
export function AnalisisTab({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  const dims = llamada.dims ?? [];
  const sinNada = !llamada.next_step && !dims.length && !(llamada.strengths?.length) && !(llamada.weaknesses?.length) && !(llamada.objections?.length) && !(llamada.recs?.length);
  if (sinNada) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Esta llamada no tiene análisis.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {llamada.next_step && <ProximoPaso llamada={llamada} />}
      {dims.length > 0 && <Dimensiones llamada={llamada} onPlay={onPlay} />}
      {((llamada.strengths?.length ?? 0) > 0 || (llamada.weaknesses?.length ?? 0) > 0) && <Fortalezas llamada={llamada} onPlay={onPlay} />}
      {(llamada.objections?.length ?? 0) > 0 && <Objeciones llamada={llamada} onPlay={onPlay} />}
      {(llamada.recs?.length ?? 0) > 0 && <Coaching llamada={llamada} />}
    </div>
  );
}

function FilaDimension({ d, onPlay }: { d: ClosingDim; onPlay: Play }) {
  const [abierta, setAbierta] = useState(false);
  const desplegable = !!(d.note || d.quote);
  const ancho = Math.max(0, Math.min(100, (d.score ?? 0) * 10));
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button type="button" className="fl-fila" disabled={!desplegable} aria-expanded={desplegable ? abierta : undefined} onClick={() => setAbierta((o) => !o)}>
        <span style={{ width: 170, flex: 'none', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{d.label}</span>
        <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${ancho}%`, background: colorPuntaje(d.score), borderRadius: 999 }} />
        </span>
        <span style={{ width: 30, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 600, color: colorPuntaje(d.score), fontFamily: MONO }}>{fmtPuntaje(d.score)}</span>
        <span aria-hidden style={{ width: 12, flex: 'none', fontSize: 10, color: 'var(--faint)', transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>{desplegable ? '›' : ''}</span>
      </button>
      {abierta && (
        <div style={{ padding: '0 0 14px 184px' }}>
          {d.note && <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--dim)' }}>{d.note}</div>}
          {d.quote && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
              <Segundo seg={d.t_seconds} onPlay={onPlay} />
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>“{d.quote}”</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Evidencias({ titulo, items, color, onPlay }: { titulo: string; items: ClosingEvidence[]; color: string; onPlay: Play }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [todas, setTodas] = useState(false);
  const vistas = todas ? items : items.slice(0, 2);
  return (
    <div>
      <Rotulo color={color} style={{ marginBottom: 8 }}>{titulo}</Rotulo>
      {items.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>—</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {vistas.map((s, i) => {
          const desplegable = !!(s.quote || s.note);
          const on = abierta === i;
          return (
            <div key={i}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <button type="button" className="fl-fila" disabled={!desplegable} aria-expanded={desplegable ? on : undefined} onClick={() => setAbierta(on ? null : i)}
                  style={{ padding: '5px 0', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ flex: 'none', width: 5, height: 5, borderRadius: '50%', background: color, marginTop: 7 }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45, flex: 1 }}>{s.title}</span>
                </button>
                <span style={{ paddingTop: 6 }}><Segundo seg={s.t_seconds} onPlay={onPlay} color={color} /></span>
              </div>
              {on && (
                <div style={{ paddingLeft: 14, marginTop: 3 }}>
                  {s.quote && <div style={{ fontSize: 12.5, color: 'var(--dim)', fontStyle: 'italic', lineHeight: 1.5 }}>“{s.quote}”</div>}
                  {s.note && <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.55 }}>{s.note}</div>}
                </div>
              )}
            </div>
          );
        })}
        {items.length > 2 && (
          <button type="button" className="fl-boton" onClick={() => setTodas((v) => !v)} style={{ color: 'var(--faint)', fontWeight: 500, marginTop: 4 }}>
            {todas ? '− menos' : `+ ${items.length - 2} más`}
          </button>
        )}
      </div>
    </div>
  );
}

function FilaObjecion({ o, onPlay }: { o: ClosingObjection; onPlay: Play }) {
  const [abierta, setAbierta] = useState(false);
  const color = o.handled ? 'var(--good)' : 'var(--bad)';
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="fl-fila" disabled={!o.note} aria-expanded={o.note ? abierta : undefined} onClick={() => setAbierta((v) => !v)} style={{ gap: 10, padding: '10px 0' }}>
          <span aria-label={o.handled ? 'Respondida' : 'Sin responder'} style={{ flex: 'none', fontSize: 13, fontWeight: 700, color, width: 16, textAlign: 'center' }}>{o.handled ? '✓' : '✕'}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: abierta ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{o.quote}”</span>
        </button>
        <Segundo seg={o.t_seconds} onPlay={onPlay} />
      </div>
      {abierta && o.note && <div style={{ padding: '0 0 12px 26px', fontSize: 13, color: 'var(--dim)', lineHeight: 1.55 }}>{o.note}</div>}
    </div>
  );
}

const COLOR_MOMENTO: Record<string, string> = { good: 'var(--good)', bad: 'var(--bad)', neutral: 'var(--warn)' };

export function Momentos({ momentos, onPlay }: { momentos: ClosingMoment[]; onPlay: Play }) {
  if (!momentos.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin momentos marcados.</p>;
  return (
    <div>
      {momentos.map((m, i) => {
        const color = COLOR_MOMENTO[m.tone] ?? 'var(--warn)';
        const seg = m.t_seconds;
        return (
          <button key={i} type="button" className="fl-fila" disabled={seg == null || !onPlay} onClick={() => { if (seg != null) onPlay?.(seg); }}
            style={{ alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 'none', width: 7, height: 7, borderRadius: '50%', background: color, marginTop: 6 }} />
            <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, fontWeight: 600, color, minWidth: 44 }}>{seg != null ? `▶ ${mmss(seg)}` : m.t}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'block', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink)' }}>{m.quote}</span>
              {m.tag && <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color, marginTop: 2 }}>{m.tag}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** El transcript de cada llamada, una vez por pestaña: volver a abrirlo no lo vuelve a pedir a Fathom. */
const TRANSCRIPTS = new Map<number, LineaTranscript[]>();

export function Transcript({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  const id = llamada.recording_id;
  // Lo ya traído se lee del caché al dibujar (no se copia al estado): el estado es sólo el pedido de ahora.
  const enCache = TRANSCRIPTS.get(id) ?? null;
  const [pedido, setPedido] = useState<{ id: number; lineas: LineaTranscript[] | null; error: string | null } | null>(null);

  useEffect(() => {
    if (TRANSCRIPTS.has(id)) return;
    const ctrl = new AbortController();
    let vencido = false;
    const t = window.setTimeout(() => { vencido = true; ctrl.abort(); }, TOPE_MS.transcript);
    fetch(`/api/closing/transcript?recording_id=${id}`, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; lines?: LineaTranscript[]; error?: string } | null;
        if (!r.ok || !j?.ok || !Array.isArray(j.lines)) { setPedido({ id, lineas: null, error: j?.error ?? 'Fathom no lo devolvió' }); return; }
        TRANSCRIPTS.set(id, j.lines);
        setPedido({ id, lineas: j.lines, error: null });
      })
      .catch(() => {
        if (ctrl.signal.aborted && !vencido) return;
        setPedido({ id, lineas: null, error: vencido ? 'Fathom tardó demasiado' : 'Sin conexión' });
      })
      .finally(() => window.clearTimeout(t));
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [id]);

  const estado = enCache ? { id, lineas: enCache, error: null } : pedido && pedido.id === id ? pedido : null;
  const lineas = estado?.lineas ?? null;
  const marcas = useMemo(() => marcasDeTranscript(lineas ?? [], llamada.annotations), [lineas, llamada.annotations]);

  if (!estado) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--faint)' }}><Spinner size={14} /> Trayendo el transcript de Fathom…</div>;
  if (estado.error) return <p style={{ margin: 0, fontSize: 13, color: 'var(--bad)' }}>No pude traer el transcript: {estado.error}.</p>;
  if (!lineas || !lineas.length) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Sin transcript.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {lineas.map((l, i) => {
        const mk = marcas.get(i);
        const c = mk ? (mk.tone === 'good' ? 'var(--good)' : 'var(--bad)') : null;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 8px', borderRadius: 6, background: mk ? (mk.tone === 'good' ? 'var(--good-bg)' : 'var(--bad-bg)') : 'transparent', borderLeft: `2px solid ${c ?? 'transparent'}` }}>
            {onPlay
              ? <button type="button" className="fl-seg" title="Abrir en Fathom desde este minuto" onClick={() => onPlay(l.t_seconds)} style={{ color: 'var(--faint)', fontWeight: 500, paddingTop: 2 }}>{mmss(l.t_seconds)}</button>
              : <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)', paddingTop: 2 }}>{mmss(l.t_seconds)}</span>}
            <div style={{ minWidth: 0 }}>
              {mk && <div style={{ fontSize: 10.5, fontWeight: 700, color: c!, marginBottom: 1 }}>{mk.label}</div>}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>{l.speaker || '—'}: </span>
              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{l.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Revisar a mano y re-evaluar con MaKo ─────────────────────────────────────────────────

type Tarea = 'analizar' | 'manual' | 'mako';
const TONOS: ReadonlyArray<Tone> = ['good', 'warn', 'bad'];

/**
 * El formulario de la tab: los puntajes de cada dimensión, el resultado, el desenlace y la nota. «Guardar»
 * pisa a mano (POST /api/closing/revise, mode manual); «Re-evaluar con MaKo» vuelve a correr el análisis
 * con la nota como pista (mode mako, obligatoria). Las dos dejan su entrada en el historial.
 * Si la ficha se cierra en el medio, el pedido sigue y `onListo` refresca la hoja igual.
 */
function RevisarForm({ llamada, ocupado, onOcupado, onListo, onVolver }: {
  llamada: LlamadaFicha; ocupado: Tarea | null; onOcupado: (t: Tarea | null) => void;
  onListo: (ok: string) => void; onVolver: () => void;
}) {
  const dims = llamada.dims ?? [];
  const [puntajes, setPuntajes] = useState<Record<string, number>>(() => Object.fromEntries(dims.map((d) => [d.label, d.score])));
  const [tono, setTono] = useState<Tone>(llamada.outcome_tone ?? 'warn');
  const [desenlace, setDesenlace] = useState(llamada.outcome ?? '');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const enVivo = puntajeEnVivo(dims, puntajes, llamada.score);

  const mandar = async (modo: 'manual' | 'mako') => {
    if (modo === 'mako' && !nota.trim()) { setError('Escribe qué viste distinto para que MaKo re-evalúe.'); return; }
    setError(null);
    onOcupado(modo);
    const cuerpo = modo === 'mako'
      ? { recording_id: llamada.recording_id, mode: 'mako', note: nota.trim() }
      : { recording_id: llamada.recording_id, mode: 'manual', dims: dims.map((d) => ({ label: d.label, score: puntajes[d.label] ?? d.score })), outcome: desenlace, outcome_tone: tono, note: nota.trim() || undefined };
    const r = await postearTarea('/api/closing/revise', cuerpo, TOPE_MS.revisar);
    onOcupado(null);
    if (!r.ok) { setError(r.error); return; }
    onListo(modo === 'mako' ? 'MaKo la re-evaluó' : 'Revisión guardada');
  };

  return (
    <div style={{ border: '1px solid var(--border-strong)', borderRadius: 16, padding: '18px 20px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Rotulo color="var(--mako-ink)">Revisar la valoración</Rotulo>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--faint)', fontFamily: MONO }}>PUNTAJE</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: colorPuntaje(enVivo), fontFamily: MONO }}>{fmtPuntaje(enVivo)}</span>
        </div>
      </div>
      {dims.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {dims.map((d) => {
            const v = puntajes[d.label] ?? d.score;
            return (
              <label key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 200, flex: 'none', fontSize: 13, color: 'var(--ink)' }}>{d.label}</span>
                <input type="range" min={0} max={10} step={0.5} value={v} disabled={ocupado != null}
                  onChange={(e) => setPuntajes((s) => ({ ...s, [d.label]: Number(e.target.value) }))} style={{ flex: 1, accentColor: 'var(--primary)' }} />
                <span style={{ width: 32, flex: 'none', textAlign: 'right', fontSize: 13, fontWeight: 600, fontFamily: MONO, color: colorPuntaje(v) }}>{fmtPuntaje(v)}</span>
              </label>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>Resultado</span>
        <div className="fl-pildoras" role="group" aria-label="Resultado de la llamada">
          {TONOS.map((t) => (
            <button key={t} type="button" className="fl-pildora" aria-pressed={tono === t} disabled={ocupado != null} onClick={() => setTono(t)}
              style={tono === t ? { color: colorDeTono(t) } : undefined}>{TONO_ROTULO[t]}</button>
          ))}
        </div>
        <input value={desenlace} onChange={(e) => setDesenlace(e.target.value)} disabled={ocupado != null} placeholder="Desenlace (ej. Cierre ganado)" aria-label="Desenlace"
          style={{ flex: 1, minWidth: 160, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit' }} />
      </div>
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} disabled={ocupado != null} rows={3} aria-label="Qué viste distinto"
        placeholder="¿Qué viste distinto a lo que dijo la IA? Queda en el historial; para re-evaluar con MaKo es obligatorio."
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit', resize: 'vertical' }} />
      {error && <div role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="sm" variant="primary" loading={ocupado === 'manual'} disabled={ocupado != null && ocupado !== 'manual'} onClick={() => void mandar('manual')}>Guardar cambios</Button>
        <Button size="sm" variant="mako" loading={ocupado === 'mako'} disabled={ocupado != null && ocupado !== 'mako'} onClick={() => void mandar('mako')}>✦ Re-evaluar con MaKo</Button>
        {ocupado === 'mako' && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Tarda hasta 2 min</span>}
        <Button size="sm" variant="tertiary" disabled={ocupado != null} onClick={onVolver}>Volver al análisis</Button>
      </div>
    </div>
  );
}

// ── La ficha entera: el cuerpo, el pie y su estado (una sola implementación para el Modal y la pieza) ──

type Vista = 'analisis' | 'momentos' | 'transcript';
type Aviso = { tono: 'bad' | 'warn'; texto: string } | null;

/**
 * El estado de la ficha entera: la lectura compartida, la vista, la revisión y las tareas. Lo usan el Modal de
 * siempre (./FichaLlamada.tsx) y la pieza `completo` del pop-up.
 */
export function useFichaLlamada(recordingId: number, opts: { onCambio?: () => void; soloLectura?: boolean; revisarAlAbrir?: boolean; aviso?: (t: string, tono: 'good' | 'bad') => void }) {
  const lectura = useLlamada(recordingId);
  const alCambio = useRef(opts.onCambio);
  const alAviso = useRef(opts.aviso);
  useEffect(() => { alCambio.current = opts.onCambio; alAviso.current = opts.aviso; });
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const [vista, setVista] = useState<Vista>('analisis');
  const [revisando, setRevisando] = useState(!!opts.revisarAlAbrir);
  const [confirmando, setConfirmando] = useState(false);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);

  /** Después de una tarea: se relee la llamada y la hoja refresca sus números (aunque la ficha ya se cerró). */
  const trasTarea = useCallback((ok: string | null, mal: string | null) => {
    alCambio.current?.();
    lectura.recargar();
    if (!vivo.current) return;
    if (ok) alAviso.current?.(ok, 'good');
    if (mal) setAviso({ tono: 'bad', texto: mal });
  }, [lectura]);

  const reanalizar = async () => {
    setConfirmando(false);
    setTarea('analizar');
    setAviso(null);
    const r = await postearTarea('/api/closing/analyze', { recording_id: recordingId }, TOPE_MS.analizar);
    if (vivo.current) setTarea(null);
    if (!r.ok) { if (vivo.current) setAviso({ tono: 'bad', texto: r.error }); return; }
    // La ruta contesta ok aunque el análisis haya fallado adentro: lo dice `status`.
    trasTarea(r.j.status === 'error' ? null : 'Análisis actualizado', r.j.status === 'error' ? 'MaKo no pudo analizarla: el motivo quedó arriba.' : null);
  };

  return {
    ...lectura, vista, setVista, revisando, setRevisando, confirmando, setConfirmando, tarea, setTarea, aviso, setAviso, trasTarea, reanalizar,
    tareas: !opts.soloLectura && !!lectura.llamada,
  };
}
export type EstadoFicha = ReturnType<typeof useFichaLlamada>;

/** La línea de arriba: tipo, desenlace, fecha, duración, y si falta el transcript. */
export function EncabezadoFicha({ llamada }: { llamada: LlamadaFicha }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)' }}>
      <span style={{ color: 'var(--dim)', textTransform: 'uppercase' }}>{llamada.tipo ?? '—'}</span>
      {llamada.outcome && <span style={{ color: colorDeTono(llamada.outcome_tone), fontWeight: 600 }}> · {llamada.outcome}</span>}
      <span> · {fechaDdMm(llamada.call_date)} · {enMinutos(llamada.duration_min)}</span>
      {llamada.has_transcript === false && <span style={{ color: 'var(--bad)' }}> · sin transcript</span>}
    </span>
  );
}

export const tituloDeFicha = (f: EstadoFicha): string =>
  (f.llamada ? nombreDeLlamada(f.llamada) ?? 'Llamada' : f.error && !f.cargando ? 'Llamada' : 'Cargando la llamada…');

/** Las tareas de la ficha (revisar, re-analizar con su confirmación pegada, «Lead →»). */
export function PieFichaLlamada({ f }: { f: EstadoFicha }) {
  const llamada = f.llamada;
  if (!llamada) return null;
  const ventaAnalizada = llamada.category === 'venta' && llamada.status === 'analizada';
  if (f.confirmando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>Pisa el análisis y lo corregido a mano. Tarda hasta 2 min.</span>
        <Button variant="secondary" size="sm" onClick={() => f.setConfirmando(false)}>No re-analizar</Button>
        <Button variant="primary" size="sm" onClick={() => void f.reanalizar()}>Re-analizar</Button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {f.tarea === 'analizar' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}><Spinner size={14} /> Re-analizando · hasta 2 min</span>}
      {llamada.lead_id != null && <ButtonLink href={`/crm/${llamada.lead_id}`} newTab size="sm" variant="tertiary">Lead →</ButtonLink>}
      {f.tareas && ventaAnalizada && !f.revisando && (
        <Button variant="secondary" size="sm" disabled={f.tarea != null} onClick={() => { f.setRevisando(true); f.setAviso(null); }}>Revisar a mano</Button>
      )}
      {f.tareas && !f.revisando && (
        <Button variant="secondary" size="sm" disabled={f.tarea != null} onClick={() => f.setConfirmando(true)}>↻ Re-analizar</Button>
      )}
    </div>
  );
}

/** El adentro de la ficha: avisos, cabecera, grabación y resumen, historial, y las pestañas (o la revisión). */
export function CuerpoFichaLlamada({ f }: { f: EstadoFicha }) {
  const llamada = f.llamada;
  const play = usePlay(llamada);
  if (!llamada) {
    return f.error && !f.cargando
      ? <p style={{ margin: 0, color: 'var(--bad)', fontSize: 14 }}>{f.error}</p>
      : <div style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}><Spinner size={20} /></div>;
  }
  const estado = estadoDeLlamada(llamada);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: f.cargando ? 0.7 : 1, transition: 'opacity .15s' }}>
      <EstilosFicha />
      {(f.aviso || (f.error && !f.cargando)) && (
        <div role="alert" style={{ border: `1px solid ${f.aviso?.tono === 'warn' ? 'var(--warn)' : 'var(--bad)'}`, background: f.aviso?.tono === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--ink)' }}>
          {f.aviso?.texto ?? f.error}
        </div>
      )}
      {estado && (
        <div style={{ border: `1px solid ${estado.tono === 'dim' ? 'var(--border)' : estado.tono === 'bad' ? 'var(--bad)' : 'var(--warn)'}`, background: estado.tono === 'dim' ? 'var(--surface-2)' : estado.tono === 'bad' ? 'var(--bad-bg)' : 'var(--warn-bg)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{estado.texto}</div>
          {estado.detalle && <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--dim)', marginTop: 3, wordBreak: 'break-word' }}>{estado.detalle}</div>}
        </div>
      )}
      <Cabecera llamada={llamada} />
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Reproductor llamada={llamada} />
        <Resumen llamada={llamada} />
      </div>
      {(llamada.edit_history?.length ?? 0) > 0 && <Historial ediciones={llamada.edit_history!} />}
      {f.revisando ? (
        <RevisarForm
          llamada={llamada}
          ocupado={f.tarea}
          onOcupado={f.setTarea}
          onListo={(ok) => { f.setRevisando(false); f.trasTarea(ok, null); }}
          onVolver={() => f.setRevisando(false)}
        />
      ) : (
        <div>
          <Tabs
            activa={f.vista}
            onCambio={(v) => f.setVista(v as Vista)}
            tabs={[
              { id: 'analisis', label: 'Análisis' },
              { id: 'momentos', label: 'Momentos', badge: llamada.moments?.length ?? 0 },
              { id: 'transcript', label: 'Transcript' },
            ]}
          />
          {f.vista === 'analisis' && <AnalisisTab llamada={llamada} onPlay={play} />}
          {f.vista === 'momentos' && <Momentos momentos={llamada.moments ?? []} onPlay={play} />}
          {f.vista === 'transcript' && <Transcript llamada={llamada} onPlay={play} />}
        </div>
      )}
    </div>
  );
}

// ── UNA pieza suelta, adentro de un pop-up ──────────────────────────────────────────────────

/**
 * Una pieza de la ficha de la llamada `recordingId` (PIEZAS_ENTIDAD.llamada). `completo` es la ficha entera con
 * su pie de tareas; las demás, su sección sola. Una pieza que no existe lo dice (un id guardado de una versión
 * que tenía otra pieza no se convierte en nada sin aviso).
 */
export function PiezaLlamada({ recordingId, pieza, soloLectura, onCambio, aviso }: {
  recordingId: number; pieza: string; soloLectura?: boolean; onCambio?: () => void; aviso?: (t: string, tono: 'good' | 'bad') => void;
}) {
  const f = useFichaLlamada(recordingId, { onCambio, soloLectura, aviso });
  const play = usePlay(f.llamada);
  if (pieza === 'completo') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {f.llamada && <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}><strong style={{ fontSize: 17, color: 'var(--ink)' }}>{tituloDeFicha(f)}</strong><EncabezadoFicha llamada={f.llamada} /></div>}
        <CuerpoFichaLlamada f={f} />
        {!soloLectura && <PieFichaLlamada f={f} />}
      </div>
    );
  }
  const l = f.llamada;
  if (!l) return f.error && !f.cargando ? <p style={{ margin: 0, color: 'var(--bad)', fontSize: 13 }}>{f.error}</p> : <div style={{ display: 'grid', placeItems: 'center', minHeight: 60 }}><Spinner size={16} /></div>;
  const cuerpo = ((): ReactNode => {
    switch (pieza) {
      case 'cabecera': return <Cabecera llamada={l} />;
      case 'reproductor': return <Reproductor llamada={l} ancho="100%" />;
      case 'resumen': return <Resumen llamada={l} />;
      case 'proximo_paso': return <ProximoPaso llamada={l} />;
      case 'dimensiones': return <Dimensiones llamada={l} onPlay={play} />;
      case 'fortalezas': return <Fortalezas llamada={l} onPlay={play} />;
      case 'objeciones': return <Objeciones llamada={l} onPlay={play} />;
      case 'coaching': return <Coaching llamada={l} />;
      case 'momentos': return <Momentos momentos={l.moments ?? []} onPlay={play} />;
      case 'transcript': return <Transcript llamada={l} onPlay={play} />;
      default: return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Esta pieza ya no existe.</p>;
    }
  })();
  return <><EstilosFicha />{cuerpo}</>;
}
