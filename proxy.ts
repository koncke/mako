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

// Prefijos públicos (no requieren login).
// '/' es la landing de venta de MaKo (antes vivía en /vsl). Solo la ve quien NO
// tiene sesión: app/page.tsx redirige a los logueados a su home según el rol.
// '/vsl' es la ruta vieja de esa misma landing y sigue viva (hay anuncios y
// links apuntando ahí); redirige a '/'. '/vsl/<slug>' son los detalles de
// features y '/vsl-assets' sus videos (.mp4 no lo excluye el matcher de abajo).
// '/api/email/unsubscribe' es la baja del email: la abren destinatarios externos
// (sin cookie) y el POST One-Click de Gmail/Apple; valida con su propio token HMAC.
// '/compartido' y '/api/compartido' son los links que Martín le pasa a alguien
// de afuera (material de marca). Son GET-only y validan su propio token contra
// la fila viva en CADA request: el token no es una sesión y no da acceso a nada
// más que a lo que ese link comparte.
const PUBLICOS = ['/api/webhooks', '/api/track', '/api/cron', '/api/email/unsubscribe', '/login', '/api/auth', '/vsl', '/vsl-assets', '/compartido', '/api/compartido'];

// Los públicos que solo deben responder a LECTURA. El early-return de abajo
// saltea el chequeo CSRF de Origin, así que una ruta pública que acepte POST
// quedaría expuesta: estas se cortan acá si el método no es de lectura.
const PUBLICOS_SOLO_LECTURA = ['/compartido', '/api/compartido'];

// Rutas que además del login exigen rol admin. /metodo gestiona las
// credenciales del workspace (tokens globales) — solo admins.
const SOLO_ADMIN = ['/admin', '/api/admin', '/metodo', '/api/metodo'];

// ── Mudanza a makodigital.app ────────────────────────────────────────────────
// MaKo se sirve SOLO desde el dominio propio. A los *.vercel.app (el alias viejo
// dashboard-marketing-six, el de la rama y los de cada deploy) no se entra más:
// devuelven un cartel de mudanza que reenvía al mismo path del dominio bueno.
//
// Con dos excepciones que NO se pueden cortar, porque no las abre una persona:
//   · /api/cron      — Vercel invoca los crons contra la URL del DEPLOY, no
//                      contra el dominio. Bloquearlos apagaba todos los crons.
//   · /api/webhooks  — Chatwoot y Evolution tienen registrada la URL vieja.
//     /api/track       Cortarlas silenciaba WhatsApp hasta re-registrarlas.
// Ambas se autentican por firma/secret propio, así que abrirlas por host no
// afloja nada. Cuando los webhooks queden re-registrados en makodigital.app,
// '/api/webhooks' y '/api/track' pueden salir de esta lista.
const HOST_CANONICO = 'makodigital.app';
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
      { ok: false, error: 'MaKo se mudó a https://makodigital.app', destino },
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
    return NextResponse.next();
  }

  // Las rutas públicas pasan siempre (tienen su propia auth por firma/secret).
  // Se evalúa primero para que ni el modo fail-closed las toque.
  if (PUBLICOS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const soloLectura = PUBLICOS_SOLO_LECTURA.some((p) => pathname === p || pathname.startsWith(p + '/'));
    if (soloLectura && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return new NextResponse('Method Not Allowed', { status: 405 });
    }
    return NextResponse.next();
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
    if (!esProd) return NextResponse.next();
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
    return NextResponse.next();
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

// Logueado pero sin rol: 403 para APIs, a la home para páginas.
function denegarRol(req: NextRequest, pathname: string) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.search = '';
  return NextResponse.redirect(url);
}

// Corre en todo menos assets estáticos.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|gif|ico|css|js|woff2?)$).*)'],
};
