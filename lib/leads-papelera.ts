import 'server-only';

// =============================================================================
// leads-papelera — mandar leads a la papelera del CRM, recuperarlos y purgarlos (mig 0340)
// =============================================================================
// Las reglas y los textos, puros, en lib/leads-papelera-reglas.ts. Acá sólo se llama a la base: la foto, el borrado y la
// vuelta los hacen las funciones de la 0340, en UNA transacción por lead (todo o nada), con el esquema real de la base
// (las FKs se leen de `pg_constraint`, no de una lista). El porqué de una foto y no una columna `eliminado_at`, en la
// cabecera de la migración y en docs/hallazgos-crm.md → «La papelera de leads».
//
// ⚠️ SIN LA MIGRACIÓN NO SE BORRA NADA. Si la función no está, se dice (`FALTA_LA_PAPELERA`) y no se cae al `deleteLead` de
// antes: un «Eliminar» que promete 30 días y borra para siempre es peor que uno que no anda.
// ⚠️ El rpc no pasa por el scoping de `getTenantDb` (sólo estampa los `.from`): el negocio va explícito y la función lo
// mira en cada consulta.

import { getTenantDb, getWorkspaceActual } from './workspace';
import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { FALTA_LA_PAPELERA, TANDA_PAPELERA, contarPapelera, faltaLaPapelera, type ResultadoPapelera } from './leads-papelera-reglas';

export type FilaPapelera = {
  lead_id: number;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  funnel_id: number | null;
  etapa: string | null;
  por: string | null;
  eliminado_at: string;
  purgar_at: string;
};

/** Lo que vuelve de mandar o recuperar: los que sí, cuántos no y por qué, y los que no llegaron en el plazo. */
export type ResultadoLotePapelera = { hechos: number[]; fallaron: number; motivos: string[]; pendientes: number[] };

/** Una línea de historial por lead, en UNA escritura (de a uno eran 394 viajes). Nunca tira: lo hecho ya está hecho. */
async function anotar(ids: readonly number[], texto: string, autor: string): Promise<void> {
  if (!ids.length) return;
  try {
    const { error } = await (await getTenantDb()).from('lead_audit')
      .insert(ids.map((lead_id) => ({ lead_id, campo: 'Papelera', valor_anterior: null, valor_nuevo: texto, autor })));
    if (error) console.error(`[papelera] el historial falló: ${error.message}`);
  } catch (e) {
    console.error('[papelera] el historial falló:', e instanceof Error ? e.message : e);
  }
}

async function negocio(): Promise<number> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('No sé de qué negocio son estos leads.');
  return ws;
}

/** Corre la función de la 0340 sobre `ids`, de a `TANDA_PAPELERA`, hasta `hasta` (lo que no llega vuelve en `pendientes`). */
async function enTandas(fn: 'mandar_leads_a_papelera' | 'recuperar_leads_de_papelera', ids: readonly number[], extra: Record<string, unknown>,
  hasta: number): Promise<{ resultados: ResultadoPapelera[]; pendientes: number[] }> {
  const ws = await negocio();
  const db = await getTenantDb();
  const todos = [...new Set(ids)].filter((n) => Number.isInteger(n) && n > 0);
  const resultados: ResultadoPapelera[] = [];
  for (let i = 0; i < todos.length; i += TANDA_PAPELERA) {
    if (Date.now() > hasta) return { resultados, pendientes: todos.slice(i) };
    const tanda = todos.slice(i, i + TANDA_PAPELERA);
    const { data, error } = await db.rpc(fn, { p_ws: ws, p_ids: tanda, ...extra });
    if (error) {
      if (faltaLaPapelera(error)) throw new Error(FALTA_LA_PAPELERA);
      // Una llamada que no contestó puede haber hecho la tanda entera o nada (es una transacción por lead): se corta y se
      // dice; lo que quedó lo cuenta quien relee.
      throw new Error(`La papelera no contestó (${error.message}). Revisa cuáles quedaron antes de volver a tocar.`);
    }
    resultados.push(...((data ?? []) as ResultadoPapelera[]));
  }
  return { resultados, pendientes: [] };
}

/**
 * Manda `ids` a la papelera: cada uno sale del CRM con todo lo que le cuelga y queda su foto 30 días. Antes de borrarlo deja
 * en su historial (que no se borra: `lead_audit` no tiene FK) quién lo mandó, para que se lea al recuperarlo.
 */
export async function mandarLeadsAPapelera(ids: readonly number[], o: { por: string; hasta: number }): Promise<ResultadoLotePapelera> {
  const { resultados, pendientes } = await enTandas('mandar_leads_a_papelera', ids, { p_por: o.por }, o.hasta);
  const c = contarPapelera(resultados, 'mandar');
  await anotar(c.ok, 'Lo mandó a la papelera', o.por);
  return { hechos: c.ok, fallaron: c.fallaron, motivos: c.motivos, pendientes };
}

/** Devuelve `ids` de la papelera, igual que estaban (mismos ids, sus pagos, sus funnels, sus mensajes). */
export async function recuperarLeadsDePapelera(ids: readonly number[], o: { por: string; hasta: number }): Promise<ResultadoLotePapelera> {
  const { resultados, pendientes } = await enTandas('recuperar_leads_de_papelera', ids, {}, o.hasta);
  const c = contarPapelera(resultados, 'recuperar');
  await anotar(c.ok, 'Lo recuperó de la papelera', o.por);
  return { hechos: c.ok, fallaron: c.fallaron, motivos: c.motivos, pendientes };
}

/** Lo que hay en la papelera de este negocio, lo más nuevo primero. `falta`: la migración 0340 no está. */
export async function listarPapeleraDeLeads(): Promise<{ filas: FilaPapelera[]; falta: boolean }> {
  const db = await getTenantDb();
  try {
    const filas = await leerTodo<FilaPapelera>(db, 'leads_papelera', 'lead_id, nombre, telefono, email, funnel_id, etapa, por, eliminado_at, purgar_at', { orden: 'id' });
    filas.sort((a, b) => String(b.eliminado_at).localeCompare(String(a.eliminado_at)));
    return { filas: filas.map((f) => ({ ...f, lead_id: Number(f.lead_id), funnel_id: f.funnel_id == null ? null : Number(f.funnel_id) })), falta: false };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (faltaLaPapelera({ message: m })) return { filas: [], falta: true };
    throw e;
  }
}

/** Cuántos hay en la papelera de este negocio, sin traerlos (el renglón «Papelera» del menú de funnels). 0 sin la 0340. */
export async function contarPapeleraDeLeads(): Promise<number> {
  const { count, error } = await (await getTenantDb()).from('leads_papelera').select('id', { count: 'exact', head: true });
  if (error) {
    if (faltaLaPapelera(error)) return 0;
    throw new Error(`No pude contar la papelera: ${error.message}`);
  }
  return count ?? 0;
}

/** Borra para siempre las fotos vencidas de TODOS los negocios (el cron diario). Devuelve cuántas. */
export async function purgarPapeleraDeLeads(): Promise<number> {
  const { data, error } = await getSupabaseServer().rpc('purgar_papelera_leads', { p_ws: null });
  if (error) {
    if (faltaLaPapelera(error)) return 0;
    throw new Error(`No pude purgar la papelera de leads: ${error.message}`);
  }
  return Number(data ?? 0);
}
