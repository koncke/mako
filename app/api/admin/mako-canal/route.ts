// =============================================================================
// /api/admin/mako-canal — canal propio de MaKo (SuperAdmin): estado + QR + voz
// =============================================================================
// Solo admin. GET → estado del canal. POST { action }:
//   'conectar'    → devuelve el QR para escanear con el número de MaKo.
//   'usar'        → { usar } fija/saca mako_superadmin como la voz de MaKo.
//   'desconectar' → cierra sesión y borra la instancia.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { estadoCanalMaKo, conectarCanalMaKo, usarCanalComoVoz, desconectarCanalMaKo } from '@/lib/mako-canal';

export const dynamic = 'force-dynamic';
// Recuperar una línea trabada encadena sondeo + logout + reintentos + crear una
// nueva: puede pasar holgado los 15 s. Cortada a mitad, el botón «no hace nada».
export const maxDuration = 60;

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  return NextResponse.json({ ok: true, ...(await estadoCanalMaKo()) });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { action?: string; usar?: boolean };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  switch (body.action) {
    case 'conectar': {
      const r = await conectarCanalMaKo();
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    case 'usar': {
      await usarCanalComoVoz(body.usar !== false);
      return NextResponse.json({ ok: true });
    }
    case 'desconectar': {
      return NextResponse.json(await desconectarCanalMaKo());
    }
    default:
      return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
