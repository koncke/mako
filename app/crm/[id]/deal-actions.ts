'use server';

// =============================================================================
// Server actions de la tab Deal Details (+ identidades fiscales del workspace)
// =============================================================================
// - Identidades fiscales ("Facturado por"): CRUD por workspace. Se cargan una
//   sola vez en /configuraciones y se eligen en el Deal Details de cada lead.
// - Secciones del deal (fiscal / servicio / promesa / obligaciones): update
//   PARCIAL del lead — solo pisa las claves presentes en el patch.
// - Cuotas explícitas + marcar pago con hora/comprobante (migración 0060).
// Toda mutación humana deja rastro en lead_audit (patrón de app/crm/actions).

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getTenantDb } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { getLead, logLeadChanges, logLeadEvent, type Lead } from '@/lib/leads';
import { saveLeadPlanManual, marcarPago, getPagosByLead, cobrarCuota, registrarPagoSuelto, asegurarLeadDelNegocio } from '@/lib/pagos';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { VENTA_SIN_COBRO, ventaTipoDe, type VentaTipo } from '@/lib/venta-tipo';

// updateTag en try/catch: la mutación ya ocurrió; si la invalidación fallara,
// la caché igual vence sola por su TTL — nunca debe romper el guardado.
function bust(...tags: string[]) {
  try {
    for (const t of tags) updateTag(t);
  } catch {
    /* no-op: la caché vence por TTL */
  }
}

/** Autor para el historial: email del usuario logueado o 'CRM' (legacy/dev). */
async function autorActual(): Promise<string> {
  try {
    const s = await getUsuarioActual();
    return s?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

function revalidarLead(leadId: number) {
  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm');
}

// ─────────────────────────────────────────────────────────────────────────────
// Identidades fiscales del workspace ("Facturado por")
// ─────────────────────────────────────────────────────────────────────────────

export type IdentidadFiscal = {
  id: number;
  nombre: string;
  id_fiscal: string | null;
  domicilio: string | null;
  correo: string | null;
  es_default: boolean;
  created_at: string;
};

/** Identidades fiscales del workspace (default primero). */
export async function getIdentidadesFiscalesAction(): Promise<IdentidadFiscal[]> {
  const { data, error } = await (await getTenantDb())
    .from('identidades_fiscales')
    .select('id, nombre, id_fiscal, domicilio, correo, es_default, created_at')
    .order('es_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Error listando identidades fiscales: ${error.message}`);
  return (data ?? []) as IdentidadFiscal[];
}

export type IdentidadFiscalInput = {
  id?: number | null;           // con id = editar; sin id = crear
  nombre: string;
  id_fiscal?: string | null;
  domicilio?: string | null;
  correo?: string | null;
  es_default?: boolean;
};

/** Crea o edita una identidad fiscal. Marcar default desmarca el resto. */
export async function saveIdentidadFiscalAction(input: IdentidadFiscalInput): Promise<void> {
  const nombre = input.nombre?.trim();
  if (!nombre) throw new Error('La razón social / nombre es obligatoria.');
  const db = await getTenantDb();
  const row = {
    nombre,
    id_fiscal: input.id_fiscal?.trim() || null,
    domicilio: input.domicilio?.trim() || null,
    correo: input.correo?.trim() || null,
    es_default: !!input.es_default,
  };
  // Un solo default por workspace: al marcar uno se desmarca el anterior.
  if (row.es_default) {
    const { error } = await db.from('identidades_fiscales').update({ es_default: false }).eq('es_default', true);
    if (error) throw new Error(`Error desmarcando el default anterior: ${error.message}`);
  }
  if (input.id) {
    const { error } = await db.from('identidades_fiscales').update(row).eq('id', input.id);
    if (error) throw new Error(`Error actualizando la identidad fiscal: ${error.message}`);
  } else {
    const { error } = await db.from('identidades_fiscales').insert([row]);
    if (error) throw new Error(`Error creando la identidad fiscal: ${error.message}`);
  }
  revalidatePath('/configuraciones');
}

/** Borra una identidad fiscal. Los leads que la referenciaban muestran "—". */
export async function deleteIdentidadFiscalAction(id: number): Promise<void> {
  const { error } = await (await getTenantDb()).from('identidades_fiscales').delete().eq('id', id);
  if (error) throw new Error(`Error borrando la identidad fiscal: ${error.message}`);
  revalidatePath('/configuraciones');
}

// ─────────────────────────────────────────────────────────────────────────────
// Secciones del deal en el lead (update parcial)
// ─────────────────────────────────────────────────────────────────────────────

export type DealSectionsInput = {
  deal_fiscal?: Lead['deal_fiscal'];
  deal_servicio?: Lead['deal_servicio'];
  deal_promesa?: Lead['deal_promesa'];
  deal_obligaciones?: Lead['deal_obligaciones'];
  facturado_por_id?: number | null;
  // Cierre (vive dentro de Pagos): monto, fecha de cierre, inicio de servicio.
  monto_cierre_usd?: number | null;
  fecha_cierre?: string | null;
  fecha_inicio_servicio?: string | null;
  // Una SUSCRIPCIÓN: la mensualidad y el plazo (null = indefinida). Sólo se escriben si el
  // lead ES una suscripción — ver el compare-and-set abajo.
  suscripcion_monto_usd?: number | null;
  suscripcion_meses?: number | null;
};

/**
 * ⚠️ EL DOCUMENTO FISCAL (doc_path / doc_nombre) LO ESCRIBE SÓLO SU SUBIDA, /api/extract-deal-fiscal, con una ruta
 * que arma el server (`<ws>/<lead>/fiscal/<ms>_<nombre>`). Hasta el 14/10/2026 esta acción guardaba deal_fiscal
 * ENTERO como lo mandaba el navegador: con un doc_path armado a mano en un lead propio, /api/doc firmaba con la
 * service role el archivo de otro negocio (auditoría de seguridad). Y de yapa: la pantalla manda el doc_path de
 * SU foto del lead (`{ ...(lead.deal_fiscal ?? {}), … }`), así que con una foto vieja guardar los datos fiscales
 * borraba el documento recién subido. El del patch se descarta y gana SIEMPRE el de la base. Lo demás de la
 * sección se guarda como llega (reemplazo, igual que antes).
 * No es una server action (no se exporta): la usa saveDealSectionsAction. tests/seguridad-crm-pagos-doc.test.ts la
 * prueba por la acción (con una base de mentira) y recortada de este archivo.
 */
function fiscalConDocDeLaBase(nuevo: Lead['deal_fiscal'], enBase: Lead['deal_fiscal']): Lead['deal_fiscal'] {
  if (nuevo != null && (typeof nuevo !== 'object' || Array.isArray(nuevo))) throw new Error('Datos fiscales inválidos.');
  const doc = enBase?.doc_path || enBase?.doc_nombre
    ? { doc_path: enBase.doc_path ?? null, doc_nombre: enBase.doc_nombre ?? null }
    : null;
  // Vaciar la sección no borra el documento: se reemplaza subiendo otro, no desde acá.
  if (nuevo == null) return doc ?? nuevo;
  const { doc_path: _p, doc_nombre: _n, ...resto } = nuevo;
  void _p; void _n;
  return doc ? { ...resto, ...doc } : resto;
}

/**
 * Guarda las secciones del deal que vengan en el patch (las ausentes no se
 * tocan). Deja el evento en lead_audit y revalida las vistas del lead.
 *
 * ⚠️ LA PLATA DEJA SU VALOR EN EL HISTORIAL, no sólo «Guardó: monto». Hasta el 08/10/2026
 * esta era la única pantalla que no podía corregir una suscripción (mostraba «USD X/mes»
 * pero no tenía el campo), y cuando corregía el monto de cierre el historial decía qué se
 * tocó y no de cuánto a cuánto. Ahora, si el patch trae plata, se diffea el lead antes y
 * después con `logLeadChanges` (AUDIT_FIELDS: «Monto de cierre», «Suscripción (USD/mes)»,
 * «Plazo de la suscripción»), y esas líneas se pueden revertir desde la ficha.
 */
export async function saveDealSectionsAction(leadId: number, patch: DealSectionsInput): Promise<void> {
  const upd: Record<string, unknown> = {};
  const tocadas: string[] = [];
  const db = await getTenantDb();
  // ⚠️ EL LEAD SE LEE PRIMERO (auditoría de seguridad del 14/10/2026), por dos cosas:
  // 1) Que sea de ESTE negocio: el update de abajo, con un lead ajeno, da 0 filas sin error, y el historial igual
  //    anotaba «Guardó: …» sobre el id de otro.
  // 2) El documento fiscal lo pone la base, no el navegador (ver `fiscalConDocDeLaBase`).
  const { data: enBase, error: eBase } = await db.from('leads').select('deal_fiscal').eq('id', leadId).maybeSingle();
  if (eBase) throw new Error(`No pude leer el lead ${leadId}: ${eBase.message}`);
  if (!enBase) throw new Error('No encontré este lead.');
  const fiscalEnBase = (enBase as { deal_fiscal: Lead['deal_fiscal'] }).deal_fiscal;
  const sus: Record<string, number | null> = {};
  if (patch.suscripcion_monto_usd !== undefined) sus.suscripcion_monto_usd = patch.suscripcion_monto_usd;
  if (patch.suscripcion_meses !== undefined) sus.suscripcion_meses = patch.suscripcion_meses;
  const tocaPlata = patch.monto_cierre_usd !== undefined || Object.keys(sus).length > 0;
  // El «antes» del diff: sin poder leerlo se guarda igual y queda sólo el evento de abajo.
  const before = tocaPlata ? await getLead(leadId).catch(() => null) : null;
  if (patch.deal_fiscal !== undefined) { upd.deal_fiscal = fiscalConDocDeLaBase(patch.deal_fiscal, fiscalEnBase); tocadas.push('datos fiscales'); }
  if (patch.deal_servicio !== undefined) { upd.deal_servicio = patch.deal_servicio; tocadas.push('servicio'); }
  if (patch.deal_promesa !== undefined) { upd.deal_promesa = patch.deal_promesa; tocadas.push('promesa'); }
  if (patch.deal_obligaciones !== undefined) { upd.deal_obligaciones = patch.deal_obligaciones; tocadas.push('obligaciones'); }
  if (patch.facturado_por_id !== undefined) { upd.facturado_por_id = patch.facturado_por_id; tocadas.push('facturado por'); }
  if (patch.monto_cierre_usd !== undefined) { upd.monto_cierre_usd = patch.monto_cierre_usd; tocadas.push('monto de cierre'); }
  if (patch.fecha_cierre !== undefined) { upd.fecha_cierre = patch.fecha_cierre; tocadas.push('fecha de cierre'); }
  if (patch.fecha_inicio_servicio !== undefined) { upd.fecha_inicio_servicio = patch.fecha_inicio_servicio; tocadas.push('inicio de servicio'); }

  if (Object.keys(upd).length) {
    const { error } = await db.from('leads').update(upd).eq('id', leadId);
    if (error) throw new Error(`Error guardando el deal del lead ${leadId}: ${error.message}`);
  }
  // ⚠️ COMPARE-AND-SET sobre el tipo: la mensualidad sólo se escribe si el lead SIGUE siendo
  // una suscripción. Una pantalla vieja (abierta antes de que alguien lo pasara a pago único
  // en el wizard) no puede volver a colgarle una mensualidad que el server ya limpió.
  if (Object.keys(sus).length) {
    const { data, error } = await db.from('leads').update(sus).eq('id', leadId).eq('venta_tipo', 'suscripcion').select('id');
    if (error) throw new Error(`Error guardando la suscripción del lead ${leadId}: ${error.message}`);
    if (data?.length) {
      if ('suscripcion_monto_usd' in sus) tocadas.push('mensualidad');
      if ('suscripcion_meses' in sus) tocadas.push('plazo');
    }
  }
  if (!tocadas.length) return;

  const autor = await autorActual();
  if (before) await logLeadChanges(leadId, before, await getLead(leadId).catch(() => null), autor);
  await logLeadEvent(leadId, 'Deal details', `Guardó: ${tocadas.join(', ')}`, autor);
  bust(TAG.leads);
  revalidarLead(leadId);
}

/**
 * Saca a un lead de «Sin cobro» (#747): vuelve a pago único, y el CRM le vuelve a pedir
 * el monto en «Datos sin marcar».
 *
 * ⚠️ ES LA ÚNICA SALIDA de un becado marcado por error. El wizard ofrece el tipo de venta
 * sólo cuando falta el monto, y a un «sin cobro» nunca le falta: sin esto, una casilla
 * tildada de más en el alta de Customer Success no se podía deshacer desde ninguna
 * pantalla. Compare-and-set sobre el tipo: un segundo clic no escribe ni deja otra línea
 * en el historial.
 *
 * ⚠️ DEVUELVE EL TIPO QUE QUEDÓ, y si escribió (07/10/2026). La tarjeta del Deal se monta en
 * tres lugares y en DOS el lead es estado de cliente leído por una action (la ficha en
 * modal, `LeadSheet`, y la pestaña Pagos de Customer Success): ahí `router.refresh()` no lo
 * alcanza. Sin el retorno, después de un clic que SÍ escribió la tarjeta seguía diciendo
 * «Sin cobro»; el segundo clic chocaba con el compare-and-set (0 filas, sin error) y el
 * botón parecía muerto. Y peor: «Completar datos» en esa ficha armaba el wizard con el
 * `sin_cobro` viejo y, al guardar, lo volvía a escribir — deshacía el quitar en silencio.
 * Con el tipo devuelto, la tarjeta se pinta con la verdad y el contenedor lo aplica.
 *
 * Si no escribió (0 filas), se LEE el tipo actual en vez de suponerlo: «ya no era sin cobro»
 * puede ser otro tipo cualquiera, que alguien cambió desde otra pantalla.
 */
export async function quitarSinCobroAction(leadId: number): Promise<{ cambio: boolean; ventaTipo: VentaTipo | null }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads')
    .update({ venta_tipo: 'unico' }).eq('id', leadId).eq('venta_tipo', VENTA_SIN_COBRO).select('id');
  if (error) throw new Error(`No se pudo cambiar el tipo de venta: ${error.message}`);
  if (data?.length) {
    await logLeadEvent(leadId, 'Tipo de venta', 'Con cobro', await autorActual());
    bust(TAG.leads);
    revalidarLead(leadId);
    revalidatePath('/customer-success');
    return { cambio: true, ventaTipo: 'unico' };
  }
  const { data: fila, error: errLeer } = await db.from('leads').select('venta_tipo').eq('id', leadId).maybeSingle();
  if (errLeer) throw new Error(`No se pudo leer el tipo de venta: ${errLeer.message}`);
  if (!fila) throw new Error('No encontré este lead.');
  return { cambio: false, ventaTipo: ventaTipoDe((fila as { venta_tipo: string | null }).venta_tipo) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cuotas explícitas + pagos
// ─────────────────────────────────────────────────────────────────────────────

export type CuotaInput = {
  /** id en `pagos`. null = cuota NUEVA: todavía sólo existe en el borrador. */
  id?: number | null;
  monto: number;
  fecha: string | null;
  pagado?: boolean;
  /** YYYY-MM-DD del cobro. Sólo lo usan las cuotas nuevas que nacen cobradas. */
  fecha_pago?: string | null;
};

/**
 * Reemplaza las cuotas NO pagadas del lead por la lista nueva (cuotas
 * explícitas: cada una con su monto y su fecha). Las pagadas que YA están en la
 * base se descartan acá porque saveLeadPlanManual las CONSERVA intactas.
 *
 * ⚠️ Una cuota pagada SIN id es otra cosa: nace cobrada desde "Registrar
 * mensualidad cobrada" (#697) y no hay nada que conservar, así que la inserta
 * esta función. Con el filtro de `!c.pagado` solo, ese cobro se perdía entero:
 * sin error, sin fila y con el botón diciendo que se había guardado.
 */
export async function saveCuotasAction(leadId: number, cuotas: CuotaInput[]): Promise<void> {
  // ⚠️ ANTES del insert de las cobradas (auditoría del 14/10/2026): ese insert vive acá y no en lib/pagos.ts, así
  // que la guarda de saveLeadPlanManual llega tarde. El leadId lo manda el navegador: con el de un lead de otro
  // negocio, la cuota cobrada entraba en este cash apuntando a una persona ajena.
  await asegurarLeadDelNegocio(leadId);
  const nuevas = cuotas.filter((c) => !c.pagado && Number(c.monto) > 0);
  const cobradas = cuotas.filter((c) => c.pagado && c.id == null && Number(c.monto) > 0);
  const autor = await autorActual();

  if (cobradas.length > 0) {
    // Se insertan ANTES de saveLeadPlanManual, por dos razones:
    // 1) `pagos` tiene un índice único (lead_id, numero), así que hay que numerar
    //    sobre TODAS las filas que existen ahora, no sólo sobre las pagadas.
    //    Después saveLeadPlanManual ve estas filas como pagadas, las conserva y
    //    numera las no pagadas a continuación.
    // 2) Si el reemplazo de las no pagadas fallara, el cobro ya quedó asentado,
    //    que es el dato que nadie puede volver a averiguar.
    const db = await getTenantDb();
    const existentes = await getPagosByLead(leadId);
    const base = existentes.length > 0 ? Math.max(...existentes.map((q) => q.numero)) : 0;
    const hoy = new Date().toISOString().slice(0, 10);
    const rows = cobradas.map((c, i) => ({
      lead_id: leadId,
      numero: base + 1 + i,
      monto_usd: Number(c.monto),
      fecha_esperada: c.fecha ?? hoy,
      pagado: true,
      fecha_pago: c.fecha_pago || c.fecha || hoy,
    }));
    const { error } = await db.from('pagos').insert(rows);
    if (error) throw new Error(`Error registrando el cobro del lead ${leadId}: ${error.message}`);
  }

  await saveLeadPlanManual(leadId, {
    total_usd: null,
    duracion_meses: null,
    fecha_cierre: null,
    fecha_inicio: null,
    cuotas: nuevas.map((c) => ({ monto_usd: Number(c.monto), fecha_esperada: c.fecha })),
  });

  // El cobro deja su propia fila en el historial: es un hecho distinto del plan
  // de cuotas, y es el único rastro de que la plata entró por este botón.
  if (cobradas.length > 0) {
    const monto = cobradas.reduce((s, c) => s + Number(c.monto), 0);
    const cuantas = cobradas.length === 1 ? 'Mensualidad cobrada' : `${cobradas.length} mensualidades cobradas`;
    await logLeadEvent(leadId, 'Pago registrado', `${cuantas} por USD ${monto}`, autor);
  }
  await logLeadEvent(leadId, 'Plan de pagos', `Cuotas actualizadas desde Deal Details (${nuevas.length} sin pagar)`, autor);
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/dashboard');
  revalidatePath('/general');
}

export type PagoManualInput = {
  monto?: number | null;   // si difiere del de la cuota, se actualiza
  fecha: string;           // YYYY-MM-DD (obligatoria)
  hora?: string | null;    // HH:MM
  /**
   * Si se cobró MENOS que la cuota, qué pasa con la diferencia (pedido de Mauricio del 13/10/2026: «yo no pude
   * ponerle el tema cuando es un pago diferente»). 'pendiente' (default) = queda como una cuota nueva con el mismo
   * vencimiento; 'descuento' = no se cobra. Sin esto, la diferencia DESAPARECÍA: la cuota quedaba pagada por menos
   * y el Outstanding bajaba como si el cliente ya no debiera nada.
   */
  resto?: 'pendiente' | 'descuento';
};

/**
 * Marca una cuota como pagada con fecha + hora (y monto real si difiere).
 * Se usa tanto desde el registro manual como al confirmar lo extraído del
 * comprobante por IA. marcarPago sincroniza total_cobrado del lead.
 *
 * ⚠️ UN PAGO DE MENOS DEJA LA DIFERENCIA PENDIENTE (salvo `resto: 'descuento'`). La diferencia es una fila NUEVA
 * de `pagos` (numerada después de la última: el índice único es (lead_id, numero)), con el vencimiento de la cuota
 * original: el cliente la debe desde ese día. Devuelve cuánto quedó pendiente, para que la pantalla lo diga.
 */
export async function marcarPagoManualAction(pagoId: number, leadId: number, datos: PagoManualInput): Promise<{ pendiente: number | null }> {
  // La regla y la escritura viven en lib/pagos.ts (`cobrarCuota`): la usa también la API de MaKo.
  const r = await cobrarCuota(pagoId, leadId, datos);
  const resto = r.pendiente != null
    ? ` · quedan USD ${r.pendiente} pendientes`
    : r.descuento > 0 ? ` · USD ${r.descuento} de descuento` : '';
  const nota = `Cuota cobrada el ${fmtDDMMYYYY(datos.fecha)}${datos.hora ? ` · ${datos.hora}` : ''}${r.monto != null && r.monto !== r.original ? ` · USD ${r.monto} (era de USD ${r.original})` : ''}${resto}`;
  await logLeadEvent(leadId, 'Pago registrado', nota, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/dashboard');
  revalidatePath('/general');
  return { pendiente: r.pendiente };
}

/**
 * Un pago FUERA DEL PLAN (pedido de Mauricio del 13/10/2026, y Martín: «terminar de configurar la pestaña de pagos
 * en el CRM para que esté bien fácil de manejar»): un adelanto, un extra, un pago que no calza con ninguna cuota.
 * Entra como una cuota nueva ya cobrada, numerada después de la última, y pasa por `marcarPago` — el mismo camino
 * que cualquier cobro: sincroniza lo cobrado del lead y corta los recordatorios. No toca el monto de cierre: si fue
 * una venta nueva, el cierre se corrige en el deal.
 */
export async function registrarPagoSueltoAction(leadId: number, datos: { monto: number; fecha: string; hora?: string | null }): Promise<void> {
  const r = await registrarPagoSuelto(leadId, datos);
  await logLeadEvent(leadId, 'Pago registrado', `Pago fuera del plan por USD ${r.monto} el ${fmtDDMMYYYY(datos.fecha)}${datos.hora ? ` · ${datos.hora}` : ''}`, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/dashboard');
  revalidatePath('/general');
}
