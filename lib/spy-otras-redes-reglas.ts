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

// ── ¿Es de la misma persona? (4/11/2026) ─────────────────────────────────────
// Martín, 4/11: «Lo de "Buscar sus otras redes" debe ser automático, no un botón, de última que te muestre opciones y
// te pregunte si es ese o no... me gustaría que pase una IA o un proceso donde pueda tener un POCO de criterio para
// darse cuenta si no es... Por la foto, o que razone».
//
// El criterio son TRES pruebas, de la más fuerte a la más floja, y sólo la primera alcanza sola:
//   1. Se ENLAZAN: el canal de YouTube nombra su Instagram, la bio de Instagram nombra su canal, o los dos llevan a su
//      mismo sitio. Eso lo escribió la persona: no es un parecido, es su firma.
//   2. La MISMA FOTO: su cara de perfil y la del candidato, comparadas con un hash perceptual (dHash de 64 bits). Una
//      foto igual con el mismo nombre ya es ella.
//   3. El MISMO NOMBRE: con «Sofia Contreras» hubo cinco Instagram distintos. Solo, nunca alcanza: se pregunta.
// Con 1, o con 2 y 3 juntas, se agrega SOLO y se puede deshacer. Con una sola de 2 o 3, se pregunta. Sin ninguna, el
// candidato no se muestra: es otra persona.

export type Evidencia = {
  /** El candidato y el competidor se nombran entre ellos (su @, su canal o su sitio). */
  enlaza: boolean;
  /** El nombre del candidato y el del competidor son el mismo, sin tildes ni mayúsculas. */
  mismoNombre: boolean;
  /** Bits distintos entre las dos fotos (0 = iguales, 64 = nada que ver). null = no hubo con qué comparar. */
  distanciaFoto: number | null;
};
export type Veredicto = 'es' | 'quizas' | 'no';

/** Hasta cuántos bits de 64 dos fotos se consideran la misma (recortada, comprimida, otro tamaño). */
export const MISMA_FOTO_HASTA = 10;

export function veredictoDe(e: Evidencia): Veredicto {
  const mismaFoto = e.distanciaFoto != null && e.distanciaFoto <= MISMA_FOTO_HASTA;
  if (e.enlaza || (mismaFoto && e.mismoNombre)) return 'es';
  if (mismaFoto || e.mismoNombre) return 'quizas';
  return 'no';
}

/** Por qué se dice que puede ser ella, cuando no se enlazan (el enlace lo describe quien sabe quién nombra a quién). */
export function porqueDe(e: Evidencia): string {
  const mismaFoto = e.distanciaFoto != null && e.distanciaFoto <= MISMA_FOTO_HASTA;
  if (e.enlaza) return 'Se enlazan entre ellos';
  if (mismaFoto && e.mismoNombre) return 'Misma foto y mismo nombre';
  if (mismaFoto) return 'Misma foto';
  return 'Mismo nombre';
}

/**
 * La segunda vuelta, por su @ («va buscando hasta encontrar»): si el nombre no trajo una red segura, su @ de Instagram (o
 * su @ de YouTube) suele ser el mismo en las otras. Vacía si no hay @ o si es lo mismo que el nombre.
 */
export function consultaPorUsuario(c: { nombre: string; instagram: string | null; youtube_id: string | null }): string {
  const u = str(c.instagram).replace(/^@/, '') || (str(c.youtube_id).startsWith('@') ? str(c.youtube_id).slice(1) : '');
  if (!u || plano(u) === plano(str(c.nombre)).replace(/\s+/g, '')) return '';
  return `"${u}" (site:youtube.com OR site:tiktok.com OR site:instagram.com)`;
}

const plano = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Los dos nombres son el mismo? «Víctor Heras» = «Victor Heras»; «Víctor Heras Media» contiene «Víctor Heras». */
export function nombresParecidos(a: string | null, b: string | null): boolean {
  const x = plano(a ?? '').replace(/[^a-z0-9]+/g, ' ').trim();
  const y = plano(b ?? '').replace(/[^a-z0-9]+/g, ' ').trim();
  if (x.length < 4 || y.length < 4) return false;
  if (x === y) return true;
  const [corto, largo] = x.length <= y.length ? [x, y] : [y, x];
  return corto.includes(' ') && (` ${largo} `).includes(` ${corto} `);
}

/** Lo que identifica a alguien en un texto: su @ de Instagram, su @ o id de YouTube, su TikTok y el dominio de su sitio. */
export type Firma = { instagram?: string | null; youtube?: string | null; tiktok?: string | null; sitio?: string | null };

const dominioDe = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};

/**
 * ¿El texto (una bio, la descripción de un canal, su web) nombra a esta firma? Busca el enlace o el @ entero, nunca un
 * pedazo: «@hera» no es «@herasmedia».
 */
export function nombraA(texto: string | null | undefined, f: Firma): boolean {
  const t = plano(texto ?? '');
  if (!t) return false;
  const borde = (x: string) => new RegExp(`(^|[^a-z0-9._])${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9._])`);
  if (f.instagram && (borde(`instagram.com/${f.instagram.toLowerCase()}`).test(t) || borde(`@${f.instagram.toLowerCase()}`).test(t))) return true;
  if (f.youtube) {
    const y = f.youtube.toLowerCase();
    if (y.startsWith('@') && (borde(`youtube.com/${y}`).test(t) || borde(y).test(t))) return true;
    if (/^uc[a-z0-9_-]{20,}$/.test(y) && t.includes(`youtube.com/channel/${y}`)) return true;
  }
  if (f.tiktok && borde(`tiktok.com/@${f.tiktok.toLowerCase()}`).test(t)) return true;
  const d = dominioDe(f.sitio);
  // Un dominio de red social no es SU sitio: «linktr.ee» o «instagram.com» lo tiene medio mundo.
  if (d && !/(instagram|youtube|tiktok|facebook|linktr|beacons|bio\.link|wa\.me|whatsapp)/.test(d) && borde(d).test(t)) return true;
  return false;
}

// ── El hash de una foto ──────────────────────────────────────────────────────

/**
 * El dHash de 64 bits de una imagen ya reducida a 9×8 en grises (72 bytes, fila por fila): cada bit dice si un píxel
 * es más claro que el de su derecha. Dos fotos iguales a otro tamaño o con otra compresión dan casi el mismo hash; una
 * cara distinta, la mitad de los bits distintos. Se devuelve como 16 caracteres hexadecimales.
 */
export function dHash(grises: ArrayLike<number>): string | null {
  if (grises.length !== 72) return null;
  let bits = '';
  for (let fila = 0; fila < 8; fila += 1) {
    for (let col = 0; col < 8; col += 1) bits += grises[fila * 9 + col] > grises[fila * 9 + col + 1] ? '1' : '0';
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Bits distintos entre dos dHash. null si alguno no está. */
export function distanciaHash(a: string | null, b: string | null): number | null {
  if (!a || !b || a.length !== b.length) return null;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/**
 * Su sitio, sacado de un texto que escribió él (la descripción de su canal, su bio): el primer enlace que NO es una red
 * social ni un acortador. Martín, 4/11: «Si encuentra la web, que la analice automáticamente». Un competidor agregado por
 * su canal de YouTube no tenía sitio aunque lo escribiera en la descripción («viralidad.com»).
 */
export function sitioDelTexto(texto: string | null | undefined): string | null {
  const t = texto ?? '';
  const RED = /(^|\.)(instagram|youtube|youtu|tiktok|facebook|fb|twitter|x|threads|linkedin|whatsapp|wa|t|telegram|spotify|apple|google|bit|tinyurl|linktr|beacons|bio|lnk|hoo|campsite|amzn|amazon|paypal|hotmart|calendly)\.[a-z.]+$/i;
  for (const m of t.matchAll(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(\/[^\s)"'<>]*)?/gi)) {
    const host = m[1].toLowerCase();
    if (RED.test(host) || /\.(png|jpe?g|gif|mp4)$/i.test(host)) continue;
    // Un correo («hola@acme.com») no es un sitio que se pueda abrir: se salta lo que viene pegado a una arroba.
    const antes = t[(m.index ?? 0) - 1];
    if (antes === '@') continue;
    return `https://${host}${(m[2] ?? '').replace(/[.,;:!?]+$/, '')}`;
  }
  return null;
}
