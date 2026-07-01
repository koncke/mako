// =============================================================================
// /api/retro — retrospectivas de /experimentos (tab Retro)
// =============================================================================
// GET  → { retros }
// POST { action: 'generar', desde, hasta } → { retro }   (MaKo lee todo y redacta)
// POST { action: 'borrar', id }            → { ok }
// =============================================================================

import type { NextRequest } from 'next/server';
import { generarRetro, listRetros, borrarRetro, periodoDefault } from '@/lib/retro';
import { esFechaValida } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

export async function GET() {
  try {
    return Response.json({ ok: true, retros: await listRetros() });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; desde?: string; hasta?: string; id?: number };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  try {
    if (body.action === 'generar') {
      const def = periodoDefault();
      const desde = body.desde && esFechaValida(body.desde) ? body.desde : def.desde;
      const hasta = body.hasta && esFechaValida(body.hasta) ? body.hasta : def.hasta;
      if (desde > hasta) return Response.json({ ok: false, error: 'rango de fechas inválido' }, { status: 400 });
      return Response.json({ ok: true, retro: await generarRetro(desde, hasta) });
    }
    if (body.action === 'borrar') {
      const id = Number(body.id);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id requerido' }, { status: 400 });
      await borrarRetro(id);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
