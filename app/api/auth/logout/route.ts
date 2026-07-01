// =============================================================================
// Logout: borra la sesión firmada, la legacy y el email
// =============================================================================

import { NextResponse } from 'next/server';
import { EMAIL_COOKIE, LEGACY_COOKIE, SESSION_COOKIE } from '@/lib/auth-session';

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
  res.cookies.set({ name: EMAIL_COOKIE, ...base, httpOnly: false });
  return res;
}
