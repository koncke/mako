// =============================================================================
// ganadores-reuso — qué anuncios se ofrecen para reusar, y en qué orden
// =============================================================================
// Puro (sin server-only): lo usan los TRES modales que ofrecen «★ Usar un ganador»
// (NuevaCampanaModal, AgregarConjuntoModal, AgregarAnuncioModal) y se prueba.
//
// ⚠️ LOS QUE SE PUEDEN USAR VAN PRIMERO, aunque hayan traído menos leads. Medido el
// 2026-09-16 en Código Inmobiliario (ws13): de 35 anuncios activos, los 10 que más
// gastaron son de OTRA página de Facebook (770269612845316), donde la conexión no es
// anunciante y Meta rechaza con 1885499. Ordenando sólo por leads y gasto, el top 12
// salía casi entero apagado y los anuncios de la página PROPIA —los únicos que ese
// cliente podía publicar— quedaban al fondo o afuera del corte.
//
// ⚠️ Y ese día reusar era la ÚNICA forma de publicar de ese cliente: su token viene de
// una app de Meta en modo de desarrollo, que bloquea todo creativo NUEVO (1885183).
// Medido en seco con validate_only sobre /ads, con control: un post nuevo da 1885183;
// un creativo que apunta a un post propio existente y el mismo creativo de un anuncio
// existente PASAN. O sea que este orden no es cosmético: decide si hay salida.
//
// ⚠️ Antes sólo NuevaCampanaModal apagaba los de otra página; los otros dos modales los
// ofrecían como elegibles y el cliente se enteraba al publicar. Por eso la consulta y
// el orden viven acá, una vez, y el hook `useGanadoresBloqueados` la hace para los tres.
// =============================================================================

export const MAX_GANADORES = 12;
/** Cuántos se le preguntan a Meta de una vez (kind=ganadores). */
export const MAX_CONSULTA = 50;

export const MOTIVO_OTRA_PAGINA = 'Es de otra página de Facebook: tu conexión de Meta no es anunciante en ella.';

type Senal = { ad_id: string; ad_thumbnail_url: string | null; leads: number; spend_usd: number };
export type Bloqueados = Record<string, string>;

const porRendimiento = (a: Senal, b: Senal) => b.leads - a.leads || b.spend_usd - a.spend_usd;

/**
 * Los ganadores que se muestran: con creativo visible, los USABLES primero y, dentro de
 * cada grupo, por leads y gasto. `bloqueados` null = todavía no se preguntó a Meta: se
 * ordena sólo por rendimiento (no poder preguntar no apaga a nadie).
 */
export function ganadoresParaReusar<T extends Senal>(senales: T[], bloqueados: Bloqueados | null): T[] {
  const b = bloqueados ?? {};
  return senales
    .filter((s) => s.ad_thumbnail_url)
    .sort((x, y) => Number(!!b[x.ad_id]) - Number(!!b[y.ad_id]) || porRendimiento(x, y))
    .slice(0, MAX_GANADORES);
}

/**
 * Los ids que se le preguntan a Meta: los MEJORES primero. Antes se cortaba sin ordenar,
 * así que con más de 50 anuncios los más fuertes podían quedar sin chequear.
 */
export function idsAConsultar<T extends Senal>(senales: T[]): string[] {
  return senales.filter((s) => s.ad_thumbnail_url).sort(porRendimiento).slice(0, MAX_CONSULTA).map((s) => s.ad_id);
}

/** La respuesta de kind=ganadores → motivo por anuncio apagado. */
export function bloqueadosDe(ganadores: Record<string, { puede: boolean }> | null | undefined): Bloqueados {
  const m: Bloqueados = {};
  for (const [id, g] of Object.entries(ganadores ?? {})) if (g && !g.puede) m[id] = MOTIVO_OTRA_PAGINA;
  return m;
}
