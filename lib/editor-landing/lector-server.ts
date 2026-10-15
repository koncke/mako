// =============================================================================
// editor-landing/lector-server — bajar el MÓDULO de una app para la ventana de lectura (tanda 6, b)
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de
// esa página.". Soluciona eso...». La landing del caso es una app de Vite: su JavaScript es un
// `<script type="module" crossorigin>` y su server no manda CORS, así que en la ventana aislada no carga
// (lector-pagina.ts, la cabecera). La ventana lo recibe EN LÍNEA: este módulo lo baja. Y lee lo PROPIO
// del negocio para el camino del Pixel (`paginasPropias`, verificación de la tanda 6).
//
// ⚠️ ES UN PEDIDO A UNA URL QUE SALE DE UNA PÁGINA DE AFUERA: las mismas barandas anti-SSRF que la bajada
//    del HTML (lib/landing-fetch.ts, que no exporta su pedido): `validarDestino` en CADA salto (sólo
//    http/https, todas las IPs públicas), la conexión CLAVADA a la IP validada (sin rebinding), techo de
//    tamaño MIENTRAS se lee, plazo total y redirecciones contadas. Y sólo JavaScript.
// =============================================================================

import 'server-only';
import { isIP, type LookupFunction } from 'node:net';
import { request as pedidoHttps } from 'node:https';
import { request as pedidoHttp } from 'node:http';
import { validarDestino } from '../landing-fetch';
import { getSetting } from '../settings';
import { LANDING_TOKEN_KEY } from '../landing-token';
import { CONFIG_KEY, parsearConfig, urlsDe } from '../landing-config';
import { PAGINAS_KEY, parsearPaginas } from '../landing-paginas';
import type { PaginasPropias } from './lector-pagina';

/** Un módulo de entrada de Vite pesa 0,3-2 MB; 4 MB deja aire sin leer un stream infinito. */
const MAX_BYTES = 4_000_000;
const PLAZO_MS = 8_000;
const MAX_SALTOS = 3;
const UA = 'Mozilla/5.0 (compatible; MaKo/1.0; +https://hola-mako.com)';

/** La IP que ya se validó, para que el cliente HTTP no vuelva a resolver (la misma idea que landing-fetch.ts). */
function lookupClavado(ips: string[]): LookupFunction {
  const familia = (ip: string): 4 | 6 => (isIP(ip) === 6 ? 6 : 4);
  return ((_host, opts, cb) => {
    const elegidas = ips.map((ip) => ({ address: ip, family: familia(ip) }));
    if (opts && typeof opts === 'object' && opts.all) cb(null, elegidas);
    else cb(null, elegidas[0].address, elegidas[0].family);
  }) as LookupFunction;
}

type Cruda = { status: number; location: string | null; tipo: string; cors: boolean; cuerpo: Buffer };

function pedir(url: URL, ips: string[]): Promise<Cruda> {
  return new Promise((resolve, reject) => {
    const esHttps = url.protocol === 'https:';
    let cerrado = false;
    const fallar = (e: Error) => { if (!cerrado) { cerrado = true; reject(e); } };
    const req = (esHttps ? pedidoHttps : pedidoHttp)(url, {
      method: 'GET',
      // `Origin` como lo mandaría la ventana aislada: así se ve si su server contesta CORS.
      headers: { 'user-agent': UA, accept: '*/*', origin: 'null' },
      lookup: lookupClavado(ips),
      maxHeaderSize: 65_536,
      ...(esHttps ? { servername: url.hostname } : {}),
    }, (res) => {
      const trozos: Buffer[] = [];
      let bytes = 0;
      res.on('data', (c: Buffer) => {
        bytes += c.length;
        if (bytes > MAX_BYTES) { res.destroy(); fallar(new Error('El script pesa demasiado.')); return; }
        trozos.push(c);
      });
      res.on('end', () => {
        if (cerrado) return;
        cerrado = true;
        const loc = res.headers.location;
        const acao = String(res.headers['access-control-allow-origin'] ?? '').trim();
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(loc) ? loc[0] ?? null : loc ?? null,
          tipo: String(res.headers['content-type'] ?? ''),
          cors: acao === '*' || acao === 'null',
          cuerpo: Buffer.concat(trozos),
        });
      });
      res.on('error', fallar);
    });
    const plazo = setTimeout(() => { req.destroy(); fallar(new Error('El script tardó demasiado.')); }, PLAZO_MS);
    req.on('close', () => clearTimeout(plazo));
    req.on('error', (e) => fallar(new Error(`No se pudo bajar el script: ${e.message}`)));
    req.end();
  });
}

/**
 * El código de un módulo de la página y si su server ya manda CORS (entonces carga solo y no hace falta
 * ponerlo en línea). Tira si no se pudo bajar o no es JavaScript.
 */
export async function bajarModulo(urlInput: string): Promise<{ codigo: string; cors: boolean }> {
  let actual = urlInput;
  for (let salto = 0; salto <= MAX_SALTOS; salto++) {
    const check = await validarDestino(actual);
    if (!check.ok) throw new Error(check.error);
    const r = await pedir(check.url, check.ips);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) throw new Error(`El script respondió ${r.status} sin decir a dónde.`);
      actual = new URL(r.location, check.url).toString();
      continue;
    }
    if (r.status < 200 || r.status >= 300) throw new Error(`El script respondió ${r.status}.`);
    if (!/javascript|ecmascript/i.test(r.tipo)) throw new Error(`No es un script (content-type: ${r.tipo.split(';')[0] || 'ninguno'}).`);
    return { codigo: new TextDecoder('utf-8').decode(r.cuerpo), cors: r.cors };
  }
  throw new Error('El script redirige demasiadas veces.');
}

/**
 * Lo PROPIO del negocio de la sesión para decidir el camino del Pixel (`vaALaPaginaReal`, lector-pagina.ts;
 * verificación de la tanda 6, seguridad): su token del Pixel y las landings que el admin DECLARÓ en
 * Integraciones (el formato nuevo, o el viejo si no hay). No las detectadas: ésas las escribe un endpoint
 * público. Si la lectura falla, nada es propio (se lee en la ventana aislada, que es lo seguro).
 */
export async function paginasPropias(): Promise<PaginasPropias> {
  try {
    const [token, config, viejas] = await Promise.all([getSetting(LANDING_TOKEN_KEY), getSetting(CONFIG_KEY), getSetting(PAGINAS_KEY)]);
    const declaradas = urlsDe(parsearConfig(config));
    return { token: token?.trim() || null, declaradas: declaradas.length ? declaradas : parsearPaginas(viejas) };
  } catch {
    return { token: null, declaradas: [] };
  }
}
