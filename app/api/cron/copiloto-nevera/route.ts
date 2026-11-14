// =============================================================================
// Cron: la nevera de contenido del Marketing CoPilot avisa sola — vercel.json: `15 13 * * *`
// =============================================================================
// Una vez por día (13:15 UTC: la mañana en América), cada negocio ACTIVO que respondió en el CoPilot cuánto publica (`ritmo` en
// marketing-copilot.perfil) pasa por lib/copiloto/nevera-aviso.ts: las tareas de la semana al Plan y, si lo listo no llega a la
// semana que viene, el aviso por WhatsApp y email. Martín a Julio (13/11): «te va mandando mensajes por WhatsApp y por email».
// Un negocio que falla no corta a los demás; lo que no entró en el tiempo queda en `sinTurno`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { listarWorkspaces } from '@/lib/workspace';
import { CLAVE_COPILOTO } from '@/lib/media-buyer/copiloto';
import { avisarNevera, type ResultadoAvisoNevera } from '@/lib/copiloto/nevera-aviso';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const TECHO_MS = (maxDuration - 30) * 1000;

/** Los negocios activos con un perfil del CoPilot que dice cuánto publica (sin ritmo, la nevera nunca avisa: no se lee). */
async function negociosConRitmo(): Promise<number[]> {
  const [{ data, error }, activos] = await Promise.all([
    getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', CLAVE_COPILOTO),
    listarWorkspaces(),
  ]);
  if (error) throw new Error(`perfiles del CoPilot: ${error.message}`);
  const vivos = new Set(activos.filter((w) => w.estado === 'activo').map((w) => w.id));
  return (data ?? [])
    .filter((f) => {
      try { return JSON.parse(String(f.value)).ritmo != null; } catch { return false; }
    })
    .map((f) => Number(f.workspace_id))
    .filter((ws) => vivos.has(ws));
}

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const t0 = Date.now();
  const negocios = await negociosConRitmo();
  const resultados: Array<ResultadoAvisoNevera | { ws: number; error: string }> = [];
  const sinTurno: number[] = [];
  for (const ws of negocios) {
    if (Date.now() - t0 > TECHO_MS) { sinTurno.push(ws); continue; }
    try {
      resultados.push(await avisarNevera(ws));
    } catch (e) {
      resultados.push({ ws, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ ok: true, ms: Date.now() - t0, negocios: negocios.length, resultados, sinTurno });
}
