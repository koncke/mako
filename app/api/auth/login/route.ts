// =============================================================================
// Login con contraseña: la contraseña maestra abre una sesión ADMIN firmada
// =============================================================================
// Es el fallback de emergencia (Google caído, DB caída, primer arranque): no
// depende de la tabla usuarios. Quien tenga DASHBOARD_PASSWORD es admin.

import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_DIAS, crearToken } from '@/lib/auth-session';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Comparación en tiempo constante (no filtra el largo/prefijo del password por timing). */
function passwordOk(recibido: string, esperado: string): boolean {
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const esperado = process.env.DASHBOARD_PASSWORD;
  if (!esperado || !process.env.AUTH_COOKIE_VALUE) {
    return NextResponse.json({ ok: false, error: 'auth no configurada' }, { status: 500 });
  }

  // Anti fuerza bruta del password maestro: pocos intentos por IP.
  if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos, esperá un minuto' }, { status: 429 });
  }

  let password = '';
  try {
    const b = (await req.json()) as { password?: unknown };
    password = typeof b.password === 'string' ? b.password : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  if (!passwordOk(password, esperado)) {
    return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const token = crearToken({ sub: 'password', email: '', nombre: 'Admin', rol: 'admin' });
  if (!token) {
    return NextResponse.json({ ok: false, error: 'auth no configurada' }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DIAS,
  });
  return res;
}
