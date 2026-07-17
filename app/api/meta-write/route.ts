// =============================================================================
// /api/meta-write — escrituras a Meta Ads (pausar/activar, presupuesto y nombre)
// =============================================================================
// Un endpoint para mutar status (ACTIVE/PAUSED), presupuesto diario (CBO en la
// campaña / ABO en el conjunto) y NOMBRE (campaña/adset/anuncio). La lógica del
// Graph vive en lib/meta-write.ts (reusada por el doer de MaKo); acá solo va el
// GATE de permisos (Fase 1: escribir a Meta es del dueño) + parseo del body.

import type { NextRequest } from 'next/server';
import { esDuenoAdmin } from '@/lib/workspace';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Fase 1: escribir a Meta (pausar/activar, presupuesto, nombre, borrar) es una
  // acción sobre la cuenta global del dueño. Solo el dueño puede mutarla.
  if (!(await esDuenoAdmin())) {
    return Response.json({ ok: false, error: 'Esta acción solo está disponible en el workspace principal por ahora.' }, { status: 403 });
  }

  let body: MetaWriteBody;
  try {
    body = (await req.json()) as MetaWriteBody;
  } catch {
    return Response.json({ ok: false, message: 'body inválido' }, { status: 400 });
  }

  const r = await metaWrite(body);
  const { status, ...rest } = r;
  return Response.json(rest, { status });
}
