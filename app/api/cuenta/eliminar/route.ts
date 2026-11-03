// =============================================================================
// /api/cuenta/eliminar — «Eliminar mi cuenta» de la persona que está frente al teclado (3/11/2026)
// =============================================================================
// GET  → qué se llevaría (`estadoDeMiBaja`), para la confirmación.
// POST { confirmar: 'eliminar', alcance } → lo pide (lib/baja-cuenta.ts). La palabra la manda el botón de la confirmación: sin ella no
//        hace nada, así un POST suelto no apaga a nadie. `alcance` es lo que la persona leyó: si cambió, 409 y lo vuelve a leer.
//
// ⚠️ NO VA EN PUBLICOS: es con sesión, y el proxy le mira el Origin. Lo que se borra sale de la fila de la SESIÓN (`usuarios`), y
//    el `?ws=` de la pestaña que pega WsFetch no se lee.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { estadoDeMiBaja, pedirBajaDeMiCuenta } from '@/lib/baja-cuenta';
import { CONFIRMACION_BAJA } from '@/lib/baja-cuenta-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await estadoDeMiBaja()) });
  } catch (e) {
    console.error('[baja-cuenta] no pude leer:', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: 'No pudimos leer tu cuenta.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getUsuarioActual())) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { confirmar?: unknown; alcance?: unknown } | null;
  if (body?.confirmar !== CONFIRMACION_BAJA) return Response.json({ ok: false, error: 'Falta la confirmación.' }, { status: 400 });
  try {
    const r = await pedirBajaDeMiCuenta(body.alcance === 'persona' || body.alcance === 'negocio' ? body.alcance : null);
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
    return Response.json({ ok: true, alcance: r.alcance, hasta: r.hasta, yaEstaba: r.yaEstaba });
  } catch (e) {
    console.error('[baja-cuenta] no pude pedirla:', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: 'No pudimos anotar tu pedido.' }, { status: 500 });
  }
}
