// =============================================================================
// thumbnails/renovar — releer y podar la biblioteca de miniaturas antes de que YouTube la venza (6/11/2026)
// =============================================================================
// Sin la enmienda III.L, lo que se guarda de la YouTube Data API (títulos, vistas) vence a los `DIAS_VIGENTE` = 30 días:
// `thumbnailsDeLaBiblioteca` no muestra lo leído hace más, y la regla obliga a borrarlo. Hasta hoy eso era un paso a mano
// («cada mes: `leer` de nuevo y `podar --de-verdad`», docs/carruseles/thumbnails.md) y nadie lo corría: la pantalla se vaciaba
// sola y el primero en enterarse era un cliente. Esto es el trabajo que hacía el script, en una función que también llama el
// cron (app/api/cron/thumbnails-renovar).
//
// ⚠️ «UNA VEZ POR MES» ES LA CADENCIA EQUIVOCADA, y es la trampa de este pendiente. El vencimiento es de 30 días exactos, así
//    que un cron mensual el día 1 deja 31 días entre la corrida de enero y la de febrero: lo leído el 1 de enero vence el 31 y
//    la galería aparece vacía un día entero antes de que el cron la salve. Y una sola corrida que falle (cuota, 403, el deploy
//    caído) borra el único margen que había. Por eso corre SEMANAL: cuatro oportunidades por vencimiento.
//    `tests/thumbnails-renovar.test.ts` lo fija contra vercel.json; si alguien lo pasa a mensual, el test lo dice.
//
// ⚠️ LA CLAVE ES LA DE LA PLATAFORMA, nunca la del negocio. La biblioteca es GLOBAL (mig 0409, sin `workspace_id`): leerla con
//    la cuota de un cliente sería gastarle su balde para llenar la vidriera de todos.
//
// ⚠️ NO LLAMA A `descubrir`. Buscar canales nuevos usa `search.list`, que tiene un balde de 100 llamadas por día PARA TODA LA
//    APP (de ahí salen también las de Competitors Spy): una corrida automática semanal se lo comería. Descubrir sigue siendo a
//    mano, desde la PC. Releer va por el camino barato de Spy (~3 unidades de las 10.000 diarias por canal).
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '../supabase';
import { credWs } from '../credenciales';
import { wsSuperAdmin } from '../workspace';
import { traerVideosDelCanal, type Buscador } from '../spy-youtube';
import { limiteDeVigencia } from './explorar';
import { filaDeCanal, filasDeVideos } from './carga';
import { T_CANALES, T_VIDEOS, hayColumnaWsThumbnails } from './servidor';

/** Cuántos canales como mucho relee una corrida. 79 hoy; el tope deja aire para que crezca sin colgar la función. */
export const CANALES_POR_CORRIDA = 150;
/** Cuánto puede tardar la corrida antes de cortar sola. `maxDuration` del cron es 300 s: se corta con margen. */
export const PRESUPUESTO_MS = 240_000;
/** Cuántos videos se le piden a cada canal (lo mismo que el script). */
export const VIDEOS_POR_CANAL = 50;
/** Cuánto espera a YouTube por pedido antes de abandonar ese canal. */
export const ESPERA_YOUTUBE_MS = 15_000;

export type CanalPorLeer = { id: number; canal_id: string; nombre: string | null; nicho: string; idioma: string };
export type Renovacion = { canales: number; videos: number; fallas: string[]; corto: boolean };
export type Poda = { vencidos: number; borrados: number; vaciados: number };

// ⚠️ Lo PURO de la renovación (`limiteDeVigencia`, `cadenciaAlcanza`, `diasEntreCorridas`) vive en ./explorar.ts, con
//    `DIAS_VIGENTE`: este módulo es `server-only` y `npm test` corre sin `--conditions=react-server`, así que lo que tenga que
//    probar un test NO puede vivir acá (el mismo motivo que lib/prompt-render-pure.ts).

// ── La clave ───────────────────────────────────────────────────────────────────────────────────

/**
 * La clave de YouTube DE LA PLATAFORMA (la del ws superadmin), con el entorno como respaldo. Nunca la del negocio: igual que
 * en scripts/thumbnails-biblioteca.mts. No se imprime ni se devuelve en la respuesta del cron.
 */
export async function claveDeLaPlataforma(): Promise<string | null> {
  const ws = await wsSuperAdmin().catch(() => null);
  const suya = ws != null ? await credWs('YOUTUBE_API_KEY', ws).catch(() => null) : null;
  if (suya && !String(suya).startsWith('PENDING')) return String(suya);
  return process.env.YOUTUBE_API_KEY || null;
}

/** `fetch` con tope de espera: una API que no contesta no se lleva los 300 s de la función. */
const conEspera: Buscador = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(ESPERA_YOUTUBE_MS) });

// ── Releer ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Los canales activos a los que les toca, los de lectura más vieja primero (así una corrida corta no deja a nadie atrás). Un canal
 * que entró porque un negocio trajo UN video suyo por el link (mig 0414) no es de la biblioteca: no se relee (traería sus 50
 * videos para todos y gastaría la cuota de la plataforma en lo que eligió un solo negocio).
 */
export async function canalesPorLeer(max: number = CANALES_POR_CORRIDA): Promise<CanalPorLeer[]> {
  let q = getSupabaseServer()
    .from(T_CANALES).select('id, canal_id, nombre, nicho, idioma, leido_en')
    .eq('estado', 'activo');
  if (await hayColumnaWsThumbnails()) q = q.is('workspace_id', null);
  const r = await q
    .order('leido_en', { ascending: true, nullsFirst: true })
    .limit(Math.max(1, max));
  if (r.error) throw new Error(`${T_CANALES}: ${r.error.message}`);
  return (r.data ?? []) as CanalPorLeer[];
}

/**
 * Relee los canales y guarda sus videos largos, con `leido_en` de hoy (es lo que los vuelve vigentes). Un canal que falla no
 * corta a los demás; si YouTube dice que se acabó la cuota, sí (seguir es pedirle que diga no otras cien veces).
 * Los videos escondidos a mano no vuelven: se filtran antes de guardar, igual que en el script.
 */
export async function releerCanales(o: {
  clave: string;
  buscar?: Buscador;
  max?: number;
  presupuestoMs?: number;
  ahora?: () => number;
  /** Para que el script de la PC muestre cómo avanza (79 canales son un minuto largo mirando una consola quieta). */
  alLeer?: (canal: CanalPorLeer, videos: number) => void;
}): Promise<Renovacion> {
  const db = getSupabaseServer();
  const buscar = o.buscar ?? conEspera;
  const reloj = o.ahora ?? Date.now;
  const empezo = reloj();
  const presupuesto = o.presupuestoMs ?? PRESUPUESTO_MS;
  const lista = await canalesPorLeer(o.max ?? CANALES_POR_CORRIDA);

  const ocultos = await db.from(T_VIDEOS).select('video_id').eq('oculto', true);
  if (ocultos.error) throw new Error(`${T_VIDEOS}: ${ocultos.error.message}`);
  const escondidos = new Set((ocultos.data ?? []).map((x: { video_id: string }) => x.video_id));

  const fallas: string[] = [];
  let canales = 0;
  let videos = 0;
  let corto = false;

  for (const c of lista) {
    if (reloj() - empezo > presupuesto) { corto = true; break; }
    const l = await traerVideosDelCanal({ id: c.canal_id }, o.clave, buscar, VIDEOS_POR_CANAL).catch((e: unknown) => ({
      ok: false as const, motivo: 'error' as const, detalle: e instanceof Error ? e.message : String(e),
    }));
    if (!l.ok) {
      fallas.push(`${c.nombre ?? c.canal_id}: ${l.detalle}`);
      if (l.motivo === 'cuota') { corto = true; break; }
      continue;
    }
    const cuando = new Date(reloj()).toISOString();
    // Su nombre, @ y foto al día. `fuente` y `estado` NO se pisan: un canal sumado a mano sigue siendo de la lista, y uno
    // excluido no se reactiva (acá además no llegan: la consulta pide `estado = activo`).
    const { fuente: _f, estado: _e, ...alDia } = filaDeCanal(l.canal, c.nicho as never, c.idioma as never, 'busqueda', cuando);
    await db.from(T_CANALES).update(alDia).eq('id', c.id).then(() => undefined, () => undefined);
    const filas = filasDeVideos(l.videos, c.id, cuando).filter((f) => !escondidos.has(f.video_id));
    if (filas.length) {
      const up = await db.from(T_VIDEOS).upsert(filas, { onConflict: 'video_id' });
      if (up.error) { fallas.push(`${c.nombre ?? c.canal_id}: ${up.error.message}`); continue; }
    }
    canales += 1;
    videos += filas.length;
    o.alLeer?.(c, filas.length);
  }
  return { canales, videos, fallas, corto };
}

// ── Podar ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Borra lo vencido, que es lo que pide YouTube. Los escondidos a mano se quedan con la fila vacía (sin título ni números): si
 * se borraran, la próxima lectura los traería de vuelta a la vidriera.
 */
export async function podarVencidos(ahora: number = Date.now()): Promise<Poda> {
  const db = getSupabaseServer();
  const limite = limiteDeVigencia(ahora);

  const cuenta = await db.from(T_VIDEOS).select('id', { count: 'exact', head: true }).lt('leido_en', limite);
  if (cuenta.error) throw new Error(`${T_VIDEOS}: ${cuenta.error.message}`);

  const borrados = await db.from(T_VIDEOS).delete({ count: 'exact' }).lt('leido_en', limite).eq('oculto', false);
  if (borrados.error) throw new Error(`${T_VIDEOS}: ${borrados.error.message}`);

  const vaciados = await db.from(T_VIDEOS).update({ titulo: null, vistas: null, megusta: null, comentarios: null }, { count: 'exact' })
    .lt('leido_en', limite).eq('oculto', true);
  if (vaciados.error) throw new Error(`${T_VIDEOS}: ${vaciados.error.message}`);

  return { vencidos: cuenta.count ?? 0, borrados: borrados.count ?? 0, vaciados: vaciados.count ?? 0 };
}

// ── Las dos cosas, que es lo que corre el cron ─────────────────────────────────────────────────

export type Renovada =
  | { ok: true; releido: Renovacion; podado: Poda }
  | { ok: false; error: string };

/**
 * Releer y después podar, en ese orden: al revés, una corrida que falla al leer borra lo vencido y deja la galería más vacía
 * de lo que estaba. Sin clave no hace NADA y lo dice (fail-closed): una poda sin lectura es pérdida neta.
 */
export async function renovarBiblioteca(o: { max?: number; presupuestoMs?: number } = {}): Promise<Renovada> {
  const clave = await claveDeLaPlataforma();
  // ⚠️ El texto NO dice «no releí ni podé nada»: el guarda de voseo de tests/puente-panel-copy.test.ts lee «podé» como el
  //    vos de «poder» (→ «puede») y da rojo, aunque acá sea el pretérito de PODAR. Un mensaje sobre podar no puede usar su
  //    propio verbo en primera persona; se escribe impersonal y se termina el problema.
  if (!clave) return { ok: false, error: 'Sin la clave de YouTube de la plataforma (YOUTUBE_API_KEY) no se relee ni se poda nada.' };
  try {
    const releido = await releerCanales({ clave, max: o.max, presupuestoMs: o.presupuestoMs });
    const podado = await podarVencidos();
    return { ok: true, releido, podado };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
