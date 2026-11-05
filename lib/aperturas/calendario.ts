// =============================================================================
// La apertura del Calendario: lo que MaKo pregunta primero en su estrella (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Calendario»), T9. Con Google YA conectado y la primera semana sin estrenar (`cal_semana`
// pendiente: nunca anotó nada en el Calendario), MaKo pregunta un HECHO, «¿Tienes alguna llamada esta semana?»; «Sí» abre el alta
// de una llamada de la tab (AgendarLlamada: el link de su agenda o anotarla ahí mismo, que cierra `cal_semana`).
//
// SIN GOOGLE NO SE SUMA NADA: al entrar ya salta el modal de conectar (pedido de Martín; app/calendario/CalendarioApp.tsx), y una
// guía más al entrar son dos (plan.md, trampa 25). Una lectura que no se pudo hacer (null) calla.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosCalendario = {
  /** ¿Google contestó? (`lectura.google` sólo existe si Google contestó.) null = no se sabe. */
  google: boolean | null;
  /** ¿La primera semana sigue sin estrenar (`cal_semana` pendiente)? null = no se pudo leer el estado de la tab. */
  semanaPendiente: boolean | null;
};

export const ID_SEMANA = 'calendario:semana';

/** La acción de la pantalla: abrir el alta de una llamada (la misma del «+» de «Ventas»). */
export const ACCIONES_CALENDARIO = ['agendar'] as const;
export type AccionCalendario = (typeof ACCIONES_CALENDARIO)[number];

export function aperturaCalendario(h: HechosCalendario, _r: Respuestas): Apertura<AccionCalendario> | null {
  if (h.google !== true || h.semanaPendiente !== true) return null;
  return {
    id: ID_SEMANA, alcance: 'negocio', corto: '¿Llamadas esta semana?',
    texto: 'Tu Google ya está conectado. ¿Tienes alguna llamada esta semana?',
    botones: [
      { tipo: 'hacer', rotulo: 'Sí, tengo una', accion: 'agendar' },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_CALENDARIO: Superficie<HechosCalendario, AccionCalendario> = { id: 'calendario', acciones: ACCIONES_CALENDARIO, apertura: aperturaCalendario };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_SEMANA, cuando: 'Con Google conectado y la primera semana sin estrenar.' },
];

export const EJEMPLOS: readonly { nombre: string; h: HechosCalendario; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'Google conectado, sin nada anotado', h: { google: true, semanaPendiente: true }, r: {}, espera: ID_SEMANA, primerPaso: true },
  { nombre: 'sin Google: ya salta el modal de conectar', h: { google: false, semanaPendiente: true }, r: {}, espera: null },
  { nombre: 'ya estrenó la semana', h: { google: true, semanaPendiente: false }, r: {}, espera: null },
  { nombre: 'no se pudo leer el estado', h: { google: true, semanaPendiente: null }, r: {}, espera: null },
];
