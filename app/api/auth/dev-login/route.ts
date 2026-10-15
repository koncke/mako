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
// ⚠️ Y SÓLO DESDE LA MÁQUINA (15/10/2026). `next dev` escucha en toda la red y detrás está la base
// de producción: esta ruta le daba un admin global a cualquiera de la misma WiFi, o a una página web
// por DNS rebinding. Ahora el Host tiene que ser localhost, 127.0.0.1 o [::1] (`devLoginPermitido`),
// y el script `dev` levanta el servidor sólo en 127.0.0.1. Las tres capas, en lib/auth-session.ts.
//
// GET /api/auth/dev-login[?next=/ruta][?ws=9]  → setea la cookie de sesión admin y
// redirige. `ws` elige el workspace del admin (sin impersonar): sin él, un admin sin
// workspace propio cae al del dueño, y probar el tablero del super-admin —que vive en
// otro workspace— era imposible desde acá.

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_DIAS, crearToken, destinoSeguro, devLoginPermitido } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Muerto en Vercel, en producción y para todo pedido que no nombre a esta máquina.
  if (!devLoginPermitido(req.headers.get('host'))) {
    return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  }
  const wsQ = Number(req.nextUrl.searchParams.get('ws'));
  const ws = Number.isInteger(wsQ) && wsQ > 0 ? wsQ : undefined;
  // `rol` para poder ver la app COMO LA VE UN CLIENTE (rol 'usuario'), que no es lo mismo
  // que un admin impersonando: el admin arrastra su banner, su layout y sus permisos, y
  // hay bugs que solo se ven del lado del cliente.
  const rolQ = req.nextUrl.searchParams.get('rol');
  const rol = rolQ === 'usuario' || rolQ === 'admin' ? rolQ : 'admin';
  // `mfa: 'dev'`: sin eso un token de admin no vale (verificarToken). Esta ruta ya es 404
  // en cualquier deploy, así que no abre ninguna puerta sin segundo factor en producción.
  const token = crearToken({ sub: 'dev', email: 'dev@local', nombre: 'Dev (local)', rol, ws, mfa: 'dev' });
  if (!token) {
    return NextResponse.json({ ok: false, error: 'falta AUTH_SECRET en .env.local' }, { status: 500 });
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
