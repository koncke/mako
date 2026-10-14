// =============================================================================
// general-alcance — lo que un bloque de /general lee de los funnels del negocio
// =============================================================================
// Desde el 14/10/2026 un bloque de General se ATA a un funnel (`general.funnel` del elemento, lib/general-piezas.ts):
// «Tu funnel hoy» cuenta ese y «A quién cobrarle» muestra sólo sus clientes. Es lo que quedó del pedido del 13/10
// («e incluso asignarles ofertas y/o funnels»), que antes vivía en las «vistas»: ahora se elige por bloque, en su panel.
// Tres lecturas, y cada una con su forma de fallar escrita:
//
//   · `leerFunnelsDeGeneral` — los funnels activos, con su nombre visible. Con la lectura caída devuelve `null`: el
//     panel no ofrece elegir (no se puede elegir de una lista que no hay).
//   · `funnelsDeLeads` — de qué funnels es cada lead de una lista CHICA (los de la cobranza): su CASA
//     (`leads.funnel_id`; el del negocio se escribe NULL, lib/lead-funnel-reglas.ts) más los AGREGADOS (`lead_funnel`,
//     mig 0207). TIRA si falla: un filtro que no se pudo armar no es «ningún cliente» — mostraría «nada por cobrar»
//     sobre cuotas vencidas.
//   · `conteoDelFunnel` — cuántos leads hay en cada etapa, con la etapa de la fila para los agregados (la misma
//     regla que el tablero del CRM, `listLeadsDeFunnel` en lib/leads.ts).
//
// ⚠️ PAGINADO. `leads` pasó las 1000 filas en el ws1 (AGENTS.md, «Un número redondo es una hipótesis de
//    truncamiento»): todo va por `leerTodo`, con orden por `id`.
// ⚠️ No vive en lib/leads.ts a propósito: es el archivo más tocado del repo por las sesiones del CRM, y esto es
//    una lectura de /general. Si el tablero del CRM cambia CÓMO un lead pertenece a un funnel, cambia acá también
//    (las dos preguntas: la casa y la fila de `lead_funnel`).

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { idDelFunnelDefault, leerFunnels } from './funnels';
import { etapasDeProducto } from './lead-funnel';
import { nombreVisible } from './lead-funnel-reglas';

export type FunnelDeGeneral = { id: number; nombre: string; esDefault: boolean };

/** Los funnels del negocio, con el nombre que ve la persona. `null` = no se pudo leer (no es «no hay»). */
export async function leerFunnelsDeGeneral(): Promise<FunnelDeGeneral[] | null> {
  try {
    const fs = await leerFunnels();
    if (fs == null) return null;
    return fs.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault }));
  } catch (e) {
    console.error('[general] no pude leer los funnels:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Cuántos ids van en un `in (…)`: la lista viaja en la URL de PostgREST. */
const TANDA_IDS = 200;

/** De qué funnels es cada uno de estos leads (casa o agregado). ⚠️ Tira si falla. */
export async function funnelsDeLeads(leadIds: readonly number[]): Promise<Map<number, Set<number>>> {
  const out = new Map<number, Set<number>>();
  const ids = [...new Set(leadIds)];
  if (!ids.length) return out;
  const db = await getTenantDb();
  const def = await idDelFunnelDefault();
  const sumar = (lead: number, funnel: number | null) => {
    if (funnel == null) return;
    const s = out.get(lead) ?? new Set<number>();
    s.add(funnel);
    out.set(lead, s);
  };
  for (let i = 0; i < ids.length; i += TANDA_IDS) {
    const tanda = ids.slice(i, i + TANDA_IDS);
    const [casa, agregados] = await Promise.all([
      leerTodo<{ id: number; funnel_id: number | null }>(db, 'leads', 'id, funnel_id', { orden: 'id', filtros: (q) => q.in('id', tanda) }),
      leerTodo<{ id: number; lead_id: number; funnel_id: number }>(db, 'lead_funnel', 'id, lead_id, funnel_id', { orden: 'id', filtros: (q) => q.in('lead_id', tanda) }),
    ]);
    // La CASA. El funnel del negocio se escribe NULL en `leads.funnel_id`.
    for (const l of casa) sumar(Number(l.id), l.funnel_id == null ? def : Number(l.funnel_id));
    // Los AGREGADOS (mig 0207): están en el funnel por una fila de `lead_funnel`, no por su casa.
    for (const f of agregados) sumar(Number(f.lead_id), Number(f.funnel_id));
  }
  return out;
}

export type EtapaContada = { key: string; label: string; dot: string | null; n: number };
export type ConteoFunnel = { funnelId: number; nombre: string; etapas: EtapaContada[]; total: number; sinEtapa: number };

/**
 * Cuántos leads hay en cada etapa de un funnel. Las etapas salen de la configuración del funnel, en su orden; un
 * lead con una etapa que el funnel ya no tiene cuenta en `sinEtapa` (y se dice: no se esconde en el total).
 * ⚠️ Tira si falla.
 */
export async function conteoDelFunnel(funnelId: number, nombre: string): Promise<ConteoFunnel> {
  const db = await getTenantDb();
  const def = await idDelFunnelDefault();
  const [etapas, casa, agregados] = await Promise.all([
    etapasDeProducto(funnelId),
    leerTodo<{ id: number; pipeline_stage: string | null }>(db, 'leads', 'id, pipeline_stage', {
      orden: 'id', filtros: (q) => (funnelId === def ? q.is('funnel_id', null) : q.eq('funnel_id', funnelId)),
    }),
    leerTodo<{ id: number; lead_id: number; etapa: string | null }>(db, 'lead_funnel', 'id, lead_id, etapa', {
      orden: 'id', filtros: (q) => q.eq('funnel_id', funnelId),
    }),
  ]);
  const porEtapa = new Map<string, number>();
  const yaContados = new Set<number>();
  for (const l of casa) {
    yaContados.add(Number(l.id));
    const k = String(l.pipeline_stage ?? '');
    porEtapa.set(k, (porEtapa.get(k) ?? 0) + 1);
  }
  for (const f of agregados) {
    if (yaContados.has(Number(f.lead_id))) continue;
    const k = String(f.etapa ?? '');
    porEtapa.set(k, (porEtapa.get(k) ?? 0) + 1);
  }
  const conocidas = new Set(etapas.map((e) => e.key));
  let sinEtapa = 0;
  for (const [k, n] of porEtapa) if (!conocidas.has(k)) sinEtapa += n;
  const contadas: EtapaContada[] = etapas.map((e) => ({ key: e.key, label: e.label, dot: e.dot ?? null, n: porEtapa.get(e.key) ?? 0 }));
  const total = contadas.reduce((s, e) => s + e.n, 0) + sinEtapa;
  return { funnelId, nombre, etapas: contadas, total, sinEtapa };
}
