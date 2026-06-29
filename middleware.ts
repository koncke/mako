// =============================================================================
// Gate de acceso al dashboard (login con contraseña compartida)
// =============================================================================
// Protege páginas + APIs internas. Exime los endpoints públicos que llaman
// servicios externos (webhooks de Calendly/Meta/Fathom, el beacon del VSL, y
// los crons — todos con su propia auth por firma/secret).
//
// Activación: el gate se prende con DASHBOARD_PASSWORD + AUTH_COOKIE_VALUE
// (env vars de Vercel). Si falta alguna:
//   - en local/dev → el gate queda INACTIVO (no-op), para no romper el flujo
//     sin Supabase ni envs cargadas.
//   - en producción → FAIL-CLOSED: se NIEGAN las rutas protegidas. Si alguien
//     olvida la env en Vercel preferimos un dashboard cerrado a uno abierto.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

// Prefijos públicos (no requieren login).
// '/vsl' es la landing pública de venta de MaKo (no figura en el sidebar) y
// '/vsl-assets' sus videos (.mp4 no lo excluye el matcher de abajo).
const PUBLICOS = ['/api/webhooks', '/api/track', '/api/cron', '/login', '/api/auth', '/vsl', '/vsl-assets'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Las rutas públicas pasan siempre (tienen su propia auth por firma/secret).
  // Se evalúa primero para que ni el modo fail-closed las toque.
  if (PUBLICOS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const esperado = process.env.AUTH_COOKIE_VALUE;
  const configurado = Boolean(process.env.DASHBOARD_PASSWORD && esperado);

  // Gate sin configurar: no-op en local/dev, fail-closed en producción.
  if (!configurado) {
    const esProd =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    if (!esProd) return NextResponse.next();
    console.error(
      '[gate] DASHBOARD_PASSWORD/AUTH_COOKIE_VALUE sin setear en producción → negando rutas protegidas',
    );
    return denegar(req, pathname);
  }

  const cookie = req.cookies.get('mako_auth')?.value;
  if (cookie === esperado) return NextResponse.next();

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

// Corre en todo menos assets estáticos.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|gif|ico|css|js|woff2?)$).*)'],
};
