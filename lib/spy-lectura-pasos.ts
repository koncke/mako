// =============================================================================
// spy-lectura-pasos — qué está leyendo AHORA la lectura de un competidor, para la pantalla del alta (4/11/2026)
// =============================================================================
// Martín (por el Cerebro, 4/11): «sería bueno que ahí vayan apareciendo como una animación especial de "Mirando su Instagram…
// Investigando su Web…" y cosas así». El Cerebro: «Sólo lo que esté ocurriendo: nada inventado».
//
// `mirarCompetidor` (lib/spy.ts) lee de a un canal y EN ORDEN: Instagram → YouTube → su web. Pero vuelve en UNA respuesta, así
// que la pantalla no sabe en cuál va. Antes de cada canal la lectura anota su paso (`spy.lectura.<id>`), y la pantalla lo pregunta
// por una RUTA (/api/competitor-spy/lectura): una server action haría fila detrás de la misma lectura que quiere mirar. Se guardan
// TODOS los pasos de la lectura, no sólo el último: uno de milisegundos también se ve.
// ⚠️ CADA LECTURA LLEVA SU MARCA: la pantalla ignora el paso de una lectura anterior (o de otra pestaña).
// Sin `server-only`: lo usan la pantalla, la acción y la ruta, y lo fija tests/spy-lectura-pasos.test.ts.
// =============================================================================

export type PasoLectura = 'instagram' | 'youtube' | 'web';
/** Lo que dice la pantalla de cada paso (y de juntar las piezas, que pasa en la pantalla, después de leer). */
export const TEXTO_PASO: Record<PasoLectura | 'piezas', string> = {
  instagram: 'Mirando su Instagram…',
  youtube: 'Leyendo su YouTube…',
  web: 'Investigando su web…',
  piezas: 'Juntando sus piezas…',
};

export const claveLectura = (competidorId: number): string => `spy.lectura.${competidorId}`;
/** Una marca de lectura: letras, números y guiones, corta. Lo demás no se guarda ni se compara. */
export const marcaValida = (m: unknown): m is string => typeof m === 'string' && /^[\w-]{6,40}$/.test(m);
/** Un paso anotado hace más de esto ya no es de una lectura viva. */
export const PASO_VENCE_MS = 5 * 60_000;

const esPaso = (x: unknown): x is PasoLectura => x === 'instagram' || x === 'youtube' || x === 'web';

/**
 * Lo que se guarda: TODOS los pasos de esa lectura hasta ahora, en orden. Con sólo el último, un canal que se lee en
 * milisegundos (una lectura compartida, lib/spy-compartido.ts) pasaría entre dos preguntas de la pantalla y no se vería.
 */
export const anotarPasos = (marca: string, pasos: readonly PasoLectura[], ahora: number): string =>
  JSON.stringify({ marca, pasos: pasos.filter(esPaso), at: new Date(ahora).toISOString() });

/** Los pasos de ESA lectura, si sigue viva. Otra marca, una vencida o algo ilegible: ninguno. */
export function pasosDe(crudo: string | null | undefined, marca: string, ahora: number): PasoLectura[] {
  if (!crudo) return [];
  try {
    const o = JSON.parse(crudo) as { marca?: unknown; pasos?: unknown; at?: unknown };
    if (o.marca !== marca || typeof o.at !== 'string' || !Array.isArray(o.pasos)) return [];
    const t = Date.parse(o.at);
    if (!Number.isFinite(t) || ahora - t > PASO_VENCE_MS) return [];
    return o.pasos.filter(esPaso).filter((p, i, l) => l.indexOf(p) === i);
  } catch {
    return [];
  }
}

/** La lista que se dibuja: lo que ya tenía, más lo nuevo, en el orden en que pasó y sin repetir. */
export const sumarPasos = <T extends string>(lista: readonly T[], nuevos: readonly T[]): T[] => {
  const out = [...lista];
  for (const p of nuevos) if (!out.includes(p)) out.push(p);
  return out;
};

/** ¿La lectura lee este canal? Sin `solo`, todos; con `solo`, sólo esos (`mirarCompetidor`). */
export const leeCanal = (solo: readonly PasoLectura[] | undefined, paso: PasoLectura): boolean => !solo || solo.includes(paso);

/**
 * Los canales que hay que LEER después de sumarle redes a un competidor (4/11/2026): los que se sumaron (TikTok no se lee: no hay
 * nada que traer) y su web si apareció. Es la lista que va como `solo` a la lectura: el resto ya está leído, y releerlo todo pasaba
 * los 60 s de la acción antes de llegar al canal nuevo.
 */
export function canalesALeer(sumadas: ReadonlyArray<{ red: string }>, web?: string | null): PasoLectura[] {
  const out: PasoLectura[] = [];
  for (const k of sumadas) if ((k.red === 'instagram' || k.red === 'youtube') && !out.includes(k.red)) out.push(k.red);
  if (web) out.push('web');
  return out;
}
