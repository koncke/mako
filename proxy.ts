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
// '/vsl' es la landing pública de venta de MaKo (no figura en el sidebar) y
// '/vsl-assets' sus videos (.mp4 no lo excluye el matcher de abajo).
// '/api/email/unsubscribe' es la baja del email: la abren destinatarios externos
// (sin cookie) y el POST One-Click de Gmail/Apple; valida con su propio token HMAC.
const PUBLICOS = ['/api/webhooks', '/api/track', '/api/cron', '/api/email/unsubscribe', '/login', '/api/auth', '/vsl', '/vsl-assets'];

// Rutas que además del login exigen rol admin. /metodo gestiona las
// credenciales del workspace (tokens globales) — solo admins.
const SOLO_ADMIN = ['/admin', '/api/admin', '/metodo', '/api/metodo'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Las rutas públicas pasan siempre (tienen su propia auth por firma/secret).
  // Se evalúa primero para que ni el modo fail-closed las toque.
  if (PUBLICOS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
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
