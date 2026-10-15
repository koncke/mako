// =============================================================================
// Gate de acceso al dashboard
// =============================================================================
// Antes era middleware.ts (convención deprecada en Next 16 → proxy.ts, corre
// en runtime Node). Protege páginas + APIs internas; exime los endpoints
// públicos que llaman servicios externos (webhooks, beacon del VSL, crons —
// todos con su propia auth por firma/secret).
//
// Se entra de UNA sola forma: mako_session, el token firmado por usuario
// (lib/auth-session.ts), que se emite con Google. Dice quién es y su rol; /admin
// y /api/admin exigen rol admin.
//
// Acá también se aceptaba `mako_auth === AUTH_COOKIE_VALUE`, la cookie
// compartida. Se fue: su valor ERA el secreto de firma, así que quien la tenía
// podía fabricarse un token de admin a mano.
//
// Activación: AUTH_SECRET. Sin él, en local/dev el gate queda INACTIVO; en
// producción FAIL-CLOSED (dashboard cerrado antes que abierto).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, gateConfigurado, verificarToken, sinLoginPermitido } from './lib/auth-session';
import { WS_HEADER, WS_PARAM, parseWs } from './lib/ws-tab';
import { esPublica, esPublicaSoloLeer, decidirRutaAlumno } from './lib/rutas-publicas';
import { HEADER_DOMINIO, RUTA_DOMINIO, consultaDelDominio, decidirHost, hostDeCabecera, paginaNoExisteDominio, tipoDeHost } from './lib/editor-landing/dominios-reglas';
import { decidirLEnApp, decidirLandings, redireccionEnElHost } from './lib/editor-landing/origen-landings';
import { MOVIL_ACTIVO, pedidoMovil } from './lib/movil-desvio';
import { VISTA_COOKIE, tipoDeDispositivo, vaAMovil } from './lib/movil-dispositivo';

// La lista de rutas públicas vive en lib/rutas-publicas.ts, no acá: es la condición
// que decide qué entra sin sesión, y adentro de un middleware ningún test la puede
// importar. Ya dejó una integración entera afuera sin que nada avisara — el detalle,
// con la pista que lo desenmascara, está en ese archivo.

// Rutas que además del login exigen rol admin. /metodo gestiona las
// credenciales del workspace (tokens globales) — solo admins.
const SOLO_ADMIN = ['/admin', '/api/admin', '/metodo', '/api/metodo'];

// ── Mudanza al dominio propio ────────────────────────────────────────────────
// MaKo se sirve SOLO desde HOST_CANONICO. Cualquier otro host —los *.vercel.app
// originales y, desde este cambio, también makodigital.app (el dominio anterior
// a este)— no responde más: recibe un cartel de mudanza que reenvía al mismo
// path del dominio bueno. La lógica es genérica (cualquier host ≠ canónico
// muda), así que un cambio de dominio futuro es solo pisar HOST_CANONICO acá +
// lib/app-url.ts + las env vars de Vercel — y sumar el dominio viejo a `DOMINIOS_DE_MAKO`
// (lib/editor-landing/dominios-reglas.ts): desde T7, un host que no es de MaKo es el dominio de una
// landing (`respuestaDominioPropio`, más abajo) y NO llega a este cartel. Tampoco hola-mako.site, el de
// las landings publicadas (tanda 4, `respuestaLandings`): sale antes que todo.
//
// Con tres excepciones que NO se pueden cortar, porque no las abre una persona.
// Todas validan por firma/secret propio, así que abrirlas por host no afloja nada:
//
//   · /api/cron     — PERMANENTE. Vercel invoca los crons contra la URL del
//                     DEPLOY (*.vercel.app), nunca contra el dominio. Sacarla
//                     apaga los 14 crons. No es deuda: es cómo funciona Vercel.
//   · /api/webhooks — Se puede sacar cuando TODOS los webhooks estén
//                     re-registrados en el dominio actual (las instancias de
//                     Evolution, Calendly, Fathom, Meta, Resend).
//                     Sacarla antes silencia WhatsApp y el alta de leads: el 410
//                     es definitivo, no hay reintento que lo salve.
//   · /api/track    — La landing NO es un webhook re-registrable por API: es HTML
//                     de un tercero (Lovable) donde el snippet queda CONGELADO con
//                     la URL del día que se copió, y hay que re-pegarlo en la
//                     landing de CADA cliente. Solo se saca cuando ninguna
//                     propiedad de terceros apunte a un host viejo — y eso se
//                     comprueba con datos (¿entran filas nuevas en landing_visits?),
//                     no suponiendo. Precedente: 18 días de tracking muerto sin
//                     un solo error visible.
const HOST_CANONICO = 'hola-mako.com';
const EXENTAS_DE_HOST = ['/api/cron', '/api/webhooks', '/api/track'];

function esHostCanonico(host: string): boolean {
  return host === HOST_CANONICO || host === `www.${HOST_CANONICO}`;
}

/**
 * Cartel de mudanza si el request no viene por el dominio propio. `null` = seguir.
 * Solo aplica en producción: los previews y el dev local tienen que seguir
 * respondiendo en su host.
 */
function respuestaMudanza(req: NextRequest, pathname: string): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null;

  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (!host || esHostCanonico(host)) return null;
  if (EXENTAS_DE_HOST.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null;

  const destino = `https://${HOST_CANONICO}${pathname}${req.nextUrl.search}`;

  // Las APIs no las mira nadie: 410 Gone y listo.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: `MaKo se mudó a https://${HOST_CANONICO}`, destino },
      { status: 410 },
    );
  }

  return new NextResponse(paginaMudanza(destino), {
    status: 410,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Cartel de mudanza: se ve el mensaje y a los 4s salta solo al dominio nuevo. */
function paginaMudanza(destino: string): string {
  const d = destino.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="4;url=${d}">
<title>Nos mudamos — MaKo</title>
<style>
  :root{--bg:#F4F6F9;--surface:#fff;--border:#EAECF1;--ink:#12151B;--dim:#5B6472;--primary:#2F6FED;--primary-strong:#245FD6}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--ink);
       font:400 16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .card{max-width:520px;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:16px;
        padding:40px 36px;text-align:center;box-shadow:0 1px 2px rgba(18,21,27,.04),0 8px 24px rgba(18,21,27,.06)}
  .logo{font-weight:700;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:28px}
  h1{margin:0 0 12px;font-size:30px;line-height:1.2;letter-spacing:-.02em}
  p{margin:0 0 8px;color:var(--dim)}
  .url{display:block;margin:24px 0 28px;font-size:15px;font-weight:600;color:var(--ink);word-break:break-all}
  a.btn{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;font-weight:600;font-size:15px;
        padding:13px 28px;border-radius:10px;transition:background .15s}
  a.btn:hover{background:var(--primary-strong)}
  .nota{margin-top:24px;font-size:13px;color:#98A0AC}
</style></head><body>
<main class="card">
  <div class="logo">MaKo</div>
  <h1>Nos mudamos</h1>
  <p>Esta dirección ya no está en uso. MaKo ahora vive en su dominio propio.</p>
  <span class="url">${d}</span>
  <a class="btn" href="${d}">Ir a MaKo</a>
  <p class="nota">Te llevamos solos en unos segundos. Actualizá tus favoritos.</p>
</main>
<script>setTimeout(function(){location.replace(${JSON.stringify(destino)})},4000)</script>
</body></html>`;
}

// ── El dominio propio de una landing (T7, docs/diseno-editor-landing.md) ────────
// Un host que NO es de MaKo (`esHostDeMako`, lib/editor-landing/dominios-reglas.ts: el canónico,
// los viejos y los *.vercel.app) es el dominio de un cliente, y ahí se sirve SÓLO su landing: `/` y
// `/<ruta>` se reescriben a la ruta interna (GET de app/api/landing-generator/dominio), que lee qué
// landing tiene ese dominio VERIFICADO y la arma igual que /l/<slug>; el HTML libre (/l/html) pasa;
// todo lo demás de la app y de /api —también cron, webhooks y track— es 404. La sesión no corre
// riesgo: la cookie de MaKo es de hola-mako.com y el navegador no la manda a otro dominio. Va
// ANTES del cartel de mudanza, y sólo en producción, como él.
//
// La consulta host → landing NO va acá: necesita la base, y el proxy es síncrono (su forma es un
// contrato: tests/alumno-sesion.test.ts lo ejecuta y lee `.status` sin `await`). La decisión que sí
// va acá es pura y tiene test (tests/editor-landing-dominios.test.ts).
//
// El PASO DE PAGO también se sirve en el dominio (Paquete 2 de la tanda 6): `/pagar/<producto>` se
// reescribe a la misma ruta interna (que resuelve el slug de ESTE dominio), y el POST de su formulario
// pasa sólo con un `Origin` ausente o de este host — el contrato de hola-mako.site (`respuestaLandings`).
function respuestaDominioPropio(req: NextRequest, pathname: string): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  const hostCrudo = req.headers.get('host');
  const d = decidirHost(hostCrudo, pathname, req.method, req.headers.get('origin'));
  if (d.tipo === 'app') return null;
  const host = hostDeCabecera(hostCrudo);
  // La cabecera del dominio la pone el proxy PISANDO la que traiga el pedido; la del workspace, nunca.
  const conDominio = () => {
    const headers = new Headers(req.headers);
    headers.delete(WS_HEADER);
    headers.set(HEADER_DOMINIO, host);
    return headers;
  };
  switch (d.tipo) {
    case 'sitio':
    case 'pago': {
      // La query la arma el proxy desde cero (`consultaDelDominio`): la del visitante no viaja.
      const u = req.nextUrl.clone();
      u.pathname = RUTA_DOMINIO;
      u.search = consultaDelDominio(d);
      return NextResponse.rewrite(u, { request: { headers: conDominio() } });
    }
    case 'pasar':
      return NextResponse.next({ request: { headers: conDominio() } });
    case 'minusculas':
      // En el MISMO dominio y con la query intacta (los utm_* son la atribución del anuncio).
      return redirigirEnElHost(req, d.destino);
    case 'metodo':
      return new NextResponse('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    case 'prohibido':
      return new NextResponse('Forbidden', { status: 403, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
    default:
      return noExisteFueraDeLaApp();
  }
}

/**
 * Un 308 en el MISMO host del pedido, con la query intacta. Si el destino saliera del host (`//otro.com`
 * es una URL relativa al protocolo: la redirección abierta de la revisión de la tanda 4), 404.
 */
function redirigirEnElHost(req: NextRequest, destino: string): NextResponse {
  const location = redireccionEnElHost(destino, req.nextUrl.search, hostDeCabecera(req.headers.get('host')));
  return location ? NextResponse.redirect(location, 308) : noExisteFueraDeLaApp();
}

/** El 404 de un host que no es la app (el dominio de un cliente, hola-mako.site): sin enumerar nada. */
function noExisteFueraDeLaApp(): NextResponse {
  return new NextResponse(paginaNoExisteDominio(), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}

// ── hola-mako.site: las landings publicadas (tanda 4, 14/10/2026) ──────────────
// Decisión de Martín: «Las landings enteras, como gamma.site». En ESE host se sirven sólo las
// landings: `/<slug>[/<ruta>]` y `/vista/<token>` se REESCRIBEN a las rutas de app/l (la URL que ve el
// visitante no cambia), `/l/html/…` pasa, y la raíz manda a la landing de venta de MaKo. Lo decide
// `decidirLandings` (lib/editor-landing/origen-landings.ts, puro y con test).
//
// ⚠️ ACÁ NO CORRE NADA DE LA APP, y es a propósito: ni el gate, ni la cookie de sesión (no se lee:
// la de MaKo es de hola-mako.com y el navegador no la manda a este host), ni el `?ws=`, ni el cartel
// de mudanza, ni MaKo Mobile. Sólo GET/HEAD, salvo UN POST: el del paso de pago de una landing
// (`RUTA_PAGAR_LANDING`, integración de la tanda 4), y sólo con un `Origin` ausente o de ESTE host
// (403 si no; la ruta lo vuelve a mirar en positivo, con sus topes). Y en CUALQUIER
// entorno: el host ya lo decide (un preview no tiene este dominio). Los headers internos se borran
// igual: una reescritura que llevara el del workspace o el del dominio propio es el IDOR de `seguir`.
function respuestaLandings(req: NextRequest, pathname: string): NextResponse {
  const d = decidirLandings(pathname, req.method, { origin: req.headers.get('origin'), host: hostDeCabecera(req.headers.get('host')) });
  const limpios = () => {
    const headers = new Headers(req.headers);
    headers.delete(WS_HEADER);
    headers.delete(HEADER_DOMINIO);
    return headers;
  };
  switch (d.tipo) {
    case 'reescribir': {
      const u = req.nextUrl.clone();
      u.pathname = d.destino;
      return NextResponse.rewrite(u, { request: { headers: limpios() } });
    }
    case 'pasar':
      return NextResponse.next({ request: { headers: limpios() } });
    case 'redirigir':
      // En el MISMO host y con la query intacta (los utm_* son la atribución del anuncio).
      return redirigirEnElHost(req, d.destino);
    case 'raiz':
      // 307 y no 308: el día que hola-mako.site tenga su portada propia, nadie la tiene cacheada.
      return NextResponse.redirect(`https://${HOST_CANONICO}/`, 307);
    case 'metodo':
      return new NextResponse('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    case 'prohibido':
      return new NextResponse('Forbidden', { status: 403, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
    default:
      return noExisteFueraDeLaApp();
  }
}

/**
 * Las landings se MUDARON a hola-mako.site (tanda 4): en producción, un `/l/<…>` en un host de la app
 * es un 308 a `https://hola-mako.site/<…>` con la query, y el HTML libre (`/l/html`) ya no se sirve
 * bajo el dominio de la app (`decidirLEnApp`). En local y en los previews /l sigue sirviendo: no
 * tienen el dominio. `null` = no es de /l, sigue.
 */
function respuestaLEnApp(req: NextRequest, pathname: string): NextResponse | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  const d = decidirLEnApp(pathname, req.nextUrl.search);
  if (d.tipo === 'seguir') return null;
  if (d.tipo === 'mudar') return NextResponse.redirect(d.destino, 308);
  return noExisteFueraDeLaApp();
}

/**
 * Dejar pasar el request, resolviendo de paso el workspace de ESTA pestaña.
 *
 * Reemplaza a `NextResponse.next()` en TODAS las salidas del gate, y eso es a
 * propósito: la primera cosa que hace es **borrar** `WS_HEADER` de lo que llegó.
 * Si una sola salida se olvidara de pasar por acá, cualquiera podría mandar ese
 * header a mano y leer los datos de otro cliente — el IDOR más caro de esta app.
 * Borrarlo siempre, y ponerlo solo nosotros, es lo que lo hace seguro.
 *
 * El header se pone ÚNICAMENTE si la sesión firmada dice `rol === 'admin'` (la
 * agencia). Para cualquier otro usuario, `?ws=` en la URL es texto decorativo:
 * su workspace sigue saliendo de su propia fila.
 *
 * No se chequea acá que el workspace EXISTA: eso es una consulta a la base en
 * cada request. Un id inventado no filtra nada — `getTenantDb` filtra por él y
 * devuelve cero filas, que es el fail-closed de siempre.
 */
function seguir(req: NextRequest) {
  return NextResponse.next({ request: { headers: headersSeguros(req) } });
}

/**
 * Los headers con los que sigue un pedido: sin los internos que pudo mandar cualquiera, y con el
 * workspace de la pestaña SÓLO si la sesión firmada es de un admin. Lo comparten `seguir` y el
 * rewrite de MaKo Mobile (`seguirOMovil`): una salida que no pase por acá es el IDOR de arriba.
 */
function headersSeguros(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  headers.delete(WS_HEADER);
  // El dominio propio de una landing lo pone SÓLO `respuestaDominioPropio`: en cualquier otra salida
  // se borra, o cualquiera podría pedirle a la ruta interna la landing de un dominio ajeno.
  headers.delete(HEADER_DOMINIO);

  const ws = parseWs(req.nextUrl.searchParams.get(WS_PARAM));
  // ⚠️ La sesión se verifica ACÁ ADENTRO y no se recibe por parámetro. Parece un
  // detalle y no lo es: `/api/auth/me` vive bajo `/api/auth`, que está en
  // PUBLICOS, así que sale por el early-return de arriba SIN pasar por la
  // verificación de sesión del final. Con la sesión como parámetro, esa ruta
  // nunca recibía el workspace — y es justo la que le dice al sidebar y al
  // cartel a qué cliente estás mirando. Verificar acá hace que las cinco
  // salidas se comporten igual sin que nadie tenga que acordarse.
  if (ws) {
    const sesion = verificarToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (sesion?.rol === 'admin') headers.set(WS_HEADER, String(ws));
  }
  return headers;
}

/**
 * MaKo Mobile con LAS MISMAS RUTAS (12/10/2026, Martín: «Las rutas deben ser las mismas, solo debe
 * detectar si estoy en mobile»). Un teléfono que pide /crm ve la página de /m/crm en la URL /crm: un
 * REWRITE, no un redirect. La decisión es pura y tiene test (`pedidoMovil`, lib/movil-desvio.ts).
 *
 * ⚠️ Sólo se llama en las dos salidas CON SESIÓN (o del gate apagado en local): nunca para lo público,
 * el alumno del curso ni /api (el proxy es el choke point de seguridad, AGENTS.md). Y el rewrite
 * lleva los MISMOS headers que `seguir` (`headersSeguros`): el workspace sale del `?ws=` del pedido
 * original, validado contra la sesión, y nunca de lo que mande el pedido.
 *
 * El teléfono es la misma pregunta que hace el layout (`prefiereMovil`): el UA y la cookie de
 * «Versión completa». Si las dos preguntas no coincidieran, la página de escritorio se dibujaría
 * tapada por <DesvioMovil> o el shell de /m sin su cromo; por eso las dos llaman a `vaAMovil`.
 */
function seguirOMovil(req: NextRequest, pathname: string) {
  const telefono = MOVIL_ACTIVO && vaAMovil(
    tipoDeDispositivo(req.headers.get('user-agent'), req.headers.get('sec-ch-ua-mobile')),
    req.cookies.get(VISTA_COOKIE)?.value,
  );
  const d = pedidoMovil({ pathname, search: req.nextUrl.search, metodo: req.method.toUpperCase(), telefono });
  if (d.tipo === 'redirigir') return NextResponse.redirect(new URL(d.destino, req.url));
  if (d.tipo === 'reescribir') {
    return NextResponse.rewrite(new URL(d.destino, req.url), { request: { headers: headersSeguros(req) } });
  }
  return seguir(req);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // hola-mako.site → sólo las landings publicadas, y NADA de lo de abajo (ni el gate ni la cookie).
  // Va primero: es contenido de clientes y nunca puede caer en una pantalla de la app.
  if (tipoDeHost(req.headers.get('host')) === 'landings') return respuestaLandings(req, pathname);

  // El dominio de una landing → sólo esa landing. Va antes que la mudanza, que trata a todo host
  // que no sea el canónico como un dominio viejo de MaKo.
  const propio = respuestaDominioPropio(req, pathname);
  if (propio) return propio;

  // Un /l/<…> en la app (producción) → la landing en hola-mako.site.
  const landing = respuestaLEnApp(req, pathname);
  if (landing) return landing;

  // Dominio viejo → cartel de mudanza. Va PRIMERO: ni el gate ni las rutas
  // públicas deben responder ahí.
  const mudanza = respuestaMudanza(req, pathname);
  if (mudanza) return mudanza;

  // La raíz es la landing pública de venta. Se chequea aparte y no dentro de
  // PUBLICOS: meter '/' en esa lista se lee como "todo es público" aunque el
  // prefijo '//' no matchee nada. Solo lectura — no hay nada que postear acá.
  if (pathname === '/') {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }
    return seguir(req);
  }

  // Las rutas públicas pasan siempre (tienen su propia auth por firma/secret).
  // Se evalúa primero para que ni el modo fail-closed las toque.
  if (esPublica(pathname)) {
    // ⚠️ TODA PÁGINA pública es de sólo lectura, no sólo las de la lista: una página que
    // acepta POST ejecuta server actions SIN SESIÓN contra el ws1 (medido el 06/10/2026; el
    // porqué completo en `esPublicaSoloLeer`, lib/rutas-publicas.ts).
    const soloLectura = esPublicaSoloLeer(pathname);
    if (soloLectura && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }
    // Sin sesión: `seguir` no pone nada, pero igual BORRA el header. Un webhook
    // o el beacon del VSL no pueden elegir workspace mandándolo a mano.
    return seguir(req);
  }

  // El alumno del curso (/mi-curso): una rama propia, en POSITIVO y exacta. Pasa SIN
  // `mako_session` porque la página se autentica sola con `mako_alumno` (y la revalida contra la
  // base en cada pedido); todo lo demás sigue cayendo en el gate de abajo, así que esa cookie no
  // abre ninguna otra cosa. Una acción del servidor o un POST ahí se corta: el porqué, en
  // `decidirRutaAlumno` (lib/rutas-publicas.ts).
  const alumno = decidirRutaAlumno(pathname, req.method, req.headers.has('next-action'));
  if (alumno === 'prohibido') return new NextResponse('Forbidden', { status: 403 });
  if (alumno === 'pasa') return seguir(req);

  // CSRF: las APIs internas se autentican por COOKIE, así que una mutación
  // cross-site desde el navegador de un usuario logueado llevaría su cookie. Un
  // POST cross-origin del navegador SIEMPRE manda header Origin; exigimos que su
  // host coincida con el nuestro. (Los webhooks/cron/track ya salieron arriba: son
  // cross-origin por diseño y validan por firma/secret.) Sin Origin (server-to-
  // server, sin cookie de víctima) no es un ataque CSRF → se deja pasar al gate.
  const metodo = req.method.toUpperCase();
  if (
    (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH' || metodo === 'DELETE') &&
    pathname.startsWith('/api/')
  ) {
    const origin = req.headers.get('origin');
    if (origin) {
      let originHost: string | null = null;
      try { originHost = new URL(origin).host; } catch { originHost = null; }
      if (!originHost || originHost !== req.headers.get('host')) {
        return NextResponse.json({ ok: false, error: 'origen no permitido' }, { status: 403 });
      }
    }
  }

  // Gate sin configurar: fail-closed en producción, y en local SÓLO con permiso explícito y
  // desde la máquina (`sinLoginPermitido`, lib/auth-session.ts). Antes en local dejaba pasar
  // todo, y `next dev` escucha en toda la red con la base de producción detrás (15/10/2026).
  if (!gateConfigurado()) {
    const esProd =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    // Sin AUTH_SECRET no hay sesión que verificar, así que tampoco hay a quién creerle: se
    // borra el header y no se pone ninguno.
    if (!esProd && sinLoginPermitido(req.headers.get('host'))) return seguirOMovil(req, pathname);
    if (!esProd) return sinSecretoEnLocal(pathname);
    console.error('[gate] AUTH_SECRET sin setear en producción → negando rutas protegidas');
    return denegar(req, pathname);
  }

  const esAdminRoute = SOLO_ADMIN.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // Sesión firmada. Es el ÚNICO camino: la cookie compartida ya no existe (era
  // una cookie cuyo valor ERA el secreto — el que la tenía podía firmarse una
  // sesión de admin a mano). Se entra con Google y nada más.
  const sesion = verificarToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (sesion) {
    if (esAdminRoute && sesion.rol !== 'admin') return denegarRol(req, pathname);
    return seguirOMovil(req, pathname);
  }

  return denegar(req, pathname);
}

// Local sin AUTH_SECRET y sin el permiso explícito: no hay login que funcione (no se puede
// firmar una sesión), así que se dice qué falta en vez de mandar a un /login que va a fallar.
function sinSecretoEnLocal(pathname: string) {
  const que = 'Falta AUTH_SECRET en .env.local. Para entrar sin login en ESTA máquina: MAKO_DEV_SIN_LOGIN=1 (y abrí localhost).';
  if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: que }, { status: 503 });
  return new NextResponse(que, { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

// Niega una ruta protegida: 401 JSON para las APIs, redirect a /login para las
// páginas (preservando el destino en ?next).
function denegar(req: NextRequest, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// Logueado pero sin rol: 403 para APIs, a su home para páginas. Va a /inicio (el
// repartidor por rol), no a '/': la raíz es la landing de venta y dejar ahí a
// alguien que YA está logueado es echarlo de la app.
function denegarRol(req: NextRequest, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/inicio';
  url.search = '';
  return NextResponse.redirect(url);
}

// Corre en todo menos assets estáticos.
//
// ⚠️ LOS ASSETS `.json` DE /conocimientos VAN EXCLUIDOS POR RUTA, y son los únicos así:
//   · `cono-tx/`  — las transcripciones (`public/cono-tx/<videoId>.json`)
//   · `cono-doc/` — el material de las clases (`public/cono-doc/<slug>.json`)
//   · `ve/`       — los recursos del Video Editor (`public/ve/`: el atlas de fuentes
//                   `.json` + `.avif`, banderas, formas). NO se exime `video-editor/`:
//                   el lookahead sacaría del proxy también a la PÁGINA del editor, y
//                   el proxy es el único que valida el `?ws=` del super admin.
//
// La lista de extensiones de acá no incluye `.json` —y no conviene que lo haga, hay
// endpoints que sí tienen que estar gateados—, así que esos archivos entran al
// middleware y sin sesión se van a /inicio con un 307. La respuesta llega con status
// 200 y `content-type: text/html`: el `fetch` no falla, recibe el HTML de la app y el
// `.json()` explota. Por eso el mensaje que se ve es «no pude cargar», nunca un 401.
//
// ⚠️ Y EL SÍNTOMA ENGAÑA IGUAL LAS DOS VECES: con sesión de admin se ve perfecto, y
// falla SOLO en /compartido/<token>, que va sin login. Con las transcripciones eso
// duró meses —cada link repartido decía «No se pudo cargar la transcripción» mientras
// del lado del admin estaba todo bien— y lo encontró el dueño. Con `cono-doc` pasó lo
// mismo el día que se agregó: el material se veía en /conocimientos y no en el link.
//
// **Si agregás otro asset `.json` público bajo /conocimientos, va acá.** No hay guarda
// que lo detecte: se ve bien en toda prueba hecha con sesión.
//
// Son assets públicos de verdad: no llevan ningún dato de sesión, y el que tiene el
// videoId ya tiene el video.
//
// ⚠️ El punto de `favicon\\.ico` va ESCAPADO: suelto es un comodín, y el lookahead dejaba fuera del
// proxy todo lo que empezara con `favicon` + cualquier carácter + `ico`. En hola-mako.site el primer
// segmento es el slug, y `favicon-ico-promo` es uno válido: caía en el 404 de la APP en vez de su
// landing (revisión de la tanda 4; el test compila el matcher como Next y lo cruza con slugs).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|cono-tx/|cono-doc/|ve/|.*\\.(?:png|jpe?g|svg|webp|gif|ico|css|js|woff2?|webmanifest)$).*)'],
};
