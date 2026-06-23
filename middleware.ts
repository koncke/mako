// =============================================================================
// Gate de acceso al dashboard (login con contraseña compartida)
// =============================================================================
// Protege páginas + APIs internas. Exime los endpoints públicos que llaman
// servicios externos (webhooks de Calendly/Meta/Fathom, el beacon del VSL, y
// los crons — todos con su propia auth por firma/secret).
//
// SEGURO de desplegar: si DASHBOARD_PASSWORD no está seteado, el gate queda
// INACTIVO (no bloquea nada). Se activa al cargar DASHBOARD_PASSWORD +
// AUTH_COOKIE_VALUE en las env vars (Vercel).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

// Prefijos públicos (no requieren login).
const PUBLICOS = ['/api/webhooks', '/api/track', '/api/cron', '/login', '/api/auth'];

export function middleware(req: NextRequest) {
  // Gate inactivo hasta configurar la contraseña.
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLICOS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get('mako_auth')?.value;
  const esperado = process.env.AUTH_COOKIE_VALUE;
  if (esperado && cookie === esperado) return NextResponse.next();

  // No autenticado.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

// Corre en todo menos assets estáticos.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|gif|ico|css|js|woff2?)$).*)'],
};
