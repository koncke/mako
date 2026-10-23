// =============================================================================
// Los topes del plan en el CRM: la decisión, pura (23/10/2026). La lectura y el freno, en lib/topes-crm.ts.
// =============================================================================

import { cabeOtra } from './topes-plan';

export type TopeCrm = 'crm.leads' | 'crm.funnels';
/** Lo que se sabe del negocio: su capa, su tope y cuánto usa. null = no se le aplica tope. */
export type EstadoTope = { capa: string; tope: number; usadas: number } | null;

/** ¿Llegó al tope? Para el cartel del tablero: lo que entra solo pudo pasarlo, y se avisa igual. */
export const enElTope = (e: EstadoTope, cual: TopeCrm): boolean => !!e && !cabeOtra(e.capa, cual, e.usadas);

/** ¿Un alta a mano de `nuevos` lo pasaría? (2.000 de tope y 1.996 usados: 4 entran, 5 no.) */
export const pasaElTope = (e: EstadoTope, cual: TopeCrm, nuevos = 1): boolean =>
  !!e && nuevos > 0 && !cabeOtra(e.capa, cual, e.usadas + nuevos - 1);
