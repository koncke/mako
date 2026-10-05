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
  /**
   * El EMBUDO al que entran los leads de ESTA pagina — o sea, el PRODUCTO que
   * vende. `undefined` = no asignado, y entonces el lead cae donde cae hoy: el
   * embudo del negocio (`leads.funnel_id = null`).
   *
   * ⚠️ POR QUE CUELGA DE LA URL Y NO DEL TOKEN. El token es UNO por workspace y
   * es determinista —`tokenDeterminista(ws)` es un HMAC de `landing:<ws>` y se
   * guarda en el unico setting `landing_token` (lib/landing-token.ts)—, asi que
   * colgar el producto de el seria decir «todas mis landings venden lo mismo»:
   * no hay un segundo token que asignar. La pagina si distingue, y esta tabla ya
   * existe POR PAGINA por la misma razon que `clarityProjectId` (ver la cabecera).
   *
   * ⚠️ NO es la fuente de verdad de que el embudo exista: el numero se guarda
   * tal cual y quien lo USA lo valida contra los embudos vivos del workspace. Un
   * embudo archivado o borrado tiene que caer al del negocio, no romper el alta
   * con una violacion de clave ajena.
   *
   * ⚠️ Y puede llegar como STRING: `funnels.id` es `bigint`, y en este repo ya
   * se midio que segun el driver eso vuelve como texto. Se sanea al parsear.
   */
  funnelId?: number;
};

export const CONFIG_KEY = 'landing.config';
export const MAX_LANDINGS = 12;

const limpio = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v : '').trim().slice(0, max);

/** Un id de fila: entero positivo, venga como numero o como texto (bigint). */
const idFila = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

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
    const fid = typeof x === 'object' && x ? idFila((x as Record<string, unknown>).funnelId) : undefined;
    out.push({ url, ...(pid ? { clarityProjectId: pid } : {}), ...(fid ? { funnelId: fid } : {}) });
  }
  return out.slice(0, MAX_LANDINGS);
}

/**
 * A que embudo entran los leads de esta pagina. `null` = no se asigno ninguno.
 *
 * Es la parte que se puede equivocar —comparar dos URLs que son la misma con
 * distinta barra final— y por eso vive aca, sin `server-only` y con test. Quien
 * la llama todavia tiene que validar que ese embudo exista y este activo.
 */
export function funnelIdDeLanding(configs: LandingConfig[], url: string | null | undefined): number | null {
  return landingDe(configs, url)?.funnelId ?? null;
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
 * pregunta. Lo mismo vale para `funnelId`, y ahi lo que borra es un `0`.
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
  // Misma regla que `clarityProjectId`: `undefined` es «no lo toques». Lo que
  // BORRA la asignacion es un `0` explicito — corregirle la URL a una landing no
  // puede desasignarle el producto, que es la trampa de un mapper que reconstruye
  // la fila campo por campo.
  const fid = parcial.funnelId !== undefined
    ? idFila(parcial.funnelId)
    : base?.funnelId;
  const fila: LandingConfig = {
    url: nueva,
    ...(pid ? { clarityProjectId: pid } : {}),
    ...(fid ? { funnelId: fid } : {}),
  };
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
