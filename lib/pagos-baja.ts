// =============================================================================
// pagos-baja — «Baja del cliente»: lo que no pagó deja de ser deuda, y lo cobrado queda (#871, 17/10/2026)
// =============================================================================
// La llamada «Mau <> Martin» del 16/10 (28:34): Francisco Javier Hernández pagó unos US$4.000 de US$6.000 y dejó el
// servicio. La ficha sólo ofrecía «Marcar pagada» o «Quitar»: quitar borraba lo que se le vendió, y dejarlo marcaba
// para siempre US$1.800 vencidos (80 días) en el Outstanding, en «A quién cobrarle» y en la cobranza por WhatsApp.
// Martín: «agregar una opción de el cliente se dio de baja». Mauricio: «para traer la visibilidad».
//
// Cómo queda una cuota de baja (mig 0307): IMPAGA, con `baja_at`, y SIN vencimiento (el que tenía va a `baja_vencia`).
// Sin fecha, toda lectura que decide «vencida» por la fecha (la cobranza, Customer Success, las condiciones de
// Automations, el calendario, las métricas) la deja afuera sin saber que esto existe; las que suman lo impago sin
// fecha ya excluían las devueltas, y ahora usan `noEsDeuda` (lib/cobrado-lead.ts), que excluye las dos.
//
// ⚠️ Lo escribe SÓLO este módulo: la tab Pagos (pagos/cuotas-actions.ts) y la API de MaKo (`baja_del_cliente`).
// ⚠️ Una SUSCRIPCIÓN no se da de baja acá: se cancela (la manual, o la de la pasarela, que deja de cobrar la tarjeta).
//    Darle de baja las cuotas a una suscripción que la pasarela sigue cobrando sería decir «se fue» mientras paga.
// =============================================================================

import 'server-only';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { asegurarLeadDelNegocio, getPagosByLead, proteccionesDeCuotas, type Pago } from './pagos';
import { esCuotaDeBaja, noEsDeuda } from './cobrado-lead';
import { getLead, logLeadEvent } from './leads';
import { nombreCuota } from './pagos-campo';
import { anularLinksDeCuota } from './cobros';
import { centavos } from './pagos-diferencia';

export type ResultadoBaja = { ok: true; cuotas: number; usd: number; resumen: string } | { ok: false; error: string };

const usd = (n: number): string => `US$ ${centavos(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
/** «cuota 3 y cuota 4» · «el inicial, cuota 1 y cuota 2». */
function cuales(qs: readonly Pick<Pago, 'numero'>[]): string {
  const n = qs.map((q) => nombreCuota(q.numero).toLowerCase());
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

/** Las cuotas que se darían de baja hoy: impagas, que todavía son deuda. La pantalla y la API preguntan con ésta. */
export const cuotasParaBaja = (pagos: readonly Pago[]): Pago[] => pagos.filter((q) => !q.pagado && !noEsDeuda(q));

/**
 * Da de baja al cliente: cada cuota impaga queda «de baja» (sin vencimiento, con el que tenía guardado), se anulan sus
 * links sin pagar (un link de alguien que se fue no se tiene que poder pagar a escondidas del CRM) y se cortan sus
 * recordatorios de cobro. Lo cobrado no se toca.
 */
export async function darDeBajaCliente(leadId: number, autor: string): Promise<ResultadoBaja> {
  await asegurarLeadDelNegocio(leadId);
  const lead = await getLead(leadId);
  if (!lead) return { ok: false, error: 'No encontré ese lead en este negocio.' };
  if (lead.venta_tipo === 'suscripcion') return { ok: false, error: 'Una suscripción no se da de baja: se cancela.' };
  const objetivo = cuotasParaBaja(await getPagosByLead(leadId));
  if (!objetivo.length) return { ok: false, error: 'No le queda nada por cobrar: no hay cuotas para dar de baja.' };

  const ws = await getWorkspaceActual();
  // Los links PRIMERO: si anularlos falla, la cuota todavía es deuda y nada quedó a medias. Una cuota a la que le
  // sigue quedando un link vivo no se da de baja (se dice), porque el cliente todavía la puede pagar por ahí.
  // `anularLinksDeCuota` no tira por un link que no pudo anular: se relee, fail-closed (`proteccionesDeCuotas` tira
  // si no puede leer, y entonces no se da de baja nada).
  if (ws != null) {
    for (const q of objetivo) {
      try { await anularLinksDeCuota(ws, q.id, autor); } catch (e) { console.warn(`[pagos-baja] links de la cuota ${q.id}:`, e instanceof Error ? e.message : String(e)); }
    }
  }
  const prot = await proteccionesDeCuotas(leadId, objetivo.map((q) => q.id));
  const conLink = new Set(objetivo.filter((q) => prot.get(q.id)?.includes('link')).map((q) => q.id));
  const db = await getTenantDb();
  const ahora = new Date().toISOString();
  const hechas: Pago[] = [];
  for (const q of objetivo) {
    if (conLink.has(q.id)) continue;
    // Compare-and-set: una que se cobró o se dio de baja en el medio no se toca.
    const { data, error } = await db.from('pagos')
      .update({ baja_at: ahora, baja_vencia: q.fecha_esperada, fecha_esperada: null })
      .eq('id', q.id).eq('lead_id', leadId).eq('pagado', false).is('baja_at', null)
      .select('id');
    if (error) throw new Error(`No pude dar de baja ${nombreCuota(q.numero).toLowerCase()}: ${error.message}`);
    if (data?.length) hechas.push(q);
  }
  // Los recordatorios que ya estaban corriendo se cortan; los nuevos no entran (la cuota no tiene vencimiento).
  if (ws != null && hechas.length) {
    const { cerrarCorridasDeCuota } = await import('./flujo-corridas');
    for (const q of hechas) await cerrarCorridasDeCuota(ws, q.id);
  }
  if (!hechas.length) {
    return { ok: false, error: conLink.size ? 'No pude anular los links de pago de esas cuotas: anúlalos en Links de pago y vuelve a probar.' : 'Esas cuotas cambiaron mientras tanto. Recarga la ficha.' };
  }
  const total = centavos(hechas.reduce((s, q) => s + Number(q.monto_usd), 0));
  const faltaron = objetivo.length - hechas.length;
  await logLeadEvent(leadId, 'Baja del cliente', `Se dio de baja. Quedó sin cobrar ${usd(total)} (${cuales(hechas)}): no es deuda y no se le recuerda. Lo cobrado queda.${faltaron ? ` ${faltaron} cuota(s) no se dieron de baja porque tenían un link que no se pudo anular.` : ''}`, autor);
  return { ok: true, cuotas: hechas.length, usd: total, resumen: `Se dio de baja: ${usd(total)} sin cobrar dejan de ser deuda.${faltaron ? ` ${faltaron} cuota(s) siguen: tienen un link sin anular.` : ''}` };
}

/** Deshace la baja: cada cuota vuelve a ser deuda con su vencimiento. Los links anulados no vuelven (se crea otro). */
export async function deshacerBajaCliente(leadId: number, autor: string): Promise<ResultadoBaja> {
  await asegurarLeadDelNegocio(leadId);
  const deBaja = (await getPagosByLead(leadId)).filter(esCuotaDeBaja);
  if (!deBaja.length) return { ok: false, error: 'Este cliente no está dado de baja.' };
  const db = await getTenantDb();
  const vueltas: Pago[] = [];
  for (const q of deBaja) {
    const { data, error } = await db.from('pagos')
      .update({ baja_at: null, baja_vencia: null, fecha_esperada: q.baja_vencia ?? null })
      .eq('id', q.id).eq('lead_id', leadId).eq('pagado', false).not('baja_at', 'is', null)
      .select('id');
    if (error) throw new Error(`No pude deshacer la baja de ${nombreCuota(q.numero).toLowerCase()}: ${error.message}`);
    if (data?.length) vueltas.push(q);
  }
  if (!vueltas.length) return { ok: false, error: 'Esas cuotas cambiaron mientras tanto. Recarga la ficha.' };
  const total = centavos(vueltas.reduce((s, q) => s + Number(q.monto_usd), 0));
  await logLeadEvent(leadId, 'Baja del cliente', `Se deshizo la baja: ${usd(total)} (${cuales(vueltas)}) vuelven a ser deuda, con su vencimiento.`, autor);
  return { ok: true, cuotas: vueltas.length, usd: total, resumen: `Se deshizo la baja: ${usd(total)} vuelven a ser deuda.` };
}
