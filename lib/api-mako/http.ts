// =============================================================================
// api-mako/http — lo que comparten las rutas de app/api/v1: auth, contexto, respuesta
// =============================================================================
// Todas las rutas de /api/v1 se autentican con un bearer (`Authorization: Bearer …`): un
// token DETALLADO de la pantalla de API (`mako_pat_…`, lib/api-mako/tokens.ts) o el
// principal de la skill (`mkoag_…`, lib/agente-token.ts), que es el «clásico».
// `resolverTokenApi` prueba los dos; las rutas de /api/agente aceptan sólo el principal, a
// propósito (ver tokens-lista.ts). NO leen la cookie de sesión ni el header interno del
// workspace: el `ws` sale SOLO del token. Por eso pueden estar en `PUBLICOS`
// (lib/rutas-publicas.ts) como prefijo sin abrir un CSRF —el navegador nunca manda ese
// header solo—.
//
// Las CONVENCIONES son las de la API de GitHub (decisión de Martín, 08/10/2026, «copiá la
// API de GitHub tal cual»), con los nombres cambiados de marca:
//   · versión por header: `X-MaKo-Api-Version: 2026-10-08` (opcional; una que no existe es
//     400) y la respuesta dice cuál se usó en `X-MaKo-Api-Version-Selected`;
//   · rate limit en `x-ratelimit-limit / -remaining / -used / -reset / -resource`, y
//     `retry-after` en el 429;
//   · el permiso que pide el endpoint en `X-Accepted-MaKo-Permissions` (`crm=read`), como
//     `X-Accepted-GitHub-Permissions`;
//   · errores con `message` y `documentation_url`, además del `{ ok:false, error }` de
//     siempre (no se saca nada: la skill instalada lee `error`);
//   · ETag en las lecturas y 304 con `If-None-Match`.
//
// ⚠️ Si una ruta de acá NO está en `PUBLICOS`, el middleware la corta con «no
// autenticado» antes de que nadie mire el bearer, y en local no se nota.
// =============================================================================

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rateLimitEstado, rateLimitVer, clientIp, type EstadoLimite } from '@/lib/rate-limit';
import { APP_BASE_URL } from '@/lib/app-url';
import { alcanceDeToken } from './alcance';
import { canalKeyDe } from './canal';
import { permisoAceptado } from './permisos';
import { recursoDe } from './recursos';
import { VERSION_API, VERSIONES_API, CABECERA_VERSION, TOPE_POR_MINUTO_WS, TOPE_POR_MINUTO_IP, TOPE_CUERPO_BYTES } from './version';
import { resolverTokenApi, type TokenResuelto } from './tokens';
import { mensajeSinCreador } from './tokens-creador';
import type { Ctx, Formato, OperacionDef, Resultado } from './tipos';

/** Los topes (lib/api-mako/version.ts, donde también los lee la documentación). */
export { TOPE_POR_MINUTO_WS, TOPE_POR_MINUTO_IP, TOPE_CUERPO_BYTES };

/** La versión de la API (lib/api-mako/version.ts). */
export { VERSION_API, VERSIONES_API, CABECERA_VERSION };

/** Dónde se lee la documentación (la pantalla de API, que es de cada workspace). */
export const docsUrl = (def?: Pick<OperacionDef, 'area' | 'id'>): string => {
  const base = `${APP_BASE_URL.replace(/\/+$/, '')}/api-mako?tab=docs`;
  if (!def) return base;
  const recurso = recursoDe(def.id);
  return `${base}&area=${def.area}${recurso ? `&recurso=${recurso}` : ''}#${def.id}`;
};

export type Autenticado = {
  ctx: Ctx;
  token: TokenResuelto;
  /** Las cabeceras de toda respuesta autenticada: versión y rate limit. */
  cabeceras: Record<string, string>;
};

/** Las cabeceras `x-ratelimit-*` de GitHub, para un estado de la ventana. */
export function cabecerasLimite(e: EstadoLimite): Record<string, string> {
  return {
    'x-ratelimit-limit': String(e.limite),
    'x-ratelimit-remaining': String(e.restantes),
    'x-ratelimit-used': String(e.usados),
    'x-ratelimit-reset': String(Math.ceil(e.reset / 1000)),
    'x-ratelimit-resource': 'core',
  };
}

/**
 * Un error con la forma de GitHub (`message`, `documentation_url`, `status`) Y la de
 * siempre (`ok:false`, `error`). Lo usan todas las rutas de /api/v1 para todas sus salidas
 * de error: un formato por ruta es cómo un cliente termina leyendo dos.
 */
export function errorJson(
  status: number, mensaje: string,
  extra: Record<string, unknown> = {}, cabeceras: Record<string, string> = {}, def?: Pick<OperacionDef, 'area' | 'id'>,
): NextResponse {
  return NextResponse.json({ ...cuerpoError(status, mensaje, def), ...extra }, { status, headers: cabeceras });
}

const cuerpoError = (status: number, mensaje: string, def?: Pick<OperacionDef, 'area' | 'id'>) =>
  ({ ok: false, error: mensaje, message: mensaje, documentation_url: docsUrl(def), status: String(status) });

const MSG_503 = 'No pude verificar el token: la base de datos no contestó. Reintenta en un momento.';

/** El token del header `authorization`. Como GitHub, acepta `Bearer <token>` y `token <token>`. */
export function tokenDeAutorizacion(h: Headers): string {
  const m = /^(?:bearer|token)\s+(.+)$/i.exec((h.get('authorization') ?? '').trim());
  return m ? m[1].trim() : '';
}

/** El token de un pedido, mirando SOLO `authorization`. `null` = no autorizado. */
export async function tokenDeHeaders(h: Headers, resolver: (token: string) => Promise<TokenResuelto | null> = resolverTokenApi): Promise<{ token: string; resuelto: TokenResuelto } | null> {
  const token = tokenDeAutorizacion(h);
  if (!token) return null;
  const resuelto = await resolver(token);
  return resuelto ? { token, resuelto } : null;
}

/** Resuelve el contexto del bearer, o la respuesta de error lista para devolver. */
export async function autenticar(req: Request, opts: { sinConsumir?: boolean } = {}): Promise<Autenticado | NextResponse> {
  // Por IP ANTES de tocar la base: un escaneo de tokens inválidos no puede costar
  // dos lecturas por intento.
  const porIp = rateLimitEstado(`api-v1:ip:${clientIp(req)}`, TOPE_POR_MINUTO_IP, 60_000);
  if (!porIp.permitido) {
    return errorJson(429, 'Demasiados pedidos: espera un minuto.', {}, { ...cabecerasLimite(porIp), 'retry-after': String(Math.max(1, Math.ceil((porIp.reset - Date.now()) / 1000))) });
  }
  // User-Agent obligatorio, como GitHub («Requests with no User-Agent header will be
  // rejected»): identifica la integración en la bitácora y en soporte. curl, n8n, Zapier y
  // cualquier librería HTTP lo mandan solos.
  if (!req.headers.get('user-agent')?.trim()) {
    return errorJson(403, 'Falta el header User-Agent: pon el nombre de tu integración (por ejemplo, «User-Agent: mi-integracion»).');
  }
  // La versión, como GitHub: opcional, y una que no existe es un 400 que dice cuáles hay.
  const version = req.headers.get(CABECERA_VERSION)?.trim();
  if (version && !VERSIONES_API.includes(version)) {
    return errorJson(400, `La versión de API «${version.slice(0, 40)}» no existe. Versiones vigentes: ${VERSIONES_API.join(', ')}.`);
  }
  // «No pude verificar» no es «token inválido» (07/10/2026): con la base caída, el resolvedor
  // TIRA en vez de devolver null, y eso va 503 — un 401 mandaba a rotar un token bueno.
  let auth: Awaited<ReturnType<typeof tokenDeHeaders>>;
  try {
    auth = await tokenDeHeaders(req.headers);
  } catch (e) {
    console.error(`[api-v1] no pude verificar el token: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ ...cuerpoError(503, MSG_503), reintentar: true }, { status: 503 });
  }
  if (!auth) return errorJson(401, 'Token inválido o revocado.');
  const r = auth.resuelto;
  if (r.clase === 'detallado' && r.vencido) {
    const dia = r.expira ? r.expira.slice(0, 10) : '';
    return errorJson(401, `El token «${r.nombre}» venció${dia ? ` el ${dia}` : ''}. Regenéralo en MaKo → API → Tokens.`);
  }
  // Como GitHub: el token deja de valer cuando quien lo creó deja de administrar el negocio.
  if (r.clase === 'detallado' && r.sinCreador) return errorJson(401, mensajeSinCreador(r.nombre));
  // Por workspace, nunca por el token: un secreto no es una clave de un Map.
  // `sinConsumir`: GET /api/v1/rate_limit mira la ventana sin gastarla, como en GitHub.
  const porWs = opts.sinConsumir ? rateLimitVer(`api-v1:ws:${r.ws}`, TOPE_POR_MINUTO_WS, 60_000) : rateLimitEstado(`api-v1:ws:${r.ws}`, TOPE_POR_MINUTO_WS, 60_000);
  const cabeceras: Record<string, string> = {
    ...cabecerasLimite(porWs),
    'X-MaKo-Api-Version-Selected': version || VERSION_API,
    // Para soporte, como X-GitHub-Request-Id: quien reporta un error manda este id.
    'X-MaKo-Request-Id': randomUUID(),
    // Como `GitHub-Authentication-Token-Expiration`: un script avisa antes de que venza.
    ...(r.clase === 'detallado' && r.expira ? { 'MaKo-Authentication-Token-Expiration': `${r.expira.slice(0, 19).replace('T', ' ')} UTC` } : {}),
    'Access-Control-Expose-Headers': 'ETag, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-RateLimit-Resource, X-RateLimit-Reset, X-Accepted-MaKo-Permissions, X-MaKo-Api-Version-Selected, X-MaKo-Request-Id, MaKo-Authentication-Token-Expiration',
  };
  if (!porWs.permitido) {
    return errorJson(429, `Más de ${TOPE_POR_MINUTO_WS} pedidos por minuto: espera un poco.`, {}, { ...cabeceras, 'retry-after': String(Math.max(1, Math.ceil((porWs.reset - Date.now()) / 1000))) });
  }
  const base = { ws: r.ws, canal: 'http' as const, canalKey: canalKeyDe('http', r.ws), rol: 'admin' as const };
  // Solo el admin del workspace acuña tokens: el principal en app/api/agente/token/route.ts
  // y los detallados en app/api-mako/actions.ts.
  const ctx: Ctx = r.clase === 'detallado'
    // Un detallado tiene el alcance máximo y lo acotan sus permisos por área (gatingOk).
    ? { ...base, alcance: 'ejecutar', permisos: r.permisos, token: { id: r.id, nombre: r.nombre }, actor: `API · token «${r.nombre}»` }
    : { ...base, alcance: alcanceDeToken(auth.token) };
  return { ctx, token: r, cabeceras };
}

export const esRespuesta = (x: unknown): x is NextResponse => x instanceof NextResponse;

/** `GET /api/v1/rate_limit`: el estado de la ventana del workspace SIN consumirla (GitHub). */
export function estadoLimite(ws: number) {
  const e = rateLimitVer(`api-v1:ws:${ws}`, TOPE_POR_MINUTO_WS, 60_000);
  const core = { limit: e.limite, remaining: e.restantes, reset: Math.ceil(e.reset / 1000), used: e.usados };
  return { resources: { core }, rate: core };
}

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  texto: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

const etagDe = (cuerpo: string): string => `W/"${createHash('sha1').update(cuerpo).digest('hex').slice(0, 27)}"`;

/**
 * De un `Resultado` a la respuesta HTTP. Las lecturas salen en su formato nativo, con ETag
 * (y 304 si el cliente ya la tiene, como GitHub). `def` agrega el permiso que el endpoint
 * acepta.
 */
export function responder(r: Resultado, opts: { req?: Request; cabeceras?: Record<string, string>; def?: OperacionDef } = {}): NextResponse {
  const cab: Record<string, string> = { ...(opts.cabeceras ?? {}), ...(opts.def ? { 'X-Accepted-MaKo-Permissions': permisoAceptado(opts.def) } : {}) };
  if (!r.ok) {
    const extra: Record<string, unknown> = {};
    if (r.faltan) extra.faltan = r.faltan;
    if (r.disponibles) extra.disponibles = r.disponibles;
    if (r.yaEstaba) extra.yaEstaba = true;
    return errorJson(r.status, r.error, extra, cab, opts.def);
  }
  if (r.tipo === 'lectura') {
    const formato: Formato | 'markdown' | 'texto' = r.formato ?? r.salida;
    let cuerpo: string;
    let tipo: string;
    if (formato === 'json') {
      try { cuerpo = JSON.stringify({ ok: true, resultado: JSON.parse(r.resultado) }); }
      catch { cuerpo = JSON.stringify({ ok: true, formato: 'texto', resultado: r.resultado }); }
      tipo = CONTENT_TYPE.json;
    } else {
      cuerpo = r.resultado;
      tipo = CONTENT_TYPE[formato] ?? CONTENT_TYPE.texto;
    }
    const etag = etagDe(cuerpo);
    const h = { ...cab, 'Content-Type': tipo, 'Cache-Control': 'private, max-age=0, must-revalidate', ETag: etag, ...(r.headers ?? {}) };
    const inm = opts.req?.headers.get('if-none-match');
    if (inm && inm.split(',').map((s) => s.trim()).includes(etag)) return new NextResponse(null, { status: 304, headers: h });
    return new NextResponse(cuerpo, { status: 200, headers: h });
  }
  if (r.tipo === 'control') {
    try { return NextResponse.json({ ok: true, resultado: JSON.parse(r.resultado) }, { headers: cab }); }
    catch { return NextResponse.json({ ok: true, resultado: r.resultado }, { headers: cab }); }
  }
  if (r.tipo === 'pendiente') {
    return NextResponse.json({
      ok: true, pendiente: r.pendiente,
      mensaje: 'Todavía no se hizo nada. La persona la confirma en MaKo (bandeja de pendientes) o por WhatsApp; con un token de alcance «ejecutar», POST /api/v1/mako/confirmar_accion con el id.',
    }, { status: 202, headers: cab });
  }
  return NextResponse.json({
    ...(r.propuesta.extra ?? {}),
    ok: true, propuesta: r.propuesta.id, nueva: r.propuesta.nueva, url: r.propuesta.url,
    mensaje: r.propuesta.nueva
      ? 'Quedó para confirmar. Pásale el link ENTERO a la persona: entra en MaKo recién cuando lo confirma ahí.'
      : 'Ya había una propuesta pendiente igual y es el mismo link; no se creó otra.',
  }, { status: 202, headers: cab });
}

/** El body JSON de un POST, o `{}` si no vino. Un JSON roto es un 400 del que llama. */
export async function bodyJson(req: Request, cabeceras: Record<string, string> = {}): Promise<Record<string, unknown> | NextResponse> {
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > TOPE_CUERPO_BYTES) return errorJson(413, `Cuerpo demasiado grande (tope ${TOPE_CUERPO_BYTES} bytes).`, {}, cabeceras);
  const texto = await req.text();
  if (Buffer.byteLength(texto, 'utf8') > TOPE_CUERPO_BYTES) return errorJson(413, `Cuerpo demasiado grande (tope ${TOPE_CUERPO_BYTES} bytes).`, {}, cabeceras);
  if (!texto.trim()) return {};
  try {
    const j = JSON.parse(texto);
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : errorJson(400, 'El cuerpo tiene que ser un objeto JSON.', {}, cabeceras);
  } catch { return errorJson(400, 'JSON inválido.', {}, cabeceras); }
}
