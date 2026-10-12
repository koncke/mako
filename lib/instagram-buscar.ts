// =============================================================================
// instagram-buscar — lo PURO del buscador de Instagram del alta de un lead (punto 28)
// =============================================================================
// Martín (12/10/2026): «que Instagram sea un buscador real de todos los usuarios existentes de
// instagram, como la barra de busqueda que tiene el propio instagram, y que si escribo "Martin
// koncke" me salten las opciones con las fotos de perfil y pueda seleccionar». Y después: «piensa
// la mejor manera de hacerlo... Ahora que vamos a tener la app de Meta aprobada».
//
// POR QUÉ DOS FUENTES: Instagram no tiene una API oficial que busque a cualquiera por nombre (la
// barra de la app es privada). Se combinan:
//   1. Business Discovery de la Graph API de Meta, con la conexión de Meta del NEGOCIO. Oficial y
//      gratis, pero sólo cuentas de EMPRESA o CREADOR, y sólo por el @ EXACTO. Va cuando lo escrito
//      parece un usuario, y también con lo escrito como nombre pegado («Martin Koncke» →
//      @martinkoncke, @martin.koncke, @martin_koncke): cada uno que Meta contesta es una cuenta que
//      EXISTE, no una suposición — es lo único que encuentra por nombre sin la fuente 2.
//   2. El buscador programable de Google (Custom Search JSON API) restringido a instagram.com:
//      encuentra por NOMBRE, también cuentas personales, pero sólo las que Google indexó. Las claves
//      son de la PLATAFORMA (GOOGLE_CSE_KEY y GOOGLE_CSE_CX, en el workspace de plataforma), gratis
//      hasta 100 búsquedas por día.
//      ⚠️ GOOGLE CERRÓ ESA API A CLIENTES NUEVOS Y LA APAGA EL 1/1/2027 (leído el 12/10/2026 en
//      developers.google.com/custom-search/v1/overview: «The Custom Search JSON API is closed to new
//      customers… Existing customers have until January 1, 2027 to transition»). Sin las claves el
//      buscador NO se rompe: usa sólo la fuente 1 y pide el @. Reemplazarla es cambiar
//      `buscarEnGoogle` (la ruta) y `leerRespuestaGoogle` (acá); el componente y el contrato no se
//      enteran.
//
// Lo que vive acá es lo que se prueba sin red (tests/instagram-buscar.test.ts): leer las dos
// respuestas, reconocer un perfil en una URL, decidir si lo escrito es un usuario, combinar. La red
// y las credenciales, en la ruta (app/api/crm/instagram-buscar/route.ts). Sin `server-only`: lo
// importan el test y el componente del alta (app/crm/new/InstagramBuscador.tsx: el tipo y los topes).
//
// ⚠️ UN RESULTADO NUNCA SE INVENTA: cada perfil sale de una respuesta que lo nombra. Un cuerpo que no
// se entiende es un FALLO («no pude», no se cachea), nunca una lista vacía («no está», sí se cachea).
//
// ⚠️ LA FOTO VENCE: la de un perfil es una URL firmada del CDN de Meta (el parámetro `oe=` es su
// vencimiento). Sirve para mostrarla en la lista; NO se guarda como foto del lead.
// =============================================================================

/** Un perfil de Instagram para elegir. `usuario` va sin la @ y en minúsculas (Instagram no distingue). */
export type PerfilIg = { usuario: string; nombre: string | null; foto: string | null };

/** Menos letras no se busca: «ma» trae cualquier cosa y gasta una de las 100 búsquedas del día. */
export const MIN_LETRAS = 3;
/** El respiro del componente entre la última tecla y la búsqueda (debounce). */
export const ESPERA_MS = 500;
/** Lo que entra en la lista, como la barra de Instagram (no es un listado para scrollear). */
export const MAX_RESULTADOS = 8;
/** Lo que la ruta acepta de lo escrito. Un nombre y apellido entra de sobra. */
export const MAX_LARGO = 80;

/** Lo que dice cada respuesta de Google: una lista (vacía = Google contestó que no hay) o el porqué no. */
export type LecturaGoogle =
  | { ok: true; perfiles: PerfilIg[] }
  | { ok: false; motivo: 'sin-cuota' | 'sin-acceso' | 'error'; detalle: string };

/**
 * Lo que dice la respuesta de Business Discovery. `no-esta` = Meta contestó que esa cuenta no se
 * puede ver (no existe, es personal o tiene restricción de edad): se cachea. `sin-permiso` = la
 * conexión del negocio no sirve para esto (token vencido, sin el permiso): se deja de preguntar un
 * rato. `limite` = Meta está limitando (las llamadas de la app, del token o de la página): también se
 * deja de preguntar un rato. `error` = cualquier otra cosa, no se cachea.
 */
export type LecturaMeta =
  | { ok: true; perfil: PerfilIg }
  | { ok: false; motivo: 'no-esta' | 'sin-permiso' | 'limite' | 'error'; detalle: string };

// ── Lo escrito ──────────────────────────────────────────────────────────────

/** Letras y números de Instagram: minúsculas, números, punto y guion bajo, hasta 30. */
const RE_USUARIO = /^[a-z0-9._]{1,30}$/;
const esUsuario = (s: string) => RE_USUARIO.test(s) && /[a-z0-9]/.test(s);

/** ¿Alcanza lo escrito para buscar? Cuenta letras y números, no espacios ni la @. */
export function alcanzaParaBuscar(texto: string): boolean {
  return (texto.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= MIN_LETRAS;
}

/** Si lo escrito es un usuario (sin espacios, con o sin @), ese usuario; si no, null. */
export function usuarioDeTexto(texto: string): string | null {
  const t = texto.trim().replace(/^@+/, '').toLowerCase();
  return esUsuario(t) ? t : null;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Los usuarios que se le preguntan a Meta por lo escrito: el usuario mismo, o —con un nombre de 2 o 3
 * palabras— el nombre pegado, con punto y con guion bajo. Nada más: cada uno es una consulta, y un
 * nombre de cuatro palabras pegado no es el @ de nadie.
 */
export function usuariosCandidatos(texto: string): string[] {
  const u = usuarioDeTexto(texto);
  if (u) return [u];
  const palabras = sinAcentos(texto.trim().toLowerCase()).split(/\s+/).filter(Boolean);
  if (palabras.length < 2 || palabras.length > 3) return [];
  if (!palabras.every((p) => /^[a-z0-9]+$/.test(p))) return [];
  return [...new Set(['', '.', '_'].map((sep) => palabras.join(sep)))].filter(esUsuario);
}

/** La clave de la caché para lo escrito: sin mayúsculas, acentos, @ ni espacios de más. */
export function normalizarBusqueda(texto: string): string {
  return sinAcentos(texto.trim().replace(/^@+/, '').toLowerCase()).replace(/\s+/g, ' ');
}

/** El perfil que se arma con lo escrito a mano («Usar @usuario»), o null si no es un usuario. */
export function perfilManual(texto: string): PerfilIg | null {
  const usuario = usuarioDeTexto(texto);
  return usuario ? { usuario, nombre: null, foto: null } : null;
}

/** El link al perfil. */
export const urlDePerfil = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario)}/`;

// ── Una URL de Instagram ────────────────────────────────────────────────────

/** Primeros tramos de una URL de instagram.com que NO son un usuario. */
const RESERVADAS = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'stories', 'accounts', 'about', 'direct', 'legal', 'developer',
  'developers', 'web', 'challenge', 'emails', 'api', 'graphql', 'popular', 'topics', 'nametag', 'session',
  'privacy', 'terms', 'directory', 'press', 'oauth', 'lite', 'download', 'help', 'your_activity', 'tags',
  'locations', 'audio', 'embed', 'ar', 's', 'invites', 'blog', 'business', 'creators', 'threads',
]);
/** Las pestañas de un PERFIL (`/usuario/reels/`): siguen siendo su página. Un post (`/usuario/p/x/`) no. */
const PESTANAS_DE_PERFIL = new Set(['reels', 'tagged', 'guides', 'channel', 'igtv', 'feed']);

/** El usuario de la URL de un PERFIL de Instagram; null para un post, un reel, /explore/ u otro sitio. */
export function usuarioDeUrlInstagram(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return null;
  const partes = u.pathname.split('/').filter(Boolean);
  if (partes.length === 0 || partes.length > 2) return null;
  if (partes.length === 2 && !PESTANAS_DE_PERFIL.has(partes[1].toLowerCase())) return null;
  let usuario: string;
  try { usuario = decodeURIComponent(partes[0]).toLowerCase(); } catch { return null; }
  if (RESERVADAS.has(usuario) || !esUsuario(usuario)) return null;
  return usuario;
}

// ── Google ──────────────────────────────────────────────────────────────────

/** `&#064;` → `@`, `&#x2022;` → `•`, y los nombrados que aparecen en un título. */
export function decodificarEntidades(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * El nombre y el usuario de un título de perfil: «Martín Koncke (@martinkoncke) • Instagram photos
 * and videos» (o «• Fotos y videos de Instagram»), o «@martinkoncke • Instagram…» sin nombre.
 */
export function nombreYUsuarioDeTitulo(titulo: string): { nombre: string | null; usuario: string } | null {
  const t = decodificarEntidades(titulo).trim();
  const conNombre = /^(.*?)\s*\(\s*@([A-Za-z0-9._]{1,30})\s*\)/.exec(t);
  if (conNombre) {
    const nombre = conNombre[1].replace(/[\s•·|\-–—]+$/u, '').trim();
    return { nombre: nombre || null, usuario: conNombre[2].toLowerCase() };
  }
  const solo = /^@([A-Za-z0-9._]{1,30})(?![A-Za-z0-9._])/.exec(t);
  return solo ? { nombre: null, usuario: solo[1].toLowerCase() } : null;
}

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const primero = (v: unknown): Obj | null => (Array.isArray(v) && esObj(v[0]) ? v[0] : null);
const https = (v: unknown): string | null => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** La foto de un resultado: la imagen que Google sacó de la página, la del `og:image`, o su miniatura. */
function fotoDePagemap(pagemap: unknown): string | null {
  if (!esObj(pagemap)) return null;
  return https(primero(pagemap.cse_image)?.src)
    ?? https(primero(pagemap.metatags)?.['og:image'])
    ?? https(primero(pagemap.cse_thumbnail)?.src);
}

/** Lo que Google contesta como fallo: 429 (o su `reason`) es la cuota; 400/401/403, la clave o el cx. */
function motivoGoogle(status: number, error: Obj | null): 'sin-cuota' | 'sin-acceso' | 'error' {
  const c = error?.code;
  const code = typeof c === 'number' ? c : status;
  const lista = error?.errors;
  const razones = Array.isArray(lista) ? lista.map((x) => (esObj(x) ? String(x.reason ?? '') : '')) : [];
  if (code === 429 || error?.status === 'RESOURCE_EXHAUSTED' || razones.some((r) => /limit|quota/i.test(r))) return 'sin-cuota';
  if (code === 400 || code === 401 || code === 403) return 'sin-acceso';
  return 'error';
}

/**
 * La respuesta de `GET customsearch/v1`. Sin `items` es «no hay» (Google lo omite con cero
 * resultados); de cada item se queda sólo el que es un PERFIL, y el nombre sólo si el título habla
 * del MISMO usuario que la URL.
 */
export function leerRespuestaGoogle(status: number, cuerpo: unknown): LecturaGoogle {
  const error = esObj(cuerpo) && esObj(cuerpo.error) ? cuerpo.error : null;
  if (error || status < 200 || status >= 300) {
    return { ok: false, motivo: motivoGoogle(status, error), detalle: texto(error?.message) ?? `HTTP ${status}` };
  }
  if (!esObj(cuerpo)) return { ok: false, motivo: 'error', detalle: 'cuerpo ilegible' };
  const items = cuerpo.items;
  if (items === undefined) return { ok: true, perfiles: [] };
  if (!Array.isArray(items)) return { ok: false, motivo: 'error', detalle: '`items` no es una lista' };
  const perfiles: PerfilIg[] = [];
  for (const it of items) {
    if (!esObj(it)) continue;
    const link = it.link;
    if (typeof link !== 'string') continue;
    const usuario = usuarioDeUrlInstagram(link);
    if (!usuario) continue;
    const pagemap = esObj(it.pagemap) ? it.pagemap : null;
    // El og:title viene entero; el `title` de Google puede venir cortado con «...».
    const titulos = [texto(primero(pagemap?.metatags)?.['og:title']), texto(it.title)];
    let nombre: string | null = null;
    for (const t of titulos) {
      const leido = t ? nombreYUsuarioDeTitulo(t) : null;
      if (leido && leido.usuario === usuario && leido.nombre) { nombre = leido.nombre; break; }
    }
    perfiles.push({ usuario, nombre, foto: fotoDePagemap(pagemap) });
  }
  return { ok: true, perfiles: combinarPerfiles(perfiles) };
}

// ── Meta ────────────────────────────────────────────────────────────────────

/**
 * Los códigos de Graph que dicen que la CONEXIÓN no sirve para esto: 190 (token vencido o
 * revocado), 10 y 200-299 (falta un permiso: Business Discovery pide `instagram_basic`,
 * `instagram_manage_insights` y `pages_read_engagement`), 3 (la app no tiene la capacidad).
 */
const esDePermiso = (code: number) => code === 190 || code === 10 || code === 3 || (code >= 200 && code <= 299);

/**
 * Los códigos de Graph que dicen que Meta está LIMITANDO: 4 (la app), 17 (el usuario: es por TOKEN),
 * 32 (la página), 613 (un límite propio del endpoint), 80001 (la página) y 80002 (Instagram).
 *
 * ⚠️ REVISIÓN DEL 12/10/2026: caían en `error`, que no se cachea, así que cada tecla volvía a llamar
 * a Graph mientras Meta limitaba. Con el 17, que es por token, insistir alarga el bloqueo del MISMO
 * token que el cliente usa para sus anuncios.
 */
const esLimite = (code: number) => code === 4 || code === 17 || code === 32 || code === 613 || code === 80001 || code === 80002;

/**
 * Qué dice un `error` de Graph sobre la conexión del negocio: no sirve para esto (`sin-permiso`),
 * Meta está limitando (`limite`), o cualquier otra cosa (`error`, que no se cachea). Lo usan la
 * lectura de Business Discovery y la de la cuenta de Instagram de la página (la ruta).
 */
export function motivoDeErrorGraph(error: unknown): 'sin-permiso' | 'limite' | 'error' {
  const code = esObj(error) ? error.code : undefined;
  if (typeof code !== 'number') return 'error';
  if (esDePermiso(code)) return 'sin-permiso';
  if (esLimite(code)) return 'limite';
  return 'error';
}

/**
 * La respuesta de `GET /{ig-user-id}?fields=business_discovery.username(x){…}`. Meta manda el fallo
 * ADENTRO de un 200 (AGENTS.md): `error` se mira antes que el dato. El subcódigo 2207013 es «Cannot
 * find User»: la cuenta no existe o no es de empresa o creador.
 */
export function leerRespuestaMeta(status: number, cuerpo: unknown): LecturaMeta {
  const error = esObj(cuerpo) && esObj(cuerpo.error) ? cuerpo.error : null;
  if (error) {
    const detalle = texto(error.message) ?? `HTTP ${status}`;
    if (error.error_subcode === 2207013) return { ok: false, motivo: 'no-esta', detalle };
    return { ok: false, motivo: motivoDeErrorGraph(error), detalle };
  }
  if (status < 200 || status >= 300 || !esObj(cuerpo)) return { ok: false, motivo: 'error', detalle: `HTTP ${status}` };
  const bd = esObj(cuerpo.business_discovery) ? cuerpo.business_discovery : null;
  const crudo = bd?.username;
  const usuario = typeof crudo === 'string' ? crudo.trim().toLowerCase() : '';
  if (!bd || !esUsuario(usuario)) return { ok: false, motivo: 'error', detalle: 'respuesta sin business_discovery.username' };
  return { ok: true, perfil: { usuario, nombre: texto(bd.name)?.trim() ?? null, foto: https(bd.profile_picture_url) } };
}

// ── Combinar ────────────────────────────────────────────────────────────────

/**
 * Una sola lista, sin repetidos, en el orden de las fuentes (la primera manda: Meta, que confirma la
 * cuenta, antes que Google). Si el primero no trae nombre o foto y un repetido sí, se completa.
 */
export function combinarPerfiles(...listas: PerfilIg[][]): PerfilIg[] {
  const out = new Map<string, PerfilIg>();
  for (const p of listas.flat()) {
    const ya = out.get(p.usuario);
    if (ya) out.set(p.usuario, { usuario: ya.usuario, nombre: ya.nombre ?? p.nombre, foto: ya.foto ?? p.foto });
    else out.set(p.usuario, { ...p });
  }
  return [...out.values()].slice(0, MAX_RESULTADOS);
}
