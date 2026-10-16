import 'server-only';

// =============================================================================
// ficha/config-server — leer y guardar la ficha de un funnel, y los avisos POR FUNNEL del workspace
// =============================================================================
// La ficha vive en `funnels.data.ficha` (decisión 1 de docs/diseno-ficha-bloques.md). Lo puro —el saneo,
// la plantilla y la ficha que se dibuja— está en lib/ficha/config.ts y lib/ficha/plantillas.ts; acá sólo
// se lee la fila y se escribe el parche.
//
// ⚠️ GUARDAR ES UN PARCHE SOBRE LO DE HOY, con compare-and-set sobre `funnels.updated_at`: se lee la fila,
//    se aplica el cambio (`aplicarCambio`) y se escribe sólo si nadie la tocó en el medio. Dos admins que
//    cambian cosas distintas a la vez no se pisan; si chocan, se relee y se vuelve a aplicar. Y se mergea
//    sobre `data` entero: el pipeline, las entradas, los umbrales y lo demás de `data` no se tocan.
// ⚠️ GUARDAR LA FICHA NO DECLARA EL FUNNEL. `saveFunnelDe` (lib/funnels.ts) pone `declarado = true`, y eso
//    hace que los prompts afirmen el funnel. Por eso la escritura es propia y no pasa por ahí.
// ⚠️ LOS AVISOS SON POR FUNNEL DEL LEAD (su casa, `leads.funnel_id`; NULL = el producto del negocio). El
//    worklist lee TODOS los funnels del workspace UNA vez por pasada (`avisosDelWorkspace`), nunca uno por
//    lead. Si esa lectura falla, vale lo del negocio (`apagadosDelNegocio`), que es lo que había: callar
//    de más un negocio entero por una lectura caída no lo decide nadie.
// =============================================================================

import { getTenantDb } from '../workspace';
import { filaAFunnel, FUNNEL_DEFAULT_NOMBRE, type FilaFunnel } from '../funnel-fila';
import { resumenDelNegocio } from '../resumen-ficha-config';
import { apagadosDelNegocio } from '../datos-aviso-config';
import { getDiagnosticoFase } from '../fase-store';
import type { CanalId } from '../fase-diagnostico';
import type { StepId } from '../stage-requirements';
import { elegirPlantilla, type EleccionPlantilla } from './plantillas';
import {
  aplicarCambio, apagadosDeLaCasa, fichaEfectiva, sanearFicha, normalizar,
  type CambioFicha, type FichaEfectiva, type FichaGuardada, type RespaldoNegocio,
} from './config';

const COLS_FICHA = 'id, nombre, canal, data, declarado, es_default, activo, updated_at';
type FilaConFicha = FilaFunnel & { activo?: boolean | null; updated_at?: string | null };

/** La ficha de un funnel, con todo lo que la explica. */
export type FichaDelFunnel = {
  funnel: { id: number; nombre: string; esDefault: boolean };
  /** La plantilla que elige MaKo para este funnel, y por qué. Lo guardado puede usar otra (`efectiva.plantilla`). */
  eleccion: EleccionPlantilla;
  /** Lo que alguien cambió, saneado. */
  guardada: FichaGuardada;
  efectiva: FichaEfectiva;
  /** El respaldo del negocio con que se armó (para validar un cambio sin releer). */
  respaldo: RespaldoNegocio;
};

/** Lo que el negocio ya eligió (el respaldo). Cada lectura cae a «nada elegido» si falla: lo dicen sus módulos. */
export async function respaldoDelNegocio(): Promise<RespaldoNegocio> {
  const [resumen, apagados] = await Promise.all([resumenDelNegocio(), apagadosDelNegocio()]);
  return { resumen, apagados };
}

async function canalDelNegocio(): Promise<CanalId | null> {
  try { return (await getDiagnosticoFase())?.canal ?? null; } catch { return null; }
}

const dataDe = (f: { data?: unknown }): Record<string, unknown> =>
  (f.data && typeof f.data === 'object' && !Array.isArray(f.data) ? f.data : {}) as Record<string, unknown>;

/** La plantilla que elige MaKo para la fila: por sus etapas generadas, su canal EFECTIVO y sus entradas. */
export function eleccionDeFila(f: FilaFunnel, canalNegocio: CanalId | null): EleccionPlantilla {
  const cfg = filaAFunnel(f);
  return elegirPlantilla({ etapas: cfg.stages, canalDelFunnel: cfg.canal, canalDelNegocio: canalNegocio, entradas: cfg.entradas });
}

function armar(f: FilaConFicha, canalNegocio: CanalId | null, respaldo: RespaldoNegocio): FichaDelFunnel {
  const eleccion = eleccionDeFila(f, canalNegocio);
  const guardada = sanearFicha(dataDe(f).ficha);
  return {
    funnel: { id: Number(f.id), nombre: f.nombre ?? FUNNEL_DEFAULT_NOMBRE, esDefault: f.es_default === true },
    eleccion, guardada,
    efectiva: fichaEfectiva(eleccion.id, guardada, respaldo),
    respaldo,
  };
}

/**
 * La fila del funnel pedido, o la del negocio con `funnelId` null (el `es_default`, con el mismo orden que
 * lib/funnels.ts). `null` = no existe en ESTE workspace (getTenantDb lo scopea). Tira si la lectura falla:
 * «no pude leer» no es «no hay».
 */
async function filaDe(funnelId: number | null): Promise<FilaConFicha | null> {
  const db = await getTenantDb();
  const q = db.from('funnels').select(COLS_FICHA);
  const { data, error } = funnelId != null
    ? await q.eq('id', funnelId).limit(1)
    : await q.order('es_default', { ascending: false }).order('orden', { ascending: true }).order('id').limit(1);
  if (error) throw new Error(`no se pudo leer el funnel: ${error.message}`);
  return ((data ?? []) as unknown as FilaConFicha[])[0] ?? null;
}

/** La ficha de UN funnel (null = el del negocio). `null` si ese funnel no es de este workspace. Tira si no se pudo leer. */
export async function leerFichaDeFunnel(funnelId: number | null): Promise<FichaDelFunnel | null> {
  const [fila, canal, respaldo] = await Promise.all([filaDe(funnelId), canalDelNegocio(), respaldoDelNegocio()]);
  return fila ? armar(fila, canal, respaldo) : null;
}

/**
 * La ficha del funnel de UN LEAD (su casa, `leads.funnel_id`). La casa NULL es el funnel del negocio, y un
 * funnel que ya no existe (borrado) cae a ése. Nunca tira: «no pude leer» es null, y quien la dibuja arma la
 * de respaldo. La leen las dos puertas de escritorio (`getLeadFullAction`, app/crm/actions.ts) y la ficha
 * del teléfono (app/m/crm/datos.ts): con una sola lectura, el teléfono no puede ordenar con otra ficha.
 */
export async function fichaDelFunnelDelLead(funnelId: number | null): Promise<FichaDelFunnel | null> {
  try {
    const f = await leerFichaDeFunnel(funnelId);
    if (f || funnelId == null) return f;
    return await leerFichaDeFunnel(null);
  } catch (e) {
    console.error('[ficha] no se pudo leer la ficha del funnel del lead:', e instanceof Error ? e.message : e);
    return null;
  }
}

export type ResultadoGuardarFicha =
  | { ok: true; ficha: FichaDelFunnel; antes: FichaGuardada; cambio: boolean }
  | { ok: false; error: string };

/**
 * Aplica UN cambio a la ficha de un funnel y lo guarda. `antes` es lo guardado justo antes (para
 * «Deshacer»: `{ op: 'restaurar', ficha: antes, esperado: ficha.guardada }`). `cambio: false` = ya estaba así y no se escribió nada.
 */
export async function cambiarFichaDeFunnel(funnelId: number | null, c: CambioFicha): Promise<ResultadoGuardarFicha> {
  const [canal, respaldo] = await Promise.all([canalDelNegocio(), respaldoDelNegocio()]);
  for (let intento = 0; intento < 4; intento++) {
    const fila = await filaDe(funnelId);
    if (!fila) return { ok: false, error: 'Ese funnel no es de esta cuenta.' };
    const eleccion = eleccionDeFila(fila, canal);
    const data = dataDe(fila);
    const antes = normalizar(sanearFicha(data.ficha), eleccion.id, respaldo);
    const r = aplicarCambio(antes, c, eleccion.id, respaldo);
    if (!r.ok) return r;
    if (!r.cambio) return { ok: true, ficha: armar(fila, canal, respaldo), antes, cambio: false };
    const nueva: Record<string, unknown> = { ...data };
    if (Object.keys(r.ficha).length) nueva.ficha = r.ficha; else delete nueva.ficha;
    const db = await getTenantDb();
    let q = db.from('funnels').update({ data: nueva, updated_at: new Date().toISOString() }).eq('id', fila.id);
    if (fila.updated_at) q = q.eq('updated_at', fila.updated_at);
    const { data: tocadas, error } = await q.select('id');
    if (error) return { ok: false, error: 'No se pudo guardar la ficha.' };
    if (((tocadas ?? []) as unknown[]).length) {
      return { ok: true, ficha: armar({ ...fila, data: nueva }, canal, respaldo), antes, cambio: true };
    }
    // Cero filas: otro guardó en el medio. Se relee y se vuelve a aplicar sobre lo nuevo.
  }
  return { ok: false, error: 'Otra persona estaba cambiando la ficha. Intenta de nuevo.' };
}

// ── Los avisos por funnel (el worklist, «A revisar», «N sin marcar», los avisos de MaKo) ──

/** Los datos que NO avisan para un lead, según la ficha de SU funnel. */
export type AvisosDelWorkspace = {
  /** Por la casa del lead (`leads.funnel_id`; null o undefined = el producto del negocio). */
  apagadosDe: (funnelIdDelLead: number | null | undefined) => StepId[];
  /** false si los funnels no se pudieron leer y todo cae a lo del negocio. */
  porFunnel: boolean;
};

/**
 * UNA lectura de todos los funnels del workspace (también los archivados: un lead puede seguir teniendo
 * de casa uno archivado) y los apagados de cada uno. Una casa que no está en el mapa (un funnel borrado, o
 * un id que no es de este workspace) es como una NULL: el funnel del negocio, igual que en `apagadosDeFunnel`
 * y en la ficha (`apagadosDeLaCasa`, ./config.ts; tests/ficha-casa-huerfana.test.ts).
 */
export async function avisosDelWorkspace(): Promise<AvisosDelWorkspace> {
  const [canal, respaldo] = await Promise.all([canalDelNegocio(), respaldoDelNegocio()]);
  const delNegocio = [...respaldo.apagados];
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('funnels').select(COLS_FICHA)
      .order('es_default', { ascending: false }).order('orden', { ascending: true }).order('id');
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as unknown as FilaConFicha[];
    const porId = new Map<number, StepId[]>();
    for (const f of filas) porId.set(Number(f.id), armar(f, canal, respaldo).efectiva.apagados);
    // La casa NULL es el del negocio: el `es_default`, o el primero (el mismo orden que lib/funnels.ts).
    const defaultId = filas.length ? Number((filas.find((f) => f.es_default === true) ?? filas[0]).id) : null;
    return { porFunnel: true, apagadosDe: (fid) => apagadosDeLaCasa(porId, defaultId, delNegocio, fid) };
  } catch (e) {
    console.error('[ficha] no se pudieron leer los avisos por funnel, vale lo del negocio:', e instanceof Error ? e.message : e);
    return { porFunnel: false, apagadosDe: () => delNegocio };
  }
}

/** Los apagados de UN funnel (la ficha de un lead). Si no se puede leer, lo del negocio. */
export async function apagadosDeFunnel(funnelIdDelLead: number | null | undefined): Promise<StepId[]> {
  try {
    const f = await leerFichaDeFunnel(funnelIdDelLead == null ? null : Number(funnelIdDelLead));
    if (f) return f.efectiva.apagados;
    // Un funnel que ya no existe: el del negocio.
    const d = await leerFichaDeFunnel(null);
    return d ? d.efectiva.apagados : await apagadosDelNegocio();
  } catch (e) {
    console.error('[ficha] no se pudieron leer los avisos del funnel, vale lo del negocio:', e instanceof Error ? e.message : e);
    return apagadosDelNegocio();
  }
}
