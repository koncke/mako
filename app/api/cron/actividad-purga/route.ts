// =============================================================================
// Cron: borra la medición de uso que pasó su retención (Admin › Activity, mig 0398, 5/11/2026)
// =============================================================================
// El encargo pide la medición «por lotes y con retención»: sin este cron, `RETENCION_USO_DIAS` y `RETENCION_ACCIONES_DIAS`
// (lib/actividad-reglas.ts) serían constantes que nadie aplica. El uso por día se va a los 400 días y lo que hizo MaKo a
// los 90. Una vez por noche alcanza: las dos consultas son por índice y casi siempre borran cero filas.
// ⚠️ CUENTA LO QUE BORRA: un proceso que limpia y no dice cuánto no se puede auditar.
// ⚠️ SIN LA MIGRACIÓN, no hace nada y lo dice (`medido: false`): no es un error.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { faltaLaTabla, hoyDeLaPlataforma } from '@/lib/actividad-registro';
import { RETENCION_ACCIONES_DIAS, RETENCION_USO_DIAS, corteDeRetencion } from '@/lib/actividad-reglas';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const db = getSupabaseServer();
  const hoy = await hoyDeLaPlataforma();
  const corteUso = corteDeRetencion(hoy, RETENCION_USO_DIAS);
  const corteAcciones = `${corteDeRetencion(hoy, RETENCION_ACCIONES_DIAS)}T00:00:00Z`;
  const uso = await db.from('actividad_uso').delete({ count: 'exact' }).lt('dia', corteUso);
  if (uso.error) {
    if (faltaLaTabla(uso.error)) return Response.json({ ok: true, medido: false });
    return Response.json({ ok: false, error: `actividad_uso: ${uso.error.message}` }, { status: 500 });
  }
  const acciones = await db.from('actividad_acciones').delete({ count: 'exact' }).lt('creado', corteAcciones);
  if (acciones.error) return Response.json({ ok: false, error: `actividad_acciones: ${acciones.error.message}` }, { status: 500 });
  return Response.json({ ok: true, medido: true, hoy, borradas: { uso: uso.count ?? 0, acciones: acciones.count ?? 0 }, desde: { uso: corteUso, acciones: corteAcciones } });
}
