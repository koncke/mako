// =============================================================================
// Cron: vacía los turnos de las sesiones del agente cuya retención de 90 días ya pasó (diario)
// =============================================================================
// El acta de cada sesión se queda; los turnos que escribió la persona caducan (supabase/migrations/0124_agente_telemetria.sql).
// El porqué y las reglas viven en lib/agente-purga.ts.
//
//   GET /api/cron/agente-purga            → la purga de verdad (lo único vencido, hasta 500 por vuelta)
//   GET /api/cron/agente-purga?seco=1     → modo seco: cuenta cuántas vaciaría y NO escribe nada
//
// ⚠️ NO ES COMO `curso-purga` (que arranca en modo prueba): acá la retención es una promesa hecha al cliente —se escribe
// `purgar_despues` en cada reporte— y lo único que toca es lo que esa fecha ya venció. Para mirarlo antes de la primera vez:
// `?seco=1`. Con el plugin sin instalaciones reales (17/10/2026), lo esperado es `vencidas: 0`.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { accesoSupabase, pideSeco, purgarTurnosVencidos } from '@/lib/agente-purga';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  try {
    const r = await purgarTurnosVencidos(accesoSupabase(), { seco: pideSeco(req.nextUrl.searchParams.get('seco')) });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
