'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

/**
 * EL DUEÑO UNICO DE LA URL DEL PORTAL DE CURSOS.
 * =============================================================================
 *
 * Una POSICION es todo lo que define «dónde estoy» en el portal, y vive entera en el
 * hash. Nadie más que este módulo escribe `history.*` para el portal.
 *
 * ⚠️ POR QUE EXISTE. El mismo botón Atrás se reportó roto CUATRO veces con CUATRO causas
 * distintas, y las tres primeras se arreglaron sin que el usuario dejara de sufrirlo:
 *
 *   1. `CursoReplica` escribía con `replaceState` → no dejaba entrada de historial
 *   2. aterrizar en `?curso=X` sin el catálogo debajo → el Atrás se iba del sitio
 *   3. el portal compartido guardaba la navegación en una pila de React y escribía
 *      siempre con `replaceState`
 *   4. volver de una clase no devolvía a la POSICION anterior (el módulo filtrado, la
 *      búsqueda y el recurso abierto eran `useState`: no sobrevivían al Atrás)
 *
 * Cada arreglo era correcto y ninguno alcanzaba, porque el problema no era ninguno de
 * ellos: era que había TRES dueños de la misma URL —el router de Next en `/conocimientos`,
 * una pila de React en `/compartido`, y el hash en `CursoReplica`— y **ninguno se entera
 * de lo que escriben los otros**.
 *
 * ⚠️ Y LA RAIZ, QUE ES LO QUE MAS CUESTA VER: `history.pushState()` y `replaceState()` NO
 * DISPARAN NINGUN EVENTO. Ni `popstate`, ni `hashchange`. Así que dos componentes pueden
 * escribir la misma URL y quedar con dos ideas distintas de dónde está el usuario, sin
 * error y sin síntoma inmediato.
 *
 * Se midió: al volver de una clase al módulo había CERO escrituras sobre el scroll — el
 * handler de `CursoReplica` no corría, porque el otro componente ya había dejado el hash
 * en su valor final con un `replaceState` mudo. La clave estaba bien guardada y el
 * contenedor ya medía sus 8.063px: no era la clave ni el timing, era que el aviso no
 * existía.
 *
 * De ahí el diseño: quien escribe AVISA, en el mismo acto. Es lo único que un `pushState`
 * no hace solo.
 */

export type Posicion = {
  /** El curso abierto. Sin esto, estás en el catálogo. */
  curso?: string;
  /** El módulo por el que está filtrada la grilla. */
  mod?: string;
  /** La búsqueda DENTRO del curso. */
  q?: string;
  /** La lista de recursos del curso. */
  recursos?: boolean;
  /** La clase abierta. */
  clase?: number;
  /** El recurso abierto, por slug. */
  r?: string;
  /**
   * Una entrada PROPIA de la barra, por su key (`#x=`): «Avance de los clientes» en la vista
   * de quien dicta el curso (app/_cursos/CursoUgc.tsx, `entradasExtra`). Es una posición
   * como cualquier otra, así que vive acá y el Atrás vuelve a ella.
   * ⚠️ Va ÚLTIMA en `ORDEN`: los hashes que ya circulan no la traen, y agregarla al final
   *    no cambia la firma de ninguno (la firma es la clave del scroll guardado).
   */
  extra?: string;
};

const VACIA: Posicion = {};

// ── Serializar: SIEMPRE en este orden ────────────────────────────────────────────────
// ⚠️ El orden es fijo y sale del OBJETO, nunca de `location.hash` tal como vino.
//    `URLSearchParams.set` respeta la posición de las claves que ya existían, así que un
//    link pegado como `#clase=12&mod=M7` produciría una firma distinta que la MISMA
//    pantalla alcanzada desde adentro (`#mod=M7&clase=12`). Dos firmas para una pantalla
//    es guardar el scroll en un lugar y buscarlo en otro.
const ORDEN: Array<[keyof Posicion, string]> = [
  ['curso', 'curso'], ['mod', 'mod'], ['q', 'q'],
  ['recursos', 'v'], ['clase', 'clase'], ['r', 'r'], ['extra', 'x'],
];

export const aHash = (p: Posicion): string => {
  const partes: string[] = [];
  for (const [campo, clave] of ORDEN) {
    const v = p[campo];
    if (v === undefined || v === null || v === '' || v === false) continue;
    partes.push(`${clave}=${encodeURIComponent(campo === 'recursos' ? 'recursos' : String(v))}`);
  }
  return partes.join('&');
};

export const deHash = (hash: string): Posicion => {
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const n = Number(h.get('clase'));
  return {
    curso: h.get('curso') ?? undefined,
    mod: h.get('mod') ?? undefined,
    q: h.get('q') ?? undefined,
    recursos: h.get('v') === 'recursos' ? true : undefined,
    clase: Number.isFinite(n) && n > 0 ? n : undefined,
    r: h.get('r') ?? undefined,
    extra: h.get('x') ?? undefined,
  };
};

/** La firma canónica de una posición. Es la clave del scroll y el criterio de igualdad. */
export const firmaDe = (p: Posicion) => aHash(p);

// ── El store ─────────────────────────────────────────────────────────────────────────
const oyentes = new Set<() => void>();
let enganchado = false;
// Se cachea para que `getSnapshot` devuelva la MISMA string mientras nada cambie: si
// devolviera una nueva cada vez, React entraría en un bucle de renders.
let cache = '';

const leerHash = () => (typeof location === 'undefined' ? '' : location.hash.replace(/^#/, ''));

const refrescar = () => {
  const ahora = leerHash();
  if (ahora === cache) return;
  cache = ahora;
  avisar();
};

/** El aviso que `pushState` no da. Todo el diseño cuelga de esta línea. */
const avisar = () => { for (const f of [...oyentes]) f(); };

const suscribir = (f: () => void) => {
  oyentes.add(f);
  if (!enganchado && typeof window !== 'undefined') {
    enganchado = true;
    // Los DOS: `popstate` cubre el Atrás/Adelante; `hashchange`, un link pegado en una
    // pestaña ya abierta. `refrescar` de-duplica, así que recibirlos dos veces es gratis.
    window.addEventListener('popstate', refrescar);
    window.addEventListener('hashchange', refrescar);
  }
  return () => { oyentes.delete(f); };
};

const instantanea = () => cache;
// En el server no hay URL: la posición es el catálogo. Devolver siempre la MISMA string
// evita el error de hidratación de `useSyncExternalStore`.
const instantaneaServer = () => '';

// ── Escribir ─────────────────────────────────────────────────────────────────────────
export type Modo = 'empujar' | 'reemplazar';

/**
 * Escribe la posición y AVISA. El único lugar del portal que toca `history`.
 *
 * ⚠️ Se conserva el `state` que ya había (`history.state`): el router de Next guarda ahí
 *    su contabilidad, y pisarla con `null` le rompe el Atrás de una forma peor que el bug
 *    que uno vino a arreglar. Ya está aprendido en este repo.
 */
export const navegar = (p: Posicion, modo: Modo = 'empujar') => {
  if (typeof window === 'undefined') return;
  const s = aHash(p);
  const base = location.pathname + location.search;
  const destino = s ? `${base}#${s}` : base;
  const actual = base + location.hash;
  if (destino === actual) { refrescar(); return; }
  if (modo === 'reemplazar') history.replaceState(history.state, '', destino);
  else history.pushState(history.state, '', destino);
  refrescar();
};

/**
 * Siembra el nivel de arriba debajo de la posición actual, para que el Atrás tenga a dónde
 * volver cuando se ATERRIZA adentro (un link compartido, un marcador, un F5).
 *
 * `techo` es lo que hay en el nivel 0 de ESTA ruta, y es un dato de la ruta y no del
 * camino: en el portal completo es el catálogo (una posición vacía); en un share de UN
 * curso es el índice de ese curso, porque arriba no hay nada.
 */
export const sembrar = (techo: Posicion) => {
  if (typeof window === 'undefined') return;
  const actual = deHash(location.hash);
  if (firmaDe(actual) === firmaDe(techo)) return;   // ya estamos en el techo
  const base = location.pathname + location.search;
  const hashTecho = aHash(techo);
  const aqui = base + location.hash;
  history.replaceState(history.state, '', hashTecho ? `${base}#${hashTecho}` : base);
  history.pushState(history.state, '', aqui);
  refrescar();
};

// ── El scroll ────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ ACA NO SCROLLEA LA VENTANA. La hoja del origen pone el contenido en `.ugc-content`
 * con su propio `overflow`. Medido: `window.scrollY` vale 0 SIEMPRE mientras
 * `.ugc-content` tiene 8.063px sobre 561 visibles. Un `window.scrollTo` acá no hace nada
 * — y una prueba que mire `window.scrollY` pasa en verde comparando cero con cero.
 */
const carril = () => (typeof document === 'undefined' ? null : document.querySelector('.ugc-content') as HTMLElement | null);

const claveScroll = (p: Posicion) => `cono-scroll:${location.pathname}${location.search}#${firmaDe(p)}`;

/**
 * Anota dónde estabas. Va SINCRONICO, en el manejador del click, antes de que se pinte lo
 * nuevo: con una lección abierta el carril del listado pierde su alto y el navegador le
 * topea el `scrollTop` a 0, así que medirlo después guarda un cero perfecto.
 */
export const guardarScroll = (p: Posicion) => {
  const c = carril();
  if (!c) return;
  try { sessionStorage.setItem(claveScroll(p), String(Math.round(c.scrollTop))); } catch { /* noop */ }
};

/**
 * Devuelve el scroll de una posición. Reintenta hasta que el contenido sea lo bastante
 * alto: el navegador TOPEA `scrollTop` a lo que el contenedor mide EN ESE INSTANTE, y
 * pedir 3.000 sobre una lista que todavía no se pintó deja 0 sin ningún error.
 */
export const restaurarScroll = (p: Posicion) => {
  let y = 0;
  try { y = parseInt(sessionStorage.getItem(claveScroll(p)) || '0', 10) || 0; } catch { /* noop */ }
  if (y <= 0) { const c0 = carril(); if (c0) c0.scrollTop = 0; return; }
  let intentos = 0;
  const poner = () => {
    const c = carril();
    if (!c) return;
    c.scrollTop = y;
    // `scrollTop` devuelve lo que el navegador ACEPTO, no lo que se pidió.
    if (Math.abs(c.scrollTop - y) > 4 && ++intentos < 40) requestAnimationFrame(poner);
  };
  requestAnimationFrame(poner);
};

export const alTope = () => { const c = carril(); if (c) c.scrollTop = 0; };

// ── El hook ──────────────────────────────────────────────────────────────────────────

/**
 * La posición actual, y la única forma de moverse.
 *
 * `ir` hace las tres cosas que van SIEMPRE juntas y que antes estaban repartidas: guarda
 * el scroll de donde salís, escribe la URL, y sube al tope si el paso es hacia adelante.
 * Que fueran tres llamadas separadas es por lo que se olvidaba una.
 */
export function usePosicion() {
  const hash = useSyncExternalStore(suscribir, instantanea, instantaneaServer);
  const pos = useMemo(() => deHash(hash), [hash]);

  // La posición ANTERIOR, para saber si un cambio fue hacia adelante o hacia atrás.
  const previa = useRef<string>('');
  useEffect(() => {
    const vieja = previa.current;
    previa.current = hash;
    // Si la URL cambió sin pasar por `ir` (el Atrás del navegador), se restaura el scroll
    // de la posición a la que se llegó. `ir` ya se ocupa de las suyas.
    if (vieja !== hash) restaurarScroll(deHash(hash));
  }, [hash]);

  const ir = useCallback((p: Posicion, modo: Modo = 'empujar') => {
    guardarScroll(deHash(leerHash()));
    navegar(p, modo);
    if (modo === 'empujar') alTope();
  }, []);

  return { pos, ir };
}
