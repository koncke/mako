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
import { integracionConectada, credWs } from './credenciales';
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
 * Config del workspace actual, buscando en los DOS almacenes. Ej.:
 *   const ids = await configWs('youtube_vsl_video_id', process.env.YOUTUBE_VSL_VIDEO_ID);
 *
 * Orden: `app_settings` → `credenciales` (misma clave en MAYÚSCULAS) → env global,
 * este último SOLO para el dueño (fail-closed: jamás ingesta el video/página de
 * Mauricio en el workspace de otro negocio).
 *
 * El paso por `credenciales` no es redundancia defensiva, arregla un bug real: estos
 * valores se cargan desde /metodo, que los guarda como CREDENCIAL (guardarCredencial)
 * y los verifica con credWs — pero acá solo se miraba `app_settings`, un almacén cuyo
 * único escritor (`POST /api/onboarding action:'config'`) es código muerto, porque el
 * wizard nunca emite esa action. Los dos lados nunca se tocaban.
 *
 * Consecuencia medida: ws3 tenía PANDA_VSL_VIDEO_IDS y YOUTUBE_VSL_VIDEO_ID cargados
 * y en verde en /metodo, y sin embargo la ingesta devolvía null el 100% de los días
 * — sin un solo error, dentro de una respuesta `ok:true`. Cero filas de panda/youtube
 * en marketing_metrics_daily fuera de ws1.
 */
export async function configWs(clave: string, envFallback?: string | null): Promise<string | null> {
  const v = await getSetting(clave);
  if (v !== null && v.trim()) return v;

  // El almacén donde /metodo SÍ escribe. La convención de nombres entre los dos es
  // la misma clave en distinto case (panda_vsl_video_ids ↔ PANDA_VSL_VIDEO_IDS).
  const ws = await getWorkspaceActual();
  const cred = await credWs(clave.toUpperCase(), ws ?? undefined);
  if (cred !== null && cred.trim()) return cred;

  return ws === OWNER_WS || ws == null ? envFallback ?? null : null;
}
