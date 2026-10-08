// =============================================================================
// nutricion-hilos — varios caminos A LA VEZ en una inscripción (puro, con test)
// =============================================================================
// Segunda tanda del flujo con ramas (08/10/2026, punto 2 del pedido de Martín: «de un mismo cron
// puedo sacar toda una secuencia para WhatsApp y toda otra secuencia de email»). El modelo
// (`paralelos` en una tarjeta, el nodo `inicio` del CRON) vive en lib/flujo-grafo.ts; el porqué,
// en docs/chatbot-flujo-ramas-diseno.md → «SEGUNDA TANDA», decisiones 2 a 7.
//
// El motor lleva los hilos de un lead en UNA inscripción (`nutricion_inscripciones.hilos`, mig
// 0228). `hilos` NULL = un solo cursor, como siempre: los flujos sin flechas en paralelo nunca
// entran acá. Con hilos, las columnas de siempre (`paso_actual`, `nodo_actual`,
// `proximo_envio_at`) RESUMEN el hilo que vence primero, así la cola de `procesarEnvios` y su
// índice no cambian.
//
// Sin `server-only` y sin base, a propósito: decide cuántas veces le escribimos a una persona
// real. El que ESCRIBE es lib/nutricion.ts (`escribir`, la puerta de la posición).
// =============================================================================

import { HILO_PRINCIPAL, TOPE_HILOS, indicePorId, puertosDe, raicesSalida, type PasoGrafo } from './flujo-grafo';

/**
 * Un camino vivo de la inscripción. `h` es su nombre: 'p' el principal, o el id de la tarjeta
 * donde nació (el destino de la flecha en paralelo). `nodo` es la tarjeta en la que está y
 * `proximo` cuándo le toca (ISO).
 */
export type Hilo = { h: string; nodo: string; proximo: string };

/** Lo que cambia de un hilo: o se CIERRA, o se mueve (`nodo`) y/o se reprograma (`proximo`). */
export type CambioHilo =
  | { cierra: true; estado?: 'completada' | 'cancelada' }
  | { cierra?: false; nodo?: string; proximo?: string };

/** Las columnas de siempre, como quedan después del cambio. */
export type ResumenInsc = {
  /** Ausente = no se escribe (la inscripción terminó, o el nodo del hilo ya no existe). */
  paso_actual?: number;
  nodo_actual: string | null;
  proximo_envio_at: string | null;
  estado: 'activa' | 'completada' | 'cancelada';
};

const ms = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

/** El orden de la cola: por próximo envío y, empatados, por nombre (determinista). */
const porProximo = (a: Hilo, b: Hilo): number => (ms(a.proximo) - ms(b.proximo)) || (a.h < b.h ? -1 : a.h > b.h ? 1 : 0);

/**
 * Lee la columna `hilos` como viene de la base. Lo que no es un hilo no viaja; un array vacío o
 * ilegible es NULL (un solo cursor): nunca se escribe vacío, una inscripción sin hilos terminó.
 */
export function sanearHilos(x: unknown): Hilo[] | null {
  if (!Array.isArray(x)) return null;
  const out: Hilo[] = [];
  for (const o of x) {
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    if (typeof r.h !== 'string' || !r.h || typeof r.nodo !== 'string' || !r.nodo || typeof r.proximo !== 'string') continue;
    if (out.some((y) => y.h === r.h)) continue;
    out.push({ h: r.h, nodo: r.nodo, proximo: r.proximo });
  }
  return out.length ? out : null;
}

/**
 * Los hilos con los que arranca una inscripción NUEVA: uno por raíz de la salida (la principal y
 * las flechas en paralelo del CRON). NULL con una sola raíz: la inscripción sigue siendo de un
 * cursor, como siempre. `proximoDe` es la programación de siempre de cada tarjeta.
 */
export function hilosIniciales(pasos: readonly PasoGrafo[], proximoDe: (nodo: string) => string): Hilo[] | null {
  const raices = raicesSalida(pasos);
  if (raices.length <= 1) return null;
  return raices.slice(0, TOPE_HILOS).map((r, k) => ({ h: k === 0 ? HILO_PRINCIPAL : r, nodo: r, proximo: proximoDe(r) }));
}

/** Los hilos que ya tocan, del que vence primero al último (y por nombre, si empatan). */
export function hilosVencidos(hilos: readonly Hilo[], ahoraMs: number): Hilo[] {
  return hilos.filter((x) => ms(x.proximo) <= ahoraMs).sort(porProximo);
}

/** Los ids que arrancan A LA VEZ cuando la tarjeta `idx` termina (sus flechas en paralelo). */
export function repartosDe(pasos: readonly PasoGrafo[], idx: number): string[] {
  return puertosDe(pasos, idx).flatMap((pt) => (pt.puerto.startsWith('par:') && pt.destino ? [pt.destino] : []));
}

/** Un hilo nuevo por cada reparto, con su próximo envío. Su nombre es la tarjeta donde nace. */
export function hilosNuevos(destinos: readonly string[], proximoDe: (nodo: string) => string): Hilo[] {
  return destinos.map((d) => ({ h: d, nodo: d, proximo: proximoDe(d) }));
}

/**
 * Aplica un cambio al hilo `h` y suma los `nuevos`, y devuelve los hilos que quedan con el
 * RESUMEN para las columnas de siempre.
 *
 *  · Un hilo que se cierra sale del array; si no queda ninguno, la inscripción TERMINA
 *    (`completada`, o `cancelada` si el último se canceló), con `hilos` NULL y sin próximo envío:
 *    la inscripción termina cuando no queda hilo (decisión 3).
 *  · Un hilo nuevo con el nombre de uno vivo no se suma (sería la misma tarjeta dos veces: el
 *    mismo mensaje dos veces al lead), ni pasado el tope de `TOPE_HILOS`. `validarGrafo` ya lo
 *    impide al guardar; esto es la red. Se cuentan en `descartados` para que el motor lo diga.
 */
export function aplicarAHilo(
  pasos: readonly PasoGrafo[], hilos: readonly Hilo[], h: string, cambio: CambioHilo, nuevos: readonly Hilo[] = [],
): { hilos: Hilo[] | null; resumen: ResumenInsc; descartados: number } {
  const out: Hilo[] = [];
  for (const x of hilos) {
    if (x.h !== h) { out.push({ ...x }); continue; }
    if (cambio.cierra) continue;
    out.push({ ...x, nodo: cambio.nodo ?? x.nodo, proximo: cambio.proximo ?? x.proximo });
  }
  let descartados = 0;
  for (const n of nuevos) {
    if (out.some((x) => x.h === n.h) || out.length >= TOPE_HILOS) { descartados += 1; continue; }
    out.push({ ...n });
  }
  if (!out.length) {
    const estado = cambio.cierra && cambio.estado === 'cancelada' ? 'cancelada' : 'completada';
    return { hilos: null, resumen: { nodo_actual: null, proximo_envio_at: null, estado }, descartados };
  }
  const primero = [...out].sort(porProximo)[0];
  const i = indicePorId(pasos, primero.nodo);
  return {
    hilos: out,
    resumen: { ...(i >= 0 ? { paso_actual: i } : {}), nodo_actual: primero.nodo, proximo_envio_at: primero.proximo, estado: 'activa' },
    descartados,
  };
}

/**
 * ¿El hilo `h` sigue en la tarjeta `nodo`? Es la pregunta del compare-and-set cuando la escritura
 * perdió contra otra (por `hilos_rev`): se relee la fila y el cambio se vuelve a aplicar SÓLO si
 * este hilo sigue donde se lo leyó. Si otra corrida ya lo movió o lo cerró, el cambio es de ella.
 */
export function hiloSigueEn(hilos: readonly Hilo[] | null, h: string, nodo: string | null | undefined): boolean {
  return !!hilos?.some((x) => x.h === h && x.nodo === nodo);
}

/** ¿Quedan OTROS hilos vivos además de `h`? Lo pregunta lo terminal de un email (decisión 7). */
export function hayOtrosHilos(hilos: readonly Hilo[] | null, h: string | null): boolean {
  return !!hilos && hilos.some((x) => x.h !== h);
}
