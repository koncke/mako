// =============================================================================
// instagram-buscar-apify-reglas — lo PURO de la búsqueda por nombre (3/11/2026)
// =============================================================================
// Está separado de `lib/instagram-buscar-apify.ts` porque ése importa `server-only` y un test no
// puede importarlo. Acá vive lo que se puede EJECUTAR: el costo y cómo se lee la respuesta.
//
// Es el mismo corte que `spy-compartido` / `spy-compartido-db`: la regla se prueba, el acceso no.
// =============================================================================

/** El actor que SÍ busca. El otro (`instagram-profile-scraper`) sólo lee por @ exacto. */
export const APIFY_ACTOR_BUSQUEDA = 'apify~instagram-scraper';
/** Cuántos candidatos se piden. Es una lista para elegir, no un listado para scrollear. */
export const RESULTADOS_POR_BUSQUEDA = 8;
/** US$ por cada 1.000 resultados, leído de la tienda de Apify el 3/11/2026. */
export const USD_POR_MIL = 1.5;
/** Lo que sale UNA búsqueda, para poder decirlo sin volver a calcularlo. */
export const USD_POR_BUSQUEDA = (USD_POR_MIL / 1000) * RESULTADOS_POR_BUSQUEDA;

export const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * El @ de una URL de perfil. Vacío si la URL es de otra cosa.
 *
 * ⚠️ `/p/ABC123/` es una PUBLICACIÓN, no un perfil: ofrecerla en la lista sería ofrecer algo que no
 * se puede mirar como competidor.
 */
export function usuarioDeUrl(url: string): string {
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?(?:\?|$)/i.exec(url);
  const u = m ? m[1] : '';
  // Las rutas reservadas de Instagram no son nombres de usuario.
  return ['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts'].includes(u.toLowerCase()) ? '' : u;
}

export type PerfilBuscado = { usuario: string; nombre: string | null; foto: string | null };

/**
 * Lee la respuesta del actor.
 *
 * ⚠️ EL @ TAMBIÉN SALE DE LA URL, Y SIN ESTO LA LISTA QUEDA CASI VACÍA. Medido contra el actor de
 * verdad el 3/11/2026 buscando «leila hormozi»: devolvió **7 candidatos y sólo 1 con `username`**.
 * Los otros 6 venían con `error: 'no_items'` («Empty or private data») porque el actor BUSCA y
 * después intenta scrapear cada perfil, y una cuenta privada o vacía no se deja. Pero el hallazgo
 * del buscador está igual, en `url`. Pedir `username` tiraba 6 de cada 7 resultados que SÍ existen.
 */
export function perfilesDeLaRespuesta(cuerpo: unknown, tope = RESULTADOS_POR_BUSQUEDA): PerfilBuscado[] {
  if (!Array.isArray(cuerpo)) return [];
  const vistos = new Set<string>();
  const out: PerfilBuscado[] = [];
  for (const it of cuerpo) {
    const o = (it ?? {}) as Record<string, unknown>;
    const usuario = (str(o.username) || usuarioDeUrl(str(o.url) || str(o.inputUrl))).toLowerCase();
    if (!usuario || vistos.has(usuario)) continue;
    vistos.add(usuario);
    out.push({
      usuario,
      nombre: str(o.fullName) || str(o.name) || null,
      // ⚠️ La foto es una URL del CDN de Meta que VENCE: sirve para la lista y NO se guarda.
      foto: str(o.profilePicUrl) || str(o.profilePicUrlHD) || null,
    });
    if (out.length >= tope) break;
  }
  return out;
}
