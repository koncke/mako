// =============================================================================
// spy-otras-redes-reglas — con UN dato, encontrar sus OTRAS redes (ítems 10/11 de Spy, 3/11/2026)
// =============================================================================
// Martín: «con un dato, traer todas sus redes», y que se VALIDEN («¿este es el YouTube de esta
// persona?»). Ésta es la mitad PURA —leer lo que devolvió el buscador—, separada de la red para que
// los tests la ejecuten. La red vive en `./spy-otras-redes.ts`.
//
// ⚠️ LO QUE DEVUELVE ESTO SON CANDIDATOS, NUNCA DATOS. Resolver a una persona por búsqueda ya nos
// trajo a OTRA con los gurús, y se vio de nuevo al medir: buscando «Sofia Contreras» Google devolvió
// CINCO Instagram distintos con ese nombre. Por eso nada de acá se guarda: la pantalla pregunta y
// sólo el «sí» de la persona escribe (con `sumarCanalAction`, lo mismo que pegarlo a mano).
//
// EL ACTOR, ELEGIDO Y MEDIDO (3/11/2026, `scripts/probar-otras-redes-apify.mjs`):
// `apify~google-search-scraper`. UNA página de Google con `site:` trae las tres redes juntas en una
// sola corrida —con «Leila Hormozi» vinieron su YouTube, su TikTok y su Instagram en la misma
// página—. Cobra por evento: **US$0,0045 la página + US$0,00005 el arranque = US$0,00455 por
// búsqueda.** Con el tope de abajo, el peor día de un negocio es US$0,09.
//
// ⚠️ DOS TRAMPAS DEL ACTOR, medidas:
//   · exige `maxTotalChargeUsd` ≥ US$0,50 por corrida (con 0,02, como los de Instagram, contesta 400
//     `max-total-charge-usd-below-minimum`). Es un TECHO, no lo que cobra.
//   · el costo de la corrida leído a los 4 s sale US$0,00005: el evento de la página todavía no
//     figura. Asentado, US$0,00455. Medirlo apurado da un número 100 veces más bajo.
// =============================================================================

export const APIFY_ACTOR_REDES = 'apify~google-search-scraper';
/** Lo cobrado por búsqueda, medido en dos corridas reales el 3/11/2026. */
export const USD_POR_BUSQUEDA_REDES = 0.0045 + 0.00005;
/** El mínimo que acepta el actor como techo de una corrida. Con menos contesta 400. */
export const TECHO_USD_POR_CORRIDA_REDES = 0.5;
/**
 * Búsquedas de redes por negocio y por día. Se dispara UNA al dar de alta y otra si la persona toca
 * «Buscar sus otras redes»: 20 alcanza para el tope de 25 competidores en dos días.
 */
export const TOPE_BUSQUEDAS_REDES_POR_DIA = 20;
/** Cuántos candidatos por red se ofrecen: más de tres es pedirle a la persona que investigue. */
export const CANDIDATOS_POR_RED = 3;

export type RedOtra = 'youtube' | 'tiktok' | 'instagram';
export type CandidatoRed = { red: RedOtra; ref: string; url: string; titulo: string };
/** Lo que ya tiene el competidor: de esas redes no se ofrece nada. */
export type RedesQueYaTiene = { instagram: string | null; youtube_id: string | null; tiktok: string | null };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const RESERVADAS_IG = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct']);

/**
 * La red y el perfil que nombra un link de Google. `null` si el link no es un PERFIL.
 *
 * ⚠️ Google devuelve muchos VIDEOS sueltos (`/watch`, `/shorts`, `/playlist`, `/p/…`): son de la
 * persona, pero no son la persona. Y una subpágina de un perfil (`/@x/videos`, `/x/reels/`) sí es
 * el perfil.
 * ⚠️ `/c/<alias>` de YouTube queda AFUERA aunque sea su canal: ningún endpoint lo resuelve
 * (`canalDeUrl`, lib/spy-youtube.ts) y convertirlo en `@alias` sería adivinar — y un `@` adivinado
 * puede ser el canal de otro, que es justo lo que la validación existe para evitar.
 */
export function redDeUrl(crudo: string): Omit<CandidatoRed, 'titulo'> | null {
  let u: URL;
  try { u = new URL(str(crudo)); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const [a, b] = u.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com') {
    if (a?.startsWith('@') && /^@[A-Za-z0-9._-]{3,30}$/.test(a)) return { red: 'youtube', ref: a, url: `https://www.youtube.com/${a}` };
    if (a === 'channel' && b && /^UC[A-Za-z0-9_-]{20,}$/.test(b)) return { red: 'youtube', ref: b, url: `https://www.youtube.com/channel/${b}` };
    if (a === 'user' && b && /^[A-Za-z0-9._-]{2,40}$/.test(b)) return { red: 'youtube', ref: `user:${b}`, url: `https://www.youtube.com/user/${b}` };
    return null;
  }
  if (host === 'tiktok.com') {
    const m = /^@([A-Za-z0-9._]{2,30})$/.exec(a ?? '');
    return m ? { red: 'tiktok', ref: m[1].toLowerCase(), url: `https://www.tiktok.com/@${m[1].toLowerCase()}` } : null;
  }
  if (host === 'instagram.com') {
    if (!a || !/^[A-Za-z0-9._]{2,30}$/.test(a) || RESERVADAS_IG.has(a.toLowerCase())) return null;
    return { red: 'instagram', ref: a.toLowerCase(), url: `https://www.instagram.com/${a.toLowerCase()}/` };
  }
  return null;
}

/**
 * Lo que se le pregunta a Google: el nombre entre comillas, sólo en las tres redes.
 *
 * Con el nombre de verdad y no el @: el alta ya guarda el nombre que devuelve Instagram, y el @ de
 * una red casi nunca es el de las otras. Si sólo hay un @ (o un id de canal), va eso.
 */
export function consultaDeRedes(c: { nombre: string; instagram: string | null }): string {
  const nombre = str(c.nombre).replace(/["]/g, '');
  const quien = !nombre || /^UC[A-Za-z0-9_-]{20,}$/.test(nombre) ? str(c.instagram).replace(/^@/, '') : nombre;
  if (!quien) return '';
  return `"${quien}" (site:youtube.com OR site:tiktok.com OR site:instagram.com)`;
}

/**
 * Los candidatos de la respuesta del actor, sin las redes que el competidor YA tiene.
 *
 * ⚠️ DE UNA RED QUE YA TIENE NO SE OFRECE NADA, ni siquiera «otro» perfil: el que está es el que el
 * negocio eligió, y los demás con su nombre son otras personas (los cinco «Sofia Contreras»).
 */
export function candidatosDeLaRespuesta(cuerpo: unknown, ya: RedesQueYaTiene): CandidatoRed[] {
  const paginas = Array.isArray(cuerpo) ? cuerpo : [];
  const organicos = paginas.flatMap((p) => (p && typeof p === 'object' && Array.isArray((p as { organicResults?: unknown }).organicResults)
    ? (p as { organicResults: unknown[] }).organicResults : []));
  const tiene: Record<RedOtra, boolean> = { instagram: !!ya.instagram, youtube: !!ya.youtube_id, tiktok: !!ya.tiktok };
  const vistos = new Set<string>();
  const porRed: Record<RedOtra, number> = { instagram: 0, youtube: 0, tiktok: 0 };
  const salida: CandidatoRed[] = [];
  for (const o of organicos) {
    const r = o && typeof o === 'object' ? redDeUrl(str((o as { url?: unknown }).url)) : null;
    if (!r || tiene[r.red] || porRed[r.red] >= CANDIDATOS_POR_RED) continue;
    const clave = `${r.red}|${r.ref.toLowerCase()}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    porRed[r.red] += 1;
    salida.push({ ...r, titulo: str((o as { title?: unknown }).title).slice(0, 140) });
  }
  return salida;
}
