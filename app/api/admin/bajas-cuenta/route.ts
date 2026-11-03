// =============================================================================
// /api/admin/bajas-cuenta — los pedidos de «Eliminar mi cuenta», para el super admin (3/11/2026)
// =============================================================================
// GET → los pendientes. POST { id, accion: 'cancelar' | 'eliminar-persona' | 'terminar' }. El negocio entero no se borra por acá: va por
// «Eliminar…» de su fila (`eliminarWorkspace`), con el nombre escrito a mano, y al terminar cierra su pedido. `terminar`: ya no existe, y lo que había
// quedado se resolvió.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { bajasPendientes, cancelarBaja, ejecutarBajaDePersona, terminarBaja } from '@/lib/baja-cuenta';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, bajas: await bajasPendientes() });
  } catch (e) {
    console.error('[baja-cuenta] no pude leer los pedidos:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: 'No pude leer quién pidió eliminar su cuenta.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sesion = await getSesionAdmin();
  if (!sesion) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; accion?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: 'id inválido' }, { status: 400 });
  const r = body?.accion === 'cancelar' ? await cancelarBaja(id, sesion.email)
    : body?.accion === 'eliminar-persona' ? await ejecutarBajaDePersona(id, sesion.email)
      : body?.accion === 'terminar' ? await terminarBaja(id, sesion.email)
      : { ok: false as const, error: 'acción inválida' };
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
