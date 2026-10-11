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
// ⚠️ SIN IA, NO SE QUEMAN TURNOS: el chequeo previo (`docsIADisponible`) va una vez por negocio, y lo
// que no pudo correr por eso se cuenta APARTE (`sin_ia`) y queda escrito en la fila con el motivo.
//
// ⚠️ Y UN FALLO NO SE REINTENTA SOLO: el horario avanzó antes del trabajo. Sin avisos por WhatsApp a
// propósito: un aviso nuevo de MaKo es un evento de automatización y lo decide Martín (AGENTS.md). El
// resultado se ve en el Dashboard, con un punto en el botón «AI Analyst».
//
// Los 15 minutos son la granularidad real: «todos los días a las 9:00» corre entre las 9:00 y las 9:15.
// Se corre a los :08 y no en punto para no caer en el mismo minuto que los crons de la hora en punto.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { drenarVencidos, type CuentaCron } from '@/lib/graficos-analisis-server';

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
    const { data, error } = await getSupabaseServer()
      .from('dashboard_analisis')
      .select('workspace_id')
      .not('cron', 'is', null)
      .lte('proxima_at', new Date().toISOString())
      .limit(500);
    if (error) {
      console.error('[cron:dashboard-analisis]', error.message);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    const wss = [...new Set((data ?? []).map((r) => (r as { workspace_id: number }).workspace_id))];

    const total: CuentaCron = { corridos: 0, fallidos: 0, sinIa: 0, sinTurno: 0, saltados: 0 };
    const errores: Array<{ ws: number; error: string }> = [];
    let sinVisitar = 0;
    for (const ws of wss) {
      // Sin tiempo para arrancar un análisis más, no se visita a nadie más: queda para el próximo tick.
      if (Date.now() > deadline - 90_000) { sinVisitar++; continue; }
      // Un negocio que falla no corta a los demás.
      try {
        const r = await runWithWorkspace(ws, () => drenarVencidos({ deadline }));
        for (const k of Object.keys(total) as Array<keyof CuentaCron>) total[k] += r[k];
      } catch (e) {
        errores.push({ ws, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const ms = Date.now() - inicio;
    // Log SIEMPRE, también sin nada que hacer: un cron mudo y uno que no corrió se ven iguales.
    console.log(`[cron:dashboard-analisis] negocios=${wss.length} corridos=${total.corridos} fallidos=${total.fallidos} sin_ia=${total.sinIa} sin_turno=${total.sinTurno + sinVisitar} saltados=${total.saltados} errores=${errores.length} ms=${ms}`);
    const ok = errores.length === 0 || errores.length < wss.length;
    return Response.json({
      ok, negocios: wss.length, corridos: total.corridos, fallidos: total.fallidos, sin_ia: total.sinIa,
      sin_turno: total.sinTurno, negocios_sin_turno: sinVisitar, saltados: total.saltados, errores, ms,
    }, { status: ok ? 200 : 500 });
  } catch (e) {
    console.error('[cron:dashboard-analisis]', e instanceof Error ? e.message : String(e));
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
