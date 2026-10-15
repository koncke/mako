// =============================================================================
// editor-landing/estilo-server — bajar el ESTILO de una página de afuera y copiar sus imágenes (tanda 6, d)
// =============================================================================
// Decisión de Martín (14/10/2026, docs/relevo/landing-generator.md, «Tanda 6» punto d): al replicar como
// landing «se COPIA el estilo (colores y fuentes leídos en el navegador → tema propio; imágenes al
// bucket), nada de fotos de stock». Lo puro (leer el estilo, armar el tema, dónde va cada imagen) vive en
// estilo-original.ts y estilo-aplicar.ts, con test; acá está lo que sale a la red:
//   · `estiloDeLaPagina`: cuando NO hubo lectura en el navegador, baja el HTML (la URL tal cual, con la
//     baranda de lib/landing-fetch.ts) y hasta `TOPES_ESTILO.hojas` hojas de estilo SUYAS (en una app de
//     Tailwind los colores viven en la hoja, no en el HTML) y se lo pasa a `estiloDeHtml`;
//   · `subirImagenes`: copia las imágenes del original a NUESTRO bucket público `landing-imagenes` con
//     `copiarUrlABucket` (lib/imagenes-stock.ts: la misma baranda SSRF —cada salto revalidado, la IP
//     clavada—, el tipo por magic bytes, nunca SVG y el tope de 15 MB de una imagen del editor). La que
//     falla deja el marcador: nunca se apunta a la imagen del tercero, que se rompe el día que la borra.
//
// ⚠️ LA HOJA SE BAJA CON SU PROPIA COPIA DEL PEDIDO CON BARANDA: landing-fetch.ts no exporta el suyo y su
//    `htmlDePagina` rechaza lo que no es HTML; lector-server.ts tiene otra copia que sólo acepta JavaScript.
//    Son cuatro copias del mismo pedido (landing-fetch, imagenes-stock, lector-server y ésta): el día que
//    landing-fetch exporte un `bajarTexto(url, { tipos, tope })`, las tres se van.
// =============================================================================

import 'server-only';
import { isIP, type LookupFunction } from 'node:net';
import { request as pedidoHttps } from 'node:https';
import { request as pedidoHttp } from 'node:http';
import { htmlDePagina, validarDestino } from '../landing-fetch';
import { copiarUrlABucket } from '../imagenes-stock';
import { BUCKET_LANDING } from './server-reglas';
import { baseDeDocumento } from './replicar-reglas';
import { TOPES_ESTILO, estiloDeHtml, estiloUtil, hojasDeHtml, type EstiloOriginal } from './estilo-original';

/** Una hoja de estilos de una app de Tailwind pesa 50-300 KB; 1,5 MB deja aire sin leer un stream infinito. */
const MAX_BYTES_HOJA = 1_500_000;
const PLAZO_HOJA_MS = 8_000;
const MAX_SALTOS = 3;
const UA = 'Mozilla/5.0 (compatible; MaKo/1.0; +https://hola-mako.com)';
/** Imágenes que se copian a la vez (cada una con su plazo de 25 s en copiarUrlABucket). */
const EN_PARALELO = 3;

function lookupClavado(ips: string[]): LookupFunction {
  const familia = (ip: string): 4 | 6 => (isIP(ip) === 6 ? 6 : 4);
  return ((_host, opts, cb) => {
    const elegidas = ips.map((ip) => ({ address: ip, family: familia(ip) }));
    if (opts && typeof opts === 'object' && opts.all) cb(null, elegidas);
    else cb(null, elegidas[0].address, elegidas[0].family);
  }) as LookupFunction;
}

type Cruda = { status: number; location: string | null; tipo: string; cuerpo: Buffer };

function pedir(url: URL, ips: string[]): Promise<Cruda> {
  return new Promise((resolve, reject) => {
    const esHttps = url.protocol === 'https:';
    let cerrado = false;
    const fallar = (e: Error) => { if (!cerrado) { cerrado = true; reject(e); } };
    const req = (esHttps ? pedidoHttps : pedidoHttp)(url, {
      method: 'GET',
      headers: { 'user-agent': UA, accept: 'text/css,text/plain;q=0.5' },
      lookup: lookupClavado(ips),
      maxHeaderSize: 65_536,
      ...(esHttps ? { servername: url.hostname } : {}),
    }, (res) => {
      const trozos: Buffer[] = [];
      let bytes = 0;
      res.on('data', (c: Buffer) => {
        bytes += c.length;
        if (bytes > MAX_BYTES_HOJA) { res.destroy(); fallar(new Error('La hoja pesa demasiado.')); return; }
        trozos.push(c);
      });
      res.on('end', () => {
        if (cerrado) return;
        cerrado = true;
        const loc = res.headers.location;
        resolve({ status: res.statusCode ?? 0, location: Array.isArray(loc) ? loc[0] ?? null : loc ?? null, tipo: String(res.headers['content-type'] ?? ''), cuerpo: Buffer.concat(trozos) });
      });
      res.on('error', fallar);
    });
    const plazo = setTimeout(() => { req.destroy(); fallar(new Error('La hoja tardó demasiado.')); }, PLAZO_HOJA_MS);
    req.on('close', () => clearTimeout(plazo));
    req.on('error', (e) => fallar(new Error(`No se pudo bajar la hoja: ${e.message}`)));
    req.end();
  });
}

/** El CSS de una hoja de la página. Tira si no se pudo bajar o no es CSS. */
export async function bajarHoja(urlInput: string): Promise<string> {
  let actual = urlInput;
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    // Revalidado en CADA salto: un 302 a 127.0.0.1 es la forma clásica de saltearse el chequeo.
    const check = await validarDestino(actual);
    if (!check.ok) throw new Error(check.error);
    const r = await pedir(check.url, check.ips);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) throw new Error(`La hoja respondió ${r.status} sin decir a dónde.`);
      actual = new URL(r.location, check.url).toString();
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw new Error(`La hoja respondió ${r.status}.`);
    if (r.tipo && !/text\/css|text\/plain/i.test(r.tipo)) throw new Error(`No es una hoja de estilos (${r.tipo.split(';')[0]}).`);
    return new TextDecoder('utf-8').decode(r.cuerpo);
  }
  throw new Error('La hoja redirige demasiadas veces.');
}

/**
 * El estilo de una página leído desde el server: su HTML (tal cual, con su www) y sus hojas. null si no
 * se pudo bajar o no trae nada usable. Nunca tira: sin estilo, la réplica nace como hasta hoy.
 */
export async function estiloDeLaPagina(url: string): Promise<EstiloOriginal | null> {
  try {
    const html = await htmlDePagina(url, { talCual: true });
    const base = baseDeDocumento(html, url);
    const hojas = await Promise.all(hojasDeHtml(html, base).slice(0, TOPES_ESTILO.hojas).map((h) => bajarHoja(h).catch((e) => {
      console.warn(`[editor-landing/estilo] hoja ${h}: ${e instanceof Error ? e.message : String(e)}`);
      return '';
    })));
    const e = estiloDeHtml(html, base, hojas);
    return estiloUtil(e) ? e : null;
  } catch (e) {
    console.warn(`[editor-landing/estilo] ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Copia las imágenes a `<ws>/<uuid>.<ext>` del bucket público de landings, de a `EN_PARALELO`, mientras
 * quede plazo (`hastaMs`). Devuelve original → copia, sólo de las que se copiaron. Nunca tira.
 */
export async function subirImagenes(urls: readonly string[], ws: number, hastaMs: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const cola = [...new Set(urls)];
  const trabajador = async () => {
    for (let u = cola.shift(); u; u = cola.shift()) {
      // Una copia puede tardar hasta 25 s (su plazo en copiarUrlABucket): no se empieza una que no llega.
      if (hastaMs - Date.now() < 26_000) return;
      try {
        const r = await copiarUrlABucket(u, BUCKET_LANDING, ws);
        if (r.ok) out.set(u, r.url);
        else console.warn(`[editor-landing/estilo] imagen ${u.slice(0, 160)}: ${r.error}`);
      } catch (e) {
        console.warn(`[editor-landing/estilo] imagen ${u.slice(0, 160)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(EN_PARALELO, cola.length) }, trabajador));
  return out;
}
