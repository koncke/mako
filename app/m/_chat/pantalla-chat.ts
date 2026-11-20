// =============================================================================
// Lo que decide PantallaChatM sin DOM (13/11/2026): para que un test lo corra (el componente importa su .css)
// =============================================================================

import { proyectar } from '@/app/m/_ui/gestos';

/** Lo que scrollea en una conversación (la de una hoja, o la de la pantalla). Para `closest`. */
export const CUERPO_CHAT = '.m-sheet__cuerpo, .m-chat__cuerpo';
/** Desde dónde se puede deslizar para volver: el borde izquierdo, como en el iPhone. */
export const BORDE_PX = 24;
/** Lo que hay que llevarla (o proyectar con la velocidad) para que se cierre al soltar. */
export const UMBRAL_CIERRE = 0.35;

/**
 * ¿La línea debajo de la cabecera (./AvisoDeIA.tsx) dice «Conectar»? Lo mismo que la caja de escritorio (PiezasCliente.tsx →
 * CajaDelCliente): sólo sin su IA. Hasta el 20/11/2026 también decía «Descarga MaKo en tu computadora» sin la app de escritorio;
 * ningún chat la pide desde ese día (lib/chat-mako-reglas.ts). null = todavía no se sabe: nada.
 */
export function avisoDeIA(iaConectada: boolean | null | undefined): boolean {
  return iaConectada === false;
}

/** ¿Se cierra al soltar? Llevada más del 35 % del ancho, o soltada con un envión que la llevaría ahí (la proyección de Apple, ./../_ui/gestos.ts). */
export function cierraAlSoltar(llevada: number, ancho: number, velocidad: number): boolean {
  if (ancho <= 0) return false;
  return llevada + Math.max(0, proyectar(velocidad)) > ancho * UMBRAL_CIERRE;
}
