// =============================================================================
// Media Buyer — lo que trae cada plan de MaKo (PURO: lo prueban los tests)
// =============================================================================
// El Cerebro, 25/10/2026: «el plan ESENCIAL suma el Media Buyer en modo "propone", con 2 recomendaciones por día y SIN
// piloto automático. Pro lo tiene entero, con piloto automático opcional y apagado de entrada» (el cupo del plan de entrada
// de AdAmigo). El número NO se escribe acá: sale de la tabla de topes de Planes (lib/topes-plan.ts,
// `ads.recomendaciones_dia`), la misma que lee la vitrina de /planes.
//
// ⚠️ SÓLO AL ESENCIAL QUE MaKo COBRA POR LA PASARELA (lib/plan-esencial.ts → `esEsencialDe`): el ws1, la plataforma, los
//    acuerdos a mano y el Pro no tienen cupo. Ante la duda, sin cupo (la regla de lib/plan-esencial.ts).
// ⚠️ El piloto automático va con el cupo: un plan con tope de recomendaciones es un plan donde una persona decide cada una.
// =============================================================================

import { topeDe } from '@/lib/topes-plan';
import type { Tactica } from './tipos';

export type CupoMediaBuyer = {
  /** Cuántas recomendaciones nuevas por día. null = sin tope. */
  recomendacionesDia: number | null;
  /** ¿Puede prender el piloto automático? */
  piloto: boolean;
};

export function cupoDelPlan(esEsencial: boolean): CupoMediaBuyer {
  if (!esEsencial) return { recomendacionesDia: null, piloto: true };
  const tope = topeDe('completo', 'ads.recomendaciones_dia');
  return { recomendacionesDia: tope, piloto: tope == null };
}

/** El modo que vale de verdad: un negocio que pasó de Pro a Esencial con el piloto prendido queda en «propone». */
export const modoEfectivo = (modo: 'propone' | 'piloto', cupo: CupoMediaBuyer): 'propone' | 'piloto' =>
  modo === 'piloto' && cupo.piloto ? 'piloto' : 'propone';

// Con el cupo lleno entra primero lo que CUIDA la plata (apagar lo que la quema), después lo que la mueve hacia lo que
// funciona, y al final lo que prende cosas.
const PRIORIDAD: Record<Tactica, number> = { hasta: -1, stop_loss: 0, calidad: 1, sunsetting: 2, surf: 3, ganador: 4, revive: 5, manual: 6 };

/**
 * Las propuestas en el orden en que entran al cupo, y cuántos lugares quedan hoy. `yaHoy` cuenta lo que el agente ya
 * recomendó hoy (cualquier estado: una descartada también fue una recomendación del día).
 */
export function ordenDelCupo<T extends { tactica: Tactica }>(nuevas: readonly T[], yaHoy: number, cupo: number | null): { orden: T[]; lugares: number } {
  const orden = [...nuevas].sort((a, b) => PRIORIDAD[a.tactica] - PRIORIDAD[b.tactica]);
  return { orden, lugares: cupo == null ? Infinity : Math.max(0, cupo - yaHoy) };
}

/**
 * Lo que el Media Buyer recomendó HOY: su clave termina en el día (motor.ts: `táctica:nivel:entidad:día`). Las subidas a mano
 * no cuentan; lo de los agentes propios SÍ (táctica `manual`, clave `propia:…`): ocupan el cupo de la corrida, y sin contarlos
 * cada «Analizar» de más dejaba otras tantas (revisión de tren-l, falla 9).
 */
export const recomendadasHoy = (decisiones: readonly { clave: string; tactica: Tactica }[], hoy: string): number =>
  // La pausa por fecha de fin no es una recomendación (es la regla de la persona): no ocupa el cupo.
  decisiones.filter((d) => d.tactica !== 'hasta' && (d.tactica !== 'manual' || d.clave.startsWith('propia:')) && d.clave.endsWith(`:${hoy}`)).length;

export const textoCupo = (n: number): string =>
  `Tu plan trae ${n} ${n === 1 ? 'recomendación' : 'recomendaciones'} por día. Pasa a MaKo Pro para tenerlas todas y el piloto automático.`;
