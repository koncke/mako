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
//   · los de plata, en ./pagos/bloques-cobro.tsx: estado de cuenta, cuotas, links, movimientos y venta;
//   · (5/11/2026) la suscripción, mes a mes, en ./pagos/suscripcion.tsx (docs/investigacion-suscripciones.md);
//   · los del deal, en ./pagos/bloques-deal.tsx: contrato, datos fiscales, servicio, promesa y obligaciones.
// =============================================================================

import type { ComponentType } from 'react';
import { OfertaDelLead } from '../OfertaDelLead';
import { REGLAS_PAGOS } from './reglas-pagos';
import { Cuotas, EstadoDeCuenta, LinksDePago, Movimientos, Venta } from './pagos/bloques-cobro';
import { SuscripcionMesAMes } from './pagos/suscripcion';
import { Contrato, DatosFiscales, Obligaciones, PromesaYGarantia, ServicioVendido } from './pagos/bloques-deal';
import { ctxDelTrato } from './pagos/trato';
import type { CtxFicha, EntradaRegistro, PropsBloque, ReglasBloque } from './tipos';

/**
 * Un bloque de PLATA que, mirando un CRM agregado (una renovación), dibuja y escribe el trato de ESE CRM (22/10/2026,
 * ./pagos/trato.ts): el componente y su `estaVacio` leen el mismo ctx. Mirando la casa, es el bloque de siempre.
 */
function delTrato(C: ComponentType<PropsBloque>, r: ReglasBloque): EntradaRegistro {
  function ConTrato(props: PropsBloque) { return <C {...props} ctx={ctxDelTrato(props.ctx)} />; }
  const vacio = r.estaVacio;
  return { Componente: ConTrato, ...r, ...(vacio ? { estaVacio: (ctx: CtxFicha, p: Parameters<typeof vacio>[1]) => vacio(ctxDelTrato(ctx), p) } : {}) };
}

/** La oferta del lead, primero (13/10/2026, Pagos punto 1): a qué oferta entró, y una nueva desde acá. */
function Oferta({ ctx }: PropsBloque) {
  return <OfertaDelLead leadId={ctx.lead.id} funnelId={ctx.lead.funnel_id ?? null} onCambio={ctx.releer} />;
}

export const REGISTRO_PAGOS: { [K in keyof typeof REGLAS_PAGOS]: EntradaRegistro } = {
  oferta: { Componente: Oferta, ...REGLAS_PAGOS.oferta },
  'links-de-pago': { Componente: LinksDePago, ...REGLAS_PAGOS['links-de-pago'] },
  venta: delTrato(Venta, REGLAS_PAGOS.venta),
  cobrado: delTrato(EstadoDeCuenta, REGLAS_PAGOS.cobrado),
  cuotas: delTrato(Cuotas, REGLAS_PAGOS.cuotas),
  movimientos: delTrato(Movimientos, REGLAS_PAGOS.movimientos),
  suscripcion: delTrato(SuscripcionMesAMes, REGLAS_PAGOS.suscripcion),
  contrato: { Componente: Contrato, ...REGLAS_PAGOS.contrato },
  'datos-fiscales': { Componente: DatosFiscales, ...REGLAS_PAGOS['datos-fiscales'] },
  'servicio-vendido': { Componente: ServicioVendido, ...REGLAS_PAGOS['servicio-vendido'] },
  'promesa-y-garantia': { Componente: PromesaYGarantia, ...REGLAS_PAGOS['promesa-y-garantia'] },
  obligaciones: { Componente: Obligaciones, ...REGLAS_PAGOS.obligaciones },
};
