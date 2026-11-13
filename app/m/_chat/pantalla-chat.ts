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
 * Qué le falta para que MaKo conteste, en la línea debajo de la cabecera (./AvisoDeIA.tsx). Lo mismo que la caja de escritorio
 * (PiezasCliente.tsx → CajaDelCliente): sin la app, la franja; sin su IA, «Conectar»; con la app que bloquea, sin «Conectar» (no
 * destraba nada: la caja misma ya dice «Instalar MaKo»). null = nada que decir.
 */
export function avisoDeIA(app: string | null | undefined, iaConectada: boolean | null | undefined): { texto: 'app' | 'ia'; conectar: boolean } | null {
  const sinApp = app === 'en-la-computadora';
  const conectar = iaConectada === false && app !== 'bloquea';
  if (!sinApp && !conectar) return null;
  return { texto: sinApp ? 'app' : 'ia', conectar };
}

/** ¿Se cierra al soltar? Llevada más del 35 % del ancho, o soltada con un envión que la llevaría ahí (la proyección de Apple, ./../_ui/gestos.ts). */
export function cierraAlSoltar(llevada: number, ancho: number, velocidad: number): boolean {
  if (ancho <= 0) return false;
  return llevada + Math.max(0, proyectar(velocidad)) > ancho * UMBRAL_CIERRE;
}
