// =============================================================================
// zernio-redes — las redes que se conectan «vía Zernio», y lo PURO de conectarlas (23/10/2026)
// =============================================================================
// Martín: «Que ellos conecten su API de Zernio y luego cuando quieran hacer X cosa que requiera un login, que en MaKo esté
// el botón de logearse con Facebook, Instagram o lo que haga falta». Esta es la parte sin red y sin pantalla de esa pieza:
// la comparten el servidor (lib/zernio-conectar.ts), la pantalla (app/_components/ConectarViaZernio.tsx) y los tests, y por eso
// NO importa nada de la app (ni `server-only`, ni React).
//
// LO QUE SE SABE DE LA API DE ZERNIO (leído en docs.zernio.com el 23/10/2026 por un resumidor: los NOMBRES de los campos
// pueden venir parafraseados, y por eso todo lo que se lee de una respuesta es TOLERANTE y falla cerrado):
//   · `GET /v1/connect/{plataforma}?profileId&redirect_url` → `{ authUrl, state }`. Al volver, el navegador llega a
//     `redirect_url` con `connected=<plataforma>&profileId&accountId&username`, o con `error=<código>&platform&request_id&stage`.
//   · Anuncios de Meta: `GET /v1/connect/facebook/ads` (con `loginMode=business` crea una conexión `metaads` aparte).
//   · Página, Instagram y cuenta publicitaria se conectan POR SEPARADO, y cada una cuenta aparte para el cobro de Zernio.
//   · Un login re-hecho sobre una cuenta que ya estaba NO cambia su id: por eso «conectada» no es sólo «apareció una nueva».
//
// ⚠️ LA VERDAD LA DICE EL SERVIDOR, NUNCA EL NAVEGADOR (Nango, Ayrshare): lo que trae la URL de vuelta o el mensaje del popup es
// una PISTA para medir antes, nunca la medición. «Conectada» sale de `GET /v1/accounts` (`medirConexion`).

// ── El catálogo ──────────────────────────────────────────────────────────────

export type RedDef = {
  etiqueta: string;
  /** El `platform` con que aparece la cuenta en `GET /v1/accounts`. */
  plataforma: string;
  /** El tramo de `GET /v1/connect/<ruta>`. */
  ruta: string;
  /** Una conexión de ANUNCIOS (su cuenta es aparte de la de publicación). */
  anuncios: boolean;
  /** Parámetros fijos de la consulta del link. */
  params?: Readonly<Record<string, string>>;
  /** Una línea para la fila de la pantalla. */
  ayuda: string;
  /** ¿La pantalla de hoy la ofrece? Las demás están en el catálogo para «lo que haga falta», sin medir con una cuenta real. */
  visible: boolean;
};

export const REDES = {
  facebook: { etiqueta: 'Facebook', plataforma: 'facebook', ruta: 'facebook', anuncios: false, ayuda: 'Tu página: mensajes y comentarios.', visible: true },
  instagram: { etiqueta: 'Instagram', plataforma: 'instagram', ruta: 'instagram', anuncios: false, ayuda: 'Tu cuenta de empresa o de creador.', visible: true },
  // `loginMode=business` (medido por Ads Manager): crea una conexión `metaads` independiente, con el token de un usuario del
  // sistema. Pide una página de Facebook y que quien entre sea admin del Business.
  metaads: { etiqueta: 'Anuncios de Meta', plataforma: 'metaads', ruta: 'facebook/ads', anuncios: true, params: { loginMode: 'business' }, ayuda: 'Tu cuenta publicitaria, para publicar anuncios.', visible: true },
  linkedin: { etiqueta: 'LinkedIn', plataforma: 'linkedin', ruta: 'linkedin', anuncios: false, ayuda: 'Tu perfil o tu página.', visible: false },
  // Visible desde el 29/10/2026 (ticket #28: «Facebook, Instagram, TikTok, YouTube», todo en el paso 2 de Zernio). El Calendario ya
  // publica en TikTok (lib/calendario-publicar-reglas.ts).
  tiktok: { etiqueta: 'TikTok', plataforma: 'tiktok', ruta: 'tiktok', anuncios: false, ayuda: 'Tu cuenta de TikTok.', visible: true },
  // Visible desde el 27/10/2026 (feedback 876470842-22): el canal se conecta con el login de Zernio, no pegando una clave.
  youtube: { etiqueta: 'YouTube', plataforma: 'youtube', ruta: 'youtube', anuncios: false, ayuda: 'Tu canal.', visible: true },
  twitter: { etiqueta: 'X', plataforma: 'twitter', ruta: 'twitter', anuncios: false, ayuda: 'Tu cuenta de X.', visible: false },
  threads: { etiqueta: 'Threads', plataforma: 'threads', ruta: 'threads', anuncios: false, ayuda: 'Tu cuenta de Threads.', visible: false },
  pinterest: { etiqueta: 'Pinterest', plataforma: 'pinterest', ruta: 'pinterest', anuncios: false, ayuda: 'Tu cuenta de Pinterest.', visible: false },
  googlebusiness: { etiqueta: 'Google Business', plataforma: 'googlebusiness', ruta: 'googlebusiness', anuncios: false, ayuda: 'La ficha de tu negocio en Google.', visible: false },
} as const satisfies Record<string, RedDef>;

export type RedZernio = keyof typeof REDES;

/** `Object.hasOwn`, no `in`: «toString», «constructor» y «__proto__» no son redes. */
export const esRedZernio = (v: unknown): v is RedZernio => typeof v === 'string' && Object.prototype.hasOwnProperty.call(REDES, v);

/** Las que la pantalla ofrece hoy, en su orden. */
export const REDES_VISIBLES: readonly RedZernio[] = (Object.keys(REDES) as RedZernio[]).filter((r) => (REDES[r] as RedDef).visible);

/** Messenger es la PÁGINA de Facebook: lo que Automations llama canal `messenger` se conecta como la red `facebook`. */
export const redDeCanal = (canal: 'instagram' | 'messenger'): RedZernio => (canal === 'messenger' ? 'facebook' : 'instagram');

// ── Lo que viaja ─────────────────────────────────────────────────────────────

/** Una cuenta conectada en Zernio, como la necesita MaKo. `accountId` es el `_id` de Zernio (lo que pide su API de anuncios para publicar). */
export type ConexionZernio = {
  accountId: string;
  plataforma: string;
  usuario: string;
  nombre: string;
  /** `isActive` y `enabled` no están apagados. */
  activa: boolean;
  /** Zernio pide reconectar (`needsReconnection`). */
  vencida: boolean;
};

/** Por qué no se pudo seguir, en una palabra que la pantalla sabe leer. */
export type MotivoZernio = 'sin-clave' | 'clave-mala' | 'clave-en-uso' | 'pausada' | 'pago' | 'limite' | 'cobro' | 'sin-perfil' | 'sin-red' | 'respuesta' | 'error';

export type RespuestaConectar =
  | { ok: true; tipo: 'url'; url: string }
  /** Zernio no necesitó un login (la cuenta ya tenía el permiso, o la rehabilitó al instante). */
  | { ok: true; tipo: 'ya-conectada'; conexiones: ConexionZernio[] }
  | { ok: false; motivo: MotivoZernio; error: string; pagoUrl?: string | null };

export const MENSAJES_DE_MOTIVO: Readonly<Record<MotivoZernio, string>> = {
  'sin-clave': 'Primero pega tu API key de Zernio.',
  'clave-mala': 'Tu API key de Zernio no sirve. Revísala.',
  'clave-en-uso': 'Esa API key de Zernio ya la usa otro negocio de MaKo. Pega una propia.',
  'pausada': 'Tu cuenta de Zernio está pausada.',
  'pago': 'Zernio pide una tarjeta para conectar otra cuenta. Las 2 primeras son gratis.',
  'limite': 'Tu plan de Zernio no deja conectar más cuentas.',
  'cobro': 'Esta cuenta se paga en tu Zernio: desde la 3.ª, US$6 por mes cada una.',
  'sin-perfil': 'Tu cuenta de Zernio no tiene ningún perfil. Crea uno en Zernio.',
  'sin-red': 'Zernio no contestó. Prueba de nuevo.',
  'respuesta': 'Zernio contestó algo que no entendimos. Prueba de nuevo.',
  'error': 'No se pudo conectar.',
};

// ── La línea del cobro ───────────────────────────────────────────────────────

/**
 * UNA línea para avisar ANTES de abrir el login (Zernio cobra por cuenta conectada, leído el 23/10/2026: las 2 primeras gratis,
 * de la 3.ª a la 10.ª US$6, de la 11.ª a la 100.ª US$3, desde la 101.ª US$1). Un login de Facebook no es UNA cuenta: la página, el
 * Instagram y la cuenta publicitaria cuentan aparte. `total` null = no se pudo leer cuántas hay.
 */
export function lineaDeCobro(total: number | null | undefined): string {
  if (total == null || !Number.isFinite(total) || total < 0) return 'Cada red cuenta aparte en Zernio (página, Instagram, anuncios): 2 gratis, desde la 3.ª se paga.';
  return `Tienes ${total} ${total === 1 ? 'cuenta conectada' : 'cuentas conectadas'} en Zernio. Las 2 primeras son gratis; desde la 3.ª se paga.`;
}

/** Las cuentas que Zernio no cobra (su tabla de precios, leída el 27/10/2026: «1 to 2 — Free»). */
export const CUENTAS_GRATIS_ZERNIO = 2;
/**
 * Lo demás que Zernio da gratis (zernio.com/pricing, leído el 28/10/2026 23:40): 10.000 mensajes ENVIADOS por mes (los recibidos no
 * cuentan; sin tarjeta, los envíos se frenan hasta el mes siguiente; con tarjeta, US$1 cada 10.000 más), los comentarios y las
 * reseñas sin contar como mensaje, y 500 anuncios gestionados. De la 3.ª a la 10.ª cuenta, US$6 por mes cada una.
 * ⚠️ Nada de Analytics: la página dice «incluido» y medimos un 402 que pedía el complemento. Hasta volver a medirlo, no se promete.
 */
export const MENSAJES_GRATIS_ZERNIO = 10_000;
export const ANUNCIOS_GRATIS_ZERNIO = 500;
export const USD_CUENTA_EXTRA_ZERNIO = 6;

/**
 * El CICLO de facturación de Zernio, de `GET /v1/billing` (`period.start`/`period.end`), con los dos instantes en ISO con Z. Los
 * 10.000 mensajes gratis son por ciclo, no por mes calendario: el ciclo arranca el día del alta (medido el 29/10 con el ws10: del
 * 12/10 03:00Z al 01/11, `anchorDay` 12; Zernio los manda con `+00:00`). null si no viene o no se entiende (no se inventa un mes).
 */
export function cicloDeZernio(billing: unknown): { desde: string; hasta: string } | null {
  const p = billing && typeof billing === 'object' ? (billing as { period?: { start?: unknown; end?: unknown } }).period : null;
  const desde = typeof p?.start === 'string' ? Date.parse(p.start) : Number.NaN;
  const hasta = typeof p?.end === 'string' ? Date.parse(p.end) : Number.NaN;
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return null;
  return { desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString() };
}

/**
 * Los límites de Zernio, dichos al conectar (Martín, 28/10: «Super importante advertir en la conexión de Zernio las limitaciones,
 * como que hasta 2 redes sociales es gratis»). Va en el modal de Zernio, abajo de la línea de las cuentas (`lineaDeCobro`).
 */
export function textoGratisZernio(): string {
  const n = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `También gratis: ${n(MENSAJES_GRATIS_ZERNIO)} mensajes enviados por mes (los recibidos, los comentarios y las reseñas no cuentan) y ${n(ANUNCIOS_GRATIS_ZERNIO)} anuncios. `
    + `Desde la ${CUENTAS_GRATIS_ZERNIO + 1}.ª cuenta, US$${USD_CUENTA_EXTRA_ZERNIO} por mes cada una. Sin tarjeta en Zernio, al llegar a ${n(MENSAJES_GRATIS_ZERNIO)} envíos se frenan hasta el mes siguiente.`;
}

/**
 * ¿Hay que avisar ANTES de abrir el login? (27/10/2026, feedback de Leila 876470842-23: Zernio le cobró US$16 y MaKo sólo lo decía en
 * una línea fija). Zernio cobra por cuenta ACTIVA de toda la cuenta de Zernio (las ocultas y desconectadas no cuentan), y la página,
 * el Instagram y los anuncios cuentan aparte. Se avisa si ya hay 2 o más y la red a conectar todavía no tiene una cuenta activa:
 * volver a entrar con la misma cuenta no suma otra (Zernio conserva su id). null = no hace falta avisar.
 */
export function avisoDeCobroZernio(p: { conectadas: readonly ConexionZernio[]; red: RedZernio }): { cuentas: number } | null {
  const activas = p.conectadas.filter((c) => c.activa);
  if (activas.some((c) => c.plataforma === REDES[p.red].plataforma)) return null;
  return activas.length >= CUENTAS_GRATIS_ZERNIO ? { cuentas: activas.length } : null;
}

/** El aviso, en una línea: cuántas hay y cuánto cuesta la que viene (de la 3.ª a la 10.ª, US$6 por mes, prorrateado por día). */
export function textoAvisoCobro(cuentas: number): string {
  // La salida gratis (Martín, 28/10: «la misma advertencia cuando estén por conectar su 3ra red»): Zernio cobra sólo las cuentas
  // ACTIVAS, así que desconectar allá una que no se usa la deja gratis. «Conecta otra cuenta de Zernio» NO va NUNCA (Martín, 29/10,
  // por el Cerebro): cada negocio con SU cuenta, y si necesita más, paga su plan. Varias cuentas gratis para lo mismo arriesgan la
  // suspensión («Abuse of the API may result in immediate suspension», zernio.com/tos), que le cortaría las publicaciones.
  return `Tu Zernio ya tiene ${cuentas} cuentas conectadas: ésta se paga. Zernio te cobra US$6 por mes por cada una desde la 3.ª, prorrateado por día. Para no pagar, desconecta en zernio.com una que ya no uses y vuelve a intentarlo.`;
}

// ── A dónde vuelve ───────────────────────────────────────────────────────────

const ORIGEN_FALSO = 'https://mako.invalid';

/**
 * `volver` es lo que llega del NAVEGADOR y termina como el `redirect_url` de un tercero: tiene que ser una RUTA de la app y
 * nada más (una URL libre sería un redirect abierto). Se resuelve contra un origen que no existe y se exige que siga siendo ese
 * origen: `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:` y `data:` no pasan. Tampoco una ruta de la API: un `GET`
 * a `/api/…` desde un redirect puede ser una acción. Sin el fragmento. `null` = no vale.
 */
export function validarVolver(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > 300 || !s.startsWith('/') || s.startsWith('//')) return null;
  // Barra invertida y controles: los navegadores normalizan `\` a `/`, y un salto de línea parte el encabezado.
  if (/[\\\u0000-\u001f\u007f]/.test(s)) return null;
  let u: URL;
  try { u = new URL(s, ORIGEN_FALSO); } catch { return null; }
  if (u.origin !== ORIGEN_FALSO || u.pathname.startsWith('//')) return null;
  if (/^\/api(\/|$)/.test(u.pathname)) return null;
  // El `ws` lo pone el servidor y sólo si hace falta: uno que venga en `volver` sería un destino que el servidor no controla.
  u.searchParams.delete('ws');
  return `${u.pathname}${u.search}`;
}

/** El parámetro con que una vuelta de PÁGINA ENTERA dice a qué red volvía. */
export const PARAM_VUELTA = 'zernio';

/** Lo que Zernio (o esta pantalla) agrega a la URL al volver: se consume una vez y se saca de la barra. */
export const PARAMS_DE_VUELTA: readonly string[] = [
  PARAM_VUELTA, 'connected', 'profileId', 'accountId', 'username', 'error', 'error_message', 'is_user_fixable',
  'platform', 'request_id', 'stage', 'step', 'tempToken', 'userProfile', 'connect_token',
];

/** `volver` (ya validado) con la marca de la red: es el `redirect_url` de la vuelta de página entera. */
export function volverConMarca(volver: string, red: RedZernio): string {
  const u = new URL(volver, ORIGEN_FALSO);
  u.searchParams.set(PARAM_VUELTA, red);
  return `${u.pathname}${u.search}`;
}

/** La URL actual sin lo que se consumió (conserva el resto: `ws`, `abrir`, lo que sea). */
export function sinParamsDeVuelta(search: string): string {
  const q = new URLSearchParams(search);
  for (const p of PARAMS_DE_VUELTA) q.delete(p);
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Lo que trae la vuelta ────────────────────────────────────────────────────

export type Retorno = {
  /** La red a la que volvía (`zernio=<red>`, el marcador de la vuelta de página entera). */
  red: RedZernio | null;
  conectado: boolean;
  accountId: string | null;
  usuario: string | null;
  error: string | null;
  mensaje: string | null;
  arreglable: boolean | null;
};

const ID_CUENTA = /^[A-Za-z0-9_-]{6,64}$/;
const CODIGO_ERROR = /^[A-Za-z0-9_.-]{1,80}$/;
const sinControles = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

/** Lo que agregó Zernio a la URL. Todo es una pista, acotada y sin controles: se muestra como TEXTO, jamás como HTML ni como link. */
export function retornoDeZernio(search: string | URLSearchParams): Retorno {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const red = q.get(PARAM_VUELTA);
  const id = q.get('accountId');
  const err = q.get('error');
  const usuario = q.get('username');
  const mensaje = q.get('error_message');
  const fix = q.get('is_user_fixable');
  const error = err && CODIGO_ERROR.test(err) ? err : err ? 'desconocido' : null;
  return {
    red: esRedZernio(red) ? red : null,
    conectado: !error && !!q.get('connected'),
    accountId: id && ID_CUENTA.test(id) ? id : null,
    usuario: usuario ? sinControles(usuario).slice(0, 100) || null : null,
    error,
    // El texto de la URL es de un tercero (cualquiera puede armar un link con el dominio de MaKo): sólo se muestra el que Zernio marca como
    // arreglable por la persona (`is_user_fixable=true`), y acotado.
    mensaje: fix === 'true' && mensaje ? sinControles(mensaje).slice(0, 200) || null : null,
    arreglable: fix === 'true' ? true : fix === 'false' ? false : null,
  };
}

/** El texto de lo que pasó en la vuelta, en neutro y con la acción. */
export function textoDeErrorDeRetorno(error: string | null, mensaje?: string | null): string {
  switch (error) {
    case 'oauth_denied':
    case 'access_denied':
    case 'meta_ads_authorization_denied':
      return 'Cancelaste el permiso. Vuelve a intentarlo y acepta todo lo que pide.';
    case 'no_facebook_pages':
    case 'no_pages_granted':
      return 'Meta no encontró ninguna página tuya. Hace falta una página de Facebook para conectar.';
    case 'payment_required':
      return MENSAJES_DE_MOTIVO.pago;
    default:
      return mensaje ? `Zernio dice: ${mensaje}` : MENSAJES_DE_MOTIVO.error;
  }
}

/**
 * La vuelta con `error=` de un login que NO salió de esta pestaña (el link se abrió suelto, desde otro lado, o venció lo
 * guardado): igual se dice por qué no conectó. Antes se descartaba en silencio, y quien había aceptado en Facebook no se
 * enteraba de que Zernio lo había rechazado (medido el 25/10/2026: dos clics de Martín que no conectaron nada). Va SIN el
 * texto de Zernio: sin lo guardado de esta pestaña, la URL la pudo armar cualquiera con el dominio de MaKo. Un éxito
 * ajeno sigue sin hacer nada (no se da por conectado lo que esta pestaña no midió).
 */
export function errorDeVueltaAjena(ret: Retorno): string | null {
  return ret.red && ret.error ? textoDeErrorDeRetorno(ret.error, null) : null;
}

// ── El mensaje de la ventana ─────────────────────────────────────────────────

export const TIPO_MENSAJE_VENTANA = 'mako-zernio';
/** El canal (BroadcastChannel, mismo origen) por el que la landing avisa cuando `window.opener` se cortó por un `Cross-Origin-Opener-Policy`. */
export const CANAL_VENTANA = 'mako-zernio';

export type MensajeVentana = {
  tipo: typeof TIPO_MENSAJE_VENTANA; conectado: boolean; accountId: string | null; error: string | null;
  /** Lo que Zernio dice del error, SÓLO si lo marcó arreglable (`retornoDeZernio`). */
  mensaje: string | null;
  /** El flujo (clic) al que le toca: un canal del mismo origen lo reciben todas las pestañas, y un error de una no puede cortar el de otra. */
  flujo: string | null;
};

const ID_FLUJO = /^[A-Za-z0-9]{6,32}$/;
export const esFlujoValido = (v: unknown): v is string => typeof v === 'string' && ID_FLUJO.test(v);

/** Lo que la landing de la ventana le manda a la pantalla que la abrió. Una PISTA para medir antes: nunca la medición. */
export function leerMensajeVentana(data: unknown): MensajeVentana | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.tipo !== TIPO_MENSAJE_VENTANA) return null;
  const id = typeof d.accountId === 'string' && ID_CUENTA.test(d.accountId) ? d.accountId : null;
  const error = typeof d.error === 'string' && CODIGO_ERROR.test(d.error) ? d.error : null;
  const mensaje = typeof d.mensaje === 'string' && d.mensaje.trim() ? sinControles(d.mensaje).slice(0, 200) || null : null;
  return { tipo: TIPO_MENSAJE_VENTANA, conectado: d.conectado === true && !error, accountId: id, error, mensaje, flujo: esFlujoValido(d.flujo) ? d.flujo : null };
}

// ── Medir ────────────────────────────────────────────────────────────────────

/** Las conexiones de UNA red, tal como las lista Zernio. */
export const delaRed = (red: RedZernio, conexiones: readonly ConexionZernio[]): ConexionZernio[] =>
  conexiones.filter((c) => c.plataforma === REDES[red].plataforma);

const esSana = (c: ConexionZernio) => c.activa && !c.vencida;

/**
 * ¿QUEDÓ CONECTADA? Con la lista de ANTES y la de AHORA (las dos de `GET /v1/accounts`), devuelve la conexión que se acaba de
 * hacer, o `null` si todavía no.
 *   · Una cuenta ACTIVA y sin pedir reconexión que antes no estaba.
 *   · O la que nombra la `pista` (el `accountId` con que volvió el navegador), SI existe en `ahora` y está sana: volver a entrar
 *     con una cuenta que ya estaba conectada no le cambia el id, y sin esto esperaría para siempre. La pista sola no alcanza.
 *   · O, reconectando una cuenta que ESTABA vencida (`reconectarId`), esa misma, ya sana (una que ya estaba sana sólo la confirma la pista).
 * `antes` null = no se pudo leer qué había: entonces NADA de lo que ya estaba cuenta como nuevo (sería dar por hecho un login que
 * nadie hizo), y sólo la pista o la reconexión pueden confirmar. Falla CERRADO.
 */
export function medirConexion(a: {
  red: RedZernio;
  antes: readonly ConexionZernio[] | null;
  ahora: readonly ConexionZernio[];
  pista?: string | null;
  reconectarId?: string | null;
}): ConexionZernio | null {
  const sanas = delaRed(a.red, a.ahora).filter(esSana);
  // ⚠️ Reconectar una cuenta VENCIDA: esa misma, ya sana. Sólo si ANTES no estaba sana (vencida o ausente): con una sana (los anuncios se
  // «vuelven a conectar» con `force` sobre una conexión que ya anda) la primera medición la daba por hecha a los 0,5 s, con la ventana recién
  // abierta. Ahí no hay cambio visible: sólo la pista (el `accountId` con que vuelve la ventana) confirma. Sin la lista de antes, tampoco.
  if (a.reconectarId && a.antes) {
    const eraSana = delaRed(a.red, a.antes).some((c) => c.accountId === a.reconectarId && esSana(c));
    const r = eraSana ? undefined : sanas.find((c) => c.accountId === a.reconectarId);
    if (r) return r;
  }
  if (a.pista) {
    const p = sanas.find((c) => c.accountId === a.pista);
    if (p) return p;
  }
  if (!a.antes) return null;
  const yaEstaban = new Set(delaRed(a.red, a.antes).filter(esSana).map((c) => c.accountId));
  return sanas.find((c) => !yaEstaban.has(c.accountId)) ?? null;
}

export type EstadoDeRed = { estado: 'conectada' | 'vencida' | 'sin-conectar'; conexiones: ConexionZernio[] };

/** Cómo está UNA red hoy: conectada (hay una sana), vencida (sólo hay cuentas que piden reconectar) o sin conectar. */
export function estadoDeRed(red: RedZernio, conexiones: readonly ConexionZernio[]): EstadoDeRed {
  const todas = delaRed(red, conexiones);
  if (todas.some(esSana)) return { estado: 'conectada', conexiones: todas };
  if (todas.some((c) => c.vencida)) return { estado: 'vencida', conexiones: todas };
  return { estado: 'sin-conectar', conexiones: todas };
}

// ── Cuándo es un teléfono o un navegador interno ─────────────────────────────

/**
 * ¿Conviene NO abrir una ventana emergente? En un teléfono y en el navegador interno de Instagram, Facebook, TikTok o WhatsApp el
 * popup no es confiable (Meta lo dice en su doc: algunos navegadores internos lo suprimen y el SDK cae a redirección), así que la
 * pestaña navega y VUELVE a la misma pantalla. La lista de agentes es una deducción: se mide en un teléfono. El ancho también
 * cuenta (una ventana chica de escritorio).
 */
export function sinVentanaEmergente(ua: string | null | undefined, ancho: number | null | undefined): boolean {
  if (ancho != null && ancho < 768) return true;
  return /Android|iPhone|iPad|iPod|Mobile|FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|WhatsApp|Line\/|MicroMessenger/i.test(ua ?? '');
}

// ── Los tiempos ──────────────────────────────────────────────────────────────

/**
 * Cada cuánto se mide mientras la persona termina en la ventana, y hasta cuándo (≈4 min). Cada medición es un `GET /v1/accounts`
 * y Zernio deja 60 pedidos por minuto a un equipo con 0 a 2 cuentas (600 desde la 3.ª): a 4 s son 15 por minuto, con margen
 * para el resto de la app.
 */
export const SONDEO_MS = 4000;
export const SONDEO_MAX = 60;
/** Lo que se espera, con la ventana ya cerrada, antes de dar la conexión por no hecha (la última medición llega a tiempo). */
export const GRACIA_CIERRE_MS = 1500;

// ── Leer lo que contesta Zernio ──────────────────────────────────────────────

const aTexto = (v: unknown, tope = 200): string => (typeof v === 'string' ? sinControles(v).slice(0, tope) : '');

/** El id de un campo que puede venir como texto o como `{ _id }` (el `profileId` de una cuenta). */
const idDe = (v: unknown): string | null => {
  if (typeof v === 'string' && v) return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o._id === 'string' && o._id) return o._id;
    if (typeof o.id === 'string' && o.id) return o.id;
  }
  return null;
};

/**
 * Las cuentas de `GET /v1/accounts`, a la forma de MaKo. La doc no trae un ejemplo de la respuesta, así que es TOLERANTE con el
 * envoltorio (`{ accounts }`, `{ data }` o el arreglo pelado) y con el `profileId` (texto u objeto), y descarta lo que no tiene
 * id o plataforma. ⚠️ Con `profileId` filtra DEL LADO NUESTRO una vez más: una clave de Zernio con varios perfiles (una agencia con
 * una sola clave para dos negocios de MaKo) no puede mostrarle a un negocio las cuentas del otro aunque Zernio las devuelva. Una
 * cuenta SIN profile en la respuesta se queda (el filtro ya lo hizo Zernio en el pedido).
 * `activa`: ni `isActive` ni `enabled` están apagados. `vencida`: `needsReconnection` (en el listado) o `needsReconnect` (en /health).
 */
export function leerCuentasDeZernio(raw: unknown, profileId: string | null = null): ConexionZernio[] {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const lista = Array.isArray(raw) ? raw : Array.isArray(o?.accounts) ? (o!.accounts as unknown[]) : Array.isArray(o?.data) ? (o!.data as unknown[]) : [];
  const out: ConexionZernio[] = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const a = x as Record<string, unknown>;
    const accountId = idDe(a._id) ?? idDe(a.id);
    const plataforma = aTexto(a.platform, 40);
    if (!accountId || !ID_CUENTA.test(accountId) || !plataforma) continue;
    const suyo = idDe(a.profileId);
    if (profileId && suyo && suyo !== profileId) continue;
    const usuario = aTexto(a.username);
    out.push({
      accountId,
      plataforma,
      usuario,
      nombre: aTexto(a.displayName) || usuario,
      activa: a.isActive !== false && a.enabled !== false && a.hidden !== true && a.isHidden !== true,
      vencida: a.needsReconnection === true || a.needsReconnect === true,
    });
  }
  return out;
}

/**
 * ¿La respuesta de `GET /v1/accounts` TRAE una lista (`{ accounts }`, `{ data }` o el arreglo pelado)? Una lista vacía es «no hay cuentas»;
 * un objeto sin lista es «no entendí la respuesta» (un campo que Zernio renombró) y NO puede leerse como «no hay cuentas»: la persona
 * esperaría 4 minutos a una conexión que el servidor no sabe ver.
 */
export function tieneListaDeCuentas(raw: unknown): boolean {
  if (Array.isArray(raw)) return true;
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  return Array.isArray(o?.accounts) || Array.isArray(o?.data);
}

/** Las claves de un cuerpo que no se entendió, para el log: NUNCA valores (pueden traer datos de una cuenta). */
export const clavesDe = (raw: unknown): string =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw as object).slice(0, 12).join(',') : Array.isArray(raw) ? 'arreglo' : typeof raw;

/**
 * El link de pago del 402 de Zernio. La doc dice `dashboard_url` (el código de antes leía `billingUrl`, que NO existe en la doc:
 * el negocio veía «pausada» sin su link); se aceptan los dos y también adentro de `details`. Sólo https y sin espacios ni comillas:
 * va a un `href`, y un `javascript:` ahí es un XSS.
 */
export function urlDePagoDeZernio(cuerpo: unknown): string | null {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : null;
  const d = o?.details && typeof o.details === 'object' ? (o.details as Record<string, unknown>) : null;
  const url = [o?.dashboard_url, o?.billingUrl, d?.dashboard_url, d?.billingUrl].find((x): x is string => typeof x === 'string');
  return url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null;
}

/** El link del login que devuelve Zernio (`authUrl`, o `url` por si la doc lo parafraseó): sólo https, sin datos de acceso en la dirección. */
export function urlDeLoginDeZernio(cuerpo: unknown): string | null {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : null;
  const url = [o?.authUrl, o?.url].find((x): x is string => typeof x === 'string');
  if (!url || url.length > 4000 || /[\s"'<>\u0000-\u001f]/.test(url)) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

// ── Qué quiso decir un error de Zernio ───────────────────────────────────────

/**
 * Del status y el cuerpo de un error de Zernio al motivo que lee la pantalla. «Branch on type and code, never on error text» (el
 * envelope de Zernio). Un 402 de la cuenta es de la CUENTA DEL NEGOCIO (no hay respaldo de la plataforma): `free_tier_exceeded` es «agrega
 * una tarjeta para pasar de 2 cuentas» y cualquier otro 402 es «tu cuenta está pausada». El link de pago es `dashboard_url`.
 * 429 y 5xx son «Zernio no contestó» (reintentable). `texto`: el `error` de Zernio, que es legible (lo dice su doc), recortado.
 */
export function motivoDeRespuesta(status: number, cuerpo: unknown, code?: string | null): { motivo: MotivoZernio; pagoUrl: string | null; texto: string | null } {
  const o = cuerpo && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : null;
  const d = o?.details && typeof o.details === 'object' ? (o.details as Record<string, unknown>) : null;
  const razon = String(o?.reason ?? d?.reason ?? '');
  const codigo = code ?? (typeof o?.code === 'string' ? o.code : '');
  const texto = typeof o?.error === 'string' && o.error.trim() ? sinControles(o.error).slice(0, 200) : null;
  if (status === 401) return { motivo: 'clave-mala', pagoUrl: null, texto: null };
  if (status === 402) return { motivo: razon === 'free_tier_exceeded' ? 'pago' : 'pausada', pagoUrl: urlDePagoDeZernio(cuerpo), texto: null };
  if (status === 403 && (codigo === 'platform_account_limit' || razon === 'platform_account_limit')) return { motivo: 'limite', pagoUrl: null, texto: null };
  if (status === 429 || status >= 500) return { motivo: 'sin-red', pagoUrl: null, texto: null };
  return { motivo: 'error', pagoUrl: null, texto };
}

// ── La vuelta de página entera, atada al clic que la inició ──────────────────

/** Dónde se guarda, en `sessionStorage` (de ESTA pestaña): el flujo que salió a Zernio y tiene que volver. */
export const CLAVE_VUELTA = 'mako-zernio-vuelta';
/** Lo que se espera el regreso de un login (el `state` de Zernio vence a los 30 minutos). */
export const VIGENCIA_VUELTA_MS = 30 * 60_000;

export type VueltaGuardada = { red: RedZernio; antes: ConexionZernio[] | null; reconectarId: string | null };

/** Lo que se guarda antes de salir: la red, las cuentas de ANTES (para medir con el mismo criterio que la ventana) y cuándo. */
export function guardarVuelta(a: { red: RedZernio; antes: readonly ConexionZernio[] | null; reconectarId?: string | null; ahoraMs: number }): string {
  return JSON.stringify({
    red: a.red, t: a.ahoraMs, reconectarId: a.reconectarId && ID_CUENTA.test(a.reconectarId) ? a.reconectarId : null,
    antes: a.antes ? delaRed(a.red, a.antes).slice(0, 50) : null,
  });
}

/**
 * Lo guardado, o `null` si no hay, está roto, venció o es de OTRA red. ⚠️ Sin esto, cualquier link con `?zernio=<red>&connected=…` hacía que la
 * pantalla dijera «conectado» y armara la recepción sin que nadie hubiera hecho un login, y la vuelta de un flujo de Instagram se aplicaba al
 * de Messenger. La vuelta se procesa SÓLO si esta pestaña salió a hacer ese login hace menos de 30 minutos, y se consume una vez.
 */
export function leerVueltaGuardada(raw: string | null | undefined, red: RedZernio, ahoraMs: number): VueltaGuardada | null {
  if (!raw) return null;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const d = o as Record<string, unknown>;
  if (d.red !== red || typeof d.t !== 'number' || !Number.isFinite(d.t) || ahoraMs - d.t > VIGENCIA_VUELTA_MS || ahoraMs < d.t - 60_000) return null;
  const antes = Array.isArray(d.antes) ? leerCuentasPropias(d.antes) : null;
  return { red, antes, reconectarId: typeof d.reconectarId === 'string' && ID_CUENTA.test(d.reconectarId) ? d.reconectarId : null };
}

/** Las conexiones guardadas por `guardarVuelta`, vueltas a leer con el mismo rigor (vienen del navegador). */
function leerCuentasPropias(lista: unknown[]): ConexionZernio[] {
  const out: ConexionZernio[] = [];
  for (const x of lista) {
    if (!x || typeof x !== 'object') continue;
    const a = x as Record<string, unknown>;
    if (typeof a.accountId !== 'string' || !ID_CUENTA.test(a.accountId) || typeof a.plataforma !== 'string') continue;
    out.push({
      accountId: a.accountId, plataforma: aTexto(a.plataforma, 40), usuario: aTexto(a.usuario), nombre: aTexto(a.nombre),
      activa: a.activa === true, vencida: a.vencida === true,
    });
  }
  return out;
}
