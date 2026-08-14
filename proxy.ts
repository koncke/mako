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
import { SESSION_COOKIE, gateConfigurado, verificarToken } from './lib/auth-session';
import { WS_HEADER, WS_PARAM, parseWs } from './lib/ws-tab';
import { esPublica, esPublicaSoloLectura } from './lib/rutas-publicas';

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
// lib/app-url.ts + las env vars de Vercel.
//
// Con tres excepciones que NO se pueden cortar, porque no las abre una persona.
// Todas validan por firma/secret propio, así que abrirlas por host no afloja nada:
//
//   · /api/cron     — PERMANENTE. Vercel invoca los crons contra la URL del
//                     DEPLOY (*.vercel.app), nunca contra el dominio. Sacarla
//                     apaga los 14 crons. No es deuda: es cómo funciona Vercel.
//   · /api/webhooks — Se puede sacar cuando TODOS los webhooks estén
//                     re-registrados en el dominio actual (Chatwoot, las 4
//                     instancias de Evolution, Calendly, Fathom, Meta, Resend).
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
  const headers = new Headers(req.headers);
  headers.delete(WS_HEADER);

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

  return NextResponse.next({ request: { headers } });
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    const soloLectura = esPublicaSoloLectura(pathname);
    if (soloLectura && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }
    // Sin sesión: `seguir` no pone nada, pero igual BORRA el header. Un webhook
    // o el beacon del VSL no pueden elegir workspace mandándolo a mano.
    return seguir(req);
  }

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

  // Gate sin configurar: no-op en local/dev, fail-closed en producción.
  if (!gateConfigurado()) {
    const esProd =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    // En local sin AUTH_SECRET no hay sesión que verificar, así que tampoco hay
    // a quién creerle: se borra el header y no se pone ninguno.
    if (!esProd) return seguir(req);
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
    return seguir(req);
  }

  return denegar(req, pathname);
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
// ⚠️ `cono-tx` va excluido POR RUTA y no por extensión, y es lo único así. Son las
// transcripciones de /conocimientos, estáticas en `public/cono-tx/<videoId>.json`.
// La lista de extensiones de acá no incluye `.json` —y no conviene que lo haga, hay
// endpoints que sí tienen que estar gateados—, así que esos archivos entraban al
// middleware y sin sesión se iban a /inicio con un 307.
//
// El síntoma era engañoso: en /conocimientos (con sesión de admin) las transcripciones
// se veían perfectas, y fallaban SOLO en /compartido/<token>, que va sin login. O sea
// que cada link repartido llevaba meses mostrando «No se pudo cargar la transcripción»
// mientras del lado del admin todo estaba bien. Lo vio el dueño en un link compartido.
//
// Es un asset público de verdad: no lleva ningún dato de sesión y el que tiene el
// videoId ya tiene el video.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|cono-tx/|.*\\.(?:png|jpe?g|svg|webp|gif|ico|css|js|woff2?)$).*)'],
};
