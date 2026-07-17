// =============================================================================
// Logout: borra TODAS las cookies de sesión
// =============================================================================
// La de impersonación (mako_ws) también, y no es un detalle: dura 12h y el único
// lugar que la limpiaba era el botón "salir" del banner de impersonación. Un
// admin que impersonaba a un cliente y cerraba sesión desde el sidebar dejaba esa
// cookie viva; al volver a entrar, seguía metido en el workspace del cliente sin
// que nada lo dijera. Cerrar sesión tiene que cerrar TODO.
//
// LEGACY_COOKIE (mako_auth) ya no autentica nada —el login es solo Google— pero
// se sigue limpiando a propósito: la cookie vieja puede estar viva en el browser
// de cualquiera que haya usado la contraseña maestra, y su valor ERA el secreto.
// Esto la barre.

import { NextResponse } from 'next/server';
import { EMAIL_COOKIE, IMPERSONATE_COOKIE, LEGACY_COOKIE, SESSION_COOKIE } from '@/lib/auth-session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const base = {
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  res.cookies.set({ name: SESSION_COOKIE, ...base });
  res.cookies.set({ name: LEGACY_COOKIE, ...base });
  res.cookies.set({ name: IMPERSONATE_COOKIE, ...base });
  res.cookies.set({ name: EMAIL_COOKIE, ...base, httpOnly: false });
  return res;
}
