// =============================================================================
// ia-saturacion — qué MODELO está saturado ahora, aprendido en este proceso (26/10/2026)
// =============================================================================
// El caso (Landings, logs de Vercel, 26/10/2026 05:52 UTC, ws9): la réplica de una página de 20 secciones dejó 17 SIN IA en
// 135 s, con un plazo de 240. Los errores: «gemini · cuenta 3: The operation was aborted due to timeout» y «gemini · cuenta
// 4: This model is currently experiencing high demand». Cada tanda de secciones tiene 42 s de IA, y el primer intento contra
// `gemini-flash-latest` colgado se los comía enteros: `gemini-flash-lite-latest` —el respaldo de MODELOS_RESPALDO, medido que
// contesta cuando el otro da «high demand»— nunca llegaba a probarse. Y la tanda siguiente volvía a empezar por el colgado.
//
// Lo que se aprende acá: un modelo que contestó 503 «high demand» (o «overloaded», «UNAVAILABLE») queda SATURADO unos
// minutos. Mientras tanto `modelosAProbar` (lib/ai-cheap.ts) lo pone AL FINAL de la lista: se prueba primero el respaldo
// sano, y el saturado igual queda como última opción.
//
// ⚠️ LA SATURACIÓN ES DE GOOGLE, NO DE UN NEGOCIO: por eso la memoria es del proceso entero y la comparten todos los
//    workspaces (no guarda ningún dato de nadie, sólo «este modelo no contesta»). Un 429 NO es saturación: es la cuota de UNA
//    cuenta, y lo resuelve otra cuenta, no otro modelo.
// ⚠️ UN TIMEOUT NUNCA MARCA AL MODELO PARA EL PROCESO: sólo lo que el proveedor DICE (503, «high demand», «overloaded»). Un
//    corte por plazo no distingue un modelo colgado de un pedido grande o de un plazo chico del que llama (10 s en la red de
//    MaKo en WhatsApp): con un umbral (fijo de 25 s, y después el timeout del que llama) un pedido SANO marcaba al modelo para
//    todos los negocios (revisión del tren-l y verificación del tren-m, hallazgo 17). El cuelgue se recuerda en el PEDIDO
//    (`conMemoriaDelPedido`): una réplica entera, por ejemplo, empieza sus tandas siguientes por el respaldo.
//
// Puro (sin `server-only`): lo prueba tests/ia-saturacion.test.ts. El molde es lib/gemini-esfuerzo.ts.
// =============================================================================

import { AsyncLocalStorage } from 'node:async_hooks';

/** Cuánto dura «saturado»: lo que tarda un bache de Google en pasar, medido en los casos de docs/hallazgos-ia.md. */
export const VENTANA_SATURADO_MS = 3 * 60_000;

/**
 * El plazo que un pedido de ese tamaño NECESITA: entre 30 s y 120 s, 12 ms por token de salida (lib/anthropic.ts, `chatClaude`).
 * Un timeout por debajo de esto es un corte del que llama (su plazo no alcanzaba), no un modelo colgado.
 */
export const plazoEsperadoMs = (maxTokens?: number): number => Math.min(120_000, Math.max(30_000, (maxTokens ?? 512) * 12));

/** `proveedor:modelo` → hasta cuándo está saturado (epoch ms), en ESTE proceso. */
const SATURADOS = new Map<string, number>();
const clave = (prov: string, modelo: string) => `${prov}:${modelo}`;

/** ¿El error dice que el MODELO está saturado (no la cuota de una cuenta)? */
export function esSaturacion(mensaje: string): boolean {
  if (/\b429\b|quota|rate.?limit|resource_exhausted/i.test(mensaje)) return false;
  return /\b503\b|high demand|overloaded|\bUNAVAILABLE\b/i.test(mensaje);
}

/** ¿El error es un plazo vencido (el `AbortSignal.timeout` de un pedido)? */
export const esTimeout = (mensaje: string): boolean => /aborted due to timeout|TimeoutError|timed? ?out/i.test(mensaje);

/**
 * ¿Este fallo dice que no vale la pena reintentar el MISMO modelo en este pedido? Un timeout, sólo si el intento tuvo todo el
 * plazo que su tamaño necesitaba. Es para el corte LOCAL de la cascada; al proceso sólo lo marca `esSaturacion`.
 */
export function fallaDeSaturacion(mensaje: string, plazoDelIntentoMs: number, plazoNecesarioMs: number): boolean {
  return esSaturacion(mensaje) || (esTimeout(mensaje) && plazoDelIntentoMs >= plazoNecesarioMs);
}

export function anotarSaturado(prov: string, modelo: string, ahora = Date.now()): void {
  if (!modelo) return;
  SATURADOS.set(clave(prov, modelo), ahora + VENTANA_SATURADO_MS);
}

export function estaSaturado(prov: string, modelo: string, ahora = Date.now()): boolean {
  const hasta = SATURADOS.get(clave(prov, modelo));
  if (hasta == null) return false;
  if (hasta <= ahora) { SATURADOS.delete(clave(prov, modelo)); return false; }
  return true;
}

/**
 * La lista de modelos con los saturados AL FINAL (orden estable: entre los sanos, y entre los saturados, el de siempre).
 * `undefined` en la lista es «el modelo por default del proveedor», que se llama `porDefecto`. Nunca saca a ninguno.
 */
export function primeroLosSanos<T extends string | undefined>(prov: string, modelos: readonly T[], porDefecto: string, ahora = Date.now()): T[] {
  const sat = (m: T) => estaSaturado(prov, m ?? porDefecto, ahora) || colgadoEnElPedido(prov, m ?? porDefecto);
  return [...modelos.filter((m) => !sat(m)), ...modelos.filter(sat)];
}

// ── Los cuelgues, en el PEDIDO (no en el proceso) ────────────────────────────────────────────────────────────────────

/** `proveedor:modelo` que se colgaron (timeout) adentro de un pedido largo: una réplica, con sus tandas y su segunda vuelta. */
const DEL_PEDIDO = new AsyncLocalStorage<Set<string>>();

/**
 * Corre `fn` con una memoria de cuelgues PROPIA: lo que se cuelgue adentro va al final de la lista sólo para lo que sigue
 * adentro de `fn` (las otras tandas de la misma réplica), nunca para otro pedido ni otro negocio.
 */
export const conMemoriaDelPedido = <T>(fn: () => Promise<T>): Promise<T> => DEL_PEDIDO.run(new Set(), fn);

/** Un intento que se cortó por plazo: sólo cuenta adentro de `conMemoriaDelPedido` (afuera no hace nada). */
export function anotarColgadoEnElPedido(prov: string, modelo: string): void {
  if (modelo) DEL_PEDIDO.getStore()?.add(clave(prov, modelo));
}

export const colgadoEnElPedido = (prov: string, modelo: string): boolean => DEL_PEDIDO.getStore()?.has(clave(prov, modelo)) === true;

/** Sólo para los tests. */
export function olvidarSaturados(): void { SATURADOS.clear(); }
