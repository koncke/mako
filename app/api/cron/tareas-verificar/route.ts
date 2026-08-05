// =============================================================================
// Cron: cerrar las tareas que el negocio ya dio por hechas — POR WORKSPACE
// =============================================================================
// El auto-completado por señales existía pero tenía UN solo disparador: renderizar
// /plan. O sea, si el cliente no entraba, no se cerraba nada y nadie se enteraba —
// justo al revés de lo que tiene que pasar, porque el valor de esto es que el tablero
// esté limpio CUANDO entra, no después.
//
// Cada corrida recorre los workspaces ACTIVOS y, dentro de cada uno, mira las tareas
// del plan que siguen pendientes contra las señales del negocio (integraciones
// conectadas, tablas con filas, artefactos guardados). Las que ya están resueltas se
// cierran solas con la evidencia en el historial, y MaKo manda UN aviso agrupado por
// día por workspace.
//
// POR QUÉ NO USA `correrPorWorkspace`: ese helper filtra por integración conectada
// (meta/fathom/panda…), y acá el punto es justamente mirar a TODOS — incluidos los que
// todavía no conectaron nada, que son los que más tareas de setup tienen abiertas.
//
// POR QUÉ ES SU PROPIO CRON y no un pedazo del reporte diario: el reporte abre la
// ventana de 24h de WhatsApp y asegura la plantilla de Meta. Meter una verificación
// por-workspace ahí adentro mezcla dos radios de explosión distintos, y un timeout acá
// apagaría el reporte.
//
// COSTO: cero tokens. Son ~15 `select count head:true` por workspace. La consulta
// arranca solo si hay candidatas.
//
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { runWithWorkspace, listarWorkspaces } from '@/lib/workspace';
import { listTareas } from '@/lib/todo';
import { autocompletarPorSenales } from '@/lib/todo-seeds';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const no = checkCronAuth(req);
  if (no) return no;

  const dry = new URL(req.url).searchParams.get('dry') === '1';
  let workspaces: Array<{ id: number; nombre: string; estado?: string }> = [];
  try {
    workspaces = (await listarWorkspaces()) as typeof workspaces;
  } catch (e) {
    console.error('[cron:tareas-verificar] no pude listar workspaces:', msg(e));
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }

  const activos = workspaces.filter((w) => (w.estado ?? 'activo') === 'activo');
  const detalle: Array<{ ws: number; nombre: string; abiertas: number; cerradas: number; error?: string }> = [];

  // Uno por uno y con su propio try: que un workspace roto no le apague la corrida
  // a los demás. Es la misma regla que sigue el resto de los crons del repo.
  for (const w of activos) {
    try {
      await runWithWorkspace(w.id, async () => {
        const tareas = await listTareas();
        const abiertas = tareas.filter((t) => t.progreso < 100).length;
        // En dry-run no se escribe: solo se dice cuántas hay para mirar.
        const cerradas = dry ? 0 : await autocompletarPorSenales(tareas);
        detalle.push({ ws: w.id, nombre: w.nombre, abiertas, cerradas });
      });
    } catch (e) {
      console.error(`[cron:tareas-verificar] ws ${w.id}:`, msg(e));
      detalle.push({ ws: w.id, nombre: w.nombre, abiertas: 0, cerradas: 0, error: msg(e) });
    }
  }

  const total = detalle.reduce((s, d) => s + d.cerradas, 0);
  console.log(`[cron:tareas-verificar] ${activos.length} workspaces · ${total} tarea(s) cerradas${dry ? ' (dry)' : ''}`);
  return Response.json({ ok: true, dry, workspaces: activos.length, cerradas: total, detalle });
}
