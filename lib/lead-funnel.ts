import 'server-only';

// =============================================================================
// lead-funnel — un lead en VARIOS productos del CRM (mig 0207)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). Las reglas, sin
// base, están en lib/lead-funnel-reglas.ts; acá se leen y escriben las filas.
//
// ⚠️ LO QUE ESTO NO TOCA, A PROPÓSITO (v1): agregar a un producto o mover la tarjeta en él
// escribe SÓLO la fila de `lead_funnel` y una línea de historial. No llama a setPipelineStage
// ni a updateLead (no toca estado_lead, monto, fecha_cierre ni el CAPI de calificado), no
// inscribe en secuencias de nutrición (las 62 secuencias de la base aplican a todos los
// productos: inscribir por la etapa del segundo producto le escribiría dos veces a la misma
// persona) y no cambia la etiqueta de WhatsApp. Todo eso sigue a la CASA. Las excepciones, en
// `moverEtapaEnProducto`: el enganche «al ganar» y las etiquetas del CRM vinculadas a una etapa
// de ESE producto (mig 0224).

import { getTenantDb } from './workspace';
import { getLead, logLeadEvent, autorDelMovimiento, updateLead } from './leads';
import { getFunnelDe, getFunnelDefault, idDelFunnelDefault, listarFunnels } from './funnels';
import { productosDe, puedeQuitar, aQuienPromover, etapaDeEntrada, casaParaEscribir, casaReal, nombreVisible, type ProductoDelLead, type FilaLeadFunnel } from './lead-funnel-reglas';
import { terminalEstadoFor } from './pipeline';
import { pasaAGanado } from './crm-curso-al-ganar-reglas';

/** Las etapas de un producto (el del negocio por su propio camino: su config vive en la fila default). */
export async function etapasDeProducto(funnelId: number): Promise<Array<{ key: string; label: string; kind?: string | null; band?: string; dot?: string }>> {
  const def = await idDelFunnelDefault();
  const cfg = def != null && funnelId === def ? await getFunnelDefault() : await getFunnelDe(funnelId);
  return cfg.stages as Array<{ key: string; label: string; kind?: string | null; band?: string; dot?: string }>;
}

/** El nombre que ve la persona: el del producto si lo hay, si no el del embudo. */
async function nombreDeProducto(funnelId: number): Promise<string> {
  const f = (await listarFunnels()).find((x) => x.id === funnelId);
  return (f ? nombreVisible(f) : '') || 'otro funnel';
}

async function filasDe(leadId: number): Promise<FilaLeadFunnel[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('lead_funnel').select('id, funnel_id, etapa, etapa_desde, created_at').eq('lead_id', leadId);
  if (error) throw new Error('No se pudieron leer los funnels del lead: ' + error.message);
  return (data ?? []) as FilaLeadFunnel[];
}

/** Los productos de UN lead (casa + filas), resueltos contra la base. */
export async function productosDelLead(leadId: number): Promise<{ productos: ProductoDelLead[]; defaultId: number | null; funnelIdDelLead: number | null; etapaCasa: string | null }> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error('No encontré ese lead.');
  const [defaultId, filas] = await Promise.all([idDelFunnelDefault(), filasDe(leadId)]);
  const funnelIdDelLead = lead.funnel_id == null ? null : Number(lead.funnel_id);
  return { productos: productosDe(funnelIdDelLead, filas, defaultId), defaultId, funnelIdDelLead, etapaCasa: lead.pipeline_stage ?? null };
}

/**
 * Agrega el lead a un producto: una fila en la etapa de ENTRADA de ese producto. Si ya está
 * (por casa o por fila), no hace nada. Devuelve si lo agregó, para el deshacer.
 */
export async function agregarAProducto(leadId: number, funnelId: number, opts?: { autor?: string }): Promise<{ agregado: boolean; etapa: string | null }> {
  const { productos } = await productosDelLead(leadId);
  if (productos.some((p) => p.funnelId === funnelId)) return { agregado: false, etapa: null };
  const funnels = await listarFunnels();
  if (!funnels.some((f) => f.id === funnelId)) throw new Error('Ese funnel no existe.');
  const etapa = etapaDeEntrada(await etapasDeProducto(funnelId));
  if (!etapa) throw new Error('Ese funnel no tiene etapas.');
  const autor = await autorDelMovimiento(opts?.autor);
  const db = await getTenantDb();
  const { error } = await db.from('lead_funnel').upsert(
    [{ lead_id: leadId, funnel_id: funnelId, etapa, por: autor, etapa_desde: new Date().toISOString() }],
    { onConflict: 'workspace_id,lead_id,funnel_id', ignoreDuplicates: true },
  );
  if (error) throw new Error('No se pudo agregar al funnel: ' + error.message);
  await logLeadEvent(leadId, 'Funnel', `Agregado a «${await nombreDeProducto(funnelId)}»`, autor);
  return { agregado: true, etapa };
}

/** Lo que hace falta para deshacer un «quitar». */
export type DeshacerQuitar = {
  leadId: number;
  funnelId: number;
  /** La fila que se borró (si el quitado era una fila, o la que se promovió a casa). */
  fila: { funnel_id: number; etapa: string; etapa_desde: string | null } | null;
  /**
   * Si se quitó la CASA: cómo estaba antes, para devolverla. `estado_lead` viene SÓLO si el quitar
   * lo cambió (la etapa promovida era un desenlace): es lo que el deshacer tiene que devolver.
   */
  casaAntes: { funnel_id: number | null; pipeline_stage: string | null; estado_lead?: string | null } | null;
};

/** Los desenlaces que un deshacer puede devolver. El dato viaja por el navegador: no se le cree otro. */
const ESTADOS = ['abierto', 'ganado', 'perdido', 'descalificado', 'no_responde'] as const;
type EstadoDeshacer = (typeof ESTADOS)[number];
const esEstado = (v: unknown): v is EstadoDeshacer => typeof v === 'string' && (ESTADOS as readonly string[]).includes(v);

/**
 * Saca al lead de UN producto. Sólo con dos o más (el server lo vuelve a contar: esconder la X
 * no protege nada).
 *   · Si era una fila, se borra.
 *   · Si era la CASA, la fila más vieja pasa a ser la casa (funnel_id + su etapa) y se borra.
 */
export async function quitarDeProducto(leadId: number, funnelId: number, opts?: { autor?: string }): Promise<DeshacerQuitar> {
  const { productos, defaultId, funnelIdDelLead, etapaCasa } = await productosDelLead(leadId);
  const p = productos.find((x) => x.funnelId === funnelId);
  if (!p) throw new Error('No está en ese funnel.');
  if (!puedeQuitar(productos)) throw new Error('Es su único funnel.');
  const autor = await autorDelMovimiento(opts?.autor);
  const db = await getTenantDb();
  const nombre = await nombreDeProducto(funnelId);

  if (!p.esCasa) {
    const { error } = await db.from('lead_funnel').delete().eq('lead_id', leadId).eq('funnel_id', funnelId);
    if (error) throw new Error('No se pudo quitar del funnel: ' + error.message);
    await logLeadEvent(leadId, 'Funnel', `Quitado de «${nombre}»`, autor);
    return { leadId, funnelId, fila: { funnel_id: funnelId, etapa: p.etapa ?? '', etapa_desde: p.desde }, casaAntes: null };
  }

  const nueva = aQuienPromover(productos);
  if (!nueva) throw new Error('Es su único funnel.');
  // La casa nueva: su producto y su etapa pasan al lead; la fila deja de existir (nunca hay
  // fila para la casa). Se escribe directo y no por setPipelineStage: la etapa viene de otro
  // tablero y no es un movimiento del recorrido.
  const { error: e1 } = await db.from('leads')
    .update({ funnel_id: casaParaEscribir(nueva.funnelId, defaultId), pipeline_stage: nueva.etapa })
    .eq('id', leadId);
  if (e1) throw new Error('No se pudo quitar del funnel: ' + e1.message);
  // ⚠️ PERO SI LA ETAPA PROMOVIDA ES UN DESENLACE, EL ESTADO LA SIGUE (08/10/2026). El desenlace
  // del lead (estado_lead, lo que cuentan Revenue y Customer Success) es el de su CASA, y escribir
  // sólo la columna dejaba la tarjeta en «Ganado» con el lead abierto: medido en el CRM de Leila
  // (ws11), el #2605 quedó así de 05:32 a 05:47, fuera del revenue, hasta que ella rehízo el Ganado
  // a mano. Va por updateLead (las reglas del desenlace y el enganche «al ganar»).
  // ⚠️ SÓLO HACIA UN DESENLACE. Si la etapa promovida es abierta y el lead había ganado en el
  // producto que se saca, no se lo des-gana: updateLead con «abierto» borra el monto y la fecha
  // de cierre de esa venta, y eso no lo decide un «quitar». Queda escrito en docs/hallazgos-crm.md.
  let estadoAntes: string | null = null;
  const desenlace = nueva.etapa ? terminalEstadoFor(nueva.etapa) : 'abierto';
  if (desenlace !== 'abierto') {
    const lead = await getLead(leadId);
    if (lead && lead.estado_lead !== desenlace) {
      estadoAntes = lead.estado_lead ?? 'abierto';
      await updateLead(leadId, { estado_lead: desenlace });
    }
  }
  const { error: e2 } = await db.from('lead_funnel').delete().eq('lead_id', leadId).eq('funnel_id', nueva.funnelId);
  if (e2) console.error('[lead-funnel] la fila promovida no se borró:', e2.message);
  await logLeadEvent(leadId, 'Funnel', `Quitado de «${nombre}»: ahora su funnel es «${await nombreDeProducto(nueva.funnelId)}»`, autor);
  return {
    leadId, funnelId,
    fila: { funnel_id: nueva.funnelId, etapa: nueva.etapa ?? '', etapa_desde: nueva.desde },
    casaAntes: { funnel_id: funnelIdDelLead, pipeline_stage: etapaCasa, ...(estadoAntes ? { estado_lead: estadoAntes } : {}) },
  };
}

/** Deshace un `quitarDeProducto`: devuelve la casa y la fila como estaban. */
export async function deshacerQuitar(d: DeshacerQuitar, opts?: { autor?: string }): Promise<void> {
  const db = await getTenantDb();
  const autor = await autorDelMovimiento(opts?.autor);
  if (d.casaAntes) {
    const { error } = await db.from('leads').update({ funnel_id: d.casaAntes.funnel_id, pipeline_stage: d.casaAntes.pipeline_stage }).eq('id', d.leadId);
    if (error) throw new Error('No se pudo deshacer: ' + error.message);
    // El desenlace que el quitar cambió, de vuelta (sólo si lo cambió, y sólo un estado válido).
    if (esEstado(d.casaAntes.estado_lead)) await updateLead(d.leadId, { estado_lead: d.casaAntes.estado_lead });
  }
  if (d.fila) {
    const { error } = await db.from('lead_funnel').upsert(
      [{ lead_id: d.leadId, funnel_id: d.fila.funnel_id, etapa: d.fila.etapa, etapa_desde: d.fila.etapa_desde ?? new Date().toISOString(), por: autor }],
      { onConflict: 'workspace_id,lead_id,funnel_id' },
    );
    if (error) throw new Error('No se pudo deshacer: ' + error.message);
  }
  await logLeadEvent(d.leadId, 'Funnel', `Vuelve a «${await nombreDeProducto(d.funnelId)}» (se deshizo)`, autor);
}

/**
 * Mueve la tarjeta de un lead AGREGADO dentro de ese producto: escribe la fila y nada más. Si el
 * producto es su casa, no es esta función (el tablero usa el camino de siempre).
 */
export async function moverEtapaEnProducto(leadId: number, funnelId: number, etapa: string, opts?: { autor?: string }): Promise<{ antes: string }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('lead_funnel').select('etapa').eq('lead_id', leadId).eq('funnel_id', funnelId).limit(1);
  if (error) throw new Error('No se pudo leer la etapa: ' + error.message);
  const fila = ((data ?? []) as Array<{ etapa: string }>)[0];
  if (!fila) throw new Error('El lead no está agregado a ese funnel.');
  if (!(await etapasDeProducto(funnelId)).some((s) => s.key === etapa)) throw new Error('Esa etapa no existe en ese funnel.');
  if (fila.etapa === etapa) return { antes: etapa };
  const autor = await autorDelMovimiento(opts?.autor);
  const { error: e2 } = await db.from('lead_funnel')
    .update({ etapa, etapa_desde: new Date().toISOString(), por: autor, updated_at: new Date().toISOString() })
    .eq('lead_id', leadId).eq('funnel_id', funnelId);
  if (e2) throw new Error('No se pudo mover: ' + e2.message);
  await db.from('lead_audit').insert([{ lead_id: leadId, campo: `Etapa · ${await nombreDeProducto(funnelId)}`, valor_anterior: fila.etapa, valor_nuevo: etapa, autor }]);
  // ⚠️ LA ÚNICA EXCEPCIÓN A «esto no toca nada más» (la cabecera): ganar en un producto agregado
  // llama al MISMO enganche que la casa (lib/crm-curso-al-ganar.ts), porque la invitación al curso
  // es POR PRODUCTO. Si el portal del alumno no abre ese producto, el enganche no invita y lo dice
  // en el historial. Sólo la transición: la etapa de antes no era la de Ganado.
  if (pasaAGanado(terminalEstadoFor(fila.etapa), terminalEstadoFor(etapa))) {
    try {
      const { alGanarInvitarAlCurso } = await import('./crm-curso-al-ganar');
      await alGanarInvitarAlCurso({ leadId, funnelId });
    } catch (e) {
      console.error(`[lead-funnel] lead ${leadId}: el enganche al ganar falló:`, e instanceof Error ? e.message : e);
    }
  }
  // ⚠️ Y LAS ETIQUETAS VINCULADAS A UNA ETAPA DE ESTE PRODUCTO (mig 0224), al lado del enganche
  // «al ganar»: salir de la etapa saca la suya y entrar pone la de la nueva. Es la segunda
  // excepción a la cabecera y no toca la casa: la etiqueta que pone una etapa nunca vuelve a
  // mover (`origen: 'etapa'`) ni dispara automatizaciones (lib/etiquetas-motor.ts). Import
  // dinámico: lib/etiquetas.ts importa este módulo. Nunca tira.
  try {
    const { espejarEtapa } = await import('./etiquetas');
    await espejarEtapa(leadId, funnelId, fila.etapa, etapa, { autor });
  } catch (e) {
    console.error(`[lead-funnel] lead ${leadId}: el espejo de etiquetas falló:`, e instanceof Error ? e.message : e);
  }
  return { antes: fila.etapa };
}

/**
 * Agrega VARIOS leads a un producto (la acción en lote, «traer» de otro producto, las
 * campañas). Saltea a los que ya están. Devuelve los ids que agregó, para el deshacer.
 */
export async function agregarLoteAProducto(leadIds: number[], funnelId: number, porQue: string, opts?: { autor?: string }): Promise<{ agregados: number[]; fallaron: number }> {
  const funnels = await listarFunnels();
  if (!funnels.some((f) => f.id === funnelId)) throw new Error('Ese funnel no existe.');
  const etapa = etapaDeEntrada(await etapasDeProducto(funnelId));
  if (!etapa) throw new Error('Ese funnel no tiene etapas.');
  const defaultId = await idDelFunnelDefault();
  const db = await getTenantDb();
  const autor = await autorDelMovimiento(opts?.autor);
  const ids = [...new Set(leadIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const agregados: number[] = [];
  let fallaron = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    // Los que YA están: por casa (funnel_id) o por fila. A ésos no se les escribe nada.
    const { data: casas, error: ec } = await db.from('leads').select('id, funnel_id').in('id', tanda);
    if (ec) { fallaron += tanda.length; continue; }
    const { data: filas, error: ef } = await db.from('lead_funnel').select('lead_id').eq('funnel_id', funnelId).in('lead_id', tanda);
    if (ef) { fallaron += tanda.length; continue; }
    const yaFila = new Set(((filas ?? []) as Array<{ lead_id: number | string }>).map((f) => Number(f.lead_id)));
    const nuevos = ((casas ?? []) as Array<{ id: number | string; funnel_id: number | string | null }>)
      .filter((l) => casaReal(l.funnel_id == null ? null : Number(l.funnel_id), defaultId) !== funnelId && !yaFila.has(Number(l.id)))
      .map((l) => Number(l.id));
    if (!nuevos.length) continue;
    const ahora = new Date().toISOString();
    const { data: ins, error } = await db.from('lead_funnel')
      .upsert(nuevos.map((lead_id) => ({ lead_id, funnel_id: funnelId, etapa, por: autor, etapa_desde: ahora })), { onConflict: 'workspace_id,lead_id,funnel_id', ignoreDuplicates: true })
      .select('lead_id');
    if (error) { fallaron += nuevos.length; continue; }
    const ok = ((ins ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id));
    agregados.push(...ok);
    const audit = ok.map((lead_id) => ({ lead_id, campo: 'Funnel', valor_anterior: null, valor_nuevo: porQue, autor }));
    if (audit.length) {
      const { error: ea } = await db.from('lead_audit').insert(audit);
      if (ea) console.error('[lead-funnel] historial falló:', ea.message);
    }
  }
  return { agregados, fallaron };
}

/** Deshace un `agregarLoteAProducto`: borra SÓLO las filas que ese lote creó. */
export async function quitarLoteDeProducto(leadIds: number[], funnelId: number, porQue: string, opts?: { autor?: string }): Promise<number> {
  const db = await getTenantDb();
  const autor = await autorDelMovimiento(opts?.autor);
  let n = 0;
  for (let i = 0; i < leadIds.length; i += 200) {
    const tanda = leadIds.slice(i, i + 200);
    const { data, error } = await db.from('lead_funnel').delete().eq('funnel_id', funnelId).in('lead_id', tanda).select('lead_id');
    if (error) { console.error('[lead-funnel] quitar en lote falló:', error.message); continue; }
    const ok = ((data ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id));
    n += ok.length;
    if (ok.length) await db.from('lead_audit').insert(ok.map((lead_id) => ({ lead_id, campo: 'Funnel', valor_anterior: null, valor_nuevo: porQue, autor })));
  }
  return n;
}
