// =============================================================================
// push-apns — manda a los iPhones de la app, por HTTP/2 a Apple (server-only, 3/11/2026)
// =============================================================================
// Lo que se manda, puro y con test: lib/push-apns-reglas.ts. Las claves viven en `credenciales` del workspace de PLATAFORMA, como las de
// VAPID, y las pega Martín en Integraciones (lib/integraciones-catalogo.ts y lib/metodo-catalogo.ts): nunca en variables de Vercel, y un chat nunca las ve.
//
// ⚠️ SIN CLAVES NO SALE NADA Y NO SE BORRA NADA: la fila sigue, y se cuenta como un fallo de ese envío. Hasta que Martín abra su cuenta de Apple
//    no hay iPhones, así que este camino no corre para nadie.
// ⚠️ NUNCA LANZA, como `enviarPush`: un aviso que no llegó no puede tumbar el cron que lo emitió.
// =============================================================================

import 'server-only';
import http2 from 'node:http2';
import { credWsEstricta } from './credenciales';
import { wsSuperAdmin } from './workspace';
import { HOST_APNS, clavesApnsDe, jwtApns, tokenDeEndpoint, type ClavesApns, type EnvioApns } from './push-apns-reglas';

const TIMEOUT_MS = 10_000;
const REUSO_JWT_MS = 50 * 60_000;
const REINTENTO_SIN_CLAVES_MS = 60_000;

// ⚠️ DOS MEMORIAS Y NO UNA: la primera versión guardaba el JWT adentro de la de las claves, y firmar con unas claves «de paso» las dejaba cargadas
// para el próximo `clavesApns()`. Un test sin claves terminó mandándole un pedido de verdad a Apple.
type Memoria = { claves: ClavesApns | null; hasta: number };
const g = globalThis as typeof globalThis & { __makoApns?: Memoria; __makoApnsJwt?: { keyId: string; valor: string; hasta: number } };

export async function clavesApns(): Promise<ClavesApns | null> {
  const ahora = Date.now();
  if (g.__makoApns && g.__makoApns.hasta > ahora) return g.__makoApns.claves;
  let claves: ClavesApns | null = null;
  try {
    const ws = await wsSuperAdmin();
    // Producción siempre: TestFlight y el App Store usan la misma, y sin una Mac no hay builds de desarrollo.
    const [keyId, teamId, p8] = await Promise.all(['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_P8'].map((k) => credWsEstricta(k, ws)));
    claves = clavesApnsDe({ keyId, teamId, p8 });
    if (!claves) console.warn('[push] sin las claves de APNs (Settings › Integraciones › Apple Push): los iPhones no reciben avisos.');
  } catch (e) {
    console.error('[push] no pude leer las claves de APNs:', e instanceof Error ? e.message : String(e));
  }
  g.__makoApns = { claves, hasta: claves ? ahora + 10 * 60_000 : ahora + REINTENTO_SIN_CLAVES_MS };
  return claves;
}

function jwtVigente(c: ClavesApns): string {
  const ahora = Date.now();
  const m = g.__makoApnsJwt;
  if (m && m.keyId === c.keyId && m.hasta > ahora) return m.valor;
  const valor = jwtApns(c, ahora);
  g.__makoApnsJwt = { keyId: c.keyId, valor, hasta: ahora + REUSO_JWT_MS };
  return valor;
}

export type RespuestaApns = { status: number | null; razon: string | null };

/**
 * Manda un mensaje a varios tokens por UNA conexión (lo que Apple pide: abrir una por aviso se lee como un ataque).
 * `host`: sólo para el servidor local de tests/push-apns.test.ts.
 */
export async function enviarApns(endpoints: string[], envio: EnvioApns, c: ClavesApns, host: string = HOST_APNS): Promise<RespuestaApns[]> {
  if (!endpoints.length) return [];
  const sesion = http2.connect(host);
  sesion.on('error', () => {});
  const uno = (endpoint: string) => new Promise<RespuestaApns>((resolve) => {
    let status: number | null = null;
    let cuerpo = '';
    let fin = false;
    const terminar = (r: RespuestaApns) => { if (!fin) { fin = true; resolve(r); } };
    try {
      const pedido = sesion.request({
        ':method': 'POST', ':path': `/3/device/${tokenDeEndpoint(endpoint)}`,
        authorization: `bearer ${jwtVigente(c)}`, 'content-type': 'application/json', ...envio.cabeceras,
      });
      pedido.setEncoding('utf8');
      pedido.setTimeout(TIMEOUT_MS, () => { pedido.close(); terminar({ status: null, razon: 'sin respuesta' }); });
      pedido.on('response', (h) => { status = Number(h[':status']) || null; });
      pedido.on('data', (d) => { cuerpo += d; });
      pedido.on('error', (e) => terminar({ status: null, razon: e.message }));
      pedido.on('end', () => {
        let razon: string | null = null;
        try { razon = cuerpo ? (JSON.parse(cuerpo) as { reason?: string }).reason ?? null : null; } catch { razon = cuerpo.slice(0, 120) || null; }
        terminar({ status, razon });
      });
      pedido.end(envio.cuerpo);
    } catch (e) {
      terminar({ status: null, razon: e instanceof Error ? e.message : String(e) });
    }
  });
  try {
    return await Promise.all(endpoints.map(uno));
  } finally {
    sesion.close();
  }
}
