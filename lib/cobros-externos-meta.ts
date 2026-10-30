// =============================================================================
// cobros-externos-meta — la compra de una venta EXTERNA a Meta, desde el aviso y desde el cron (28/10/2026, MAU-10)
// =============================================================================
// La venta de un Payment Link propio del negocio (lib/cobros-externos-reglas.ts) le avisa la compra a Meta por CAPI. La mandaba
// sólo el aviso de Stripe, al final: si la venta se cortaba en la cuota con un error que reintentar no arregla (la ruta contesta
// 200 y Stripe no vuelve), el cron reparaba la cuota y la compra no salía nunca (la verificación de 3ca2d8328). Por eso vive
// acá: la llaman `ventaExternaStripe` (lib/cobros-webhook.ts) y `reconciliarCobros` (lib/cobros.ts).
// =============================================================================

import 'server-only';
import { getTenantDb, runWithWorkspace } from './workspace';
import { getLead, logLeadEvent } from './leads';
import { compraDelCobroExterno, lineaCompraEnMeta, type CompraExterna } from './cobros-externos-reglas';
import type { Cobro } from './cobros-tipos';

/**
 * La compra a Meta por CAPI (Zernio primero), al píxel del SITIO y como evento de la página: así deduplica con la del navegador, que
 * manda el mismo `purchase:<cs_…>` (el Pixel de MaKo v28; el id lo decidió el Cerebro el 27/10/2026). Con lead, UNA vez: la línea
 * fija del historial (`lineaCompraEnMeta`) la marca, y un reintento, el cron o el script no la repiten. Corre dentro del
 * `runWithWorkspace` del negocio (sin él, el píxel sale `sin_pixel` sin rastro). Nunca tira.
 */
export async function avisarCompraAMeta(compra: CompraExterna, cuando: string | Date | null | undefined, leadId: number | null): Promise<string> {
  try {
    const linea = lineaCompraEnMeta(compra.eventId);
    if (leadId != null) {
      const { data } = await (await getTenantDb()).from('lead_audit').select('id').eq('lead_id', leadId).eq('valor_nuevo', linea).limit(1);
      if ((data ?? []).length) return 'la compra ya estaba en Meta';
    }
    const [{ EVENTO_COMPRA }, { sendMetaCAPIEvent }] = await Promise.all([import('./meta-capi-payload'), import('./meta-capi')]);
    const r = await sendMetaCAPIEvent({
      eventName: EVENTO_COMPRA, email: compra.email, phone: compra.phone, eventId: compra.eventId,
      eventTime: cuando ?? new Date(), customData: { value: compra.value, currency: compra.currency },
      // Al píxel del sitio (no al conjunto de datos de CRM) y como evento de la página: así deduplica con el del navegador.
      soloPixel: true, actionSource: 'website',
    });
    if (leadId != null) await logLeadEvent(leadId, 'Meta', r.ok ? linea : `Meta no recibió la compra (${compra.eventId}): ${r.motivo}`, 'MaKo');
    return r.ok ? 'compra enviada a Meta' : `Meta no recibió la compra (${r.motivo})`;
  } catch (e) {
    return `no pude avisarle la compra a Meta (${e instanceof Error ? e.name : 'error'})`;
  }
}

/**
 * La compra que le FALTÓ a Meta de un cobro externo ya guardado (el cron). Se intenta UNA vez por venta: si el historial del lead
 * ya dice algo de esta compra («Meta recibió…» o «Meta no recibió…»), no se vuelve a mandar; así un negocio sin píxel no junta una
 * línea por cada pasada del cron. Devuelve qué pasó, o null si no correspondía. Nunca tira.
 */
export async function compraExternaQueFalto(c: Cobro): Promise<string | null> {
  const compra = compraDelCobroExterno(c);
  const leadId = c.lead_id;
  if (!compra || leadId == null) return null;
  try {
    return await runWithWorkspace(c.workspace_id, async () => {
      const { data, error } = await (await getTenantDb()).from('lead_audit').select('valor_nuevo').eq('lead_id', leadId).eq('campo', 'Meta');
      if (error) return null;
      if ((data ?? []).some((f) => String((f as { valor_nuevo: unknown }).valor_nuevo ?? '').includes(`(${compra.eventId})`))) return null;
      const lead = await getLead(leadId).catch(() => null);
      return avisarCompraAMeta({ ...compra, phone: lead?.telefono ?? null }, c.pagado_at, leadId);
    });
  } catch (e) {
    return `no pude avisarle la compra a Meta (${e instanceof Error ? e.name : 'error'})`;
  }
}
