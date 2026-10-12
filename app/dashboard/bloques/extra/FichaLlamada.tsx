'use client';

// =============================================================================
// FichaLlamada — el detalle de UNA llamada, con sus tareas, en una caja (interfaz C1 del Dashboard v4)
// =============================================================================
// Martín, 11/10/2026: «Closing Analyst va COMPLETO al Dashboard… y la tab se ELIMINA». Esto es el port del
// detalle de app/closing/ClosingBrowser.tsx (`Detail` y lo que colgaba de él), con el mismo comportamiento:
// la cabecera (puntaje, R1/R2, desenlace, fecha, duración, closer), el reproductor de Fathom (la miniatura y
// clic para reproducir; ▶ mm:ss abre la grabación en Fathom en ese segundo, porque el embed no salta), el
// resumen, el historial de revisiones, el Análisis (próximo paso, las 7 dimensiones con su cita, fortalezas,
// a mejorar, objeciones y coaching), los Momentos, el Transcript en vivo de Fathom con las marcas del
// análisis, «Lead →», y las TAREAS: revisar a mano, re-evaluar con MaKo y re-analizar.
//
// Quién la abre: una fila del bloque «Las llamadas» y los ejemplos de «Factores del cierre»
// (./BloquesClosing.tsx), la acción «Ver llamada» del detalle de un número (../../Detalle.tsx) y
// `?llamada=<recording_id>` (EditorInforme, de otro paquete). Pide sus datos a GET /api/closing/llamada.
//
// Lo que no se ve en la firma:
//   · SE MONTA EN EL <body>. Abierta desde una tarjeta de la grilla, un `position: fixed` queda relativo a la
//     tarjeta (react-grid-layout la ubica con `transform`) y recortado por su `overflow: hidden`. La envoltura
//     frena los eventos: un portal de React burbujea por el árbol de React, y un mousedown adentro empezaría a
//     arrastrar la tarjeta en modo edición (el mismo motivo que `Capa`, ../piezas.tsx).
//   · `onCerrar` va estable (`useCerrarEstable`): el efecto de foco del Modal depende de él (AGENTS.md).
//   · El ALTO de la caja es FIJO: pasar de «Momentos» a «Transcript» no la achica (AGENTS.md: «JAMÁS achiques
//     el tamaño de un detail según lo que contenga dentro»).
//   · Cada pedido lleva `signal` con el tope de su ruta (TOPE_MS, ./llamadas-modelo.ts). Una TAREA no se
//     aborta al cerrar la caja: re-analizar sigue en el server, y cuando contesta la hoja se refresca igual
//     (`onCambio`), aunque la ficha ya no esté.
//   · `soloLectura` apaga las TAREAS (revisar, re-analizar). Para un closer NO va: las tareas son de admin y
//     closer (decisión 6 de Martín), y las rutas lo vuelven a mirar (app/api/closing/puerta.ts).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type JSX, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, ButtonLink, Modal, Spinner, Tabs, Toast, useToast } from '@/app/_ui';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import type { ClosingDim, ClosingEdit, ClosingEvidence, ClosingMoment, ClosingObjection, Tone } from '@/lib/closing';
import { NO_ARRASTRAR } from '../piezas';
import { MONO, colorPuntaje, suave } from './piezas-extra';
import {
  GRUPOS_DIM, TONO_ROTULO, TOPE_MS, colorDeTono, enMinutos, estadoDeLlamada, fechaDdMm, fmtPuntaje, linkAlSegundo, marcasDeTranscript,
  mmss, nombreDeLlamada, partirResumen, postearTarea, promedio, puntajeEnVivo, reproductorFathom, esLinkHttp,
  type LineaTranscript, type LlamadaFicha,
} from './llamadas-modelo';

type Props = {
  recordingId: number;
  onCerrar: () => void;
  /** Una tarea cambió la llamada: quien la abrió vuelve a pedir sus números. */
  onCambio?: () => void;
  /** Sin tareas (revisar, re-analizar): sólo se lee. */
  soloLectura?: boolean;
};

type Vista = 'analisis' | 'momentos' | 'transcript';
type Tarea = 'analizar' | 'manual' | 'mako';
type Aviso = { tono: 'bad' | 'warn'; texto: string } | null;
type Play = ((seg: number) => void) | null;

const CSS_FICHA = `
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

const parar = (e: SyntheticEvent) => e.stopPropagation();

const sinSuscripcion = () => () => {};
/**
 * Monta la ficha en el <body> (ver la cabecera). Sólo en el navegador: en el server no hay `document`, y una
 * ficha que abre de entrada (`?llamada=`) no puede dibujar un portal en la hidratación. `useSyncExternalStore`
 * contesta false en el server y al hidratar, y true después, sin un setState en un efecto.
 */
function EnElBody({ children }: { children: ReactNode }) {
  const enNavegador = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  if (!enNavegador) return null;
  return createPortal(
    <div className={NO_ARRASTRAR} onClick={parar} onMouseDown={parar} onPointerDown={parar} onTouchStart={parar}>{children}</div>,
    document.body,
  );
}

function Rotulo({ children, color, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return <div className="fl-rotulo" style={{ ...(color ? { color } : {}), ...style }}>{children}</div>;
}

export function FichaLlamada({ recordingId, onCerrar, onCambio, soloLectura = false }: Props): JSX.Element {
  const cerrar = useCerrarEstable(onCerrar);
  const alCambio = useRef(onCambio);
  useLayoutEffect(() => { alCambio.current = onCambio; });
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);

  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState<{ clave: string; id: number; llamada: LlamadaFicha | null; error: string | null } | null>(null);
  const [vista, setVista] = useState<Vista>('analisis');
  const [revisando, setRevisando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [tarea, setTarea] = useState<Tarea | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const { toast, show, clear } = useToast();

  const clave = `${recordingId}|${version}`;
  useEffect(() => {
    const ctrl = new AbortController();
    let vencido = false;
    const t = window.setTimeout(() => { vencido = true; ctrl.abort(); }, TOPE_MS.llamada);
    // Si falla una RE-lectura (después de una tarea), se sigue viendo lo que había: el error va arriba.
    const fallo = (error: string) => setLectura((p) => ({ clave, id: recordingId, llamada: p && p.id === recordingId ? p.llamada : null, error }));
    fetch(`/api/closing/llamada?recording_id=${recordingId}`, { signal: ctrl.signal, cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { ok?: boolean; llamada?: LlamadaFicha; error?: string } | null;
        if (r.ok && j?.ok && j.llamada) setLectura({ clave, id: recordingId, llamada: j.llamada, error: null });
        else fallo(j?.error ?? 'No pude leer la llamada');
      })
      .catch(() => {
        // Reemplazado por otro pedido o desmontado: nada que mostrar. Vencido: que se vea.
        if (ctrl.signal.aborted && !vencido) return;
        fallo(vencido ? 'Tardó demasiado. Prueba de nuevo.' : 'No pude leer la llamada');
      })
      .finally(() => window.clearTimeout(t));
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [clave, recordingId]);

  const llamada = lectura && lectura.id === recordingId ? lectura.llamada : null;
  const cargando = lectura?.clave !== clave;

  /** Después de una tarea: se relee la llamada y la hoja refresca sus números (aunque la ficha ya se cerró). */
  const trasTarea = useCallback((ok: string | null, mal: string | null) => {
    alCambio.current?.();
    if (!vivo.current) return;
    setVersion((v) => v + 1);
    if (ok) show(ok, undefined, 'good');
    if (mal) setAviso({ tono: 'bad', texto: mal });
  }, [show]);

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

  const play: Play = useMemo(() => {
    if (!llamada || !esLinkHttp(llamada.share_url)) return null;
    const share = llamada.share_url;
    return (seg: number) => {
      const url = linkAlSegundo(share, seg);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    };
  }, [llamada]);

  const titulo = llamada ? nombreDeLlamada(llamada) ?? 'Llamada' : lectura?.error && !cargando ? 'Llamada' : 'Cargando la llamada…';
  const estado = llamada ? estadoDeLlamada(llamada) : null;
  const ventaAnalizada = !!llamada && llamada.category === 'venta' && llamada.status === 'analizada';
  const tareas = !soloLectura && !!llamada;

  const encabezado = llamada ? (
    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', color: 'var(--faint)' }}>
      <span style={{ color: 'var(--dim)', textTransform: 'uppercase' }}>{llamada.tipo ?? '—'}</span>
      {llamada.outcome && <span style={{ color: colorDeTono(llamada.outcome_tone), fontWeight: 600 }}> · {llamada.outcome}</span>}
      <span> · {fechaDdMm(llamada.call_date)} · {enMinutos(llamada.duration_min)}</span>
      {llamada.has_transcript === false && <span style={{ color: 'var(--bad)' }}> · sin transcript</span>}
    </span>
  ) : undefined;

  const pie = llamada ? (
    confirmando ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>Pisa el análisis y lo corregido a mano. Tarda hasta 2 min.</span>
        <Button variant="secondary" size="sm" onClick={() => setConfirmando(false)}>No re-analizar</Button>
        <Button variant="primary" size="sm" onClick={() => void reanalizar()}>Re-analizar</Button>
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {tarea === 'analizar' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}><Spinner size={14} /> Re-analizando · hasta 2 min</span>}
        {llamada.lead_id != null && <ButtonLink href={`/crm/${llamada.lead_id}`} newTab size="sm" variant="tertiary">Lead →</ButtonLink>}
        {tareas && ventaAnalizada && !revisando && (
          <Button variant="secondary" size="sm" disabled={tarea != null} onClick={() => { setRevisando(true); setAviso(null); }}>Revisar a mano</Button>
        )}
        {tareas && !revisando && (
          <Button variant="secondary" size="sm" disabled={tarea != null} onClick={() => setConfirmando(true)}>↻ Re-analizar</Button>
        )}
      </div>
    )
  ) : undefined;

  return (
    <EnElBody>
      <style href="dash-ficha-llamada" precedence="medium">{CSS_FICHA}</style>
      <Modal titulo={titulo} encabezado={encabezado} onCerrar={cerrar} ancho={900} alto="min(90vh, 880px)" pie={pie}>
        {!llamada ? (
          lectura?.error && !cargando
            ? <p style={{ margin: 0, color: 'var(--bad)', fontSize: 14 }}>{lectura.error}</p>
            : <div style={{ display: 'grid', placeItems: 'center', minHeight: 200 }}><Spinner size={20} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: cargando ? 0.7 : 1, transition: 'opacity .15s' }}>
            {(aviso || (lectura?.error && !cargando)) && (
              <div role="alert" style={{ border: `1px solid ${aviso?.tono === 'warn' ? 'var(--warn)' : 'var(--bad)'}`, background: aviso?.tono === 'warn' ? 'var(--warn-bg)' : 'var(--bad-bg)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--ink)' }}>
                {aviso?.texto ?? lectura?.error}
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
            {revisando ? (
              <RevisarForm
                llamada={llamada}
                ocupado={tarea}
                onOcupado={setTarea}
                onListo={(ok) => { setRevisando(false); trasTarea(ok, null); }}
                onVolver={() => setRevisando(false)}
              />
            ) : (
              <div>
                <Tabs
                  activa={vista}
                  onCambio={(v) => setVista(v as Vista)}
                  tabs={[
                    { id: 'analisis', label: 'Análisis' },
                    { id: 'momentos', label: 'Momentos', badge: llamada.moments?.length ?? 0 },
                    { id: 'transcript', label: 'Transcript' },
                  ]}
                />
                {vista === 'analisis' && <AnalisisTab llamada={llamada} onPlay={play} />}
                {vista === 'momentos' && <MomentosTab momentos={llamada.moments ?? []} onPlay={play} />}
                {vista === 'transcript' && <TranscriptTab llamada={llamada} onPlay={play} />}
              </div>
            )}
          </div>
        )}
      </Modal>
      <Toast state={toast} onClose={clear} />
    </EnElBody>
  );
}

// ── La cabecera, el reproductor y el resumen ─────────────────────────────────────────────

function Cabecera({ llamada }: { llamada: LlamadaFicha }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ flex: 'none', textAlign: 'center', minWidth: 56 }}>
        <div style={{ fontSize: 44, fontWeight: 600, lineHeight: 1, color: colorPuntaje(llamada.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtPuntaje(llamada.score)}</div>
        <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: MONO, marginTop: 2 }}>/ 10</div>
      </div>
      <div style={{ minWidth: 0, fontSize: 13.5, color: 'var(--dim)' }}>
        {llamada.lead_empresa || llamada.invitee_email || '—'}
        {llamada.closer && <> · Closer <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{llamada.closer}</strong></>}
      </div>
    </div>
  );
}

function Reproductor({ llamada }: { llamada: LlamadaFicha }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const fathom = reproductorFathom(llamada.share_url, llamada.embed_token);
  const caja: CSSProperties = { position: 'relative', width: 420, maxWidth: '100%', aspectRatio: '16 / 9', borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', flex: 'none' };
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
      <img src={fathom.miniatura} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
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

function Resumen({ llamada }: { llamada: LlamadaFicha }) {
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

function Historial({ ediciones }: { ediciones: ClosingEdit[] }) {
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

// ── Revisar a mano y re-evaluar con MaKo ─────────────────────────────────────────────────

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

// ── Análisis, momentos y transcript ──────────────────────────────────────────────────────

function Segundo({ seg, onPlay, color }: { seg: number | null | undefined; onPlay: Play; color?: string }) {
  if (seg == null || !Number.isFinite(seg)) return null;
  if (!onPlay) return <span style={{ flex: 'none', fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{mmss(seg)}</span>;
  return (
    <button type="button" className="fl-seg" title="Abrir en Fathom desde este minuto" style={{ color: color ?? 'var(--primary)' }}
      onClick={(e) => { e.stopPropagation(); onPlay(seg); }}>▶ {mmss(seg)}</button>
  );
}

function AnalisisTab({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
  const dims = llamada.dims ?? [];
  const sinNada = !llamada.next_step && !dims.length && !(llamada.strengths?.length) && !(llamada.weaknesses?.length) && !(llamada.objections?.length) && !(llamada.recs?.length);
  if (sinNada) return <p style={{ margin: 0, fontSize: 13, color: 'var(--faint)' }}>Esta llamada no tiene análisis.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {llamada.next_step && (
        <div style={{ background: suave('var(--mako)', 8), border: `1px solid ${suave('var(--mako)', 40)}`, borderRadius: 14, padding: '14px 16px' }}>
          <Rotulo color="var(--mako-ink)" style={{ marginBottom: 5 }}>Próximo paso</Rotulo>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{llamada.next_step}</div>
        </div>
      )}
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
      {((llamada.strengths?.length ?? 0) > 0 || (llamada.weaknesses?.length ?? 0) > 0) && (
        <div className="fl-cols">
          <Evidencias titulo="Fortalezas" items={llamada.strengths ?? []} color="var(--good)" onPlay={onPlay} />
          <Evidencias titulo="A mejorar" items={llamada.weaknesses ?? []} color="var(--bad)" onPlay={onPlay} />
        </div>
      )}
      {(llamada.objections?.length ?? 0) > 0 && (
        <div>
          <Rotulo style={{ marginBottom: 6 }}>Objeciones</Rotulo>
          {llamada.objections!.map((o, i) => <FilaObjecion key={i} o={o} onPlay={onPlay} />)}
        </div>
      )}
      {(llamada.recs?.length ?? 0) > 0 && (
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
      )}
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

function MomentosTab({ momentos, onPlay }: { momentos: ClosingMoment[]; onPlay: Play }) {
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

/** El transcript de cada llamada, una vez por pestaña: volver a la pestaña Transcript no lo vuelve a pedir a Fathom. */
const TRANSCRIPTS = new Map<number, LineaTranscript[]>();

function TranscriptTab({ llamada, onPlay }: { llamada: LlamadaFicha; onPlay: Play }) {
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
