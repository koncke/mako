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
 * (`useProductosDeLaFicha`). Con la lista del server, el que se mira (`vista`) si es uno agregado donde está; antes de
 * que llegue, el `?funnel=` del tablero si no es la casa.
 * ⚠️ NUNCA CAE A LA CASA porque falte el trato (revisión del 22/10/2026, A2): si la cabecera dice «Renovación» y los tratos
 * no llegaron (recién agregado, o la lectura falló), la tab muestra la renovación VACÍA y lo que se escriba va a la
 * renovación (el server valida el CRM: uno donde no está se rechaza). Antes mostraba y ESCRIBÍA el plan de la casa.
 */
export function crmEnVista(
  prod: { vista: { id: number; nombre: string; esCasa: boolean; esta: boolean } | null; idEnVista: number | null; casaId: number | null; foto: readonly { id: number; nombre: string }[] },
  _data?: Pick<LeadFullData, 'tratos'>,
): { id: number; nombre: string } | null {
  if (prod.vista) return !prod.vista.esCasa && prod.vista.esta ? { id: prod.vista.id, nombre: prod.vista.nombre } : null;
  const id = prod.idEnVista;
  if (id == null || id === prod.casaId) return null;
  return { id, nombre: prod.foto.find((p) => p.id === id)?.nombre ?? '' };
}

/**
 * ¿Mira un CRM agregado cuyo trato NO se pudo leer? La tab lo avisa y no ofrece escribir (segunda revisión del 22/10/2026):
 * armar un plan o cargar el monto sobre un trato que no se vio podía pisar uno que existe.
 */
export const sinTratoLeido = (ctx: Pick<CtxFicha, 'crm' | 'data'>): boolean => !!ctx.crm && !ctx.data?.tratos;

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
