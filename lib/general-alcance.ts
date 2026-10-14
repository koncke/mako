// =============================================================================
// general-alcance — lo que una vista de /general lee de sus funnels y ofertas
// =============================================================================
// Tres lecturas, y cada una con su forma de fallar escrita:
//
//   · `leerCatalogoAlcance` — los funnels activos, las ofertas activas y quién vende qué (`funnel_ofertas`). Con la
//     lectura caída devuelve `null`: el botón del alcance no se ofrece (no se puede elegir de una lista que no hay).
//   · `idsDeLeadsEnFunnels` — los leads de un alcance: los que tienen ahí su CASA (`leads.funnel_id`; el del negocio
//     se escribe NULL, lib/lead-funnel-reglas.ts) más los AGREGADOS (`lead_funnel`, mig 0207). TIRA si falla: un
//     filtro que no se pudo armar no es «ningún lead» — mostraría «nada por cobrar» sobre cuotas vencidas.
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
import { listarOfertas, ofertasDeFunnels } from './ofertas';
import type { LigaFunnelOferta } from './general-vistas-modelo';

export type CatalogoAlcance = {
  funnels: Array<{ id: number; nombre: string; esDefault: boolean }>;
  ofertas: Array<{ id: number; nombre: string }>;
  ligas: LigaFunnelOferta[];
};

/** Los funnels y las ofertas del negocio. `null` = no se pudo leer (no es «no hay»). */
export async function leerCatalogoAlcance(): Promise<CatalogoAlcance | null> {
  try {
    const [fs, os, ls] = await Promise.all([
      leerFunnels(),
      listarOfertas(true),
      // Sin la tabla (o con la lectura caída), una oferta no suma funnels: se elige igual y no filtra nada de más.
      ofertasDeFunnels().catch(() => []),
    ]);
    if (fs == null) return null;
    return {
      funnels: fs.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault })),
      ofertas: os.map((o) => ({ id: o.id, nombre: o.nombre })),
      ligas: ls.map((l) => ({ funnel_id: Number(l.funnel_id), oferta_id: Number(l.oferta_id) })),
    };
  } catch (e) {
    console.error('[general] no pude leer funnels y ofertas:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Los ids de los leads que están en alguno de estos funnels (casa o agregados). ⚠️ Tira si falla. */
export async function idsDeLeadsEnFunnels(funnelIds: readonly number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!funnelIds.length) return out;
  const db = await getTenantDb();
  const def = await idDelFunnelDefault();
  const otros = funnelIds.filter((f) => f !== def);
  // La CASA. El funnel del negocio se escribe NULL en `leads.funnel_id`.
  if (def != null && funnelIds.includes(def)) {
    const filas = await leerTodo<{ id: number }>(db, 'leads', 'id', { orden: 'id', filtros: (q) => q.is('funnel_id', null) });
    for (const f of filas) out.add(Number(f.id));
  }
  if (otros.length) {
    const filas = await leerTodo<{ id: number }>(db, 'leads', 'id', { orden: 'id', filtros: (q) => q.in('funnel_id', otros) });
    for (const f of filas) out.add(Number(f.id));
  }
  // Los AGREGADOS (mig 0207): están en el funnel por una fila de `lead_funnel`, no por su casa.
  const agregados = await leerTodo<{ id: number; lead_id: number }>(db, 'lead_funnel', 'id, lead_id', { orden: 'id', filtros: (q) => q.in('funnel_id', [...funnelIds]) });
  for (const f of agregados) out.add(Number(f.lead_id));
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
