// =============================================================================
// /api/admin/impersonate — el admin "entra como" un cliente (y sale)
// =============================================================================
// POST { ws }  → setea la cookie firmada mako_ws: el admin ve el dashboard de
//                ese workspace (todo el scoping ya la respeta).
// POST { salir: true } / DELETE → borra la cookie (vuelve al panel de admin).
// Solo admin (getSesionAdmin re-chequea el rol vigente contra la base).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { firmarImpersonacion, getWorkspace, IMPERSONATE_COOKIE } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function limpiar() {
  const res = NextResponse.json({ ok: true, impersonando: false });
  res.cookies.set({ name: IMPERSONATE_COOKIE, value: '', ...cookieBase, maxAge: 0 });
  return res;
}

export async function DELETE() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return limpiar();
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });

  let body: { ws?: unknown; salir?: unknown };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  if (body.salir === true) return limpiar();

  const ws = Number(body.ws);
  if (!Number.isInteger(ws) || ws <= 0) {
    return NextResponse.json({ ok: false, error: 'workspace inválido' }, { status: 400 });
  }
  // El workspace tiene que existir.
  const wsRow = await getWorkspace(ws);
  if (!wsRow) return NextResponse.json({ ok: false, error: 'workspace no encontrado' }, { status: 404 });

  const token = firmarImpersonacion(ws);
  if (!token) return NextResponse.json({ ok: false, error: 'auth no configurada' }, { status: 500 });

  const res = NextResponse.json({ ok: true, impersonando: true, ws, nombre: wsRow.nombre });
  res.cookies.set({ name: IMPERSONATE_COOKIE, value: token, ...cookieBase, maxAge: 60 * 60 * 12 });
  return res;
}
