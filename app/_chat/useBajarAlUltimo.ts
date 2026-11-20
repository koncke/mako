'use client';
// =============================================================================
// EL CHAT SIEMPRE BAJA AL ÚLTIMO MENSAJE (20/11/2026)
// =============================================================================
// Martín, probando el onboarding en producción: «siempre se haga scroll automático hacia el último mensaje para que el usuario sepa
// dónde están las cosas». La auditoría de los chats (el Cerebro, 20/11) encontró la causa, y NO era el video (VideoDelMomento tiene
// caja fija): era lo que dispara el scroll. Cada chat bajaba con una CUENTA (el largo de la lista, más los puntitos y lo pendiente),
// y al contestar el servidor suma dos mensajes mientras se van los puntitos y lo pendiente en el mismo render: la cuenta no cambia y
// el hilo no baja. Y en el Ops Center, filas que viven fuera de la lista (la llegada) no las cuenta nadie.
//
// La regla, para los chats con MaKo:
//   · un mensaje NUEVO baja siempre al último: `nuevo` es la CLAVE de la última fila dibujada (su id, los puntitos, su pieza), nunca
//     una cuenta; una fila que no sale de la lista del chat avisa con `avisarMensajeNuevo`;
//   · lo que CRECE o se achica (una tarjeta que se arma, el recuadro o el error arriba de la caja) baja mientras la persona está abajo
//     (ResizeObserver sobre el hilo y sus hijos);
//   · si la persona SUBIÓ a leer, lo que crece no la arrastra; el próximo mensaje nuevo, sí;
//   · sin animación (`auto`), y la primera vez antes de pintar: al recargar, el hilo aparece abajo.
// Los chats con PERSONAS (los grupos y la bandeja) siguen con app/_chat/grupo/useSeguirElHilo.ts: lo nuevo de otros no baja a quien
// lee arriba, y un botón cuenta cuántos llegaron (como WhatsApp, decisión del 3/11). Comparten `bajarAlCrecer`.
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

export function seguirAlUltimo(el: HiloQueEscrolea, o: { arriba?: () => boolean; quieto?: () => boolean; Observador?: ClaseObservador | null } = {}): SeguidorDelHilo {
  let pegado = true;
  let ultimo = el.scrollTop;
  const arriba = o.arriba ?? (() => false);
  const quieto = o.quieto ?? (() => false);
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
  // Quieto (lo enfocado gana): lo que crece tampoco la baja.
  const crece = bajarAlCrecer(el, () => pegado && !arriba() && !quieto(), o.Observador, () => { ultimo = el.scrollTop; });
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
 * El hilo de un chat con MaKo que sigue al último mensaje. `contenedor`: lo que escrolea (estable: un useCallback). `nuevo`: la clave
 * de la ÚLTIMA fila dibujada (cambia con cada mensaje nuevo, sus puntitos o su pieza). `arriba`: el chat abre arriba (el chat nuevo
 * del Ops Center, con su portada) y mientras tanto no baja. `suave`: con animación (ningún chat la usa: la auditoría pide `auto`).
 * `quieto`: algo pidió ir a otro lugar del hilo (la propuesta de un link en el Video Editor) y mientras tanto no baja, ni con un
 * mensaje nuevo; al soltarse no salta: baja con el próximo (20/11, el rojo de la punta de las pestañas).
 */
export function useBajarAlUltimo(contenedor: () => HTMLElement | null, nuevo: unknown, o: { arriba?: boolean; suave?: boolean; quieto?: boolean } = {}): void {
  const seguidor = useRef<SeguidorDelHilo | null>(null);
  const arriba = useRef(!!o.arriba);
  arriba.current = !!o.arriba;
  const quieto = useRef(!!o.quieto);
  quieto.current = !!o.quieto;
  useEffect(() => {
    let s: SeguidorDelHilo | null = null;
    const enganchar = () => {
      if (s) return;
      const el = contenedor();
      if (!el) return;
      s = seguirAlUltimo(el, { arriba: () => arriba.current, quieto: () => quieto.current });
      seguidor.current = s;
    };
    enganchar();
    const t = s ? 0 : window.setTimeout(enganchar, MS_HOJA_MEDIDA);
    const alNuevo = () => { if (!quieto.current) seguidor.current?.bajar(); };
    window.addEventListener(EVENTO_MENSAJE_NUEVO, alNuevo);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(EVENTO_MENSAJE_NUEVO, alNuevo);
      (s as SeguidorDelHilo | null)?.soltar();
      seguidor.current = null;
    };
  }, [contenedor]);
  const suave = !!o.suave;
  // Quieto: no baja. `quieto` no está en las dependencias a propósito: al soltarse no salta al final.
  useLayoutEffect(() => {
    if (quieto.current) return;
    const s = seguidor.current;
    if (s) { s.mirarHijos(); s.bajar(suave); return; }
    // Antes de engancharse (el primer pintado): baja igual; el seguidor la mantiene abajo apenas se engancha.
    const el = contenedor();
    if (el) el.scrollTop = arriba.current ? 0 : el.scrollHeight;
  }, [nuevo, o.arriba, suave, contenedor]);
}
