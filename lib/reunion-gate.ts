// =============================================================================
// reunion-gate — el freno de scope del Perro por TIPO de reunión (punto 8), PURO
// =============================================================================
// Lo que pidió Martín: si le cargás al plan de EJECUCIÓN una llamada de VENTAS o de
// ENTREGA de servicio, el Perro FRENA — porque de una llamada de ventas salen tareas
// que no tienen NADA que ver con el scope del plan (seguir un lead, mandar la
// propuesta), y hoy el Perro las ejecuta igual. Con la clasificación del punto 10 ya
// sabemos el tipo, así que el freno es determinístico y barato (sin IA).
//
// NO bloquea: advierte y pide confirmación explícita. El usuario decide (a veces una
// llamada de ventas SÍ deja una tarea propia legítima: "grabar mejor el pitch").
// =============================================================================

import type { TipoReunion } from './reunion-clasificar';

export type FrenoScope = { frena: boolean; titulo: string; detalle: string } | null;

/** ¿El Perro frena cargar esta reunión al plan de ejecución, según su tipo? */
export function frenoDeScope(tipo: TipoReunion): FrenoScope {
  if (tipo === 'ventas') {
    return {
      frena: true,
      titulo: 'Esto parece una llamada de VENTAS',
      detalle: 'De una llamada de ventas suelen salir tareas de seguimiento del lead (mandar la propuesta, agendar la R2), no tareas de tu plan de ejecución. ¿Seguro querés cargarlas acá? Revisá que sean tuyas de verdad.',
    };
  }
  if (tipo === 'entrega') {
    return {
      frena: true,
      titulo: 'Esto parece una llamada de ENTREGA de servicio',
      detalle: 'De una llamada de entrega salen tareas para ESE cliente (customer success), no para tu plan. ¿Seguro querés cargarlas a tu tablero? Ojo con mezclar el trabajo de un cliente con tu ejecución.',
    };
  }
  return null; // equipo / otra: no frena
}
