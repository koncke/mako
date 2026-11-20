'use client';
// =============================================================================
// EL CHAT SIEMPRE BAJA AL ÚLTIMO MENSAJE (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción: «siempre se haga scroll automático hacia el último mensaje para que el usuario sepa
// dónde están las cosas». Cada chat bajaba UNA vez, cuando se montaba el mensaje (`scrollTop = scrollHeight` con el largo de la
// lista), y un video se dibuja después: la portada y los metadatos llegan más tarde y el mensaje CRECE, con el chat ya quieto arriba.
// Lo mismo una imagen lenta o una tarjeta que se arma después.
//
// La regla, para todos los chats:
//   · un mensaje NUEVO baja siempre al último (`nuevo` cambia, o alguien avisa con `avisarMensajeNuevo`);
//   · lo que CRECE (un video, una imagen, una tarjeta) también baja, mientras la persona está abajo (ResizeObserver sobre el hilo
//     y sus hijos);
//   · si la persona SUBIÓ a leer, lo que crece no la arrastra; el próximo mensaje nuevo, sí.
// El núcleo (`seguirAlUltimo`) no usa React: lo prueba tests/bajar-al-ultimo.test.ts con un hilo de mentira.
// UN solo mecanismo para lo que crece (`bajarAlCrecer`): lo usa también el chat de los grupos (app/_chat/grupo/useSeguirElHilo.ts),
// que decide por su cuenta cuándo está abajo (lo nuevo de otros no la baja si está leyendo: cuenta cuántos llegaron, como WhatsApp).
// =============================================================================
import { useEffect, useLayoutEffect, useRef } from 'react';

/** A cuánto del final se considera «abajo»: la persona que mira el último mensaje con un poco de aire sigue pegada. */
export const CERCA_DE_ABAJO_PX = 90;
/** La hoja del teléfono se mide después del primer pintado: se engancha un momento después si todavía no está. */
const MS_HOJA_MEDIDA = 120;
/** Un mensaje nuevo que no sale de la lista del chat (la llegada del Ops Center, sus puntitos): lo avisa quien lo dibuja. */
export const EVENTO_MENSAJE_NUEVO = 'mk-mensaje-nuevo';

export function avisarMensajeNuevo(): void {
  try { window.dispatchEvent(new Event(EVENTO_MENSAJE_NUEVO)); } catch { /* sin window */ }
}

/** Lo que se usa del elemento que escrolea (un HTMLElement; en el test, uno de mentira). */
export type HiloQueEscrolea = {
  scrollTop: number; readonly scrollHeight: number; readonly clientHeight: number; readonly children: ArrayLike<unknown>;
  addEventListener(tipo: 'scroll', f: () => void, o?: AddEventListenerOptions): void;
  removeEventListener(tipo: 'scroll', f: () => void): void;
  scrollTo?: (o: ScrollToOptions) => void;
};
type Observador = { observe(e: never): void; disconnect(): void };
type ClaseObservador = new (alCambiar: () => void) => Observador;

export type SeguidorDelHilo = {
  /** Un mensaje nuevo: al último, aunque estuviera leyendo arriba. */
  bajar(suave?: boolean): void;
  /** Vuelve a mirar los hijos del hilo (cambian con los mensajes). */
  mirarHijos(): void;
  soltar(): void;
  /** ¿Está abajo? (lo que crece la baja sólo así) */
  pegado(): boolean;
};

/**
 * Lo que CRECE adentro del hilo (un video que cargó, una imagen lenta, una tarjeta que se armó después) lo mantiene abajo mientras
 * `debe()`: el ResizeObserver sobre el hilo y sus hijos. `mirarHijos` vuelve a mirar los hijos (cambian con los mensajes).
 */
export function bajarAlCrecer(el: HiloQueEscrolea, debe: () => boolean, Observador?: ClaseObservador | null, alBajar?: () => void): { mirarHijos(): void; soltar(): void } {
  const Clase = Observador !== undefined ? Observador : (typeof ResizeObserver !== 'undefined' ? (ResizeObserver as unknown as ClaseObservador) : null);
  const ro = Clase ? new Clase(() => { if (debe()) { el.scrollTop = el.scrollHeight; alBajar?.(); } }) : null;
  const mirarHijos = () => {
    if (!ro) return;
    ro.disconnect();
    ro.observe(el as never);
    for (const c of Array.from(el.children)) ro.observe(c as never);
  };
  mirarHijos();
  return { mirarHijos, soltar: () => ro?.disconnect() };
}

export function seguirAlUltimo(el: HiloQueEscrolea, o: { arriba?: () => boolean; Observador?: ClaseObservador | null } = {}): SeguidorDelHilo {
  let pegado = true;
  let ultimo = el.scrollTop;
  const arriba = o.arriba ?? (() => false);
  const alFondo = () => { el.scrollTop = el.scrollHeight; ultimo = el.scrollTop; };
  // La persona mueve el hilo: cerca del final queda pegada; si SUBIÓ (el scroll bajó de donde estaba), deja de estarlo. Lo que baja
  // el chat solo nunca la despega (sólo sube el scrollTop), y el navegador que recorta el scroll cuando el hilo se achica la deja
  // abajo (cerca del final).
  const alMover = () => {
    const lejos = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (lejos <= CERCA_DE_ABAJO_PX) pegado = true;
    else if (el.scrollTop < ultimo - 2) pegado = false;
    ultimo = el.scrollTop;
  };
  el.addEventListener('scroll', alMover, { passive: true });
  // Algo del hilo cambió de alto (un video que cargó, una imagen lenta, la caja que creció): si estaba abajo, sigue abajo.
  const crece = bajarAlCrecer(el, () => pegado && !arriba(), o.Observador, () => { ultimo = el.scrollTop; });
  return {
    bajar(suave = false) {
      if (arriba()) { el.scrollTop = 0; ultimo = 0; return; }
      pegado = true;
      if (suave && typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      else alFondo();
    },
    mirarHijos: crece.mirarHijos,
    soltar() { el.removeEventListener('scroll', alMover); crece.soltar(); },
    pegado: () => pegado,
  };
}

/**
 * El hilo de un chat que sigue al último mensaje. `contenedor`: lo que escrolea (estable: un useCallback). `nuevo`: cambia con cada
 * mensaje nuevo (el largo de la lista, los puntitos, una fase). `arriba`: el chat abre arriba (el chat nuevo del Ops Center, con su
 * portada) y mientras tanto no baja. `suave`: el mensaje nuevo baja con animación.
 */
export function useBajarAlUltimo(contenedor: () => HTMLElement | null, nuevo: unknown, o: { arriba?: boolean; suave?: boolean } = {}): void {
  const seguidor = useRef<SeguidorDelHilo | null>(null);
  const arriba = useRef(!!o.arriba);
  arriba.current = !!o.arriba;
  useEffect(() => {
    let s: SeguidorDelHilo | null = null;
    const enganchar = () => {
      if (s) return;
      const el = contenedor();
      if (!el) return;
      s = seguirAlUltimo(el, { arriba: () => arriba.current });
      seguidor.current = s;
    };
    enganchar();
    const t = s ? 0 : window.setTimeout(enganchar, MS_HOJA_MEDIDA);
    const alNuevo = () => seguidor.current?.bajar(true);
    window.addEventListener(EVENTO_MENSAJE_NUEVO, alNuevo);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENTO_MENSAJE_NUEVO, alNuevo);
      (s as SeguidorDelHilo | null)?.soltar();
      seguidor.current = null;
    };
  }, [contenedor]);
  const suave = !!o.suave;
  useLayoutEffect(() => {
    const s = seguidor.current;
    if (s) { s.mirarHijos(); s.bajar(suave); return; }
    // Antes de engancharse (el primer pintado): baja igual; el seguidor la mantiene abajo apenas se engancha.
    const el = contenedor();
    if (el) el.scrollTop = arriba.current ? 0 : el.scrollHeight;
  }, [nuevo, o.arriba, suave, contenedor]);
}
