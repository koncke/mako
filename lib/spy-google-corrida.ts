// =============================================================================
// spy-google-corrida — la búsqueda en Google de sus otras redes, sin cortarse (4/11/2026)
// =============================================================================
// El Cerebro lo midió desde la PC: el actor de Google de Apify a veces tarda más que los 45 s que le dábamos (57 s a las
// 12:57 UTC, 48 s a las 10:13, las dos `SUCCEEDED`). Apify terminaba y cobraba, y nosotros ya habíamos abortado: la pantalla
// decía «No pude buscar sus otras redes ahora. Prueba en un rato.» y el resultado pagado se perdía.
//
// Ahora la corrida se EMPIEZA (asíncrona) y se sigue un rato. Si no terminó, queda anotada en el negocio
// (`spy.google.<huella de la consulta>`) y el próximo pedido la RETOMA: lee lo que dejó, sin empezar otra ni volver a pagar.
// La pantalla reintenta sola, sin texto (`pendiente`).
//
// Sin `server-only`: lo que decide (qué hacer con lo anotado, cuándo se olvida) se prueba en tests/spy-google-corrida.test.ts.
// =============================================================================

/** Lo anotado de una corrida en marcha o recién terminada. */
export type CorridaGoogle = { run: string; dataset: string; desde: string };

/** Pasado esto, lo anotado se olvida y se busca de nuevo (una búsqueda de otro día no es ésta). */
export const CORRIDA_GOOGLE_VENCE_MS = 30 * 60_000;
/** Cuánto se sigue una corrida dentro de UN pedido antes de contestar «sigue». */
export const SEGUIR_CORRIDA_MS = 35_000;
/** Cada cuánto se pregunta su estado. */
export const PREGUNTAR_CADA_MS = 3_000;
/** El techo de Apify para la corrida (segundos): una corrida que se cuelga no sigue cobrando. */
export const TIMEOUT_CORRIDA_S = 180;

/** Lo que devuelve el que busca en Google: el cuerpo, o que todavía corre, o que no quedan búsquedas hoy. `null` = no se pudo. */
export const GOOGLE_PENDIENTE = { pendiente: true } as const;
export const GOOGLE_SIN_CUPO = { sinCupo: true } as const;
export type RespuestaGoogle = unknown;
export const esPendiente = (x: unknown): boolean => !!x && typeof x === 'object' && (x as { pendiente?: unknown }).pendiente === true;
export const esSinCupo = (x: unknown): boolean => !!x && typeof x === 'object' && (x as { sinCupo?: unknown }).sinCupo === true;

/** FNV-1a de la consulta normalizada: la clave del setting no lleva el texto (nombres de personas). */
export function huellaConsulta(consulta: string): string {
  const t = consulta.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i += 1) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
export const claveCorridaGoogle = (consulta: string): string => `spy.google.${huellaConsulta(consulta)}`;

export function leerCorrida(crudo: string | null | undefined): CorridaGoogle | null {
  if (!crudo) return null;
  try {
    const o = JSON.parse(crudo) as Record<string, unknown>;
    return typeof o?.run === 'string' && typeof o.dataset === 'string' && typeof o.desde === 'string' ? { run: o.run, dataset: o.dataset, desde: o.desde } : null;
  } catch { return null; }
}

/** ¿Se retoma lo anotado o se empieza otra? Lo vencido (o ilegible) se olvida. */
export function queHacerConLaCorrida(c: CorridaGoogle | null, ahora: number): 'retomar' | 'empezar' {
  if (!c) return 'empezar';
  const desde = Date.parse(c.desde);
  return Number.isFinite(desde) && ahora - desde < CORRIDA_GOOGLE_VENCE_MS ? 'retomar' : 'empezar';
}
