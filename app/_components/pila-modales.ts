'use client';

// =============================================================================
// pila-modales — un modal sobre otro: el de abajo se va, y al volver está igual
// =============================================================================
// LA REGLA (una sola, para toda la app): cuando se abre un modal sobre otro, el de
// abajo DESAPARECE de la pantalla. Al cerrar el de arriba, el de abajo vuelve — con
// el scroll exactamente donde estaba. Y encadenado: si abriste cuatro, cerrás cuatro
// veces y vas volviendo uno por uno.
//
// Qué NO hace, a propósito: no desmonta el de abajo. Desmontarlo pierde lo que había
// adentro —la revisión de una reunión con 30 tareas destildadas a mano, media
// búsqueda escrita, un formulario a medio llenar—, y eso es peor que el problema que
// resuelve. Se esconde con `display:none`, que saca el nodo del layout pero conserva
// su estado de React y su scrollTop.
//
// Por qué un store de módulo y no un contexto de React: estos modales se montan en
// árboles distintos (algunos con portal, otros no) y no siempre comparten un provider.
// Un store suelto con suscripción funciona desde cualquier lado y no obliga a envolver
// nada. Como la pila es una sola por pestaña, no hay riesgo de dos instancias.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

let pila: string[] = [];
const suscriptores = new Set<() => void>();
const avisar = () => { for (const f of suscriptores) f(); };

/** El id del modal que está arriba de todo (null si no hay ninguno abierto). */
export const modalDeArriba = (): string | null => (pila.length ? pila[pila.length - 1] : null);
/** Cuántos hay abiertos. Útil para bloquear el scroll del body una sola vez. */
export const profundidadModales = (): number => pila.length;

let n = 0;
const nuevoId = () => `m${++n}`;

/** Base del z-index. Cada nivel suma 2 para dejar lugar al backdrop de cada uno. */
const Z_BASE = 130;

export type CapaModal = {
  /** false = hay otro modal adelante. Pintá el tuyo con `display:none`, NO lo desmontes. */
  visible: boolean;
  /** el z-index que le toca a este nivel. */
  z: number;
  /** poné este ref en el contenedor que scrollea (el cuerpo del modal). */
  refScroll: (el: HTMLElement | null) => void;
  /** true si es el único abierto (para decidir si bloquear el scroll del body). */
  esElPrimero: boolean;
  /**
   * ¿NADA está abierto encima? Es con lo que se decide si contestar al Escape.
   *
   * ⚠️ ES UNA FUNCIÓN Y NO UN BOOLEAN, a propósito. Un listener de teclado se registra una
   * vez y vive muchos renders: con un boolean habría que meterlo en las dependencias del
   * efecto —y el del `Modal` devuelve el foco en su cleanup, así que re-ejecutarlo haría
   * saltar el foco cada vez que algo se abre encima— o guardarlo en un ref escrito durante
   * el render, que es otra cosa que no se hace. Preguntándolo en el momento de la tecla, la
   * respuesta es siempre la de AHORA y el handler no tiene dependencias.
   *
   * ⚠️ NO ES `visible`, y confundirlos es el bug. Una capa `anidada` deja ver a su padre y
   * una `contenedor` nunca se apaga: en los dos casos hay dos capas VISIBLES a la vez, y si
   * las dos escuchan el Escape, una sola tecla cierra las dos. Medido el 27/09/2026 adentro
   * de la ficha de un cliente: Escape en el detalle de una tarea cerraba la tarea Y la
   * ficha entera, o sea que perdías el cliente por cerrar una tarjeta.
   *
   * `stopPropagation()` no alcanza: los dos listeners viven en `document`, y eso sólo frena
   * la propagación a OTROS nodos, nunca a los otros listeners del mismo.
   */
  esElDeArriba: () => boolean;
};

/**
 * Registra este modal en la pila mientras `abierto` sea true.
 *
 * Uso:
 *   const capa = useCapaModal(true);
 *   <div style={{ display: capa.visible ? 'flex' : 'none', zIndex: capa.z }}>
 *     <div ref={capa.refScroll} style={{ overflowY: 'auto' }}>…</div>
 *   </div>
 */
/**
 * ⚠️ UNA CAPA «ANIDADA» NO TAPA A LA DE ABAJO, y eso hacía falta. Por default un modal
 * esconde a todos los de abajo (`display: none`), que es lo correcto cuando el que se abre
 * es OTRA pantalla: dos overlays superpuestos se ven sucios y el de atrás scrollea solo.
 *
 * Pero un diálogo CHICO que se abre DESDE un campo del modal de atrás —«Personalizado…» de
 * la repetición, abierto desde la columna derecha de un detalle— no es otra pantalla: es
 * parte de la misma tarea. Escondiendo el padre, elegir «Personalizado…» hacía desaparecer
 * el detalle entero y dejaba el diálogo flotando sobre el tablero, como si se hubiera
 * cerrado la tarjeta. Se reportó así: «cuando le doy a personalizado, se me cierra el
 * detail» (26/09/2026).
 *
 * `anidada: true` es OPT-IN a propósito: el default no cambia, así que ninguna de las
 * pantallas que ya usan la pila se entera de esto.
 */
/** Las capas que NO tapan a la de abajo (ver `useCapaModal`). */
const anidadas = new Set<string>();

/**
 * ⚠️ UNA CAPA «CONTENEDOR» NO SE APAGA NUNCA, y es la otra mitad de `anidada`.
 *
 * `anidada` lo declara el de ARRIBA («yo no tapo al de abajo»). Esto lo declara el de
 * ABAJO: «adentro mío viven otros modales, no me apagues». Hacen falta las dos porque el
 * de abajo no puede saber quién se va a abrir encima, y el de arriba tampoco sabe dónde
 * está montado.
 *
 * El caso que la obligó, medido en el navegador el 27/09/2026: la ficha de un cliente
 * (`app/customer-success/FichaCliente.tsx`) es un `Modal` de la casa que monta ADENTRO el
 * tablero entero, y el tablero abre sus propios modales — el detalle de una tarea, el de un
 * proyecto, la audiencia, el de eliminar. Esos modales son DESCENDIENTES del DOM de la
 * ficha, así que apagarla con `display:none` los apaga a ellos también: al hacer click en
 * una tarea desaparecía todo y no se abría nada. Medido: `.mk-modal__fondo` en
 * `display:none` con el overlay del detalle adentro, montado, en `display:flex` y z 132.
 * Se reportó como «se bugea y no abre nada».
 *
 * Marcar como `anidada` a los ~15 modales del tablero no servía: `anidada` también apaga
 * la semántica de REEMPLAZO que esos modales tienen entre sí en `/plan` (el detalle de un
 * proyecto abierto desde una tarea la tapa, y tiene un «Volver a la tarea»). Esto es una
 * línea, es opt-in, y no cambia nada para las otras pantallas.
 */
const contenedores = new Set<string>();

/**
 * LA REGLA DE QUÉ SE VE, pura y exportada PARA QUE SE PUEDA TESTEAR.
 *
 * Vive afuera del hook a propósito: adentro no la puede importar ningún test, y esta
 * condición ya dejó una pantalla en blanco en producción. Es el mismo criterio que
 * `exigirClienteDePrueba` en `lib/auth-session.ts` (AGENTS.md: la condición de un guard va
 * en un módulo que un test pueda importar).
 *
 * Tres reglas, y el orden importa:
 *   1. Una capa que no está en la pila no se ve.
 *   2. Una capa CONTENEDOR siempre se ve: lo que se abre encima vive ADENTRO suyo, así que
 *      apagarla con `display:none` apaga también al que se acaba de abrir.
 *   3. Si no, se ve cuando todo lo que tiene encima es ANIDADO — un diálogo de un campo no
 *      es una pantalla nueva.
 */
export function decidirVisible(
  pila: readonly string[],
  id: string,
  anidadas: ReadonlySet<string>,
  contenedores: ReadonlySet<string>,
): boolean {
  const idx = pila.indexOf(id);
  if (idx < 0) return false;
  if (contenedores.has(id)) return true;
  return pila.slice(idx + 1).every((x) => anidadas.has(x));
}

export function useCapaModal(abierto: boolean, opciones?: { anidada?: boolean; contenedor?: boolean }): CapaModal {
  const anidada = !!opciones?.anidada;
  const contenedor = !!opciones?.contenedor;
  const idRef = useRef<string>('');
  if (!idRef.current) idRef.current = nuevoId();
  const id = idRef.current;

  const [, forzar] = useState(0);
  const scrollEl = useRef<HTMLElement | null>(null);
  const scrollGuardado = useRef(0);
  const estabaVisible = useRef(true);

  useEffect(() => {
    const f = () => forzar((x) => x + 1);
    suscriptores.add(f);
    return () => { suscriptores.delete(f); };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    pila = [...pila.filter((x) => x !== id), id];
    if (anidada) anidadas.add(id); else anidadas.delete(id);
    if (contenedor) contenedores.add(id); else contenedores.delete(id);
    avisar();
    return () => { pila = pila.filter((x) => x !== id); anidadas.delete(id); contenedores.delete(id); avisar(); };
  }, [abierto, id, anidada, contenedor]);

  const idx = pila.indexOf(id);
  const visible = decidirVisible(pila, id, anidadas, contenedores);

  // El scroll se guarda JUSTO ANTES de esconderse y se devuelve al volver. Hacerlo en
  // un layout effect (no en un effect normal) evita el parpadeo de un frame arriba de
  // todo antes de saltar a donde estabas.
  useEffect(() => {
    if (!estabaVisible.current && visible) {
      const el = scrollEl.current;
      if (el) {
        // Doble rAF: cuando el nodo vuelve de display:none todavía no tiene altura, y
        // asignar scrollTop en ese momento no hace nada.
        requestAnimationFrame(() => requestAnimationFrame(() => { if (scrollEl.current) scrollEl.current.scrollTop = scrollGuardado.current; }));
      }
    }
    if (estabaVisible.current && !visible && scrollEl.current) {
      scrollGuardado.current = scrollEl.current.scrollTop;
    }
    estabaVisible.current = visible;
  }, [visible]);

  const refScroll = useCallback((el: HTMLElement | null) => { scrollEl.current = el; }, []);
  const esElDeArriba = useCallback(() => modalDeArriba() === id, [id]);

  // `esElDeArriba` lee la pila VIVA, no la de este render: por eso `useCallback` con `id`
  // como única dependencia — su identidad no cambia nunca y el handler no se re-registra.
  return { visible, z: Z_BASE + Math.max(0, idx) * 2, refScroll, esElPrimero: idx === 0, esElDeArriba };
}
