// =============================================================================
// spy-analisis-reglas — qué lee la IA de un competidor, y cuándo (4/11/2026)
// =============================================================================
// Martín, 4/11: «"Con qué abre" no se entiende que significa eso, y la IA ya debería analizar por sí sola todo, sin
// pedirlo. Obvio, jamás que el usuario tenga que esperar, que los procesos se ejecuten en segundo plano… y de última
// que en el detail de cada reel aparezca "Analizando"».
//
// Lo puro, para que tenga test: qué piezas faltan, en qué orden se leen y de a cuántas. La llamada a la IA vive en
// `analizarCompetidor` (lib/spy.ts) y la dispara sola /api/competitor-spy/analizar después de cada lectura.
//
// ⚠️ DE A TANDAS Y SÓLO LO QUE FALTA. Antes se mandaban las primeras 40 piezas cada vez que alguien apretaba el botón,
// ya leídas o no: con todo lo que publica (etapa 3) eso se vuelve caro y lento, y la IA es del negocio.
// =============================================================================

/** Lo que mira esta regla de una pieza. */
export type PiezaParaAnalisis = {
  ref: string;
  canal: string;
  vistas: number | null;
  publicada_en: string | null;
  analisis: unknown;
};

/** Cuántas piezas se le mandan a la IA de una vez: entran en un pedido sin pasarse de 4.000 tokens de respuesta. */
export const PIEZAS_POR_ANALISIS = 30;

/** Los canales cuyas piezas lee la IA. La web se lee aparte (`leerFunnel`). */
const CANALES_ANALIZABLES = new Set(['instagram', 'youtube', 'anuncios']);

/**
 * Lo que se guarda para una pieza que se mandó y la IA no devolvió. Sin esto queda «pendiente» para siempre, y cada
 * lectura la vuelve a mandar y a pagar.
 */
export const ANALISIS_SIN_DATOS = { gancho: '', tipoGancho: '', angulo: '', etiquetas: [] as string[], formato: 'otro' };

/** ¿El análisis ya trae el formato? Lo que se guardó antes del 4/11/2026 no lo tiene (lo pide el detalle: lib/spy-detalle.ts). */
const conFormato = (a: unknown): boolean => !!a && typeof a === 'object' && typeof (a as { formato?: unknown }).formato === 'string';

/**
 * ¿Le falta el análisis? `null` es «no se leyó»; un objeto, aunque venga vacío, es «ya se leyó»… si trae el formato.
 *
 * ⚠️ LO ANALIZADO ANTES DEL FORMATO SE LEE UNA VEZ MÁS (4/11/2026, «la vista de formatos se llena sola»): sin eso, un
 * competidor ya analizado no llena nunca «¿Qué formatos le funcionan?». Es UNA vez: `guardarAnalisis` escribe siempre un
 * formato (`otro` si la IA no lo vio), y una pieza que la IA no devuelve queda con `ANALISIS_SIN_DATOS`, que también lo trae.
 */
export const faltaAnalisis = (p: PiezaParaAnalisis): boolean => CANALES_ANALIZABLES.has(p.canal) && !conFormato(p.analisis);

/**
 * Las que faltan, en el orden en que se leen: primero las que nunca se leyeron, y entre ellas lo que más vistas tiene (es lo que se va a copiar), y a igual
 * vistas, lo más nuevo. Un contador que el canal no publica va al final, no cuenta como cero.
 */
export function pendientesDeAnalisis<T extends PiezaParaAnalisis>(piezas: readonly T[], tope = PIEZAS_POR_ANALISIS): T[] {
  return piezas
    .filter(faltaAnalisis)
    .sort((a, b) => {
      // Lo que nunca se leyó va antes que lo que sólo necesita el formato: eso ya tiene algo que mostrar.
      if ((a.analisis == null) !== (b.analisis == null)) return a.analisis == null ? -1 : 1;
      if (a.vistas == null && b.vistas != null) return 1;
      if (b.vistas == null && a.vistas != null) return -1;
      if ((b.vistas ?? 0) !== (a.vistas ?? 0)) return (b.vistas ?? 0) - (a.vistas ?? 0);
      return (b.publicada_en ?? '').localeCompare(a.publicada_en ?? '');
    })
    .slice(0, Math.max(0, tope));
}

/** Cuántas faltan: la pantalla dibuja «Analizando…» en esas y deja de preguntar cuando llega a cero. */
export const cuantasFaltan = (piezas: readonly PiezaParaAnalisis[]): number => piezas.filter(faltaAnalisis).length;

/**
 * Las refs que se mandaron y la IA no devolvió: se guardan con `ANALISIS_SIN_DATOS`. Se compara sin mayúsculas ni
 * espacios: un modelo que reescribe el ref en minúsculas no deja la pieza pendiente para siempre.
 */
export function refsSinRespuesta(enviadas: readonly string[], devueltas: readonly string[]): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const vinieron = new Set(devueltas.map(norm));
  return enviadas.filter((r) => !vinieron.has(norm(r)));
}

/**
 * La oferta que se guarda. Una tanda que no dice qué promete (la IA vio sólo reels de una charla) no BORRA la que
 * ya estaba: la pisa sólo una que trae algo.
 */
export function ofertaQueQueda<O extends { promete: string }>(nueva: O, anterior: O | null): O | null {
  return nueva.promete.trim() ? nueva : anterior;
}
