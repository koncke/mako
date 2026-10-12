'use client';

// =============================================================================
// RecorridoDiagnostico — los comentarios del diagnóstico como un tutorial de MaKo
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 7), textual: «que al analizar una landing sea como un
// "tutorial" de los que tenemos en MaKo, que se ponga opaco y señale el lugar donde se esta haciendo el
// comentario». Decisión T5 de docs/diseno-editor-landing.md.
//
// LA FORMA ES LA DEL RECORRIDO DE LA CASA (app/_ui/Recorrido.tsx, el de CURSO y Automations): la pantalla
// se oscurece, un recorte con el aro de `--primary` deja ver el bloque y al lado va la tarjeta, con su
// flecha, «n de N» y los botones. Reusa lo que decide (lib/recorridos.ts: `recorteDe`, `posicionTarjeta`,
// `Z_PISO_RECORRIDO`), la pila de modales como capa ANIDADA y el portal al body, y sus tokens.
//
// POR QUÉ NO ES `<Recorrido>` MISMO: aquél encuentra su objetivo con `[data-recorrido]` en el documento y
// decide si hay que scrollear mirando la VENTANA. Acá el objetivo puede vivir adentro de un iframe de
// otro origen (una landing de afuera), que scrollea por dentro y sólo se mueve por `postMessage`: el
// recorrido tiene que PEDIRLE a la vista que traiga el bloque (`ir`) y preguntarle dónde quedó (`caja`).
// Con `<Recorrido>`, un comentario de más abajo quedaba «a la vista» de la ventana pero tapado por el
// borde del iframe, y el recorte se dibujaba sobre la lista de al lado. Por eso los dos verbos son props.
//
// Lo que no se ve en la firma:
//   · un comentario cuya cita no se encontró se señala sobre la VISTA ENTERA (la `caja` que devuelve la
//     vista): el recorrido no saltea comentarios — la persona tiene que poder leerlos todos;
//   · el Escape lo contesta sólo él (`esElDeArriba` + `stopImmediatePropagation`: los Escape de la casa
//     viven todos en `document` y en captura, y el panel de atrás también escucha);
//   · las flechas del teclado pasan de comentario.
// =============================================================================

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { Button } from '@/app/_ui/Button';
import { Z_PISO_RECORRIDO, posicionTarjeta, recorteDe, type Caja, type PosicionTarjeta } from '@/lib/recorridos';
import { EVENTO_MOVIO } from './vista';

export type PasoDiagnostico = { id: number; titulo: string; texto: string; severidad: string };
export type MotivoCierreDiagnostico = 'fin' | 'omitido';

const FOCABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MS_TRANSICION = 220;
const ETIQUETA_SEVERIDAD: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

type Geometria = { hueco: Caja; tarjeta: PosicionTarjeta };
const casi = (a: number, b: number) => Math.abs(a - b) < 0.5;
const misma = (a: Geometria, b: Geometria) =>
  casi(a.hueco.x, b.hueco.x) && casi(a.hueco.y, b.hueco.y) && casi(a.hueco.ancho, b.hueco.ancho) && casi(a.hueco.alto, b.hueco.alto)
  && a.tarjeta.x === b.tarjeta.x && a.tarjeta.y === b.tarjeta.y && a.tarjeta.lado === b.tarjeta.lado && a.tarjeta.flecha === b.tarjeta.flecha;

function ventana() {
  const d = document.documentElement;
  return { ancho: d.clientWidth || window.innerWidth, alto: d.clientHeight || window.innerHeight };
}

export function RecorridoDiagnostico({ pasos, abierto, desde = 0, ir, caja, senal, onPaso, onCerrar }: {
  pasos: PasoDiagnostico[];
  abierto: boolean;
  /** El índice del paso por el que arranca al abrirse («Ver» de un comentario de la lista). */
  desde?: number;
  /** Trae a la vista el bloque del comentario (scrollea la vista o el iframe). */
  ir: (id: number) => Promise<unknown>;
  /** Dónde está el bloque, en píxeles de la VENTANA (o la vista entera si no se encontró). */
  caja: (id: number) => Caja | null;
  /** Donde la vista avisa que se movió por dentro (`EVENTO_MOVIO`: el scroll de un iframe no llega al documento). */
  senal: EventTarget;
  onPaso?: (id: number) => void;
  onCerrar: (motivo: MotivoCierreDiagnostico) => void;
}) {
  const [indice, setIndice] = useState(0);
  const [geo, setGeo] = useState<Geometria | null>(null);
  const [animando, setAnimando] = useState(false);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();

  // Las funciones de la vista y del panel viajan por refs: llegan nuevas en cada render y con ellas en
  // las dependencias cada render volvería a traer el bloque a la vista.
  const irRef = useRef(ir);
  const cajaRef = useRef(caja);
  const onPasoRef = useRef(onPaso);
  const onCerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { irRef.current = ir; cajaRef.current = caja; onPasoRef.current = onPaso; onCerrarRef.current = onCerrar; });

  // Al abrirse, arranca por `desde`. Se ajusta DURANTE el render al ver el cambio (el patrón de React
  // para «ajustar estado cuando cambia una prop»), como el recorrido de la casa.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto);
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto);
    setGeo(null);
    setAnimando(false);
    if (abierto) setIndice(Math.max(0, Math.min(desde, pasos.length - 1)));
  }

  const mostrando = abierto && pasos.length > 0;
  const capa = useCapaModal(mostrando, { anidada: true });
  const esElDeArriba = capa.esElDeArriba;
  const z = Math.max(capa.z, Z_PISO_RECORRIDO);
  const i = Math.max(0, Math.min(indice, pasos.length - 1));
  const paso = mostrando ? pasos[i] : null;
  const pasoId = paso?.id ?? null;

  const medir = useCallback(() => {
    if (pasoId == null) return;
    const c = cajaRef.current(pasoId);
    if (!c) { setGeo(null); return; }
    const v = ventana();
    const hueco = recorteDe(c, v);
    const t = tarjetaRef.current?.getBoundingClientRect();
    const tarjeta = posicionTarjeta({ objetivo: hueco, tarjeta: { ancho: t?.width || 340, alto: t?.height || 170 }, ventana: v });
    const nueva = { hueco, tarjeta };
    setGeo((prev) => (prev && misma(prev, nueva) ? prev : nueva));
  }, [pasoId]);

  // Cada paso: avisarle al panel (resalta la fila), traer el bloque a la vista y medir.
  useEffect(() => {
    if (pasoId == null) return;
    let vivo = true;
    onPasoRef.current?.(pasoId);
    void Promise.resolve(irRef.current(pasoId)).catch(() => null).then(() => { if (vivo) medir(); });
    return () => { vivo = false; };
  }, [pasoId, medir]);

  // Y en cada cosa que lo puede mover: la ventana, el scroll de cualquier contenedor (en captura: no
  // burbujea), el tamaño de la tarjeta y lo que avisa la vista (`senal`). Todo por un cuadro.
  const visible = capa.visible;
  useLayoutEffect(() => {
    if (pasoId == null || !visible) return;
    // Medir antes de pintar es el caso que la documentación de React pone para `useLayoutEffect`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    medir();
    let cuadro = 0;
    const pedir = () => { if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; medir(); }); };
    window.addEventListener('resize', pedir);
    document.addEventListener('scroll', pedir, { capture: true, passive: true });
    senal.addEventListener(EVENTO_MOVIO, pedir);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pedir) : null;
    if (ro && tarjetaRef.current) ro.observe(tarjetaRef.current);
    return () => {
      window.removeEventListener('resize', pedir);
      document.removeEventListener('scroll', pedir, { capture: true });
      senal.removeEventListener(EVENTO_MOVIO, pedir);
      ro?.disconnect();
      if (cuadro) cancelAnimationFrame(cuadro);
    };
  }, [pasoId, medir, visible, senal]);

  useEffect(() => {
    if (!animando) return;
    const t = setTimeout(() => setAnimando(false), MS_TRANSICION * 2);
    return () => clearTimeout(t);
  }, [animando, indice]);

  const total = pasos.length;
  const siguiente = useCallback(() => {
    if (i >= total - 1) { onCerrarRef.current('fin'); return; }
    setAnimando(true);
    setIndice(i + 1);
  }, [i, total]);
  const anterior = useCallback(() => {
    if (i <= 0) return;
    setAnimando(true);
    setIndice(i - 1);
  }, [i]);

  // El teclado: Escape cierra, las flechas pasan de comentario y el Tab se queda en la tarjeta.
  useEffect(() => {
    if (!mostrando) return;
    const previo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (!esElDeArriba()) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onCerrarRef.current('omitido'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); siguiente(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); anterior(); return; }
      if (e.key !== 'Tab') return;
      const cajaT = tarjetaRef.current;
      const focables = cajaT?.querySelectorAll<HTMLElement>(FOCABLES);
      if (!cajaT || !focables?.length) { e.preventDefault(); return; }
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      const activo = document.activeElement;
      if (!cajaT.contains(activo)) { e.preventDefault(); primero.focus(); return; }
      if (e.shiftKey && (activo === primero || activo === cajaT)) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      try { previo?.focus?.({ preventScroll: true }); } catch { /* el nodo ya no existe */ }
    };
  }, [mostrando, esElDeArriba, siguiente, anterior]);

  // El foco a la tarjeta en cada paso, recién cuando se ve (una tarjeta en `visibility: hidden` no
  // recibe el foco: ver la misma nota en app/_ui/Recorrido.tsx).
  const medida = geo !== null;
  useEffect(() => {
    if (pasoId == null || !medida) return;
    tarjetaRef.current?.focus({ preventScroll: true });
  }, [pasoId, medida]);

  // ── Sin hooks de acá para abajo (AGENTS.md: ningún hook detrás de un `return`). ──
  if (!mostrando || !paso) return null;
  const t = geo?.tarjeta;
  const estiloFlecha: CSSProperties | null = t && t.flecha != null
    ? (t.lado === 'abajo' || t.lado === 'arriba' ? { left: t.flecha - 6 } : { top: t.flecha - 6 })
    : null;
  const esUltimo = i >= total - 1;

  return createPortal(
    <div className="gdg-rec" style={{ zIndex: z, display: capa.visible ? 'block' : 'none' }}>
      <style>{CSS_RECORRIDO}</style>
      {geo
        ? <div
            className={animando ? 'gdg-rec__hueco gdg-rec__hueco--anima' : 'gdg-rec__hueco'}
            style={{ left: geo.hueco.x, top: geo.hueco.y, width: geo.hueco.ancho, height: geo.hueco.alto }}
            aria-hidden
          />
        : <div className="gdg-rec__velo" aria-hidden />}
      <div
        ref={tarjetaRef}
        className="gdg-rec__tarjeta"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={textoId}
        tabIndex={-1}
        style={{ left: t?.x ?? 0, top: t?.y ?? 0, visibility: t ? 'visible' : 'hidden' }}
      >
        {estiloFlecha && t && <span className="gdg-rec__flecha" data-lado={t.lado} style={estiloFlecha} aria-hidden />}
        <div key={paso.id} className="gdg-rec__cuerpo">
          <div className="gdg-rec__cont">
            {total > 1 && <span>{i + 1} de {total}</span>}
            <span className="gdg-rec__sev" data-sev={paso.severidad}>{ETIQUETA_SEVERIDAD[paso.severidad] ?? paso.severidad}</span>
          </div>
          <h2 id={tituloId} className="gdg-rec__tit">{paso.titulo}</h2>
          <p id={textoId} className="gdg-rec__txt">{paso.texto}</p>
        </div>
        <div className="gdg-rec__pie">
          {!esUltimo && <Button variant="tertiary" size="sm" onClick={() => onCerrarRef.current('omitido')}>Saltar</Button>}
          <span className="gdg-rec__aire" />
          {i > 0 && <Button variant="secondary" size="sm" onClick={anterior}>Anterior</Button>}
          <Button variant="primary" size="sm" onClick={siguiente}>{esUltimo ? 'Listo' : 'Siguiente'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** La hoja del recorrido: los mismos tokens y medidas que el de la casa (app/_ui/Recorrido.tsx). */
const CSS_RECORRIDO = `
.gdg-rec { position: fixed; inset: 0; --rec-velo: color-mix(in srgb, var(--sidebar) 66%, transparent); }
.gdg-rec__velo { position: absolute; inset: 0; background: var(--rec-velo); }
.gdg-rec__hueco { position: fixed; border-radius: var(--r-md); box-shadow: 0 0 0 2px var(--primary), 0 0 0 200vmax var(--rec-velo); pointer-events: none; }
.gdg-rec__hueco::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; animation: gdgRecLatido 1.8s ease-out infinite; }
.gdg-rec__hueco--anima { transition: left ${MS_TRANSICION}ms ease, top ${MS_TRANSICION}ms ease, width ${MS_TRANSICION}ms ease, height ${MS_TRANSICION}ms ease; }
@keyframes gdgRecLatido { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--primary) 45%, transparent); } 100% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--primary) 0%, transparent); } }
.gdg-rec__tarjeta { position: fixed; width: min(340px, calc(100vw - 24px)); box-sizing: border-box; padding: 16px 18px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: 0 18px 44px color-mix(in srgb, var(--sidebar) 32%, transparent); font-family: inherit; color: var(--ink); }
.gdg-rec__tarjeta:focus { outline: none; }
.gdg-rec__tarjeta:focus-visible { box-shadow: var(--focus-ring), 0 18px 44px color-mix(in srgb, var(--sidebar) 32%, transparent); }
.gdg-rec__cuerpo { animation: gdgRecEntra .16s ease both; }
@keyframes gdgRecEntra { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.gdg-rec__cont { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: var(--fs-meta); color: var(--faint); font-variant-numeric: tabular-nums; }
.gdg-rec__sev { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; border-radius: 9999px; font-size: 11px; font-weight: 650; background: var(--primary-bg); color: var(--primary-strong); }
.gdg-rec__sev[data-sev="alta"] { background: var(--bad-bg); color: var(--bad); }
.gdg-rec__sev[data-sev="media"] { background: var(--warn-bg); color: var(--warn); }
.gdg-rec__tit { margin: 0; font-size: var(--fs-card); font-weight: 650; line-height: 1.3; color: var(--ink); }
.gdg-rec__txt { margin: 6px 0 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--dim); }
.gdg-rec__pie { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.gdg-rec__aire { flex: 1 1 auto; }
.gdg-rec__flecha { position: absolute; width: 12px; height: 12px; background: var(--surface); border: 0 solid var(--border); transform: rotate(45deg); }
.gdg-rec__flecha[data-lado="abajo"] { top: -7px; border-top-width: 1px; border-left-width: 1px; }
.gdg-rec__flecha[data-lado="arriba"] { bottom: -7px; border-right-width: 1px; border-bottom-width: 1px; }
.gdg-rec__flecha[data-lado="derecha"] { left: -7px; border-left-width: 1px; border-bottom-width: 1px; }
.gdg-rec__flecha[data-lado="izquierda"] { right: -7px; border-top-width: 1px; border-right-width: 1px; }
@media (prefers-reduced-motion: reduce) {
  .gdg-rec__hueco--anima { transition: none; }
  .gdg-rec__hueco::after, .gdg-rec__cuerpo { animation: none; }
}
`;
