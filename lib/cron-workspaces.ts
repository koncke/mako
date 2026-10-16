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
import { runWithWorkspace, listarWorkspaces, getWorkspaceActual, wsSuperAdmin, OWNER_WS } from './workspace';
import { integracionConectada, credWs } from './credenciales';
import { getSetting, setSetting } from './settings';
import { entraEnLaRonda, ordenRotado } from './cron-ronda';

export type ResultadoCronWs = { ws: number; ok: boolean; resultado?: unknown; error?: string };

export type Ronda = {
  /** el universo a servir: los que tienen la integración conectada. */
  conectados: number[];
  /** el orden REAL de ESTA corrida (rotado desde el cursor). */
  orden: number[];
  resultados: ResultadoCronWs[];
  /**
   * ⚠️ Los que NO corrieron porque no quedaba tiempo. Es el dato que este arreglo
   * vino a hacer existir: el cron devolvía SOLO a los que corrieron, así que un
   * cliente sin servicio era indistinguible de un cliente que no existe.
   */
  sinTurno: number[];
  ms: number;
};

export type OpcionesRonda = {
  /** ms totales de la corrida (= maxDuration × 1000). Sin esto corren todos, como antes. */
  techoMs?: number;
  /** lo mínimo que le tiene que quedar a un workspace para que darle el turno sirva. */
  minimoMs?: number;
  /**
   * Clave del cursor de rotación. Es por CRON y NO por servicio: closing-sync y
   * fathom-plan comparten el servicio 'fathom' y tienen que rotar por separado, o
   * se pisan el cursor y la rotación queda sin sentido.
   */
  rotacion?: string;
};

/** ms que se reservan para armar la respuesta y cerrar, después del último workspace. */
const RESERVA_SALIDA_MS = 15_000;

// El cursor es de la PLATAFORMA (cross-cliente) → app_settings del SUPER ADMIN.
// OJO: wsSuperAdmin(), NO OWNER_WS — que vale 1 y es Mauricio, o sea un cliente.
const keyCursor = (cron: string) => `cron.rotacion.${cron}`;

async function leerCursor(cron: string): Promise<number | null> {
  const raw = await runWithWorkspace(await wsSuperAdmin(), () => getSetting(keyCursor(cron))).catch(() => null);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function guardarCursor(cron: string, ws: number): Promise<void> {
  await runWithWorkspace(await wsSuperAdmin(), () => setSetting(keyCursor(cron), String(ws)));
}

/**
 * Corre `fn` por cada workspace ACTIVO con la integración `servicio` conectada,
 * repartiendo UNA fecha límite entre todos y arrancando donde terminó la ronda
 * anterior. Secuencial (respeta rate limits y el timeout del cron). Un workspace
 * que falla no corta al resto.
 *
 * Devuelve `sinTurno`: a quién NO le tocó. Sin ese dato, la inanición es invisible.
 */
export async function correrRonda(
  servicio: string,
  fn: (ws: number, deadlineMs: number) => Promise<unknown>,
  opts: OpcionesRonda = {},
): Promise<Ronda> {
  const t0 = Date.now();
  // UN SOLO número para toda la ronda. El primero corre hasta que no le entre otra
  // llamada entera, el segundo hereda lo que sobró, y el que no llega a empezar cae
  // en sinTurno. Nada de cuotas relativas por workspace: eso ERA el bug.
  const deadline = opts.techoMs ? t0 + opts.techoMs - RESERVA_SALIDA_MS : Number.MAX_SAFE_INTEGER;
  const minimo = opts.minimoMs ?? 0;

  let workspaces: Array<{ id: number }>;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    // Sin lista de workspaces (DB caída), al menos corré el dueño para no frenar
    // la ingesta de producción.
    console.error('[cron] listarWorkspaces falló, corriendo solo el dueño:', e);
    workspaces = [{ id: OWNER_WS }];
  }

  const conectados: number[] = [];
  for (const w of workspaces) {
    try { if (await integracionConectada(servicio, w.id)) conectados.push(w.id); }
    catch { /* si no se puede evaluar, se omite ese workspace */ }
  }

  const cursor = opts.rotacion ? await leerCursor(opts.rotacion) : null;
  const orden = ordenRotado(conectados, cursor);

  const resultados: ResultadoCronWs[] = [];
  const sinTurno: number[] = [];
  for (const ws of orden) {
    if (!entraEnLaRonda(Date.now(), deadline, minimo)) { sinTurno.push(ws); continue; }
    try {
      const resultado = await runWithWorkspace(ws, () => fn(ws, deadline));
      resultados.push({ ws, ok: true, resultado });
    } catch (e) {
      console.error(`[cron:${servicio}] workspace ${ws} falló:`, e);
      resultados.push({ ws, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    // El turno se marca haya salido bien o mal: el turno se CONSUMIÓ. Si un workspace
    // que rompe siempre no moviera el cursor, la ronda se clavaría en él y nadie más
    // correría nunca — el bug de hoy, con otra cara.
    if (opts.rotacion) {
      await guardarCursor(opts.rotacion, ws).catch((e) =>
        console.error(`[cron:${servicio}] NO pude guardar el cursor (mañana se sirve al mismo):`, e));
    }
  }

  return { conectados, orden, resultados, sinTurno, ms: Date.now() - t0 };
}

/**
 * Corre `fn` (recibe el workspace_id) por cada workspace ACTIVO que tenga
 * conectada la integración `servicio`. Secuencial. Un workspace que falla no corta
 * al resto.
 *
 * Sin reparto de tiempo ni rotación: es el comportamiento de siempre, y es el
 * correcto para los 9 crons que no tienen nada que repartir. El que necesita
 * repartir un `maxDuration` entre N clientes usa `correrRonda`.
 */
export async function correrPorWorkspace(
  servicio: string,
  fn: (ws: number) => Promise<unknown>,
): Promise<ResultadoCronWs[]> {
  return (await correrRonda(servicio, fn)).resultados;
}

/**
 * ¿Le toca a ESTE workspace lo que el cron de `servicio` hace? La MISMA vara que `correrRonda`:
 * activo y con la integración conectada. Para lo que dispara lo mismo FUERA del cron (16/10/2026:
 * el webhook de Fathom lee la reunión al terminar, y hasta ese día lo hacía también para un
 * workspace pausado o dado de baja, con su WhatsApp de «tareas al plan» incluido). Ante la duda
 * (no se pudo leer), no: es lo que hace la ronda con el workspace que no puede evaluar.
 */
export async function wsEnLaRonda(servicio: string, ws: number): Promise<boolean> {
  try {
    const w = (await listarWorkspaces()).find((x) => x.id === ws);
    if (!w || w.estado !== 'activo') return false;
    return await integracionConectada(servicio, ws);
  } catch { return false; }
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
