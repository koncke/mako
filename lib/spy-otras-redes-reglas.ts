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
 * «Buscar sus otras redes»: 20 por día, aunque la lista se llene (`TOPES.competidores`) en unos días.
 */
export const TOPE_BUSQUEDAS_REDES_POR_DIA = 20;
/** Cuántos candidatos por red se ofrecen: más de tres es pedirle a la persona que investigue. */
export const CANDIDATOS_POR_RED = 3;
/** La línea de la ficha cuando Apify rechazó la clave de Spy al buscar sus otras redes (14/11/2026), al lado del botón para revisarla. */
export const REDES_CLAVE_RECHAZADA = 'Apify rechazó tu clave de Spy: no pude buscar sus otras redes.';

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
  /** El candidato es su MISMO usuario en la otra red (@den.borgg en Instagram, @den.borgg o @denborgg en YouTube). */
  mismoUsuario?: boolean;
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
  // El mismo usuario con su nombre o su cara ya es ella (Martín, 4/11: «busqué literalmente el usuario exacto y ya me
  // apareció»). El mismo usuario SOLO se pregunta: un @ libre en otra red lo puede tener cualquiera.
  if (e.enlaza || (mismaFoto && e.mismoNombre) || (e.mismoUsuario && (mismaFoto || e.mismoNombre))) return 'es';
  if (mismaFoto || e.mismoNombre || e.mismoUsuario) return 'quizas';
  return 'no';
}

/** Por qué se dice que puede ser ella, cuando no se enlazan (el enlace lo describe quien sabe quién nombra a quién). */
export function porqueDe(e: Evidencia): string {
  const mismaFoto = e.distanciaFoto != null && e.distanciaFoto <= MISMA_FOTO_HASTA;
  if (e.enlaza) return 'Se enlazan entre ellos';
  if (e.mismoUsuario && e.mismoNombre) return 'Mismo usuario y mismo nombre';
  if (e.mismoUsuario && mismaFoto) return 'Mismo usuario y misma foto';
  if (mismaFoto && e.mismoNombre) return 'Misma foto y mismo nombre';
  if (mismaFoto) return 'Misma foto';
  if (e.mismoUsuario) return 'Mismo usuario';
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

// ── La cadena: lo que él mismo enlaza, y su usuario en la otra red (4/11/2026) ─────────────────────────────
// Martín, 4/11: «tampoco está haciendo el ejercicio de buscar en YouTube y también buscar su web… Yo busqué literalmente el
// usuario exacto y ya me apareció el primer resultado… y en correlación mirar las biografías para traer sus webs». Medido
// en producción (el Cerebro, 4/11): @den.borgg quedó sin YouTube y con su «web» = beacons.page/denborg, que es su página
// de ENLACES, no su web.

/**
 * Las páginas de enlaces («link in bio»): no son su web, son la puerta a su web y a sus redes. Se abren y se leen sus
 * enlaces. Una lista y no «cualquiera con muchos enlaces»: un sitio de verdad también tiene muchos.
 */
const AGREGADORES = /(^|\.)(beacons\.(page|ai)|linktr\.ee|linkin\.bio|lnk\.bio|bio\.link|bio\.site|solo\.to|hoo\.be|campsite\.bio|taplink\.(cc|at)|msha\.ke|linkpop\.com|stan\.store|komi\.io|snipfeed\.co|allmylinks\.com|linkbio\.co|tap\.bio|direct\.me|milkshake\.app|linkr\.bio|lynk\.id|linkfly\.to|link\.me|flowpage\.com)$/i;

const hostDe = (u: string): string | null => {
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
};

/** ¿Es una página de enlaces (beacons, linktree…)? */
export const esAgregador = (url: string | null | undefined): boolean => { const h = url ? hostDe(url) : null; return !!h && AGREGADORES.test(h); };

/** Los enlaces de un texto (una bio, una descripción), con o sin https, en el orden en que aparecen. */
export function enlacesDelTexto(texto: string | null | undefined): string[] {
  const out: string[] = [];
  for (const m of (texto ?? '').matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s)"'<>]*)?/gi)) {
    const antes = (texto ?? '')[(m.index ?? 0) - 1];
    if (antes === '@') continue; // un correo
    const u = m[0].replace(/[.,;:!?]+$/, '');
    out.push(/^https?:\/\//i.test(u) ? u : `https://${u}`);
  }
  return [...new Set(out)];
}

/**
 * Los enlaces de una página de enlaces, ya absolutos: los `<a href>` y, como muchas se dibujan con JavaScript, los que
 * vienen escritos en sus datos (`"https:\/\/…"`, `\u002F`). Sin repetir y con tope.
 */
export function enlacesDeHtml(html: string, base: string): string[] {
  const out: string[] = [];
  const sumar = (crudo: string) => {
    try {
      const u = new URL(crudo.replace(/&amp;/g, '&'), base);
      if (u.protocol === 'https:' || u.protocol === 'http:') out.push(u.toString());
    } catch { /* no es un enlace */ }
  };
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"']+)["']/gi)) sumar(m[1]);
  const sinEscapes = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  for (const m of sinEscapes.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) sumar(m[0]);
  return [...new Set(out)].slice(0, 300);
}

/** Lo que no es una web de nadie: imágenes, fuentes, scripts y los servicios que cualquier página carga. */
const NO_ES_WEB = /(^|\.)(cdn|static|assets|fonts?|img|images|media)\.|googleapis\.com$|gstatic\.com$|cloudfront\.net$|amazonaws\.com$|vercel\.(app|com)$|sentry\.io$|cloudflare|jsdelivr\.net$|unpkg\.com$|gravatar\.com$|googletagmanager\.com$|google-analytics\.com$|facebook\.(com|net)$|fb\.(com|me)$|doubleclick\.net$|hotjar\.com$|segment\.(io|com)$|intercom\.io$|w3\.org$|schema\.org$|ogp\.me$|apple\.com$|google\.com$|spotify\.com$|twitter\.com$|x\.com$|threads\.net$|linkedin\.com$|whatsapp\.com$|wa\.me$|t\.me$|telegram\.me$|tiktok\.com$|instagram\.com$|youtube\.com$|youtu\.be$|pinterest\.com$|snapchat\.com$|twitch\.tv$|discord\.(gg|com)$|paypal\.(com|me)$/i;
const ES_ARCHIVO = /\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|otf|mp4|mov|json|xml|txt|pdf)(\?|#|$)/i;

/**
 * Lo que enlaza (su bio, su descripción o su página de enlaces): sus redes, una por red, y su WEB — el primer enlace que
 * no es una red, una página de enlaces, un archivo ni un servicio que carga cualquier página. Sin la página misma.
 */
export function loQueEnlaza(urls: readonly string[], propio?: string | null): { redes: Array<Omit<CandidatoRed, 'titulo'>>; web: string | null } {
  const yo = propio ? hostDe(propio) : null;
  const redes = new Map<RedOtra, Omit<CandidatoRed, 'titulo'>>();
  let web: string | null = null;
  for (const u of urls) {
    const r = redDeUrl(u);
    if (r) { if (!redes.has(r.red)) redes.set(r.red, r); continue; }
    const h = hostDe(u);
    if (web || !h || h === yo || AGREGADORES.test(h) || NO_ES_WEB.test(h) || ES_ARCHIVO.test(u)) continue;
    web = `https://${h}${(() => { try { const p = new URL(u).pathname; return p === '/' ? '' : p.replace(/\/$/, ''); } catch { return ''; } })()}`;
  }
  return { redes: [...redes.values()], web };
}

/**
 * TODAS sus páginas de una página de enlaces (4/11/2026, Funnel: «en el caso de denborg tiene muchas otras páginas dentro»): lo que
 * no es una red, ni otra página de enlaces, ni un CDN, ni un archivo. Sin repetir (por host y camino) y hasta `tope`. La venta de
 * entradas (Passline, Eventbrite) entra: es una página suya, y es la mejor evidencia de su funnel.
 */
export function paginasQueEnlaza(urls: readonly string[], propio: string | null, tope: number): string[] {
  const yo = propio ? hostDe(propio) : null;
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (out.length >= tope) break;
    if (redDeUrl(u)) continue;
    const h = hostDe(u);
    if (!h || h === yo || AGREGADORES.test(h) || NO_ES_WEB.test(h) || ES_ARCHIVO.test(u)) continue;
    let camino = '';
    try { camino = new URL(u).pathname.replace(/\/$/, ''); } catch { continue; }
    const k = `${h}${camino}`.toLowerCase();
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(`https://${h}${camino}`);
  }
  return out;
}

/**
 * Su MISMO usuario en la red que le falta: con su @ de Instagram, el canal de YouTube con ese @ (y sin puntos ni guiones
 * bajos: @den.borgg → @denborgg); con su @ de YouTube, el Instagram con ese usuario. Gratis en YouTube (1 unidad).
 */
export function usuariosParaProbar(c: { instagram: string | null; youtube_id: string | null }): { youtube: string[]; instagram: string[] } {
  const ig = str(c.instagram).replace(/^@/, '').toLowerCase();
  const yt = str(c.youtube_id).startsWith('@') ? str(c.youtube_id).slice(1) : '';
  const youtube = c.youtube_id || !ig ? [] : [...new Set([ig, ig.replace(/[._]/g, '')].filter((u) => /^[a-z0-9._-]{3,30}$/i.test(u)).map((u) => `@${u}`))];
  const instagram = c.instagram || !yt ? [] : [...new Set([yt.toLowerCase(), yt.toLowerCase().replace(/-/g, '')].filter((u) => /^[a-z0-9._]{2,30}$/.test(u)))];
  return { youtube, instagram };
}

// ─────────────────────────────────────────────────────────────────────────────
// Un canal, una pastilla (4/11/2026)
// ─────────────────────────────────────────────────────────────────────────────
// Martín, con Federico Cristofari: «2 veces saltó el cartel de YouTube. Eso no debe pasar». El mismo canal llegaba por dos
// caminos con dos refs (su `@handle` probado a ciegas y su `UC…` del video de Google) y cada uno era un candidato. Lo que lo
// identifica es el id que DEVUELVE la API al leerlo (`id`), no la ref con la que se pidió.

/** Lo que identifica a un canal: el id leído si lo hay; si no, la ref. Sin mayúsculas. */
export const claveDeCanal = (k: { red: string; ref: string; id?: string | null }): string =>
  `${k.red}|${(k.id || k.ref).replace(/^@/, '').toLowerCase()}`;

/** Sin repetidos, en el orden en que llegaron (el primero es el de más evidencia: así los evalúa la cadena). */
export function sinCanalesRepetidos<T extends { red: string; ref: string; id?: string | null }>(lista: readonly T[]): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const k of lista) {
    const clave = claveDeCanal(k);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(k);
  }
  return out;
}

/** El orden en que se pregunta: lo que más importa primero (su YouTube y su Instagram traen piezas; TikTok sólo se muestra). */
const ORDEN_DE_RED: Record<string, number> = { youtube: 0, instagram: 1, tiktok: 2 };

/**
 * La pregunta de ahora: UNA sola pastilla de «¿Es su…?» en la fila de la miga, la más probable, y cuántas más hay para «Ver otro»
 * (Martín, con Federico Cristofari: dos pastillas iguales, y la segunda partía la fila). Primero su YouTube, después su Instagram,
 * y dentro de cada red en el orden en que llegaron (el primero es el de más evidencia: así los evalúa la cadena). `vuelta` es
 * cuántas veces se tocó «Ver otro»: da la vuelta. «No es» saca la de ahora y aparece la siguiente.
 */
export function preguntaDeAhora<T extends { red: string; ref: string; id?: string | null }>(
  lista: readonly T[], vuelta = 0,
): { k: T; otros: number } | null {
  const todas = sinCanalesRepetidos(lista)
    .map((k, i) => ({ k, i }))
    .sort((a, b) => (ORDEN_DE_RED[a.k.red] ?? 9) - (ORDEN_DE_RED[b.k.red] ?? 9) || a.i - b.i)
    .map((x) => x.k);
  if (!todas.length) return null;
  return { k: todas[((vuelta % todas.length) + todas.length) % todas.length], otros: todas.length - 1 };
}
