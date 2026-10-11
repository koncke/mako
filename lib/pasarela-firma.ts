// =============================================================================
// pasarela-firma — la firma de los avisos (webhooks) de Stripe y de Mercado Pago
// =============================================================================
// Puro y SIN `server-only`: un `route.ts` sólo exporta sus handlers, y el test lo ejecuta con vectores.
// Devuelve el MOTIVO del rechazo y no un booleano (molde: lib/standard-webhooks.ts), para que el 401
// diga si fue un secreto que falta, un reloj o una firma que no coincide.
//
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO. docs/hallazgos-planes-y-cobro.md decía que el webhook de
// pago era «envolverlo con verificarFirmaSvix». Para Stripe es FALSO, y el secreto lo disfraza: el de
// Stripe también empieza con `whsec_`, pero Stripe lo usa TAL CUAL como clave HMAC (UTF-8), y
// `claveDelSecreto` (Svix) le saca el prefijo y lo decodifica de base64 → «no coincide» en el 100%
// de los eventos, que se lee igual que un secreto mal pegado. Svix además firma en base64 con otros
// headers. Por eso este módulo NUNCA pasa por lib/standard-webhooks.ts.
//
// Fuentes (verificadas el 11/10/2026): docs.stripe.com/webhooks («Verify signatures manually») y
// mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks + el SDK oficial
// de Node (src/utils/webhook).

import crypto from 'node:crypto';

export type FalloFirmaPasarela = 'sin-secreto' | 'faltan-headers' | 'timestamp-invalido' | 'timestamp-viejo' | 'no-coincide';

export const MOTIVO_FIRMA_PASARELA: Readonly<Record<FalloFirmaPasarela, string>> = {
  'sin-secreto': 'no hay secreto para verificar el aviso',
  'faltan-headers': 'el aviso llegó sin firma',
  'timestamp-invalido': 'la firma trae una hora que no se entiende',
  'timestamp-viejo': 'la firma es de hace más de 5 minutos',
  'no-coincide': 'la firma no coincide',
};

/** Stripe: las librerías oficiales usan 5 minutos. 0 desactivaría el chequeo: nunca. */
export const TOLERANCIA_STRIPE_SEG = 300;

const hmacHex = (clave: string, msg: string): string =>
  crypto.createHmac('sha256', clave).update(msg, 'utf8').digest('hex');

/**
 * Comparación en tiempo constante. `timingSafeEqual` tira RangeError si los buffers miden distinto
 * EN BYTES (no en caracteres): eso sería un 500 sin autenticar ante una firma falsificada. Por eso el
 * largo se mira antes, en bytes (molde: lib/calendly.ts).
 */
function igualHex(esperada: string, recibida: string): boolean {
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(recibida.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Parte `t=…,v1=…,v1=…,v0=…` en pares SIN perder las claves repetidas. */
function pares(header: string): Array<[string, string]> {
  return header
    .split(',')
    .map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? null : ([p.slice(0, i).trim(), p.slice(i + 1).trim()] as [string, string]);
    })
    .filter((x): x is [string, string] => !!x && !!x[0]);
}

/**
 * `Stripe-Signature: t=1492774577,v1=5257a8…,v0=6ffbb5…`. El mensaje firmado es `${t}.${raw}` con el
 * cuerpo CRUDO sin tocar, HMAC-SHA256 hex con el `whsec_…` ENTERO como clave.
 *
 * ⚠️ PUEDE HABER VARIOS `v1`: mientras se rota el secreto (hasta 24 h) Stripe firma con los dos. Se
 * acepta si CUALQUIERA coincide — un parser con `Object.fromEntries` (el de lib/calendly.ts) se queda
 * con el último y rechaza tráfico legítimo justo durante la rotación. Y `v0` se IGNORA: es una firma
 * falsa que sólo aparece en los eventos de prueba.
 */
export function verificarFirmaStripe(
  raw: string,
  header: string | null,
  secret: string | null,
  ahoraSeg: number = Math.floor(Date.now() / 1000),
  toleranciaSeg: number = TOLERANCIA_STRIPE_SEG,
): FalloFirmaPasarela | null {
  if (!secret) return 'sin-secreto';
  if (!header) return 'faltan-headers';
  const ps = pares(header);
  const t = ps.find(([k]) => k === 't')?.[1];
  const v1s = ps.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || v1s.length === 0) return 'faltan-headers';
  if (!/^\d{1,12}$/.test(t)) return 'timestamp-invalido';
  if (Math.abs(ahoraSeg - Number(t)) > toleranciaSeg) return 'timestamp-viejo';
  const esperada = hmacHex(secret, `${t}.${raw}`);
  return v1s.some((v) => igualHex(esperada, v)) ? null : 'no-coincide';
}

/** La firma que pondría Stripe (para los tests y para probar un endpoint a mano). */
export const firmarStripe = (raw: string, secret: string, t: number): string => `t=${t},v1=${hmacHex(secret, `${t}.${raw}`)}`;

/**
 * El manifiesto que firma Mercado Pago: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Si falta
 * `data.id` o `x-request-id`, se SACA el par entero (lo dice la doc y lo hace el SDK oficial).
 *
 * `data.id` sale del QUERY de la URL (`?data.id=…`), no del cuerpo. La doc pide pasarlo a minúsculas
 * cuando es alfanumérico y el SDK oficial NO lo hace: los ids de pago son numéricos (ahí da igual), y
 * para los alfanuméricos se prueba con los dos — una notificación válida pasa con cualquiera de las
 * dos lecturas, y una falsificada no pasa con ninguna (la clave sigue siendo secreta).
 */
export function manifiestoMercadoPago(p: { dataId: string | null; requestId: string | null; ts: string }): string {
  return `${p.dataId ? `id:${p.dataId};` : ''}${p.requestId ? `request-id:${p.requestId};` : ''}ts:${p.ts};`;
}

/**
 * `x-signature: ts=1704908010,v1=618c8534…`. HMAC-SHA256 hex del manifiesto con la «clave secreta»
 * del panel de Mercado Pago (Tus integraciones → Webhooks). `ts` va en SEGUNDOS (la doc dice
 * milisegundos y su propio ejemplo y el SDK lo tratan como segundos). Sin tolerancia de reloj: MP
 * reintenta cada 15 minutos con la MISMA firma, y la protección contra la repetición es que el
 * webhook relee siempre el pago al proveedor (un aviso repetido sólo provoca una relectura).
 */
export function verificarFirmaMercadoPago(
  p: { dataId: string | null; requestId: string | null; header: string | null },
  secret: string | null,
): FalloFirmaPasarela | null {
  if (!secret) return 'sin-secreto';
  if (!p.header) return 'faltan-headers';
  const ps = pares(p.header);
  const ts = ps.find(([k]) => k === 'ts')?.[1];
  const v1 = ps.find(([k]) => k === 'v1')?.[1];
  if (!ts || !v1) return 'faltan-headers';
  if (!/^\d{1,16}$/.test(ts)) return 'timestamp-invalido';
  const ids = new Set([p.dataId, p.dataId && /[A-Za-z]/.test(p.dataId) ? p.dataId.toLowerCase() : p.dataId]);
  for (const dataId of ids) {
    if (igualHex(hmacHex(secret, manifiestoMercadoPago({ dataId, requestId: p.requestId, ts })), v1)) return null;
  }
  return 'no-coincide';
}

/** La firma que pondría Mercado Pago (para los tests). */
export const firmarMercadoPago = (p: { dataId: string | null; requestId: string | null; ts: string }, secret: string): string =>
  `ts=${p.ts},v1=${hmacHex(secret, manifiestoMercadoPago(p))}`;
