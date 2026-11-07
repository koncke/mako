// =============================================================================
// pasarela-firma — la firma de los avisos (webhooks) de Stripe, Mercado Pago, Creem y dLocal Go
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

/**
 * `creem-signature: dd7bdd2c…` — HMAC-SHA256 hex del CUERPO CRUDO Y NADA MÁS, con el secreto del aviso como clave.
 * Verificado en pantalla el 31/10/2026 (docs.creem.io/code/webhooks): «The signature is generated using the HMAC-SHA256
 * algorithm with the webhook secret as the key, and the request payload as the message».
 *
 * Es más simple que Stripe: no hay `t=`, no hay esquema versionado, no hay prefijo. Y por eso mismo hay que decir qué
 * NO protege:
 *
 * ⚠️ SIN TIMESTAMP NO HAY PROTECCIÓN CONTRA LA REPETICIÓN. Una firma válida capturada vale para siempre: quien pueda
 *    repetir el cuerpo entero puede reenviarlo. Lo que cubre ese hueco NO es esta función, es la deduplicación por el
 *    `id` del evento (`evt_…`) en `pasarela_eventos` y la relectura del recurso a Creem antes de aplicar. Por eso el
 *    webhook deduplica ANTES de aplicar y nunca se cree el monto del cuerpo.
 *    Y el detalle fino que la doc aclara: los reintentos automáticos CONSERVAN el `id`, pero un reenvío a mano desde el
 *    panel llega con un `id` NUEVO — así que la deduplicación no protege de un reenvío manual, y de ahí que lo que se
 *    aplica salga de releer el estado y no de contar eventos.
 *
 * ⚠️ FAIL-CLOSED, al revés que Mercado Pago (que se relee igual sin secreto): acá «sin secreto» es un RECHAZO. En MP el
 *    aviso es flaco (un id) y la seguridad real es la relectura obligatoria; un aviso falso sólo provoca una lectura.
 *    El de Creem trae el objeto entero y el `eventType`, así que aceptar sin verificar sería dejar que cualquiera
 *    POSTee `subscription.paid` y se dé de alta un plan. Mientras no esté el secreto, el webhook de Creem rechaza todo:
 *    es la decisión del brief, y es la correcta.
 *
 * El ejemplo oficial de la doc hace `JSON.stringify(req.body)` para armar el mensaje: eso está MAL y hay que no
 * copiarlo. Re-serializar cambia bytes (orden de claves, unicode, espaciado) y la firma deja de coincidir en cuanto el
 * cuerpo trae un nombre con acento. Esta función recibe el `raw` tal como llegó (`req.text()`).
 */
export function verificarFirmaCreem(raw: string, header: string | null, secret: string | null): FalloFirmaPasarela | null {
  if (!secret) return 'sin-secreto';
  if (!header) return 'faltan-headers';
  // Hex pelado de 64 caracteres: nada que partir en pares. Un header con otra forma es «faltan-headers» y no
  // «no-coincide», para que el log distinga «Creem cambió el formato» de «el secreto está mal».
  const v = header.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(v)) return 'faltan-headers';
  return igualHex(hmacHex(secret, raw), v) ? null : 'no-coincide';
}

/** La firma que pondría Creem (para los tests y para probar el endpoint a mano). */
export const firmarCreem = (raw: string, secret: string): string => hmacHex(secret, raw);

// ── dLocal Go ────────────────────────────────────────────────────────────────────────────────────
// Fuente: docs.dlocalgo.com/integration-api/welcome-to-dlocal-go-api/payments/notifications, leída
// el 06/11/2026.

/** El prefijo EXACTO del header, con su coma y su espacio. Afuera para que el test lo fije. */
export const PREFIJO_FIRMA_DLOCAL = 'V2-HMAC-SHA256, Signature: ';

/**
 * El mensaje que firma dLocal Go: la API KEY pegada adelante del cuerpo crudo, SIN separador.
 *
 * ⚠️ ES EL ÚNICO DE LOS CUATRO QUE METE UNA CREDENCIAL ADENTRO DEL MENSAJE. Stripe firma `t.raw`,
 * Mercado Pago un manifiesto de ids y Creem el cuerpo pelado; acá el mensaje es `apiKey + raw` y la
 * clave HMAC es la SECRET key. La consecuencia de diseño, que es la que importa: **verificar un
 * aviso de dLocal necesita LAS DOS claves del negocio**, no un secreto de webhook aparte. Un
 * receptor que tenga una sola nunca va a poder verificar nada — y es justo el error que se comete
 * copiando la forma de Creem, que sí tiene su `CREEM_WEBHOOK_SECRET` separado.
 *
 * Y como la api key no lleva separador, firmar con un `.` en el medio (la analogía con Stripe) o al
 * revés da «no coincide» en el 100% de los avisos, que se lee igual que una clave mal pegada. Por
 * eso el test fija el vector oficial de la doc.
 */
export const manifiestoDlocal = (apiKey: string, raw: string): string => `${apiKey}${raw}`;

/**
 * `Authorization: V2-HMAC-SHA256, Signature: <hex>` sobre el cuerpo CRUDO.
 *
 * FAIL-CLOSED, igual que Creem y al revés que Mercado Pago: sin las dos claves es un RECHAZO. El
 * motivo es el mismo que el de Creem — el aviso de MP es flaco (un id) y la seguridad real es la
 * relectura, así que uno falso sólo provoca una lectura. El de dLocal también es flaco
 * (`{"payment_id": "..."}`), pero dLocal **firma todas** sus notificaciones, así que aceptar una sin
 * firma sería renunciar a una verificación que el proveedor sí da.
 *
 * ⚠️ SIN TIMESTAMP NO HAY PROTECCIÓN CONTRA LA REPETICIÓN, igual que en Creem: una firma válida
 * capturada vale para siempre. Lo que cubre ese hueco no es esta función, es la deduplicación en
 * `pasarela_eventos` y la relectura del pago antes de aplicar.
 */
export function verificarFirmaDlocal(
  raw: string,
  header: string | null,
  claves: { apiKey: string | null; secret: string | null },
): FalloFirmaPasarela | null {
  if (!claves.apiKey || !claves.secret) return 'sin-secreto';
  if (!header) return 'faltan-headers';
  // El prefijo se compara sin distinguir mayúsculas y tolerando espacios de más: lo que autentica es
  // el HMAC, y rechazar por un espacio dejaría afuera tráfico legítimo si dLocal cambia el formato.
  const i = header.toUpperCase().indexOf('SIGNATURE:');
  if (!header.toUpperCase().trimStart().startsWith('V2-HMAC-SHA256') || i < 0) return 'faltan-headers';
  const recibida = header.slice(i + 'SIGNATURE:'.length).trim();
  // Hex de 64: otra forma es «faltan-headers» y no «no-coincide», para que el log distinga «dLocal
  // cambió el formato» de «la clave está mal» (el mismo criterio que en Creem).
  if (!/^[0-9a-fA-F]{64}$/.test(recibida)) return 'faltan-headers';
  return igualHex(hmacHex(claves.secret, manifiestoDlocal(claves.apiKey, raw)), recibida) ? null : 'no-coincide';
}

/** La firma que pondría dLocal Go (para los tests y para probar el endpoint a mano). */
export const firmarDlocal = (raw: string, claves: { apiKey: string; secret: string }): string =>
  `${PREFIJO_FIRMA_DLOCAL}${hmacHex(claves.secret, manifiestoDlocal(claves.apiKey, raw))}`;
