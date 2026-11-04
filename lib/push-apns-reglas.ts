// =============================================================================
// push-apns-reglas — lo que se le manda a Apple para que suene el iPhone, PURO (3/11/2026)
// =============================================================================
// Web Push no existe adentro de una app con WebView en iOS: sólo en la web instalada. La app de iPhone recibe por APNs, con el token que da
// `@capacitor/push-notifications`. El catálogo, las preferencias por persona, el TTL y la urgencia son los MISMOS del Web Push:
// sólo cambia el último tramo (lib/push.ts → `despachar`).
//
// La fila vive en `push_suscripciones`, como cualquier otra, y NO hizo falta tocar la tabla: `endpoint` es `apns:<token>` (único, como los
// demás) y `p256dh`/`auth`, que son obligatorias y acá no significan nada, llevan una marca. Un endpoint que empieza con `apns:` no pasa
// por `endpointPermitido` y nunca le llega a web-push: va siempre a api.push.apple.com, así que no abre ningún SSRF.
//
// Sólo con `node:crypto` y sin `server-only`: un test tiene que poder armarlo y romperlo.
// =============================================================================

import { createPrivateKey, createSign } from 'node:crypto';
import type { PayloadPush } from './push-payload';

export const BUNDLE_ID = 'com.holamako.app';
export const HOST_APNS = 'https://api.push.apple.com';

/** Lo que va en `p256dh` y `auth` de una fila de APNs: las columnas son `not null`, con largo mínimo. */
export const MARCA_SIN_CLAVE_APNS = 'apns-sin-clave';

const PREFIJO = 'apns:';

/** Un token de APNs es hexadecimal. 64 hoy, pero Apple avisa que puede crecer (hasta 100 bytes). */
export const tokenApnsValido = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-fA-F]{32,200}$/.test(t);
export const endpointDeApns = (token: string): string => `${PREFIJO}${token.toLowerCase()}`;
export const esEndpointApns = (endpoint: string | null | undefined): boolean => String(endpoint ?? '').startsWith(PREFIJO);
export const tokenDeEndpoint = (endpoint: string): string => endpoint.slice(PREFIJO.length);

export type ClavesApns = { keyId: string; teamId: string; p8: string };

/** Las tres credenciales, ya normalizadas. `null` = todavía no están. Se pegan en Método: un pegado puede perder los saltos de la .p8. */
export function clavesApnsDe(v: { keyId?: string | null; teamId?: string | null; p8?: string | null }): ClavesApns | null {
  const keyId = String(v.keyId ?? '').trim();
  const teamId = String(v.teamId ?? '').trim();
  const cuerpo = String(v.p8 ?? '').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  if (!/^[A-Z0-9]{10}$/.test(keyId) || !/^[A-Z0-9]{10}$/.test(teamId) || cuerpo.length < 40) return null;
  const lineas = cuerpo.match(/.{1,64}/g) ?? [];
  return { keyId, teamId, p8: `-----BEGIN PRIVATE KEY-----\n${lineas.join('\n')}\n-----END PRIVATE KEY-----\n` }; // claves-en-el-diff: ok
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/**
 * El token con el que MaKo se presenta ante Apple: un JWT ES256 firmado con la .p8. Apple lo acepta hasta 60 minutos y rechaza con
 * `TooManyProviderTokenUpdates` a quien lo cambia más de una vez cada 20, así que se reusa 50 minutos (lib/push-apns.ts).
 */
export function jwtApns(c: ClavesApns, ahoraMs: number = Date.now()): string {
  const cabecera = b64u(JSON.stringify({ alg: 'ES256', kid: c.keyId }));
  const cuerpo = b64u(JSON.stringify({ iss: c.teamId, iat: Math.floor(ahoraMs / 1000) }));
  const firma = createSign('SHA256').update(`${cabecera}.${cuerpo}`).sign({ key: createPrivateKey(c.p8), dsaEncoding: 'ieee-p1363' });
  return `${cabecera}.${cuerpo}.${b64u(firma)}`;
}

export type EnvioApns = { cabeceras: Record<string, string>; cuerpo: string };

/**
 * Lo que viaja. El TTL es `apns-expiration` (una FECHA, no segundos: 0 significa «ahora o nunca») y sólo `high` despierta el teléfono
 * (`apns-priority: 10`), igual que la urgencia del Web Push. `url` va afuera de `aps`: la lee la app al tocar (lib/nativo.ts).
 */
export function armarApns(p: PayloadPush, o: { ttlSegundos: number; urgencia: string; ahoraMs?: number }): EnvioApns {
  const ahora = Math.floor((o.ahoraMs ?? Date.now()) / 1000);
  return {
    cabeceras: {
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': o.urgencia === 'high' ? '10' : '5',
      'apns-expiration': String(o.ttlSegundos > 0 ? ahora + Math.floor(o.ttlSegundos) : 0),
      // El mismo aviso reemplaza al anterior, como el `tag` del Web Push. Hasta 64 bytes, y sólo ASCII: una raya o un emoji en una cabecera de HTTP/2 mata el
      // pedido (NGHTTP2_PROTOCOL_ERROR, medido), y ese aviso no llegaría nunca.
      'apns-collapse-id': p.tag.replace(/[^A-Za-z0-9:_.-]+/g, '-').slice(0, 64),
    },
    cuerpo: JSON.stringify({
      aps: { alert: { title: p.titulo, body: p.cuerpo }, sound: 'default', ...(typeof p.badge === 'number' ? { badge: p.badge } : {}) },
      url: p.url,
    }),
  };
}

/**
 * Qué hacer con una fila después de que Apple contestó. Sólo se borra lo que MURIÓ: 410 (se desinstaló) y un token que no es de esta app.
 * Un error nuestro (la clave mal cargada, 403) NO borra: si no, una .p8 equivocada dejaría sin avisos a todos los iPhones.
 */
export function accionTrasErrorApns(status: number | null, razon: string | null | undefined): 'borrar' | 'fallo' {
  if (status === 410) return 'borrar';
  if (status === 400 && (razon === 'BadDeviceToken' || razon === 'DeviceTokenNotForTopic')) return 'borrar';
  return 'fallo';
}
