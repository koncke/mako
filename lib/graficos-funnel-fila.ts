// =============================================================================
// graficos-funnel-fila — en qué funnels está la fila de un LEAD del Dashboard, y de cuál es su venta
// =============================================================================
// Lo arma `filasLeads` (lib/graficos-datos.ts) para cada lead, y lo lee SÓLO el filtro (`filtrarFilas`,
// lib/graficos-agregar.ts). Es puro (sin base) para que un test lo EJECUTE: tests/graficos-venta-en-su-funnel.test.ts.
//
// Dos preguntas, cada una con su campo (AGENTS.md, «"No puedo hacer X con este dato" no es "este dato es falso"»):
//   · `m.producto`: en qué OTROS funnels estaba el lead el día de la fila (los de `lead_funnel` agregados ese día o antes).
//     Con eso, filtrar por «Renovación» trae a los que están ahí aunque su casa sea otra (17/10/2026).
//   · `duenoDe.producto`: de qué funnel es la VENTA de la fila. Hasta el 18/11/2026 era siempre la casa (`soloCasa` a secas):
//     filtrada por un funnel agregado, la hoja por fecha de cierre ponía la venta en 0, y los OKR la ponían en el agregado
//     (`funnelDelMomento`: el último funnel al que se agregó al lead el día del cierre o antes). El número del OKR y la hoja
//     decían dos cosas sobre la misma venta. Ahora, en la hoja POR FECHA DE CIERRE, la venta es del funnel que dice
//     `funnelDelMomento` sobre la MISMA fecha (la regla de lib/funnels-elegidos.ts, la que usan los OKR y los pagos).
//
// ⚠️ SÓLO POR FECHA DE CIERRE. Por fecha de alta o de agenda la fila es la de ESE día (una cohorte), y la venta de esa
//    cohorte sigue en su casa: si se la diera al funnel del cierre, con un lead que se agregó DESPUÉS del alta la venta
//    no saldría en ninguna hoja filtrada (no está en la de su casa y el lead no está en la del agregado ese día).
// ⚠️ La venta de la casa no es la de un CRM agregado (CO2, mig 0324: esa vive en `lead_funnel` y la cuentan los OKR por su
//    lado, `ventasDeCrms`). Acá sólo se decide de qué funnel es `leads.monto_cierre_usd`.
// =============================================================================

import { funnelDelMomento } from './funnels-elegidos';

/** Las métricas de la fila que son de la VENTA (y lo cobrado por ella): van al funnel dueño de la venta. */
export const METRICAS_DE_LA_VENTA = ['cierres', 'vendido', 'cobrado', 'dias_ciclo', 'con_ciclo', 'dias_ciclo_cierre', 'con_ciclo_cierre'] as const;

/**
 * Un funnel al que se agregó al lead, como lo lee `funnelsAgregados` (lib/graficos-lectura.ts): su nombre, el DÍA en que
 * se lo agregó (en la zona de la app, para el `m`), su id y el timestamp crudo (para `funnelDelMomento`, como los OKR).
 */
export type AgregadoDeLead = { nombre: string; desde: string; funnel: number; creado: string };

/** Lo que la fila de un lead lleva de sus funnels (se esparce en la fila). Vacío = sólo su casa. */
export type FunnelsDeFila = { m?: Record<string, readonly string[]>; soloCasa?: readonly string[]; duenoDe?: Record<string, string> };

export function funnelsDeLaFilaDeLead(p: {
  /** La fecha de la hoja: 'alta', 'agenda' o 'cierre'. */
  fecha: string;
  /** El día de la fila (YYYY-MM-DD) o null. */
  dia: string | null;
  /** La casa del lead, cruda (`leads.funnel_id`; null = el funnel del negocio). */
  casa: number | null;
  /** Lo que la hoja escribe de la casa (`rotulosDelCrm().producto(casa)`). */
  casaNombre: string | null;
  agregados: readonly AgregadoDeLead[];
  /** La fila es una venta (`gano`). */
  vendio: boolean;
  /** `leads.fecha_cierre`. */
  fechaCierre: string | null;
  /** El nombre de un funnel por su id (el mismo de la casa). */
  nombreDe: (id: number | null) => string | null;
}): FunnelsDeFila {
  const dia = p.dia;
  const tambien = dia ? p.agregados.filter((a) => a.nombre !== p.casaNombre && !!a.desde && a.desde <= dia).map((a) => a.nombre) : [];
  let dueno: string | null = null;
  if (p.fecha === 'cierre' && p.vendio && p.fechaCierre && p.agregados.length) {
    const id = funnelDelMomento(p.casa, p.agregados.map((a) => ({ funnel: a.funnel, desde: a.creado || a.desde })), p.fechaCierre);
    const nombre = id === p.casa ? p.casaNombre : p.nombreDe(id);
    if (nombre && nombre !== p.casaNombre) {
      dueno = nombre;
      // Ya está en `tambien` (se agregó ese día o antes): esto es por si los dos relojes no dan el mismo día.
      if (!tambien.includes(nombre)) tambien.push(nombre);
    }
  }
  if (!tambien.length) return {};
  return { m: { producto: tambien }, soloCasa: METRICAS_DE_LA_VENTA, ...(dueno ? { duenoDe: { producto: dueno } } : {}) };
}
