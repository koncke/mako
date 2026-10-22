// =============================================================================
// ficha/pagos/trato — la tab Pagos mirando un CRM agregado muestra el trato de ESE CRM (22/10/2026, mig 0324)
// =============================================================================
// La llamada con un cliente del 22/10/2026: en el CRM de renovaciones, la tab Pagos mostraba el plan del primer
// servicio. El modelo está en lib/pagos-crm.ts. Acá se arma el `CtxFicha` que leen los bloques de PLATA de Pagos
// (./bloques-cobro.tsx, por `conTrato` en ../registro-pagos.tsx) cuando la ficha mira un CRM agregado (`ctx.crm`):
//   · `lead`: la venta, el plan y si está ganado son los de ese CRM (`leadConTrato`);
//   · `data.pagos`: los de ese CRM (`data.tratos`, que trae getLeadFullAction);
//   · `etapa`: la del lead en ese CRM;
//   · `parchear`: relee (un parche iría a la fila del lead, que no es la de este trato).
// Con la casa en vista (`ctx.crm` null) devuelve el mismo ctx: nada cambia para quien no tiene otro CRM.
// Los bloques del deal (contrato, datos fiscales…) siguen siendo del lead: no pasan por acá.
//
// Puro y sin 'use client': lo usan los componentes y las reglas (`estaVacio`), y un test lo ejecuta.
// =============================================================================

import { leadConTrato } from '@/lib/pagos-crm';
import type { LeadFullData } from '@/app/crm/actions';
import type { CtxFicha } from '../tipos';

/**
 * El CRM agregado que mira la ficha, para `FichaPorBloques` (las dos puertas): el del desplegable de la cabecera
 * (`useProductosDeLaFicha`: el `?funnel=` del tablero o el que se eligió). Sólo si el lead TIENE un trato ahí
 * (`data.tratos`): la casa, o un CRM donde no está, es null. No espera a la lista de productos del server: los tratos ya
 * vinieron con la ficha, así la tab no muestra un instante el plan de la casa.
 */
export function crmEnVista(prod: { idEnVista: number | null; casaId: number | null; foto: readonly { id: number; nombre: string }[] }, data: Pick<LeadFullData, 'tratos'>): { id: number; nombre: string } | null {
  const id = prod.idEnVista;
  if (id == null || id === prod.casaId || !data.tratos?.some((t) => t.funnelId === id)) return null;
  return { id, nombre: prod.foto.find((p) => p.id === id)?.nombre ?? '' };
}

export function ctxDelTrato(ctx: CtxFicha): CtxFicha {
  const crm = ctx.crm ?? null;
  if (!crm) return ctx;
  const t = ctx.data?.tratos?.find((x) => x.funnelId === crm.id) ?? null;
  return {
    ...ctx,
    lead: leadConTrato(ctx.lead, t),
    etapa: t?.etapa ?? ctx.etapa,
    data: { ...ctx.data, pagos: t?.pagos ?? [] },
    parchear: () => ctx.releer(),
  };
}
