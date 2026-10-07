// =============================================================================
// calendly-error — ¿este error se arregla REINTENTANDO? (puro)
// =============================================================================
// Sin 'server-only' a propósito: tests/calendly-error.test.ts lo EJECUTA sobre errores
// medidos. Acá no se lee ni se escribe nada; el que contesta y anota es el webhook
// (app/api/webhooks/calendly/route.ts → `responderFalloDeProceso`).
//
// ⚠️⚠️ LA REGLA (AGENTS.md): UN WEBHOOK CONTESTA 5xx SÓLO A LO QUE SE ARREGLA REINTENTANDO.
// Un 5xx le dice a Calendly «reintentá», y Calendly reintenta un par de días y después
// DESHABILITA LA SUSCRIPCIÓN ENTERA, sin avisar. Un evento que falla SIEMPRE —un dato que no
// cierra, una excepción del código— no se arregla reintentándolo: sólo apaga la integración
// de todos. Pasó el 11/09 y otra vez el 21/09/2026 (tres cancelaciones del anfitrión en un
// minuto, y 4 reservas perdidas hasta el 06/10).
//
// ── QUÉ ES TRANSITORIO ───────────────────────────────────────────────────────
// Lo que mañana puede salir distinto con el MISMO cuerpo: la red (el pedido no llegó o la
// respuesta no volvió), un timeout, un 5xx/429/408 de un proveedor, y la base sin conexión o
// rechazando por carga (no por el dato). Todo lo demás —un 4xx, una restricción violada, una
// columna que no existe, una fila de más, un `TypeError` del código— no lo es.
//
// ⚠️ EN LA DUDA, NO TRANSITORIO. Es asimétrico a propósito: un evento anotado y contestado con
// 200 deja rastro y se puede recuperar; una suscripción deshabilitada pierde TODOS los que
// vengan, y no avisa. ⚠️ Y «se puede recuperar» tiene letra chica (medido el 06/10/2026):
// scripts/backfill-calendly.ts corre SÓLO sobre el ws1 (token y config del dueño) y una reserva
// que trae vuelve como lead con su reunión y su link, pero SIN lo que dispara el webhook —la
// bienvenida, el aviso al dueño, el CAPI, los flujos—. Una cancelación no la trae nunca. Por eso un error que no se reconoce
// cae del lado del 200, y por eso los patrones de abajo son FRASES y no palabras sueltas.
//
// ⚠️ LO QUE LLEGA AL CATCH CASI NUNCA ES EL ERROR ORIGINAL. lib/leads.ts envuelve el de
// Supabase en `new Error('Error buscando lead por email: ' + error.message)`: el `code`, el
// `status` y la causa se pierden y queda SOLO el texto. Por eso el clasificador lee el texto
// primero y los campos estructurados cuando vienen (un error crudo de undici, de `postgres` o
// de PostgREST). Las formas, medidas el 06/10/2026 con supabase-js 2.106 / postgrest-js 2.106.1
// y node 24 contra un server local y contra el pooler, están en el test, una por caso.
//
// ⚠️ NUNCA UN NÚMERO SUELTO. «Error actualizando lead 503: duplicate key…» y «Lead 504 no
// existe» (lib/leads.ts arma los dos con el id) llevan un 5xx adentro y son errores de DATO:
// un `\b5\d\d\b` los mandaría a reintentar para siempre. El código HTTP sólo cuenta pegado a
// algo que diga que ES un código (HTTP, status, el nombre de un proveedor, la frase del 5xx).
// =============================================================================

/** Hasta dónde se baja por `cause` / `errors`: una cadena de causas cíclica no puede colgar el webhook. */
const PROFUNDIDAD_MAX = 4;

/**
 * Lo que un error dice de sí mismo, en texto: `name`, `message`, `code`, `details` y `hint` (los
 * dos últimos los trae el error de PostgREST), y lo mismo de cada causa. Nunca lanza: un getter
 * que tira o un valor raro se saltean.
 */
function piezasDe(e: unknown, prof = 0, acc: string[] = []): string[] {
  if (e == null || prof > PROFUNDIDAD_MAX) return acc;
  if (typeof e === 'string') { acc.push(e); return acc; }
  if (typeof e !== 'object') return acc;
  const o = e as Record<string, unknown>;
  for (const k of ['name', 'message', 'code', 'details', 'hint']) {
    try {
      const v = o[k];
      if (typeof v === 'string' && v) acc.push(v);
    } catch { /* un getter que tira no es un dato */ }
  }
  try { if (o.cause != null) piezasDe(o.cause, prof + 1, acc); } catch { /* ídem */ }
  // AggregateError: undici prueba ::1 y 127.0.0.1 y, si los dos rebotan, la causa es un
  // AggregateError con mensaje VACÍO y los ECONNREFUSED adentro de `errors` (medido).
  try { if (Array.isArray(o.errors)) for (const x of o.errors.slice(0, 5)) piezasDe(x, prof + 1, acc); } catch { /* ídem */ }
  return acc;
}

/** Los `status` / `statusCode` NUMÉRICOS de un error y de sus causas. */
function statusDe(e: unknown, prof = 0, acc: number[] = []): number[] {
  if (e == null || typeof e !== 'object' || prof > PROFUNDIDAD_MAX) return acc;
  const o = e as Record<string, unknown>;
  try {
    for (const k of ['status', 'statusCode']) {
      const v = o[k];
      if (typeof v === 'number' && Number.isInteger(v)) acc.push(v);
    }
    if (o.cause != null) statusDe(o.cause, prof + 1, acc);
  } catch { /* ídem piezasDe */ }
  return acc;
}

/** Un código HTTP que dice «probá más tarde»: 408, 429 y los 5xx. */
const esStatusTransitorio = (s: number): boolean => s === 408 || s === 429 || (s >= 500 && s <= 599);

/**
 * Lo que es DETERMINISTA aunque viaje con la cara de un error de red, y gana sobre todo lo
 * demás. Los dos medidos: unos headers de más de 16 KB (un `.in()` con cientos de ids arma una
 * URL que no entra NUNCA) y un puerto que undici prohíbe (configuración). Los dos llegan como
 * «TypeError: fetch failed», que sin esto es red. Sólo se ven con el error CRUDO: envuelto por
 * lib/leads.ts queda «fetch failed» pelado, y ahí se reintenta.
 */
const DETERMINISTA = /HeadersOverflow|UND_ERR_HEADERS_OVERFLOW|headers exceeded server limits|\bbad port\b/i;

/** La red: el pedido no salió, o la respuesta no volvió. */
const RED = new RegExp([
  // `terminated`: el socket que se corta a MITAD de la respuesta. undici lo tira como
  // «TypeError: terminated» y lib/leads.ts lo envuelve sin el `details` que nombra el
  // SocketError, así que lo único que viaja es esa palabra. Medido el 06/10/2026 contra un
  // server que manda los headers, escribe medio cuerpo y corta: sin esto, un fallo de red
  // real pasaba a 200 y el evento se perdía. Con borde de palabra: «unterminated» no es esto.
  '\\bterminated\\b',
  'fetch failed', 'failed to fetch', 'network ?error', 'socket hang up', 'other side closed',
  'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'EPIPE',
  'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'ENETDOWN', 'EHOSTUNREACH',
  'UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT|SOCKET|CLOSED)',
].join('|'), 'i');

/** El otro lado no contestó a tiempo (el `fetch` con `AbortSignal.timeout`, el statement timeout de Postgres, PGRST003). */
const TIEMPO = /\btime-?outs?\b|\btimed out\b|TimeoutError|AbortError|\boperation was aborted\b/i;

/**
 * La base sin conexión o rechazando por CARGA, no por el dato. Las frases son las de Postgres,
 * PostgREST (PGRST000-003), Supavisor y el gateway de Supabase (Envoy/Kong).
 *
 * ⚠️ «schema cache» SOLA no: «Could not find the 'x' column of 'leads' in the schema cache» es
 * PGRST204 — el código escribe una columna que no existe (un deploy antes de su migración) y
 * eso falla igual en cada reintento. La transitoria es la de PGRST002, con la frase entera.
 */
const BASE = new RegExp([
  'could not connect', 'connection (?:refused|reset|terminated|timed out|closed|failure)',
  'connection to server', 'server closed the connection', 'terminating connection',
  'too many (?:clients|connections)', 'remaining connection slots', 'max client connections',
  'database system is (?:starting up|shutting down|in recovery)',
  'database connection error', 'database client error',
  'could not query the database for the schema cache', 'acquiring connection',
  'deadlock detected', 'could not serialize access', 'could not obtain lock',
  'canceling statement due to (?:statement timeout|lock timeout|conflict with recovery)',
  'no healthy upstream', 'upstream connect error', 'upstream request timeout',
  'invalid response was received from the upstream', 'upstream server is timing out',
].join('|'), 'i');

/** Los SQLSTATE / códigos de PostgREST transitorios, cuando el `code` viaja (el error crudo). */
const CODIGOS_TRANSITORIOS = new Set([
  '08000', '08001', '08003', '08004', '08006', '08007',  // la conexión
  '40001', '40P01',                                      // serialización y deadlock: reintentar ES la cura
  '53000', '53100', '53200', '53300', '53400',           // recursos (53300 = demasiadas conexiones)
  '55P03', '57014',                                      // lock no disponible · statement timeout
  '57P01', '57P02', '57P03', '57P05',                    // la base se reinicia o todavía no acepta
  '58000', '58030',                                      // error de sistema / de disco
  'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003',        // PostgREST sin base, o sin conexión en el pool
]);

/**
 * Un código HTTP de reintento, PEGADO a algo que diga que es un código. Las formas son las que
 * arman las libs del repo (`HTTP ${status}`, `Chatwoot ${status}: …`, `Fathom ${status} en …`) y
 * las que devuelve un gateway como cuerpo (`error code: 522` de Cloudflare, la página HTML
 * «502 Bad Gateway»). Ver la cabecera: un número suelto NO alcanza.
 */
const HTTP_TRANSITORIO = new RegExp([
  '\\b(?:HTTP(?:\\/\\d(?:\\.\\d)?)?|status(?:Code)?)["\']?\\s*[:=]?\\s*(?:408|429|5\\d\\d)\\b',
  '\\b(?:Chatwoot|Calendly|Meta|Fathom|Evolution|Resend|Supabase|PostgREST|GitHub|Panda|Graph API)\\s+(?:408|429|5\\d\\d)\\b',
  '\\berror code:\\s*5\\d\\d\\b',
  // «Temporarily»: la página de nginx dice «503 Service Temporarily Unavailable», y la frase
  // corta no la cubría (medido el 06/10/2026).
  'Bad Gateway', 'Service (?:Temporarily )?Unavailable', 'Gateway Time-?out', 'Internal Server Error',
  'Too Many Requests', 'Request Time-?out',
].join('|'), 'i');

/**
 * ⚠️ EL PROVEEDOR CONTESTÓ SIN CUERPO: un wrapper con la cola VACÍA.
 *
 * Un 502 o un 504 del gateway con el cuerpo vacío llega a supabase-js como `error.message: ''`
 * (postgrest-js hace JSON.parse('') y cae a `{ message: body }`), y lib/leads.ts lo envuelve
 * como «Error buscando lead por email: » — con el status perdido. Medido el 06/10/2026: daba
 * false y el evento se perdía con 200. Un error PERMANENTE de PostgREST siempre trae su JSON
 * con mensaje, así que la cola vacía sólo sale de un gateway que no contestó: se reintenta.
 */
const CUERPO_VACIO = /:\s*$/;

/**
 * ¿Este error se arregla REINTENTANDO el mismo evento? true → el webhook contesta 503 y Calendly
 * reintenta. false → contesta 200 y lo anota (ver la cabecera, y el porqué de que la duda sea
 * false). Nunca lanza.
 */
export function esErrorTransitorio(e: unknown): boolean {
  try {
    const piezas = piezasDe(e);
    const texto = piezas.join('\n');
    if (DETERMINISTA.test(texto)) return false;
    if (CUERPO_VACIO.test(mensajeDeError(e))) return true;
    if (statusDe(e).some(esStatusTransitorio)) return true;
    if (piezas.some((p) => CODIGOS_TRANSITORIOS.has(p.trim().toUpperCase()))) return true;
    return RED.test(texto) || TIEMPO.test(texto) || BASE.test(texto) || HTTP_TRANSITORIO.test(texto);
  } catch {
    return false;
  }
}

/** El mensaje de un error para un log o un cuerpo de respuesta. Nunca lanza. */
export function mensajeDeError(e: unknown): string {
  try {
    if (e instanceof Error) return e.message;
    if (typeof e === 'string') return e;
    if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') {
      return (e as { message: string }).message;
    }
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}

// =============================================================================
// La huella de lo que falló y se contestó 200: `calendly.fallos_proceso`
// =============================================================================
// Contestar 200 sin dejar nada escrito es tirar el evento con cara de recibido: «no llegó» y
// «falló adentro» se verían igual mirando la base, y los logs de Vercel duran minutos. Lo que
// se guarda es lo justo para RECUPERARLO: qué evento, qué reserva (el uuid del scheduled_event,
// el mismo que imprime scripts/backfill-calendly.ts), de quién, qué falló y cuándo.
//
// Vive en el setting del WORKSPACE DEL EVENTO, no en el de la plataforma: acá sí se sabe de quién
// es la reserva, y el email es de un lead que ese negocio QUERÍA y que el código no pudo cargar
// — no el de alguien que el producto decidió no ingestar, que es lo que la huella del «sin ruteo»
// se cuida de guardar. Una sola consulta los ve a todos:
//   select workspace_id, value from app_settings where key = 'calendly.fallos_proceso';
//
// Topea en `TOPE_FALLOS_PROCESO` entradas, las más RECIENTES: es una huella, no un log.

export const KEY_FALLOS_PROCESO = 'calendly.fallos_proceso';
export const TOPE_FALLOS_PROCESO = 30;
const TOPE_MENSAJE = 300;

export type FalloProceso = {
  /** ISO de cuándo falló. */
  cuando: string;
  /** El evento de Calendly (`invitee.created`, `invitee.canceled`). */
  evento: string;
  /** Qué rama del webhook: `ruteo` (antes de saber de quién es: va al super admin), `j2`, `j1`, `cancelacion` o `despacho` (lo que escapó a las tres). */
  rama: string;
  /** El uuid del scheduled_event (el último tramo de su URI): con él se encuentra en Calendly. */
  uuid: string | null;
  email: string | null;
  /** El mensaje del error, recortado. */
  mensaje: string;
};

export type HuellaFallosProceso = {
  /** ISO del último fallo anotado. */
  cuando: string;
  /** Cuántos se anotaron en total. Best-effort: se lee y se reescribe, dos simultáneos pueden perder uno. */
  veces: number;
  /** Los últimos, el más reciente primero. */
  ultimos: FalloProceso[];
};

const texto = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/** El uuid de una URI de Calendly (`…/scheduled_events/<uuid>`): el último tramo. */
export function uuidDeUri(uri: string | null | undefined): string | null {
  if (typeof uri !== 'string') return null;
  const t = uri.trim().replace(/\/+$/, '').split('/').pop() ?? '';
  return t ? t.slice(0, 80) : null;
}

/** Un fallo saneado: los campos con su tope, o null si no tiene lo mínimo (cuándo y qué evento). */
function falloSaneado(v: unknown): FalloProceso | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const cuando = texto(o.cuando, 40);
  const evento = texto(o.evento, 60);
  if (!cuando || !evento) return null;
  return {
    cuando,
    evento,
    rama: texto(o.rama, 20) ?? '—',
    uuid: texto(o.uuid, 80),
    email: texto(o.email, 200),
    mensaje: texto(o.mensaje, TOPE_MENSAJE) ?? '(sin mensaje)',
  };
}

/**
 * La huella guardada, saneada. Un valor ilegible empieza de cero: una fila rota no puede hacer
 * que el próximo fallo tampoco deje rastro. (Lo que NO empieza de cero es «no pude LEER»: eso lo
 * decide el que llama, que lee con `getSettingEstricto` y no pisa la huella si la lectura falló.)
 */
export function huellaFallosPrevia(crudo: string | null): HuellaFallosProceso {
  const vacia: HuellaFallosProceso = { cuando: '', veces: 0, ultimos: [] };
  if (!crudo) return vacia;
  try {
    const parsed: unknown = JSON.parse(crudo);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return vacia;
    const o = parsed as Record<string, unknown>;
    const ultimos = Array.isArray(o.ultimos)
      ? o.ultimos.map(falloSaneado).filter((f): f is FalloProceso => f !== null)
      : [];
    return {
      cuando: typeof o.cuando === 'string' ? o.cuando : '',
      veces: typeof o.veces === 'number' && Number.isFinite(o.veces) && o.veces >= 0 ? Math.floor(o.veces) : ultimos.length,
      ultimos,
    };
  } catch {
    return vacia;
  }
}

/**
 * Suma un fallo a la huella: queda primero, el total sube y se topea dejando los MÁS RECIENTES
 * (ordenados por `cuando`, no por cómo vinieran guardados). Puro: no lee ni escribe.
 */
export function sumarFalloProceso(
  previa: HuellaFallosProceso,
  fallo: FalloProceso,
  tope = TOPE_FALLOS_PROCESO,
): HuellaFallosProceso {
  const nuevo = falloSaneado(fallo);
  if (!nuevo) return previa;
  // `sort` es estable: con el mismo `cuando`, el nuevo (que va adelante) queda primero.
  const ultimos = [nuevo, ...previa.ultimos]
    .sort((a, b) => b.cuando.localeCompare(a.cuando))
    .slice(0, Math.max(1, tope));
  return { cuando: nuevo.cuando, veces: previa.veces + 1, ultimos };
}
