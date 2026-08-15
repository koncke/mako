// =============================================================================
// landing-config — la configuración ES POR LANDING, no por workspace
// =============================================================================
// El modelo viejo guardaba todo a nivel workspace: un `landing.snippet_version`,
// un `CLARITY_PROJECT_ID`, un semáforo. Y eso funciona exactamente mientras el
// cliente tenga UNA página.
//
// Con dos, todo lo que la pantalla afirma pasa a ser mentira la mitad de las
// veces: el código puede estar al día en la de ventas y viejo en la de webinar, y
// le decimos lo mismo de las dos; Clarity puede estar conectado en una y no en la
// otra, y le ofrecemos el mismo botón. El dueño lo dijo con estas palabras: «tal
// vez en una landing aún no pegue el token y el ID de Clarity y en otra sí».
//
// Así que la landing deja de ser un string en una lista y pasa a ser la ENTIDAD
// que lleva su propio estado. Lo que se elige en el paso 1 gobierna todo lo que
// viene después — incluido el código que se copia, porque el bloque de Clarity
// lleva el id de ESE proyecto.
//
// ⚠️ Sin `server-only`: lo que se puede equivocar es el saneo y la MIGRACIÓN del
// formato viejo, y tiene que poder testearse sin base de datos.
// =============================================================================

import { normalizarUrl } from './landing-paginas';

/** Una landing del cliente, con lo que le pertenece solo a ella. */
export type LandingConfig = {
  /** URL normalizada. Es la identidad: no puede haber dos con la misma. */
  url: string;
  /**
   * El proyecto de Clarity de ESTA página.
   *
   * Va acá y no en las credenciales del workspace porque un proyecto de Clarity
   * es de un sitio: con dos landings son dos proyectos, y guardarlo por
   * workspace hacía que la segunda escribiera en el proyecto de la primera —
   * mezclando las grabaciones de dos negocios distintos en un mismo panel.
   */
  clarityProjectId?: string;
};

export const CONFIG_KEY = 'landing.config';
export const MAX_LANDINGS = 12;

const limpio = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, max);

/**
 * Lee la configuración, y MIGRA el formato viejo sin perder nada.
 *
 * ⚠️ Acepta las dos formas a propósito: `["https://a.com"]` (la lista de strings
 * que se guardó hasta hoy) y `[{url, clarityProjectId}]`. Una migración que exija
 * convertir la base primero es una migración que deja a alguien sin sus páginas
 * el día que se despliega — y acá el costo de tolerar las dos formas es una
 * línea.
 */
export function parsearConfig(crudo: string | null): LandingConfig[] {
  if (!crudo?.trim()) return [];
  let lista: unknown;
  try { lista = JSON.parse(crudo); } catch { return []; }
  if (!Array.isArray(lista)) return [];
  const out: LandingConfig[] = [];
  for (const x of lista) {
    // Formato viejo: un string suelto.
    const url = normalizarUrl(typeof x === 'string' ? x : limpio((x as Record<string, unknown>)?.url, 500));
    if (!url || out.some((c) => c.url === url)) continue;
    const pid = typeof x === 'object' && x
      ? limpio((x as Record<string, unknown>).clarityProjectId, 40).toLowerCase()
      : '';
    out.push(pid ? { url, clarityProjectId: pid } : { url });
  }
  return out.slice(0, MAX_LANDINGS);
}

/** La landing elegida, o null. Compara normalizado en las dos puntas. */
export function landingDe(configs: LandingConfig[], url: string | null | undefined): LandingConfig | null {
  const u = url ? normalizarUrl(url) : null;
  return u ? configs.find((c) => c.url === u) ?? null : null;
}

/**
 * Agrega o actualiza una landing. `parcial` solo pisa lo que trae.
 *
 * ⚠️ `clarityProjectId: undefined` significa «no lo toques», no «bórralo». Es la
 * misma regla que ya mordió con `esVsl` en los videos: guardar la URL corregida
 * de una landing no puede desconectarle Clarity, porque renombrar no contesta esa
 * pregunta.
 */
export function conLanding(
  actuales: LandingConfig[],
  url: string,
  parcial: Partial<Omit<LandingConfig, 'url'>> = {},
  anterior?: string | null,
): LandingConfig[] | null {
  const nueva = normalizarUrl(url);
  if (!nueva) return null;
  const prev = anterior ? normalizarUrl(anterior) : null;
  const base = actuales.find((c) => c.url === (prev ?? nueva));
  const pid = parcial.clarityProjectId !== undefined
    ? limpio(parcial.clarityProjectId, 40).toLowerCase()
    : base?.clarityProjectId ?? '';
  const fila: LandingConfig = pid ? { url: nueva, clarityProjectId: pid } : { url: nueva };
  // Se conserva la POSICIÓN al editar: en un desplegable, que un renglón salte al
  // final porque le corregiste una letra es desconcertante.
  const lista = base
    ? actuales.map((c) => (c.url === (prev ?? nueva) ? fila : c))
    : [...actuales, fila];
  const sinRepetir: LandingConfig[] = [];
  for (const c of lista) if (!sinRepetir.some((x) => x.url === c.url)) sinRepetir.push(c);
  return sinRepetir.slice(0, MAX_LANDINGS);
}

export function sinLanding(actuales: LandingConfig[], url: string): LandingConfig[] {
  const u = normalizarUrl(url);
  return u ? actuales.filter((c) => c.url !== u) : actuales;
}

/** Las URLs, para lo que todavía razona con la lista vieja. */
export const urlsDe = (configs: LandingConfig[]): string[] => configs.map((c) => c.url);
