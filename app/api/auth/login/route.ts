// =============================================================================
// Login: verifica la contraseña compartida y setea la cookie de sesión
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const esperado = process.env.DASHBOARD_PASSWORD;
  const cookieVal = process.env.AUTH_COOKIE_VALUE;
  if (!esperado || !cookieVal) {
    return NextResponse.json({ ok: false, error: 'auth no configurada' }, { status: 500 });
  }

  let password = '';
  try {
    const b = (await req.json()) as { password?: unknown };
    password = typeof b.password === 'string' ? b.password : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }

  if (password !== esperado) {
    return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: 'mako_auth',
    value: cookieVal,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return res;
}
