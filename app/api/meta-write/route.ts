// =============================================================================
// /api/meta-write — escrituras a Meta Ads (pausar/activar, presupuesto y nombre)
// =============================================================================
// Un endpoint para mutar status (ACTIVE/PAUSED), presupuesto diario (CBO en la
// campaña / ABO en el conjunto) y NOMBRE (campaña/adset/anuncio). La lógica del
// Graph vive en lib/meta-write.ts (reusada por el doer de MaKo); acá solo va el
// GATE de permisos + parseo del body.
//
// El gate es el mismo de las rutas de /api/ads-manager (lib/ads-guard.ts): el
// admin de ESTE workspace opera la cuenta de Meta de ESTE workspace. Hasta el
// 07/10/2026 era esDuenoAdmin() con un 403 «solo en el workspace principal»,
// porque lib/meta-write leía el token del ws1 para todos.

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { metaWrite, type MetaWriteBody } from '@/lib/meta-write';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // El ws sale de la sesión, nunca del body: el body sólo trae el id de Meta.
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;

  let body: MetaWriteBody;
  try {
    body = (await req.json()) as MetaWriteBody;
  } catch {
    return Response.json({ ok: false, message: 'body inválido' }, { status: 400 });
  }

  const r = await metaWrite(body, ws);
  const { status, ...rest } = r;
  return Response.json(rest, { status });
}
