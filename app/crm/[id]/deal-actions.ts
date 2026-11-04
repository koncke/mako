'use server';

// =============================================================================
// Server actions de la tab Deal Details (+ identidades fiscales del workspace)
// =============================================================================
// - Identidades fiscales ("Facturado por"): CRUD por workspace. Se cargan una
//   sola vez en /configuraciones y se eligen en el Deal Details de cada lead.
// - Las secciones del deal y las cuotas del borrador de «Editar deal» se fueron el 17/10/2026 con esa pantalla:
//   cada dato se escribe desde su bloque de la tab Pagos (app/crm/[id]/pagos-campo-actions.ts).
// - Marcar pago con hora/comprobante (migración 0060), el pago suelto y quitar «Sin cobro».
// Toda mutación humana deja rastro en lead_audit (patrón de app/crm/actions).

import { revalidatePath, updateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getRolWsEfectivo, getTenantDb } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { logLeadEvent } from '@/lib/leads';
import {
  cobrarCuota, crmDelTrato, registrarPagoSuelto, type DatosDeMoneda,
} from '@/lib/pagos';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { VENTA_SIN_COBRO, ventaTipoDe, type VentaTipo } from '@/lib/venta-tipo';
import { formatoMonto } from '@/lib/pasarela-moneda';
import type { Pasarela } from '@/lib/cobros-tipos';
import { ROTULO_METODO, etiquetaDePago } from '@/lib/pagos-campo';

/**
 * ⚠️ SIN SESIÓN NO SE ESCRIBE NADA (14/10/2026). Ninguna de estas acciones lo miraba, y sin cookie
 * `getWorkspaceActual()` cae al ws1 (Mauricio, un cliente): un POST con el id de la acción escribía cuotas y
 * pagos en su CRM. El corte de fondo es el proxy (una página pública sólo se lee); éste es el segundo, para no
 * depender de la ruta (tests/acciones-sin-sesion.test.ts).
 */
async function haySesion(): Promise<boolean> {
  try { return Boolean(await getUsuarioActual()); } catch { return false; }
}
const SIN_SESION = 'Tu sesión no está activa en este negocio. Recarga la página.';
/**
 * Las identidades fiscales son CONFIGURACIÓN DEL NEGOCIO (la razón social con la que factura): sólo el admin las
 * crea, cambia o borra (17/10/2026). La pantalla ya era sólo del admin (`requireRolWs([])` en /configuraciones/fiscal),
 * pero una server action es una puerta propia: un closer la podía llamar y borrar la razón social. Leerlas, sí,
 * cualquiera con sesión (el deal las muestra). Mismo molde que la moneda del negocio (pagos-campo-actions.ts).
 */
const SOLO_ADMIN_FISCAL = 'Sólo el administrador de este negocio puede cambiar sus datos fiscales.';
async function esAdminDelNegocio(): Promise<boolean> {
  try { return (await getRolWsEfectivo()) === 'admin'; } catch { return false; }
}

/** «USD 500» o, si se cobró en otra moneda, «MXN 8,600 (USD 500)», con el método y el concepto si vinieron. */
function textoDelPago(montoUsd: number, d: DatosDeMoneda & { moneda?: string | null; montoOriginal?: number | null }): string {
  const enOtra = d.moneda && d.moneda !== 'USD' && d.montoOriginal != null;
  const plata = enOtra ? `${formatoMonto(d.montoOriginal as number, d.moneda as string)} (USD ${montoUsd})` : `USD ${montoUsd}`;
  const e = etiquetaDePago(d);
  return [plata, e.metodo ? ROTULO_METODO[e.metodo] : null, e.concepto].filter(Boolean).join(' · ');
}

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
  if (!(await haySesion())) return [];
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
  if (!(await haySesion())) throw new Error(SIN_SESION);
  if (!(await esAdminDelNegocio())) throw new Error(SOLO_ADMIN_FISCAL);
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
  if (!(await haySesion())) throw new Error(SIN_SESION);
  if (!(await esAdminDelNegocio())) throw new Error(SOLO_ADMIN_FISCAL);
  const { error } = await (await getTenantDb()).from('identidades_fiscales').delete().eq('id', id);
  if (error) throw new Error(`Error borrando la identidad fiscal: ${error.message}`);
  revalidatePath('/configuraciones');
}

// ⛔ ACÁ VIVÍAN `saveDealSectionsAction` y `saveCuotasAction`, BORRADAS EL 17/10/2026 con su única pantalla
// (EditarDeal / DealDetailsCard, la tab Pagos vieja). Cada dato del deal y cada cuota se escriben desde su
// bloque de la tab Pagos (app/crm/[id]/pagos-campo-actions.ts, ficha/pagos/cuotas-actions.ts).

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
  if (!(await haySesion())) throw new Error(SIN_SESION);
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
// Pagos
// ─────────────────────────────────────────────────────────────────────────────

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
} & DatosDeMoneda;

/**
 * Marca una cuota como pagada con fecha + hora (y monto real si difiere).
 * Se usa tanto desde el registro manual como al confirmar lo extraído del
 * comprobante por IA. marcarPago sincroniza total_cobrado del lead.
 *
 * ⚠️ UN PAGO DE MENOS DEJA LA DIFERENCIA PENDIENTE (salvo `resto: 'descuento'`). La diferencia es una fila NUEVA
 * de `pagos` (numerada después de la última: el índice único es (lead_id, numero)), con el vencimiento de la cuota
 * original: el cliente la debe desde ese día. Devuelve cuánto quedó pendiente, para que la pantalla lo diga.
 *
 * La MONEDA (decisión 7, 14/10/2026): con `moneda` (y `montoOriginal` si no es USD) la cuota guarda en qué se
 * cobró, como lo de la pasarela (mig 0255). `monto` sigue siendo DÓLARES (lo que suman el Dashboard y la cobranza)
 * y sin `moneda` es USD: es lo que manda la pantalla de hoy. El valor inicial del selector es la moneda del negocio
 * (`monedaDelNegocioAction`, app/crm/[id]/pagos-campo-actions.ts), no una suposición del server.
 */
export async function marcarPagoManualAction(pagoId: number, leadId: number, datos: PagoManualInput): Promise<{ pendiente: number | null; pendienteEnSuMoneda: { moneda: string; monto: number } | null; porLink: Pasarela | null; yaEstaba: boolean }> {
  if (!(await haySesion())) throw new Error(SIN_SESION);
  // La regla y la escritura viven en lib/pagos.ts (`cobrarCuota`): la usa también la API de MaKo.
  const r = await cobrarCuota(pagoId, leadId, datos);
  // Ya estaba cobrada (otra pestaña, otra persona): no se tocó nada, ni el historial.
  if (r.yaEstaba) return { pendiente: null, pendienteEnSuMoneda: null, porLink: null, yaEstaba: true };
  // El link de la cuota ya se había cobrado: quedó cobrada con ESE pago, y el historial ya lo dice la pasarela.
  if (r.porLink) {
    bust(TAG.pagos, TAG.leads);
    revalidarLead(leadId);
    revalidatePath('/dashboard');
    revalidatePath('/general');
    return { pendiente: null, pendienteEnSuMoneda: null, porLink: r.porLink, yaEstaba: false };
  }
  // La diferencia en la moneda de la cuota (mig 0347), como quedó (revisión de 7f79a4e6c, B13).
  const enSuMoneda = r.pendienteEnSuMoneda ? `${formatoMonto(r.pendienteEnSuMoneda.monto, r.pendienteEnSuMoneda.moneda)} (USD ${r.pendiente})` : `USD ${r.pendiente}`;
  const resto = r.pendiente != null
    ? ` · quedan ${enSuMoneda} pendientes`
    : r.descuento > 0 ? ` · USD ${r.descuento} de descuento` : '';
  // En otra moneda, o con método o concepto, la línea dice cómo se cobró: «MXN 8,600 (USD 500) · Transferencia».
  const e = etiquetaDePago(datos);
  const otraMoneda = !!r.moneda && r.moneda !== 'USD' && r.montoOriginal != null;
  const como = otraMoneda || e.metodo || e.concepto ? ` · ${textoDelPago(r.monto ?? r.original, { ...datos, moneda: r.moneda, montoOriginal: r.montoOriginal })}` : '';
  const nota = `Cuota cobrada el ${fmtDDMMYYYY(datos.fecha)}${datos.hora ? ` · ${datos.hora}` : ''}${r.monto != null && r.monto !== r.original ? ` · USD ${r.monto} (era de USD ${r.original})` : ''}${resto}${como}`;
  await logLeadEvent(leadId, 'Pago registrado', nota, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/dashboard');
  revalidatePath('/general');
  return { pendiente: r.pendiente, pendienteEnSuMoneda: r.pendienteEnSuMoneda, porLink: null, yaEstaba: false };
}

/**
 * Un pago FUERA DEL PLAN (pedido de Mauricio del 13/10/2026, y Martín: «terminar de configurar la pestaña de pagos
 * en el CRM para que esté bien fácil de manejar»): un adelanto, un extra, un pago que no calza con ninguna cuota.
 * Entra como una cuota nueva ya cobrada, numerada después de la última, y pasa por `marcarPago` — el mismo camino
 * que cualquier cobro: sincroniza lo cobrado del lead y corta los recordatorios. No toca el monto de cierre: si fue
 * una venta nueva, el cierre se corrige en el deal.
 *
 * La moneda, el concepto y el método (14/10/2026): como en `marcarPagoManualAction`, `monto` es DÓLARES y sin
 * `moneda` todo es como siempre.
 */
export async function registrarPagoSueltoAction(leadId: number, datos: { monto: number; fecha: string; hora?: string | null; mensualidad?: boolean; crm?: number | null } & DatosDeMoneda): Promise<void> {
  if (!(await haySesion())) throw new Error(SIN_SESION);
  // `crm`: el pago es de un CRM agregado (la tab Pagos mirando una renovación, mig 0324); validado contra el lead.
  const r = await registrarPagoSuelto(leadId, { ...datos, crm: await crmDelTrato(leadId, datos.crm) });
  await logLeadEvent(leadId, 'Pago registrado', `Pago fuera del plan por ${textoDelPago(r.monto, { ...datos, moneda: r.moneda, montoOriginal: r.montoOriginal })} el ${fmtDDMMYYYY(datos.fecha)}${datos.hora ? ` · ${datos.hora}` : ''}`, await autorActual());
  bust(TAG.pagos, TAG.leads);
  revalidarLead(leadId);
  revalidatePath('/dashboard');
  revalidatePath('/general');
}
