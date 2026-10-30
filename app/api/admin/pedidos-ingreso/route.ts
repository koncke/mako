// =============================================================================
// /api/admin/pedidos-ingreso — la bandeja «Quieren entrar» (lib/pedidos-ingreso.ts)
// =============================================================================
// GET                → los pendientes, sin quien ya tiene usuario.
// POST { id }        → descartar uno.
//
// Aceptar no pasa por acá: es el «Nuevo cliente» de siempre (/api/admin/workspaces), que crea la cuenta y manda el acceso. Sólo
// el super admin: son correos de personas que todavía no son de nadie.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { descartarPedido, pedidosPendientes } from '@/lib/pedidos-ingreso';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await pedidosPendientes()) });
  } catch (e) {
    console.error('[pedidos-ingreso] no pude leer la bandeja:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: 'No pude leer quién quiere entrar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const r = await descartarPedido(Number(body?.id), sesion.email);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: r.error }, { status: 400 });
}
