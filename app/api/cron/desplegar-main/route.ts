// =============================================================================
// Cron: compila producción una vez por día, sólo si main tiene algo nuevo que salga en la app (6/11/2026)
// =============================================================================
//   GET /api/cron/desplegar-main          → decide y, si hace falta, compila
//   GET /api/cron/desplegar-main?dry=1    → qué decidiría, sin compilar
// Un push a main no compila (vercel.json): esto es lo que lleva los cambios a producción. El porqué, en
// lib/desplegar-main-reglas.ts. Lo urgente no espera este cron: scripts/desplegar-ya.mjs.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { desplegarMainSiHaceFalta } from '@/lib/desplegar-main';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const dry = req.nextUrl.searchParams.get('dry') === '1';
  try {
    const r = await desplegarMainSiHaceFalta({ dry });
    if (!r.ok) console.error(`[desplegar-main] ${r.error}`);
    return Response.json(r, { status: r.ok ? 200 : 500 });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[desplegar-main] ${error}`);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
