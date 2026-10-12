// =============================================================================
// CRON: el «AI Analyst» programado del Dashboard (cada 15 min) — vercel.json: `8,23,38,53 * * * *`
// =============================================================================
// Pedido de Martín (11/10/2026), punto 23: «que se pueda configurar CRON para que lo analice cada X
// tiempo». Lo programado vive en `dashboard_analisis` (mig 0247), una fila por negocio, persona y hoja;
// el trabajo es `drenarVencidos` (lib/graficos-analisis-server.ts).
//
// ⚠️ GUIADO POR LA TABLA, no por `correrPorWorkspace`: aquél recorre los negocios con una INTEGRACIÓN
// conectada, y acá no hay ninguna. UNA consulta cruda dice quién tiene algo vencido y se visita sólo a
// esos (el molde es app/api/cron/avisos-programados). Un tick sin nada programado cuesta una consulta.
//
// ⚠️ FECHA LÍMITE ABSOLUTA (270 s dentro de los 300), como landing-analyst-auto: un análisis puede
// tardar minutos en la cascada, y no se arranca uno que no llega a terminar. Lo que no entra queda
// vencido y lo toma el tick siguiente (`sin_turno` en la respuesta): no se quema.
//
// ⚠️ UN NEGOCIO SIN IA PROPIA TAMBIÉN SE ANALIZA (desde el 11/10/2026): después de sus keys va la red
// de plataforma (lib/graficos-ia-red.ts; Martín: «siempre tiene que probar con otros provedoores»).
// Antes se contaba aparte como `sin_ia` y no se intentaba.
//
// ⚠️ Y UN FALLO NO SE REINTENTA SOLO: el horario avanzó antes del trabajo. Sin avisos por WhatsApp a
// propósito: un aviso nuevo de MaKo es un evento de automatización y lo decide Martín (AGENTS.md). El
// resultado se ve en el Dashboard, con un punto en el botón «AI Analyst».
//
// Los 15 minutos son la granularidad real: «todos los días a las 9:00» corre entre las 9:00 y las 9:15.
// Se corre a los :08 y no en punto para no caer en el mismo minuto que los crons de la hora en punto.
//
// v5 (12/10/2026): drena TAMBIÉN las cajas «Conclusiones de MaKo» con horario (`dashboard_ia_elementos`, mig
// 0260), con la MISMA función que el AI Analyst (`drenarTabla`, lib/graficos-analisis-server.ts): lo único
// propio de cada tabla es cómo se corre una fila. Se visita a quien tenga algo vencido en CUALQUIERA de las dos.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { drenarVencidos, type CuentaCron } from '@/lib/graficos-analisis-server';
import { drenarCajasVencidas } from '@/lib/graficos-ia-elemento-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const inicio = Date.now();
  const deadline = inicio + 270_000;

  try {
    // Crudo y sin scope a propósito: es la ÚNICA lectura entre negocios, y sólo sirve para saber a
    // quién visitar. Todo lo que toca datos va adentro del runWithWorkspace de abajo.
    const ahora = new Date().toISOString();
    const vencidos = (tabla: 'dashboard_analisis' | 'dashboard_ia_elementos') => getSupabaseServer()
      .from(tabla)
      .select('workspace_id')
      .not('cron', 'is', null)
      .lte('proxima_at', ahora)
      .limit(500);
    const [an, cj] = await Promise.all([vencidos('dashboard_analisis'), vencidos('dashboard_ia_elementos')]);
    // ⚠️ Una tabla que falla no tapa a la otra: si la de las cajas todavía no existe (la 0260 sin aplicar), el
    // AI Analyst sigue drenando y el error queda en el log y en la respuesta.
    if (an.error) {
      console.error('[cron:dashboard-analisis]', an.error.message);
      return Response.json({ ok: false, error: an.error.message }, { status: 500 });
    }
    if (cj.error) console.error('[cron:dashboard-analisis] cajas:', cj.error.message);
    const deAnalisis = new Set((an.data ?? []).map((r) => (r as { workspace_id: number }).workspace_id));
    const deCajas = new Set((cj.data ?? []).map((r) => (r as { workspace_id: number }).workspace_id));
    const wss = [...new Set([...deAnalisis, ...deCajas])];

    const total: CuentaCron = { corridos: 0, fallidos: 0, sinTurno: 0, saltados: 0 };
    const errores: Array<{ ws: number; error: string }> = [];
    let sinVisitar = 0;
    for (const ws of wss) {
      // Sin tiempo para arrancar un análisis más, no se visita a nadie más: queda para el próximo tick.
      if (Date.now() > deadline - 90_000) { sinVisitar++; continue; }
      // Un negocio que falla no corta a los demás.
      try {
        const sumar = (r: CuentaCron) => { for (const k of Object.keys(total) as Array<keyof CuentaCron>) total[k] += r[k]; };
        if (deAnalisis.has(ws)) sumar(await runWithWorkspace(ws, () => drenarVencidos({ deadline })));
        if (deCajas.has(ws)) sumar(await runWithWorkspace(ws, () => drenarCajasVencidas({ deadline })));
      } catch (e) {
        errores.push({ ws, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const ms = Date.now() - inicio;
    // Log SIEMPRE, también sin nada que hacer: un cron mudo y uno que no corrió se ven iguales.
    console.log(`[cron:dashboard-analisis] negocios=${wss.length} corridos=${total.corridos} fallidos=${total.fallidos} sin_turno=${total.sinTurno + sinVisitar} saltados=${total.saltados} errores=${errores.length} ms=${ms}`);
    const ok = errores.length === 0 || errores.length < wss.length;
    return Response.json({
      ok, negocios: wss.length, corridos: total.corridos, fallidos: total.fallidos, ...(cj.error ? { error_cajas: cj.error.message } : {}),
      sin_turno: total.sinTurno, negocios_sin_turno: sinVisitar, saltados: total.saltados, errores, ms,
    }, { status: ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron:dashboard-analisis]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
