import 'server-only';

// =============================================================================
// leads-unificar — unir dos fichas del mismo negocio: leer todo lo que cuelga de las dos y aplicar el plan (23/10/2026)
// =============================================================================
// Martín (23/10/2026): «En el CRM si me dice "Hay otra ficha parecida", que me de la opción ahí mismo de unificarlas».
// Lo que se decide (quién queda, qué dato, qué etapa, qué choca) es puro: lib/leads-unificar-reglas.ts (`planDeUnificar`).
// Acá, la lectura (`leerParaUnificar`) y la escritura (`aplicarUnificar`).
//
// ⚠️ NO ES UNA TRANSACCIÓN, Y POR ESO EL ORDEN: primero lo que choca, después lo que se muda, después los datos y al
//    final se borra la ficha que se va, y sólo si ya no le cuelga nada (`quedaColgando`). Si algo falla a la mitad, las
//    dos fichas siguen existiendo y no se perdió nada (lo movido está en la que queda); volver a unificar termina el
//    trabajo, porque cada operación vale dos veces. Una función de SQL lo haría atómico, pero sería una migración a
//    aplicar en producción a mano (scripts/apply-migration.mjs no deja registro: docs/hallazgos-infra.md).
// ⚠️ TODO VA ACOTADO AL NEGOCIO: además del cliente del workspace, cada escritura lleva `workspace_id` (muchas de estas
//    tablas no están en TENANT_TABLES, lib/workspace.ts) y las dos fichas se leen con `getLead` (un id ajeno no existe).
// =============================================================================

import { getTenantDb, getWorkspaceActual } from './workspace';
import { getLead } from './leads';
import { listarFunnels, funnelsConUmbrales } from './funnels';
import { productosDelLead } from './lead-funnel';
import { nombreVisible } from './lead-funnel-reglas';
import { etapaVigenteDe } from './funnel-etapas';
import {
  TABLAS_DE_CLIENTE, TABLAS_QUE_SE_MUDAN, planDeUnificar,
  type EnCrm, type LecturaUnificar, type OpUnificar, type PlanUnificar,
} from './leads-unificar-reglas';

type Db = Awaited<ReturnType<typeof getTenantDb>>;
const RESTO_DE_LA_FICHA = 'id, nombre, created_at, updated_at, funnel_id, estado_lead, monto_cierre_usd, meta_lead_id';

async function contar(db: Db, ws: number, tabla: string, col: string, id: number | string): Promise<number> {
  const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true }).eq('workspace_id', ws).eq(col, id);
  // Una tabla que no existe en esta base (una migración sin aplicar) cuenta 0: no hay nada que mudar.
  if (error) { if (/does not exist|42P01|PGRST205/i.test(error.message)) return 0; throw new Error(`No pude contar ${tabla}: ${error.message}`); }
  return count ?? 0;
}

async function filas<T>(db: Db, ws: number, tabla: string, cols: string, col: string, id: number | string, extra?: (q: never) => never): Promise<T[]> {
  let q = db.from(tabla).select(cols).eq('workspace_id', ws).eq(col, id);
  if (extra) q = extra(q as never);
  const { data, error } = await q;
  if (error) { if (/does not exist|42P01|PGRST205/i.test(error.message)) return []; throw new Error(`No pude leer ${tabla}: ${error.message}`); }
  return (data ?? []) as T[];
}

/** Lo que el plan necesita de UNA ficha. */
async function leerUna(db: Db, ws: number, leadId: number, cache: {
  nombres: Map<number, string>; etapas: Map<number, Array<{ key: string; label: string }>>; delNegocio: number | null;
}): Promise<LecturaUnificar['de'][number]> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error('Esa ficha no es de este negocio.');
  const [{ productos }, inscripciones, filasCrm, etiquetas, closingJobs, makoPendientes, borradoresSetter, chatEstado, chatLeidos, notif, flujos, ordenes, entregas] = await Promise.all([
    productosDelLead(leadId),
    filas<{ id: number; secuencia_id: number; estado: string }>(db, ws, 'nutricion_inscripciones', 'id, secuencia_id, estado', 'lead_id', leadId),
    filas<{ id: number; funnel_id: number; etapa: string }>(db, ws, 'lead_funnel', 'id, funnel_id, etapa', 'lead_id', leadId),
    filas<{ id: number; etiqueta_id: number }>(db, ws, 'crm_lead_etiquetas', 'id, etiqueta_id', 'lead_id', leadId),
    filas<{ id: number }>(db, ws, 'closing_jobs', 'id', 'lead_id', leadId),
    filas<{ id: number; clave: string }>(db, ws, 'mako_confirmaciones', 'id, clave', 'lead_id', leadId, (q) => (q as unknown as { eq: (c: string, v: string) => never }).eq('estado', 'pendiente')),
    filas<{ id: number }>(db, ws, 'wa_borradores', 'id', 'lead_id', leadId, (q) => (q as unknown as { eq: (c: string, v: string) => { eq: (c: string, v: string) => never } }).eq('origen', 'setter-asistido').eq('estado', 'pendiente')),
    filas<{ clave: string }>(db, ws, 'chat_estado', 'clave', 'clave', `lead:${leadId}`),
    filas<{ usuario_id: string }>(db, ws, 'chat_leidos', 'usuario_id', 'clave', `lead:${leadId}`),
    contar(db, ws, 'notificaciones', 'entity_id', String(leadId)),
    filas<{ id: number; ctx: Record<string, unknown> }>(db, ws, 'flujo_corridas', 'id, ctx', 'ctx->>leadId', String(leadId)),
    arreglosCon(db, ws, 'lead_orden', leadId),
    arreglosCon(db, ws, 'cliente_entrega_orden', leadId),
  ]);
  // Los nombres de las automatizaciones (para decir cuál chocó).
  const secIds = [...new Set(inscripciones.map((i) => i.secuencia_id))];
  const nombres = new Map<number, string>();
  if (secIds.length) {
    const { data } = await db.from('nutricion_secuencias').select('id, nombre').in('id', secIds);
    for (const s of (data ?? []) as Array<{ id: number; nombre: string | null }>) nombres.set(Number(s.id), s.nombre?.trim() || `Automatización #${s.id}`);
  }
  const conteos: Record<string, number> = {};
  for (const t of TABLAS_QUE_SE_MUDAN) conteos[t.tabla] = await contar(db, ws, t.tabla, t.col, leadId);
  conteos.cobros = conteos.cobros ?? 0;
  const deCliente: Record<string, number> = {};
  for (const t of TABLAS_DE_CLIENTE) deCliente[t.tabla] = await contar(db, ws, t.tabla, t.col, leadId);
  const crm: EnCrm[] = productos.map((p) => {
    const fid = p.funnelId ?? cache.delNegocio ?? 0;
    const stages = cache.etapas.get(fid) ?? [];
    const etapa = p.esCasa ? etapaVigenteDe(lead, stages as never) : p.etapa;
    const orden = stages.findIndex((s) => s.key === etapa);
    return { funnelId: fid, crm: cache.nombres.get(fid) ?? 'otro CRM', etapa, etapaNombre: stages.find((s) => s.key === etapa)?.label ?? null, orden, casa: !!p.esCasa };
  });
  return {
    inscripciones: inscripciones.map((i) => ({ ...i, nombre: nombres.get(Number(i.secuencia_id)) ?? `Automatización #${i.secuencia_id}` })),
    crm, filasCrm, etiquetas,
    closingJobs: closingJobs.map((x) => x.id), makoPendientes, borradoresSetter: borradoresSetter.map((x) => x.id),
    chatEstado: chatEstado.length > 0, chatLeidos, conteos, deCliente,
    arreglos: [...ordenes, ...entregas], flujos, notificaciones: notif,
  };
}

async function arreglosCon(db: Db, ws: number, tabla: string, leadId: number): Promise<Array<{ tabla: string; id: number; lead_ids: number[] }>> {
  const { data, error } = await db.from(tabla).select('id, lead_ids').eq('workspace_id', ws).contains('lead_ids', [leadId]);
  if (error) return [];
  return ((data ?? []) as Array<{ id: number; lead_ids: number[] }>).map((r) => ({ tabla, id: Number(r.id), lead_ids: (r.lead_ids ?? []).map(Number) }));
}

/** Lee las dos fichas y todo lo que cuelga de ellas. Tira si alguna no es de este negocio o si una lectura falla. */
export async function leerParaUnificar(aId: number, bId: number): Promise<LecturaUnificar> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Sin negocio.');
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select(RESTO_DE_LA_FICHA + ', email, telefono, telefono_normalizado, empresa, instagram, web, linkedin, youtube, direccion, sexo, setter, closer, ingreso_estimado, calificado, origen_lead, visitor_id, pagina_registro')
    .in('id', [aId, bId]);
  if (error) throw new Error(`No pude leer las fichas: ${error.message}`);
  const porId = new Map(((data ?? []) as Array<Record<string, unknown>>).map((r) => [Number(r.id), r]));
  const a = porId.get(aId), b = porId.get(bId);
  if (!a || !b) throw new Error('Alguna de las dos fichas no es de este negocio.');
  const [funnels, conEtapas] = await Promise.all([listarFunnels(), funnelsConUmbrales()]);
  const cache = {
    nombres: new Map(funnels.map((f) => [f.id, nombreVisible(f)] as const)),
    etapas: new Map((conEtapas ?? []).map((f) => [f.id, f.cfg.stages.map((s) => ({ key: s.key, label: s.label }))] as const)),
    delNegocio: funnels.find((f) => f.esDefault)?.id ?? funnels[0]?.id ?? null,
  };
  const [deA, deB] = await Promise.all([leerUna(db, ws, aId, cache), leerUna(db, ws, bId, cache)]);
  return { ws, a: { ...a, id: aId } as LecturaUnificar['a'], b: { ...b, id: bId } as LecturaUnificar['b'], de: { [aId]: deA, [bId]: deB } };
}

/** El plan (previa y operaciones), sin escribir nada. */
export async function planParaUnificar(aId: number, bId: number, queda: number | null): Promise<PlanUnificar> {
  return planDeUnificar(await leerParaUnificar(aId, bId), queda);
}

/** Lo que le queda colgando a la ficha que se va, en las tablas que la borrarían en cascada (si no es 0, no se borra). */
async function quedaColgando(db: Db, ws: number, id: number): Promise<string[]> {
  const cascada = ['nutricion_inscripciones', 'nutricion_envios', 'lead_funnel', 'crm_lead_etiquetas', 'chat_agent_handoffs', 'insistencias', 'curso_sesiones', ...TABLAS_DE_CLIENTE.map((t) => t.tabla)];
  const out: string[] = [];
  for (const t of cascada) if ((await contar(db, ws, t, 'lead_id', id)) > 0) out.push(t);
  return out;
}

/**
 * APLICA el plan. `version` es la de la previa que vio la persona: si alguna de las dos fichas cambió desde entonces, no
 * se hace nada (se vuelve a mirar). Devuelve cuántas operaciones aplicó; tira con lo que falló (lo hecho queda hecho y
 * volver a unificar lo termina).
 */
export async function aplicarUnificar(plan: Extract<PlanUnificar, { ok: true }>, version: { queda: string | null; seVa: string | null }, autor: string): Promise<{ aplicadas: number }> {
  const ws = await getWorkspaceActual();
  if (ws == null) throw new Error('Sin negocio.');
  const db = await getTenantDb();
  if (version.queda !== plan.previa.version.queda || version.seVa !== plan.previa.version.seVa) {
    throw new Error('Alguna de las dos fichas cambió mientras mirabas: vuelve a abrir «Unificar».');
  }
  let aplicadas = 0;
  const ok = (r: { error: { message: string } | null }, que: string) => { if (r.error) throw new Error(`${que}: ${r.error.message}`); aplicadas++; };
  for (const o of plan.ops as OpUnificar[]) {
    switch (o.op) {
      case 'borrar':
        if (o.ids.length) ok(await db.from(o.tabla).delete().eq('workspace_id', ws).in('id', o.ids), `borrar en ${o.tabla}`);
        break;
      case 'borrar-donde':
        ok(await db.from(o.tabla).delete().eq('workspace_id', ws).eq(o.col, o.valor), `borrar en ${o.tabla}`);
        break;
      case 'mover': {
        const r = await db.from(o.tabla).update({ [o.col]: o.a }).eq('workspace_id', ws).eq(o.col, o.de);
        // Una tabla que esta base no tiene (migración sin aplicar) no tiene nada que mudar.
        if (r.error && /does not exist|42P01|PGRST205/i.test(r.error.message)) break;
        ok(r, `mudar ${o.tabla}`);
        break;
      }
      case 'actualizar':
        ok(await db.from(o.tabla).update(o.valores).eq('workspace_id', ws).eq('id', o.id), `cambiar ${o.tabla}`);
        break;
      case 'insertar':
        ok(await db.from(o.tabla).insert({ ...o.fila, workspace_id: ws }), `agregar en ${o.tabla}`);
        break;
      case 'chat-leidos':
        if (o.usuarios.length) ok(await db.from('chat_leidos').update({ clave: o.aClave }).eq('workspace_id', ws).eq('clave', o.deClave).in('usuario_id', o.usuarios), 'mudar los leídos');
        break;
      case 'arreglo':
        ok(await db.from(o.tabla).update({ lead_ids: o.lead_ids }).eq('workspace_id', ws).eq('id', o.id), `ordenar ${o.tabla}`);
        break;
      case 'flujo':
        ok(await db.from('flujo_corridas').update({ ctx: o.ctx }).eq('workspace_id', ws).eq('id', o.id), 'mudar una corrida');
        break;
      case 'notificaciones':
        ok(await db.from('notificaciones').update({ entity_id: String(o.a) }).eq('workspace_id', ws).eq('entity_type', 'lead').eq('entity_id', String(o.de)), 'mudar los avisos');
        break;
      case 'historial':
        ok(await db.from('lead_audit').insert({ workspace_id: ws, lead_id: plan.queda, campo: 'Unificada', valor_anterior: null, valor_nuevo: o.texto, autor }), 'anotar en el historial');
        break;
      case 'borrar-ficha': {
        const colgando = await quedaColgando(db, ws, plan.seVa);
        if (colgando.length) throw new Error(`No borré «${plan.previa.seVa.nombre}»: todavía le cuelga ${colgando.join(', ')}. Vuelve a unificar.`);
        ok(await db.from('leads').delete().eq('id', plan.seVa), 'borrar la ficha que se va');
        break;
      }
    }
  }
  return { aplicadas };
}
