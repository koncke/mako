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
//
// ⚠️ Y DESDE EL 23/10/2026 (P0 de #289), LAS AUTOMATIZACIONES DE ESE CRM, POR EVENTO: MOVER la tarjeta de un agregado lo
// inscribe en el acto en las automatizaciones cuyo CRON es esa etapa de ESE CRM (`enrolarAgregado`). Desde el 21/10 el
// barrido de la hora ya veía a los agregados (lib/nutricion-ambito.ts): esto no inscribe a nadie de más, lo inscribe una
// hora antes. La regla es la MISMA (`agregadoEntraPorEvento`): una automatización de «Todos los productos» sigue sin
// agarrar la etapa de un segundo CRM. AGREGARLO no dispara (revisión adversarial del 23/10/2026): la página de gracias y
// el cobro agregan y en el mismo pedido mueven a Ganado, y el evento de la entrada le mandaba la prospección a quien
// acababa de pagar. Lo agregado lo levanta el barrido, que ya lo ve en su etapa de verdad.

import { getTenantDb } from './workspace';
import { getLead, logLeadEvent, autorDelMovimiento, updateLead } from './leads';
import { getFunnelDe, getFunnelDefault, idDelFunnelDefault, listarFunnels } from './funnels';
import { productosDe, puedeQuitar, aQuienPromover, etapaDeEntrada, casaParaEscribir, casaReal, nombreVisible, type ProductoDelLead, type FilaLeadFunnel } from './lead-funnel-reglas';
import { terminalEstadoFor } from './pipeline';
import { pasaAGanado } from './crm-curso-al-ganar-reglas';
import type { InformeMovimiento } from './reentrada';
import { agendoLead, pagoLead } from './nutricion-grafo-motor';
import type { EtapaDestino, PreviaPasar } from './pasar-funnel-reglas';

/**
 * Lo cobrado de la casa (`total_cobrado_casa_usd`, mig 0325) depende de en qué CRMs está el lead: un pago con el funnel de
 * un CRM agregado no es de la casa. Agregar, quitar o deshacer cambia ese conjunto, y la columna lo sigue (tercera revisión
 * del 22/10/2026, B1: re-agregar a un CRM viejo dejaba la columna con plata que ya no era de la casa, y el saldo saltaba
 * en el próximo pago). Con `funnelId`, sólo los leads con pagos en ese CRM (un lote de 1.000 no se sincroniza entero).
 * Nunca tira: el movimiento ya está hecho, y el próximo pago la vuelve a sincronizar.
 */
async function resincronizarCobrado(leadIds: readonly number[], funnelId?: number): Promise<void> {
  let ids = [...new Set(leadIds)];
  try {
    if (!ids.length) return;
    // Sólo los que tienen pagos (en ese CRM, si se dice): un lead sin pagos no tiene nada que re-sincronizar, y
    // sincronizarlo escribía casa = 0 donde había NULL (cuarta revisión, B4).
    let q = (await getTenantDb()).from('pagos').select('lead_id').in('lead_id', ids);
    if (funnelId != null) q = q.eq('funnel_id', funnelId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    ids = [...new Set(((data ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id)))];
  } catch (e) {
    console.error(`[lead-funnel] no pude ver a quién re-sincronizar (${leadIds.length} lead(s)):`, e instanceof Error ? e.message : e);
    return;
  }
  if (!ids.length) return;
  // Import dinámico: lib/pagos.ts es pesado y no hace falta para mover de CRM.
  const { sincronizarTotalCobrado } = await import('./pagos');
  // De a uno, cada uno con su catch (cuarta revisión, B1): una falla en el tercero no deja a los siete siguientes viejos.
  for (const id of ids) {
    try {
      await sincronizarTotalCobrado(id);
    } catch (e) {
      console.error(`[lead-funnel] no pude re-sincronizar lo cobrado del lead ${id}:`, e instanceof Error ? e.message : e);
    }
  }
}

/**
 * ¿El lead tiene pagos con el funnel de este CRM, sin estar en él? Sólo pasa si se le quitó ESA casa con pagos: los pagos
 * conservan su funnel y hoy cuentan como de la casa nueva. Volver a agregarlo a ese CRM los movería a ese trato, y el saldo
 * de la venta saltaría en el acto a la venta entera (cuarta revisión, M1), sin un Deshacer (quitar lo frena por la plata).
 * Es el espejo del guard de quitar. Tira si no puede leer.
 */
async function pagosHuerfanosDe(leadIds: readonly number[], funnelId: number): Promise<Set<number>> {
  if (!leadIds.length) return new Set();
  const { data, error } = await (await getTenantDb()).from('pagos').select('lead_id').eq('funnel_id', funnelId).in('lead_id', [...leadIds]);
  if (error) throw new Error('No se pudieron revisar los pagos del lead: ' + error.message);
  return new Set(((data ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id)));
}

/** El error del guard de agregar: quien agrega solo (un pago de «Vincular cobro») lo reconoce y sigue por la casa. */
export class TienePagosDeEseCrmError extends Error {}

export const TIENE_PAGOS_DE_ESE_CRM = (nombre: string) =>
  `Tiene pagos de su venta principal hechos cuando su CRM era «${nombre}»: si lo vuelves a agregar ahí, esa plata pasaría a ese CRM y su saldo cambiaría. Déjalo donde está.`;

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
 *
 * `opts.etapa` (16/10/2026): entra en ESA etapa y no en la de entrada. Lo usa la reserva de un evento
 * de agenda vinculado a una etapa de reunión (lib/agenda-evento-etapa-server.ts): el que reservó la R1
 * de ese producto entra en su R1, no en «Lead entrante». Si la etapa no es de ese embudo, no agrega.
 */
export async function agregarAProducto(leadId: number, funnelId: number, opts?: { autor?: string; etapa?: string }): Promise<{ agregado: boolean; etapa: string | null }> {
  const { productos } = await productosDelLead(leadId);
  if (productos.some((p) => p.funnelId === funnelId)) return { agregado: false, etapa: null };
  const funnels = await listarFunnels();
  if (!funnels.some((f) => f.id === funnelId)) throw new Error('Ese funnel no existe.');
  const etapas = await etapasDeProducto(funnelId);
  if (opts?.etapa != null && !etapas.some((s) => s.key === opts.etapa)) throw new Error('Esa etapa no existe en ese funnel.');
  const etapa = opts?.etapa ?? etapaDeEntrada(etapas);
  if (!etapa) throw new Error('Ese funnel no tiene etapas.');
  if ((await pagosHuerfanosDe([leadId], funnelId)).size) throw new TienePagosDeEseCrmError(TIENE_PAGOS_DE_ESE_CRM(await nombreDeProducto(funnelId)));
  const autor = await autorDelMovimiento(opts?.autor);
  const db = await getTenantDb();
  const { error } = await db.from('lead_funnel').upsert(
    [{ lead_id: leadId, funnel_id: funnelId, etapa, por: autor, etapa_desde: new Date().toISOString() }],
    { onConflict: 'workspace_id,lead_id,funnel_id', ignoreDuplicates: true },
  );
  if (error) throw new Error('No se pudo agregar al funnel: ' + error.message);
  await resincronizarCobrado([leadId], funnelId);
  await logLeadEvent(leadId, 'Funnel', `Agregado a «${await nombreDeProducto(funnelId)}»`, autor);
  return { agregado: true, etapa };
}

/**
 * Las automatizaciones de ESA etapa de ESE CRM, en el acto (23/10/2026, P0 de #289: ver la cabecera). Import dinámico
 * (lib/nutricion.ts importa lib/leads.ts, que importa éste) y nunca tira: la fila ya se escribió, y lo que no entre lo
 * levanta el barrido de la hora.
 */
async function enrolarAgregado(leadId: number, funnelId: number, etapa: string, o?: { enLote?: boolean; persona?: string; informe?: InformeMovimiento }): Promise<void> {
  try {
    const { enrolarPorEvento } = await import('./nutricion');
    // En LOTE, sin la vía rápida: la manda el tick con el tope de la hora (ver `moverEtapaEnProducto`).
    await enrolarPorEvento(leadId, 'etapa', {
      etapa, funnelId, agregado: true, ...(o?.enLote ? { sinViaRapida: true } : {}),
      ...(o?.persona && o.informe ? { persona: o.persona, informe: o.informe } : {}),
    });
  } catch (e) {
    console.error(`[lead-funnel] lead ${leadId}: no pude inscribirlo por llegar a «${etapa}» del CRM ${funnelId}:`, e instanceof Error ? e.message : e);
  }
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
 *     Con `promoverA` (28/10/2026, `pasarAOtroFunnel`), la que pasa a ser la casa es ESA, no la más vieja.
 */
export async function quitarDeProducto(leadId: number, funnelId: number, opts?: { autor?: string; promoverA?: number }): Promise<DeshacerQuitar> {
  const { productos, defaultId, funnelIdDelLead, etapaCasa } = await productosDelLead(leadId);
  const p = productos.find((x) => x.funnelId === funnelId);
  if (!p) throw new Error('No está en ese funnel.');
  if (!puedeQuitar(productos)) throw new Error('Es su único funnel.');
  const promovido = opts?.promoverA != null ? productos.find((x) => x.funnelId === opts.promoverA && !x.esCasa) ?? null : aQuienPromover(productos);
  if (p.esCasa && opts?.promoverA != null && !promovido) throw new Error('No está en el funnel que tomaría su lugar.');
  const autor = await autorDelMovimiento(opts?.autor);
  const db = await getTenantDb();
  const nombre = await nombreDeProducto(funnelId);
  // ⚠️ UN CRM AGREGADO CON PLATA NO SE QUITA (revisión del 22/10/2026, M4, mig 0324): su venta y su plan viven en ESTA
  // fila de `lead_funnel`, y sus pagos llevan su `funnel_id`. Borrarla perdía la venta (el Deshacer recrea la fila vacía) y
  // los pagos caían en la casa, mezclados con los de la venta de siempre (dos «cuota 1»). Lo mismo al quitar la CASA: la
  // fila que se promueve a casa se borra. Se dice por qué y qué hacer; nada se pierde de un clic.
  const conPlata = !p.esCasa ? funnelId : promovido?.funnelId ?? null;
  if (conPlata != null) {
    const { tratoConPlata } = await import('./pagos');
    if (await tratoConPlata(leadId, conPlata)) {
      // Un texto por caso (segunda revisión del 22/10/2026): quitar un CRM agregado, o quitar la casa cuando el CRM que la
      // reemplazaría tiene su propia venta (renovó y se quiere sacar de la venta vieja).
      throw new Error(!p.esCasa
        ? `Tiene una venta o pagos en «${nombre}»: si lo quitas, se quedan sin su CRM. Si ya no sigue ahí, márcalo como perdido en «${nombre}».`
        : `«${nombre}» es su CRM principal, y el que tomaría su lugar («${await nombreDeProducto(conPlata)}») tiene su propia venta o pagos: se mezclarían. Déjalo en «${nombre}» y muévelo de etapa ahí.`);
    }
  }

  if (!p.esCasa) {
    const { error } = await db.from('lead_funnel').delete().eq('lead_id', leadId).eq('funnel_id', funnelId);
    if (error) throw new Error('No se pudo quitar del funnel: ' + error.message);
    await resincronizarCobrado([leadId]);
    await logLeadEvent(leadId, 'Funnel', `Quitado de «${nombre}»`, autor);
    return { leadId, funnelId, fila: { funnel_id: funnelId, etapa: p.etapa ?? '', etapa_desde: p.desde }, casaAntes: null };
  }

  const nueva = promovido;
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
  await resincronizarCobrado([leadId]);
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
  await resincronizarCobrado([d.leadId]);
  await logLeadEvent(d.leadId, 'Funnel', `Vuelve a «${await nombreDeProducto(d.funnelId)}» (se deshizo)`, autor);
}

/**
 * Mueve la tarjeta de un lead AGREGADO dentro de ese producto: escribe la fila y nada más. Si el
 * producto es su casa, no es esta función (el tablero usa el camino de siempre).
 */
// `porPersona`: lo movió una persona (el CRM, con sesión). Sólo así vuelve el informe de las automatizaciones de la etapa
// (en cuáles entró y en cuáles no, con su porqué) y el «no volvió a entrar» queda en el historial (23/10/2026).
export async function moverEtapaEnProducto(leadId: number, funnelId: number, etapa: string, opts?: { autor?: string; enLote?: boolean; porPersona?: boolean }): Promise<{ antes: string; automatizaciones?: InformeMovimiento | null }> {
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
  // Y LAS AUTOMATIZACIONES DE ESA ETAPA DE ESTE CRM, en el acto (23/10/2026, P0 de #289): la tercera excepción. En LOTE
  // (`enLote`, la barra del CRM) se inscribe sin la vía rápida: 200 vías rápidas en fila no entran en los 60 s de la
  // acción, y la vía rápida no mira el tope de la HORA (sólo el cron, `cupoPorHora`): serían 200 en frío de golpe por la
  // línea. Las manda el tick del minuto que viene, con sus topes.
  const informe: InformeMovimiento | null = opts?.porPersona ? { entro: [], noEntro: [] } : null;
  await enrolarAgregado(leadId, funnelId, etapa, { enLote: opts?.enLote, ...(informe ? { persona: autor, informe } : {}) });
  return { antes: fila.etapa, automatizaciones: informe };
}

/**
 * Agrega VARIOS leads a un producto (la acción en lote, «traer» de otro producto, las
 * campañas). Saltea a los que ya están. Devuelve los ids que agregó, para el deshacer.
 *
 * ⚠️ NO LOS SACA DE DONDE ESTÁN: es AGREGAR (una fila de `lead_funnel` en este CRM), nunca mover la casa. Por eso la
 * campaña de email de Mauricio (4/11/2026, `agregar_en_bloque_a_crm` de la API de MaKo) usa ésta y no
 * `pasarLoteAOtroFunnel`, que los saca del origen.
 * `hasta` (4/11/2026): la hora en ms en que deja de empezar tandas. Lo que no llegó vuelve en `pendientes`, para que
 * quien llama lo diga y se pida de nuevo (por HTTP la ruta corta a los 60 s). `yaEstaban`: los que ya eran de este CRM.
 */
export async function agregarLoteAProducto(leadIds: number[], funnelId: number, porQue: string, opts?: { autor?: string; hasta?: number }): Promise<{ agregados: number[]; fallaron: number; pendientes: number[]; yaEstaban: number }> {
  const funnels = await listarFunnels();
  if (!funnels.some((f) => f.id === funnelId)) throw new Error('Ese funnel no existe.');
  const etapa = etapaDeEntrada(await etapasDeProducto(funnelId));
  if (!etapa) throw new Error('Ese funnel no tiene etapas.');
  const defaultId = await idDelFunnelDefault();
  const db = await getTenantDb();
  const autor = await autorDelMovimiento(opts?.autor);
  const ids = [...new Set(leadIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const agregados: number[] = [];
  const pendientes: number[] = [];
  let fallaron = 0, yaEstaban = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    if (opts?.hasta != null && Date.now() > opts.hasta) { pendientes.push(...tanda); continue; }
    // Los que YA están: por casa (funnel_id) o por fila. A ésos no se les escribe nada.
    const { data: casas, error: ec } = await db.from('leads').select('id, funnel_id').in('id', tanda);
    if (ec) { fallaron += tanda.length; continue; }
    const { data: filas, error: ef } = await db.from('lead_funnel').select('lead_id').eq('funnel_id', funnelId).in('lead_id', tanda);
    if (ef) { fallaron += tanda.length; continue; }
    const yaFila = new Set(((filas ?? []) as Array<{ lead_id: number | string }>).map((f) => Number(f.lead_id)));
    const leidas = (casas ?? []) as Array<{ id: number | string; funnel_id: number | string | null }>;
    const candidatos = leidas
      .filter((l) => casaReal(l.funnel_id == null ? null : Number(l.funnel_id), defaultId) !== funnelId && !yaFila.has(Number(l.id)))
      .map((l) => Number(l.id));
    yaEstaban += leidas.length - candidatos.length;
    // Los que tienen pagos de una casa vieja que era ESTE CRM se saltean (cuarta revisión, M1): se cuentan como fallados.
    let huerfanos: Set<number>;
    try { huerfanos = await pagosHuerfanosDe(candidatos, funnelId); } catch { fallaron += candidatos.length; continue; }
    fallaron += huerfanos.size;
    const nuevos = candidatos.filter((id) => !huerfanos.has(id));
    if (!nuevos.length) continue;
    const ahora = new Date().toISOString();
    const { data: ins, error } = await db.from('lead_funnel')
      .upsert(nuevos.map((lead_id) => ({ lead_id, funnel_id: funnelId, etapa, por: autor, etapa_desde: ahora })), { onConflict: 'workspace_id,lead_id,funnel_id', ignoreDuplicates: true })
      .select('lead_id');
    if (error) { fallaron += nuevos.length; continue; }
    const ok = ((ins ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id));
    agregados.push(...ok);
    await resincronizarCobrado(ok, funnelId);
    const audit = ok.map((lead_id) => ({ lead_id, campo: 'Funnel', valor_anterior: null, valor_nuevo: porQue, autor }));
    if (audit.length) {
      const { error: ea } = await db.from('lead_audit').insert(audit);
      if (ea) console.error('[lead-funnel] historial falló:', ea.message);
    }
  }
  return { agregados, fallaron, pendientes, yaEstaban };
}

/** Deshace un `agregarLoteAProducto`: borra SÓLO las filas que ese lote creó. */
export async function quitarLoteDeProducto(leadIds: number[], funnelId: number, porQue: string, opts?: { autor?: string }): Promise<number> {
  const db = await getTenantDb();
  const autor = await autorDelMovimiento(opts?.autor);
  // ⚠️ Los que tienen PLATA en ese CRM no se quitan (segunda revisión del 22/10/2026, M4): su venta vive en esa fila y sus
  // pagos llevan ese CRM. Pasa con el Deshacer de «Agregar», si en esos segundos se registró un pago ahí. Se saltean.
  const { leadsConPlataEn } = await import('./pagos');
  const conPlata = await leadsConPlataEn(funnelId, leadIds);
  if (conPlata.size) console.warn(`[lead-funnel] quitar en lote: ${conPlata.size} lead(s) con venta o pagos en el funnel ${funnelId} no se quitan.`);
  const aQuitar = leadIds.filter((id) => !conPlata.has(Number(id)));
  let n = 0;
  for (let i = 0; i < aQuitar.length; i += 200) {
    const tanda = aQuitar.slice(i, i + 200);
    const { data, error } = await db.from('lead_funnel').delete().eq('funnel_id', funnelId).in('lead_id', tanda).select('lead_id');
    if (error) { console.error('[lead-funnel] quitar en lote falló:', error.message); continue; }
    const ok = ((data ?? []) as Array<{ lead_id: number | string }>).map((r) => Number(r.lead_id));
    n += ok.length;
    if (ok.length) await db.from('lead_audit').insert(ok.map((lead_id) => ({ lead_id, campo: 'Funnel', valor_anterior: null, valor_nuevo: porQue, autor })));
  }
  return n;
}

/** Lo que hace falta para deshacer un `pasarAOtroFunnel`: el «quitar» del origen y si la fila del destino la creó el pase. */
export type DeshacerPasar = { leadId: number; hacia: number; agregado: boolean; quitar: DeshacerQuitar };

/**
 * PASA el lead de un funnel a otro (28/10/2026, tickets #21 y #22 de Leila: «limpiar la casilla de contacto nuevo de
 * lidermente y pasarlo a Funnel general»). Es AGREGAR al destino en `etapa` + QUITAR del origen, por los MISMOS caminos de
 * siempre (no una tercera escritura de la casa): si el origen era su casa, la casa pasa a ser el destino (`promoverA`).
 *
 * ⚠️ NO ES EL «MOVER» QUE SE BORRÓ EL 06/10/2026 (`moverLeadsAFunnelAction`, ver la cabecera). Aquel era el gesto por defecto,
 * callado, y reseteaba a la etapa de entrada a un Ganado con su venta colgando. Éste se pide aparte, con una pregunta que
 * dice cuántos y a qué etapa; la etapa la elige la persona; y quien tiene PLATA en el origen no se pasa (la pantalla lo
 * saca antes y lo dice; acá lo frena el guard de quitar: sus pagos son de ese funnel).
 *
 * Si ya estaba en el destino, se queda en su etapa de ahí: sólo se lo saca del origen. Si sacarlo del origen falla, la fila
 * que se acaba de crear en el destino se borra: nunca queda en los dos sin que nadie lo haya pedido. Tira con el motivo.
 */
export async function pasarAOtroFunnel(leadId: number, desde: number, hacia: number, etapa: string, opts?: { autor?: string }): Promise<{ yaEstaba: boolean; deshacer: DeshacerPasar }> {
  if (desde === hacia) throw new Error('Ya está en ese funnel.');
  const { productos } = await productosDelLead(leadId);
  if (!productos.some((p) => p.funnelId === desde)) throw new Error('No está en ese funnel.');
  const yaEstaba = productos.some((p) => p.funnelId === hacia);
  let agregado = false;
  if (!yaEstaba) agregado = (await agregarAProducto(leadId, hacia, { autor: opts?.autor, etapa })).agregado;
  try {
    const quitar = await quitarDeProducto(leadId, desde, { autor: opts?.autor, promoverA: hacia });
    return { yaEstaba, deshacer: { leadId, hacia, agregado, quitar } };
  } catch (e) {
    if (agregado) {
      const { error } = await (await getTenantDb()).from('lead_funnel').delete().eq('lead_id', leadId).eq('funnel_id', hacia);
      if (error) console.error(`[lead-funnel] lead ${leadId}: no pude sacar la fila del destino tras un pase fallido:`, error.message);
    }
    throw e;
  }
}

/** Deshace un `pasarAOtroFunnel`: devuelve el origen como estaba y, si el pase creó la fila del destino, la saca. */
export async function deshacerPasar(d: DeshacerPasar, opts?: { autor?: string }): Promise<void> {
  await deshacerQuitar(d.quitar, opts);
  if (!d.agregado) return;
  const { error } = await (await getTenantDb()).from('lead_funnel').delete().eq('lead_id', d.leadId).eq('funnel_id', d.hacia);
  if (error) throw new Error('No se pudo deshacer: ' + error.message);
  await resincronizarCobrado([d.leadId]);
}

/**
 * Lo que la pregunta de PASAR necesita saber de los tildados, antes de tocar nada: quiénes ya están en el destino, quiénes
 * agendaron, quiénes tienen plata en el origen, y las etapas del destino. `desde` y `hacia`: ids reales. Tira si no puede
 * leer: preguntar a ciegas es justo lo que esta lectura evita.
 */
export async function previaDePasar(leadIds: readonly number[], desde: number, hacia: number): Promise<PreviaPasar> {
  const ids = [...new Set(leadIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const db = await getTenantDb();
  const defaultId = await idDelFunnelDefault();
  const yaEstan: number[] = [], agendaron: number[] = [], pagaron = new Set<number>();
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    const [{ data: leads, error: el }, { data: filas, error: ef }] = await Promise.all([
      db.from('leads').select('id, funnel_id, estado_lead, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_primer_pago, cerro').in('id', tanda),
      db.from('lead_funnel').select('lead_id').eq('funnel_id', hacia).in('lead_id', tanda),
    ]);
    if (el || ef) throw new Error(`No pude leer a los elegidos: ${(el ?? ef)?.message}`);
    const enDestino = new Set(((filas ?? []) as Array<{ lead_id: number | string }>).map((f) => Number(f.lead_id)));
    for (const l of (leads ?? []) as Array<Record<string, unknown>>) {
      const id = Number(l.id);
      const casa = casaReal(l.funnel_id == null ? null : Number(l.funnel_id), defaultId);
      if (casa === hacia || enDestino.has(id)) yaEstan.push(id);
      if (agendoLead(l)) agendaron.push(id);
      // La venta de la CASA vive en el lead (no en una fila): si el origen es su casa, mira el lead.
      if (casa === desde && (pagoLead(l) || l.estado_lead === 'ganado')) pagaron.add(id);
    }
  }
  const { leadsConPlataEn } = await import('./pagos');
  for (const id of await leadsConPlataEn(desde, ids)) pagaron.add(id);
  const etapas = (await etapasDeProducto(hacia)).map((s) => ({ key: s.key, label: s.label, kind: s.kind ?? null, band: s.band })) as EtapaDestino[];
  return { yaEstan, agendaron, pagaron: [...pagaron], etapas };
}

/**
 * PASA varios leads a otro funnel, de a uno (`pasarAOtroFunnel`) y con corte por tiempo: lo que no llega vuelve en
 * `pendientes`, como mover de etapa (app/crm/lote-tandas.ts). Devuelve con qué deshacer cada uno.
 */
export async function pasarLoteAOtroFunnel(leadIds: readonly number[], desde: number, hacia: number, etapa: string, o: { autor?: string; hasta: number }): Promise<{
  pasados: number[]; yaEstaban: number; fallaron: number; motivos: string[]; pendientes: number[]; deshacer: DeshacerPasar[];
}> {
  const ids = [...new Set(leadIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  if (!(await etapasDeProducto(hacia)).some((s) => s.key === etapa)) throw new Error('Esa etapa no existe en ese funnel.');
  const pasados: number[] = [], pendientes: number[] = [], deshacer: DeshacerPasar[] = [];
  const motivos = new Set<string>();
  let yaEstaban = 0, fallaron = 0;
  for (const id of ids) {
    if (Date.now() > o.hasta) { pendientes.push(id); continue; }
    try {
      const r = await pasarAOtroFunnel(id, desde, hacia, etapa, { autor: o.autor });
      pasados.push(id);
      deshacer.push(r.deshacer);
      if (r.yaEstaba) yaEstaban += 1;
    } catch (e) {
      fallaron += 1;
      motivos.add(e instanceof Error ? e.message : 'no se pudo');
      console.error(`[lote] no se pudo pasar el lead ${id} del funnel ${desde} al ${hacia}:`, e instanceof Error ? e.message : e);
    }
  }
  return { pasados, yaEstaban, fallaron, motivos: [...motivos], pendientes, deshacer };
}

/**
 * Los `ids` que están AGREGADOS al CRM `funnelId` (null = el del negocio): tienen su fila en `lead_funnel` y su casa es
 * otro. Con el id real de ese CRM. Tira si no puede leer: mover a ciegas es justo pisar la casa de alguien. La usan la barra
 * en bloque (`moverLeadsDeEtapaAction`) y la API de MaKo (lib/crm-bloque-server.ts): a un agregado se lo mueve en su FILA.
 */
export async function agregadosDelCrm(ids: readonly number[], funnelId: number | null): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const def = await idDelFunnelDefault();
  const real = funnelId ?? def;
  if (real == null) return out;
  const db = await getTenantDb();
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    const [{ data: filas, error: eF }, { data: casas, error: eC }] = await Promise.all([
      db.from('lead_funnel').select('lead_id').eq('funnel_id', real).in('lead_id', tanda),
      db.from('leads').select('id, funnel_id').in('id', tanda),
    ]);
    if (eF || eC) throw new Error(`No pude leer en que CRM esta cada lead: ${(eF ?? eC)?.message}`);
    const conFila = new Set(((filas ?? []) as Array<{ lead_id: number | string }>).map((f) => Number(f.lead_id)));
    for (const l of (casas ?? []) as Array<{ id: number | string; funnel_id: number | string | null }>) {
      const casa = casaReal(l.funnel_id == null ? null : Number(l.funnel_id), def);
      if (conFila.has(Number(l.id)) && casa !== real) out.set(Number(l.id), real);
    }
  }
  return out;
}
