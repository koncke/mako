// =============================================================================
// zernio-tope — ¿un error de Zernio es un TOPE? (Leandro, 28/10/2026). Puro: lo usan lib/zernio.ts (`topeDe`) y el test.
// =============================================================================
// Leandro preguntó si hay un límite (hace ~500 respuestas a comentarios y ~1.000 DMs por mes) y pidió no encontrarse «con mil
// mensajes sin responder». Los topes (el Cerebro, 28/10): Meta, 750 respuestas privadas por hora y por cuenta; Zernio, 60
// pedidos por minuto (600 con 3+ cuentas), con 429, `Retry-After` y `X-RateLimit-Remaining` (docs.zernio.com/rate-limits).
// Un tope pasa solo: lo que no salió tiene que volver a salir, nunca cerrarse como «Meta no deja».
// =============================================================================

/** El tope que frenó un envío: el de Zernio (sus pedidos por minuto) o el de Meta (Instagram o Facebook). */
export type TopeSocial = { quien: 'zernio' | 'meta'; esperaMs: number };

/** Lo que se espera sin un `Retry-After`: el minuto de Zernio, y la hora de Meta (750 respuestas privadas por hora y cuenta). */
export const ESPERA_TOPE_ZERNIO_MS = 60_000;
export const ESPERA_TOPE_META_MS = 60 * 60_000;
/** Los códigos de Meta que son «muchos pedidos»: 4 (la app), 17 (el usuario), 32 (la página), 613 (llamadas por hora). */
const CODIGOS_TOPE_META: ReadonlySet<number> = new Set([4, 17, 32, 613]);
const RX_TOPE = /rate.?limit|too many (requests|calls)|request limit|limit (reached|exceeded)|quota|demasiad[oa]s/i;

/** Lo que de un error de Zernio mira esta pieza (`ZernioError` lo cumple). */
export type ErrorDeZernio = {
  status: number;
  type: string | null;
  esperaMs: number | null;
  body: { error?: string; platform?: string; platformError?: unknown } | null;
};

/** EL `Retry-After` EN MILISEGUNDOS (RFC 9110: segundos, o una fecha HTTP). null = no vino o no se entiende. */
export function esperaDeRetryAfter(valor: string | null | undefined, ahoraMs: number = Date.now()): number | null {
  const v = (valor ?? '').trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v) * 1000;
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, t - ahoraMs) : null;
}

/**
 * ¿ESTE ERROR ES UN TOPE? Un tope NO es «Meta no deja»: pasa solo, y lo que no salió tiene que salir después.
 *   · 429 de Zernio: su tope por minuto, o el de la plataforma cuando el error trae `type: platform_error` («upstream
 *     platform quota»: el de Meta).
 *   · un error de Meta con código de «muchos pedidos» (4, 17, 32, 613) o que lo dice en palabras.
 * La espera: el `Retry-After` si vino; si no, el minuto de Zernio o la hora de Meta.
 */
export function topeDeError(e: ErrorDeZernio): TopeSocial | null {
  const pe = (e.body?.platformError ?? null) as { code?: unknown; message?: unknown } | null;
  const codigo = Number(pe?.code);
  const dePlataforma = e.type === 'platform_error' || !!e.body?.platform;
  const diceTope = CODIGOS_TOPE_META.has(codigo) || RX_TOPE.test(`${e.body?.error ?? ''} ${typeof pe?.message === 'string' ? pe.message : ''}`);
  if (e.status === 429) return dePlataforma
    ? { quien: 'meta', esperaMs: e.esperaMs ?? ESPERA_TOPE_META_MS }
    : { quien: 'zernio', esperaMs: e.esperaMs ?? ESPERA_TOPE_ZERNIO_MS };
  return dePlataforma && diceTope ? { quien: 'meta', esperaMs: e.esperaMs ?? ESPERA_TOPE_META_MS } : null;
}
