'use client';

// =============================================================================
// ficha/registro-pagos — los COMPONENTES de los bloques de la tab Pagos
// =============================================================================
// Las reglas están en ./reglas-pagos.ts. Los dos archivos son del frente de Pagos (ver ./tipos.ts).
//
// HOY (14/10/2026): `oferta` es OfertaDelLead y `venta` es DealDetailsCard ENTERA, con «Editar deal →»
// abajo cuando hay deal. ⚠️ EL LINK SIGUE HASTA LA TANDA B2: se va cuando cada bloque de Pagos escriba su
// campo, porque guardar el deal hoy reemplaza sus datos enteros (§3, Pagos; §5, «El orden de "Editar deal →"»).
// Las dos puertas lo dibujan igual: en la ruta, `?edit=1` abre el editor del deal (LeadDetailBody).
// =============================================================================

import Link from '@/app/_ui/Link';
import { tieneDeal, planEnLead } from '@/lib/muestra-pagos';
import { DealDetailsCard } from '../../[id]/DealDetailsCard';
import { OfertaDelLead } from '../OfertaDelLead';
import { REGLAS_PAGOS } from './reglas-pagos';
import type { EntradaRegistro, PropsBloque } from './tipos';

/** La oferta del lead, primero (13/10/2026, Pagos punto 1): a qué oferta entró, y una nueva desde acá. */
function Oferta({ ctx }: PropsBloque) {
  return <OfertaDelLead leadId={ctx.lead.id} funnelId={ctx.lead.funnel_id ?? null} onCambio={ctx.releer} />;
}

/**
 * El deal entero. ⚠️ `onCambio`: en el pop-up el lead es estado de cliente (getLeadFullAction) y el refresh
 * de la tarjeta no lo alcanza; se aplica lo que la action devolvió (el asistente de «Completar datos» se
 * arma con ESTE lead) y se relee el resto.
 */
function Venta({ ctx }: PropsBloque) {
  const { lead, data } = ctx;
  const conDeal = tieneDeal({ estado: lead.estado_lead, etapa: ctx.etapa, cuotas: data.pagos.length, planEnLead: planEnLead(lead) });
  return (
    <>
      <DealDetailsCard lead={lead} pagos={data.pagos} onCambio={(patch) => ctx.parchear(patch)} />
      {conDeal && <Link href={`/crm/${lead.id}?tab=cobranza&edit=1`} style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>Editar deal →</Link>}
    </>
  );
}

export const REGISTRO_PAGOS: { [K in keyof typeof REGLAS_PAGOS]: EntradaRegistro } = {
  oferta: { Componente: Oferta, ...REGLAS_PAGOS.oferta },
  venta: { Componente: Venta, ...REGLAS_PAGOS.venta },
};
