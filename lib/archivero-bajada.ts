// =============================================================================
// archivero-bajada — las dos barandas del Archivero que miran lo que manda el cliente
// =============================================================================
// Auditoría de seguridad del 14/10/2026, dos hallazgos en app/api/onboarding/archivero/route.ts:
//
// 1. EL PATH DE UN ARCHIVO SUBIDO. La guarda era `path.startsWith(`${ws}/`)`, y `5/../7/<uuid>`
//    empieza con `5/`: storage-js arma la URL con el path tal cual, `fetch` normaliza el `..`, y
//    se bajaba (y si la lectura fallaba, se BORRABA) un archivo del workspace 7. El path no se
//    acepta más como viene: tiene que ser EXACTAMENTE el que acuña /archivero/upload-url,
//    `${ws}/${fileId}` con `fileId` un UUID. Así no hay nada que normalizar.
//
// 2. «SUMAR UNA WEB» ERA UN SSRF. La baranda miraba el TEXTO del host (`localhost.`,
//    `localtest.me` o `x.127.0.0.1.nip.io` pasaban, y resuelven a loopback) y `fetch` seguía los
//    redirects solo, sin revalidar ninguno: un 302 desde un host público a una IP interna llegaba.
//    Ahora cada salto pasa por `validarDestino` de lib/landing-fetch.ts (DNS + TODAS las IPs
//    públicas), la conexión va a la IP que se validó (sin rebinding) y los redirects se siguen a
//    mano.
//
// ⚠️ POR QUÉ HAY UNA COPIA DEL PEDIDO CON LA IP CLAVADA: lib/landing-fetch.ts la tiene
// (`pedirPagina`/`bajarHtml`), pero lo único que exporta es `htmlDePagina`, que NORMALIZA la URL
// —le saca el `www.` y el querystring, porque para Landing Analyst eso es la identidad de una
// landing—. El Archivero baja la página que pegó la persona tal cual: un sitio que sólo existe
// con `www.` dejaba de leerse. Mismo caso que lib/imagenes-stock.ts. Cuando landing-fetch exporte
// una bajada «tal cual» (su `bajarHtml` con `urlTalCual`), esta copia se borra.
//
// SIN `server-only`: las dos decisiones se EJECUTAN en tests/seguridad-tokens-linea-ssrf.test.ts
// (el salto a una IP interna, con un `validar` y un `pedir` de mentira).
// =============================================================================

import { isIP, type LookupFunction } from 'node:net';
import { request as pedidoHttps } from 'node:https';
import { request as pedidoHttp } from 'node:http';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Es éste el path que /archivero/upload-url le dio a este workspace para este archivo? Exacto:
 * nada de prefijos, así que ni `..` ni `//` ni un `%2e%2e` tienen por dónde entrar.
 */
export function pathSubidoValido(ws: number, fileId: string, path: string): boolean {
  if (!Number.isInteger(ws) || ws <= 0) return false;
  if (!UUID.test(fileId)) return false;
  return path === `${ws}/${fileId}`;
}

/** Techo de lo que se lee de una web pegada (antes: 3 MB, recortados DESPUÉS de bajarla entera). */
export const MAX_BYTES_WEB = 3 * 1024 * 1024;
/** Plazo por salto, cuerpo incluido. */
export const TIMEOUT_WEB_MS = 12_000;
/** Redirects que se siguen a mano. */
export const MAX_SALTOS_WEB = 5;

export type DestinoValidado = { ok: true; url: URL; ips: string[] } | { ok: false; error: string };
export type RespuestaWeb = { status: number; location: string | null; cuerpo: Buffer };
export type DepsBajada = {
  /** `validarDestino` de lib/landing-fetch.ts: esquema http(s) + TODAS las IPs públicas. */
  validar(url: string): Promise<DestinoValidado>;
  /** El pedido, a una de las IPs ya validadas (`pedirClavado`). */
  pedir(url: URL, ips: string[]): Promise<RespuestaWeb>;
};

/**
 * Baja una web siguiendo los redirects A MANO y revalidando CADA salto: un 302 hacia 127.0.0.1 es
 * la forma clásica de saltearse un chequeo que sólo mira la primera URL. Devuelve el cuerpo y el
 * status final; tira con un texto para la persona si un salto no es público o son demasiados.
 */
export async function bajarWebSegura(url: string, deps: DepsBajada): Promise<{ status: number; cuerpo: Buffer; final: string }> {
  let actual = url;
  for (let salto = 0; salto <= MAX_SALTOS_WEB; salto++) {
    const check = await deps.validar(actual);
    if (!check.ok) throw new Error(check.error);
    const res = await deps.pedir(check.url, check.ips);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new Error(`La web respondió ${res.status} sin decir a dónde redirige.`);
      actual = new URL(res.location, check.url).toString();
      continue;
    }
    return { status: res.status, cuerpo: res.cuerpo, final: check.url.toString() };
  }
  throw new Error('La web redirige demasiadas veces.');
}

/** Que el cliente HTTP use la IP QUE YA SE VALIDÓ, no la que resolvería por su cuenta (rebinding). */
function lookupClavado(ips: string[]): LookupFunction {
  const familia = (ip: string): 4 | 6 => (isIP(ip) === 6 ? 6 : 4);
  return ((_host, opts, cb) => {
    const elegidas = ips.map((ip) => ({ address: ip, family: familia(ip) }));
    if (opts && typeof opts === 'object' && opts.all) cb(null, elegidas);
    else cb(null, elegidas[0].address, elegidas[0].family);
  }) as LookupFunction;
}

/**
 * Un GET a la IP clavada, con techo de tamaño MIENTRAS se lee (pasado el techo se corta y se usa
 * lo leído, como antes se recortaba) y un plazo que cubre también el cuerpo. El nombre sigue
 * viajando en el SNI y en el Host, así que TLS y los virtual hosts andan igual.
 */
export function pedirClavado(url: URL, ips: string[]): Promise<RespuestaWeb> {
  return new Promise((resolve, reject) => {
    const esHttps = url.protocol === 'https:';
    const pedir = esHttps ? pedidoHttps : pedidoHttp;
    let cerrado = false;
    const fallar = (e: Error) => { if (!cerrado) { cerrado = true; reject(e); } };
    const req = pedir(url, {
      method: 'GET',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MaKoBot/1.0)', accept: 'text/html,application/xhtml+xml,*/*' },
      lookup: lookupClavado(ips),
      ...(esHttps ? { servername: url.hostname } : {}),
    }, (res) => {
      const trozos: Buffer[] = [];
      let bytes = 0;
      const terminar = () => {
        if (cerrado) return;
        cerrado = true;
        const loc = res.headers.location;
        resolve({ status: res.statusCode ?? 0, location: Array.isArray(loc) ? loc[0] ?? null : loc ?? null, cuerpo: Buffer.concat(trozos) });
      };
      res.on('data', (c: Buffer) => {
        if (cerrado) return;
        const resta = MAX_BYTES_WEB - bytes;
        trozos.push(c.length > resta ? c.subarray(0, resta) : c);
        bytes += c.length;
        if (bytes >= MAX_BYTES_WEB) { terminar(); res.destroy(); }
      });
      res.on('end', terminar);
      res.on('error', fallar);
    });
    const plazo = setTimeout(() => { req.destroy(); fallar(new Error(`La web tardó más de ${TIMEOUT_WEB_MS / 1000}s en responder.`)); }, TIMEOUT_WEB_MS);
    req.on('close', () => clearTimeout(plazo));
    req.on('error', (e) => fallar(new Error(`No se pudo conectar con la web: ${e.message}`)));
    req.end();
  });
}
