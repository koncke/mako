'use client';

// =============================================================================
// ficha/registro-pagos — los COMPONENTES de los bloques de la tab Pagos
// =============================================================================
// Las reglas están en ./reglas-pagos.ts. Los dos archivos son del frente de Pagos (ver ./tipos.ts).
//
// 16/10/2026: la tab se rehizo en bloques. Hasta acá `venta` era DealDetailsCard ENTERA con «Editar deal →» abajo.
// Ahora cada bloque es una pieza propia y escribe su campo (app/crm/[id]/pagos-campo-actions.ts), y «Editar deal →»
// ya no se dibuja en la ficha. DealDetailsCard sigue viva sólo para la tab Pagos de Customer Success, que todavía
// no está en bloques (docs/hallazgos-pagos.md, «Lo que quedó sin hacer»).
//   · los de plata, en ./pagos/bloques-cobro.tsx: estado de cuenta, cuotas, links, movimientos, suscripción y venta;
//   · los del deal, en ./pagos/bloques-deal.tsx: contrato, datos fiscales, servicio, promesa y obligaciones.
// =============================================================================

import { OfertaDelLead } from '../OfertaDelLead';
import { REGLAS_PAGOS } from './reglas-pagos';
import { Cuotas, EstadoDeCuenta, LinksDePago, Movimientos, Suscripcion, Venta } from './pagos/bloques-cobro';
import { Contrato, DatosFiscales, Obligaciones, PromesaYGarantia, ServicioVendido } from './pagos/bloques-deal';
import type { EntradaRegistro, PropsBloque } from './tipos';

/** La oferta del lead, primero (13/10/2026, Pagos punto 1): a qué oferta entró, y una nueva desde acá. */
function Oferta({ ctx }: PropsBloque) {
  return <OfertaDelLead leadId={ctx.lead.id} funnelId={ctx.lead.funnel_id ?? null} onCambio={ctx.releer} />;
}

export const REGISTRO_PAGOS: { [K in keyof typeof REGLAS_PAGOS]: EntradaRegistro } = {
  oferta: { Componente: Oferta, ...REGLAS_PAGOS.oferta },
  'links-de-pago': { Componente: LinksDePago, ...REGLAS_PAGOS['links-de-pago'] },
  venta: { Componente: Venta, ...REGLAS_PAGOS.venta },
  cobrado: { Componente: EstadoDeCuenta, ...REGLAS_PAGOS.cobrado },
  cuotas: { Componente: Cuotas, ...REGLAS_PAGOS.cuotas },
  movimientos: { Componente: Movimientos, ...REGLAS_PAGOS.movimientos },
  suscripcion: { Componente: Suscripcion, ...REGLAS_PAGOS.suscripcion },
  contrato: { Componente: Contrato, ...REGLAS_PAGOS.contrato },
  'datos-fiscales': { Componente: DatosFiscales, ...REGLAS_PAGOS['datos-fiscales'] },
  'servicio-vendido': { Componente: ServicioVendido, ...REGLAS_PAGOS['servicio-vendido'] },
  'promesa-y-garantia': { Componente: PromesaYGarantia, ...REGLAS_PAGOS['promesa-y-garantia'] },
  obligaciones: { Componente: Obligaciones, ...REGLAS_PAGOS.obligaciones },
};
