// =============================================================================
// Login SOLO-DEV: abre una sesión ADMIN sin contraseña, para automatización local
// =============================================================================
// Existe para que herramientas de desarrollo (incluido Claude/MaKo) puedan
// autenticarse contra el dev server LOCAL sin escribir la contraseña maestra —
// firma el token con el mismo secret que ya está en .env.local.
//
// SEGURIDAD: es INERTE en cualquier entorno desplegado. Solo responde si NO
// estamos en Vercel y NO estamos en producción; en cualquier otro caso devuelve
// 404 (como si la ruta no existiera). Nunca abre una puerta en prod.
//
// GET /api/auth/dev-login[?next=/ruta]  → setea la cookie de sesión admin y redirige.

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_DIAS, crearToken, destinoSeguro } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

/** Solo dev local: muerto en Vercel y en producción. */
function habilitado(): boolean {
  if (process.env.VERCEL) return false; // cualquier deploy en Vercel
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!habilitado()) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
  const token = crearToken({ sub: 'dev', email: 'dev@local', nombre: 'Dev (local)', rol: 'admin' });
  if (!token) {
    return NextResponse.json({ ok: false, error: 'falta AUTH_SECRET / AUTH_COOKIE_VALUE / DASHBOARD_PASSWORD en .env.local' }, { status: 500 });
  }
  const next = destinoSeguro(req.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: false, // dev local corre en http
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DIAS,
  });
  return res;
}
