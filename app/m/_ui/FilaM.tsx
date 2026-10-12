'use client';

// =============================================================================
// FilaM — la fila de toda lista de /m (la anatomía de .mk-fila, a medida de un dedo)
// =============================================================================
//   [avatar o ícono]  nombre (2 líneas) ........................  riel  [›]
//                     una línea, en gris
//                     (píldora de estado)
//
// v2 (docs/diseno-mako-mobile-v2.md, «Tarjetas, listas y estados»): va adentro de una LISTA
// AGRUPADA (<ListaM>: caja --surface, borde, radio 14). Mínimo 60 px de alto, el filete de
// 1 px lo pone la fila de ABAJO y arranca donde arranca el TEXTO (después del avatar o del
// ícono, como Ajustes de iPhone). Feedback en `:active` con el velo (en táctil no hay hover).
// El chevron va SÓLO si la fila abre algo: una flecha que no lleva a ningún lado es una
// promesa que no se cumple.
//
// Atajos: `avatar="Camila Rivas"` (iniciales, 40 px), `icono="graphics"` (baldosa de 32),
// `navegacion` (el nombre en 500: filas de More, de actividad). `control` pone a la derecha un
// interruptor (<InterruptorM>): la fila deja de ser un solo botón y lo que abre es el texto.
//
// SWIPE (opcional): UNA acción por lado, siempre la misma para ese tipo de lista,
// y SIEMPRE con un botón equivalente a la vista (en la fila o en su detalle): un
// gesto sin control visible no existe para quien no lo conoce. Derecha = completar
// (reversible, con Deshacer en el toast). Nunca se aprueba por swipe algo que
// bloquea, y nunca se borra por swipe (borrar es el tacho rojo).
//
// Mecánica (app/m/_ui/gestos.ts): 10 px de histéresis, el eje se bloquea con
// |dx| > 1,5·|dy| (el scroll vertical gana), seguimiento 1:1, confirma pasado el
// 35% del ancho o con un flick > 0,11 px/ms; un tic háptico al cruzar el umbral.
// `touch-action: pan-y` deja el vertical al navegador y los pointer events del
// horizontal llegan sin `pointercancel`.
// =============================================================================

import { useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { decidirSwipe, ejeDelGesto, rubberband, UMBRAL_SWIPE, velocidadDe, type Muestra } from './gestos';
import { AvatarM, IconoM } from './Piezas';

export type AccionSwipe = {
  /** 1-2 palabras: «Hecha», «Más tarde». */
  rotulo: string;
  /** Nombre de `app/_components/icons.tsx`. */
  icono: string;
  /** completar = verde · mako = lo que sugirió MaKo · neutro = más tarde / descartar. */
  tono?: 'completar' | 'mako' | 'neutro';
  onAccion: () => void;
};

export type FilaMProps = {
  titulo: ReactNode;
  /** UNA línea en gris (se corta con «…»). Si dice lo mismo en todas las filas, sobra. */
  segunda?: ReactNode;
  /** Debajo de la segunda línea: una <PildoraM> (estado). */
  pill?: ReactNode;
  /** A la izquierda, lo que sea (la estrella de MaKo, un check de 44, una hora grande). */
  leading?: ReactNode;
  /** Atajo de `leading`: el avatar de iniciales de este nombre (40 px). */
  avatar?: string;
  /** Atajo de `leading`: un ícono de `app/_components/icons.tsx` en su baldosa de 32. */
  icono?: string;
  /** El nombre en 500 en vez de 600: filas de navegación (More, actividad). */
  navegacion?: boolean;
  /** A la derecha: una hora, un conteo o un %, corto. */
  riel?: ReactNode;
  /** A la derecha de todo: un <InterruptorM>. Con control, lo que abre (href/onClick) es el texto. */
  control?: ReactNode;
  /** Abre otra pantalla. */
  href?: string;
  /** Abre algo en el lugar (un sheet). */
  onClick?: () => void;
  /** Por defecto: true si abre algo. */
  chevron?: boolean;
  /** En curso: la barra-borde de 2 px. Un número 0..1 es el avance; `true`, sin avance conocido. */
  enCurso?: number | boolean;
  deshabilitada?: boolean;
  swipeDerecha?: AccionSwipe;
  swipeIzquierda?: AccionSwipe;
  /** El nombre accesible de la fila si el título solo no alcanza. */
  etiqueta?: string;
};

type Arrastre = { id: number; x0: number; y0: number; eje: 'x' | 'y' | null; x: number; muestras: Muestra[]; listo: boolean };

function FondoSwipe({ lado, accion, refFondo }: { lado: 'derecha' | 'izquierda'; accion: AccionSwipe; refFondo: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={refFondo} className={`m-swipe-fondo m-swipe-fondo--${lado}`} data-tono={accion.tono ?? 'neutro'} hidden aria-hidden>
      {lado === 'izquierda' && <span>{accion.rotulo}</span>}
      <span className="m-swipe-fondo__ico"><Icon name={accion.icono} size={22} /></span>
      {lado === 'derecha' && <span>{accion.rotulo}</span>}
    </div>
  );
}

export function FilaM(p: FilaMProps) {
  const abre = !!(p.href || p.onClick) && !p.deshabilitada;
  // Con un interruptor al lado, sin chevron (como Ajustes): el control ya ocupa la derecha.
  const chevron = p.chevron ?? (abre && p.control == null);
  const conSwipe = !p.deshabilitada && !!(p.swipeDerecha || p.swipeIzquierda);

  const filaRef = useRef<HTMLElement | null>(null);
  const fondoDer = useRef<HTMLDivElement>(null);
  const fondoIzq = useRef<HTMLDivElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const tragarClick = useRef(false);

  const mostrarFondo = (x: number, listo: boolean) => {
    const der = fondoDer.current;
    const izq = fondoIzq.current;
    if (der) { der.hidden = !(x > 0); if (x > 0) der.toggleAttribute('data-listo', listo); }
    if (izq) { izq.hidden = !(x < 0); if (x < 0) izq.toggleAttribute('data-listo', listo); }
  };
  const mover = (x: number, transicion?: string) => {
    const el = filaRef.current;
    if (!el) return;
    el.style.transition = transicion ?? 'none';
    el.style.transform = x ? `translateX(${x}px)` : '';
  };

  const alBajar = (e: PointerEvent<HTMLElement>) => {
    tragarClick.current = false;
    if (!conSwipe || arrastre.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrastre.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, eje: null, x: 0, muestras: [{ v: e.clientX, t: e.timeStamp }], listo: false };
  };
  const alMover = (e: PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    const el = filaRef.current;
    // Un segundo dedo no toma el control a mitad del gesto.
    if (!a || !el || e.pointerId !== a.id) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (!a.eje) {
      a.eje = ejeDelGesto(dx, dy);
      if (!a.eje) return;
      if (a.eje === 'y') { arrastre.current = null; return; }
      try { el.setPointerCapture(e.pointerId); } catch { /* el puntero ya no existe */ }
    }
    const ancho = el.offsetWidth || 1;
    // Hacia un lado sin acción, la fila se resiste: no hay nada que confirmar ahí.
    let x = dx;
    if (x > 0 && !p.swipeDerecha) x = rubberband(x, ancho) * 0.25;
    if (x < 0 && !p.swipeIzquierda) x = rubberband(x, ancho) * 0.25;
    a.x = x;
    a.muestras.push({ v: e.clientX, t: e.timeStamp });
    if (a.muestras.length > 8) a.muestras.shift();
    const hayAccion = (x > 0 && !!p.swipeDerecha) || (x < 0 && !!p.swipeIzquierda);
    const listo = hayAccion && Math.abs(x) >= UMBRAL_SWIPE * ancho;
    if (listo && !a.listo) haptico('light');
    a.listo = listo;
    mostrarFondo(x, listo);
    mover(x);
  };
  const alSoltar = (e: PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    const el = filaRef.current;
    if (!a || e.pointerId !== a.id) return;
    arrastre.current = null;
    if (!el || a.eje !== 'x') return;
    tragarClick.current = true; // el click que sigue a un arrastre no abre la fila
    const ancho = el.offsetWidth || 1;
    const lado = decidirSwipe(a.x, ancho, velocidadDe(a.muestras));
    const accion = lado === 'derecha' ? p.swipeDerecha : lado === 'izquierda' ? p.swipeIzquierda : undefined;
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (accion && lado) {
      mover(lado === 'derecha' ? ancho : -ancho, sinMovimiento ? 'none' : 'transform 200ms var(--ease-out)');
      window.setTimeout(() => {
        accion.onAccion();
        // Si la lista no sacó la fila (o la devolvió con «Deshacer»), vuelve a su lugar.
        mover(0);
        mostrarFondo(0, false);
      }, sinMovimiento ? 0 : 200);
    } else {
      mover(0, sinMovimiento ? 'none' : 'transform 250ms var(--ease-out)');
      window.setTimeout(() => mostrarFondo(0, false), sinMovimiento ? 0 : 250);
    }
  };
  const alClickCaptura = (e: MouseEvent<HTMLElement>) => {
    if (!tragarClick.current) return;
    tragarClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const barra = p.enCurso === undefined || p.enCurso === false ? null : (
    <span className={`m-fila__barra${typeof p.enCurso === 'number' && p.enCurso >= 1 ? '' : ' m-fila__barra--viva'}`} aria-hidden>
      <i style={{ width: typeof p.enCurso === 'number' ? `${Math.round(Math.max(0, Math.min(1, p.enCurso)) * 100)}%` : '40%' }} />
    </span>
  );

  const lead = p.leading ?? (p.avatar != null ? <AvatarM nombre={p.avatar} /> : p.icono ? <IconoM nombre={p.icono} /> : null);
  const cuerpo = (
    <>
      {lead != null && <span className="m-fila__lead">{lead}</span>}
      <span className="m-fila__txt">
        <span className={p.navegacion ? 'm-fila__t m-fila__t--nav' : 'm-fila__t'}>{p.titulo}</span>
        {p.segunda != null && <span className="m-fila__c">{p.segunda}</span>}
        {p.pill != null && <span className="m-fila__pill">{p.pill}</span>}
      </span>
      {p.riel != null && <span className="m-fila__riel">{p.riel}</span>}
      {chevron && <span className="m-fila__ir" aria-hidden><Icon name="chevron" size={18} /></span>}
    </>
  );

  // Con un interruptor, la fila NO es un botón (un botón adentro de otro no existe): es un
  // div con el texto como zona que abre y el control a la derecha.
  if (p.control != null) {
    const zona = p.href && !p.deshabilitada
      ? <Link href={p.href} className="m-fila__abre m-fila--toca" aria-label={p.etiqueta}>{cuerpo}</Link>
      : p.onClick
        ? <button type="button" className="m-fila__abre m-fila--toca" onClick={p.onClick} disabled={p.deshabilitada} aria-label={p.etiqueta}>{cuerpo}</button>
        : <span className="m-fila__abre">{cuerpo}</span>;
    return (
      <div className="m-fila-envoltorio">
        <div className="m-fila m-fila--control" aria-disabled={p.deshabilitada || undefined}>
          {zona}
          <span className="m-fila__control">{p.control}</span>
          {barra}
        </div>
      </div>
    );
  }

  const contenido = <>{cuerpo}{barra}</>;
  const clase = `m-fila${abre ? ' m-fila--toca' : ''}${conSwipe ? ' m-fila--swipe' : ''}`;
  const gestos = conSwipe ? {
    onPointerDown: alBajar,
    onPointerMove: alMover,
    onPointerUp: alSoltar,
    onPointerCancel: alSoltar,
    onClickCapture: alClickCaptura,
  } : {};
  const asignar = (el: HTMLElement | null) => { filaRef.current = el; };

  let fila: ReactNode;
  if (p.href && !p.deshabilitada) {
    fila = <Link href={p.href} className={clase} ref={asignar} aria-label={p.etiqueta} {...gestos}>{contenido}</Link>;
  } else if (p.onClick) {
    fila = (
      <button type="button" className={clase} ref={asignar} onClick={p.onClick} disabled={p.deshabilitada} aria-label={p.etiqueta} {...gestos}>
        {contenido}
      </button>
    );
  } else {
    fila = <div className={clase} ref={asignar} aria-disabled={p.deshabilitada || undefined} aria-label={p.etiqueta} {...gestos}>{contenido}</div>;
  }

  return (
    <div className="m-fila-envoltorio">
      {conSwipe && p.swipeDerecha && <FondoSwipe lado="derecha" accion={p.swipeDerecha} refFondo={fondoDer} />}
      {conSwipe && p.swipeIzquierda && <FondoSwipe lado="izquierda" accion={p.swipeIzquierda} refFondo={fondoIzq} />}
      {fila}
    </div>
  );
}
