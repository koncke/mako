// =============================================================================
// gemini-esfuerzo — cuánto «piensa» Gemini en `chatCheap`, y qué modelo dejó de aceptar `minimal` (15/10/2026)
// =============================================================================
// `chatCheap` (lib/ai-cheap.ts) le manda a Gemini `reasoning_effort: 'minimal'`: con un tope chico de salida, el
// pensar oculto se come el `max_tokens` y la respuesta sale cortada (medido en el Archivero). Funcionó hasta el
// 14/10/2026 a las 20:31 UTC. Desde ahí `gemini-flash-latest` contesta 400 «Thinking level MINIMAL is not supported for
// this model» (INVALID_ARGUMENT) a TODO pedido, en cualquier clave: Google movió el alias a otro modelo. Con `low`
// contesta 200. `gemini-flash-lite-latest` sigue aceptando `minimal`.
//
// ⚠️ UN MODELO «latest» ES UN NOMBRE QUE PROMETE MOVERSE: cualquier parámetro que le mandamos puede dejar de valer sin
// que cambie una línea nuestra. Por eso esto no fija «`gemini-flash-latest` usa `low`»: lo APRENDE del 400, por MODELO,
// y sólo en este proceso. El día que Google lo revierta, o que otro modelo sí acepte `minimal`, un arranque nuevo vuelve
// a probar `minimal` primero.
//
// DÓNDE VIVE LA MEMORIA: `SIN_MINIMAL`, un Set de este módulo. Una instancia de Vercel la arranca vacía y paga UN 400 la
// primera vez (rápido, sin tokens); después va directo con `low`.
//
// Puro (sin `server-only`): lo prueba tests/gemini-esfuerzo.test.ts.
// =============================================================================

/** Lo que `chatCheap` le puede pedir a Gemini (`EsfuerzoBarato`, lib/ai-cheap.ts). */
export type Esfuerzo = 'minimal' | 'low' | 'medium' | 'high';

/**
 * El aire que se suma a `max_tokens` cuando se pide `low` en vez de `minimal`: con `low` el pensar come del MISMO tope,
 * y con el tope de siempre la respuesta visible salía vacía (medido: con 4 tokens, `finish_reason: length` y 0 de
 * salida).
 */
export const AIRE_SIN_MINIMAL = 1024;

/** Los modelos que contestaron que no aceptan `minimal`, en ESTE proceso. */
const SIN_MINIMAL = new Set<string>();

/** ¿El 400 dice que el modelo no acepta ese nivel de pensar? */
export function rechazaElEsfuerzo(status: number, mensaje: string): boolean {
  return status === 400 && /thinking level/i.test(mensaje) && /not supported/i.test(mensaje);
}

/** Cuánto pensar se le pide a ESTE modelo, y cuánto aire se suma a `max_tokens`. */
export function esfuerzoParaGemini(modelo: string, pedido: Esfuerzo): { esfuerzo: Esfuerzo; aire: number } {
  if (pedido === 'minimal' && SIN_MINIMAL.has(modelo)) return { esfuerzo: 'low', aire: AIRE_SIN_MINIMAL };
  return { esfuerzo: pedido, aire: 0 };
}

/** Anota que ESTE modelo no acepta `minimal` (lo dijo un 400). Sólo este modelo, sólo este proceso. */
export function aprenderSinMinimal(modelo: string): void {
  SIN_MINIMAL.add(modelo);
}

/** Para el test: olvidar lo aprendido. */
export function olvidarEsfuerzos(): void {
  SIN_MINIMAL.clear();
}
