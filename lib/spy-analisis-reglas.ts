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

import { VERSION_FORMATOS, formatoDe } from './spy-detalle';
import { textoVencido } from './spy-reglas';

/** Lo que mira esta regla de una pieza. */
export type PiezaParaAnalisis = {
  ref: string;
  canal: string;
  vistas: number | null;
  publicada_en: string | null;
  analisis: unknown;
  /** Cuándo se leyó el texto. Opcional: quien no lo pasa se trata como «hay algo que leer» (`hayAlgoQueLeer`). */
  texto_leido_en?: string | null;
};

/** Cuántas piezas se le mandan a la IA de una vez: entran en un pedido sin pasarse de 4.000 tokens de respuesta. */
export const PIEZAS_POR_ANALISIS = 30;

/** Los canales cuyas piezas lee la IA. La web se lee aparte (`leerFunnel`). */
const CANALES_ANALIZABLES = new Set(['instagram', 'youtube', 'anuncios']);

/**
 * Lo que se guarda para una pieza que se mandó y la IA no devolvió. Sin esto queda «pendiente» para siempre, y cada
 * lectura la vuelve a mandar y a pagar.
 */
export const ANALISIS_SIN_DATOS = { gancho: '', tipoGancho: '', angulo: '', etiquetas: [] as string[], formato: 'otro', formatosV: VERSION_FORMATOS };

/** ¿El análisis ya trae el formato? Lo que se guardó antes del 4/11/2026 no lo tiene (lo pide el detalle: lib/spy-detalle.ts). */
const conFormato = (a: unknown): boolean => !!a && typeof a === 'object' && typeof (a as { formato?: unknown }).formato === 'string';

/**
 * Los formatos VIEJOS (los 11 del 4/11 a la mañana) en los que pudo caer, a la fuerza, uno de los OCHO que entraron
 * después: `otro` (cualquiera), `testimonio` (→ `caso-de-exito`), `opinion` (→ `mito`, `reaccion`, `frase`), `detras`
 * (→ `recap-evento`) y `entrevista` (→ `preguntas`). Lo dijo la refutación del pendiente T12 (17/11/2026): con once
 * opciones, un caso de éxito se llamaba testimonio, y releer sólo lo que quedó en `otro` lo dejaba así para siempre.
 *
 * ⚠️ Y NO MÁS: una pieza que la IA vieja llamó `tutorial` o `lista` no tiene un formato nuevo vecino, y releerla lo
 * pagaría el negocio para obtener lo mismo. Si entra otro formato nuevo, se sube `VERSION_FORMATOS` y se piensa de
 * nuevo esta lista.
 */
const PUEDEN_SER_UNO_NUEVO: ReadonlySet<string> = new Set(['otro', 'testimonio', 'opinion', 'detras', 'entrevista']);

/**
 * ¿Se clasificó con un catálogo de formatos MÁS CHICO que el de hoy, y en uno de los formatos que pueden ser uno de los
 * nuevos (`PUEDEN_SER_UNO_NUEVO`)? Entonces se vuelve a leer UNA vez: todo lo que se guarda desde el 4/11 lleva
 * `formatosV`, y lo que la IA no devuelve se cierra igual (`cierreDeLasQueNoVolvieron`).
 */
const conCatalogoViejo = (a: unknown): boolean => {
  if (!conFormato(a)) return false;
  const x = a as { formato?: unknown; formatosV?: unknown };
  const v = typeof x.formatosV === 'number' ? x.formatosV : 1;
  return v < VERSION_FORMATOS && PUEDEN_SER_UNO_NUEVO.has(formatoDe(x.formato) || 'otro');
};

/**
 * ¿Hay algo que leer? No, si el TEXTO VENCIÓ: `podarVencido` (lib/spy-reglas.ts) le tacha título, texto y análisis al LEERLA
 * a los 30 días, así que llega con `analisis: null` y parecía «sin leer». Mandarla le cobraba al negocio una lectura de nada
 * en cada tanda, y si la IA contestaba algo, el guardado le pisaba el análisis bueno y le renovaba el reloj del texto
 * (`texto_leido_en`), que es la retención de YouTube. Los anuncios no se podan, así que nunca vencen acá.
 * ⚠️ NO es «sin título ni texto» (la revisión del 18/11): un post sano sin descripción tiene texto vacío y se manda igual, como
 *    siempre; si la IA no lo devuelve, queda con `ANALISIS_SIN_DATOS`. Lo usan los dos caminos que mandan piezas a la IA
 *    (lib/spy.ts `analizarCompetidor`, el automático y el de la API).
 */
export const hayAlgoQueLeer = (p: PiezaParaAnalisis, ahora: Date = new Date()): boolean =>
  p.canal === 'anuncios' || typeof p.texto_leido_en !== 'string' || !textoVencido(p.texto_leido_en, ahora);

/**
 * ¿Le falta el análisis? `null` es «no se leyó»; un objeto, aunque venga vacío, es «ya se leyó»… si trae el formato.
 *
 * ⚠️ LO ANALIZADO ANTES DEL FORMATO SE LEE UNA VEZ MÁS (4/11/2026, «la vista de formatos se llena sola»): sin eso, un
 * competidor ya analizado no llena nunca «¿Qué formatos le funcionan?». Es UNA vez: `guardarAnalisis` escribe siempre un
 * formato (`otro` si la IA no lo vio), y una pieza que la IA no devuelve queda con `ANALISIS_SIN_DATOS`, que también lo trae.
 */
export const faltaAnalisis = (p: PiezaParaAnalisis): boolean =>
  CANALES_ANALIZABLES.has(p.canal) && hayAlgoQueLeer(p) && (!conFormato(p.analisis) || conCatalogoViejo(p.analisis));

/**
 * Las que faltan, en el orden en que se leen: primero las que nunca se leyeron, y entre ellas lo que más vistas tiene (es lo que se va a copiar), y a igual
 * vistas, lo más nuevo. Un contador que el canal no publica va al final, no cuenta como cero.
 */
export function pendientesDeAnalisis<T extends PiezaParaAnalisis>(piezas: readonly T[], tope = PIEZAS_POR_ANALISIS): T[] {
  return piezas
    .filter((p) => faltaAnalisis(p))
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
export const cuantasFaltan = (piezas: readonly PiezaParaAnalisis[]): number => piezas.filter((p) => faltaAnalisis(p)).length;

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
 * Qué se escribe en las piezas que se MANDARON y la IA no devolvió. Son dos casos y piden dos escrituras:
 *  · `sinDatos`: nunca tuvieron análisis → `ANALISIS_SIN_DATOS` (con `.is('analisis', null)`, como siempre).
 *  · `yaRevisadas`: tenían un análisis viejo (sin formato, o del catálogo de once) y se mandaron para releerlo. Que la
 *    IA no las devuelva quiere decir que lo de antes queda: se escribe ESE análisis con `formatosV` al día.
 *
 * ⚠️ El segundo caso era el agujero del pendiente T12 (17/11/2026): el guardado sólo escribía lo que estaba en `null`,
 * así que una pieza vieja que la IA no devolvía quedaba sin `formatosV`, `faltaAnalisis` la seguía pidiendo, iba
 * primera en cada tanda y se pagaba cada vez que alguien abría la ficha.
 */
/**
 * El filtro (PostgREST `or`) de la escritura de `yaRevisadas`: sólo si la fila todavía NO tiene el catálogo de hoy. Es el
 * compare-and-set contra otra tanda que la clasificó en el medio, y no es `formatosV is null` (la revisión del 18/11): el día
 * que `VERSION_FORMATOS` suba, una pieza con la versión anterior que la IA no devuelve no se cerraría nunca.
 */
export const FILTRO_SIN_LA_VERSION_DE_HOY = `analisis->>formatosV.is.null,analisis->>formatosV.neq.${VERSION_FORMATOS}`;

export function cierreDeLasQueNoVolvieron(
  enviadas: readonly PiezaParaAnalisis[],
  devueltas: readonly string[],
): { sinDatos: string[]; yaRevisadas: Array<{ ref: string; analisis: Record<string, unknown> }> } {
  const faltan = new Set(refsSinRespuesta(enviadas.map((p) => p.ref), devueltas));
  const sinDatos: string[] = [];
  const yaRevisadas: Array<{ ref: string; analisis: Record<string, unknown> }> = [];
  for (const p of enviadas) {
    if (!faltan.has(p.ref)) continue;
    // Un objeto sin `formato` es lo analizado ANTES del 4/11: tampoco está en `null`, y por la misma razón queda pidiendo
    // lectura si no se cierra acá. Queda en `otro`, que es lo que la pantalla ya le mostraba.
    const a = p.analisis;
    if (a && typeof a === 'object' && !Array.isArray(a)) {
      const antes = a as Record<string, unknown>;
      yaRevisadas.push({ ref: p.ref, analisis: { ...antes, formato: typeof antes.formato === 'string' ? antes.formato : 'otro', formatosV: VERSION_FORMATOS } });
    } else sinDatos.push(p.ref);
  }
  return { sinDatos, yaRevisadas };
}

/**
 * La oferta que se guarda. Una tanda que no dice qué promete (la IA vio sólo reels de una charla) no BORRA la que
 * ya estaba: la pisa sólo una que trae algo.
 */
export function ofertaQueQueda<O extends { promete: string }>(nueva: O, anterior: O | null): O | null {
  return nueva.promete.trim() ? nueva : anterior;
}
