// =============================================================================
// landing-fetch — bajar la landing del cliente y sacarle el copy
// =============================================================================
// El Landing Analyst necesita el CONTENIDO de la página, y lo único que tenemos
// hoy de una landing es comportamiento (`landing_visits` + `vsl_events`): scroll
// y plays, nada de texto. Así que MaKo la baja sola: el cliente pega su URL y
// acá se descarga el HTML, se le quita todo lo que no es mensaje (scripts,
// estilos, nav, footer, cookie banners) y queda el copy en el ORDEN en el que lo
// lee un visitante, que es lo que se le pasa al modelo.
//
// ⚠️ ESTE MÓDULO HACE REQUESTS A UNA URL QUE ESCRIBE EL USUARIO. Es un SSRF de
// manual si se lo deja suelto: un cliente pega `http://169.254.169.254/…` (el
// metadata endpoint de la nube) o `http://10.0.0.5/admin` y el server se lo trae
// desde ADENTRO de la red, con la IP del server como origen. Las barandas:
//   1. Solo http/https. Nada de file:, gopher:, data:.
//   2. Se RESUELVE el hostname y se exige que TODAS sus IPs sean públicas
//      (bloquea loopback, link-local, privadas, CGNAT, multicast, IPv6 local).
//   3. Los redirects se siguen A MANO, revalidando cada salto con la regla 2
//      (un 302 a 127.0.0.1 es la forma clásica de saltearse el chequeo inicial).
//   4. Techo de tamaño y de tiempo: no se lee un stream infinito.
// El resultado NUNCA es confiable: lo envuelve contenidoNoConfiable() antes de
// llegar al prompt (lib/landing-analyst.ts).
// =============================================================================

import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { request as pedidoHttps } from 'node:https';
import { request as pedidoHttp } from 'node:http';
import { normalizarUrl } from './landing-url';

/** Techo de descarga: una landing de texto no pesa más que esto. */
const MAX_BYTES = 2_000_000;
/** Timeout de red por salto. */
const TIMEOUT_MS = 15_000;
/** Máximo de redirects que seguimos a mano. */
const MAX_REDIRECTS = 5;
/**
 * Debajo de esto asumimos que la página no se renderiza en el server (SPA de
 * Framer/Lovable/React que pinta todo en el cliente): tenemos HTML pero no
 * mensaje, y analizar eso da un diagnóstico inventado.
 */
const MIN_PALABRAS = 60;

const UA = 'Mozilla/5.0 (compatible; MaKoLandingAnalyst/1.0; +https://hola-mako.com)';

// ─────────────────────────────────────────────────────────────────────────────
// Normalización de la URL (la ENTIDAD de landing_analyses)
// ─────────────────────────────────────────────────────────────────────────────

// La normalización de la entidad que se analiza vive en lib/landing-url.ts desde el
// 06/10/2026 (sin `server-only`, para que tenga test y la use el análisis
// automático). Se re-exporta: sigue habiendo UNA.
export { normalizarUrl };

// ─────────────────────────────────────────────────────────────────────────────
// Baranda SSRF
// ─────────────────────────────────────────────────────────────────────────────

/** true si la IP NO es enrutable en internet (loopback, privada, link-local…). */
export function esIpPrivada(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = p;
    if (a === 0 || a === 10 || a === 127) return true;              // this-network, privada, loopback
    if (a === 169 && b === 254) return true;                         // link-local (metadata de la nube)
    if (a === 172 && b >= 16 && b <= 31) return true;                // privada
    if (a === 192 && b === 168) return true;                         // privada
    if (a === 100 && b >= 64 && b <= 127) return true;               // CGNAT
    if (a === 192 && b === 0) return true;                           // IETF protocol assignments
    if (a >= 224) return true;                                       // multicast + reservada
    return false;
  }
  if (v === 6) {
    const s = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (s === '::' || s === '::1') return true;                      // unspecified, loopback
    if (s.startsWith('fe80') || s.startsWith('fec0')) return true;   // link-local / site-local
    if (/^f[cd]/.test(s)) return true;                               // unique local (fc00::/7)
    if (s.startsWith('ff')) return true;                             // multicast
    // IPv4 MAPEADA — las DOS formas. La punteada (::ffff:127.0.0.1) es la que se
    // escribe a mano; la hexadecimal (::ffff:7f00:1) es a la que `new URL()`
    // NORMALIZA esa misma dirección. Mirar solo la punteada dejaba pasar
    // ::ffff:169.254.169.254 escrito por el usuario, porque para cuando se
    // evaluaba ya era ::ffff:a9fe:a9fe. Lo encontró una revisión adversarial.
    const punteada = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (punteada) return esIpPrivada(punteada[1]);
    const hexa = s.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexa) {
      const alto = parseInt(hexa[1], 16), bajo = parseInt(hexa[2], 16);
      return esIpPrivada(`${alto >> 8}.${alto & 255}.${bajo >> 8}.${bajo & 255}`);
    }
    return false;
  }
  return true; // no es una IP → no la dejamos pasar
}

export type UrlCheck =
  | { ok: true; url: URL; ips: string[] }
  | { ok: false; error: string };

/**
 * Valida un salto: esquema http/https + TODAS las IPs del host son públicas.
 * Se llama en CADA redirect, no solo al principio. Devuelve las IPs validadas
 * para que la conexión se clave a ellas (ver `agentePinneado`).
 */
export async function validarDestino(raw: string): Promise<UrlCheck> {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, error: 'La dirección no es una URL válida.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Solo se pueden analizar páginas http o https.' };
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  // Host que ya es una IP: se valida directo (no hay DNS que resolver).
  if (isIP(host)) {
    return esIpPrivada(host)
      ? { ok: false, error: 'Esa dirección apunta a una red interna, no a una página pública.' }
      : { ok: true, url: u, ips: [host] };
  }
  if (/^localhost$/i.test(host) || /\.local$/i.test(host) || /\.internal$/i.test(host)) {
    return { ok: false, error: 'Esa dirección apunta a una red interna, no a una página pública.' };
  }
  let ips: string[];
  try {
    const res = await lookup(host, { all: true });
    ips = res.map((r) => r.address);
  } catch {
    return { ok: false, error: `No se pudo resolver el dominio ${host}. ¿Está bien escrito?` };
  }
  if (!ips.length) return { ok: false, error: `El dominio ${host} no resuelve a ninguna dirección.` };
  // TODAS tienen que ser públicas: con una privada alcanza para abortar (un host
  // con A público y AAAA local sigue siendo un camino hacia adentro).
  if (ips.some(esIpPrivada)) {
    return { ok: false, error: 'Ese dominio resuelve a una red interna, no a una página pública.' };
  }
  return { ok: true, url: u, ips };
}

/**
 * Cierra el DNS REBINDING, que es lo que quedaba abierto: `validarDestino`
 * resuelve el host y comprueba que la IP sea pública, pero después el cliente
 * HTTP vuelve a resolver el MISMO nombre POR SU CUENTA. Un servidor DNS hostil
 * con TTL 0 contesta la IP pública en la primera consulta y 127.0.0.1 en la
 * segunda, y el chequeo no sirvió de nada — un TOCTOU de manual.
 *
 * Por eso NO se usa `fetch` acá: no deja intervenir la resolución. `node:https`
 * sí acepta `lookup`, así que se le devuelve la IP QUE YA SE VALIDÓ. El nombre
 * sigue viajando en el SNI (`servername`) y en el header Host, así que TLS y los
 * virtual hosts funcionan igual que siempre.
 */
function lookupClavado(ips: string[]): LookupFunction {
  const familia = (ip: string): 4 | 6 => (isIP(ip) === 6 ? 6 : 4);
  // La firma la fija Node (LookupFunction): el callback acepta una IP suelta o
  // la lista completa según `opts.all`, y hay que contemplar las dos.
  return ((_host, opts, cb) => {
    const elegidas = ips.map((ip) => ({ address: ip, family: familia(ip) }));
    if (opts && typeof opts === 'object' && opts.all) cb(null, elegidas);
    else cb(null, elegidas[0].address, elegidas[0].family);
  }) as LookupFunction;
}

type RespuestaCruda = { status: number; location: string | null; contentType: string; cuerpo: Buffer };

/**
 * Un pedido HTTP con las tres barandas puestas a la vez: la IP clavada, el
 * techo de tamaño aplicado MIENTRAS se lee (no después de bufferear todo) y un
 * plazo total que cubre también el cuerpo — no solo los headers, que era por
 * donde un servidor lento podía colgar la función hasta el corte de la
 * plataforma.
 */
function pedirPagina(url: URL, ips: string[]): Promise<RespuestaCruda> {
  return new Promise((resolve, reject) => {
    const esHttps = url.protocol === 'https:';
    const pedir = esHttps ? pedidoHttps : pedidoHttp;
    let cerrado = false;
    const fallar = (e: Error) => { if (!cerrado) { cerrado = true; reject(e); } };

    const req = pedir(url, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      lookup: lookupClavado(ips),
      ...(esHttps ? { servername: url.hostname } : {}),
    }, (res) => {
      const trozos: Buffer[] = [];
      let bytes = 0;
      res.on('data', (c: Buffer) => {
        bytes += c.length;
        if (bytes > MAX_BYTES) { res.destroy(); fallar(new Error('La página pesa demasiado para analizarla.')); return; }
        trozos.push(c);
      });
      res.on('end', () => {
        if (cerrado) return;
        cerrado = true;
        const loc = res.headers.location;
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(loc) ? loc[0] ?? null : loc ?? null,
          contentType: String(res.headers['content-type'] ?? ''),
          cuerpo: Buffer.concat(trozos),
        });
      });
      res.on('error', fallar);
    });

    const plazo = setTimeout(() => {
      req.destroy();
      fallar(new Error(`La página tardó más de ${TIMEOUT_MS / 1000}s en responder.`));
    }, TIMEOUT_MS);
    req.on('close', () => clearTimeout(plazo));
    req.on('error', (e) => fallar(new Error(`No se pudo conectar con la página: ${e.message}`)));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Descarga
// ─────────────────────────────────────────────────────────────────────────────

async function bajarHtml(url: string): Promise<{ html: string; final: string; bytes: number }> {
  let actual = url;
  for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
    // Se revalida EN CADA SALTO: un 302 hacia 127.0.0.1 es la forma clásica de
    // saltearse un chequeo que solo mira la primera URL.
    const check = await validarDestino(actual);
    if (!check.ok) throw new Error(check.error);

    const res = await pedirPagina(check.url, check.ips);

    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`La página respondió ${res.status} sin decir a dónde redirige.`);
      actual = new URL(res.location, check.url).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(res.status === 403 || res.status === 401
        ? `La página respondió ${res.status}: está bloqueando la lectura automática.`
        : `La página respondió ${res.status}.`);
    }
    if (res.contentType && !/text\/html|application\/xhtml|text\/plain/i.test(res.contentType)) {
      throw new Error(`Esa dirección no devuelve una página web (content-type: ${res.contentType.split(';')[0]}).`);
    }

    return {
      html: new TextDecoder('utf-8').decode(res.cuerpo),
      final: check.url.toString(),
      bytes: res.cuerpo.byteLength,
    };
  }
  throw new Error('La página redirige demasiadas veces.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción del copy
// ─────────────────────────────────────────────────────────────────────────────

/** Bloques que no son mensaje: se sacan enteros antes de leer nada. */
const RUIDO = /<(script|style|noscript|svg|iframe|template|head)\b[^>]*>[\s\S]*?<\/\1>/gi;
const COMENTARIOS = /<!--[\s\S]*?-->/g;

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: '’', aacute: 'á',
  eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿',
};

function decodificar(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n] ?? ENTIDADES[n.toLowerCase()] ?? m);
}

function limpiar(s: string): string {
  return decodificar(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Un bloque de copy en el orden en que lo lee un visitante. */
export type BloqueLanding = {
  /** h1 | h2 | h3 | texto | cta | lista */
  tipo: 'h1' | 'h2' | 'h3' | 'texto' | 'cta' | 'lista';
  texto: string;
};

export type LandingExtraida = {
  url: string;
  urlFinal: string;
  titulo: string;
  descripcion: string;
  bloques: BloqueLanding[];
  /** El copy plano, listo para el prompt. */
  texto: string;
  palabras: number;
  htmlBytes: number;
  fetchMs: number;
  /** true = hay HTML pero casi nada de texto (SPA que renderiza en el cliente). */
  bloqueada: boolean;
};

/** Etiquetas que aportan copy, en un solo barrido para conservar el ORDEN. */
const RE_BLOQUE = /<(h1|h2|h3|p|li|button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Un <a> solo cuenta como CTA si parece un botón (clase/rol) o es texto corto de acción. */
const RE_CTA_CLASE = /\b(btn|button|cta|action)\b/i;
const RE_CTA_TEXTO = /^(agenda|reserva|solicita|quiero|empez|comenz|descarg|regist|contrat|compr|apl(i|í)ca|hablemos|ver\s|cont(a|á)ct|book|get|start|schedule)/i;

function extraerBloques(html: string): BloqueLanding[] {
  const out: BloqueLanding[] = [];
  const vistos = new Set<string>();
  let m: RegExpExecArray | null;
  RE_BLOQUE.lastIndex = 0;
  while ((m = RE_BLOQUE.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? '';
    const texto = limpiar(m[3]);
    if (!texto || texto.length < 2) continue;
    if (texto.length > 1200) continue;                 // contenedor gigante: no es un bloque de copy

    let tipo: BloqueLanding['tipo'];
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') tipo = tag;
    else if (tag === 'button') tipo = 'cta';
    else if (tag === 'a') {
      const esCta = RE_CTA_CLASE.test(attrs) || (texto.length <= 40 && RE_CTA_TEXTO.test(texto));
      if (!esCta) continue;                             // link de navegación / legales → ruido
      tipo = 'cta';
    } else if (tag === 'li') tipo = 'lista';
    else tipo = 'texto';

    // Dedup: los menús y footers repiten el mismo texto muchas veces.
    const clave = `${tipo}:${texto.toLowerCase()}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ tipo, texto });
  }
  return out;
}

function meta(html: string, nombre: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nombre}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0] ?? '';
  return limpiar(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '');
}

/**
 * Baja la landing y le extrae el copy. NO tira por errores de la página: los
 * errores de red/HTTP sí (los captura el analyst y quedan en la fila).
 */
export async function extraerLanding(urlInput: string): Promise<LandingExtraida> {
  const t0 = Date.now();
  const url = normalizarUrl(urlInput);
  const { html, final, bytes } = await bajarHtml(url);

  const limpio = html.replace(COMENTARIOS, ' ').replace(RUIDO, ' ');
  // OJO: el <title> se busca en el HTML ORIGINAL, no en `limpio`. RUIDO elimina
  // el <head> entero (ahí viven scripts y estilos), y con él se llevaba puesto
  // el título — medido: example.com devolvía titulo:''.
  const titulo = limpiar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    || meta(html, 'og:title');
  const descripcion = meta(html, 'description') || meta(html, 'og:description');
  const bloques = extraerBloques(limpio);

  const texto = bloques
    .map((b) => (b.tipo === 'cta' ? `[BOTÓN] ${b.texto}` : b.tipo === 'lista' ? `• ${b.texto}` : b.tipo.startsWith('h') ? `${'#'.repeat(Number(b.tipo[1]))} ${b.texto}` : b.texto))
    .join('\n');
  const palabras = texto.split(/\s+/).filter(Boolean).length;

  return {
    url,
    urlFinal: final,
    titulo,
    descripcion,
    bloques,
    texto,
    palabras,
    htmlBytes: bytes,
    fetchMs: Date.now() - t0,
    bloqueada: palabras < MIN_PALABRAS,
  };
}
