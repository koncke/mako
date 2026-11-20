// =============================================================================
// El cron que termina los clips de regalo del reto que nadie vuelve a mirar (20/11/2026)
// =============================================================================
// El clip de 10 s del día 6 (app/ai-avatar/regalo/clip.ts) se TERMINA cuando alguien pregunta cómo va: la tarjeta del día 6
// pregunta cada 10 s mientras está abierta. Si la persona pide el clip y se va, no pregunta nadie: ApiMart lo genera, lo
// cobra y lo guarda 24 h, y después se pierde. Un clip pagado y tirado.
//
// Este cron es el que pregunta cuando no hay nadie mirando. Cada 15 min recorre los pedidos en curso de las últimas 25 h y a
// cada uno le hace la MISMA vuelta que la tarjeta (`terminarClipDe`): si ApiMart terminó, lo baja, lo deja en el historial de
// videos y anota lo que costó. El historial es lo que cierra la señal «6:clip» del reto: la señal se calcula leyéndolo
// (lib/reto/senales.ts), así que no hay nada más que avisar.
//
// ⚠️ LA MISMA VUELTA, NO UNA COPIA. La tarjeta y el cron pueden caer a la vez sobre el mismo clip: los dos pasan por el
// compare-and-set de `reto.clip-regalo` («generando» → «guardando»), así que lo guarda UNO y el costo se anota una vez.
// ⚠️ NUNCA LANZA UN CLIP: sólo termina los que ya están pagos. Pedir es de la persona (`pedirClipRegalo`, con su puerta).
// ⚠️ CADA NEGOCIO EN SU CONTEXTO: los settings se leen y escriben en el negocio de `runWithWorkspace`, y `terminarClipDe` se
// niega a tocar nada si el contexto no es el suyo.
//
// vercel.json: `4,19,34,49 * * * *` (SCHEDULE_CRON_CLIP, lib/reto/clip-regalo-reglas.ts). `?dry=1` dice cuáles miraría.
// =============================================================================

import { type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { terminarClipDe } from '@/app/ai-avatar/regalo/clip';
import {
  CLAVE_CLIP_REGALO, MAX_CLIPS_POR_CORRIDA, VENTANA_CRON_MS, leerEstado, pendienteParaElCron,
} from '@/lib/reto/clip-regalo-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;
/** Lo que se deja libre al final: bajar un video tarda hasta 60 s (`guardarVideo`), y uno empezado no se corta a la mitad. */
const TECHO_MS = (maxDuration - 70) * 1000;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const t0 = Date.now();
  // ⚠️ SIN SCOPE, A PROPÓSITO: es la única lectura que cruza negocios (cuáles tienen un clip en curso). Todo lo que se escribe
  // va después, negocio por negocio, dentro de su `runWithWorkspace`.
  const { data, error } = await getSupabaseServer()
    .from('app_settings')
    .select('workspace_id, value, updated_at')
    .eq('key', CLAVE_CLIP_REGALO)
    .gte('updated_at', new Date(t0 - VENTANA_CRON_MS).toISOString())
    .order('updated_at', { ascending: true })
    .limit(500);
  if (error) {
    console.error('[cron clip-regalo] no pude leer los clips en curso:', error.message);
    return Response.json({ ok: false, error: 'no pude leer los clips en curso' }, { status: 500 });
  }

  const pendientes = (data ?? [])
    .filter((f) => pendienteParaElCron(leerEstado(f.value as string | null)))
    .map((f) => Number(f.workspace_id))
    .filter((ws) => Number.isInteger(ws) && ws > 0);
  if (req.nextUrl.searchParams.get('dry') === '1') return Response.json({ ok: true, dry: true, pendientes });

  const porEstado: Record<string, number> = {};
  let mirados = 0;
  let errores = 0;
  for (const ws of pendientes.slice(0, MAX_CLIPS_POR_CORRIDA)) {
    if (Date.now() - t0 > TECHO_MS) break;
    mirados++;
    try {
      const r = await runWithWorkspace(ws, () => terminarClipDe(ws, true));
      const k = r.ok ? r.clip.estado : 'error';
      porEstado[k] = (porEstado[k] ?? 0) + 1;
      if (!r.ok) { errores++; console.error(`[cron clip-regalo] negocio ${ws}: ${r.error}`); }
    } catch (e) {
      // Un negocio que falla no frena a los demás: su clip sigue «generando» y la corrida siguiente lo vuelve a mirar.
      errores++;
      console.error(`[cron clip-regalo] negocio ${ws}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (pendientes.length) {
    console.log(`[cron clip-regalo] ${mirados} de ${pendientes.length} clip(s) en curso mirados: ${JSON.stringify(porEstado)}`);
  }
  return Response.json({ ok: errores === 0, pendientes: pendientes.length, mirados, porEstado });
}
