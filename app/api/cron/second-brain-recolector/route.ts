// =============================================================================
// GET /api/cron/second-brain-recolector — el recolector del Second Brain, cada hora (25/10/2026)
// =============================================================================
// Schedule (vercel.json): «35 * * * *». docs/diseno-second-brain-recolector.md §6: un cron del SERVIDOR, nunca un proceso
// atado a una sesión («si "¿quién lo dispara?" se contesta "un chat", no es un guardia», AGENTS.md).
//
// Por cada negocio activo, una vuelta de lib/recolector.ts (`recolectarWhatsApp`) adentro de SU `runWithWorkspace` y de
// «sólo su IA» (`conSuIADelNegocio`): sin su IA un cliente no corre, y nada de lo suyo cruza a otro negocio. Cada negocio
// con su marca (su libro, `second_brain_recolectado`) y su anotación (su setting). Un negocio que falla no frena al resto.
//
// El interruptor de la plataforma: env `RECOLECTOR_SECOND_BRAIN` = `off` (no corre) · `seco` (cuenta qué haría, sin IA y sin
// escribir) · cualquier otra cosa, prendido. El de cada negocio, en su Second Brain (el Mapa, «Aprende solo»).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { modoRecolector, recolectarWhatsApp, type VueltaNegocio } from '@/lib/recolector';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (auth) return auth;
  const modo = modoRecolector();
  if (modo === 'off') {
    console.log('[cron:second-brain-recolector] apagado (RECOLECTOR_SECOND_BRAIN=off)');
    return Response.json({ ok: true, modo });
  }
  const inicio = Date.now();
  const deadline = inicio + 270_000;
  const vueltas: VueltaNegocio[] = [];
  const sinTiempo: number[] = [];
  const errores: Array<{ ws: number; error: string }> = [];
  // Sólo los activos (un negocio pausado no gasta su IA) y nunca la capa del super admin como negocio aparte.
  const negocios = (await listarWorkspaces()).filter((w) => w.estado === 'activo' && w.capa !== 'superadmin');
  for (const w of negocios) {
    if (Date.now() > deadline - 60_000) { sinTiempo.push(w.id); continue; }
    try {
      vueltas.push(await runWithWorkspace(w.id, () => conSuIADelNegocio(w.id, () => recolectarWhatsApp(w.id, { deadline, seco: modo === 'seco' }))));
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const suma = (k: 'nuevas' | 'actualizadas' | 'leidas' | 'pendientes') => vueltas.reduce((n, v) => n + v[k], 0);
  const porResultado = vueltas.reduce<Record<string, number>>((m, v) => ({ ...m, [v.resultado]: (m[v.resultado] ?? 0) + 1 }), {});
  const ms = Date.now() - inicio;
  // Log SIEMPRE, también sin nada que hacer: un cron mudo y uno que no corrió se ven iguales.
  console.log(`[cron:second-brain-recolector] modo=${modo} negocios=${vueltas.length} ${JSON.stringify(porResultado)} pendientes=${suma('pendientes')} nuevas=${suma('nuevas')} actualizadas=${suma('actualizadas')} leidas=${suma('leidas')} sinTiempo=${sinTiempo.length} errores=${errores.length} ms=${ms}`);
  // Sin la migración 0332, lo dice (y no gastó IA): nadie tiene que adivinar por qué no aprende.
  const sinTabla = vueltas.some((v) => v.resultado === 'sin-tabla');
  const ok = errores.length === 0 || vueltas.length > 0;
  return Response.json({ ok, modo, ...(sinTabla ? { aviso: 'falta la migración 0332 (second_brain_recolectado)' } : {}), porResultado, vueltas, sinTiempo, errores, ms }, { status: ok ? 200 : 500 });
}
