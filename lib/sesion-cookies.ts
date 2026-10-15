// =============================================================================
// sesion-cookies — UNA forma de poner (y sacar) las cookies del login
// =============================================================================
// Las ponen dos rutas: el callback de Google (cuando no hace falta segundo paso, o el
// dispositivo es de confianza) y `/api/auth/2fa` (cuando el segundo paso salió bien).
// Con dos copias, la que se queda vieja es la que deja una cookie con otros flags —o el
// paso intermedio vivo después de entrar—, así que viven acá.

import type { NextResponse } from 'next/server';
import {
  SESSION_COOKIE, EMAIL_COOKIE, SESSION_DIAS, PREAUTH_COOKIE, PREAUTH_MINUTOS, DISPOSITIVO_COOKIE,
  crearToken, type Rol,
} from './auth-session';
import { DISPOSITIVO_DIAS, type Amr } from './mfa-reglas';

const base = () => ({ secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });

/** La sesión completa. Devuelve false si no hay secreto de firma (no se puede emitir). */
export function ponerSesion(
  res: NextResponse,
  s: { sub: string; email: string; nombre: string; rol: Rol; mfa?: Amr },
): boolean {
  const token = crearToken({ sub: s.sub, email: s.email, nombre: s.nombre, rol: s.rol, ...(s.mfa ? { mfa: s.mfa } : {}) });
  if (!token) return false;
  const dias = 60 * 60 * 24 * SESSION_DIAS;
  res.cookies.set({ name: SESSION_COOKIE, value: token, httpOnly: true, maxAge: dias, ...base() });
  res.cookies.set({ name: EMAIL_COOKIE, value: s.email, httpOnly: false, maxAge: dias, ...base() });
  // El paso intermedio se cierra en el mismo movimiento: vivo después de entrar no sirve
  // para nada y es una credencial más dando vueltas.
  sacarPreauth(res);
  return true;
}

export function ponerPreauth(res: NextResponse, token: string): void {
  res.cookies.set({ name: PREAUTH_COOKIE, value: token, httpOnly: true, maxAge: 60 * PREAUTH_MINUTOS, ...base() });
}

export function sacarPreauth(res: NextResponse): void {
  res.cookies.set({ name: PREAUTH_COOKIE, value: '', maxAge: 0, path: '/' });
}

export function ponerDispositivo(res: NextResponse, token: string): void {
  res.cookies.set({ name: DISPOSITIVO_COOKIE, value: token, httpOnly: true, maxAge: 60 * 60 * 24 * DISPOSITIVO_DIAS, ...base() });
}
