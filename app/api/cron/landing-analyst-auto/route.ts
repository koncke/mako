// =============================================================================
// /api/cron/landing-analyst-auto — la red del análisis automático de páginas
// =============================================================================
// Pedido de Martín (06/10/2026): «si yo pongo una nueva landing en el pixel,
// automáticamente la tiene que analizar la funcion de Landing Analyst».
//
// El camino normal es el `after()` de quien guarda la página (lib/landing-analyst-
// auto.ts). Este cron, cada hora, cubre lo que ése no alcanza: un análisis que se
// cortó, una página que entró por un camino que no avisa, y el BACKFILL de las que
// ya estaban declaradas sin análisis (medido: 4 de 7 el 06/10/2026).
//
// Es el MISMO cálculo que el disparo (`asegurarAnalisisDeDeclaradas`): las
// declaradas sin fila, con reclamo atómico, así que correr los dos a la vez no
// analiza dos veces. Recorre los negocios con el Pixel acuñado, como el vigilante.
//
// ⚠️ FECHA LÍMITE ABSOLUTA: un análisis puede tardar minutos (la cascada de IA), y
// no se arranca uno que no llega a terminar antes del corte. Lo que no entra queda
// para la hora siguiente y se nombra en la respuesta (`sinTiempo`).
// =============================================================================
import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { getSetting } from '@/lib/settings';
import { LANDING_TOKEN_KEY } from '@/lib/landing-token';
import { asegurarAnalisisDeDeclaradas } from '@/lib/landing-analyst-auto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  const inicio = Date.now();
  const deadline = inicio + 270_000;
  const revisados: Array<{ ws: number; declaradas: number; analizadas: number; fallidas: number; cortadas: number }> = [];
  const sinTiempo: Array<{ ws: number; url: string }> = [];
  const errores: Array<{ ws: number; error: string }> = [];

  // Sólo los activos, como el vigilante: un negocio pausado no gasta cuota de IA.
  for (const w of (await listarWorkspaces()).filter((x) => x.estado === 'activo')) {
    if (Date.now() > deadline - 30_000) break;
    try {
      const r = await runWithWorkspace(w.id, async () => {
        // Sin Pixel acuñado no hay páginas declaradas que mirar.
        if (!(await getSetting(LANDING_TOKEN_KEY))?.trim()) return null;
        return asegurarAnalisisDeDeclaradas({ deadline });
      });
      if (!r) continue;
      revisados.push({ ws: w.id, declaradas: r.declaradas, analizadas: r.analizadas.length, fallidas: r.fallidas.length, cortadas: r.cortadas });
      for (const url of r.sinTiempo) sinTiempo.push({ ws: w.id, url });
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const ms = Date.now() - inicio;
  const analizadas = revisados.reduce((n, r) => n + r.analizadas, 0);
  // Log SIEMPRE, también cuando no hubo nada que hacer: un cron mudo y uno que no
  // corrió se ven iguales.
  console.log(`[cron:landing-analyst-auto] revisados=${revisados.length} analizadas=${analizadas} sinTiempo=${sinTiempo.length} errores=${errores.length} ms=${ms}`);
  const ok = errores.length === 0 || revisados.length > 0;
  return Response.json({ ok, revisados, sinTiempo, errores, ms }, { status: ok ? 200 : 500 });
}
