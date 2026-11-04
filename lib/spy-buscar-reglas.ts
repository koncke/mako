// =============================================================================
// spy-buscar-reglas — lo PURO de la búsqueda de Spy por red (4/11/2026)
// =============================================================================
// Martín, 4/11: «La barra principal de búsqueda debería funcionar igual que cuando le doy al "+", solo que ahí
// debería estar diferenciado las redes, Instagram, YouTube, Sitio Web...», «si busco solo el nombre TAMBIÉN
// debería buscar en YouTube», «no me trajo ni 1 solo de las cuentas grandes de victor heras», «cuando busco por
// link de instagram, también debería salir automáticamente como si lo hubiese puesto el @ exacto», y «si busco el
// @ exacto, pero me olvidé de poner el @, debería buscarlo también».
//
// Sin `server-only`: lo usan la pantalla (app/competitor-spy/BuscadorAlta.tsx), la ruta
// (app/api/competitor-spy/buscar) y los tests, que lo EJECUTAN.
//
// ⚠️ EL DIAGNÓSTICO OBVIO DEL PUNTO 3 ERA EL EQUIVOCADO. «El buscador de Apify trae cuentas chicas» lleva a
// buscar otro actor de Apify que busque mejor. Pero el buscador de Instagram ordena por RELEVANCIA (quién te
// sigue, quién es grande, a quién buscó otra gente), y un scraper sin sesión no tiene nada de eso: sólo puede
// emparejar texto, y «Víctor Heras» empareja igual con @victor.heras.167 (14 seguidores) que con
// @victorherasemprendedor (492 mil). Lo que sí ordena por popularidad sin sesión es GOOGLE: un perfil con
// 492 mil seguidores tiene enlaces apuntándole y uno de 14 no. Y Google trae el número de seguidores en la
// descripción del resultado («492K Followers, 503 Following…»), así que se puede ordenar sin leer cada perfil.
// Por eso el nombre se busca en Google (`site:instagram.com` y `site:youtube.com`, una corrida) y ADEMÁS en el
// buscador de Instagram, y la lista se ordena por seguidores.
// =============================================================================

import { nombreYUsuarioDeTitulo, usuarioDeTexto, usuarioDeUrlInstagram, usuariosCandidatos, MIN_LETRAS } from './instagram-buscar';
import { canalDeUrl } from './spy-youtube';
import { redDeUrl } from './spy-otras-redes-reglas';

// ── Qué se busca con lo escrito ──────────────────────────────────────────────

/**
 * Lo que se le pide a cada red por lo escrito. Cada campo es UN pedido (una ruta, un costo):
 *   · `instagramExacto` — leer ese @ (Apify por @, ~5-10 s). Con @, sin @, o de un enlace de su perfil.
 *   · `nombre`          — buscarlo por nombre en Google (Instagram y YouTube juntos) y en el buscador de Instagram.
 *   · `youtubeExacto`   — leer ese canal (1 unidad de la Data API, menos de un segundo).
 *   · `sitio` / `tiktok` — se ofrecen como fila, sin buscar nada.
 */
export type PlanDeBusqueda = {
  instagramExacto: string | null;
  /**
   * El @ que va PRIMERO en la lista: el que la persona escribió (con @, sin @ o en un enlace). El que sale de pegar
   * un nombre («Víctor Heras» → @victorheras) NO: es una suposición, y con Víctor Heras era la cuenta chica que
   * Martín no quería arriba. Ésa compite por seguidores con las demás.
   */
  fijar: string | null;
  nombre: string | null;
  youtubeExacto: string | null;
  sitio: string | null;
  tiktok: string | null;
  /**
   * «acme.com» puede ser el @ de alguien, pero casi siempre es un sitio: se ofrece «Usar @acme.com» tal cual,
   * SIN leerlo (cada lectura cuesta y gasta del tope del día).
   */
  tambienUsuario: string | null;
  /** Un enlace que no se puede resolver (un /c/ de YouTube, un post de Instagram): se dice, no se adivina. */
  noReconocido: 'youtube-c' | 'instagram-post' | null;
};

const VACIO: PlanDeBusqueda = { instagramExacto: null, fijar: null, nombre: null, youtubeExacto: null, sitio: null, tiktok: null, tambienUsuario: null, noReconocido: null };

/**
 * Los dominios de primer nivel que convierten «algo.xx» en un SITIO. Es una lista y no «cualquier cosa con punto»
 * porque «den.borgg» es un @ de Instagram que se escribió sin la arroba (Martín, 4/11: «busqué @den.borgg exacto…
 * si me olvidé de poner el @, debería buscarlo también»). Con la regla vieja era la página https://den.borgg.
 * Un dominio real (acme.com) sigue siendo las dos cosas: el sitio, y el @ por si es de alguien.
 */
const TLD = new Set([
  'com', 'net', 'org', 'io', 'co', 'ai', 'app', 'dev', 'me', 'info', 'biz', 'us', 'uk', 'es', 'mx', 'ar', 'cl', 'pe',
  'uy', 'py', 'bo', 'ec', 've', 'br', 'pt', 'it', 'fr', 'de', 'ca', 'au', 'store', 'shop', 'online', 'site', 'xyz',
  'academy', 'digital', 'agency', 'club', 'live', 'pro', 'tv', 'fm', 'link', 'page', 'blog', 'tech', 'studio',
  'school', 'education', 'courses', 'coach', 'life', 'world', 'today', 'top', 'vip', 'one', 'io', 'gg', 'so', 'to',
  'cr', 'gt', 'hn', 'ni', 'pa', 'sv', 'do', 'pr', 'cu', 'eu', 'global', 'network', 'media', 'marketing', 'com.mx',
]);

/** ¿«algo.xx» (sin protocolo ni espacios) es un sitio? Mira el ÚLTIMO tramo, y «.com.mx» también. */
export function esDominio(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/\/.*$/, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t)) return false;
  const partes = t.split('.');
  return TLD.has(partes[partes.length - 1]);
}

const conProtocolo = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

/** El @ de un enlace a un PERFIL de Instagram, con o sin https y con o sin `?igsh=`. Un post o un reel no es un perfil. */
function instagramDeEnlace(s: string): { usuario: string } | { post: true } | null {
  if (!/(^|\/\/|\.)instagram\.com\//i.test(s) && !/^(www\.)?instagram\.com\//i.test(s) && !/^instagr\.am\//i.test(s)) return null;
  const url = conProtocolo(s.replace(/^instagr\.am\//i, 'instagram.com/'));
  const u = usuarioDeUrlInstagram(url);
  if (u) return { usuario: u };
  return /\/(p|reel|reels|tv)\//i.test(url) ? { post: true } : null;
}

/**
 * Qué buscar con lo escrito. UNA función para la pantalla y para la ruta: si cada una decidiera por su cuenta, la
 * pantalla podría ofrecer un sitio y la ruta buscar un @.
 */
export function planDeBusqueda(texto: string): PlanDeBusqueda {
  const t = (texto ?? '').trim();
  if (!t) return VACIO;

  // 1. Un enlace de Instagram: su @ exacto, como si lo hubiera escrito (punto 4).
  const ig = instagramDeEnlace(t);
  if (ig) return 'usuario' in ig ? { ...VACIO, instagramExacto: ig.usuario, fijar: ig.usuario } : { ...VACIO, noReconocido: 'instagram-post' };

  // 2. Un enlace de YouTube: ese canal, leído con su foto.
  if (/(^|\/\/|\.)youtube\.com|youtu\.be/i.test(t)) {
    const c = canalDeUrl(t);
    if (c && 'id' in c) return { ...VACIO, youtubeExacto: c.id };
    if (c && 'handle' in c) return { ...VACIO, youtubeExacto: `@${c.handle}` };
    if (c && 'usuario' in c) return { ...VACIO, youtubeExacto: `user:${c.usuario}` };
    return { ...VACIO, noReconocido: 'youtube-c' };
  }

  // 3. Un TikTok: se ofrece tal cual (no se lee).
  const tt = /tiktok\.com/i.test(t) ? redDeUrl(conProtocolo(t)) : null;
  if (tt?.red === 'tiktok') return { ...VACIO, tiktok: tt.ref };

  // 4. Un enlace cualquiera: su sitio.
  if (/^https?:\/\//i.test(t)) return { ...VACIO, sitio: t.slice(0, 500) };

  // 5. «@algo»: el @ exacto, y nada más. Quien escribe la arroba sabe a quién busca: esperar la búsqueda por
  //    nombre era el tiempo de sobra. Un @ también puede ser su canal de YouTube, y eso cuesta 1 unidad.
  if (t.startsWith('@')) {
    const u = usuarioDeTexto(t);
    if (!u || u.length < 2) return VACIO;
    return { ...VACIO, instagramExacto: u, fijar: u, youtubeExacto: /^[a-z0-9._-]{3,30}$/i.test(u) ? `@${u}` : null };
  }

  // 6. «acme.com»: un sitio de verdad, y también puede ser el @ de alguien.
  if (esDominio(t)) {
    const u = usuarioDeTexto(t);
    return { ...VACIO, sitio: `https://${t}`.slice(0, 500), tambienUsuario: u };
  }

  if (t.replace(/\s+/g, '').length < MIN_LETRAS) return VACIO;

  // 7. Una palabra que puede ser un @ («den.borgg», «herasmedia»): ese @ exacto Y la búsqueda por nombre. Las dos
  //    a la vez: el exacto, si existe, sale primero.
  const u = usuarioDeTexto(t);
  if (u) return { ...VACIO, instagramExacto: u, fijar: u, nombre: t, youtubeExacto: /^[a-z0-9._-]{3,30}$/i.test(u) ? `@${u}` : null };

  // 8. Un nombre: se busca por nombre, y su nombre pegado se prueba como @ («Leila Hormozi» → @leilahormozi), en
  //    Instagram Y en YouTube. ⚠️ Antes sólo en Instagram (Martín, 4/11: «pongo un espacio… solamente me trae
  //    Instagram»): con un nombre, YouTube dependía entero de Google, y Google devuelve videos que se tiraban.
  const pegado = usuariosCandidatos(t)[0] ?? null;
  return { ...VACIO, nombre: t.slice(0, 80), instagramExacto: pegado, youtubeExacto: pegado && /^[a-z0-9._-]{3,30}$/i.test(pegado) ? `@${pegado}` : null };
}

/** ¿Este plan pide algo que tarda? Es lo que decide si se muestran los mensajes de espera. */
export const pideAlgo = (p: PlanDeBusqueda): boolean => !!(p.instagramExacto || p.nombre || p.youtubeExacto);

// ── Lo que se encontró ───────────────────────────────────────────────────────

/** Un perfil de Instagram que se ofrece como fila. `seguidores` null = no se sabe (nunca 0). */
export type PerfilHallado = {
  usuario: string;
  nombre: string | null;
  foto: string | null;
  seguidores: number | null;
  bio?: string | null;
  web?: string | null;
  /** Se intentó completar y no se pudo: no se vuelve a pedir en esta búsqueda. */
  sinLeer?: boolean;
};

/** Un canal de YouTube que se ofrece como fila. `ref` es lo que guarda el alta: `UC…`, `@handle` o `user:x`. */
export type CanalHallado = {
  ref: string;
  nombre: string | null;
  foto: string | null;
  suscriptores: number | null;
  url: string;
};

/**
 * Un contador escrito por Google o por YouTube: «492K», «1.2M», «1,543», «248 mil», «1,2 M», «120 k».
 *
 * ⚠️ El separador decide distinto según haya sufijo: «1,543» (sin sufijo) son mil quinientos; «1,2 M» (con sufijo)
 * es un millón doscientos mil. Sin sufijo los separadores son de miles y se borran; con sufijo es la coma decimal.
 */
export function contadorDeTexto(s: string): number | null {
  const m = /(\d+(?:[.,]\d+)*)\s*(k|mil|m|mill(?:ones)?|mm|b)?\b/i.exec((s ?? '').replace(/ /g, ' '));
  if (!m) return null;
  const sufijo = (m[2] ?? '').toLowerCase();
  const mult = sufijo === 'k' || sufijo === 'mil' ? 1e3 : sufijo === 'm' || sufijo.startsWith('mill') || sufijo === 'mm' ? 1e6 : sufijo === 'b' ? 1e9 : 1;
  const crudo = m[1];
  const n = mult === 1 ? Number(crudo.replace(/[.,]/g, '')) : Number(crudo.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

/** Los seguidores de la descripción de un resultado de Google sobre un perfil de Instagram. */
export function seguidoresDeDescripcion(d: string): number | null {
  const m = /(\d[\d.,]*\s*(?:k|mil|m|mill(?:ones)?|mm|b)?)\s*(?:followers|seguidores)\b/i.exec(d ?? '');
  return m ? contadorDeTexto(m[1]) : null;
}

/** Los suscriptores de la descripción de un resultado de Google sobre un canal de YouTube. */
export function suscriptoresDeDescripcion(d: string): number | null {
  const m = /(\d[\d.,]*\s*(?:k|mil|m|mill(?:ones)?|mm|b)?)\s*(?:subscribers|suscriptores)\b/i.exec(d ?? '');
  return m ? contadorDeTexto(m[1]) : null;
}

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Los resultados orgánicos de una o varias páginas de `apify~google-search-scraper`, con la consulta de cada uno. */
function organicos(cuerpo: unknown): Array<{ url: string; titulo: string; descripcion: string; consulta: string }> {
  const paginas = Array.isArray(cuerpo) ? cuerpo.filter(esObj) : [];
  return paginas.flatMap((p) => {
    const consulta = esObj(p.searchQuery) ? str(p.searchQuery.term) : '';
    const lista = Array.isArray(p.organicResults) ? p.organicResults.filter(esObj) : [];
    return lista.map((o) => ({ url: str(o.url), titulo: str(o.title), descripcion: str(o.description), consulta }));
  });
}

/** Cuántos perfiles y canales salen de Google por red: una lista para elegir, no un directorio. */
export const POR_RED = 8;

/**
 * Los perfiles de Instagram de una respuesta de Google, en el orden de Google, con sus seguidores si la
 * descripción los trae. Sólo PERFILES: un post, un reel o /explore/ no son una persona.
 */
export function perfilesDeGoogle(cuerpo: unknown): PerfilHallado[] {
  const vistos = new Set<string>();
  const out: PerfilHallado[] = [];
  for (const o of organicos(cuerpo)) {
    const usuario = usuarioDeUrlInstagram(o.url);
    if (!usuario || vistos.has(usuario)) continue;
    vistos.add(usuario);
    const t = nombreYUsuarioDeTitulo(o.titulo);
    out.push({ usuario, nombre: t && t.usuario === usuario ? t.nombre : null, foto: null, seguidores: seguidoresDeDescripcion(o.descripcion) });
    if (out.length >= POR_RED) break;
  }
  return out;
}

/** El nombre de un canal en un título de Google: «Víctor Heras Media - YouTube». */
const nombreDeTituloYoutube = (t: string): string | null => t.replace(/\s*[-–—|]\s*YouTube\s*$/i, '').trim() || null;

/**
 * Los canales de YouTube de una respuesta de Google. Un video suelto (`/watch`, `/shorts`) no dice de qué canal es
 * sin leerlo, así que no se ofrece; un `/c/` tampoco (no tiene endpoint, y adivinar su @ puede traer a otro).
 */
export function canalesDeGoogle(cuerpo: unknown): CanalHallado[] {
  const vistos = new Set<string>();
  const out: CanalHallado[] = [];
  for (const o of organicos(cuerpo)) {
    const r = redDeUrl(o.url);
    if (!r || r.red !== 'youtube') continue;
    const clave = r.ref.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ ref: r.ref, url: r.url, nombre: nombreDeTituloYoutube(o.titulo), foto: null, suscriptores: suscriptoresDeDescripcion(o.descripcion) });
    if (out.length >= POR_RED) break;
  }
  return out;
}

/** El id de un VIDEO de YouTube en un enlace (`/watch?v=`, `/shorts/`, `/live/`, `youtu.be/`), o null. */
export function videoDeUrl(crudo: string): string | null {
  let u: URL;
  try { u = new URL(str(crudo)); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const [a, b] = u.pathname.split('/').filter(Boolean);
  const id = host === 'youtu.be' ? a : host === 'youtube.com' ? (a === 'watch' ? u.searchParams.get('v') : a === 'shorts' || a === 'live' || a === 'embed' ? b : null) : null;
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/**
 * Los VIDEOS de YouTube de una respuesta de Google, sin repetir. ⚠️ Es la mayoría de lo que Google devuelve para
 * `site:youtube.com`: antes se tiraban (un video no dice de qué canal es sin leerlo) y una búsqueda por nombre no traía
 * ningún canal. Ahora se leen con `videos.list` (1 unidad por todos) y se ofrece el canal de cada uno.
 */
export function videosDeGoogle(cuerpo: unknown): string[] {
  const vistos = new Set<string>();
  for (const o of organicos(cuerpo)) {
    const id = videoDeUrl(o.url);
    if (id) vistos.add(id);
  }
  return [...vistos].slice(0, 20);
}

/**
 * Las dos consultas a Google por un nombre, en UNA corrida (dos páginas: US$0,009). Con comillas: sin ellas,
 * «Víctor Heras» trae a cualquiera que se llame Víctor.
 */
export function consultasDeNombre(nombre: string): string {
  const n = (nombre ?? '').replace(/["\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return '';
  return [`"${n}" site:instagram.com`, `"${n}" site:youtube.com`].join('\n');
}

// ── Juntar y ordenar ─────────────────────────────────────────────────────────

/**
 * Una lista de perfiles sin repetidos: lo que dijo cada fuente se completa con lo de las otras (el exacto trae la foto,
 * Google trae los seguidores, el buscador de Instagram trae a los que Google no conoce).
 */
export function juntarPerfiles(...listas: ReadonlyArray<readonly PerfilHallado[]>): PerfilHallado[] {
  const out = new Map<string, PerfilHallado>();
  for (const p of listas.flat()) {
    const ya = out.get(p.usuario);
    if (!ya) { out.set(p.usuario, { ...p }); continue; }
    out.set(p.usuario, {
      usuario: ya.usuario,
      nombre: ya.nombre ?? p.nombre,
      foto: ya.foto ?? p.foto,
      seguidores: ya.seguidores ?? p.seguidores,
      bio: ya.bio ?? p.bio,
      web: ya.web ?? p.web,
    });
  }
  return [...out.values()];
}

/**
 * El orden de la lista de Instagram: primero el @ que se escribió (si existe), después por seguidores de mayor a
 * menor, y los que no se sabe cuántos tienen al final, en el orden en que llegaron.
 *
 * ⚠️ «Sin dato» NO es «cero»: no se los manda al final por chicos sino porque no hay con qué compararlos. Cuando se
 * completen, suben solos.
 */
export function ordenarPerfiles(perfiles: readonly PerfilHallado[], exacto: string | null): PerfilHallado[] {
  const idx = new Map(perfiles.map((p, i) => [p.usuario, i] as const));
  return [...perfiles].sort((a, b) => {
    if (exacto) {
      if (a.usuario === exacto && b.usuario !== exacto) return -1;
      if (b.usuario === exacto && a.usuario !== exacto) return 1;
    }
    const sa = a.seguidores; const sb = b.seguidores;
    if (sa != null && sb != null && sa !== sb) return sb - sa;
    if (sa != null && sb == null) return -1;
    if (sa == null && sb != null) return 1;
    return (idx.get(a.usuario) ?? 0) - (idx.get(b.usuario) ?? 0);
  });
}

/** Lo mismo para los canales: primero el que se pegó, después por suscriptores. */
export function ordenarCanales(canales: readonly CanalHallado[], exacto: string | null): CanalHallado[] {
  const unicos = new Map<string, CanalHallado>();
  for (const c of canales) {
    const k = c.ref.toLowerCase();
    const ya = unicos.get(k);
    unicos.set(k, ya ? { ...ya, nombre: ya.nombre ?? c.nombre, foto: ya.foto ?? c.foto, suscriptores: ya.suscriptores ?? c.suscriptores } : { ...c });
  }
  const lista = [...unicos.values()];
  const idx = new Map(lista.map((c, i) => [c.ref.toLowerCase(), i] as const));
  const ex = exacto?.toLowerCase() ?? null;
  return lista.sort((a, b) => {
    if (ex) {
      if (a.ref.toLowerCase() === ex && b.ref.toLowerCase() !== ex) return -1;
      if (b.ref.toLowerCase() === ex && a.ref.toLowerCase() !== ex) return 1;
    }
    const sa = a.suscriptores; const sb = b.suscriptores;
    if (sa != null && sb != null && sa !== sb) return sb - sa;
    if (sa != null && sb == null) return -1;
    if (sa == null && sb != null) return 1;
    return (idx.get(a.ref.toLowerCase()) ?? 0) - (idx.get(b.ref.toLowerCase()) ?? 0);
  });
}

/** Las primeras filas que todavía no tienen foto o seguidores, y que no se pidieron: se completan en UNA corrida. */
export const PRIMERAS_QUE_SE_COMPLETAN = 5;
export function cualesCompletar(perfiles: readonly PerfilHallado[], yaPedidos: ReadonlySet<string>): string[] {
  return perfiles.slice(0, PRIMERAS_QUE_SE_COMPLETAN)
    .filter((p) => (!p.foto || p.seguidores == null) && !yaPedidos.has(p.usuario))
    .map((p) => p.usuario);
}

// ── Lo que se dice mientras se espera ────────────────────────────────────────

/**
 * La línea que se ve mientras una búsqueda tarda, según cuánto lleva (punto 2: «debería ir diciéndome "Esto
 * puede tardar 20 segundos... Si tienes el @ exacto es inmediato..." para que el usuario no crea que se trabó»).
 *
 * ⚠️ «INMEDIATO» NO: el @ exacto se lee por Apify y tarda unos segundos. Prometer algo que no pasa es peor que
 * no decir nada. Lo que es verdad es que con el @ no hay que esperar la búsqueda por nombre.
 */
export function esperaDe(ms: number, porNombre: boolean): string {
  if (!porNombre) return ms < 6000 ? 'Leyendo su perfil…' : 'Instagram tarda un poco. Ya casi.';
  if (ms < 3000) return 'Buscando…';
  if (ms < 9000) return 'Esto puede tardar unos 20 segundos.';
  if (ms < 18000) return 'Con su @ exacto es más rápido.';
  return 'Ya casi.';
}

// ── De las respuestas a las filas ────────────────────────────────────────────

/** La clave de lo pedido por un nombre: sin mayúsculas, tildes ni espacios de más (como la caché del servidor). */
export const normalizarClave = (s: string): string => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Lo que contestó cada pedido, por su clave. `{ fallo: true }` = no contestó (cortado, 5xx, sin red). */
export type RespuestasBusqueda = Record<string,
  | { fallo: true }
  | { perfil?: PerfilHallado | null; perfiles?: PerfilHallado[]; instagram?: PerfilHallado[]; youtube?: CanalHallado[]; canal?: CanalHallado | null; vacio?: 'sin-clave' | 'limite' | 'fallo' | null; vacioYoutube?: 'sin-clave' | 'fallo' | null }
>;

/** Los @ y canales que el negocio ya mira: no se buscan ni se ofrecen (salen en «Ya los miras»). */
export type YaMirados = { instagram: ReadonlySet<string>; youtube: ReadonlySet<string> };

type Claves = { ig: string | null; g: string | null; ign: string | null; yt: string | null };

/** Las claves de los pedidos de un plan. Lo que ya se mira no se pide. */
function clavesDe(plan: PlanDeBusqueda, ya: YaMirados): Claves {
  const n = plan.nombre ? normalizarClave(plan.nombre) : null;
  return {
    ig: plan.instagramExacto && !ya.instagram.has(plan.instagramExacto) ? `ig:${plan.instagramExacto}` : null,
    g: n ? `g:${n}` : null,
    ign: n ? `ign:${n}` : null,
    yt: plan.youtubeExacto && !ya.youtube.has(plan.youtubeExacto.toLowerCase()) ? `yt:${plan.youtubeExacto.toLowerCase()}` : null,
  };
}

const RUTA = '/api/competitor-spy/buscar';

/** Los pedidos que salen para un plan, con su URL. La pantalla los manda todos a la vez. */
export function pedidosDelPlan(plan: PlanDeBusqueda, ya: YaMirados): Array<{ k: string; url: string }> {
  const c = clavesDe(plan, ya);
  const out: Array<{ k: string; url: string }> = [];
  if (c.ig) out.push({ k: c.ig, url: `${RUTA}?fuente=ig&u=${encodeURIComponent(plan.instagramExacto as string)}` });
  if (c.g) out.push({ k: c.g, url: `${RUTA}?fuente=google&q=${encodeURIComponent(plan.nombre as string)}` });
  if (c.ign) out.push({ k: c.ign, url: `${RUTA}?fuente=ig-nombre&q=${encodeURIComponent(plan.nombre as string)}` });
  if (c.yt) out.push({ k: c.yt, url: `${RUTA}?fuente=yt&ref=${encodeURIComponent(plan.youtubeExacto as string)}` });
  return out;
}

/** Una fila de la lista. `grupo` decide bajo qué red se dibuja. */
export type FilaBusqueda =
  | { k: string; tipo: 'mirado'; grupo: 'mirados'; competidorId: number }
  | { k: string; tipo: 'perfil'; grupo: 'instagram'; perfil: PerfilHallado; completando: boolean }
  | { k: string; tipo: 'usar'; grupo: 'instagram'; usuario: string }
  | { k: string; tipo: 'canal'; grupo: 'youtube'; canal: CanalHallado }
  | { k: string; tipo: 'directo'; grupo: 'youtube' | 'tiktok' | 'sitio'; campo: 'youtube_id' | 'tiktok' | 'landing_url'; valor: string; pegar: string; titulo: string; detalle: string }
  | { k: string; tipo: 'nombre'; grupo: 'nombre'; nombre: string };

/** Cuántas filas por red se muestran: una lista para elegir, no un directorio. */
export const FILAS_INSTAGRAM = 10;
export const FILAS_YOUTUBE = 6;

const sinProtocolo = (s: string) => s.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/**
 * Las filas de la búsqueda (sin «Ya los miras», que pone la pantalla), y lo que hace falta para decir qué pasa.
 *
 * ⚠️ «NO PUDE» Y «NO HAY» NO SON LO MISMO. Una lista vacía porque falta la clave, porque se acabó el cupo o porque
 * Apify no contestó se dice como tal; «No encontré a nadie» sólo cuando todos contestaron y no trajeron a nadie.
 */
export function filasDeLaBusqueda(plan: PlanDeBusqueda, resp: RespuestasBusqueda, completos: Readonly<Record<string, PerfilHallado & { sinLeer?: boolean }>>, ya: YaMirados) {
  const c = clavesDe(plan, ya);
  const r = (k: string | null) => (k ? resp[k] : undefined);
  const enCamino = (k: string | null) => !!k && resp[k] === undefined;
  const ok = (k: string | null) => { const x = r(k); return x && !('fallo' in x) ? x : null; };
  const vacios = [c.ig, c.g, c.ign, c.yt].map((k) => r(k)).filter(Boolean).map((x) => ('fallo' in (x as object) ? 'fallo' : (x as { vacio?: string | null }).vacio ?? null));

  // Instagram: el exacto, Google y el buscador de Instagram, juntos y completados.
  const exacto = ok(c.ig)?.perfil ?? null;
  const juntos = juntarPerfiles(exacto ? [exacto] : [], ok(c.g)?.instagram ?? [], ok(c.ign)?.perfiles ?? [])
    .map((p) => { const x = completos[p.usuario]; return x && !x.sinLeer ? { ...p, ...x, nombre: x.nombre ?? p.nombre, foto: x.foto ?? p.foto, seguidores: x.seguidores ?? p.seguidores } : p; })
    .filter((p) => !ya.instagram.has(p.usuario));
  const instagram = ordenarPerfiles(juntos, plan.fijar).slice(0, FILAS_INSTAGRAM);
  const sinCupo = vacios.includes('limite');
  const filas: FilaBusqueda[] = instagram.map((p, i) => ({
    k: `p:${p.usuario}`, tipo: 'perfil', grupo: 'instagram', perfil: p,
    completando: i < PRIMERAS_QUE_SE_COMPLETAN && !completos[p.usuario] && (!p.foto || p.seguidores == null) && !sinCupo,
  }));
  // «Usar @x» tal cual: lo que se escribió y no se pudo leer (sin clave, sin cupo, Apify caído) se puede agregar igual.
  // Si la lectura dijo que NO EXISTE, no se ofrece: agregar a alguien que no existe es una tarjeta vacía para siempre.
  const usar = plan.tambienUsuario ?? (plan.fijar && c.ig && r(c.ig) && !exacto && (('fallo' in (r(c.ig) as object)) || (ok(c.ig)?.vacio ?? null) !== null) ? plan.fijar : null);
  if (usar && !ya.instagram.has(usar) && !instagram.some((p) => p.usuario === usar)) filas.push({ k: `u:${usar}`, tipo: 'usar', grupo: 'instagram', usuario: usar });

  // YouTube: el canal pegado o escrito, y los que encontró Google.
  const canal = ok(c.yt)?.canal ?? null;
  const youtube = ordenarCanales([...(canal ? [canal] : []), ...(ok(c.g)?.youtube ?? [])], plan.youtubeExacto)
    .filter((x) => !ya.youtube.has(x.ref.toLowerCase())).slice(0, FILAS_YOUTUBE);
  for (const x of youtube) filas.push({ k: `y:${x.ref.toLowerCase()}`, tipo: 'canal', grupo: 'youtube', canal: x });
  // Un enlace de YouTube que no se pudo leer (sin clave de la Data API, sin cuota) se ofrece igual, con lo que se pegó.
  const deEnlaceYt = plan.youtubeExacto && !plan.instagramExacto && !plan.nombre;
  if (deEnlaceYt && !canal && c.yt && r(c.yt)) {
    const ref = plan.youtubeExacto as string;
    filas.push({ k: `d:yt`, tipo: 'directo', grupo: 'youtube', campo: 'youtube_id', valor: ref, pegar: ref.startsWith('@') ? `https://www.youtube.com/${ref}` : ref.startsWith('user:') ? `https://www.youtube.com/user/${ref.slice(5)}` : `https://www.youtube.com/channel/${ref}`, titulo: ref.startsWith('@') ? ref : 'Su canal de YouTube', detalle: 'Canal de YouTube' });
  }
  if (plan.tiktok) filas.push({ k: 'd:tt', tipo: 'directo', grupo: 'tiktok', campo: 'tiktok', valor: plan.tiktok, pegar: `https://www.tiktok.com/@${plan.tiktok}`, titulo: `@${plan.tiktok}`, detalle: 'Su TikTok' });
  if (plan.sitio) filas.push({ k: 'd:web', tipo: 'directo', grupo: 'sitio', campo: 'landing_url', valor: plan.sitio, pegar: plan.sitio, titulo: sinProtocolo(plan.sitio), detalle: 'Su sitio' });

  const instagramCargando = enCamino(c.ig) || enCamino(c.g) || enCamino(c.ign);
  const youtubeCargando = enCamino(c.yt) || enCamino(c.g);
  // «Agregar con su nombre»: sólo con un nombre de verdad (no un @), y cuando la búsqueda ya contestó.
  if (plan.nombre && !plan.fijar && !enCamino(c.g) && !enCamino(c.ign)) filas.push({ k: 'n', tipo: 'nombre', grupo: 'nombre', nombre: plan.nombre });

  const claves = [c.ig, c.g, c.ign, c.yt].filter((k): k is string => !!k);
  // ── Qué se dice de YouTube cuando no trae ningún canal ─────────────────────
  // ⚠️ NUNCA UNA LISTA QUE PARECE COMPLETA Y NO LO ES (Martín, 4/11: «solamente me trae Instagram»). Con Instagram
  // lleno y YouTube vacío no se decía nada: no se sabía si YouTube se había buscado. Ahora el grupo de YouTube dice
  // lo que pasó: no hay canales con ese nombre, o no se pudo buscar (y por qué).
  const delYoutube = [c.yt, c.g].map((k) => r(k)).filter(Boolean) as NonNullable<ReturnType<typeof r>>[];
  // Sin la clave de la YouTube Data API (la del negocio o la de la plataforma) es NUESTRO problema: «no pude», sin pedirle
  // nada. Sin la clave de Apify (la de Spy del negocio), Google no buscó: eso sí se le pide.
  const motivosYoutube = delYoutube.map((x) => ('fallo' in x ? 'fallo' : x.vacioYoutube ? 'fallo' : x.youtube !== undefined ? x.vacio ?? null : null));
  const youtubeEstado: 'cargando' | 'hay' | 'ninguno' | 'no-pude' | 'sin-clave' | 'sin-cupo' | null =
    !c.yt && !c.g ? null
      : youtubeCargando ? 'cargando'
      : youtube.length || filas.some((f) => f.grupo === 'youtube') ? 'hay'
      : motivosYoutube.includes('fallo') ? 'no-pude'
      : motivosYoutube.includes('sin-clave') ? 'sin-clave'
      : motivosYoutube.includes('limite') ? 'sin-cupo'
      : 'ninguno';
  return {
    youtubeEstado,
    filas,
    instagram,
    instagramCargando,
    youtubeCargando,
    clavesInstagram: [c.ig, c.g, c.ign].filter((k): k is string => !!k),
    clavesYoutube: [c.yt, c.g].filter((k): k is string => !!k),
    sinClave: vacios.includes('sin-clave'),
    sinCupo,
    fallo: vacios.includes('fallo'),
    algoEnCamino: instagramCargando || youtubeCargando,
    algoPedido: claves.length > 0 && claves.every((k) => resp[k] !== undefined),
  };
}

// ── Sumarle un canal a alguien que ya se mira (4/11/2026) ─────────────────────────────────────────────────────────────
// Martín: «Le di a "Agregar YouTube" y el modal que me sale es uno feo... Debe ser el mismo de siempre para buscar su YouTube,
// este ni siquiera tiene la funcionalidad de búsqueda». Es el MISMO buscador, arrancado con su nombre y con sólo sus redes.

/** Para quién se busca un canal: su nombre y, si se pidió una red, sólo esa. */
export type BuscarPara = { nombre: string; red?: 'instagram' | 'youtube' | null };

/** Qué grupos ofrece el buscador. Para sumarle un canal a alguien, ni «Ya los miras» ni «Sin redes»: sólo sus redes. */
export function gruposPermitidos(para?: BuscarPara | null): ReadonlySet<FilaBusqueda['grupo']> {
  if (!para) return new Set(['mirados', 'instagram', 'youtube', 'tiktok', 'sitio', 'nombre']);
  if (para.red) return new Set([para.red]);
  return new Set(['instagram', 'youtube', 'tiktok', 'sitio']);
}

/** Su nombre para buscar: vive en lib/spy-reglas.ts (lo usan también la Biblioteca de anuncios y la verificación). */
export { nombreParaBuscar } from './spy-reglas';
