// =============================================================================
// cron-workspaces — correr un cron POR CADA workspace con la integración conectada
// =============================================================================
// Fase 2b: los crons dejan de correr una sola vez (dueño) y pasan a iterar los
// workspaces activos que tienen conectada la integración que el cron necesita.
// Cada iteración corre dentro de runWithWorkspace(ws), así todos los credWs()
// resuelven el token de ESE cliente y todos los getTenantDb() scopean su data.
//
// INVARIANTE DEL DUEÑO: hoy solo el workspace 1 está conectado, así que la lista
// es [1] y el cron corre EXACTAMENTE como antes (credWs(1)→env, scope ws1). A
// medida que se conectan clientes, se suman al loop sin tocar nada.
//
// Config por-workspace (ids de video, page id, flags): configWs() lee la setting
// del workspace y cae al env global para el dueño (misma resolución que hoy).

import 'server-only';
import { runWithWorkspace, listarWorkspaces, getWorkspaceActual, OWNER_WS } from './workspace';
import { integracionConectada } from './credenciales';
import { getSetting } from './settings';

export type ResultadoCronWs = { ws: number; ok: boolean; resultado?: unknown; error?: string };

/**
 * Corre `fn` (recibe el workspace_id) por cada workspace ACTIVO que tenga
 * conectada la integración `servicio`. Secuencial (respeta rate limits de las
 * APIs externas y el timeout del cron). Un workspace que falla no corta al resto.
 */
export async function correrPorWorkspace(
  servicio: string,
  fn: (ws: number) => Promise<unknown>,
): Promise<ResultadoCronWs[]> {
  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    // Sin lista de workspaces (DB caída), al menos corré el dueño para no frenar
    // la ingesta de producción.
    console.error('[cron] listarWorkspaces falló, corriendo solo el dueño:', e);
    workspaces = [{ id: OWNER_WS }] as Array<{ id: number }>;
  }

  const conectados: number[] = [];
  for (const w of workspaces) {
    try { if (await integracionConectada(servicio, w.id)) conectados.push(w.id); }
    catch { /* si no se puede evaluar, se omite ese workspace */ }
  }

  const out: ResultadoCronWs[] = [];
  for (const ws of conectados) {
    try {
      const resultado = await runWithWorkspace(ws, () => fn(ws));
      out.push({ ws, ok: true, resultado });
    } catch (e) {
      console.error(`[cron:${servicio}] workspace ${ws} falló:`, e);
      out.push({ ws, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/**
 * Config del workspace actual con fallback al env global SOLO PARA EL DUEÑO. Ej.:
 *   const ids = await configWs('youtube_vsl_video_id', process.env.YOUTUBE_VSL_VIDEO_ID);
 * Para el dueño (sin la setting cargada) devuelve el env de siempre; para un
 * CLIENTE sin la setting devuelve null (fail-closed: jamás ingesta el video/página
 * de Mauricio en el workspace de otro negocio).
 */
export async function configWs(clave: string, envFallback?: string | null): Promise<string | null> {
  const v = await getSetting(clave);
  if (v !== null && v.trim()) return v;
  const ws = await getWorkspaceActual();
  return ws === OWNER_WS || ws == null ? envFallback ?? null : null;
}
